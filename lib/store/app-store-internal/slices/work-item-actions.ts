"use client"

import { differenceInCalendarDays } from "date-fns"
import { toast } from "sonner"

import {
  syncCreateLabel,
  syncUpdateLabel,
  syncCreateWorkItem,
  syncDeleteWorkItem,
  syncShiftTimelineItem,
  syncSetWorkItemSubscription,
  syncUpdateWorkItem,
} from "@/lib/convex/client"
import {
  addLocalCalendarDays,
  formatLocalCalendarDate,
  shiftCalendarDate,
} from "@/lib/calendar-date"
import {
  getLabelsForWorkspace,
  hasWorkspaceAccess,
} from "@/lib/domain/selectors"
import {
  formatWorkItemKey,
  PRIVATE_WORK_ITEM_KEY_PREFIX,
} from "@/lib/domain/work-item-key"
import {
  buildWorkItemAssignmentNotificationMessage,
  buildWorkItemStatusChangeNotificationMessage,
} from "@/lib/domain/notification-copy"
import {
  getAllowedWorkItemTypesForTemplate,
  statusMeta,
  workItemSchema,
} from "@/lib/domain/types"
import {
  haveSameWorkItemAssigneeIds,
  getResolvedWorkItemMutationAssigneeIds,
  getWorkItemAssigneeFields,
  getWorkItemAssigneeIds,
} from "@/lib/domain/work-item-assignees"
import { getBrowserTimeZone, normalizeTimeZone } from "@/lib/time-zone"

import {
  createId,
  createNotification,
  getNow,
  toTeamKeyPrefix,
} from "../helpers"
import { registerPendingWorkItemCreation } from "../pending-work-item-creations"
import {
  effectiveRole,
  getProjectCascadeConfirmationForWorkItemUpdate,
  getProjectsForTeamScope,
  getResolvedProjectLinkForWorkItemUpdate,
  getWorkItemCascadeDeletePlan,
  getWorkItemValidationMessage,
} from "../validation"
import type { AppStore } from "../types"
import type { WorkSlice, WorkSliceFactoryArgs } from "./work-shared"

type CreateWorkItemInput = Parameters<AppStore["createWorkItem"]>[0]
type UpdateWorkItemPatch = Parameters<AppStore["updateWorkItem"]>[1]
type LocalWorkItemPatch = Omit<UpdateWorkItemPatch, "expectedUpdatedAt">
type WorkItem = AppStore["workItems"][number]
type WorkItemDocument = AppStore["documents"][number]
type WorkItemNotification = AppStore["notifications"][number]
type WorkItemActivity = AppStore["workItemActivities"][number]
type CreateWorkItemDates = {
  dueDate: string
  endTime: string | null
  scheduleTimeZone: string | null
  startDate: string
  startTime: string | null
  targetDate: string
}
type CreateWorkItemScope = {
  keyPrefix: string
  nextNumber: number
  parent: AppStore["workItems"][number] | null
  resolvedPrimaryProjectId: string | null
  team: AppStore["teams"][number] | null
  workspaceId: string
}
type WorkItemDeletePlan = NonNullable<
  ReturnType<typeof getWorkItemCascadeDeletePlan>
>
type WorkItemDeletePreviousState = Pick<
  AppStore,
  | "attachments"
  | "comments"
  | "documents"
  | "notifications"
  | "workItemActivities"
  | "workItems"
>

function getCreateWorkItemScopeAccessError(input: {
  input: CreateWorkItemInput
  isPrivate: boolean
  state: AppStore
  team: AppStore["teams"][number] | null
  workspaceId: string
}) {
  if (input.isPrivate) {
    if (input.input.teamId) {
      return "Private tasks cannot belong to a team"
    }

    return hasWorkspaceAccess(
      input.state,
      input.workspaceId,
      input.state.currentUserId
    )
      ? null
      : "You do not have access to this workspace"
  }

  if (!input.team) {
    return "Team not found"
  }

  const role = input.input.teamId
    ? effectiveRole(input.state, input.input.teamId)
    : null

  return role === "viewer" || role === "guest" || !role
    ? "Your current role is read-only"
    : null
}

function getCreateWorkItemScopeItems(
  state: AppStore,
  input: CreateWorkItemInput,
  isPrivate: boolean
) {
  return state.workItems.filter((item) =>
    isPrivate
      ? (item.visibility ?? "team") === "private" &&
        item.creatorId === state.currentUserId &&
        item.workspaceId === input.workspaceId
      : item.teamId === input.teamId &&
        (item.visibility ?? "team") !== "private"
  )
}

function getCreateWorkItemPrimaryProjectId(
  input: CreateWorkItemInput,
  isPrivate: boolean,
  parent: WorkItem | null
) {
  if (isPrivate) {
    return null
  }

  return parent ? (parent.primaryProjectId ?? null) : input.primaryProjectId
}

function canDeleteWorkItem(state: AppStore, deletionPlan: WorkItemDeletePlan) {
  if ((deletionPlan.item.visibility ?? "team") === "private") {
    const workspaceId = deletionPlan.item.workspaceId ?? null

    if (
      deletionPlan.item.creatorId === state.currentUserId &&
      workspaceId &&
      hasWorkspaceAccess(state, workspaceId, state.currentUserId)
    ) {
      return true
    }

    toast.error("Work item not found")
    return false
  }

  if (!deletionPlan.item.teamId) {
    toast.error("Team not found")
    return false
  }

  const role = effectiveRole(state, deletionPlan.item.teamId)

  if (role === "viewer" || role === "guest" || !role) {
    toast.error("Your current role is read-only")
    return false
  }

  return true
}

function getWorkItemDeletePreviousState(
  state: AppStore
): WorkItemDeletePreviousState {
  return {
    workItems: state.workItems,
    documents: state.documents,
    comments: state.comments,
    attachments: state.attachments,
    notifications: state.notifications,
    workItemActivities: state.workItemActivities,
  }
}

function applyWorkItemCascadeDeletePlan(
  current: AppStore,
  deletionPlan: WorkItemDeletePlan
) {
  return {
    ...current,
    workItems: deletionPlan.nextWorkItems,
    documents: deletionPlan.nextDocuments,
    comments: current.comments.filter(
      (entry) => !deletionPlan.deletedCommentIds.has(entry.id)
    ),
    attachments: current.attachments.filter(
      (entry) => !deletionPlan.deletedAttachmentIds.has(entry.id)
    ),
    notifications: current.notifications.filter(
      (entry) => !deletionPlan.deletedNotificationIds.has(entry.id)
    ),
    workItemActivities: current.workItemActivities.filter(
      (entry) => !deletionPlan.deletedWorkItemActivityIds.has(entry.id)
    ),
  }
}

function getWorkItemDeleteSuccessMessage(deletionPlan: WorkItemDeletePlan) {
  return deletionPlan.deletedItemIds.size > 1
    ? `Deleted ${deletionPlan.deletedItemIds.size} items`
    : "Item deleted"
}

// Only the top-level roots are synced; the server cascades their descendants,
// so a selected id whose ancestor is also selected is dropped here to avoid
// server-side double-deletes.
function getBulkDeleteRootIds(state: AppStore, uniqueIds: string[]): string[] {
  const itemById = new Map(state.workItems.map((item) => [item.id, item]))
  const selectedIdSet = new Set(uniqueIds)

  const isTopLevelRoot = (id: string) => {
    let parentId = itemById.get(id)?.parentId ?? null
    const visited = new Set<string>()

    while (parentId && !visited.has(parentId)) {
      if (selectedIdSet.has(parentId)) {
        return false
      }

      visited.add(parentId)
      parentId = itemById.get(parentId)?.parentId ?? null
    }

    return true
  }

  return uniqueIds.filter(isTopLevelRoot)
}

type BulkWorkItemDeletePlan = {
  working: AppStore
  syncIds: string[]
  totalDeleted: number
}

// Fold each root's cascade plan against an evolving snapshot so the optimistic
// removal is order-independent. canDeleteWorkItem surfaces its own toast for
// unauthorized roots, which are skipped while the rest of the selection
// continues to process.
function planBulkWorkItemDelete(
  state: AppStore,
  rootIds: string[]
): BulkWorkItemDeletePlan {
  let working: AppStore = state
  const syncIds: string[] = []
  let totalDeleted = 0

  for (const rootId of rootIds) {
    const plan = getWorkItemCascadeDeletePlan(working, rootId)

    if (!plan || !canDeleteWorkItem(working, plan)) {
      continue
    }

    working = applyWorkItemCascadeDeletePlan(working, plan)
    syncIds.push(rootId)
    totalDeleted += plan.deletedItemIds.size
  }

  return { working, syncIds, totalDeleted }
}

function resolveCreateWorkItemDates(
  state: AppStore,
  input: CreateWorkItemInput
): CreateWorkItemDates {
  const currentUser = state.users.find(
    (user) => user.id === state.currentUserId
  )
  const fallbackScheduleTimeZone = normalizeTimeZone(
    currentUser?.preferences.timeZone,
    getBrowserTimeZone()
  )

  return {
    startDate: input.startDate ?? formatLocalCalendarDate(),
    dueDate: input.dueDate ?? addLocalCalendarDays(7),
    targetDate: input.targetDate ?? addLocalCalendarDays(10),
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    scheduleTimeZone: input.scheduleTimeZone ?? fallbackScheduleTimeZone,
  }
}

function resolveCreateWorkItemScope(
  state: AppStore,
  input: CreateWorkItemInput
): CreateWorkItemScope | null {
  const isPrivate = input.visibility === "private"
  const team = input.teamId
    ? (state.teams.find((entry) => entry.id === input.teamId) ?? null)
    : null
  const workspaceId = isPrivate
    ? (input.workspaceId ?? "")
    : (team?.workspaceId ?? "")
  const accessError = getCreateWorkItemScopeAccessError({
    input,
    isPrivate,
    state,
    team,
    workspaceId,
  })

  if (accessError) {
    toast.error(accessError)
    return null
  }

  const parent = input.parentId
    ? (state.workItems.find((item) => item.id === input.parentId) ?? null)
    : null
  const teamItems = getCreateWorkItemScopeItems(state, input, isPrivate)

  return {
    keyPrefix: isPrivate
      ? PRIVATE_WORK_ITEM_KEY_PREFIX
      : toTeamKeyPrefix(team?.name, input.teamId ?? ""),
    nextNumber: isPrivate ? teamItems.length + 1 : 1 + teamItems.length + 100,
    parent,
    resolvedPrimaryProjectId: getCreateWorkItemPrimaryProjectId(
      input,
      isPrivate,
      parent
    ),
    team,
    workspaceId,
  }
}

function buildOptimisticDescriptionDocument(input: {
  currentUserId: string
  descriptionDocId: string
  parsedInput: CreateWorkItemInput
  scope: CreateWorkItemScope
  title: string
}) {
  const now = getNow()

  return {
    id: input.descriptionDocId,
    kind: "item-description" as const,
    workspaceId: input.scope.workspaceId,
    teamId:
      input.parsedInput.visibility === "private"
        ? null
        : (input.parsedInput.teamId ?? null),
    title: `${input.title} description`,
    content: "<p></p>",
    linkedProjectIds: input.scope.resolvedPrimaryProjectId
      ? [input.scope.resolvedPrimaryProjectId]
      : [],
    linkedWorkItemIds: [],
    createdBy: input.currentUserId,
    updatedBy: input.currentUserId,
    createdAt: now,
    updatedAt: now,
  }
}

function buildOptimisticWorkItem(input: {
  currentUserId: string
  dates: CreateWorkItemDates
  descriptionDocId: string
  itemId: string
  parsedInput: CreateWorkItemInput
  scope: CreateWorkItemScope
}) {
  const now = getNow()
  const isPrivate = input.parsedInput.visibility === "private"

  return {
    id: input.itemId,
    key: formatWorkItemKey(input.scope.keyPrefix, input.scope.nextNumber),
    teamId: isPrivate ? null : (input.parsedInput.teamId ?? null),
    workspaceId: input.scope.workspaceId,
    type: input.parsedInput.type,
    title: input.parsedInput.title,
    descriptionDocId: input.descriptionDocId,
    status: input.parsedInput.status ?? ("backlog" as const),
    priority: input.parsedInput.priority,
    ...getWorkItemAssigneeFields(
      isPrivate ? [] : getResolvedWorkItemMutationAssigneeIds(input.parsedInput)
    ),
    creatorId: input.currentUserId,
    parentId: input.scope.parent?.id ?? null,
    primaryProjectId: isPrivate ? null : input.scope.resolvedPrimaryProjectId,
    linkedProjectIds: [],
    linkedDocumentIds: [],
    labelIds: input.parsedInput.labelIds ?? [],
    visibility: input.parsedInput.visibility ?? "team",
    milestoneId: null,
    startDate: input.dates.startDate,
    dueDate: input.dates.dueDate,
    targetDate: input.dates.targetDate,
    startTime: input.dates.startTime,
    endTime: input.dates.endTime,
    scheduleTimeZone: input.dates.scheduleTimeZone,
    subscriberIds: isPrivate ? [] : [input.currentUserId],
    createdAt: now,
    updatedAt: now,
  }
}

function buildCreateWorkItemNotifications(
  state: AppStore,
  input: {
    parsedInput: CreateWorkItemInput
    scope: CreateWorkItemScope
    workItemId: string
  }
) {
  const assigneeIds =
    input.parsedInput.visibility === "private"
      ? []
      : getResolvedWorkItemMutationAssigneeIds(input.parsedInput)

  if (assigneeIds.length === 0) {
    return state.notifications
  }

  const actor = state.users.find((user) => user.id === state.currentUserId)

  return [
    ...assigneeIds.map((assigneeId) =>
      createNotification(
        assigneeId,
        state.currentUserId,
        buildWorkItemAssignmentNotificationMessage(
          actor?.name ?? "Someone",
          input.parsedInput.title,
          input.scope.team?.name
        ),
        "workItem",
        input.workItemId,
        "assignment"
      )
    ),
    ...state.notifications,
  ]
}

function buildCreateWorkItemAssigneeActivity(
  state: AppStore,
  input: {
    parsedInput: CreateWorkItemInput
    workItem: WorkItem
  }
): WorkItemActivity[] {
  const toAssigneeIds =
    input.parsedInput.visibility === "private"
      ? []
      : getResolvedWorkItemMutationAssigneeIds(input.parsedInput)

  if (toAssigneeIds.length === 0) {
    return []
  }

  return [
    {
      id: createId("work_item_activity"),
      itemId: input.workItem.id,
      actorId: state.currentUserId,
      type: "assignee-change" as const,
      fromAssigneeIds: [],
      toAssigneeIds,
      createdAt: input.workItem.createdAt,
    },
  ]
}

function buildOptimisticWorkItemCreationState(
  state: AppStore,
  input: {
    dates: CreateWorkItemDates
    parsedInput: CreateWorkItemInput
  }
) {
  const scope = resolveCreateWorkItemScope(state, input.parsedInput)

  if (!scope) {
    return null
  }

  const descriptionDocId = createId("doc")
  const workItem = buildOptimisticWorkItem({
    currentUserId: state.currentUserId,
    dates: input.dates,
    descriptionDocId,
    itemId: createId("item"),
    parsedInput: input.parsedInput,
    scope,
  })
  const descriptionDoc = buildOptimisticDescriptionDocument({
    currentUserId: state.currentUserId,
    descriptionDocId,
    parsedInput: input.parsedInput,
    scope,
    title: input.parsedInput.title,
  })

  return {
    createdDescriptionDocId: descriptionDocId,
    createdItemId: workItem.id,
    state: {
      ...state,
      documents: [descriptionDoc, ...state.documents],
      notifications: buildCreateWorkItemNotifications(state, {
        parsedInput: input.parsedInput,
        scope,
        workItemId: workItem.id,
      }),
      workItemActivities: [
        ...state.workItemActivities,
        ...buildCreateWorkItemAssigneeActivity(state, {
          parsedInput: input.parsedInput,
          workItem,
        }),
      ],
      workItems: [workItem, ...state.workItems],
    },
  }
}

function reconcileCreatedWorkItem(input: {
  createdDescriptionDocId: string | null
  createdItemId: string
  result: Awaited<ReturnType<typeof syncCreateWorkItem>>
  set: WorkSliceFactoryArgs["set"]
}) {
  input.set((state) => {
    const nextDescriptionDocId =
      input.result?.descriptionDocId ?? input.createdDescriptionDocId ?? null

    return {
      ...state,
      documents: state.documents.map((document) =>
        document.id === input.createdDescriptionDocId ||
        document.id === nextDescriptionDocId
          ? {
              ...document,
              id: nextDescriptionDocId ?? document.id,
              updatedAt:
                input.result?.descriptionUpdatedAt ?? document.updatedAt,
              updatedBy: state.currentUserId,
            }
          : document
      ),
      workItems: state.workItems.map((item) =>
        item.id === input.createdItemId
          ? {
              ...item,
              descriptionDocId: nextDescriptionDocId ?? item.descriptionDocId,
              updatedAt: input.result?.itemUpdatedAt ?? item.updatedAt,
            }
          : item
      ),
    }
  })
}

function isPrivateWorkItem(item: WorkItem) {
  return (item.visibility ?? "team") === "private"
}

function getEffectiveLocalWorkItemPatch(
  existing: WorkItem,
  patch: UpdateWorkItemPatch
): LocalWorkItemPatch {
  const rawLocalPatch = { ...patch }
  delete rawLocalPatch.expectedUpdatedAt

  if (!isPrivateWorkItem(existing)) {
    return rawLocalPatch
  }

  const privatePatch = { ...rawLocalPatch }
  delete privatePatch.assigneeId
  delete privatePatch.assigneeIds
  delete privatePatch.primaryProjectId

  return {
    ...privatePatch,
    ...getWorkItemAssigneeFields([]),
    primaryProjectId: null,
  }
}

function getProjectTemplateValidationMessageForWorkItemUpdate(
  state: AppStore,
  existing: WorkItem,
  input: {
    cascadeItemIds: Set<string>
    resolvedPrimaryProjectId: string | null
    shouldCascadeProjectLink: boolean
  }
) {
  if (
    isPrivateWorkItem(existing) ||
    !existing.teamId ||
    !input.resolvedPrimaryProjectId ||
    !input.shouldCascadeProjectLink
  ) {
    return null
  }

  const project = getProjectsForTeamScope(state, existing.teamId).find(
    (entry) => entry.id === input.resolvedPrimaryProjectId
  )

  if (!project) {
    return null
  }

  return state.workItems
    .filter((item) => input.cascadeItemIds.has(item.id))
    .some(
      (item) =>
        !getAllowedWorkItemTypesForTemplate(project.templateType).includes(
          item.type
        )
    )
    ? "A work item type in this hierarchy is not allowed for the selected project template"
    : null
}

function getWorkItemUpdateProjectCascadeConfirmation(
  state: AppStore,
  existing: WorkItem,
  localPatch: LocalWorkItemPatch
) {
  return isPrivateWorkItem(existing)
    ? {
        cascadeItemIds: new Set<string>(),
        cascadeItemCount: 0,
        resolvedPrimaryProjectId: null,
        requiresConfirmation: false,
      }
    : getProjectCascadeConfirmationForWorkItemUpdate(
        state,
        existing,
        localPatch
      )
}

function getEffectivePrimaryProjectIdForWorkItemUpdate(
  item: WorkItem,
  resolvedPrimaryProjectId: string | null
) {
  return isPrivateWorkItem(item) ? null : resolvedPrimaryProjectId
}

function getPatchValue<T>(patchValue: T | undefined, existingValue: T) {
  return patchValue === undefined ? existingValue : patchValue
}

function getUpdatedAssigneeId(
  existing: WorkItem,
  localPatch: LocalWorkItemPatch,
  isPrivate: boolean
) {
  if (isPrivate) {
    return null
  }

  return getPatchValue(localPatch.assigneeId, existing.assigneeId)
}

function getUpdatedAssigneeIds(
  existing: WorkItem,
  localPatch: LocalWorkItemPatch,
  isPrivate: boolean
) {
  if (isPrivate) {
    return []
  }

  return localPatch.assigneeIds !== undefined ||
    localPatch.assigneeId !== undefined
    ? getResolvedWorkItemMutationAssigneeIds(localPatch)
    : getWorkItemAssigneeIds(existing)
}

function getUpdatedWorkItemValidationInput(input: {
  existing: WorkItem
  localPatch: LocalWorkItemPatch
  resolvedPrimaryProjectId: string | null
}) {
  const { existing, localPatch, resolvedPrimaryProjectId } = input
  const isPrivate = isPrivateWorkItem(existing)

  return {
    teamId: existing.teamId,
    workspaceId: existing.workspaceId,
    type: existing.type,
    title: localPatch.title ?? existing.title,
    priority: localPatch.priority ?? existing.priority,
    visibility: existing.visibility ?? "team",
    assigneeId: getUpdatedAssigneeId(existing, localPatch, isPrivate),
    assigneeIds: getUpdatedAssigneeIds(existing, localPatch, isPrivate),
    parentId: getPatchValue(localPatch.parentId, existing.parentId),
    primaryProjectId: getEffectivePrimaryProjectIdForWorkItemUpdate(
      existing,
      resolvedPrimaryProjectId
    ),
    labelIds: getPatchValue(localPatch.labelIds, existing.labelIds),
    startDate: getPatchValue(localPatch.startDate, existing.startDate),
    targetDate: getPatchValue(localPatch.targetDate, existing.targetDate),
    startTime: getPatchValue(localPatch.startTime, existing.startTime),
    endTime: getPatchValue(localPatch.endTime, existing.endTime),
    scheduleTimeZone: getPatchValue(
      localPatch.scheduleTimeZone,
      existing.scheduleTimeZone
    ),
    currentItemId: existing.id,
  }
}

function applyOptimisticProjectLinkToWorkItems(
  workItems: WorkItem[],
  input: {
    cascadeItemIds: Set<string>
    effectivePrimaryProjectId: string | null
    itemId: string
    localPatch: LocalWorkItemPatch
    now: string
    shouldCascadeProjectLink: boolean
  }
) {
  const assigneePatch =
    input.localPatch.assigneeIds !== undefined ||
    input.localPatch.assigneeId !== undefined
      ? getWorkItemAssigneeFields(
          getResolvedWorkItemMutationAssigneeIds(input.localPatch)
        )
      : {}

  return workItems.map((item) => {
    if (item.id === input.itemId) {
      return {
        ...item,
        ...input.localPatch,
        ...assigneePatch,
        primaryProjectId: input.effectivePrimaryProjectId,
        updatedAt: input.now,
      }
    }

    if (!input.shouldCascadeProjectLink || !input.cascadeItemIds.has(item.id)) {
      return item
    }

    return {
      ...item,
      primaryProjectId: input.effectivePrimaryProjectId,
      updatedAt: input.now,
    }
  })
}

function getCascadeDescriptionDocIds(
  workItems: WorkItem[],
  cascadeItemIds: Set<string>,
  shouldCascadeProjectLink: boolean
) {
  return shouldCascadeProjectLink
    ? new Set(
        workItems
          .filter((item) => cascadeItemIds.has(item.id))
          .map((item) => item.descriptionDocId)
      )
    : null
}

function applyOptimisticProjectLinkToDocuments(
  documents: WorkItemDocument[],
  input: {
    cascadeDescriptionDocIds: Set<string> | null
    currentUserId: string
    effectivePrimaryProjectId: string | null
    now: string
  }
) {
  if (!input.cascadeDescriptionDocIds) {
    return documents
  }

  return documents.map((document) => {
    if (!input.cascadeDescriptionDocIds?.has(document.id)) {
      return document
    }

    return {
      ...document,
      linkedProjectIds: input.effectivePrimaryProjectId
        ? [input.effectivePrimaryProjectId]
        : [],
      updatedBy: input.currentUserId,
      updatedAt: input.now,
    }
  })
}

function applyOptimisticTitleToDescriptionDocument(
  documents: WorkItemDocument[],
  input: {
    currentItem: WorkItem
    currentUserId: string
    localPatch: LocalWorkItemPatch
    nextTitle: string
    now: string
  }
) {
  if (input.localPatch.title === undefined) {
    return documents
  }

  return documents.map((document) =>
    document.id === input.currentItem.descriptionDocId
      ? {
          ...document,
          title: `${input.nextTitle} description`,
          updatedBy: input.currentUserId,
          updatedAt: input.now,
        }
      : document
  )
}

function getChangedAssigneeIdsForWorkItemUpdate(
  currentItem: WorkItem,
  localPatch: LocalWorkItemPatch
) {
  if (
    localPatch.assigneeIds === undefined &&
    localPatch.assigneeId === undefined
  ) {
    return []
  }

  const currentAssigneeIds = new Set(getWorkItemAssigneeIds(currentItem))
  return getResolvedWorkItemMutationAssigneeIds(localPatch).filter(
    (assigneeId) => !currentAssigneeIds.has(assigneeId)
  )
}

function getResolvedAssigneeIdsForWorkItemUpdate(
  currentItem: WorkItem,
  localPatch: LocalWorkItemPatch
) {
  return localPatch.assigneeIds !== undefined ||
    localPatch.assigneeId !== undefined
    ? getResolvedWorkItemMutationAssigneeIds(localPatch)
    : getWorkItemAssigneeIds(currentItem)
}

function createOptimisticWorkItemNotification(
  state: AppStore,
  input: {
    currentItem: WorkItem
    recipientId: string
    message: (actorName: string, teamName: string | undefined) => string
    type: "assignment" | "status-change"
  }
) {
  const actor = state.users.find((user) => user.id === state.currentUserId)
  const team = state.teams.find(
    (entry) => entry.id === input.currentItem.teamId
  )

  return createNotification(
    input.recipientId,
    state.currentUserId,
    input.message(actor?.name ?? "Someone", team?.name),
    "workItem",
    input.currentItem.id,
    input.type
  )
}

function createOptimisticAssignmentNotifications(
  state: AppStore,
  input: {
    currentItem: WorkItem
    localPatch: LocalWorkItemPatch
    nextTitle: string
  }
): WorkItemNotification[] {
  const assigneeIds = getChangedAssigneeIdsForWorkItemUpdate(
    input.currentItem,
    input.localPatch
  )

  if (assigneeIds.length === 0) {
    return []
  }

  return assigneeIds.map((assigneeId) =>
    createOptimisticWorkItemNotification(state, {
      currentItem: input.currentItem,
      recipientId: assigneeId,
      type: "assignment",
      message: (actorName, teamName) =>
        buildWorkItemAssignmentNotificationMessage(
          actorName,
          input.nextTitle,
          teamName
        ),
    })
  )
}

function createOptimisticStatusNotifications(
  state: AppStore,
  input: {
    currentItem: WorkItem
    localPatch: LocalWorkItemPatch
    nextTitle: string
  }
): WorkItemNotification[] {
  const resolvedAssigneeIds = getResolvedAssigneeIdsForWorkItemUpdate(
    input.currentItem,
    input.localPatch
  )
  const status = input.localPatch.status

  const recipientIds = [
    ...new Set([...resolvedAssigneeIds, ...input.currentItem.subscriberIds]),
  ].filter((recipientId) => recipientId !== state.currentUserId)

  if (
    !status ||
    status === input.currentItem.status ||
    recipientIds.length === 0
  ) {
    return []
  }

  return recipientIds.map((recipientId) =>
    createOptimisticWorkItemNotification(state, {
      currentItem: input.currentItem,
      recipientId,
      type: "status-change",
      message: (actorName, teamName) =>
        buildWorkItemStatusChangeNotificationMessage(
          actorName,
          input.nextTitle,
          statusMeta[status].label,
          teamName
        ),
    })
  )
}

function buildOptimisticWorkItemUpdateNotifications(
  state: AppStore,
  input: {
    currentItem: WorkItem
    localPatch: LocalWorkItemPatch
    nextTitle: string
  }
) {
  if (isPrivateWorkItem(input.currentItem)) {
    return state.notifications
  }

  const nextNotifications = [...state.notifications]
  const assignmentNotifications = createOptimisticAssignmentNotifications(
    state,
    {
      currentItem: input.currentItem,
      localPatch: input.localPatch,
      nextTitle: input.nextTitle,
    }
  )
  const statusNotifications = createOptimisticStatusNotifications(state, {
    currentItem: input.currentItem,
    localPatch: input.localPatch,
    nextTitle: input.nextTitle,
  })

  nextNotifications.unshift(...assignmentNotifications, ...statusNotifications)

  return nextNotifications
}

function buildOptimisticAssigneeChangeActivity(input: {
  currentItem: WorkItem
  currentUserId: string
  localPatch: LocalWorkItemPatch
  now: string
}): WorkItemActivity | null {
  if (
    isPrivateWorkItem(input.currentItem) ||
    (input.localPatch.assigneeIds === undefined &&
      input.localPatch.assigneeId === undefined)
  ) {
    return null
  }

  const fromAssigneeIds = getWorkItemAssigneeIds(input.currentItem)
  const toAssigneeIds = getResolvedWorkItemMutationAssigneeIds(input.localPatch)

  if (haveSameWorkItemAssigneeIds(fromAssigneeIds, toAssigneeIds)) {
    return null
  }

  return {
    id: createId("work_item_activity"),
    itemId: input.currentItem.id,
    actorId: input.currentUserId,
    type: "assignee-change",
    fromAssigneeIds,
    toAssigneeIds,
    createdAt: input.now,
  }
}

function applyOptimisticWorkItemUpdate(
  currentState: AppStore,
  input: {
    itemId: string
    localPatch: LocalWorkItemPatch
    patch: UpdateWorkItemPatch
  }
) {
  const currentItem = currentState.workItems.find(
    (item) => item.id === input.itemId
  )

  if (!currentItem) {
    return currentState
  }

  const now = getNow()
  const nextTitle = input.patch.title?.trim() || currentItem.title
  const { cascadeItemIds, resolvedPrimaryProjectId, shouldCascadeProjectLink } =
    getResolvedProjectLinkForWorkItemUpdate(
      currentState,
      currentItem,
      input.localPatch
    )
  const effectivePrimaryProjectId =
    getEffectivePrimaryProjectIdForWorkItemUpdate(
      currentItem,
      resolvedPrimaryProjectId
    )
  const nextItems = applyOptimisticProjectLinkToWorkItems(
    currentState.workItems,
    {
      cascadeItemIds,
      effectivePrimaryProjectId,
      itemId: input.itemId,
      localPatch: input.localPatch,
      now,
      shouldCascadeProjectLink,
    }
  )
  const cascadeDescriptionDocIds = getCascadeDescriptionDocIds(
    currentState.workItems,
    cascadeItemIds,
    shouldCascadeProjectLink
  )
  const linkedDocuments = applyOptimisticProjectLinkToDocuments(
    currentState.documents,
    {
      cascadeDescriptionDocIds,
      currentUserId: currentState.currentUserId,
      effectivePrimaryProjectId,
      now,
    }
  )
  const finalDocuments = applyOptimisticTitleToDescriptionDocument(
    linkedDocuments,
    {
      currentItem,
      currentUserId: currentState.currentUserId,
      localPatch: input.localPatch,
      nextTitle,
      now,
    }
  )
  const assigneeActivity = buildOptimisticAssigneeChangeActivity({
    currentItem,
    currentUserId: currentState.currentUserId,
    localPatch: input.localPatch,
    now,
  })

  return {
    ...currentState,
    documents: finalDocuments,
    workItems: nextItems,
    workItemActivities: assigneeActivity
      ? [...currentState.workItemActivities, assigneeActivity]
      : currentState.workItemActivities,
    notifications: buildOptimisticWorkItemUpdateNotifications(currentState, {
      currentItem,
      localPatch: input.localPatch,
      nextTitle,
    }),
  }
}

export function createWorkItemActions({
  get,
  runtime,
  set,
}: WorkSliceFactoryArgs): Pick<
  WorkSlice,
  | "createLabel"
  | "updateLabel"
  | "updateWorkItem"
  | "setWorkItemSubscription"
  | "deleteWorkItem"
  | "deleteWorkItems"
  | "shiftTimelineItem"
  | "createWorkItem"
> {
  return {
    async createLabel(name, workspaceId, options) {
      const normalizedName = name.trim()
      const resolvedWorkspaceId = workspaceId ?? get().currentWorkspaceId
      const scopeType = options?.scopeType ?? "workspace"

      if (normalizedName.length === 0) {
        toast.error("Label name is required")
        return null
      }

      if (!resolvedWorkspaceId) {
        toast.error("Workspace not found")
        return null
      }

      const existing = getLabelsForWorkspace(get(), resolvedWorkspaceId).find(
        (label) =>
          (label.scopeType ?? "workspace") === scopeType &&
          (label.ownerId ?? null) ===
            (scopeType === "private" ? get().currentUserId : null) &&
          label.name.toLowerCase() === normalizedName.toLowerCase()
      )

      if (existing) {
        return existing
      }

      try {
        const result = await syncCreateLabel({
          workspaceId: resolvedWorkspaceId,
          scopeType,
          name: normalizedName,
        })

        if (!result?.label) {
          throw new Error("Failed to create label")
        }

        set((state) => ({
          labels: [...state.labels, result.label].sort((left, right) =>
            left.name.localeCompare(right.name)
          ),
        }))

        return result.label
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to create label"
        )
        return null
      }
    },
    async updateLabel(labelId, name) {
      const normalizedName = name.trim()

      if (normalizedName.length === 0) {
        toast.error("Label name is required")
        return false
      }

      const existing = get().labels.find((label) => label.id === labelId)

      if (!existing) {
        toast.error("Label not found")
        return false
      }

      if (existing.name === normalizedName) {
        return true
      }

      set((state) => ({
        labels: state.labels
          .map((label) =>
            label.id === labelId ? { ...label, name: normalizedName } : label
          )
          .sort((left, right) => left.name.localeCompare(right.name)),
      }))

      try {
        const result = await syncUpdateLabel({ labelId, name: normalizedName })

        if (!result?.label) {
          throw new Error("Failed to update label")
        }

        return true
      } catch (error) {
        set((state) => ({
          labels: state.labels
            .map((label) =>
              label.id === labelId
                ? { ...label, name: existing.name }
                : label
            )
            .sort((left, right) => left.name.localeCompare(right.name)),
        }))
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to update label"
        )
        return false
      }
    },
    updateWorkItem(itemId, patch, options) {
      const state = get()
      const existing = state.workItems.find((item) => item.id === itemId)

      if (!existing) {
        return {
          status: "missing-item",
        }
      }

      const { expectedUpdatedAt } = patch
      const localPatch = getEffectiveLocalWorkItemPatch(existing, patch)

      const {
        cascadeItemIds,
        resolvedPrimaryProjectId,
        shouldCascadeProjectLink,
      } = getResolvedProjectLinkForWorkItemUpdate(state, existing, localPatch)

      const validationMessage = getWorkItemValidationMessage(
        state,
        getUpdatedWorkItemValidationInput({
          existing,
          localPatch,
          resolvedPrimaryProjectId,
        })
      )

      if (validationMessage) {
        toast.error(validationMessage)
        return {
          status: "validation-error",
          message: validationMessage,
        }
      }

      const projectTemplateValidationMessage =
        getProjectTemplateValidationMessageForWorkItemUpdate(state, existing, {
          cascadeItemIds,
          resolvedPrimaryProjectId,
          shouldCascadeProjectLink,
        })

      if (projectTemplateValidationMessage) {
        toast.error(projectTemplateValidationMessage)
        return {
          status: "validation-error",
          message: projectTemplateValidationMessage,
        }
      }

      const projectCascadeConfirmation =
        getWorkItemUpdateProjectCascadeConfirmation(state, existing, localPatch)

      if (
        projectCascadeConfirmation.requiresConfirmation &&
        !options?.confirmProjectCascade
      ) {
        return {
          status: "project-confirmation-required",
          cascadeItemCount: projectCascadeConfirmation.cascadeItemCount,
        }
      }

      const syncToken = createId("work_item_sync")

      set((currentState) => {
        const optimisticState = applyOptimisticWorkItemUpdate(currentState, {
          itemId,
          localPatch,
          patch,
        })
        return {
          ...optimisticState,
          pendingWorkItemSyncsById: {
            ...(optimisticState.pendingWorkItemSyncsById ?? {}),
            [itemId]: syncToken,
          },
        }
      })

      const updateTask = syncUpdateWorkItem(get().currentUserId, itemId, {
        ...localPatch,
        ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
      }).finally(() => {
        set((currentState) => {
          if (currentState.pendingWorkItemSyncsById?.[itemId] !== syncToken) {
            return currentState
          }

          const nextPendingSyncs = {
            ...(currentState.pendingWorkItemSyncsById ?? {}),
          }
          delete nextPendingSyncs[itemId]

          return {
            pendingWorkItemSyncsById: nextPendingSyncs,
          }
        })
      })

      runtime.syncInBackground(updateTask, "Failed to update work item")

      return {
        status: "updated",
      }
    },
    setWorkItemSubscription(itemId, subscribed) {
      const state = get()
      const item = state.workItems.find((entry) => entry.id === itemId)

      if (!item) {
        toast.error("Work item not found")
        return
      }

      if ((item.visibility ?? "team") === "private") {
        toast.error("Private tasks do not support subscriptions")
        return
      }

      const currentlySubscribed = item.subscriberIds.includes(
        state.currentUserId
      )

      if (currentlySubscribed === subscribed) {
        return
      }

      const nextSubscriberIds = subscribed
        ? [...item.subscriberIds, state.currentUserId]
        : item.subscriberIds.filter(
            (subscriberId) => subscriberId !== state.currentUserId
          )

      set((currentState) => ({
        workItems: currentState.workItems.map((entry) =>
          entry.id === itemId
            ? {
                ...entry,
                subscriberIds: nextSubscriberIds,
                updatedAt: getNow(),
              }
            : entry
        ),
      }))

      runtime.syncInBackground(
        syncSetWorkItemSubscription(itemId, subscribed),
        "Failed to update subscription"
      )
      toast.success(subscribed ? "Subscribed" : "Unsubscribed")
    },
    async deleteWorkItem(itemId) {
      const state = get()
      const deletionPlan = getWorkItemCascadeDeletePlan(state, itemId)

      if (!deletionPlan) {
        return false
      }

      if (!canDeleteWorkItem(state, deletionPlan)) {
        return false
      }

      const previousState = getWorkItemDeletePreviousState(state)

      set((current) => {
        const nextPlan = getWorkItemCascadeDeletePlan(current, itemId)

        if (!nextPlan) {
          return current
        }

        return applyWorkItemCascadeDeletePlan(current, nextPlan)
      })

      try {
        await syncDeleteWorkItem(itemId)
        toast.success(getWorkItemDeleteSuccessMessage(deletionPlan))
        return true
      } catch (error) {
        console.error(error)
        set((current) => ({
          ...current,
          ...previousState,
        }))
        void runtime.refreshFromServer().catch((refreshError) => {
          console.error(
            "Failed to reconcile work item state after delete failure",
            refreshError
          )
        })
        toast.error("Failed to delete item")
        return false
      }
    },
    async deleteWorkItems(itemIds) {
      const uniqueIds = [...new Set(itemIds)].filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )

      if (uniqueIds.length <= 1) {
        return uniqueIds.length === 1
          ? get().deleteWorkItem(uniqueIds[0]!)
          : false
      }

      const state = get()
      const rootIds = getBulkDeleteRootIds(state, uniqueIds)
      const { working, syncIds, totalDeleted } = planBulkWorkItemDelete(
        state,
        rootIds
      )

      if (syncIds.length === 0) {
        return false
      }

      const previousState = getWorkItemDeletePreviousState(state)

      set((current) => ({
        ...current,
        workItems: working.workItems,
        documents: working.documents,
        comments: working.comments,
        attachments: working.attachments,
        notifications: working.notifications,
        workItemActivities: working.workItemActivities,
      }))

      const results = await Promise.allSettled(
        syncIds.map((id) => syncDeleteWorkItem(id))
      )

      if (results.some((result) => result.status === "rejected")) {
        for (const result of results) {
          if (result.status === "rejected") {
            console.error(result.reason)
          }
        }

        set((current) => ({
          ...current,
          ...previousState,
        }))
        void runtime.refreshFromServer().catch((refreshError) => {
          console.error(
            "Failed to reconcile work item state after bulk delete failure",
            refreshError
          )
        })
        toast.error("Failed to delete some items")
        return false
      }

      toast.success(
        totalDeleted > 1 ? `Deleted ${totalDeleted} items` : "Item deleted"
      )
      return true
    },
    shiftTimelineItem(itemId, nextStartDate) {
      set((state) => {
        const item = state.workItems.find((entry) => entry.id === itemId)
        if (!item || !item.startDate) {
          return state
        }

        const delta = differenceInCalendarDays(
          new Date(nextStartDate),
          new Date(item.startDate)
        )

        return {
          ...state,
          workItems: state.workItems.map((entry) => {
            if (entry.id !== itemId) {
              return entry
            }

            return {
              ...entry,
              startDate: nextStartDate,
              dueDate: entry.dueDate
                ? shiftCalendarDate(entry.dueDate, delta)
                : entry.dueDate,
              targetDate: entry.targetDate
                ? shiftCalendarDate(entry.targetDate, delta)
                : entry.targetDate,
              updatedAt: getNow(),
            }
          }),
        }
      })

      runtime.syncInBackground(
        syncShiftTimelineItem(itemId, nextStartDate),
        "Failed to move timeline item"
      )
    },
    createWorkItem(input) {
      const parsed = workItemSchema.safeParse(input)
      if (!parsed.success) {
        toast.error("Work item input is invalid")
        return null
      }

      const parsedInput =
        parsed.data.visibility === "private"
          ? {
              ...parsed.data,
              assigneeId: null,
              assigneeIds: [],
              primaryProjectId: null,
            }
          : parsed.data

      const validationMessage = getWorkItemValidationMessage(get(), parsedInput)

      if (validationMessage) {
        toast.error(validationMessage)
        return null
      }

      let createdItemId: string | null = null
      let createdDescriptionDocId: string | null = null
      const dates = resolveCreateWorkItemDates(get(), parsedInput)

      set((state) => {
        const optimisticCreation = buildOptimisticWorkItemCreationState(state, {
          dates,
          parsedInput,
        })

        if (!optimisticCreation) {
          return state
        }

        createdItemId = optimisticCreation.createdItemId
        createdDescriptionDocId = optimisticCreation.createdDescriptionDocId
        return optimisticCreation.state
      })

      if (!createdItemId) {
        return null
      }

      const createTask = syncCreateWorkItem(get().currentUserId, {
        ...parsedInput,
        id: createdItemId,
        descriptionDocId: createdDescriptionDocId ?? undefined,
        startDate: dates.startDate,
        dueDate: dates.dueDate,
        targetDate: dates.targetDate,
        startTime: dates.startTime,
        endTime: dates.endTime,
        scheduleTimeZone: dates.scheduleTimeZone,
      }).then((result) => {
        if (!createdItemId) {
          return result
        }

        reconcileCreatedWorkItem({
          createdDescriptionDocId,
          createdItemId,
          result,
          set,
        })

        return result
      })

      registerPendingWorkItemCreation(createdItemId, createTask)
      runtime.syncInBackground(createTask, "Failed to create work item")

      toast.success("Work item created")
      return createdItemId
    },
  }
}

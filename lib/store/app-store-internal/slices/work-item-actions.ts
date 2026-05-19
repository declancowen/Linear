"use client"

import { differenceInCalendarDays } from "date-fns"
import { toast } from "sonner"

import {
  syncCreateLabel,
  syncCreateWorkItem,
  syncDeleteWorkItem,
  syncShiftTimelineItem,
  syncUpdateWorkItem,
} from "@/lib/convex/client"
import {
  addLocalCalendarDays,
  formatLocalCalendarDate,
  shiftCalendarDate,
} from "@/lib/calendar-date"
import { getLabelsForWorkspace } from "@/lib/domain/selectors"
import { formatWorkItemKey } from "@/lib/domain/work-item-key"
import {
  buildWorkItemAssignmentNotificationMessage,
  buildWorkItemStatusChangeNotificationMessage,
} from "@/lib/domain/notification-copy"
import {
  getAllowedWorkItemTypesForTemplate,
  statusMeta,
  workItemSchema,
} from "@/lib/domain/types"
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
  "attachments" | "comments" | "documents" | "notifications" | "workItems"
>

function canDeleteWorkItem(state: AppStore, deletionPlan: WorkItemDeletePlan) {
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
  }
}

function getWorkItemDeleteSuccessMessage(deletionPlan: WorkItemDeletePlan) {
  return deletionPlan.deletedItemIds.size > 1
    ? `Deleted ${deletionPlan.deletedItemIds.size} items`
    : "Item deleted"
}

function resolveCreateWorkItemDates(
  state: AppStore,
  input: CreateWorkItemInput
): CreateWorkItemDates {
  const currentUser = state.users.find((user) => user.id === state.currentUserId)
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
  const role = effectiveRole(state, input.teamId)

  if (role === "viewer" || role === "guest" || !role) {
    toast.error("Your current role is read-only")
    return null
  }

  const parent = input.parentId
    ? (state.workItems.find((item) => item.id === input.parentId) ?? null)
    : null
  const team = state.teams.find((entry) => entry.id === input.teamId) ?? null
  const isPrivate = input.visibility === "private"
  const teamItems = state.workItems.filter((item) =>
    isPrivate
      ? (item.visibility ?? "team") === "private" &&
        item.creatorId === state.currentUserId
      : item.teamId === input.teamId && (item.visibility ?? "team") !== "private"
  )

  return {
    keyPrefix: isPrivate ? "PRIVATE" : toTeamKeyPrefix(team?.name, input.teamId),
    nextNumber: isPrivate ? teamItems.length + 1 : 1 + teamItems.length + 100,
    parent,
    resolvedPrimaryProjectId: parent
      ? (parent.primaryProjectId ?? null)
      : input.primaryProjectId,
    team,
    workspaceId: team?.workspaceId ?? "",
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
    teamId: input.parsedInput.teamId,
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

  return {
    id: input.itemId,
    key: formatWorkItemKey(input.scope.keyPrefix, input.scope.nextNumber),
    teamId: input.parsedInput.teamId,
    type: input.parsedInput.type,
    title: input.parsedInput.title,
    descriptionDocId: input.descriptionDocId,
    status: input.parsedInput.status ?? ("backlog" as const),
    priority: input.parsedInput.priority,
    assigneeId: input.parsedInput.assigneeId,
    creatorId: input.currentUserId,
    parentId: input.scope.parent?.id ?? null,
    primaryProjectId: input.scope.resolvedPrimaryProjectId,
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
    subscriberIds: [input.currentUserId],
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
  if (!input.parsedInput.assigneeId) {
    return state.notifications
  }

  const actor = state.users.find((user) => user.id === state.currentUserId)

  return [
    createNotification(
      input.parsedInput.assigneeId,
      state.currentUserId,
      buildWorkItemAssignmentNotificationMessage(
        actor?.name ?? "Someone",
        input.parsedInput.title,
        input.scope.team?.name
      ),
      "workItem",
      input.workItemId,
      "assignment"
    ),
    ...state.notifications,
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
  delete privatePatch.primaryProjectId

  return privatePatch
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

function getUpdatedWorkItemValidationInput(input: {
  existing: WorkItem
  localPatch: LocalWorkItemPatch
  resolvedPrimaryProjectId: string | null
}) {
  const { existing, localPatch, resolvedPrimaryProjectId } = input

  return {
    teamId: existing.teamId,
    type: existing.type,
    title: localPatch.title ?? existing.title,
    priority: localPatch.priority ?? existing.priority,
    assigneeId:
      localPatch.assigneeId === undefined
        ? existing.assigneeId
        : localPatch.assigneeId,
    parentId:
      localPatch.parentId === undefined ? existing.parentId : localPatch.parentId,
    primaryProjectId: getEffectivePrimaryProjectIdForWorkItemUpdate(
      existing,
      resolvedPrimaryProjectId
    ),
    labelIds:
      localPatch.labelIds === undefined ? existing.labelIds : localPatch.labelIds,
    startDate:
      localPatch.startDate === undefined
        ? existing.startDate
        : localPatch.startDate,
    targetDate:
      localPatch.targetDate === undefined
        ? existing.targetDate
        : localPatch.targetDate,
    startTime:
      localPatch.startTime === undefined
        ? existing.startTime
        : localPatch.startTime,
    endTime:
      localPatch.endTime === undefined ? existing.endTime : localPatch.endTime,
    scheduleTimeZone:
      localPatch.scheduleTimeZone === undefined
        ? existing.scheduleTimeZone
        : localPatch.scheduleTimeZone,
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
  return workItems.map((item) => {
    if (item.id === input.itemId) {
      return {
        ...item,
        ...input.localPatch,
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

function getChangedAssigneeIdForWorkItemUpdate(
  currentItem: WorkItem,
  localPatch: LocalWorkItemPatch
) {
  return localPatch.assigneeId &&
    localPatch.assigneeId !== currentItem.assigneeId
    ? localPatch.assigneeId
    : null
}

function getResolvedAssigneeIdForWorkItemUpdate(
  currentItem: WorkItem,
  localPatch: LocalWorkItemPatch
) {
  return localPatch.assigneeId === undefined
    ? currentItem.assigneeId
    : localPatch.assigneeId
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

function createOptimisticAssignmentNotification(
  state: AppStore,
  input: {
    currentItem: WorkItem
    localPatch: LocalWorkItemPatch
    nextTitle: string
  }
): WorkItemNotification | null {
  const assigneeId = getChangedAssigneeIdForWorkItemUpdate(
    input.currentItem,
    input.localPatch
  )

  if (!assigneeId) {
    return null
  }

  return createOptimisticWorkItemNotification(state, {
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
}

function createOptimisticStatusNotification(
  state: AppStore,
  input: {
    currentItem: WorkItem
    localPatch: LocalWorkItemPatch
    nextTitle: string
  }
): WorkItemNotification | null {
  const resolvedAssigneeId = getResolvedAssigneeIdForWorkItemUpdate(
    input.currentItem,
    input.localPatch
  )
  const status = input.localPatch.status

  if (!status || status === input.currentItem.status || !resolvedAssigneeId) {
    return null
  }

  return createOptimisticWorkItemNotification(state, {
    currentItem: input.currentItem,
    recipientId: resolvedAssigneeId,
    type: "status-change",
    message: (actorName, teamName) =>
      buildWorkItemStatusChangeNotificationMessage(
        actorName,
        input.nextTitle,
        statusMeta[status].label,
        teamName
      ),
  })
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
  const assignmentNotification = createOptimisticAssignmentNotification(state, {
    currentItem: input.currentItem,
    localPatch: input.localPatch,
    nextTitle: input.nextTitle,
  })
  const statusNotification = createOptimisticStatusNotification(state, {
    currentItem: input.currentItem,
    localPatch: input.localPatch,
    nextTitle: input.nextTitle,
  })

  if (assignmentNotification) {
    nextNotifications.unshift(assignmentNotification)
  }

  if (statusNotification) {
    nextNotifications.unshift(statusNotification)
  }

  return nextNotifications
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

  return {
    ...currentState,
    documents: finalDocuments,
    workItems: nextItems,
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
  | "updateWorkItem"
  | "deleteWorkItem"
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

      set((currentState) =>
        applyOptimisticWorkItemUpdate(currentState, {
          itemId,
          localPatch,
          patch,
        })
      )

      runtime.syncInBackground(
        syncUpdateWorkItem(get().currentUserId, itemId, {
          ...localPatch,
          ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
        }),
        "Failed to update work item"
      )

      return {
        status: "updated",
      }
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

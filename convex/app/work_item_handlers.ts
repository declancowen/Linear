import { differenceInCalendarDays } from "date-fns"

import type { MutationCtx } from "../_generated/server"

import {
  addLocalCalendarDays,
  formatLocalCalendarDate,
  shiftCalendarDate,
} from "../../lib/calendar-date"
import {
  buildAssignmentEmailJobs,
  type AssignmentEmail,
} from "../../lib/email/builders"
import {
  formatWorkItemKey,
  PRIVATE_WORK_ITEM_KEY_PREFIX,
} from "../../lib/domain/work-item-key"
import {
  getResolvedWorkItemMutationAssigneeIds,
  getWorkItemAssigneeFields,
  getWorkItemAssigneeIds,
} from "../../lib/domain/work-item-assignees"
import {
  buildWorkItemAssignmentNotificationMessage,
  buildWorkItemStatusChangeNotificationMessage,
} from "../../lib/domain/notification-copy"
import {
  getAllowedWorkItemTypesForTemplate,
  getWorkSurfaceCopy,
  normalizeStoredWorkItemType,
  statusMeta,
  type StoredWorkItemType,
  type WorkItemType,
} from "../../lib/domain/types"
import type {
  AuthenticatedCreateWorkItemInput,
  WorkItemMutationPatch,
} from "../../lib/domain/work-item-inputs"
import { createNotification } from "./collaboration_utils"
import { getClampedNotifiedMentionCounts } from "./document_handlers"
import { assertServerToken, createId, getNow, toTeamKeyPrefix } from "./core"
import {
  getDocumentDoc,
  getProjectDoc,
  getTeamDoc,
  getUserDoc,
  getWorkItemDoc,
  isTeamMember,
  listPrivateWorkItemsByCreator,
  listAttachmentsByTargets,
  listCommentsByTargets,
  listNotificationsByEntities,
  listWorkItemActivitiesByWorkItems,
  listTeamDocuments,
  listWorkspaceDocuments,
} from "./data"
import { listDocumentPresenceViewers, normalizeTeam } from "./normalization"
import {
  clearDocumentPresenceForActor,
  upsertDocumentPresenceForActor,
} from "./presence_helpers"
import {
  assertScheduleDate,
  assertScheduleTime,
  assertScheduleTimeZone,
  assertTargetDateOnOrAfterStartDate,
  assertWorkItemLabelIds,
  collectWorkItemCascadeIds,
  getResolvedProjectLinkForWorkItemUpdate,
  projectBelongsToTeamScope,
  validateWorkItemParent,
} from "./work_helpers"
import {
  requireEditableTeamDoc,
  requireEditableWorkItemAccess,
  requireReadableWorkItemAccess,
  requireReadableWorkspaceAccess,
} from "./access"
import { queueEmailJobs } from "./email_job_handlers"

type ServerAccessArgs = {
  serverToken: string
}

type WorkItemPatch = WorkItemMutationPatch

type UpdateWorkItemArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
  itemId: string
  patch: WorkItemPatch
}

type PersistCollaborationWorkItemArgs = ServerAccessArgs & {
  currentUserId: string
  itemId: string
  patch: {
    title?: string
    description?: string
    expectedUpdatedAt?: string
  }
}

type DeleteWorkItemArgs = ServerAccessArgs & {
  currentUserId: string
  itemId: string
}

type SetWorkItemSubscriptionArgs = ServerAccessArgs & {
  currentUserId: string
  itemId: string
  subscribed: boolean
}

type WorkItemPresenceArgs = ServerAccessArgs & {
  currentUserId: string
  itemId: string
  workosUserId: string
  email: string
  name: string
  avatarUrl: string
  avatarImageUrl?: string | null
  activeBlockId?: string | null
  sessionId: string
}

type ClearWorkItemPresenceArgs = ServerAccessArgs & {
  currentUserId: string
  itemId: string
  workosUserId: string
  sessionId: string
}

type ShiftTimelineItemArgs = ServerAccessArgs & {
  currentUserId: string
  itemId: string
  nextStartDate: string
}

type CreateWorkItemArgs = ServerAccessArgs & AuthenticatedCreateWorkItemInput

type WorkItemDoc = NonNullable<Awaited<ReturnType<typeof getWorkItemDoc>>>
type TeamDoc = NonNullable<Awaited<ReturnType<typeof getTeamDoc>>>
type ProjectDoc = NonNullable<Awaited<ReturnType<typeof getProjectDoc>>>

async function requireCreateWorkItemTeam(
  ctx: MutationCtx,
  args: CreateWorkItemArgs
) {
  if (args.visibility !== "private") {
    const team = await requireEditableTeamDoc(
      ctx,
      args.teamId,
      args.currentUserId
    )
    assertTeamSupportsWorkItems(normalizeTeam(team))
    return team
  }

  const team = await getTeamDoc(ctx, args.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  await requireReadableWorkspaceAccess(
    ctx,
    team.workspaceId,
    args.currentUserId
  )

  return team
}

function assertExpectedWorkItemVersion(
  existing: WorkItemDoc,
  patch: WorkItemPatch
) {
  if (
    patch.expectedUpdatedAt !== undefined &&
    existing.updatedAt !== patch.expectedUpdatedAt
  ) {
    throw new Error("Work item changed while you were editing")
  }
}

function getNextWorkItemTitle(existing: WorkItemDoc, patch: WorkItemPatch) {
  const nextTitle = patch.title?.trim() || existing.title

  if (nextTitle.length < 2 || nextTitle.length > 96) {
    throw new Error("Work item title must be between 2 and 96 characters")
  }

  return nextTitle
}

function getNormalizedWorkItemType(existing: WorkItemDoc, team: TeamDoc) {
  return normalizeStoredWorkItemType(
    existing.type as StoredWorkItemType,
    normalizeTeam(team).settings.experience,
    {
      parentId: existing.parentId,
    }
  )
}

function assertWorkItemSchedulePatch(
  existing: WorkItemDoc,
  patch: WorkItemPatch
) {
  assertScheduleDate(patch.startDate, "Start date")
  assertScheduleDate(patch.dueDate, "Due date")
  assertScheduleDate(patch.targetDate, "Target date")
  assertScheduleTime(patch.startTime, "Start time")
  assertScheduleTime(patch.endTime, "End time")
  assertScheduleTimeZone(patch.scheduleTimeZone)

  const nextStartDate =
    patch.startDate === undefined ? existing.startDate : patch.startDate
  const nextTargetDate =
    patch.targetDate === undefined ? existing.targetDate : patch.targetDate
  assertTargetDateOnOrAfterStartDate({
    startDate: nextStartDate,
    targetDate: nextTargetDate,
  })
}

async function validateWorkItemParentPatch(
  ctx: MutationCtx,
  existing: WorkItemDoc,
  patch: WorkItemPatch,
  itemType: WorkItemType
) {
  const parent = await validateWorkItemParent(ctx, {
    teamId: existing.teamId,
    itemType,
    parentId: patch.parentId === undefined ? existing.parentId : patch.parentId,
    currentItemId: existing.id,
  })

  if (!parent) {
    return
  }

  if ((existing.visibility ?? "team") === "private") {
    if (
      (parent.visibility ?? "team") !== "private" ||
      parent.creatorId !== existing.creatorId
    ) {
      throw new Error("Private task parent must be one of your private tasks")
    }
  } else if ((parent.visibility ?? "team") === "private") {
    throw new Error("Parent item not found")
  }
}

async function listTeamWorkItemsForUpdate(ctx: MutationCtx, teamId: string) {
  return ctx.db
    .query("workItems")
    .withIndex("by_team_id", (q) => q.eq("teamId", teamId))
    .collect()
}

function resolveProjectLinkForUpdate(
  teamItems: WorkItemDoc[],
  existing: WorkItemDoc,
  patch: WorkItemPatch
) {
  return getResolvedProjectLinkForWorkItemUpdate(
    teamItems.map((item) => ({
      id: item.id,
      parentId: item.parentId,
      primaryProjectId: item.primaryProjectId,
    })),
    existing,
    existing.id,
    patch
  )
}

function isWorkItemAllowedForProjectTemplate(
  item: WorkItemDoc,
  projectTemplateType: Parameters<typeof getAllowedWorkItemTypesForTemplate>[0],
  experience: ReturnType<typeof normalizeTeam>["settings"]["experience"]
) {
  return getAllowedWorkItemTypesForTemplate(projectTemplateType).includes(
    normalizeStoredWorkItemType(item.type as StoredWorkItemType, experience, {
      parentId: item.parentId,
    })
  )
}

async function loadProjectLinkPatchProject(
  ctx: MutationCtx,
  projectId: string | null
) {
  if (!projectId) {
    return null
  }

  const project = await getProjectDoc(ctx, projectId)

  if (!project) {
    throw new Error("Project not found")
  }

  return project
}

function assertProjectLinkBelongsToTeam(team: TeamDoc, project: ProjectDoc) {
  if (!projectBelongsToTeamScope(team, project)) {
    throw new Error("Project must belong to the same team or workspace")
  }
}

function assertProjectTemplateAllowsWorkItem(
  project: ProjectDoc,
  normalizedExistingType: WorkItemType
) {
  if (
    !getAllowedWorkItemTypesForTemplate(project.templateType).includes(
      normalizedExistingType
    )
  ) {
    throw new Error(
      "Work item type is not allowed for the selected project template"
    )
  }
}

function hasUnsupportedCascadeProjectItem(input: {
  teamItems: WorkItemDoc[]
  existing: WorkItemDoc
  project: ProjectDoc
  normalizedExperience: ReturnType<
    typeof normalizeTeam
  >["settings"]["experience"]
  cascadeItemIds: Set<string>
  shouldCascadeProjectLink: boolean
}) {
  if (!input.shouldCascadeProjectLink) {
    return false
  }

  return input.teamItems.some(
    (item) =>
      item.id !== input.existing.id &&
      input.cascadeItemIds.has(item.id) &&
      !isWorkItemAllowedForProjectTemplate(
        item,
        input.project.templateType,
        input.normalizedExperience
      )
  )
}

function assertCascadeProjectTemplateAllowsHierarchy(input: {
  teamItems: WorkItemDoc[]
  existing: WorkItemDoc
  project: ProjectDoc
  normalizedExperience: ReturnType<
    typeof normalizeTeam
  >["settings"]["experience"]
  cascadeItemIds: Set<string>
  shouldCascadeProjectLink: boolean
}) {
  if (hasUnsupportedCascadeProjectItem(input)) {
    throw new Error(
      "A work item type in this hierarchy is not allowed for the selected project template"
    )
  }
}

async function assertProjectLinkPatchAllowed(
  ctx: MutationCtx,
  input: {
    team: TeamDoc | null
    teamItems: WorkItemDoc[]
    existing: WorkItemDoc
    normalizedExistingType: WorkItemType
    normalizedExperience: ReturnType<
      typeof normalizeTeam
    >["settings"]["experience"]
    cascadeItemIds: Set<string>
    resolvedPrimaryProjectId: string | null
    shouldCascadeProjectLink: boolean
  }
) {
  const project = await loadProjectLinkPatchProject(
    ctx,
    input.resolvedPrimaryProjectId
  )

  if (!project) {
    return
  }

  if (!input.team) {
    throw new Error("Team not found")
  }

  assertProjectLinkBelongsToTeam(input.team, project)
  assertProjectTemplateAllowsWorkItem(project, input.normalizedExistingType)
  assertCascadeProjectTemplateAllowsHierarchy({
    teamItems: input.teamItems,
    existing: input.existing,
    project,
    normalizedExperience: input.normalizedExperience,
    cascadeItemIds: input.cascadeItemIds,
    shouldCascadeProjectLink: input.shouldCascadeProjectLink,
  })
}

export async function patchWorkItemDescriptionDocument(
  ctx: MutationCtx,
  input: {
    existing: WorkItemDoc
    nextTitle: string
    nextDescription: string | undefined
    currentUserId: string
    now: string
    titleChanged: boolean
  }
) {
  if (!input.titleChanged && input.nextDescription === undefined) {
    return
  }

  const descriptionDocument = await getDocumentDoc(
    ctx,
    input.existing.descriptionDocId
  )

  if (!descriptionDocument) {
    return
  }

  await ctx.db.patch(descriptionDocument._id, {
    ...(input.nextDescription !== undefined
      ? {
          content: input.nextDescription,
          notifiedMentionCounts: getClampedNotifiedMentionCounts(
            input.nextDescription,
            descriptionDocument.notifiedMentionCounts
          ),
        }
      : {}),
    title: `${input.nextTitle} description`,
    updatedAt: input.now,
    updatedBy: input.currentUserId,
  })
}

async function cascadeProjectLinkToWorkItemHierarchy(
  ctx: MutationCtx,
  input: {
    teamItems: WorkItemDoc[]
    existing: WorkItemDoc
    cascadeItemIds: Set<string>
    resolvedPrimaryProjectId: string | null
    currentUserId: string
    now: string
  }
) {
  await patchCascadeProjectLinkedItems(ctx, input)
  await patchCascadeProjectDescriptionDocuments(ctx, input)
}

async function patchCascadeProjectLinkedItems(
  ctx: MutationCtx,
  input: {
    teamItems: WorkItemDoc[]
    existing: WorkItemDoc
    cascadeItemIds: Set<string>
    resolvedPrimaryProjectId: string | null
    now: string
  }
) {
  for (const item of input.teamItems) {
    if (item.id === input.existing.id || !input.cascadeItemIds.has(item.id)) {
      continue
    }

    await ctx.db.patch(item._id, {
      primaryProjectId: input.resolvedPrimaryProjectId,
      updatedAt: input.now,
    })
  }
}

function getCascadeDescriptionDocIds(input: {
  teamItems: WorkItemDoc[]
  cascadeItemIds: Set<string>
}) {
  return new Set(
    input.teamItems
      .filter((item) => input.cascadeItemIds.has(item.id))
      .map((item) => item.descriptionDocId)
  )
}

async function patchCascadeProjectDescriptionDocuments(
  ctx: MutationCtx,
  input: {
    teamItems: WorkItemDoc[]
    cascadeItemIds: Set<string>
    resolvedPrimaryProjectId: string | null
    currentUserId: string
    now: string
  }
) {
  for (const documentId of getCascadeDescriptionDocIds(input)) {
    const document = await getDocumentDoc(ctx, documentId)

    if (!document) {
      continue
    }

    await ctx.db.patch(document._id, {
      linkedProjectIds: input.resolvedPrimaryProjectId
        ? [input.resolvedPrimaryProjectId]
        : [],
      updatedBy: input.currentUserId,
      updatedAt: input.now,
    })
  }
}

async function loadWorkItemUpdateTarget(
  ctx: MutationCtx,
  args: UpdateWorkItemArgs
) {
  const existing = await getWorkItemDoc(ctx, args.itemId)

  if (!existing) {
    throw new Error("Work item not found")
  }

  await requireEditableWorkItemAccess(ctx, existing, args.currentUserId)
  const team = await getTeamDoc(ctx, existing.teamId)
  const isPrivate = (existing.visibility ?? "team") === "private"

  if (!team && !isPrivate) {
    throw new Error("Team not found")
  }

  return {
    existing,
    team,
    normalizedExperience: team
      ? normalizeTeam(team).settings.experience
      : ("project-management" as const),
    normalizedExistingType: team
      ? getNormalizedWorkItemType(existing, team)
      : normalizeStoredWorkItemType(
          existing.type as StoredWorkItemType,
          "project-management",
          { parentId: existing.parentId }
        ),
    nextTitle: getNextWorkItemTitle(existing, args.patch),
  }
}

async function resolveWorkItemProjectPatch(
  ctx: MutationCtx,
  input: {
    existing: WorkItemDoc
    patch: WorkItemPatch
  }
) {
  const teamItems = await listTeamWorkItemsForUpdate(ctx, input.existing.teamId)
  const { cascadeItemIds, resolvedPrimaryProjectId, shouldCascadeProjectLink } =
    resolveProjectLinkForUpdate(teamItems, input.existing, input.patch)

  return {
    teamItems,
    cascadeItemIds,
    resolvedPrimaryProjectId,
    shouldCascadeProjectLink,
  }
}

async function assertWorkItemAssigneePatchAllowed(
  ctx: MutationCtx,
  existing: WorkItemDoc,
  patch: WorkItemPatch
) {
  if ((existing.visibility ?? "team") === "private") {
    return
  }

  const assigneeIds =
    patch.assigneeIds !== undefined
      ? getResolvedWorkItemMutationAssigneeIds(patch)
      : patch.assigneeId !== undefined
        ? getResolvedWorkItemMutationAssigneeIds(patch)
        : []

  for (const assigneeId of assigneeIds) {
    if (!(await isTeamMember(ctx, existing.teamId, assigneeId))) {
      throw new Error("Assignee must belong to the selected team")
    }
  }
}

function getPatchAssigneeIds(patch: WorkItemPatch) {
  return patch.assigneeIds !== undefined || patch.assigneeId !== undefined
    ? getResolvedWorkItemMutationAssigneeIds(patch)
    : null
}

async function assertWorkItemLabelPatchAllowed(
  ctx: MutationCtx,
  currentUserId: string,
  existing: WorkItemDoc,
  team: TeamDoc | null,
  patch: WorkItemPatch
) {
  if (patch.labelIds !== undefined) {
    const workspaceId = team?.workspaceId ?? existing.workspaceId

    if (!workspaceId) {
      throw new Error("Workspace not found")
    }

    await assertWorkItemLabelIds(ctx, {
      currentUserId,
      labelIds: patch.labelIds,
      visibility: existing.visibility,
      workspaceId,
    })
  }
}

function buildPersistedWorkItemPatch(
  patch: WorkItemPatch,
  input: {
    existing: WorkItemDoc
    nextTitle: string
    resolvedPrimaryProjectId: string | null
    now: string
  }
) {
  const persistedPatch = { ...patch }
  const isPrivate = (input.existing.visibility ?? "team") === "private"

  delete persistedPatch.description
  delete persistedPatch.expectedUpdatedAt
  if (isPrivate) {
    delete persistedPatch.assigneeId
    delete persistedPatch.assigneeIds
    delete persistedPatch.primaryProjectId
  }

  const assigneeIds = isPrivate ? [] : getPatchAssigneeIds(patch)

  return {
    ...persistedPatch,
    ...(assigneeIds !== null ? getWorkItemAssigneeFields(assigneeIds) : {}),
    title: input.nextTitle,
    primaryProjectId: isPrivate ? null : input.resolvedPrimaryProjectId,
    updatedAt: input.now,
  }
}

export async function createAssignmentNotificationForWorkItemUpdate(
  ctx: MutationCtx,
  input: {
    args: UpdateWorkItemArgs
    existing: WorkItemDoc
    actorName: string
    teamName: string
    nextTitle: string
  }
): Promise<AssignmentEmail[]> {
  if (
    (input.existing.visibility ?? "team") === "private" ||
    (input.args.patch.assigneeIds === undefined &&
      input.args.patch.assigneeId === undefined)
  ) {
    return []
  }

  const previousAssigneeIds = new Set(getWorkItemAssigneeIds(input.existing))
  const nextAssigneeIds = getResolvedWorkItemMutationAssigneeIds(
    input.args.patch
  ).filter((assigneeId) => !previousAssigneeIds.has(assigneeId))
  const assignmentEmails: AssignmentEmail[] = []

  for (const assigneeId of nextAssigneeIds) {
    const assignee = await getUserDoc(ctx, assigneeId)
    const notification = createNotification(
      assigneeId,
      input.args.currentUserId,
      buildWorkItemAssignmentNotificationMessage(
        input.actorName,
        input.nextTitle,
        input.teamName
      ),
      "workItem",
      input.existing.id,
      "assignment"
    )

    await ctx.db.insert("notifications", notification)

    if (assignee?.preferences.emailAssignments) {
      assignmentEmails.push({
        notificationId: notification.id,
        email: assignee.email,
        name: assignee.name,
        itemTitle: input.nextTitle,
        itemId: input.existing.id,
        actorName: input.actorName,
        teamName: input.teamName,
      })
    }
  }

  return assignmentEmails
}

export async function createStatusChangeNotificationForWorkItemUpdate(
  ctx: MutationCtx,
  input: {
    args: UpdateWorkItemArgs
    existing: WorkItemDoc
    actorName: string
    teamName: string
    nextTitle: string
  }
) {
  if ((input.existing.visibility ?? "team") === "private") {
    return
  }

  const resolvedAssigneeIds =
    input.args.patch.assigneeIds !== undefined ||
    input.args.patch.assigneeId !== undefined
      ? getResolvedWorkItemMutationAssigneeIds(input.args.patch)
      : getWorkItemAssigneeIds(input.existing)

  const recipientIds = [
    ...new Set([
      ...resolvedAssigneeIds,
      ...(input.existing.subscriberIds ?? []),
    ]),
  ].filter((recipientId) => recipientId !== input.args.currentUserId)

  if (
    !input.args.patch.status ||
    input.args.patch.status === input.existing.status ||
    recipientIds.length === 0
  ) {
    return
  }

  for (const recipientId of recipientIds) {
    await ctx.db.insert(
      "notifications",
      createNotification(
        recipientId,
        input.args.currentUserId,
        buildWorkItemStatusChangeNotificationMessage(
          input.actorName,
          input.nextTitle,
          statusMeta[input.args.patch.status].label,
          input.teamName
        ),
        "workItem",
        input.existing.id,
        "status-change"
      )
    )
  }
}

export async function createStatusChangeActivityForWorkItemUpdate(
  ctx: MutationCtx,
  input: {
    args: UpdateWorkItemArgs
    existing: WorkItemDoc
    now: string
  }
) {
  const nextStatus = input.args.patch.status

  if (!nextStatus || nextStatus === input.existing.status) {
    return null
  }

  const activity = {
    id: createId("work_item_activity"),
    itemId: input.existing.id,
    actorId: input.args.currentUserId,
    type: "status-change" as const,
    fromStatus: input.existing.status,
    toStatus: nextStatus,
    createdAt: input.now,
  }

  await ctx.db.insert("workItemActivities", activity)

  return activity
}

function getEffectiveWorkItemPatch(
  existing: WorkItemDoc,
  patch: WorkItemPatch
) {
  if ((existing.visibility ?? "team") !== "private") {
    return patch
  }

  const effectivePatch = { ...patch }
  delete effectivePatch.assigneeId
  delete effectivePatch.assigneeIds
  delete effectivePatch.primaryProjectId
  return effectivePatch
}

export async function updateWorkItemHandler(
  ctx: MutationCtx,
  args: UpdateWorkItemArgs
) {
  assertServerToken(args.serverToken)
  const {
    existing,
    team,
    normalizedExperience,
    normalizedExistingType,
    nextTitle,
  } = await loadWorkItemUpdateTarget(ctx, args)
  const patch = getEffectiveWorkItemPatch(existing, args.patch)
  const effectiveArgs = { ...args, patch }

  assertExpectedWorkItemVersion(existing, args.patch)
  assertWorkItemSchedulePatch(existing, patch)
  await validateWorkItemParentPatch(
    ctx,
    existing,
    patch,
    normalizedExistingType
  )

  const {
    teamItems,
    cascadeItemIds,
    resolvedPrimaryProjectId,
    shouldCascadeProjectLink,
  } = await resolveWorkItemProjectPatch(ctx, {
    existing,
    patch,
  })

  await assertWorkItemAssigneePatchAllowed(ctx, existing, patch)
  await assertWorkItemLabelPatchAllowed(
    ctx,
    args.currentUserId,
    existing,
    team,
    patch
  )
  await assertProjectLinkPatchAllowed(ctx, {
    team,
    teamItems,
    existing,
    normalizedExistingType,
    normalizedExperience,
    cascadeItemIds,
    resolvedPrimaryProjectId,
    shouldCascadeProjectLink,
  })

  const actor = await getUserDoc(ctx, args.currentUserId)
  const actorName = actor?.name ?? "Someone"
  const now = getNow()
  const nextDescription = patch.description

  await ctx.db.patch(existing._id, {
    ...buildPersistedWorkItemPatch(patch, {
      existing,
      nextTitle,
      resolvedPrimaryProjectId,
      now,
    }),
  })

  await patchWorkItemDescriptionDocument(ctx, {
    existing,
    nextTitle,
    nextDescription,
    currentUserId: args.currentUserId,
    now,
    titleChanged: patch.title !== undefined,
  })

  if (shouldCascadeProjectLink) {
    await cascadeProjectLinkToWorkItemHierarchy(ctx, {
      teamItems,
      existing,
      cascadeItemIds,
      resolvedPrimaryProjectId,
      currentUserId: args.currentUserId,
      now,
    })
  }

  await createStatusChangeActivityForWorkItemUpdate(ctx, {
    args: effectiveArgs,
    existing,
    now,
  })

  const assignmentEmails = await createAssignmentNotificationForWorkItemUpdate(
    ctx,
    {
      args: effectiveArgs,
      existing,
      actorName,
      teamName: team?.name ?? "",
      nextTitle,
    }
  )

  await createStatusChangeNotificationForWorkItemUpdate(ctx, {
    args: effectiveArgs,
    existing,
    actorName,
    teamName: team?.name ?? "",
    nextTitle,
  })

  await queueEmailJobs(
    ctx,
    buildAssignmentEmailJobs({
      origin: args.origin,
      emails: assignmentEmails,
    })
  )

  return {
    assignmentEmails,
  }
}

export async function setWorkItemSubscriptionHandler(
  ctx: MutationCtx,
  args: SetWorkItemSubscriptionArgs
) {
  assertServerToken(args.serverToken)
  const item = await getWorkItemDoc(ctx, args.itemId)

  if (!item) {
    throw new Error("Work item not found")
  }

  await requireReadableWorkItemAccess(ctx, item, args.currentUserId)

  if ((item.visibility ?? "team") === "private") {
    throw new Error("Private tasks do not support subscriptions")
  }

  const subscriberIds = new Set(item.subscriberIds ?? [])

  if (args.subscribed) {
    subscriberIds.add(args.currentUserId)
  } else {
    subscriberIds.delete(args.currentUserId)
  }

  await ctx.db.patch(item._id, {
    subscriberIds: [...subscriberIds],
    updatedAt: getNow(),
  })

  return {
    subscribed: args.subscribed,
  }
}

async function requireCollaborationWorkItem(
  ctx: MutationCtx,
  args: PersistCollaborationWorkItemArgs
) {
  const existing = await getWorkItemDoc(ctx, args.itemId)

  if (!existing) {
    throw new Error("Work item not found")
  }

  await requireEditableWorkItemAccess(ctx, existing, args.currentUserId)

  if (
    args.patch.expectedUpdatedAt !== undefined &&
    existing.updatedAt !== args.patch.expectedUpdatedAt
  ) {
    throw new Error("Work item changed while you were editing")
  }

  return existing
}

async function requireEditableWorkItem(
  ctx: MutationCtx,
  args: { itemId: string; currentUserId: string }
) {
  const item = await getWorkItemDoc(ctx, args.itemId)

  if (!item) {
    throw new Error("Work item not found")
  }

  await requireEditableWorkItemAccess(ctx, item, args.currentUserId)

  return item
}

function getCollaborationWorkItemTitle(
  existing: WorkItemDoc,
  args: PersistCollaborationWorkItemArgs
) {
  return args.patch.title !== undefined
    ? args.patch.title.trim()
    : existing.title
}

function assertWorkItemTitleLength(title: string) {
  if (title.length < 2 || title.length > 96) {
    throw new Error("Work item title must be between 2 and 96 characters")
  }
}

async function patchCollaborationDescriptionDocument(
  ctx: MutationCtx,
  args: PersistCollaborationWorkItemArgs,
  existing: WorkItemDoc,
  nextTitle: string,
  updatedAt: string
) {
  const descriptionDocument = await getDocumentDoc(
    ctx,
    existing.descriptionDocId
  )

  if (!descriptionDocument) {
    return
  }

  await ctx.db.patch(descriptionDocument._id, {
    ...(args.patch.description !== undefined
      ? {
          content: args.patch.description,
          notifiedMentionCounts: getClampedNotifiedMentionCounts(
            args.patch.description,
            descriptionDocument.notifiedMentionCounts
          ),
        }
      : {}),
    title: `${nextTitle} description`,
    updatedAt,
    updatedBy: args.currentUserId,
  })
}

export async function persistCollaborationWorkItemHandler(
  ctx: MutationCtx,
  args: PersistCollaborationWorkItemArgs
) {
  assertServerToken(args.serverToken)
  const existing = await requireCollaborationWorkItem(ctx, args)

  if (args.patch.title === undefined && args.patch.description === undefined) {
    return {
      updatedAt: existing.updatedAt,
    }
  }

  const nextTitle = getCollaborationWorkItemTitle(existing, args)
  assertWorkItemTitleLength(nextTitle)
  const updatedAt = getNow()

  await ctx.db.patch(existing._id, {
    ...(args.patch.title !== undefined ? { title: nextTitle } : {}),
    updatedAt,
  })

  if (args.patch.title !== undefined || args.patch.description !== undefined) {
    await patchCollaborationDescriptionDocument(
      ctx,
      args,
      existing,
      nextTitle,
      updatedAt
    )
  }

  return {
    updatedAt,
  }
}

export async function heartbeatWorkItemPresenceHandler(
  ctx: MutationCtx,
  args: WorkItemPresenceArgs
) {
  assertServerToken(args.serverToken)

  const item = await requireEditableWorkItem(ctx, args)
  const currentTime = getNow()
  await upsertDocumentPresenceForActor(
    ctx,
    item.descriptionDocId,
    args,
    currentTime
  )

  return listDocumentPresenceViewers(
    ctx,
    item.descriptionDocId,
    args.currentUserId,
    args.workosUserId
  )
}

export async function clearWorkItemPresenceHandler(
  ctx: MutationCtx,
  args: ClearWorkItemPresenceArgs
) {
  assertServerToken(args.serverToken)

  const item = await requireEditableWorkItem(ctx, args)
  return clearDocumentPresenceForActor(ctx, item.descriptionDocId, args)
}

async function requireWorkItemDeleteTarget(
  ctx: MutationCtx,
  args: DeleteWorkItemArgs
) {
  const item = await getWorkItemDoc(ctx, args.itemId)

  if (!item) {
    throw new Error("Work item not found")
  }

  await requireEditableWorkItemAccess(ctx, item, args.currentUserId)
  const team = await getTeamDoc(ctx, item.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  return {
    item,
    team,
  }
}

async function getWorkItemDeleteCascade(ctx: MutationCtx, item: WorkItemDoc) {
  const teamItems = await ctx.db
    .query("workItems")
    .withIndex("by_team_id", (q) => q.eq("teamId", item.teamId))
    .collect()
  const deletedItemIds = collectWorkItemCascadeIds(teamItems, item.id)
  const deletedWorkItems = teamItems.filter((entry) =>
    deletedItemIds.has(entry.id)
  )
  const deletedDescriptionDocIds = new Set(
    deletedWorkItems.map((entry) => entry.descriptionDocId)
  )

  return {
    deletedDescriptionDocIds,
    deletedItemIds,
    deletedWorkItems,
    teamItems,
  }
}

async function listWorkItemDeleteRecords(
  ctx: MutationCtx,
  team: TeamDoc,
  cascade: Awaited<ReturnType<typeof getWorkItemDeleteCascade>>
) {
  const [
    workItemComments,
    documentComments,
    workItemAttachments,
    documentAttachments,
    notifications,
    workItemActivities,
    workspaceDocuments,
    teamDocuments,
  ] = await Promise.all([
    listCommentsByTargets(ctx, {
      targetType: "workItem",
      targetIds: cascade.deletedItemIds,
    }),
    listCommentsByTargets(ctx, {
      targetType: "document",
      targetIds: cascade.deletedDescriptionDocIds,
    }),
    listAttachmentsByTargets(ctx, {
      targetType: "workItem",
      targetIds: cascade.deletedItemIds,
    }),
    listAttachmentsByTargets(ctx, {
      targetType: "document",
      targetIds: cascade.deletedDescriptionDocIds,
    }),
    listNotificationsByEntities(ctx, [
      ...[...cascade.deletedItemIds].map((entityId) => ({
        entityType: "workItem" as const,
        entityId,
      })),
      ...[...cascade.deletedDescriptionDocIds].map((entityId) => ({
        entityType: "document" as const,
        entityId,
      })),
    ]),
    listWorkItemActivitiesByWorkItems(ctx, cascade.deletedItemIds),
    listWorkspaceDocuments(ctx, team.workspaceId),
    listTeamDocuments(ctx, team.id),
  ])

  return {
    attachments: [...workItemAttachments, ...documentAttachments],
    comments: [...workItemComments, ...documentComments],
    documents: [
      ...new Map(
        [...workspaceDocuments, ...teamDocuments].map((document) => [
          document.id,
          document,
        ])
      ).values(),
    ],
    notifications,
    workItemActivities,
  }
}

async function deleteWorkItemRelatedRecords(
  ctx: MutationCtx,
  records: Awaited<ReturnType<typeof listWorkItemDeleteRecords>>
) {
  for (const attachment of records.attachments) {
    await ctx.storage.delete(attachment.storageId)
    await ctx.db.delete(attachment._id)
  }

  for (const comment of records.comments) {
    await ctx.db.delete(comment._id)
  }

  for (const notification of records.notifications) {
    await ctx.db.delete(notification._id)
  }

  for (const activity of records.workItemActivities) {
    await ctx.db.delete(activity._id)
  }
}

async function unlinkDeletedDescriptionDocumentsFromWorkItems(
  ctx: MutationCtx,
  cascade: Awaited<ReturnType<typeof getWorkItemDeleteCascade>>
) {
  for (const workItem of cascade.teamItems) {
    if (cascade.deletedItemIds.has(workItem.id)) {
      continue
    }

    const nextLinkedDocumentIds = workItem.linkedDocumentIds.filter(
      (documentId) => !cascade.deletedDescriptionDocIds.has(documentId)
    )

    if (nextLinkedDocumentIds.length === workItem.linkedDocumentIds.length) {
      continue
    }

    await ctx.db.patch(workItem._id, {
      linkedDocumentIds: nextLinkedDocumentIds,
      updatedAt: getNow(),
    })
  }
}

async function deleteOrUnlinkWorkItemDocuments(
  ctx: MutationCtx,
  records: Awaited<ReturnType<typeof listWorkItemDeleteRecords>>,
  cascade: Awaited<ReturnType<typeof getWorkItemDeleteCascade>>,
  currentUserId: string
) {
  for (const document of records.documents) {
    if (cascade.deletedDescriptionDocIds.has(document.id)) {
      await ctx.db.delete(document._id)
      continue
    }

    const nextLinkedWorkItemIds = document.linkedWorkItemIds.filter(
      (linkedItemId) => !cascade.deletedItemIds.has(linkedItemId)
    )

    if (nextLinkedWorkItemIds.length === document.linkedWorkItemIds.length) {
      continue
    }

    await ctx.db.patch(document._id, {
      linkedWorkItemIds: nextLinkedWorkItemIds,
      updatedAt: getNow(),
      updatedBy: currentUserId,
    })
  }
}

async function deleteCascadedWorkItems(
  ctx: MutationCtx,
  deletedWorkItems: WorkItemDoc[]
) {
  for (const workItem of deletedWorkItems) {
    const workItemDoc = await getWorkItemDoc(ctx, workItem.id)

    if (workItemDoc) {
      await ctx.db.delete(workItemDoc._id)
    }
  }
}

export async function deleteWorkItemHandler(
  ctx: MutationCtx,
  args: DeleteWorkItemArgs
) {
  assertServerToken(args.serverToken)
  const { item, team } = await requireWorkItemDeleteTarget(ctx, args)
  const cascade = await getWorkItemDeleteCascade(ctx, item)
  const records = await listWorkItemDeleteRecords(ctx, team, cascade)

  await deleteWorkItemRelatedRecords(ctx, records)
  await unlinkDeletedDescriptionDocumentsFromWorkItems(ctx, cascade)
  await deleteOrUnlinkWorkItemDocuments(
    ctx,
    records,
    cascade,
    args.currentUserId
  )
  await deleteCascadedWorkItems(ctx, cascade.deletedWorkItems)

  return {
    deletedItemIds: [...cascade.deletedItemIds],
    deletedDescriptionDocIds: [...cascade.deletedDescriptionDocIds],
  }
}

export async function shiftTimelineItemHandler(
  ctx: MutationCtx,
  args: ShiftTimelineItemArgs
) {
  assertServerToken(args.serverToken)
  const item = await getWorkItemDoc(ctx, args.itemId)

  if (!item) {
    throw new Error("Work item not found")
  }

  if (!item.startDate) {
    throw new Error("Work item is not scheduled")
  }

  await requireEditableWorkItemAccess(ctx, item, args.currentUserId)

  const delta = differenceInCalendarDays(
    new Date(args.nextStartDate),
    new Date(item.startDate)
  )

  await ctx.db.patch(item._id, {
    startDate: args.nextStartDate,
    dueDate: shiftOptionalCalendarDate(item.dueDate, delta),
    targetDate: shiftOptionalCalendarDate(item.targetDate, delta),
    updatedAt: getNow(),
  })
}

function shiftOptionalCalendarDate(date: string | null | undefined, delta: number) {
  return date ? shiftCalendarDate(date, delta) : date
}

function assertCreateWorkItemSchedule(args: CreateWorkItemArgs) {
  assertScheduleDate(args.startDate, "Start date")
  assertScheduleDate(args.dueDate, "Due date")
  assertScheduleDate(args.targetDate, "Target date")
  assertScheduleTime(args.startTime, "Start time")
  assertScheduleTime(args.endTime, "End time")
  assertScheduleTimeZone(args.scheduleTimeZone)
  assertTargetDateOnOrAfterStartDate(args)
}

function assertTeamSupportsWorkItems(team: ReturnType<typeof normalizeTeam>) {
  if (!team.settings.features.issues) {
    throw new Error(getWorkSurfaceCopy(team.settings.experience).disabledLabel)
  }
}

async function assertCreateWorkItemAssignee(
  ctx: MutationCtx,
  args: CreateWorkItemArgs
) {
  if (args.visibility === "private") {
    return
  }

  for (const assigneeId of getCreateWorkItemAssigneeIds(args)) {
    if (!(await isTeamMember(ctx, args.teamId, assigneeId))) {
      throw new Error("Assignee must belong to the selected team")
    }
  }
}

function getCreateWorkItemAssigneeIds(args: CreateWorkItemArgs) {
  return args.visibility === "private"
    ? []
    : getResolvedWorkItemMutationAssigneeIds(args)
}

async function assertCreateWorkItemLabels(
  ctx: MutationCtx,
  team: TeamDoc,
  args: CreateWorkItemArgs
) {
  if (args.labelIds !== undefined) {
    await assertWorkItemLabelIds(ctx, {
      currentUserId: args.currentUserId,
      labelIds: args.labelIds,
      visibility: args.visibility,
      workspaceId: team.workspaceId,
    })
  }
}

function assertCreateWorkItemVisibility(args: CreateWorkItemArgs) {
  if (
    args.visibility === "private" &&
    args.type !== "task" &&
    args.type !== "sub-task"
  ) {
    throw new Error("Private tasks can only use task and sub-task types")
  }
}

async function resolveCreateWorkItemParent(
  ctx: MutationCtx,
  args: CreateWorkItemArgs
) {
  const parent = await validateWorkItemParent(ctx, {
    teamId: args.teamId,
    itemType: args.type,
    parentId: args.parentId ?? null,
  })

  if (!parent) {
    return parent
  }

  if (args.visibility === "private") {
    if (
      (parent.visibility ?? "team") !== "private" ||
      parent.creatorId !== args.currentUserId
    ) {
      throw new Error("Private task parent must be one of your private tasks")
    }
  } else if ((parent.visibility ?? "team") === "private") {
    throw new Error("Parent item not found")
  }

  return parent
}

function getCreateWorkItemProjectId({
  args,
  parent,
}: {
  args: CreateWorkItemArgs
  parent: Awaited<ReturnType<typeof validateWorkItemParent>>
}) {
  if (args.visibility === "private") {
    return null
  }

  return parent ? (parent.primaryProjectId ?? null) : args.primaryProjectId
}

async function assertCreateWorkItemProject(
  ctx: MutationCtx,
  team: TeamDoc,
  args: CreateWorkItemArgs,
  resolvedPrimaryProjectId: string | null
) {
  if (!resolvedPrimaryProjectId) {
    return
  }

  const project = await getProjectDoc(ctx, resolvedPrimaryProjectId)

  if (!project) {
    throw new Error("Project not found")
  }

  if (!projectBelongsToTeamScope(team, project)) {
    throw new Error("Project must belong to the same team or workspace")
  }

  if (
    !getAllowedWorkItemTypesForTemplate(project.templateType).includes(
      args.type
    )
  ) {
    throw new Error(
      "Work item type is not allowed for the selected project template"
    )
  }
}

async function assertCreateWorkItemIdsAvailable(
  ctx: MutationCtx,
  args: CreateWorkItemArgs
) {
  await assertDescriptionDocumentIdAvailable(ctx, args.descriptionDocId)
  await assertWorkItemIdAvailable(ctx, args.id)
}

async function assertDescriptionDocumentIdAvailable(
  ctx: MutationCtx,
  descriptionDocId?: string
) {
  if (!descriptionDocId) {
    return
  }

  const existingDescriptionDocument = await getDocumentDoc(
    ctx,
    descriptionDocId
  )

  if (existingDescriptionDocument) {
    throw new Error("Description document id already exists")
  }
}

async function assertWorkItemIdAvailable(ctx: MutationCtx, itemId?: string) {
  if (!itemId) {
    return
  }

  const existingWorkItem = await getWorkItemDoc(ctx, itemId)

  if (existingWorkItem) {
    throw new Error("Work item id already exists")
  }
}

async function getCreateWorkItemNumbering(
  ctx: MutationCtx,
  team: TeamDoc,
  args: CreateWorkItemArgs
) {
  const isPrivate = args.visibility === "private"

  if (isPrivate) {
    const privateItems = await listPrivateWorkItemsByCreator(
      ctx,
      args.currentUserId
    )

    return {
      prefix: PRIVATE_WORK_ITEM_KEY_PREFIX,
      nextNumber: privateItems.length + 1,
    }
  }

  const teamItems = await ctx.db
    .query("workItems")
    .withIndex("by_team_id", (q) => q.eq("teamId", args.teamId))
    .collect()
  const matchingItems = teamItems.filter(
    (item) => (item.visibility ?? "team") !== "private"
  )

  return {
    prefix: toTeamKeyPrefix(team.name, args.teamId),
    nextNumber: 1 + matchingItems.length + 100,
  }
}

async function insertCreatedWorkItemDescription({
  ctx,
  args,
  team,
  descriptionDocId,
  resolvedPrimaryProjectId,
  now,
}: {
  ctx: MutationCtx
  args: CreateWorkItemArgs
  team: TeamDoc
  descriptionDocId: string
  resolvedPrimaryProjectId: string | null
  now: string
}) {
  await ctx.db.insert("documents", {
    id: descriptionDocId,
    kind: "item-description",
    workspaceId: team.workspaceId,
    teamId: args.visibility === "private" ? null : args.teamId,
    title: `${args.title} description`,
    content: "<p></p>",
    linkedProjectIds: resolvedPrimaryProjectId
      ? [resolvedPrimaryProjectId]
      : [],
    linkedWorkItemIds: [],
    createdBy: args.currentUserId,
    updatedBy: args.currentUserId,
    createdAt: now,
    updatedAt: now,
  })
}

function buildCreatedWorkItem({
  args,
  team,
  parent,
  resolvedPrimaryProjectId,
  descriptionDocId,
  prefix,
  nextNumber,
  now,
  defaultScheduleTimeZone,
}: {
  args: CreateWorkItemArgs
  team: TeamDoc
  parent: Awaited<ReturnType<typeof validateWorkItemParent>>
  resolvedPrimaryProjectId: string | null
  descriptionDocId: string
  prefix: string
  nextNumber: number
  now: string
  defaultScheduleTimeZone: string | null
}) {
  return {
    id: args.id ?? createId("item"),
    key: formatWorkItemKey(prefix, nextNumber),
    teamId: args.teamId,
    workspaceId: team.workspaceId,
    type: args.type,
    title: args.title,
    descriptionDocId,
    status: args.status ?? ("backlog" as const),
    priority: args.priority,
    ...getWorkItemAssigneeFields(getCreateWorkItemAssigneeIds(args)),
    creatorId: args.currentUserId,
    parentId: parent?.id ?? null,
    primaryProjectId: resolvedPrimaryProjectId,
    linkedProjectIds: [],
    linkedDocumentIds: [],
    labelIds: args.labelIds ?? [],
    visibility: args.visibility ?? "team",
    milestoneId: null,
    startDate: args.startDate ?? formatLocalCalendarDate(),
    dueDate: args.dueDate ?? addLocalCalendarDays(7),
    targetDate: args.targetDate ?? addLocalCalendarDays(10),
    startTime: args.startTime ?? null,
    endTime: args.endTime ?? null,
    scheduleTimeZone: args.scheduleTimeZone ?? defaultScheduleTimeZone,
    subscriberIds:
      (args.visibility ?? "team") === "private" ? [] : [args.currentUserId],
    createdAt: now,
    updatedAt: now,
  }
}

async function notifyCreatedWorkItemAssignee({
  ctx,
  args,
  team,
  workItemId,
}: {
  ctx: MutationCtx
  args: CreateWorkItemArgs
  team: TeamDoc
  workItemId: string
}) {
  const assignmentEmails: AssignmentEmail[] = []
  const assigneeIds = getCreateWorkItemAssigneeIds(args)

  if (assigneeIds.length === 0) {
    return assignmentEmails
  }

  const actor = await getUserDoc(ctx, args.currentUserId)
  for (const assigneeId of assigneeIds) {
    const assignee = await getUserDoc(ctx, assigneeId)
    const notification = createNotification(
      assigneeId,
      args.currentUserId,
      buildWorkItemAssignmentNotificationMessage(
        actor?.name ?? "Someone",
        args.title,
        team.name
      ),
      "workItem",
      workItemId,
      "assignment"
    )

    await ctx.db.insert("notifications", notification)

    if (assignee?.preferences.emailAssignments) {
      assignmentEmails.push({
        notificationId: notification.id,
        email: assignee.email,
        name: assignee.name,
        itemTitle: args.title,
        itemId: workItemId,
        actorName: actor?.name ?? "Someone",
        teamName: team.name,
      })
    }
  }

  return assignmentEmails
}

export async function createWorkItemHandler(
  ctx: MutationCtx,
  args: CreateWorkItemArgs
) {
  assertServerToken(args.serverToken)
  const team = await requireCreateWorkItemTeam(ctx, args)

  assertCreateWorkItemSchedule(args)
  assertCreateWorkItemVisibility(args)
  await assertCreateWorkItemAssignee(ctx, args)
  await assertCreateWorkItemLabels(ctx, team, args)
  const parent = await resolveCreateWorkItemParent(ctx, args)
  const resolvedPrimaryProjectId = getCreateWorkItemProjectId({ args, parent })
  await assertCreateWorkItemProject(ctx, team, args, resolvedPrimaryProjectId)
  await assertCreateWorkItemIdsAvailable(ctx, args)
  const { prefix, nextNumber } = await getCreateWorkItemNumbering(
    ctx,
    team,
    args
  )
  const descriptionDocId = args.descriptionDocId ?? createId("doc")
  const now = getNow()
  const creator = await getUserDoc(ctx, args.currentUserId)
  const defaultScheduleTimeZone = creator?.preferences.timeZone ?? null

  await insertCreatedWorkItemDescription({
    ctx,
    args,
    team,
    descriptionDocId,
    resolvedPrimaryProjectId,
    now,
  })
  const workItem = buildCreatedWorkItem({
    args,
    team,
    parent,
    resolvedPrimaryProjectId,
    descriptionDocId,
    prefix,
    nextNumber,
    now,
    defaultScheduleTimeZone,
  })

  await ctx.db.insert("workItems", workItem)

  const assignmentEmails = await notifyCreatedWorkItemAssignee({
    ctx,
    args,
    team,
    workItemId: workItem.id,
  })

  await queueEmailJobs(
    ctx,
    buildAssignmentEmailJobs({
      origin: args.origin,
      emails: assignmentEmails,
    })
  )

  return {
    itemId: workItem.id,
    itemUpdatedAt: now,
    descriptionDocId,
    descriptionUpdatedAt: now,
    assignmentEmails,
  }
}

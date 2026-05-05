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
import { formatWorkItemKey } from "../../lib/domain/work-item-key"
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
  listAttachmentsByTargets,
  listCommentsByTargets,
  listNotificationsByEntities,
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
  assertTargetDateOnOrAfterStartDate,
  assertWorkspaceLabelIds,
  collectWorkItemCascadeIds,
  getResolvedProjectLinkForWorkItemUpdate,
  projectBelongsToTeamScope,
  validateWorkItemParent,
} from "./work_helpers"
import { requireEditableTeamAccess } from "./access"
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
  await validateWorkItemParent(ctx, {
    teamId: existing.teamId,
    itemType,
    parentId: patch.parentId === undefined ? existing.parentId : patch.parentId,
    currentItemId: existing.id,
  })
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
  normalizedExperience: ReturnType<typeof normalizeTeam>["settings"]["experience"]
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
  normalizedExperience: ReturnType<typeof normalizeTeam>["settings"]["experience"]
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
    team: TeamDoc
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

  await requireEditableTeamAccess(ctx, existing.teamId, args.currentUserId)
  const team = await getTeamDoc(ctx, existing.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  return {
    existing,
    team,
    normalizedExperience: normalizeTeam(team).settings.experience,
    normalizedExistingType: getNormalizedWorkItemType(existing, team),
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
  if (
    patch.assigneeId !== undefined &&
    patch.assigneeId &&
    !(await isTeamMember(ctx, existing.teamId, patch.assigneeId))
  ) {
    throw new Error("Assignee must belong to the selected team")
  }
}

async function assertWorkItemLabelPatchAllowed(
  ctx: MutationCtx,
  team: TeamDoc,
  patch: WorkItemPatch
) {
  if (patch.labelIds !== undefined) {
    await assertWorkspaceLabelIds(ctx, team.workspaceId, patch.labelIds)
  }
}

function buildPersistedWorkItemPatch(
  patch: WorkItemPatch,
  input: {
    nextTitle: string
    resolvedPrimaryProjectId: string | null
    now: string
  }
) {
  const persistedPatch = { ...patch }

  delete persistedPatch.description
  delete persistedPatch.expectedUpdatedAt

  return {
    ...persistedPatch,
    title: input.nextTitle,
    primaryProjectId: input.resolvedPrimaryProjectId,
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
): Promise<AssignmentEmail | null> {
  if (
    input.args.patch.assigneeId === undefined ||
    !input.args.patch.assigneeId ||
    input.args.patch.assigneeId === input.existing.assigneeId
  ) {
    return null
  }

  const assignee = await getUserDoc(ctx, input.args.patch.assigneeId)
  const notification = createNotification(
    input.args.patch.assigneeId,
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

  if (!assignee?.preferences.emailAssignments) {
    return null
  }

  return {
    notificationId: notification.id,
    email: assignee.email,
    name: assignee.name,
    itemTitle: input.nextTitle,
    itemId: input.existing.id,
    actorName: input.actorName,
    teamName: input.teamName,
  }
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
  const resolvedAssigneeId =
    input.args.patch.assigneeId === undefined
      ? input.existing.assigneeId
      : input.args.patch.assigneeId

  if (
    !input.args.patch.status ||
    input.args.patch.status === input.existing.status ||
    !resolvedAssigneeId
  ) {
    return
  }

  await ctx.db.insert(
    "notifications",
    createNotification(
      resolvedAssigneeId,
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

  assertExpectedWorkItemVersion(existing, args.patch)
  assertWorkItemSchedulePatch(existing, args.patch)
  await validateWorkItemParentPatch(
    ctx,
    existing,
    args.patch,
    normalizedExistingType
  )

  const {
    teamItems,
    cascadeItemIds,
    resolvedPrimaryProjectId,
    shouldCascadeProjectLink,
  } = await resolveWorkItemProjectPatch(ctx, {
    existing,
    patch: args.patch,
  })

  await assertWorkItemAssigneePatchAllowed(ctx, existing, args.patch)
  await assertWorkItemLabelPatchAllowed(ctx, team, args.patch)
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
  const nextDescription = args.patch.description

  await ctx.db.patch(existing._id, {
    ...buildPersistedWorkItemPatch(args.patch, {
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
    titleChanged: args.patch.title !== undefined,
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

  const assignmentEmail = await createAssignmentNotificationForWorkItemUpdate(
    ctx,
    {
      args,
      existing,
      actorName,
      teamName: team.name,
      nextTitle,
    }
  )
  const assignmentEmails = assignmentEmail ? [assignmentEmail] : []

  await createStatusChangeNotificationForWorkItemUpdate(ctx, {
    args,
    existing,
    actorName,
    teamName: team.name,
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

async function requireCollaborationWorkItem(
  ctx: MutationCtx,
  args: PersistCollaborationWorkItemArgs
) {
  const existing = await getWorkItemDoc(ctx, args.itemId)

  if (!existing) {
    throw new Error("Work item not found")
  }

  await requireEditableTeamAccess(ctx, existing.teamId, args.currentUserId)

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

  await requireEditableTeamAccess(ctx, item.teamId, args.currentUserId)

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

  await requireEditableTeamAccess(ctx, item.teamId, args.currentUserId)
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

  await requireEditableTeamAccess(ctx, item.teamId, args.currentUserId)

  const delta = differenceInCalendarDays(
    new Date(args.nextStartDate),
    new Date(item.startDate)
  )

  await ctx.db.patch(item._id, {
    startDate: args.nextStartDate,
    dueDate: item.dueDate
      ? shiftCalendarDate(item.dueDate, delta)
      : item.dueDate,
    targetDate: item.targetDate
      ? shiftCalendarDate(item.targetDate, delta)
      : item.targetDate,
    updatedAt: getNow(),
  })
}

function assertCreateWorkItemSchedule(args: CreateWorkItemArgs) {
  assertScheduleDate(args.startDate, "Start date")
  assertScheduleDate(args.dueDate, "Due date")
  assertScheduleDate(args.targetDate, "Target date")
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
  if (
    args.assigneeId &&
    !(await isTeamMember(ctx, args.teamId, args.assigneeId))
  ) {
    throw new Error("Assignee must belong to the selected team")
  }
}

async function assertCreateWorkItemLabels(
  ctx: MutationCtx,
  team: TeamDoc,
  args: CreateWorkItemArgs
) {
  if (args.labelIds !== undefined) {
    await assertWorkspaceLabelIds(ctx, team.workspaceId, args.labelIds)
  }
}

async function resolveCreateWorkItemParent(
  ctx: MutationCtx,
  args: CreateWorkItemArgs
) {
  return validateWorkItemParent(ctx, {
    teamId: args.teamId,
    itemType: args.type,
    parentId: args.parentId ?? null,
  })
}

function getCreateWorkItemProjectId({
  args,
  parent,
}: {
  args: CreateWorkItemArgs
  parent: Awaited<ReturnType<typeof validateWorkItemParent>>
}) {
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
  if (args.descriptionDocId) {
    const existingDescriptionDocument = await getDocumentDoc(
      ctx,
      args.descriptionDocId
    )

    if (existingDescriptionDocument) {
      throw new Error("Description document id already exists")
    }
  }

  if (args.id) {
    const existingWorkItem = await getWorkItemDoc(ctx, args.id)

    if (existingWorkItem) {
      throw new Error("Work item id already exists")
    }
  }
}

async function getCreateWorkItemNumbering(
  ctx: MutationCtx,
  team: TeamDoc,
  args: CreateWorkItemArgs
) {
  const teamItems = await ctx.db
    .query("workItems")
    .withIndex("by_team_id", (q) => q.eq("teamId", args.teamId))
    .collect()

  return {
    prefix: toTeamKeyPrefix(team.name, args.teamId),
    nextNumber: 1 + teamItems.length + 100,
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
    teamId: args.teamId,
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
  parent,
  resolvedPrimaryProjectId,
  descriptionDocId,
  prefix,
  nextNumber,
  now,
}: {
  args: CreateWorkItemArgs
  parent: Awaited<ReturnType<typeof validateWorkItemParent>>
  resolvedPrimaryProjectId: string | null
  descriptionDocId: string
  prefix: string
  nextNumber: number
  now: string
}) {
  return {
    id: args.id ?? createId("item"),
    key: formatWorkItemKey(prefix, nextNumber),
    teamId: args.teamId,
    type: args.type,
    title: args.title,
    descriptionDocId,
    status: args.status ?? ("backlog" as const),
    priority: args.priority,
    assigneeId: args.assigneeId,
    creatorId: args.currentUserId,
    parentId: parent?.id ?? null,
    primaryProjectId: resolvedPrimaryProjectId,
    linkedProjectIds: [],
    linkedDocumentIds: [],
    labelIds: args.labelIds ?? [],
    milestoneId: null,
    startDate: args.startDate ?? formatLocalCalendarDate(),
    dueDate: args.dueDate ?? addLocalCalendarDays(7),
    targetDate: args.targetDate ?? addLocalCalendarDays(10),
    subscriberIds: [args.currentUserId],
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

  if (!args.assigneeId) {
    return assignmentEmails
  }

  const actor = await getUserDoc(ctx, args.currentUserId)
  const assignee = await getUserDoc(ctx, args.assigneeId)
  const notification = createNotification(
    args.assigneeId,
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

  return assignmentEmails
}

export async function createWorkItemHandler(
  ctx: MutationCtx,
  args: CreateWorkItemArgs
) {
  assertServerToken(args.serverToken)
  await requireEditableTeamAccess(ctx, args.teamId, args.currentUserId)
  const team = await getTeamDoc(ctx, args.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  const normalizedTeam = normalizeTeam(team)

  assertCreateWorkItemSchedule(args)
  assertTeamSupportsWorkItems(normalizedTeam)
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
    parent,
    resolvedPrimaryProjectId,
    descriptionDocId,
    prefix,
    nextNumber,
    now,
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

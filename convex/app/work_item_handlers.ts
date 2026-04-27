import { differenceInCalendarDays } from "date-fns"

import type { MutationCtx } from "../_generated/server"

import {
  addLocalCalendarDays,
  formatLocalCalendarDate,
  getCalendarDatePrefix,
  isValidCalendarDateString,
  shiftCalendarDate,
} from "../../lib/calendar-date"
import {
  buildAssignmentEmailJobs,
  type AssignmentEmail,
} from "../../lib/email/builders"
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

type WorkItemPatch = {
  title?: string
  description?: string
  expectedUpdatedAt?: string
  status?:
    | "backlog"
    | "todo"
    | "in-progress"
    | "done"
    | "cancelled"
    | "duplicate"
  priority?: "none" | "low" | "medium" | "high" | "urgent"
  assigneeId?: string | null
  parentId?: string | null
  primaryProjectId?: string | null
  labelIds?: string[]
  startDate?: string | null
  dueDate?: string | null
  targetDate?: string | null
}

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

type CreateWorkItemArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
  id?: string
  descriptionDocId?: string
  teamId: string
  type: WorkItemType
  title: string
  parentId?: string | null
  primaryProjectId: string | null
  assigneeId: string | null
  status?:
    | "backlog"
    | "todo"
    | "in-progress"
    | "done"
    | "cancelled"
    | "duplicate"
  priority: "none" | "low" | "medium" | "high" | "urgent"
  labelIds?: string[]
  startDate?: string | null
  dueDate?: string | null
  targetDate?: string | null
}

function assertWorkItemScheduleDate(
  value: string | null | undefined,
  label: "Start date" | "Due date" | "Target date"
) {
  if (value !== undefined && value !== null && !isValidCalendarDateString(value)) {
    throw new Error(`${label} must be a valid calendar date`)
  }
}

export async function updateWorkItemHandler(
  ctx: MutationCtx,
  args: UpdateWorkItemArgs
) {
  assertServerToken(args.serverToken)
  const existing = await getWorkItemDoc(ctx, args.itemId)

  if (!existing) {
    throw new Error("Work item not found")
  }

  await requireEditableTeamAccess(ctx, existing.teamId, args.currentUserId)
  const team = await getTeamDoc(ctx, existing.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  const normalizedExperience = normalizeTeam(team).settings.experience
  const normalizedExistingType = normalizeStoredWorkItemType(
    existing.type as StoredWorkItemType,
    normalizedExperience,
    {
      parentId: existing.parentId,
    }
  )

  if (
    args.patch.expectedUpdatedAt !== undefined &&
    existing.updatedAt !== args.patch.expectedUpdatedAt
  ) {
    throw new Error("Work item changed while you were editing")
  }

  const nextTitle = args.patch.title?.trim() || existing.title

  if (nextTitle.length < 2 || nextTitle.length > 96) {
    throw new Error("Work item title must be between 2 and 96 characters")
  }

  assertWorkItemScheduleDate(args.patch.startDate, "Start date")
  assertWorkItemScheduleDate(args.patch.dueDate, "Due date")
  assertWorkItemScheduleDate(args.patch.targetDate, "Target date")

  const nextStartDate =
    args.patch.startDate === undefined ? existing.startDate : args.patch.startDate
  const nextTargetDate =
    args.patch.targetDate === undefined
      ? existing.targetDate
      : args.patch.targetDate
  const nextStartDatePrefix = getCalendarDatePrefix(nextStartDate)
  const nextTargetDatePrefix = getCalendarDatePrefix(nextTargetDate)

  if (
    nextStartDatePrefix &&
    nextTargetDatePrefix &&
    nextTargetDatePrefix < nextStartDatePrefix
  ) {
    throw new Error("Target date must be on or after the start date")
  }

  const parent = await validateWorkItemParent(ctx, {
    teamId: existing.teamId,
    itemType: normalizedExistingType,
    parentId:
      args.patch.parentId === undefined
        ? existing.parentId
        : args.patch.parentId,
    currentItemId: existing.id,
  })
  const teamItems = await ctx.db
    .query("workItems")
    .withIndex("by_team_id", (q) => q.eq("teamId", existing.teamId))
    .collect()
  const { cascadeItemIds, resolvedPrimaryProjectId, shouldCascadeProjectLink } =
    getResolvedProjectLinkForWorkItemUpdate(
      teamItems.map((item) => ({
        id: item.id,
        parentId: item.parentId,
        primaryProjectId: item.primaryProjectId,
      })),
      existing,
      parent,
      existing.id,
      args.patch
    )

  if (
    args.patch.assigneeId !== undefined &&
    args.patch.assigneeId &&
    !(await isTeamMember(ctx, existing.teamId, args.patch.assigneeId))
  ) {
    throw new Error("Assignee must belong to the selected team")
  }

  if (args.patch.labelIds !== undefined) {
    await assertWorkspaceLabelIds(ctx, team.workspaceId, args.patch.labelIds)
  }

  if (resolvedPrimaryProjectId) {
    const project = await getProjectDoc(ctx, resolvedPrimaryProjectId)

    if (!project) {
      throw new Error("Project not found")
    }

    if (!projectBelongsToTeamScope(team, project)) {
      throw new Error("Project must belong to the same team or workspace")
    }

    if (
      !getAllowedWorkItemTypesForTemplate(project.templateType).includes(
        normalizedExistingType
      )
    ) {
      throw new Error(
        "Work item type is not allowed for the selected project template"
      )
    }

    if (shouldCascadeProjectLink) {
      if (
        teamItems.some(
          (item) =>
            item.id !== existing.id &&
            cascadeItemIds.has(item.id) &&
            !getAllowedWorkItemTypesForTemplate(project.templateType).includes(
              normalizeStoredWorkItemType(
                item.type as StoredWorkItemType,
                normalizedExperience,
                {
                  parentId: item.parentId,
                }
              )
            )
        )
      ) {
        throw new Error(
          "A work item type in this hierarchy is not allowed for the selected project template"
        )
      }
    }
  }

  const actor = await getUserDoc(ctx, args.currentUserId)
  const assignmentEmails: AssignmentEmail[] = []
  const now = getNow()
  const { description: nextDescription, ...persistedPatch } = args.patch

  delete persistedPatch.expectedUpdatedAt

  await ctx.db.patch(existing._id, {
    ...persistedPatch,
    title: nextTitle,
    primaryProjectId: resolvedPrimaryProjectId,
    updatedAt: now,
  })

  if (args.patch.title !== undefined || nextDescription !== undefined) {
    const descriptionDocument = await getDocumentDoc(ctx, existing.descriptionDocId)

    if (descriptionDocument) {
      await ctx.db.patch(descriptionDocument._id, {
        ...(nextDescription !== undefined
          ? {
              content: nextDescription,
              notifiedMentionCounts: getClampedNotifiedMentionCounts(
                nextDescription,
                descriptionDocument.notifiedMentionCounts
              ),
            }
          : {}),
        title: `${nextTitle} description`,
        updatedAt: now,
        updatedBy: args.currentUserId,
      })
    }
  }

  if (shouldCascadeProjectLink) {
    for (const item of teamItems) {
      if (item.id === existing.id || !cascadeItemIds.has(item.id)) {
        continue
      }

      await ctx.db.patch(item._id, {
        primaryProjectId: resolvedPrimaryProjectId,
        updatedAt: now,
      })
    }

    const cascadeDescriptionDocIds = new Set(
      teamItems
        .filter((item) => cascadeItemIds.has(item.id))
        .map((item) => item.descriptionDocId)
    )

    for (const documentId of cascadeDescriptionDocIds) {
      const document = await getDocumentDoc(ctx, documentId)

      if (!document) {
        continue
      }

      await ctx.db.patch(document._id, {
        linkedProjectIds: resolvedPrimaryProjectId
          ? [resolvedPrimaryProjectId]
          : [],
        updatedBy: args.currentUserId,
        updatedAt: now,
      })
    }
  }

  if (
    args.patch.assigneeId !== undefined &&
    args.patch.assigneeId &&
    args.patch.assigneeId !== existing.assigneeId
  ) {
    const assignee = await getUserDoc(ctx, args.patch.assigneeId)
    const notification = createNotification(
      args.patch.assigneeId,
      args.currentUserId,
      buildWorkItemAssignmentNotificationMessage(
        actor?.name ?? "Someone",
        nextTitle,
        team.name
      ),
      "workItem",
      existing.id,
      "assignment"
    )

    await ctx.db.insert("notifications", notification)

    if (assignee?.preferences.emailAssignments) {
      assignmentEmails.push({
        notificationId: notification.id,
        email: assignee.email,
        name: assignee.name,
        itemTitle: nextTitle,
        itemId: existing.id,
        actorName: actor?.name ?? "Someone",
        teamName: team.name,
      })
    }
  }

  const resolvedAssigneeId =
    args.patch.assigneeId === undefined ? existing.assigneeId : args.patch.assigneeId

  if (
    args.patch.status &&
    args.patch.status !== existing.status &&
    resolvedAssigneeId
  ) {
    await ctx.db.insert(
      "notifications",
      createNotification(
        resolvedAssigneeId,
        args.currentUserId,
        buildWorkItemStatusChangeNotificationMessage(
          actor?.name ?? "Someone",
          nextTitle,
          statusMeta[args.patch.status].label,
          team.name
        ),
        "workItem",
        existing.id,
        "status-change"
      )
    )
  }

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

export async function persistCollaborationWorkItemHandler(
  ctx: MutationCtx,
  args: PersistCollaborationWorkItemArgs
) {
  assertServerToken(args.serverToken)
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

  if (args.patch.title === undefined && args.patch.description === undefined) {
    return {
      updatedAt: existing.updatedAt,
    }
  }

  const nextTitle =
    args.patch.title !== undefined ? args.patch.title.trim() : existing.title

  if (nextTitle.length < 2 || nextTitle.length > 96) {
    throw new Error("Work item title must be between 2 and 96 characters")
  }

  const updatedAt = getNow()

  await ctx.db.patch(existing._id, {
    ...(args.patch.title !== undefined ? { title: nextTitle } : {}),
    updatedAt,
  })

  if (args.patch.title !== undefined || args.patch.description !== undefined) {
    const descriptionDocument = await getDocumentDoc(ctx, existing.descriptionDocId)

    if (descriptionDocument) {
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

  const item = await getWorkItemDoc(ctx, args.itemId)

  if (!item) {
    throw new Error("Work item not found")
  }

  await requireEditableTeamAccess(ctx, item.teamId, args.currentUserId)

  const existingPresenceEntries = await ctx.db
    .query("documentPresence")
    .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
    .collect()
  const currentTime = getNow()
  const existingPresence = [...existingPresenceEntries]
    .filter(
      (entry) =>
        entry.workosUserId === args.workosUserId ||
        (!entry.workosUserId && entry.userId === args.currentUserId)
    )
    .sort(
      (left, right) =>
        Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt)
    )[0]

  const conflictingPresenceEntries = existingPresenceEntries.filter((entry) =>
    entry.workosUserId
      ? entry.workosUserId !== args.workosUserId
      : entry.userId !== args.currentUserId
  )

  if (conflictingPresenceEntries.length > 0) {
    throw new Error("Document presence session is already in use")
  }

  if (existingPresence) {
    await ctx.db.patch(existingPresence._id, {
      activeBlockId: args.activeBlockId ?? null,
      avatarUrl: args.avatarUrl,
      avatarImageUrl: args.avatarImageUrl ?? null,
      documentId: item.descriptionDocId,
      email: args.email,
      lastSeenAt: currentTime,
      name: args.name,
      userId: args.currentUserId,
      workosUserId: args.workosUserId,
    })

    for (const duplicateEntry of existingPresenceEntries) {
      if (
        duplicateEntry._id !== existingPresence._id &&
        (duplicateEntry.workosUserId
          ? duplicateEntry.workosUserId === args.workosUserId
          : duplicateEntry.userId === args.currentUserId)
      ) {
        await ctx.db.delete(duplicateEntry._id)
      }
    }
  } else {
    await ctx.db.insert("documentPresence", {
      activeBlockId: args.activeBlockId ?? null,
      avatarUrl: args.avatarUrl,
      avatarImageUrl: args.avatarImageUrl ?? null,
      documentId: item.descriptionDocId,
      userId: args.currentUserId,
      email: args.email,
      name: args.name,
      sessionId: args.sessionId,
      createdAt: currentTime,
      lastSeenAt: currentTime,
      workosUserId: args.workosUserId,
    })
  }

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

  const item = await getWorkItemDoc(ctx, args.itemId)

  if (!item) {
    throw new Error("Work item not found")
  }

  await requireEditableTeamAccess(ctx, item.teamId, args.currentUserId)

  const existingPresenceEntries = await ctx.db
    .query("documentPresence")
    .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
    .collect()

  if (existingPresenceEntries.length === 0) {
    return { ok: true }
  }

  const conflictingPresenceEntries = existingPresenceEntries.filter((entry) =>
    entry.workosUserId
      ? entry.workosUserId !== args.workosUserId
      : entry.userId !== args.currentUserId
  )

  if (conflictingPresenceEntries.length > 0) {
    throw new Error("Document presence session is already in use")
  }

  for (const existingPresence of existingPresenceEntries) {
    if (existingPresence.documentId !== item.descriptionDocId) {
      continue
    }

    await ctx.db.delete(existingPresence._id)
  }

  return { ok: true }
}

export async function deleteWorkItemHandler(
  ctx: MutationCtx,
  args: DeleteWorkItemArgs
) {
  assertServerToken(args.serverToken)
  const item = await getWorkItemDoc(ctx, args.itemId)

  if (!item) {
    throw new Error("Work item not found")
  }

  await requireEditableTeamAccess(ctx, item.teamId, args.currentUserId)
  const team = await getTeamDoc(ctx, item.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

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
      targetIds: deletedItemIds,
    }),
    listCommentsByTargets(ctx, {
      targetType: "document",
      targetIds: deletedDescriptionDocIds,
    }),
    listAttachmentsByTargets(ctx, {
      targetType: "workItem",
      targetIds: deletedItemIds,
    }),
    listAttachmentsByTargets(ctx, {
      targetType: "document",
      targetIds: deletedDescriptionDocIds,
    }),
    listNotificationsByEntities(ctx, [
      ...[...deletedItemIds].map((entityId) => ({
        entityType: "workItem" as const,
        entityId,
      })),
      ...[...deletedDescriptionDocIds].map((entityId) => ({
        entityType: "document" as const,
        entityId,
      })),
    ]),
    listWorkspaceDocuments(ctx, team.workspaceId),
    listTeamDocuments(ctx, team.id),
  ])
  const documents = [
    ...new Map(
      [...workspaceDocuments, ...teamDocuments].map((document) => [
        document.id,
        document,
      ])
    ).values(),
  ]
  const comments = [...workItemComments, ...documentComments]
  const attachments = [...workItemAttachments, ...documentAttachments]

  for (const attachment of attachments) {
    await ctx.storage.delete(attachment.storageId)
    await ctx.db.delete(attachment._id)
  }

  for (const comment of comments) {
    await ctx.db.delete(comment._id)
  }

  for (const notification of notifications) {
    await ctx.db.delete(notification._id)
  }

  for (const workItem of teamItems) {
    if (deletedItemIds.has(workItem.id)) {
      continue
    }

    const nextLinkedDocumentIds = workItem.linkedDocumentIds.filter(
      (documentId) => !deletedDescriptionDocIds.has(documentId)
    )

    if (nextLinkedDocumentIds.length === workItem.linkedDocumentIds.length) {
      continue
    }

    await ctx.db.patch(workItem._id, {
      linkedDocumentIds: nextLinkedDocumentIds,
      updatedAt: getNow(),
    })
  }

  for (const document of documents) {
    if (deletedDescriptionDocIds.has(document.id)) {
      await ctx.db.delete(document._id)
      continue
    }

    const nextLinkedWorkItemIds = document.linkedWorkItemIds.filter(
      (linkedItemId) => !deletedItemIds.has(linkedItemId)
    )

    if (nextLinkedWorkItemIds.length === document.linkedWorkItemIds.length) {
      continue
    }

    await ctx.db.patch(document._id, {
      linkedWorkItemIds: nextLinkedWorkItemIds,
      updatedAt: getNow(),
      updatedBy: args.currentUserId,
    })
  }

  for (const workItem of deletedWorkItems) {
    const workItemDoc = await getWorkItemDoc(ctx, workItem.id)

    if (workItemDoc) {
      await ctx.db.delete(workItemDoc._id)
    }
  }

  return {
    deletedItemIds: [...deletedItemIds],
    deletedDescriptionDocIds: [...deletedDescriptionDocIds],
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

  assertWorkItemScheduleDate(args.startDate, "Start date")
  assertWorkItemScheduleDate(args.dueDate, "Due date")
  assertWorkItemScheduleDate(args.targetDate, "Target date")

  const startDatePrefix = getCalendarDatePrefix(args.startDate)
  const targetDatePrefix = getCalendarDatePrefix(args.targetDate)

  if (
    startDatePrefix &&
    targetDatePrefix &&
    targetDatePrefix < startDatePrefix
  ) {
    throw new Error("Target date must be on or after the start date")
  }

  const parent = await validateWorkItemParent(ctx, {
    teamId: args.teamId,
    itemType: args.type,
    parentId: args.parentId ?? null,
  })
  const resolvedPrimaryProjectId = parent
    ? (parent.primaryProjectId ?? null)
    : args.primaryProjectId

  if (!normalizedTeam.settings.features.issues) {
    throw new Error(
      getWorkSurfaceCopy(normalizedTeam.settings.experience).disabledLabel
    )
  }

  if (
    args.assigneeId &&
    !(await isTeamMember(ctx, args.teamId, args.assigneeId))
  ) {
    throw new Error("Assignee must belong to the selected team")
  }

  if (args.labelIds !== undefined) {
    await assertWorkspaceLabelIds(ctx, team.workspaceId, args.labelIds)
  }

  if (resolvedPrimaryProjectId) {
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

  const teamItems = await ctx.db
    .query("workItems")
    .withIndex("by_team_id", (q) => q.eq("teamId", args.teamId))
    .collect()

  const prefix = toTeamKeyPrefix(team.name, args.teamId)
  const nextNumber = 1 + teamItems.length + 100
  const descriptionDocId = args.descriptionDocId ?? createId("doc")
  const now = getNow()

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

  const workItem = {
    id: args.id ?? createId("item"),
    key: `${prefix}-${nextNumber}`,
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

  await ctx.db.insert("workItems", workItem)

  const assignmentEmails: AssignmentEmail[] = []

  if (args.assigneeId) {
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
      workItem.id,
      "assignment"
    )

    await ctx.db.insert("notifications", notification)

    if (assignee?.preferences.emailAssignments) {
      assignmentEmails.push({
        notificationId: notification.id,
        email: assignee.email,
        name: assignee.name,
        itemTitle: args.title,
        itemId: workItem.id,
        actorName: actor?.name ?? "Someone",
        teamName: team.name,
      })
    }
  }

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

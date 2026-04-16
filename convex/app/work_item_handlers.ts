import { addDays, differenceInCalendarDays } from "date-fns"

import type { MutationCtx } from "../_generated/server"

import {
  getAllowedWorkItemTypesForTemplate,
  getWorkSurfaceCopy,
  normalizeStoredWorkItemType,
  type StoredWorkItemType,
  type WorkItemType,
} from "../../lib/domain/types"
import { createNotification } from "./collaboration_utils"
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
import { normalizeTeam } from "./normalization"
import {
  assertWorkspaceLabelIds,
  collectWorkItemCascadeIds,
  getResolvedProjectLinkForWorkItemUpdate,
  projectBelongsToTeamScope,
  validateWorkItemParent,
} from "./work_helpers"
import { requireEditableTeamAccess } from "./access"

type ServerAccessArgs = {
  serverToken: string
}

type WorkItemPatch = {
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
  itemId: string
  patch: WorkItemPatch
}

type DeleteWorkItemArgs = ServerAccessArgs & {
  currentUserId: string
  itemId: string
}

type ShiftTimelineItemArgs = ServerAccessArgs & {
  currentUserId: string
  itemId: string
  nextStartDate: string
}

type CreateWorkItemArgs = ServerAccessArgs & {
  currentUserId: string
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
  const assignmentEmails: Array<{
    notificationId: string
    email: string
    name: string
    itemTitle: string
    itemId: string
    actorName: string
  }> = []
  const now = getNow()

  await ctx.db.patch(existing._id, {
    ...args.patch,
    primaryProjectId: resolvedPrimaryProjectId,
    updatedAt: now,
  })

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
    args.patch.assigneeId !== existing.assigneeId &&
    args.patch.assigneeId !== args.currentUserId
  ) {
    const assignee = await getUserDoc(ctx, args.patch.assigneeId)
    const notification = createNotification(
      args.patch.assigneeId,
      args.currentUserId,
      `${actor?.name ?? "Someone"} assigned you ${existing.title}`,
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
        itemTitle: existing.title,
        itemId: existing.id,
        actorName: actor?.name ?? "Someone",
      })
    }
  }

  if (
    args.patch.status &&
    args.patch.status !== existing.status &&
    existing.creatorId !== args.currentUserId
  ) {
    await ctx.db.insert(
      "notifications",
      createNotification(
        existing.creatorId,
        args.currentUserId,
        `${existing.title} moved to ${args.patch.status}`,
        "workItem",
        existing.id,
        "status-change"
      )
    )
  }

  return {
    assignmentEmails,
  }
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
      ? addDays(new Date(item.dueDate), delta).toISOString()
      : item.dueDate,
    targetDate: item.targetDate
      ? addDays(new Date(item.targetDate), delta).toISOString()
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

  const teamItems = await ctx.db
    .query("workItems")
    .withIndex("by_team_id", (q) => q.eq("teamId", args.teamId))
    .collect()

  const prefix = toTeamKeyPrefix(team.name, args.teamId)
  const nextNumber = 1 + teamItems.length + 100
  const descriptionDocId = createId("doc")

  await ctx.db.insert("documents", {
    id: descriptionDocId,
    kind: "item-description",
    workspaceId: team.workspaceId,
    teamId: args.teamId,
    title: `${args.title} description`,
    content: `<p>Add a fuller description for ${args.title}.</p>`,
    linkedProjectIds: resolvedPrimaryProjectId
      ? [resolvedPrimaryProjectId]
      : [],
    linkedWorkItemIds: [],
    createdBy: args.currentUserId,
    updatedBy: args.currentUserId,
    createdAt: getNow(),
    updatedAt: getNow(),
  })

  const workItem = {
    id: createId("item"),
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
    startDate: getNow(),
    dueDate: addDays(new Date(), 7).toISOString(),
    targetDate: addDays(new Date(), 10).toISOString(),
    subscriberIds: [args.currentUserId],
    createdAt: getNow(),
    updatedAt: getNow(),
  }

  await ctx.db.insert("workItems", workItem)

  const assignmentEmails: Array<{
    notificationId: string
    email: string
    name: string
    itemTitle: string
    itemId: string
    actorName: string
  }> = []

  if (args.assigneeId && args.assigneeId !== args.currentUserId) {
    const actor = await getUserDoc(ctx, args.currentUserId)
    const assignee = await getUserDoc(ctx, args.assigneeId)
    const notification = createNotification(
      args.assigneeId,
      args.currentUserId,
      `${actor?.name ?? "Someone"} assigned you ${args.title}`,
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
      })
    }
  }

  return {
    itemId: workItem.id,
    assignmentEmails,
  }
}

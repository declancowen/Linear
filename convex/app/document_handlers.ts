import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

import {
  buildMentionEmailJobs,
  type MentionEmail,
} from "../../lib/email/builders"
import {
  buildWorkItemDescriptionMentionDetailText,
  buildWorkItemDescriptionMentionNotificationMessage,
} from "../../lib/domain/notification-copy"
import { extractRichTextMentionCounts } from "../../lib/content/rich-text-mentions"
import { assertServerToken, getNow } from "./core"
import {
  getDocumentDoc,
  getUserDoc,
  getWorkItemDoc,
  listActiveUsersByIds,
} from "./data"
import { resolveAttachmentTarget } from "./assets"
import {
  requireEditableDocumentAccess,
  requireEditableTeamAccess,
  requireReadableDocumentAccess,
  requireEditableWorkspaceAccess,
  requireWorkspaceAdminAccess,
} from "./access"
import { createNotification } from "./collaboration_utils"
import { getTeamMemberIds, getWorkspaceUserIds } from "./conversations"
import { queueEmailJobs } from "./email_job_handlers"
import { deleteDocumentCascade } from "./lifecycle"
import { listDocumentPresenceViewers } from "./normalization"
import { getAttachmentDoc } from "./data"
import { createId, getNow as now } from "./core"
import { getTeamDoc } from "./data"
import { normalizeTeam } from "./normalization"

type ServerAccessArgs = {
  serverToken: string
}

type StorageId = Id<"_storage">

type UpdateDocumentContentArgs = ServerAccessArgs & {
  currentUserId: string
  documentId: string
  content: string
  expectedUpdatedAt?: string
}

type UpdateDocumentArgs = ServerAccessArgs & {
  currentUserId: string
  documentId: string
  title?: string
  content?: string
  expectedUpdatedAt?: string
}

type SendDocumentMentionNotificationsArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
  documentId: string
  mentions: Array<{
    userId: string
    count: number
  }>
}

type DocumentPresenceArgs = ServerAccessArgs & {
  currentUserId: string
  documentId: string
  workosUserId: string
  email: string
  name: string
  avatarUrl: string
  avatarImageUrl?: string | null
  activeBlockId?: string | null
  sessionId: string
}

type ClearDocumentPresenceArgs = ServerAccessArgs & {
  currentUserId: string
  documentId: string
  workosUserId: string
  sessionId: string
}

type RenameDocumentArgs = ServerAccessArgs & {
  currentUserId: string
  documentId: string
  title: string
}

type DeleteDocumentArgs = ServerAccessArgs & {
  currentUserId: string
  documentId: string
}

type UpdateItemDescriptionArgs = ServerAccessArgs & {
  currentUserId: string
  itemId: string
  content: string
  expectedUpdatedAt?: string
}

type SendItemDescriptionMentionNotificationsArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
  itemId: string
  mentions: Array<{
    userId: string
    count: number
  }>
}

type GenerateAttachmentUploadUrlArgs = ServerAccessArgs & {
  currentUserId: string
  targetType: "workItem" | "document"
  targetId: string
}

type GenerateSettingsImageUploadUrlArgs = ServerAccessArgs & {
  currentUserId: string
  kind: "user-avatar" | "workspace-logo"
  workspaceId?: string
}

type CreateAttachmentArgs = ServerAccessArgs & {
  currentUserId: string
  targetType: "workItem" | "document"
  targetId: string
  storageId: StorageId
  fileName: string
  contentType: string
  size: number
}

type DeleteAttachmentArgs = ServerAccessArgs & {
  currentUserId: string
  attachmentId: string
}

type CreateDocumentArgs = ServerAccessArgs & {
  currentUserId: string
  id?: string
  kind: "team-document" | "workspace-document" | "private-document"
  teamId?: string
  workspaceId?: string
  title: string
}

export async function updateDocumentContentHandler(
  ctx: MutationCtx,
  args: UpdateDocumentContentArgs
) {
  assertServerToken(args.serverToken)
  const document = await getDocumentDoc(ctx, args.documentId)

  if (!document) {
    throw new Error("Document not found")
  }

  await requireEditableDocumentAccess(ctx, document, args.currentUserId)

  if (
    args.expectedUpdatedAt !== undefined &&
    document.updatedAt !== args.expectedUpdatedAt
  ) {
    throw new Error("Document changed while you were editing")
  }

  const updatedAt = getNow()

  await ctx.db.patch(document._id, {
    content: args.content,
    notifiedMentionCounts: getClampedNotifiedMentionCounts(
      args.content,
      document.notifiedMentionCounts
    ),
    updatedAt,
    updatedBy: args.currentUserId,
  })

  return {
    updatedAt,
  }
}

export async function updateDocumentHandler(
  ctx: MutationCtx,
  args: UpdateDocumentArgs
) {
  assertServerToken(args.serverToken)

  if (args.title === undefined && args.content === undefined) {
    return
  }

  const document = await getDocumentDoc(ctx, args.documentId)

  if (!document) {
    throw new Error("Document not found")
  }

  await requireEditableDocumentAccess(ctx, document, args.currentUserId)

  if (
    args.expectedUpdatedAt !== undefined &&
    document.updatedAt !== args.expectedUpdatedAt
  ) {
    throw new Error("Document changed while you were editing")
  }

  const updatedAt = getNow()

  await ctx.db.patch(document._id, {
    ...(args.title !== undefined ? { title: args.title } : {}),
    ...(args.content !== undefined
      ? {
          content: args.content,
          notifiedMentionCounts: getClampedNotifiedMentionCounts(
            args.content,
            document.notifiedMentionCounts
          ),
        }
      : {}),
    updatedAt,
    updatedBy: args.currentUserId,
  })

  return {
    updatedAt,
  }
}

function normalizeMentionNotificationCount(count: number) {
  if (!Number.isFinite(count) || count <= 0) {
    return 0
  }

  return Math.floor(count)
}

function normalizeStoredMentionCounts(
  mentionCounts?: Record<string, number> | null
) {
  const normalizedCounts: Record<string, number> = {}

  for (const [userId, count] of Object.entries(mentionCounts ?? {})) {
    const normalizedUserId = userId.trim()
    const normalizedCount = normalizeMentionNotificationCount(count)

    if (normalizedUserId.length === 0 || normalizedCount === 0) {
      continue
    }

    normalizedCounts[normalizedUserId] = normalizedCount
  }

  return normalizedCounts
}

function clampStoredMentionCountsToContentCounts(
  storedCounts: Record<string, number>,
  contentCounts: Record<string, number>
) {
  const clampedCounts: Record<string, number> = {}

  for (const [userId, contentCount] of Object.entries(contentCounts)) {
    const normalizedContentCount =
      normalizeMentionNotificationCount(contentCount)

    if (normalizedContentCount === 0) {
      continue
    }

    const normalizedCount = Math.min(
      normalizedContentCount,
      normalizeMentionNotificationCount(storedCounts[userId] ?? 0)
    )

    if (normalizedCount > 0) {
      clampedCounts[userId] = normalizedCount
    }
  }

  return clampedCounts
}

export function getClampedNotifiedMentionCounts(
  content: string,
  notifiedMentionCounts?: Record<string, number> | null
) {
  return clampStoredMentionCountsToContentCounts(
    normalizeStoredMentionCounts(notifiedMentionCounts),
    extractRichTextMentionCounts(content)
  )
}

function buildAdvancedNotifiedMentionCounts(
  persistedMentionCounts: Record<string, number>,
  notifiedMentionCounts: Record<string, number>,
  deliveredMentionCounts: Map<string, number>
) {
  const nextNotifiedMentionCounts = {
    ...notifiedMentionCounts,
  }

  for (const [userId, deliveredCount] of deliveredMentionCounts.entries()) {
    const normalizedDeliveredCount =
      normalizeMentionNotificationCount(deliveredCount)

    if (normalizedDeliveredCount === 0) {
      continue
    }

    const persistedCount = normalizeMentionNotificationCount(
      persistedMentionCounts[userId] ?? 0
    )

    if (persistedCount === 0) {
      continue
    }

    nextNotifiedMentionCounts[userId] = Math.min(
      persistedCount,
      (nextNotifiedMentionCounts[userId] ?? 0) + normalizedDeliveredCount
    )
  }

  return nextNotifiedMentionCounts
}

function buildDocumentMentionNotificationMessage(
  actorName: string,
  documentTitle: string,
  mentionCount: number
) {
  if (mentionCount > 1) {
    return `${actorName} mentioned you ${mentionCount} times in ${documentTitle}`
  }

  return `${actorName} mentioned you in ${documentTitle}`
}

function buildDocumentMentionDetailText(mentionCount: number) {
  if (mentionCount > 1) {
    return `You were mentioned ${mentionCount} times in this live document before notifications were sent.`
  }

  return "You were mentioned in this live document."
}

export async function sendDocumentMentionNotificationsHandler(
  ctx: MutationCtx,
  args: SendDocumentMentionNotificationsArgs
) {
  assertServerToken(args.serverToken)

  if (args.mentions.length === 0) {
    return {
      recipientCount: 0,
      mentionCount: 0,
    }
  }

  const document = await getDocumentDoc(ctx, args.documentId)

  if (!document) {
    throw new Error("Document not found")
  }

  await requireEditableDocumentAccess(ctx, document, args.currentUserId)

  if (document.kind === "private-document") {
    throw new Error("Private documents do not support mention notifications")
  }

  const audienceUserIds = new Set(
    document.teamId
      ? await getTeamMemberIds(ctx, document.teamId)
      : document.workspaceId
        ? await getWorkspaceUserIds(ctx, document.workspaceId)
        : []
  )
  const persistedMentionCounts = extractRichTextMentionCounts(document.content)
  const notifiedMentionCounts = clampStoredMentionCountsToContentCounts(
    normalizeStoredMentionCounts(document.notifiedMentionCounts),
    persistedMentionCounts
  )
  const mentionCounts = new Map<string, number>()

  for (const mention of args.mentions) {
    const normalizedUserId = mention.userId.trim()
    const normalizedCount = normalizeMentionNotificationCount(mention.count)

    if (normalizedUserId.length === 0 || normalizedCount === 0) {
      continue
    }

    mentionCounts.set(
      normalizedUserId,
      (mentionCounts.get(normalizedUserId) ?? 0) + normalizedCount
    )
  }

  if (mentionCounts.size === 0) {
    return {
      recipientCount: 0,
      mentionCount: 0,
    }
  }

  for (const userId of mentionCounts.keys()) {
    if (userId === args.currentUserId) {
      continue
    }

    if (!audienceUserIds.has(userId)) {
      throw new Error(
        "One or more mentioned users are invalid for this document"
      )
    }

    if (
      (persistedMentionCounts[userId] ?? 0) < (mentionCounts.get(userId) ?? 0)
    ) {
      throw new Error(
        "One or more mentioned users are not present in the document"
      )
    }

    if (
      (persistedMentionCounts[userId] ?? 0) -
        (notifiedMentionCounts[userId] ?? 0) <
      (mentionCounts.get(userId) ?? 0)
    ) {
      throw new Error(
        "One or more mentioned users were already notified for this document"
      )
    }
  }

  const users = await listActiveUsersByIds(ctx, [
    args.currentUserId,
    ...mentionCounts.keys(),
  ])
  const usersById = new Map(users.map((user) => [user.id, user]))
  const actorName = usersById.get(args.currentUserId)?.name ?? "Someone"
  const mentionEmails: MentionEmail[] = []
  const documentTitle = document.title.trim() || "Untitled document"
  const deliveredMentionCounts = new Map<string, number>()
  let mentionCount = 0
  let recipientCount = 0

  for (const [
    mentionedUserId,
    recipientMentionCount,
  ] of mentionCounts.entries()) {
    if (mentionedUserId === args.currentUserId) {
      continue
    }

    const mentionedUser = usersById.get(mentionedUserId)

    if (!mentionedUser) {
      continue
    }

    const notification = createNotification(
      mentionedUserId,
      args.currentUserId,
      buildDocumentMentionNotificationMessage(
        actorName,
        documentTitle,
        recipientMentionCount
      ),
      "document",
      args.documentId,
      "mention"
    )

    await ctx.db.insert("notifications", notification)

    if (mentionedUser.preferences.emailMentions) {
      mentionEmails.push({
        notificationId: notification.id,
        email: mentionedUser.email,
        name: mentionedUser.name,
        entityTitle: documentTitle,
        entityType: "document",
        entityId: args.documentId,
        actorName,
        commentText: "",
        detailLabel: "Summary",
        detailText: buildDocumentMentionDetailText(recipientMentionCount),
        mentionCount: recipientMentionCount,
      })
    }

    deliveredMentionCounts.set(mentionedUserId, recipientMentionCount)
    mentionCount += recipientMentionCount
    recipientCount += 1
  }

  await ctx.db.patch(document._id, {
    notifiedMentionCounts: buildAdvancedNotifiedMentionCounts(
      persistedMentionCounts,
      notifiedMentionCounts,
      deliveredMentionCounts
    ),
  })

  await queueEmailJobs(
    ctx,
    buildMentionEmailJobs({
      origin: args.origin,
      emails: mentionEmails,
    })
  )

  return {
    recipientCount,
    mentionCount,
  }
}

export async function sendItemDescriptionMentionNotificationsHandler(
  ctx: MutationCtx,
  args: SendItemDescriptionMentionNotificationsArgs
) {
  assertServerToken(args.serverToken)

  if (args.mentions.length === 0) {
    return {
      recipientCount: 0,
      mentionCount: 0,
    }
  }

  const item = await getWorkItemDoc(ctx, args.itemId)

  if (!item) {
    throw new Error("Work item not found")
  }

  await requireEditableTeamAccess(ctx, item.teamId, args.currentUserId)

  const descriptionDocument = await getDocumentDoc(ctx, item.descriptionDocId)

  if (!descriptionDocument) {
    throw new Error("Work item description document not found")
  }

  const audienceUserIds = new Set(await getTeamMemberIds(ctx, item.teamId))
  const persistedMentionCounts = extractRichTextMentionCounts(
    descriptionDocument.content
  )
  const notifiedMentionCounts = clampStoredMentionCountsToContentCounts(
    normalizeStoredMentionCounts(descriptionDocument.notifiedMentionCounts),
    persistedMentionCounts
  )
  const mentionCounts = new Map<string, number>()

  for (const mention of args.mentions) {
    const normalizedUserId = mention.userId.trim()
    const normalizedCount = normalizeMentionNotificationCount(mention.count)

    if (normalizedUserId.length === 0 || normalizedCount === 0) {
      continue
    }

    mentionCounts.set(
      normalizedUserId,
      (mentionCounts.get(normalizedUserId) ?? 0) + normalizedCount
    )
  }

  if (mentionCounts.size === 0) {
    return {
      recipientCount: 0,
      mentionCount: 0,
    }
  }

  for (const userId of mentionCounts.keys()) {
    if (!audienceUserIds.has(userId)) {
      throw new Error(
        "One or more mentioned users are invalid for this work item"
      )
    }

    if (
      (persistedMentionCounts[userId] ?? 0) < (mentionCounts.get(userId) ?? 0)
    ) {
      throw new Error(
        "One or more mentioned users are not present in this work item"
      )
    }

    if (
      (persistedMentionCounts[userId] ?? 0) -
        (notifiedMentionCounts[userId] ?? 0) <
      (mentionCounts.get(userId) ?? 0)
    ) {
      throw new Error(
        "One or more mentioned users were already notified for this work item"
      )
    }
  }

  const users = await listActiveUsersByIds(ctx, [
    args.currentUserId,
    ...mentionCounts.keys(),
  ])
  const usersById = new Map(users.map((user) => [user.id, user]))
  const actorName = usersById.get(args.currentUserId)?.name ?? "Someone"
  const team = await getTeamDoc(ctx, item.teamId)
  const teamName = team ? normalizeTeam(team).name : null
  const mentionEmails: MentionEmail[] = []
  const itemTitle = item.title.trim() || item.key
  const deliveredMentionCounts = new Map<string, number>()
  let mentionCount = 0
  let recipientCount = 0

  for (const [
    mentionedUserId,
    recipientMentionCount,
  ] of mentionCounts.entries()) {
    const mentionedUser = usersById.get(mentionedUserId)

    if (!mentionedUser) {
      continue
    }

    const notification = createNotification(
      mentionedUserId,
      args.currentUserId,
      buildWorkItemDescriptionMentionNotificationMessage(
        actorName,
        itemTitle,
        teamName,
        recipientMentionCount
      ),
      "workItem",
      args.itemId,
      "mention"
    )

    await ctx.db.insert("notifications", notification)

    if (mentionedUser.preferences.emailMentions) {
      mentionEmails.push({
        notificationId: notification.id,
        email: mentionedUser.email,
        name: mentionedUser.name,
        entityTitle: itemTitle,
        entityType: "workItem",
        entityId: args.itemId,
        entityPath: `/items/${args.itemId}`,
        actorName,
        commentText: "",
        detailLabel: "Description",
        detailText: buildWorkItemDescriptionMentionDetailText(
          itemTitle,
          teamName,
          recipientMentionCount
        ),
        mentionCount: recipientMentionCount,
      })
    }

    deliveredMentionCounts.set(mentionedUserId, recipientMentionCount)
    mentionCount += recipientMentionCount
    recipientCount += 1
  }

  await ctx.db.patch(descriptionDocument._id, {
    notifiedMentionCounts: buildAdvancedNotifiedMentionCounts(
      persistedMentionCounts,
      notifiedMentionCounts,
      deliveredMentionCounts
    ),
  })

  await queueEmailJobs(
    ctx,
    buildMentionEmailJobs({
      origin: args.origin,
      emails: mentionEmails,
    })
  )

  return {
    recipientCount,
    mentionCount,
  }
}

export async function heartbeatDocumentPresenceHandler(
  ctx: MutationCtx,
  args: DocumentPresenceArgs
) {
  assertServerToken(args.serverToken)

  const document = await getDocumentDoc(ctx, args.documentId)
  await requireReadableDocumentAccess(ctx, document, args.currentUserId)

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
      documentId: args.documentId,
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
      documentId: args.documentId,
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
    args.documentId,
    args.currentUserId,
    args.workosUserId
  )
}

export async function clearDocumentPresenceHandler(
  ctx: MutationCtx,
  args: ClearDocumentPresenceArgs
) {
  assertServerToken(args.serverToken)

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
    if (existingPresence.documentId !== args.documentId) {
      continue
    }

    await ctx.db.delete(existingPresence._id)
  }

  return { ok: true }
}

export async function renameDocumentHandler(
  ctx: MutationCtx,
  args: RenameDocumentArgs
) {
  assertServerToken(args.serverToken)
  const document = await getDocumentDoc(ctx, args.documentId)

  if (!document) {
    throw new Error("Document not found")
  }

  await requireEditableDocumentAccess(ctx, document, args.currentUserId)

  await ctx.db.patch(document._id, {
    title: args.title,
    updatedAt: getNow(),
    updatedBy: args.currentUserId,
  })
}

export async function deleteDocumentHandler(
  ctx: MutationCtx,
  args: DeleteDocumentArgs
) {
  assertServerToken(args.serverToken)
  const document = await getDocumentDoc(ctx, args.documentId)

  if (!document) {
    throw new Error("Document not found")
  }

  if (document.kind === "item-description") {
    throw new Error("Work item description documents can't be deleted directly")
  }

  await requireEditableDocumentAccess(ctx, document, args.currentUserId)
  await deleteDocumentCascade(ctx, {
    currentUserId: args.currentUserId,
    document,
  })
}

export async function updateItemDescriptionHandler(
  ctx: MutationCtx,
  args: UpdateItemDescriptionArgs
) {
  assertServerToken(args.serverToken)
  const item = await getWorkItemDoc(ctx, args.itemId)

  if (!item) {
    throw new Error("Work item not found")
  }

  await requireEditableTeamAccess(ctx, item.teamId, args.currentUserId)

  const descriptionDocument = await getDocumentDoc(ctx, item.descriptionDocId)

  if (!descriptionDocument) {
    throw new Error("Work item description document not found")
  }

  if (
    args.expectedUpdatedAt !== undefined &&
    descriptionDocument.updatedAt !== args.expectedUpdatedAt
  ) {
    throw new Error("Work item description changed while you were editing")
  }

  const updatedAt = getNow()

  await ctx.db.patch(descriptionDocument._id, {
    content: args.content,
    notifiedMentionCounts: getClampedNotifiedMentionCounts(
      args.content,
      descriptionDocument.notifiedMentionCounts
    ),
    updatedAt,
    updatedBy: args.currentUserId,
  })

  await ctx.db.patch(item._id, {
    updatedAt,
  })

  return {
    updatedAt,
    documentId: descriptionDocument.id,
  }
}

export async function generateAttachmentUploadUrlHandler(
  ctx: MutationCtx,
  args: GenerateAttachmentUploadUrlArgs
) {
  assertServerToken(args.serverToken)
  const target = await resolveAttachmentTarget(
    ctx,
    args.targetType,
    args.targetId
  )
  await requireEditableTeamAccess(ctx, target.teamId, args.currentUserId)

  return {
    uploadUrl: await ctx.storage.generateUploadUrl(),
  }
}

export async function generateSettingsImageUploadUrlHandler(
  ctx: MutationCtx,
  args: GenerateSettingsImageUploadUrlArgs
) {
  assertServerToken(args.serverToken)

  if (args.kind === "workspace-logo") {
    if (!args.workspaceId) {
      throw new Error("Workspace not found")
    }

    await requireWorkspaceAdminAccess(ctx, args.workspaceId, args.currentUserId)
  } else {
    const user = await getUserDoc(ctx, args.currentUserId)

    if (!user) {
      throw new Error("User not found")
    }
  }

  return {
    uploadUrl: await ctx.storage.generateUploadUrl(),
  }
}

export async function createAttachmentHandler(
  ctx: MutationCtx,
  args: CreateAttachmentArgs
) {
  assertServerToken(args.serverToken)
  const target = await resolveAttachmentTarget(
    ctx,
    args.targetType,
    args.targetId
  )
  await requireEditableTeamAccess(ctx, target.teamId, args.currentUserId)

  const metadata = await ctx.storage.getMetadata(args.storageId)

  if (!metadata) {
    throw new Error("Uploaded file not found")
  }

  if ((metadata.size ?? args.size) <= 0) {
    throw new Error("File is empty")
  }

  const attachment = {
    id: createId("attachment"),
    targetType: args.targetType,
    targetId: args.targetId,
    teamId: target.teamId,
    storageId: args.storageId,
    fileName: args.fileName,
    contentType:
      args.contentType || metadata.contentType || "application/octet-stream",
    size: metadata.size ?? args.size,
    uploadedBy: args.currentUserId,
    createdAt: now(),
  }

  await ctx.db.insert("attachments", attachment)

  if (target.entityType === "workItem") {
    await ctx.db.patch(target.recordId, {
      updatedAt: getNow(),
    })
  } else {
    await ctx.db.patch(target.recordId, {
      updatedAt: getNow(),
      updatedBy: args.currentUserId,
    })
  }

  return {
    attachmentId: attachment.id,
    fileUrl: await ctx.storage.getUrl(args.storageId),
  }
}

export async function deleteAttachmentHandler(
  ctx: MutationCtx,
  args: DeleteAttachmentArgs
) {
  assertServerToken(args.serverToken)
  const attachment = await getAttachmentDoc(ctx, args.attachmentId)

  if (!attachment) {
    throw new Error("Attachment not found")
  }

  await requireEditableTeamAccess(ctx, attachment.teamId, args.currentUserId)
  await ctx.storage.delete(attachment.storageId)
  await ctx.db.delete(attachment._id)

  const target = await resolveAttachmentTarget(
    ctx,
    attachment.targetType,
    attachment.targetId
  )

  if (target.entityType === "workItem") {
    await ctx.db.patch(target.recordId, {
      updatedAt: getNow(),
    })
  } else {
    await ctx.db.patch(target.recordId, {
      updatedAt: getNow(),
      updatedBy: args.currentUserId,
    })
  }

  return {
    attachmentId: attachment.id,
  }
}

export async function createDocumentHandler(
  ctx: MutationCtx,
  args: CreateDocumentArgs
) {
  assertServerToken(args.serverToken)
  const documentId = args.id ?? createId("document")
  const workspaceId =
    args.kind === "team-document"
      ? ((await getTeamDoc(ctx, args.teamId ?? ""))?.workspaceId ?? "")
      : (args.workspaceId ?? "")

  if (args.kind === "team-document") {
    if (!args.teamId) {
      throw new Error("Team is required")
    }

    await requireEditableTeamAccess(ctx, args.teamId, args.currentUserId)
    const team = await getTeamDoc(ctx, args.teamId)

    if (!team) {
      throw new Error("Team not found")
    }

    if (!normalizeTeam(team).settings.features.docs) {
      throw new Error("Docs are disabled for this team")
    }
  } else {
    if (!workspaceId) {
      throw new Error("Workspace is required")
    }

    await requireEditableWorkspaceAccess(ctx, workspaceId, args.currentUserId)
  }

  const contentTemplate =
    args.kind === "private-document"
      ? "New private document."
      : args.kind === "workspace-document"
        ? "New workspace document."
        : "New team document."

  await ctx.db.insert("documents", {
    id: documentId,
    kind: args.kind,
    workspaceId,
    teamId: args.kind === "team-document" ? (args.teamId ?? null) : null,
    title: args.title,
    content: `<h1>${args.title}</h1><p>${contentTemplate}</p>`,
    linkedProjectIds: [],
    linkedWorkItemIds: [],
    createdBy: args.currentUserId,
    updatedBy: args.currentUserId,
    createdAt: getNow(),
    updatedAt: getNow(),
  })

  return {
    documentId,
    workspaceId,
  }
}

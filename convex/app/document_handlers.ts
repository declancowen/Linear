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
import {
  clearDocumentPresenceForActor,
  upsertDocumentPresenceForActor,
} from "./presence_helpers"
import { getAttachmentDoc } from "./data"
import { createId, getNow as now } from "./core"
import { getTeamDoc } from "./data"
import { normalizeTeam } from "./normalization"

type ServerAccessArgs = {
  serverToken: string
}

type StorageId = Id<"_storage">
type DocumentDoc = NonNullable<Awaited<ReturnType<typeof getDocumentDoc>>>
type WorkItemDoc = NonNullable<Awaited<ReturnType<typeof getWorkItemDoc>>>
type AttachmentTarget = Awaited<ReturnType<typeof resolveAttachmentTarget>>
type AttachmentUploadMetadata = NonNullable<
  Awaited<ReturnType<MutationCtx["storage"]["getMetadata"]>>
>

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

type MentionInput = Array<{
  userId: string
  count: number
}>

type MentionResult = {
  recipientCount: number
  mentionCount: number
}

type MentionValidationMessages = {
  invalidUser: string
  missingMention: string
  alreadyNotified: string
}

type MentionTrackingState = {
  persistedMentionCounts: Record<string, number>
  notifiedMentionCounts: Record<string, number>
}

type ActiveMentionUser = Awaited<
  ReturnType<typeof listActiveUsersByIds>
>[number]

type MentionEmailFactory = (args: {
  mentionedUser: ActiveMentionUser
  notificationId: string
  recipientMentionCount: number
}) => MentionEmail

type MentionDeliveryArgs = {
  buildEmail: MentionEmailFactory
  buildMessage: (recipientMentionCount: number) => string
  ctx: MutationCtx
  currentUserId: string
  entityId: string
  entityType: "document" | "workItem"
  mentionCounts: Map<string, number>
  skipCurrentUser: boolean
  usersById: Map<string, ActiveMentionUser>
}

async function requireTeamDocumentCreateAccess(
  ctx: MutationCtx,
  args: CreateDocumentArgs
) {
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

  return team.workspaceId
}

async function requireWorkspaceDocumentCreateAccess(
  ctx: MutationCtx,
  args: CreateDocumentArgs
) {
  const workspaceId = args.workspaceId ?? ""

  if (!workspaceId) {
    throw new Error("Workspace is required")
  }

  await requireEditableWorkspaceAccess(ctx, workspaceId, args.currentUserId)

  return workspaceId
}

function getDocumentContentTemplate(kind: CreateDocumentArgs["kind"]) {
  if (kind === "private-document") {
    return "New private document."
  }

  return kind === "workspace-document"
    ? "New workspace document."
    : "New team document."
}

async function requireDocumentCreateAccess(
  ctx: MutationCtx,
  args: CreateDocumentArgs
) {
  return args.kind === "team-document"
    ? requireTeamDocumentCreateAccess(ctx, args)
    : requireWorkspaceDocumentCreateAccess(ctx, args)
}

function assertExpectedDocumentUpdatedAt(
  document: { updatedAt: string },
  expectedUpdatedAt: string | undefined,
  message: string
) {
  if (expectedUpdatedAt !== undefined && document.updatedAt !== expectedUpdatedAt) {
    throw new Error(message)
  }
}

async function requireEditableDocumentForUpdate(
  ctx: MutationCtx,
  args: {
    currentUserId: string
    documentId: string
    expectedUpdatedAt?: string
  }
) {
  const document = await getDocumentDoc(ctx, args.documentId)

  if (!document) {
    throw new Error("Document not found")
  }

  await requireEditableDocumentAccess(ctx, document, args.currentUserId)
  assertExpectedDocumentUpdatedAt(
    document,
    args.expectedUpdatedAt,
    "Document changed while you were editing"
  )

  return document
}

async function touchAttachmentTarget(
  ctx: MutationCtx,
  target: AttachmentTarget,
  currentUserId: string
) {
  await ctx.db.patch(
    target.recordId,
    target.entityType === "workItem"
      ? {
          updatedAt: getNow(),
        }
      : {
          updatedAt: getNow(),
          updatedBy: currentUserId,
        }
  )
}

export async function updateDocumentContentHandler(
  ctx: MutationCtx,
  args: UpdateDocumentContentArgs
) {
  assertServerToken(args.serverToken)
  const document = await requireEditableDocumentForUpdate(ctx, args)

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

  const document = await requireEditableDocumentForUpdate(ctx, args)

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

function emptyMentionResult(): MentionResult {
  return {
    recipientCount: 0,
    mentionCount: 0,
  }
}

async function requireEditableItemDescriptionDocument(
  ctx: MutationCtx,
  args: {
    currentUserId: string
    itemId: string
  }
): Promise<{
  item: WorkItemDoc
  descriptionDocument: DocumentDoc
}> {
  const item = await getWorkItemDoc(ctx, args.itemId)

  if (!item) {
    throw new Error("Work item not found")
  }

  await requireEditableTeamAccess(ctx, item.teamId, args.currentUserId)

  const descriptionDocument = await getDocumentDoc(ctx, item.descriptionDocId)

  if (!descriptionDocument) {
    throw new Error("Work item description document not found")
  }

  return {
    item,
    descriptionDocument,
  }
}

function normalizeMentionCounts(mentions: MentionInput) {
  const mentionCounts = new Map<string, number>()

  for (const mention of mentions) {
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

  return mentionCounts
}

function getMentionTrackingState(
  content: string,
  notifiedMentionCounts?: Record<string, number> | null
): MentionTrackingState {
  const persistedMentionCounts = extractRichTextMentionCounts(content)

  return {
    persistedMentionCounts,
    notifiedMentionCounts: clampStoredMentionCountsToContentCounts(
      normalizeStoredMentionCounts(notifiedMentionCounts),
      persistedMentionCounts
    ),
  }
}

function assertMentionCountsCanBeDelivered({
  audienceUserIds,
  currentUserId,
  mentionCounts,
  messages,
  persistedMentionCounts,
  notifiedMentionCounts,
  skipCurrentUser,
}: MentionTrackingState & {
  audienceUserIds: Set<string>
  currentUserId: string
  mentionCounts: Map<string, number>
  messages: MentionValidationMessages
  skipCurrentUser: boolean
}) {
  for (const [userId, requestedCount] of mentionCounts.entries()) {
    if (skipCurrentUser && userId === currentUserId) {
      continue
    }

    if (!audienceUserIds.has(userId)) {
      throw new Error(messages.invalidUser)
    }

    if ((persistedMentionCounts[userId] ?? 0) < requestedCount) {
      throw new Error(messages.missingMention)
    }

    if (
      (persistedMentionCounts[userId] ?? 0) -
        (notifiedMentionCounts[userId] ?? 0) <
      requestedCount
    ) {
      throw new Error(messages.alreadyNotified)
    }
  }
}

async function getMentionUsersById(
  ctx: MutationCtx,
  currentUserId: string,
  mentionCounts: Map<string, number>
) {
  const users = await listActiveUsersByIds(ctx, [
    currentUserId,
    ...mentionCounts.keys(),
  ])

  return new Map(users.map((user) => [user.id, user]))
}

async function deliverMentionNotifications({
  buildEmail,
  buildMessage,
  ctx,
  currentUserId,
  entityId,
  entityType,
  mentionCounts,
  skipCurrentUser,
  usersById,
}: MentionDeliveryArgs) {
  const mentionEmails: MentionEmail[] = []
  const deliveredMentionCounts = new Map<string, number>()
  let mentionCount = 0
  let recipientCount = 0

  for (const [
    mentionedUserId,
    recipientMentionCount,
  ] of mentionCounts.entries()) {
    if (skipCurrentUser && mentionedUserId === currentUserId) {
      continue
    }

    const mentionedUser = usersById.get(mentionedUserId)

    if (!mentionedUser) {
      continue
    }

    const notification = createNotification(
      mentionedUserId,
      currentUserId,
      buildMessage(recipientMentionCount),
      entityType,
      entityId,
      "mention"
    )

    await ctx.db.insert("notifications", notification)

    if (mentionedUser.preferences.emailMentions) {
      mentionEmails.push(
        buildEmail({
          mentionedUser,
          notificationId: notification.id,
          recipientMentionCount,
        })
      )
    }

    deliveredMentionCounts.set(mentionedUserId, recipientMentionCount)
    mentionCount += recipientMentionCount
    recipientCount += 1
  }

  return {
    deliveredMentionCounts,
    mentionCount,
    mentionEmails,
    recipientCount,
  }
}

async function getDocumentMentionAudienceUserIds(
  ctx: MutationCtx,
  document: DocumentDoc
) {
  if (document.teamId) {
    return new Set(await getTeamMemberIds(ctx, document.teamId))
  }

  if (document.workspaceId) {
    return new Set(await getWorkspaceUserIds(ctx, document.workspaceId))
  }

  return new Set<string>()
}

export async function sendDocumentMentionNotificationsHandler(
  ctx: MutationCtx,
  args: SendDocumentMentionNotificationsArgs
) {
  assertServerToken(args.serverToken)

  if (args.mentions.length === 0) {
    return emptyMentionResult()
  }

  const document = await getDocumentDoc(ctx, args.documentId)

  if (!document) {
    throw new Error("Document not found")
  }

  await requireEditableDocumentAccess(ctx, document, args.currentUserId)

  if (document.kind === "private-document") {
    throw new Error("Private documents do not support mention notifications")
  }

  const audienceUserIds = await getDocumentMentionAudienceUserIds(ctx, document)
  const mentionTracking = getMentionTrackingState(
    document.content,
    document.notifiedMentionCounts
  )
  const mentionCounts = normalizeMentionCounts(args.mentions)

  if (mentionCounts.size === 0) {
    return emptyMentionResult()
  }

  assertMentionCountsCanBeDelivered({
    ...mentionTracking,
    audienceUserIds,
    currentUserId: args.currentUserId,
    mentionCounts,
    messages: {
      invalidUser: "One or more mentioned users are invalid for this document",
      missingMention:
        "One or more mentioned users are not present in the document",
      alreadyNotified:
        "One or more mentioned users were already notified for this document",
    },
    skipCurrentUser: true,
  })

  const usersById = await getMentionUsersById(
    ctx,
    args.currentUserId,
    mentionCounts
  )
  const actorName = usersById.get(args.currentUserId)?.name ?? "Someone"
  const documentTitle = document.title.trim() || "Untitled document"
  const delivery = await deliverMentionNotifications({
    ctx,
    currentUserId: args.currentUserId,
    entityId: args.documentId,
    entityType: "document",
    mentionCounts,
    skipCurrentUser: true,
    usersById,
    buildMessage: (recipientMentionCount) =>
      buildDocumentMentionNotificationMessage(
        actorName,
        documentTitle,
        recipientMentionCount
      ),
    buildEmail: ({ mentionedUser, notificationId, recipientMentionCount }) => ({
      notificationId,
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
    }),
  })

  await ctx.db.patch(document._id, {
    notifiedMentionCounts: buildAdvancedNotifiedMentionCounts(
      mentionTracking.persistedMentionCounts,
      mentionTracking.notifiedMentionCounts,
      delivery.deliveredMentionCounts
    ),
  })

  await queueEmailJobs(
    ctx,
    buildMentionEmailJobs({
      origin: args.origin,
      emails: delivery.mentionEmails,
    })
  )

  return {
    recipientCount: delivery.recipientCount,
    mentionCount: delivery.mentionCount,
  }
}

export async function sendItemDescriptionMentionNotificationsHandler(
  ctx: MutationCtx,
  args: SendItemDescriptionMentionNotificationsArgs
) {
  assertServerToken(args.serverToken)

  if (args.mentions.length === 0) {
    return emptyMentionResult()
  }

  const { item, descriptionDocument } =
    await requireEditableItemDescriptionDocument(ctx, args)

  const audienceUserIds = new Set(await getTeamMemberIds(ctx, item.teamId))
  const mentionTracking = getMentionTrackingState(
    descriptionDocument.content,
    descriptionDocument.notifiedMentionCounts
  )
  const mentionCounts = normalizeMentionCounts(args.mentions)

  if (mentionCounts.size === 0) {
    return emptyMentionResult()
  }

  assertMentionCountsCanBeDelivered({
    ...mentionTracking,
    audienceUserIds,
    currentUserId: args.currentUserId,
    mentionCounts,
    messages: {
      invalidUser: "One or more mentioned users are invalid for this work item",
      missingMention:
        "One or more mentioned users are not present in this work item",
      alreadyNotified:
        "One or more mentioned users were already notified for this work item",
    },
    skipCurrentUser: false,
  })

  const usersById = await getMentionUsersById(
    ctx,
    args.currentUserId,
    mentionCounts
  )
  const actorName = usersById.get(args.currentUserId)?.name ?? "Someone"
  const team = await getTeamDoc(ctx, item.teamId)
  const teamName = team ? normalizeTeam(team).name : null
  const itemTitle = item.title.trim() || item.key
  const delivery = await deliverMentionNotifications({
    ctx,
    currentUserId: args.currentUserId,
    entityId: args.itemId,
    entityType: "workItem",
    mentionCounts,
    skipCurrentUser: false,
    usersById,
    buildMessage: (recipientMentionCount) =>
      buildWorkItemDescriptionMentionNotificationMessage(
        actorName,
        itemTitle,
        teamName,
        recipientMentionCount
      ),
    buildEmail: ({ mentionedUser, notificationId, recipientMentionCount }) => ({
      notificationId,
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
    }),
  })

  await ctx.db.patch(descriptionDocument._id, {
    notifiedMentionCounts: buildAdvancedNotifiedMentionCounts(
      mentionTracking.persistedMentionCounts,
      mentionTracking.notifiedMentionCounts,
      delivery.deliveredMentionCounts
    ),
  })

  await queueEmailJobs(
    ctx,
    buildMentionEmailJobs({
      origin: args.origin,
      emails: delivery.mentionEmails,
    })
  )

  return {
    recipientCount: delivery.recipientCount,
    mentionCount: delivery.mentionCount,
  }
}

export async function heartbeatDocumentPresenceHandler(
  ctx: MutationCtx,
  args: DocumentPresenceArgs
) {
  assertServerToken(args.serverToken)

  const document = await getDocumentDoc(ctx, args.documentId)
  await requireReadableDocumentAccess(ctx, document, args.currentUserId)

  const currentTime = getNow()
  await upsertDocumentPresenceForActor(ctx, args.documentId, args, currentTime)

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

  return clearDocumentPresenceForActor(ctx, args.documentId, args)
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
  const { item, descriptionDocument } =
    await requireEditableItemDescriptionDocument(ctx, args)

  assertExpectedDocumentUpdatedAt(
    descriptionDocument,
    args.expectedUpdatedAt,
    "Work item description changed while you were editing"
  )

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

async function loadAttachmentUploadMetadata(
  ctx: MutationCtx,
  args: Pick<CreateAttachmentArgs, "storageId" | "size">
) {
  const metadata = await ctx.storage.getMetadata(args.storageId)

  if (!metadata) {
    throw new Error("Uploaded file not found")
  }

  if ((metadata.size ?? args.size) <= 0) {
    throw new Error("File is empty")
  }

  return metadata
}

function createAttachmentRecord(
  args: CreateAttachmentArgs,
  target: AttachmentTarget,
  metadata: AttachmentUploadMetadata
) {
  return {
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

  const metadata = await loadAttachmentUploadMetadata(ctx, args)
  const attachment = createAttachmentRecord(args, target, metadata)

  await ctx.db.insert("attachments", attachment)

  await touchAttachmentTarget(ctx, target, args.currentUserId)

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

  await touchAttachmentTarget(ctx, target, args.currentUserId)

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
  const workspaceId = await requireDocumentCreateAccess(ctx, args)
  const contentTemplate = getDocumentContentTemplate(args.kind)
  const currentTime = getNow()

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
    createdAt: currentTime,
    updatedAt: currentTime,
  })

  return {
    documentId,
    workspaceId,
  }
}

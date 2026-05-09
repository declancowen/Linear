import type { MutationCtx } from "../_generated/server"
import type { MentionEmail } from "../../lib/email/builders"

import { createId, getNow } from "./core"
import { listUsersByIds } from "./data"
export {
  createMentionIds,
  haveSameIds,
  normalizeUniqueIds,
  toggleReactionUsers,
} from "../../lib/domain/collaboration-utils"

type MentionNotificationRecipient = {
  email: string
  name: string
  preferences: {
    emailMentions: boolean
  }
}

type MentionNotificationArgs = {
  actorId: string
  actorName: string
  commentText: string
  ctx: MutationCtx
  entityId: string
  entityLabel?: string
  entityPath?: string
  entityTitle: string
  entityType: MentionEmail["entityType"]
  mentionUserIds: string[]
  notifiedUserIds?: Set<string>
  usersById: ReadonlyMap<string, MentionNotificationRecipient>
}

export type MentionAudienceUser = Awaited<
  ReturnType<typeof listUsersByIds>
>[number]

export async function getMentionAudienceContext(
  ctx: MutationCtx,
  input: {
    actorUserId: string
    audienceUserIds: Iterable<string>
  }
) {
  const audienceUserIds = [...input.audienceUserIds]
  const users = await listUsersByIds(ctx, [
    input.actorUserId,
    ...audienceUserIds,
  ])
  const usersById = new Map(users.map((user) => [user.id, user]))

  return {
    actorName: usersById.get(input.actorUserId)?.name ?? "Someone",
    audienceUserIds,
    users,
    usersById,
  }
}

export function createNotification(
  userId: string,
  actorId: string,
  message: string,
  entityType:
    | "workItem"
    | "document"
    | "project"
    | "invite"
    | "channelPost"
    | "chat"
    | "team"
    | "workspace",
  entityId: string,
  type:
    | "mention"
    | "assignment"
    | "comment"
    | "message"
    | "invite"
    | "status-change"
) {
  return {
    id: createId("notification"),
    userId,
    actorId,
    message,
    entityType,
    entityId,
    type,
    readAt: null,
    archivedAt: null,
    emailedAt: null,
    digestClaimId: null,
    digestClaimedAt: null,
    createdAt: getNow(),
  }
}

export function createDeliveredNotification(
  userId: string,
  actorId: string,
  message: string,
  entityType:
    | "workItem"
    | "document"
    | "project"
    | "invite"
    | "channelPost"
    | "chat"
    | "team"
    | "workspace",
  entityId: string,
  type:
    | "mention"
    | "assignment"
    | "comment"
    | "message"
    | "invite"
    | "status-change"
) {
  return {
    ...createNotification(userId, actorId, message, entityType, entityId, type),
    emailedAt: getNow(),
  }
}

export async function insertMentionNotifications({
  actorId,
  actorName,
  commentText,
  ctx,
  entityId,
  entityLabel,
  entityPath,
  entityTitle,
  entityType,
  mentionUserIds,
  notifiedUserIds,
  usersById,
}: MentionNotificationArgs) {
  const mentionEmails: MentionEmail[] = []
  const deliveredUserIds = notifiedUserIds ?? new Set<string>()

  for (const mentionedUserId of mentionUserIds) {
    if (mentionedUserId === actorId || deliveredUserIds.has(mentionedUserId)) {
      continue
    }

    const mentionedUser = usersById.get(mentionedUserId)
    const notification = createNotification(
      mentionedUserId,
      actorId,
      `${actorName} mentioned you in ${entityTitle}`,
      entityType,
      entityId,
      "mention"
    )

    await ctx.db.insert("notifications", notification)

    if (mentionedUser?.preferences.emailMentions) {
      mentionEmails.push({
        notificationId: notification.id,
        email: mentionedUser.email,
        name: mentionedUser.name,
        entityTitle,
        entityType,
        entityId,
        entityPath,
        entityLabel,
        actorName,
        commentText,
      })
    }

    deliveredUserIds.add(mentionedUserId)
  }

  return {
    mentionEmails,
    notifiedUserIds: deliveredUserIds,
  }
}

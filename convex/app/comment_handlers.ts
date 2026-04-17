import type { MutationCtx } from "../_generated/server"

import { buildMentionEmailJobs } from "../../lib/email/builders"
import { getPlainTextContent } from "../../lib/utils"
import {
  createMentionIds,
  createNotification,
  toggleReactionUsers,
} from "./collaboration_utils"
import { assertServerToken, createId, getNow } from "./core"
import {
  getCommentDoc,
  getDocumentDoc,
  getWorkItemDoc,
  listCommentsByTarget,
  listUsersByIds,
} from "./data"
import {
  requireEditableTeamAccess,
  requireReadableDocumentAccess,
  requireReadableTeamAccess,
} from "./access"
import { getTeamMemberIds } from "./conversations"
import { queueEmailJobs } from "./email_job_handlers"

type ServerAccessArgs = {
  serverToken: string
}

type AddCommentArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
  targetType: "workItem" | "document"
  targetId: string
  parentCommentId?: string | null
  content: string
}

type ToggleCommentReactionArgs = ServerAccessArgs & {
  currentUserId: string
  commentId: string
  emoji: string
}

export async function addCommentHandler(
  ctx: MutationCtx,
  args: AddCommentArgs
) {
  assertServerToken(args.serverToken)
  let teamId = ""
  let followerIds: string[] = []
  let entityType: "workItem" | "document" = "workItem"
  let entityTitle = "item"
  const existingComments = await listCommentsByTarget(
    ctx,
    args.targetType,
    args.targetId
  )
  const parentComment = args.parentCommentId
    ? await getCommentDoc(ctx, args.parentCommentId)
    : null

  if (args.parentCommentId) {
    if (!parentComment) {
      throw new Error("Parent comment not found")
    }

    if (
      parentComment.targetType !== args.targetType ||
      parentComment.targetId !== args.targetId
    ) {
      throw new Error("Reply must stay on the same thread target")
    }
  }

  if (args.targetType === "workItem") {
    const item = await getWorkItemDoc(ctx, args.targetId)

    if (!item) {
      throw new Error("Work item not found")
    }

    teamId = item.teamId
    followerIds = [
      ...item.subscriberIds,
      item.creatorId,
      item.assigneeId ?? "",
      ...existingComments.map((comment) => comment.createdBy),
    ].filter(Boolean)
    entityTitle = item.title

    await ctx.db.patch(item._id, {
      updatedAt: getNow(),
    })
  } else {
    const document = await getDocumentDoc(ctx, args.targetId)

    if (!document) {
      throw new Error("Document not found")
    }

    if (!document.teamId) {
      throw new Error("Comments are only available on team documents")
    }

    teamId = document.teamId
    followerIds = [
      document.createdBy,
      document.updatedBy,
      ...existingComments.map((comment) => comment.createdBy),
    ]
    entityType = "document"
    entityTitle = document.title

    await ctx.db.patch(document._id, {
      updatedAt: getNow(),
      updatedBy: args.currentUserId,
    })
  }

  await requireEditableTeamAccess(ctx, teamId, args.currentUserId)

  const audienceUserIds = new Set(await getTeamMemberIds(ctx, teamId))
  const users = await listUsersByIds(ctx, [
    args.currentUserId,
    ...audienceUserIds,
  ])
  const usersById = new Map(users.map((user) => [user.id, user]))
  const actor = usersById.get(args.currentUserId)
  const mentionUserIds = createMentionIds(args.content, users, audienceUserIds)
  const notifiedUserIds = new Set<string>()
  const mentionEmails: Array<{
    notificationId: string
    email: string
    name: string
    entityTitle: string
    entityType: "workItem" | "document"
    entityId: string
    actorName: string
    commentText: string
  }> = []

  await ctx.db.insert("comments", {
    id: createId("comment"),
    targetType: args.targetType,
    targetId: args.targetId,
    parentCommentId: args.parentCommentId ?? null,
    content: args.content.trim(),
    mentionUserIds,
    reactions: [],
    createdBy: args.currentUserId,
    createdAt: getNow(),
  })

  for (const mentionedUserId of mentionUserIds) {
    if (
      mentionedUserId === args.currentUserId ||
      notifiedUserIds.has(mentionedUserId)
    ) {
      continue
    }

    const mentionedUser = usersById.get(mentionedUserId)
    const notification = createNotification(
      mentionedUserId,
      args.currentUserId,
      `${actor?.name ?? "Someone"} mentioned you in ${entityTitle}`,
      entityType,
      args.targetId,
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
        entityId: args.targetId,
        actorName: actor?.name ?? "Someone",
        commentText: getPlainTextContent(args.content),
      })
    }

    notifiedUserIds.add(mentionedUserId)
  }

  const followerMessage = args.parentCommentId
    ? `${actor?.name ?? "Someone"} replied in ${entityTitle}`
    : `${actor?.name ?? "Someone"} commented on ${entityTitle}`

  for (const followerId of followerIds) {
    if (
      !followerId ||
      !audienceUserIds.has(followerId) ||
      followerId === args.currentUserId ||
      notifiedUserIds.has(followerId)
    ) {
      continue
    }

    await ctx.db.insert(
      "notifications",
      createNotification(
        followerId,
        args.currentUserId,
        followerMessage,
        entityType,
        args.targetId,
        "comment"
      )
    )
    notifiedUserIds.add(followerId)
  }

  await queueEmailJobs(
    ctx,
    buildMentionEmailJobs({
      origin: args.origin,
      emails: mentionEmails,
    })
  )

  return {
    mentionEmails,
  }
}

export async function toggleCommentReactionHandler(
  ctx: MutationCtx,
  args: ToggleCommentReactionArgs
) {
  assertServerToken(args.serverToken)
  const comment = await getCommentDoc(ctx, args.commentId)

  if (!comment) {
    throw new Error("Comment not found")
  }

  if (comment.targetType === "workItem") {
    const item = await getWorkItemDoc(ctx, comment.targetId)

    if (!item) {
      throw new Error("Work item not found")
    }

    await requireReadableTeamAccess(ctx, item.teamId, args.currentUserId)
  } else {
    await requireReadableDocumentAccess(
      ctx,
      await getDocumentDoc(ctx, comment.targetId),
      args.currentUserId
    )
  }

  await ctx.db.patch(comment._id, {
    reactions: toggleReactionUsers(
      comment.reactions,
      args.emoji.trim(),
      args.currentUserId
    ),
  })

  return {
    commentId: comment.id,
    ok: true,
  }
}

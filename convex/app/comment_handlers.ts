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

type CommentEntityType = "workItem" | "document"
type AddCommentTargetContext = {
  entityTitle: string
  entityType: CommentEntityType
  followerIds: string[]
  teamId: string
}
type MentionEmail = {
  notificationId: string
  email: string
  name: string
  entityTitle: string
  entityType: CommentEntityType
  entityId: string
  actorName: string
  commentText: string
}

function assertParentCommentTarget(
  parentComment: Awaited<ReturnType<typeof getCommentDoc>> | null,
  args: AddCommentArgs
) {
  if (!args.parentCommentId) {
    return
  }

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

async function resolveWorkItemCommentTarget(
  ctx: MutationCtx,
  args: AddCommentArgs,
  existingComments: Awaited<ReturnType<typeof listCommentsByTarget>>
): Promise<AddCommentTargetContext> {
  const item = await getWorkItemDoc(ctx, args.targetId)

  if (!item) {
    throw new Error("Work item not found")
  }

  await ctx.db.patch(item._id, {
    updatedAt: getNow(),
  })

  return {
    teamId: item.teamId,
    followerIds: [
      ...item.subscriberIds,
      item.creatorId,
      item.assigneeId ?? "",
      ...existingComments.map((comment) => comment.createdBy),
    ].filter(Boolean),
    entityType: "workItem",
    entityTitle: item.title,
  }
}

async function resolveDocumentCommentTarget(
  ctx: MutationCtx,
  args: AddCommentArgs,
  existingComments: Awaited<ReturnType<typeof listCommentsByTarget>>
): Promise<AddCommentTargetContext> {
  const document = await getDocumentDoc(ctx, args.targetId)

  if (!document) {
    throw new Error("Document not found")
  }

  if (!document.teamId) {
    throw new Error("Comments are only available on team documents")
  }

  await ctx.db.patch(document._id, {
    updatedAt: getNow(),
    updatedBy: args.currentUserId,
  })

  return {
    teamId: document.teamId,
    followerIds: [
      document.createdBy,
      document.updatedBy,
      ...existingComments.map((comment) => comment.createdBy),
    ],
    entityType: "document",
    entityTitle: document.title,
  }
}

function insertComment(
  ctx: MutationCtx,
  args: AddCommentArgs,
  mentionUserIds: string[]
) {
  return ctx.db.insert("comments", {
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
}

async function notifyMentionedCommentUsers({
  ctx,
  args,
  actorName,
  entityTitle,
  entityType,
  mentionUserIds,
  usersById,
}: {
  ctx: MutationCtx
  args: AddCommentArgs
  actorName: string
  entityTitle: string
  entityType: CommentEntityType
  mentionUserIds: string[]
  usersById: Map<string, Awaited<ReturnType<typeof listUsersByIds>>[number]>
}) {
  const notifiedUserIds = new Set<string>()
  const mentionEmails: MentionEmail[] = []

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
      `${actorName} mentioned you in ${entityTitle}`,
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
        actorName,
        commentText: getPlainTextContent(args.content),
      })
    }

    notifiedUserIds.add(mentionedUserId)
  }

  return { mentionEmails, notifiedUserIds }
}

async function notifyCommentFollowers({
  ctx,
  args,
  audienceUserIds,
  entityTitle,
  entityType,
  followerIds,
  notifiedUserIds,
  actorName,
}: {
  ctx: MutationCtx
  args: AddCommentArgs
  audienceUserIds: Set<string>
  entityTitle: string
  entityType: CommentEntityType
  followerIds: string[]
  notifiedUserIds: Set<string>
  actorName: string
}) {
  const followerMessage = args.parentCommentId
    ? `${actorName} replied in ${entityTitle}`
    : `${actorName} commented on ${entityTitle}`

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
}

export async function addCommentHandler(
  ctx: MutationCtx,
  args: AddCommentArgs
) {
  assertServerToken(args.serverToken)
  const existingComments = await listCommentsByTarget(
    ctx,
    args.targetType,
    args.targetId
  )
  const parentComment = args.parentCommentId
    ? await getCommentDoc(ctx, args.parentCommentId)
    : null

  assertParentCommentTarget(parentComment, args)
  const targetContext =
    args.targetType === "workItem"
      ? await resolveWorkItemCommentTarget(ctx, args, existingComments)
      : await resolveDocumentCommentTarget(ctx, args, existingComments)

  await requireEditableTeamAccess(ctx, targetContext.teamId, args.currentUserId)

  const audienceUserIds = new Set(
    await getTeamMemberIds(ctx, targetContext.teamId)
  )
  const users = await listUsersByIds(ctx, [
    args.currentUserId,
    ...audienceUserIds,
  ])
  const usersById = new Map(users.map((user) => [user.id, user]))
  const actor = usersById.get(args.currentUserId)
  const mentionUserIds = createMentionIds(args.content, users, audienceUserIds)
  const actorName = actor?.name ?? "Someone"

  await insertComment(ctx, args, mentionUserIds)

  const { mentionEmails, notifiedUserIds } = await notifyMentionedCommentUsers({
    ctx,
    args,
    actorName,
    entityTitle: targetContext.entityTitle,
    entityType: targetContext.entityType,
    mentionUserIds,
    usersById,
  })

  await notifyCommentFollowers({
    ctx,
    args,
    audienceUserIds,
    actorName,
    entityTitle: targetContext.entityTitle,
    entityType: targetContext.entityType,
    followerIds: targetContext.followerIds,
    notifiedUserIds,
  })

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

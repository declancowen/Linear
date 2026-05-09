import type { MutationCtx } from "../_generated/server"

import {
  collectDocumentCommentFollowerIds,
  collectWorkItemCommentFollowerIds,
} from "../../lib/domain/comment-followers"
import { buildMentionEmailJobs } from "../../lib/email/builders"
import { getPlainTextContent } from "../../lib/utils"
import {
  createMentionIds,
  createNotification,
  getMentionAudienceContext,
  insertMentionNotifications,
  toggleReactionUsers,
  type MentionAudienceUser,
} from "./collaboration_utils"
import { assertServerToken, createId, getNow } from "./core"
import {
  getCommentDoc,
  getDocumentDoc,
  getWorkItemDoc,
  listCommentsByTarget,
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
export function assertParentCommentTarget(
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
    followerIds: collectWorkItemCommentFollowerIds({
      subscriberIds: item.subscriberIds,
      creatorId: item.creatorId,
      assigneeId: item.assigneeId,
      existingCommentAuthorIds: existingComments.map(
        (comment) => comment.createdBy
      ),
    }),
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
    followerIds: collectDocumentCommentFollowerIds({
      createdBy: document.createdBy,
      updatedBy: document.updatedBy,
      existingCommentAuthorIds: existingComments.map(
        (comment) => comment.createdBy
      ),
    }),
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
  usersById: Map<string, MentionAudienceUser>
}) {
  return insertMentionNotifications({
    actorId: args.currentUserId,
    actorName,
    commentText: getPlainTextContent(args.content),
    ctx,
    entityId: args.targetId,
    entityTitle,
    entityType,
    mentionUserIds,
    usersById,
  })
}

function getCommentFollowerMessage({
  actorName,
  entityTitle,
  parentCommentId,
}: {
  actorName: string
  entityTitle: string
  parentCommentId?: string | null
}) {
  return parentCommentId
    ? `${actorName} replied in ${entityTitle}`
    : `${actorName} commented on ${entityTitle}`
}

function shouldNotifyCommentFollower({
  audienceUserIds,
  currentUserId,
  followerId,
  notifiedUserIds,
}: {
  audienceUserIds: Set<string>
  currentUserId: string
  followerId: string
  notifiedUserIds: Set<string>
}) {
  return ![
    !followerId,
    !audienceUserIds.has(followerId),
    followerId === currentUserId,
    notifiedUserIds.has(followerId),
  ].some(Boolean)
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
  const followerMessage = getCommentFollowerMessage({
    actorName,
    entityTitle,
    parentCommentId: args.parentCommentId,
  })

  for (const followerId of followerIds) {
    if (
      !shouldNotifyCommentFollower({
        audienceUserIds,
        currentUserId: args.currentUserId,
        followerId,
        notifiedUserIds,
      })
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

  const audience = await getMentionAudienceContext(ctx, {
    actorUserId: args.currentUserId,
    audienceUserIds: await getTeamMemberIds(ctx, targetContext.teamId),
  })
  const mentionUserIds = createMentionIds(
    args.content,
    audience.users,
    audience.audienceUserIds
  )

  await insertComment(ctx, args, mentionUserIds)

  const { mentionEmails, notifiedUserIds } = await notifyMentionedCommentUsers({
    ctx,
    args,
    actorName: audience.actorName,
    entityTitle: targetContext.entityTitle,
    entityType: targetContext.entityType,
    mentionUserIds,
    usersById: audience.usersById,
  })

  await notifyCommentFollowers({
    ctx,
    args,
    actorName: audience.actorName,
    audienceUserIds: new Set(audience.audienceUserIds),
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

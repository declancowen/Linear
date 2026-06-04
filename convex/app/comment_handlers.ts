import type { MutationCtx } from "../_generated/server"

import {
  collectDocumentCommentFollowerIds,
  collectWorkItemCommentFollowerIds,
} from "../../lib/domain/comment-followers"
import { collectCommentDescendantIds } from "../../lib/domain/comment-threads"
import type { CommentEmail } from "../../lib/email/builders"
import { getPlainTextContent } from "../../lib/utils"
import { deleteContentReferencedAttachments } from "./cleanup"
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
  getWorkItemByDescriptionDocId,
  getWorkItemDoc,
  listCommentsByTarget,
} from "./data"
import {
  requireEditableDocumentAccess,
  requireEditableWorkItemAccess,
  requireReadableDocumentAccess,
  requireReadableWorkItemAccess,
  getWorkItemAudienceUserIds,
} from "./access"
import { getTeamMemberIds } from "./conversations"
import { queueMentionAndCommentEmailJobs } from "./email_job_handlers"
import {
  resolveDocumentCommentReferenceRelationships,
  resolveWorkItemCommentReferenceRelationships,
  type RichTextReferenceRelationshipIds,
} from "./rich_text_reference_relationships"

type ServerAccessArgs = {
  serverToken: string
}

type AddCommentArgs = ServerAccessArgs & {
  currentUserId: string
  commentId?: string
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

type UpdateCommentArgs = ServerAccessArgs & {
  currentUserId: string
  commentId: string
  content: string
}

type DeleteCommentArgs = ServerAccessArgs & {
  currentUserId: string
  commentId: string
}

type CommentEntityType = "workItem" | "document"
type AddCommentTargetContext = {
  entityTitle: string
  entityType: CommentEntityType
  followerIds: string[]
  teamId: string | null
  audienceUserIds: string[]
}

type CommentDoc = NonNullable<Awaited<ReturnType<typeof getCommentDoc>>>

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

async function resolveTopLevelParentComment(
  ctx: MutationCtx,
  parentComment: CommentDoc,
  args: AddCommentArgs
) {
  let topLevelParent = parentComment
  const seenParentIds = new Set<string>()

  while (topLevelParent.parentCommentId) {
    if (seenParentIds.has(topLevelParent.id)) {
      throw new Error("Parent comment thread is invalid")
    }

    seenParentIds.add(topLevelParent.id)
    const nextParent = await getCommentDoc(ctx, topLevelParent.parentCommentId)

    assertParentCommentTarget(nextParent, {
      ...args,
      parentCommentId: topLevelParent.parentCommentId,
    })

    if (!nextParent) {
      throw new Error("Parent comment not found")
    }

    topLevelParent = nextParent
  }

  return topLevelParent
}

async function normalizeAddCommentParent(
  ctx: MutationCtx,
  args: AddCommentArgs
) {
  const parentComment = args.parentCommentId
    ? await getCommentDoc(ctx, args.parentCommentId)
    : null

  assertParentCommentTarget(parentComment, args)

  if (!parentComment) {
    return args
  }

  const topLevelParent = await resolveTopLevelParentComment(
    ctx,
    parentComment,
    args
  )

  if (topLevelParent.id === args.parentCommentId) {
    return args
  }

  return {
    ...args,
    parentCommentId: topLevelParent.id,
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

  await requireEditableWorkItemAccess(ctx, item, args.currentUserId)
  const isPrivateItem = (item.visibility ?? "team") === "private"

  if (isPrivateItem) {
    throw new Error("Comments are not available on private tasks")
  }

  const teamMemberIds = item.teamId
    ? await getTeamMemberIds(ctx, item.teamId)
    : []

  await ctx.db.patch(item._id, {
    updatedAt: getNow(),
  })

  return {
    teamId: item.teamId,
    followerIds: collectWorkItemCommentFollowerIds({
      subscriberIds: item.subscriberIds,
      creatorId: item.creatorId,
      assigneeId: item.assigneeId,
      assigneeIds: item.assigneeIds,
      existingCommentAuthorIds: existingComments.map(
        (comment) => comment.createdBy
      ),
    }),
    entityType: "workItem",
    entityTitle: item.title,
    audienceUserIds: getWorkItemAudienceUserIds(item, teamMemberIds),
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

  await requireEditableDocumentAccess(ctx, document, args.currentUserId)
  const teamMemberIds = await getTeamMemberIds(ctx, document.teamId)

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
    audienceUserIds:
      document.kind === "item-description"
        ? getWorkItemAudienceUserIds(
            await requireWorkItemForDescriptionDocument(ctx, document.id),
            teamMemberIds
          )
        : teamMemberIds,
  }
}

async function resolveExistingCommentTarget(
  ctx: MutationCtx,
  args: {
    currentUserId: string
    content: string
    targetId: string
    targetType: "workItem" | "document"
  },
  existingComments: Awaited<ReturnType<typeof listCommentsByTarget>>
) {
  const targetArgs = {
    serverToken: "",
    currentUserId: args.currentUserId,
    origin: "",
    targetType: args.targetType,
    targetId: args.targetId,
    content: args.content,
  }

  return args.targetType === "workItem"
    ? resolveWorkItemCommentTarget(ctx, targetArgs, existingComments)
    : resolveDocumentCommentTarget(ctx, targetArgs, existingComments)
}

async function requireWorkItemForDescriptionDocument(
  ctx: MutationCtx,
  documentId: string
) {
  const item = await getWorkItemByDescriptionDocId(ctx, documentId)

  if (!item) {
    throw new Error("Work item not found")
  }

  return item
}

async function requireWorkItemCommentTarget(ctx: MutationCtx, itemId: string) {
  const item = await getWorkItemDoc(ctx, itemId)

  if (!item) {
    throw new Error("Work item not found")
  }

  return item
}

async function requireDocumentCommentTarget(
  ctx: MutationCtx,
  documentId: string
) {
  const document = await getDocumentDoc(ctx, documentId)

  if (!document) {
    throw new Error("Document not found")
  }

  return document
}

async function resolveCommentReferenceRelationships(
  ctx: MutationCtx,
  input: {
    content: string
    currentUserId: string
    targetId: string
    targetType: "workItem" | "document"
  }
) {
  if (input.targetType === "workItem") {
    return resolveWorkItemCommentReferenceRelationships(ctx, {
      content: input.content,
      currentUserId: input.currentUserId,
      item: await requireWorkItemCommentTarget(ctx, input.targetId),
    })
  }

  return resolveDocumentCommentReferenceRelationships(ctx, {
    content: input.content,
    currentUserId: input.currentUserId,
    document: await requireDocumentCommentTarget(ctx, input.targetId),
  })
}

async function insertComment(
  ctx: MutationCtx,
  args: AddCommentArgs,
  mentionUserIds: string[],
  referenceRelationships: RichTextReferenceRelationshipIds
) {
  const commentId = args.commentId?.trim() || createId("comment")

  if (args.commentId && (await getCommentDoc(ctx, commentId))) {
    throw new Error("Comment id already exists")
  }

  await ctx.db.insert("comments", {
    id: commentId,
    targetType: args.targetType,
    targetId: args.targetId,
    parentCommentId: args.parentCommentId ?? null,
    content: args.content.trim(),
    mentionUserIds,
    referencedWorkItemIds: referenceRelationships.workItemIds,
    referencedDocumentIds: referenceRelationships.documentIds,
    referencedProjectIds: referenceRelationships.projectIds,
    referencedViewIds: referenceRelationships.viewIds,
    reactions: [],
    createdBy: args.currentUserId,
    createdAt: getNow(),
  })

  return commentId
}

async function assertOwnedComment(
  comment: CommentDoc,
  currentUserId: string,
  action: "delete" | "edit"
) {
  if (comment.createdBy === currentUserId) {
    return
  }

  throw new Error(
    action === "edit"
      ? "You can only edit your own comments"
      : "You can only delete your own comments"
  )
}

async function notifyMentionedCommentUsers({
  ctx,
  args,
  actorName,
  commentId,
  entityTitle,
  entityType,
  mentionUserIds,
  usersById,
}: {
  ctx: MutationCtx
  args: AddCommentArgs
  actorName: string
  commentId: string
  entityTitle: string
  entityType: CommentEntityType
  mentionUserIds: string[]
  usersById: Map<string, MentionAudienceUser>
}) {
  const commentText = getPlainTextContent(args.content)

  return insertMentionNotifications({
    actorId: args.currentUserId,
    actorName,
    commentText,
    contentPreview: commentText,
    ctx,
    entityId: args.targetId,
    entityTitle,
    entityType,
    mentionUserIds,
    targetCommentId: commentId,
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
  commentId,
  commentText,
  entityTitle,
  entityType,
  followerIds,
  notifiedUserIds,
  actorName,
  usersById,
}: {
  ctx: MutationCtx
  args: AddCommentArgs
  audienceUserIds: Set<string>
  commentId: string
  commentText: string
  entityTitle: string
  entityType: CommentEntityType
  followerIds: string[]
  notifiedUserIds: Set<string>
  actorName: string
  usersById: ReadonlyMap<string, MentionAudienceUser>
}) {
  const commentEmails: CommentEmail[] = []
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

    const notification = createNotification(
      followerId,
      args.currentUserId,
      followerMessage,
      entityType,
      args.targetId,
      "comment",
      {
        contentPreview: commentText,
        targetCommentId: commentId,
      }
    )

    await ctx.db.insert("notifications", notification)

    const follower = usersById.get(followerId)

    if (follower && (follower.preferences.emailComments ?? true)) {
      commentEmails.push({
        notificationId: notification.id,
        email: follower.email,
        name: follower.name,
        entityTitle,
        entityType,
        entityId: args.targetId,
        actorName,
        commentText,
        isReply: Boolean(args.parentCommentId),
      })
    }

    notifiedUserIds.add(followerId)
  }

  return commentEmails
}

export async function addCommentHandler(
  ctx: MutationCtx,
  args: AddCommentArgs
) {
  assertServerToken(args.serverToken)
  const normalizedArgs = await normalizeAddCommentParent(ctx, args)
  const existingComments = await listCommentsByTarget(
    ctx,
    normalizedArgs.targetType,
    normalizedArgs.targetId
  )

  const targetContext =
    normalizedArgs.targetType === "workItem"
      ? await resolveWorkItemCommentTarget(ctx, normalizedArgs, existingComments)
      : await resolveDocumentCommentTarget(
          ctx,
          normalizedArgs,
          existingComments
        )

  const audience = await getMentionAudienceContext(ctx, {
    actorUserId: normalizedArgs.currentUserId,
    audienceUserIds: targetContext.audienceUserIds,
  })
  const mentionUserIds = createMentionIds(
    normalizedArgs.content,
    audience.users,
    audience.audienceUserIds
  )
  const referenceRelationships = await resolveCommentReferenceRelationships(ctx, {
    content: normalizedArgs.content,
    currentUserId: normalizedArgs.currentUserId,
    targetId: normalizedArgs.targetId,
    targetType: normalizedArgs.targetType,
  })

  const commentId = await insertComment(
    ctx,
    normalizedArgs,
    mentionUserIds,
    referenceRelationships
  )

  const { mentionEmails, notifiedUserIds } = await notifyMentionedCommentUsers({
    ctx,
    args: normalizedArgs,
    actorName: audience.actorName,
    commentId,
    entityTitle: targetContext.entityTitle,
    entityType: targetContext.entityType,
    mentionUserIds,
    usersById: audience.usersById,
  })

  const commentEmails = await notifyCommentFollowers({
    ctx,
    args: normalizedArgs,
    actorName: audience.actorName,
    audienceUserIds: new Set(audience.audienceUserIds),
    commentId,
    commentText: getPlainTextContent(normalizedArgs.content),
    entityTitle: targetContext.entityTitle,
    entityType: targetContext.entityType,
    followerIds: targetContext.followerIds,
    notifiedUserIds,
    usersById: audience.usersById,
  })

  await queueMentionAndCommentEmailJobs(ctx, {
    origin: args.origin,
    mentionEmails,
    commentEmails,
  })

  return {
    commentId,
    mentionEmails,
    commentEmails,
    notificationUserIds: [...notifiedUserIds],
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

    await requireReadableWorkItemAccess(ctx, item, args.currentUserId)

    if ((item.visibility ?? "team") === "private") {
      throw new Error("Comments are not available on private tasks")
    }
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
    targetType: comment.targetType,
    targetId: comment.targetId,
  }
}

export async function updateCommentHandler(
  ctx: MutationCtx,
  args: UpdateCommentArgs
) {
  assertServerToken(args.serverToken)
  const comment = await getCommentDoc(ctx, args.commentId)

  if (!comment) {
    throw new Error("Comment not found")
  }

  await assertOwnedComment(comment, args.currentUserId, "edit")
  const existingComments = await listCommentsByTarget(
    ctx,
    comment.targetType,
    comment.targetId
  )
  const targetContext = await resolveExistingCommentTarget(
    ctx,
    {
      currentUserId: args.currentUserId,
      targetType: comment.targetType,
      targetId: comment.targetId,
      content: args.content,
    },
    existingComments
  )
  const audience = await getMentionAudienceContext(ctx, {
    actorUserId: args.currentUserId,
    audienceUserIds: targetContext.audienceUserIds,
  })
  const mentionUserIds = createMentionIds(
    args.content,
    audience.users,
    audience.audienceUserIds
  )
  const referenceRelationships = await resolveCommentReferenceRelationships(ctx, {
    content: args.content,
    currentUserId: args.currentUserId,
    targetId: comment.targetId,
    targetType: comment.targetType,
  })

  await ctx.db.patch(comment._id, {
    content: args.content.trim(),
    mentionUserIds,
    referencedWorkItemIds: referenceRelationships.workItemIds,
    referencedDocumentIds: referenceRelationships.documentIds,
    referencedProjectIds: referenceRelationships.projectIds,
    referencedViewIds: referenceRelationships.viewIds,
    editedAt: getNow(),
  })

  return {
    ok: true,
    commentId: comment.id,
    targetType: comment.targetType,
    targetId: comment.targetId,
  }
}

export async function deleteCommentHandler(
  ctx: MutationCtx,
  args: DeleteCommentArgs
) {
  assertServerToken(args.serverToken)
  const comment = await getCommentDoc(ctx, args.commentId)

  if (!comment) {
    return {
      ok: true,
      commentId: args.commentId,
      deletedCommentIds: [],
      targetId: null,
      targetType: null,
    }
  }

  await assertOwnedComment(comment, args.currentUserId, "delete")
  const existingComments = await listCommentsByTarget(
    ctx,
    comment.targetType,
    comment.targetId
  )
  await resolveExistingCommentTarget(
    ctx,
    {
      currentUserId: args.currentUserId,
      targetType: comment.targetType,
      targetId: comment.targetId,
      content: comment.content,
    },
    existingComments
  )

  const deletedIds = collectCommentDescendantIds(existingComments, comment.id)
  const deletedContents = existingComments
    .filter((entry) => deletedIds.has(entry.id))
    .map((entry) => entry.content)

  for (const entry of existingComments) {
    if (deletedIds.has(entry.id)) {
      await ctx.db.delete(entry._id)
    }
  }

  if (comment.targetType === "workItem" || comment.targetType === "document") {
    await deleteContentReferencedAttachments(ctx, {
      targetType: comment.targetType,
      targetId: comment.targetId,
      contents: deletedContents,
    })
  }

  return {
    ok: true,
    commentId: comment.id,
    deletedCommentIds: [...deletedIds],
    targetType: comment.targetType,
    targetId: comment.targetId,
  }
}

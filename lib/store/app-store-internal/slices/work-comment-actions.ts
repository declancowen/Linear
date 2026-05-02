"use client"

import { toast } from "sonner"

import { syncAddComment, syncToggleCommentReaction } from "@/lib/convex/client"
import { commentSchema } from "@/lib/domain/types"

import {
  createId,
  createMentionIds,
  createNotification,
  getNow,
  toggleReactionUsers,
} from "../helpers"
import type { AddCommentInput, AppStore } from "../types"
import { effectiveRole, getTeamMemberIds } from "../validation"
import type { WorkSlice, WorkSliceFactoryArgs } from "./work-shared"

type CommentEntityType = "workItem" | "document"

type CommentTargetContext = {
  teamId: string
  followerIds: string[]
  entityType: CommentEntityType
  entityTitle: string
}

type CommentNotificationContext = {
  audienceUserIds: string[]
  currentUserId: string
  entityTitle: string
  entityType: CommentEntityType
  followerIds: string[]
  notifications: AppStore["notifications"]
  targetId: string
}

function getExistingTargetComments(state: AppStore, input: AddCommentInput) {
  return state.comments.filter(
    (comment) =>
      comment.targetType === input.targetType &&
      comment.targetId === input.targetId
  )
}

function hasMissingParentComment(
  input: AddCommentInput,
  existingComments: AppStore["comments"]
) {
  return Boolean(
    input.parentCommentId &&
    !existingComments.some((comment) => comment.id === input.parentCommentId)
  )
}

function resolveWorkItemCommentTarget(
  state: AppStore,
  input: AddCommentInput,
  existingComments: AppStore["comments"]
): CommentTargetContext | null {
  const item = state.workItems.find((entry) => entry.id === input.targetId)
  if (!item) {
    return null
  }

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

function resolveDocumentCommentTarget(
  state: AppStore,
  input: AddCommentInput,
  existingComments: AppStore["comments"]
): CommentTargetContext | null {
  const document = state.documents.find((entry) => entry.id === input.targetId)
  if (!document) {
    return null
  }

  return {
    teamId: document.teamId ?? "",
    followerIds: [
      document.createdBy,
      document.updatedBy,
      ...existingComments.map((comment) => comment.createdBy),
    ],
    entityType: "document",
    entityTitle: document.title,
  }
}

function resolveCommentTarget(
  state: AppStore,
  input: AddCommentInput,
  existingComments: AppStore["comments"]
) {
  if (input.targetType === "workItem") {
    return resolveWorkItemCommentTarget(state, input, existingComments)
  }

  return resolveDocumentCommentTarget(state, input, existingComments)
}

function isReadOnlyRole(role: ReturnType<typeof effectiveRole>) {
  return role === "viewer" || role === "guest" || !role
}

function createOptimisticComment(
  state: AppStore,
  input: AddCommentInput,
  mentionUserIds: string[],
  now: string
): AppStore["comments"][number] {
  return {
    id: createId("comment"),
    targetType: input.targetType,
    targetId: input.targetId,
    parentCommentId: input.parentCommentId ?? null,
    content: input.content.trim(),
    mentionUserIds,
    reactions: [],
    createdBy: state.currentUserId,
    createdAt: now,
  }
}

function addMentionNotifications(
  context: CommentNotificationContext,
  mentionUserIds: string[],
  actorName: string,
  notifiedUserIds: Set<string>
) {
  for (const mentionedUserId of mentionUserIds) {
    if (
      mentionedUserId === context.currentUserId ||
      notifiedUserIds.has(mentionedUserId)
    ) {
      continue
    }

    context.notifications.unshift(
      createNotification(
        mentionedUserId,
        context.currentUserId,
        `${actorName} mentioned you in ${context.entityTitle}`,
        context.entityType,
        context.targetId,
        "mention"
      )
    )
    notifiedUserIds.add(mentionedUserId)
  }
}

function addFollowerNotifications(
  context: CommentNotificationContext,
  parentCommentId: string | null | undefined,
  actorName: string,
  notifiedUserIds: Set<string>
) {
  const message = parentCommentId
    ? `${actorName} replied in ${context.entityTitle}`
    : `${actorName} commented on ${context.entityTitle}`

  for (const followerId of context.followerIds) {
    if (
      !followerId ||
      !context.audienceUserIds.includes(followerId) ||
      followerId === context.currentUserId ||
      notifiedUserIds.has(followerId)
    ) {
      continue
    }

    context.notifications.unshift(
      createNotification(
        followerId,
        context.currentUserId,
        message,
        context.entityType,
        context.targetId,
        "comment"
      )
    )
    notifiedUserIds.add(followerId)
  }
}

function createCommentNotifications(
  state: AppStore,
  input: AddCommentInput,
  target: CommentTargetContext,
  audienceUserIds: string[],
  mentionUserIds: string[]
) {
  const notifications = [...state.notifications]
  const actor = state.users.find((user) => user.id === state.currentUserId)
  const actorName = actor?.name ?? "Someone"
  const notifiedUserIds = new Set<string>()
  const context = {
    audienceUserIds,
    currentUserId: state.currentUserId,
    entityTitle: target.entityTitle,
    entityType: target.entityType,
    followerIds: target.followerIds,
    notifications,
    targetId: input.targetId,
  }

  addMentionNotifications(context, mentionUserIds, actorName, notifiedUserIds)
  addFollowerNotifications(
    context,
    input.parentCommentId,
    actorName,
    notifiedUserIds
  )

  return notifications
}

function applyCommentStateUpdate(
  state: AppStore,
  input: AddCommentInput,
  comment: AppStore["comments"][number],
  notifications: AppStore["notifications"],
  now: string
): Partial<AppStore> {
  return {
    comments: [...state.comments, comment],
    notifications,
    workItems: state.workItems.map((item) =>
      item.id === input.targetId ? { ...item, updatedAt: now } : item
    ),
    documents: state.documents.map((document) =>
      document.id === input.targetId
        ? {
            ...document,
            updatedAt: now,
            updatedBy: state.currentUserId,
          }
        : document
    ),
  }
}

function addCommentToState(state: AppStore, input: AddCommentInput) {
  const existingComments = getExistingTargetComments(state, input)
  if (hasMissingParentComment(input, existingComments)) {
    toast.error("Reply target no longer exists")
    return state
  }

  const target = resolveCommentTarget(state, input, existingComments)
  if (!target) {
    return state
  }

  const role = effectiveRole(state, target.teamId)
  if (isReadOnlyRole(role)) {
    toast.error("Your current role is read-only")
    return state
  }

  const now = getNow()
  const audienceUserIds = getTeamMemberIds(state, target.teamId)
  const mentionUserIds = createMentionIds(
    input.content,
    state.users,
    audienceUserIds
  )
  const comment = createOptimisticComment(state, input, mentionUserIds, now)
  const notifications = createCommentNotifications(
    state,
    input,
    target,
    audienceUserIds,
    mentionUserIds
  )

  return applyCommentStateUpdate(state, input, comment, notifications, now)
}

export function createWorkCommentActions({
  get,
  runtime,
  set,
}: WorkSliceFactoryArgs): Pick<
  WorkSlice,
  "addComment" | "toggleCommentReaction"
> {
  return {
    addComment(input) {
      const parsed = commentSchema.safeParse(input)
      if (!parsed.success) {
        toast.error("Comment cannot be empty")
        return
      }

      set((state) => {
        return addCommentToState(state, parsed.data)
      })

      runtime.syncInBackground(
        syncAddComment(
          get().currentUserId,
          parsed.data.targetType,
          parsed.data.targetId,
          parsed.data.content,
          parsed.data.parentCommentId
        ),
        "Failed to post comment"
      )

      toast.success("Comment posted")
    },
    toggleCommentReaction(commentId, emoji) {
      set((state) => ({
        comments: state.comments.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                reactions: toggleReactionUsers(
                  comment.reactions,
                  emoji,
                  state.currentUserId
                ),
              }
            : comment
        ),
      }))

      runtime.syncInBackground(
        syncToggleCommentReaction(commentId, emoji),
        "Failed to update reaction"
      )
    },
  }
}

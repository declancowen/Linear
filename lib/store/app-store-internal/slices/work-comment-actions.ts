"use client"

import { toast } from "sonner"

import {
  syncAddComment,
  syncDeleteComment,
  syncToggleCommentReaction,
  syncUpdateComment,
} from "@/lib/convex/client"
import {
  collectDocumentCommentFollowerIds,
  collectWorkItemCommentFollowerIds,
} from "@/lib/domain/comment-followers"
import { collectCommentDescendantIds } from "@/lib/domain/comment-threads"
import { commentSchema } from "@/lib/domain/types"
import { getWorkItemAssigneeIds } from "@/lib/domain/work-item-assignees"

import {
  createId,
  createMentionIds,
  createNotification,
  createNotificationDraft,
  getNow,
  toggleReactionUsers,
} from "../helpers"
import type { AddCommentInput, AppStore, UpdateCommentInput } from "../types"
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
    followerIds: collectWorkItemCommentFollowerIds({
      subscriberIds: item.subscriberIds,
      creatorId: item.creatorId,
      assigneeId: item.assigneeId,
      assigneeIds: getWorkItemAssigneeIds(item),
      existingCommentAuthorIds: existingComments.map(
        (comment) => comment.createdBy
      ),
    }),
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
  commentId: string,
  mentionUserIds: string[],
  now: string
): AppStore["comments"][number] {
  return {
    id: commentId,
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
  const { actorName, notifications, notifiedUserIds } =
    createNotificationDraft(state)
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

function touchCommentTarget(
  state: AppStore,
  targetType: CommentEntityType,
  targetId: string,
  now: string
): Pick<AppStore, "documents" | "workItems"> {
  return {
    workItems:
      targetType === "workItem"
        ? state.workItems.map((item) =>
            item.id === targetId ? { ...item, updatedAt: now } : item
          )
        : state.workItems,
    documents:
      targetType === "document"
        ? state.documents.map((document) =>
            document.id === targetId
              ? {
                  ...document,
                  updatedAt: now,
                  updatedBy: state.currentUserId,
                }
              : document
          )
        : state.documents,
  }
}

function getCommentMutationTarget(
  state: AppStore,
  comment: AppStore["comments"][number]
) {
  const input = {
    targetType: comment.targetType,
    targetId: comment.targetId,
    parentCommentId: comment.parentCommentId,
    content: comment.content,
  }

  return resolveCommentTarget(
    state,
    input,
    getExistingTargetComments(state, input)
  )
}

function canMutateOwnComment(
  state: AppStore,
  comment: AppStore["comments"][number]
) {
  if (comment.createdBy !== state.currentUserId) {
    toast.error("You can only edit or delete your own comments")
    return false
  }

  const target = getCommentMutationTarget(state, comment)
  if (!target) {
    return false
  }

  const role = effectiveRole(state, target.teamId)
  if (isReadOnlyRole(role)) {
    toast.error("Your current role is read-only")
    return false
  }

  return true
}

function getMutableOwnComment(
  get: WorkSliceFactoryArgs["get"],
  commentId: string
) {
  const comment = get().comments.find((entry) => entry.id === commentId)

  if (!comment || !canMutateOwnComment(get(), comment)) {
    return null
  }

  return comment
}

function updateCommentInState(
  state: AppStore,
  commentId: string,
  input: UpdateCommentInput
) {
  const comment = state.comments.find((entry) => entry.id === commentId)

  if (!comment) {
    return state
  }

  const now = getNow()

  return {
    ...state,
    comments: state.comments.map((entry) =>
      entry.id === commentId
        ? {
            ...entry,
            content: input.content.trim(),
            mentionUserIds: createMentionIds(
              input.content,
              state.users,
              comment.targetType === "workItem"
                ? getTeamMemberIds(
                    state,
                    state.workItems.find((item) => item.id === comment.targetId)
                      ?.teamId ?? ""
                  )
                : getTeamMemberIds(
                    state,
                    state.documents.find(
                      (document) => document.id === comment.targetId
                    )?.teamId ?? ""
                  )
            ),
          }
        : entry
    ),
    ...touchCommentTarget(state, comment.targetType, comment.targetId, now),
  }
}

function deleteCommentFromState(state: AppStore, commentId: string) {
  const comment = state.comments.find((entry) => entry.id === commentId)

  if (!comment) {
    return state
  }

  const deletedIds = collectCommentDescendantIds(state.comments, commentId)
  const now = getNow()

  return {
    ...state,
    comments: state.comments.filter((entry) => !deletedIds.has(entry.id)),
    ...touchCommentTarget(state, comment.targetType, comment.targetId, now),
  }
}

function addCommentToState(
  state: AppStore,
  input: AddCommentInput,
  commentId: string
) {
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
  const comment = createOptimisticComment(
    state,
    input,
    commentId,
    mentionUserIds,
    now
  )
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
  "addComment" | "deleteComment" | "toggleCommentReaction" | "updateComment"
> {
  const pendingCommentCreates = new Map<string, Promise<unknown>>()

  return {
    addComment(input) {
      const parsed = commentSchema.safeParse(input)
      if (!parsed.success) {
        toast.error("Comment cannot be empty")
        return
      }

      const commentId = createId("comment")
      set((state) => {
        return addCommentToState(state, parsed.data, commentId)
      })

      const createTask: Promise<unknown> | null = syncAddComment(
        get().currentUserId,
        parsed.data.targetType,
        parsed.data.targetId,
        parsed.data.content,
        parsed.data.parentCommentId,
        commentId
      )
      const syncTask = createTask
        ? createTask.finally(() => pendingCommentCreates.delete(commentId))
        : null

      if (syncTask) {
        pendingCommentCreates.set(commentId, syncTask)
      }

      runtime.syncInBackground(syncTask, "Failed to post comment")

      toast.success("Comment posted")
    },
    updateComment(commentId, input) {
      const comment = getMutableOwnComment(get, commentId)
      if (!comment) {
        return
      }

      const parsed = commentSchema.safeParse({
        targetType: comment.targetType,
        targetId: comment.targetId,
        parentCommentId: comment.parentCommentId,
        content: input.content,
      })

      if (!parsed.success) {
        toast.error("Comment cannot be empty")
        return
      }

      set((state) =>
        updateCommentInState(state, commentId, {
          content: parsed.data.content,
        })
      )

      const pendingCreate = pendingCommentCreates.get(commentId)
      const syncTask = pendingCreate
        ? pendingCreate.then(
            () =>
              get().comments.some((entry) => entry.id === commentId)
                ? syncUpdateComment(commentId, parsed.data.content)
                : null,
            () => null
          )
        : syncUpdateComment(commentId, parsed.data.content)

      runtime.syncInBackground(syncTask, "Failed to update comment")

      toast.success("Comment updated")
    },
    deleteComment(commentId) {
      if (!getMutableOwnComment(get, commentId)) {
        return
      }

      set((state) => deleteCommentFromState(state, commentId))

      const pendingCreate = pendingCommentCreates.get(commentId)
      const syncTask = pendingCreate
        ? pendingCreate.then(() => syncDeleteComment(commentId), () => null)
        : syncDeleteComment(commentId)

      runtime.syncInBackground(syncTask, "Failed to delete comment")

      toast.success("Comment deleted")
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

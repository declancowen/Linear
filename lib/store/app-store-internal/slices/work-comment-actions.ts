"use client"

import { toast } from "sonner"

import {
  syncAddComment,
  syncToggleCommentReaction,
} from "@/lib/convex/client"
import { commentSchema } from "@/lib/domain/types"

import {
  createId,
  createMentionIds,
  createNotification,
  getNow,
  toggleReactionUsers,
} from "../helpers"
import { effectiveRole, getTeamMemberIds } from "../validation"
import type { WorkSlice, WorkSliceFactoryArgs } from "./work-shared"

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
        let teamId = ""
        let followerIds: string[] = []
        let entityType: "workItem" | "document" = "workItem"
        let entityTitle = "item"
        const existingComments = state.comments.filter(
          (comment) =>
            comment.targetType === parsed.data.targetType &&
            comment.targetId === parsed.data.targetId
        )
        const parentComment = parsed.data.parentCommentId
          ? (existingComments.find(
              (comment) => comment.id === parsed.data.parentCommentId
            ) ?? null)
          : null

        if (parsed.data.parentCommentId && !parentComment) {
          toast.error("Reply target no longer exists")
          return state
        }

        if (parsed.data.targetType === "workItem") {
          const item = state.workItems.find(
            (entry) => entry.id === parsed.data.targetId
          )
          if (!item) {
            return state
          }

          teamId = item.teamId
          followerIds = [
            ...item.subscriberIds,
            item.creatorId,
            item.assigneeId ?? "",
            ...existingComments.map((comment) => comment.createdBy),
          ].filter(Boolean)
          entityType = "workItem"
          entityTitle = item.title
        } else {
          const document = state.documents.find(
            (entry) => entry.id === parsed.data.targetId
          )
          if (!document) {
            return state
          }

          teamId = document.teamId ?? ""
          followerIds = [
            document.createdBy,
            document.updatedBy,
            ...existingComments.map((comment) => comment.createdBy),
          ]
          entityType = "document"
          entityTitle = document.title
        }

        const role = effectiveRole(state, teamId)
        if (role === "viewer" || role === "guest" || !role) {
          toast.error("Your current role is read-only")
          return state
        }

        const audienceUserIds = getTeamMemberIds(state, teamId)
        const mentionUserIds = createMentionIds(
          parsed.data.content,
          state.users,
          audienceUserIds
        )
        const comment = {
          id: createId("comment"),
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
          parentCommentId: parsed.data.parentCommentId ?? null,
          content: parsed.data.content.trim(),
          mentionUserIds,
          reactions: [],
          createdBy: state.currentUserId,
          createdAt: getNow(),
        }

        const notifications = [...state.notifications]
        const actor = state.users.find((user) => user.id === state.currentUserId)
        const notifiedUserIds = new Set<string>()

        for (const mentionedUserId of mentionUserIds) {
          if (
            mentionedUserId === state.currentUserId ||
            notifiedUserIds.has(mentionedUserId)
          ) {
            continue
          }

          notifications.unshift(
            createNotification(
              mentionedUserId,
              state.currentUserId,
              `${actor?.name ?? "Someone"} mentioned you in ${entityTitle}`,
              entityType,
              parsed.data.targetId,
              "mention"
            )
          )
          notifiedUserIds.add(mentionedUserId)
        }

        const followerMessage = parsed.data.parentCommentId
          ? `${actor?.name ?? "Someone"} replied in ${entityTitle}`
          : `${actor?.name ?? "Someone"} commented on ${entityTitle}`

        for (const followerId of followerIds) {
          if (
            !followerId ||
            !audienceUserIds.includes(followerId) ||
            followerId === state.currentUserId ||
            notifiedUserIds.has(followerId)
          ) {
            continue
          }

          notifications.unshift(
            createNotification(
              followerId,
              state.currentUserId,
              followerMessage,
              entityType,
              parsed.data.targetId,
              "comment"
            )
          )
          notifiedUserIds.add(followerId)
        }

        return {
          ...state,
          comments: [...state.comments, comment],
          notifications,
          workItems: state.workItems.map((item) =>
            item.id === parsed.data.targetId ? { ...item, updatedAt: getNow() } : item
          ),
          documents: state.documents.map((document) =>
            document.id === parsed.data.targetId
              ? {
                  ...document,
                  updatedAt: getNow(),
                  updatedBy: state.currentUserId,
                }
              : document
          ),
        }
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

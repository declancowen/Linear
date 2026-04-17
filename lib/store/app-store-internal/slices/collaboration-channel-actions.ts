"use client"

import { toast } from "sonner"

import {
  syncAddChannelPostComment,
  syncCreateChannelPost,
  syncDeleteChannelPost,
  syncToggleChannelPostReaction,
} from "@/lib/convex/client"
import {
  channelPostCommentSchema,
  channelPostSchema,
} from "@/lib/domain/types"

import {
  createId,
  createMentionIds,
  createNotification,
  getNow,
  toggleReactionUsers,
} from "../helpers"
import {
  canEditWorkspaceDocuments,
  effectiveRole,
  getConversationAudienceUserIds,
} from "../validation"
import type {
  CollaborationSlice,
  CollaborationSliceFactoryArgs,
} from "./collaboration-shared"

export function createCollaborationChannelActions({
  runtime,
  set,
}: CollaborationSliceFactoryArgs): Pick<
  CollaborationSlice,
  | "createChannelPost"
  | "addChannelPostComment"
  | "deleteChannelPost"
  | "toggleChannelPostReaction"
> {
  return {
    createChannelPost(input) {
      const parsed = channelPostSchema.safeParse(input)
      if (!parsed.success) {
        toast.error("Post details are invalid")
        return
      }

      set((state) => {
        const conversation = state.conversations.find(
          (entry) => entry.id === parsed.data.conversationId
        )

        if (!conversation || conversation.kind !== "channel") {
          return state
        }

        if (conversation.scopeType === "team") {
          const role = effectiveRole(state, conversation.scopeId)
          if (role === "viewer" || role === "guest" || !role) {
            toast.error("Your current role is read-only")
            return state
          }
        } else if (!canEditWorkspaceDocuments(state, conversation.scopeId)) {
          toast.error("Your current role is read-only")
          return state
        }

        const now = getNow()
        const postId = createId("channel_post")
        const actor = state.users.find((user) => user.id === state.currentUserId)
        const mentionUserIds = createMentionIds(
          parsed.data.content,
          state.users,
          getConversationAudienceUserIds(state, conversation)
        ).filter((userId) => userId !== state.currentUserId)
        const notifications = [...state.notifications]
        const entityTitle = parsed.data.title.trim() || "a channel post"
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
              "channelPost",
              postId,
              "mention"
            )
          )

          notifiedUserIds.add(mentionedUserId)
        }

        return {
          ...state,
          channelPosts: [
            {
              id: postId,
              conversationId: conversation.id,
              title: parsed.data.title,
              content: parsed.data.content.trim(),
              reactions: [],
              createdBy: state.currentUserId,
              createdAt: now,
              updatedAt: now,
            },
            ...state.channelPosts,
          ],
          notifications,
          conversations: state.conversations.map((entry) =>
            entry.id === conversation.id
              ? {
                  ...entry,
                  updatedAt: now,
                  lastActivityAt: now,
                }
              : entry
          ),
        }
      })

      runtime.syncInBackground(
        syncCreateChannelPost(parsed.data),
        "Failed to create post"
      )

      toast.success("Post published")
    },
    addChannelPostComment(input) {
      const parsed = channelPostCommentSchema.safeParse(input)
      if (!parsed.success) {
        return
      }

      set((state) => {
        const post = state.channelPosts.find((entry) => entry.id === parsed.data.postId)
        if (!post) {
          return state
        }

        const conversation = state.conversations.find(
          (entry) => entry.id === post.conversationId
        )
        if (!conversation || conversation.kind !== "channel") {
          return state
        }

        if (conversation.scopeType === "team") {
          const role = effectiveRole(state, conversation.scopeId)
          if (role === "viewer" || role === "guest" || !role) {
            toast.error("Your current role is read-only")
            return state
          }
        } else if (!canEditWorkspaceDocuments(state, conversation.scopeId)) {
          toast.error("Your current role is read-only")
          return state
        }

        const now = getNow()
        const actor = state.users.find((user) => user.id === state.currentUserId)
        const audienceUserIds = getConversationAudienceUserIds(
          state,
          conversation
        )
        const mentionUserIds = createMentionIds(
          parsed.data.content,
          state.users,
          audienceUserIds
        ).filter((userId) => userId !== state.currentUserId)
        const notifications = [...state.notifications]
        const notifiedUserIds = new Set<string>()
        const followerIds = [
          post.createdBy,
          ...state.channelPostComments
            .filter((entry) => entry.postId === post.id)
            .map((entry) => entry.createdBy),
        ]
        const entityTitle = post.title.trim() || "a channel post"

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
              "channelPost",
              post.id,
              "mention"
            )
          )
          notifiedUserIds.add(mentionedUserId)
        }

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
              `${actor?.name ?? "Someone"} commented on ${entityTitle}`,
              "channelPost",
              post.id,
              "comment"
            )
          )
          notifiedUserIds.add(followerId)
        }

        return {
          ...state,
          channelPostComments: [
            ...state.channelPostComments,
            {
              id: createId("channel_comment"),
              postId: post.id,
              content: parsed.data.content.trim(),
              mentionUserIds,
              createdBy: state.currentUserId,
              createdAt: now,
            },
          ],
          notifications,
          channelPosts: state.channelPosts.map((entry) =>
            entry.id === post.id ? { ...entry, updatedAt: now } : entry
          ),
          conversations: state.conversations.map((entry) =>
            entry.id === conversation.id
              ? {
                  ...entry,
                  updatedAt: now,
                  lastActivityAt: now,
                }
              : entry
          ),
        }
      })

      runtime.syncInBackground(
        syncAddChannelPostComment(parsed.data.postId, parsed.data.content),
        "Failed to post reply"
      )
    },
    deleteChannelPost(postId) {
      set((state) => {
        const post = state.channelPosts.find((entry) => entry.id === postId)

        if (!post) {
          return state
        }

        if (post.createdBy !== state.currentUserId) {
          toast.error("You can only delete your own posts")
          return state
        }

        const now = getNow()

        return {
          ...state,
          channelPosts: state.channelPosts.filter((entry) => entry.id !== postId),
          channelPostComments: state.channelPostComments.filter(
            (entry) => entry.postId !== postId
          ),
          notifications: state.notifications.filter(
            (entry) =>
              !(entry.entityType === "channelPost" && entry.entityId === postId)
          ),
          conversations: state.conversations.map((entry) =>
            entry.id === post.conversationId
              ? {
                  ...entry,
                  updatedAt: now,
                  lastActivityAt: now,
                }
              : entry
          ),
        }
      })

      runtime.syncInBackground(
        syncDeleteChannelPost(postId),
        "Failed to delete post"
      )

      toast.success("Post deleted")
    },
    toggleChannelPostReaction(postId, emoji) {
      const nextEmoji = emoji.trim()

      if (!nextEmoji) {
        return
      }

      set((state) => {
        const post = state.channelPosts.find((entry) => entry.id === postId)

        if (!post) {
          return state
        }

        const conversation = state.conversations.find(
          (entry) => entry.id === post.conversationId
        )

        if (!conversation || conversation.kind !== "channel") {
          return state
        }

        if (conversation.scopeType === "team") {
          const role = effectiveRole(state, conversation.scopeId)
          if (role === "viewer" || role === "guest" || !role) {
            toast.error("Your current role is read-only")
            return state
          }
        }

        return {
          ...state,
          channelPosts: state.channelPosts.map((entry) =>
            entry.id === postId
              ? {
                  ...entry,
                  reactions: toggleReactionUsers(
                    entry.reactions,
                    nextEmoji,
                    state.currentUserId
                  ),
                }
              : entry
          ),
        }
      })

      runtime.syncInBackground(
        syncToggleChannelPostReaction(postId, nextEmoji),
        "Failed to update reaction"
      )
    },
  }
}

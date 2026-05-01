"use client"

import { toast } from "sonner"

import {
  syncAddChannelPostComment,
  syncCreateChannelPost,
  syncDeleteChannelPost,
  syncToggleChannelPostReaction,
} from "@/lib/convex/client"
import { prepareRichTextMessageForStorage } from "@/lib/content/rich-text-security"
import { channelPostCommentSchema, channelPostSchema } from "@/lib/domain/types"

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
import type { AppStore } from "../types"

type ChannelConversation = AppStore["conversations"][number]
type ChannelPost = AppStore["channelPosts"][number]
type NotificationRecord = AppStore["notifications"][number]

function getEditableChannelConversation(
  state: AppStore,
  conversationId: string,
  options: {
    requireWorkspaceEdit: boolean
  }
): ChannelConversation | null {
  const conversation = state.conversations.find(
    (entry) => entry.id === conversationId
  )

  if (!conversation || conversation.kind !== "channel") {
    return null
  }

  if (conversation.scopeType === "team") {
    const role = effectiveRole(state, conversation.scopeId)

    if (role === "viewer" || role === "guest" || !role) {
      toast.error("Your current role is read-only")
      return null
    }
  } else if (
    options.requireWorkspaceEdit &&
    !canEditWorkspaceDocuments(state, conversation.scopeId)
  ) {
    toast.error("Your current role is read-only")
    return null
  }

  return conversation
}

function getChannelMentionUserIds(
  state: AppStore,
  content: string,
  audienceUserIds: string[]
) {
  return createMentionIds(content, state.users, audienceUserIds).filter(
    (userId) => userId !== state.currentUserId
  )
}

function addChannelMentionNotifications(
  notifications: NotificationRecord[],
  input: {
    actorName: string
    currentUserId: string
    entityId: string
    entityTitle: string
    mentionUserIds: string[]
    notifiedUserIds: Set<string>
  }
) {
  for (const mentionedUserId of input.mentionUserIds) {
    if (
      mentionedUserId === input.currentUserId ||
      input.notifiedUserIds.has(mentionedUserId)
    ) {
      continue
    }

    notifications.unshift(
      createNotification(
        mentionedUserId,
        input.currentUserId,
        `${input.actorName} mentioned you in ${input.entityTitle}`,
        "channelPost",
        input.entityId,
        "mention"
      )
    )

    input.notifiedUserIds.add(mentionedUserId)
  }
}

function addChannelFollowerNotifications(
  notifications: NotificationRecord[],
  input: {
    actorName: string
    audienceUserIds: string[]
    currentUserId: string
    entityId: string
    entityTitle: string
    followerIds: string[]
    notifiedUserIds: Set<string>
  }
) {
  for (const followerId of input.followerIds) {
    if (
      !followerId ||
      !input.audienceUserIds.includes(followerId) ||
      followerId === input.currentUserId ||
      input.notifiedUserIds.has(followerId)
    ) {
      continue
    }

    notifications.unshift(
      createNotification(
        followerId,
        input.currentUserId,
        `${input.actorName} commented on ${input.entityTitle}`,
        "channelPost",
        input.entityId,
        "comment"
      )
    )
    input.notifiedUserIds.add(followerId)
  }
}

function getChannelCommentFollowerIds(state: AppStore, post: ChannelPost) {
  return [
    post.createdBy,
    ...state.channelPostComments
      .filter((entry) => entry.postId === post.id)
      .map((entry) => entry.createdBy),
  ]
}

function buildChannelCommentNotifications(
  state: AppStore,
  input: {
    audienceUserIds: string[]
    mentionUserIds: string[]
    post: ChannelPost
  }
) {
  const notifications = [...state.notifications]
  const actor = state.users.find((user) => user.id === state.currentUserId)
  const actorName = actor?.name ?? "Someone"
  const entityTitle = input.post.title.trim() || "a channel post"
  const notifiedUserIds = new Set<string>()

  addChannelMentionNotifications(notifications, {
    actorName,
    currentUserId: state.currentUserId,
    entityId: input.post.id,
    entityTitle,
    mentionUserIds: input.mentionUserIds,
    notifiedUserIds,
  })

  addChannelFollowerNotifications(notifications, {
    actorName,
    audienceUserIds: input.audienceUserIds,
    currentUserId: state.currentUserId,
    entityId: input.post.id,
    entityTitle,
    followerIds: getChannelCommentFollowerIds(state, input.post),
    notifiedUserIds,
  })

  return notifications
}

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

      const preparedContent = prepareRichTextMessageForStorage(
        parsed.data.content,
        {
          minPlainTextCharacters: 2,
        }
      )

      if (!preparedContent.isMeaningful) {
        toast.error("Post content must include at least 2 characters")
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
        const actor = state.users.find(
          (user) => user.id === state.currentUserId
        )
        const mentionUserIds = createMentionIds(
          preparedContent.sanitized,
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
              content: preparedContent.sanitized,
              mentionUserIds,
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
        syncCreateChannelPost({
          ...parsed.data,
          content: preparedContent.sanitized,
        }),
        "Failed to create post"
      )

      toast.success("Post published")
    },
    addChannelPostComment(input) {
      const parsed = channelPostCommentSchema.safeParse(input)
      if (!parsed.success) {
        return
      }

      const preparedContent = prepareRichTextMessageForStorage(
        parsed.data.content,
        {
          minPlainTextCharacters: 1,
        }
      )

      if (!preparedContent.isMeaningful) {
        toast.error("Comment content must include at least 1 character")
        return
      }

      set((state) => {
        const post = state.channelPosts.find(
          (entry) => entry.id === parsed.data.postId
        )
        if (!post) {
          return state
        }

        const conversation = getEditableChannelConversation(
          state,
          post.conversationId,
          {
            requireWorkspaceEdit: true,
          }
        )
        if (!conversation) {
          return state
        }

        const now = getNow()
        const audienceUserIds = getConversationAudienceUserIds(
          state,
          conversation
        )
        const mentionUserIds = getChannelMentionUserIds(
          state,
          preparedContent.sanitized,
          audienceUserIds
        )
        const notifications = buildChannelCommentNotifications(state, {
          audienceUserIds,
          mentionUserIds,
          post,
        })

        return {
          ...state,
          channelPostComments: [
            ...state.channelPostComments,
            {
              id: createId("channel_comment"),
              postId: post.id,
              content: preparedContent.sanitized,
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
        syncAddChannelPostComment(
          parsed.data.postId,
          preparedContent.sanitized
        ),
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
          channelPosts: state.channelPosts.filter(
            (entry) => entry.id !== postId
          ),
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

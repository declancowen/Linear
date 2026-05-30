"use client"

import { toast } from "sonner"

import {
  syncAddChannelPostComment,
  syncCreateChannelPost,
  syncDeleteChannelPost,
  syncDeleteChannelPostComment,
  syncToggleChannelPostReaction,
  syncUpdateChannelPost,
  syncUpdateChannelPostComment,
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
import { addChannelFollowerNotifications } from "./collaboration-channel-notifications"
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
type ChannelPostComment = AppStore["channelPostComments"][number]
type NotificationRecord = AppStore["notifications"][number]
type PreparedChannelPostInput = {
  conversationId: string
  title: string
  content: string
}
type UpdateChannelPostInput = {
  title: string
  content: string
}
type UpdateChannelPostCommentInput = {
  content: string
}
type DeleteChannelPostCommentResult = {
  error: string | null
  shouldSync: boolean
  state: AppStore
}
type MutateChannelPostResult = {
  error: string | null
  shouldSync: boolean
  state: AppStore
}
type ReconcileCreatedChannelPostCommentResult = {
  shouldDeleteCreatedComment: boolean
  state: AppStore
}
type ReconcileCreatedChannelPostResult = {
  shouldDeleteCreatedPost: boolean
  state: AppStore
}
type ChannelPostMutationContext = {
  conversation: ChannelConversation
  post: ChannelPost
}

function getChannelConversation(state: AppStore, conversationId: string) {
  const conversation = state.conversations.find(
    (entry) => entry.id === conversationId
  )

  return conversation?.kind === "channel" ? conversation : null
}

function canEditTeamChannelConversation(
  state: AppStore,
  conversation: ChannelConversation
) {
  const role = effectiveRole(state, conversation.scopeId)

  if (role === "viewer" || role === "guest" || !role) {
    toast.error("Your current role is read-only")
    return false
  }

  return true
}

function canEditWorkspaceChannelConversation(
  state: AppStore,
  conversation: ChannelConversation,
  requireWorkspaceEdit: boolean
) {
  if (!requireWorkspaceEdit) {
    return true
  }

  if (canEditWorkspaceDocuments(state, conversation.scopeId)) {
    return true
  }

  toast.error("Your current role is read-only")
  return false
}

function canEditChannelConversation(
  state: AppStore,
  conversation: ChannelConversation,
  requireWorkspaceEdit: boolean
) {
  return conversation.scopeType === "team"
    ? canEditTeamChannelConversation(state, conversation)
    : canEditWorkspaceChannelConversation(
        state,
        conversation,
        requireWorkspaceEdit
      )
}

function getEditableChannelConversation(
  state: AppStore,
  conversationId: string,
  options: {
    requireWorkspaceEdit: boolean
  }
): ChannelConversation | null {
  const conversation = getChannelConversation(state, conversationId)

  if (!conversation) {
    return null
  }

  return canEditChannelConversation(
    state,
    conversation,
    options.requireWorkspaceEdit
  )
    ? conversation
    : null
}

function isTargetChannelPostComment(
  entry: ChannelPostComment,
  postId: string,
  commentId: string
) {
  return entry.id === commentId && entry.postId === postId
}

function updatePostAfterCommentDelete(
  posts: ChannelPost[],
  post: ChannelPost | null,
  now: string
) {
  if (!post) {
    return posts
  }

  return posts.map((entry) =>
    entry.id === post.id ? { ...entry, updatedAt: now } : entry
  )
}

function touchChannelConversation(
  conversations: ChannelConversation[],
  input: {
    conversationId: string
    now: string
  }
) {
  return conversations.map((entry) =>
    entry.id === input.conversationId
      ? {
          ...entry,
          updatedAt: input.now,
          lastActivityAt: input.now,
        }
      : entry
  )
}

function updateConversationAfterCommentDelete(
  conversations: ChannelConversation[],
  post: ChannelPost | null,
  now: string
) {
  if (!post) {
    return conversations
  }

  return touchChannelConversation(conversations, {
    conversationId: post.conversationId,
    now,
  })
}

function getChannelPostMutationConversation(
  state: AppStore,
  post: ChannelPost
) {
  return getEditableChannelConversation(state, post.conversationId, {
    requireWorkspaceEdit: true,
  })
}

function getOwnedChannelPostMutationContext(
  state: AppStore,
  postId: string,
  action: "delete" | "edit"
): { context: ChannelPostMutationContext | null; error: string | null } {
  const post = state.channelPosts.find((entry) => entry.id === postId)

  if (!post) {
    return { context: null, error: null }
  }

  if (post.createdBy !== state.currentUserId) {
    return {
      context: null,
      error: `You can only ${action} your own posts`,
    }
  }

  const conversation = getChannelPostMutationConversation(state, post)
  if (!conversation) {
    return { context: null, error: null }
  }

  return {
    context: { conversation, post },
    error: null,
  }
}

function getOwnedChannelPostCommentMutationContext(
  state: AppStore,
  postId: string,
  commentId: string,
  action: "delete" | "edit"
): {
  context: (ChannelPostMutationContext & { comment: ChannelPostComment }) | null
  error: string | null
} {
  const comment = state.channelPostComments.find((entry) =>
    isTargetChannelPostComment(entry, postId, commentId)
  )

  if (!comment) {
    return { context: null, error: null }
  }

  if (comment.createdBy !== state.currentUserId) {
    return {
      context: null,
      error: `You can only ${action} your own comments`,
    }
  }

  const post = state.channelPosts.find((entry) => entry.id === postId) ?? null

  if (!post) {
    return { context: null, error: null }
  }

  const conversation = getChannelPostMutationConversation(state, post)
  if (!conversation) {
    return { context: null, error: null }
  }

  return {
    context: {
      comment,
      conversation,
      post,
    },
    error: null,
  }
}

function getUpdateChannelPostResult(
  state: AppStore,
  postId: string,
  input: UpdateChannelPostInput
): MutateChannelPostResult {
  const { context, error } = getOwnedChannelPostMutationContext(
    state,
    postId,
    "edit"
  )
  if (!context) {
    return { error, shouldSync: false, state }
  }

  const { conversation } = context
  const now = getNow()
  const mentionUserIds = getChannelMentionUserIds(
    state,
    input.content,
    getConversationAudienceUserIds(state, conversation)
  )

  return {
    error: null,
    shouldSync: true,
    state: {
      ...state,
      channelPosts: state.channelPosts.map((entry) =>
        entry.id === postId
          ? {
              ...entry,
              title: input.title.trim(),
              content: input.content.trim(),
              mentionUserIds,
              updatedAt: now,
            }
          : entry
      ),
      conversations: touchChannelConversation(state.conversations, {
        conversationId: conversation.id,
        now,
      }),
    },
  }
}

function getUpdateChannelPostCommentResult(
  state: AppStore,
  postId: string,
  commentId: string,
  input: UpdateChannelPostCommentInput
): MutateChannelPostResult {
  const { context, error } = getOwnedChannelPostCommentMutationContext(
    state,
    postId,
    commentId,
    "edit"
  )
  if (!context) {
    return { error, shouldSync: false, state }
  }

  const { conversation, post } = context
  const now = getNow()
  const mentionUserIds = getChannelMentionUserIds(
    state,
    input.content,
    getConversationAudienceUserIds(state, conversation)
  )

  return {
    error: null,
    shouldSync: true,
    state: {
      ...state,
      channelPostComments: state.channelPostComments.map((entry) =>
        isTargetChannelPostComment(entry, postId, commentId)
          ? {
              ...entry,
              content: input.content.trim(),
              mentionUserIds,
            }
          : entry
      ),
      channelPosts: updatePostAfterCommentDelete(state.channelPosts, post, now),
      conversations: updateConversationAfterCommentDelete(
        state.conversations,
        post,
        now
      ),
    },
  }
}

function getDeleteChannelPostResult(
  state: AppStore,
  postId: string
): MutateChannelPostResult {
  const { context, error } = getOwnedChannelPostMutationContext(
    state,
    postId,
    "delete"
  )
  if (!context) {
    return { error, shouldSync: false, state }
  }

  const { conversation } = context
  const now = getNow()

  return {
    error: null,
    shouldSync: true,
    state: {
      ...state,
      channelPosts: state.channelPosts.filter((entry) => entry.id !== postId),
      channelPostComments: state.channelPostComments.filter(
        (entry) => entry.postId !== postId
      ),
      notifications: state.notifications.filter(
        (entry) =>
          !(entry.entityType === "channelPost" && entry.entityId === postId)
      ),
      conversations: touchChannelConversation(state.conversations, {
        conversationId: conversation.id,
        now,
      }),
    },
  }
}

function getDeleteChannelPostCommentResult(
  state: AppStore,
  postId: string,
  commentId: string
): DeleteChannelPostCommentResult {
  const { context, error } = getOwnedChannelPostCommentMutationContext(
    state,
    postId,
    commentId,
    "delete"
  )
  if (!context) {
    return { error, shouldSync: false, state }
  }

  const { post } = context
  const now = getNow()

  return {
    error: null,
    shouldSync: true,
    state: {
      ...state,
      channelPostComments: state.channelPostComments.filter(
        (entry) => entry.id !== commentId
      ),
      channelPosts: updatePostAfterCommentDelete(state.channelPosts, post, now),
      conversations: updateConversationAfterCommentDelete(
        state.conversations,
        post,
        now
      ),
    },
  }
}

function reconcileCreatedChannelPost(
  state: AppStore,
  input: {
    createdPostId: string
    optimisticPostId: string
  }
): ReconcileCreatedChannelPostResult {
  if (input.createdPostId === input.optimisticPostId) {
    return {
      shouldDeleteCreatedPost: !state.channelPosts.some(
        (post) => post.id === input.optimisticPostId
      ),
      state,
    }
  }

  const hasOptimisticPost = state.channelPosts.some(
    (post) => post.id === input.optimisticPostId
  )
  const hasCreatedPost = state.channelPosts.some(
    (post) => post.id === input.createdPostId
  )

  if (!hasOptimisticPost) {
    return {
      shouldDeleteCreatedPost: !hasCreatedPost,
      state,
    }
  }

  return {
    shouldDeleteCreatedPost: false,
    state: {
      ...state,
      channelPosts: hasCreatedPost
        ? state.channelPosts.filter(
            (post) => post.id !== input.optimisticPostId
          )
        : state.channelPosts.map((post) =>
            post.id === input.optimisticPostId
              ? { ...post, id: input.createdPostId }
              : post
          ),
      channelPostComments: state.channelPostComments.map((comment) =>
        comment.postId === input.optimisticPostId
          ? { ...comment, postId: input.createdPostId }
          : comment
      ),
      notifications: state.notifications.map((notification) =>
        notification.entityType === "channelPost" &&
        notification.entityId === input.optimisticPostId
          ? { ...notification, entityId: input.createdPostId }
          : notification
      ),
    },
  }
}

function reconcileCreatedChannelPostComment(
  state: AppStore,
  input: {
    createdCommentId: string
    optimisticCommentId: string
  }
): ReconcileCreatedChannelPostCommentResult {
  if (input.createdCommentId === input.optimisticCommentId) {
    return { shouldDeleteCreatedComment: false, state }
  }

  const hasOptimisticComment = state.channelPostComments.some(
    (comment) => comment.id === input.optimisticCommentId
  )
  const hasCreatedComment = state.channelPostComments.some(
    (comment) => comment.id === input.createdCommentId
  )

  if (!hasOptimisticComment) {
    return {
      shouldDeleteCreatedComment: !hasCreatedComment,
      state,
    }
  }

  return {
    shouldDeleteCreatedComment: false,
    state: {
      ...state,
      channelPostComments: hasCreatedComment
        ? state.channelPostComments.filter(
            (comment) => comment.id !== input.optimisticCommentId
          )
        : state.channelPostComments.map((comment) =>
            comment.id === input.optimisticCommentId
              ? { ...comment, id: input.createdCommentId }
              : comment
          ),
    },
  }
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

function createOptimisticChannelPostState(
  state: AppStore,
  input: {
    content: string
    conversation: ChannelConversation
    postId: string
    title: string
  }
) {
  const now = getNow()
  const actor = state.users.find((user) => user.id === state.currentUserId)
  const mentionUserIds = getChannelMentionUserIds(
    state,
    input.content,
    getConversationAudienceUserIds(state, input.conversation)
  )
  const notifications = [...state.notifications]
  const entityTitle = input.title.trim() || "a channel post"

  addChannelMentionNotifications(notifications, {
    actorName: actor?.name ?? "Someone",
    currentUserId: state.currentUserId,
    entityId: input.postId,
    entityTitle,
    mentionUserIds,
    notifiedUserIds: new Set<string>(),
  })

  return {
    ...state,
    channelPosts: [
      {
        id: input.postId,
        conversationId: input.conversation.id,
        title: input.title,
        content: input.content,
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
      entry.id === input.conversation.id
        ? {
            ...entry,
            updatedAt: now,
            lastActivityAt: now,
          }
        : entry
    ),
  }
}

function prepareChannelPostMutationInput(
  input: PreparedChannelPostInput
): PreparedChannelPostInput | null {
  const parsed = channelPostSchema.safeParse(input)
  if (!parsed.success) {
    toast.error("Post details are invalid")
    return null
  }

  const preparedContent = prepareRichTextMessageForStorage(
    parsed.data.content,
    {
      minPlainTextCharacters: 2,
    }
  )

  if (!preparedContent.isMeaningful) {
    toast.error("Post content must include at least 2 characters")
    return null
  }

  return {
    ...parsed.data,
    content: preparedContent.sanitized,
  }
}

function applyChannelMutationResult(
  set: CollaborationSliceFactoryArgs["set"],
  resolve: (state: AppStore) => MutateChannelPostResult
) {
  let decision: Pick<MutateChannelPostResult, "error" | "shouldSync"> = {
    error: null,
    shouldSync: false,
  }

  set((state) => {
    const result = resolve(state)
    decision = {
      error: result.error,
      shouldSync: result.shouldSync,
    }
    return result.state
  })

  return decision
}

export function createCollaborationChannelActions({
  get,
  runtime,
  set,
}: CollaborationSliceFactoryArgs): Pick<
  CollaborationSlice,
  | "createChannelPost"
  | "updateChannelPost"
  | "addChannelPostComment"
  | "updateChannelPostComment"
  | "deleteChannelPost"
  | "deleteChannelPostComment"
  | "toggleChannelPostReaction"
> {
  const pendingChannelPostCreates = new Set<string>()
  const pendingChannelPostCommentCreates = new Set<string>()

  return {
    createChannelPost(input) {
      const prepared = prepareChannelPostMutationInput(input)
      if (!prepared) {
        return
      }

      const postId = createId("channel_post")
      let shouldSync = false
      pendingChannelPostCreates.add(postId)

      set((state) => {
        const conversation = getEditableChannelConversation(
          state,
          prepared.conversationId,
          {
            requireWorkspaceEdit: true,
          }
        )

        if (!conversation) {
          return state
        }

        shouldSync = true
        return createOptimisticChannelPostState(state, {
          content: prepared.content,
          conversation,
          postId,
          title: prepared.title,
        })
      })

      if (!shouldSync) {
        pendingChannelPostCreates.delete(postId)
        return
      }

      const syncTask = syncCreateChannelPost({
        ...prepared,
        postId,
      })
        .then((result) => {
          let shouldDeleteCreatedPost = false

          set((state) => {
            const reconciliation = reconcileCreatedChannelPost(state, {
              createdPostId: result.postId,
              optimisticPostId: postId,
            })

            shouldDeleteCreatedPost = reconciliation.shouldDeleteCreatedPost

            return reconciliation.state
          })

          if (shouldDeleteCreatedPost) {
            runtime.syncInBackground(
              syncDeleteChannelPost(result.postId),
              "Failed to delete post"
            )
          }
        })
        .finally(() => {
          pendingChannelPostCreates.delete(postId)
        })

      runtime.syncInBackground(syncTask, "Failed to create post")

      toast.success("Post published")
    },
    updateChannelPost(postId, input) {
      const post = get().channelPosts.find((entry) => entry.id === postId)

      if (!post) {
        return
      }

      const prepared = prepareChannelPostMutationInput({
        conversationId: post.conversationId,
        title: input.title,
        content: input.content,
      })
      if (!prepared) {
        return
      }

      const { error, shouldSync } = applyChannelMutationResult(set, (state) =>
        getUpdateChannelPostResult(state, postId, {
          title: prepared.title,
          content: prepared.content,
        })
      )

      if (error) {
        toast.error(error)
        return
      }

      if (!shouldSync) {
        return
      }

      runtime.syncInBackground(
        syncUpdateChannelPost({
          postId,
          title: prepared.title,
          content: prepared.content,
        }),
        "Failed to update post"
      )

      toast.success("Post updated")
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

      const optimisticCommentId = createId("channel_comment")
      pendingChannelPostCommentCreates.add(optimisticCommentId)

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
              id: optimisticCommentId,
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

      const syncTask = syncAddChannelPostComment(
        parsed.data.postId,
        preparedContent.sanitized
      )
        .then((result) => {
          let shouldDeleteCreatedComment = false

          set((state) => {
            const reconciliation = reconcileCreatedChannelPostComment(state, {
              createdCommentId: result.commentId,
              optimisticCommentId,
            })

            shouldDeleteCreatedComment =
              reconciliation.shouldDeleteCreatedComment

            return reconciliation.state
          })

          if (shouldDeleteCreatedComment) {
            runtime.syncInBackground(
              syncDeleteChannelPostComment(
                parsed.data.postId,
                result.commentId
              ),
              "Failed to delete comment"
            )
          }
        })
        .finally(() => {
          pendingChannelPostCommentCreates.delete(optimisticCommentId)
        })

      runtime.syncInBackground(syncTask, "Failed to post reply")
    },
    updateChannelPostComment(postId, commentId, input) {
      const parsed = channelPostCommentSchema.safeParse({
        postId,
        content: input.content,
      })
      if (!parsed.success) {
        toast.error("Comment content must include at least 1 character")
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

      const { error, shouldSync } = applyChannelMutationResult(set, (state) =>
        getUpdateChannelPostCommentResult(state, postId, commentId, {
          content: preparedContent.sanitized,
        })
      )

      if (error) {
        toast.error(error)
        return
      }

      if (!shouldSync) {
        return
      }

      runtime.syncInBackground(
        syncUpdateChannelPostComment(
          postId,
          commentId,
          preparedContent.sanitized
        ),
        "Failed to update comment"
      )

      toast.success("Comment updated")
    },
    deleteChannelPost(postId) {
      const deleteIsPendingCreate = pendingChannelPostCreates.has(postId)
      const { error, shouldSync } = applyChannelMutationResult(set, (state) =>
        getDeleteChannelPostResult(state, postId)
      )

      if (error) {
        toast.error(error)
        return
      }

      if (!shouldSync) {
        return
      }

      if (deleteIsPendingCreate) {
        toast.success("Post deleted")
        return
      }

      runtime.syncInBackground(
        syncDeleteChannelPost(postId),
        "Failed to delete post"
      )

      toast.success("Post deleted")
    },
    deleteChannelPostComment(postId, commentId) {
      const deleteIsPendingCreate =
        pendingChannelPostCommentCreates.has(commentId)
      const { error, shouldSync } = applyChannelMutationResult(set, (state) =>
        getDeleteChannelPostCommentResult(state, postId, commentId)
      )

      if (error) {
        toast.error(error)
      }

      if (!shouldSync) {
        return
      }

      if (deleteIsPendingCreate) {
        toast.success("Comment deleted")
        return
      }

      runtime.syncInBackground(
        syncDeleteChannelPostComment(postId, commentId),
        "Failed to delete comment"
      )

      toast.success("Comment deleted")
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

        if (
          !getEditableChannelConversation(state, post.conversationId, {
            requireWorkspaceEdit: false,
          })
        ) {
          return state
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

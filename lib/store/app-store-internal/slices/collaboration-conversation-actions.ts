"use client"

import { toast } from "sonner"

import {
  syncCreateChannel,
  syncCreateWorkspaceChat,
  syncEnsureTeamChat,
  syncSendChatMessage,
  syncStartConversationCall,
  syncToggleChatMessageReaction,
} from "@/lib/convex/client"
import { prepareRichTextMessageForStorage } from "@/lib/content/rich-text-security"
import { RouteMutationError } from "@/lib/convex/client/shared"
import {
  channelSchema,
  chatMessageSchema,
  teamChatSchema,
  workspaceChatSchema,
} from "@/lib/domain/types"

import {
  buildWorkspaceChatTitle,
  createId,
  createMentionIds,
  createNotification,
  findWorkspaceDirectConversation,
  getNow,
  normalizeChatMessages,
  toggleReactionUsers,
} from "../helpers"
import {
  canEditWorkspaceDocuments,
  effectiveRole,
  getConversationAudienceUserIds,
  getTeamMemberIds,
  getWorkspaceMemberIds,
} from "../validation"
import type { AppStore } from "../types"
import type {
  CollaborationSlice,
  CollaborationSliceFactoryArgs,
} from "./collaboration-shared"

const pendingChatMessageSyncs = new Map<string, Promise<unknown>>()

type PreparedChatMessageContent = ReturnType<
  typeof prepareRichTextMessageForStorage
>

type ChatConversationRecord = AppStore["conversations"][number]

function getChatConversationForSend(
  state: AppStore,
  conversationId: string
): ChatConversationRecord | null {
  const conversation = state.conversations.find(
    (entry) => entry.id === conversationId
  )

  return conversation?.kind === "chat" ? conversation : null
}

function canSendOptimisticChatMessage(
  state: AppStore,
  conversation: ChatConversationRecord
) {
  if (conversation.scopeType === "workspace") {
    if (!conversation.participantIds.includes(state.currentUserId)) {
      toast.error("You do not have access to this chat")
      return false
    }

    if (!canEditWorkspaceDocuments(state, conversation.scopeId)) {
      toast.error("Your current role is read-only")
      return false
    }

    return true
  }

  const role = effectiveRole(state, conversation.scopeId)
  if (role === "viewer" || role === "guest" || !role) {
    toast.error("Your current role is read-only")
    return false
  }

  return true
}

function assertOptimisticChatAudience(
  state: AppStore,
  conversation: ChatConversationRecord,
  audienceUserIds: string[]
) {
  if (audienceUserIds.some((userId) => userId !== state.currentUserId)) {
    return true
  }

  toast.error(
    conversation.scopeType === "team"
      ? "This chat is read-only because the other participants have left the team or deleted their account"
      : "This chat is read-only because the other participants have left the workspace or deleted their account"
  )
  return false
}

function addOptimisticMentionNotifications({
  actorName,
  conversation,
  currentUserId,
  mentionUserIds,
  notifications,
  notifiedUserIds,
}: {
  actorName: string
  conversation: ChatConversationRecord
  currentUserId: string
  mentionUserIds: string[]
  notifications: AppStore["notifications"]
  notifiedUserIds: Set<string>
}) {
  for (const mentionedUserId of mentionUserIds) {
    if (
      mentionedUserId === currentUserId ||
      notifiedUserIds.has(mentionedUserId)
    ) {
      continue
    }

    notifications.unshift(
      createNotification(
        mentionedUserId,
        currentUserId,
        `${actorName} mentioned you in ${conversation.title || "a chat"}`,
        "chat",
        conversation.id,
        "mention"
      )
    )

    notifiedUserIds.add(mentionedUserId)
  }
}

function addOptimisticAudienceNotifications({
  actorName,
  audienceUserIds,
  conversation,
  currentUserId,
  notifications,
  notifiedUserIds,
}: {
  actorName: string
  audienceUserIds: string[]
  conversation: ChatConversationRecord
  currentUserId: string
  notifications: AppStore["notifications"]
  notifiedUserIds: Set<string>
}) {
  for (const audienceUserId of audienceUserIds) {
    if (
      audienceUserId === currentUserId ||
      notifiedUserIds.has(audienceUserId)
    ) {
      continue
    }

    notifications.unshift(
      createNotification(
        audienceUserId,
        currentUserId,
        `${actorName} sent you a message in ${conversation.title || "a chat"}`,
        "chat",
        conversation.id,
        "message"
      )
    )

    notifiedUserIds.add(audienceUserId)
  }
}

function createOptimisticChatNotifications(
  state: AppStore,
  conversation: ChatConversationRecord,
  audienceUserIds: string[],
  mentionUserIds: string[]
) {
  const notifications = [...state.notifications]
  const actor = state.users.find((user) => user.id === state.currentUserId)
  const actorName = actor?.name ?? "Someone"
  const notifiedUserIds = new Set<string>()

  addOptimisticMentionNotifications({
    actorName,
    conversation,
    currentUserId: state.currentUserId,
    mentionUserIds,
    notifications,
    notifiedUserIds,
  })
  addOptimisticAudienceNotifications({
    actorName,
    audienceUserIds,
    conversation,
    currentUserId: state.currentUserId,
    notifications,
    notifiedUserIds,
  })

  return notifications
}

function addOptimisticChatMessageToState(
  state: AppStore,
  conversationId: string,
  preparedContent: PreparedChatMessageContent,
  optimisticMessageId: string
): AppStore | Partial<AppStore> {
  const conversation = getChatConversationForSend(state, conversationId)

  if (!conversation || !canSendOptimisticChatMessage(state, conversation)) {
    return state
  }

  const now = getNow()
  const audienceUserIds = getConversationAudienceUserIds(state, conversation)

  if (!assertOptimisticChatAudience(state, conversation, audienceUserIds)) {
    return state
  }

  const mentionUserIds = createMentionIds(
    preparedContent.sanitized,
    state.users,
    audienceUserIds
  )
  const notifications = createOptimisticChatNotifications(
    state,
    conversation,
    audienceUserIds,
    mentionUserIds
  )

  return {
    notifications,
    chatMessages: [
      ...state.chatMessages,
      {
        id: optimisticMessageId,
        conversationId: conversation.id,
        kind: "text",
        content: preparedContent.sanitized,
        callId: null,
        mentionUserIds,
        reactions: [],
        createdBy: state.currentUserId,
        createdAt: now,
      },
    ],
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
}

type ChannelDraftInput = {
  workspaceId?: string | null
  teamId?: string | null
  title: string
  description: string
}

type ChannelCreationResult = {
  conversationId: string | null
  state: AppStore
}

function findChannelConversation(
  state: AppStore,
  scopeType: "workspace" | "team",
  scopeId: string
) {
  return state.conversations.find(
    (conversation) =>
      conversation.kind === "channel" &&
      conversation.scopeType === scopeType &&
      conversation.scopeId === scopeId
  )
}

function getWorkspaceChannelCreationResult(
  state: AppStore,
  input: ChannelDraftInput
): ChannelCreationResult {
  const workspaceId = input.workspaceId
  const workspace = state.workspaces.find((entry) => entry.id === workspaceId)

  if (!workspace || !workspaceId) {
    toast.error("Workspace not found")
    return { conversationId: null, state }
  }

  const existingConversation = findChannelConversation(
    state,
    "workspace",
    workspaceId
  )

  if (existingConversation) {
    return { conversationId: existingConversation.id, state }
  }

  if (!canEditWorkspaceDocuments(state, workspaceId)) {
    toast.error("Your current role is read-only")
    return { conversationId: null, state }
  }

  const now = getNow()
  const conversationId = createId("conversation")

  return {
    conversationId,
    state: {
      ...state,
      conversations: [
        {
          id: conversationId,
          kind: "channel",
          scopeType: "workspace",
          scopeId: workspaceId,
          variant: "team",
          title: input.title.trim() || workspace.name,
          description:
            input.description.trim() ||
            workspace.settings.description ||
            "Shared updates and threaded decisions for the whole workspace.",
          participantIds: getWorkspaceMemberIds(state, workspaceId),
          roomId: null,
          roomName: null,
          createdBy: state.currentUserId,
          createdAt: now,
          updatedAt: now,
          lastActivityAt: now,
        },
        ...state.conversations,
      ],
    },
  }
}

function getTeamChannelCreationResult(
  state: AppStore,
  input: ChannelDraftInput
): ChannelCreationResult {
  const teamId = input.teamId

  if (!teamId) {
    return { conversationId: null, state }
  }

  const team = state.teams.find((entry) => entry.id === teamId)

  if (!team) {
    toast.error("Team not found")
    return { conversationId: null, state }
  }

  if (!team.settings.features.channels) {
    toast.error("Channel is disabled for this team")
    return { conversationId: null, state }
  }

  const existingConversation = findChannelConversation(state, "team", teamId)

  if (existingConversation) {
    return { conversationId: existingConversation.id, state }
  }

  const role = effectiveRole(state, teamId)

  if (role === "viewer" || role === "guest" || !role) {
    toast.error("Your current role is read-only")
    return { conversationId: null, state }
  }

  const now = getNow()
  const conversationId = createId("conversation")

  return {
    conversationId,
    state: {
      ...state,
      conversations: [
        {
          id: conversationId,
          kind: "channel",
          scopeType: "team",
          scopeId: teamId,
          variant: "team",
          title: input.title.trim() || team.name,
          description: input.description.trim() || team.settings.summary,
          participantIds: getTeamMemberIds(state, teamId),
          roomId: null,
          roomName: null,
          createdBy: state.currentUserId,
          createdAt: now,
          updatedAt: now,
          lastActivityAt: now,
        },
        ...state.conversations,
      ],
    },
  }
}

function getChannelCreationResult(
  state: AppStore,
  input: ChannelDraftInput
): ChannelCreationResult {
  return input.workspaceId
    ? getWorkspaceChannelCreationResult(state, input)
    : getTeamChannelCreationResult(state, input)
}

export function createCollaborationConversationActions({
  get,
  runtime,
  set,
}: CollaborationSliceFactoryArgs): Pick<
  CollaborationSlice,
  | "createWorkspaceChat"
  | "ensureTeamChat"
  | "createChannel"
  | "startConversationCall"
  | "sendChatMessage"
  | "toggleChatMessageReaction"
> {
  return {
    createWorkspaceChat(input) {
      const parsed = workspaceChatSchema.safeParse(input)
      if (!parsed.success) {
        toast.error("Chat details are invalid")
        return null
      }

      let conversationId: string | null = null
      let participantIdsForSync: string[] = []
      let reusedConversation = false

      set((state) => {
        if (!canEditWorkspaceDocuments(state, parsed.data.workspaceId)) {
          toast.error("Your current role is read-only")
          return state
        }

        const workspaceMemberIds = new Set(
          getWorkspaceMemberIds(state, parsed.data.workspaceId)
        )
        const participantIds = [
          ...new Set([state.currentUserId, ...parsed.data.participantIds]),
        ].filter((userId) => workspaceMemberIds.has(userId))

        if (participantIds.length < 2) {
          toast.error("Select at least one other workspace member")
          return state
        }

        const existingConversation =
          participantIds.length === 2
            ? findWorkspaceDirectConversation(
                state,
                parsed.data.workspaceId,
                participantIds
              )
            : null

        if (existingConversation) {
          conversationId = existingConversation.id
          reusedConversation = true
          return state
        }

        const now = getNow()
        conversationId = createId("conversation")
        participantIdsForSync = participantIds.filter(
          (userId) => userId !== state.currentUserId
        )

        return {
          ...state,
          conversations: [
            {
              id: conversationId,
              kind: "chat",
              scopeType: "workspace",
              scopeId: parsed.data.workspaceId,
              variant: participantIds.length === 2 ? "direct" : "group",
              title: buildWorkspaceChatTitle(
                state,
                state.currentUserId,
                participantIds,
                parsed.data.title
              ),
              description: parsed.data.description.trim(),
              participantIds,
              roomId: null,
              roomName: null,
              createdBy: state.currentUserId,
              createdAt: now,
              updatedAt: now,
              lastActivityAt: now,
            },
            ...state.conversations,
          ],
        }
      })

      if (!conversationId) {
        return null
      }

      if (reusedConversation) {
        toast.success("Opened existing chat")
        return conversationId
      }

      runtime.syncInBackground(
        syncCreateWorkspaceChat({
          workspaceId: parsed.data.workspaceId,
          participantIds: participantIdsForSync,
          title: parsed.data.title,
          description: parsed.data.description,
        }),
        "Failed to create chat"
      )

      toast.success("Chat created")
      return conversationId
    },
    ensureTeamChat(input) {
      const parsed = teamChatSchema.safeParse(input)
      if (!parsed.success) {
        toast.error("Team chat details are invalid")
        return null
      }

      let conversationId: string | null = null
      let shouldSync = false

      set((state) => {
        const team = state.teams.find(
          (entry) => entry.id === parsed.data.teamId
        )
        if (!team) {
          toast.error("Team not found")
          return state
        }

        if (!team.settings.features.chat) {
          toast.error("Chat is disabled for this team")
          return state
        }

        const existingConversation = state.conversations.find(
          (conversation) =>
            conversation.kind === "chat" &&
            conversation.scopeType === "team" &&
            conversation.scopeId === parsed.data.teamId &&
            conversation.variant === "team"
        )

        if (existingConversation) {
          conversationId = existingConversation.id
          return state
        }

        const role = effectiveRole(state, parsed.data.teamId)
        if (role === "viewer" || role === "guest" || !role) {
          toast.error("Your current role is read-only")
          return state
        }

        const now = getNow()
        conversationId = createId("conversation")
        shouldSync = true

        return {
          ...state,
          conversations: [
            {
              id: conversationId,
              kind: "chat",
              scopeType: "team",
              scopeId: parsed.data.teamId,
              variant: "team",
              title: parsed.data.title.trim() || team.name,
              description:
                parsed.data.description.trim() || team.settings.summary,
              participantIds: getTeamMemberIds(state, parsed.data.teamId),
              roomId: null,
              roomName: null,
              createdBy: state.currentUserId,
              createdAt: now,
              updatedAt: now,
              lastActivityAt: now,
            },
            ...state.conversations,
          ],
        }
      })

      if (!conversationId) {
        return null
      }

      if (shouldSync) {
        runtime.syncInBackground(
          syncEnsureTeamChat(parsed.data),
          "Failed to create team chat"
        )
        toast.success("Team chat ready")
      }

      return conversationId
    },
    createChannel(input) {
      const silent = input.silent ?? false
      const parsed = channelSchema.safeParse(input)
      if (!parsed.success) {
        toast.error("Channel details are invalid")
        return null
      }

      let conversationId: string | null = null

      set((state) => {
        const result = getChannelCreationResult(state, parsed.data)
        conversationId = result.conversationId
        return result.state
      })

      if (!conversationId) {
        return null
      }

      runtime.syncInBackground(
        syncCreateChannel(parsed.data),
        "Failed to create channel"
      )

      if (!silent) {
        toast.success("Channel ready")
      }
      return conversationId
    },
    async startConversationCall(conversationId) {
      try {
        const result = await syncStartConversationCall(conversationId)

        if (!result?.message || !result.joinHref) {
          throw new Error("Failed to start call")
        }

        const [message] = normalizeChatMessages([result.message])

        set((state) => {
          const conversation = state.conversations.find(
            (entry) => entry.id === conversationId
          )

          if (!conversation || conversation.kind !== "chat") {
            return state
          }

          return {
            ...state,
            calls: result.call
              ? [
                  ...state.calls.filter(
                    (entry) => entry.id !== result.call?.id
                  ),
                  result.call,
                ]
              : state.calls,
            chatMessages: [
              ...state.chatMessages.filter((entry) => entry.id !== message.id),
              message,
            ],
            conversations: state.conversations.map((entry) =>
              entry.id === conversationId
                ? {
                    ...entry,
                    updatedAt: message.createdAt,
                    lastActivityAt: message.createdAt,
                  }
                : entry
            ),
          }
        })

        return result.joinHref
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to start call"
        )
        return null
      }
    },
    sendChatMessage(input) {
      const parsed = chatMessageSchema.safeParse(input)
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
        toast.error("Message content must include at least 1 character")
        return
      }

      const optimisticMessageId = createId("chat_message")

      set((state) => {
        return addOptimisticChatMessageToState(
          state,
          parsed.data.conversationId,
          preparedContent,
          optimisticMessageId
        )
      })

      const sendTask = syncSendChatMessage(
        parsed.data.conversationId,
        preparedContent.sanitized,
        optimisticMessageId
      ).finally(() => {
        pendingChatMessageSyncs.delete(optimisticMessageId)
      })

      pendingChatMessageSyncs.set(optimisticMessageId, sendTask)

      runtime.syncInBackground(sendTask, "Failed to send message")
    },
    toggleChatMessageReaction(messageId, emoji) {
      const nextEmoji = emoji.trim()

      if (nextEmoji.length === 0) {
        return
      }

      const state = get()
      const message = state.chatMessages.find((entry) => entry.id === messageId)

      if (!message) {
        return
      }

      const conversation = state.conversations.find(
        (entry) => entry.id === message.conversationId
      )

      if (!conversation || conversation.kind !== "chat") {
        return
      }

      if (conversation.scopeType === "workspace") {
        if (!conversation.participantIds.includes(state.currentUserId)) {
          toast.error("You do not have access to this chat")
          return
        }

        if (!canEditWorkspaceDocuments(state, conversation.scopeId)) {
          toast.error("Your current role is read-only")
          return
        }
      } else {
        const role = effectiveRole(state, conversation.scopeId)

        if (role === "viewer" || role === "guest" || !role) {
          toast.error("Your current role is read-only")
          return
        }
      }

      const toggleLocalReaction = () =>
        set((state) => ({
          chatMessages: state.chatMessages.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  reactions: toggleReactionUsers(
                    message.reactions,
                    nextEmoji,
                    state.currentUserId
                  ),
                }
              : message
          ),
        }))

      toggleLocalReaction()

      const reactionTask = (async () => {
        const pendingMessageSync = pendingChatMessageSyncs.get(messageId)

        if (pendingMessageSync) {
          try {
            await pendingMessageSync
          } catch {
            toggleLocalReaction()
            return null
          }
        }

        try {
          return await syncToggleChatMessageReaction(messageId, nextEmoji)
        } catch (error) {
          if (
            error instanceof RouteMutationError &&
            (error.code === "CHAT_MESSAGE_NOT_FOUND" || error.status === 404)
          ) {
            await runtime.refreshFromServer()

            if (!get().chatMessages.some((entry) => entry.id === messageId)) {
              return null
            }

            return syncToggleChatMessageReaction(messageId, nextEmoji)
          }

          throw error
        }
      })()

      runtime.syncInBackground(reactionTask, "Failed to update reaction")
    },
  }
}

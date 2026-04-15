"use client"

import { toast } from "sonner"

import {
  syncCreateChannel,
  syncCreateWorkspaceChat,
  syncEnsureTeamChat,
  syncSendChatMessage,
  syncStartConversationCall,
} from "@/lib/convex/client"
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
} from "../helpers"
import {
  canEditWorkspaceDocuments,
  effectiveRole,
  getConversationAudienceUserIds,
  getTeamMemberIds,
  getWorkspaceMemberIds,
} from "../validation"
import type {
  CollaborationSlice,
  CollaborationSliceFactoryArgs,
} from "./collaboration-shared"

export function createCollaborationConversationActions({
  runtime,
  set,
}: CollaborationSliceFactoryArgs): Pick<
  CollaborationSlice,
  | "createWorkspaceChat"
  | "ensureTeamChat"
  | "createChannel"
  | "startConversationCall"
  | "sendChatMessage"
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
        const team = state.teams.find((entry) => entry.id === parsed.data.teamId)
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
              description: parsed.data.description.trim() || team.settings.summary,
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
        if (parsed.data.workspaceId) {
          const workspace = state.workspaces.find(
            (entry) => entry.id === parsed.data.workspaceId
          )
          if (!workspace) {
            toast.error("Workspace not found")
            return state
          }

          const existingConversation = state.conversations.find(
            (conversation) =>
              conversation.kind === "channel" &&
              conversation.scopeType === "workspace" &&
              conversation.scopeId === parsed.data.workspaceId
          )

          if (existingConversation) {
            conversationId = existingConversation.id
            return state
          }

          if (!canEditWorkspaceDocuments(state, parsed.data.workspaceId)) {
            toast.error("Your current role is read-only")
            return state
          }

          const now = getNow()
          conversationId = createId("conversation")

          return {
            ...state,
            conversations: [
              {
                id: conversationId,
                kind: "channel",
                scopeType: "workspace",
                scopeId: parsed.data.workspaceId,
                variant: "team",
                title: parsed.data.title.trim() || workspace.name,
                description:
                  parsed.data.description.trim() ||
                  workspace.settings.description ||
                  "Shared updates and threaded decisions for the whole workspace.",
                participantIds: getWorkspaceMemberIds(
                  state,
                  parsed.data.workspaceId
                ),
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
        }

        const teamId = parsed.data.teamId
        if (!teamId) {
          return state
        }

        const team = state.teams.find((entry) => entry.id === teamId)
        if (!team) {
          toast.error("Team not found")
          return state
        }

        if (!team.settings.features.channels) {
          toast.error("Channel is disabled for this team")
          return state
        }

        const existingConversation = state.conversations.find(
          (conversation) =>
            conversation.kind === "channel" &&
            conversation.scopeType === "team" &&
            conversation.scopeId === teamId
        )

        if (existingConversation) {
          conversationId = existingConversation.id
          return state
        }

        const role = effectiveRole(state, teamId)
        if (role === "viewer" || role === "guest" || !role) {
          toast.error("Your current role is read-only")
          return state
        }

        const now = getNow()
        conversationId = createId("conversation")

        return {
          ...state,
          conversations: [
            {
              id: conversationId,
              kind: "channel",
              scopeType: "team",
              scopeId: teamId,
              variant: "team",
              title: parsed.data.title.trim() || team.name,
              description: parsed.data.description.trim() || team.settings.summary,
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
        }
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
                  ...state.calls.filter((entry) => entry.id !== result.call?.id),
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

      set((state) => {
        const conversation = state.conversations.find(
          (entry) => entry.id === parsed.data.conversationId
        )

        if (!conversation || conversation.kind !== "chat") {
          return state
        }

        if (conversation.scopeType === "workspace") {
          if (!conversation.participantIds.includes(state.currentUserId)) {
            toast.error("You do not have access to this chat")
            return state
          }

          if (!canEditWorkspaceDocuments(state, conversation.scopeId)) {
            toast.error("Your current role is read-only")
            return state
          }
        } else {
          const role = effectiveRole(state, conversation.scopeId)
          if (role === "viewer" || role === "guest" || !role) {
            toast.error("Your current role is read-only")
            return state
          }
        }

        const now = getNow()
        const actor = state.users.find((user) => user.id === state.currentUserId)
        const mentionUserIds = createMentionIds(
          parsed.data.content,
          state.users,
          getConversationAudienceUserIds(state, conversation)
        )
        const notifications = [...state.notifications]
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
              `${actor?.name ?? "Someone"} mentioned you in ${conversation.title || "a chat"}`,
              "chat",
              conversation.id,
              "mention"
            )
          )

          notifiedUserIds.add(mentionedUserId)
        }

        return {
          ...state,
          notifications,
          chatMessages: [
            ...state.chatMessages,
            {
              id: createId("chat_message"),
              conversationId: conversation.id,
              kind: "text",
              content: parsed.data.content.trim(),
              callId: null,
              mentionUserIds,
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
      })

      runtime.syncInBackground(
        syncSendChatMessage(parsed.data.conversationId, parsed.data.content),
        "Failed to send message"
      )
    },
  }
}

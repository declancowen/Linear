"use client"

import type { StateStorage } from "zustand/middleware"

import type {
  AppData,
  AttachmentTargetType,
  UserStatus,
} from "@/lib/domain/types"
import { haveSameIds } from "@/lib/domain/collaboration-utils"
export {
  createMentionIds,
  toggleReactionUsers,
} from "@/lib/domain/collaboration-utils"
import { userStatuses } from "@/lib/domain/types"
export { toTeamKeyPrefix } from "@/lib/domain/team-key-prefix"

export function getNow() {
  return new Date().toISOString()
}

export const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function getNextActiveTeamId(
  teams: AppData["teams"],
  currentWorkspaceId: string,
  currentActiveTeamId: string
) {
  const activeTeamStillVisible = teams.some(
    (team) =>
      team.id === currentActiveTeamId && team.workspaceId === currentWorkspaceId
  )

  if (activeTeamStillVisible) {
    return currentActiveTeamId
  }

  return (
    teams.find((team) => team.workspaceId === currentWorkspaceId)?.id ??
    teams[0]?.id ??
    ""
  )
}

export function createNotification(
  userId: string,
  actorId: string,
  message: string,
  entityType:
    | "workItem"
    | "document"
    | "project"
    | "invite"
    | "channelPost"
    | "chat",
  entityId: string,
  type:
    | "mention"
    | "assignment"
    | "comment"
    | "message"
    | "invite"
    | "status-change"
) {
  return {
    id: createId("notification"),
    userId,
    actorId,
    message,
    entityType,
    entityId,
    type,
    readAt: null,
    archivedAt: null,
    emailedAt: null,
    createdAt: getNow(),
  }
}

export function createNotificationDraft(
  state: Pick<AppData, "currentUserId" | "notifications" | "users">
) {
  const notifications = [...state.notifications]
  const actor = state.users.find((user) => user.id === state.currentUserId)

  return {
    actorName: actor?.name ?? "Someone",
    notifications,
    notifiedUserIds: new Set<string>(),
  }
}

export function normalizeNotifications<T extends { archivedAt?: string | null }>(
  notifications: T[] | undefined
) {
  const entries = notifications ?? []

  return entries.map((notification) => ({
    ...notification,
    archivedAt: notification.archivedAt ?? null,
  }))
}

export function normalizeChannelPosts<
  T extends {
    mentionUserIds?: string[]
    reactions?: { emoji: string; userIds: string[] }[]
  },
>(channelPosts: T[] | undefined) {
  const entries = channelPosts ?? []

  return entries.map((post) => ({
    ...post,
    mentionUserIds: post.mentionUserIds ?? [],
    reactions: post.reactions ?? [],
  }))
}

export function normalizeComments<
  T extends {
    mentionUserIds?: string[]
    reactions?: { emoji: string; userIds: string[] }[]
  },
>(comments: T[] | undefined) {
  const entries = comments ?? []

  return entries.map((comment) => ({
    ...comment,
    mentionUserIds: comment.mentionUserIds ?? [],
    reactions: comment.reactions ?? [],
  }))
}

export function normalizeChatMessages<
  T extends {
    mentionUserIds?: string[]
    kind?: "text" | "call"
    callId?: string | null
    reactions?: { emoji: string; userIds: string[] }[]
  },
>(chatMessages: T[] | undefined) {
  const entries = chatMessages ?? []

  return entries.map((message) => ({
    ...message,
    kind: message.kind ?? "text",
    callId: message.callId ?? null,
    mentionUserIds: message.mentionUserIds ?? [],
    reactions: message.reactions ?? [],
  }))
}

export function normalizeChannelPostComments<T extends { mentionUserIds?: string[] }>(
  channelPostComments: T[] | undefined
) {
  const entries = channelPostComments ?? []

  return entries.map((comment) => ({
    ...comment,
    mentionUserIds: comment.mentionUserIds ?? [],
  }))
}

export function normalizeUsers<
  T extends {
    hasExplicitStatus?: boolean | null
    status?: string | null
    statusMessage?: string | null
  },
>(users: T[] | undefined) {
  const entries = users ?? []

  return entries.map((user) => ({
    ...user,
    hasExplicitStatus:
      typeof user.hasExplicitStatus === "boolean"
        ? user.hasExplicitStatus
        : user.status != null,
    status: userStatuses.includes(user.status as UserStatus)
      ? (user.status as UserStatus)
      : ("offline" as const),
    statusMessage:
      typeof user.statusMessage === "string" ? user.statusMessage : "",
  }))
}

export function buildWorkspaceChatTitle(
  state: AppData,
  currentUserId: string,
  participantIds: string[],
  title: string
) {
  const trimmedTitle = title.trim()

  if (trimmedTitle) {
    return trimmedTitle
  }

  const otherParticipants = participantIds.filter(
    (userId) => userId !== currentUserId
  )

  if (otherParticipants.length === 1) {
    return (
      state.users.find((user) => user.id === otherParticipants[0])?.name ??
      "Direct chat"
    )
  }

  const names = otherParticipants
    .map((userId) => state.users.find((user) => user.id === userId)?.name ?? "")
    .filter(Boolean)
    .join(", ")

  return names.slice(0, 80) || "Group chat"
}

export function findWorkspaceDirectConversation(
  state: AppData,
  workspaceId: string,
  participantIds: string[]
) {
  return (
    state.conversations
      .filter(
        (conversation) =>
          conversation.kind === "chat" &&
          conversation.scopeType === "workspace" &&
          conversation.scopeId === workspaceId &&
          conversation.variant === "direct" &&
          haveSameIds(conversation.participantIds, participantIds)
      )
      .sort((left, right) =>
        right.lastActivityAt.localeCompare(left.lastActivityAt)
      )[0] ?? null
  )
}

export function getAttachmentTeamId(
  state: AppData,
  targetType: AttachmentTargetType,
  targetId: string
) {
  if (targetType === "workItem") {
    return state.workItems.find((item) => item.id === targetId)?.teamId ?? ""
  }

  return state.documents.find((document) => document.id === targetId)?.teamId ?? ""
}

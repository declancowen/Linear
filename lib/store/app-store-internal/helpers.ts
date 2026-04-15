"use client"

import type { StateStorage } from "zustand/middleware"

import type {
  AppData,
  AttachmentTargetType,
  UserStatus,
} from "@/lib/domain/types"
import { userStatuses } from "@/lib/domain/types"

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

export function extractDocumentTitleFromContent(content: string) {
  const match = content.match(/<h1[^>]*>(.*?)<\/h1>/)

  if (!match?.[1]) {
    return null
  }

  const plainTitle = match[1].replace(/<[^>]*>/g, "").trim()
  return plainTitle.length > 0 ? plainTitle : null
}

function escapeDocumentHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function replaceDocumentHeading(content: string, title: string) {
  const escapedTitle = escapeDocumentHtml(title)
  const headingPattern = /(<h1[^>]*>)[\s\S]*?(<\/h1>)/i

  if (headingPattern.test(content)) {
    return content.replace(headingPattern, `$1${escapedTitle}$2`)
  }

  return `<h1>${escapedTitle}</h1>${content}`
}

export function toKeyPrefix(teamId: string) {
  const alphanumeric = teamId.replace(/[^a-z0-9]+/gi, "").toUpperCase()
  return alphanumeric.slice(0, 3) || "TEA"
}

export function toTeamKeyPrefix(
  teamName: string | null | undefined,
  teamId: string
) {
  const words = (teamName ?? "")
    .split(/[^a-z0-9]+/gi)
    .map((word) => word.trim())
    .filter(Boolean)

  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((word) => word[0] ?? "")
      .join("")
      .toUpperCase()
  }

  if (words.length === 1) {
    const compact = words[0].replace(/[^a-z0-9]+/gi, "").toUpperCase()

    if (compact.length > 0) {
      return compact.slice(0, 3)
    }
  }

  return toKeyPrefix(teamId)
}

export function createMentionIds(
  content: string,
  users: AppData["users"],
  allowedUserIds?: Iterable<string>
) {
  const audience = allowedUserIds ? new Set(allowedUserIds) : null
  const handles = [...content.matchAll(/@([a-z0-9_-]+)/gi)].map((match) =>
    match[1]?.toLowerCase()
  )

  return [
    ...new Set(
      users
        .filter((user) => handles.includes(user.handle.toLowerCase()))
        .filter((user) => (audience ? audience.has(user.id) : true))
        .map((user) => user.id)
    ),
  ]
}

export function toggleReactionUsers(
  reactions: Array<{ emoji: string; userIds: string[] }> | undefined,
  emoji: string,
  userId: string
) {
  const nextReactions = [...(reactions ?? [])]
  const reactionIndex = nextReactions.findIndex(
    (entry) => entry.emoji === emoji
  )

  if (reactionIndex === -1) {
    return [
      ...nextReactions,
      {
        emoji,
        userIds: [userId],
      },
    ]
  }

  const reaction = nextReactions[reactionIndex]
  const hasReacted = reaction.userIds.includes(userId)
  const userIds = hasReacted
    ? reaction.userIds.filter((entry) => entry !== userId)
    : [...reaction.userIds, userId]

  if (userIds.length === 0) {
    nextReactions.splice(reactionIndex, 1)
    return nextReactions
  }

  nextReactions[reactionIndex] = {
    ...reaction,
    userIds,
  }

  return nextReactions
}

export function normalizeUniqueIds(ids: string[]) {
  return [...new Set(ids)].sort()
}

export function haveSameIds(left: string[], right: string[]) {
  const normalizedLeft = normalizeUniqueIds(left)
  const normalizedRight = normalizeUniqueIds(right)

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
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
  type: "mention" | "assignment" | "comment" | "invite" | "status-change"
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
  T extends { reactions?: { emoji: string; userIds: string[] }[] },
>(channelPosts: T[] | undefined) {
  const entries = channelPosts ?? []

  return entries.map((post) => ({
    ...post,
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
  },
>(chatMessages: T[] | undefined) {
  const entries = chatMessages ?? []

  return entries.map((message) => ({
    ...message,
    kind: message.kind ?? "text",
    callId: message.callId ?? null,
    mentionUserIds: message.mentionUserIds ?? [],
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
      : ("active" as const),
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

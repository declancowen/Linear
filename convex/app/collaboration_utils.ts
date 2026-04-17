import { createId, getNow } from "./core"

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

export function createMentionIds(
  content: string,
  users: Array<{ id: string; handle: string }>,
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
    | "chat"
    | "team"
    | "workspace",
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
    digestClaimId: null,
    digestClaimedAt: null,
    createdAt: getNow(),
  }
}

export function createDeliveredNotification(
  userId: string,
  actorId: string,
  message: string,
  entityType:
    | "workItem"
    | "document"
    | "project"
    | "invite"
    | "channelPost"
    | "chat"
    | "team"
    | "workspace",
  entityId: string,
  type: "mention" | "assignment" | "comment" | "invite" | "status-change"
) {
  return {
    ...createNotification(userId, actorId, message, entityType, entityId, type),
    emailedAt: getNow(),
  }
}

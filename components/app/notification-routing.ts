import type { AppData, Notification } from "@/lib/domain/types"

export type NotificationRouteData = Pick<
  AppData,
  "channelPosts" | "conversations" | "projects" | "teams"
>

export function appendPendingNotificationToastIds(input: {
  candidates: Pick<Notification, "id">[]
  knownIds: Set<string>
  pendingIds: string[]
}) {
  const { candidates, knownIds, pendingIds } = input

  for (const notification of candidates) {
    if (knownIds.has(notification.id)) {
      continue
    }

    knownIds.add(notification.id)
    pendingIds.push(notification.id)
  }
}

export function initializePendingNotificationToastIds(input: {
  candidates: Pick<Notification, "id" | "createdAt">[]
  knownIds: Set<string>
  pendingIds: string[]
  startedAt: string
}) {
  const { candidates, knownIds, pendingIds, startedAt } = input

  for (const notification of candidates) {
    if (knownIds.has(notification.id)) {
      continue
    }

    knownIds.add(notification.id)

    if (!startedAt || notification.createdAt <= startedAt) {
      continue
    }

    pendingIds.push(notification.id)
  }
}

export function getNotificationHref(
  data: NotificationRouteData,
  notification: Notification
) {
  if (notification.entityType === "workItem") {
    return `/items/${notification.entityId}`
  }

  if (notification.entityType === "document") {
    return `/docs/${notification.entityId}`
  }

  if (notification.entityType === "project") {
    const project = data.projects.find(
      (entry) => entry.id === notification.entityId
    )

    if (!project) {
      return null
    }

    if (project.scopeType === "workspace") {
      return `/workspace/projects/${project.id}`
    }

    const team = data.teams.find((entry) => entry.id === project.scopeId)
    return team ? `/team/${team.slug}/projects/${project.id}` : null
  }

  if (notification.entityType === "channelPost") {
    const post = data.channelPosts.find(
      (entry) => entry.id === notification.entityId
    )
    const conversation = post
      ? data.conversations.find((entry) => entry.id === post.conversationId)
      : null

    if (!post || !conversation || conversation.kind !== "channel") {
      return null
    }

    if (conversation.scopeType === "workspace") {
      return `/workspace/channel#${post.id}`
    }

    const team = data.teams.find((entry) => entry.id === conversation.scopeId)
    return team ? `/team/${team.slug}/channel#${post.id}` : null
  }

  if (notification.entityType === "chat") {
    const conversation = data.conversations.find(
      (entry) => entry.id === notification.entityId
    )

    if (!conversation || conversation.kind !== "chat") {
      return null
    }

    if (conversation.scopeType === "workspace") {
      return `/chats?chatId=${conversation.id}`
    }

    const team = data.teams.find((entry) => entry.id === conversation.scopeId)
    return team ? `/team/${team.slug}/chat` : null
  }

  if (notification.entityType === "invite") {
    return "/invites"
  }

  return null
}

function getHrefPathname(href: string) {
  return href.split(/[?#]/, 1)[0]
}

function getHrefHash(href: string) {
  const hashStart = href.indexOf("#")

  if (hashStart === -1) {
    return ""
  }

  return href.slice(hashStart + 1).split("?", 1)[0]
}

function getHrefSearchParams(href: string) {
  const query = href.includes("?")
    ? href.split("?", 2)[1]?.split("#", 1)[0]
    : ""
  return new URLSearchParams(query ?? "")
}

function normalizeHash(hash: string | null | undefined) {
  return hash?.replace(/^#/, "") ?? ""
}

export function isViewingNotificationTarget(input: {
  notification: Notification
  href: string | null
  pathname: string
  searchParams: URLSearchParams
  hash?: string | null
}) {
  const { notification, href, pathname, searchParams, hash } = input

  if (notification.entityType === "channelPost") {
    if (!href) {
      return false
    }

    const hrefHash = getHrefHash(href)

    if (!hrefHash) {
      return false
    }

    return (
      pathname === getHrefPathname(href) && normalizeHash(hash) === hrefHash
    )
  }

  if (notification.entityType === "chat") {
    if (!href) {
      return false
    }

    const hrefPathname = getHrefPathname(href)
    const targetChatId = getHrefSearchParams(href).get("chatId")

    if (targetChatId) {
      return (
        pathname === hrefPathname && searchParams.get("chatId") === targetChatId
      )
    }

    return pathname === hrefPathname
  }

  if (!href) {
    return false
  }

  return pathname === getHrefPathname(href)
}

"use client"

import type { AppSnapshot } from "@/lib/domain/types"
import type { ScopedReadModelReplaceInstruction } from "@/lib/scoped-sync/read-models"

import { runRouteMutation } from "./shared"

type ReadModelRoutePayload = {
  data: Partial<AppSnapshot>
}

export type ReadModelFetchResult<T extends Partial<AppSnapshot>> = {
  data: T
  replace?: ScopedReadModelReplaceInstruction[]
}

const EMPTY_SCOPED_READ_MODEL_DATA: Partial<AppSnapshot> = {
  workspaces: [],
  workspaceMemberships: [],
  teams: [],
  teamMemberships: [],
  users: [],
  labels: [],
  projects: [],
  milestones: [],
  workItems: [],
  documents: [],
  views: [],
  comments: [],
  attachments: [],
  notifications: [],
  invites: [],
  projectUpdates: [],
  conversations: [],
  calls: [],
  chatMessages: [],
  channelPosts: [],
  channelPostComments: [],
}

async function fetchReadModel<T extends Partial<AppSnapshot>>(
  url: string,
  replace?: ScopedReadModelReplaceInstruction[]
): Promise<ReadModelFetchResult<T>> {
  const payload = await runRouteMutation<ReadModelRoutePayload>(url, {
    method: "GET",
  })

  return {
    data: payload.data as T,
    replace,
  }
}

export function createMissingScopedReadModelResult(
  replace: ScopedReadModelReplaceInstruction[]
): ReadModelFetchResult<Partial<AppSnapshot>> {
  return {
    data: EMPTY_SCOPED_READ_MODEL_DATA,
    replace,
  }
}

export function fetchDocumentDetailReadModel(documentId: string) {
  return fetchReadModel(`/api/read-models/documents/${documentId}`, [
    {
      kind: "document-detail",
      documentId,
    },
  ])
}

export function fetchWorkIndexReadModel(
  scopeType: "team" | "workspace" | "personal",
  scopeId: string
) {
  return fetchReadModel(
    `/api/read-models/work/index?scopeType=${encodeURIComponent(scopeType)}&scopeId=${encodeURIComponent(scopeId)}`,
    [
      {
        kind: "work-index",
        scopeType,
        scopeId,
      },
    ]
  )
}

export function fetchDocumentIndexReadModel(
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return fetchReadModel(
    `/api/read-models/documents/index?scopeType=${encodeURIComponent(scopeType)}&scopeId=${encodeURIComponent(scopeId)}`,
    [
      {
        kind: "document-index",
        scopeType,
        scopeId,
      },
    ]
  )
}

export function fetchWorkspaceMembershipReadModel(workspaceId: string) {
  return fetchReadModel(`/api/read-models/workspaces/${workspaceId}/membership`, [
    {
      kind: "workspace-membership",
      workspaceId,
    },
  ])
}

export function fetchViewCatalogReadModel(
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return fetchReadModel(
    `/api/read-models/views/catalog?scopeType=${encodeURIComponent(scopeType)}&scopeId=${encodeURIComponent(scopeId)}`,
    [
      {
        kind: "view-catalog",
        scopeType,
        scopeId,
      },
    ]
  )
}

export function fetchProjectIndexReadModel(
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return fetchReadModel(
    `/api/read-models/projects/index?scopeType=${encodeURIComponent(scopeType)}&scopeId=${encodeURIComponent(scopeId)}`,
    [
      {
        kind: "project-index",
        scopeType,
        scopeId,
      },
    ]
  )
}

export function fetchWorkItemDetailReadModel(itemId: string) {
  return fetchReadModel(`/api/read-models/items/${itemId}`, [
    {
      kind: "work-item-detail",
      itemId,
    },
  ])
}

export function fetchProjectDetailReadModel(projectId: string) {
  return fetchReadModel(`/api/read-models/projects/${projectId}`, [
    {
      kind: "project-detail",
      projectId,
    },
  ])
}

export function fetchNotificationInboxReadModel(userId: string) {
  return fetchReadModel("/api/read-models/notifications/inbox", [
    {
      kind: "notification-inbox",
      userId,
    },
  ])
}

export function fetchConversationListReadModel(userId: string) {
  return fetchReadModel("/api/read-models/conversations/list", [
    {
      kind: "conversation-list",
      userId,
    },
  ])
}

export function fetchConversationThreadReadModel(conversationId: string) {
  return fetchReadModel(`/api/read-models/conversations/${conversationId}`, [
    {
      kind: "conversation-thread",
      conversationId,
    },
  ])
}

export function fetchChannelFeedReadModel(channelId: string) {
  return fetchReadModel(`/api/read-models/channels/${channelId}/feed`, [
    {
      kind: "channel-feed",
      conversationId: channelId,
    },
  ])
}

export function fetchSearchSeedReadModel(workspaceId: string) {
  return fetchReadModel(
    `/api/read-models/workspaces/${workspaceId}/search-seed`,
    [
      {
        kind: "search-seed",
        workspaceId,
      },
    ]
  )
}

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

type ScopedArrayDomainKey = keyof Pick<
  AppSnapshot,
  | "workspaces"
  | "workspaceMemberships"
  | "teams"
  | "teamMemberships"
  | "users"
  | "labels"
  | "projects"
  | "milestones"
  | "workItems"
  | "documents"
  | "views"
  | "comments"
  | "attachments"
  | "notifications"
  | "invites"
  | "projectUpdates"
  | "conversations"
  | "calls"
  | "chatMessages"
  | "channelPosts"
  | "channelPostComments"
>

const EMPTY_SCOPED_ARRAY_DOMAINS_BY_REPLACE_KIND = {
  "document-detail": ["documents", "comments", "attachments", "users"],
  "missing-document-detail": ["documents"],
  "document-index": ["documents", "views", "users"],
  "work-item-detail": [
    "workItems",
    "labels",
    "projects",
    "milestones",
    "documents",
    "comments",
    "attachments",
    "teamMemberships",
    "users",
  ],
  "missing-work-item-detail": ["workItems"],
  "work-index": [
    "workspaces",
    "workspaceMemberships",
    "teams",
    "teamMemberships",
    "users",
    "labels",
    "projects",
    "milestones",
    "workItems",
    "views",
  ],
  "project-detail": [
    "projects",
    "milestones",
    "projectUpdates",
    "workItems",
    "documents",
    "views",
    "users",
  ],
  "missing-project-detail": ["projects"],
  "project-index": ["projects", "workItems", "teams", "views", "users"],
  "workspace-membership": [
    "workspaces",
    "workspaceMemberships",
    "teams",
    "teamMemberships",
    "labels",
    "users",
    "invites",
  ],
  "view-catalog": [
    "workspaces",
    "workspaceMemberships",
    "teams",
    "teamMemberships",
    "views",
  ],
  "notification-inbox": [
    "workspaces",
    "teams",
    "users",
    "notifications",
    "invites",
    "conversations",
    "channelPosts",
    "projects",
  ],
  "conversation-list": [
    "workspaces",
    "workspaceMemberships",
    "teams",
    "teamMemberships",
    "users",
    "conversations",
    "chatMessages",
  ],
  "conversation-thread": [
    "workspaces",
    "workspaceMemberships",
    "teams",
    "teamMemberships",
    "users",
    "conversations",
    "calls",
    "chatMessages",
  ],
  "channel-feed": [
    "workspaces",
    "workspaceMemberships",
    "teams",
    "teamMemberships",
    "users",
    "conversations",
    "channelPosts",
    "channelPostComments",
  ],
  "search-seed": [
    "workspaces",
    "workspaceMemberships",
    "teams",
    "teamMemberships",
    "users",
    "projects",
    "documents",
    "workItems",
  ],
} satisfies Partial<
  Record<
    ScopedReadModelReplaceInstruction["kind"],
    readonly ScopedArrayDomainKey[]
  >
>

function getEmptyScopedArrayDomains(
  instruction: ScopedReadModelReplaceInstruction
): ScopedArrayDomainKey[] {
  return [
    ...(EMPTY_SCOPED_ARRAY_DOMAINS_BY_REPLACE_KIND[instruction.kind] ?? []),
  ]
}

function createEmptyScopedReadModelData(
  replace: ScopedReadModelReplaceInstruction[]
): Partial<AppSnapshot> {
  const domains = new Set<ScopedArrayDomainKey>()

  for (const instruction of replace) {
    for (const domain of getEmptyScopedArrayDomains(instruction)) {
      domains.add(domain)
    }
  }

  return [...domains].reduce<Partial<AppSnapshot>>((result, domain) => {
    result[domain] = []
    return result
  }, {})
}

function createMissingReplaceInstruction(
  instruction: ScopedReadModelReplaceInstruction
): ScopedReadModelReplaceInstruction {
  switch (instruction.kind) {
    case "document-detail":
      return {
        kind: "missing-document-detail",
        documentId: instruction.documentId,
      }
    case "work-item-detail":
      return {
        kind: "missing-work-item-detail",
        itemId: instruction.itemId,
      }
    case "project-detail":
      return {
        kind: "missing-project-detail",
        projectId: instruction.projectId,
      }
    default:
      return instruction
  }
}

function createMissingScopedReadModelData(
  replace: ScopedReadModelReplaceInstruction[]
): Partial<AppSnapshot> {
  const missingReplace = replace.map(createMissingReplaceInstruction)

  return missingReplace.reduce<Partial<AppSnapshot>>((result, instruction) => {
    switch (instruction.kind) {
      case "missing-document-detail":
        result.documents = []
        break
      case "missing-work-item-detail":
        result.workItems = []
        break
      case "missing-project-detail":
        result.projects = []
        break
      default:
        Object.assign(result, createEmptyScopedReadModelData([instruction]))
        break
    }

    return result
  }, {})
}

async function fetchReadModel<T extends Partial<AppSnapshot>>(
  url: string,
  replace?: ScopedReadModelReplaceInstruction[],
  init: RequestInit = {
    method: "GET",
  }
): Promise<ReadModelFetchResult<T>> {
  const payload = await runRouteMutation<ReadModelRoutePayload>(url, init)

  return {
    data: payload.data as T,
    replace,
  }
}

export function createMissingScopedReadModelResult(
  replace: ScopedReadModelReplaceInstruction[]
): ReadModelFetchResult<Partial<AppSnapshot>> {
  return {
    data: createMissingScopedReadModelData(replace),
    replace: replace.map(createMissingReplaceInstruction),
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
  return fetchReadModel(
    `/api/read-models/workspaces/${workspaceId}/membership`,
    [
      {
        kind: "workspace-membership",
        workspaceId,
      },
    ]
  )
}

export function selectCurrentWorkspaceReadModel(workspaceId: string) {
  return fetchReadModel(
    `/api/workspace/current/selection`,
    [
      {
        kind: "workspace-membership",
        workspaceId,
      },
    ],
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ workspaceId }),
    }
  )
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

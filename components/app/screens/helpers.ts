"use client"

import type { AppStore } from "@/lib/store/app-store"
import { getDisplayInitials } from "@/lib/display-initials"
import {
  canEditWorkspace,
  canEditTeam,
  getProject,
  getProjectsForScope,
  getWorkItemDescendantIds,
  sortItems,
} from "@/lib/domain/selectors"
import {
  canParentWorkItemTypeAcceptChild,
  createDefaultViewFilters,
  type AppData,
  type Document,
  type GroupField,
  type Project,
  type ViewDefinition,
  type WorkItem,
  type WorkItemType,
} from "@/lib/domain/types"

const DOCUMENT_PRESENCE_SESSION_STORAGE_KEY =
  "linear.document-presence-session-id"
const DOCUMENT_PRESENCE_SESSION_USER_STORAGE_KEY =
  "linear.document-presence-session-user-id"

let documentPresenceSessionFallbackState: {
  userId: string | null
  sessionId: string
} | null = null

export type ViewFilterKey = Exclude<
  keyof ViewDefinition["filters"],
  "showCompleted"
>

export type PersistedViewFilterKey =
  | "status"
  | "priority"
  | "assigneeIds"
  | "creatorIds"
  | "leadIds"
  | "health"
  | "milestoneIds"
  | "relationTypes"
  | "projectIds"
  | "parentIds"
  | "itemTypes"
  | "labelIds"
  | "teamIds"

export function createEmptyViewFilters(): ViewDefinition["filters"] {
  return createDefaultViewFilters()
}

export function isPersistedViewFilterKey(
  key: ViewFilterKey
): key is PersistedViewFilterKey {
  return [
    "status",
    "priority",
    "assigneeIds",
    "creatorIds",
    "leadIds",
    "health",
    "milestoneIds",
    "relationTypes",
    "projectIds",
    "parentIds",
    "itemTypes",
    "labelIds",
    "teamIds",
  ].includes(key)
}

export function cloneViewFilters(
  filters: ViewDefinition["filters"]
): ViewDefinition["filters"] {
  return {
    status: [...filters.status],
    priority: [...filters.priority],
    assigneeIds: [...filters.assigneeIds],
    creatorIds: [...filters.creatorIds],
    leadIds: [...filters.leadIds],
    health: [...filters.health],
    milestoneIds: [...filters.milestoneIds],
    relationTypes: [...filters.relationTypes],
    projectIds: [...filters.projectIds],
    parentIds: [...(filters.parentIds ?? [])],
    itemTypes: [...filters.itemTypes],
    labelIds: [...filters.labelIds],
    teamIds: [...filters.teamIds],
    showCompleted: filters.showCompleted,
  }
}

export function getContainerItemsForDisplay(
  items: WorkItem[],
  visibleItems: WorkItem[],
  showChildItems: boolean
) {
  if (!showChildItems) {
    return items
  }

  const visibleItemIds = new Set(visibleItems.map((item) => item.id))

  return items.filter(
    (item) => !item.parentId || !visibleItemIds.has(item.parentId)
  )
}

export function selectAppDataSnapshot(state: AppStore): AppData {
  return {
    currentUserId: state.currentUserId,
    currentWorkspaceId: state.currentWorkspaceId,
    workspaces: state.workspaces,
    teams: state.teams,
    workspaceMemberships: state.workspaceMemberships,
    teamMemberships: state.teamMemberships,
    users: state.users,
    labels: state.labels,
    projects: state.projects,
    milestones: state.milestones,
    workItems: state.workItems,
    documents: state.documents,
    views: state.views,
    comments: state.comments,
    attachments: state.attachments,
    notifications: state.notifications,
    invites: state.invites,
    projectUpdates: state.projectUpdates,
    conversations: state.conversations,
    calls: state.calls,
    chatMessages: state.chatMessages,
    channelPosts: state.channelPosts,
    channelPostComments: state.channelPostComments,
    ui: state.ui,
  }
}

export function canEditDocumentInUi(data: AppData, document: Document) {
  if (document.kind === "item-description") {
    return false
  }

  if (document.kind === "team-document") {
    return document.teamId ? canEditTeam(data, document.teamId) : false
  }

  if (document.kind === "private-document") {
    return document.createdBy === data.currentUserId
  }

  return document.workspaceId
    ? canEditWorkspace(data, document.workspaceId)
    : false
}

export function getUserInitials(name: string | null | undefined) {
  return getDisplayInitials(name ?? "", "?")
}

function createPresenceSessionId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID()
  }

  return `presence_${Math.random().toString(36).slice(2, 10)}`
}

function resolveStoredPresenceSessionId(currentUserId?: string | null) {
  const existingSessionId = window.sessionStorage.getItem(
    DOCUMENT_PRESENCE_SESSION_STORAGE_KEY
  )
  const existingUserId = window.sessionStorage.getItem(
    DOCUMENT_PRESENCE_SESSION_USER_STORAGE_KEY
  )

  if (!existingSessionId) {
    return null
  }

  if (!currentUserId) {
    return existingSessionId
  }

  if (!existingUserId) {
    window.sessionStorage.setItem(
      DOCUMENT_PRESENCE_SESSION_USER_STORAGE_KEY,
      currentUserId
    )
    return existingSessionId
  }

  return existingUserId === currentUserId ? existingSessionId : null
}

function createStoredPresenceSessionId(currentUserId?: string | null) {
  const nextSessionId = createPresenceSessionId()

  window.sessionStorage.setItem(
    DOCUMENT_PRESENCE_SESSION_STORAGE_KEY,
    nextSessionId
  )

  if (currentUserId) {
    window.sessionStorage.setItem(
      DOCUMENT_PRESENCE_SESSION_USER_STORAGE_KEY,
      currentUserId
    )
  } else {
    window.sessionStorage.removeItem(DOCUMENT_PRESENCE_SESSION_USER_STORAGE_KEY)
  }

  return nextSessionId
}

function getFallbackPresenceSessionId(currentUserId?: string | null) {
  if (!documentPresenceSessionFallbackState) {
    documentPresenceSessionFallbackState = {
      userId: currentUserId ?? null,
      sessionId: createPresenceSessionId(),
    }
  } else if (currentUserId && !documentPresenceSessionFallbackState.userId) {
    documentPresenceSessionFallbackState = {
      ...documentPresenceSessionFallbackState,
      userId: currentUserId,
    }
  } else if (
    currentUserId &&
    documentPresenceSessionFallbackState.userId !== currentUserId
  ) {
    documentPresenceSessionFallbackState = {
      userId: currentUserId,
      sessionId: createPresenceSessionId(),
    }
  }

  return documentPresenceSessionFallbackState.sessionId
}

export function getDocumentPresenceSessionId(currentUserId?: string | null) {
  if (typeof window === "undefined") {
    return createPresenceSessionId()
  }

  try {
    return (
      resolveStoredPresenceSessionId(currentUserId) ??
      createStoredPresenceSessionId(currentUserId)
    )
  } catch (error) {
    console.warn(
      "Falling back to in-memory document presence session id",
      error
    )
    return getFallbackPresenceSessionId(currentUserId)
  }
}

export function getWorkItemPresenceSessionId(currentUserId?: string | null) {
  return getDocumentPresenceSessionId(currentUserId)
}

export function getEligibleParentWorkItems(data: AppData, item: WorkItem) {
  const blockedIds = getWorkItemDescendantIds(data, item.id)

  return sortItems(
    data.workItems.filter(
      (candidate) =>
        candidate.teamId === item.teamId &&
        candidate.id !== item.id &&
        !blockedIds.has(candidate.id) &&
        canParentWorkItemTypeAcceptChild(candidate.type, item.type)
    ),
    "priority"
  )
}

export function getTeamProjectOptions(
  data: AppData,
  teamId: string | null | undefined,
  selectedProjectId?: string | null
) {
  if (!teamId) {
    return []
  }

  const projects = getProjectsForScope(data, "team", teamId)

  if (!selectedProjectId) {
    return projects
  }

  const selectedProject = getProject(data, selectedProjectId)

  if (
    !selectedProject ||
    projects.some((project) => project.id === selectedProject.id)
  ) {
    return projects
  }

  return [selectedProject, ...projects]
}

export function getPreferredCreateDialogType(
  templateType: Project["templateType"]
) {
  if (templateType === "bug-tracking") {
    return "issue" satisfies WorkItemType
  }

  if (templateType === "project-management") {
    return "task" satisfies WorkItemType
  }

  return "epic" satisfies WorkItemType
}

export function getProjectPresentationGroupOptions(
  templateType: Project["templateType"]
): GroupField[] {
  const baseOptions: GroupField[] = [
    "status",
    "assignee",
    "priority",
    "label",
    "type",
  ]

  if (templateType === "software-delivery") {
    return [...baseOptions, "epic", "feature"]
  }

  return baseOptions
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function formatInlineDescriptionContent(value: string) {
  return value
    .trim()
    .split(/\n{2,}/)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`
    )
    .join("")
}

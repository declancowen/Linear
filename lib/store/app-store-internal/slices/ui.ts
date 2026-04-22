"use client"

import { createEmptyState } from "@/lib/domain/empty-state"
import type { AppData } from "@/lib/domain/types"
import {
  selectReadModelForInstruction,
  type ScopedReadModelPatch,
  type ScopedReadModelReplaceInstruction,
} from "@/lib/scoped-sync/read-models"

import {
  normalizeChannelPostComments,
  normalizeChannelPosts,
  normalizeChatMessages,
  normalizeComments,
  normalizeNotifications,
  normalizeUsers,
} from "../helpers"
import type { AppStore, AppStoreSlice } from "../types"

type UiSlice = Pick<
  AppStore,
  | "protectedDocumentIds"
  | "setDocumentBodyProtection"
  | "replaceDomainData"
  | "mergeReadModelData"
  | "setActiveTeam"
  | "openCreateDialog"
  | "closeCreateDialog"
  | "setSelectedView"
  | "setActiveInboxNotification"
>

function getNextActiveTeamId(
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

function mergeByKey<T>(
  existing: T[],
  incoming: T[] | undefined,
  getKey: (value: T) => string
) {
  if (!incoming) {
    return existing
  }

  const entries = new Map(existing.map((value) => [getKey(value), value]))

  for (const value of incoming) {
    entries.set(getKey(value), value)
  }

  return [...entries.values()]
}

function mergeProtectedDocuments(
  existing: AppData["documents"],
  incoming: AppData["documents"] | undefined,
  protectedDocumentIds: string[],
  options?: {
    preserveExistingBodies?: boolean
  }
) {
  if (!incoming) {
    return existing
  }

  const protectedIds = new Set(protectedDocumentIds)

  return mergeByKey(existing, incoming, (value) => value.id).map((document) => {
    const currentDocument =
      existing.find((entry) => entry.id === document.id) ?? null

    if (!currentDocument) {
      return document
    }

    if (!protectedIds.has(document.id) && !options?.preserveExistingBodies) {
      return document
    }

    if (options?.preserveExistingBodies) {
      return {
        ...document,
        content: currentDocument.content,
      }
    }

    return {
      ...document,
      title: currentDocument.title,
      content: currentDocument.content,
      updatedAt: currentDocument.updatedAt,
      updatedBy: currentDocument.updatedBy,
    }
  })
}

function getWorkspaceMembershipKey(value: AppData["workspaceMemberships"][number]) {
  return `${value.workspaceId}:${value.userId}`
}

function getTeamMembershipKey(value: AppData["teamMemberships"][number]) {
  return `${value.teamId}:${value.userId}`
}

type ArrayDomainKey =
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

function shouldPreserveExistingDocumentBodies(
  replaceInstructions?: ScopedReadModelReplaceInstruction[]
) {
  if (!replaceInstructions || replaceInstructions.length === 0) {
    return false
  }

  return replaceInstructions.every(
    (instruction) =>
      instruction.kind === "document-index" ||
      instruction.kind === "project-detail" ||
      instruction.kind === "search-seed"
  )
}

type ArrayDomainValue<K extends ArrayDomainKey> =
  AppData[K] extends Array<infer TValue> ? TValue : never

type ArrayDomainEntry =
  | AppData["workspaces"][number]
  | AppData["workspaceMemberships"][number]
  | AppData["teams"][number]
  | AppData["teamMemberships"][number]
  | AppData["users"][number]
  | AppData["labels"][number]
  | AppData["projects"][number]
  | AppData["milestones"][number]
  | AppData["workItems"][number]
  | AppData["documents"][number]
  | AppData["views"][number]
  | AppData["comments"][number]
  | AppData["attachments"][number]
  | AppData["notifications"][number]
  | AppData["invites"][number]
  | AppData["projectUpdates"][number]
  | AppData["conversations"][number]
  | AppData["calls"][number]
  | AppData["chatMessages"][number]
  | AppData["channelPosts"][number]
  | AppData["channelPostComments"][number]

const domainKeyResolvers: {
  [K in ArrayDomainKey]: (value: ArrayDomainValue<K>) => string
} = {
  workspaces: (value: AppData["workspaces"][number]) => value.id,
  workspaceMemberships: getWorkspaceMembershipKey,
  teams: (value: AppData["teams"][number]) => value.id,
  teamMemberships: getTeamMembershipKey,
  users: (value: AppData["users"][number]) => value.id,
  labels: (value: AppData["labels"][number]) => value.id,
  projects: (value: AppData["projects"][number]) => value.id,
  milestones: (value: AppData["milestones"][number]) => value.id,
  workItems: (value: AppData["workItems"][number]) => value.id,
  documents: (value: AppData["documents"][number]) => value.id,
  views: (value: AppData["views"][number]) => value.id,
  comments: (value: AppData["comments"][number]) => value.id,
  attachments: (value: AppData["attachments"][number]) => value.id,
  notifications: (value: AppData["notifications"][number]) => value.id,
  invites: (value: AppData["invites"][number]) => value.id,
  projectUpdates: (value: AppData["projectUpdates"][number]) => value.id,
  conversations: (value: AppData["conversations"][number]) => value.id,
  calls: (value: AppData["calls"][number]) => value.id,
  chatMessages: (value: AppData["chatMessages"][number]) => value.id,
  channelPosts: (value: AppData["channelPosts"][number]) => value.id,
  channelPostComments: (value: AppData["channelPostComments"][number]) =>
    value.id,
}

function pruneScopedDomain(
  currentDomain: ArrayDomainEntry[],
  scopedDomain: ArrayDomainEntry[] | undefined,
  incomingDomain: ArrayDomainEntry[] | undefined,
  keyResolver: (value: ArrayDomainEntry) => string
) {
  if (!scopedDomain || !incomingDomain) {
    return currentDomain
  }

  const scopedKeys = new Set(scopedDomain.map((value) => keyResolver(value)))

  if (scopedKeys.size === 0) {
    return currentDomain
  }

  const incomingKeys = new Set(incomingDomain.map((value) => keyResolver(value)))

  return currentDomain.filter((value) => {
    const key = keyResolver(value)

    return !scopedKeys.has(key) || incomingKeys.has(key)
  })
}

function applyScopedReadModelPruning(
  state: AppStore,
  data: Partial<AppData>,
  replaceInstructions: ScopedReadModelReplaceInstruction[] | undefined
) {
  if (!replaceInstructions || replaceInstructions.length === 0) {
    return state
  }

  let nextState = state

  for (const instruction of replaceInstructions) {
    const scopedSelection = selectReadModelForInstruction(
      nextState,
      instruction
    ) as ScopedReadModelPatch | null

    if (!scopedSelection) {
      continue
    }

    for (const domainKey of Object.keys(domainKeyResolvers) as ArrayDomainKey[]) {
      const keyResolver = domainKeyResolvers[domainKey]
      const incomingDomain = data[domainKey]
      const scopedDomain = scopedSelection[domainKey]

      if (!Array.isArray(incomingDomain) || !Array.isArray(scopedDomain)) {
        continue
      }

      nextState = {
        ...nextState,
        [domainKey]: pruneScopedDomain(
          nextState[domainKey] as ArrayDomainEntry[],
          scopedDomain as ArrayDomainEntry[],
          incomingDomain as ArrayDomainEntry[],
          keyResolver as (value: ArrayDomainEntry) => string
        ) as AppData[typeof domainKey],
      }
    }
  }

  return nextState
}

function applyReplacedDomainData(state: AppStore, data: Partial<AppData>) {
  return {
    ...state,
    ...data,
    protectedDocumentIds: state.protectedDocumentIds,
    documents: mergeProtectedDocuments(
      state.documents,
      data.documents,
      state.protectedDocumentIds
    ),
    users: normalizeUsers(data.users ?? state.users),
    notifications: normalizeNotifications(
      data.notifications ?? state.notifications
    ),
    comments: normalizeComments(data.comments ?? state.comments),
    chatMessages: normalizeChatMessages(
      data.chatMessages ?? state.chatMessages
    ),
    channelPosts: normalizeChannelPosts(
      data.channelPosts ?? state.channelPosts
    ),
    channelPostComments: normalizeChannelPostComments(
      data.channelPostComments ?? state.channelPostComments
    ),
    ui: {
      ...state.ui,
      activeTeamId: getNextActiveTeamId(
        data.teams ?? state.teams,
        data.currentWorkspaceId ?? state.currentWorkspaceId,
        state.ui.activeTeamId
      ),
    },
  }
}

function applyMergedReadModelData(
  state: AppStore,
  data: Partial<AppData>,
  replaceInstructions?: ScopedReadModelReplaceInstruction[]
) {
  const prunedState = applyScopedReadModelPruning(
    state,
    data,
    replaceInstructions
  )
  const currentWorkspaceId = data.currentWorkspaceId ?? state.currentWorkspaceId
  const teams = mergeByKey(prunedState.teams, data.teams, (value) => value.id)
  const preserveExistingDocumentBodies =
    shouldPreserveExistingDocumentBodies(replaceInstructions)

  return {
    ...prunedState,
    ...data,
    currentUserId: data.currentUserId ?? prunedState.currentUserId,
    currentWorkspaceId,
    workspaces: mergeByKey(prunedState.workspaces, data.workspaces, (value) => value.id),
    workspaceMemberships: mergeByKey(
      prunedState.workspaceMemberships,
      data.workspaceMemberships,
      getWorkspaceMembershipKey
    ),
    teams,
    teamMemberships: mergeByKey(
      prunedState.teamMemberships,
      data.teamMemberships,
      getTeamMembershipKey
    ),
    users: normalizeUsers(mergeByKey(prunedState.users, data.users, (value) => value.id)),
    labels: mergeByKey(prunedState.labels, data.labels, (value) => value.id),
    projects: mergeByKey(prunedState.projects, data.projects, (value) => value.id),
    milestones: mergeByKey(
      prunedState.milestones,
      data.milestones,
      (value) => value.id
    ),
    workItems: mergeByKey(prunedState.workItems, data.workItems, (value) => value.id),
    documents: mergeProtectedDocuments(
      prunedState.documents,
      data.documents,
      prunedState.protectedDocumentIds,
      {
        preserveExistingBodies: preserveExistingDocumentBodies,
      }
    ),
    views: mergeByKey(prunedState.views, data.views, (value) => value.id),
    comments: normalizeComments(
      mergeByKey(prunedState.comments, data.comments, (value) => value.id)
    ),
    attachments: mergeByKey(
      prunedState.attachments,
      data.attachments,
      (value) => value.id
    ),
    notifications: normalizeNotifications(
      mergeByKey(prunedState.notifications, data.notifications, (value) => value.id)
    ),
    invites: mergeByKey(prunedState.invites, data.invites, (value) => value.id),
    projectUpdates: mergeByKey(
      prunedState.projectUpdates,
      data.projectUpdates,
      (value) => value.id
    ),
    conversations: mergeByKey(
      prunedState.conversations,
      data.conversations,
      (value) => value.id
    ),
    calls: mergeByKey(prunedState.calls, data.calls, (value) => value.id),
    chatMessages: normalizeChatMessages(
      mergeByKey(prunedState.chatMessages, data.chatMessages, (value) => value.id)
    ),
    channelPosts: normalizeChannelPosts(
      mergeByKey(prunedState.channelPosts, data.channelPosts, (value) => value.id)
    ),
    channelPostComments: normalizeChannelPostComments(
      mergeByKey(
        prunedState.channelPostComments,
        data.channelPostComments,
        (value) => value.id
      )
    ),
    ui: {
      ...prunedState.ui,
      activeTeamId: getNextActiveTeamId(
        teams,
        currentWorkspaceId,
        prunedState.ui.activeTeamId
      ),
    },
  }
}

export function createUiSlice(
  set: Parameters<AppStoreSlice<UiSlice>>[0]
): UiSlice & AppData {
  return {
    ...createEmptyState(),
    protectedDocumentIds: [],
    replaceDomainData(data) {
      set((state) => applyReplacedDomainData(state, data))
    },
    mergeReadModelData(data, options) {
      set((state) =>
        applyMergedReadModelData(state, data, options?.replace)
      )
    },
    setDocumentBodyProtection(documentId, protectedState) {
      set((state) => {
        const nextProtectedDocumentIds = protectedState
          ? state.protectedDocumentIds.includes(documentId)
            ? state.protectedDocumentIds
            : [...state.protectedDocumentIds, documentId]
          : state.protectedDocumentIds.filter((entry) => entry !== documentId)

        if (nextProtectedDocumentIds === state.protectedDocumentIds) {
          return state
        }

        return {
          protectedDocumentIds: nextProtectedDocumentIds,
        }
      })
    },
    setActiveTeam(teamId) {
      set((state) => ({
        ui: {
          ...state.ui,
          activeTeamId: teamId,
        },
      }))
    },
    openCreateDialog(dialog) {
      set((state) => ({
        ui: {
          ...state.ui,
          activeCreateDialog: dialog,
        },
      }))
    },
    closeCreateDialog() {
      set((state) => ({
        ui: {
          ...state.ui,
          activeCreateDialog: null,
        },
      }))
    },
    setSelectedView(route, viewId) {
      set((state) => ({
        ui: {
          ...state.ui,
          selectedViewByRoute: {
            ...state.ui.selectedViewByRoute,
            [route]: viewId,
          },
        },
      }))
    },
    setActiveInboxNotification(notificationId) {
      set((state) => ({
        ui: {
          ...state.ui,
          activeInboxNotificationId: notificationId,
        },
      }))
    },
  }
}

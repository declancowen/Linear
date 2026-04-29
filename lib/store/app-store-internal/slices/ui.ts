"use client"

import { createEmptyState } from "@/lib/domain/empty-state"
import type { AppData } from "@/lib/domain/types"
import { getViewerScopedDirectoryKey, getViewerScopedViewKey } from "@/lib/domain/viewer-view-config"
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
import type {
  AppStore,
  AppStoreSlice,
  PendingViewConfig,
  ViewFilterValueKey,
} from "../types"

type UiSlice = Pick<
  AppStore,
  | "protectedDocumentIds"
  | "pendingViewConfigById"
  | "setDocumentBodyProtection"
  | "replaceDomainData"
  | "mergeReadModelData"
  | "setActiveTeam"
  | "openCreateDialog"
  | "closeCreateDialog"
  | "setSelectedView"
  | "patchViewerViewConfig"
  | "toggleViewerViewFilterValue"
  | "clearViewerViewFilters"
  | "toggleViewerViewDisplayProperty"
  | "reorderViewerViewDisplayProperties"
  | "clearViewerViewDisplayProperties"
  | "toggleViewerViewHiddenValue"
  | "patchViewerDirectoryConfig"
  | "setActiveInboxNotification"
>

const FILTER_KEYS: ViewFilterValueKey[] = [
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
]

type RuntimeViewConfigPatch = PendingViewConfig["patch"] & {
  filters?: Partial<AppData["views"][number]["filters"]>
}

function getSelectedViewStorageKey(userId: string, route: string) {
  return getViewerScopedDirectoryKey(userId, route)
}

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
      content: currentDocument.content,
    }
  })
}

function applyPendingViewConfig(
  view: AppData["views"][number],
  patch: PendingViewConfig["patch"]
) {
  const { showCompleted, filters, ...viewPatch } =
    patch as RuntimeViewConfigPatch
  const hasFilterPatch = filters !== undefined || showCompleted !== undefined

  return {
    ...view,
    ...viewPatch,
    ...(hasFilterPatch
      ? {
          filters: {
            ...view.filters,
            ...filters,
            ...(showCompleted === undefined ? {} : { showCompleted }),
          },
        }
      : {}),
  }
}

function matchesPendingViewConfig(
  view: AppData["views"][number],
  patch: PendingViewConfig["patch"]
) {
  if (patch.layout !== undefined && view.layout !== patch.layout) {
    return false
  }

  if (patch.grouping !== undefined && view.grouping !== patch.grouping) {
    return false
  }

  if (
    patch.subGrouping !== undefined &&
    (view.subGrouping ?? null) !== patch.subGrouping
  ) {
    return false
  }

  if (patch.ordering !== undefined && view.ordering !== patch.ordering) {
    return false
  }

  if (patch.itemLevel !== undefined && view.itemLevel !== patch.itemLevel) {
    return false
  }

  if (
    patch.showChildItems !== undefined &&
    view.showChildItems !== patch.showChildItems
  ) {
    return false
  }

  if (
    patch.showCompleted !== undefined &&
    view.filters.showCompleted !== patch.showCompleted
  ) {
    return false
  }

  return true
}

function reconcilePendingViews(
  existing: AppData["views"],
  incoming: AppData["views"] | undefined,
  pendingViewConfigById: AppStore["pendingViewConfigById"],
  options?: {
    replace?: boolean
  }
) {
  if (!incoming) {
    return {
      pendingViewConfigById,
      views: existing,
    }
  }

  const baseViews = options?.replace
    ? incoming
    : mergeByKey(existing, incoming, (value) => value.id)

  if (Object.keys(pendingViewConfigById).length === 0) {
    return {
      pendingViewConfigById,
      views: baseViews,
    }
  }

  const nextPendingViewConfigById = { ...pendingViewConfigById }
  const views = baseViews.map((view) => {
    const pendingConfig = nextPendingViewConfigById[view.id]

    if (!pendingConfig) {
      return view
    }

    if (matchesPendingViewConfig(view, pendingConfig.patch)) {
      delete nextPendingViewConfigById[view.id]
      return view
    }

    return applyPendingViewConfig(view, pendingConfig.patch)
  })

  return {
    pendingViewConfigById: nextPendingViewConfigById,
    views,
  }
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
  const reconciledViews = reconcilePendingViews(
    state.views,
    data.views,
    state.pendingViewConfigById,
    {
      replace: true,
    }
  )

  return {
    ...state,
    ...data,
    protectedDocumentIds: state.protectedDocumentIds,
    pendingViewConfigById: reconciledViews.pendingViewConfigById,
    documents: mergeProtectedDocuments(
      state.documents,
      data.documents,
      state.protectedDocumentIds
    ),
    views: reconciledViews.views,
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
  const reconciledViews = reconcilePendingViews(
    prunedState.views,
    data.views,
    prunedState.pendingViewConfigById
  )

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
    pendingViewConfigById: reconciledViews.pendingViewConfigById,
    views: reconciledViews.views,
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
    pendingViewConfigById: {},
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
      set((state) => {
        const selectedViewByRoute = { ...state.ui.selectedViewByRoute }
        delete selectedViewByRoute[route]

        return {
          ui: {
            ...state.ui,
            selectedViewByRoute: {
              ...selectedViewByRoute,
              [getSelectedViewStorageKey(state.currentUserId, route)]: viewId,
            },
          },
        }
      })
    },
    patchViewerViewConfig(surfaceKey, viewId, patch) {
      set((state) => {
        const key = getViewerScopedViewKey(
          state.currentUserId,
          surfaceKey,
          viewId
        )
        const current = state.ui.viewerViewConfigByRoute[key] ?? {}
        const { showCompleted, filters, ...viewPatch } =
          patch as RuntimeViewConfigPatch
        const hasFilterPatch =
          filters !== undefined || showCompleted !== undefined

        return {
          ui: {
            ...state.ui,
            viewerViewConfigByRoute: {
              ...state.ui.viewerViewConfigByRoute,
              [key]: {
                ...current,
                ...viewPatch,
                ...(!hasFilterPatch
                  ? {}
                  : {
                      filters: {
                        ...current.filters,
                        ...filters,
                        ...(showCompleted === undefined
                          ? {}
                          : { showCompleted }),
                      },
                    }),
              },
            },
          },
        }
      })
    },
    toggleViewerViewFilterValue(surfaceKey, viewId, key, value) {
      set((state) => {
        const storageKey = getViewerScopedViewKey(
          state.currentUserId,
          surfaceKey,
          viewId
        )
        const current = state.ui.viewerViewConfigByRoute[storageKey] ?? {}
        const baseView = state.views.find((view) => view.id === viewId)
        const currentFilters = current.filters ?? {}
        const currentValues = (currentFilters[key] ??
          baseView?.filters[key] ??
          []) as string[]
        const nextValues = currentValues.includes(value)
          ? currentValues.filter((entry) => entry !== value)
          : [...currentValues, value]

        return {
          ui: {
            ...state.ui,
            viewerViewConfigByRoute: {
              ...state.ui.viewerViewConfigByRoute,
              [storageKey]: {
                ...current,
                filters: {
                  ...currentFilters,
                  [key]: nextValues,
                },
              },
            },
          },
        }
      })
    },
    clearViewerViewFilters(surfaceKey, viewId) {
      set((state) => {
        const storageKey = getViewerScopedViewKey(
          state.currentUserId,
          surfaceKey,
          viewId
        )
        const current = state.ui.viewerViewConfigByRoute[storageKey] ?? {}
        const filters = { ...(current.filters ?? {}) }

        for (const key of FILTER_KEYS) {
          filters[key] = [] as never
        }

        return {
          ui: {
            ...state.ui,
            viewerViewConfigByRoute: {
              ...state.ui.viewerViewConfigByRoute,
              [storageKey]: {
                ...current,
                filters,
              },
            },
          },
        }
      })
    },
    toggleViewerViewDisplayProperty(surfaceKey, viewId, property) {
      set((state) => {
        const storageKey = getViewerScopedViewKey(
          state.currentUserId,
          surfaceKey,
          viewId
        )
        const current = state.ui.viewerViewConfigByRoute[storageKey] ?? {}
        const baseView = state.views.find((view) => view.id === viewId)
        const displayProps = current.displayProps ?? baseView?.displayProps ?? []
        const nextDisplayProps = displayProps.includes(property)
          ? displayProps.filter((entry) => entry !== property)
          : [...displayProps, property]

        return {
          ui: {
            ...state.ui,
            viewerViewConfigByRoute: {
              ...state.ui.viewerViewConfigByRoute,
              [storageKey]: {
                ...current,
                displayProps: nextDisplayProps,
              },
            },
          },
        }
      })
    },
    reorderViewerViewDisplayProperties(surfaceKey, viewId, displayProps) {
      set((state) => {
        const storageKey = getViewerScopedViewKey(
          state.currentUserId,
          surfaceKey,
          viewId
        )
        const current = state.ui.viewerViewConfigByRoute[storageKey] ?? {}

        return {
          ui: {
            ...state.ui,
            viewerViewConfigByRoute: {
              ...state.ui.viewerViewConfigByRoute,
              [storageKey]: {
                ...current,
                displayProps: [...new Set(displayProps)],
              },
            },
          },
        }
      })
    },
    clearViewerViewDisplayProperties(surfaceKey, viewId) {
      set((state) => {
        const storageKey = getViewerScopedViewKey(
          state.currentUserId,
          surfaceKey,
          viewId
        )
        const current = state.ui.viewerViewConfigByRoute[storageKey] ?? {}

        return {
          ui: {
            ...state.ui,
            viewerViewConfigByRoute: {
              ...state.ui.viewerViewConfigByRoute,
              [storageKey]: {
                ...current,
                displayProps: [],
              },
            },
          },
        }
      })
    },
    toggleViewerViewHiddenValue(surfaceKey, viewId, key, value) {
      set((state) => {
        const storageKey = getViewerScopedViewKey(
          state.currentUserId,
          surfaceKey,
          viewId
        )
        const current = state.ui.viewerViewConfigByRoute[storageKey] ?? {}
        const baseView = state.views.find((view) => view.id === viewId)
        const currentHiddenState = current.hiddenState ??
          baseView?.hiddenState ?? { groups: [], subgroups: [] }
        const currentValues = currentHiddenState[key] ?? []
        const nextValues = currentValues.includes(value)
          ? currentValues.filter((entry) => entry !== value)
          : [...currentValues, value]

        return {
          ui: {
            ...state.ui,
            viewerViewConfigByRoute: {
              ...state.ui.viewerViewConfigByRoute,
              [storageKey]: {
                ...current,
                hiddenState: {
                  groups: [...currentHiddenState.groups],
                  subgroups: [...currentHiddenState.subgroups],
                  [key]: nextValues,
                },
              },
            },
          },
        }
      })
    },
    patchViewerDirectoryConfig(surfaceKey, patch) {
      set((state) => {
        const storageKey = getViewerScopedDirectoryKey(
          state.currentUserId,
          surfaceKey
        )
        const current = state.ui.viewerDirectoryConfigByRoute[storageKey] ?? {}

        return {
          ui: {
            ...state.ui,
            viewerDirectoryConfigByRoute: {
              ...state.ui.viewerDirectoryConfigByRoute,
              [storageKey]: {
                ...current,
                ...patch,
                filters: patch.filters
                  ? {
                      ...current.filters,
                      ...patch.filters,
                    }
                  : current.filters,
              },
            },
          },
        }
      })
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

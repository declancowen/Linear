"use client"

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  normalizeHiddenState,
  type AppData,
  type ViewerViewConfigOverride,
} from "@/lib/domain/types"
import {
  getViewerScopedDirectoryKey,
  getViewerScopedViewKey,
} from "@/lib/domain/viewer-view-config"
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
  getNextActiveTeamId,
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
  | "pendingDocumentContentSyncs"
  | "pendingWorkItemSyncsById"
  | "pendingCommentSyncsById"
  | "pendingChatMessageSyncsById"
  | "pendingChannelPostCommentSyncsById"
  | "pendingViewConfigById"
  | "setDocumentBodyProtection"
  | "replaceDomainData"
  | "mergeReadModelData"
  | "setActiveTeam"
  | "openCreateDialog"
  | "closeCreateDialog"
  | "setSelectedView"
  | "patchViewerViewConfig"
  | "resetViewerViewConfig"
  | "toggleViewerViewFilterValue"
  | "clearViewerViewFilters"
  | "toggleViewerViewDisplayProperty"
  | "reorderViewerViewDisplayProperties"
  | "clearViewerViewDisplayProperties"
  | "toggleViewerViewHiddenValue"
  | "patchViewerDirectoryConfig"
  | "setCollaborationSidebarOpen"
  | "setActiveInboxNotification"
>

const FILTER_KEYS: ViewFilterValueKey[] = [
  "status",
  "priority",
  "assigneeIds",
  "creatorIds",
  "subscriberIds",
  "updatedByIds",
  "documentKinds",
  "linkedWorkItemIds",
  "leadIds",
  "health",
  "milestoneIds",
  "relationTypes",
  "projectIds",
  "parentIds",
  "itemTypes",
  "labelIds",
  "teamIds",
  "visibility",
]

type RuntimeViewConfigPatch = PendingViewConfig["patch"] & {
  filters?: Partial<AppData["views"][number]["filters"]>
}

function patchViewerViewConfigByRoute(
  state: AppStore,
  storageKey: string,
  patch: (current: ViewerViewConfigOverride) => ViewerViewConfigOverride
) {
  const current = state.ui.viewerViewConfigByRoute[storageKey] ?? {}

  return {
    ui: {
      ...state.ui,
      viewerViewConfigByRoute: {
        ...state.ui.viewerViewConfigByRoute,
        [storageKey]: patch(current),
      },
    },
  }
}

function getViewerViewConfigContext(
  state: AppStore,
  surfaceKey: string,
  viewId: string
) {
  const storageKey = getViewerScopedViewKey(
    state.currentUserId,
    surfaceKey,
    viewId
  )

  return {
    baseView: state.views.find((view) => view.id === viewId),
    current: state.ui.viewerViewConfigByRoute[storageKey] ?? {},
    storageKey,
  }
}

function getSelectedViewStorageKey(userId: string, route: string) {
  return getViewerScopedDirectoryKey(userId, route)
}

function getCollaborationSidebarStorageKey(userId: string, surfaceKey: string) {
  return getViewerScopedDirectoryKey(userId, surfaceKey)
}

function mergeByKey<T>(
  existing: T[],
  incoming: T[] | undefined,
  getKey: (value: T) => string,
  options?: {
    preserveExistingKeys?: ReadonlySet<string>
  }
) {
  if (!incoming) {
    return existing
  }

  const entries = new Map(existing.map((value) => [getKey(value), value]))

  for (const value of incoming) {
    const key = getKey(value)

    if (options?.preserveExistingKeys?.has(key) && entries.has(key)) {
      continue
    }

    entries.set(key, value)
  }

  return [...entries.values()]
}

function replaceByKeyPreservingExisting<T>(
  existing: T[],
  incoming: T[] | undefined,
  getKey: (value: T) => string,
  preserveExistingKeys: ReadonlySet<string>
) {
  if (!incoming) {
    return existing
  }

  const entries = new Map(incoming.map((value) => [getKey(value), value]))

  if (preserveExistingKeys.size === 0) {
    return [...entries.values()]
  }

  for (const value of existing) {
    const key = getKey(value)

    if (preserveExistingKeys.has(key)) {
      entries.set(key, value)
    }
  }

  return [...entries.values()]
}

function mergeChatReadStates(
  existing: AppData["chatReadStates"],
  incoming: AppData["chatReadStates"] | undefined
) {
  if (!incoming) {
    return existing
  }

  const entries = new Map(existing.map((value) => [value.id, value]))

  for (const value of incoming) {
    const current = entries.get(value.id)

    entries.set(
      value.id,
      current && value.messageReadAtById === undefined
        ? {
            ...value,
            messageReadAtById: current.messageReadAtById,
          }
        : value
    )
  }

  return [...entries.values()]
}

function preserveLocalNotificationReadState(
  existing: AppData["notifications"],
  incoming: AppData["notifications"]
) {
  const existingById = new Map(existing.map((entry) => [entry.id, entry]))

  return incoming.map((notification) => {
    const current = existingById.get(notification.id)

    return current?.readAt && !notification.readAt
      ? {
          ...notification,
          readAt: current.readAt,
        }
      : notification
  })
}

function mergeProtectedDocuments(
  existing: AppData["documents"],
  incoming: AppData["documents"] | undefined,
  protectedDocumentIds: string[] = [],
  pendingDocumentContentSyncs: Record<string, string> = {},
  options?: {
    preserveExistingBodies?: boolean
  }
) {
  if (!incoming) {
    return existing
  }

  const protectedIds = new Set([
    ...protectedDocumentIds,
    ...Object.keys(pendingDocumentContentSyncs),
  ])

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
  const { showCompleted, showEmptyGroups, filters, ...viewPatch } =
    patch as RuntimeViewConfigPatch
  const hasFilterPatch =
    filters !== undefined ||
    showCompleted !== undefined ||
    showEmptyGroups !== undefined

  return {
    ...view,
    ...viewPatch,
    ...(hasFilterPatch
      ? {
          filters: {
            ...view.filters,
            ...filters,
            ...(showCompleted === undefined ? {} : { showCompleted }),
            ...(showEmptyGroups === undefined ? {} : { showEmptyGroups }),
          },
        }
      : {}),
  }
}

function matchesPendingViewConfig(
  view: AppData["views"][number],
  patch: PendingViewConfig["patch"]
) {
  return [
    patch.layout === undefined || view.layout === patch.layout,
    patch.grouping === undefined || view.grouping === patch.grouping,
    patch.subGrouping === undefined ||
      (view.subGrouping ?? null) === patch.subGrouping,
    patch.ordering === undefined || view.ordering === patch.ordering,
    patch.itemLevel === undefined || view.itemLevel === patch.itemLevel,
    patch.showChildItems === undefined ||
      view.showChildItems === patch.showChildItems,
    patch.showCompleted === undefined ||
      view.filters.showCompleted === patch.showCompleted,
    patch.showEmptyGroups === undefined ||
      (view.filters.showEmptyGroups ?? true) === patch.showEmptyGroups,
  ].every(Boolean)
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

function getWorkspaceMembershipKey(
  value: AppData["workspaceMemberships"][number]
) {
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
  | "workItemActivities"
  | "customPropertyDefinitions"
  | "customPropertyValues"
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
  | "chatReadStates"
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
      instruction.kind === "workspace-people" ||
      instruction.kind === "search-seed"
  )
}

function shouldApplyIncomingCurrentWorkspaceId(
  replaceInstructions?: ScopedReadModelReplaceInstruction[]
) {
  return (
    !replaceInstructions ||
    replaceInstructions.some(
      (instruction) => instruction.kind === "workspace-membership"
    )
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
  | AppData["workItemActivities"][number]
  | AppData["customPropertyDefinitions"][number]
  | AppData["customPropertyValues"][number]
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
  | AppData["chatReadStates"][number]
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
  workItemActivities: (value: AppData["workItemActivities"][number]) =>
    value.id,
  customPropertyDefinitions: (
    value: AppData["customPropertyDefinitions"][number]
  ) => value.id,
  customPropertyValues: (value: AppData["customPropertyValues"][number]) =>
    value.id,
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
  chatReadStates: (value: AppData["chatReadStates"][number]) => value.id,
  channelPosts: (value: AppData["channelPosts"][number]) => value.id,
  channelPostComments: (value: AppData["channelPostComments"][number]) =>
    value.id,
}

function pruneScopedDomain(
  currentDomain: ArrayDomainEntry[],
  scopedDomain: ArrayDomainEntry[] | undefined,
  incomingDomain: ArrayDomainEntry[] | undefined,
  keyResolver: (value: ArrayDomainEntry) => string,
  protectedKeys: ReadonlySet<string> = new Set()
) {
  if (!scopedDomain || !incomingDomain) {
    return currentDomain
  }

  const scopedKeys = new Set(scopedDomain.map((value) => keyResolver(value)))

  if (scopedKeys.size === 0) {
    return currentDomain
  }

  const incomingKeys = new Set(
    incomingDomain.map((value) => keyResolver(value))
  )

  return currentDomain.filter((value) => {
    const key = keyResolver(value)

    return (
      protectedKeys.has(key) || !scopedKeys.has(key) || incomingKeys.has(key)
    )
  })
}

function getScopedPruningProtectedKeys(
  state: AppStore,
  domainKey: ArrayDomainKey
) {
  if (domainKey === "workItems") {
    return new Set(Object.keys(state.pendingWorkItemSyncsById ?? {}))
  }

  if (domainKey === "comments") {
    return new Set(Object.keys(state.pendingCommentSyncsById ?? {}))
  }

  if (domainKey === "chatMessages") {
    return new Set(Object.keys(state.pendingChatMessageSyncsById ?? {}))
  }

  if (domainKey === "channelPostComments") {
    return new Set(
      Object.keys(state.pendingChannelPostCommentSyncsById ?? {})
    )
  }

  return undefined
}

function shouldSkipScopedPruningDomain(
  instruction: ScopedReadModelReplaceInstruction,
  domainKey: ArrayDomainKey
) {
  return instruction.kind === "conversation-list" && domainKey === "chatMessages"
}

function pruneScopedReadModelDomain(
  state: AppStore,
  data: Partial<AppData>,
  scopedSelection: ScopedReadModelPatch,
  domainKey: ArrayDomainKey
) {
  const incomingDomain = data[domainKey]
  const scopedDomain = scopedSelection[domainKey]

  if (!Array.isArray(incomingDomain) || !Array.isArray(scopedDomain)) {
    return state
  }

  const keyResolver = domainKeyResolvers[domainKey]

  return {
    ...state,
    [domainKey]: pruneScopedDomain(
      state[domainKey] as ArrayDomainEntry[],
      scopedDomain as ArrayDomainEntry[],
      incomingDomain as ArrayDomainEntry[],
      keyResolver as (value: ArrayDomainEntry) => string,
      getScopedPruningProtectedKeys(state, domainKey)
    ) as AppData[typeof domainKey],
  }
}

function applyScopedReadModelInstructionPruning(
  state: AppStore,
  data: Partial<AppData>,
  instruction: ScopedReadModelReplaceInstruction
) {
  const scopedSelection = selectReadModelForInstruction(
    state,
    instruction
  ) as ScopedReadModelPatch | null

  if (!scopedSelection) {
    return state
  }

  return (Object.keys(domainKeyResolvers) as ArrayDomainKey[]).reduce(
    (nextState, domainKey) =>
      shouldSkipScopedPruningDomain(instruction, domainKey)
        ? nextState
        : pruneScopedReadModelDomain(
            nextState,
            data,
            scopedSelection,
            domainKey
          ),
    state
  )
}

function applyScopedReadModelPruning(
  state: AppStore,
  data: Partial<AppData>,
  replaceInstructions: ScopedReadModelReplaceInstruction[] | undefined
) {
  if (!replaceInstructions || replaceInstructions.length === 0) {
    return state
  }

  return replaceInstructions.reduce(
    (nextState, instruction) =>
      applyScopedReadModelInstructionPruning(nextState, data, instruction),
    state
  )
}

function getPendingDomainIds(state: AppStore) {
  return {
    channelPostCommentIds: new Set(
      Object.keys(state.pendingChannelPostCommentSyncsById ?? {})
    ),
    chatMessageIds: new Set(Object.keys(state.pendingChatMessageSyncsById ?? {})),
    commentIds: new Set(Object.keys(state.pendingCommentSyncsById ?? {})),
    workItemIds: new Set(Object.keys(state.pendingWorkItemSyncsById ?? {})),
  }
}

function buildReplacedDomainPatch(
  state: AppStore,
  data: Partial<AppData>,
  input: {
    pendingIds: ReturnType<typeof getPendingDomainIds>
    reconciledViews: ReturnType<typeof reconcilePendingViews>
  }
) {
  return {
    ...data,
    channelPostComments: normalizeChannelPostComments(
      replaceByKeyPreservingExisting(
        state.channelPostComments,
        data.channelPostComments,
        (value) => value.id,
        input.pendingIds.channelPostCommentIds
      )
    ),
    chatMessages: normalizeChatMessages(
      replaceByKeyPreservingExisting(
        state.chatMessages,
        data.chatMessages,
        (value) => value.id,
        input.pendingIds.chatMessageIds
      )
    ),
    chatReadStates: data.chatReadStates ?? state.chatReadStates,
    comments: normalizeComments(
      replaceByKeyPreservingExisting(
        state.comments,
        data.comments,
        (value) => value.id,
        input.pendingIds.commentIds
      )
    ),
    documents: mergeProtectedDocuments(
      state.documents,
      data.documents,
      state.protectedDocumentIds,
      state.pendingDocumentContentSyncs ?? {}
    ),
    notifications: normalizeNotifications(
      data.notifications
        ? preserveLocalNotificationReadState(state.notifications, data.notifications)
        : state.notifications
    ),
    users: normalizeUsers(data.users ?? state.users),
    views: input.reconciledViews.views,
    workItems: replaceByKeyPreservingExisting(
      state.workItems,
      data.workItems,
      (value) => value.id,
      input.pendingIds.workItemIds
    ),
  }
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
    ...buildReplacedDomainPatch(state, data, {
      pendingIds: getPendingDomainIds(state),
      reconciledViews,
    }),
    protectedDocumentIds: state.protectedDocumentIds,
    pendingDocumentContentSyncs: state.pendingDocumentContentSyncs ?? {},
    pendingWorkItemSyncsById: state.pendingWorkItemSyncsById ?? {},
    pendingCommentSyncsById: state.pendingCommentSyncsById ?? {},
    pendingChatMessageSyncsById: state.pendingChatMessageSyncsById ?? {},
    pendingChannelPostCommentSyncsById:
      state.pendingChannelPostCommentSyncsById ?? {},
    pendingViewConfigById: reconciledViews.pendingViewConfigById,
    channelPosts: normalizeChannelPosts(
      data.channelPosts ?? state.channelPosts
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
  const pendingWorkItemIds = new Set(
    Object.keys(prunedState.pendingWorkItemSyncsById ?? {})
  )
  const pendingCommentIds = new Set(
    Object.keys(prunedState.pendingCommentSyncsById ?? {})
  )
  const pendingChatMessageIds = new Set(
    Object.keys(prunedState.pendingChatMessageSyncsById ?? {})
  )
  const pendingChannelPostCommentIds = new Set(
    Object.keys(prunedState.pendingChannelPostCommentSyncsById ?? {})
  )
  const currentWorkspaceId = shouldApplyIncomingCurrentWorkspaceId(
    replaceInstructions
  )
    ? (data.currentWorkspaceId ?? state.currentWorkspaceId)
    : state.currentWorkspaceId
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
    workspaces: mergeByKey(
      prunedState.workspaces,
      data.workspaces,
      (value) => value.id
    ),
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
    users: normalizeUsers(
      mergeByKey(prunedState.users, data.users, (value) => value.id)
    ),
    labels: mergeByKey(prunedState.labels, data.labels, (value) => value.id),
    projects: mergeByKey(
      prunedState.projects,
      data.projects,
      (value) => value.id
    ),
    milestones: mergeByKey(
      prunedState.milestones,
      data.milestones,
      (value) => value.id
    ),
    workItems: mergeByKey(
      prunedState.workItems,
      data.workItems,
      (value) => value.id,
      { preserveExistingKeys: pendingWorkItemIds }
    ),
    workItemActivities: mergeByKey(
      prunedState.workItemActivities,
      data.workItemActivities,
      (value) => value.id
    ),
    documents: mergeProtectedDocuments(
      prunedState.documents,
      data.documents,
      prunedState.protectedDocumentIds,
      prunedState.pendingDocumentContentSyncs ?? {},
      {
        preserveExistingBodies: preserveExistingDocumentBodies,
      }
    ),
    pendingDocumentContentSyncs: prunedState.pendingDocumentContentSyncs ?? {},
    pendingWorkItemSyncsById: prunedState.pendingWorkItemSyncsById ?? {},
    pendingCommentSyncsById: prunedState.pendingCommentSyncsById ?? {},
    pendingChatMessageSyncsById:
      prunedState.pendingChatMessageSyncsById ?? {},
    pendingChannelPostCommentSyncsById:
      prunedState.pendingChannelPostCommentSyncsById ?? {},
    pendingViewConfigById: reconciledViews.pendingViewConfigById,
    views: reconciledViews.views,
    comments: normalizeComments(
      mergeByKey(prunedState.comments, data.comments, (value) => value.id, {
        preserveExistingKeys: pendingCommentIds,
      })
    ),
    attachments: mergeByKey(
      prunedState.attachments,
      data.attachments,
      (value) => value.id
    ),
    notifications: normalizeNotifications(
      data.notifications
        ? preserveLocalNotificationReadState(
            prunedState.notifications,
            mergeByKey(
              prunedState.notifications,
              data.notifications,
              (value) => value.id
            )
          )
        : prunedState.notifications
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
      mergeByKey(
        prunedState.chatMessages,
        data.chatMessages,
        (value) => value.id,
        { preserveExistingKeys: pendingChatMessageIds }
      )
    ),
    chatReadStates: mergeChatReadStates(
      prunedState.chatReadStates,
      data.chatReadStates
    ),
    channelPosts: normalizeChannelPosts(
      mergeByKey(
        prunedState.channelPosts,
        data.channelPosts,
        (value) => value.id
      )
    ),
    channelPostComments: normalizeChannelPostComments(
      mergeByKey(
        prunedState.channelPostComments,
        data.channelPostComments,
        (value) => value.id,
        { preserveExistingKeys: pendingChannelPostCommentIds }
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
    pendingDocumentContentSyncs: {},
    pendingWorkItemSyncsById: {},
    pendingCommentSyncsById: {},
    pendingChatMessageSyncsById: {},
    pendingChannelPostCommentSyncsById: {},
    pendingViewConfigById: {},
    replaceDomainData(data) {
      set((state) => applyReplacedDomainData(state, data))
    },
    mergeReadModelData(data, options) {
      set((state) => applyMergedReadModelData(state, data, options?.replace))
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
        const { showCompleted, showEmptyGroups, filters, ...viewPatch } =
          patch as RuntimeViewConfigPatch
        const hasFilterPatch =
          filters !== undefined ||
          showCompleted !== undefined ||
          showEmptyGroups !== undefined

        return patchViewerViewConfigByRoute(state, key, () => ({
          ...current,
          ...viewPatch,
          ...(!hasFilterPatch
            ? {}
            : {
                filters: {
                  ...current.filters,
                  ...filters,
                  ...(showCompleted === undefined ? {} : { showCompleted }),
                  ...(showEmptyGroups === undefined ? {} : { showEmptyGroups }),
                },
              }),
        }))
      })
    },
    resetViewerViewConfig(surfaceKey, viewId) {
      set((state) => {
        const storageKey = getViewerScopedViewKey(
          state.currentUserId,
          surfaceKey,
          viewId
        )

        if (!(storageKey in state.ui.viewerViewConfigByRoute)) {
          return state
        }

        const viewerViewConfigByRoute = {
          ...state.ui.viewerViewConfigByRoute,
        }
        delete viewerViewConfigByRoute[storageKey]

        return {
          ui: {
            ...state.ui,
            viewerViewConfigByRoute,
          },
        }
      })
    },
    toggleViewerViewFilterValue(surfaceKey, viewId, key, value) {
      set((state) => {
        const { baseView, current, storageKey } = getViewerViewConfigContext(
          state,
          surfaceKey,
          viewId
        )
        const currentFilters = current.filters ?? {}
        const currentValues = (currentFilters[key] ??
          baseView?.filters[key] ??
          []) as string[]
        const nextValues = currentValues.includes(value)
          ? currentValues.filter((entry) => entry !== value)
          : [...currentValues, value]

        return patchViewerViewConfigByRoute(state, storageKey, () => ({
          ...current,
          filters: {
            ...currentFilters,
            [key]: nextValues,
          },
        }))
      })
    },
    clearViewerViewFilters(surfaceKey, viewId) {
      set((state) => {
        const { current, storageKey } = getViewerViewConfigContext(
          state,
          surfaceKey,
          viewId
        )
        const filters = { ...(current.filters ?? {}) }

        for (const key of FILTER_KEYS) {
          filters[key] = [] as never
        }

        filters.showEmptyGroups = true

        return patchViewerViewConfigByRoute(state, storageKey, () => ({
          ...current,
          filters,
        }))
      })
    },
    toggleViewerViewDisplayProperty(surfaceKey, viewId, property) {
      set((state) => {
        const { baseView, current, storageKey } = getViewerViewConfigContext(
          state,
          surfaceKey,
          viewId
        )
        const displayProps =
          current.displayProps ?? baseView?.displayProps ?? []
        const nextDisplayProps = displayProps.includes(property)
          ? displayProps.filter((entry) => entry !== property)
          : [...displayProps, property]

        return patchViewerViewConfigByRoute(state, storageKey, () => ({
          ...current,
          displayProps: nextDisplayProps,
        }))
      })
    },
    reorderViewerViewDisplayProperties(surfaceKey, viewId, displayProps) {
      set((state) => {
        const { current, storageKey } = getViewerViewConfigContext(
          state,
          surfaceKey,
          viewId
        )

        return patchViewerViewConfigByRoute(state, storageKey, () => ({
          ...current,
          displayProps: [...new Set(displayProps)],
        }))
      })
    },
    clearViewerViewDisplayProperties(surfaceKey, viewId) {
      set((state) => {
        const { current, storageKey } = getViewerViewConfigContext(
          state,
          surfaceKey,
          viewId
        )

        return patchViewerViewConfigByRoute(state, storageKey, () => ({
          ...current,
          displayProps: [],
        }))
      })
    },
    toggleViewerViewHiddenValue(surfaceKey, viewId, key, value) {
      set((state) => {
        const { baseView, current, storageKey } = getViewerViewConfigContext(
          state,
          surfaceKey,
          viewId
        )
        const currentHiddenState = normalizeHiddenState(
          current.hiddenState ?? baseView?.hiddenState
        )
        const currentValues = currentHiddenState[key] ?? []
        const nextValues = currentValues.includes(value)
          ? currentValues.filter((entry) => entry !== value)
          : [...currentValues, value]
        const nextHiddenState = normalizeHiddenState({
          ...currentHiddenState,
          [key]: nextValues,
        })

        return patchViewerViewConfigByRoute(state, storageKey, () => ({
          ...current,
          hiddenState: nextHiddenState,
        }))
      })
    },
    patchViewerDirectoryConfig(surfaceKey, patch) {
      set((state) => {
        const storageKey = getViewerScopedDirectoryKey(
          state.currentUserId,
          surfaceKey
        )
        const current = state.ui.viewerDirectoryConfigByRoute[storageKey] ?? {}
        const nextConfig = {
          ...current,
          ...patch,
        }

        if (patch.filters) {
          nextConfig.filters = {
            ...current.filters,
            ...patch.filters,
          }
        } else if (!current.filters) {
          delete nextConfig.filters
        }

        return {
          ui: {
            ...state.ui,
            viewerDirectoryConfigByRoute: {
              ...state.ui.viewerDirectoryConfigByRoute,
              [storageKey]: nextConfig,
            },
          },
        }
      })
    },
    setCollaborationSidebarOpen(surfaceKey, open) {
      set((state) => ({
        ui: {
          ...state.ui,
          collaborationSidebarOpenBySurface: {
            ...state.ui.collaborationSidebarOpenBySurface,
            [getCollaborationSidebarStorageKey(
              state.currentUserId,
              surfaceKey
            )]: open,
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

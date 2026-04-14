import { isAfter } from "date-fns"

import type {
  AppData,
  Conversation,
  DisplayProperty,
  Document,
  GroupField,
  OrderingField,
  Priority,
  Project,
  Team,
  TeamFeatureSettings,
  TeamWorkflowSettings,
  UserProfile,
  ViewDefinition,
  WorkItem,
  WorkStatus,
} from "@/lib/domain/types"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  getDisplayLabelForWorkItemType,
  normalizeTeamFeatureSettings,
  priorityMeta,
  statusMeta,
  templateMeta,
  workStatuses,
} from "@/lib/domain/types"
import { sortViewsForDisplay } from "@/lib/domain/default-views"

export function getCurrentUser(data: AppData) {
  return (
    data.users.find((user) => user.id === data.currentUserId) ?? data.users[0]
  )
}

export function getCurrentWorkspace(data: AppData) {
  return data.workspaces.find(
    (workspace) => workspace.id === data.currentWorkspaceId
  )
}

export function getAccessibleTeams(data: AppData) {
  const membershipTeamIds = new Set(
    data.teamMemberships
      .filter((membership) => membership.userId === data.currentUserId)
      .map((membership) => membership.teamId)
  )

  return data.teams.filter((team) => membershipTeamIds.has(team.id))
}

export function getTeamBySlug(data: AppData, teamSlug: string) {
  return data.teams.find((team) => team.slug === teamSlug) ?? null
}

export function getTeamRole(data: AppData, teamId: string) {
  if (data.ui.rolePreview) {
    return data.ui.rolePreview
  }

  return (
    data.teamMemberships.find(
      (membership) =>
        membership.teamId === teamId && membership.userId === data.currentUserId
    )?.role ?? null
  )
}

export function canEditTeam(data: AppData, teamId: string) {
  const role = getTeamRole(data, teamId)
  return role === "admin" || role === "member"
}

export function canInviteToTeam(data: AppData, teamId: string) {
  return canEditTeam(data, teamId)
}

export function canAdminTeam(data: AppData, teamId: string) {
  return getTeamRole(data, teamId) === "admin"
}

export function canCreateWorkspace(data: AppData) {
  return getAccessibleTeams(data).some(
    (team) => getTeamRole(data, team.id) === "admin"
  )
}

export function getProject(data: AppData, projectId: string | null) {
  if (!projectId) {
    return null
  }

  return data.projects.find((project) => project.id === projectId) ?? null
}

export function getDocument(data: AppData, documentId: string) {
  return data.documents.find((document) => document.id === documentId) ?? null
}

export function getWorkItem(data: AppData, itemId: string) {
  return data.workItems.find((item) => item.id === itemId) ?? null
}

export function getWorkItemDescendantIds(data: AppData, itemId: string) {
  const descendants = new Set<string>()
  const queue = [itemId]

  while (queue.length > 0) {
    const currentId = queue.shift()

    if (!currentId) {
      continue
    }

    data.workItems.forEach((item) => {
      if (item.parentId !== currentId || descendants.has(item.id)) {
        return
      }

      descendants.add(item.id)
      queue.push(item.id)
    })
  }

  return descendants
}

export function getTeam(data: AppData, teamId: string) {
  return data.teams.find((team) => team.id === teamId) ?? null
}

export function getTeamFeatureSettings(
  team: Team | null | undefined
): TeamFeatureSettings {
  return normalizeTeamFeatureSettings(
    team?.settings.experience ?? "software-development",
    team?.settings.features ?? createDefaultTeamFeatureSettings()
  )
}

export function teamHasFeature(
  team: Team | null | undefined,
  feature: keyof TeamFeatureSettings
) {
  return getTeamFeatureSettings(team)[feature]
}

export function getTeamMembers(data: AppData, teamId: string) {
  const memberIds = new Set(
    data.teamMemberships
      .filter((membership) => membership.teamId === teamId)
      .map((membership) => membership.userId)
  )

  return data.users.filter((user) => memberIds.has(user.id))
}

export function getWorkspaceUsers(data: AppData, workspaceId: string) {
  const teamIds = data.teams
    .filter((team) => team.workspaceId === workspaceId)
    .map((team) => team.id)
  const userIds = new Set(
    data.teamMemberships
      .filter((membership) => teamIds.includes(membership.teamId))
      .map((membership) => membership.userId)
  )

  return data.users.filter((user) => userIds.has(user.id))
}

export function getConversationParticipants(
  data: AppData,
  conversation: Conversation | null | undefined
) {
  if (!conversation) {
    return []
  }

  if (conversation.scopeType === "team") {
    return getTeamMembers(data, conversation.scopeId)
  }

  if (conversation.kind === "channel") {
    return getWorkspaceUsers(data, conversation.scopeId)
  }

  return conversation.participantIds
    .map((userId) => getUser(data, userId))
    .filter((user): user is UserProfile => Boolean(user))
}

export function getTeamWorkflowSettings(
  team: Team | null | undefined
): TeamWorkflowSettings {
  return (
    team?.settings.workflow ??
    createDefaultTeamWorkflowSettings(
      team?.settings.experience ?? "software-development"
    )
  )
}

export function getStatusOrderForTeam(
  team: Team | null | undefined
): WorkStatus[] {
  return [...getTeamWorkflowSettings(team).statusOrder]
}

export function getTemplateDefaultsForTeam(
  team: Team | null | undefined,
  templateType: Project["templateType"]
) {
  return getTeamWorkflowSettings(team).templateDefaults[templateType]
}

export function getUser(data: AppData, userId: string | null) {
  if (!userId) {
    return null
  }

  return data.users.find((user) => user.id === userId) ?? null
}

export function getLabelMap(data: AppData) {
  return Object.fromEntries(data.labels.map((label) => [label.id, label]))
}

export function getProjectsForScope(
  data: AppData,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  if (scopeType === "team") {
    return data.projects.filter(
      (project) =>
        (project.scopeType === "team" && project.scopeId === scopeId) ||
        (project.scopeType === "workspace" &&
          getAccessibleTeams(data).some(
            (team) => team.workspaceId === project.scopeId
          ))
    )
  }

  const accessibleTeams = getAccessibleTeams(data).map((team) => team.id)

  return data.projects.filter((project) => {
    if (project.scopeType === "workspace") {
      return project.scopeId === scopeId
    }

    return accessibleTeams.includes(project.scopeId)
  })
}

export function getWorkspacePersonalViews(
  data: AppData,
  entityKind?: "items" | "projects" | "docs"
) {
  return sortViewsForDisplay(
    data.views.filter(
      (view) =>
        view.scopeType === "personal" &&
        view.scopeId === data.currentUserId &&
        view.route.startsWith("/workspace/") &&
        (entityKind ? view.entityKind === entityKind : true)
    )
  )
}

export function getDocumentsForScope(
  data: AppData,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  const visibleTeamIds =
    scopeType === "team"
      ? [scopeId]
      : getAccessibleTeams(data)
          .filter((team) => team.workspaceId === scopeId)
          .map((team) => team.id)

  return data.documents.filter(
    (document) =>
      document.kind === "team-document" &&
      document.teamId !== null &&
      visibleTeamIds.includes(document.teamId)
  )
}

export function getTeamDocuments(data: AppData, teamId: string) {
  return data.documents.filter(
    (document) =>
      document.kind === "team-document" && document.teamId === teamId
  )
}

export function getWorkspaceDocuments(data: AppData, workspaceId: string) {
  return data.documents.filter(
    (document) =>
      document.kind === "workspace-document" &&
      document.workspaceId === workspaceId
  )
}

export function getPrivateDocuments(data: AppData, workspaceId: string) {
  return data.documents.filter(
    (document) =>
      document.kind === "private-document" &&
      document.workspaceId === workspaceId &&
      document.createdBy === data.currentUserId
  )
}

export function getSearchableDocuments(data: AppData, workspaceId: string) {
  return [
    ...getDocumentsForScope(data, "workspace", workspaceId),
    ...getWorkspaceDocuments(data, workspaceId),
    ...getPrivateDocuments(data, workspaceId),
  ]
}

export function getDocumentContextLabel(data: AppData, document: Document) {
  if (document.kind === "workspace-document") {
    return "Workspace"
  }

  if (document.kind === "private-document") {
    return "Private"
  }

  return getTeam(data, document.teamId ?? "")?.name ?? "Team"
}

export function getViewsForScope(
  data: AppData,
  scopeType: "personal" | "team" | "workspace",
  scopeId: string,
  entityKind: "items" | "projects" | "docs"
) {
  if (scopeType === "workspace") {
    return getWorkspacePersonalViews(data, entityKind)
  }

  return sortViewsForDisplay(
    data.views.filter(
      (view) =>
        view.scopeType === scopeType &&
        view.scopeId === scopeId &&
        view.entityKind === entityKind
    )
  )
}

export function getCommentsForTarget(
  data: AppData,
  targetType: "workItem" | "document",
  targetId: string
) {
  return data.comments
    .filter(
      (comment) =>
        comment.targetType === targetType && comment.targetId === targetId
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export function getWorkspaceChats(data: AppData, workspaceId: string) {
  return data.conversations
    .filter(
      (conversation) =>
        conversation.kind === "chat" &&
        conversation.scopeType === "workspace" &&
        conversation.scopeId === workspaceId &&
        conversation.participantIds.includes(data.currentUserId)
    )
    .sort((left, right) =>
      right.lastActivityAt.localeCompare(left.lastActivityAt)
    )
}

export function getWorkspaceChannels(data: AppData, workspaceId: string) {
  return data.conversations
    .filter(
      (conversation) =>
        conversation.kind === "channel" &&
        conversation.scopeType === "workspace" &&
        conversation.scopeId === workspaceId
    )
    .sort((left, right) =>
      right.lastActivityAt.localeCompare(left.lastActivityAt)
    )
}

export function getPrimaryWorkspaceChannel(data: AppData, workspaceId: string) {
  return getWorkspaceChannels(data, workspaceId)[0] ?? null
}

export function getTeamChatConversation(data: AppData, teamId: string) {
  return (
    data.conversations.find(
      (conversation) =>
        conversation.kind === "chat" &&
        conversation.scopeType === "team" &&
        conversation.scopeId === teamId &&
        conversation.variant === "team"
    ) ?? null
  )
}

export function getTeamChannels(data: AppData, teamId: string) {
  return data.conversations
    .filter(
      (conversation) =>
        conversation.kind === "channel" &&
        conversation.scopeType === "team" &&
        conversation.scopeId === teamId
    )
    .sort((left, right) =>
      right.lastActivityAt.localeCompare(left.lastActivityAt)
    )
}

export function getPrimaryTeamChannel(data: AppData, teamId: string) {
  return getTeamChannels(data, teamId)[0] ?? null
}

export function getTeamSurfaceDisableReason(
  data: AppData,
  teamId: string,
  feature: "docs" | "chat" | "channels"
) {
  if (feature === "docs") {
    return getTeamDocuments(data, teamId).length > 0
      ? "Docs cannot be turned off while this team still has documents."
      : null
  }

  if (feature === "chat") {
    const conversation = getTeamChatConversation(data, teamId)

    if (!conversation) {
      return null
    }

    return getChatMessages(data, conversation.id).length > 0
      ? "Chat cannot be turned off while the team chat has messages."
      : null
  }

  const channelIds = new Set(
    getTeamChannels(data, teamId).map((channel) => channel.id)
  )

  if (channelIds.size === 0) {
    return null
  }

  return data.channelPosts.some((post) => channelIds.has(post.conversationId))
    ? "Channel cannot be turned off while posts exist."
    : null
}

export function getTeamSurfaceDisableReasons(data: AppData, teamId: string) {
  return {
    docs: getTeamSurfaceDisableReason(data, teamId, "docs"),
    chat: getTeamSurfaceDisableReason(data, teamId, "chat"),
    channels: getTeamSurfaceDisableReason(data, teamId, "channels"),
  }
}

export function getChatMessages(data: AppData, conversationId: string) {
  return data.chatMessages
    .filter((message) => message.conversationId === conversationId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export function getChannelPosts(data: AppData, conversationId: string) {
  return data.channelPosts
    .filter((post) => post.conversationId === conversationId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function getChannelPostComments(data: AppData, postId: string) {
  return data.channelPostComments
    .filter((comment) => comment.postId === postId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export function getChannelPostHref(data: AppData, postId: string) {
  const post = data.channelPosts.find((entry) => entry.id === postId)

  if (!post) {
    return null
  }

  const conversation = data.conversations.find(
    (entry) => entry.id === post.conversationId
  )

  if (!conversation || conversation.kind !== "channel") {
    return null
  }

  if (conversation.scopeType === "workspace") {
    return `/workspace/channel#${post.id}`
  }

  const team = data.teams.find((entry) => entry.id === conversation.scopeId)

  if (!team) {
    return null
  }

  return `/team/${team.slug}/channel#${post.id}`
}

export function getConversationHref(data: AppData, conversationId: string) {
  const conversation = data.conversations.find(
    (entry) => entry.id === conversationId
  )

  if (!conversation || conversation.kind !== "chat") {
    return null
  }

  if (conversation.scopeType === "workspace") {
    return `/chats?chatId=${conversation.id}`
  }

  const team = data.teams.find((entry) => entry.id === conversation.scopeId)

  if (!team) {
    return null
  }

  return `/team/${team.slug}/chat`
}

export function getAttachmentsForTarget(
  data: AppData,
  targetType: "workItem" | "document",
  targetId: string
) {
  return data.attachments
    .filter(
      (attachment) =>
        attachment.targetType === targetType && attachment.targetId === targetId
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function getProjectProgress(data: AppData, projectId: string) {
  const items = data.workItems.filter(
    (item) =>
      item.primaryProjectId === projectId ||
      item.linkedProjectIds.includes(projectId)
  )
  const completed = items.filter((item) => item.status === "done").length
  return {
    scope: items.length,
    completed,
    percent:
      items.length === 0 ? 0 : Math.round((completed / items.length) * 100),
  }
}

export function isGuestVisible(
  data: AppData,
  team: Team,
  entity: Project | Document | WorkItem
) {
  if ("templateType" in entity) {
    return team.settings.guestProjectIds.includes(entity.id)
  }

  if ("key" in entity) {
    return team.settings.guestWorkItemIds.includes(entity.id)
  }

  return team.settings.guestDocumentIds.includes(entity.id)
}

export function getVisibleWorkItems(
  data: AppData,
  params:
    | { teamId: string }
    | { workspaceId: string }
    | { assignedToCurrentUser: true }
) {
  if ("assignedToCurrentUser" in params) {
    const teamIds = getAccessibleTeams(data).map((team) => team.id)
    return data.workItems.filter(
      (item) =>
        item.assigneeId === data.currentUserId && teamIds.includes(item.teamId)
    )
  }

  if ("teamId" in params) {
    return data.workItems.filter((item) => item.teamId === params.teamId)
  }

  const teamIds = getAccessibleTeams(data)
    .filter((team) => team.workspaceId === params.workspaceId)
    .map((team) => team.id)

  return data.workItems.filter((item) => teamIds.includes(item.teamId))
}

export function itemMatchesView(
  data: AppData,
  item: WorkItem,
  view: ViewDefinition
) {
  const project = getProject(data, item.primaryProjectId)

  if (
    view.filters.status.length > 0 &&
    !view.filters.status.includes(item.status)
  ) {
    return false
  }

  if (
    view.filters.priority.length > 0 &&
    !view.filters.priority.includes(item.priority)
  ) {
    return false
  }

  if (
    view.filters.assigneeIds.length > 0 &&
    !view.filters.assigneeIds.includes(item.assigneeId ?? "")
  ) {
    return false
  }

  if (
    view.filters.creatorIds.length > 0 &&
    !view.filters.creatorIds.includes(item.creatorId)
  ) {
    return false
  }

  if (
    view.filters.projectIds.length > 0 &&
    !view.filters.projectIds.includes(item.primaryProjectId ?? "")
  ) {
    return false
  }

  if (
    view.filters.itemTypes.length > 0 &&
    !view.filters.itemTypes.includes(item.type)
  ) {
    return false
  }

  if (
    view.filters.labelIds.length > 0 &&
    !item.labelIds.some((labelId) => view.filters.labelIds.includes(labelId))
  ) {
    return false
  }

  if (
    view.filters.teamIds.length > 0 &&
    !view.filters.teamIds.includes(item.teamId)
  ) {
    return false
  }

  if (
    view.filters.leadIds.length > 0 &&
    !view.filters.leadIds.includes(project?.leadId ?? "")
  ) {
    return false
  }

  if (
    view.filters.health.length > 0 &&
    !view.filters.health.includes(project?.health ?? "no-update")
  ) {
    return false
  }

  if (
    !view.filters.showCompleted &&
    (item.status === "done" ||
      item.status === "cancelled" ||
      item.status === "duplicate")
  ) {
    return false
  }

  return true
}

export function comparePriority(left: Priority, right: Priority) {
  return priorityMeta[right].weight - priorityMeta[left].weight
}

export function sortItems(items: WorkItem[], ordering: OrderingField) {
  return [...items].sort((left, right) => {
    if (ordering === "priority") {
      return comparePriority(left.priority, right.priority)
    }

    if (ordering === "title") {
      return left.title.localeCompare(right.title)
    }

    const leftValue = left[ordering]
    const rightValue = right[ordering]

    if (!leftValue && !rightValue) {
      return 0
    }

    if (!leftValue) {
      return 1
    }

    if (!rightValue) {
      return -1
    }

    return rightValue.localeCompare(leftValue)
  })
}

export function getGroupValue(
  data: AppData,
  item: WorkItem,
  field: GroupField | null
) {
  if (!field) {
    return "all"
  }

  if (field === "project") {
    return getProject(data, item.primaryProjectId)?.name ?? "No project"
  }

  if (field === "assignee") {
    return getUser(data, item.assigneeId)?.name ?? "No assignee"
  }

  if (field === "team") {
    return getTeam(data, item.teamId)?.name ?? "Unknown team"
  }

  if (field === "type") {
    return item.type
  }

  return item[field]
}

export function buildItemGroups(
  data: AppData,
  items: WorkItem[],
  view: ViewDefinition
) {
  const sortedItems = sortItems(items, view.ordering)
  const groups = new Map<string, Map<string, WorkItem[]>>()

  for (const item of sortedItems) {
    const groupKey = getGroupValue(data, item, view.grouping)
    const subgroupKey = getGroupValue(data, item, view.subGrouping)

    if (!groups.has(groupKey)) {
      groups.set(groupKey, new Map())
    }

    const subgroups = groups.get(groupKey)
    if (!subgroups) {
      continue
    }

    if (!subgroups.has(subgroupKey)) {
      subgroups.set(subgroupKey, [])
    }

    subgroups.get(subgroupKey)?.push(item)
  }

  const statusOrder = getStatusOrderForItems(data, items)

  return new Map(
    [...groups.entries()]
      .sort((left, right) =>
        compareGroupKeys(view.grouping, left[0], right[0], statusOrder)
      )
      .map(([groupKey, subgroups]) => [
        groupKey,
        new Map(
          [...subgroups.entries()].sort((left, right) =>
            compareGroupKeys(view.subGrouping, left[0], right[0], statusOrder)
          )
        ),
      ])
  )
}

function getStatusOrderForItems(data: AppData, items: WorkItem[]) {
  if (items.length === 0) {
    return [...workStatuses]
  }

  const teamIds = [...new Set(items.map((item) => item.teamId))]

  if (teamIds.length !== 1) {
    return [...workStatuses]
  }

  return getStatusOrderForTeam(getTeam(data, teamIds[0]))
}

function compareGroupKeys(
  field: GroupField | null,
  left: string,
  right: string,
  statusOrder: WorkStatus[]
) {
  if (field === "status") {
    return (
      statusOrder.indexOf(left as WorkStatus) -
      statusOrder.indexOf(right as WorkStatus)
    )
  }

  if (field === "priority") {
    return comparePriority(left as Priority, right as Priority)
  }

  return left.localeCompare(right)
}

export function getUnreadNotifications(data: AppData) {
  return data.notifications.filter(
    (notification) =>
      notification.userId === data.currentUserId && notification.readAt === null
  )
}

export function getRecentDocuments(data: AppData) {
  return [...data.documents]
    .filter((document) => document.kind !== "item-description")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function getUpcomingItems(data: AppData) {
  return [...data.workItems]
    .filter((item) => item.targetDate)
    .sort((left, right) => {
      if (!left.targetDate || !right.targetDate) {
        return 0
      }

      return left.targetDate.localeCompare(right.targetDate)
    })
}

export function getLateItems(data: AppData) {
  const now = new Date()
  return data.workItems.filter((item) => {
    if (!item.dueDate || item.status === "done") {
      return false
    }

    return isAfter(now, new Date(item.dueDate))
  })
}

export type GlobalSearchResult = {
  id: string
  kind: "navigation" | "team" | "project" | "item" | "document"
  title: string
  subtitle: string
  href: string
  keywords: string[]
  teamId?: string | null
  status?: WorkStatus | null
  priority?: Priority | null
}

export function searchWorkspace(data: AppData, query: string) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const textTokens: string[] = []
  const kinds = new Set<GlobalSearchResult["kind"]>()
  let teamToken: string | null = null
  let statusToken: WorkStatus | null = null

  for (const token of tokens) {
    if (token.startsWith("kind:")) {
      const rawKind = token.slice(5)
      if (rawKind === "nav" || rawKind === "navigation") {
        kinds.add("navigation")
      } else if (rawKind === "team" || rawKind === "teams") {
        kinds.add("team")
      } else if (rawKind === "project" || rawKind === "projects") {
        kinds.add("project")
      } else if (
        rawKind === "item" ||
        rawKind === "issue" ||
        rawKind === "issues"
      ) {
        kinds.add("item")
      } else if (
        rawKind === "doc" ||
        rawKind === "docs" ||
        rawKind === "document"
      ) {
        kinds.add("document")
      }
      continue
    }

    if (token.startsWith("team:")) {
      teamToken = token.slice(5)
      continue
    }

    if (token.startsWith("status:")) {
      const nextStatus = token.slice(7) as WorkStatus
      if (workStatuses.includes(nextStatus)) {
        statusToken = nextStatus
      }
      continue
    }

    textTokens.push(token)
  }

  const accessibleTeams = getAccessibleTeams(data)
  const projects = getProjectsForScope(
    data,
    "workspace",
    data.currentWorkspaceId
  )
  const documents = getSearchableDocuments(data, data.currentWorkspaceId)
  const items = getVisibleWorkItems(data, {
    workspaceId: data.currentWorkspaceId,
  })

  const navigationResults: GlobalSearchResult[] = [
    {
      id: "nav-inbox",
      kind: "navigation",
      title: "Inbox",
      subtitle: "Unread notifications and mentions",
      href: "/inbox",
      keywords: ["notifications", "mentions", "inbox"],
    },
    {
      id: "nav-chats",
      kind: "navigation",
      title: "Chats",
      subtitle: "Direct and group conversations across the workspace",
      href: "/chats",
      keywords: ["chat", "messages", "direct", "group"],
    },
    {
      id: "nav-assigned",
      kind: "navigation",
      title: "My items",
      subtitle: "Cross-team work assigned to the current user",
      href: "/assigned",
      keywords: ["assigned", "tasks", "items", "issues"],
    },
    {
      id: "nav-channels",
      kind: "navigation",
      title: "Workspace Channel",
      subtitle: "Shared updates and threaded decisions for the whole workspace",
      href: "/workspace/channel",
      keywords: ["workspace", "channel", "channels", "announcements"],
    },
    {
      id: "nav-docs",
      kind: "navigation",
      title: "Workspace Docs",
      subtitle: "Workspace knowledge plus your private notes",
      href: "/workspace/docs",
      keywords: ["docs", "documents", "knowledge"],
    },
    {
      id: "nav-projects",
      kind: "navigation",
      title: "Workspace Projects",
      subtitle: "Aggregate projects across your joined teams",
      href: "/workspace/projects",
      keywords: ["workspace", "projects"],
    },
    {
      id: "nav-views",
      kind: "navigation",
      title: "Workspace Views",
      subtitle: "Saved list, board, and timeline views",
      href: "/workspace/views",
      keywords: ["views", "boards", "timeline"],
    },
    {
      id: "nav-search",
      kind: "navigation",
      title: "Workspace Search",
      subtitle:
        "Expanded search with faceted results across the workspace graph",
      href: "/workspace/search",
      keywords: ["search", "discover", "workspace"],
    },
    {
      id: "nav-reports",
      kind: "navigation",
      title: "Workspace Reports",
      subtitle: "Delivery health, capacity, and execution signals",
      href: "/workspace/reports",
      keywords: ["reports", "analytics", "health", "capacity"],
    },
  ]

  const results: GlobalSearchResult[] = [
    ...navigationResults,
    ...accessibleTeams.map((team) => ({
      id: `team-${team.id}`,
      kind: "team" as const,
      title: team.name,
      subtitle: team.settings.summary,
      href: `/team/${team.slug}/work`,
      keywords: [team.slug, team.settings.joinCode, team.id],
      teamId: team.id,
      status: null,
      priority: null,
    })),
    ...projects.map((project) => ({
      id: `project-${project.id}`,
      kind: "project" as const,
      title: project.name,
      subtitle: `${templateMeta[project.templateType].label} · ${project.summary}`,
      href: `/projects/${project.id}`,
      keywords: [
        project.id,
        project.summary,
        project.templateType,
        getUser(data, project.leadId)?.name ?? "",
        getTeam(
          data,
          project.scopeType === "team" ? project.scopeId : data.ui.activeTeamId
        )?.name ?? "",
      ],
      teamId: project.scopeType === "team" ? project.scopeId : null,
      status: null,
      priority: project.priority,
    })),
    ...documents.map((document) => ({
      id: `document-${document.id}`,
      kind: "document" as const,
      title: document.title,
      subtitle: `${getDocumentContextLabel(data, document)} · document`,
      href: `/docs/${document.id}`,
      keywords: [
        document.id,
        document.content,
        getTeam(data, document.teamId ?? "")?.slug ?? "",
        getDocumentContextLabel(data, document).toLowerCase(),
      ],
      teamId: document.teamId,
      status: null,
      priority: null,
    })),
    ...items.map((item) => {
      const team = getTeam(data, item.teamId)

      return {
        id: `item-${item.id}`,
        kind: "item" as const,
        title: `${item.key} · ${item.title}`,
        subtitle: `${statusMeta[item.status].label} · ${team?.name ?? "Team"} · ${getDisplayLabelForWorkItemType(item.type, team?.settings.experience)}`,
        href: `/items/${item.id}`,
        keywords: [
          item.id,
          item.key,
          item.title,
          item.type,
          item.status,
          team?.slug ?? "",
          getProject(data, item.primaryProjectId)?.name ?? "",
          getUser(data, item.assigneeId)?.name ?? "",
        ],
        teamId: item.teamId,
        status: item.status,
        priority: item.priority,
      }
    }),
  ]

  return results.filter((result) => {
    if (kinds.size > 0 && !kinds.has(result.kind)) {
      return false
    }

    if (teamToken) {
      if (result.kind === "team") {
        const matchesTeam = [result.title, ...result.keywords]
          .join(" ")
          .toLowerCase()
          .includes(teamToken)
        if (!matchesTeam) {
          return false
        }
      } else if (
        result.kind === "project" ||
        result.kind === "item" ||
        result.kind === "document"
      ) {
        const entityTeamId =
          result.kind === "project"
            ? projects.find((project) => `project-${project.id}` === result.id)
                ?.scopeId
            : result.kind === "item"
              ? items.find((item) => `item-${item.id}` === result.id)?.teamId
              : documents.find(
                  (document) => `document-${document.id}` === result.id
                )?.teamId

        if (
          !entityTeamId ||
          !accessibleTeams.some(
            (team) =>
              team.id === entityTeamId &&
              [team.id, team.slug, team.name, team.settings.joinCode]
                .join(" ")
                .toLowerCase()
                .includes(teamToken)
          )
        ) {
          return false
        }
      } else {
        return false
      }
    }

    if (statusToken && result.kind === "item") {
      const item = items.find((entry) => `item-${entry.id}` === result.id)
      if (!item || item.status !== statusToken) {
        return false
      }
    }

    if (statusToken && result.kind !== "item") {
      return false
    }

    if (textTokens.length === 0) {
      return true
    }

    const haystack = [result.title, result.subtitle, ...result.keywords]
      .join(" ")
      .toLowerCase()

    return textTokens.every((token) => haystack.includes(token))
  })
}

export function formatDisplayValue(
  data: AppData,
  item: WorkItem,
  property: DisplayProperty
) {
  if (property === "assignee") {
    return getUser(data, item.assigneeId)?.name ?? "Unassigned"
  }

  if (property === "project") {
    return getProject(data, item.primaryProjectId)?.name ?? "No project"
  }

  if (property === "milestone") {
    return (
      data.milestones.find((milestone) => milestone.id === item.milestoneId)
        ?.name ?? "No milestone"
    )
  }

  if (property === "labels") {
    return item.labelIds
      .map((labelId) => data.labels.find((label) => label.id === labelId)?.name)
      .filter(Boolean)
      .join(", ")
  }

  if (property === "created") {
    return item.createdAt
  }

  if (property === "updated") {
    return item.updatedAt
  }

  if (property === "dueDate") {
    return item.dueDate ?? "No due date"
  }

  if (property === "id") {
    return item.key
  }

  if (property === "type") {
    return item.type
  }

  return item[property]
}

export function getViewByRoute(data: AppData, route: string) {
  const selected = data.ui.selectedViewByRoute[route]
  return data.views.find((view) => view.id === selected) ?? null
}

export function getLinkedProjects(data: AppData, item: WorkItem) {
  return item.linkedProjectIds
    .map((projectId) => getProject(data, projectId))
    .filter(Boolean) as Project[]
}

export function getLinkedDocuments(data: AppData, item: WorkItem) {
  return item.linkedDocumentIds
    .map((documentId) => getDocument(data, documentId))
    .filter(Boolean) as Document[]
}

export function getItemAssignees(data: AppData, items: WorkItem[]) {
  const assignees = new Map<string, UserProfile>()

  for (const item of items) {
    const user = getUser(data, item.assigneeId)
    if (user) {
      assignees.set(user.id, user)
    }
  }

  return [...assignees.values()]
}

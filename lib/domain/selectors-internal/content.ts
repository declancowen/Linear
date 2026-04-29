import { sortViewsForDisplay } from "@/lib/domain/default-views"
import { getViewerScopedDirectoryKey } from "@/lib/domain/viewer-view-config"
import type {
  AppData,
  Document,
  Project,
  ViewDefinition,
} from "@/lib/domain/types"

import {
  canEditTeam,
  canEditWorkspace,
  getAccessibleTeams,
  getDocument,
  getTeam,
} from "@/lib/domain/selectors-internal/core"

function isTopLevelView(view: ViewDefinition) {
  return !view.containerType
}

export function getWorkspacePersonalViews(
  data: AppData,
  entityKind?: "items" | "projects" | "docs"
) {
  const workspaceViews = data.views.filter(
    (view) =>
      isTopLevelView(view) &&
      view.scopeType === "workspace" &&
      view.scopeId === data.currentWorkspaceId &&
      (entityKind ? view.entityKind === entityKind : true)
  )
  const legacyPersonalViews = data.views.filter(
    (view) =>
      isTopLevelView(view) &&
      view.scopeType === "personal" &&
      view.scopeId === data.currentUserId &&
      view.route.startsWith("/workspace/") &&
      (entityKind ? view.entityKind === entityKind : true)
  )

  return sortViewsForDisplay([...workspaceViews, ...legacyPersonalViews])
}

export function getWorkspaceDirectoryViews(
  data: AppData,
  workspaceId: string,
  entityKind?: "items" | "projects" | "docs"
) {
  const accessibleTeamIds = new Set(
    getAccessibleTeams(data)
      .filter((team) => team.workspaceId === workspaceId)
      .map((team) => team.id)
  )

  const workspaceViews = data.views.filter(
    (view) =>
      isTopLevelView(view) &&
      view.scopeType === "workspace" &&
      view.scopeId === workspaceId &&
      (entityKind ? view.entityKind === entityKind : true)
  )
  const teamViews = data.views.filter(
    (view) =>
      isTopLevelView(view) &&
      view.scopeType === "team" &&
      accessibleTeamIds.has(view.scopeId) &&
      (entityKind ? view.entityKind === entityKind : true)
  )
  const legacyPersonalViews =
    workspaceId === data.currentWorkspaceId
      ? data.views.filter(
          (view) =>
            isTopLevelView(view) &&
            view.scopeType === "personal" &&
            view.scopeId === data.currentUserId &&
            view.route.startsWith("/workspace/") &&
            (entityKind ? view.entityKind === entityKind : true)
        )
      : []

  return sortViewsForDisplay([
    ...workspaceViews,
    ...teamViews,
    ...legacyPersonalViews,
  ])
}

export function getViewContextLabel(
  data: Pick<AppData, "teams" | "workspaces" | "currentWorkspaceId">,
  view: ViewDefinition
) {
  if (view.scopeType === "team") {
    return data.teams.find((team) => team.id === view.scopeId)?.name ?? "Team"
  }

  if (view.scopeType === "workspace") {
    return (
      data.workspaces.find((workspace) => workspace.id === view.scopeId)?.name ??
      "Workspace"
    )
  }

  if (view.route.startsWith("/workspace/")) {
    return (
      data.workspaces.find(
        (workspace) => workspace.id === data.currentWorkspaceId
      )?.name ?? "Workspace"
    )
  }

  return "Personal"
}

export function canMutateView(data: AppData, view: ViewDefinition) {
  if (view.scopeType === "personal") {
    return view.scopeId === data.currentUserId
  }

  if (view.scopeType === "team") {
    return canEditTeam(data, view.scopeId)
  }

  return canEditWorkspace(data, view.scopeId)
}

export function canMutateProject(data: AppData, project: Project) {
  if (project.scopeType === "team") {
    return canEditTeam(data, project.scopeId)
  }

  return canEditWorkspace(data, project.scopeId)
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
        isTopLevelView(view) &&
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

export function getRecentDocuments(data: AppData) {
  return [...data.documents]
    .filter((document) => document.kind !== "item-description")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function getViewByRoute(data: AppData, route: string) {
  const selected =
    data.ui.selectedViewByRoute[
      getViewerScopedDirectoryKey(data.currentUserId, route)
    ]
  return data.views.find((view) => view.id === selected) ?? null
}

export function getLinkedDocuments(data: AppData, item: { linkedDocumentIds: string[] }) {
  return item.linkedDocumentIds
    .map((documentId) => getDocument(data, documentId))
    .filter(Boolean) as Document[]
}

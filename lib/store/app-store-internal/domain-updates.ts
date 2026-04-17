"use client"

import {
  createDefaultTeamWorkflowSettings,
  type AppData,
  type TeamExperienceType,
  type TeamFeatureSettings,
} from "@/lib/domain/types"

function filterDeletedIds(ids: string[], deletedIds: Set<string>) {
  return ids.filter((id) => !deletedIds.has(id))
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

type RemovalScope = {
  deletedWorkspaceIds: Set<string>
  deletedTeamIds: Set<string>
}

type RemovalSets = RemovalScope & {
  deletedProjectIds: Set<string>
  deletedMilestoneIds: Set<string>
  deletedWorkItemIds: Set<string>
  deletedDocumentIds: Set<string>
  deletedLabelIds: Set<string>
  deletedInviteIds: Set<string>
  deletedConversationIds: Set<string>
  deletedChannelPostIds: Set<string>
  deletedViewIds: Set<string>
  deletedNotificationIds: Set<string>
}

function buildRemovalSets(state: AppData, scope: RemovalScope): RemovalSets {
  const deletedProjectIds = new Set(
    state.projects
      .filter((project) => {
        if (project.scopeType === "workspace") {
          return scope.deletedWorkspaceIds.has(project.scopeId)
        }

        return scope.deletedTeamIds.has(project.scopeId)
      })
      .map((project) => project.id)
  )
  const deletedMilestoneIds = new Set(
    state.milestones
      .filter((milestone) => deletedProjectIds.has(milestone.projectId))
      .map((milestone) => milestone.id)
  )
  const deletedWorkItemIds = new Set(
    state.workItems
      .filter((item) => scope.deletedTeamIds.has(item.teamId))
      .map((item) => item.id)
  )
  const deletedDescriptionDocIds = new Set(
    state.workItems
      .filter((item) => deletedWorkItemIds.has(item.id))
      .map((item) => item.descriptionDocId)
  )
  const deletedDocumentIds = new Set(
    state.documents
      .filter(
        (document) =>
          scope.deletedWorkspaceIds.has(document.workspaceId) ||
          scope.deletedTeamIds.has(document.teamId ?? "") ||
          deletedDescriptionDocIds.has(document.id)
      )
      .map((document) => document.id)
  )
  const deletedLabelIds = new Set(
    state.labels
      .filter((label) => scope.deletedWorkspaceIds.has(label.workspaceId))
      .map((label) => label.id)
  )
  const deletedInviteIds = new Set(
    state.invites
      .filter(
        (invite) =>
          scope.deletedWorkspaceIds.has(invite.workspaceId) ||
          scope.deletedTeamIds.has(invite.teamId)
      )
      .map((invite) => invite.id)
  )
  const deletedConversationIds = new Set(
    state.conversations
      .filter((conversation) => {
        if (conversation.scopeType === "workspace") {
          return scope.deletedWorkspaceIds.has(conversation.scopeId)
        }

        return scope.deletedTeamIds.has(conversation.scopeId)
      })
      .map((conversation) => conversation.id)
  )
  const deletedChannelPostIds = new Set(
    state.channelPosts
      .filter((post) => deletedConversationIds.has(post.conversationId))
      .map((post) => post.id)
  )
  const deletedViewIds = new Set(
    state.views
      .filter((view) => {
        if (view.scopeType === "workspace") {
          return scope.deletedWorkspaceIds.has(view.scopeId)
        }

        return view.scopeType === "team" && scope.deletedTeamIds.has(view.scopeId)
      })
      .map((view) => view.id)
  )
  const deletedNotificationIds = new Set(
    state.notifications
      .filter((notification) => {
        if (notification.entityType === "workspace") {
          return scope.deletedWorkspaceIds.has(notification.entityId)
        }

        if (notification.entityType === "team") {
          return scope.deletedTeamIds.has(notification.entityId)
        }

        if (notification.entityType === "project") {
          return deletedProjectIds.has(notification.entityId)
        }

        if (notification.entityType === "workItem") {
          return deletedWorkItemIds.has(notification.entityId)
        }

        if (notification.entityType === "document") {
          return deletedDocumentIds.has(notification.entityId)
        }

        if (notification.entityType === "invite") {
          return deletedInviteIds.has(notification.entityId)
        }

        if (notification.entityType === "chat") {
          return deletedConversationIds.has(notification.entityId)
        }

        if (notification.entityType === "channelPost") {
          return deletedChannelPostIds.has(notification.entityId)
        }

        return false
      })
      .map((notification) => notification.id)
  )

  return {
    ...scope,
    deletedProjectIds,
    deletedMilestoneIds,
    deletedWorkItemIds,
    deletedDocumentIds,
    deletedLabelIds,
    deletedInviteIds,
    deletedConversationIds,
    deletedChannelPostIds,
    deletedViewIds,
    deletedNotificationIds,
  }
}

function buildNextStateAfterRemoval(
  state: AppData,
  removal: RemovalSets,
  currentWorkspaceId: string
) {
  const workspaces =
    removal.deletedWorkspaceIds.size === 0
      ? state.workspaces
      : state.workspaces.filter(
          (workspace) => !removal.deletedWorkspaceIds.has(workspace.id)
        )
  const teams = state.teams.filter((team) => !removal.deletedTeamIds.has(team.id))
  const teamMemberships = state.teamMemberships.filter(
    (membership) => !removal.deletedTeamIds.has(membership.teamId)
  )
  const labels =
    removal.deletedLabelIds.size === 0
      ? state.labels
      : state.labels.filter((label) => !removal.deletedLabelIds.has(label.id))
  const projects = state.projects.filter(
    (project) => !removal.deletedProjectIds.has(project.id)
  )
  const milestones = state.milestones.filter(
    (milestone) => !removal.deletedMilestoneIds.has(milestone.id)
  )
  const workItems = state.workItems
    .filter((item) => !removal.deletedWorkItemIds.has(item.id))
    .map((item) => ({
      ...item,
      primaryProjectId:
        item.primaryProjectId && removal.deletedProjectIds.has(item.primaryProjectId)
          ? null
          : item.primaryProjectId,
      linkedProjectIds: filterDeletedIds(
        item.linkedProjectIds,
        removal.deletedProjectIds
      ),
      linkedDocumentIds: filterDeletedIds(
        item.linkedDocumentIds,
        removal.deletedDocumentIds
      ),
      labelIds: filterDeletedIds(item.labelIds, removal.deletedLabelIds),
      milestoneId:
        item.milestoneId && removal.deletedMilestoneIds.has(item.milestoneId)
          ? null
          : item.milestoneId,
    }))
  const documents = state.documents
    .filter((document) => !removal.deletedDocumentIds.has(document.id))
    .map((document) => ({
      ...document,
      linkedProjectIds: filterDeletedIds(
        document.linkedProjectIds,
        removal.deletedProjectIds
      ),
      linkedWorkItemIds: filterDeletedIds(
        document.linkedWorkItemIds,
        removal.deletedWorkItemIds
      ),
    }))
  const views = state.views
    .filter((view) => !removal.deletedViewIds.has(view.id))
    .map((view) => ({
      ...view,
      filters: {
        ...view.filters,
        projectIds: filterDeletedIds(
          view.filters.projectIds,
          removal.deletedProjectIds
        ),
        milestoneIds: filterDeletedIds(
          view.filters.milestoneIds,
          removal.deletedMilestoneIds
        ),
        teamIds: filterDeletedIds(view.filters.teamIds, removal.deletedTeamIds),
        labelIds: filterDeletedIds(view.filters.labelIds, removal.deletedLabelIds),
      },
    }))
  const comments = state.comments.filter((comment) => {
    if (comment.targetType === "workItem") {
      return !removal.deletedWorkItemIds.has(comment.targetId)
    }

    return !removal.deletedDocumentIds.has(comment.targetId)
  })
  const attachments = state.attachments.filter((attachment) => {
    if (removal.deletedTeamIds.has(attachment.teamId)) {
      return false
    }

    if (attachment.targetType === "workItem") {
      return !removal.deletedWorkItemIds.has(attachment.targetId)
    }

    return !removal.deletedDocumentIds.has(attachment.targetId)
  })
  const notifications = state.notifications.filter(
    (notification) => !removal.deletedNotificationIds.has(notification.id)
  )
  const invites = state.invites.filter(
    (invite) => !removal.deletedInviteIds.has(invite.id)
  )
  const projectUpdates = state.projectUpdates.filter(
    (projectUpdate) => !removal.deletedProjectIds.has(projectUpdate.projectId)
  )
  const conversations = state.conversations.filter(
    (conversation) => !removal.deletedConversationIds.has(conversation.id)
  )
  const calls = state.calls.filter(
    (call) => !removal.deletedConversationIds.has(call.conversationId)
  )
  const chatMessages = state.chatMessages.filter(
    (message) => !removal.deletedConversationIds.has(message.conversationId)
  )
  const channelPosts = state.channelPosts.filter(
    (post) => !removal.deletedChannelPostIds.has(post.id)
  )
  const channelPostComments = state.channelPostComments.filter(
    (comment) => !removal.deletedChannelPostIds.has(comment.postId)
  )
  const selectedViewByRoute = Object.fromEntries(
    Object.entries(state.ui.selectedViewByRoute).filter(
      ([, viewId]) => !removal.deletedViewIds.has(viewId)
    )
  )

  return {
    currentWorkspaceId,
    workspaces,
    teams,
    teamMemberships,
    labels,
    projects,
    milestones,
    workItems,
    documents,
    views,
    comments,
    attachments,
    notifications,
    invites,
    projectUpdates,
    conversations,
    calls,
    chatMessages,
    channelPosts,
    channelPostComments,
    ui: {
      ...state.ui,
      activeTeamId: getNextActiveTeamId(
        teams,
        currentWorkspaceId,
        state.ui.activeTeamId
      ),
      activeInboxNotificationId:
        state.ui.activeInboxNotificationId &&
        removal.deletedNotificationIds.has(state.ui.activeInboxNotificationId)
          ? null
          : state.ui.activeInboxNotificationId,
      selectedViewByRoute,
    },
  }
}

export function buildLocalTeamCreateState(input: {
  currentUserId: string
  workspaceId: string
  teamId: string
  teamSlug: string
  joinCode: string
  name: string
  icon: string
  summary: string
  experience: TeamExperienceType
  features: TeamFeatureSettings
}) {
  return {
    team: {
      id: input.teamId,
      workspaceId: input.workspaceId,
      slug: input.teamSlug,
      name: input.name,
      icon: input.icon,
      settings: {
        joinCode: input.joinCode,
        summary: input.summary,
        guestProjectIds: [],
        guestDocumentIds: [],
        guestWorkItemIds: [],
        experience: input.experience,
        features: input.features,
        workflow: createDefaultTeamWorkflowSettings(input.experience),
      },
    },
    membership: {
      teamId: input.teamId,
      userId: input.currentUserId,
      role: "admin" as const,
    },
  }
}

export function getNextStateAfterTeamRemoval(
  state: AppData,
  teamId: string
) {
  return buildNextStateAfterRemoval(
    state,
    buildRemovalSets(state, {
      deletedWorkspaceIds: new Set(),
      deletedTeamIds: new Set<string>([teamId]),
    }),
    state.currentWorkspaceId
  )
}

export function getNextStateAfterWorkspaceRemoval(
  state: AppData,
  workspaceId: string
) {
  const deletedWorkspaceIds = new Set<string>([workspaceId])
  const deletedTeamIds = new Set(
    state.teams
      .filter((team) => deletedWorkspaceIds.has(team.workspaceId))
      .map((team) => team.id)
  )
  const workspaces = state.workspaces.filter(
    (workspace) => !deletedWorkspaceIds.has(workspace.id)
  )
  const currentWorkspaceId =
    state.currentWorkspaceId === workspaceId
      ? (workspaces[0]?.id ?? "")
      : state.currentWorkspaceId

  return buildNextStateAfterRemoval(
    state,
    buildRemovalSets(state, {
      deletedWorkspaceIds,
      deletedTeamIds,
    }),
    currentWorkspaceId
  )
}

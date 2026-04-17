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
  const deletedTeamIds = new Set<string>([teamId])
  const deletedProjectIds = new Set(
    state.projects
      .filter(
        (project) => project.scopeType === "team" && deletedTeamIds.has(project.scopeId)
      )
      .map((project) => project.id)
  )
  const deletedMilestoneIds = new Set(
    state.milestones
      .filter((milestone) => deletedProjectIds.has(milestone.projectId))
      .map((milestone) => milestone.id)
  )
  const deletedWorkItemIds = new Set(
    state.workItems
      .filter((item) => deletedTeamIds.has(item.teamId))
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
          deletedTeamIds.has(document.teamId ?? "") ||
          deletedDescriptionDocIds.has(document.id)
      )
      .map((document) => document.id)
  )
  const deletedInviteIds = new Set(
    state.invites
      .filter((invite) => deletedTeamIds.has(invite.teamId))
      .map((invite) => invite.id)
  )
  const deletedConversationIds = new Set(
    state.conversations
      .filter(
        (conversation) =>
          conversation.scopeType === "team" &&
          deletedTeamIds.has(conversation.scopeId)
      )
      .map((conversation) => conversation.id)
  )
  const deletedChannelPostIds = new Set(
    state.channelPosts
      .filter((post) => deletedConversationIds.has(post.conversationId))
      .map((post) => post.id)
  )
  const deletedViewIds = new Set(
    state.views
      .filter(
        (view) => view.scopeType === "team" && deletedTeamIds.has(view.scopeId)
      )
      .map((view) => view.id)
  )
  const deletedNotificationIds = new Set(
    state.notifications
      .filter((notification) => {
        if (notification.entityType === "team") {
          return deletedTeamIds.has(notification.entityId)
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

  const teams = state.teams.filter((team) => !deletedTeamIds.has(team.id))
  const teamMemberships = state.teamMemberships.filter(
    (membership) => !deletedTeamIds.has(membership.teamId)
  )
  const projects = state.projects.filter((project) => !deletedProjectIds.has(project.id))
  const milestones = state.milestones.filter(
    (milestone) => !deletedMilestoneIds.has(milestone.id)
  )
  const workItems = state.workItems
    .filter((item) => !deletedWorkItemIds.has(item.id))
    .map((item) => ({
      ...item,
      primaryProjectId:
        item.primaryProjectId && deletedProjectIds.has(item.primaryProjectId)
          ? null
          : item.primaryProjectId,
      linkedProjectIds: filterDeletedIds(item.linkedProjectIds, deletedProjectIds),
      linkedDocumentIds: filterDeletedIds(item.linkedDocumentIds, deletedDocumentIds),
      milestoneId:
        item.milestoneId && deletedMilestoneIds.has(item.milestoneId)
          ? null
          : item.milestoneId,
    }))
  const documents = state.documents
    .filter((document) => !deletedDocumentIds.has(document.id))
    .map((document) => ({
      ...document,
      linkedProjectIds: filterDeletedIds(document.linkedProjectIds, deletedProjectIds),
      linkedWorkItemIds: filterDeletedIds(
        document.linkedWorkItemIds,
        deletedWorkItemIds
      ),
    }))
  const views = state.views
    .filter((view) => !deletedViewIds.has(view.id))
    .map((view) => ({
      ...view,
      filters: {
        ...view.filters,
        projectIds: filterDeletedIds(view.filters.projectIds, deletedProjectIds),
        milestoneIds: filterDeletedIds(view.filters.milestoneIds, deletedMilestoneIds),
        teamIds: filterDeletedIds(view.filters.teamIds, deletedTeamIds),
      },
    }))
  const comments = state.comments.filter((comment) => {
    if (comment.targetType === "workItem") {
      return !deletedWorkItemIds.has(comment.targetId)
    }

    return !deletedDocumentIds.has(comment.targetId)
  })
  const attachments = state.attachments.filter((attachment) => {
    if (deletedTeamIds.has(attachment.teamId)) {
      return false
    }

    if (attachment.targetType === "workItem") {
      return !deletedWorkItemIds.has(attachment.targetId)
    }

    return !deletedDocumentIds.has(attachment.targetId)
  })
  const notifications = state.notifications.filter(
    (notification) => !deletedNotificationIds.has(notification.id)
  )
  const invites = state.invites.filter((invite) => !deletedInviteIds.has(invite.id))
  const projectUpdates = state.projectUpdates.filter(
    (projectUpdate) => !deletedProjectIds.has(projectUpdate.projectId)
  )
  const conversations = state.conversations.filter(
    (conversation) => !deletedConversationIds.has(conversation.id)
  )
  const calls = state.calls.filter((call) => !deletedConversationIds.has(call.conversationId))
  const chatMessages = state.chatMessages.filter(
    (message) => !deletedConversationIds.has(message.conversationId)
  )
  const channelPosts = state.channelPosts.filter(
    (post) => !deletedChannelPostIds.has(post.id)
  )
  const channelPostComments = state.channelPostComments.filter(
    (comment) => !deletedChannelPostIds.has(comment.postId)
  )
  const selectedViewByRoute = Object.fromEntries(
    Object.entries(state.ui.selectedViewByRoute).filter(
      ([, viewId]) => !deletedViewIds.has(viewId)
    )
  )

  return {
    teams,
    teamMemberships,
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
        state.currentWorkspaceId,
        state.ui.activeTeamId
      ),
      activeInboxNotificationId:
        state.ui.activeInboxNotificationId &&
        deletedNotificationIds.has(state.ui.activeInboxNotificationId)
          ? null
          : state.ui.activeInboxNotificationId,
      selectedViewByRoute,
    },
  }
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
  const deletedProjectIds = new Set(
    state.projects
      .filter((project) => {
        if (project.scopeType === "workspace") {
          return deletedWorkspaceIds.has(project.scopeId)
        }

        return deletedTeamIds.has(project.scopeId)
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
      .filter((item) => deletedTeamIds.has(item.teamId))
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
          deletedWorkspaceIds.has(document.workspaceId) ||
          deletedTeamIds.has(document.teamId ?? "") ||
          deletedDescriptionDocIds.has(document.id)
      )
      .map((document) => document.id)
  )
  const deletedLabelIds = new Set(
    state.labels
      .filter((label) => deletedWorkspaceIds.has(label.workspaceId))
      .map((label) => label.id)
  )
  const deletedInviteIds = new Set(
    state.invites
      .filter(
        (invite) =>
          deletedWorkspaceIds.has(invite.workspaceId) ||
          deletedTeamIds.has(invite.teamId)
      )
      .map((invite) => invite.id)
  )
  const deletedConversationIds = new Set(
    state.conversations
      .filter((conversation) => {
        if (conversation.scopeType === "workspace") {
          return deletedWorkspaceIds.has(conversation.scopeId)
        }

        return deletedTeamIds.has(conversation.scopeId)
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
          return deletedWorkspaceIds.has(view.scopeId)
        }

        return view.scopeType === "team" && deletedTeamIds.has(view.scopeId)
      })
      .map((view) => view.id)
  )
  const deletedNotificationIds = new Set(
    state.notifications
      .filter((notification) => {
        if (notification.entityType === "workspace") {
          return deletedWorkspaceIds.has(notification.entityId)
        }

        if (notification.entityType === "team") {
          return deletedTeamIds.has(notification.entityId)
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

  const workspaces = state.workspaces.filter(
    (workspace) => !deletedWorkspaceIds.has(workspace.id)
  )
  const teams = state.teams.filter((team) => !deletedTeamIds.has(team.id))
  const teamMemberships = state.teamMemberships.filter(
    (membership) => !deletedTeamIds.has(membership.teamId)
  )
  const labels = state.labels.filter((label) => !deletedLabelIds.has(label.id))
  const projects = state.projects.filter((project) => !deletedProjectIds.has(project.id))
  const milestones = state.milestones.filter(
    (milestone) => !deletedMilestoneIds.has(milestone.id)
  )
  const workItems = state.workItems
    .filter((item) => !deletedWorkItemIds.has(item.id))
    .map((item) => ({
      ...item,
      primaryProjectId:
        item.primaryProjectId && deletedProjectIds.has(item.primaryProjectId)
          ? null
          : item.primaryProjectId,
      linkedProjectIds: filterDeletedIds(item.linkedProjectIds, deletedProjectIds),
      linkedDocumentIds: filterDeletedIds(item.linkedDocumentIds, deletedDocumentIds),
      labelIds: filterDeletedIds(item.labelIds, deletedLabelIds),
      milestoneId:
        item.milestoneId && deletedMilestoneIds.has(item.milestoneId)
          ? null
          : item.milestoneId,
    }))
  const documents = state.documents
    .filter((document) => !deletedDocumentIds.has(document.id))
    .map((document) => ({
      ...document,
      linkedProjectIds: filterDeletedIds(document.linkedProjectIds, deletedProjectIds),
      linkedWorkItemIds: filterDeletedIds(
        document.linkedWorkItemIds,
        deletedWorkItemIds
      ),
    }))
  const views = state.views
    .filter((view) => !deletedViewIds.has(view.id))
    .map((view) => ({
      ...view,
      filters: {
        ...view.filters,
        projectIds: filterDeletedIds(view.filters.projectIds, deletedProjectIds),
        milestoneIds: filterDeletedIds(view.filters.milestoneIds, deletedMilestoneIds),
        teamIds: filterDeletedIds(view.filters.teamIds, deletedTeamIds),
        labelIds: filterDeletedIds(view.filters.labelIds, deletedLabelIds),
      },
    }))
  const comments = state.comments.filter((comment) => {
    if (comment.targetType === "workItem") {
      return !deletedWorkItemIds.has(comment.targetId)
    }

    return !deletedDocumentIds.has(comment.targetId)
  })
  const attachments = state.attachments.filter((attachment) => {
    if (deletedTeamIds.has(attachment.teamId)) {
      return false
    }

    if (attachment.targetType === "workItem") {
      return !deletedWorkItemIds.has(attachment.targetId)
    }

    return !deletedDocumentIds.has(attachment.targetId)
  })
  const notifications = state.notifications.filter(
    (notification) => !deletedNotificationIds.has(notification.id)
  )
  const invites = state.invites.filter((invite) => !deletedInviteIds.has(invite.id))
  const projectUpdates = state.projectUpdates.filter(
    (projectUpdate) => !deletedProjectIds.has(projectUpdate.projectId)
  )
  const conversations = state.conversations.filter(
    (conversation) => !deletedConversationIds.has(conversation.id)
  )
  const calls = state.calls.filter((call) => !deletedConversationIds.has(call.conversationId))
  const chatMessages = state.chatMessages.filter(
    (message) => !deletedConversationIds.has(message.conversationId)
  )
  const channelPosts = state.channelPosts.filter(
    (post) => !deletedChannelPostIds.has(post.id)
  )
  const channelPostComments = state.channelPostComments.filter(
    (comment) => !deletedChannelPostIds.has(comment.postId)
  )
  const selectedViewByRoute = Object.fromEntries(
    Object.entries(state.ui.selectedViewByRoute).filter(
      ([, viewId]) => !deletedViewIds.has(viewId)
    )
  )
  const currentWorkspaceId =
    state.currentWorkspaceId === workspaceId
      ? (workspaces[0]?.id ?? "")
      : state.currentWorkspaceId

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
        deletedNotificationIds.has(state.ui.activeInboxNotificationId)
          ? null
          : state.ui.activeInboxNotificationId,
      selectedViewByRoute,
    },
  }
}

import type {
  AppData,
  Conversation,
  Project,
  Team,
  TeamFeatureSettings,
  TeamWorkflowSettings,
  UserProfile,
  WorkStatus,
} from "@/lib/domain/types"
import { canEditRole, mergeRole } from "@/lib/domain/roles"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  normalizeTeamFeatureSettings,
} from "@/lib/domain/types"

export function getCurrentUser(data: AppData): UserProfile | null {
  return (
    data.users.find((user) => user.id === data.currentUserId) ??
    data.users[0] ??
    null
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

  return data.teams.filter(
    (team) =>
      team.workspaceId === data.currentWorkspaceId &&
      membershipTeamIds.has(team.id)
  )
}

function getEditableTeams(data: AppData) {
  const editableTeamIds = new Set(
    data.teamMemberships
      .filter(
        (membership) =>
          membership.userId === data.currentUserId &&
          canEditRole(membership.role)
      )
      .map((membership) => membership.teamId)
  )

  return data.teams.filter(
    (team) =>
      team.workspaceId === data.currentWorkspaceId &&
      editableTeamIds.has(team.id)
  )
}

export function getEditableTeamsForFeature(
  data: AppData,
  feature: keyof TeamFeatureSettings
) {
  return getEditableTeams(data).filter(
    (team) => getTeamFeatureSettings(team)[feature]
  )
}

export function getTeamBySlug(data: AppData, teamSlug: string) {
  return (
    data.teams.find(
      (team) =>
        team.workspaceId === data.currentWorkspaceId && team.slug === teamSlug
    ) ?? null
  )
}

export function getTeamRole(data: AppData, teamId: string) {
  return (
    data.teamMemberships.find(
      (membership) =>
        membership.teamId === teamId && membership.userId === data.currentUserId
    )?.role ?? null
  )
}

export function isWorkspaceOwner(data: AppData, workspaceId: string) {
  return (
    data.workspaces.find((workspace) => workspace.id === workspaceId)
      ?.createdBy === data.currentUserId
  )
}

function getHighestWorkspaceTeamRoleInCollections(
  teams: AppData["teams"],
  teamMemberships: AppData["teamMemberships"],
  workspaceId: string,
  userId: string
) {
  const workspaceTeamIds = new Set(
    teams
      .filter((team) => team.workspaceId === workspaceId)
      .map((team) => team.id)
  )

  return (
    teamMemberships
      .filter(
        (membership) =>
          membership.userId === userId &&
          workspaceTeamIds.has(membership.teamId)
      )
      .reduce<
        AppData["teamMemberships"][number]["role"] | null
      >((currentRole, membership) => mergeRole(currentRole, membership.role), null) ??
    null
  )
}

function getWorkspaceAccessSubject(
  workspaces: AppData["workspaces"],
  workspaceId: string,
  userId: string
) {
  const workspace = workspaces.find((entry) => entry.id === workspaceId)

  if (!workspace) {
    return null
  }

  return {
    isCreator: workspace.createdBy === userId,
  }
}

function getDirectOrFallbackWorkspaceRoleInCollections(
  workspaces: AppData["workspaces"],
  workspaceMemberships: AppData["workspaceMemberships"],
  teams: AppData["teams"],
  teamMemberships: AppData["teamMemberships"],
  workspaceId: string,
  userId: string
) {
  const subject = getWorkspaceAccessSubject(workspaces, workspaceId, userId)

  if (!subject) {
    return null
  }

  if (subject.isCreator) {
    return "admin"
  }

  const directMembership =
    workspaceMemberships.find(
      (membership) =>
        membership.workspaceId === workspaceId && membership.userId === userId
    ) ?? null

  if (directMembership) {
    return directMembership.role
  }

  return getHighestWorkspaceTeamRoleInCollections(
    teams,
    teamMemberships,
    workspaceId,
    userId
  )
}

function getWorkspaceEditableRoleInCollections(
  workspaces: AppData["workspaces"],
  workspaceMemberships: AppData["workspaceMemberships"],
  teams: AppData["teams"],
  teamMemberships: AppData["teamMemberships"],
  workspaceId: string,
  userId: string
) {
  const workspaceRole = getDirectOrFallbackWorkspaceRoleInCollections(
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
    workspaceId,
    userId
  )
  const teamRole = getHighestWorkspaceTeamRoleInCollections(
    teams,
    teamMemberships,
    workspaceId,
    userId
  )

  return teamRole ? mergeRole(workspaceRole, teamRole) : workspaceRole
}

function getWorkspaceEffectiveRoleInCollections(
  workspaces: AppData["workspaces"],
  workspaceMemberships: AppData["workspaceMemberships"],
  teams: AppData["teams"],
  teamMemberships: AppData["teamMemberships"],
  workspaceId: string,
  userId: string
) {
  return getWorkspaceEditableRoleInCollections(
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
    workspaceId,
    userId
  )
}

export function hasWorkspaceAccessInCollections(
  workspaces: AppData["workspaces"],
  workspaceMemberships: AppData["workspaceMemberships"],
  teams: AppData["teams"],
  teamMemberships: AppData["teamMemberships"],
  workspaceId: string,
  userId: string
) {
  const subject = getWorkspaceAccessSubject(workspaces, workspaceId, userId)

  if (!subject) {
    return false
  }

  if (subject.isCreator) {
    return true
  }

  if (
    workspaceMemberships.some(
      (membership) =>
        membership.workspaceId === workspaceId && membership.userId === userId
    )
  ) {
    return true
  }

  const workspaceTeamIds = new Set(
    teams
      .filter((team) => team.workspaceId === workspaceId)
      .map((team) => team.id)
  )

  return teamMemberships.some(
    (membership) =>
      membership.userId === userId && workspaceTeamIds.has(membership.teamId)
  )
}

export function hasWorkspaceAccess(
  data: AppData,
  workspaceId: string,
  userId: string
) {
  return hasWorkspaceAccessInCollections(
    data.workspaces,
    data.workspaceMemberships,
    data.teams,
    data.teamMemberships,
    workspaceId,
    userId
  )
}

export function canEditTeam(data: AppData, teamId: string) {
  const role = getTeamRole(data, teamId)
  return canEditRole(role)
}

export function canEditWorkspace(data: AppData, workspaceId: string) {
  const role = getWorkspaceEffectiveRoleInCollections(
    data.workspaces,
    data.workspaceMemberships,
    data.teams,
    data.teamMemberships,
    workspaceId,
    data.currentUserId
  )

  return canEditRole(role)
}

export function canAdminTeam(data: AppData, teamId: string) {
  return getTeamRole(data, teamId) === "admin"
}

export function canAdminWorkspace(data: AppData, workspaceId: string) {
  return (
    getWorkspaceEffectiveRoleInCollections(
      data.workspaces,
      data.workspaceMemberships,
      data.teams,
      data.teamMemberships,
      workspaceId,
      data.currentUserId
    ) === "admin"
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
  const workspaceOwnerId =
    data.workspaces.find((workspace) => workspace.id === workspaceId)
      ?.createdBy ?? null
  const teamIds = data.teams
    .filter((team) => team.workspaceId === workspaceId)
    .map((team) => team.id)
  const userIds = new Set([
    ...data.workspaceMemberships
      .filter((membership) => membership.workspaceId === workspaceId)
      .map((membership) => membership.userId),
    ...data.teamMemberships
      .filter((membership) => teamIds.includes(membership.teamId))
      .map((membership) => membership.userId),
  ])

  if (workspaceOwnerId) {
    userIds.add(workspaceOwnerId)
  }

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

function getTeamWorkflowSettings(
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

export function getLabelsForWorkspace(data: AppData, workspaceId: string) {
  return data.labels.filter((label) => label.workspaceId === workspaceId)
}

export function getLabelsForTeamScope(data: AppData, teamId: string) {
  const team = getTeam(data, teamId)

  if (!team) {
    return []
  }

  return getLabelsForWorkspace(data, team.workspaceId)
}

export function getProjectsForScope(
  data: AppData,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  if (scopeType === "team") {
    return data.projects.filter(
      (project) => project.scopeType === "team" && project.scopeId === scopeId
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

export function getProjectTeam(
  data: AppData,
  project: Project | string | null | undefined
) {
  const resolvedProject =
    typeof project === "string" ? getProject(data, project) : project

  if (!resolvedProject || resolvedProject.scopeType !== "team") {
    return null
  }

  return getTeam(data, resolvedProject.scopeId)
}

export function getProjectHref(
  data: AppData,
  project: Project | string | null | undefined
) {
  const resolvedProject =
    typeof project === "string" ? getProject(data, project) : project

  if (!resolvedProject) {
    return null
  }

  const team = getProjectTeam(data, resolvedProject)

  if (team) {
    return `/team/${team.slug}/projects/${resolvedProject.id}`
  }

  if (resolvedProject.scopeType === "workspace") {
    return `/workspace/projects/${resolvedProject.id}`
  }

  return `/projects/${resolvedProject.id}`
}

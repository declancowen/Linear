import type {
  AppData,
  Conversation,
  Project,
  Role,
  Team,
  TeamFeatureSettings,
  TeamWorkflowSettings,
  UserProfile,
  WorkStatus,
} from "@/lib/domain/types"
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

  return data.teams.filter((team) => membershipTeamIds.has(team.id))
}

export function getTeamBySlug(data: AppData, teamSlug: string) {
  return data.teams.find((team) => team.slug === teamSlug) ?? null
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

function mergeRole(currentRole: Role | null, nextRole: Role) {
  if (currentRole === "admin" || nextRole === "admin") {
    return "admin"
  }

  if (currentRole === "member" || nextRole === "member") {
    return "member"
  }

  if (currentRole === "viewer" || nextRole === "viewer") {
    return "viewer"
  }

  return nextRole
}

export function getWorkspaceRoleInCollections(
  workspaces: AppData["workspaces"],
  workspaceMemberships: AppData["workspaceMemberships"],
  teams: AppData["teams"],
  teamMemberships: AppData["teamMemberships"],
  workspaceId: string,
  userId: string
) {
  const workspace = workspaces.find((entry) => entry.id === workspaceId)

  if (!workspace) {
    return null
  }

  if (workspace.createdBy === userId) {
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

  const workspaceTeamIds = new Set(
    teams
      .filter((team) => team.workspaceId === workspaceId)
      .map((team) => team.id)
  )

  return (
    teamMemberships
      .filter(
        (membership) =>
          membership.userId === userId && workspaceTeamIds.has(membership.teamId)
      )
      .reduce<Role | null>(
        (currentRole, membership) => mergeRole(currentRole, membership.role),
        null
      ) ?? null
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
  const workspace = workspaces.find((entry) => entry.id === workspaceId)

  if (!workspace) {
    return false
  }

  if (workspace.createdBy === userId) {
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

export function hasLeftWorkspace(
  data: AppData,
  workspaceId: string,
  userId: string
) {
  return !hasWorkspaceAccess(data, workspaceId, userId)
}

export function canEditTeam(data: AppData, teamId: string) {
  const role = getTeamRole(data, teamId)
  return role === "admin" || role === "member"
}

export function canEditWorkspace(data: AppData, workspaceId: string) {
  const role = getWorkspaceRoleInCollections(
    data.workspaces,
    data.workspaceMemberships,
    data.teams,
    data.teamMemberships,
    workspaceId,
    data.currentUserId
  )

  return role === "admin" || role === "member"
}

export function canInviteToTeam(data: AppData, teamId: string) {
  return canEditTeam(data, teamId)
}

export function canAdminTeam(data: AppData, teamId: string) {
  return getTeamRole(data, teamId) === "admin"
}

export function canAdminWorkspace(data: AppData, workspaceId: string) {
  return (
    getWorkspaceRoleInCollections(
      data.workspaces,
      data.workspaceMemberships,
      data.teams,
      data.teamMemberships,
      workspaceId,
      data.currentUserId
    ) === "admin"
  )
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

export function getWorkItemHierarchyIds(data: AppData, itemId: string) {
  let root = getWorkItem(data, itemId)

  if (!root) {
    return new Set<string>()
  }

  const visited = new Set<string>([root.id])

  while (root.parentId) {
    const parent = getWorkItem(data, root.parentId)

    if (!parent || visited.has(parent.id)) {
      break
    }

    visited.add(parent.id)
    root = parent
  }

  return new Set<string>([root.id, ...getWorkItemDescendantIds(data, root.id)])
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
  const userIds = new Set(
    [
      ...data.workspaceMemberships
        .filter((membership) => membership.workspaceId === workspaceId)
        .map((membership) => membership.userId),
      ...data.teamMemberships
      .filter((membership) => teamIds.includes(membership.teamId))
      .map((membership) => membership.userId),
    ]
  )

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

export function getProjectContextLabel(
  data: AppData,
  project: Project | string | null | undefined
) {
  const resolvedProject =
    typeof project === "string" ? getProject(data, project) : project

  if (!resolvedProject) {
    return "Project"
  }

  const team = getProjectTeam(data, resolvedProject)

  if (team) {
    return team.name
  }

  return getCurrentWorkspace(data)?.name ?? "Workspace"
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

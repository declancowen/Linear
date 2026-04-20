import { api } from "@/convex/_generated/api"
import type {
  Priority,
  ProjectPresentationConfig,
  ProjectStatus,
  Role,
  TeamExperienceType,
  TeamWorkflowSettings,
  TemplateType,
} from "@/lib/domain/types"
import { coerceApplicationError } from "@/lib/server/application-errors"

import { getConvexServerClient, withServerToken } from "./core"
import { resolveServerOrigin } from "../request-origin"

const TEAM_JOIN_CODE_CONFLICT_MATCH = /join code (already exists|is already in use)/i

const REGENERATE_TEAM_JOIN_CODE_ERROR_MAPPINGS = [
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "Only team admins can regenerate join codes",
    status: 403,
    code: "TEAM_JOIN_CODE_ADMIN_REQUIRED",
  },
  {
    match: TEAM_JOIN_CODE_CONFLICT_MATCH,
    status: 409,
    code: "TEAM_JOIN_CODE_CONFLICT",
    retryable: true,
  },
] as const

const PROJECT_MUTATION_ERROR_MAPPINGS = [
  {
    match: "Project not found",
    status: 404,
    code: "PROJECT_NOT_FOUND",
  },
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "Settings team not found",
    status: 404,
    code: "PROJECT_SETTINGS_TEAM_NOT_FOUND",
  },
  {
    match: "Settings team must belong to the current workspace",
    status: 400,
    code: "PROJECT_SETTINGS_TEAM_SCOPE_INVALID",
  },
  {
    match: "Projects are disabled for this team",
    status: 400,
    code: "PROJECTS_DISABLED_FOR_TEAM",
  },
  {
    match: "Projects are disabled for the selected team",
    status: 400,
    code: "PROJECTS_DISABLED_FOR_SETTINGS_TEAM",
  },
  {
    match: "Project template is not allowed for this team",
    status: 400,
    code: "PROJECT_TEMPLATE_INVALID",
  },
  {
    match: "One or more labels are invalid",
    status: 400,
    code: "PROJECT_LABELS_INVALID",
  },
  {
    match: "Lead must belong to the selected team",
    status: 400,
    code: "PROJECT_LEAD_INVALID",
  },
  {
    match: "Lead must belong to the current workspace",
    status: 400,
    code: "PROJECT_LEAD_INVALID",
  },
  {
    match: "All project members must belong to the selected team",
    status: 400,
    code: "PROJECT_MEMBERS_INVALID",
  },
  {
    match: "All project members must belong to the current workspace",
    status: 400,
    code: "PROJECT_MEMBERS_INVALID",
  },
  {
    match: "Project name must be at least 2 characters",
    status: 400,
    code: "PROJECT_NAME_INVALID",
  },
  {
    match: "Project name must be at most 64 characters",
    status: 400,
    code: "PROJECT_NAME_INVALID",
  },
  {
    match: "Project labels must belong to the same workspace",
    status: 400,
    code: "PROJECT_LABELS_INVALID",
  },
  {
    match: "Target date must be on or after the start date",
    status: 400,
    code: "PROJECT_DATES_INVALID",
  },
  {
    match: (message: string) =>
      message === "Your current role is read-only" ||
      message === "You do not have access to this team" ||
      message === "You do not have access to this workspace",
    status: 403,
    code: "PROJECT_ACCESS_DENIED",
  },
] as const

const TEAM_FEATURE_VALIDATION_ERROR_MAPPINGS = [
  {
    match: "Community teams can only enable docs, chat, and channel surfaces.",
    status: 400,
    code: "TEAM_FEATURES_INVALID",
  },
  {
    match: "Community teams must enable docs, chat, channel, or a combination.",
    status: 400,
    code: "TEAM_FEATURES_INVALID",
  },
  {
    match: "Non-community teams must include the work surface, projects, and views.",
    status: 400,
    code: "TEAM_FEATURES_INVALID",
  },
] as const

const TEAM_SURFACE_DISABLE_ERROR_MAPPINGS = [
  {
    match: "Docs cannot be turned off while this team still has documents.",
    status: 409,
    code: "TEAM_FEATURE_DISABLE_CONFLICT",
  },
  {
    match: "Chat cannot be turned off while the team chat has messages.",
    status: 409,
    code: "TEAM_FEATURE_DISABLE_CONFLICT",
  },
  {
    match: "Channel cannot be turned off while posts exist.",
    status: 409,
    code: "TEAM_FEATURE_DISABLE_CONFLICT",
  },
] as const

const TEAM_CREATE_ERROR_MAPPINGS = [
  {
    match: "Workspace not found",
    status: 404,
    code: "WORKSPACE_NOT_FOUND",
  },
  {
    match: "Only workspace admins can perform this action",
    status: 403,
    code: "WORKSPACE_ADMIN_REQUIRED",
  },
  ...TEAM_FEATURE_VALIDATION_ERROR_MAPPINGS,
] as const

const TEAM_UPDATE_DETAILS_ERROR_MAPPINGS = [
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "Only team admins can update team details",
    status: 403,
    code: "TEAM_ADMIN_REQUIRED",
  },
  ...TEAM_FEATURE_VALIDATION_ERROR_MAPPINGS,
  ...TEAM_SURFACE_DISABLE_ERROR_MAPPINGS,
  {
    match: TEAM_JOIN_CODE_CONFLICT_MATCH,
    status: 409,
    code: "TEAM_JOIN_CODE_CONFLICT",
    retryable: true,
  },
] as const

const DELETE_TEAM_ERROR_MAPPINGS = [
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "Only team admins can delete the team",
    status: 403,
    code: "TEAM_ADMIN_REQUIRED",
  },
] as const

const LEAVE_TEAM_ERROR_MAPPINGS = [
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "You are not a member of this team",
    status: 404,
    code: "TEAM_MEMBERSHIP_NOT_FOUND",
  },
  {
    match: "Team admins can't leave the team",
    status: 409,
    code: "TEAM_LEAVE_ADMIN_FORBIDDEN",
  },
] as const

const TEAM_MEMBER_ROLE_ERROR_MAPPINGS = [
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "Only team admins can manage team members",
    status: 403,
    code: "TEAM_ADMIN_REQUIRED",
  },
  {
    match: "You can't change your own team access here",
    status: 409,
    code: "TEAM_MEMBER_SELF_MUTATION_FORBIDDEN",
  },
  {
    match: "Team member not found",
    status: 404,
    code: "TEAM_MEMBER_NOT_FOUND",
  },
  {
    match: "Teams must keep at least one admin",
    status: 409,
    code: "TEAM_LAST_ADMIN_REQUIRED",
  },
] as const

const TEAM_WORKFLOW_ERROR_MAPPINGS = [
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "Only team admins can update workflow settings",
    status: 403,
    code: "TEAM_ADMIN_REQUIRED",
  },
] as const

const TEAM_JOIN_BY_CODE_ERROR_MAPPINGS = [
  {
    match: "Join code not found",
    status: 404,
    code: "TEAM_JOIN_CODE_NOT_FOUND",
  },
  {
    match: "User not found",
    status: 404,
    code: "ACCOUNT_NOT_FOUND",
  },
] as const

export async function joinTeamByCodeServer(input: {
  currentUserId: string
  code: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.joinTeamByCode,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...TEAM_JOIN_BY_CODE_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function createProjectServer(input: {
  currentUserId: string
  scopeType: "team" | "workspace"
  scopeId: string
  templateType: TemplateType
  name: string
  summary: string
  status?: ProjectStatus
  priority: Priority
  leadId?: string | null
  memberIds?: string[]
  startDate?: string | null
  targetDate?: string | null
  labelIds?: string[]
  settingsTeamId?: string | null
  presentation?: ProjectPresentationConfig
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.createProject,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...PROJECT_MUTATION_ERROR_MAPPINGS]) ?? error
    )
  }
}

export async function updateProjectServer(input: {
  currentUserId: string
  projectId: string
  patch: {
    name?: string
    status?: ProjectStatus
    priority?: Priority
  }
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.updateProject,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...PROJECT_MUTATION_ERROR_MAPPINGS]) ?? error
    )
  }
}

export async function renameProjectServer(input: {
  currentUserId: string
  projectId: string
  name: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.renameProject,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...PROJECT_MUTATION_ERROR_MAPPINGS]) ?? error
    )
  }
}

export async function deleteProjectServer(input: {
  currentUserId: string
  projectId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.deleteProject,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...PROJECT_MUTATION_ERROR_MAPPINGS]) ?? error
    )
  }
}

export async function updateTeamWorkflowSettingsServer(input: {
  currentUserId: string
  teamId: string
  workflow: TeamWorkflowSettings
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.updateTeamWorkflowSettings,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...TEAM_WORKFLOW_ERROR_MAPPINGS]) ?? error
    )
  }
}

export async function updateTeamMemberRoleServer(input: {
  currentUserId: string
  teamId: string
  userId: string
  role: Role
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.updateTeamMemberRole,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...TEAM_MEMBER_ROLE_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function updateTeamDetailsServer(input: {
  currentUserId: string
  teamId: string
  name: string
  icon: string
  summary: string
  joinCode?: string
  experience: TeamExperienceType
  features: {
    issues: boolean
    projects: boolean
    views: boolean
    docs: boolean
    chat: boolean
    channels: boolean
  }
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.updateTeamDetails,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...TEAM_UPDATE_DETAILS_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function createTeamServer(input: {
  currentUserId: string
  workspaceId: string
  name: string
  icon: string
  summary: string
  joinCode: string
  experience: TeamExperienceType
  features: {
    issues: boolean
    projects: boolean
    views: boolean
    docs: boolean
    chat: boolean
    channels: boolean
  }
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.createTeam,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...TEAM_CREATE_ERROR_MAPPINGS]) ?? error
  }
}

export async function deleteTeamServer(input: {
  currentUserId: string
  teamId: string
}) {
  try {
    const origin = await resolveServerOrigin()

    return await getConvexServerClient().mutation(
      api.app.deleteTeam,
      withServerToken({
        ...input,
        origin,
      })
    )
  } catch (error) {
    throw coerceApplicationError(error, [...DELETE_TEAM_ERROR_MAPPINGS]) ?? error
  }
}

export async function leaveTeamServer(input: {
  currentUserId: string
  teamId: string
}) {
  try {
    const origin = await resolveServerOrigin()

    return await getConvexServerClient().mutation(
      api.app.leaveTeam,
      withServerToken({
        ...input,
        origin,
      })
    )
  } catch (error) {
    throw coerceApplicationError(error, [...LEAVE_TEAM_ERROR_MAPPINGS]) ?? error
  }
}

export async function removeTeamMemberServer(input: {
  currentUserId: string
  teamId: string
  userId: string
}) {
  try {
    const origin = await resolveServerOrigin()

    return await getConvexServerClient().mutation(
      api.app.removeTeamMember,
      withServerToken({
        ...input,
        origin,
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...TEAM_MEMBER_ROLE_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function regenerateTeamJoinCodeServer(input: {
  currentUserId: string
  teamId: string
  joinCode: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.regenerateTeamJoinCode,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...REGENERATE_TEAM_JOIN_CODE_ERROR_MAPPINGS]) ??
      error
    )
  }
}

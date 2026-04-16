import { api } from "@/convex/_generated/api"
import type {
  Priority,
  ProjectPresentationConfig,
  TeamExperienceType,
  TeamWorkflowSettings,
  TemplateType,
} from "@/lib/domain/types"

import { getConvexServerClient, withServerToken } from "./core"

export async function joinTeamByCodeServer(input: {
  currentUserId: string
  code: string
}) {
  return getConvexServerClient().mutation(
    api.app.joinTeamByCode,
    withServerToken(input)
  )
}

export async function createProjectServer(input: {
  currentUserId: string
  scopeType: "team" | "workspace"
  scopeId: string
  templateType: TemplateType
  name: string
  summary: string
  priority: Priority
  settingsTeamId?: string | null
  presentation?: ProjectPresentationConfig
}) {
  return getConvexServerClient().mutation(
    api.app.createProject,
    withServerToken(input)
  )
}

export async function updateProjectServer(input: {
  currentUserId: string
  projectId: string
  patch: {
    status?: "planning" | "active" | "paused" | "completed"
    priority?: Priority
  }
}) {
  return getConvexServerClient().mutation(
    api.app.updateProject,
    withServerToken(input)
  )
}

export async function updateTeamWorkflowSettingsServer(input: {
  currentUserId: string
  teamId: string
  workflow: TeamWorkflowSettings
}) {
  return getConvexServerClient().mutation(
    api.app.updateTeamWorkflowSettings,
    withServerToken(input)
  )
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
  return getConvexServerClient().mutation(
    api.app.updateTeamDetails,
    withServerToken(input)
  )
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
  return getConvexServerClient().mutation(
    api.app.createTeam,
    withServerToken(input)
  )
}

export async function deleteTeamServer(input: {
  currentUserId: string
  teamId: string
}) {
  return getConvexServerClient().mutation(
    api.app.deleteTeam,
    withServerToken(input)
  )
}

export async function regenerateTeamJoinCodeServer(input: {
  currentUserId: string
  teamId: string
  joinCode: string
}) {
  return getConvexServerClient().mutation(
    api.app.regenerateTeamJoinCode,
    withServerToken(input)
  )
}

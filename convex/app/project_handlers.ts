import { addDays } from "date-fns"

import type { MutationCtx } from "../_generated/server"

import {
  type Priority,
  type ProjectPresentationConfig,
  type ProjectStatus,
  type TemplateType,
  createDefaultProjectPresentationConfig,
  getAllowedTemplateTypesForTeamExperience,
} from "../../lib/domain/types"
import { assertServerToken, createId, getNow } from "./core"
import { getProjectDoc, getTeamDoc } from "./data"
import {
  requireEditableTeamAccess,
  requireEditableWorkspaceAccess,
} from "./access"
import {
  normalizeTeam,
  normalizeTeamWorkflowSettings,
} from "./normalization"
import { assertWorkspaceLabelIds } from "./work_helpers"

type ServerAccessArgs = {
  serverToken: string
}

type CreateProjectArgs = ServerAccessArgs & {
  currentUserId: string
  scopeType: "team" | "workspace"
  scopeId: string
  templateType: TemplateType
  name: string
  summary: string
  priority: Priority
  settingsTeamId?: string | null
  presentation?: ProjectPresentationConfig
}

type UpdateProjectArgs = ServerAccessArgs & {
  currentUserId: string
  projectId: string
  patch: {
    status?: ProjectStatus
    priority?: Priority
  }
}

export async function createProjectHandler(
  ctx: MutationCtx,
  args: CreateProjectArgs
) {
  assertServerToken(args.serverToken)
  let settingsTeam = null
  let workspaceId = args.scopeId

  if (args.scopeType === "team") {
    await requireEditableTeamAccess(ctx, args.scopeId, args.currentUserId)
    settingsTeam = await getTeamDoc(ctx, args.scopeId)

    if (!settingsTeam) {
      throw new Error("Team not found")
    }

    workspaceId = settingsTeam.workspaceId

    if (!normalizeTeam(settingsTeam).settings.features.projects) {
      throw new Error("Projects are disabled for this team")
    }
  } else {
    await requireEditableWorkspaceAccess(ctx, args.scopeId, args.currentUserId)

    if (args.settingsTeamId) {
      settingsTeam = await getTeamDoc(ctx, args.settingsTeamId)

      if (!settingsTeam) {
        throw new Error("Settings team not found")
      }

      if (settingsTeam.workspaceId !== args.scopeId) {
        throw new Error("Settings team must belong to the current workspace")
      }

      await requireEditableTeamAccess(
        ctx,
        settingsTeam.id,
        args.currentUserId
      )

      if (!normalizeTeam(settingsTeam).settings.features.projects) {
        throw new Error("Projects are disabled for the selected team")
      }
    }
  }

  await assertWorkspaceLabelIds(
    ctx,
    workspaceId,
    args.presentation?.filters.labelIds
  )

  const settingsTeamExperience =
    (
      settingsTeam?.settings as {
        experience?:
          | "software-development"
          | "issue-analysis"
          | "project-management"
          | "community"
      } | null
    )?.experience ?? "software-development"

  if (
    !getAllowedTemplateTypesForTeamExperience(settingsTeamExperience).includes(
      args.templateType
    )
  ) {
    throw new Error("Project template is not allowed for this team")
  }

  const workflow = normalizeTeamWorkflowSettings(
    settingsTeam?.settings.workflow,
    settingsTeamExperience
  )
  const templateDefaults = workflow.templateDefaults[args.templateType]
  const presentation =
    args.presentation ??
    createDefaultProjectPresentationConfig(args.templateType, {
      layout: templateDefaults.defaultViewLayout,
    })
  const now = new Date()

  await ctx.db.insert("projects", {
    id: createId("project"),
    scopeType: args.scopeType,
    scopeId: args.scopeId,
    templateType: args.templateType,
    name: args.name,
    summary: args.summary,
    description: `${args.name} was created from the ${args.templateType} template.`,
    leadId: args.currentUserId,
    memberIds: [args.currentUserId],
    health: "no-update",
    priority: args.priority,
    status: "planning",
    presentation,
    startDate: getNow(),
    targetDate: addDays(now, templateDefaults.targetWindowDays).toISOString(),
    createdAt: getNow(),
    updatedAt: getNow(),
  })
}

export async function updateProjectHandler(
  ctx: MutationCtx,
  args: UpdateProjectArgs
) {
  assertServerToken(args.serverToken)
  const project = await getProjectDoc(ctx, args.projectId)

  if (!project) {
    throw new Error("Project not found")
  }

  if (project.scopeType === "team") {
    await requireEditableTeamAccess(ctx, project.scopeId, args.currentUserId)
  } else {
    await requireEditableWorkspaceAccess(
      ctx,
      project.scopeId,
      args.currentUserId
    )
  }

  await ctx.db.patch(project._id, {
    ...args.patch,
    updatedAt: getNow(),
  })
}

import type { MutationCtx } from "../_generated/server"

import {
  addLocalCalendarDays,
  formatLocalCalendarDate,
  getCalendarDatePrefix,
  isValidCalendarDateString,
} from "../../lib/calendar-date"
import {
  type Priority,
  type ProjectPresentationConfig,
  type ProjectStatus,
  type TemplateType,
  createDefaultProjectPresentationConfig,
  getAllowedTemplateTypesForTeamExperience,
  projectNameMaxLength,
  projectNameMinLength,
} from "../../lib/domain/types"
import { assertServerToken, createId, getNow } from "./core"
import {
  getProjectDoc,
  getTeamDoc,
  listMilestonesByProject,
  listNotificationsByEntity,
  listProjectUpdatesByProject,
  listWorkspaceMembershipsByWorkspace,
  listViewsByScope,
  listTeamMembershipsByTeam,
} from "./data"
import {
  requireEditableTeamAccess,
  requireEditableWorkspaceAccess,
} from "./access"
import {
  normalizeTeam,
  normalizeTeamWorkflowSettings,
} from "./normalization"
import { assertWorkspaceLabelIds } from "./work_helpers"
import {
  cleanupRemainingLinksAfterDelete,
  cleanupViewFiltersForDeletedEntities,
  deleteDocs,
} from "./cleanup"

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
  status?: ProjectStatus
  priority: Priority
  leadId?: string | null
  memberIds?: string[]
  startDate?: string | null
  targetDate?: string | null
  labelIds?: string[]
  settingsTeamId?: string | null
  presentation?: ProjectPresentationConfig
}

type UpdateProjectArgs = ServerAccessArgs & {
  currentUserId: string
  projectId: string
  patch: {
    name?: string
    status?: ProjectStatus
    priority?: Priority
  }
}

type RenameProjectArgs = ServerAccessArgs & {
  currentUserId: string
  projectId: string
  name: string
}

type DeleteProjectArgs = ServerAccessArgs & {
  currentUserId: string
  projectId: string
}

function assertProjectNameLength(name: string) {
  if (name.length < projectNameMinLength) {
    throw new Error(
      `Project name must be at least ${projectNameMinLength} characters`
    )
  }

  if (name.length > projectNameMaxLength) {
    throw new Error(
      `Project name must be at most ${projectNameMaxLength} characters`
    )
  }
}

function assertProjectScheduleDate(
  value: string | null | undefined,
  label: "Start date" | "Target date"
) {
  if (value !== undefined && value !== null && !isValidCalendarDateString(value)) {
    throw new Error(`${label} must be a valid calendar date`)
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
  await assertWorkspaceLabelIds(ctx, workspaceId, args.labelIds)

  const trimmedName = args.name.trim()

  assertProjectNameLength(trimmedName)

  const resolvedLeadId = args.leadId ?? args.currentUserId
  const resolvedMemberIds = [
    ...new Set([...(args.memberIds ?? []), resolvedLeadId].filter(Boolean)),
  ]

  if (settingsTeam) {
    const teamMemberships = await listTeamMembershipsByTeam(ctx, settingsTeam.id)
    const teamMemberIds = new Set(
      teamMemberships.map((membership) => membership.userId)
    )

    if (!teamMemberIds.has(resolvedLeadId)) {
      throw new Error("Lead must belong to the selected team")
    }

    if (!resolvedMemberIds.every((memberId) => teamMemberIds.has(memberId))) {
      throw new Error("All project members must belong to the selected team")
    }
  } else if (args.scopeType === "workspace") {
    const workspaceMemberships = await listWorkspaceMembershipsByWorkspace(
      ctx,
      workspaceId
    )
    const workspaceMemberIds = new Set(
      workspaceMemberships.map((membership) => membership.userId)
    )

    if (!workspaceMemberIds.has(resolvedLeadId)) {
      throw new Error("Lead must belong to the current workspace")
    }

    if (
      !resolvedMemberIds.every((memberId) => workspaceMemberIds.has(memberId))
    ) {
      throw new Error(
        "All project members must belong to the current workspace"
      )
    }
  }

  assertProjectScheduleDate(args.startDate, "Start date")
  assertProjectScheduleDate(args.targetDate, "Target date")

  const startDatePrefix = getCalendarDatePrefix(args.startDate)
  const targetDatePrefix = getCalendarDatePrefix(args.targetDate)

  if (
    startDatePrefix &&
    targetDatePrefix &&
    targetDatePrefix < startDatePrefix
  ) {
    throw new Error("Target date must be on or after the start date")
  }

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

  await ctx.db.insert("projects", {
    id: createId("project"),
    scopeType: args.scopeType,
    scopeId: args.scopeId,
    templateType: args.templateType,
    name: trimmedName,
    summary: args.summary,
    description: `${trimmedName} was created from the ${args.templateType} template.`,
    leadId: resolvedLeadId,
    memberIds: resolvedMemberIds,
    health: "no-update",
    priority: args.priority,
    status: args.status ?? "backlog",
    labelIds: [...new Set(args.labelIds ?? [])],
    blockingProjectIds: [],
    blockedByProjectIds: [],
    presentation,
    startDate: args.startDate ?? formatLocalCalendarDate(),
    targetDate:
      args.targetDate ?? addLocalCalendarDays(templateDefaults.targetWindowDays),
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

  const nextPatch = { ...args.patch }

  if (typeof nextPatch.name === "string") {
    const trimmedName = nextPatch.name.trim()

    assertProjectNameLength(trimmedName)
    nextPatch.name = trimmedName
  }

  await ctx.db.patch(project._id, {
    ...nextPatch,
    updatedAt: getNow(),
  })
}

export async function renameProjectHandler(
  ctx: MutationCtx,
  args: RenameProjectArgs
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

  const trimmedName = args.name.trim()

  assertProjectNameLength(trimmedName)

  await ctx.db.patch(project._id, {
    name: trimmedName,
    updatedAt: getNow(),
  })
}

export async function deleteProjectHandler(
  ctx: MutationCtx,
  args: DeleteProjectArgs
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

  const team =
    project.scopeType === "team" ? await getTeamDoc(ctx, project.scopeId) : null
  const detailRoute =
    project.scopeType === "workspace"
      ? `/workspace/projects/${project.id}`
      : team
        ? `/team/${team.slug}/projects/${project.id}`
        : null
  const [milestones, projectUpdates, notifications, scopedViews, containerViews] =
    await Promise.all([
      listMilestonesByProject(ctx, project.id),
      listProjectUpdatesByProject(ctx, project.id),
      listNotificationsByEntity(ctx, "project", project.id),
      listViewsByScope(ctx, project.scopeType, project.scopeId),
      ctx.db
        .query("views")
        .withIndex("by_container", (q) =>
          q.eq("containerType", "project-items").eq("containerId", project.id)
        )
        .collect(),
    ])

  const deletedProjectIds = new Set([project.id])
  const deletedMilestoneIds = new Set(milestones.map((milestone) => milestone.id))
  const customProjectViews = scopedViews.filter(
    (view) =>
      (view.containerType === "project-items" && view.containerId === project.id) ||
      (detailRoute !== null &&
        !view.containerType &&
        view.entityKind === "items" &&
        view.route === detailRoute)
  )
  const viewsToDelete = [
    ...new Map(
      [...customProjectViews, ...containerViews].map((view) => [view._id, view] as const)
    ).values(),
  ]

  await cleanupRemainingLinksAfterDelete(ctx, {
    currentUserId: args.currentUserId,
    deletedProjectIds,
    deletedMilestoneIds,
  })
  await cleanupViewFiltersForDeletedEntities(ctx, {
    deletedProjectIds,
    deletedMilestoneIds,
  })

  await deleteDocs(ctx, viewsToDelete)
  await deleteDocs(ctx, projectUpdates)
  await deleteDocs(ctx, milestones)
  await deleteDocs(ctx, notifications)
  await ctx.db.delete(project._id)
}

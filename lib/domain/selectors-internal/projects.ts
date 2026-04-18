import type {
  AppData,
  Document,
  Project,
  Team,
  UserProfile,
  WorkItem,
} from "@/lib/domain/types"
import {
  normalizeTeamIconToken,
  teamExperienceMeta,
  teamIconMeta,
} from "@/lib/domain/types"

import {
  getProject,
  getProjectHref,
  getProjectTeam,
  getUser,
} from "@/lib/domain/selectors-internal/core"
import {
  comparePriority,
  sortItems,
} from "@/lib/domain/selectors-internal/work-items"
import type { OrderingField, ViewDefinition } from "@/lib/domain/types"

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

function projectMatchesView(
  project: Project,
  view: Pick<ViewDefinition, "filters">
) {
  if (
    view.filters.priority.length > 0 &&
    !view.filters.priority.includes(project.priority)
  ) {
    return false
  }

  if (
    view.filters.leadIds.length > 0 &&
    !view.filters.leadIds.includes(project.leadId)
  ) {
    return false
  }

  if (
    view.filters.health.length > 0 &&
    !view.filters.health.includes(project.health)
  ) {
    return false
  }

  if (
    view.filters.projectIds.length > 0 &&
    !view.filters.projectIds.includes(project.id)
  ) {
    return false
  }

  if (view.filters.teamIds.length > 0) {
    const projectTeamId = project.scopeType === "team" ? project.scopeId : ""

    if (!view.filters.teamIds.includes(projectTeamId)) {
      return false
    }
  }

  if (!view.filters.showCompleted && project.status === "completed") {
    return false
  }

  return true
}

export function sortProjects(projects: Project[], ordering: OrderingField) {
  return [...projects].sort((left, right) => {
    if (ordering === "priority") {
      return comparePriority(left.priority, right.priority)
    }

    if (ordering === "title") {
      return left.name.localeCompare(right.name)
    }

    const leftValue =
      ordering === "dueDate" ? left.targetDate : left[ordering]
    const rightValue =
      ordering === "dueDate" ? right.targetDate : right[ordering]

    if (!leftValue && !rightValue) {
      return left.name.localeCompare(right.name)
    }

    if (!leftValue) {
      return 1
    }

    if (!rightValue) {
      return -1
    }

    const comparison =
      typeof leftValue === "string" && typeof rightValue === "string"
        ? rightValue.localeCompare(leftValue)
        : 0

    return comparison !== 0
      ? comparison
      : left.name.localeCompare(right.name)
  })
}

export function getVisibleProjectsForView(
  _data: AppData,
  projects: Project[],
  view: ViewDefinition
) {
  return sortProjects(
    projects.filter((project) => projectMatchesView(project, view)),
    view.ordering
  )
}

export function getProjectDetailModel(data: AppData, projectId: string) {
  const project = getProject(data, projectId)

  if (!project) {
    return null
  }

  const team = getProjectTeam(data, project)
  const progress = getProjectProgress(data, project.id)
  const items = sortItems(
    data.workItems.filter(
      (item) =>
        item.primaryProjectId === project.id ||
        item.linkedProjectIds.includes(project.id)
    ),
    "priority"
  )
  const milestones = data.milestones
    .filter((milestone) => milestone.projectId === project.id)
    .sort(
      (left, right) =>
        (left.targetDate ?? "").localeCompare(right.targetDate ?? "") ||
        left.name.localeCompare(right.name)
    )
  const updates = data.projectUpdates
    .filter((update) => update.projectId === project.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const documents = data.documents
    .filter(
      (document) =>
        document.kind !== "item-description" &&
        document.linkedProjectIds.includes(project.id)
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const members = project.memberIds
    .map((memberId) => getUser(data, memberId))
    .filter((user): user is UserProfile => Boolean(user))

  return {
    project,
    team,
    progress,
    items,
    milestones,
    updates,
    documents,
    members,
    contextLabel: team ? `${team.name} projects` : "Workspace projects",
    backHref: team ? `/team/${team.slug}/projects` : "/workspace/projects",
    detailHref: getProjectHref(data, project) ?? `/projects/${project.id}`,
    teamTypeLabel: team
      ? teamIconMeta[
          normalizeTeamIconToken(team.icon, team.settings.experience)
        ].label
      : null,
    teamExperienceLabel: team
      ? teamExperienceMeta[team.settings.experience].label
      : null,
  }
}

export function isGuestVisible(
  data: AppData,
  team: Team,
  entity: Project | Document | WorkItem
) {
  void data

  if ("templateType" in entity) {
    return team.settings.guestProjectIds.includes(entity.id)
  }

  if ("key" in entity) {
    return team.settings.guestWorkItemIds.includes(entity.id)
  }

  return team.settings.guestDocumentIds.includes(entity.id)
}

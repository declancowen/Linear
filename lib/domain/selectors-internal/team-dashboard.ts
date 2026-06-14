import {
  workItemTypes,
  workStatuses,
  type Project,
  type WorkItem,
  type WorkItemType,
  type WorkStatus,
} from "@/lib/domain/types"

/**
 * Team-dashboard read models. These are pure, framework-free derivations over
 * team-scoped work items so the dashboard presentation layer stays a thin view.
 * Completion semantics: a "done" item is complete; "cancelled"/"duplicate" are
 * non-actionable and excluded from the denominator so percentages reflect real
 * progress rather than being diluted by abandoned work.
 */

const NON_ACTIONABLE_STATUSES: ReadonlySet<WorkStatus> = new Set<WorkStatus>([
  "cancelled",
  "duplicate",
])
const COMPLETED_STATUS: WorkStatus = "done"

function getDashboardVisibleItems(items: WorkItem[]) {
  return items.filter((item) => (item.visibility ?? "team") !== "private")
}

export type CompletionStat = {
  total: number
  completed: number
  /** Items excluded from the denominator (cancelled/duplicate). */
  excluded: number
  /** 0–100, rounded; 0 when there is nothing actionable. */
  percent: number
}

export type TypeCompletionStat = CompletionStat & {
  type: WorkItemType
}

export type TeamDashboardCompletion = {
  overall: CompletionStat
  byType: TypeCompletionStat[]
}

function computeCompletionStat(items: WorkItem[]): CompletionStat {
  const visibleItems = getDashboardVisibleItems(items)
  let completed = 0
  let excluded = 0

  for (const item of visibleItems) {
    if (NON_ACTIONABLE_STATUSES.has(item.status)) {
      excluded += 1
      continue
    }

    if (item.status === COMPLETED_STATUS) {
      completed += 1
    }
  }

  const total = visibleItems.length - excluded

  return {
    total,
    completed,
    excluded,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  }
}

/**
 * Completion percentages overall and per work-item type (epics → features →
 * requirements → stories → tasks → sub-tasks, plus issues → sub-issues), in the
 * canonical type order. Types with no items are omitted so the chart only shows
 * lanes that exist in the team.
 */
export function getTeamDashboardCompletion(
  items: WorkItem[]
): TeamDashboardCompletion {
  const visibleItems = getDashboardVisibleItems(items)
  const byType: TypeCompletionStat[] = []

  for (const type of workItemTypes) {
    const typeItems = visibleItems.filter((item) => item.type === type)

    if (typeItems.length === 0) {
      continue
    }

    byType.push({ type, ...computeCompletionStat(typeItems) })
  }

  return {
    overall: computeCompletionStat(visibleItems),
    byType,
  }
}

export type StatusBreakdownEntry = {
  status: WorkStatus
  count: number
}

/**
 * Count of items per status, in canonical status order, omitting statuses with
 * no items so the breakdown stays focused on what the team actually has.
 */
export function getTeamDashboardStatusBreakdown(
  items: WorkItem[]
): StatusBreakdownEntry[] {
  const counts = new Map<WorkStatus, number>()

  for (const item of getDashboardVisibleItems(items)) {
    counts.set(item.status, (counts.get(item.status) ?? 0) + 1)
  }

  return workStatuses
    .map((status) => ({ status, count: counts.get(status) ?? 0 }))
    .filter((entry) => entry.count > 0)
}

export type ProjectProgress = {
  projectId: string
  name: string
  completion: CompletionStat
}

/**
 * Completion progress per project, derived from the items primarily assigned to
 * each project. Projects are matched by `primaryProjectId` so an item counts
 * once toward its owning project. Returned in the given project order.
 */
export function getTeamDashboardProjectProgress(
  projects: Pick<Project, "id" | "name">[],
  items: WorkItem[]
): ProjectProgress[] {
  const itemsByProject = new Map<string, WorkItem[]>()

  for (const item of getDashboardVisibleItems(items)) {
    if (!item.primaryProjectId) {
      continue
    }

    const bucket = itemsByProject.get(item.primaryProjectId)

    if (bucket) {
      bucket.push(item)
      continue
    }

    itemsByProject.set(item.primaryProjectId, [item])
  }

  return projects.map((project) => ({
    projectId: project.id,
    name: project.name,
    completion: computeCompletionStat(itemsByProject.get(project.id) ?? []),
  }))
}

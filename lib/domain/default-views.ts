import type { ViewDefinition } from "@/lib/domain/types"

function createDefaultFilters(): ViewDefinition["filters"] {
  return {
    status: [],
    priority: [],
    assigneeIds: [],
    creatorIds: [],
    leadIds: [],
    health: [],
    milestoneIds: [],
    relationTypes: [],
    projectIds: [],
    itemTypes: [],
    labelIds: [],
    teamIds: [],
    showCompleted: true,
  }
}

export const canonicalTeamIssueViewNames = [
  "All issues",
  "Active",
  "Backlog",
] as const

function getCanonicalTeamIssueViewOrder(name: string) {
  const index = canonicalTeamIssueViewNames.indexOf(
    name as (typeof canonicalTeamIssueViewNames)[number]
  )

  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

export function isCanonicalTeamIssueViewName(name: string) {
  return canonicalTeamIssueViewNames.includes(
    name as (typeof canonicalTeamIssueViewNames)[number]
  )
}

export function buildTeamIssueViews(input: {
  teamId: string
  teamSlug: string
  createdAt: string
  updatedAt?: string
}): ViewDefinition[] {
  const route = `/team/${input.teamSlug}/work`
  const updatedAt = input.updatedAt ?? input.createdAt

  return [
    {
      id: `view_${input.teamId}_all_issues`,
      name: "All issues",
      description: "Everything in the team grouped by status.",
      scopeType: "team",
      scopeId: input.teamId,
      entityKind: "items",
      layout: "list",
      filters: createDefaultFilters(),
      grouping: "status",
      subGrouping: null,
      ordering: "priority",
      displayProps: [
        "id",
        "status",
        "assignee",
        "priority",
        "project",
        "updated",
      ],
      hiddenState: { groups: [], subgroups: ["cancelled", "duplicate"] },
      isShared: true,
      route,
      createdAt: input.createdAt,
      updatedAt,
    },
    {
      id: `view_${input.teamId}_active_issues`,
      name: "Active",
      description: "Current work ready for execution.",
      scopeType: "team",
      scopeId: input.teamId,
      entityKind: "items",
      layout: "board",
      filters: {
        ...createDefaultFilters(),
        status: ["todo", "in-progress"],
      },
      grouping: "status",
      subGrouping: null,
      ordering: "priority",
      displayProps: [
        "id",
        "status",
        "assignee",
        "priority",
        "project",
        "created",
      ],
      hiddenState: { groups: [], subgroups: ["cancelled", "duplicate"] },
      isShared: true,
      route,
      createdAt: input.createdAt,
      updatedAt,
    },
    {
      id: `view_${input.teamId}_backlog_issues`,
      name: "Backlog",
      description: "Upcoming work still in queue.",
      scopeType: "team",
      scopeId: input.teamId,
      entityKind: "items",
      layout: "list",
      filters: {
        ...createDefaultFilters(),
        status: ["backlog"],
      },
      grouping: "priority",
      subGrouping: null,
      ordering: "targetDate",
      displayProps: ["id", "project", "priority", "assignee", "dueDate"],
      hiddenState: { groups: [], subgroups: [] },
      isShared: true,
      route,
      createdAt: input.createdAt,
      updatedAt,
    },
  ]
}

export function sortViewsForDisplay(views: ViewDefinition[]) {
  return [...views].sort((left, right) => {
    const canonicalOrderDiff =
      getCanonicalTeamIssueViewOrder(left.name) -
      getCanonicalTeamIssueViewOrder(right.name)

    if (canonicalOrderDiff !== 0) {
      return canonicalOrderDiff
    }

    if (left.isShared !== right.isShared) {
      return left.isShared ? -1 : 1
    }

    return left.name.localeCompare(right.name)
  })
}

export function getViewHref(view: ViewDefinition) {
  const separator = view.route.includes("?") ? "&" : "?"
  return `${view.route}${separator}view=${encodeURIComponent(view.id)}`
}

import {
  getWorkSurfaceCopy,
  type TeamExperienceType,
  type ViewDefinition,
} from "@/lib/domain/types"

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

function getCanonicalPrimaryViewName(
  experience: TeamExperienceType | null | undefined
) {
  const surfaceLabel = getWorkSurfaceCopy(experience).surfaceLabel

  if (surfaceLabel === "Tasks") {
    return "All tasks"
  }

  if (surfaceLabel === "Issues") {
    return "All issues"
  }

  return "All work"
}

function getCanonicalTeamViewOrder(name: string) {
  if (name === "All work" || name === "All issues" || name === "All tasks") {
    return 0
  }

  if (name === "Active") {
    return 1
  }

  if (name === "Backlog") {
    return 2
  }

  return Number.MAX_SAFE_INTEGER
}

export function buildTeamWorkViews(input: {
  teamId: string
  teamSlug: string
  createdAt: string
  updatedAt?: string
  experience?: TeamExperienceType | null
}): ViewDefinition[] {
  const route = `/team/${input.teamSlug}/work`
  const updatedAt = input.updatedAt ?? input.createdAt
  const surfaceLabel = getWorkSurfaceCopy(input.experience).surfaceLabel
  const primaryViewName = getCanonicalPrimaryViewName(input.experience)
  const lowercaseSurfaceLabel = surfaceLabel.toLowerCase()

  return [
    {
      id: `view_${input.teamId}_all_items`,
      name: primaryViewName,
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
      id: `view_${input.teamId}_active_items`,
      name: "Active",
      description: `Current ${lowercaseSurfaceLabel} ready for execution.`,
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
      id: `view_${input.teamId}_backlog_items`,
      name: "Backlog",
      description: `Upcoming ${lowercaseSurfaceLabel} still in queue.`,
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
      getCanonicalTeamViewOrder(left.name) -
      getCanonicalTeamViewOrder(right.name)

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

import {
  createDefaultViewFilters,
  getDefaultShowChildItemsForItemLevel,
  getDefaultViewItemLevelForTeamExperience,
  getWorkSurfaceCopy,
  type EntityKind,
  type TeamExperienceType,
  type ViewContainerType,
  type ViewDefinition,
} from "@/lib/domain/types"

type ViewConfigOverrides = Partial<
  Pick<
    ViewDefinition,
    | "layout"
    | "filters"
    | "grouping"
    | "subGrouping"
    | "ordering"
    | "displayProps"
    | "hiddenState"
    | "itemLevel"
    | "showChildItems"
  >
>

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
  if (
    name === "All work" ||
    name === "All issues" ||
    name === "All tasks" ||
    name === "All projects"
  ) {
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

export function getDefaultRouteForViewContext(input: {
  scopeType: "team" | "workspace"
  entityKind: EntityKind
  teamSlug?: string | null
}) {
  if (input.scopeType === "team") {
    if (!input.teamSlug) {
      return null
    }

    if (input.entityKind === "items") {
      return `/team/${input.teamSlug}/work`
    }

    if (input.entityKind === "projects") {
      return `/team/${input.teamSlug}/projects`
    }

    return `/team/${input.teamSlug}/docs`
  }

  if (input.entityKind === "projects") {
    return "/workspace/projects"
  }

  if (input.entityKind === "docs") {
    return "/workspace/docs"
  }

  return null
}

export function isRouteAllowedForViewContext(input: {
  scopeType: "team" | "workspace"
  entityKind: EntityKind
  route: string
  teamSlug?: string | null
}) {
  if (input.scopeType === "team") {
    if (!input.teamSlug) {
      return false
    }

    if (input.entityKind === "items") {
      return (
        input.route === `/team/${input.teamSlug}/work` ||
        input.route.startsWith(`/team/${input.teamSlug}/projects/`)
      )
    }

    if (input.entityKind === "projects") {
      return input.route === `/team/${input.teamSlug}/projects`
    }

    return input.route === `/team/${input.teamSlug}/docs`
  }

  if (input.entityKind === "items") {
    return input.route.startsWith("/workspace/projects/")
  }

  if (input.entityKind === "projects") {
    return input.route === "/workspace/projects"
  }

  return input.route === "/workspace/docs"
}

export function createViewDefinition(input: {
  id: string
  name: string
  description: string
  scopeType: "team" | "workspace"
  scopeId: string
  entityKind: EntityKind
  containerType?: ViewContainerType | null
  containerId?: string | null
  createdAt: string
  updatedAt?: string
  route?: string | null
  teamSlug?: string | null
  experience?: TeamExperienceType | null
  isShared?: boolean
  overrides?: ViewConfigOverrides
}): ViewDefinition | null {
  const route =
    input.route ??
    getDefaultRouteForViewContext({
      scopeType: input.scopeType,
      entityKind: input.entityKind,
      teamSlug: input.teamSlug,
    })

  if (!route) {
    return null
  }

  const updatedAt = input.updatedAt ?? input.createdAt
  const baseItemLevel =
    input.entityKind === "items" && input.scopeType === "team"
      ? getDefaultViewItemLevelForTeamExperience(input.experience)
      : null
  const itemLevel =
    input.overrides?.itemLevel === undefined
      ? baseItemLevel
      : input.overrides.itemLevel
  const showChildItems =
    input.overrides?.showChildItems ??
    (input.entityKind === "items" && itemLevel
      ? getDefaultShowChildItemsForItemLevel(itemLevel)
      : false)

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    entityKind: input.entityKind,
    ...(input.containerType ? { containerType: input.containerType } : {}),
    ...(input.containerId ? { containerId: input.containerId } : {}),
    itemLevel,
    showChildItems,
    layout: input.overrides?.layout ?? "list",
    filters: input.overrides?.filters
      ? {
          ...input.overrides.filters,
          status: [...input.overrides.filters.status],
          priority: [...input.overrides.filters.priority],
          assigneeIds: [...input.overrides.filters.assigneeIds],
          creatorIds: [...input.overrides.filters.creatorIds],
          leadIds: [...input.overrides.filters.leadIds],
          health: [...input.overrides.filters.health],
          milestoneIds: [...input.overrides.filters.milestoneIds],
          relationTypes: [...input.overrides.filters.relationTypes],
          projectIds: [...input.overrides.filters.projectIds],
          itemTypes: [...input.overrides.filters.itemTypes],
          labelIds: [...input.overrides.filters.labelIds],
          teamIds: [...input.overrides.filters.teamIds],
        }
      : createDefaultViewFilters(),
    grouping: input.overrides?.grouping ?? "status",
    subGrouping: input.overrides?.subGrouping ?? null,
    ordering: input.overrides?.ordering ?? "priority",
    displayProps: input.overrides?.displayProps
      ? [...input.overrides.displayProps]
      : input.entityKind === "items"
        ? ["id", "status", "assignee", "priority", "project", "updated"]
        : ["id", "status", "assignee", "priority", "updated"],
    hiddenState: input.overrides?.hiddenState
      ? {
          groups: [...input.overrides.hiddenState.groups],
          subgroups: [...input.overrides.hiddenState.subgroups],
        }
      : {
          groups: [],
          subgroups: input.entityKind === "items" ? ["cancelled", "duplicate"] : [],
        },
    isShared: input.isShared ?? true,
    route,
    createdAt: input.createdAt,
    updatedAt,
  }
}

export function buildTeamWorkViews(input: {
  teamId: string
  teamSlug: string
  createdAt: string
  updatedAt?: string
  experience?: TeamExperienceType | null
}): ViewDefinition[] {
  const surfaceLabel = getWorkSurfaceCopy(input.experience).surfaceLabel
  const primaryViewName = getCanonicalPrimaryViewName(input.experience)
  const lowercaseSurfaceLabel = surfaceLabel.toLowerCase()

  return [
    createViewDefinition({
      id: `view_${input.teamId}_all_items`,
      name: primaryViewName,
      description: "Everything in the team grouped by status.",
      scopeType: "team",
      scopeId: input.teamId,
      entityKind: "items",
      teamSlug: input.teamSlug,
      experience: input.experience,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    }),
    createViewDefinition({
      id: `view_${input.teamId}_active_items`,
      name: "Active",
      description: `Current ${lowercaseSurfaceLabel} ready for execution.`,
      scopeType: "team",
      scopeId: input.teamId,
      entityKind: "items",
      teamSlug: input.teamSlug,
      experience: input.experience,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      overrides: {
        layout: "board",
        filters: {
          ...createDefaultViewFilters(),
          status: ["todo", "in-progress"],
        },
        displayProps: [
          "id",
          "status",
          "assignee",
          "priority",
          "project",
          "created",
        ],
      },
    }),
    createViewDefinition({
      id: `view_${input.teamId}_backlog_items`,
      name: "Backlog",
      description: `Upcoming ${lowercaseSurfaceLabel} still in queue.`,
      scopeType: "team",
      scopeId: input.teamId,
      entityKind: "items",
      teamSlug: input.teamSlug,
      experience: input.experience,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      overrides: {
        filters: {
          ...createDefaultViewFilters(),
          status: ["backlog"],
        },
        grouping: "priority",
        ordering: "targetDate",
        displayProps: ["id", "project", "priority", "assignee", "dueDate"],
        hiddenState: { groups: [], subgroups: [] },
      },
    }),
  ].filter(Boolean) as ViewDefinition[]
}

export function buildTeamProjectViews(input: {
  teamId: string
  teamSlug: string
  createdAt: string
  updatedAt?: string
}): ViewDefinition[] {
  return [
    createViewDefinition({
      id: `view_${input.teamId}_all_projects`,
      name: "All projects",
      description: "Every project in the team.",
      scopeType: "team",
      scopeId: input.teamId,
      entityKind: "projects",
      teamSlug: input.teamSlug,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    }),
  ].filter(Boolean) as ViewDefinition[]
}

export function buildWorkspaceProjectViews(input: {
  workspaceId: string
  createdAt: string
  updatedAt?: string
}): ViewDefinition[] {
  return [
    createViewDefinition({
      id: `view_${input.workspaceId}_all_projects`,
      name: "All projects",
      description: "All projects across the workspace.",
      scopeType: "workspace",
      scopeId: input.workspaceId,
      entityKind: "projects",
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    }),
  ].filter(Boolean) as ViewDefinition[]
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

export function isSystemView(view: Pick<ViewDefinition, "name" | "route" | "entityKind">) {
  if (view.entityKind === "projects") {
    return (
      view.name === "All projects" &&
      (view.route === "/workspace/projects" || /\/team\/[^/]+\/projects$/.test(view.route))
    )
  }

  if (view.entityKind === "items") {
    if (
      view.name !== "All work" &&
      view.name !== "All issues" &&
      view.name !== "All tasks" &&
      view.name !== "Active" &&
      view.name !== "Backlog"
    ) {
      return false
    }

    return (
      /\/team\/[^/]+\/work$/.test(view.route) ||
      /\/team\/[^/]+\/projects\/[^/]+$/.test(view.route) ||
      /\/workspace\/projects\/[^/]+$/.test(view.route)
    )
  }

  return false
}

export function getViewHref(view: ViewDefinition) {
  const separator = view.route.includes("?") ? "&" : "?"
  return `${view.route}${separator}view=${encodeURIComponent(view.id)}`
}

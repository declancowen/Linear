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
type CreateViewDefinitionInput = {
  id: string
  name: string
  description: string
  scopeType: "personal" | "team" | "workspace"
  scopeId: string
  entityKind: EntityKind
  containerType?: ViewContainerType | null
  containerId?: string | null
  createdAt: string
  updatedAt?: string
  route?: string | null
  teamSlug?: string | null
  defaultItemLevelExperience?: TeamExperienceType | null
  isShared?: boolean
  overrides?: ViewConfigOverrides
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

export function getSharedTeamExperience(
  experiences: readonly (TeamExperienceType | null | undefined)[]
) {
  const [firstExperience] = experiences

  if (!firstExperience) {
    return null
  }

  return experiences.every((experience) => experience === firstExperience)
    ? firstExperience
    : null
}

export function getDefaultRouteForViewContext(input: {
  scopeType: "personal" | "team" | "workspace"
  entityKind: EntityKind
  teamSlug?: string | null
}) {
  if (input.scopeType === "personal") {
    if (input.entityKind === "items") {
      return "/assigned"
    }

    return null
  }

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
  scopeType: "personal" | "team" | "workspace"
  entityKind: EntityKind
  route: string
  teamSlug?: string | null
}) {
  if (input.scopeType === "personal") {
    return input.entityKind === "items" && input.route === "/assigned"
  }

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

function getViewDefinitionRoute(input: CreateViewDefinitionInput) {
  return (
    input.route ??
    getDefaultRouteForViewContext({
      scopeType: input.scopeType,
      entityKind: input.entityKind,
      teamSlug: input.teamSlug,
    })
  )
}

function getViewDefinitionItemDisplay(input: CreateViewDefinitionInput) {
  const baseItemLevel = getDefaultItemLevelForView(input)
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
    itemLevel,
    showChildItems,
  }
}

function getViewDefinitionContainerFields(input: CreateViewDefinitionInput) {
  return {
    ...(input.containerType ? { containerType: input.containerType } : {}),
    ...(input.containerId ? { containerId: input.containerId } : {}),
  }
}

function getViewDefinitionConfigFields(input: CreateViewDefinitionInput) {
  return {
    layout: input.overrides?.layout ?? "list",
    filters: cloneViewFilters(input.overrides?.filters),
    grouping: input.overrides?.grouping ?? "status",
    subGrouping: input.overrides?.subGrouping ?? null,
    ordering: input.overrides?.ordering ?? "priority",
    displayProps: cloneDisplayProps(
      input.entityKind,
      input.overrides?.displayProps
    ),
    hiddenState: cloneHiddenState(
      input.entityKind,
      input.overrides?.hiddenState
    ),
  }
}

export function createViewDefinition(
  input: CreateViewDefinitionInput
): ViewDefinition | null {
  const route = getViewDefinitionRoute(input)

  if (!route) {
    return null
  }

  const updatedAt = input.updatedAt ?? input.createdAt
  const itemDisplay = getViewDefinitionItemDisplay(input)

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    entityKind: input.entityKind,
    ...getViewDefinitionContainerFields(input),
    ...itemDisplay,
    ...getViewDefinitionConfigFields(input),
    isShared: input.isShared ?? true,
    route,
    createdAt: input.createdAt,
    updatedAt,
  }
}

function getDefaultItemLevelForView(input: {
  entityKind: EntityKind
  defaultItemLevelExperience?: TeamExperienceType | null
}) {
  return input.entityKind === "items" && input.defaultItemLevelExperience
    ? getDefaultViewItemLevelForTeamExperience(input.defaultItemLevelExperience)
    : null
}

function cloneViewFilters(filters: ViewConfigOverrides["filters"] | undefined) {
  if (!filters) {
    return createDefaultViewFilters()
  }

  return {
    ...filters,
    status: [...filters.status],
    priority: [...filters.priority],
    assigneeIds: [...filters.assigneeIds],
    creatorIds: [...filters.creatorIds],
    leadIds: [...filters.leadIds],
    health: [...filters.health],
    milestoneIds: [...filters.milestoneIds],
    relationTypes: [...filters.relationTypes],
    projectIds: [...filters.projectIds],
    parentIds: [...(filters.parentIds ?? [])],
    itemTypes: [...filters.itemTypes],
    labelIds: [...filters.labelIds],
    teamIds: [...filters.teamIds],
  }
}

function cloneDisplayProps(
  entityKind: EntityKind,
  displayProps: ViewConfigOverrides["displayProps"] | undefined
): ViewDefinition["displayProps"] {
  if (displayProps) {
    return [...displayProps]
  }

  return entityKind === "items"
    ? ["id", "status", "assignee", "priority", "project", "updated"]
    : ["id", "status", "assignee", "priority", "updated"]
}

function cloneHiddenState(
  entityKind: EntityKind,
  hiddenState: ViewConfigOverrides["hiddenState"] | undefined
) {
  if (hiddenState) {
    return {
      groups: [...hiddenState.groups],
      subgroups: [...hiddenState.subgroups],
    }
  }

  return {
    groups: [],
    subgroups: entityKind === "items" ? ["cancelled", "duplicate"] : [],
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
      defaultItemLevelExperience: input.experience,
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
      defaultItemLevelExperience: input.experience,
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
      defaultItemLevelExperience: input.experience,
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

export function buildAssignedWorkViews(input: {
  userId: string
  createdAt: string
  updatedAt?: string
  experience?: TeamExperienceType | null
}): ViewDefinition[] {
  const surfaceLabel = getWorkSurfaceCopy(input.experience).surfaceLabel
  const primaryViewName = getCanonicalPrimaryViewName(input.experience)
  const lowercaseSurfaceLabel = surfaceLabel.toLowerCase()

  return [
    createViewDefinition({
      id: "view_assigned_all_items",
      name: primaryViewName,
      description: "Everything assigned to you grouped by status.",
      scopeType: "personal",
      scopeId: input.userId,
      entityKind: "items",
      route: "/assigned",
      defaultItemLevelExperience: input.experience,
      isShared: false,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      overrides: {
        showChildItems: true,
      },
    }),
    createViewDefinition({
      id: "view_assigned_active_items",
      name: "Active",
      description: `Current ${lowercaseSurfaceLabel} assigned to you.`,
      scopeType: "personal",
      scopeId: input.userId,
      entityKind: "items",
      route: "/assigned",
      defaultItemLevelExperience: input.experience,
      isShared: false,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      overrides: {
        showChildItems: true,
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
      id: "view_assigned_backlog_items",
      name: "Backlog",
      description: `Upcoming ${lowercaseSurfaceLabel} assigned to you.`,
      scopeType: "personal",
      scopeId: input.userId,
      entityKind: "items",
      route: "/assigned",
      defaultItemLevelExperience: input.experience,
      isShared: false,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      overrides: {
        showChildItems: true,
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

function isCanonicalSystemViewId(
  id: string,
  entityKind: ViewDefinition["entityKind"]
) {
  if (entityKind === "projects") {
    return /^view_.+_all_projects$/.test(id)
  }

  if (entityKind === "items") {
    return /^view_.+_(all|active|backlog)_items$/.test(id)
  }

  return false
}

export function isSystemView(view: Pick<ViewDefinition, "id" | "entityKind">) {
  return isCanonicalSystemViewId(view.id, view.entityKind)
}

export function getViewHref(view: ViewDefinition) {
  const separator = view.route.includes("?") ? "&" : "?"
  return `${view.route}${separator}view=${encodeURIComponent(view.id)}`
}

"use client"

import { AppLink, useAppSearchParams } from "@/lib/browser/app-navigation"
import { useEffect, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { format } from "date-fns"
import {
  CalendarDots,
  CalendarBlank,
  CaretDown,
  Check,
  CodesandboxLogo,
  FileText,
  FunnelSimple,
  Kanban,
  Plus,
  Rows,
  SquaresFour,
  Stack,
  Tag,
  SortAscending,
  TreeStructure,
} from "@phosphor-icons/react"

import {
  canEditTeam,
  canEditWorkspace,
  getAccessibleTeams,
  getCurrentWorkspace,
  getPrivateDocuments,
  getProjectHref,
  getProjectProgress,
  getProjectsForScope,
  getTeam,
  getTeamDocuments,
  getUser,
  getViewContextLabel,
  getVisibleProjectsForView,
  getViewsForScope,
  getVisibleWorkItems,
  getWorkspaceDocuments,
  getWorkspaceDirectoryViews,
  hasWorkspaceAccess,
  teamHasFeature,
  workItemMatchesView,
} from "@/lib/domain/selectors"
import { formatCalendarDateLabel } from "@/lib/date-input"
import {
  getWorkSurfaceCopy,
  projectStatusMeta,
  priorityMeta,
  templateMeta,
  type AppData,
  type DisplayProperty,
  type Document,
  type DocumentKind,
  type GroupField,
  type OrderingField,
  type Project,
  type ScopeType,
  type Team,
  type ViewDefinition,
  type ViewerDirectoryConfig,
  type WorkItem,
  type Workspace,
} from "@/lib/domain/types"
import {
  buildAssignedWorkViews,
  buildTeamDocumentViews,
  buildWorkspaceDocumentViews,
  createViewDefinition,
  getSharedTeamExperience,
  isSystemView,
} from "@/lib/domain/default-views"
import {
  applyViewerDirectoryConfig,
  applyViewerViewConfig,
  getViewerScopedDirectoryKey,
  getViewerScopedViewKey,
} from "@/lib/domain/viewer-view-config"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { ProjectIconGlyph } from "@/components/app/entity-icons"
import {
  fetchDocumentIndexReadModel,
  fetchProjectIndexReadModel,
  fetchViewCatalogReadModel,
  fetchWorkIndexReadModel,
} from "@/lib/convex/client/read-models"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import { useRetainedTeamBySlug } from "@/hooks/use-retained-team-by-slug"
import {
  getDocumentIndexScopeKeys,
  getProjectIndexScopeKeys,
  getViewCatalogScopeKeys,
  getWorkIndexScopeKeys,
} from "@/lib/scoped-sync/read-models"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  HeaderTitle,
  MissingState,
  formatEntityKind,
} from "@/components/app/screens/shared"
export { InboxScreen } from "@/components/app/screens/inbox-screen"
import { CreateDocumentDialog } from "@/components/app/screens/create-document-dialog"
import {
  ProjectContextMenu,
  ViewContextMenu,
} from "@/components/app/screens/entity-context-menus"
export { ProjectDetailScreen } from "@/components/app/screens/project-detail-screen"
import {
  clearViewFiltersPreservingCompletion,
  createEmptyViewFilters,
  canEditDocumentInUi,
  selectAppDataSnapshot,
  toggleDisplayPropertyValue,
  toggleViewFilterValue,
  type ViewFilterKey,
} from "@/components/app/screens/helpers"
import {
  getDocsDialogInput,
  type DocsTab,
} from "@/components/app/screens/docs-dialog-input"
import { DocsContent } from "@/components/app/screens/docs-content"
import { DocumentDetailSidebarSurface } from "@/components/app/screens/document-detail-sidebar"
import {
  buildGroupedSections,
  type GroupedSection,
} from "@/components/app/screens/grouped-sections"
import { ScopedScreenLoading } from "@/components/app/screens/scoped-screen-loading"
import { WorkSurface } from "@/components/app/screens/work-surface"
import { CalendarView } from "@/components/app/screens/work-surface-view"
import { getViewHref } from "@/lib/domain/default-views"
import {
  GroupChipPopover,
  FilterPopover,
  PROJECT_DISPLAY_PROPERTY_OPTIONS,
  PROJECT_GROUP_OPTIONS,
  ProjectFilterPopover,
  ProjectLayoutTabs,
  ProjectSortChipPopover,
  PropertiesChipPopover,
  type ViewConfigPatch,
  getGroupFieldOptionLabel,
} from "@/components/app/screens/work-surface-controls"
import {
  type ViewsDirectoryFilters,
  type ViewsDirectoryGroupField,
  type ViewsDirectoryProperty,
  type ViewsDirectoryScopeFilter,
  type ViewsDirectorySortField,
  ViewsDirectoryFilterPopover,
  ViewsDirectoryGroupChipPopover,
  ViewsDirectoryLayoutTabs,
  ViewsDirectoryPropertiesChipPopover,
  ViewsDirectorySortChipPopover,
} from "@/components/app/screens/directory-controls"
import { DocsFilterOptionsList } from "@/components/app/screens/docs-filter-options-list"
import {
  buildDocsFilterOptions,
  DOC_KIND_LABEL,
  DOCS_DISPLAY_PROPERTY_LABEL,
  DOCS_DISPLAY_PROPERTY_OPTIONS,
  DOCS_GROUP_OPTIONS,
  DOCS_ORDERING_LABEL,
  DOCS_ORDERING_OPTIONS,
  getDocsFilterCount,
  groupDocsFilterOptions,
} from "@/components/app/screens/docs-view-config"
import {
  IconButton,
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverFoot,
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
  Topbar,
  Viewbar,
} from "@/components/ui/template-primitives"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
export { DocumentDetailScreen } from "@/components/app/screens/document-detail-screen"
export { WorkItemDetailScreen } from "@/components/app/screens/work-item-detail-screen"

function useCollectionLayout(routeKey: string, views: ViewDefinition[]) {
  const selectedViewId = useAppStore(
    (state) =>
      state.ui.selectedViewByRoute[
        getViewerScopedDirectoryKey(state.currentUserId, routeKey)
      ] ??
      state.ui.selectedViewByRoute[routeKey] ??
      null
  )
  const selectedView = selectedViewId
    ? (views.find((view) => view.id === selectedViewId) ?? null)
    : null
  const searchParams = useAppSearchParams()
  const hasSelectedView = Boolean(selectedView)
  const activeBaseView = selectedView ?? views[0] ?? null
  const activeOverride = useAppStore((state) => {
    if (!activeBaseView) {
      return null
    }

    return (
      state.ui.viewerViewConfigByRoute[
        getViewerScopedViewKey(state.currentUserId, routeKey, activeBaseView.id)
      ] ?? null
    )
  })
  const activeView = activeBaseView
    ? applyViewerViewConfig(activeBaseView, activeOverride)
    : null
  const [localLayout, setLocalLayout] = useState<"list" | "board">("list")

  useEffect(() => {
    if (!views[0] || hasSelectedView) {
      return
    }

    useAppStore.getState().setSelectedView(routeKey, views[0].id)
  }, [hasSelectedView, routeKey, views])

  useEffect(() => {
    const requestedViewId = searchParams.get("view")

    if (
      !requestedViewId ||
      !views.some((view) => view.id === requestedViewId)
    ) {
      return
    }

    useAppStore.getState().setSelectedView(routeKey, requestedViewId)
  }, [routeKey, searchParams, views])

  const layout =
    activeView?.layout === "board"
      ? "board"
      : activeView?.layout === "list"
        ? "list"
        : localLayout

  function setLayout(nextLayout: "list" | "board") {
    if (activeView) {
      useAppStore
        .getState()
        .patchViewerViewConfig(routeKey, activeView.id, { layout: nextLayout })
      return
    }

    setLocalLayout(nextLayout)
  }

  return { activeView, layout, setLayout }
}

const viewDirectoryLayoutMeta: Record<
  ViewDefinition["layout"],
  {
    label: string
    icon: typeof Rows
    accent: string
  }
> = {
  list: {
    label: "List",
    icon: Rows,
    accent: "var(--status-todo)",
  },
  board: {
    label: "Board",
    icon: SquaresFour,
    accent: "var(--status-doing)",
  },
  timeline: {
    label: "Timeline",
    icon: CalendarDots,
    accent: "var(--status-review)",
  },
  calendar: {
    label: "Calendar",
    icon: CalendarBlank,
    accent: "var(--status-done)",
  },
}

const PROJECT_STATUS_ORDER = [
  "backlog",
  "planned",
  "in-progress",
  "completed",
  "cancelled",
] as const

const DEFAULT_PROJECT_DISPLAY_PROPS: DisplayProperty[] = [
  "team",
  "assignee",
  "priority",
  "updated",
]

const PROJECT_PROPERTY_LABEL: Partial<Record<DisplayProperty, string>> = {
  assignee: "Lead",
  created: "Created",
  dueDate: "Target date",
  priority: "Priority",
  team: "Team",
  type: "Type",
  updated: "Updated",
}

type ProjectDisplayToken = {
  key: string
  label: string
}

type ProjectDisplayTokenResolver = (input: {
  data: AppData
  project: Project
  property: DisplayProperty
}) => ProjectDisplayToken | null

const PROJECT_DISPLAY_TOKEN_RESOLVERS: Partial<
  Record<DisplayProperty, ProjectDisplayTokenResolver>
> = {
  team: ({ data, project, property }) => ({
    key: property,
    label: getProjectTeamLabel(data, project),
  }),
  priority: ({ project, property }) =>
    project.priority === "none"
      ? null
      : {
          key: property,
          label: priorityMeta[project.priority].label,
        },
  assignee: ({ data, project, property }) => {
    const lead = getUser(data, project.leadId)

    return lead
      ? {
          key: property,
          label: lead.name,
        }
      : null
  },
  type: ({ project, property }) => ({
    key: property,
    label: templateMeta[project.templateType].label,
  }),
  dueDate: ({ project, property }) => {
    const targetDateLabel = formatCalendarDateLabel(project.targetDate, "")

    return targetDateLabel
      ? {
          key: property,
          label: targetDateLabel,
        }
      : null
  },
  created: ({ project, property }) => ({
    key: property,
    label: `Created ${format(new Date(project.createdAt), "MMM d")}`,
  }),
  updated: ({ project, property }) => ({
    key: property,
    label: `Updated ${format(new Date(project.updatedAt), "MMM d")}`,
  }),
}

const DEFAULT_VIEW_DIRECTORY_PROPERTIES: ViewsDirectoryProperty[] = [
  "description",
  "project",
  "scope",
  "updated",
  "configuration",
]

type ResolvedViewsDirectoryConfig = ViewerDirectoryConfig & {
  layout: "list" | "board"
  ordering: ViewsDirectorySortField
  grouping: ViewsDirectoryGroupField
  subGrouping: ViewsDirectoryGroupField
  filters: ViewsDirectoryFilters
  displayProps: ViewsDirectoryProperty[]
}

type ViewsDirectorySettings = {
  layout: "list" | "board"
  sortBy: ViewsDirectorySortField
  filters: ViewsDirectoryFilters
  grouping: ViewsDirectoryGroupField
  subGrouping: ViewsDirectoryGroupField
  properties: ViewsDirectoryProperty[]
}

type ViewDirectoryDisplayState = {
  showConfiguration: boolean
  showDescription: boolean
  showProject: boolean
  showScope: boolean
  showUpdated: boolean
}

const DEFAULT_VIEWS_DIRECTORY_CONFIG: ResolvedViewsDirectoryConfig = {
  layout: "list",
  ordering: "updated",
  grouping: "none",
  subGrouping: "none",
  filters: {
    entityKinds: [],
    scopes: [],
  },
  displayProps: DEFAULT_VIEW_DIRECTORY_PROPERTIES,
}

function getProjectGroupOptionLabel(field: GroupField) {
  if (field === "assignee") {
    return "Lead"
  }

  if (field === "type") {
    return "Type"
  }

  return getGroupFieldOptionLabel(field)
}

function getProjectPropertyLabel(property: DisplayProperty) {
  return PROJECT_PROPERTY_LABEL[property] ?? property
}

type ProjectGroupKeyResolver = (project: Project) => string

const PROJECT_GROUP_KEY_RESOLVERS: Record<string, ProjectGroupKeyResolver> = {
  assignee: (project) => project.leadId || "__unassigned__",
  priority: (project) => project.priority,
  team: (project) =>
    project.scopeType === "team" ? project.scopeId : "__workspace__",
  type: (project) => project.templateType,
}

function getProjectGroupKey(project: Project, field: string) {
  return PROJECT_GROUP_KEY_RESOLVERS[field]?.(project) ?? project.status
}

function getProjectPriorityGroupLabel(_data: AppData, key: string) {
  return priorityMeta[key as keyof typeof priorityMeta]?.label ?? "None"
}

function getProjectTeamGroupLabel(data: AppData, key: string) {
  return key === "__workspace__"
    ? "Workspace"
    : (getTeam(data, key)?.name ?? "Unknown team")
}

function getProjectAssigneeGroupLabel(data: AppData, key: string) {
  return key === "__unassigned__"
    ? "Unassigned"
    : (getUser(data, key)?.name ?? "Unknown lead")
}

function getProjectTypeGroupLabel(_data: AppData, key: string) {
  return templateMeta[key as keyof typeof templateMeta]?.label ?? "Type"
}

function getProjectStatusGroupLabel(_data: AppData, key: string) {
  return (
    projectStatusMeta[key as keyof typeof projectStatusMeta]?.label ?? "Status"
  )
}

type ProjectGroupLabelResolver = (data: AppData, key: string) => string

const PROJECT_GROUP_LABEL_RESOLVERS: Record<string, ProjectGroupLabelResolver> =
  {
    assignee: getProjectAssigneeGroupLabel,
    priority: getProjectPriorityGroupLabel,
    team: getProjectTeamGroupLabel,
    type: getProjectTypeGroupLabel,
  }

function getProjectGroupLabel(data: AppData, field: string, key: string) {
  const resolver =
    PROJECT_GROUP_LABEL_RESOLVERS[field] ?? getProjectStatusGroupLabel

  return resolver(data, key)
}

type ProjectGroupKeyComparator = (
  data: AppData,
  field: string,
  left: string,
  right: string
) => number

function compareProjectPriorityGroupKeys(
  _data: AppData,
  _field: string,
  left: string,
  right: string
) {
  return (
    priorityMeta[right as keyof typeof priorityMeta].weight -
    priorityMeta[left as keyof typeof priorityMeta].weight
  )
}

function compareProjectTeamGroupKeys(
  data: AppData,
  field: string,
  left: string,
  right: string
) {
  const workspaceGroupSort =
    Number(right === "__workspace__") - Number(left === "__workspace__")

  return (
    workspaceGroupSort ||
    getProjectGroupLabel(data, field, left).localeCompare(
      getProjectGroupLabel(data, field, right)
    )
  )
}

function compareProjectStatusGroupKeys(
  _data: AppData,
  _field: string,
  left: string,
  right: string
) {
  return (
    PROJECT_STATUS_ORDER.indexOf(
      left as (typeof PROJECT_STATUS_ORDER)[number]
    ) -
    PROJECT_STATUS_ORDER.indexOf(right as (typeof PROJECT_STATUS_ORDER)[number])
  )
}

function compareProjectGroupLabels(
  data: AppData,
  field: string,
  left: string,
  right: string
) {
  return getProjectGroupLabel(data, field, left).localeCompare(
    getProjectGroupLabel(data, field, right)
  )
}

const PROJECT_GROUP_KEY_COMPARATORS: Record<string, ProjectGroupKeyComparator> =
  {
    priority: compareProjectPriorityGroupKeys,
    status: compareProjectStatusGroupKeys,
    team: compareProjectTeamGroupKeys,
  }

function compareProjectGroupKeys(
  data: AppData,
  field: string,
  left: string,
  right: string
) {
  const comparator =
    PROJECT_GROUP_KEY_COMPARATORS[field] ?? compareProjectGroupLabels

  return comparator(data, field, left, right)
}

function getProjectDisplayToken(
  data: AppData,
  project: Project,
  property: DisplayProperty
) {
  return (
    PROJECT_DISPLAY_TOKEN_RESOLVERS[property]?.({
      data,
      project,
      property,
    }) ?? null
  )
}

function getProjectDisplayTokens(
  data: AppData,
  project: Project,
  displayProps: DisplayProperty[]
) {
  const tokens: Array<{ key: string; label: string }> = []

  for (const property of displayProps) {
    const token = getProjectDisplayToken(data, project, property)

    if (token) {
      tokens.push(token)
    }
  }

  return tokens
}

function getViewDirectoryScopeFilter(
  view: ViewDefinition,
  scopeType: "team" | "workspace"
): ViewsDirectoryScopeFilter {
  if (scopeType === "workspace") {
    if (view.scopeType === "team") {
      return "team"
    }

    if (view.scopeType === "workspace") {
      return "workspace"
    }

    return "personal"
  }

  return view.isShared ? "team" : "personal"
}

function getViewDirectoryScopeLabel(input: {
  view: ViewDefinition
  scopeType: "team" | "workspace"
  scopeLabels: Record<string, string>
}) {
  if (input.scopeType === "workspace") {
    return input.scopeLabels[input.view.id] ?? "Workspace"
  }

  return input.view.isShared ? "Team" : "Personal"
}

function getViewDirectoryProjectGroupKey(view: ViewDefinition) {
  if (view.containerType === "project-items" && view.containerId) {
    return view.containerId
  }

  if (view.filters.projectIds.length === 1) {
    return view.filters.projectIds[0] ?? "__none__"
  }

  return view.filters.projectIds.length > 1 ? "__multiple__" : "__none__"
}

function getViewDirectoryProjectLabel(
  view: ViewDefinition,
  projectLabels: Record<string, string>
) {
  return getViewDirectoryProjectGroupLabel(
    getViewDirectoryProjectGroupKey(view),
    projectLabels
  )
}

function getViewDirectoryProjectGroupLabel(
  key: string,
  projectLabels: Record<string, string>
) {
  if (key === "__none__") {
    return "No project"
  }

  if (key === "__multiple__") {
    return "Multiple projects"
  }

  return projectLabels[key] ?? "Unknown project"
}

function getViewDirectoryGroupKey(
  view: ViewDefinition,
  field: ViewsDirectoryGroupField,
  scopeType: "team" | "workspace",
  scopeLabels: Record<string, string>
) {
  if (field === "entity") {
    return view.entityKind
  }

  if (field === "project") {
    return getViewDirectoryProjectGroupKey(view)
  }

  return getViewDirectoryScopeLabel({
    view,
    scopeType,
    scopeLabels,
  })
}

function getViewDirectoryGroupLabel(
  field: ViewsDirectoryGroupField,
  key: string,
  projectLabels: Record<string, string>
) {
  if (field === "entity") {
    return formatEntityKind(key as ViewDefinition["entityKind"])
  }

  if (field === "project") {
    return getViewDirectoryProjectGroupLabel(key, projectLabels)
  }

  return key
}

function getResolvedViewsDirectoryLayout(
  layout: ViewerDirectoryConfig["layout"]
) {
  return (layout ?? "list") as "list" | "board"
}

function getResolvedViewsDirectorySortBy(
  ordering: ViewerDirectoryConfig["ordering"]
) {
  return (ordering ?? "updated") as ViewsDirectorySortField
}

function getResolvedViewsDirectoryFilters(
  filters: ViewerDirectoryConfig["filters"]
): ViewsDirectoryFilters {
  return {
    entityKinds: (filters?.entityKinds as ViewDefinition["entityKind"][]) ?? [],
    scopes: (filters?.scopes as ViewsDirectoryScopeFilter[]) ?? [],
  }
}

function getResolvedViewsDirectoryGrouping(
  grouping: ViewerDirectoryConfig["grouping"]
) {
  return (grouping ?? "none") as ViewsDirectoryGroupField
}

function getResolvedViewsDirectoryProperties(
  displayProps: ViewerDirectoryConfig["displayProps"]
) {
  return (
    (displayProps as ViewsDirectoryProperty[] | undefined) ??
    DEFAULT_VIEW_DIRECTORY_PROPERTIES
  )
}

function getResolvedViewsDirectorySettings(
  directoryConfig: ViewerDirectoryConfig | null | undefined
): ViewsDirectorySettings {
  const resolvedDirectoryConfig = applyViewerDirectoryConfig(
    DEFAULT_VIEWS_DIRECTORY_CONFIG,
    directoryConfig
  )

  return {
    layout: getResolvedViewsDirectoryLayout(resolvedDirectoryConfig.layout),
    sortBy: getResolvedViewsDirectorySortBy(resolvedDirectoryConfig.ordering),
    filters: getResolvedViewsDirectoryFilters(resolvedDirectoryConfig.filters),
    grouping: getResolvedViewsDirectoryGrouping(
      resolvedDirectoryConfig.grouping
    ),
    subGrouping: getResolvedViewsDirectoryGrouping(
      resolvedDirectoryConfig.subGrouping
    ),
    properties: getResolvedViewsDirectoryProperties(
      resolvedDirectoryConfig.displayProps
    ),
  }
}

function getCurrentViewsDirectorySettings(
  directorySurfaceKey: string
): ViewsDirectorySettings {
  const state = useAppStore.getState()
  const directoryConfig =
    state.ui.viewerDirectoryConfigByRoute[
      getViewerScopedDirectoryKey(state.currentUserId, directorySurfaceKey)
    ]

  return getResolvedViewsDirectorySettings(directoryConfig)
}

function getAvailableViewEntityKinds(views: ViewDefinition[]) {
  return [...new Set(views.map((view) => view.entityKind))]
}

function getAvailableViewScopes(
  views: ViewDefinition[],
  scopeType: "team" | "workspace"
) {
  return [
    ...new Set(
      views.map((view) => getViewDirectoryScopeFilter(view, scopeType))
    ),
  ] as ViewsDirectoryScopeFilter[]
}

function getFilteredDirectoryViews({
  filters,
  scopeType,
  views,
}: {
  filters: ViewsDirectoryFilters
  scopeType: "team" | "workspace"
  views: ViewDefinition[]
}) {
  return views.filter((view) => {
    if (
      filters.entityKinds.length > 0 &&
      !filters.entityKinds.includes(view.entityKind)
    ) {
      return false
    }

    if (
      filters.scopes.length > 0 &&
      !filters.scopes.includes(getViewDirectoryScopeFilter(view, scopeType))
    ) {
      return false
    }

    return true
  })
}

function compareDirectoryViews(
  sortBy: ViewsDirectorySortField,
  left: ViewDefinition,
  right: ViewDefinition
) {
  if (sortBy === "name") {
    return left.name.localeCompare(right.name)
  }

  if (sortBy === "entity") {
    return (
      formatEntityKind(left.entityKind).localeCompare(
        formatEntityKind(right.entityKind)
      ) || left.name.localeCompare(right.name)
    )
  }

  return right.updatedAt.localeCompare(left.updatedAt)
}

function getOrderedDirectoryViews(input: {
  filters: ViewsDirectoryFilters
  scopeType: "team" | "workspace"
  sortBy: ViewsDirectorySortField
  views: ViewDefinition[]
}) {
  return getFilteredDirectoryViews(input).sort((left, right) =>
    compareDirectoryViews(input.sortBy, left, right)
  )
}

function getViewsDirectorySections({
  grouping,
  orderedViews,
  projectLabels,
  scopeLabels,
  scopeType,
  subGrouping,
}: {
  grouping: ViewsDirectoryGroupField
  orderedViews: ViewDefinition[]
  projectLabels: Record<string, string>
  scopeLabels: Record<string, string>
  scopeType: "team" | "workspace"
  subGrouping: ViewsDirectoryGroupField
}) {
  return buildGroupedSections({
    items: orderedViews,
    grouping,
    subGrouping,
    getGroupKey: (view, field) =>
      getViewDirectoryGroupKey(
        view,
        field as ViewsDirectoryGroupField,
        scopeType,
        scopeLabels
      ),
    getGroupLabel: (field, key) =>
      getViewDirectoryGroupLabel(
        field as ViewsDirectoryGroupField,
        key,
        projectLabels
      ),
    compareGroupKeys: (field, left, right) =>
      getViewDirectoryGroupLabel(
        field as ViewsDirectoryGroupField,
        left,
        projectLabels
      ).localeCompare(
        getViewDirectoryGroupLabel(
          field as ViewsDirectoryGroupField,
          right,
          projectLabels
        )
      ),
  })
}

function getViewDirectoryDisplayState(
  properties: ViewsDirectoryProperty[]
): ViewDirectoryDisplayState {
  return {
    showConfiguration: properties.includes("configuration"),
    showDescription: properties.includes("description"),
    showProject: properties.includes("project"),
    showScope: properties.includes("scope"),
    showUpdated: properties.includes("updated"),
  }
}

function toggleArrayValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value]
}

function getDocsEmptyTitle(isWorkspaceDocs: boolean, activeTab: DocsTab) {
  if (!isWorkspaceDocs) {
    return "No documents yet"
  }

  return activeTab === "workspace"
    ? "No workspace documents yet"
    : "No private documents yet"
}

function isWorkspaceDocsScope(
  scopeType: "team" | "workspace",
  team?: Team | null
) {
  return scopeType === "workspace" && !team
}

function selectTeamDocViews(
  state: AppData,
  scopeId: string,
  team?: Team | null
) {
  if (!team) {
    return []
  }

  return getViewsForScope(state, "team", scopeId, "docs")
}

function selectWorkspaceDocViews(
  state: AppData,
  input: {
    scopeId: string
    scopeType: "team" | "workspace"
    team?: Team | null
  }
) {
  if (!isWorkspaceDocsScope(input.scopeType, input.team)) {
    return []
  }

  return getViewsForScope(state, "workspace", input.scopeId, "docs")
}

function getPersistedDocsViews({
  isWorkspaceDocs,
  persistedTeamDocViews,
  persistedWorkspaceDocViews,
}: {
  isWorkspaceDocs: boolean
  persistedTeamDocViews: ViewDefinition[]
  persistedWorkspaceDocViews: ViewDefinition[]
}) {
  return isWorkspaceDocs ? persistedWorkspaceDocViews : persistedTeamDocViews
}

function selectDocsEditable(state: AppData, team?: Team | null) {
  return team ? canEditTeam(state, team.id) : true
}

function isTeamDocsDisabled(team?: Team | null) {
  return Boolean(team && !teamHasFeature(team, "docs"))
}

const DOCS_CHIP_BASE =
  "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
const DOCS_CHIP_DEFAULT =
  "border-line bg-surface text-fg-2 hover:text-foreground hover:bg-surface-3"
const DOCS_CHIP_SELECTED =
  "border-transparent bg-surface-3 text-foreground shadow-none hover:bg-surface-3"

function getDocsChipClassName(selected = false) {
  return cn(DOCS_CHIP_BASE, selected ? DOCS_CHIP_SELECTED : DOCS_CHIP_DEFAULT)
}

function getDocsRouteKey(scopeType: "team" | "workspace", team?: Team | null) {
  return team ? `/team/${team.slug}/docs` : "/workspace/docs"
}

function getDocsSystemViews(input: {
  currentUserId: string
  scopeId: string
  scopeType: "team" | "workspace"
  team?: Team | null
}) {
  const createdAt = "1970-01-01T00:00:00.000Z"

  if (input.scopeType === "team" && input.team) {
    return buildTeamDocumentViews({
      teamId: input.scopeId,
      teamSlug: input.team.slug,
      createdAt,
    })
  }

  return buildWorkspaceDocumentViews({
    workspaceId: input.scopeId,
    userId: input.currentUserId,
    createdAt,
  })
}

function mergeDocsViews(
  systemViews: ViewDefinition[],
  persistedViews: ViewDefinition[]
) {
  const seen = new Set(systemViews.map((view) => view.id))

  return [
    ...systemViews,
    ...persistedViews.filter((view) => {
      if (seen.has(view.id)) {
        return false
      }

      seen.add(view.id)
      return true
    }),
  ]
}

function getActiveDocsTab(view: ViewDefinition | null): DocsTab {
  return view?.filters.documentKinds?.includes("private-document")
    ? "private"
    : "workspace"
}

function getDocsBaseDocuments(input: {
  data: AppData
  scopeId: string
  scopeType: "team" | "workspace"
  isWorkspaceDocs: boolean
}) {
  if (!input.isWorkspaceDocs) {
    return getTeamDocuments(input.data, input.scopeId)
  }

  return [
    ...getPrivateDocuments(input.data, input.scopeId),
    ...getWorkspaceDocuments(input.data, input.scopeId),
  ]
}

function matchesDocsViewFilters(document: Document, view: ViewDefinition) {
  const filters = view.filters

  if (
    filters.documentKinds?.length &&
    !filters.documentKinds.includes(document.kind)
  ) {
    return false
  }

  if (
    filters.teamIds.length &&
    (!document.teamId || !filters.teamIds.includes(document.teamId))
  ) {
    return false
  }

  if (
    filters.creatorIds.length &&
    !filters.creatorIds.includes(document.createdBy)
  ) {
    return false
  }

  if (
    filters.updatedByIds?.length &&
    !filters.updatedByIds.includes(document.updatedBy)
  ) {
    return false
  }

  if (
    filters.projectIds.length &&
    !document.linkedProjectIds.some((projectId) =>
      filters.projectIds.includes(projectId)
    )
  ) {
    return false
  }

  if (
    filters.linkedWorkItemIds?.length &&
    !document.linkedWorkItemIds.some((itemId) =>
      filters.linkedWorkItemIds?.includes(itemId)
    )
  ) {
    return false
  }

  return true
}

function compareDocumentsByOrdering(
  ordering: OrderingField,
  left: Document,
  right: Document
) {
  if (ordering === "title") {
    return left.title.localeCompare(right.title)
  }

  if (ordering === "createdAt") {
    return right.createdAt.localeCompare(left.createdAt)
  }

  return right.updatedAt.localeCompare(left.updatedAt)
}

function getDocumentsForView(
  documents: Document[],
  view: ViewDefinition | null
) {
  if (!view) {
    return [...documents].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    )
  }

  return documents
    .filter((document) => matchesDocsViewFilters(document, view))
    .sort((left, right) =>
      compareDocumentsByOrdering(view.ordering, left, right)
    )
}

function getDocumentGroupKey(data: AppData, document: Document, field: string) {
  if (field === "kind") {
    return document.kind
  }

  if (field === "team") {
    return document.teamId ?? "workspace"
  }

  if (field === "createdBy") {
    return document.createdBy
  }

  if (field === "updatedBy") {
    return document.updatedBy
  }

  return getDocsBaseGroupKey(data, document)
}

function getDocsBaseGroupKey(_data: AppData, document: Document) {
  return document.kind
}

function getDocumentGroupLabel(data: AppData, field: string, key: string) {
  if (field === "kind") {
    return DOC_KIND_LABEL[key as DocumentKind] ?? "Documents"
  }

  if (field === "team") {
    if (key === "workspace") {
      return "Workspace"
    }

    return getTeam(data, key)?.name ?? "Team"
  }

  if (field === "createdBy" || field === "updatedBy") {
    return getUser(data, key)?.name ?? "Unknown"
  }

  return "Documents"
}

function compareDocumentGroupKeys(
  data: AppData,
  field: string,
  left: string,
  right: string
) {
  return getDocumentGroupLabel(data, field, left).localeCompare(
    getDocumentGroupLabel(data, field, right)
  )
}

function buildDocsSections(
  data: AppData,
  documents: Document[],
  view: ViewDefinition | null
) {
  return buildGroupedSections({
    items: documents,
    grouping: view?.grouping ?? null,
    subGrouping: null,
    getGroupKey: (document, field) =>
      getDocumentGroupKey(data, document, field),
    getGroupLabel: (field, key) => getDocumentGroupLabel(data, field, key),
    compareGroupKeys: (field, left, right) =>
      compareDocumentGroupKeys(data, field, left, right),
  })
}

const PROJECT_HEALTH_PILL_CLASS: Record<Project["health"], string> = {
  "at-risk":
    "bg-[color:color-mix(in_oklch,var(--priority-high)_14%,transparent)] text-[color:var(--priority-high)]",
  "no-update": "bg-surface-2 text-fg-3",
  "off-track":
    "bg-[color:color-mix(in_oklch,var(--priority-urgent)_14%,transparent)] text-[color:var(--priority-urgent)]",
  "on-track":
    "bg-[color:color-mix(in_oklch,var(--status-done)_14%,transparent)] text-[color:var(--status-done)]",
}

const PROJECT_HEALTH_DOT_COLOR: Record<Project["health"], string> = {
  "at-risk": "var(--priority-high)",
  "no-update": "var(--text-4)",
  "off-track": "var(--priority-urgent)",
  "on-track": "var(--status-done)",
}

const PROJECT_HEALTH_LABEL: Record<Project["health"], string> = {
  "at-risk": "At risk",
  "no-update": "No update",
  "off-track": "Off track",
  "on-track": "On track",
}

const PROJECT_STATUS_ACCENT: Record<Project["status"], string> = {
  backlog: "var(--text-4)",
  planned: "var(--status-todo)",
  "in-progress": "var(--status-doing)",
  completed: "var(--status-done)",
  cancelled: "var(--priority-urgent)",
}

function ProjectHealthPill({ project }: { project: Project }) {
  if (project.health === "no-update") {
    return null
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
        PROJECT_HEALTH_PILL_CLASS[project.health]
      )}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{
          background: PROJECT_HEALTH_DOT_COLOR[project.health],
        }}
      />
      {PROJECT_HEALTH_LABEL[project.health]}
    </span>
  )
}

function getProjectTeamLabel(data: AppData, project: Project) {
  if (project.scopeType === "team") {
    return getTeam(data, project.scopeId)?.name ?? "Unknown team"
  }

  return "Workspace"
}

function ProjectIconTile({ project }: { project: Project }) {
  const accent = PROJECT_STATUS_ACCENT[project.status]
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-md"
      style={{
        background: `color-mix(in oklch, ${accent} 14%, var(--surface-2))`,
        color: "var(--foreground)",
      }}
    >
      {project.icon ? (
        <ProjectIconGlyph project={project} className="size-4" />
      ) : (
        <span className="text-[13px] font-semibold">
          {project.name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  )
}

function ProjectPropertyTokens({
  data,
  project,
  displayProps,
  className,
}: {
  data: AppData
  project: Project
  displayProps: DisplayProperty[]
  className?: string
}) {
  const tokens = getProjectDisplayTokens(data, project, displayProps)

  if (tokens.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-[11px] text-fg-3",
        className
      )}
    >
      {tokens.map((token) => (
        <span
          key={token.key}
          className="inline-flex max-w-[160px] items-center truncate rounded-full border border-line-soft bg-surface px-2 py-0.5"
        >
          {token.label}
        </span>
      ))}
    </div>
  )
}

function ProjectItemCount({
  count,
  className,
}: {
  count: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[11.5px] text-fg-4 tabular-nums",
        className
      )}
    >
      <TreeStructure className="size-3" />
      {count}
    </span>
  )
}

type ProjectPreviewProps = {
  data: AppData
  project: Project
  displayProps: DisplayProperty[]
}

function getProjectPreviewContext(data: AppData, project: Project) {
  return {
    href: getProjectHref(data, project) ?? "/workspace/projects",
    progress: getProjectProgress(data, project.id),
    summary: project.summary || project.description,
  }
}

function ProjectStatusPill({
  project,
  className,
}: {
  project: Project
  className?: string
}) {
  const accent = PROJECT_STATUS_ACCENT[project.status]
  const label = projectStatusMeta[project.status]?.label ?? "Status"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] leading-none font-medium",
        className
      )}
      style={{
        background: `color-mix(in oklch, ${accent} 16%, transparent)`,
        color: accent,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: accent }}
      />
      {label}
    </span>
  )
}

function ProjectProgressBar({
  progress,
  accent,
  height = 6,
}: {
  progress: ReturnType<typeof getProjectProgress>
  accent: string
  height?: number
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-full bg-surface-3"
      style={{ height: `${height}px` }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          left: `${progress.completedPercent}%`,
          width: `${progress.inProgressOnlyPercent}%`,
          background: `color-mix(in oklch, ${accent} 55%, var(--surface-3))`,
        }}
      />
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${progress.completedPercent}%`,
          background: accent,
        }}
      />
    </div>
  )
}

function getFilteredDisplayProps(displayProps: DisplayProperty[]) {
  return displayProps.filter(
    (property) => property !== "id" && property !== "status"
  )
}

function getProjectPreviewDisplayContext({
  data,
  displayProps,
  project,
}: ProjectPreviewProps) {
  const { href, progress, summary } = getProjectPreviewContext(data, project)

  return {
    accent: PROJECT_STATUS_ACCENT[project.status],
    filteredDisplayProps: getFilteredDisplayProps(displayProps),
    href,
    progress,
    summary,
  }
}

function ProjectRow({ data, project, displayProps }: ProjectPreviewProps) {
  const preview = getProjectPreviewDisplayContext({
    data,
    displayProps,
    project,
  })

  return (
    <ProjectContextMenu data={data} project={project}>
      <AppLink
        className="group relative flex items-center gap-4 border-b border-line-soft py-3 pr-7 pl-7 transition-colors hover:bg-surface-2"
        href={preview.href}
      >
        <ProjectIconTile project={project} />
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[14px] font-semibold tracking-[-0.005em] text-foreground group-hover:underline">
                {project.name}
              </span>
              <ProjectStatusPill
                project={project}
                className="hidden md:inline-flex"
              />
              <ProjectHealthPill project={project} />
            </div>
            {preview.summary ? (
              <p className="mt-1 line-clamp-1 max-w-2xl text-[12px] leading-[1.4] text-fg-3">
                {preview.summary}
              </p>
            ) : null}
          </div>
          <div className="hidden w-[360px] shrink-0 flex-col items-end justify-center gap-2 lg:flex">
            <ProjectPropertyTokens
              className="max-w-full justify-end"
              data={data}
              project={project}
              displayProps={preview.filteredDisplayProps}
            />
            <div className="flex w-full items-center justify-end gap-3">
              <ProjectItemCount count={preview.progress.scope} />
              <ProjectProgressBar
                progress={preview.progress}
                accent={preview.accent}
              />
              <span
                className="w-9 shrink-0 text-right text-[11.5px] font-medium tabular-nums"
                style={{ color: preview.accent }}
              >
                {preview.progress.completedPercent}%
              </span>
            </div>
          </div>
        </div>
      </AppLink>
    </ProjectContextMenu>
  )
}

function ProjectCard({ data, project, displayProps }: ProjectPreviewProps) {
  const preview = getProjectPreviewDisplayContext({
    data,
    displayProps,
    project,
  })

  return (
    <ProjectContextMenu data={data} project={project}>
      <AppLink
        className="group relative flex h-full min-h-[252px] flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all hover:-translate-y-px hover:border-fg-4 hover:shadow-md"
        href={preview.href}
      >
        <div
          className="relative flex flex-col gap-3 px-4 pt-4 pb-4"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklch, ${preview.accent} 18%, transparent) 0%, color-mix(in oklch, ${preview.accent} 5%, transparent) 100%)`,
            borderBottom: `1px solid color-mix(in oklch, ${preview.accent} 20%, var(--line))`,
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <ProjectStatusPill project={project} />
            <div className="flex shrink-0 items-center gap-1.5">
              <ProjectHealthPill project={project} />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-lg text-[14px] font-semibold"
              style={{
                background: `color-mix(in oklch, ${preview.accent} 24%, var(--surface))`,
                color: "var(--foreground)",
                border: `1px solid color-mix(in oklch, ${preview.accent} 35%, transparent)`,
              }}
            >
              {project.icon ? (
                <ProjectIconGlyph project={project} className="size-4" />
              ) : (
                project.name.charAt(0).toUpperCase()
              )}
            </span>
            <h2 className="min-w-0 flex-1 truncate text-[15px] leading-[1.25] font-semibold tracking-[-0.005em] text-foreground group-hover:underline">
              {project.name}
            </h2>
          </div>
          <ProjectPropertyTokens
            className="justify-start"
            data={data}
            project={project}
            displayProps={preview.filteredDisplayProps}
          />
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <ProjectItemCount count={preview.progress.scope} />
                <ProjectProgressBar
                  progress={preview.progress}
                  accent={preview.accent}
                  height={7}
                />
              </div>
            </div>
            <span
              className="text-[22px] leading-none font-semibold tracking-[-0.02em] tabular-nums"
              style={{ color: preview.accent }}
            >
              {preview.progress.completedPercent}%
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          {preview.summary ? (
            <p className="line-clamp-3 text-[12.5px] leading-[1.5] text-fg-2">
              {preview.summary}
            </p>
          ) : (
            <p className="text-[12px] text-fg-4 italic">No summary yet.</p>
          )}
        </div>
      </AppLink>
    </ProjectContextMenu>
  )
}

function GroupHeading({
  label,
  count,
  className,
}: {
  label: string
  count: number
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <h2 className="text-[12px] font-semibold tracking-[0.02em] text-foreground">
        {label}
      </h2>
      <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-3">
        {count}
      </span>
    </div>
  )
}

function getEntityKindIconNode(
  entityKind: ViewDefinition["entityKind"],
  className = "size-3.5"
) {
  if (entityKind === "items") {
    return <CodesandboxLogo className={className} />
  }
  if (entityKind === "projects") {
    return <Kanban className={className} />
  }
  return <FileText className={className} />
}

function ViewConfigurationBadges({
  view,
  variant = "card",
}: {
  view: ViewDefinition
  variant?: "card" | "row"
}) {
  const layoutMeta = viewDirectoryLayoutMeta[view.layout]
  const LayoutIcon = layoutMeta.icon
  const groupLabel = view.subGrouping
    ? `${getGroupFieldOptionLabel(view.grouping)} / ${getGroupFieldOptionLabel(view.subGrouping)}`
    : getGroupFieldOptionLabel(view.grouping)

  if (variant === "row") {
    return (
      <div className="flex items-center gap-3 text-[11.5px] text-fg-3">
        <span className="inline-flex items-center gap-1">
          {getEntityKindIconNode(view.entityKind, "size-3.5 text-fg-3")}
          <span>{formatEntityKind(view.entityKind)}</span>
        </span>
        <span aria-hidden className="size-1 rounded-full bg-line-soft" />
        <span className="inline-flex items-center gap-1">
          <LayoutIcon
            className="size-3.5"
            style={{ color: layoutMeta.accent }}
          />
          <span>{layoutMeta.label}</span>
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px] text-fg-3">
      <span className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-1 leading-none">
        {getEntityKindIconNode(view.entityKind, "size-3 text-fg-3")}
        <span>{formatEntityKind(view.entityKind)}</span>
      </span>
      <span
        className="inline-flex items-center gap-1 rounded-md border px-1.5 py-1 leading-none"
        style={{
          color: layoutMeta.accent,
          borderColor: `color-mix(in oklch, ${layoutMeta.accent} 30%, var(--line))`,
          background: `color-mix(in oklch, ${layoutMeta.accent} 10%, transparent)`,
        }}
      >
        <LayoutIcon className="size-3" />
        <span>{layoutMeta.label}</span>
      </span>
      <span
        className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-md border border-line px-1.5 py-1 leading-none"
        title={`Grouped by ${groupLabel}`}
      >
        <Tag className="size-3 text-fg-3" />
        <span className="truncate">{groupLabel}</span>
      </span>
    </div>
  )
}

function ViewLayoutPreview({
  layout,
  accent,
}: {
  layout: ViewDefinition["layout"]
  accent: string
}) {
  return (
    <div
      aria-hidden
      className="relative h-[72px] overflow-hidden border-b border-line-soft"
      style={{
        background: `linear-gradient(180deg, color-mix(in oklch, ${accent} 14%, transparent) 0%, color-mix(in oklch, ${accent} 4%, transparent) 100%)`,
      }}
    >
      {layout === "list" ? <ViewListPreviewArt accent={accent} /> : null}
      {layout === "board" ? <ViewBoardPreviewArt accent={accent} /> : null}
      {layout === "timeline" ? (
        <ViewTimelinePreviewArt accent={accent} />
      ) : null}
    </div>
  )
}

function ViewListPreviewArt({ accent }: { accent: string }) {
  const rows = [
    { width: 72, opacity: 0.7 },
    { width: 60, opacity: 0.55 },
    { width: 78, opacity: 0.4 },
    { width: 52, opacity: 0.3 },
  ]
  return (
    <div className="absolute inset-0 flex flex-col gap-2 px-4 pt-3.5">
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: accent, opacity: row.opacity }}
          />
          <span
            className="h-[5px] rounded-full"
            style={{
              width: `${row.width}%`,
              background: `color-mix(in oklch, var(--line) 90%, transparent)`,
            }}
          />
        </div>
      ))}
    </div>
  )
}

function ViewBoardPreviewArt({ accent }: { accent: string }) {
  const columns = [
    [{ h: 14 }, { h: 10 }],
    [{ h: 18 }, { h: 8 }, { h: 6 }],
    [{ h: 12 }],
  ]
  return (
    <div className="absolute inset-0 grid grid-cols-3 gap-2.5 px-4 pt-3.5">
      {columns.map((column, columnIndex) => (
        <div key={columnIndex} className="flex flex-col gap-1.5">
          <span
            className="h-[5px] w-2/3 rounded-full"
            style={{ background: accent, opacity: 0.55 }}
          />
          {column.map((card, cardIndex) => (
            <span
              key={cardIndex}
              className="rounded-sm"
              style={{
                height: `${card.h}px`,
                background: `color-mix(in oklch, var(--line) 75%, transparent)`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function ViewTimelinePreviewArt({ accent }: { accent: string }) {
  const bars = [
    { left: 6, width: 32, opacity: 0.7 },
    { left: 24, width: 48, opacity: 0.55 },
    { left: 14, width: 28, opacity: 0.45 },
    { left: 46, width: 38, opacity: 0.35 },
  ]
  return (
    <div className="absolute inset-0 flex flex-col gap-2 px-4 pt-3.5">
      {bars.map((bar, index) => (
        <div key={index} className="relative h-[6px]">
          <span
            className="absolute inset-y-0 rounded-full"
            style={{
              left: `${bar.left}%`,
              width: `${bar.width}%`,
              background: accent,
              opacity: bar.opacity,
            }}
          />
        </div>
      ))}
    </div>
  )
}

function getSavedViewUpdatedLabel(view: ViewDefinition, showUpdated: boolean) {
  return showUpdated ? format(new Date(view.updatedAt), "MMM d") : null
}

function SavedViewDescription({
  className,
  showDescription,
  view,
}: {
  className: string
  showDescription: boolean
  view: ViewDefinition
}) {
  if (!showDescription || !view.description) {
    return null
  }

  return <p className={className}>{view.description}</p>
}

function SavedViewConfiguration({
  showConfiguration,
  variant,
  view,
}: {
  showConfiguration: boolean
  variant: "card" | "row"
  view: ViewDefinition
}) {
  if (!showConfiguration) {
    return null
  }

  if (variant === "row") {
    return (
      <div className="hidden shrink-0 lg:block">
        <ViewConfigurationBadges view={view} variant="row" />
      </div>
    )
  }

  return (
    <div className="pt-0.5">
      <ViewConfigurationBadges view={view} />
    </div>
  )
}

function SavedViewScopeLabel({
  className,
  scopeLabel,
  showScope,
}: {
  className: string
  scopeLabel: string
  showScope: boolean
}) {
  return showScope ? <span className={className}>{scopeLabel}</span> : null
}

function SavedViewProjectLabel({
  className,
  projectLabel,
  showProject,
}: {
  className: string
  projectLabel: string
  showProject: boolean
}) {
  if (!showProject || projectLabel === "No project") {
    return null
  }

  return <span className={className}>{projectLabel}</span>
}

function SavedViewUpdatedDate({
  className,
  updatedLabel,
}: {
  className: string
  updatedLabel: string | null
}) {
  return updatedLabel ? <span className={className}>{updatedLabel}</span> : null
}

function SavedViewCardFooter({
  projectLabel,
  scopeLabel,
  showProject,
  showScope,
  updatedLabel,
}: {
  projectLabel: string
  scopeLabel: string
  showProject: boolean
  showScope: boolean
  updatedLabel: string | null
}) {
  const hasProject = showProject && projectLabel !== "No project"

  if (!hasProject && !showScope && !updatedLabel) {
    return null
  }

  return (
    <div className="mt-auto flex items-center gap-2 border-t border-dashed border-line pt-2.5 text-[11px] text-fg-3">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {hasProject ? (
          <span className="min-w-0 truncate">{projectLabel}</span>
        ) : null}
        {hasProject && showScope ? (
          <span aria-hidden className="size-1 shrink-0 rounded-full bg-line" />
        ) : null}
        {showScope ? (
          <span className="min-w-0 truncate">{scopeLabel}</span>
        ) : null}
      </div>
      <SavedViewUpdatedDate
        className="shrink-0 tabular-nums"
        updatedLabel={updatedLabel}
      />
    </div>
  )
}

type SavedViewItemProps = {
  projectLabel: string
  scopeLabel: string
  showConfiguration: boolean
  showDescription: boolean
  showProject: boolean
  showScope: boolean
  showUpdated: boolean
  view: ViewDefinition
}

function SavedViewRow(props: SavedViewItemProps) {
  const {
    projectLabel,
    scopeLabel,
    showConfiguration,
    showDescription,
    showProject,
    showScope,
    showUpdated,
    view,
  } = props
  const layoutMeta = viewDirectoryLayoutMeta[view.layout]
  const LayoutIcon = layoutMeta.icon
  const updatedLabel = getSavedViewUpdatedLabel(view, showUpdated)

  return (
    <ViewContextMenu view={view}>
      <AppLink
        className="group relative flex items-center gap-3 border-b border-line-soft py-2.5 pr-6 pl-6 transition-colors hover:bg-surface-2 sm:pr-7 sm:pl-7"
        href={getViewHref(view)}
      >
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-[2px] rounded-r-full opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: layoutMeta.accent }}
        />
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-md transition-colors"
          style={{
            color: layoutMeta.accent,
            background: `color-mix(in oklch, ${layoutMeta.accent} 14%, transparent)`,
          }}
        >
          <LayoutIcon className="size-3.5" />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-medium text-foreground group-hover:underline">
                {view.name}
              </span>
            </div>
            <SavedViewDescription
              className="mt-0.5 line-clamp-1 text-[11.5px] leading-[1.4] text-fg-3"
              showDescription={showDescription}
              view={view}
            />
          </div>
          <SavedViewConfiguration
            showConfiguration={showConfiguration}
            variant="row"
            view={view}
          />
          <SavedViewProjectLabel
            className="hidden max-w-[160px] shrink-0 truncate text-[11.5px] text-fg-3 lg:inline"
            projectLabel={projectLabel}
            showProject={showProject}
          />
          <SavedViewScopeLabel
            className="hidden max-w-[160px] shrink-0 truncate text-[11.5px] text-fg-3 md:inline"
            scopeLabel={scopeLabel}
            showScope={showScope}
          />
          <SavedViewUpdatedDate
            className="w-12 shrink-0 text-right text-[11.5px] text-fg-3 tabular-nums"
            updatedLabel={updatedLabel}
          />
        </div>
      </AppLink>
    </ViewContextMenu>
  )
}

function SavedViewCard(props: SavedViewItemProps) {
  const {
    projectLabel,
    scopeLabel,
    showConfiguration,
    showDescription,
    showProject,
    showScope,
    showUpdated,
    view,
  } = props
  const layoutMeta = viewDirectoryLayoutMeta[view.layout]
  const updatedLabel = getSavedViewUpdatedLabel(view, showUpdated)

  return (
    <ViewContextMenu view={view}>
      <AppLink
        className="group relative flex h-full min-h-[212px] flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all hover:-translate-y-px hover:border-fg-4 hover:shadow-md"
        href={getViewHref(view)}
      >
        <ViewLayoutPreview layout={view.layout} accent={layoutMeta.accent} />
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 flex-1 truncate text-[14px] leading-[1.3] font-semibold tracking-[-0.005em] text-foreground">
              {view.name}
            </h2>
          </div>
          <SavedViewDescription
            className="line-clamp-2 text-[12.5px] leading-[1.5] text-fg-2"
            showDescription={showDescription}
            view={view}
          />
          <SavedViewConfiguration
            showConfiguration={showConfiguration}
            variant="card"
            view={view}
          />
          <SavedViewCardFooter
            projectLabel={projectLabel}
            scopeLabel={scopeLabel}
            showProject={showProject}
            showScope={showScope}
            updatedLabel={updatedLabel}
          />
        </div>
      </AppLink>
    </ViewContextMenu>
  )
}

type ViewsDirectoryItemDisplay = ViewDirectoryDisplayState & {
  projectLabels: Record<string, string>
  scopeLabels: Record<string, string>
  scopeType: "team" | "workspace"
}

function getSavedViewItemProps(
  view: ViewDefinition,
  display: ViewsDirectoryItemDisplay
) {
  return {
    projectLabel: getViewDirectoryProjectLabel(view, display.projectLabels),
    scopeLabel: getViewDirectoryScopeLabel({
      view,
      scopeLabels: display.scopeLabels,
      scopeType: display.scopeType,
    }),
    showConfiguration: display.showConfiguration,
    showDescription: display.showDescription,
    showProject: display.showProject,
    showScope: display.showScope,
    showUpdated: display.showUpdated,
    view,
  }
}

function SavedViewCardGrid({
  display,
  views,
}: {
  display: ViewsDirectoryItemDisplay
  views: ViewDefinition[]
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {views.map((view) => (
        <SavedViewCard
          key={view.id}
          {...getSavedViewItemProps(view, display)}
        />
      ))}
    </div>
  )
}

function SavedViewRowList({
  display,
  views,
}: {
  display: ViewsDirectoryItemDisplay
  views: ViewDefinition[]
}) {
  return (
    <>
      {views.map((view) => (
        <SavedViewRow key={view.id} {...getSavedViewItemProps(view, display)} />
      ))}
    </>
  )
}

function ViewsDirectoryBoardSection({
  display,
  grouping,
  section,
}: {
  display: ViewsDirectoryItemDisplay
  grouping: ViewsDirectoryGroupField
  section: GroupedSection<ViewDefinition>
}) {
  return (
    <section className="flex flex-col gap-3">
      {grouping !== "none" ? (
        <GroupHeading label={section.label} count={section.items.length} />
      ) : null}
      {section.children ? (
        <div className="flex flex-col gap-4">
          {section.children.map((child) => (
            <div key={child.key} className="flex flex-col gap-2">
              <GroupHeading
                className="pl-1"
                label={child.label}
                count={child.items.length}
              />
              <SavedViewCardGrid display={display} views={child.items} />
            </div>
          ))}
        </div>
      ) : (
        <SavedViewCardGrid display={display} views={section.items} />
      )}
    </section>
  )
}

function ViewsDirectoryListSection({
  display,
  grouping,
  section,
}: {
  display: ViewsDirectoryItemDisplay
  grouping: ViewsDirectoryGroupField
  section: GroupedSection<ViewDefinition>
}) {
  return (
    <section className="flex flex-col">
      {grouping !== "none" ? (
        <GroupHeading
          className="px-7 py-3"
          label={section.label}
          count={section.items.length}
        />
      ) : null}
      {section.children ? (
        <div className="flex flex-col">
          {section.children.map((child) => (
            <div key={child.key} className="flex flex-col">
              <GroupHeading
                className="border-y border-line-soft px-7 py-2.5"
                label={child.label}
                count={child.items.length}
              />
              <SavedViewRowList display={display} views={child.items} />
            </div>
          ))}
        </div>
      ) : (
        <SavedViewRowList display={display} views={section.items} />
      )}
    </section>
  )
}

function ViewsDirectoryBoardContent({
  display,
  grouping,
  sections,
}: {
  display: ViewsDirectoryItemDisplay
  grouping: ViewsDirectoryGroupField
  sections: GroupedSection<ViewDefinition>[]
}) {
  return (
    <div className="flex flex-col gap-7 px-7 py-5">
      {sections.map((section) => (
        <ViewsDirectoryBoardSection
          key={section.key}
          display={display}
          grouping={grouping}
          section={section}
        />
      ))}
    </div>
  )
}

function ViewsDirectoryListContent({
  display,
  grouping,
  sections,
}: {
  display: ViewsDirectoryItemDisplay
  grouping: ViewsDirectoryGroupField
  sections: GroupedSection<ViewDefinition>[]
}) {
  return (
    <div className="flex flex-col pb-6">
      {sections.map((section) => (
        <ViewsDirectoryListSection
          key={section.key}
          display={display}
          grouping={grouping}
          section={section}
        />
      ))}
    </div>
  )
}

function ViewsDirectoryContent({
  display,
  emptyTitle,
  grouping,
  hasLoadedOnce,
  layout,
  orderedViews,
  sections,
}: {
  display: ViewsDirectoryItemDisplay
  emptyTitle: string
  grouping: ViewsDirectoryGroupField
  hasLoadedOnce: boolean
  layout: "list" | "board"
  orderedViews: ViewDefinition[]
  sections: GroupedSection<ViewDefinition>[]
}) {
  if (!hasLoadedOnce && orderedViews.length === 0) {
    return <ScopedScreenLoading label="Loading views..." />
  }

  if (orderedViews.length === 0) {
    return (
      <MissingState
        icon={Stack}
        title={emptyTitle}
        subtitle="Saved views slice work the way your team thinks. Create one from the toolbar to get started."
      />
    )
  }

  if (layout === "board") {
    return (
      <ViewsDirectoryBoardContent
        display={display}
        grouping={grouping}
        sections={sections}
      />
    )
  }

  return (
    <ViewsDirectoryListContent
      display={display}
      grouping={grouping}
      sections={sections}
    />
  )
}

function ViewsDirectoryViewbar({
  availableEntityKinds,
  availableScopes,
  editable,
  filters,
  grouping,
  layout,
  onUpdateConfig,
  onUpdateFilters,
  onUpdateProperties,
  properties,
  scopeId,
  scopeType,
  sortBy,
  subGrouping,
}: {
  availableEntityKinds: ViewDefinition["entityKind"][]
  availableScopes: ViewsDirectoryScopeFilter[]
  editable: boolean
  filters: ViewsDirectoryFilters
  grouping: ViewsDirectoryGroupField
  layout: "list" | "board"
  onUpdateConfig: (patch: ViewerDirectoryConfig) => void
  onUpdateFilters: (
    resolveNextFilters: (
      current: ViewsDirectoryFilters
    ) => ViewsDirectoryFilters
  ) => void
  onUpdateProperties: (
    resolveNextProperties: (
      current: ViewsDirectoryProperty[]
    ) => ViewsDirectoryProperty[]
  ) => void
  properties: ViewsDirectoryProperty[]
  scopeId: string
  scopeType: "team" | "workspace"
  sortBy: ViewsDirectorySortField
  subGrouping: ViewsDirectoryGroupField
}) {
  return (
    <Viewbar className="border-b-0">
      <ViewsDirectoryLayoutTabs
        layout={layout}
        onLayoutChange={(nextLayout) => onUpdateConfig({ layout: nextLayout })}
      />
      <div aria-hidden className="mx-1.5 h-[18px] w-px bg-line" />
      <ViewsDirectoryFilterPopover
        availableEntityKinds={availableEntityKinds}
        availableScopes={availableScopes}
        filters={filters}
        onClearFilters={() =>
          onUpdateConfig({
            filters: {
              entityKinds: [],
              scopes: [],
            },
          })
        }
        onToggleEntityKind={(entityKind) =>
          onUpdateFilters((current) => ({
            ...current,
            entityKinds: toggleArrayValue(current.entityKinds, entityKind),
          }))
        }
        onToggleScope={(scope) =>
          onUpdateFilters((current) => ({
            ...current,
            scopes: toggleArrayValue(current.scopes, scope),
          }))
        }
      />
      <ViewsDirectoryGroupChipPopover
        grouping={grouping}
        onGroupingChange={(nextGrouping) =>
          onUpdateConfig({
            grouping: nextGrouping,
            ...(nextGrouping !== "none" && subGrouping === nextGrouping
              ? { subGrouping: "none" }
              : {}),
          })
        }
        onSubGroupingChange={(nextSubGrouping) =>
          onUpdateConfig({ subGrouping: nextSubGrouping })
        }
        subGrouping={subGrouping}
      />
      <ViewsDirectorySortChipPopover
        sortBy={sortBy}
        onSortByChange={(nextSortBy) =>
          onUpdateConfig({ ordering: nextSortBy })
        }
      />
      <ViewsDirectoryPropertiesChipPopover
        onClearProperties={() =>
          onUpdateConfig({
            displayProps: DEFAULT_VIEW_DIRECTORY_PROPERTIES,
          })
        }
        onToggleProperty={(property) =>
          onUpdateProperties((current) => toggleArrayValue(current, property))
        }
        properties={properties}
      />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {editable ? (
          <Button
            size="sm"
            variant="default"
            className="h-7 shrink-0 gap-1.5 px-2.5 text-[12px]"
            onClick={() =>
              openManagedCreateDialog({
                kind: "view",
                defaultScopeType: scopeType,
                defaultScopeId: scopeId,
                ...(scopeType === "team" ? { lockScope: true } : {}),
              })
            }
          >
            <Plus className="size-3.5" />
            New
          </Button>
        ) : null}
      </div>
    </Viewbar>
  )
}

function DocsFilterPopover({
  data,
  documents,
  routeKey,
  view,
}: {
  data: AppData
  documents: Document[]
  routeKey: string
  view: ViewDefinition
}) {
  const options = buildDocsFilterOptions(data, documents)
  const optionGroups = groupDocsFilterOptions(options)
  const count = getDocsFilterCount(view)

  function toggleFilter(key: ViewFilterKey, value: string) {
    useAppStore
      .getState()
      .toggleViewerViewFilterValue(routeKey, view.id, key, value)
  }

  function clearFilters() {
    useAppStore.getState().clearViewerViewFilters(routeKey, view.id)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={getDocsChipClassName(count > 0)}>
          <FunnelSimple className="size-3.5" />
          Filter
          {count > 0 ? (
            <span className="rounded-full bg-background/60 px-1 text-[10px]">
              {count}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[280px]")}
      >
        <DocsFilterOptionsList
          checkClassName="size-3.5 text-accent-fg"
          optionGroups={optionGroups}
          view={view}
          onToggleFilter={toggleFilter}
        />
        <PropertyPopoverFoot>
          <span>{count} active</span>
          {count > 0 ? (
            <button
              type="button"
              className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
              onClick={clearFilters}
            >
              Clear all
            </button>
          ) : null}
        </PropertyPopoverFoot>
      </PopoverContent>
    </Popover>
  )
}

function DocsGroupPopover({
  routeKey,
  view,
}: {
  routeKey: string
  view: ViewDefinition
}) {
  function updateGrouping(grouping: GroupField) {
    useAppStore.getState().patchViewerViewConfig(routeKey, view.id, {
      grouping,
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={getDocsChipClassName()}>
          <TreeStructure className="size-3.5" />
          Group
          <span className="font-medium text-foreground">
            · {getGroupFieldOptionLabel(view.grouping)}
          </span>
          <CaretDown className="size-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[220px]")}
      >
        <PropertyPopoverList>
          <PropertyPopoverGroup>Group by</PropertyPopoverGroup>
          {DOCS_GROUP_OPTIONS.map((option) => {
            const selected = view.grouping === option

            return (
              <PropertyPopoverItem
                key={option}
                selected={selected}
                onClick={() => updateGrouping(option)}
                trailing={
                  selected ? (
                    <Check className="size-3.5 text-accent-fg" />
                  ) : null
                }
              >
                {getGroupFieldOptionLabel(option)}
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

function DocsSortPopover({
  routeKey,
  view,
}: {
  routeKey: string
  view: ViewDefinition
}) {
  function updateOrdering(ordering: OrderingField) {
    useAppStore.getState().patchViewerViewConfig(routeKey, view.id, {
      ordering,
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={getDocsChipClassName()}>
          <SortAscending className="size-3.5" />
          <span>{DOCS_ORDERING_LABEL[view.ordering]}</span>
          <CaretDown className="size-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[200px]")}
      >
        <PropertyPopoverList>
          <PropertyPopoverGroup>Order by</PropertyPopoverGroup>
          {DOCS_ORDERING_OPTIONS.map((option) => {
            const selected = view.ordering === option

            return (
              <PropertyPopoverItem
                key={option}
                selected={selected}
                onClick={() => updateOrdering(option)}
                trailing={
                  selected ? (
                    <Check className="size-3.5 text-accent-fg" />
                  ) : null
                }
              >
                {DOCS_ORDERING_LABEL[option]}
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

function DocsViewTabs({
  activeView,
  editable,
  routeKey,
  scopeId,
  scopeType,
  views,
}: {
  activeView: ViewDefinition | null
  editable: boolean
  routeKey: string
  scopeId: string
  scopeType: "team" | "workspace"
  views: ViewDefinition[]
}) {
  function selectView(viewId: string) {
    useAppStore.getState().setSelectedView(routeKey, viewId)
  }

  function createDocumentView() {
    openManagedCreateDialog({
      kind: "view",
      defaultScopeType: scopeType,
      defaultScopeId: scopeId,
      defaultEntityKind: "docs",
      defaultRoute: routeKey,
      lockEntityKind: true,
      seedInitialConfig: true,
      initialConfig: {
        layout: activeView?.layout ?? "list",
        grouping: activeView?.grouping ?? "kind",
        subGrouping: null,
        ordering: activeView?.ordering ?? "updatedAt",
        filters: activeView?.filters ?? createEmptyViewFilters(),
        displayProps: activeView?.displayProps ?? DOCS_DISPLAY_PROPERTY_OPTIONS,
        hiddenState: { groups: [], subgroups: [] },
      },
    })
  }

  return (
    <div className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto">
      {views.map((view) => {
        const button = (
          <ProjectViewTabButton
            key={view.id}
            active={activeView?.id === view.id}
            onSelect={() => selectView(view.id)}
            view={view}
          />
        )

        if (isSystemView(view)) {
          return button
        }

        return (
          <ViewContextMenu key={view.id} view={view}>
            {button}
          </ViewContextMenu>
        )
      })}
      {editable ? (
        <IconButton
          aria-label="Create document view"
          className="size-7 shrink-0"
          onClick={createDocumentView}
        >
          <Plus className="size-3.5" />
        </IconButton>
      ) : null}
    </div>
  )
}

function DocsTaskbar({
  activeView,
  data,
  documents,
  editable,
  layout,
  onCreateDocument,
  onLayoutChange,
  routeKey,
}: {
  activeView: ViewDefinition | null
  data: AppData
  documents: Document[]
  editable: boolean
  layout: "list" | "board"
  onCreateDocument: () => void
  onLayoutChange: (layout: "list" | "board") => void
  routeKey: string
}) {
  if (!activeView) {
    return null
  }

  return (
    <Viewbar className="no-scrollbar gap-2 overflow-x-auto border-b-0">
      <ViewsDirectoryLayoutTabs
        layout={layout}
        onLayoutChange={onLayoutChange}
      />
      <div aria-hidden className="mx-1.5 h-[18px] w-px bg-line" />
      <DocsFilterPopover
        data={data}
        documents={documents}
        routeKey={routeKey}
        view={activeView}
      />
      <DocsGroupPopover routeKey={routeKey} view={activeView} />
      <DocsSortPopover routeKey={routeKey} view={activeView} />
      <PropertiesChipPopover
        view={activeView}
        propertyOptions={DOCS_DISPLAY_PROPERTY_OPTIONS}
        getPropertyLabel={(property) =>
          DOCS_DISPLAY_PROPERTY_LABEL[property] ?? "Property"
        }
        onToggleDisplayProperty={(property) =>
          useAppStore
            .getState()
            .toggleViewerViewDisplayProperty(routeKey, activeView.id, property)
        }
        onReorderDisplayProperties={(displayProps) =>
          useAppStore
            .getState()
            .reorderViewerViewDisplayProperties(
              routeKey,
              activeView.id,
              displayProps
            )
        }
        onClearDisplayProperties={() =>
          useAppStore
            .getState()
            .reorderViewerViewDisplayProperties(routeKey, activeView.id, [])
        }
      />
      {editable ? (
        <Button
          size="sm"
          className="ml-auto h-7 shrink-0 gap-1.5 px-2.5 text-[12px]"
          onClick={onCreateDocument}
        >
          <Plus className="size-3.5" />
          New document
        </Button>
      ) : null}
    </Viewbar>
  )
}

function ProjectViewTabButton({
  active,
  onSelect,
  view,
}: {
  active: boolean
  onSelect: () => void
  view: ViewDefinition
}) {
  return (
    <button
      className={cn(
        "h-7 rounded-md px-2 text-[12px] transition-colors",
        active
          ? "bg-surface-3 font-medium text-foreground"
          : "text-fg-3 hover:bg-surface-3 hover:text-foreground"
      )}
      onClick={onSelect}
    >
      {view.name}
    </button>
  )
}

function ProjectViewTabs({
  activeView,
  displayedProjectViews,
  editable,
  effectiveProjectView,
  persistedProjectViewIds,
  routeKey,
  scopeId,
  team,
}: {
  activeView: ViewDefinition | null
  displayedProjectViews: ViewDefinition[]
  editable: boolean
  effectiveProjectView: ViewDefinition | null
  persistedProjectViewIds: Set<string>
  routeKey: string
  scopeId: string
  team?: Team | null
}) {
  if (displayedProjectViews.length === 0) {
    return null
  }

  function selectView(viewId: string) {
    if (!activeView) {
      return
    }

    useAppStore.getState().setSelectedView(routeKey, viewId)
  }

  return (
    <div className="ml-2 flex items-center gap-0.5">
      {displayedProjectViews.map((view) => {
        const button = (
          <ProjectViewTabButton
            key={view.id}
            active={view.id === effectiveProjectView?.id}
            onSelect={() => selectView(view.id)}
            view={view}
          />
        )

        if (isSystemView(view) || !persistedProjectViewIds.has(view.id)) {
          return button
        }

        return (
          <ViewContextMenu key={view.id} view={view}>
            {button}
          </ViewContextMenu>
        )
      })}
      {editable ? (
        <IconButton
          className="size-6"
          onClick={() =>
            openManagedCreateDialog({
              kind: "view",
              defaultScopeType: team ? "team" : "workspace",
              defaultScopeId: scopeId,
              defaultEntityKind: "projects",
              defaultRoute: routeKey,
              ...(team ? { lockScope: true } : {}),
              lockEntityKind: true,
            })
          }
        >
          <Plus className="size-3.5" />
        </IconButton>
      ) : null}
    </div>
  )
}

function ProjectsTopbar({
  activeView,
  displayedProjectViews,
  editable,
  effectiveProjectView,
  persistedProjectViewIds,
  routeKey,
  scopeId,
  team,
  title,
}: {
  activeView: ViewDefinition | null
  displayedProjectViews: ViewDefinition[]
  editable: boolean
  effectiveProjectView: ViewDefinition | null
  persistedProjectViewIds: Set<string>
  routeKey: string
  scopeId: string
  team?: Team | null
  title: string
}) {
  return (
    <Topbar>
      <HeaderTitle title={title} />
      <ProjectViewTabs
        activeView={activeView}
        displayedProjectViews={displayedProjectViews}
        editable={editable}
        effectiveProjectView={effectiveProjectView}
        persistedProjectViewIds={persistedProjectViewIds}
        routeKey={routeKey}
        scopeId={scopeId}
        team={team}
      />
    </Topbar>
  )
}

type ProjectViewbarHandlers = {
  onClearDisplayProperties: () => void
  onClearFilters: () => void
  onReorderDisplayProperties: (displayProps: DisplayProperty[]) => void
  onToggleDisplayProperty: (property: DisplayProperty) => void
  onToggleFilterValue: (key: ViewFilterKey, value: string) => void
  onUpdateView: (patch: ViewConfigPatch) => void
}

type ProjectDraftFilters = ReturnType<typeof createEmptyViewFilters>

type ProjectDraftViewSetters = {
  setLayout: (layout: "list" | "board") => void
  setProjectFilters: (
    resolveNextFilters: (current: ProjectDraftFilters) => ProjectDraftFilters
  ) => void
  setProjectGrouping: (grouping: GroupField) => void
  setProjectOrdering: (ordering: ViewDefinition["ordering"]) => void
  setProjectSubGrouping: (grouping: GroupField | null) => void
}

function applyProjectDraftLayoutPatch(
  patch: ViewConfigPatch,
  setLayout: ProjectDraftViewSetters["setLayout"]
) {
  if (!patch.layout) {
    return
  }

  setLayout(patch.layout === "board" ? "board" : "list")
}

function applyProjectDraftGroupingPatch(
  patch: ViewConfigPatch,
  setters: Pick<
    ProjectDraftViewSetters,
    "setProjectGrouping" | "setProjectSubGrouping"
  >
) {
  if (patch.grouping) {
    setters.setProjectGrouping(patch.grouping)
  }

  if ("subGrouping" in patch) {
    setters.setProjectSubGrouping(patch.subGrouping ?? null)
  }
}

function applyProjectDraftOrderingPatch(
  patch: ViewConfigPatch,
  setProjectOrdering: ProjectDraftViewSetters["setProjectOrdering"]
) {
  if (!patch.ordering) {
    return
  }

  setProjectOrdering(patch.ordering)
}

function applyProjectDraftCompletionPatch(
  patch: ViewConfigPatch,
  setProjectFilters: ProjectDraftViewSetters["setProjectFilters"]
) {
  if (
    patch.showCompleted === undefined &&
    patch.showEmptyGroups === undefined
  ) {
    return
  }

  setProjectFilters((current) => ({
    ...current,
    ...(patch.showCompleted === undefined
      ? {}
      : { showCompleted: patch.showCompleted }),
    ...(patch.showEmptyGroups === undefined
      ? {}
      : { showEmptyGroups: patch.showEmptyGroups }),
  }))
}

function applyProjectDraftViewPatch(
  patch: ViewConfigPatch,
  setters: ProjectDraftViewSetters
) {
  applyProjectDraftLayoutPatch(patch, setters.setLayout)
  applyProjectDraftGroupingPatch(patch, setters)
  applyProjectDraftOrderingPatch(patch, setters.setProjectOrdering)
  applyProjectDraftCompletionPatch(patch, setters.setProjectFilters)
}

function ProjectsViewbar({
  canCreateProject,
  handlers,
  projects,
  team,
  view,
}: {
  canCreateProject: boolean
  handlers: ProjectViewbarHandlers
  projects: Project[]
  team?: Team | null
  view: ViewDefinition
}) {
  return (
    <Viewbar className="border-b-0">
      <ProjectLayoutTabs view={view} onUpdateView={handlers.onUpdateView} />
      <div aria-hidden className="mx-1.5 h-[18px] w-px bg-line" />
      <ProjectFilterPopover
        view={view}
        projects={projects}
        variant="chip"
        onToggleFilterValue={handlers.onToggleFilterValue}
        onClearFilters={handlers.onClearFilters}
      />
      <GroupChipPopover
        view={view}
        getOptionLabel={getProjectGroupOptionLabel}
        groupOptions={PROJECT_GROUP_OPTIONS}
        onUpdateView={handlers.onUpdateView}
      />
      <ProjectSortChipPopover
        view={view}
        onUpdateView={handlers.onUpdateView}
      />
      <PropertiesChipPopover
        view={view}
        getPropertyLabel={getProjectPropertyLabel}
        propertyOptions={PROJECT_DISPLAY_PROPERTY_OPTIONS}
        onToggleDisplayProperty={handlers.onToggleDisplayProperty}
        onReorderDisplayProperties={handlers.onReorderDisplayProperties}
        onClearDisplayProperties={handlers.onClearDisplayProperties}
      />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {canCreateProject ? (
          <Button
            size="sm"
            variant="default"
            className="h-7 shrink-0 gap-1.5 px-2.5 text-[12px]"
            onClick={() => {
              openManagedCreateDialog({
                kind: "project",
                ...(team ? { defaultTeamId: team.id } : {}),
              })
            }}
          >
            <Plus className="size-3.5" />
            New
          </Button>
        ) : null}
      </div>
    </Viewbar>
  )
}

function useProjectDraftViewState({
  layout,
  routeKey,
  scopeId,
  scopeType,
  setLayout,
  team,
}: {
  layout: "list" | "board"
  routeKey: string
  scopeId: string
  scopeType: ScopeType
  setLayout: (layout: "list" | "board") => void
  team?: Team | null
}) {
  const [projectFilters, setProjectFilters] = useState(() =>
    createEmptyViewFilters()
  )
  const [projectGrouping, setProjectGrouping] = useState<GroupField>("status")
  const [projectSubGrouping, setProjectSubGrouping] =
    useState<GroupField | null>(null)
  const [projectOrdering, setProjectOrdering] =
    useState<ViewDefinition["ordering"]>("priority")
  const [projectDisplayProperties, setProjectDisplayProperties] = useState<
    DisplayProperty[]
  >(DEFAULT_PROJECT_DISPLAY_PROPS)
  const fallbackProjectView = useMemo(() => {
    const timestamp = new Date().toISOString()

    return (
      createViewDefinition({
        id: `fallback-project-view-${scopeType}-${scopeId}`,
        name: "All projects",
        description: "All projects in this scope.",
        scopeType: team ? "team" : "workspace",
        scopeId,
        entityKind: "projects",
        route: routeKey,
        teamSlug: team?.slug,
        createdAt: timestamp,
        updatedAt: timestamp,
        overrides: {
          layout,
          filters: projectFilters,
          grouping: projectGrouping,
          subGrouping: projectSubGrouping,
          ordering: projectOrdering,
          displayProps: projectDisplayProperties,
        },
      }) ?? null
    )
  }, [
    layout,
    projectDisplayProperties,
    projectFilters,
    projectGrouping,
    projectOrdering,
    projectSubGrouping,
    routeKey,
    scopeId,
    scopeType,
    team,
  ])

  function updateProjectView(patch: ViewConfigPatch) {
    applyProjectDraftViewPatch(patch, {
      setLayout,
      setProjectFilters,
      setProjectGrouping,
      setProjectOrdering,
      setProjectSubGrouping,
    })
  }

  const handlers: ProjectViewbarHandlers = {
    onUpdateView: updateProjectView,
    onToggleFilterValue: (key, value) =>
      setProjectFilters((current) =>
        toggleViewFilterValue(current, key, value)
      ),
    onClearFilters: () =>
      setProjectFilters(clearViewFiltersPreservingCompletion),
    onToggleDisplayProperty: (property) =>
      setProjectDisplayProperties((current) =>
        toggleDisplayPropertyValue(current, property)
      ),
    onReorderDisplayProperties: setProjectDisplayProperties,
    onClearDisplayProperties: () => setProjectDisplayProperties([]),
  }

  return {
    fallbackProjectView,
    handlers,
  }
}

function getDisplayedProjectViews(
  projectViews: ViewDefinition[],
  fallbackProjectView: ViewDefinition | null
) {
  if (projectViews.length > 0) {
    return projectViews
  }

  return fallbackProjectView ? [fallbackProjectView] : []
}

function useEffectiveProjectView({
  activeView,
  fallbackProjectView,
  layout,
}: {
  activeView: ViewDefinition | null
  fallbackProjectView: ViewDefinition | null
  layout: "list" | "board"
}) {
  return useMemo(() => {
    const source = activeView ?? fallbackProjectView

    if (!source) {
      return null
    }

    const grouping = getProjectViewGrouping(source)
    const subGrouping = getProjectViewSubGrouping(source, grouping)

    return {
      ...source,
      ...(activeView ? {} : { layout }),
      grouping,
      subGrouping,
    }
  }, [activeView, fallbackProjectView, layout])
}

function getProjectViewGrouping(view: ViewDefinition) {
  return PROJECT_GROUP_OPTIONS.includes(view.grouping)
    ? view.grouping
    : "status"
}

function getProjectViewSubGrouping(view: ViewDefinition, grouping: GroupField) {
  if (!view.subGrouping || view.subGrouping === grouping) {
    return null
  }

  return PROJECT_GROUP_OPTIONS.includes(view.subGrouping)
    ? view.subGrouping
    : null
}

function createSavedProjectViewbarHandlers(
  activeView: ViewDefinition | null,
  routeKey: string
): ProjectViewbarHandlers {
  return {
    onUpdateView: (patch) =>
      withSavedProjectView(activeView, (viewId) =>
        useAppStore.getState().patchViewerViewConfig(routeKey, viewId, patch)
      ),
    onToggleFilterValue: (key, value) =>
      withSavedProjectView(activeView, (viewId) =>
        useAppStore
          .getState()
          .toggleViewerViewFilterValue(routeKey, viewId, key, value)
      ),
    onClearFilters: () =>
      withSavedProjectView(activeView, (viewId) =>
        useAppStore.getState().clearViewerViewFilters(routeKey, viewId)
      ),
    onToggleDisplayProperty: (property) =>
      withSavedProjectView(activeView, (viewId) =>
        useAppStore
          .getState()
          .toggleViewerViewDisplayProperty(routeKey, viewId, property)
      ),
    onReorderDisplayProperties: (displayProps) =>
      withSavedProjectView(activeView, (viewId) =>
        useAppStore
          .getState()
          .reorderViewerViewDisplayProperties(routeKey, viewId, displayProps)
      ),
    onClearDisplayProperties: () =>
      withSavedProjectView(activeView, (viewId) =>
        useAppStore
          .getState()
          .clearViewerViewDisplayProperties(routeKey, viewId)
      ),
  }
}

function withSavedProjectView(
  activeView: ViewDefinition | null,
  action: (viewId: string) => void
) {
  if (!activeView) {
    return
  }

  action(activeView.id)
}

function getProjectViewbarHandlers({
  activeView,
  draftHandlers,
  hasSavedProjectView,
  routeKey,
}: {
  activeView: ViewDefinition | null
  draftHandlers: ProjectViewbarHandlers
  hasSavedProjectView: boolean
  routeKey: string
}) {
  return hasSavedProjectView
    ? createSavedProjectViewbarHandlers(activeView, routeKey)
    : draftHandlers
}

function ProjectBoardSection({
  data,
  displayProps,
  section,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  section: GroupedSection<Project>
}) {
  return (
    <section className="flex flex-col gap-3">
      <GroupHeading label={section.label} count={section.items.length} />
      {section.children ? (
        <div className="flex flex-col gap-4">
          {section.children.map((child) => (
            <div key={child.key} className="flex flex-col gap-2">
              <GroupHeading
                className="pl-1"
                label={child.label}
                count={child.items.length}
              />
              <ProjectCardGrid
                data={data}
                displayProps={displayProps}
                projects={child.items}
              />
            </div>
          ))}
        </div>
      ) : (
        <ProjectCardGrid
          data={data}
          displayProps={displayProps}
          projects={section.items}
        />
      )}
    </section>
  )
}

function ProjectCardGrid({
  data,
  displayProps,
  projects,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  projects: Project[]
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          data={data}
          displayProps={displayProps}
          project={project}
        />
      ))}
    </div>
  )
}

function ProjectBoardContent({
  data,
  displayProps,
  sections,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  sections: GroupedSection<Project>[]
}) {
  return (
    <div className="flex flex-col gap-7 px-7 py-5">
      {sections.map((section) => (
        <ProjectBoardSection
          key={section.key}
          data={data}
          displayProps={displayProps}
          section={section}
        />
      ))}
    </div>
  )
}

function ProjectListSection({
  data,
  displayProps,
  section,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  section: GroupedSection<Project>
}) {
  return (
    <section className="flex flex-col">
      <GroupHeading
        className="px-7 py-3"
        label={section.label}
        count={section.items.length}
      />
      {section.children ? (
        <div className="flex flex-col">
          {section.children.map((child) => (
            <div key={child.key} className="flex flex-col">
              <GroupHeading
                className="border-y border-line-soft px-7 py-2.5"
                label={child.label}
                count={child.items.length}
              />
              <ProjectRows
                data={data}
                displayProps={displayProps}
                projects={child.items}
              />
            </div>
          ))}
        </div>
      ) : (
        <ProjectRows
          data={data}
          displayProps={displayProps}
          projects={section.items}
        />
      )}
    </section>
  )
}

function ProjectRows({
  data,
  displayProps,
  projects,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  projects: Project[]
}) {
  return projects.map((project) => (
    <ProjectRow
      key={project.id}
      data={data}
      displayProps={displayProps}
      project={project}
    />
  ))
}

function ProjectListContent({
  data,
  displayProps,
  sections,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  sections: GroupedSection<Project>[]
}) {
  return (
    <div className="flex flex-col pb-6">
      {sections.map((section) => (
        <ProjectListSection
          key={section.key}
          data={data}
          displayProps={displayProps}
          section={section}
        />
      ))}
    </div>
  )
}

function getProjectsContentStatus(
  hasLoadedOnce: boolean,
  visibleProjects: Project[]
) {
  if (!hasLoadedOnce && visibleProjects.length === 0) {
    return "loading"
  }

  return visibleProjects.length === 0 ? "empty" : "ready"
}

function ProjectReadyContent({
  data,
  displayProps,
  layout,
  sections,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  layout: ViewDefinition["layout"]
  sections: GroupedSection<Project>[]
}) {
  return layout === "board" ? (
    <ProjectBoardContent
      data={data}
      displayProps={displayProps}
      sections={sections}
    />
  ) : (
    <ProjectListContent
      data={data}
      displayProps={displayProps}
      sections={sections}
    />
  )
}

function ProjectsContent({
  data,
  displayProps,
  emptyProjectsLabel,
  hasLoadedOnce,
  layout,
  sections,
  visibleProjects,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  emptyProjectsLabel: string
  hasLoadedOnce: boolean
  layout: ViewDefinition["layout"]
  sections: GroupedSection<Project>[]
  visibleProjects: Project[]
}) {
  const status = getProjectsContentStatus(hasLoadedOnce, visibleProjects)

  if (status === "loading") {
    return <ScopedScreenLoading label="Loading projects..." />
  }

  if (status === "empty") {
    return (
      <MissingState
        icon={Kanban}
        title={emptyProjectsLabel}
        subtitle="Spin up a project to group items by milestone, OKR, or initiative."
      />
    )
  }

  return (
    <ProjectReadyContent
      data={data}
      displayProps={displayProps}
      layout={layout}
      sections={sections}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  Screen components                                                  */
/* ------------------------------------------------------------------ */

function getTeamWorkScopeKeys(team?: Team | null) {
  if (!team) {
    return []
  }

  return getWorkIndexScopeKeys("team", team.id)
}

function fetchTeamWorkReadModel(team?: Team | null) {
  return fetchWorkIndexReadModel("team", team?.id ?? "")
}

function selectTeamWorkViews(state: AppData, team?: Team | null) {
  if (!team) {
    return []
  }

  return getViewsForScope(state, "team", team.id, "items")
}

function selectTeamWorkItems(state: AppData, team?: Team | null) {
  if (!team) {
    return []
  }

  return getVisibleWorkItems(state, { teamId: team.id })
}

function TeamWorkScreenContent({
  hasLoadedOnce,
  items,
  team,
  views,
}: {
  hasLoadedOnce: boolean
  items: WorkItem[]
  team?: Team | null
  views: ViewDefinition[]
}) {
  if (!team) {
    return <MissingState title="Team not found" />
  }

  const workCopy = getWorkSurfaceCopy(team.settings.experience)

  if (!teamHasFeature(team, "issues")) {
    return <MissingState title={workCopy.disabledLabel} />
  }

  return (
    <WorkSurface
      title={workCopy.surfaceLabel}
      routeKey={`/team/${team.slug}/work`}
      views={views}
      items={items}
      team={team}
      emptyLabel={workCopy.emptyLabel}
      isLoading={!hasLoadedOnce && items.length === 0}
      loadingLabel={`Loading ${workCopy.surfaceLabel.toLowerCase()}...`}
    />
  )
}

export function TeamWorkScreen({ teamSlug }: { teamSlug: string }) {
  const { team } = useRetainedTeamBySlug(teamSlug)
  const views = useAppStore(
    useShallow((state) => selectTeamWorkViews(state, team))
  )
  const items = useAppStore(
    useShallow((state) => selectTeamWorkItems(state, team))
  )
  const { hasLoadedOnce } = useScopedReadModelRefresh({
    enabled: Boolean(team?.id),
    scopeKeys: getTeamWorkScopeKeys(team),
    fetchLatest: () => fetchTeamWorkReadModel(team),
    diagnostics: {
      retainedData: items.length > 0 || views.length > 0,
      surface: "team/work-items",
    },
  })

  return (
    <TeamWorkScreenContent
      hasLoadedOnce={hasLoadedOnce}
      items={items}
      team={team}
      views={views}
    />
  )
}

function getWorkspaceItemsScopeKeys(workspaceId: string | null) {
  if (!workspaceId) {
    return []
  }

  return getWorkIndexScopeKeys("workspace", workspaceId)
}

function fetchWorkspaceItemsReadModel(workspaceId: string | null) {
  return fetchWorkIndexReadModel("workspace", workspaceId ?? "")
}

function selectWorkspaceItemViews(state: AppData, workspaceId: string | null) {
  if (!workspaceId) {
    return []
  }

  return getViewsForScope(state, "workspace", workspaceId, "items")
}

function selectWorkspaceVisibleItems(
  state: AppData,
  workspaceId: string | null
) {
  if (!workspaceId) {
    return []
  }

  return getVisibleWorkItems(state, { workspaceId })
}

function selectWorkspaceItemsExperience(state: AppData) {
  const workspace = getCurrentWorkspace(state)

  if (!workspace) {
    return null
  }

  return getSharedTeamExperience(
    getAccessibleTeams(state)
      .filter((team) => team.workspaceId === workspace.id)
      .map((team) => team.settings.experience)
  )
}

function WorkspaceItemsScreenContent({
  activeTeamId,
  hasLoadedOnce,
  items,
  views,
  workspace,
  workspaceExperience,
}: {
  activeTeamId: string | null
  hasLoadedOnce: boolean
  items: WorkItem[]
  views: ViewDefinition[]
  workspace: Workspace | null
  workspaceExperience: ReturnType<typeof getSharedTeamExperience>
}) {
  if (!workspace) {
    return <MissingState title="Workspace not found" />
  }

  const workCopy = getWorkSurfaceCopy(workspaceExperience)

  return (
    <WorkSurface
      title="Workspace items"
      routeKey="/workspace/items"
      views={views}
      items={items}
      team={null}
      workspaceId={workspace.id}
      createTeamId={activeTeamId}
      groupingExperience={workspaceExperience}
      emptyLabel={workCopy.emptyLabel}
      isLoading={!hasLoadedOnce && items.length === 0}
      loadingLabel="Loading workspace items..."
    />
  )
}

export function WorkspaceItemsScreen() {
  const workspace = useAppStore(getCurrentWorkspace) ?? null
  const workspaceId = workspace?.id ?? null
  const activeTeamId = useAppStore((state) => state.ui.activeTeamId)
  const views = useAppStore(
    useShallow((state) => selectWorkspaceItemViews(state, workspaceId))
  )
  const items = useAppStore(
    useShallow((state) => selectWorkspaceVisibleItems(state, workspaceId))
  )
  const { hasLoadedOnce } = useScopedReadModelRefresh({
    enabled: Boolean(workspaceId),
    scopeKeys: getWorkspaceItemsScopeKeys(workspaceId),
    fetchLatest: () => fetchWorkspaceItemsReadModel(workspaceId),
    diagnostics: {
      retainedData: items.length > 0 || views.length > 0,
      surface: "workspace/work-items",
    },
  })
  const workspaceExperience = useAppStore(selectWorkspaceItemsExperience)

  return (
    <WorkspaceItemsScreenContent
      activeTeamId={activeTeamId}
      hasLoadedOnce={hasLoadedOnce}
      items={items}
      views={views}
      workspace={workspace}
      workspaceExperience={workspaceExperience}
    />
  )
}

export function AssignedScreen() {
  const { activeTeamId, currentUserId } = useAppStore(
    useShallow((state) => ({
      activeTeamId: state.ui.activeTeamId,
      currentUserId: state.currentUserId,
    }))
  )
  const team = useAppStore((state) => getTeam(state, activeTeamId))
  const assignedViewExperience = useAppStore((state) => {
    return getSharedTeamExperience(
      getAccessibleTeams(state).map(
        (candidate) => candidate.settings.experience
      )
    )
  })
  const views = useAppStore(
    useShallow((state) =>
      getViewsForScope(state, "personal", currentUserId, "items")
    )
  )
  const assignedItems = useAppStore(
    useShallow((state) =>
      getVisibleWorkItems(state, {
        assignedToCurrentUser: true,
        includeSubscribed: true,
      })
    )
  )
  const items = useAppStore(
    useShallow((state) =>
      getVisibleWorkItems(state, {
        assignedToCurrentUserWithAncestors: true,
        includeSubscribed: true,
      })
    )
  )
  const { hasLoadedOnce } = useScopedReadModelRefresh({
    enabled: Boolean(currentUserId),
    scopeKeys: currentUserId
      ? getWorkIndexScopeKeys("personal", currentUserId)
      : [],
    fetchLatest: () => fetchWorkIndexReadModel("personal", currentUserId ?? ""),
    diagnostics: {
      retainedData: items.length > 0 || views.length > 0,
      surface: "workspace/assigned-items",
    },
  })
  const fallbackViews = useMemo(() => {
    if (!currentUserId) {
      return []
    }

    const timestamp = new Date().toISOString()

    return buildAssignedWorkViews({
      userId: currentUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
      experience: assignedViewExperience,
    })
  }, [assignedViewExperience, currentUserId])

  return (
    <WorkSurface
      title="My items"
      routeKey="/assigned"
      views={views}
      fallbackViews={fallbackViews}
      items={items}
      filterItems={assignedItems}
      team={team}
      groupingExperience={assignedViewExperience}
      createTeamId={activeTeamId}
      emptyLabel="Nothing is assigned right now"
      isLoading={!hasLoadedOnce && items.length === 0}
      loadingLabel="Loading items..."
      childDisplayMode="assigned-descendants"
      allowCreateViews={false}
      hiddenFilters={["assigneeIds"]}
    />
  )
}

function getPersonalWorkScopeKeys(currentUserId: string | null) {
  if (!currentUserId) {
    return []
  }

  return getWorkIndexScopeKeys("personal", currentUserId)
}

function fetchPersonalWorkReadModel(currentUserId: string | null) {
  return fetchWorkIndexReadModel("personal", currentUserId ?? "")
}

function createUserCalendarFilterView({
  currentUserId,
  filters,
}: {
  currentUserId: string | null
  filters: ViewDefinition["filters"]
}): ViewDefinition {
  return {
    id: "user-calendar-filters",
    name: "Calendar",
    description: "",
    scopeType: "personal",
    scopeId: currentUserId ?? "current-user",
    entityKind: "items",
    itemLevel: null,
    showChildItems: true,
    layout: "calendar",
    filters,
    grouping: "status",
    subGrouping: null,
    ordering: "targetDate",
    displayProps: [],
    hiddenState: { groups: [], subgroups: [] },
    isShared: false,
    route: "/calendar",
    createdAt: "",
    updatedAt: "",
  }
}

function getUserCalendarItemsForView({
  data,
  items,
  view,
}: {
  data: AppData
  items: WorkItem[]
  view: ViewDefinition
}) {
  return items.filter((item) =>
    workItemMatchesView(data, item, view, {
      ignoreItemLevel: true,
    })
  )
}

function getDefaultUserCalendarCreateTeamId(data: AppData) {
  return (
    data.teams.find(
      (team) => teamHasFeature(team, "issues") && canEditTeam(data, team.id)
    )?.id ?? null
  )
}

function UserCalendarFilterAccessory({
  items,
  onClearFilters,
  onToggleFilterValue,
  view,
}: {
  items: WorkItem[]
  onClearFilters: () => void
  onToggleFilterValue: (key: ViewFilterKey, value: string) => void
  view: ViewDefinition
}) {
  return (
    <FilterPopover
      view={view}
      items={items}
      onToggleFilterValue={onToggleFilterValue}
      onClearFilters={onClearFilters}
      triggerIcon={<FunnelSimple className="size-3.5" />}
      variant="icon"
    />
  )
}

function UserCalendarScreenContent({
  calendarFilterView,
  calendarItems,
  canEditCalendarItem,
  data,
  defaultCreateTeamId,
  filteredCalendarItems,
  hasLoadedOnce,
  onClearFilters,
  onToggleFilterValue,
}: {
  calendarFilterView: ViewDefinition
  calendarItems: WorkItem[]
  canEditCalendarItem: (item: WorkItem) => boolean
  data: AppData
  defaultCreateTeamId: string | null
  filteredCalendarItems: WorkItem[]
  hasLoadedOnce: boolean
  onClearFilters: () => void
  onToggleFilterValue: (key: ViewFilterKey, value: string) => void
}) {
  if (!hasLoadedOnce && calendarItems.length === 0) {
    return <ScopedScreenLoading label="Loading calendar..." />
  }

  return (
    <CalendarView
      data={data}
      items={filteredCalendarItems}
      editable
      canEditItem={canEditCalendarItem}
      toolbarAccessory={
        <UserCalendarFilterAccessory
          view={calendarFilterView}
          items={calendarItems}
          onToggleFilterValue={onToggleFilterValue}
          onClearFilters={onClearFilters}
        />
      }
      createContext={{
        defaultTeamId: defaultCreateTeamId,
        defaultProjectId: null,
        defaultVisibility: "private",
      }}
    />
  )
}

export function UserCalendarScreen() {
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const [calendarFilters, setCalendarFilters] = useState(() =>
    createEmptyViewFilters()
  )
  const { currentUserId } = useAppStore(
    useShallow((state) => ({
      currentUserId: state.currentUserId,
    }))
  )
  const calendarItems = useAppStore(
    useShallow((state) =>
      getVisibleWorkItems(state, { assignedToCurrentUser: true })
    )
  )
  const { hasLoadedOnce } = useScopedReadModelRefresh({
    enabled: Boolean(currentUserId),
    scopeKeys: getPersonalWorkScopeKeys(currentUserId),
    fetchLatest: () => fetchPersonalWorkReadModel(currentUserId),
    diagnostics: {
      retainedData: calendarItems.length > 0,
      surface: "workspace/calendar",
    },
  })
  const calendarFilterView = useMemo<ViewDefinition>(
    () =>
      createUserCalendarFilterView({
        currentUserId,
        filters: calendarFilters,
      }),
    [calendarFilters, currentUserId]
  )
  const filteredCalendarItems = useMemo(() => {
    return getUserCalendarItemsForView({
      data,
      items: calendarItems,
      view: calendarFilterView,
    })
  }, [calendarFilterView, calendarItems, data])
  const canEditCalendarItem = useMemo(
    () => (item: WorkItem) => {
      if ((item.visibility ?? "team") !== "private") {
        return canEditTeam(data, item.teamId)
      }

      const workspaceId = item.workspaceId ?? null

      return (
        item.creatorId === data.currentUserId &&
        Boolean(
          workspaceId &&
          hasWorkspaceAccess(data, workspaceId, data.currentUserId)
        )
      )
    },
    [data]
  )
  const defaultCreateTeamId = getDefaultUserCalendarCreateTeamId(data)

  return (
    <UserCalendarScreenContent
      calendarFilterView={calendarFilterView}
      calendarItems={calendarItems}
      canEditCalendarItem={canEditCalendarItem}
      data={data}
      defaultCreateTeamId={defaultCreateTeamId}
      filteredCalendarItems={filteredCalendarItems}
      hasLoadedOnce={hasLoadedOnce}
      onToggleFilterValue={(key, value) =>
        setCalendarFilters((current) =>
          toggleViewFilterValue(current, key, value)
        )
      }
      onClearFilters={() =>
        setCalendarFilters((current) =>
          clearViewFiltersPreservingCompletion(current)
        )
      }
    />
  )
}

type ProjectsScreenProps = {
  scopeType: ScopeType
  scopeId: string
  team?: Team | null
  title: string
  description?: string
}

function getProjectsScreenRouteKey(team?: Team | null) {
  return team ? `/team/${team.slug}/projects` : "/workspace/projects"
}

function useProjectsScreenReadModel(input: {
  scopeId: string
  scopeType: ScopeType
}) {
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const projects = useAppStore(
    useShallow((state) =>
      getProjectsForScope(state, input.scopeType, input.scopeId)
    )
  )
  const projectViews = useAppStore(
    useShallow((state) =>
      getViewsForScope(state, input.scopeType, input.scopeId, "projects")
    )
  )
  const { hasLoadedOnce } = useScopedReadModelRefresh({
    enabled: Boolean(input.scopeId),
    scopeKeys: getProjectIndexScopeKeys(input.scopeType, input.scopeId),
    fetchLatest: () =>
      fetchProjectIndexReadModel(input.scopeType, input.scopeId),
    diagnostics: {
      retainedData: projects.length > 0 || projectViews.length > 0,
      surface: `${input.scopeType}/projects`,
    },
  })

  return {
    data,
    hasLoadedOnce,
    projectViews,
    projects,
  }
}

function useProjectsScreenViewState({
  projectViews,
  routeKey,
  scopeId,
  scopeType,
  team,
}: {
  projectViews: ViewDefinition[]
  routeKey: string
  scopeId: string
  scopeType: ScopeType
  team?: Team | null
}) {
  const { activeView, layout, setLayout } = useCollectionLayout(
    routeKey,
    projectViews
  )
  const { fallbackProjectView, handlers: draftProjectViewbarHandlers } =
    useProjectDraftViewState({
      layout,
      routeKey,
      scopeId,
      scopeType,
      setLayout,
      team,
    })
  const hasSavedProjectView = activeView !== null
  const displayedProjectViews = getDisplayedProjectViews(
    projectViews,
    fallbackProjectView
  )
  const persistedProjectViewIds = new Set(projectViews.map((view) => view.id))
  const effectiveProjectView = useEffectiveProjectView({
    activeView,
    fallbackProjectView,
    layout,
  })
  const projectViewbarHandlers = getProjectViewbarHandlers({
    activeView,
    draftHandlers: draftProjectViewbarHandlers,
    hasSavedProjectView,
    routeKey,
  })

  return {
    activeView,
    displayedProjectViews,
    effectiveProjectView,
    layout,
    persistedProjectViewIds,
    projectViewbarHandlers,
  }
}

function getVisibleProjectsForEffectiveView(input: {
  data: AppData
  effectiveProjectView: ViewDefinition | null
  projects: Project[]
}) {
  if (!input.effectiveProjectView) {
    return input.projects
  }

  return getVisibleProjectsForView(
    input.data,
    input.projects,
    input.effectiveProjectView
  )
}

function buildProjectSectionsForView(input: {
  data: AppData
  effectiveProjectView: ViewDefinition | null
  visibleProjects: Project[]
}) {
  if (!input.effectiveProjectView) {
    return []
  }

  return buildGroupedSections({
    items: input.visibleProjects,
    grouping: input.effectiveProjectView.grouping,
    subGrouping: input.effectiveProjectView.subGrouping,
    getGroupKey: (project, field) => getProjectGroupKey(project, field),
    getGroupLabel: (field, key) => getProjectGroupLabel(input.data, field, key),
    compareGroupKeys: (field, left, right) =>
      compareProjectGroupKeys(input.data, field, left, right),
  })
}

function useProjectSectionsForView(input: {
  data: AppData
  effectiveProjectView: ViewDefinition | null
  visibleProjects: Project[]
}) {
  const { data, effectiveProjectView, visibleProjects } = input

  return useMemo(
    () =>
      buildProjectSectionsForView({
        data,
        effectiveProjectView,
        visibleProjects,
      }),
    [data, effectiveProjectView, visibleProjects]
  )
}

function getEmptyProjectsLabel(projects: Project[]) {
  return projects.length === 0
    ? "No projects yet"
    : "No projects match the current view."
}

function useCanEditProjectsScreen({
  scopeId,
  team,
}: {
  scopeId: string
  team?: Team | null
}) {
  return useAppStore((state) =>
    team ? canEditTeam(state, team.id) : canEditWorkspace(state, scopeId)
  )
}

function getProjectsScreenDisabledTitle(team?: Team | null) {
  return team && !teamHasFeature(team, "projects")
    ? "Projects are disabled for this team"
    : null
}

function getProjectsContentViewState({
  effectiveProjectView,
  layout,
}: {
  effectiveProjectView: ViewDefinition | null
  layout: "list" | "board"
}) {
  return {
    displayProps: effectiveProjectView?.displayProps ?? [],
    layout: effectiveProjectView?.layout ?? layout,
  }
}

function ProjectsScreenViewbarSlot({
  canCreateProject,
  projectViewbarHandlers,
  projects,
  team,
  view,
}: {
  canCreateProject: boolean
  projectViewbarHandlers: ProjectViewbarHandlers
  projects: Project[]
  team?: Team | null
  view: ViewDefinition | null
}) {
  if (!view) {
    return null
  }

  return (
    <ProjectsViewbar
      canCreateProject={canCreateProject}
      handlers={projectViewbarHandlers}
      projects={projects}
      team={team}
      view={view}
    />
  )
}

export function ProjectsScreen({
  scopeType,
  scopeId,
  team,
  title,
}: ProjectsScreenProps) {
  const { data, hasLoadedOnce, projects, projectViews } =
    useProjectsScreenReadModel({ scopeId, scopeType })
  const routeKey = getProjectsScreenRouteKey(team)
  const {
    activeView,
    displayedProjectViews,
    effectiveProjectView,
    layout,
    persistedProjectViewIds,
    projectViewbarHandlers,
  } = useProjectsScreenViewState({
    projectViews,
    routeKey,
    scopeId,
    scopeType,
    team,
  })
  const editable = useCanEditProjectsScreen({ scopeId, team })
  const canCreateProject = editable
  const visibleProjects = getVisibleProjectsForEffectiveView({
    data,
    effectiveProjectView,
    projects,
  })
  const projectSections = useProjectSectionsForView({
    data,
    effectiveProjectView,
    visibleProjects,
  })
  const contentViewState = getProjectsContentViewState({
    effectiveProjectView,
    layout,
  })
  const emptyProjectsLabel = getEmptyProjectsLabel(projects)
  const disabledTitle = getProjectsScreenDisabledTitle(team)

  if (disabledTitle) {
    return <MissingState title={disabledTitle} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <ProjectsTopbar
        activeView={activeView}
        displayedProjectViews={displayedProjectViews}
        editable={editable}
        effectiveProjectView={effectiveProjectView}
        persistedProjectViewIds={persistedProjectViewIds}
        routeKey={routeKey}
        scopeId={scopeId}
        team={team}
        title={title}
      />
      <ProjectsScreenViewbarSlot
        canCreateProject={canCreateProject}
        projectViewbarHandlers={projectViewbarHandlers}
        projects={projects}
        team={team}
        view={effectiveProjectView}
      />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ProjectsContent
          data={data}
          displayProps={contentViewState.displayProps}
          emptyProjectsLabel={emptyProjectsLabel}
          hasLoadedOnce={hasLoadedOnce}
          layout={contentViewState.layout}
          sections={projectSections}
          visibleProjects={visibleProjects}
        />
      </div>
    </div>
  )
}

export function ViewsScreen({
  scopeType,
  scopeId,
  title,
}: {
  scopeType: "team" | "workspace"
  scopeId: string
  title: string
  description?: string
}) {
  const { hasLoadedOnce } = useScopedReadModelRefresh({
    enabled: Boolean(scopeId),
    scopeKeys: getViewCatalogScopeKeys(scopeType, scopeId),
    fetchLatest: () => fetchViewCatalogReadModel(scopeType, scopeId),
    diagnostics: {
      retainedData: Boolean(scopeId),
      surface: `${scopeType}/views`,
    },
  })
  const views = useAppStore(
    useShallow((state) =>
      scopeType === "workspace"
        ? getWorkspaceDirectoryViews(state, scopeId)
        : state.views.filter(
            (view) =>
              !view.containerType &&
              view.scopeType === scopeType &&
              view.scopeId === scopeId
          )
    )
  )
  const viewContext = useAppStore(
    useShallow((state) => ({
      projects: state.projects,
      teams: state.teams,
      workspaces: state.workspaces,
      currentWorkspaceId: state.currentWorkspaceId,
    }))
  )
  const viewScopeLabels = useMemo(
    () =>
      Object.fromEntries(
        views.map((view) => [view.id, getViewContextLabel(viewContext, view)])
      ),
    [viewContext, views]
  )
  const viewProjectLabels = useMemo(
    () =>
      Object.fromEntries(
        viewContext.projects.map((project) => [project.id, project.name])
      ),
    [viewContext.projects]
  )
  const directorySurfaceKey = `views-directory:${scopeType}:${scopeId}`
  const directoryConfig = useAppStore(
    useShallow(
      (state) =>
        state.ui.viewerDirectoryConfigByRoute[
          getViewerScopedDirectoryKey(state.currentUserId, directorySurfaceKey)
        ]
    )
  )
  const { filters, grouping, layout, properties, sortBy, subGrouping } =
    getResolvedViewsDirectorySettings(directoryConfig)
  const editable = useAppStore((state) =>
    scopeType === "team"
      ? canEditTeam(state, scopeId)
      : canEditWorkspace(state, scopeId)
  )
  const availableEntityKinds = useMemo(
    () => getAvailableViewEntityKinds(views),
    [views]
  )
  const availableScopes = useMemo(
    () => getAvailableViewScopes(views, scopeType),
    [scopeType, views]
  )
  const orderedViews = getOrderedDirectoryViews({
    filters,
    scopeType,
    sortBy,
    views,
  })
  const viewSections = getViewsDirectorySections({
    grouping,
    orderedViews,
    projectLabels: viewProjectLabels,
    scopeLabels: viewScopeLabels,
    scopeType,
    subGrouping,
  })
  const displayState = getViewDirectoryDisplayState(properties)
  const emptyTitle =
    views.length === 0
      ? "No saved views yet"
      : "No saved views match the current settings."

  function updateDirectoryConfig(patch: ViewerDirectoryConfig) {
    useAppStore
      .getState()
      .patchViewerDirectoryConfig(directorySurfaceKey, patch)
  }

  function updateDirectoryFilters(
    resolveNextFilters: (
      current: ViewsDirectoryFilters
    ) => ViewsDirectoryFilters
  ) {
    updateDirectoryConfig({
      filters: resolveNextFilters(
        getCurrentViewsDirectorySettings(directorySurfaceKey).filters
      ),
    })
  }

  function updateDirectoryProperties(
    resolveNextProperties: (
      current: ViewsDirectoryProperty[]
    ) => ViewsDirectoryProperty[]
  ) {
    updateDirectoryConfig({
      displayProps: resolveNextProperties(
        getCurrentViewsDirectorySettings(directorySurfaceKey).properties
      ),
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <Topbar>
        <HeaderTitle title={title} />
      </Topbar>
      <ViewsDirectoryViewbar
        availableEntityKinds={availableEntityKinds}
        availableScopes={availableScopes}
        editable={editable}
        filters={filters}
        grouping={grouping}
        layout={layout}
        onUpdateConfig={updateDirectoryConfig}
        onUpdateFilters={updateDirectoryFilters}
        onUpdateProperties={updateDirectoryProperties}
        properties={properties}
        scopeId={scopeId}
        scopeType={scopeType}
        sortBy={sortBy}
        subGrouping={subGrouping}
      />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ViewsDirectoryContent
          display={{
            ...displayState,
            projectLabels: viewProjectLabels,
            scopeLabels: viewScopeLabels,
            scopeType,
          }}
          emptyTitle={emptyTitle}
          grouping={grouping}
          hasLoadedOnce={hasLoadedOnce}
          layout={layout}
          orderedViews={orderedViews}
          sections={viewSections}
        />
      </div>
    </div>
  )
}

export function DocsScreen({
  scopeType,
  scopeId,
  team,
  title,
}: {
  scopeType: "team" | "workspace"
  scopeId: string
  team?: Team | null
  title: string
  description?: string
}) {
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const currentUserId = useAppStore((state) => state.currentUserId)
  const { hasLoadedOnce } = useScopedReadModelRefresh({
    enabled: Boolean(scopeId),
    scopeKeys: getDocumentIndexScopeKeys(scopeType, scopeId, currentUserId),
    fetchLatest: () => fetchDocumentIndexReadModel(scopeType, scopeId),
    diagnostics: {
      retainedData: Boolean(scopeId),
      surface: `${scopeType}/documents`,
    },
  })
  const activeTeamId = useAppStore((state) => state.ui.activeTeamId)
  const persistedTeamDocViews = useAppStore(
    useShallow((state) => selectTeamDocViews(state, scopeId, team))
  )
  const persistedWorkspaceDocViews = useAppStore(
    useShallow((state) =>
      selectWorkspaceDocViews(state, { scopeId, scopeType, team })
    )
  )
  const isWorkspaceDocs = isWorkspaceDocsScope(scopeType, team)
  const [dialogOpen, setDialogOpen] = useState(false)
  const routeKey = getDocsRouteKey(scopeType, team)
  const systemDocViews = useMemo(
    () =>
      getDocsSystemViews({
        currentUserId,
        scopeId,
        scopeType,
        team,
      }),
    [currentUserId, scopeId, scopeType, team]
  )
  const docViews = useMemo(
    () =>
      mergeDocsViews(
        systemDocViews,
        getPersistedDocsViews({
          isWorkspaceDocs,
          persistedTeamDocViews,
          persistedWorkspaceDocViews,
        })
      ),
    [
      isWorkspaceDocs,
      persistedTeamDocViews,
      persistedWorkspaceDocViews,
      systemDocViews,
    ]
  )
  const docLayoutState = useCollectionLayout(routeKey, docViews)
  const activeView = docLayoutState.activeView
  const activeTab = getActiveDocsTab(activeView)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  )
  const baseDocuments = useMemo(
    () =>
      getDocsBaseDocuments({
        data,
        scopeId,
        scopeType,
        isWorkspaceDocs,
      }),
    [data, isWorkspaceDocs, scopeId, scopeType]
  )
  const documents = useMemo(
    () => getDocumentsForView(baseDocuments, activeView),
    [activeView, baseDocuments]
  )
  const docSections = useMemo(
    () => buildDocsSections(data, documents, activeView),
    [activeView, data, documents]
  )
  const dialogInput = getDocsDialogInput({
    activeTab,
    activeTeamId,
    isWorkspaceDocs,
    scopeId,
    team,
  })
  const editable = useAppStore((state) => selectDocsEditable(state, team))
  const emptyTitle = getDocsEmptyTitle(isWorkspaceDocs, activeTab)
  const selectedDocument =
    selectedDocumentId !== null
      ? (documents.find((document) => document.id === selectedDocumentId) ??
        null)
      : null

  if (isTeamDocsDisabled(team)) {
    return <MissingState title="Docs are disabled for this team" />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <Topbar>
        <HeaderTitle title={title} />
        <DocsViewTabs
          activeView={activeView}
          editable={editable}
          routeKey={routeKey}
          scopeId={scopeId}
          scopeType={scopeType}
          views={docViews}
        />
      </Topbar>
      <CreateDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        input={dialogInput}
        disabled={!editable}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DocsTaskbar
            activeView={activeView}
            data={data}
            documents={baseDocuments}
            editable={editable}
            layout={docLayoutState.layout}
            onCreateDocument={() => setDialogOpen(true)}
            onLayoutChange={docLayoutState.setLayout}
            routeKey={routeKey}
          />
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <DocsContent
              data={data}
              documents={documents}
              displayProps={activeView?.displayProps}
              emptyTitle={emptyTitle}
              hasLoadedOnce={hasLoadedOnce}
              layout={docLayoutState.layout}
              sections={docSections}
              onOpenProperties={setSelectedDocumentId}
            />
          </div>
        </div>
        {selectedDocument ? (
          <DocumentDetailSidebarSurface
            data={data}
            document={selectedDocument}
            editable={canEditDocumentInUi(data, selectedDocument)}
            open={Boolean(selectedDocument)}
            onClose={() => setSelectedDocumentId(null)}
          />
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Create dialogs                                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                  */

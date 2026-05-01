"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { type ComponentProps, useEffect, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { format } from "date-fns"
import {
  CalendarDots,
  FileText,
  Plus,
  Rows,
  SquaresFour,
} from "@phosphor-icons/react"

import {
  canEditTeam,
  canEditWorkspace,
  getAccessibleTeams,
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
  teamHasFeature,
} from "@/lib/domain/selectors"
import { formatCalendarDateLabel } from "@/lib/date-input"
import {
  getWorkSurfaceCopy,
  projectStatusMeta,
  priorityMeta,
  templateMeta,
  type AppData,
  type DisplayProperty,
  type Document as AppDocument,
  type GroupField,
  type Project,
  type ScopeType,
  type Team,
  type ViewDefinition,
  type ViewerDirectoryConfig,
} from "@/lib/domain/types"
import {
  buildAssignedWorkViews,
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
  CollectionDisplaySettingsPopover,
  HeaderTitle,
  MissingState,
  SCREEN_HEADER_CLASS_NAME,
  ScreenHeader,
  formatEntityKind,
  getDocumentPreview,
} from "@/components/app/screens/shared"
export { InboxScreen } from "@/components/app/screens/inbox-screen"
import { CreateDocumentDialog } from "@/components/app/screens/create-document-dialog"
import { DocumentContextMenu } from "@/components/app/screens/document-ui"
import {
  ProjectContextMenu,
  ViewContextMenu,
} from "@/components/app/screens/entity-context-menus"
export { ProjectDetailScreen } from "@/components/app/screens/project-detail-screen"
import {
  createEmptyViewFilters,
  selectAppDataSnapshot,
  type ViewFilterKey,
} from "@/components/app/screens/helpers"
import { DocumentBoard } from "@/components/app/screens/collection-boards"
import { WorkSurface } from "@/components/app/screens/work-surface"
import { getViewHref } from "@/lib/domain/default-views"
import {
  GroupChipPopover,
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
import {
  IconButton,
  Topbar,
  Viewbar,
} from "@/components/ui/template-primitives"
import { cn } from "@/lib/utils"
export { DocumentDetailScreen } from "@/components/app/screens/document-detail-screen"
export { WorkItemDetailScreen } from "@/components/app/screens/work-item-detail-screen"

function ScopedScreenLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-20 text-sm text-muted-foreground">
      {label}
    </div>
  )
}

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
  const searchParams = useSearchParams()
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
}

type GroupedSection<T> = {
  key: string
  label: string
  items: T[]
  children: GroupedSection<T>[] | null
}

const PROJECT_STATUS_ORDER = [
  "backlog",
  "planned",
  "in-progress",
  "completed",
  "cancelled",
] as const

const DEFAULT_PROJECT_DISPLAY_PROPS: DisplayProperty[] = [
  "id",
  "status",
  "assignee",
  "priority",
  "updated",
]

const DEFAULT_VIEW_DIRECTORY_PROPERTIES: ViewsDirectoryProperty[] = [
  "description",
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
  showScope: boolean
  showUpdated: boolean
}

type CollectionLayoutState = ReturnType<typeof useCollectionLayout>
type CreateDocumentDialogInput = ComponentProps<
  typeof CreateDocumentDialog
>["input"]
type DocsTab = "workspace" | "private"

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
    return "Template"
  }

  return getGroupFieldOptionLabel(field)
}

function getProjectPropertyLabel(property: DisplayProperty) {
  if (property === "assignee") {
    return "Lead"
  }

  if (property === "dueDate") {
    return "Target date"
  }

  if (property === "type") {
    return "Template"
  }

  if (property === "created") {
    return "Created"
  }

  if (property === "updated") {
    return "Updated"
  }

  if (property === "status") {
    return "Status"
  }

  if (property === "priority") {
    return "Priority"
  }

  if (property === "id") {
    return "ID"
  }

  return property
}

function buildGroupedSections<T>({
  items,
  grouping,
  subGrouping,
  getGroupKey,
  getGroupLabel,
  compareGroupKeys,
}: {
  items: T[]
  grouping: string | null
  subGrouping: string | null
  getGroupKey: (item: T, field: string) => string
  getGroupLabel: (field: string, key: string) => string
  compareGroupKeys: (field: string, left: string, right: string) => number
}): GroupedSection<T>[] {
  if (!grouping || grouping === "none") {
    return [
      {
        key: "all",
        label: "All",
        items,
        children: null,
      },
    ]
  }

  const groups = new Map<string, T[]>()

  for (const item of items) {
    const key = getGroupKey(item, grouping)
    const current = groups.get(key)

    if (current) {
      current.push(item)
      continue
    }

    groups.set(key, [item])
  }

  const orderedKeys = [...groups.keys()].sort((left, right) =>
    compareGroupKeys(grouping, left, right)
  )

  return orderedKeys.map((key) => {
    const groupedItems = groups.get(key) ?? []

    if (!subGrouping || subGrouping === "none" || subGrouping === grouping) {
      return {
        key,
        label: getGroupLabel(grouping, key),
        items: groupedItems,
        children: null,
      }
    }

    const subGroups = new Map<string, T[]>()

    for (const item of groupedItems) {
      const subKey = getGroupKey(item, subGrouping)
      const current = subGroups.get(subKey)

      if (current) {
        current.push(item)
        continue
      }

      subGroups.set(subKey, [item])
    }

    const orderedSubKeys = [...subGroups.keys()].sort((left, right) =>
      compareGroupKeys(subGrouping, left, right)
    )

    return {
      key,
      label: getGroupLabel(grouping, key),
      items: groupedItems,
      children: orderedSubKeys.map((subKey) => ({
        key: `${key}:${subKey}`,
        label: getGroupLabel(subGrouping, subKey),
        items: subGroups.get(subKey) ?? [],
        children: null,
      })),
    }
  })
}

function getProjectGroupKey(project: Project, field: string) {
  if (field === "priority") {
    return project.priority
  }

  if (field === "team") {
    return project.scopeType === "team" ? project.scopeId : "__workspace__"
  }

  if (field === "assignee") {
    return project.leadId || "__unassigned__"
  }

  if (field === "type") {
    return project.templateType
  }

  return project.status
}

function getProjectGroupLabel(data: AppData, field: string, key: string) {
  if (field === "priority") {
    return priorityMeta[key as keyof typeof priorityMeta]?.label ?? "None"
  }

  if (field === "team") {
    return key === "__workspace__"
      ? "Workspace"
      : (getTeam(data, key)?.name ?? "Unknown team")
  }

  if (field === "assignee") {
    return key === "__unassigned__"
      ? "Unassigned"
      : (getUser(data, key)?.name ?? "Unknown lead")
  }

  if (field === "type") {
    return templateMeta[key as keyof typeof templateMeta]?.label ?? "Template"
  }

  return (
    projectStatusMeta[key as keyof typeof projectStatusMeta]?.label ?? "Status"
  )
}

function compareProjectGroupKeys(
  data: AppData,
  field: string,
  left: string,
  right: string
) {
  if (field === "priority") {
    return (
      priorityMeta[right as keyof typeof priorityMeta].weight -
      priorityMeta[left as keyof typeof priorityMeta].weight
    )
  }

  if (field === "team") {
    if (left === "__workspace__" && right !== "__workspace__") {
      return -1
    }

    if (right === "__workspace__" && left !== "__workspace__") {
      return 1
    }

    return getProjectGroupLabel(data, field, left).localeCompare(
      getProjectGroupLabel(data, field, right)
    )
  }

  if (field === "status") {
    return (
      PROJECT_STATUS_ORDER.indexOf(
        left as (typeof PROJECT_STATUS_ORDER)[number]
      ) -
      PROJECT_STATUS_ORDER.indexOf(
        right as (typeof PROJECT_STATUS_ORDER)[number]
      )
    )
  }

  return getProjectGroupLabel(data, field, left).localeCompare(
    getProjectGroupLabel(data, field, right)
  )
}

function getProjectDisplayToken(
  data: AppData,
  project: Project,
  property: DisplayProperty
) {
  switch (property) {
    case "id":
      return {
        key: property,
        label: `ID ${project.id.slice(0, 8)}`,
      }
    case "status":
      return {
        key: property,
        label:
          projectStatusMeta[project.status as keyof typeof projectStatusMeta]
            ?.label ?? "Status",
      }
    case "priority":
      return {
        key: property,
        label: priorityMeta[project.priority].label,
      }
    case "assignee":
      return {
        key: property,
        label: getUser(data, project.leadId)?.name ?? "Unassigned",
      }
    case "type":
      return {
        key: property,
        label: templateMeta[project.templateType].label,
      }
    case "dueDate": {
      const targetDateLabel = formatCalendarDateLabel(project.targetDate, "")

      return targetDateLabel
        ? {
            key: property,
            label: targetDateLabel,
          }
        : null
    }
    case "created":
      return {
        key: property,
        label: `Created ${format(new Date(project.createdAt), "MMM d")}`,
      }
    case "updated":
      return {
        key: property,
        label: `Updated ${format(new Date(project.updatedAt), "MMM d")}`,
      }
    default:
      return null
  }
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

function getViewDirectoryGroupKey(
  view: ViewDefinition,
  field: ViewsDirectoryGroupField,
  scopeType: "team" | "workspace",
  scopeLabels: Record<string, string>
) {
  if (field === "entity") {
    return view.entityKind
  }

  return getViewDirectoryScopeLabel({
    view,
    scopeType,
    scopeLabels,
  })
}

function getViewDirectoryGroupLabel(
  field: ViewsDirectoryGroupField,
  key: string
) {
  if (field === "entity") {
    return formatEntityKind(key as ViewDefinition["entityKind"])
  }

  return key
}

function getResolvedViewsDirectorySettings(
  directoryConfig: ViewerDirectoryConfig | null | undefined
): ViewsDirectorySettings {
  const resolvedDirectoryConfig = applyViewerDirectoryConfig(
    DEFAULT_VIEWS_DIRECTORY_CONFIG,
    directoryConfig
  )

  return {
    layout: (resolvedDirectoryConfig.layout ?? "list") as "list" | "board",
    sortBy:
      (resolvedDirectoryConfig.ordering as
        | ViewsDirectorySortField
        | undefined) ?? "updated",
    filters: {
      entityKinds:
        (resolvedDirectoryConfig.filters
          ?.entityKinds as ViewDefinition["entityKind"][]) ?? [],
      scopes:
        (resolvedDirectoryConfig.filters
          ?.scopes as ViewsDirectoryScopeFilter[]) ?? [],
    },
    grouping:
      (resolvedDirectoryConfig.grouping as
        | ViewsDirectoryGroupField
        | undefined) ?? "none",
    subGrouping:
      (resolvedDirectoryConfig.subGrouping as
        | ViewsDirectoryGroupField
        | undefined) ?? "none",
    properties:
      (resolvedDirectoryConfig.displayProps as
        | ViewsDirectoryProperty[]
        | undefined) ?? DEFAULT_VIEW_DIRECTORY_PROPERTIES,
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
  scopeLabels,
  scopeType,
  subGrouping,
}: {
  grouping: ViewsDirectoryGroupField
  orderedViews: ViewDefinition[]
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
      getViewDirectoryGroupLabel(field as ViewsDirectoryGroupField, key),
    compareGroupKeys: (field, left, right) =>
      getViewDirectoryGroupLabel(
        field as ViewsDirectoryGroupField,
        left
      ).localeCompare(
        getViewDirectoryGroupLabel(field as ViewsDirectoryGroupField, right)
      ),
  })
}

function getViewDirectoryDisplayState(
  properties: ViewsDirectoryProperty[]
): ViewDirectoryDisplayState {
  return {
    showConfiguration: properties.includes("configuration"),
    showDescription: properties.includes("description"),
    showScope: properties.includes("scope"),
    showUpdated: properties.includes("updated"),
  }
}

function toggleArrayValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value]
}

function getDocsLayoutState({
  activeTab,
  isWorkspaceDocs,
  privateLayoutState,
  teamLayoutState,
  workspaceLayoutState,
}: {
  activeTab: DocsTab
  isWorkspaceDocs: boolean
  privateLayoutState: CollectionLayoutState
  teamLayoutState: CollectionLayoutState
  workspaceLayoutState: CollectionLayoutState
}) {
  if (!isWorkspaceDocs) {
    return teamLayoutState
  }

  return activeTab === "workspace" ? workspaceLayoutState : privateLayoutState
}

function getDocsDialogInput({
  activeTab,
  activeTeamId,
  isWorkspaceDocs,
  scopeId,
  team,
}: {
  activeTab: DocsTab
  activeTeamId: string
  isWorkspaceDocs: boolean
  scopeId: string
  team?: Team | null
}): CreateDocumentDialogInput {
  if (isWorkspaceDocs) {
    return activeTab === "workspace"
      ? { kind: "workspace-document", workspaceId: scopeId }
      : { kind: "private-document", workspaceId: scopeId }
  }

  return {
    kind: "team-document",
    teamId: team?.id ?? activeTeamId,
  }
}

function getDocsEmptyTitle(isWorkspaceDocs: boolean, activeTab: DocsTab) {
  if (!isWorkspaceDocs) {
    return "No documents yet"
  }

  return activeTab === "workspace"
    ? "No workspace documents yet"
    : "No private documents yet"
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

function ProjectHealthPill({ project }: { project: Project }) {
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

function ProjectIconTile({ project }: { project: Project }) {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-3 text-fg-2"
    >
      <span className="text-[13px] font-semibold">
        {project.name.charAt(0).toUpperCase()}
      </span>
    </span>
  )
}

function ProjectDisplayTokenRow({
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
  const projectTeam =
    project.scopeType === "team" ? getTeam(data, project.scopeId) : null
  const tokens = getProjectDisplayTokens(data, project, displayProps)

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-fg-3",
        className
      )}
    >
      <span>{projectTeam?.name ?? "Workspace"}</span>
      {tokens.map((token) => (
        <span key={token.key} className="inline-flex items-center gap-2">
          <span aria-hidden className="text-fg-4">
            ·
          </span>
          <span>{token.label}</span>
        </span>
      ))}
    </div>
  )
}

function ProjectRow({
  data,
  project,
  displayProps,
}: {
  data: AppData
  project: Project
  displayProps: DisplayProperty[]
}) {
  const progress = getProjectProgress(data, project.id)
  const summary = project.summary || project.description

  return (
    <ProjectContextMenu data={data} project={project}>
      <Link
        className="group block border-b border-line-soft px-7 py-3 transition-colors hover:bg-surface-2"
        href={getProjectHref(data, project) ?? "/workspace/projects"}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <ProjectIconTile project={project} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-[14px] font-semibold tracking-[-0.005em] text-foreground group-hover:underline">
                  {project.name}
                </span>
                <ProjectHealthPill project={project} />
              </div>
              <ProjectDisplayTokenRow
                className="mt-1"
                data={data}
                project={project}
                displayProps={displayProps}
              />
              {summary ? (
                <p className="mt-1.5 line-clamp-2 max-w-2xl text-[12.5px] leading-5 text-fg-2">
                  {summary}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:w-[340px] lg:shrink-0">
            <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
              <div className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="absolute inset-y-0 left-0 rounded-full opacity-90"
                  style={{
                    left: `${progress.completedPercent}%`,
                    width: `${progress.inProgressOnlyPercent}%`,
                    background: "var(--status-doing)",
                  }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${progress.completedPercent}%`,
                    background: "var(--status-done)",
                  }}
                />
              </div>
              <span className="w-9 text-right tabular-nums">
                {progress.completedPercent}%
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
              <span>{progress.scope} items</span>
            </div>
          </div>
        </div>
      </Link>
    </ProjectContextMenu>
  )
}

function ProjectCard({
  data,
  project,
  displayProps,
}: {
  data: AppData
  project: Project
  displayProps: DisplayProperty[]
}) {
  const progress = getProjectProgress(data, project.id)
  const summary = project.summary || project.description

  return (
    <ProjectContextMenu data={data} project={project}>
      <Link
        className="group flex min-h-[168px] flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 transition-all hover:-translate-y-px hover:border-fg-4 hover:shadow-sm"
        href={getProjectHref(data, project) ?? "/workspace/projects"}
      >
        <div className="flex items-center gap-2.5">
          <ProjectIconTile project={project} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] leading-[1.3] font-semibold tracking-[-0.005em] text-foreground group-hover:underline">
              {project.name}
            </h2>
            <ProjectDisplayTokenRow
              className="mt-px"
              data={data}
              project={project}
              displayProps={displayProps}
            />
          </div>
        </div>

        {summary ? (
          <p className="line-clamp-2 text-[12.5px] leading-[1.5] text-fg-2">
            {summary}
          </p>
        ) : null}

        <div className="flex items-center gap-2.5 text-[11.5px] text-fg-3">
          <ProjectHealthPill project={project} />
          <div className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className="absolute inset-y-0 left-0 rounded-full opacity-90 transition-all"
              style={{
                left: `${progress.completedPercent}%`,
                width: `${progress.inProgressOnlyPercent}%`,
                background: "var(--status-doing)",
              }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{
                width: `${progress.completedPercent}%`,
                background: "var(--status-done)",
              }}
            />
          </div>
          <span className="tabular-nums">{progress.completedPercent}%</span>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-dashed border-line pt-2 text-[11.5px] text-fg-3">
          <span>{progress.scope} items</span>
        </div>
      </Link>
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

function ViewConfigurationBadges({ view }: { view: ViewDefinition }) {
  const layoutMeta = viewDirectoryLayoutMeta[view.layout]

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-fg-3">
      <span className="rounded-md border border-line bg-surface px-1.5 py-1">
        {formatEntityKind(view.entityKind)}
      </span>
      <span className="rounded-md border border-line bg-surface px-1.5 py-1">
        {layoutMeta.label}
      </span>
      <span className="rounded-md border border-line bg-surface px-1.5 py-1">
        {getGroupFieldOptionLabel(view.grouping)}
        {view.subGrouping
          ? ` / ${getGroupFieldOptionLabel(view.subGrouping)}`
          : ""}
      </span>
    </div>
  )
}

function SavedViewRow({
  scopeLabel,
  showConfiguration,
  showDescription,
  showScope,
  showUpdated,
  view,
}: {
  scopeLabel: string
  showConfiguration: boolean
  showDescription: boolean
  showScope: boolean
  showUpdated: boolean
  view: ViewDefinition
}) {
  const layoutMeta = viewDirectoryLayoutMeta[view.layout]
  const LayoutIcon = layoutMeta.icon
  const updatedLabel = showUpdated
    ? format(new Date(view.updatedAt), "MMM d")
    : null

  return (
    <ViewContextMenu view={view}>
      <Link
        className="group flex items-start gap-3 border-b border-line-soft px-6 py-3 transition-colors hover:bg-surface-2 sm:px-7"
        href={getViewHref(view)}
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-md text-white"
          style={{ background: layoutMeta.accent }}
        >
          <LayoutIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-[13.5px] font-medium text-foreground group-hover:underline">
                  {view.name}
                </span>
                {showScope ? (
                  <span className="text-[11.5px] text-fg-3">{scopeLabel}</span>
                ) : null}
              </div>
            </div>
            {showConfiguration || updatedLabel ? (
              <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
                {showConfiguration ? (
                  <ViewConfigurationBadges view={view} />
                ) : null}
                {updatedLabel ? (
                  <div className="shrink-0 self-start text-[12px] text-fg-3 tabular-nums">
                    {updatedLabel}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {showDescription && view.description ? (
            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-fg-3">
              {view.description}
            </p>
          ) : null}
        </div>
      </Link>
    </ViewContextMenu>
  )
}

function SavedViewCard({
  scopeLabel,
  showConfiguration,
  showDescription,
  showScope,
  showUpdated,
  view,
}: {
  scopeLabel: string
  showConfiguration: boolean
  showDescription: boolean
  showScope: boolean
  showUpdated: boolean
  view: ViewDefinition
}) {
  const layoutMeta = viewDirectoryLayoutMeta[view.layout]
  const LayoutIcon = layoutMeta.icon

  return (
    <ViewContextMenu view={view}>
      <Link
        className="group flex h-full min-h-[168px] flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 transition-all hover:-translate-y-px hover:border-fg-4 hover:shadow-sm"
        href={getViewHref(view)}
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-md"
            style={{
              color: layoutMeta.accent,
              background: `color-mix(in oklch, ${layoutMeta.accent} 18%, transparent)`,
            }}
          >
            <LayoutIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] leading-[1.3] font-semibold tracking-[-0.005em] text-foreground">
              {view.name}
            </h2>
            {showScope || showUpdated ? (
              <div className="mt-px truncate text-[11.5px] text-fg-3">
                {[
                  showScope ? scopeLabel : null,
                  showUpdated
                    ? format(new Date(view.updatedAt), "MMM d")
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            ) : null}
          </div>
        </div>
        {showDescription && view.description ? (
          <p className="line-clamp-2 text-[12.5px] leading-[1.5] text-fg-2">
            {view.description}
          </p>
        ) : null}
        {showConfiguration ? <ViewConfigurationBadges view={view} /> : null}
      </Link>
    </ViewContextMenu>
  )
}

type ViewsDirectoryItemDisplay = ViewDirectoryDisplayState & {
  scopeLabels: Record<string, string>
  scopeType: "team" | "workspace"
}

function getSavedViewItemProps(
  view: ViewDefinition,
  display: ViewsDirectoryItemDisplay
) {
  return {
    scopeLabel: getViewDirectoryScopeLabel({
      view,
      scopeLabels: display.scopeLabels,
      scopeType: display.scopeType,
    }),
    showConfiguration: display.showConfiguration,
    showDescription: display.showDescription,
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
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
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
    <div className="flex flex-col gap-6 px-7 py-4">
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
    <div className="flex flex-col pb-4">
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
    return <MissingState title={emptyTitle} />
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
    <Viewbar>
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
      <div className="ml-auto flex items-center gap-1.5">
        {editable ? (
          <Button
            size="sm"
            variant="default"
            className="h-7 gap-1.5 px-2.5 text-[12px]"
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

const DOCS_TABS = ["workspace", "private"] as const

function getDocsTabLabel(tab: DocsTab) {
  return tab === "workspace" ? "Workspace" : "Private"
}

function DocsHeaderActions({
  layout,
  onCreateDocument,
  onLayoutChange,
}: {
  layout: "list" | "board"
  onCreateDocument: () => void
  onLayoutChange: (layout: "list" | "board") => void
}) {
  return (
    <div className="flex items-center gap-1">
      <CollectionDisplaySettingsPopover
        layout={layout}
        onLayoutChange={onLayoutChange}
      />
      <Button size="icon-xs" variant="ghost" onClick={onCreateDocument}>
        <Plus className="size-3.5" />
      </Button>
    </div>
  )
}

function WorkspaceDocsTabs({
  activeTab,
  onActiveTabChange,
}: {
  activeTab: DocsTab
  onActiveTabChange: (tab: DocsTab) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {DOCS_TABS.map((tab) => (
        <button
          key={tab}
          className={cn(
            "h-6 rounded-sm px-2 text-xs transition-colors",
            tab === activeTab
              ? "bg-accent font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onActiveTabChange(tab)}
        >
          {getDocsTabLabel(tab)}
        </button>
      ))}
    </div>
  )
}

function DocsHeader({
  activeTab,
  isWorkspaceDocs,
  layout,
  onActiveTabChange,
  onCreateDocument,
  onLayoutChange,
  title,
}: {
  activeTab: DocsTab
  isWorkspaceDocs: boolean
  layout: "list" | "board"
  onActiveTabChange: (tab: DocsTab) => void
  onCreateDocument: () => void
  onLayoutChange: (layout: "list" | "board") => void
  title: string
}) {
  const actions = (
    <DocsHeaderActions
      layout={layout}
      onCreateDocument={onCreateDocument}
      onLayoutChange={onLayoutChange}
    />
  )

  if (!isWorkspaceDocs) {
    return <ScreenHeader title={title} actions={actions} />
  }

  return (
    <div className={SCREEN_HEADER_CLASS_NAME}>
      <div className="flex min-w-0 items-center gap-2">
        <HeaderTitle title={title} />
        <WorkspaceDocsTabs
          activeTab={activeTab}
          onActiveTabChange={onActiveTabChange}
        />
      </div>
      {actions}
    </div>
  )
}

function DocumentListRow({
  data,
  document,
}: {
  data: AppData
  document: AppDocument
}) {
  const preview = getDocumentPreview(document)
  const author = getUser(data, document.updatedBy ?? document.createdBy)

  return (
    <DocumentContextMenu data={data} document={document}>
      <Link
        className="flex items-start px-6 py-3.5 transition-colors hover:bg-accent/40"
        href={`/docs/${document.id}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {document.title}
            </span>
          </div>
          {preview ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {preview}
            </p>
          ) : null}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{author?.name ?? "Unknown"}</span>
            <span>·</span>
            <span>{format(new Date(document.updatedAt), "MMM d")}</span>
          </div>
        </div>
      </Link>
    </DocumentContextMenu>
  )
}

function DocumentList({
  data,
  documents,
}: {
  data: AppData
  documents: AppDocument[]
}) {
  return (
    <div className="flex flex-col divide-y">
      {documents.map((document) => (
        <DocumentListRow key={document.id} data={data} document={document} />
      ))}
    </div>
  )
}

function DocsContent({
  data,
  documents,
  emptyTitle,
  hasLoadedOnce,
  layout,
}: {
  data: AppData
  documents: AppDocument[]
  emptyTitle: string
  hasLoadedOnce: boolean
  layout: "list" | "board"
}) {
  if (!hasLoadedOnce && documents.length === 0) {
    return <ScopedScreenLoading label="Loading documents..." />
  }

  if (documents.length === 0) {
    return <MissingState icon={FileText} title={emptyTitle} />
  }

  if (layout === "board") {
    return <DocumentBoard data={data} documents={documents} />
  }

  return <DocumentList data={data} documents={documents} />
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
    <Viewbar>
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
      <div className="ml-auto flex items-center gap-1.5">
        {canCreateProject ? (
          <Button
            size="sm"
            variant="default"
            className="h-7 gap-1.5 px-2.5 text-[12px]"
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
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
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
    <div className="flex flex-col gap-6 px-7 py-4">
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
    <div className="flex flex-col pb-4">
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
  if (!hasLoadedOnce && visibleProjects.length === 0) {
    return <ScopedScreenLoading label="Loading projects..." />
  }

  if (visibleProjects.length === 0) {
    return <MissingState title={emptyProjectsLabel} />
  }

  if (layout === "board") {
    return (
      <ProjectBoardContent
        data={data}
        displayProps={displayProps}
        sections={sections}
      />
    )
  }

  return (
    <ProjectListContent
      data={data}
      displayProps={displayProps}
      sections={sections}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  Screen components                                                  */
/* ------------------------------------------------------------------ */

export function TeamWorkScreen({ teamSlug }: { teamSlug: string }) {
  const { team } = useRetainedTeamBySlug(teamSlug)
  const { hasLoadedOnce } = useScopedReadModelRefresh({
    enabled: Boolean(team?.id),
    scopeKeys: team ? getWorkIndexScopeKeys("team", team.id) : [],
    fetchLatest: () => fetchWorkIndexReadModel("team", team?.id ?? ""),
  })
  const views = useAppStore(
    useShallow((state) =>
      team ? getViewsForScope(state, "team", team.id, "items") : []
    )
  )
  const items = useAppStore(
    useShallow((state) =>
      team ? getVisibleWorkItems(state, { teamId: team.id }) : []
    )
  )

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

export function AssignedScreen() {
  const { activeTeamId, currentUserId } = useAppStore(
    useShallow((state) => ({
      activeTeamId: state.ui.activeTeamId,
      currentUserId: state.currentUserId,
    }))
  )
  const team = useAppStore((state) => getTeam(state, activeTeamId))
  const { hasLoadedOnce } = useScopedReadModelRefresh({
    enabled: Boolean(currentUserId),
    scopeKeys: currentUserId
      ? getWorkIndexScopeKeys("personal", currentUserId)
      : [],
    fetchLatest: () => fetchWorkIndexReadModel("personal", currentUserId ?? ""),
  })
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
      getVisibleWorkItems(state, { assignedToCurrentUser: true })
    )
  )
  const items = useAppStore(
    useShallow((state) =>
      getVisibleWorkItems(state, { assignedToCurrentUserWithAncestors: true })
    )
  )
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

export function ProjectsScreen({
  scopeType,
  scopeId,
  team,
  title,
}: {
  scopeType: ScopeType
  scopeId: string
  team?: Team | null
  title: string
  description?: string
}) {
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const { hasLoadedOnce } = useScopedReadModelRefresh({
    enabled: Boolean(scopeId),
    scopeKeys: getProjectIndexScopeKeys(scopeType, scopeId),
    fetchLatest: () => fetchProjectIndexReadModel(scopeType, scopeId),
  })
  const projects = useAppStore(
    useShallow((state) => getProjectsForScope(state, scopeType, scopeId))
  )
  const projectViews = useAppStore(
    useShallow((state) =>
      getViewsForScope(
        state,
        scopeType === "team" ? "team" : "workspace",
        scopeId,
        "projects"
      )
    )
  )
  const routeKey = team ? `/team/${team.slug}/projects` : "/workspace/projects"
  const { activeView, layout, setLayout } = useCollectionLayout(
    routeKey,
    projectViews
  )
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
  const editable = useAppStore((state) =>
    team ? canEditTeam(state, team.id) : canEditWorkspace(state, scopeId)
  )
  const canCreateProject = editable
  const hasSavedProjectView = activeView !== null
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
  const displayedProjectViews =
    projectViews.length > 0
      ? projectViews
      : fallbackProjectView
        ? [fallbackProjectView]
        : []
  const persistedProjectViewIds = new Set(projectViews.map((view) => view.id))
  const effectiveProjectView = useMemo(() => {
    const source = activeView ?? fallbackProjectView

    if (!source) {
      return null
    }

    const grouping = PROJECT_GROUP_OPTIONS.includes(source.grouping)
      ? source.grouping
      : "status"
    const subGrouping =
      source.subGrouping &&
      PROJECT_GROUP_OPTIONS.includes(source.subGrouping) &&
      source.subGrouping !== grouping
        ? source.subGrouping
        : null

    return {
      ...source,
      ...(activeView ? {} : { layout }),
      grouping,
      subGrouping,
    }
  }, [activeView, fallbackProjectView, layout])
  const visibleProjects =
    effectiveProjectView !== null
      ? getVisibleProjectsForView(data, projects, effectiveProjectView)
      : projects
  const projectSections = useMemo(
    () =>
      effectiveProjectView
        ? buildGroupedSections({
            items: visibleProjects,
            grouping: effectiveProjectView.grouping,
            subGrouping: effectiveProjectView.subGrouping,
            getGroupKey: (project, field) => getProjectGroupKey(project, field),
            getGroupLabel: (field, key) =>
              getProjectGroupLabel(data, field, key),
            compareGroupKeys: (field, left, right) =>
              compareProjectGroupKeys(data, field, left, right),
          })
        : [],
    [data, effectiveProjectView, visibleProjects]
  )
  const projectDisplayProps = effectiveProjectView?.displayProps ?? []
  const projectLayout = effectiveProjectView?.layout ?? layout
  const emptyProjectsLabel =
    projects.length === 0
      ? "No projects yet"
      : "No projects match the current view."

  function updateProjectView(patch: ViewConfigPatch) {
    if (patch.layout) {
      setLayout(patch.layout === "board" ? "board" : "list")
    }

    if (patch.grouping) {
      setProjectGrouping(patch.grouping)
    }

    if ("subGrouping" in patch) {
      setProjectSubGrouping(patch.subGrouping ?? null)
    }

    if (patch.ordering) {
      setProjectOrdering(patch.ordering)
    }

    if (patch.showCompleted !== undefined) {
      setProjectFilters((current) => ({
        ...current,
        showCompleted: patch.showCompleted ?? true,
      }))
    }
  }

  function toggleProjectFilterValue(key: ViewFilterKey, value: string) {
    setProjectFilters((current) => {
      const nextFilters = { ...current } as ViewDefinition["filters"]
      const currentValues = nextFilters[key] as string[]
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value]

      nextFilters[key] = nextValues as never
      return nextFilters
    })
  }

  function clearProjectFilters() {
    setProjectFilters((current) => ({
      ...createEmptyViewFilters(),
      showCompleted: current.showCompleted,
    }))
  }

  function toggleProjectDisplayProperty(property: DisplayProperty) {
    setProjectDisplayProperties((current) =>
      current.includes(property)
        ? current.filter((value) => value !== property)
        : [...current, property]
    )
  }

  function reorderProjectDisplayProperties(displayProps: DisplayProperty[]) {
    setProjectDisplayProperties(displayProps)
  }

  function clearProjectDisplayProperties() {
    setProjectDisplayProperties([])
  }

  function updateViewerProjectView(patch: ViewConfigPatch) {
    if (!activeView) {
      return
    }

    useAppStore.getState().patchViewerViewConfig(routeKey, activeView.id, patch)
  }

  function toggleViewerProjectFilterValue(key: ViewFilterKey, value: string) {
    if (!activeView) {
      return
    }

    useAppStore
      .getState()
      .toggleViewerViewFilterValue(routeKey, activeView.id, key, value)
  }

  function clearViewerProjectFilters() {
    if (!activeView) {
      return
    }

    useAppStore.getState().clearViewerViewFilters(routeKey, activeView.id)
  }

  function toggleViewerProjectDisplayProperty(property: DisplayProperty) {
    if (!activeView) {
      return
    }

    useAppStore
      .getState()
      .toggleViewerViewDisplayProperty(routeKey, activeView.id, property)
  }

  function reorderViewerProjectDisplayProperties(
    displayProps: DisplayProperty[]
  ) {
    if (!activeView) {
      return
    }

    useAppStore
      .getState()
      .reorderViewerViewDisplayProperties(routeKey, activeView.id, displayProps)
  }

  function clearViewerProjectDisplayProperties() {
    if (!activeView) {
      return
    }

    useAppStore
      .getState()
      .clearViewerViewDisplayProperties(routeKey, activeView.id)
  }

  const projectViewbarHandlers: ProjectViewbarHandlers = hasSavedProjectView
    ? {
        onUpdateView: updateViewerProjectView,
        onToggleFilterValue: toggleViewerProjectFilterValue,
        onClearFilters: clearViewerProjectFilters,
        onToggleDisplayProperty: toggleViewerProjectDisplayProperty,
        onReorderDisplayProperties: reorderViewerProjectDisplayProperties,
        onClearDisplayProperties: clearViewerProjectDisplayProperties,
      }
    : {
        onUpdateView: updateProjectView,
        onToggleFilterValue: toggleProjectFilterValue,
        onClearFilters: clearProjectFilters,
        onToggleDisplayProperty: toggleProjectDisplayProperty,
        onReorderDisplayProperties: reorderProjectDisplayProperties,
        onClearDisplayProperties: clearProjectDisplayProperties,
      }

  if (team && !teamHasFeature(team, "projects")) {
    return <MissingState title="Projects are disabled for this team" />
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
      {effectiveProjectView ? (
        <ProjectsViewbar
          canCreateProject={canCreateProject}
          handlers={projectViewbarHandlers}
          projects={projects}
          team={team}
          view={effectiveProjectView}
        />
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ProjectsContent
          data={data}
          displayProps={projectDisplayProps}
          emptyProjectsLabel={emptyProjectsLabel}
          hasLoadedOnce={hasLoadedOnce}
          layout={projectLayout}
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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ViewsDirectoryContent
          display={{
            ...displayState,
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
  })
  const activeTeamId = useAppStore((state) => state.ui.activeTeamId)
  const teamDocViews = useAppStore(
    useShallow((state) =>
      team ? getViewsForScope(state, "team", scopeId, "docs") : []
    )
  )
  const workspaceDocViews = useAppStore(
    useShallow((state) =>
      scopeType === "workspace" && !team
        ? getViewsForScope(state, "workspace", scopeId, "docs")
        : []
    )
  )
  const isWorkspaceDocs = scopeType === "workspace" && !team
  const [activeTab, setActiveTab] = useState<DocsTab>("workspace")
  const [dialogOpen, setDialogOpen] = useState(false)
  const teamRouteKey = team ? `/team/${team.slug}/docs` : "/workspace/docs/team"
  const teamLayoutState = useCollectionLayout(teamRouteKey, teamDocViews)
  const workspaceLayoutState = useCollectionLayout(
    "/workspace/docs",
    workspaceDocViews
  )
  const privateLayoutState = useCollectionLayout("/workspace/docs/private", [])
  const documents = useAppStore(
    useShallow((state) =>
      isWorkspaceDocs
        ? activeTab === "workspace"
          ? getWorkspaceDocuments(state, scopeId)
          : getPrivateDocuments(state, scopeId)
        : getTeamDocuments(state, scopeId)
    )
  )
  const { layout, setLayout } = getDocsLayoutState({
    activeTab,
    isWorkspaceDocs,
    privateLayoutState,
    teamLayoutState,
    workspaceLayoutState,
  })
  const dialogInput = getDocsDialogInput({
    activeTab,
    activeTeamId,
    isWorkspaceDocs,
    scopeId,
    team,
  })
  const editable = useAppStore((state) =>
    team ? canEditTeam(state, team.id) : true
  )
  const emptyTitle = getDocsEmptyTitle(isWorkspaceDocs, activeTab)

  if (team && !teamHasFeature(team, "docs")) {
    return <MissingState title="Docs are disabled for this team" />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DocsHeader
        activeTab={activeTab}
        isWorkspaceDocs={isWorkspaceDocs}
        layout={layout}
        onActiveTabChange={setActiveTab}
        onCreateDocument={() => setDialogOpen(true)}
        onLayoutChange={setLayout}
        title={title}
      />
      <CreateDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        input={dialogInput}
        disabled={!editable}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <DocsContent
          data={data}
          documents={documents}
          emptyTitle={emptyTitle}
          hasLoadedOnce={hasLoadedOnce}
          layout={layout}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Create dialogs                                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                  */

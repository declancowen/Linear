"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { Plus } from "@phosphor-icons/react"

import {
  canEditTeam,
  canEditWorkspace,
  getViewByRoute,
  getVisibleItemsForView,
  getProjectDetailModel,
  getTemplateDefaultsForTeam,
} from "@/lib/domain/selectors"
import {
  createDefaultProjectPresentationConfig,
  getDefaultViewItemLevelForProjectTemplate,
  getDefaultViewItemLevelForTeamExperience,
  getWorkSurfaceCopy,
  type DisplayProperty,
  type GroupField,
  type OrderingField,
  type ProjectPresentationConfig,
  type ViewDefinition,
} from "@/lib/domain/types"
import { createViewDefinition } from "@/lib/domain/default-views"
import {
  applyViewerViewConfig,
  getViewerScopedViewKey,
} from "@/lib/domain/viewer-view-config"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { fetchProjectDetailReadModel } from "@/lib/convex/client"
import { createMissingScopedReadModelResult } from "@/lib/convex/client/read-models"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import { createProjectDetailScopeKey } from "@/lib/scoped-sync/scope-keys"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { MissingState } from "@/components/app/screens/shared"
import { ViewContextMenu } from "@/components/app/screens/entity-context-menus"
import {
  clearViewFiltersPreservingCompletion,
  cloneViewFilters,
  toggleDisplayPropertyValue,
  toggleViewFilterValue,
  type ViewFilterKey,
  selectAppDataSnapshot,
} from "@/components/app/screens/helpers"
import {
  FilterPopover,
  getAvailableGroupOptions,
  GroupChipPopover,
  LayoutTabs,
  LevelChipPopover,
  PropertiesChipPopover,
  SortChipPopover,
  type ViewConfigPatch,
  ViewConfigPopover,
} from "@/components/app/screens/work-surface-controls"
import {
  BoardView,
  ListView,
  TimelineView,
} from "@/components/app/screens/work-surface-view"
import {
  IconButton,
  Topbar,
  Viewbar,
} from "@/components/ui/template-primitives"
import { cn } from "@/lib/utils"

function ProjectItemsTopbar({
  projectName,
  projectId,
  projectScopeType,
  projectScopeId,
  detailHref,
  projectRoute,
  displayedViews,
  savedViews,
  activeTabId,
  editable,
  onSelectBuiltinView,
  onSelectSavedView,
}: {
  projectName: string
  projectId: string
  projectScopeType: "team" | "workspace"
  projectScopeId: string
  detailHref: string
  projectRoute: string | null
  displayedViews: ViewDefinition[]
  savedViews: ViewDefinition[]
  activeTabId: string
  editable: boolean
  onSelectBuiltinView: (view: ViewDefinition) => void
  onSelectSavedView: (viewId: string) => void
}) {
  return (
    <Topbar>
      <SidebarTrigger className="size-5 shrink-0" />
      <div className="min-w-0 shrink-0 text-sm font-medium text-foreground">
        <span className="truncate">{projectName}</span>
      </div>
      <div className="ml-2 flex items-center gap-0.5">
        {displayedViews.map((view) => {
          const isSavedView = savedViews.some(
            (savedView) => savedView.id === view.id
          )
          const tabButton = (
            <button
              className={cn(
                "h-7 rounded-md px-2 text-[12px] transition-colors",
                view.id === activeTabId
                  ? "bg-surface-3 font-medium text-foreground"
                  : "text-fg-3 hover:bg-surface-3 hover:text-foreground"
              )}
              onClick={() => {
                if (!projectRoute) {
                  return
                }

                if (isSavedView) {
                  onSelectSavedView(view.id)
                  return
                }

                onSelectBuiltinView(view)
              }}
            >
              {view.name}
            </button>
          )

          return isSavedView ? (
            <ViewContextMenu key={view.id} view={view}>
              {tabButton}
            </ViewContextMenu>
          ) : (
            <div key={view.id}>{tabButton}</div>
          )
        })}
        {editable ? (
          <IconButton
            aria-label="Create view"
            className="size-6"
            onClick={() =>
              openManagedCreateDialog({
                kind: "view",
                defaultScopeType: projectScopeType,
                defaultScopeId: projectScopeId,
                defaultProjectId: projectId,
                defaultEntityKind: "items",
                defaultRoute: detailHref,
                lockScope: true,
                lockProject: true,
                lockEntityKind: true,
              })
            }
          >
            <Plus className="size-3.5" />
          </IconButton>
        ) : null}
      </div>
    </Topbar>
  )
}

function ProjectItemsViewbar({
  view,
  activeSavedView,
  items,
  groupOptions,
  createWorkItemTeamId,
  projectId,
  onUpdateProjectView,
  onUpdateViewerView,
  onToggleProjectFilter,
  onToggleViewerFilter,
  onClearProjectFilters,
  onClearViewerFilters,
  onToggleProjectDisplayProperty,
  onToggleViewerDisplayProperty,
  onReorderProjectDisplayProperties,
  onReorderViewerDisplayProperties,
  onClearProjectDisplayProperties,
  onClearViewerDisplayProperties,
}: {
  view: ViewDefinition
  activeSavedView: ViewDefinition | null
  items: ReturnType<typeof selectAppDataSnapshot>["workItems"]
  groupOptions: GroupField[]
  createWorkItemTeamId: string | null
  projectId: string
  onUpdateProjectView: (patch: ViewConfigPatch) => void
  onUpdateViewerView: (patch: ViewConfigPatch) => void
  onToggleProjectFilter: (key: ViewFilterKey, value: string) => void
  onToggleViewerFilter: (key: ViewFilterKey, value: string) => void
  onClearProjectFilters: () => void
  onClearViewerFilters: () => void
  onToggleProjectDisplayProperty: (property: DisplayProperty) => void
  onToggleViewerDisplayProperty: (property: DisplayProperty) => void
  onReorderProjectDisplayProperties: (displayProps: DisplayProperty[]) => void
  onReorderViewerDisplayProperties: (displayProps: DisplayProperty[]) => void
  onClearProjectDisplayProperties: () => void
  onClearViewerDisplayProperties: () => void
}) {
  const isSavedViewActive = Boolean(activeSavedView)
  const updateView = isSavedViewActive
    ? onUpdateViewerView
    : onUpdateProjectView

  return (
    <Viewbar>
      <LayoutTabs view={view} onUpdateView={updateView} />
      <div aria-hidden className="mx-1.5 h-[18px] w-px bg-line" />
      <FilterPopover
        view={view}
        items={items}
        variant="chip"
        onToggleFilterValue={
          isSavedViewActive ? onToggleViewerFilter : onToggleProjectFilter
        }
        onClearFilters={
          isSavedViewActive ? onClearViewerFilters : onClearProjectFilters
        }
      />
      <LevelChipPopover view={view} onUpdateView={updateView} />
      <GroupChipPopover
        view={view}
        groupOptions={groupOptions}
        onUpdateView={updateView}
      />
      <SortChipPopover view={view} onUpdateView={updateView} />
      <PropertiesChipPopover
        view={view}
        onToggleDisplayProperty={
          isSavedViewActive
            ? onToggleViewerDisplayProperty
            : onToggleProjectDisplayProperty
        }
        onReorderDisplayProperties={
          isSavedViewActive
            ? onReorderViewerDisplayProperties
            : onReorderProjectDisplayProperties
        }
        onClearDisplayProperties={
          isSavedViewActive
            ? onClearViewerDisplayProperties
            : onClearProjectDisplayProperties
        }
      />
      <div className="ml-auto flex items-center gap-1.5">
        <ViewConfigPopover
          view={view}
          groupOptions={groupOptions}
          onUpdateView={updateView}
          onToggleDisplayProperty={
            isSavedViewActive
              ? onToggleViewerDisplayProperty
              : onToggleProjectDisplayProperty
          }
        />
        <Button
          size="sm"
          variant="default"
          className="h-7 gap-1.5 px-2.5 text-[12px]"
          onClick={() =>
            openManagedCreateDialog({
              kind: "workItem",
              defaultTeamId: createWorkItemTeamId,
              defaultProjectId: projectId,
            })
          }
        >
          <Plus className="size-3.5" />
          New
        </Button>
      </div>
    </Viewbar>
  )
}

function ProjectItemsBody({
  data,
  view,
  activeSavedView,
  visibleItems,
  scopedItems,
  editable,
  createWorkItemTeamId,
  projectId,
  emptyLabel,
  onToggleHiddenValue,
}: {
  data: ReturnType<typeof selectAppDataSnapshot>
  view: ViewDefinition
  activeSavedView: ViewDefinition | null
  visibleItems: ReturnType<typeof selectAppDataSnapshot>["workItems"]
  scopedItems: ReturnType<typeof selectAppDataSnapshot>["workItems"]
  editable: boolean
  createWorkItemTeamId: string | null
  projectId: string
  emptyLabel: string
  onToggleHiddenValue: (key: "groups" | "subgroups", value: string) => void
}) {
  return (
    <div
      className={cn(
        "min-h-0 min-w-0 flex-1 overscroll-contain",
        view.layout === "timeline" ? "overflow-hidden" : "overflow-y-auto"
      )}
    >
      <>
        {view.layout === "board" ? (
          <BoardView
            data={data}
            items={visibleItems}
            scopedItems={scopedItems}
            view={view}
            editable={editable}
            createContext={{
              defaultTeamId: createWorkItemTeamId,
              defaultProjectId: projectId,
            }}
            onToggleHiddenValue={
              activeSavedView ? onToggleHiddenValue : undefined
            }
          />
        ) : null}
        {view.layout === "list" ? (
          <ListView
            data={data}
            items={visibleItems}
            scopedItems={scopedItems}
            view={view}
            editable={editable}
            createContext={{
              defaultTeamId: createWorkItemTeamId,
              defaultProjectId: projectId,
            }}
            onToggleHiddenValue={
              activeSavedView ? onToggleHiddenValue : undefined
            }
          />
        ) : null}
        {view.layout === "timeline" ? (
          <TimelineView
            data={data}
            items={visibleItems}
            view={view}
            editable={editable}
          />
        ) : null}
      </>
      {visibleItems.length > 0 ? null : (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </div>
  )
}

function useProjectItemsPresentationState({
  defaultProjectPresentation,
  initialProjectPresentation,
  projectId,
  projectModelProjectId,
}: {
  defaultProjectPresentation: ProjectPresentationConfig | null
  initialProjectPresentation: ProjectPresentationConfig
  projectId: string
  projectModelProjectId: string | null
}) {
  const [layout, setLayout] = useState<ViewDefinition["layout"]>(
    () => initialProjectPresentation.layout
  )
  const [grouping, setGrouping] = useState<GroupField>(
    () => initialProjectPresentation.grouping
  )
  const [subGrouping, setSubGrouping] = useState<GroupField | null>(null)
  const [ordering, setOrdering] = useState<OrderingField>(
    () => initialProjectPresentation.ordering
  )
  const [itemLevel, setItemLevel] = useState<
    ProjectPresentationConfig["itemLevel"]
  >(() => initialProjectPresentation.itemLevel)
  const [showChildItems, setShowChildItems] = useState<boolean>(
    () => initialProjectPresentation.showChildItems ?? false
  )
  const [filters, setFilters] = useState<ViewDefinition["filters"]>(() =>
    cloneViewFilters(initialProjectPresentation.filters)
  )
  const [displayProps, setDisplayProps] = useState<DisplayProperty[]>(() => [
    ...initialProjectPresentation.displayProps,
  ])

  useEffect(() => {
    if (!defaultProjectPresentation) {
      return
    }

    queueMicrotask(() => {
      setLayout(defaultProjectPresentation.layout)
      setGrouping(defaultProjectPresentation.grouping)
      setSubGrouping(null)
      setOrdering(defaultProjectPresentation.ordering)
      setItemLevel(defaultProjectPresentation.itemLevel)
      setShowChildItems(defaultProjectPresentation.showChildItems ?? false)
      setFilters(cloneViewFilters(defaultProjectPresentation.filters))
      setDisplayProps([...defaultProjectPresentation.displayProps])
    })
  }, [defaultProjectPresentation, projectId, projectModelProjectId])

  function updateView(patch: ViewConfigPatch) {
    if (patch.layout) {
      setLayout(patch.layout)
    }

    if (patch.grouping) {
      setGrouping(patch.grouping)
    }

    if ("subGrouping" in patch) {
      setSubGrouping(patch.subGrouping ?? null)
    }

    if (patch.ordering) {
      setOrdering(patch.ordering)
    }

    if ("itemLevel" in patch) {
      setItemLevel(patch.itemLevel)
    }

    if ("showChildItems" in patch) {
      setShowChildItems(Boolean(patch.showChildItems))
    }

    if (patch.showCompleted !== undefined) {
      setFilters((current) => ({
        ...current,
        showCompleted: patch.showCompleted ?? true,
      }))
    }
  }

  function toggleFilter(key: ViewFilterKey, value: string) {
    setFilters((current) => toggleViewFilterValue(current, key, value))
  }

  function clearFilters() {
    setFilters(clearViewFiltersPreservingCompletion)
  }

  function toggleDisplayProperty(property: DisplayProperty) {
    setDisplayProps((current) =>
      toggleDisplayPropertyValue(current, property)
    )
  }

  function applyTemplate(view: ViewDefinition) {
    setLayout(view.layout)
    setGrouping(view.grouping)
    setSubGrouping(view.subGrouping ?? null)
    setOrdering(view.ordering)
    setItemLevel(view.itemLevel)
    setShowChildItems(Boolean(view.showChildItems))
    setFilters(cloneViewFilters(view.filters))
    setDisplayProps([...view.displayProps])
  }

  return {
    applyTemplate,
    clearDisplayProperties: () => setDisplayProps([]),
    clearFilters,
    displayProps,
    filters,
    grouping,
    itemLevel,
    layout,
    ordering,
    reorderDisplayProperties: setDisplayProps,
    showChildItems,
    subGrouping,
    toggleDisplayProperty,
    toggleFilter,
    updateView,
  }
}

type ProjectDetailModel = NonNullable<ReturnType<typeof getProjectDetailModel>>
type ProjectItemsHiddenKey = "groups" | "subgroups"

function useSavedProjectItemViews(
  projectModel: ProjectDetailModel | null,
  projectRoute: string | null
) {
  return useAppStore(
    useShallow((state) => {
      if (!projectModel || !projectRoute) {
        return []
      }

      return state.views.filter(
        (view) =>
          view.entityKind === "items" &&
          ((view.containerType === "project-items" &&
            view.containerId === projectModel.project.id) ||
            (!view.containerType &&
              view.route === projectRoute &&
              view.scopeType === projectModel.project.scopeType &&
              view.scopeId === projectModel.project.scopeId))
      )
    })
  )
}

function useActiveProjectItemViewSelection({
  data,
  projectId,
  projectRoute,
  savedProjectItemViews,
  searchParams,
}: {
  data: ReturnType<typeof selectAppDataSnapshot>
  projectId: string
  projectRoute: string | null
  savedProjectItemViews: ViewDefinition[]
  searchParams: ReturnType<typeof useSearchParams>
}) {
  const [activeBuiltinProjectViewId, setActiveBuiltinProjectViewId] = useState<
    string | null
  >(null)
  const selectedProjectView = projectRoute
    ? getViewByRoute(data, projectRoute)
    : null
  const activeSavedProjectViewBase = savedProjectItemViews.some(
    (view) => view.id === selectedProjectView?.id
  )
    ? selectedProjectView
    : null
  const activeSavedProjectViewOverride =
    activeSavedProjectViewBase && projectRoute
      ? data.ui.viewerViewConfigByRoute[
          getViewerScopedViewKey(
            data.currentUserId,
            projectRoute,
            activeSavedProjectViewBase.id
          )
        ]
      : null
  const activeSavedProjectView = activeSavedProjectViewBase
    ? applyViewerViewConfig(
        activeSavedProjectViewBase,
        activeSavedProjectViewOverride
      )
    : null

  useEffect(() => {
    if (!projectRoute) {
      return
    }

    const requestedViewId = searchParams.get("view")

    if (
      !requestedViewId ||
      !savedProjectItemViews.some((view) => view.id === requestedViewId)
    ) {
      return
    }

    setActiveBuiltinProjectViewId(null)
    useAppStore.getState().setSelectedView(projectRoute, requestedViewId)
  }, [projectRoute, savedProjectItemViews, searchParams])

  useEffect(() => {
    setActiveBuiltinProjectViewId(`fallback-project-items-${projectId}`)
  }, [projectId])

  return {
    activeBuiltinProjectViewId,
    activeSavedProjectView,
    setActiveBuiltinProjectViewId,
  }
}

function useViewerProjectItemsActions({
  activeSavedProjectView,
  projectRoute,
}: {
  activeSavedProjectView: ViewDefinition | null
  projectRoute: string | null
}) {
  function updateView(patch: ViewConfigPatch) {
    if (!activeSavedProjectView || !projectRoute) {
      return
    }

    useAppStore
      .getState()
      .patchViewerViewConfig(projectRoute, activeSavedProjectView.id, patch)
  }

  function toggleFilter(key: ViewFilterKey, value: string) {
    if (!activeSavedProjectView || !projectRoute) {
      return
    }

    useAppStore
      .getState()
      .toggleViewerViewFilterValue(
        projectRoute,
        activeSavedProjectView.id,
        key,
        value
      )
  }

  function clearFilters() {
    if (!activeSavedProjectView || !projectRoute) {
      return
    }

    useAppStore
      .getState()
      .clearViewerViewFilters(projectRoute, activeSavedProjectView.id)
  }

  function toggleDisplayProperty(property: DisplayProperty) {
    if (!activeSavedProjectView || !projectRoute) {
      return
    }

    useAppStore
      .getState()
      .toggleViewerViewDisplayProperty(
        projectRoute,
        activeSavedProjectView.id,
        property
      )
  }

  function reorderDisplayProperties(displayProps: DisplayProperty[]) {
    if (!activeSavedProjectView || !projectRoute) {
      return
    }

    useAppStore
      .getState()
      .reorderViewerViewDisplayProperties(
        projectRoute,
        activeSavedProjectView.id,
        displayProps
      )
  }

  function clearDisplayProperties() {
    if (!activeSavedProjectView || !projectRoute) {
      return
    }

    useAppStore
      .getState()
      .clearViewerViewDisplayProperties(projectRoute, activeSavedProjectView.id)
  }

  function toggleHiddenValue(key: ProjectItemsHiddenKey, value: string) {
    if (!activeSavedProjectView || !projectRoute) {
      return
    }

    useAppStore
      .getState()
      .toggleViewerViewHiddenValue(
        projectRoute,
        activeSavedProjectView.id,
        key,
        value
      )
  }

  return {
    clearDisplayProperties,
    clearFilters,
    reorderDisplayProperties,
    toggleDisplayProperty,
    toggleFilter,
    toggleHiddenValue,
    updateView,
  }
}

function resolveProjectEditable(
  data: ReturnType<typeof selectAppDataSnapshot>,
  project: ProjectDetailModel["project"],
  team: ProjectDetailModel["team"]
) {
  return project.scopeType === "team"
    ? Boolean(team && canEditTeam(data, team.id))
    : canEditWorkspace(data, project.scopeId)
}

function resolveProjectWorkSurfaceExperience(
  project: ProjectDetailModel["project"],
  team: ProjectDetailModel["team"]
): Parameters<typeof getWorkSurfaceCopy>[0] {
  if (team) {
    return team.settings.experience
  }

  if (project.templateType === "bug-tracking") {
    return "issue-analysis"
  }

  return project.templateType === "project-management"
    ? "project-management"
    : "software-development"
}

function resolveProjectItemsLevel({
  presentation,
  project,
  team,
}: {
  presentation: Pick<ProjectPresentationConfig, "itemLevel">
  project: ProjectDetailModel["project"]
  team: ProjectDetailModel["team"]
}) {
  if (presentation.itemLevel !== undefined) {
    return presentation.itemLevel
  }

  return team
    ? getDefaultViewItemLevelForTeamExperience(team.settings.experience)
    : getDefaultViewItemLevelForProjectTemplate(project.templateType)
}

function buildProjectItemsView({
  data,
  detailHref,
  itemLevel,
  presentation,
  project,
}: {
  data: ReturnType<typeof selectAppDataSnapshot>
  detailHref: string
  itemLevel: ProjectPresentationConfig["itemLevel"]
  presentation: ReturnType<typeof useProjectItemsPresentationState>
  project: ProjectDetailModel["project"]
}): ViewDefinition {
  return {
    id: `project-items-${project.id}`,
    name: "Project items",
    description: "",
    scopeType: "personal",
    scopeId: data.currentUserId,
    entityKind: "items",
    itemLevel: itemLevel ?? null,
    showChildItems: presentation.showChildItems,
    layout: presentation.layout,
    filters: presentation.filters,
    grouping: presentation.grouping,
    subGrouping: presentation.subGrouping,
    ordering: presentation.ordering,
    displayProps: presentation.displayProps,
    hiddenState: { groups: [], subgroups: [] },
    isShared: false,
    route: detailHref,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

function buildProjectBuiltinItemViews({
  baselineItemsLevel,
  baselinePresentation,
  detailHref,
  project,
  projectItemsView,
  team,
  workSurfaceLabel,
}: {
  baselineItemsLevel: ProjectPresentationConfig["itemLevel"]
  baselinePresentation: ProjectPresentationConfig
  detailHref: string
  project: ProjectDetailModel["project"]
  projectItemsView: ViewDefinition
  team: ProjectDetailModel["team"]
  workSurfaceLabel: string
}) {
  const lowerSurfaceLabel = workSurfaceLabel.toLowerCase()
  const fallbackProjectItemsView =
    createViewDefinition({
      id: `fallback-project-items-${project.id}`,
      name: `All ${lowerSurfaceLabel}`,
      description: `All ${lowerSurfaceLabel} linked to this project.`,
      scopeType: project.scopeType,
      scopeId: project.scopeId,
      entityKind: "items",
      route: detailHref,
      teamSlug: team?.slug,
      isShared: false,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      overrides: {
        layout: baselinePresentation.layout,
        filters: cloneViewFilters(baselinePresentation.filters),
        grouping: baselinePresentation.grouping,
        subGrouping: null,
        ordering: baselinePresentation.ordering,
        ...(baselineItemsLevel !== undefined
          ? { itemLevel: baselineItemsLevel }
          : {}),
        showChildItems: baselinePresentation.showChildItems ?? false,
        displayProps: [...baselinePresentation.displayProps],
        hiddenState: { groups: [], subgroups: [] },
      },
    }) ?? projectItemsView
  const builtinProjectItemsOverrides = {
    layout: fallbackProjectItemsView.layout,
    filters: cloneViewFilters(fallbackProjectItemsView.filters),
    grouping: fallbackProjectItemsView.grouping,
    subGrouping: fallbackProjectItemsView.subGrouping,
    ordering: fallbackProjectItemsView.ordering,
    ...(fallbackProjectItemsView.itemLevel !== undefined
      ? { itemLevel: fallbackProjectItemsView.itemLevel }
      : {}),
    showChildItems: fallbackProjectItemsView.showChildItems,
    displayProps: [...fallbackProjectItemsView.displayProps],
    hiddenState: {
      groups: [...fallbackProjectItemsView.hiddenState.groups],
      subgroups: [...fallbackProjectItemsView.hiddenState.subgroups],
    },
  }
  const activeBuiltinProjectView =
    createViewDefinition({
      id: `builtin-project-active-${project.id}`,
      name: "Active",
      description: `Current ${lowerSurfaceLabel} linked to this project.`,
      scopeType: project.scopeType,
      scopeId: project.scopeId,
      entityKind: "items",
      route: detailHref,
      teamSlug: team?.slug,
      isShared: false,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      overrides: {
        ...builtinProjectItemsOverrides,
        layout: "board",
        filters: {
          ...cloneViewFilters(fallbackProjectItemsView.filters),
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
    }) ?? fallbackProjectItemsView
  const backlogBuiltinProjectView =
    createViewDefinition({
      id: `builtin-project-backlog-${project.id}`,
      name: "Backlog",
      description: `Upcoming ${lowerSurfaceLabel} linked to this project.`,
      scopeType: project.scopeType,
      scopeId: project.scopeId,
      entityKind: "items",
      route: detailHref,
      teamSlug: team?.slug,
      isShared: false,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      overrides: {
        ...builtinProjectItemsOverrides,
        filters: {
          ...cloneViewFilters(fallbackProjectItemsView.filters),
          status: ["backlog"],
        },
        grouping: "priority",
        ordering: "targetDate",
        displayProps: ["id", "project", "priority", "assignee", "dueDate"],
        hiddenState: { groups: [], subgroups: [] },
      },
    }) ?? fallbackProjectItemsView

  return {
    activeBuiltinProjectView,
    backlogBuiltinProjectView,
    fallbackProjectItemsView,
  }
}

function resolveEmptyProjectItemsLabel({
  activeView,
  itemsLength,
  surfaceLabel,
  visibleItemsLength,
  workEmptyLabel,
}: {
  activeView: ViewDefinition
  itemsLength: number
  surfaceLabel: string
  visibleItemsLength: number
  workEmptyLabel: string
}) {
  if (itemsLength === 0) {
    return workEmptyLabel
  }

  if (
    activeView.layout === "timeline" &&
    !activeView.itemLevel &&
    visibleItemsLength === 0
  ) {
    return "Timeline only shows top-level items."
  }

  return `No ${surfaceLabel.toLowerCase()} match the current filters.`
}

function resolveCreateWorkItemTeamId({
  data,
  project,
  team,
}: {
  data: ReturnType<typeof selectAppDataSnapshot>
  project: ProjectDetailModel["project"]
  team: ProjectDetailModel["team"]
}) {
  return project.scopeType === "team"
    ? project.scopeId
    : (data.ui.activeTeamId ?? team?.id ?? data.teams[0]?.id ?? null)
}

function resolveDefaultProjectPresentation({
  presentation,
  team,
  templateType,
}: {
  presentation: ProjectPresentationConfig | null
  team: ProjectDetailModel["team"]
  templateType: ProjectDetailModel["project"]["templateType"] | null
}) {
  if (!templateType) {
    return null
  }

  return (
    presentation ??
    createDefaultProjectPresentationConfig(templateType, {
      layout: getTemplateDefaultsForTeam(team, templateType).defaultViewLayout,
    })
  )
}

export function ProjectDetailScreen({ projectId }: { projectId: string }) {
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  useScopedReadModelRefresh({
    enabled: true,
    scopeKeys: [createProjectDetailScopeKey(projectId)],
    fetchLatest: () => fetchProjectDetailReadModel(projectId),
    notFoundResult: createMissingScopedReadModelResult([
      {
        kind: "project-detail",
        projectId,
      },
    ]),
  })
  const searchParams = useSearchParams()
  const projectModel = getProjectDetailModel(data, projectId)
  const projectRoute = projectModel?.detailHref ?? null
  const savedProjectItemViews = useSavedProjectItemViews(
    projectModel,
    projectRoute
  )
  const defaultProjectPresentationSource =
    projectModel?.project.presentation ?? null
  const defaultProjectTemplateType = projectModel?.project.templateType ?? null
  const defaultProjectTeam = projectModel?.team ?? null
  const defaultProjectPresentation = useMemo(
    () =>
      resolveDefaultProjectPresentation({
        presentation: defaultProjectPresentationSource,
        team: defaultProjectTeam,
        templateType: defaultProjectTemplateType,
      }),
    [
      defaultProjectPresentationSource,
      defaultProjectTeam,
      defaultProjectTemplateType,
    ]
  )
  const initialProjectPresentation =
    defaultProjectPresentation ??
    createDefaultProjectPresentationConfig("software-delivery")
  const projectItemsPresentation = useProjectItemsPresentationState({
    defaultProjectPresentation,
    initialProjectPresentation,
    projectId,
    projectModelProjectId: projectModel?.project.id ?? null,
  })
  const {
    activeBuiltinProjectViewId,
    activeSavedProjectView,
    setActiveBuiltinProjectViewId,
  } = useActiveProjectItemViewSelection({
    data,
    projectId,
    projectRoute,
    savedProjectItemViews,
    searchParams,
  })

  const projectGroupOptions = useMemo(
    () => getAvailableGroupOptions(projectModel?.project.templateType),
    [projectModel?.project.templateType]
  )
  const viewerProjectItemsActions = useViewerProjectItemsActions({
    activeSavedProjectView,
    projectRoute,
  })

  if (!projectModel) {
    return <MissingState title="Project not found" />
  }

  const { project, team, items, detailHref } = projectModel
  const editable = resolveProjectEditable(data, project, team)
  const workSurfaceExperience = resolveProjectWorkSurfaceExperience(
    project,
    team
  )
  const workCopy = getWorkSurfaceCopy(workSurfaceExperience)
  const baselineProjectPresentation =
    defaultProjectPresentation ?? initialProjectPresentation
  const baselineProjectItemsLevel = resolveProjectItemsLevel({
    presentation: baselineProjectPresentation,
    project,
    team,
  })
  const effectiveProjectItemsLevel = resolveProjectItemsLevel({
    presentation: projectItemsPresentation,
    project,
    team,
  })
  const projectItemsView = buildProjectItemsView({
    data,
    detailHref,
    itemLevel: effectiveProjectItemsLevel,
    presentation: projectItemsPresentation,
    project,
  })
  const {
    activeBuiltinProjectView,
    backlogBuiltinProjectView,
    fallbackProjectItemsView,
  } = buildProjectBuiltinItemViews({
    baselineItemsLevel: baselineProjectItemsLevel,
    baselinePresentation: baselineProjectPresentation,
    detailHref,
    project,
    projectItemsView,
    team,
    workSurfaceLabel: workCopy.surfaceLabel,
  })
  const builtinProjectItemViews = [
    fallbackProjectItemsView,
    activeBuiltinProjectView,
    backlogBuiltinProjectView,
  ]
  const activeProjectItemsView = activeSavedProjectView ?? projectItemsView
  const displayedProjectItemViews = [
    ...builtinProjectItemViews,
    ...savedProjectItemViews,
  ]
  const activeProjectItemsTabId =
    activeSavedProjectView?.id ??
    activeBuiltinProjectViewId ??
    fallbackProjectItemsView.id
  const visibleProjectItems = getVisibleItemsForView(
    data,
    items,
    activeProjectItemsView
  )
  const emptyProjectItemsLabel = resolveEmptyProjectItemsLabel({
    activeView: activeProjectItemsView,
    itemsLength: items.length,
    surfaceLabel: workCopy.surfaceLabel,
    visibleItemsLength: visibleProjectItems.length,
    workEmptyLabel: workCopy.emptyLabel,
  })
  const createWorkItemTeamId = resolveCreateWorkItemTeamId({
    data,
    project,
    team,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ProjectItemsTopbar
          projectName={project.name}
          projectId={project.id}
          projectScopeType={project.scopeType}
          projectScopeId={project.scopeId}
          detailHref={detailHref}
          projectRoute={projectRoute}
          displayedViews={displayedProjectItemViews}
          savedViews={savedProjectItemViews}
          activeTabId={activeProjectItemsTabId}
          editable={editable}
          onSelectBuiltinView={(view) => {
            projectItemsPresentation.applyTemplate(view)
            setActiveBuiltinProjectViewId(view.id)
            useAppStore.getState().setSelectedView(projectRoute ?? "", "")
          }}
          onSelectSavedView={(viewId) => {
            setActiveBuiltinProjectViewId(null)
            useAppStore.getState().setSelectedView(projectRoute ?? "", viewId)
          }}
        />
        <ProjectItemsViewbar
          view={activeProjectItemsView}
          activeSavedView={activeSavedProjectView}
          items={items}
          groupOptions={projectGroupOptions}
          createWorkItemTeamId={createWorkItemTeamId}
          projectId={project.id}
          onUpdateProjectView={projectItemsPresentation.updateView}
          onUpdateViewerView={viewerProjectItemsActions.updateView}
          onToggleProjectFilter={projectItemsPresentation.toggleFilter}
          onToggleViewerFilter={viewerProjectItemsActions.toggleFilter}
          onClearProjectFilters={projectItemsPresentation.clearFilters}
          onClearViewerFilters={viewerProjectItemsActions.clearFilters}
          onToggleProjectDisplayProperty={
            projectItemsPresentation.toggleDisplayProperty
          }
          onToggleViewerDisplayProperty={
            viewerProjectItemsActions.toggleDisplayProperty
          }
          onReorderProjectDisplayProperties={
            projectItemsPresentation.reorderDisplayProperties
          }
          onReorderViewerDisplayProperties={
            viewerProjectItemsActions.reorderDisplayProperties
          }
          onClearProjectDisplayProperties={
            projectItemsPresentation.clearDisplayProperties
          }
          onClearViewerDisplayProperties={
            viewerProjectItemsActions.clearDisplayProperties
          }
        />
        <ProjectItemsBody
          data={data}
          view={activeProjectItemsView}
          activeSavedView={activeSavedProjectView}
          visibleItems={visibleProjectItems}
          scopedItems={items}
          editable={editable}
          createWorkItemTeamId={createWorkItemTeamId}
          projectId={project.id}
          emptyLabel={emptyProjectItemsLabel}
          onToggleHiddenValue={viewerProjectItemsActions.toggleHiddenValue}
        />
      </div>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useShallow } from "zustand/react/shallow"
import { Plus } from "@phosphor-icons/react"

import {
  canEditTeam,
  canEditWorkspace,
  getVisibleItemsForView,
  getViewByRoute,
} from "@/lib/domain/selectors"
import { isSystemView } from "@/lib/domain/default-views"
import {
  applyViewerViewConfig,
  getViewerScopedDirectoryKey,
  getViewerScopedViewKey,
} from "@/lib/domain/viewer-view-config"
import {
  getDefaultTemplateTypeForTeamExperience,
  type Team,
  type TeamExperienceType,
  type ViewDefinition,
  type WorkItem,
  type WorkItemVisibility,
} from "@/lib/domain/types"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  IconButton,
  Topbar,
  Viewbar,
} from "@/components/ui/template-primitives"
import { HeaderTitle } from "@/components/app/screens/shared"
import { ViewContextMenu } from "@/components/app/screens/entity-context-menus"
import {
  applyViewConfigPatch,
  clearViewFiltersPreservingCompletion,
  cloneViewFilters,
  selectAppDataSnapshot,
  toggleViewFilterValue,
  type ViewFilterKey,
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
} from "@/components/app/screens/work-surface-controls"
import {
  BoardView,
  CalendarView,
  ListView,
  TimelineView,
} from "@/components/app/screens/work-surface-view"
import { cn } from "@/lib/utils"

type WorkSurfaceChildDisplayMode = "direct" | "assigned-descendants"
type WorkSurfaceCreateContext = {
  defaultTeamId?: string | null
  defaultProjectId?: string | null
  defaultVisibility?: WorkItemVisibility
}

const EMPTY_FALLBACK_VIEWS: ViewDefinition[] = []

function cloneFallbackView(view: ViewDefinition): ViewDefinition {
  return {
    ...view,
    filters: cloneViewFilters(view.filters),
    displayProps: [...view.displayProps],
    hiddenState: {
      groups: [...view.hiddenState.groups],
      subgroups: [...view.hiddenState.subgroups],
    },
  }
}

function getCompatibleActiveView(
  view: ViewDefinition | null,
  groupOptions: ViewDefinition["grouping"][]
) {
  if (!view) {
    return null
  }

  const grouping = groupOptions.includes(view.grouping)
    ? view.grouping
    : "status"
  const subGrouping =
    view.subGrouping &&
    groupOptions.includes(view.subGrouping) &&
    view.subGrouping !== grouping
      ? view.subGrouping
      : null
  const displayProps = getCompatibleWorkSurfaceDisplayProps(view)
  const displayPropsChanged = displayProps.length !== view.displayProps.length

  if (
    grouping === view.grouping &&
    subGrouping === (view.subGrouping ?? null) &&
    !displayPropsChanged
  ) {
    return view
  }

  return {
    ...view,
    grouping,
    subGrouping,
    displayProps,
  }
}

function isPrivateTaskView(view: ViewDefinition | null) {
  return (
    view?.entityKind === "items" && view.filters.visibility?.includes("private")
  )
}

function getCompatibleGroupOptions(
  view: ViewDefinition | null,
  groupOptions: ViewDefinition["grouping"][]
) {
  return isPrivateTaskView(view)
    ? groupOptions.filter((option) => option !== "assignee")
    : groupOptions
}

function getCompatibleWorkSurfaceDisplayProps(view: ViewDefinition) {
  return isPrivateTaskView(view)
    ? view.displayProps.filter((property) => property !== "assignee")
    : view.displayProps
}

function getActiveBaseWorkSurfaceView({
  data,
  localFallbackViewId,
  localFallbackViews,
  routeKey,
  usingFallbackViews,
  views,
}: {
  data: ReturnType<typeof selectAppDataSnapshot>
  localFallbackViewId: string | null
  localFallbackViews: ViewDefinition[]
  routeKey: string
  usingFallbackViews: boolean
  views: ViewDefinition[]
}) {
  if (usingFallbackViews) {
    const selectedFallbackViewId =
      data.ui.selectedViewByRoute[
        getViewerScopedDirectoryKey(data.currentUserId, routeKey)
      ] ?? localFallbackViewId

    return (
      localFallbackViews.find((view) => view.id === selectedFallbackViewId) ??
      localFallbackViews[0] ??
      null
    )
  }

  return getViewByRoute(data, routeKey) ?? views[0] ?? null
}

function getActiveWorkSurfaceView({
  activeBaseView,
  data,
  routeKey,
  useViewerConfig,
}: {
  activeBaseView: ViewDefinition | null
  data: ReturnType<typeof selectAppDataSnapshot>
  routeKey: string
  useViewerConfig: boolean
}) {
  if (!activeBaseView) {
    return activeBaseView
  }

  if (!useViewerConfig) {
    return activeBaseView
  }

  const viewerConfig =
    data.ui.viewerViewConfigByRoute[
      getViewerScopedViewKey(data.currentUserId, routeKey, activeBaseView.id)
    ]

  return applyViewerViewConfig(activeBaseView, viewerConfig)
}

function getEffectiveGroupingExperience(
  groupingExperience: TeamExperienceType | null | undefined,
  team: Team | null
) {
  return groupingExperience === undefined
    ? (team?.settings.experience ?? null)
    : groupingExperience
}

function shouldMatchAssignedDescendantItems({
  childDisplayMode,
  filterItems,
}: {
  childDisplayMode: WorkSurfaceChildDisplayMode
  filterItems?: WorkItem[]
}) {
  return childDisplayMode === "assigned-descendants" && Boolean(filterItems)
}

function getWorkSurfaceFilterPopoverItems({
  activeView,
  filterScopeItems,
  items,
  shouldMatchAssignedItems,
}: {
  activeView: ViewDefinition | null
  filterScopeItems: WorkItem[]
  items: WorkItem[]
  shouldMatchAssignedItems: boolean
}) {
  return shouldMatchAssignedItems && activeView?.showChildItems
    ? items
    : filterScopeItems
}

function getWorkSurfaceVisibleItems({
  childDisplayMode,
  data,
  filterScopeItems,
  items,
  shouldMatchAssignedItems,
  view,
}: {
  childDisplayMode: WorkSurfaceChildDisplayMode
  data: ReturnType<typeof selectAppDataSnapshot>
  filterScopeItems: WorkItem[]
  items: WorkItem[]
  shouldMatchAssignedItems: boolean
  view: ViewDefinition | null
}) {
  if (!view) {
    return filterScopeItems
  }

  return getVisibleItemsForView(data, items, view, {
    ...(shouldMatchAssignedItems
      ? {
          matchItems: filterScopeItems,
          ...(view.showChildItems ? { childDisplayMode } : {}),
        }
      : {}),
  })
}

function WorkSurfaceTopbar({
  title,
  displayedViews,
  activeView,
  usingFallbackViews,
  allowCreateViews,
  editable,
  team,
  workspaceId,
  routeKey,
  onSelectFallbackView,
  onSelectView,
}: {
  title: string
  displayedViews: ViewDefinition[]
  activeView: ViewDefinition | null
  usingFallbackViews: boolean
  allowCreateViews: boolean
  editable: boolean
  team: Team | null
  workspaceId?: string | null
  routeKey: string
  onSelectFallbackView: (viewId: string) => void
  onSelectView: (viewId: string) => void
}) {
  const createViewScope = team
    ? { scopeType: "team" as const, scopeId: team.id }
    : workspaceId
      ? { scopeType: "workspace" as const, scopeId: workspaceId }
      : null

  return (
    <Topbar>
      <HeaderTitle title={title} />
      {displayedViews.length > 0 && activeView ? (
        <div className="ml-2 flex items-center gap-0.5">
          {displayedViews.map((view) =>
            usingFallbackViews || isSystemView(view) ? (
              <button
                key={view.id}
                className={cn(
                  "h-7 rounded-md px-2 text-[12px] transition-colors",
                  view.id === activeView.id
                    ? "bg-surface-3 font-medium text-foreground"
                    : "text-fg-3 hover:bg-surface-3 hover:text-foreground"
                )}
                onClick={() => {
                  if (usingFallbackViews) {
                    onSelectFallbackView(view.id)
                    return
                  }

                  onSelectView(view.id)
                }}
              >
                {view.name}
              </button>
            ) : (
              <ViewContextMenu key={view.id} view={view}>
                <button
                  className={cn(
                    "h-7 rounded-md px-2 text-[12px] transition-colors",
                    view.id === activeView.id
                      ? "bg-surface-3 font-medium text-foreground"
                      : "text-fg-3 hover:bg-surface-3 hover:text-foreground"
                  )}
                  onClick={() => {
                    onSelectView(view.id)
                  }}
                >
                  {view.name}
                </button>
              </ViewContextMenu>
            )
          )}
          {!usingFallbackViews &&
          allowCreateViews &&
          editable &&
          createViewScope ? (
            <IconButton
              className="size-6"
              onClick={() =>
                openManagedCreateDialog({
                  kind: "view",
                  defaultScopeType: createViewScope.scopeType,
                  defaultScopeId: createViewScope.scopeId,
                  defaultEntityKind: "items",
                  defaultRoute: routeKey,
                  lockScope: true,
                  lockEntityKind: true,
                })
              }
            >
              <Plus className="size-3.5" />
            </IconButton>
          ) : null}
        </div>
      ) : null}
    </Topbar>
  )
}

function WorkSurfaceViewbar({
  view,
  filterPopoverItems,
  hiddenFilters,
  groupOptions,
  onUpdateViewerView,
  onToggleViewerFilterValue,
  onClearViewerFilters,
  onToggleViewerDisplayProperty,
  onReorderViewerDisplayProperties,
  onClearViewerDisplayProperties,
  onCreateWorkItem,
}: {
  view: ViewDefinition
  filterPopoverItems: WorkItem[]
  hiddenFilters: ViewFilterKey[]
  groupOptions: ViewDefinition["grouping"][]
  onUpdateViewerView: (patch: ViewConfigPatch) => void
  onToggleViewerFilterValue: (key: ViewFilterKey, value: string) => void
  onClearViewerFilters: () => void
  onToggleViewerDisplayProperty: (
    property: ViewDefinition["displayProps"][number]
  ) => void
  onReorderViewerDisplayProperties: (
    displayProps: ViewDefinition["displayProps"]
  ) => void
  onClearViewerDisplayProperties: () => void
  onCreateWorkItem: () => void
}) {
  return (
    <Viewbar
      className={
        view.layout === "timeline" || view.layout === "calendar"
          ? undefined
          : "border-b-0"
      }
    >
      <LayoutTabs view={view} onUpdateView={onUpdateViewerView} />
      <div aria-hidden className="mx-1.5 h-[18px] w-px bg-line" />
      <FilterPopover
        view={view}
        items={filterPopoverItems}
        hiddenFilters={hiddenFilters}
        variant="chip"
        onToggleFilterValue={onToggleViewerFilterValue}
        onClearFilters={onClearViewerFilters}
      />
      <LevelChipPopover view={view} onUpdateView={onUpdateViewerView} />
      <GroupChipPopover
        view={view}
        groupOptions={groupOptions}
        onUpdateView={onUpdateViewerView}
      />
      <SortChipPopover view={view} onUpdateView={onUpdateViewerView} />
      <PropertiesChipPopover
        view={view}
        onToggleDisplayProperty={onToggleViewerDisplayProperty}
        onReorderDisplayProperties={onReorderViewerDisplayProperties}
        onClearDisplayProperties={onClearViewerDisplayProperties}
      />
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          size="sm"
          variant="default"
          className="h-7 gap-1.5 px-2.5 text-[12px]"
          onClick={onCreateWorkItem}
        >
          <Plus className="size-3.5" />
          New
        </Button>
      </div>
    </Viewbar>
  )
}

function WorkSurfaceContent({
  data,
  view,
  visibleItems,
  scopedItems,
  editable,
  childDisplayMode,
  createContext,
  resolvedCreateTeamId,
  isLoading,
  loadingLabel,
  emptyLabel,
  onCreateWorkItem,
  onToggleHiddenValue,
}: {
  data: ReturnType<typeof selectAppDataSnapshot>
  view: ViewDefinition | null
  visibleItems: WorkItem[]
  scopedItems: WorkItem[]
  editable: boolean
  childDisplayMode: WorkSurfaceChildDisplayMode
  createContext?: WorkSurfaceCreateContext
  resolvedCreateTeamId: string | null
  isLoading: boolean
  loadingLabel: string
  emptyLabel: string
  onCreateWorkItem: () => void
  onToggleHiddenValue: (key: "groups" | "subgroups", value: string) => void
}) {
  const contentClassName = getWorkSurfaceContentClassName(view)

  return (
    <div className={contentClassName}>
      {isLoading ? (
        <WorkSurfaceLoadingState loadingLabel={loadingLabel} />
      ) : view ? (
        <WorkSurfaceActiveContent
          childDisplayMode={childDisplayMode}
          createContext={createContext}
          data={data}
          editable={editable}
          items={visibleItems}
          resolvedCreateTeamId={resolvedCreateTeamId}
          scopedItems={scopedItems}
          view={view}
          onToggleHiddenValue={onToggleHiddenValue}
        />
      ) : (
        <WorkSurfaceEmptyState
          emptyLabel={emptyLabel}
          resolvedCreateTeamId={resolvedCreateTeamId}
          onCreateWorkItem={onCreateWorkItem}
        />
      )}
    </div>
  )
}

function getWorkSurfaceContentClassName(view: ViewDefinition | null) {
  return cn(
    "min-h-0 min-w-0 flex-1 overscroll-contain",
    view?.layout === "board" ||
      view?.layout === "timeline" ||
      view?.layout === "calendar"
      ? "overflow-hidden"
      : "overflow-x-hidden overflow-y-auto"
  )
}

function getResolvedWorkSurfaceCreateContext(
  createContext: WorkSurfaceCreateContext | undefined,
  resolvedCreateTeamId: string | null,
  view: ViewDefinition
): WorkSurfaceCreateContext {
  const createsPrivateWorkItem = view.filters.visibility?.includes("private")

  return {
    defaultTeamId: createContext?.defaultTeamId ?? resolvedCreateTeamId,
    defaultProjectId: createContext?.defaultProjectId ?? null,
    defaultVisibility:
      createContext?.defaultVisibility ??
      (createsPrivateWorkItem ? "private" : undefined),
  }
}

function WorkSurfaceLoadingState({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-20 text-sm text-muted-foreground">
      {loadingLabel}
    </div>
  )
}

function WorkSurfaceEmptyState({
  emptyLabel,
  resolvedCreateTeamId,
  onCreateWorkItem,
}: {
  emptyLabel: string
  resolvedCreateTeamId: string | null
  onCreateWorkItem: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
      <div>{emptyLabel}</div>
      {resolvedCreateTeamId ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 px-2.5 text-[12px]"
          onClick={onCreateWorkItem}
        >
          <Plus className="size-3.5" />
          New
        </Button>
      ) : null}
    </div>
  )
}

function WorkSurfaceActiveContent({
  childDisplayMode,
  createContext,
  data,
  editable,
  items,
  resolvedCreateTeamId,
  scopedItems,
  view,
  onToggleHiddenValue,
}: {
  childDisplayMode: WorkSurfaceChildDisplayMode
  createContext?: WorkSurfaceCreateContext
  data: ReturnType<typeof selectAppDataSnapshot>
  editable: boolean
  items: WorkItem[]
  resolvedCreateTeamId: string | null
  scopedItems: WorkItem[]
  view: ViewDefinition
  onToggleHiddenValue: (key: "groups" | "subgroups", value: string) => void
}) {
  const resolvedCreateContext = getResolvedWorkSurfaceCreateContext(
    createContext,
    resolvedCreateTeamId,
    view
  )
  const hiddenValueHandler = onToggleHiddenValue

  if (view.layout === "board") {
    return (
      <BoardView
        data={data}
        items={items}
        scopedItems={scopedItems}
        view={view}
        editable={editable}
        childDisplayMode={childDisplayMode}
        createContext={resolvedCreateContext}
        onToggleHiddenValue={hiddenValueHandler}
      />
    )
  }

  if (view.layout === "list") {
    return (
      <ListView
        data={data}
        items={items}
        scopedItems={scopedItems}
        view={view}
        editable={editable}
        childDisplayMode={childDisplayMode}
        createContext={resolvedCreateContext}
        onToggleHiddenValue={hiddenValueHandler}
      />
    )
  }

  if (view.layout === "calendar") {
    return <CalendarView data={data} items={items} editable={editable} />
  }

  return (
    <TimelineView data={data} items={items} view={view} editable={editable} />
  )
}

function useViewerViewActions({
  activeView,
  onUpdateFallbackView,
  routeKey,
}: {
  activeView: ViewDefinition | null
  onUpdateFallbackView?: (
    viewId: string,
    updateView: (view: ViewDefinition) => ViewDefinition
  ) => void
  routeKey: string
}) {
  const activeViewId = activeView?.id ?? null
  function updateFallbackActiveView(
    updateView: (view: ViewDefinition) => ViewDefinition
  ) {
    if (!activeViewId || !onUpdateFallbackView) {
      return false
    }

    onUpdateFallbackView(activeViewId, updateView)
    return true
  }

  function updateViewerActiveView(patch: ViewConfigPatch) {
    if (
      updateFallbackActiveView((view) => applyViewConfigPatch(view, patch))
    ) {
      return
    }

    if (!activeViewId) {
      return
    }

    useAppStore.getState().patchViewerViewConfig(routeKey, activeViewId, patch)
  }

  function toggleViewerActiveViewFilterValue(
    key: ViewFilterKey,
    value: string
  ) {
    if (
      updateFallbackActiveView((view) => ({
        ...view,
        filters: toggleViewFilterValue(view.filters, key, value),
      }))
    ) {
      return
    }

    if (!activeViewId) {
      return
    }

    useAppStore
      .getState()
      .toggleViewerViewFilterValue(routeKey, activeViewId, key, value)
  }

  function clearViewerActiveViewFilters() {
    if (
      updateFallbackActiveView((view) => ({
        ...view,
        filters: clearViewFiltersPreservingCompletion(view.filters),
      }))
    ) {
      return
    }

    if (!activeViewId) {
      return
    }

    useAppStore.getState().clearViewerViewFilters(routeKey, activeViewId)
  }

  function toggleViewerActiveDisplayProperty(
    property: ViewDefinition["displayProps"][number]
  ) {
    if (
      updateFallbackActiveView((view) => {
        const displayProps = view.displayProps.includes(property)
          ? view.displayProps.filter((entry) => entry !== property)
          : [...view.displayProps, property]

        return {
          ...view,
          displayProps,
        }
      })
    ) {
      return
    }

    if (!activeViewId) {
      return
    }

    useAppStore
      .getState()
      .toggleViewerViewDisplayProperty(routeKey, activeViewId, property)
  }

  function reorderViewerActiveDisplayProperties(
    displayProps: ViewDefinition["displayProps"]
  ) {
    if (
      updateFallbackActiveView((view) => ({
        ...view,
        displayProps: [...new Set(displayProps)],
      }))
    ) {
      return
    }

    if (!activeViewId) {
      return
    }

    useAppStore
      .getState()
      .reorderViewerViewDisplayProperties(routeKey, activeViewId, displayProps)
  }

  function clearViewerActiveDisplayProperties() {
    if (
      updateFallbackActiveView((view) => ({
        ...view,
        displayProps: [],
      }))
    ) {
      return
    }

    if (!activeViewId) {
      return
    }

    useAppStore
      .getState()
      .clearViewerViewDisplayProperties(routeKey, activeViewId)
  }

  function toggleViewerActiveHiddenValue(
    key: "groups" | "subgroups",
    value: string
  ) {
    if (
      updateFallbackActiveView((view) => {
        const currentValues = view.hiddenState[key] ?? []
        const nextValues = currentValues.includes(value)
          ? currentValues.filter((entry) => entry !== value)
          : [...currentValues, value]

        return {
          ...view,
          hiddenState: {
            groups: [...view.hiddenState.groups],
            subgroups: [...view.hiddenState.subgroups],
            [key]: nextValues,
          },
        }
      })
    ) {
      return
    }

    if (!activeViewId) {
      return
    }

    useAppStore
      .getState()
      .toggleViewerViewHiddenValue(routeKey, activeViewId, key, value)
  }

  return {
    clearViewerActiveDisplayProperties,
    clearViewerActiveViewFilters,
    reorderViewerActiveDisplayProperties,
    toggleViewerActiveDisplayProperty,
    toggleViewerActiveHiddenValue,
    toggleViewerActiveViewFilterValue,
    updateViewerActiveView,
  }
}

export function WorkSurface({
  title,
  routeKey,
  views,
  fallbackViews = EMPTY_FALLBACK_VIEWS,
  items,
  filterItems,
  team,
  workspaceId,
  createTeamId,
  createContext,
  groupingExperience,
  emptyLabel,
  isLoading = false,
  loadingLabel = "Loading items...",
  childDisplayMode = "direct",
  allowCreateViews = true,
  hiddenFilters = [],
}: {
  title: string
  routeKey: string
  views: ViewDefinition[]
  fallbackViews?: ViewDefinition[]
  items: WorkItem[]
  filterItems?: WorkItem[]
  team: Team | null
  workspaceId?: string | null
  createTeamId?: string | null
  createContext?: WorkSurfaceCreateContext
  groupingExperience?: TeamExperienceType | null
  emptyLabel: string
  isLoading?: boolean
  loadingLabel?: string
  childDisplayMode?: WorkSurfaceChildDisplayMode
  allowCreateViews?: boolean
  hiddenFilters?: ViewFilterKey[]
}) {
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const searchParams = useSearchParams()
  const requestedViewId = searchParams.get("view")
  const editable = team
    ? canEditTeam(data, team.id)
    : workspaceId
      ? canEditWorkspace(data, workspaceId)
      : false
  const resolvedCreateTeamId = createTeamId ?? team?.id ?? null
  const [localFallbackViews, setLocalFallbackViews] = useState(() =>
    fallbackViews.map(cloneFallbackView)
  )
  const [localFallbackViewId, setLocalFallbackViewId] = useState<string | null>(
    null
  )
  const usingFallbackViews = views.length === 0 && localFallbackViews.length > 0
  const activeBaseView = getActiveBaseWorkSurfaceView({
    data,
    localFallbackViewId,
    localFallbackViews,
    routeKey,
    usingFallbackViews,
    views,
  })
  const activeView = getActiveWorkSurfaceView({
    activeBaseView,
    data,
    routeKey,
    useViewerConfig: !usingFallbackViews,
  })
  const effectiveGroupingExperience = getEffectiveGroupingExperience(
    groupingExperience,
    team
  )
  const groupOptions = useMemo(
    () =>
      getAvailableGroupOptions(
        effectiveGroupingExperience
          ? getDefaultTemplateTypeForTeamExperience(effectiveGroupingExperience)
          : null
      ),
    [effectiveGroupingExperience]
  )
  const compatibleGroupOptions = useMemo(
    () => getCompatibleGroupOptions(activeView, groupOptions),
    [activeView, groupOptions]
  )

  useEffect(() => {
    setLocalFallbackViews(fallbackViews.map(cloneFallbackView))
  }, [fallbackViews])

  useEffect(() => {
    if (!usingFallbackViews || localFallbackViewId || !localFallbackViews[0]) {
      return
    }

    setLocalFallbackViewId(localFallbackViews[0].id)
  }, [localFallbackViewId, localFallbackViews, usingFallbackViews])

  useEffect(() => {
    if (usingFallbackViews) {
      return
    }

    if (!activeBaseView && views[0]) {
      useAppStore.getState().setSelectedView(routeKey, views[0].id)
    }
  }, [activeBaseView, routeKey, usingFallbackViews, views])

  useEffect(() => {
    if (!requestedViewId) {
      return
    }

    if (usingFallbackViews) {
      if (fallbackViews.some((view) => view.id === requestedViewId)) {
        useAppStore.getState().setSelectedView(routeKey, requestedViewId)
      }
      return
    }

    if (!views.some((view) => view.id === requestedViewId)) {
      return
    }

    useAppStore.getState().setSelectedView(routeKey, requestedViewId)
  }, [fallbackViews, requestedViewId, routeKey, usingFallbackViews, views])

  const compatibleActiveView = useMemo(
    () => getCompatibleActiveView(activeView, compatibleGroupOptions),
    [activeView, compatibleGroupOptions]
  )
  const displayedViews = usingFallbackViews ? localFallbackViews : views
  const filterScopeItems = filterItems ?? items
  const shouldMatchAssignedItems = shouldMatchAssignedDescendantItems({
    childDisplayMode,
    filterItems,
  })
  const filterPopoverItems = getWorkSurfaceFilterPopoverItems({
    activeView: compatibleActiveView,
    filterScopeItems,
    items,
    shouldMatchAssignedItems,
  })
  const visibleItems = getWorkSurfaceVisibleItems({
    childDisplayMode,
    data,
    filterScopeItems,
    items,
    shouldMatchAssignedItems,
    view: compatibleActiveView,
  })
  function updateLocalFallbackView(
    viewId: string,
    updateView: (view: ViewDefinition) => ViewDefinition
  ) {
    setLocalFallbackViews((currentViews) =>
      currentViews.map((view) => (view.id === viewId ? updateView(view) : view))
    )
  }

  const viewerViewActions = useViewerViewActions({
    activeView,
    onUpdateFallbackView: usingFallbackViews
      ? updateLocalFallbackView
      : undefined,
    routeKey,
  })

  function handleCreateWorkItem() {
    if (!resolvedCreateTeamId) {
      return
    }

    const createsPrivateWorkItem = Boolean(
      compatibleActiveView?.filters.visibility?.includes("private")
    )

    openManagedCreateDialog({
      kind: "workItem",
      defaultTeamId: resolvedCreateTeamId,
      ...(createsPrivateWorkItem
        ? {
            initialType: "task" as const,
            defaultValues: {
              primaryProjectId: null,
              visibility: "private" as const,
            },
          }
        : {}),
    })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <WorkSurfaceTopbar
        title={title}
        displayedViews={displayedViews}
        activeView={activeView}
        usingFallbackViews={usingFallbackViews}
        allowCreateViews={allowCreateViews}
        editable={editable}
        team={team}
        workspaceId={workspaceId}
        routeKey={routeKey}
        onSelectFallbackView={(viewId) =>
          useAppStore.getState().setSelectedView(routeKey, viewId)
        }
        onSelectView={(viewId) =>
          useAppStore.getState().setSelectedView(routeKey, viewId)
        }
      />

      {compatibleActiveView ? (
        <WorkSurfaceViewbar
          view={compatibleActiveView}
          filterPopoverItems={filterPopoverItems}
          hiddenFilters={hiddenFilters}
          groupOptions={compatibleGroupOptions}
          onUpdateViewerView={viewerViewActions.updateViewerActiveView}
          onToggleViewerFilterValue={
            viewerViewActions.toggleViewerActiveViewFilterValue
          }
          onClearViewerFilters={viewerViewActions.clearViewerActiveViewFilters}
          onToggleViewerDisplayProperty={
            viewerViewActions.toggleViewerActiveDisplayProperty
          }
          onReorderViewerDisplayProperties={
            viewerViewActions.reorderViewerActiveDisplayProperties
          }
          onClearViewerDisplayProperties={
            viewerViewActions.clearViewerActiveDisplayProperties
          }
          onCreateWorkItem={handleCreateWorkItem}
        />
      ) : null}

      <WorkSurfaceContent
        data={data}
        view={compatibleActiveView}
        visibleItems={visibleItems}
        scopedItems={items}
        editable={editable}
        childDisplayMode={childDisplayMode}
        createContext={createContext}
        resolvedCreateTeamId={resolvedCreateTeamId}
        isLoading={isLoading}
        loadingLabel={loadingLabel}
        emptyLabel={emptyLabel}
        onCreateWorkItem={handleCreateWorkItem}
        onToggleHiddenValue={viewerViewActions.toggleViewerActiveHiddenValue}
      />
    </div>
  )
}

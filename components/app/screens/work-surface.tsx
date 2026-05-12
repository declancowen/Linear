"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useShallow } from "zustand/react/shallow"
import { Plus } from "@phosphor-icons/react"

import {
  canEditTeam,
  getVisibleItemsForView,
  getViewByRoute,
} from "@/lib/domain/selectors"
import { isSystemView } from "@/lib/domain/default-views"
import {
  applyViewerViewConfig,
  getViewerScopedViewKey,
} from "@/lib/domain/viewer-view-config"
import {
  getDefaultTemplateTypeForTeamExperience,
  type Team,
  type TeamExperienceType,
  type ViewDefinition,
  type WorkItem,
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
  cloneViewFilters,
  createEmptyViewFilters,
  selectAppDataSnapshot,
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
  ListView,
  TimelineView,
} from "@/components/app/screens/work-surface-view"
import { cn } from "@/lib/utils"

type WorkSurfaceChildDisplayMode = "direct" | "assigned-descendants"
type WorkSurfaceCreateContext = {
  defaultTeamId?: string | null
  defaultProjectId?: string | null
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

function applyLocalViewPatch(
  view: ViewDefinition,
  patch: ViewConfigPatch
): ViewDefinition {
  const { showCompleted, ...viewPatch } = patch

  return {
    ...view,
    ...viewPatch,
    filters:
      showCompleted === undefined
        ? view.filters
        : {
            ...view.filters,
            showCompleted,
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

  if (
    grouping === view.grouping &&
    subGrouping === (view.subGrouping ?? null)
  ) {
    return view
  }

  return {
    ...view,
    grouping,
    subGrouping,
  }
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
    return (
      localFallbackViews.find((view) => view.id === localFallbackViewId) ??
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
  usingFallbackViews,
}: {
  activeBaseView: ViewDefinition | null
  data: ReturnType<typeof selectAppDataSnapshot>
  routeKey: string
  usingFallbackViews: boolean
}) {
  if (!activeBaseView || usingFallbackViews) {
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

function updateWorkSurfaceViewById(
  views: ViewDefinition[],
  viewId: string,
  updateView: (view: ViewDefinition) => ViewDefinition
) {
  return views.map((view) => (view.id === viewId ? updateView(view) : view))
}

function toggleWorkSurfaceFilterValue(
  view: ViewDefinition,
  key: ViewFilterKey,
  value: string
) {
  const existing = (view.filters[key] ?? []) as string[]
  const next = existing.includes(value)
    ? existing.filter((entry) => entry !== value)
    : [...existing, value]

  return {
    ...view,
    filters: {
      ...view.filters,
      [key]: next,
    },
  }
}

function toggleWorkSurfaceDisplayProperty(
  view: ViewDefinition,
  property: ViewDefinition["displayProps"][number]
) {
  return {
    ...view,
    displayProps: view.displayProps.includes(property)
      ? view.displayProps.filter((entry) => entry !== property)
      : [...view.displayProps, property],
  }
}

function WorkSurfaceTopbar({
  title,
  displayedViews,
  activeView,
  usingFallbackViews,
  allowCreateViews,
  editable,
  team,
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
  routeKey: string
  onSelectFallbackView: (viewId: string | null) => void
  onSelectView: (viewId: string) => void
}) {
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
                    onSelectFallbackView(null)
                    onSelectView(view.id)
                  }}
                >
                  {view.name}
                </button>
              </ViewContextMenu>
            )
          )}
          {!usingFallbackViews && allowCreateViews && editable && team ? (
            <IconButton
              className="size-6"
              onClick={() =>
                openManagedCreateDialog({
                  kind: "view",
                  defaultScopeType: "team",
                  defaultScopeId: team.id,
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
  usingFallbackViews,
  filterPopoverItems,
  hiddenFilters,
  groupOptions,
  onUpdateLocalView,
  onUpdateViewerView,
  onToggleLocalFilterValue,
  onToggleViewerFilterValue,
  onClearLocalFilters,
  onClearViewerFilters,
  onToggleLocalDisplayProperty,
  onToggleViewerDisplayProperty,
  onReorderLocalDisplayProperties,
  onReorderViewerDisplayProperties,
  onClearLocalDisplayProperties,
  onClearViewerDisplayProperties,
  onCreateWorkItem,
}: {
  view: ViewDefinition
  usingFallbackViews: boolean
  filterPopoverItems: WorkItem[]
  hiddenFilters: ViewFilterKey[]
  groupOptions: ViewDefinition["grouping"][]
  onUpdateLocalView: (patch: ViewConfigPatch) => void
  onUpdateViewerView: (patch: ViewConfigPatch) => void
  onToggleLocalFilterValue: (key: ViewFilterKey, value: string) => void
  onToggleViewerFilterValue: (key: ViewFilterKey, value: string) => void
  onClearLocalFilters: () => void
  onClearViewerFilters: () => void
  onToggleLocalDisplayProperty: (
    property: ViewDefinition["displayProps"][number]
  ) => void
  onToggleViewerDisplayProperty: (
    property: ViewDefinition["displayProps"][number]
  ) => void
  onReorderLocalDisplayProperties: (
    displayProps: ViewDefinition["displayProps"]
  ) => void
  onReorderViewerDisplayProperties: (
    displayProps: ViewDefinition["displayProps"]
  ) => void
  onClearLocalDisplayProperties: () => void
  onClearViewerDisplayProperties: () => void
  onCreateWorkItem: () => void
}) {
  return (
    <Viewbar className={view.layout === "timeline" ? undefined : "border-b-0"}>
      <LayoutTabs
        view={view}
        onUpdateView={
          usingFallbackViews ? onUpdateLocalView : onUpdateViewerView
        }
      />
      <div aria-hidden className="mx-1.5 h-[18px] w-px bg-line" />
      <FilterPopover
        view={view}
        items={filterPopoverItems}
        hiddenFilters={hiddenFilters}
        variant="chip"
        onToggleFilterValue={
          usingFallbackViews
            ? onToggleLocalFilterValue
            : onToggleViewerFilterValue
        }
        onClearFilters={
          usingFallbackViews ? onClearLocalFilters : onClearViewerFilters
        }
      />
      <LevelChipPopover
        view={view}
        onUpdateView={
          usingFallbackViews ? onUpdateLocalView : onUpdateViewerView
        }
      />
      <GroupChipPopover
        view={view}
        groupOptions={groupOptions}
        onUpdateView={
          usingFallbackViews ? onUpdateLocalView : onUpdateViewerView
        }
      />
      <SortChipPopover
        view={view}
        onUpdateView={
          usingFallbackViews ? onUpdateLocalView : onUpdateViewerView
        }
      />
      <PropertiesChipPopover
        view={view}
        onToggleDisplayProperty={
          usingFallbackViews
            ? onToggleLocalDisplayProperty
            : onToggleViewerDisplayProperty
        }
        onReorderDisplayProperties={
          usingFallbackViews
            ? onReorderLocalDisplayProperties
            : onReorderViewerDisplayProperties
        }
        onClearDisplayProperties={
          usingFallbackViews
            ? onClearLocalDisplayProperties
            : onClearViewerDisplayProperties
        }
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
  usingFallbackViews,
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
  usingFallbackViews: boolean
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
          usingFallbackViews={usingFallbackViews}
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
    view?.layout === "board" || view?.layout === "timeline"
      ? "overflow-hidden"
      : "overflow-x-hidden overflow-y-auto"
  )
}

function getResolvedWorkSurfaceCreateContext(
  createContext: WorkSurfaceCreateContext | undefined,
  resolvedCreateTeamId: string | null
): WorkSurfaceCreateContext {
  return {
    defaultTeamId: createContext?.defaultTeamId ?? resolvedCreateTeamId,
    defaultProjectId: createContext?.defaultProjectId ?? null,
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
  usingFallbackViews,
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
  usingFallbackViews: boolean
  view: ViewDefinition
  onToggleHiddenValue: (key: "groups" | "subgroups", value: string) => void
}) {
  const resolvedCreateContext = getResolvedWorkSurfaceCreateContext(
    createContext,
    resolvedCreateTeamId
  )
  const hiddenValueHandler = usingFallbackViews
    ? undefined
    : onToggleHiddenValue

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

  return (
    <TimelineView data={data} items={items} view={view} editable={editable} />
  )
}

function useLocalFallbackViewActions({
  activeView,
  setLocalFallbackViews,
  usingFallbackViews,
}: {
  activeView: ViewDefinition | null
  setLocalFallbackViews: (
    updater: (current: ViewDefinition[]) => ViewDefinition[]
  ) => void
  usingFallbackViews: boolean
}) {
  const activeViewId = activeView?.id ?? null

  function updateLocalActiveView(patch: ViewConfigPatch) {
    if (!usingFallbackViews || !activeViewId) {
      return
    }

    setLocalFallbackViews((current) =>
      updateWorkSurfaceViewById(current, activeViewId, (view) =>
        applyLocalViewPatch(view, patch)
      )
    )
  }

  function toggleLocalActiveViewFilterValue(key: ViewFilterKey, value: string) {
    if (!usingFallbackViews || !activeViewId) {
      return
    }

    setLocalFallbackViews((current) =>
      updateWorkSurfaceViewById(current, activeViewId, (view) =>
        toggleWorkSurfaceFilterValue(view, key, value)
      )
    )
  }

  function clearLocalActiveViewFilters() {
    if (!usingFallbackViews || !activeViewId) {
      return
    }

    setLocalFallbackViews((current) =>
      updateWorkSurfaceViewById(current, activeViewId, (view) => ({
        ...view,
        filters: createEmptyViewFilters(),
      }))
    )
  }

  function toggleLocalActiveDisplayProperty(
    property: ViewDefinition["displayProps"][number]
  ) {
    if (!usingFallbackViews || !activeViewId) {
      return
    }

    setLocalFallbackViews((current) =>
      updateWorkSurfaceViewById(current, activeViewId, (view) =>
        toggleWorkSurfaceDisplayProperty(view, property)
      )
    )
  }

  function reorderLocalActiveDisplayProperties(
    displayProps: ViewDefinition["displayProps"]
  ) {
    if (!usingFallbackViews || !activeViewId) {
      return
    }

    setLocalFallbackViews((current) =>
      updateWorkSurfaceViewById(current, activeViewId, (view) => ({
        ...view,
        displayProps: [...displayProps],
      }))
    )
  }

  function clearLocalActiveDisplayProperties() {
    if (!usingFallbackViews || !activeViewId) {
      return
    }

    setLocalFallbackViews((current) =>
      updateWorkSurfaceViewById(current, activeViewId, (view) => ({
        ...view,
        displayProps: [],
      }))
    )
  }

  return {
    clearLocalActiveDisplayProperties,
    clearLocalActiveViewFilters,
    reorderLocalActiveDisplayProperties,
    toggleLocalActiveDisplayProperty,
    toggleLocalActiveViewFilterValue,
    updateLocalActiveView,
  }
}

function useViewerViewActions({
  activeView,
  routeKey,
  usingFallbackViews,
}: {
  activeView: ViewDefinition | null
  routeKey: string
  usingFallbackViews: boolean
}) {
  const activeViewId = activeView?.id ?? null

  function updateViewerActiveView(patch: ViewConfigPatch) {
    if (usingFallbackViews || !activeViewId) {
      return
    }

    useAppStore.getState().patchViewerViewConfig(routeKey, activeViewId, patch)
  }

  function toggleViewerActiveViewFilterValue(
    key: ViewFilterKey,
    value: string
  ) {
    if (usingFallbackViews || !activeViewId) {
      return
    }

    useAppStore
      .getState()
      .toggleViewerViewFilterValue(routeKey, activeViewId, key, value)
  }

  function clearViewerActiveViewFilters() {
    if (usingFallbackViews || !activeViewId) {
      return
    }

    useAppStore.getState().clearViewerViewFilters(routeKey, activeViewId)
  }

  function toggleViewerActiveDisplayProperty(
    property: ViewDefinition["displayProps"][number]
  ) {
    if (usingFallbackViews || !activeViewId) {
      return
    }

    useAppStore
      .getState()
      .toggleViewerViewDisplayProperty(routeKey, activeViewId, property)
  }

  function reorderViewerActiveDisplayProperties(
    displayProps: ViewDefinition["displayProps"]
  ) {
    if (usingFallbackViews || !activeViewId) {
      return
    }

    useAppStore
      .getState()
      .reorderViewerViewDisplayProperties(routeKey, activeViewId, displayProps)
  }

  function clearViewerActiveDisplayProperties() {
    if (usingFallbackViews || !activeViewId) {
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
    if (usingFallbackViews || !activeViewId) {
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
  const editable = team ? canEditTeam(data, team.id) : false
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
    usingFallbackViews,
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
        setLocalFallbackViewId(requestedViewId)
      }
      return
    }

    if (!views.some((view) => view.id === requestedViewId)) {
      return
    }

    useAppStore.getState().setSelectedView(routeKey, requestedViewId)
  }, [fallbackViews, requestedViewId, routeKey, usingFallbackViews, views])

  const compatibleActiveView = useMemo(
    () => getCompatibleActiveView(activeView, groupOptions),
    [activeView, groupOptions]
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
  const localViewActions = useLocalFallbackViewActions({
    activeView,
    setLocalFallbackViews,
    usingFallbackViews,
  })
  const viewerViewActions = useViewerViewActions({
    activeView,
    routeKey,
    usingFallbackViews,
  })

  function handleCreateWorkItem() {
    if (!resolvedCreateTeamId) {
      return
    }

    openManagedCreateDialog({
      kind: "workItem",
      defaultTeamId: resolvedCreateTeamId,
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
        routeKey={routeKey}
        onSelectFallbackView={setLocalFallbackViewId}
        onSelectView={(viewId) =>
          useAppStore.getState().setSelectedView(routeKey, viewId)
        }
      />

      {compatibleActiveView ? (
        <WorkSurfaceViewbar
          view={compatibleActiveView}
          usingFallbackViews={usingFallbackViews}
          filterPopoverItems={filterPopoverItems}
          hiddenFilters={hiddenFilters}
          groupOptions={groupOptions}
          onUpdateLocalView={localViewActions.updateLocalActiveView}
          onUpdateViewerView={viewerViewActions.updateViewerActiveView}
          onToggleLocalFilterValue={
            localViewActions.toggleLocalActiveViewFilterValue
          }
          onToggleViewerFilterValue={
            viewerViewActions.toggleViewerActiveViewFilterValue
          }
          onClearLocalFilters={localViewActions.clearLocalActiveViewFilters}
          onClearViewerFilters={viewerViewActions.clearViewerActiveViewFilters}
          onToggleLocalDisplayProperty={
            localViewActions.toggleLocalActiveDisplayProperty
          }
          onToggleViewerDisplayProperty={
            viewerViewActions.toggleViewerActiveDisplayProperty
          }
          onReorderLocalDisplayProperties={
            localViewActions.reorderLocalActiveDisplayProperties
          }
          onReorderViewerDisplayProperties={
            viewerViewActions.reorderViewerActiveDisplayProperties
          }
          onClearLocalDisplayProperties={
            localViewActions.clearLocalActiveDisplayProperties
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
        usingFallbackViews={usingFallbackViews}
        isLoading={isLoading}
        loadingLabel={loadingLabel}
        emptyLabel={emptyLabel}
        onCreateWorkItem={handleCreateWorkItem}
        onToggleHiddenValue={viewerViewActions.toggleViewerActiveHiddenValue}
      />
    </div>
  )
}

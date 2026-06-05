"use client"

import { useEffect, useMemo, useState } from "react"
import { useAppSearchParams } from "@/lib/browser/app-navigation"
import { useShallow } from "zustand/react/shallow"
import { ArrowCounterClockwise, Plus } from "@phosphor-icons/react"

import {
  canEditTeam,
  canEditWorkspace,
  buildWorkViewModel,
  getCompatibleWorkViewGroupOptions,
  getGroupVisibleItemsForView,
  getUser,
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
  normalizeHiddenState,
  type GroupField,
  type Team,
  type TeamExperienceType,
  type ViewDefinition,
  type WorkItem,
  type WorkItemVisibility,
} from "@/lib/domain/types"
import { getBrowserTimeZone, normalizeTimeZone } from "@/lib/time-zone"
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
  CalendarSettingsButton,
  CalendarView,
  getWorkSurfaceCreateDefaultsFromView,
  ListView,
  TimelineView,
  type CalendarColorMode,
  type CalendarMode,
  type CalendarTimeInterval,
  type CalendarViewControls,
  type CalendarWeekDayCount,
  type CalendarWeekStart,
} from "@/components/app/screens/work-surface-view"
import { WorkItemDetailSidebarSurface } from "@/components/app/screens/work-item-detail-screen"
import { cn } from "@/lib/utils"

type WorkSurfaceChildDisplayMode = "direct" | "assigned-descendants"
type WorkSurfaceCreateContext = {
  defaultTeamId?: string | null
  defaultProjectId?: string | null
  defaultVisibility?: WorkItemVisibility
}
type WorkSurfaceCalendarState = Required<CalendarViewControls>

const EMPTY_FALLBACK_VIEWS: ViewDefinition[] = []

function useWorkSurfaceCalendarState(
  data: ReturnType<typeof selectAppDataSnapshot>
): WorkSurfaceCalendarState {
  const [colorMode, onColorModeChange] = useState<CalendarColorMode>("status")
  const [mode, onModeChange] = useState<CalendarMode>("week")
  const [timeInterval, onTimeIntervalChange] =
    useState<CalendarTimeInterval>("hour")
  const [maxAllDayEvents, onMaxAllDayEventsChange] = useState(10)
  const [weekDayCount, onWeekDayCountChange] = useState<CalendarWeekDayCount>(7)
  const [showWeekends, onShowWeekendsChange] = useState(true)
  const [weekStart, onWeekStartChange] = useState<CalendarWeekStart>("monday")
  const currentUser = getUser(data, data.currentUserId)
  const defaultTimeZone = normalizeTimeZone(
    currentUser?.preferences.timeZone,
    getBrowserTimeZone()
  )
  const [timeZoneOverride, setTimeZoneOverride] = useState<string | null>(null)

  return {
    colorMode,
    onColorModeChange,
    mode,
    onModeChange,
    timeInterval,
    onTimeIntervalChange,
    maxAllDayEvents,
    onMaxAllDayEventsChange,
    weekDayCount,
    onWeekDayCountChange,
    showWeekends,
    onShowWeekendsChange,
    weekStart,
    onWeekStartChange,
    timeZone: timeZoneOverride ?? defaultTimeZone,
    onTimeZoneChange: setTimeZoneOverride,
  }
}

function WorkSurfaceCalendarSettingsButton({
  calendar,
}: {
  calendar: WorkSurfaceCalendarState
}) {
  return (
    <CalendarSettingsButton
      colorMode={calendar.colorMode}
      onColorModeChange={calendar.onColorModeChange}
      timeInterval={calendar.timeInterval}
      onTimeIntervalChange={calendar.onTimeIntervalChange}
      maxAllDayEvents={calendar.maxAllDayEvents}
      onMaxAllDayEventsChange={calendar.onMaxAllDayEventsChange}
      weekDayCount={calendar.weekDayCount}
      onWeekDayCountChange={calendar.onWeekDayCountChange}
      showWeekDayCount={calendar.mode === "week"}
      showWeekends={calendar.showWeekends}
      onShowWeekendsChange={calendar.onShowWeekendsChange}
      weekStart={calendar.weekStart}
      onWeekStartChange={calendar.onWeekStartChange}
      timeZone={calendar.timeZone}
      onTimeZoneChange={calendar.onTimeZoneChange}
    />
  )
}

function cloneFallbackView(view: ViewDefinition): ViewDefinition {
  return {
    ...view,
    filters: cloneViewFilters(view.filters),
    displayProps: [...view.displayProps],
    hiddenState: {
      groups: [...view.hiddenState.groups],
      subgroups: [...view.hiddenState.subgroups],
      ...(view.hiddenState.includedGroups
        ? { includedGroups: [...view.hiddenState.includedGroups] }
        : {}),
    },
  }
}

function getCompatibleActiveView(
  view: ViewDefinition | null,
  groupOptions: GroupField[]
) {
  if (!view) {
    return null
  }

  const grouping =
    view.grouping === null || groupOptions.includes(view.grouping)
      ? view.grouping
      : "status"
  const subGrouping =
    grouping !== null &&
    view.subGrouping &&
    groupOptions.includes(view.subGrouping) &&
    view.subGrouping !== grouping
      ? view.subGrouping
      : null
  const displayProps = getCompatibleWorkSurfaceDisplayProps(view)
  const displayPropsChanged = displayProps.length !== view.displayProps.length
  const filters = getCompatibleWorkSurfaceFilters(view)
  const filtersChanged = filters !== view.filters
  if (
    grouping === view.grouping &&
    subGrouping === (view.subGrouping ?? null) &&
    !displayPropsChanged &&
    !filtersChanged
  ) {
    return view
  }

  return {
    ...view,
    grouping,
    subGrouping,
    filters,
    displayProps,
  }
}

function isPrivateTaskView(view: ViewDefinition | null) {
  return (
    view?.entityKind === "items" &&
    view.filters.visibility?.length === 1 &&
    view.filters.visibility[0] === "private"
  )
}

const PRIVATE_TASK_EXCLUDED_DISPLAY_PROPERTIES = new Set<
  ViewDefinition["displayProps"][number]
>(["assignee", "project"])

function getCompatibleGroupOptions(
  view: ViewDefinition | null,
  groupOptions: GroupField[]
) {
  return getCompatibleWorkViewGroupOptions(view, groupOptions)
}

function getCompatibleWorkSurfaceDisplayProps(view: ViewDefinition) {
  return isPrivateTaskView(view)
    ? view.displayProps.filter(
        (property) => !PRIVATE_TASK_EXCLUDED_DISPLAY_PROPERTIES.has(property)
      )
    : view.displayProps
}

function getCompatibleWorkSurfaceFilters(view: ViewDefinition) {
  if (!isPrivateTaskView(view)) {
    return view.filters
  }

  const hasUnsupportedPrivateTaskFilters =
    view.filters.assigneeIds.length > 0 ||
    view.filters.creatorIds.length > 0 ||
    view.filters.projectIds.length > 0 ||
    view.filters.teamIds.length > 0 ||
    view.filters.leadIds.length > 0 ||
    view.filters.health.length > 0

  if (!hasUnsupportedPrivateTaskFilters) {
    return view.filters
  }

  return {
    ...view.filters,
    assigneeIds: [],
    creatorIds: [],
    projectIds: [],
    teamIds: [],
    leadIds: [],
    health: [],
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

function getWorkSurfaceViewModel({
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
    return {
      matchedItems: filterScopeItems,
      scopedSourceItems: filterScopeItems,
      visibleItems: filterScopeItems,
    }
  }

  return buildWorkViewModel(data, items, view, {
    ...(shouldMatchAssignedItems
      ? {
          matchItems: filterScopeItems,
          ...(view.showChildItems ? { childDisplayMode } : {}),
        }
      : {}),
    sourceItems: items,
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
  groupingExperience,
  hiddenFilters,
  groupOptions,
  onUpdateViewerView,
  onToggleViewerFilterValue,
  onClearViewerFilters,
  onToggleViewerDisplayProperty,
  onReorderViewerDisplayProperties,
  onClearViewerDisplayProperties,
  onResetViewerView,
  onCreateWorkItem,
  calendar,
  compactControls,
}: {
  view: ViewDefinition
  filterPopoverItems: WorkItem[]
  groupingExperience?: TeamExperienceType | null
  hiddenFilters: ViewFilterKey[]
  groupOptions: GroupField[]
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
  onResetViewerView: () => void
  onCreateWorkItem: () => void
  calendar: WorkSurfaceCalendarState
  compactControls?: boolean
}) {
  return (
    <Viewbar
      className={cn(
        "work-surface-viewbar",
        view.layout === "timeline" || view.layout === "calendar"
          ? undefined
          : "border-b-0"
      )}
    >
      <LayoutTabs view={view} onUpdateView={onUpdateViewerView} />
      <div aria-hidden className="mx-1.5 h-[18px] w-px bg-line" />
      <FilterPopover
        view={view}
        items={filterPopoverItems}
        hiddenFilters={hiddenFilters}
        groupingExperience={groupingExperience}
        variant="chip"
        showLabel={!compactControls}
        onToggleFilterValue={onToggleViewerFilterValue}
        onUpdateView={onUpdateViewerView}
        onClearFilters={onClearViewerFilters}
      />
      <LevelChipPopover
        view={view}
        showLabel={!compactControls}
        groupingExperience={groupingExperience}
        onUpdateView={onUpdateViewerView}
      />
      <GroupChipPopover
        view={view}
        groupOptions={groupOptions}
        groupingExperience={groupingExperience}
        showLabel={!compactControls}
        onUpdateView={onUpdateViewerView}
      />
      <SortChipPopover
        view={view}
        showLabel={!compactControls}
        showValue={!compactControls}
        onUpdateView={onUpdateViewerView}
      />
      <PropertiesChipPopover
        view={view}
        showLabel={!compactControls}
        onToggleDisplayProperty={onToggleViewerDisplayProperty}
        onReorderDisplayProperties={onReorderViewerDisplayProperties}
        onClearDisplayProperties={onClearViewerDisplayProperties}
      />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {view.layout === "calendar" ? (
          <WorkSurfaceCalendarSettingsButton calendar={calendar} />
        ) : null}
        <Button
          size={compactControls ? "icon-sm" : "sm"}
          variant="outline"
          aria-label="Reset view"
          className={cn(
            "h-7 shrink-0 text-[12px]",
            compactControls ? "w-7 px-0" : "gap-1.5 px-2.5"
          )}
          onClick={onResetViewerView}
        >
          <ArrowCounterClockwise className="size-3.5" />
          {compactControls ? null : "Reset"}
        </Button>
        <Button
          size={compactControls ? "icon-sm" : "sm"}
          variant="default"
          aria-label="New work item"
          className={cn(
            "h-7 shrink-0 text-[12px]",
            compactControls ? "w-7 px-0" : "gap-1.5 px-2.5"
          )}
          onClick={onCreateWorkItem}
        >
          <Plus className="size-3.5" />
          {compactControls ? null : "New"}
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
  groupingExperience,
  resolvedCreateTeamId,
  isLoading,
  loadingLabel,
  emptyLabel,
  calendar,
  onCreateWorkItem,
  onToggleHiddenValue,
  selectedItemId,
  onSelectedItemIdChange,
}: {
  data: ReturnType<typeof selectAppDataSnapshot>
  view: ViewDefinition | null
  visibleItems: WorkItem[]
  scopedItems: WorkItem[]
  editable: boolean
  childDisplayMode: WorkSurfaceChildDisplayMode
  createContext?: WorkSurfaceCreateContext
  groupingExperience?: TeamExperienceType | null
  resolvedCreateTeamId: string | null
  isLoading: boolean
  loadingLabel: string
  emptyLabel: string
  calendar: WorkSurfaceCalendarState
  onCreateWorkItem: () => void
  onToggleHiddenValue: (key: "groups" | "subgroups", value: string) => void
  selectedItemId?: string | null
  onSelectedItemIdChange?: (itemId: string | null) => void
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
          groupingExperience={groupingExperience}
          items={visibleItems}
          resolvedCreateTeamId={resolvedCreateTeamId}
          scopedItems={scopedItems}
          view={view}
          calendar={calendar}
          onToggleHiddenValue={onToggleHiddenValue}
          selectedItemId={selectedItemId}
          onSelectedItemIdChange={onSelectedItemIdChange}
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
  if (view?.layout === "calendar") {
    return "min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden overscroll-contain"
  }

  return cn(
    "min-h-0 min-w-0 flex-1 overscroll-contain",
    view?.layout === "board" || view?.layout === "timeline"
      ? "flex overflow-hidden"
      : "no-scrollbar overflow-x-hidden overflow-y-auto"
  )
}

function getResolvedWorkSurfaceCreateContext(
  createContext: WorkSurfaceCreateContext | undefined,
  resolvedCreateTeamId: string | null,
  view: ViewDefinition
): WorkSurfaceCreateContext {
  const filteredVisibility =
    view.filters.visibility?.length === 1
      ? view.filters.visibility[0]
      : undefined

  return {
    defaultTeamId: createContext?.defaultTeamId ?? resolvedCreateTeamId,
    defaultProjectId: createContext?.defaultProjectId ?? null,
    defaultVisibility: createContext?.defaultVisibility ?? filteredVisibility,
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
  groupingExperience,
  items,
  resolvedCreateTeamId,
  scopedItems,
  view,
  calendar,
  onToggleHiddenValue,
  selectedItemId,
  onSelectedItemIdChange,
}: {
  childDisplayMode: WorkSurfaceChildDisplayMode
  createContext?: WorkSurfaceCreateContext
  data: ReturnType<typeof selectAppDataSnapshot>
  editable: boolean
  groupingExperience?: TeamExperienceType | null
  items: WorkItem[]
  resolvedCreateTeamId: string | null
  scopedItems: WorkItem[]
  view: ViewDefinition
  calendar: WorkSurfaceCalendarState
  onToggleHiddenValue: (key: "groups" | "subgroups", value: string) => void
  selectedItemId?: string | null
  onSelectedItemIdChange?: (itemId: string | null) => void
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
        groupingExperience={groupingExperience}
        childDisplayMode={childDisplayMode}
        createContext={resolvedCreateContext}
        onToggleHiddenValue={hiddenValueHandler}
        selectedItemId={selectedItemId}
        onSelectedItemIdChange={onSelectedItemIdChange}
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
        groupingExperience={groupingExperience}
        childDisplayMode={childDisplayMode}
        createContext={resolvedCreateContext}
        onToggleHiddenValue={hiddenValueHandler}
        selectedItemId={selectedItemId}
        onSelectedItemIdChange={onSelectedItemIdChange}
      />
    )
  }

  if (view.layout === "calendar") {
    return (
      <CalendarView
        data={data}
        items={getGroupVisibleItemsForView(data, items, view)}
        editable={editable}
        mode={calendar.mode}
        onModeChange={calendar.onModeChange}
        colorMode={calendar.colorMode}
        onColorModeChange={calendar.onColorModeChange}
        timeInterval={calendar.timeInterval}
        onTimeIntervalChange={calendar.onTimeIntervalChange}
        maxAllDayEvents={calendar.maxAllDayEvents}
        onMaxAllDayEventsChange={calendar.onMaxAllDayEventsChange}
        weekDayCount={calendar.weekDayCount}
        onWeekDayCountChange={calendar.onWeekDayCountChange}
        showWeekends={calendar.showWeekends}
        onShowWeekendsChange={calendar.onShowWeekendsChange}
        weekStart={calendar.weekStart}
        onWeekStartChange={calendar.onWeekStartChange}
        timeZone={calendar.timeZone}
        onTimeZoneChange={calendar.onTimeZoneChange}
        createContext={resolvedCreateContext}
        showSettingsButton={false}
      />
    )
  }

  return (
    <TimelineView
      data={data}
      items={items}
      view={view}
      editable={editable}
      groupingExperience={groupingExperience}
    />
  )
}

function useViewerViewActions({
  activeView,
  onResetFallbackView,
  onUpdateFallbackView,
  routeKey,
}: {
  activeView: ViewDefinition | null
  onResetFallbackView?: (viewId: string) => void
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
    if (updateFallbackActiveView((view) => applyViewConfigPatch(view, patch))) {
      return
    }

    if (!activeViewId) {
      return
    }

    useAppStore.getState().patchViewerViewConfig(routeKey, activeViewId, patch)
  }

  function resetViewerActiveView() {
    if (!activeViewId) {
      return
    }

    if (onResetFallbackView) {
      onResetFallbackView(activeViewId)
      return
    }

    useAppStore.getState().resetViewerViewConfig(routeKey, activeViewId)
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
          hiddenState: normalizeHiddenState({
            ...view.hiddenState,
            [key]: nextValues,
          }),
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
    resetViewerActiveView,
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
  const searchParams = useAppSearchParams()
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
  const [selectedInlineItemId, setSelectedInlineItemId] = useState<
    string | null
  >(null)
  const calendar = useWorkSurfaceCalendarState(data)
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
  const workViewModel = getWorkSurfaceViewModel({
    childDisplayMode,
    data,
    filterScopeItems,
    items,
    shouldMatchAssignedItems,
    view: compatibleActiveView,
  })
  const filterPopoverItems = getWorkSurfaceFilterPopoverItems({
    activeView: compatibleActiveView,
    filterScopeItems: workViewModel.scopedSourceItems,
    items: workViewModel.matchedItems,
    shouldMatchAssignedItems,
  })
  const visibleItems = workViewModel.visibleItems
  const matchedItems = workViewModel.matchedItems
  const scopedSourceItems = workViewModel.scopedSourceItems
  const selectedInlineItem =
    selectedInlineItemId && compatibleActiveView?.layout !== "calendar"
      ? (visibleItems.find((item) => item.id === selectedInlineItemId) ??
        data.workItems.find((item) => item.id === selectedInlineItemId) ??
        null)
      : null
  const inlineSidebarOpen = Boolean(selectedInlineItem)

  useEffect(() => {
    if (!selectedInlineItemId) {
      return
    }

    if (
      !compatibleActiveView ||
      (compatibleActiveView.layout !== "list" &&
        compatibleActiveView.layout !== "board") ||
      !data.workItems.some((item) => item.id === selectedInlineItemId)
    ) {
      setSelectedInlineItemId(null)
    }
  }, [compatibleActiveView, data.workItems, selectedInlineItemId])

  function toggleInlineItemSidebar(itemId: string | null) {
    if (!itemId) {
      setSelectedInlineItemId(null)
      return
    }

    setSelectedInlineItemId((currentItemId) =>
      currentItemId === itemId ? null : itemId
    )
  }

  function updateLocalFallbackView(
    viewId: string,
    updateView: (view: ViewDefinition) => ViewDefinition
  ) {
    setLocalFallbackViews((currentViews) =>
      currentViews.map((view) => (view.id === viewId ? updateView(view) : view))
    )
  }

  function resetLocalFallbackView(viewId: string) {
    const sourceView = fallbackViews.find((view) => view.id === viewId)

    if (!sourceView) {
      return
    }

    setLocalFallbackViews((currentViews) =>
      currentViews.map((view) =>
        view.id === viewId ? cloneFallbackView(sourceView) : view
      )
    )
  }

  const viewerViewActions = useViewerViewActions({
    activeView,
    onResetFallbackView: usingFallbackViews
      ? resetLocalFallbackView
      : undefined,
    onUpdateFallbackView: usingFallbackViews
      ? updateLocalFallbackView
      : undefined,
    routeKey,
  })

  function handleCreateWorkItem() {
    const resolvedCreateContext = compatibleActiveView
      ? getResolvedWorkSurfaceCreateContext(
          createContext,
          resolvedCreateTeamId,
          compatibleActiveView
        )
      : createContext
    const createDefaults = compatibleActiveView
      ? getWorkSurfaceCreateDefaultsFromView({
          createContext: resolvedCreateContext,
          view: compatibleActiveView,
        })
      : null
    const defaultValues = createDefaults?.defaultValues
    const createsPrivateWorkItem = defaultValues?.visibility === "private"
    const defaultTeamId =
      createDefaults?.defaultTeamId ??
      resolvedCreateContext?.defaultTeamId ??
      resolvedCreateTeamId

    if (!createsPrivateWorkItem && !defaultTeamId) {
      return
    }

    openManagedCreateDialog({
      kind: "workItem",
      defaultTeamId,
      defaultProjectId: createDefaults?.defaultProjectId,
      initialType: createDefaults?.initialType,
      ...(defaultValues ? { defaultValues } : {}),
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

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {compatibleActiveView ? (
            <WorkSurfaceViewbar
              view={compatibleActiveView}
              filterPopoverItems={filterPopoverItems}
              groupingExperience={effectiveGroupingExperience}
              hiddenFilters={hiddenFilters}
              groupOptions={compatibleGroupOptions}
              onUpdateViewerView={viewerViewActions.updateViewerActiveView}
              onToggleViewerFilterValue={
                viewerViewActions.toggleViewerActiveViewFilterValue
              }
              onClearViewerFilters={
                viewerViewActions.clearViewerActiveViewFilters
              }
              onToggleViewerDisplayProperty={
                viewerViewActions.toggleViewerActiveDisplayProperty
              }
              onReorderViewerDisplayProperties={
                viewerViewActions.reorderViewerActiveDisplayProperties
              }
              onClearViewerDisplayProperties={
                viewerViewActions.clearViewerActiveDisplayProperties
              }
              onResetViewerView={viewerViewActions.resetViewerActiveView}
              calendar={calendar}
              compactControls={inlineSidebarOpen}
              onCreateWorkItem={handleCreateWorkItem}
            />
          ) : null}

          <WorkSurfaceContent
            data={data}
            view={compatibleActiveView}
            visibleItems={matchedItems}
            scopedItems={scopedSourceItems}
            editable={editable}
            groupingExperience={effectiveGroupingExperience}
            childDisplayMode={childDisplayMode}
            createContext={createContext}
            resolvedCreateTeamId={resolvedCreateTeamId}
            isLoading={isLoading}
            loadingLabel={loadingLabel}
            emptyLabel={emptyLabel}
            calendar={calendar}
            onCreateWorkItem={handleCreateWorkItem}
            onToggleHiddenValue={
              viewerViewActions.toggleViewerActiveHiddenValue
            }
            selectedItemId={selectedInlineItemId}
            onSelectedItemIdChange={toggleInlineItemSidebar}
          />
        </div>
        {selectedInlineItem ? (
          <div className="flex h-full min-h-0 w-[26.25rem] shrink-0 overflow-hidden">
            <WorkItemDetailSidebarSurface
              data={data}
              currentItem={selectedInlineItem}
              editable={editable}
              variant="inline"
              onClose={() => setSelectedInlineItemId(null)}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

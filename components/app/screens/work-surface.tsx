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
  createContext?: {
    defaultTeamId?: string | null
    defaultProjectId?: string | null
  }
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
  const activeBaseView = usingFallbackViews
    ? (localFallbackViews.find((view) => view.id === localFallbackViewId) ??
      localFallbackViews[0] ??
      null)
    : (getViewByRoute(data, routeKey) ?? views[0] ?? null)
  const activeViewOverride = activeBaseView
    ? data.ui.viewerViewConfigByRoute[
        getViewerScopedViewKey(data.currentUserId, routeKey, activeBaseView.id)
      ]
    : null
  const activeView =
    activeBaseView && !usingFallbackViews
      ? applyViewerViewConfig(activeBaseView, activeViewOverride)
      : activeBaseView
  const effectiveGroupingExperience =
    groupingExperience === undefined
      ? (team?.settings.experience ?? null)
      : groupingExperience
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
  const shouldMatchAssignedItems =
    childDisplayMode === "assigned-descendants" && Boolean(filterItems)
  const filterPopoverItems =
    shouldMatchAssignedItems && compatibleActiveView?.showChildItems
      ? items
      : filterScopeItems

  const visibleItems = compatibleActiveView
    ? getVisibleItemsForView(data, items, compatibleActiveView, {
        ...(shouldMatchAssignedItems
          ? {
              matchItems: filterScopeItems,
              ...(compatibleActiveView.showChildItems
                ? { childDisplayMode }
                : {}),
            }
          : {}),
      })
    : filterScopeItems

  function updateLocalActiveView(patch: ViewConfigPatch) {
    if (!usingFallbackViews || !activeView) {
      return
    }

    setLocalFallbackViews((current) =>
      current.map((view) =>
        view.id === activeView.id ? applyLocalViewPatch(view, patch) : view
      )
    )
  }

  function toggleLocalActiveViewFilterValue(key: ViewFilterKey, value: string) {
    if (!usingFallbackViews || !activeView) {
      return
    }

    setLocalFallbackViews((current) =>
      current.map((view) => {
        if (view.id !== activeView.id) {
          return view
        }

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
      })
    )
  }

  function clearLocalActiveViewFilters() {
    if (!usingFallbackViews || !activeView) {
      return
    }

    setLocalFallbackViews((current) =>
      current.map((view) =>
        view.id === activeView.id
          ? {
              ...view,
              filters: {
                ...view.filters,
                status: [],
                priority: [],
                assigneeIds: [],
                creatorIds: [],
                leadIds: [],
                health: [],
                milestoneIds: [],
                relationTypes: [],
                projectIds: [],
                parentIds: [],
                itemTypes: [],
                labelIds: [],
                teamIds: [],
              },
            }
          : view
      )
    )
  }

  function toggleLocalActiveDisplayProperty(
    property: ViewDefinition["displayProps"][number]
  ) {
    if (!usingFallbackViews || !activeView) {
      return
    }

    setLocalFallbackViews((current) =>
      current.map((view) => {
        if (view.id !== activeView.id) {
          return view
        }

        return {
          ...view,
          displayProps: view.displayProps.includes(property)
            ? view.displayProps.filter((entry) => entry !== property)
            : [...view.displayProps, property],
        }
      })
    )
  }

  function reorderLocalActiveDisplayProperties(
    displayProps: ViewDefinition["displayProps"]
  ) {
    if (!usingFallbackViews || !activeView) {
      return
    }

    setLocalFallbackViews((current) =>
      current.map((view) =>
        view.id === activeView.id
          ? {
              ...view,
              displayProps: [...displayProps],
            }
          : view
      )
    )
  }

  function clearLocalActiveDisplayProperties() {
    if (!usingFallbackViews || !activeView) {
      return
    }

    setLocalFallbackViews((current) =>
      current.map((view) =>
        view.id === activeView.id
          ? {
              ...view,
              displayProps: [],
            }
          : view
      )
    )
  }

  function updateViewerActiveView(patch: ViewConfigPatch) {
    if (usingFallbackViews || !activeView) {
      return
    }

    useAppStore.getState().patchViewerViewConfig(routeKey, activeView.id, patch)
  }

  function toggleViewerActiveViewFilterValue(
    key: ViewFilterKey,
    value: string
  ) {
    if (usingFallbackViews || !activeView) {
      return
    }

    useAppStore
      .getState()
      .toggleViewerViewFilterValue(routeKey, activeView.id, key, value)
  }

  function clearViewerActiveViewFilters() {
    if (usingFallbackViews || !activeView) {
      return
    }

    useAppStore.getState().clearViewerViewFilters(routeKey, activeView.id)
  }

  function toggleViewerActiveDisplayProperty(
    property: ViewDefinition["displayProps"][number]
  ) {
    if (usingFallbackViews || !activeView) {
      return
    }

    useAppStore
      .getState()
      .toggleViewerViewDisplayProperty(routeKey, activeView.id, property)
  }

  function reorderViewerActiveDisplayProperties(
    displayProps: ViewDefinition["displayProps"]
  ) {
    if (usingFallbackViews || !activeView) {
      return
    }

    useAppStore
      .getState()
      .reorderViewerViewDisplayProperties(routeKey, activeView.id, displayProps)
  }

  function clearViewerActiveDisplayProperties() {
    if (usingFallbackViews || !activeView) {
      return
    }

    useAppStore
      .getState()
      .clearViewerViewDisplayProperties(routeKey, activeView.id)
  }

  function toggleViewerActiveHiddenValue(
    key: "groups" | "subgroups",
    value: string
  ) {
    if (usingFallbackViews || !activeView) {
      return
    }

    useAppStore
      .getState()
      .toggleViewerViewHiddenValue(routeKey, activeView.id, key, value)
  }

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
                      setLocalFallbackViewId(view.id)
                      return
                    }

                    useAppStore.getState().setSelectedView(routeKey, view.id)
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
                      setLocalFallbackViewId(null)
                      useAppStore.getState().setSelectedView(routeKey, view.id)
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

      {compatibleActiveView ? (
        <Viewbar
          className={
            compatibleActiveView.layout === "timeline"
              ? undefined
              : "border-b-0"
          }
        >
          <LayoutTabs
            view={compatibleActiveView}
            onUpdateView={
              usingFallbackViews ? updateLocalActiveView : updateViewerActiveView
            }
          />
          <div aria-hidden className="mx-1.5 h-[18px] w-px bg-line" />
          <FilterPopover
            view={compatibleActiveView}
            items={filterPopoverItems}
            hiddenFilters={hiddenFilters}
            variant="chip"
            onToggleFilterValue={
              usingFallbackViews
                ? toggleLocalActiveViewFilterValue
                : toggleViewerActiveViewFilterValue
            }
            onClearFilters={
              usingFallbackViews
                ? clearLocalActiveViewFilters
                : clearViewerActiveViewFilters
            }
          />
          <LevelChipPopover
            view={compatibleActiveView}
            onUpdateView={
              usingFallbackViews ? updateLocalActiveView : updateViewerActiveView
            }
          />
          <GroupChipPopover
            view={compatibleActiveView}
            groupOptions={groupOptions}
            onUpdateView={
              usingFallbackViews ? updateLocalActiveView : updateViewerActiveView
            }
          />
          <SortChipPopover
            view={compatibleActiveView}
            onUpdateView={
              usingFallbackViews ? updateLocalActiveView : updateViewerActiveView
            }
          />
          <PropertiesChipPopover
            view={compatibleActiveView}
            onToggleDisplayProperty={
              usingFallbackViews
                ? toggleLocalActiveDisplayProperty
                : toggleViewerActiveDisplayProperty
            }
            onReorderDisplayProperties={
              usingFallbackViews
                ? reorderLocalActiveDisplayProperties
                : reorderViewerActiveDisplayProperties
            }
            onClearDisplayProperties={
              usingFallbackViews
                ? clearLocalActiveDisplayProperties
                : clearViewerActiveDisplayProperties
            }
          />
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              variant="default"
              className="h-7 gap-1.5 px-2.5 text-[12px]"
              onClick={handleCreateWorkItem}
            >
              <Plus className="size-3.5" />
              New
            </Button>
          </div>
        </Viewbar>
      ) : null}

      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 overscroll-contain",
          compatibleActiveView?.layout === "board"
            ? "overflow-hidden"
            : compatibleActiveView?.layout === "timeline"
              ? "overflow-hidden"
              : "overflow-x-hidden overflow-y-auto"
        )}
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center px-6 py-20 text-sm text-muted-foreground">
            {loadingLabel}
          </div>
        ) : compatibleActiveView ? (
          <>
            {compatibleActiveView.layout === "board" ? (
              <BoardView
                data={data}
                items={visibleItems}
                scopedItems={items}
                view={compatibleActiveView}
                editable={editable}
                childDisplayMode={childDisplayMode}
                createContext={{
                  defaultTeamId:
                    createContext?.defaultTeamId ?? resolvedCreateTeamId,
                  defaultProjectId: createContext?.defaultProjectId ?? null,
                }}
                onToggleHiddenValue={
                  usingFallbackViews ? undefined : toggleViewerActiveHiddenValue
                }
              />
            ) : null}
            {compatibleActiveView.layout === "list" ? (
              <ListView
                data={data}
                items={visibleItems}
                scopedItems={items}
                view={compatibleActiveView}
                editable={editable}
                childDisplayMode={childDisplayMode}
                createContext={{
                  defaultTeamId:
                    createContext?.defaultTeamId ?? resolvedCreateTeamId,
                  defaultProjectId: createContext?.defaultProjectId ?? null,
                }}
                onToggleHiddenValue={
                  usingFallbackViews ? undefined : toggleViewerActiveHiddenValue
                }
              />
            ) : null}
            {compatibleActiveView.layout === "timeline" ? (
              <TimelineView
                data={data}
                items={visibleItems}
                view={compatibleActiveView}
                editable={editable}
              />
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
            <div>{emptyLabel}</div>
            {resolvedCreateTeamId ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-2.5 text-[12px]"
                onClick={handleCreateWorkItem}
              >
                <Plus className="size-3.5" />
                New
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

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
  getDefaultTemplateTypeForTeamExperience,
  type Team,
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
  fallbackViews = [],
  items,
  filterItems,
  team,
  emptyLabel,
  childDisplayMode = "direct",
  allowCreateViews = true,
}: {
  title: string
  routeKey: string
  views: ViewDefinition[]
  fallbackViews?: ViewDefinition[]
  items: WorkItem[]
  filterItems?: WorkItem[]
  team: Team | null
  emptyLabel: string
  childDisplayMode?: WorkSurfaceChildDisplayMode
  allowCreateViews?: boolean
}) {
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const searchParams = useSearchParams()
  const editable = team ? canEditTeam(data, team.id) : false
  const createTeamId = team?.id ?? data.ui.activeTeamId
  const [localFallbackViews, setLocalFallbackViews] = useState(() =>
    fallbackViews.map(cloneFallbackView)
  )
  const [localFallbackViewId, setLocalFallbackViewId] = useState<string | null>(
    null
  )
  const usingFallbackViews = views.length === 0 && localFallbackViews.length > 0
  const activeView = usingFallbackViews
    ? (localFallbackViews.find((view) => view.id === localFallbackViewId) ??
      localFallbackViews[0] ??
      null)
    : (getViewByRoute(data, routeKey) ?? views[0] ?? null)
  const groupOptions = useMemo(
    () =>
      getAvailableGroupOptions(
        team
          ? getDefaultTemplateTypeForTeamExperience(team.settings.experience)
          : null
      ),
    [team?.settings.experience]
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

    if (!activeView && views[0]) {
      useAppStore.getState().setSelectedView(routeKey, views[0].id)
    }
  }, [activeView, routeKey, usingFallbackViews, views])

  useEffect(() => {
    const requestedViewId = searchParams.get("view")

    if (!requestedViewId) {
      return
    }

    if (usingFallbackViews) {
      if (localFallbackViews.some((view) => view.id === requestedViewId)) {
        setLocalFallbackViewId(requestedViewId)
      }
      return
    }

    if (!views.some((view) => view.id === requestedViewId)) {
      return
    }

    useAppStore.getState().setSelectedView(routeKey, requestedViewId)
  }, [localFallbackViews, routeKey, searchParams, usingFallbackViews, views])

  const compatibleActiveView = useMemo(
    () => getCompatibleActiveView(activeView, groupOptions),
    [activeView, groupOptions]
  )
  const displayedViews = usingFallbackViews ? localFallbackViews : views

  const visibleItems = compatibleActiveView
    ? getVisibleItemsForView(data, items, compatibleActiveView)
    : items
  const filterScopeItems = filterItems ?? items

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

  function handleCreateWorkItem() {
    if (!createTeamId) {
      return
    }

    openManagedCreateDialog({
      kind: "workItem",
      defaultTeamId: createTeamId,
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
              usingFallbackViews ? updateLocalActiveView : undefined
            }
          />
          <div aria-hidden className="mx-1.5 h-[18px] w-px bg-line" />
          <FilterPopover
            view={compatibleActiveView}
            items={filterScopeItems}
            variant="chip"
            onToggleFilterValue={
              usingFallbackViews ? toggleLocalActiveViewFilterValue : undefined
            }
            onClearFilters={
              usingFallbackViews ? clearLocalActiveViewFilters : undefined
            }
          />
          <LevelChipPopover
            view={compatibleActiveView}
            onUpdateView={
              usingFallbackViews ? updateLocalActiveView : undefined
            }
          />
          <GroupChipPopover
            view={compatibleActiveView}
            groupOptions={groupOptions}
            onUpdateView={
              usingFallbackViews ? updateLocalActiveView : undefined
            }
          />
          <SortChipPopover
            view={compatibleActiveView}
            onUpdateView={
              usingFallbackViews ? updateLocalActiveView : undefined
            }
          />
          <PropertiesChipPopover
            view={compatibleActiveView}
            onToggleDisplayProperty={
              usingFallbackViews ? toggleLocalActiveDisplayProperty : undefined
            }
            onReorderDisplayProperties={
              usingFallbackViews
                ? reorderLocalActiveDisplayProperties
                : undefined
            }
            onClearDisplayProperties={
              usingFallbackViews ? clearLocalActiveDisplayProperties : undefined
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

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
        {compatibleActiveView ? (
          <>
            {compatibleActiveView.layout === "board" ? (
              <BoardView
                data={data}
                items={visibleItems}
                scopedItems={items}
                view={compatibleActiveView}
                editable={editable}
                childDisplayMode={childDisplayMode}
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
            {createTeamId ? (
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

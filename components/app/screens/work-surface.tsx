"use client"

import { useEffect, useMemo } from "react"
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
  ViewConfigPopover,
} from "@/components/app/screens/work-surface-controls"
import {
  BoardView,
  ListView,
  TimelineView,
} from "@/components/app/screens/work-surface-view"
import { cn } from "@/lib/utils"

function getCompatibleActiveView(
  view: ViewDefinition | null,
  groupOptions: ViewDefinition["grouping"][]
) {
  if (!view) {
    return null
  }

  const grouping = groupOptions.includes(view.grouping) ? view.grouping : "status"
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
  items,
  team,
  emptyLabel,
}: {
  title: string
  routeKey: string
  views: ViewDefinition[]
  items: WorkItem[]
  team: Team | null
  emptyLabel: string
}) {
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const searchParams = useSearchParams()
  const activeView = getViewByRoute(data, routeKey) ?? views[0] ?? null
  const editable = team ? canEditTeam(data, team.id) : false
  const createTeamId = team?.id ?? data.ui.activeTeamId
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
    if (!activeView && views[0]) {
      useAppStore.getState().setSelectedView(routeKey, views[0].id)
    }
  }, [activeView, routeKey, views])

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

  const compatibleActiveView = useMemo(
    () => getCompatibleActiveView(activeView, groupOptions),
    [activeView, groupOptions]
  )

  const visibleItems = compatibleActiveView
    ? getVisibleItemsForView(data, items, compatibleActiveView)
    : items

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
        {views.length > 0 && activeView ? (
          <div className="ml-2 flex items-center gap-0.5">
            {views.map((view) =>
              isSystemView(view) ? (
                <button
                  key={view.id}
                  className={cn(
                    "h-7 rounded-md px-2 text-[12px] transition-colors",
                    view.id === activeView.id
                      ? "bg-surface-3 font-medium text-foreground"
                      : "text-fg-3 hover:bg-surface-3 hover:text-foreground"
                  )}
                  onClick={() =>
                    useAppStore.getState().setSelectedView(routeKey, view.id)
                  }
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
                    onClick={() =>
                      useAppStore.getState().setSelectedView(routeKey, view.id)
                    }
                  >
                    {view.name}
                  </button>
                </ViewContextMenu>
              )
            )}
            {editable && team ? (
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
        <Viewbar>
          <LayoutTabs view={compatibleActiveView} />
          <div
            aria-hidden
            className="mx-1.5 h-[18px] w-px bg-line"
          />
          <FilterPopover
            view={compatibleActiveView}
            items={items}
            variant="chip"
          />
          <LevelChipPopover view={compatibleActiveView} />
          <GroupChipPopover
            view={compatibleActiveView}
            groupOptions={groupOptions}
          />
          <SortChipPopover view={compatibleActiveView} />
          <PropertiesChipPopover view={compatibleActiveView} />
          <div className="ml-auto flex items-center gap-1.5">
            <ViewConfigPopover
              view={compatibleActiveView}
              groupOptions={groupOptions}
            />
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
              />
            ) : null}
            {compatibleActiveView.layout === "list" ? (
              <ListView
                data={data}
                items={visibleItems}
                scopedItems={items}
                view={compatibleActiveView}
                editable={editable}
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

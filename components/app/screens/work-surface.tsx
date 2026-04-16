"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useShallow } from "zustand/react/shallow"
import { Plus } from "@phosphor-icons/react"

import {
  canEditTeam,
  getViewByRoute,
  itemMatchesView,
} from "@/lib/domain/selectors"
import {
  type Team,
  type ViewDefinition,
  type WorkItem,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  HeaderTitle,
  SCREEN_HEADER_CLASS_NAME,
} from "@/components/app/screens/shared"
import { selectAppDataSnapshot } from "@/components/app/screens/helpers"
import { CreateWorkItemDialog } from "@/components/app/screens/create-work-item-dialog"
import {
  FilterPopover,
  ViewConfigPopover,
} from "@/components/app/screens/work-surface-controls"
import {
  BoardView,
  ListView,
  TimelineView,
} from "@/components/app/screens/work-surface-view"
import { cn } from "@/lib/utils"

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
  const [dialogOpen, setDialogOpen] = useState(false)

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

  const filteredItems = activeView
    ? items.filter((item) => itemMatchesView(data, item, activeView))
    : items
  const visibleItems =
    activeView?.layout === "timeline"
      ? filteredItems.filter((item) => item.parentId === null)
      : filteredItems

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div className={SCREEN_HEADER_CLASS_NAME}>
        <div className="flex min-w-0 items-center gap-2">
          <HeaderTitle title={title} />
          {views.length > 0 && activeView ? (
            <div className="flex items-center gap-1">
              {views.map((view) => (
                <button
                  key={view.id}
                  className={cn(
                    "h-6 rounded-sm px-2 text-xs transition-colors",
                    view.id === activeView.id
                      ? "bg-accent font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() =>
                    useAppStore.getState().setSelectedView(routeKey, view.id)
                  }
                >
                  {view.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {activeView ? (
            <>
              <FilterPopover view={activeView} items={items} />
              <ViewConfigPopover view={activeView} />
            </>
          ) : null}
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {dialogOpen ? (
        <CreateWorkItemDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          teamId={team?.id ?? data.ui.activeTeamId}
          disabled={!editable}
        />
      ) : null}

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
        {activeView ? (
          <>
            {activeView.layout === "board" ? (
              <BoardView
                data={data}
                items={visibleItems}
                view={activeView}
                editable={editable}
              />
            ) : null}
            {activeView.layout === "list" ? (
              <ListView
                data={data}
                items={visibleItems}
                view={activeView}
                editable={editable}
              />
            ) : null}
            {activeView.layout === "timeline" ? (
              <TimelineView
                data={data}
                items={visibleItems}
                view={activeView}
                editable={editable}
              />
            ) : null}
          </>
        ) : (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        )}
        {activeView && visibleItems.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : null}
      </div>
    </div>
  )
}

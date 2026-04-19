"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { CSS } from "@dnd-kit/utilities"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core"
import {
  format,
} from "date-fns"
import {
  CaretDown,
  CaretRight,
  Circle,
  DotsSixVertical,
  DotsThree,
  Flame,
  Plus,
} from "@phosphor-icons/react"

import {
  buildItemGroupsWithEmptyGroups,
  formatDisplayValue,
  getDirectChildWorkItemsForDisplay,
  getProject,
  getTeam,
  getUser,
} from "@/lib/domain/selectors"
import {
  getChildWorkItemCopy,
  priorityMeta,
  type AppData,
  type DisplayProperty,
  type ViewDefinition,
  type WorkItem,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

import { IssueActionMenu, IssueContextMenu, stopMenuEvent } from "./work-item-menus"
import { WorkItemAssigneeAvatar, WorkItemTypeBadge } from "./work-item-ui"
import { StatusIcon, getPatchForField } from "./shared"
import { getContainerItemsForDisplay } from "./helpers"
import {
  computeGroupDoneRatio,
  getGroupAccentVar,
  getGroupValueAdornment,
  getGroupValueLabel,
} from "./work-surface-view/shared"
export { TimelineView } from "./work-surface-view/timeline-view"
import { cn } from "@/lib/utils"

function parseGroupDropTarget(id: string, scope: "board" | "list") {
  const [dropScope, groupValue, subgroupValue] = id.split("::")

  if (dropScope === `${scope}-group` && groupValue) {
    return {
      groupValue,
      subgroupValue: undefined,
    }
  }

  if (dropScope === scope && groupValue) {
    return {
      groupValue,
      subgroupValue,
    }
  }

  return null
}

function buildGroupedWorkItemPatch({
  data,
  items,
  itemId,
  view,
  groupValue,
  subgroupValue,
}: {
  data: AppData
  items: WorkItem[]
  itemId: string
  view: Pick<ViewDefinition, "grouping" | "subGrouping">
  groupValue: string
  subgroupValue?: string
}) {
  const item = items.find((entry) => entry.id === itemId) ?? null

  return {
    ...getPatchForField(data, item, view.grouping, groupValue),
    ...(subgroupValue === undefined
      ? {}
      : getPatchForField(data, item, view.subGrouping, subgroupValue)),
  }
}

export function BoardView({
  data,
  items,
  scopedItems,
  view,
  editable,
}: {
  data: AppData
  items: WorkItem[]
  scopedItems?: WorkItem[]
  view: ViewDefinition
  editable: boolean
}) {
  const groups = [
    ...buildItemGroupsWithEmptyGroups(data, items, view).entries(),
  ]
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set())
  const hiddenGroups = groups.filter(([groupName]) =>
    view.hiddenState.groups.includes(groupName)
  )
  const visibleGroups = groups.filter(
    ([groupName]) => !view.hiddenState.groups.includes(groupName)
  )
  const showChildItems = Boolean(view.showChildItems)

  function toggleExpandedItem(itemId: string) {
    setExpandedItemIds((current) => {
      const next = new Set(current)

      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }

      return next
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveItemId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItemId(null)

    if (!editable || !event.over) {
      return
    }

    const target = parseGroupDropTarget(String(event.over.id), "board")

    if (!target) {
      return
    }

    const patch = buildGroupedWorkItemPatch({
      data,
      items,
      itemId: String(event.active.id),
      view,
      groupValue: target.groupValue,
      subgroupValue: target.subgroupValue,
    })

    useAppStore.getState().updateWorkItem(String(event.active.id), patch)
  }

  const activeItem = items.find((item) => item.id === activeItemId) ?? null

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveItemId(null)}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="w-full">
        <div className="flex min-w-max items-stretch gap-3 px-4 pt-3.5 pb-8">
          {visibleGroups.map(([groupName, subgroups]) => {
            const groupItems = Array.from(subgroups.values()).flat()
            const groupCount = groupItems.length
            const groupLabel = getGroupValueLabel(view.grouping, groupName)
            const groupAdornment = getGroupValueAdornment(
              view.grouping,
              groupName
            )
            const groupAccentVar = getGroupAccentVar(view.grouping, groupName)

            return (
              <div
                key={groupName}
                className="flex w-[18.5rem] shrink-0 flex-col rounded-xl border border-line-soft bg-bg-sunken"
              >
                <BoardGroupHeader id={`board-group::${groupName}`}>
                  <div className="flex items-center gap-2 text-[12.5px] font-semibold tracking-[0.01em]">
                    {groupAdornment}
                    <span className="text-foreground">{groupLabel}</span>
                    <span className="text-[11.5px] font-normal tabular-nums text-fg-3">
                      {groupCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/col:opacity-100">
                    <Button size="icon-xs" variant="ghost">
                      <Plus className="size-3.5" />
                    </Button>
                    <Button size="icon-xs" variant="ghost">
                      <DotsThree className="size-3.5" />
                    </Button>
                  </div>
                </BoardGroupHeader>
                {groupAccentVar ? (
                  <div
                    aria-hidden
                    className="mx-3 h-0.5 rounded-full"
                    style={{ background: groupAccentVar }}
                  />
                ) : null}
                <div className="flex flex-1 flex-col gap-1.5 p-2">
                  {Array.from(subgroups.entries()).map(
                    ([subgroupName, subItems]) => {
                      const hidden =
                        view.hiddenState.subgroups.includes(subgroupName)
                      if (hidden) return null

                      return (
                        <div key={`${groupName}-${subgroupName}`}>
                          {view.subGrouping ? (
                            <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
                              {getGroupValueLabel(
                                view.subGrouping,
                                subgroupName
                              )}
                            </div>
                          ) : null}
                          <BoardDropLane
                            id={`board::${groupName}::${subgroupName}`}
                          >
                            {getContainerItemsForDisplay(
                              subItems,
                              items,
                              showChildItems
                            ).map((item) => (
                              <DraggableWorkCard
                                key={item.id}
                                item={item}
                                data={data}
                                displayProps={view.displayProps}
                                details={
                                  showChildItems ? (
                                    <WorkItemChildDisclosure
                                      data={data}
                                      item={item}
                                      scopedItems={scopedItems}
                                      view={view}
                                      ordering={view.ordering}
                                      expanded={expandedItemIds.has(item.id)}
                                      onToggle={() => toggleExpandedItem(item.id)}
                                      variant="board"
                                    />
                                  ) : null
                                }
                              />
                            ))}
                          </BoardDropLane>
                        </div>
                      )
                    }
                  )}
                  {subgroups.size === 0 ? (
                    <div className="flex min-h-20 items-center justify-center rounded-lg border-[1.5px] border-dashed border-line px-3 text-xs text-fg-4">
                      {editable ? "Drop items onto the header" : "No items"}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {hiddenGroups.length > 0 ? (
        <div className="border-t px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Hidden columns
            </span>
            {hiddenGroups.map(([groupName]) => (
              <button
                key={groupName}
                className="rounded-md border px-2 py-0.5 text-xs hover:bg-accent"
                onClick={() =>
                  useAppStore
                    .getState()
                    .toggleViewHiddenValue(view.id, "groups", groupName)
                }
              >
                {getGroupValueLabel(view.grouping, groupName)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <DragOverlay>
        {activeItem ? (
          <div className="w-[18rem]">
            <BoardCardBody
              data={data}
              item={activeItem}
              displayProps={view.displayProps}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export function ListView({
  data,
  items,
  scopedItems,
  view,
  editable,
}: {
  data: AppData
  items: WorkItem[]
  scopedItems?: WorkItem[]
  view: ViewDefinition
  editable: boolean
}) {
  const groups = [
    ...buildItemGroupsWithEmptyGroups(data, items, view).entries(),
  ]
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set())
  const showChildItems = Boolean(view.showChildItems)

  function toggleGroup(groupName: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveItemId(String(event.active.id))
  }

  function toggleExpandedItem(itemId: string) {
    setExpandedItemIds((current) => {
      const next = new Set(current)

      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }

      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItemId(null)

    if (!editable || !event.over) {
      return
    }

    const target = parseGroupDropTarget(String(event.over.id), "list")

    if (!target) {
      return
    }

    const patch = buildGroupedWorkItemPatch({
      data,
      items,
      itemId: String(event.active.id),
      view,
      groupValue: target.groupValue,
      subgroupValue: target.subgroupValue,
    })

    useAppStore.getState().updateWorkItem(String(event.active.id), patch)
  }

  const activeItem = items.find((item) => item.id === activeItemId) ?? null

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveItemId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col">
        {groups.map(([groupName, subgroups]) => {
          if (view.hiddenState.groups.includes(groupName)) {
            return null
          }

          const groupItems = Array.from(subgroups.values()).flat()
          const groupCount = groupItems.length
          const isCollapsed = collapsedGroups.has(groupName)
          const groupLabel = getGroupValueLabel(view.grouping, groupName)
          const groupAdornment = getGroupValueAdornment(
            view.grouping,
            groupName
          )
          const groupAccentVar = getGroupAccentVar(view.grouping, groupName)
          const groupProgress = computeGroupDoneRatio(groupItems)

          return (
            <div key={groupName}>
              <ListGroupHeader
                id={`list-group::${groupName}`}
                accentVar={groupAccentVar}
                groupAdornment={groupAdornment}
                groupCount={groupCount}
                groupLabel={groupLabel}
                progressPercent={groupProgress.percent}
                isCollapsed={isCollapsed}
                onClick={() => toggleGroup(groupName)}
              />

              {!isCollapsed ? (
                <div className="flex flex-col">
                  {Array.from(subgroups.entries()).map(
                    ([subgroupName, subItems]) => {
                      if (view.hiddenState.subgroups.includes(subgroupName)) {
                        return null
                      }

                      return (
                        <div key={`${groupName}-${subgroupName}`}>
                          {view.subGrouping ? (
                            <div className="border-b border-line-soft bg-surface-2 px-8 py-1 text-[11.5px] font-medium tracking-[0.02em] text-fg-3 uppercase">
                              {getGroupValueLabel(
                                view.subGrouping,
                                subgroupName
                              )}
                            </div>
                          ) : null}
                          <ListDropLane
                            id={`list::${groupName}::${subgroupName}`}
                          >
                            {getContainerItemsForDisplay(
                              subItems,
                              items,
                              showChildItems
                            ).map((item) => {
                              const details = showChildItems ? (
                                <WorkItemChildDisclosure
                                  data={data}
                                  item={item}
                                  scopedItems={scopedItems}
                                  view={view}
                                  ordering={view.ordering}
                                  expanded={expandedItemIds.has(item.id)}
                                  onToggle={() => toggleExpandedItem(item.id)}
                                  variant="list"
                                />
                              ) : undefined

                              return editable ? (
                                <DraggableListRow
                                  key={item.id}
                                  data={data}
                                  item={item}
                                  displayProps={view.displayProps}
                                  depth={0}
                                  details={details}
                                />
                              ) : (
                                <ListRow
                                  key={item.id}
                                  data={data}
                                  item={item}
                                  displayProps={view.displayProps}
                                  depth={0}
                                  details={details}
                                />
                              )
                            })}
                          </ListDropLane>
                        </div>
                      )
                    }
                  )}
                  {subgroups.size === 0 ? (
                    <div className="border-b px-8 py-3 text-xs text-muted-foreground">
                      {editable
                        ? "Drop items onto the group header"
                        : "No items"}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}

        {view.hiddenState.groups.length > 0 ? (
          <div className="border-t px-4 py-3">
            <div className="mb-2 text-xs text-muted-foreground">
              Hidden rows
            </div>
            {view.hiddenState.groups.map((groupName) => (
              <button
                key={groupName}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                onClick={() =>
                  useAppStore
                    .getState()
                    .toggleViewHiddenValue(view.id, "groups", groupName)
                }
              >
                {getGroupValueAdornment(view.grouping, groupName)}
                <span>{getGroupValueLabel(view.grouping, groupName)}</span>
                <span className="ml-auto text-xs text-muted-foreground">0</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="w-full max-w-4xl rounded-md border bg-card shadow-sm">
            <ListRowBody
              data={data}
              item={activeItem}
              displayProps={view.displayProps}
              depth={0}
              interactive={false}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function ListGroupHeader({
  id,
  accentVar,
  groupAdornment,
  groupCount,
  groupLabel,
  progressPercent,
  isCollapsed,
  onClick,
}: {
  id: string
  accentVar?: string | null
  groupAdornment: ReactNode
  groupCount: number
  groupLabel: string
  progressPercent: number
  isCollapsed: boolean
  onClick: () => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "sticky top-0 z-[2] border-b border-line-soft backdrop-blur-[6px] transition-colors",
        isOver ? "bg-surface-2" : "bg-[color:color-mix(in_oklch,var(--background)_92%,transparent)]"
      )}
    >
      <button
        type="button"
        className="group/grp flex w-full items-center gap-2.5 px-3.5 pt-2 pb-1.5 text-left"
        onClick={onClick}
      >
        <span className="grid size-5 place-items-center text-fg-3">
          {isCollapsed ? (
            <CaretRight className="size-3" />
          ) : (
            <CaretDown className="size-3" />
          )}
        </span>
        <span className="flex min-w-0 items-center gap-2.5 text-[12.5px] font-semibold text-foreground">
          {groupAdornment}
          <span className="truncate">{groupLabel}</span>
        </span>
        <span className="text-[12px] tabular-nums text-fg-3">{groupCount}</span>
        {groupCount > 0 ? (
          <div className="ml-auto flex items-center gap-2">
            <div
              className="h-1 w-[120px] overflow-hidden rounded-full bg-surface-3"
              aria-label="Completion"
            >
              <div
                className="block h-full rounded-full transition-all"
                style={{
                  width: `${progressPercent}%`,
                  background: accentVar ?? "var(--text-2)",
                }}
              />
            </div>
            <span className="w-9 text-right text-[11.5px] tabular-nums text-fg-3">
              {progressPercent}%
            </span>
          </div>
        ) : null}
      </button>
    </div>
  )
}

function ListDropLane({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col transition-colors",
        isOver && "bg-surface-2"
      )}
    >
      {children}
    </div>
  )
}

function ListRowBody({
  data,
  item,
  displayProps,
  depth,
  dragHandle,
  interactive = true,
  details,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  depth: number
  dragHandle?: ReactNode
  interactive?: boolean
  details?: ReactNode
}) {
  const assignee = item.assigneeId ? getUser(data, item.assigneeId) : null
  const dueDate = item.dueDate ? new Date(item.dueDate) : null
  const now = new Date()
  const daysUntilDue = dueDate
    ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0
  const isSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 5
  const labelText =
    displayProps.includes("labels")
      ? formatDisplayValue(data, item, "labels")
      : ""

  const content = (
    <>
      <span className="font-mono text-[11.5px] tracking-[0.01em] text-fg-3">
        {item.key}
      </span>
      <StatusIcon status={item.status} />
      <div
        className="min-w-0"
        style={{ paddingLeft: depth * 16 }}
      >
        <div className="truncate text-[13px] text-foreground">
          {item.title}
        </div>
      </div>
      {labelText ? (
        <span className="hidden max-w-40 truncate text-[11.5px] text-fg-3 md:inline">
          {labelText}
        </span>
      ) : null}
      <WorkItemTypeBadge data={data} item={item} className="shrink-0" />
      {displayProps.includes("priority") && item.priority !== "none" ? (
        <Flame
          className="size-3.5 shrink-0"
          style={{ color: priorityColorVar[item.priority] }}
          weight="fill"
        />
      ) : (
        <span className="size-3.5 shrink-0" />
      )}
      {dueDate ? (
        <span
          className={cn(
            "shrink-0 text-[12px]",
            isOverdue && "text-[color:var(--priority-urgent)]",
            !isOverdue && isSoon && "text-[color:var(--priority-high)]",
            !isOverdue && !isSoon && "text-fg-3"
          )}
        >
          {format(dueDate, "MMM d")}
        </span>
      ) : (
        <span className="shrink-0 text-[12px] text-fg-4">—</span>
      )}
      {displayProps.includes("assignee") ? (
        assignee ? (
          <WorkItemAssigneeAvatar user={assignee} className="shrink-0" />
        ) : (
          <span
            aria-hidden
            className="inline-grid size-5 shrink-0 place-items-center rounded-full border border-dashed border-line text-fg-4"
          >
            <Circle className="size-2.5" />
          </span>
        )
      ) : null}
    </>
  )

  const body = (
    <div className="group/row relative border-b border-line-soft transition-colors hover:bg-surface-2">
      <div
        className="grid h-[34px] items-center gap-2.5 px-5 pl-3.5"
        style={{
          gridTemplateColumns:
            "18px 82px 16px minmax(0,1fr) auto auto auto auto auto",
        }}
      >
        <div className="flex items-center justify-center">
          {dragHandle ?? (
            <span aria-hidden className="size-4" />
          )}
        </div>
        {interactive ? (
          <Link
            href={`/items/${item.id}`}
            className="contents"
          >
            {content}
          </Link>
        ) : (
          <>{content}</>
        )}
        {interactive ? (
          <div className="absolute top-1/2 right-3.5 -translate-y-1/2 opacity-0 transition-opacity group-hover/row:opacity-100">
            <IssueActionMenu
              data={data}
              item={item}
              triggerClassName="rounded-md border border-line bg-surface px-1.5 py-0.5 shadow-sm hover:bg-surface-3"
            />
          </div>
        ) : null}
      </div>
      {details}
    </div>
  )

  return interactive ? (
    <IssueContextMenu data={data} item={item}>
      {body}
    </IssueContextMenu>
  ) : (
    body
  )
}

function ListRow({
  data,
  item,
  displayProps,
  depth,
  details,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  depth: number
  details?: ReactNode
}) {
  return (
    <ListRowBody
      data={data}
      item={item}
      displayProps={displayProps}
      depth={depth}
      details={details}
    />
  )
}

function DraggableListRow({
  data,
  item,
  displayProps,
  depth,
  details,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  depth: number
  details?: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
    })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging ? "opacity-60" : "opacity-100")}
    >
      <ListRowBody
        data={data}
        item={item}
        displayProps={displayProps}
        depth={depth}
        details={details}
        dragHandle={
          <button
            type="button"
            className="cursor-grab rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Drag ${item.title}`}
            onClick={stopMenuEvent}
            {...listeners}
            {...attributes}
          >
            <DotsSixVertical className="size-4" />
          </button>
        }
      />
    </div>
  )
}

function BoardGroupHeader({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/col flex items-center justify-between gap-2 px-3 pt-2.5 pb-2 transition-colors",
        isOver && "bg-surface-2"
      )}
    >
      {children}
    </div>
  )
}

function BoardDropLane({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-8 flex-col gap-2 rounded-md p-1 transition-colors",
        isOver && "bg-accent/50"
      )}
    >
      {children}
    </div>
  )
}

function DraggableWorkCard({
  data,
  item,
  displayProps,
  details,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  details?: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
    })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging ? "opacity-60" : "opacity-100")}
    >
      <BoardCardBody
        data={data}
        item={item}
        displayProps={displayProps}
        details={details}
        dragHandle={
          <button
            type="button"
            className="cursor-grab rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Drag ${item.title}`}
            {...listeners}
            {...attributes}
          >
            <DotsSixVertical className="size-4" />
          </button>
        }
      />
    </div>
  )
}

const priorityColorVar: Record<string, string> = {
  urgent: "var(--priority-urgent)",
  high: "var(--priority-high)",
  medium: "var(--priority-medium)",
  low: "var(--priority-low)",
  none: "var(--text-4)",
}

function BoardCardBody({
  data,
  item,
  displayProps,
  dragHandle,
  details,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  dragHandle?: ReactNode
  details?: ReactNode
}) {
  const assignee = item.assigneeId ? getUser(data, item.assigneeId) : null
  const dueDate = item.dueDate ? new Date(item.dueDate) : null
  const now = new Date()
  const daysUntilDue = dueDate
    ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0
  const isSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 5
  const labelNames = item.labelIds
    .slice(0, 3)
    .map((labelId) =>
      formatDisplayValue(data, { ...item, labelIds: [labelId] }, "labels")
    )
    .filter(Boolean) as string[]

  return (
    <IssueContextMenu data={data} item={item}>
      <div className="group/card flex cursor-grab flex-col gap-2 rounded-lg border border-line bg-surface p-2.5 transition-all hover:border-[color:var(--text-4)] hover:shadow-sm">
        <div className="flex items-center gap-2 text-[11px] text-fg-3">
          <span className="font-mono tracking-[0.01em]">{item.key}</span>
          {item.priority !== "none" ? (
            <Flame
              className="ml-auto size-3.5"
              style={{ color: priorityColorVar[item.priority] }}
              weight="fill"
            />
          ) : null}
          <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100">
            <IssueActionMenu
              data={data}
              item={item}
              triggerClassName="rounded-sm p-0.5 hover:bg-surface-3"
            />
            {dragHandle}
          </div>
        </div>
        <Link
          className="flex min-w-0 flex-col gap-2 focus-visible:outline-none"
          href={`/items/${item.id}`}
        >
          <div className="text-[13.5px] leading-[1.4] font-medium text-foreground">
            {item.title}
          </div>
          {displayProps.includes("labels") && labelNames.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-fg-3">
              {labelNames.map((name, index) => (
                <span
                  key={`${item.id}-label-${index}`}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-1.5 py-0.5 text-fg-2"
                >
                  <span
                    aria-hidden
                    className="size-[7px] rounded-full"
                    style={{
                      background: `var(--label-${(index % 5) + 1})`,
                    }}
                  />
                  {name}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-2 border-t border-dashed border-line pt-2 text-[11px] text-fg-3">
            <span className="inline-flex items-center gap-1">
              <StatusIcon status={item.status} />
              <WorkItemTypeBadge data={data} item={item} className="ml-0.5" />
            </span>
            {dueDate ? (
              <span
                className={cn(
                  "ml-auto inline-flex items-center gap-1",
                  isOverdue && "text-[color:var(--priority-urgent)]",
                  !isOverdue && isSoon && "text-[color:var(--priority-high)]"
                )}
              >
                {format(dueDate, "MMM d")}
              </span>
            ) : (
              <span className="ml-auto">—</span>
            )}
            {assignee ? (
              <WorkItemAssigneeAvatar user={assignee} className="shrink-0" />
            ) : (
              <span
                aria-hidden
                className="inline-grid size-5 place-items-center rounded-full border border-dashed border-line text-fg-4"
              >
                <Circle className="size-2.5" />
              </span>
            )}
          </div>
        </Link>
        {details}
      </div>
    </IssueContextMenu>
  )
}

function WorkItemChildDisclosure({
  data,
  item,
  scopedItems,
  view,
  ordering,
  expanded,
  onToggle,
  variant,
}: {
  data: AppData
  item: WorkItem
  scopedItems?: WorkItem[]
  view: ViewDefinition
  ordering: ViewDefinition["ordering"]
  expanded: boolean
  onToggle: () => void
  variant: "board" | "list"
}) {
  const team = getTeam(data, item.teamId)
  const childCopy = getChildWorkItemCopy(item.type, team?.settings.experience)
  const childItems = getDirectChildWorkItemsForDisplay(
    data,
    item,
    ordering,
    view,
    scopedItems
  )

  if (!childCopy.childType || childItems.length === 0) {
    return null
  }

  const childCountLabel = `${childItems.length} ${
    childItems.length === 1
      ? childCopy.childLabel.toLowerCase()
      : childCopy.childPluralLabel.toLowerCase()
  }`

  return (
    <div
      className={cn(
        variant === "board"
          ? "mt-3 border-t border-border/60 pt-2"
          : "border-t border-border/60 bg-muted/20 px-4 py-2"
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        onClick={onToggle}
      >
        {expanded ? (
          <CaretDown className="size-3.5" />
        ) : (
          <CaretRight className="size-3.5" />
        )}
        <span>{childCountLabel}</span>
      </button>
      {expanded ? (
        <div
          className={cn(
            "mt-2 flex flex-col gap-1.5",
            variant === "board" ? "" : "ml-8"
          )}
        >
          {childItems.map((child) => {
            const childAssignee = child.assigneeId
              ? getUser(data, child.assigneeId)
              : null

            return (
              <Link
                key={child.id}
                href={`/items/${child.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-md border border-border/60 text-xs transition-colors hover:bg-accent",
                  variant === "board"
                    ? "bg-background/70 px-2 py-1.5"
                    : "bg-background/80 px-2.5 py-1.5"
                )}
              >
                <StatusIcon status={child.status} />
                <span className="min-w-0 shrink-0 text-[11px] text-muted-foreground">
                  {child.key}
                </span>
                <span className="min-w-0 flex-1 truncate">{child.title}</span>
                {childAssignee ? (
                  <WorkItemAssigneeAvatar
                    user={childAssignee}
                    className="size-4"
                  />
                ) : null}
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

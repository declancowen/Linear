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
  DotsSixVertical,
  DotsThree,
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
import {
  getGroupValueAdornment,
  getGroupValueLabel,
} from "./work-surface-view/shared"
export { TimelineView } from "./work-surface-view/timeline-view"
import { cn } from "@/lib/utils"

function getContainerItemsForDisplay(items: WorkItem[], showChildItems: boolean) {
  if (!showChildItems) {
    return items
  }

  const visibleItemIds = new Set(items.map((item) => item.id))

  return items.filter(
    (item) => !item.parentId || !visibleItemIds.has(item.parentId)
  )
}

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
        <div className="flex min-w-max gap-2 p-3">
          {visibleGroups.map(([groupName, subgroups]) => {
            const groupCount = Array.from(subgroups.values()).flat().length
            const groupLabel = getGroupValueLabel(view.grouping, groupName)
            const groupAdornment = getGroupValueAdornment(
              view.grouping,
              groupName
            )

            return (
              <div
                key={groupName}
                className="flex w-[20rem] shrink-0 flex-col rounded-lg bg-muted/50"
              >
                <BoardGroupHeader id={`board-group::${groupName}`}>
                  <div className="flex items-center gap-2">
                    {groupAdornment}
                    <span className="text-sm font-medium">{groupLabel}</span>
                    <span className="text-xs text-muted-foreground">
                      {groupCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button size="icon-xs" variant="ghost">
                      <DotsThree className="size-3.5" />
                    </Button>
                    <Button size="icon-xs" variant="ghost">
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </BoardGroupHeader>
                <div className="flex flex-col gap-1.5 px-2 pb-2">
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
                    <div className="flex min-h-20 items-center justify-center rounded-md border border-dashed border-border/60 px-3 text-xs text-muted-foreground">
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

          const groupCount = Array.from(subgroups.values()).flat().length
          const isCollapsed = collapsedGroups.has(groupName)
          const groupLabel = getGroupValueLabel(view.grouping, groupName)
          const groupAdornment = getGroupValueAdornment(
            view.grouping,
            groupName
          )

          return (
            <div key={groupName}>
              <ListGroupHeader
                id={`list-group::${groupName}`}
                groupAdornment={groupAdornment}
                groupCount={groupCount}
                groupLabel={groupLabel}
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
                            <div className="border-b bg-accent/30 px-8 py-1.5 text-xs font-medium text-muted-foreground">
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
  groupAdornment,
  groupCount,
  groupLabel,
  isCollapsed,
  onClick,
}: {
  id: string
  groupAdornment: ReactNode
  groupCount: number
  groupLabel: string
  isCollapsed: boolean
  onClick: () => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn("transition-colors", isOver && "bg-accent/50")}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b px-4 py-2 transition-colors hover:bg-accent/50"
        onClick={onClick}
      >
        {isCollapsed ? (
          <CaretRight className="size-3 text-muted-foreground" />
        ) : (
          <CaretDown className="size-3 text-muted-foreground" />
        )}
        {groupAdornment}
        <span className="text-sm font-medium">{groupLabel}</span>
        <span className="text-xs text-muted-foreground">{groupCount}</span>
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
        isOver && "bg-accent/20"
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
  const content = (
    <>
      <span className="w-20 shrink-0 text-xs text-muted-foreground">
        {item.key}
      </span>
      <StatusIcon status={item.status} />
      <div className="min-w-0 flex-1" style={{ paddingLeft: depth * 16 }}>
        <div className="truncate text-sm">{item.title}</div>
      </div>
      <WorkItemTypeBadge data={data} item={item} className="shrink-0" />
      {displayProps.includes("priority") ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {priorityMeta[item.priority].label}
        </span>
      ) : null}
      {displayProps.includes("assignee") ? (
        assignee ? (
          <WorkItemAssigneeAvatar user={assignee} className="shrink-0" />
        ) : (
          <span className="size-5 shrink-0" />
        )
      ) : null}
      {displayProps.includes("project") ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {getProject(data, item.primaryProjectId)?.name ?? ""}
        </span>
      ) : null}
      {displayProps.includes("labels") ? (
        <span className="max-w-40 truncate text-xs text-muted-foreground">
          {formatDisplayValue(data, item, "labels")}
        </span>
      ) : null}
      {displayProps.includes("created") ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {format(new Date(item.createdAt), "MMM d")}
        </span>
      ) : null}
      {displayProps.includes("updated") ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {format(new Date(item.updatedAt), "MMM d")}
        </span>
      ) : null}
    </>
  )

  const body = (
    <div className="group border-b transition-colors hover:bg-accent/50">
      <div className="flex items-center gap-3 px-4 py-2">
        {interactive ? (
          <IssueActionMenu
            data={data}
            item={item}
            triggerClassName="opacity-0 transition-opacity group-hover:opacity-100"
          />
        ) : (
          <span className="size-4 shrink-0" />
        )}
        {dragHandle}
        {interactive ? (
          <Link
            href={`/items/${item.id}`}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            {content}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>
        )}
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
        "flex items-center justify-between px-3 py-2.5 transition-colors",
        isOver && "bg-accent/50"
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

  return (
    <IssueContextMenu data={data} item={item}>
      <div className="rounded-md border border-border/50 bg-card p-3 shadow-xs transition-shadow hover:shadow-sm">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="text-xs text-muted-foreground">{item.key}</span>
          <div className="flex items-center gap-1.5">
            {assignee ? (
              <WorkItemAssigneeAvatar user={assignee} className="shrink-0" />
            ) : (
              <span className="size-5 shrink-0" />
            )}
            <IssueActionMenu
              data={data}
              item={item}
              triggerClassName="rounded-md p-1 transition-colors hover:bg-muted"
            />
            {dragHandle}
          </div>
        </div>
        <Link
          className="flex flex-col rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          href={`/items/${item.id}`}
        >
          <div className="text-sm leading-snug font-medium hover:underline">
            {item.title}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <StatusIcon status={item.status} />
            <WorkItemTypeBadge data={data} item={item} />
            {displayProps.includes("project") && item.primaryProjectId ? (
              <Badge
                variant="secondary"
                className="h-4 px-1.5 py-0 text-[10px]"
              >
                {getProject(data, item.primaryProjectId)?.name}
              </Badge>
            ) : null}
          </div>
          {displayProps.includes("labels") && item.labelIds.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.labelIds.slice(0, 3).map((labelId) => {
                const labelName = formatDisplayValue(data, {
                  ...item,
                  labelIds: [labelId],
                }, "labels")

                if (!labelName) {
                  return null
                }

                return (
                  <Badge
                    key={`${item.id}-${labelId}`}
                    variant="outline"
                    className="h-4 px-1.5 py-0 text-[10px]"
                  >
                    {labelName}
                  </Badge>
                )
              })}
            </div>
          ) : null}
          <div className="mt-2 text-xs text-muted-foreground">
            Created {format(new Date(item.createdAt), "MMM d")}
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

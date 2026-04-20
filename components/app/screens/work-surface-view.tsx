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
import { format } from "date-fns"
import {
  CaretDown,
  CaretRight,
  Circle,
  DotsSixVertical,
  DotsThree,
  Flame,
  FolderSimple,
  ListBullets,
  TreeStructure,
} from "@phosphor-icons/react"

import {
  buildItemGroupsWithEmptyGroups,
  getDirectChildWorkItemsForDisplay,
  getProject,
  getTeam,
  getUser,
} from "@/lib/domain/selectors"
import {
  getChildWorkItemCopy,
  type AppData,
  type DisplayProperty,
  type ViewDefinition,
  type WorkItem,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusRing } from "@/components/ui/template-primitives"

import {
  IssueActionMenu,
  IssueContextMenu,
  stopMenuEvent,
} from "./work-item-menus"
import { WorkItemAssigneeAvatar } from "./work-item-ui"
import { getPatchForField } from "./shared"
import { getContainerItemsForDisplay } from "./helpers"
import {
  computeGroupDoneRatio,
  getGroupAccentVar,
  getGroupValueAdornment,
  getGroupValueLabel,
} from "./work-surface-view/shared"
export { TimelineView } from "./work-surface-view/timeline-view"
import { cn } from "@/lib/utils"

const priorityColorVar: Record<string, string> = {
  urgent: "var(--priority-urgent)",
  high: "var(--priority-high)",
  medium: "var(--priority-medium)",
  low: "var(--priority-low)",
  none: "var(--text-4)",
}

const LIST_ROW_TEMPLATE =
  "18px 18px 82px 16px minmax(0,1fr) auto auto auto auto auto"

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

function countChildItems(data: AppData, item: WorkItem) {
  return data.workItems.filter((entry) => entry.parentId === item.id).length
}

function GroupPill({
  label,
  accentVar,
  adornment,
}: {
  label: string
  accentVar?: string | null
  adornment: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[12px] font-semibold text-foreground">
      {adornment ?? (
        <span
          aria-hidden
          className="inline-block size-2 rounded-full"
          style={{ background: accentVar ?? "var(--text-3)" }}
        />
      )}
      <span>{label}</span>
    </span>
  )
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
        <div className="flex h-full min-w-max items-stretch gap-3 px-4 pt-3.5 pb-8">
          {visibleGroups.map(([groupName, subgroups]) => {
            const groupItems = Array.from(subgroups.values()).flat()
            const groupCount = groupItems.length
            const groupLabel = getGroupValueLabel(view.grouping, groupName)
            const groupAccentVar = getGroupAccentVar(view.grouping, groupName)

            return (
              <div
                key={groupName}
                className="flex w-[296px] shrink-0 flex-col rounded-xl border border-line-soft bg-bg-sunken"
              >
                <BoardGroupHeader
                  id={`board-group::${groupName}`}
                  accentVar={groupAccentVar}
                  groupLabel={groupLabel}
                  groupCount={groupCount}
                />
                <div
                  aria-hidden
                  className="mx-3 h-0.5 rounded-full opacity-60"
                  style={{
                    background: groupAccentVar ?? "var(--text-3)",
                  }}
                />
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2">
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
                                      onToggle={() =>
                                        toggleExpandedItem(item.id)
                                      }
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
                    <div className="rounded-[6px] border-[1.5px] border-dashed border-line px-3 py-3.5 text-center text-[12px] text-fg-4">
                      {editable ? "Drop here" : "No items"}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {hiddenGroups.length > 0 ? (
        <div className="border-t border-line-soft px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Hidden columns
            </span>
            {hiddenGroups.map(([groupName]) => (
              <button
                key={groupName}
                className="rounded-md border border-line px-2 py-0.5 text-xs hover:bg-surface-3"
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
          <div className="w-[280px]">
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
      <div className="flex flex-col pb-10">
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
                            ).flatMap((item) => {
                              const children = showChildItems
                                ? getDirectChildWorkItemsForDisplay(
                                    data,
                                    item,
                                    view.ordering,
                                    view,
                                    scopedItems
                                  )
                                : []
                              const hasChildren = children.length > 0
                              const isExpanded = expandedItemIds.has(item.id)
                              const parentRow = editable ? (
                                <DraggableListRow
                                  key={item.id}
                                  data={data}
                                  item={item}
                                  displayProps={view.displayProps}
                                  depth={0}
                                  hasChildren={hasChildren}
                                  expanded={isExpanded}
                                  onToggleExpanded={() =>
                                    toggleExpandedItem(item.id)
                                  }
                                />
                              ) : (
                                <ListRow
                                  key={item.id}
                                  data={data}
                                  item={item}
                                  displayProps={view.displayProps}
                                  depth={0}
                                  hasChildren={hasChildren}
                                  expanded={isExpanded}
                                  onToggleExpanded={() =>
                                    toggleExpandedItem(item.id)
                                  }
                                />
                              )

                              if (!isExpanded || !hasChildren) {
                                return [parentRow]
                              }

                              return [
                                parentRow,
                                ...children.map((child) => (
                                  <ListRow
                                    key={child.id}
                                    data={data}
                                    item={child}
                                    displayProps={view.displayProps}
                                    depth={1}
                                  />
                                )),
                              ]
                            })}
                          </ListDropLane>
                        </div>
                      )
                    }
                  )}
                  {subgroups.size === 0 ? (
                    <div className="border-b border-line-soft px-8 py-3 text-xs text-muted-foreground">
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
          <div className="border-t border-line-soft px-4 py-3">
            <div className="mb-2 text-xs text-muted-foreground">
              Hidden rows
            </div>
            {view.hiddenState.groups.map((groupName) => (
              <button
                key={groupName}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-3"
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
          <div className="w-full max-w-4xl rounded-md border border-line bg-surface shadow-sm">
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
        "sticky top-0 z-[2] backdrop-blur-[6px] transition-colors",
        isOver
          ? "bg-surface-2"
          : "bg-[color:color-mix(in_oklch,var(--background)_92%,transparent)]"
      )}
    >
      <button
        type="button"
        className="group/grp flex w-full items-center gap-2.5 px-5 pt-2 pb-1.5 pl-3.5 text-left"
        onClick={onClick}
      >
        <span className="grid size-5 place-items-center text-fg-3">
          {isCollapsed ? (
            <CaretRight className="size-3" />
          ) : (
            <CaretDown className="size-3" />
          )}
        </span>
        <GroupPill
          label={groupLabel}
          accentVar={accentVar}
          adornment={groupAdornment}
        />
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
  hasChildren = false,
  expanded = false,
  onToggleExpanded,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  depth: number
  dragHandle?: ReactNode
  interactive?: boolean
  hasChildren?: boolean
  expanded?: boolean
  onToggleExpanded?: () => void
}) {
  const assignee = item.assigneeId ? getUser(data, item.assigneeId) : null
  const dueDate = item.dueDate ? new Date(item.dueDate) : null
  const now = new Date()
  const daysUntilDue = dueDate
    ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0
  const isSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 5
  const project = getProject(data, item.primaryProjectId)
  const showProject = displayProps.includes("project") && Boolean(project)
  const showLabels = displayProps.includes("labels") && item.labelIds.length > 0
  const labelsToShow = showLabels ? item.labelIds.slice(0, 2) : []
  const labelLookup = data.labels
  const subCount = countChildItems(data, item)
  const showSubCount = subCount > 0

  const content = (
    <>
      <span className="font-mono text-[11.5px] tracking-[0.01em] text-fg-3">
        {item.key}
      </span>
      <StatusRing status={item.status} />
      <div className="min-w-0">
        <div className="truncate text-[13px] text-foreground">{item.title}</div>
      </div>
      {showProject || showLabels ? (
        <div className="hidden shrink-0 items-center gap-1 md:flex">
          {showProject ? (
            <span className="inline-flex h-5 items-center gap-1 rounded-full border border-line bg-surface px-2 text-[11px] text-fg-2">
              <FolderSimple className="size-[11px]" />
              <span className="max-w-[120px] truncate">{project?.name}</span>
            </span>
          ) : null}
          {labelsToShow.map((labelId) => {
            const label = labelLookup.find((entry) => entry.id === labelId)
            if (!label) {
              return null
            }

            return (
              <span
                key={labelId}
                className="inline-flex h-5 items-center gap-1 rounded-full border border-line bg-surface px-2 text-[11px] text-fg-2"
              >
                <span
                  aria-hidden
                  className="size-[7px] rounded-full"
                  style={{ background: label.color }}
                />
                {label.name}
              </span>
            )
          })}
        </div>
      ) : (
        <span aria-hidden className="hidden shrink-0 md:inline" />
      )}
      {displayProps.includes("priority") && item.priority !== "none" ? (
        <Flame
          className="size-3.5 shrink-0"
          style={{ color: priorityColorVar[item.priority] }}
          weight="fill"
        />
      ) : (
        <span aria-hidden className="size-3.5 shrink-0" />
      )}
      {displayProps.includes("dueDate") ? (
        dueDate ? (
          <span
            className={cn(
              "shrink-0 text-[12px] tabular-nums",
              isOverdue && "text-[color:var(--priority-urgent)]",
              !isOverdue && isSoon && "text-[color:var(--priority-high)]",
              !isOverdue && !isSoon && "text-fg-3"
            )}
          >
            {isOverdue ? "Overdue" : format(dueDate, "MMM d")}
          </span>
        ) : (
          <span aria-hidden className="shrink-0 text-[12px] text-fg-4">
            —
          </span>
        )
      ) : (
        <span aria-hidden className="shrink-0 text-[12px] text-transparent">
          —
        </span>
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
      ) : (
        <span aria-hidden className="size-5 shrink-0" />
      )}
      {showSubCount ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-fg-4 tabular-nums">
          <TreeStructure className="size-3" />
          {subCount}
        </span>
      ) : (
        <span aria-hidden className="shrink-0" />
      )}
    </>
  )

  const body = (
    <div className="group/row relative transition-colors hover:bg-surface-2">
      <div
        className="grid h-[34px] items-center gap-2.5 pr-5"
        style={{
          gridTemplateColumns: LIST_ROW_TEMPLATE,
          paddingLeft: 14 + depth * 24,
        }}
      >
        <div className="flex items-center justify-center">
          {dragHandle ?? <span aria-hidden className="size-4" />}
        </div>
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? "Collapse sub-issues" : "Expand sub-issues"}
            aria-expanded={expanded}
            className="inline-grid size-4 place-items-center rounded-sm text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onToggleExpanded?.()
            }}
          >
            {expanded ? (
              <CaretDown className="size-3" />
            ) : (
              <CaretRight className="size-3" />
            )}
          </button>
        ) : (
          <span aria-hidden className="size-4" />
        )}
        {interactive ? (
          <Link href={`/items/${item.id}`} className="contents">
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
  hasChildren,
  expanded,
  onToggleExpanded,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  depth: number
  hasChildren?: boolean
  expanded?: boolean
  onToggleExpanded?: () => void
}) {
  return (
    <ListRowBody
      data={data}
      item={item}
      displayProps={displayProps}
      depth={depth}
      hasChildren={hasChildren}
      expanded={expanded}
      onToggleExpanded={onToggleExpanded}
    />
  )
}

function DraggableListRow({
  data,
  item,
  displayProps,
  depth,
  hasChildren,
  expanded,
  onToggleExpanded,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  depth: number
  hasChildren?: boolean
  expanded?: boolean
  onToggleExpanded?: () => void
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
        hasChildren={hasChildren}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
        dragHandle={
          <button
            type="button"
            className="cursor-grab rounded-md p-0.5 text-fg-4 opacity-0 transition-all hover:bg-surface-3 hover:text-foreground group-hover/row:opacity-100 active:cursor-grabbing"
            aria-label={`Drag ${item.title}`}
            onClick={stopMenuEvent}
            {...listeners}
            {...attributes}
          >
            <DotsSixVertical className="size-3.5" />
          </button>
        }
      />
    </div>
  )
}

function BoardGroupHeader({
  id,
  accentVar,
  groupLabel,
  groupCount,
}: {
  id: string
  accentVar?: string | null
  groupLabel: string
  groupCount: number
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
      <div className="flex items-center gap-2 text-[12.5px] font-semibold tracking-[0.01em] text-foreground">
        <span
          aria-hidden
          className="inline-block size-2 rounded-full"
          style={{ background: accentVar ?? "var(--text-3)" }}
        />
        <span>{groupLabel}</span>
        <span className="text-[11.5px] font-normal tabular-nums text-fg-3">
          {groupCount}
        </span>
      </div>
      <div className="flex items-center gap-0.5 opacity-55 transition-opacity hover:opacity-100">
        <button
          type="button"
          className="inline-grid size-6 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
        >
          <DotsThree className="size-3.5" weight="bold" />
        </button>
      </div>
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
        "flex min-h-8 flex-col gap-1.5 rounded-md p-0 transition-colors",
        isOver && "bg-accent-bg/40"
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
            aria-label={`Drag ${item.title}`}
            className="inline-grid size-5 place-items-center rounded-sm text-fg-4 transition-colors hover:bg-surface-3 hover:text-foreground"
            {...listeners}
            {...attributes}
          >
            <DotsSixVertical className="size-3.5" />
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
  details,
  dragHandle,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  details?: ReactNode
  dragHandle?: ReactNode
}) {
  const assignee = item.assigneeId ? getUser(data, item.assigneeId) : null
  const dueDate = item.dueDate ? new Date(item.dueDate) : null
  const now = new Date()
  const daysUntilDue = dueDate
    ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0
  const isSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 5
  const project = getProject(data, item.primaryProjectId)
  const showProject = displayProps.includes("project") && Boolean(project)
  const labelIds =
    displayProps.includes("labels") ? item.labelIds.slice(0, 3) : []
  const labelLookup = data.labels
  const subCount = countChildItems(data, item)
  const doneSubCount = data.workItems.filter(
    (entry) => entry.parentId === item.id && entry.status === "done"
  ).length
  const showMeta = showProject || labelIds.length > 0

  return (
    <IssueContextMenu data={data} item={item}>
      <div className="group/card flex flex-col gap-2 rounded-[8px] border border-line bg-surface px-3 py-2.5 transition-all hover:border-[color:var(--text-4)] hover:shadow-sm">
        <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
          {dragHandle ?? null}
          <span className="font-mono tracking-[0.01em]">{item.key}</span>
          <div className="ml-auto flex items-center gap-1">
            {item.priority !== "none" ? (
              <Flame
                className="size-3.5"
                style={{ color: priorityColorVar[item.priority] }}
                weight="fill"
              />
            ) : null}
            <div className="opacity-0 transition-opacity group-hover/card:opacity-100">
              <IssueActionMenu
                data={data}
                item={item}
                triggerClassName="rounded-sm p-0.5 hover:bg-surface-3"
              />
            </div>
          </div>
        </div>
        <Link
          className="flex min-w-0 flex-col gap-2 focus-visible:outline-none"
          href={`/items/${item.id}`}
        >
          <div className="text-[13.5px] leading-[1.4] font-medium text-foreground">
            {item.title}
          </div>
          {showMeta ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-fg-3">
              {showProject ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-1.5 py-0.5 text-fg-2">
                  <FolderSimple className="size-[11px]" />
                  <span className="max-w-[140px] truncate">{project?.name}</span>
                </span>
              ) : null}
              {labelIds.map((labelId) => {
                const label = labelLookup.find(
                  (entry) => entry.id === labelId
                )
                if (!label) return null
                return (
                  <span
                    key={labelId}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-1.5 py-0.5 text-fg-2"
                  >
                    <span
                      aria-hidden
                      className="size-[7px] rounded-full"
                      style={{ background: label.color }}
                    />
                    {label.name}
                  </span>
                )
              })}
            </div>
          ) : null}
          <div className="flex items-center gap-2 border-t border-dashed border-line pt-2 text-[11.5px] text-fg-3">
            <span className="inline-flex items-center gap-1">
              <ListBullets className="size-3" />
              {subCount > 0 ? `${doneSubCount}/${subCount}` : "0"}
            </span>
            {displayProps.includes("dueDate") ? (
              dueDate ? (
                <span
                  className={cn(
                    "ml-auto inline-flex items-center gap-1 tabular-nums",
                    isOverdue && "text-[color:var(--priority-urgent)]",
                    !isOverdue && isSoon && "text-[color:var(--priority-high)]"
                  )}
                >
                  {isOverdue ? "Overdue" : format(dueDate, "MMM d")}
                </span>
              ) : (
                <span aria-hidden className="ml-auto text-fg-4">
                  —
                </span>
              )
            ) : null}
            {assignee ? (
              <WorkItemAssigneeAvatar user={assignee} className="size-5" />
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
}: {
  data: AppData
  item: WorkItem
  scopedItems?: WorkItem[]
  view: ViewDefinition
  ordering: ViewDefinition["ordering"]
  expanded: boolean
  onToggle: () => void
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
    <div className="mt-1 rounded-md bg-surface-2 p-2">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-[11.5px] font-medium text-fg-3 transition-colors hover:text-foreground"
        onClick={onToggle}
      >
        {expanded ? (
          <CaretDown className="size-3" />
        ) : (
          <CaretRight className="size-3" />
        )}
        <span>{childCountLabel}</span>
      </button>
      {expanded ? (
        <div className="mt-1.5 flex flex-col gap-1">
          {childItems.map((child) => {
            const childAssignee = child.assigneeId
              ? getUser(data, child.assigneeId)
              : null

            return (
              <Link
                key={child.id}
                href={`/items/${child.id}`}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[12px] transition-colors hover:bg-surface-3"
              >
                <StatusRing status={child.status} className="size-2.5" />
                <span className="shrink-0 text-[11px] text-fg-3">
                  {child.key}
                </span>
                <span className="min-w-0 flex-1 truncate text-fg-2">
                  {child.title}
                </span>
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

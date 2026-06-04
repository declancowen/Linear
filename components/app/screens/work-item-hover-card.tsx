"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react"
import { format } from "date-fns"
import { ArrowSquareOut } from "@phosphor-icons/react"

import { AppLink } from "@/lib/browser/app-navigation"
import { type AppData, type WorkItem } from "@/lib/domain/types"
import {
  canEditTeam,
  getDocument,
  getTeam,
  getWorkItem,
  getWorkItemChildProgress,
  hasWorkspaceAccess,
} from "@/lib/domain/selectors"
import { getWorkItemAssigneeIds } from "@/lib/domain/work-item-assignees"
import { cn } from "@/lib/utils"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { useWorkItemSurfacePortalContainer } from "@/components/app/screens/work-item-surface-portal-context"

import { LabelColorDot, WorkItemTypeIcon, getDocumentPreview } from "./shared"
import { WorkItemTypeBadge } from "./work-item-ui"
import { InlineWorkItemPropertyControl } from "./work-item-inline-property-control"

const OPEN_DELAY_MS = 140
const CLOSE_DELAY_MS = 140

type PointerHandlers = {
  onPointerEnter?: (event: ReactPointerEvent) => void
  onPointerLeave?: (event: ReactPointerEvent) => void
  onPointerMove?: (event: ReactPointerEvent) => void
}

function WorkItemHoverMetaRow({
  label,
  align = "center",
  children,
}: {
  label: string
  align?: "center" | "start"
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex min-h-6 gap-2 text-[12px]",
        align === "start" ? "items-start" : "items-center"
      )}
    >
      <span className="w-16 shrink-0 text-fg-3">{label}</span>
      <span className="text-fg-1 min-w-0 flex-1">{children}</span>
    </div>
  )
}

function isInsideHoverCardSurface(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest(
      '[data-slot="hover-card-content"],[data-slot="popover-content"]'
    ) !== null
  )
}

function hasOpenPropertyPopover() {
  return (
    typeof document !== "undefined" &&
    document.querySelector(
      '[data-slot="popover-content"][data-state="open"]'
    ) !== null
  )
}

function useWorkItemHoverCardOpenState() {
  const [open, setOpen] = useState(false)
  const [anchorPoint, setAnchorPoint] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })
  const openTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const clearTimers = useCallback(() => {
    clearTimeout(openTimerRef.current)
    clearTimeout(closeTimerRef.current)
  }, [])

  const scheduleOpen = useCallback(
    (point: { x: number; y: number }) => {
      clearTimers()
      openTimerRef.current = setTimeout(() => {
        setAnchorPoint(point)
        setOpen(true)
      }, OPEN_DELAY_MS)
    },
    [clearTimers]
  )

  const scheduleClose = useCallback(() => {
    clearTimers()
    closeTimerRef.current = setTimeout(() => {
      if (!hasOpenPropertyPopover()) {
        setOpen(false)
      }
    }, CLOSE_DELAY_MS)
  }, [clearTimers])

  useEffect(() => clearTimers, [clearTimers])

  // Dismiss on outside pointer interaction while open (covers the case where a
  // nested property popover keeps the card pinned open after editing).
  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!isInsideHoverCardSurface(event.target)) {
        clearTimers()
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true)
  }, [clearTimers, open])

  return {
    anchorPoint,
    clearTimers,
    open,
    scheduleClose,
    setAnchorPoint,
    scheduleOpen,
  }
}

function getWorkItemHoverCardModel(data: AppData, item: WorkItem) {
  const doc = getDocument(data, item.descriptionDocId)
  const description = doc ? getDocumentPreview(doc) : ""
  const progress = getWorkItemChildProgress(data, item.id)
  const assigneeIds = getWorkItemAssigneeIds(item)
  const isPrivate = (item.visibility ?? "team") === "private"
  const team = getTeam(data, item.teamId)
  const workspaceId = isPrivate
    ? (item.workspaceId ?? null)
    : (item.workspaceId ?? team?.workspaceId ?? null)
  const editable = isPrivate
    ? item.creatorId === data.currentUserId &&
      Boolean(
        workspaceId && hasWorkspaceAccess(data, workspaceId, data.currentUserId)
      )
    : canEditTeam(data, team?.id)
  const parent = item.parentId ? getWorkItem(data, item.parentId) : null
  const project =
    !isPrivate && item.primaryProjectId
      ? (data.projects.find((entry) => entry.id === item.primaryProjectId) ??
        null)
      : null
  const labels = item.labelIds.length
    ? data.labels.filter((label) => item.labelIds.includes(label.id))
    : []

  return {
    assigneeIds,
    description,
    editable,
    isLongDescription: description.length > 160,
    isPrivate,
    labels,
    parent,
    progress,
    project,
  }
}

function WorkItemHoverCardHeader({
  data,
  item,
}: {
  data: AppData
  item: WorkItem
}) {
  return (
    <div className="flex items-start gap-2">
      <WorkItemTypeIcon itemType={item.type} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] text-fg-3">
          <span className="font-mono">{item.key}</span>
          <WorkItemTypeBadge data={data} item={item} />
        </div>
        <div className="text-fg-1 mt-1 text-[13px] leading-snug font-semibold">
          {item.title}
        </div>
      </div>
      <AppLink
        href={`/items/${item.id}`}
        aria-label="Open work item"
        title="Open"
        className="hover:text-fg-1 shrink-0 rounded-md p-1 text-fg-3 transition-colors hover:bg-surface-2"
      >
        <ArrowSquareOut className="size-4" />
      </AppLink>
    </div>
  )
}

function WorkItemHoverCardDescription({
  description,
  expanded,
  isLongDescription,
  onToggleExpanded,
}: {
  description: string
  expanded: boolean
  isLongDescription: boolean
  onToggleExpanded: () => void
}) {
  if (!description) {
    return null
  }

  return (
    <div>
      <p
        className={cn(
          "text-[12px] leading-relaxed whitespace-pre-line text-fg-3",
          expanded ? "max-h-40 overflow-y-auto" : "line-clamp-3"
        )}
      >
        {description}
      </p>
      {isLongDescription ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="hover:text-fg-1 mt-1 text-[11px] font-medium text-fg-3"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  )
}

function WorkItemHoverCardProgress({
  progress,
}: {
  progress: ReturnType<typeof getWorkItemChildProgress>
}) {
  if (progress.totalChildren <= 0) {
    return null
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-fg-3 tabular-nums">
        <span>
          {progress.completedChildren}/
          {progress.includedChildren || progress.totalChildren} done
        </span>
        <span>{progress.percent}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-status-done transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  )
}

function WorkItemHoverCardLabels({
  labels,
}: {
  labels: ReturnType<typeof getWorkItemHoverCardModel>["labels"]
}) {
  if (labels.length === 0) {
    return null
  }

  return (
    <WorkItemHoverMetaRow label="Labels" align="start">
      <span className="flex flex-wrap gap-1">
        {labels.map((label) => (
          <span
            key={label.id}
            className="flex items-center gap-1 rounded-full bg-surface-2 px-1.5 py-px text-[11px]"
          >
            <LabelColorDot color={label.color} className="size-1.5" />
            {label.name}
          </span>
        ))}
      </span>
    </WorkItemHoverMetaRow>
  )
}

function WorkItemHoverCardMeta({
  data,
  item,
  model,
}: {
  data: AppData
  item: WorkItem
  model: ReturnType<typeof getWorkItemHoverCardModel>
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-line-soft pt-2.5">
      <WorkItemHoverMetaRow label="Status">
        <InlineWorkItemPropertyControl
          data={data}
          item={item}
          property="status"
          variant="child"
        />
      </WorkItemHoverMetaRow>
      {model.editable || item.priority !== "none" ? (
        <WorkItemHoverMetaRow label="Priority">
          <InlineWorkItemPropertyControl
            data={data}
            item={item}
            property="priority"
            variant="child"
          />
        </WorkItemHoverMetaRow>
      ) : null}
      {!model.isPrivate && (model.editable || model.assigneeIds.length > 0) ? (
        <WorkItemHoverMetaRow label="Assignee">
          <InlineWorkItemPropertyControl
            data={data}
            item={item}
            property="assignee"
            variant="child"
          />
        </WorkItemHoverMetaRow>
      ) : null}
      {!model.isPrivate && (model.editable || model.project) ? (
        <WorkItemHoverMetaRow label="Project">
          <InlineWorkItemPropertyControl
            data={data}
            item={item}
            property="project"
            variant="child"
          />
        </WorkItemHoverMetaRow>
      ) : null}
      {model.parent ? (
        <WorkItemHoverMetaRow label="Parent">
          <span className="block truncate">
            {model.parent.key} · {model.parent.title}
          </span>
        </WorkItemHoverMetaRow>
      ) : null}
      {item.dueDate ? (
        <WorkItemHoverMetaRow label="Due">
          {format(new Date(item.dueDate), "MMM d, yyyy")}
        </WorkItemHoverMetaRow>
      ) : null}
      <WorkItemHoverCardLabels labels={model.labels} />
    </div>
  )
}

export function WorkItemHoverCard({
  data,
  item,
  children,
  side = "left",
  align = "start",
}: {
  data: AppData
  item: WorkItem
  children: ReactElement<PointerHandlers>
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}) {
  const portalContainer = useWorkItemSurfacePortalContainer()
  const [expanded, setExpanded] = useState(false)
  const hoverState = useWorkItemHoverCardOpenState()
  const model = getWorkItemHoverCardModel(data, item)

  return (
    <>
      <span
        className="contents"
        onPointerEnter={(event: ReactPointerEvent) => {
          hoverState.scheduleOpen({ x: event.clientX, y: event.clientY })
        }}
        onPointerMove={(event: ReactPointerEvent) => {
          if (hoverState.open) {
            hoverState.setAnchorPoint({ x: event.clientX, y: event.clientY })
          }
        }}
        onPointerLeave={hoverState.scheduleClose}
      >
        {children}
      </span>
      <HoverCard open={hoverState.open} onOpenChange={() => {}}>
        <HoverCardTrigger asChild>
          <span
            aria-hidden="true"
            className="pointer-events-none fixed"
            style={{ left: hoverState.anchorPoint.x, top: hoverState.anchorPoint.y }}
          />
        </HoverCardTrigger>
        <HoverCardContent
          side={side}
          align={align}
          portalContainer={portalContainer}
          onPointerEnter={hoverState.clearTimers}
          onPointerLeave={hoverState.scheduleClose}
          className="max-h-(--radix-hover-card-content-available-height) w-96 overflow-y-auto"
        >
          <WorkItemHoverCardHeader data={data} item={item} />
          <WorkItemHoverCardDescription
            description={model.description}
            expanded={expanded}
            isLongDescription={model.isLongDescription}
            onToggleExpanded={() => setExpanded((value) => !value)}
          />
          <WorkItemHoverCardProgress progress={model.progress} />
          <WorkItemHoverCardMeta data={data} item={item} model={model} />
        </HoverCardContent>
      </HoverCard>
    </>
  )
}

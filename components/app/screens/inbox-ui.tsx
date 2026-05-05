"use client"

import Link from "next/link"
import { isToday, isYesterday } from "date-fns"
import {
  Archive,
  ArrowCounterClockwise,
  Bell,
  CheckCircle,
  Circle,
  Trash,
} from "@phosphor-icons/react"

import {
  type Notification,
  type NotificationEntityType,
  type UserProfile,
} from "@/lib/domain/types"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { UserAvatar } from "@/components/app/user-presence"
import { cn } from "@/lib/utils"

import {
  ENTITY_LABEL,
  InboxArchiveButton,
  formatFullTimestamp,
  getShortRelativeTimestamp,
  renderEntityIcon,
} from "./inbox-display"
import { InboxRow } from "./inbox-row"

export type InboxTab = "inbox" | "archived"

export type InboxEntry = {
  notification: Notification
  actor: UserProfile | null
}

type BucketKey = "today" | "yesterday" | "earlier"

const BUCKET_ORDER: BucketKey[] = ["today", "yesterday", "earlier"]
const BUCKET_LABEL: Record<BucketKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
}

function bucketForDate(iso: string): BucketKey {
  const date = new Date(iso)
  if (isToday(date)) return "today"
  if (isYesterday(date)) return "yesterday"
  return "earlier"
}

function groupEntries(entries: InboxEntry[]) {
  const buckets = new Map<BucketKey, InboxEntry[]>()

  for (const entry of entries) {
    const key = bucketForDate(entry.notification.createdAt)
    const existing = buckets.get(key)
    if (existing) {
      existing.push(entry)
    } else {
      buckets.set(key, [entry])
    }
  }

  return BUCKET_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: BUCKET_LABEL[key],
    items: buckets.get(key) ?? [],
  }))
}

type GroupedInboxEntries = ReturnType<typeof groupEntries>[number]

function InboxEmptyList({ inboxTab }: { inboxTab: InboxTab }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
      <div className="grid size-10 place-items-center rounded-full bg-muted/60">
        <Bell className="size-4 text-muted-foreground" />
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          {inboxTab === "inbox" ? "Inbox zero" : "Nothing archived"}
        </p>
        <p className="text-xs text-muted-foreground">
          {inboxTab === "inbox"
            ? "New notifications will show up here."
            : "Archive notifications to clear them from your inbox."}
        </p>
      </div>
    </div>
  )
}

type InboxListTab = {
  value: InboxTab
  label: string
  count: number
}

function getInboxListTabs(input: {
  archivedCount: number
  unreadCount: number
}): InboxListTab[] {
  return [
    { value: "inbox", label: "Inbox", count: input.unreadCount },
    { value: "archived", label: "Archived", count: input.archivedCount },
  ]
}

function InboxTabButton({
  active,
  tab,
  onTabChange,
}: {
  active: boolean
  tab: InboxListTab
  onTabChange: (tab: InboxTab) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-[5px] px-2 py-1 text-[11.5px] transition-all",
        active
          ? "bg-background font-medium text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={() => onTabChange(tab.value)}
    >
      {tab.label}
      <InboxTabCount active={active} count={tab.count} />
    </button>
  )
}

function InboxTabCount({ active, count }: { active: boolean; count: number }) {
  if (count <= 0) {
    return null
  }

  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums",
        active
          ? "bg-muted text-foreground"
          : "bg-muted/80 text-muted-foreground"
      )}
    >
      {count}
    </span>
  )
}

function InboxListTabSwitch({
  inboxTab,
  tabs,
  onTabChange,
}: {
  inboxTab: InboxTab
  tabs: InboxListTab[]
  onTabChange: (tab: InboxTab) => void
}) {
  return (
    <div className="flex rounded-md bg-muted/60 p-0.5">
      {tabs.map((tab) => (
        <InboxTabButton
          key={tab.value}
          active={tab.value === inboxTab}
          tab={tab}
          onTabChange={onTabChange}
        />
      ))}
    </div>
  )
}

function InboxMoveAllButton({
  disabled,
  inboxTab,
  onMoveAll,
}: {
  disabled: boolean
  inboxTab: InboxTab
  onMoveAll: () => void
}) {
  const isInbox = inboxTab === "inbox"
  const label = isInbox ? "Archive all" : "Unarchive all"
  const MoveIcon = isInbox ? Archive : ArrowCounterClockwise

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-xs"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={onMoveAll}
          disabled={disabled}
          aria-label={label}
        >
          <MoveIcon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  )
}

function InboxMarkAllReadButton({
  disabled,
  inboxTab,
  onMarkAllRead,
}: {
  disabled: boolean
  inboxTab: InboxTab
  onMarkAllRead: () => void
}) {
  if (inboxTab !== "inbox") {
    return null
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-xs"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={onMarkAllRead}
          disabled={disabled}
          aria-label="Mark all as read"
        >
          <CheckCircle className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>Mark all read</TooltipContent>
    </Tooltip>
  )
}

function InboxListActions({
  entries,
  inboxTab,
  onMarkAllRead,
  onMoveAll,
}: {
  entries: InboxEntry[]
  inboxTab: InboxTab
  onMarkAllRead: () => void
  onMoveAll: () => void
}) {
  return (
    <div className="flex items-center gap-0.5">
      <InboxMarkAllReadButton
        disabled={!entries.some((entry) => entry.notification.readAt == null)}
        inboxTab={inboxTab}
        onMarkAllRead={onMarkAllRead}
      />
      <InboxMoveAllButton
        disabled={entries.length === 0}
        inboxTab={inboxTab}
        onMoveAll={onMoveAll}
      />
    </div>
  )
}

function InboxListHeader({
  entries,
  inboxTab,
  tabs,
  onMarkAllRead,
  onMoveAll,
  onTabChange,
}: {
  entries: InboxEntry[]
  inboxTab: InboxTab
  tabs: InboxListTab[]
  onMarkAllRead: () => void
  onMoveAll: () => void
  onTabChange: (tab: InboxTab) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b bg-background px-3 py-2">
      <InboxListTabSwitch
        inboxTab={inboxTab}
        tabs={tabs}
        onTabChange={onTabChange}
      />
      <InboxListActions
        entries={entries}
        inboxTab={inboxTab}
        onMarkAllRead={onMarkAllRead}
        onMoveAll={onMoveAll}
      />
    </div>
  )
}

function InboxListEntries({
  activeId,
  grouped,
  inboxTab,
  onSelectNotification,
  onToggleArchive,
}: {
  activeId: string | null
  grouped: GroupedInboxEntries[]
  inboxTab: InboxTab
  onSelectNotification: (notificationId: string) => void
  onToggleArchive: (notification: Notification) => void
}) {
  if (grouped.length === 0) {
    return <InboxEmptyList inboxTab={inboxTab} />
  }

  return (
    <div className="isolate flex flex-col">
      {grouped.map((bucket) => (
        <section key={bucket.key} className="flex flex-col">
          <div className="sticky top-0 z-10 flex items-center border-b border-line-soft bg-background/95 px-4 py-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase backdrop-blur">
            {bucket.label}
            <span className="ml-2 text-muted-foreground/60">
              {bucket.items.length}
            </span>
          </div>
          {bucket.items.map((entry) => (
            <InboxRow
              key={entry.notification.id}
              entry={entry}
              active={entry.notification.id === activeId}
              onSelect={() => onSelectNotification(entry.notification.id)}
              onToggleArchive={() => onToggleArchive(entry.notification)}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function InboxResizeHandle({
  resizing,
  onResizeStart,
  onResetWidth,
}: {
  resizing: boolean
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void
  onResetWidth: () => void
}) {
  return (
    <button
      type="button"
      aria-label="Resize inbox list"
      className={cn(
        "group absolute top-0 -right-2 z-10 hidden h-full w-4 cursor-col-resize touch-none select-none md:block",
        resizing && "bg-primary/6"
      )}
      onPointerDown={onResizeStart}
      onDoubleClick={onResetWidth}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-2 left-1/2 w-2 -translate-x-1/2 rounded-full bg-transparent transition-colors",
          resizing ? "bg-primary/10" : "group-hover:bg-accent"
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 rounded-full bg-border/80 transition-all",
          resizing
            ? "w-0.5 bg-primary/55"
            : "group-hover:w-0.5 group-hover:bg-primary/45"
        )}
      />
    </button>
  )
}

export function InboxListPane({
  width,
  resizing,
  inboxTab,
  activeId,
  entries,
  unreadCount,
  archivedCount,
  onTabChange,
  onMarkAllRead,
  onMoveAll,
  onSelectNotification,
  onToggleArchive,
  onResizeStart,
  onResetWidth,
}: {
  width: number
  resizing: boolean
  inboxTab: InboxTab
  activeId: string | null
  entries: InboxEntry[]
  unreadCount: number
  archivedCount: number
  onTabChange: (tab: InboxTab) => void
  onMarkAllRead: () => void
  onMoveAll: () => void
  onSelectNotification: (notificationId: string) => void
  onToggleArchive: (notification: Notification) => void
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void
  onResetWidth: () => void
}) {
  const grouped = groupEntries(entries)
  const tabs = getInboxListTabs({ archivedCount, unreadCount })

  return (
    <div
      className="relative flex min-h-0 shrink-0 flex-col border-r"
      style={{
        width: `${width}px`,
        flexBasis: `${width}px`,
      }}
    >
      <InboxListHeader
        entries={entries}
        inboxTab={inboxTab}
        tabs={tabs}
        onMarkAllRead={onMarkAllRead}
        onMoveAll={onMoveAll}
        onTabChange={onTabChange}
      />
      <ScrollArea className="min-h-0 flex-1">
        <InboxListEntries
          activeId={activeId}
          grouped={grouped}
          inboxTab={inboxTab}
          onSelectNotification={onSelectNotification}
          onToggleArchive={onToggleArchive}
        />
      </ScrollArea>
      <InboxResizeHandle
        resizing={resizing}
        onResizeStart={onResizeStart}
        onResetWidth={onResetWidth}
      />
    </div>
  )
}

type PrimaryActionDescriptor =
  | { kind: "link"; label: string; href: string }
  | { kind: "button"; label: string; loading: boolean; onClick: () => void }

type PrimaryActionInput = {
  notification: Notification
  activeProjectHref: string | null
  activeChannelPostHref: string | null
  activeChatHref: string | null
  hasPendingActiveInvite: boolean
  acceptingInvite: boolean
  onAcceptInvite: () => void
}

const PRIMARY_ACTION_BUILDERS: Partial<
  Record<
    NotificationEntityType,
    (input: PrimaryActionInput) => PrimaryActionDescriptor | null
  >
> = {
  workItem: ({ notification }) => ({
    kind: "link",
    label: "Open work item",
    href: `/items/${notification.entityId}`,
  }),
  document: ({ notification }) => ({
    kind: "link",
    label: "Open document",
    href: `/docs/${notification.entityId}`,
  }),
  project: ({ activeProjectHref }) =>
    activeProjectHref
      ? { kind: "link", label: "Open project", href: activeProjectHref }
      : null,
  channelPost: ({ activeChannelPostHref }) =>
    activeChannelPostHref
      ? {
          kind: "link",
          label: "Open channel post",
          href: activeChannelPostHref,
        }
      : null,
  chat: ({ activeChatHref }) =>
    activeChatHref
      ? { kind: "link", label: "Open chat", href: activeChatHref }
      : null,
  invite: ({ acceptingInvite, hasPendingActiveInvite, onAcceptInvite }) =>
    hasPendingActiveInvite
      ? {
          kind: "button",
          label: acceptingInvite ? "Accepting…" : "Accept invite",
          loading: acceptingInvite,
          onClick: onAcceptInvite,
        }
      : null,
}

function getPrimaryActionDescriptor(input: PrimaryActionInput) {
  return PRIMARY_ACTION_BUILDERS[input.notification.entityType]?.(input) ?? null
}

function InboxDetailEmptyState({
  visibleNotificationCount,
}: {
  visibleNotificationCount: number
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center px-6">
      {visibleNotificationCount === 0 ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted/60">
            <Bell className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">All caught up</p>
            <p className="text-sm text-muted-foreground">
              No new notifications.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Select a notification to view details.
        </p>
      )}
    </div>
  )
}

function InboxDetailToolbar({
  notification,
  onDelete,
  onToggleArchive,
  onToggleRead,
}: {
  notification: Notification
  onDelete: () => void
  onToggleArchive: (notification: Notification) => void
  onToggleRead: (notification: Notification) => void
}) {
  const unread = !notification.readAt
  const relativeCreatedAt = getShortRelativeTimestamp(notification.createdAt)

  return (
    <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-6 py-2 backdrop-blur">
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        {renderEntityIcon(
          notification.entityType,
          "size-3.5 text-muted-foreground"
        )}
        <span className="truncate font-medium text-foreground/80">
          {ENTITY_LABEL[notification.entityType]}
        </span>
        <span className="text-muted-foreground/60">·</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate tabular-nums">
              {relativeCreatedAt.usesAgoSuffix
                ? `${relativeCreatedAt.label} ago`
                : relativeCreatedAt.label}
            </span>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>
            {formatFullTimestamp(notification.createdAt)}
          </TooltipContent>
        </Tooltip>
        {unread ? (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            Unread
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onToggleRead(notification)}
              aria-label={unread ? "Mark as read" : "Mark as unread"}
            >
              {unread ? (
                <CheckCircle className="size-3.5" />
              ) : (
                <Circle className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>
            {unread ? "Mark as read" : "Mark as unread"}
          </TooltipContent>
        </Tooltip>
        <InboxArchiveButton
          notification={notification}
          onArchive={() => onToggleArchive(notification)}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={onDelete}
              aria-label="Delete notification"
            >
              <Trash className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function InboxPrimaryAction({
  action,
}: {
  action: PrimaryActionDescriptor | null
}) {
  if (!action) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {action.kind === "link" ? (
        <Button size="sm" asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : (
        <Button size="sm" disabled={action.loading} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

function InboxDetailBody({
  actor,
  actorName,
  notification,
  primaryAction,
}: {
  actor: UserProfile | null
  actorName: string
  notification: Notification
  primaryAction: PrimaryActionDescriptor | null
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <UserAvatar
          name={actorName}
          avatarUrl={actor?.avatarUrl ?? null}
          avatarImageUrl={actor?.avatarImageUrl ?? null}
          size="default"
          showStatus={false}
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {actorName}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatFullTimestamp(notification.createdAt)}
          </div>
        </div>
      </div>
      <p className="text-[15px] leading-relaxed text-foreground">
        {notification.message}
      </p>
      <InboxPrimaryAction action={primaryAction} />
    </div>
  )
}

export function InboxDetailPane({
  activeEntry,
  visibleNotificationCount,
  activeProjectHref,
  activeChannelPostHref,
  activeChatHref,
  hasPendingActiveInvite,
  acceptingInvite,
  onAcceptInvite,
  onToggleArchive,
  onToggleRead,
  onDelete,
}: {
  activeEntry: InboxEntry | null
  visibleNotificationCount: number
  activeProjectHref: string | null
  activeChannelPostHref: string | null
  activeChatHref: string | null
  hasPendingActiveInvite: boolean
  acceptingInvite: boolean
  onAcceptInvite: () => void
  onToggleArchive: (notification: Notification) => void
  onToggleRead: (notification: Notification) => void
  onDelete: () => void
}) {
  if (!activeEntry) {
    return (
      <InboxDetailEmptyState
        visibleNotificationCount={visibleNotificationCount}
      />
    )
  }

  const { notification, actor } = activeEntry
  const actorName = actor?.name ?? "Someone"
  const primaryAction = getPrimaryActionDescriptor({
    notification,
    activeProjectHref,
    activeChannelPostHref,
    activeChatHref,
    hasPendingActiveInvite,
    acceptingInvite,
    onAcceptInvite,
  })

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
      <InboxDetailToolbar
        notification={notification}
        onDelete={onDelete}
        onToggleArchive={onToggleArchive}
        onToggleRead={onToggleRead}
      />
      <InboxDetailBody
        actor={actor}
        actorName={actorName}
        notification={notification}
        primaryAction={primaryAction}
      />
    </div>
  )
}

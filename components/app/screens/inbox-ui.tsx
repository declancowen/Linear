"use client"

import Link from "next/link"
import { format, isToday, isYesterday } from "date-fns"
import {
  Archive,
  ArrowCounterClockwise,
  Bell,
  Buildings,
  ChatCircle,
  CheckCircle,
  Circle,
  EnvelopeSimple,
  FileText,
  Hash,
  Kanban,
  Target,
  Trash,
  UsersThree,
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

export type InboxTab = "inbox" | "archived"

export type InboxEntry = {
  notification: Notification
  actor: UserProfile | null
}

const ENTITY_LABEL: Record<NotificationEntityType, string> = {
  workItem: "Work item",
  document: "Document",
  project: "Project",
  invite: "Invite",
  channelPost: "Channel post",
  chat: "Chat",
  team: "Team",
  workspace: "Workspace",
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function buildInboxNotificationSubtitle(
  notification: Pick<Notification, "message">,
  actorName?: string | null
) {
  const message = notification.message.trim()

  if (!message) {
    return ""
  }

  const normalizedActorName = actorName?.trim()
  let subtitle = message

  if (normalizedActorName) {
    subtitle = subtitle.replace(
      new RegExp(`^${escapeRegExp(normalizedActorName)}(?:\\s+|$)`, "i"),
      ""
    )
  }

  subtitle = subtitle
    .replace(/^mentioned you (\d+ times? in\b)/i, "mentioned $1")
    .replace(/^mentioned you in\b/i, "mentioned in")
    .replace(/^assigned you\b/i, "assigned")
    .trim()

  if (!subtitle) {
    return message
  }

  return `${subtitle.charAt(0).toUpperCase()}${subtitle.slice(1)}`
}

function renderEntityIcon(
  entityType: NotificationEntityType,
  className?: string
) {
  switch (entityType) {
    case "workItem":
      return <Target className={className} />
    case "document":
      return <FileText className={className} />
    case "channelPost":
      return <Hash className={className} />
    case "chat":
      return <ChatCircle className={className} />
    case "invite":
      return <EnvelopeSimple className={className} />
    case "project":
      return <Kanban className={className} />
    case "team":
      return <UsersThree className={className} />
    case "workspace":
      return <Buildings className={className} />
    default:
      return <Circle className={className} />
  }
}

type BucketKey = "today" | "yesterday" | "earlier"

type ShortRelativeTimestamp = {
  label: string
  usesAgoSuffix: boolean
}

function getShortRelativeTimestamp(iso: string): ShortRelativeTimestamp {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, now - then)
  const seconds = Math.floor(diff / 1000)

  if (seconds < 45) {
    return {
      label: "now",
      usesAgoSuffix: false,
    }
  }

  const minutes = Math.max(1, Math.floor(diff / (60 * 1000)))
  if (minutes < 60) {
    return {
      label: `${minutes}m`,
      usesAgoSuffix: true,
    }
  }

  const hours = Math.max(1, Math.floor(diff / (60 * 60 * 1000)))
  if (hours < 24) {
    return {
      label: `${hours}h`,
      usesAgoSuffix: true,
    }
  }

  const days = Math.max(1, Math.floor(diff / (24 * 60 * 60 * 1000)))
  if (days < 7) {
    return {
      label: `${days}d`,
      usesAgoSuffix: true,
    }
  }

  return {
    label: format(new Date(iso), "MMM d"),
    usesAgoSuffix: false,
  }
}

function formatFullTimestamp(iso: string) {
  return format(new Date(iso), "MMM d, yyyy 'at' h:mm a")
}

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

function EntityPip({ entityType }: { entityType: NotificationEntityType }) {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-0.5 -bottom-0.5 inline-grid size-3.5 place-items-center rounded-full bg-background ring-1 ring-border"
    >
      {renderEntityIcon(entityType, "size-2.5 text-muted-foreground")}
    </span>
  )
}

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

function InboxRow({
  entry,
  active,
  onSelect,
  onToggleArchive,
}: {
  entry: InboxEntry
  active: boolean
  onSelect: () => void
  onToggleArchive: () => void
}) {
  const { notification, actor } = entry
  const unread = !notification.readAt
  const actorName = actor?.name ?? "Someone"
  const subtitle = buildInboxNotificationSubtitle(notification, actorName)
  const relativeCreatedAt = getShortRelativeTimestamp(notification.createdAt)

  return (
    <div
      className={cn(
        "group/row relative flex items-center border-b border-line-soft transition-colors",
        active ? "bg-accent" : "hover:bg-accent/40"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-1.5 left-0 w-0.5 rounded-r-full transition-opacity",
          unread ? "bg-primary opacity-100" : "opacity-0"
        )}
      />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-3 py-2.5 pr-2 pl-4 text-left"
        onClick={onSelect}
      >
        <div className="relative mt-0.5 shrink-0">
          <UserAvatar
            name={actorName}
            avatarUrl={actor?.avatarUrl ?? null}
            avatarImageUrl={actor?.avatarImageUrl ?? null}
            size="sm"
            showStatus={false}
          />
          <EntityPip entityType={notification.entityType} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span
              className={cn(
                "truncate text-[12.5px] leading-5 text-foreground",
                unread && "font-semibold"
              )}
            >
              {actorName}
            </span>
            <span className="shrink-0 text-[10.5px] text-muted-foreground/70">
              ·
            </span>
            <span className="truncate text-[11.5px] text-muted-foreground">
              {ENTITY_LABEL[notification.entityType]}
            </span>
          </div>
          <span
            className={cn(
              "truncate text-[12px] leading-5",
              unread ? "text-foreground/85" : "text-muted-foreground"
            )}
          >
            {subtitle}
          </span>
        </div>
      </button>
      <div className="relative flex shrink-0 items-center pr-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="pr-1 text-[11px] text-muted-foreground tabular-nums transition-opacity group-focus-within/row:opacity-0 group-hover/row:opacity-0">
              {relativeCreatedAt.label}
            </span>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>
            {formatFullTimestamp(notification.createdAt)}
          </TooltipContent>
        </Tooltip>
        <div className="absolute inset-y-0 right-2 flex items-center opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleArchive()
                }}
                aria-label={
                  notification.archivedAt
                    ? "Unarchive notification"
                    : "Archive notification"
                }
              >
                {notification.archivedAt ? (
                  <ArrowCounterClockwise className="size-3.5" />
                ) : (
                  <Archive className="size-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              {notification.archivedAt ? "Unarchive" : "Archive"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
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
  const tabs: Array<{
    value: InboxTab
    label: string
    count: number
  }> = [
    { value: "inbox", label: "Inbox", count: unreadCount },
    { value: "archived", label: "Archived", count: archivedCount },
  ]

  return (
    <div
      className="relative flex min-h-0 shrink-0 flex-col border-r"
      style={{
        width: `${width}px`,
        flexBasis: `${width}px`,
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b bg-background px-3 py-2">
        <div className="flex rounded-md bg-muted/60 p-0.5">
          {tabs.map((tab) => {
            const isActive = tab.value === inboxTab
            const showCount = tab.count > 0

            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={isActive}
                className={cn(
                  "flex items-center gap-1.5 rounded-[5px] px-2 py-1 text-[11.5px] transition-all",
                  isActive
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => onTabChange(tab.value)}
              >
                {tab.label}
                {showCount ? (
                  <span
                    className={cn(
                      "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums",
                      isActive
                        ? "bg-muted text-foreground"
                        : "bg-muted/80 text-muted-foreground"
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-0.5">
          {inboxTab === "inbox" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={onMarkAllRead}
                  disabled={
                    !entries.some((entry) => entry.notification.readAt == null)
                  }
                  aria-label="Mark all as read"
                >
                  <CheckCircle className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Mark all read</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={onMoveAll}
                disabled={entries.length === 0}
                aria-label={
                  inboxTab === "inbox" ? "Archive all" : "Unarchive all"
                }
              >
                {inboxTab === "inbox" ? (
                  <Archive className="size-3.5" />
                ) : (
                  <ArrowCounterClockwise className="size-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              {inboxTab === "inbox" ? "Archive all" : "Unarchive all"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {grouped.length === 0 ? (
          <InboxEmptyList inboxTab={inboxTab} />
        ) : (
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
        )}
      </ScrollArea>
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
    </div>
  )
}

function getPrimaryActionDescriptor({
  notification,
  activeProjectHref,
  activeChannelPostHref,
  activeChatHref,
  hasPendingActiveInvite,
  acceptingInvite,
  onAcceptInvite,
}: {
  notification: Notification
  activeProjectHref: string | null
  activeChannelPostHref: string | null
  activeChatHref: string | null
  hasPendingActiveInvite: boolean
  acceptingInvite: boolean
  onAcceptInvite: () => void
}):
  | { kind: "link"; label: string; href: string }
  | { kind: "button"; label: string; loading: boolean; onClick: () => void }
  | null {
  switch (notification.entityType) {
    case "workItem":
      return {
        kind: "link",
        label: "Open work item",
        href: `/items/${notification.entityId}`,
      }
    case "document":
      return {
        kind: "link",
        label: "Open document",
        href: `/docs/${notification.entityId}`,
      }
    case "project":
      return activeProjectHref
        ? { kind: "link", label: "Open project", href: activeProjectHref }
        : null
    case "channelPost":
      return activeChannelPostHref
        ? {
            kind: "link",
            label: "Open channel post",
            href: activeChannelPostHref,
          }
        : null
    case "chat":
      return activeChatHref
        ? { kind: "link", label: "Open chat", href: activeChatHref }
        : null
    case "invite":
      return hasPendingActiveInvite
        ? {
            kind: "button",
            label: acceptingInvite ? "Accepting…" : "Accept invite",
            loading: acceptingInvite,
            onClick: onAcceptInvite,
          }
        : null
    default:
      return null
  }
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
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center px-6">
        {visibleNotificationCount === 0 ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-muted/60">
              <Bell className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                All caught up
              </p>
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

  const { notification, actor } = activeEntry
  const unread = !notification.readAt
  const actorName = actor?.name ?? "Someone"
  const relativeCreatedAt = getShortRelativeTimestamp(notification.createdAt)
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onToggleArchive(notification)}
                aria-label={
                  notification.archivedAt
                    ? "Unarchive notification"
                    : "Archive notification"
                }
              >
                {notification.archivedAt ? (
                  <ArrowCounterClockwise className="size-3.5" />
                ) : (
                  <Archive className="size-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              {notification.archivedAt ? "Unarchive" : "Archive"}
            </TooltipContent>
          </Tooltip>
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
        {primaryAction ? (
          <div className="flex items-center gap-2">
            {primaryAction.kind === "link" ? (
              <Button size="sm" asChild>
                <Link href={primaryAction.href}>{primaryAction.label}</Link>
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={primaryAction.loading}
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

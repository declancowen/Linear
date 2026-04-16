"use client"

import Link from "next/link"
import { format } from "date-fns"
import {
  Archive,
  Bell,
  ChatCircle,
  Circle,
  EnvelopeSimple,
  FileText,
  Hash,
  Kanban,
  Target,
  Trash,
  ArrowCounterClockwise,
} from "@phosphor-icons/react"

import {
  type Notification,
  type NotificationEntityType,
} from "@/lib/domain/types"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export type InboxTab = "inbox" | "archived"

function getNotificationEntityIcon(
  entityType: NotificationEntityType
) {
  switch (entityType) {
    case "workItem":
      return Target
    case "document":
      return FileText
    case "channelPost":
      return Hash
    case "chat":
      return ChatCircle
    case "invite":
      return EnvelopeSimple
    case "project":
      return Kanban
    default:
      return Circle
  }
}

export function InboxListPane({
  width,
  resizing,
  inboxTab,
  activeId,
  visibleNotifications,
  onTabChange,
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
  visibleNotifications: Notification[]
  onTabChange: (tab: InboxTab) => void
  onMoveAll: () => void
  onSelectNotification: (notificationId: string) => void
  onToggleArchive: (notification: Notification) => void
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void
  onResetWidth: () => void
}) {
  return (
    <div
      className="relative flex min-h-0 shrink-0 flex-col border-r"
      style={{
        width: `${width}px`,
        flexBasis: `${width}px`,
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b bg-background px-4 py-2">
        <div className="flex items-center gap-1">
          {(["inbox", "archived"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={cn(
                "h-6 rounded-sm px-2 text-xs transition-colors",
                tab === inboxTab
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onTabChange(tab)}
            >
              {tab === "inbox" ? "Inbox" : "Archived"}
            </button>
          ))}
        </div>
        <Button
          size="xs"
          variant="ghost"
          className="h-6 px-2 text-muted-foreground hover:text-foreground"
          onClick={onMoveAll}
          disabled={visibleNotifications.length === 0}
        >
          {inboxTab === "inbox" ? "Archive all" : "Unarchive all"}
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col">
          {visibleNotifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                "flex items-start border-b transition-colors",
                notification.id === activeId ? "bg-accent" : "hover:bg-accent/50"
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left"
                onClick={() => onSelectNotification(notification.id)}
              >
                <div className="mt-0.5 shrink-0">
                  {(() => {
                    const NotificationIcon = getNotificationEntityIcon(
                      notification.entityType
                    )

                    return (
                      <NotificationIcon className="size-4 text-muted-foreground" />
                    )
                  })()}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cn(
                      "truncate text-[13px] leading-5 text-foreground",
                      !notification.readAt && "font-medium"
                    )}
                  >
                    {notification.message}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {format(new Date(notification.createdAt), "MMM d, h:mm a")}
                  </span>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-1 px-2 py-3">
                {notification.readAt ? null : (
                  <div className="size-2 rounded-full bg-primary" />
                )}
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="size-7 rounded-md text-muted-foreground/40 transition-colors hover:bg-background hover:text-muted-foreground"
                  onClick={() => onToggleArchive(notification)}
                  aria-label={
                    notification.archivedAt
                      ? "Unarchive notification"
                      : "Archive notification"
                  }
                >
                  {notification.archivedAt ? (
                    <ArrowCounterClockwise className="size-4" />
                  ) : (
                    <Archive className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
          {visibleNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground">
              {inboxTab === "inbox"
                ? "No inbox notifications"
                : "No archived notifications"}
            </div>
          ) : null}
        </div>
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

export function InboxDetailPane({
  activeNotification,
  visibleNotificationCount,
  shouldShowPrimaryAction,
  activeProjectHref,
  activeChannelPostHref,
  activeChatHref,
  hasPendingActiveInvite,
  acceptingInvite,
  onAcceptInvite,
  onToggleArchive,
  onDelete,
}: {
  activeNotification: Notification | null
  visibleNotificationCount: number
  shouldShowPrimaryAction: boolean
  activeProjectHref: string | null
  activeChannelPostHref: string | null
  activeChatHref: string | null
  hasPendingActiveInvite: boolean
  acceptingInvite: boolean
  onAcceptInvite: () => void
  onToggleArchive: (notification: Notification) => void
  onDelete: () => void
}) {
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      {activeNotification ? (
        <div className="p-6">
          <p className="max-w-2xl text-sm leading-relaxed">
            {activeNotification.message}
          </p>
          {shouldShowPrimaryAction ? (
            <div className="mt-4">
              {activeNotification.entityType === "workItem" ? (
                <Button size="sm" asChild>
                  <Link href={`/items/${activeNotification.entityId}`}>
                    Open work item
                  </Link>
                </Button>
              ) : null}
              {activeNotification.entityType === "document" ? (
                <Button size="sm" asChild>
                  <Link href={`/docs/${activeNotification.entityId}`}>
                    Open document
                  </Link>
                </Button>
              ) : null}
              {activeNotification.entityType === "project" &&
              activeProjectHref ? (
                <Button size="sm" asChild>
                  <Link href={activeProjectHref}>Open project</Link>
                </Button>
              ) : null}
              {activeNotification.entityType === "channelPost" &&
              activeChannelPostHref ? (
                <Button size="sm" asChild>
                  <Link href={activeChannelPostHref}>Open channel post</Link>
                </Button>
              ) : null}
              {activeNotification.entityType === "chat" && activeChatHref ? (
                <Button size="sm" asChild>
                  <Link href={activeChatHref}>Open chat</Link>
                </Button>
              ) : null}
              {hasPendingActiveInvite ? (
                <Button
                  size="sm"
                  disabled={acceptingInvite}
                  onClick={onAcceptInvite}
                >
                  {acceptingInvite ? "..." : "Accept invite"}
                </Button>
              ) : null}
            </div>
          ) : null}
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground",
              shouldShowPrimaryAction ? "mt-6" : "mt-4"
            )}
          >
            <span>
              Received{" "}
              {format(new Date(activeNotification.createdAt), "MMM d, h:mm a")}{" "}
              · {activeNotification.readAt ? "Read" : "Unread"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onToggleArchive(activeNotification)}
                aria-label={
                  activeNotification.archivedAt
                    ? "Unarchive notification"
                    : "Archive notification"
                }
              >
                {activeNotification.archivedAt ? (
                  <ArrowCounterClockwise className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )}
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={onDelete}
                aria-label="Delete notification"
              >
                <Trash className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center px-6">
          {visibleNotificationCount === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <Bell className="size-5 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  All caught up
                </p>
                <p className="text-sm text-muted-foreground">
                  No new notifications
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a notification to view details.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

import {
  ENTITY_LABEL,
  InboxArchiveButton,
  InboxRowAvatar,
  buildInboxNotificationSubtitle,
  formatFullTimestamp,
  getShortRelativeTimestamp,
} from "./inbox-display"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Notification } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

import type { InboxEntry } from "./inbox-ui"

export function InboxRow({
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
        "group/row relative flex w-full min-w-0 items-center border-b border-line-soft transition-colors",
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
        className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 py-2.5 pr-9 pl-4 text-left"
        onClick={onSelect}
      >
        <InboxRowAvatar
          actor={actor}
          actorName={actorName}
          notification={notification}
        />
        <InboxRowContent
          actorName={actorName}
          notification={notification}
          relativeCreatedAt={relativeCreatedAt}
          subtitle={subtitle}
          unread={unread}
        />
      </button>
      <InboxRowTimestampActions
        notification={notification}
        onToggleArchive={onToggleArchive}
      />
    </div>
  )
}

function InboxRowContent({
  actorName,
  notification,
  relativeCreatedAt,
  subtitle,
  unread,
}: {
  actorName: string
  notification: Notification
  relativeCreatedAt: ReturnType<typeof getShortRelativeTimestamp>
  subtitle: string
  unread: boolean
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5 overflow-hidden">
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
        <Tooltip>
          <TooltipTrigger asChild>
            <time
              className="max-w-16 shrink-0 overflow-hidden text-right text-[11px] text-ellipsis whitespace-nowrap text-muted-foreground tabular-nums"
              dateTime={notification.createdAt}
            >
              {relativeCreatedAt.label}
            </time>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>
            {formatFullTimestamp(notification.createdAt)}
          </TooltipContent>
        </Tooltip>
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
  )
}

function InboxRowTimestampActions({
  notification,
  onToggleArchive,
}: {
  notification: Notification
  onToggleArchive: () => void
}) {
  return (
    <div className="absolute inset-y-0 right-2 flex items-center opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100">
      <InboxArchiveButton
        notification={notification}
        onArchive={(event) => {
          event.stopPropagation()
          onToggleArchive()
        }}
      />
    </div>
  )
}

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
        <InboxRowAvatar
          actor={actor}
          actorName={actorName}
          notification={notification}
        />
        <InboxRowContent
          actorName={actorName}
          notification={notification}
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
  subtitle,
  unread,
}: {
  actorName: string
  notification: Notification
  subtitle: string
  unread: boolean
}) {
  return (
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
  )
}

function InboxRowTimestampActions({
  notification,
  onToggleArchive,
}: {
  notification: Notification
  onToggleArchive: () => void
}) {
  const relativeCreatedAt = getShortRelativeTimestamp(notification.createdAt)

  return (
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
        <InboxArchiveButton
          notification={notification}
          onArchive={(event) => {
            event.stopPropagation()
            onToggleArchive()
          }}
        />
      </div>
    </div>
  )
}

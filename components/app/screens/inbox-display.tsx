import type { MouseEvent, ComponentType } from "react"
import { format } from "date-fns"
import {
  Archive,
  ArrowCounterClockwise,
  Buildings,
  ChatCircle,
  Circle,
  EnvelopeSimple,
  FileText,
  Hash,
  Kanban,
  Target,
  UsersThree,
} from "@phosphor-icons/react"

import { UserAvatar } from "@/components/app/user-presence"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  Notification,
  NotificationEntityType,
  UserProfile,
} from "@/lib/domain/types"

export const ENTITY_LABEL: Record<NotificationEntityType, string> = {
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

export function renderEntityIcon(
  entityType: NotificationEntityType,
  className?: string
) {
  const EntityIcon = ENTITY_ICON_BY_TYPE[entityType] ?? Circle

  return <EntityIcon className={className} />
}

const ENTITY_ICON_BY_TYPE: Partial<
  Record<NotificationEntityType, ComponentType<{ className?: string }>>
> = {
  channelPost: Hash,
  chat: ChatCircle,
  document: FileText,
  invite: EnvelopeSimple,
  project: Kanban,
  team: UsersThree,
  workItem: Target,
  workspace: Buildings,
}

export type ShortRelativeTimestamp = {
  label: string
  usesAgoSuffix: boolean
}

export function getShortRelativeTimestamp(iso: string): ShortRelativeTimestamp {
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

export function formatFullTimestamp(iso: string) {
  return format(new Date(iso), "MMM d, yyyy 'at' h:mm a")
}

function EntityPip({
  entityType,
}: {
  entityType: NotificationEntityType
}) {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-0.5 -bottom-0.5 inline-grid size-3.5 place-items-center rounded-full bg-background ring-1 ring-border"
    >
      {renderEntityIcon(entityType, "size-2.5 text-muted-foreground")}
    </span>
  )
}

export function InboxArchiveButton({
  notification,
  onArchive,
}: {
  notification: Notification
  onArchive: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  const label = notification.archivedAt
    ? "Unarchive notification"
    : "Archive notification"
  const tooltip = notification.archivedAt ? "Unarchive" : "Archive"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-xs"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={onArchive}
          aria-label={label}
        >
          {notification.archivedAt ? (
            <ArrowCounterClockwise className="size-3.5" />
          ) : (
            <Archive className="size-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function InboxRowAvatar({
  actor,
  actorName,
  notification,
}: {
  actor: UserProfile | null
  actorName: string
  notification: Notification
}) {
  return (
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
  )
}

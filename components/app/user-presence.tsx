"use client"

import type { ReactElement } from "react"
import { useRouter } from "next/navigation"
import {
  ChatCircle,
  CopySimple,
  EnvelopeSimple,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  type UserStatus,
  resolveUserStatus,
  userStatusMeta,
} from "@/lib/domain/types"
import {
  buildWorkspaceUserPresenceView,
  type WorkspaceUserMembershipState,
  type WorkspaceUserPresenceData,
} from "@/lib/domain/workspace-user-presence"
import { hasWorkspaceAccess } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { cn, resolveImageAssetSource } from "@/lib/utils"
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

type UserPresenceData = WorkspaceUserPresenceData & {
  handle?: string | null
}

function getUserInitials(name: string | null | undefined) {
  const parts = (name ?? "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
}

export function UserStatusDot({
  status,
  className,
}: {
  status: UserStatus | null | undefined
  className?: string
}) {
  const resolvedStatus = resolveUserStatus(status)

  if (resolvedStatus === "offline") {
    return (
      <span
        className={cn(
          "inline-flex size-2 items-center justify-center rounded-full bg-zinc-400 text-background",
          className
        )}
      >
        <X weight="bold" className="size-[75%]" />
      </span>
    )
  }

  const backgroundColor =
    resolvedStatus === "active"
      ? "#10b981"
      : resolvedStatus === "away"
        ? "#fbbf24"
        : resolvedStatus === "busy"
          ? "#f43f5e"
          : "#a855f7"

  return (
    <span
      className={cn("inline-flex size-2 rounded-full", className)}
      style={{ backgroundColor }}
    />
  )
}

export function UserAvatar({
  name,
  avatarUrl,
  avatarImageUrl,
  status,
  size = "sm",
  showStatus = true,
  className,
  badgeClassName,
}: UserPresenceData & {
  size?: "xs" | "sm" | "default" | "lg"
  showStatus?: boolean
  className?: string
  badgeClassName?: string
}) {
  const imageSrc = resolveImageAssetSource(avatarImageUrl, avatarUrl)

  return (
    <Avatar
      size={size}
      className={cn(showStatus && "overflow-visible", className)}
    >
      {imageSrc ? <AvatarImage src={imageSrc} alt={name ?? "User"} /> : null}
      <AvatarFallback>{getUserInitials(name)}</AvatarFallback>
      {showStatus ? (
        <AvatarBadge
          className={cn("overflow-hidden bg-background", badgeClassName)}
        >
          <UserStatusDot status={status} className="size-full" />
        </AvatarBadge>
      ) : null}
    </Avatar>
  )
}

type UserHoverDisplayState = {
  canEmail: boolean
  canMessage: boolean
  displayUser: NonNullable<ReturnType<typeof buildWorkspaceUserPresenceView>>
  hasStatusMessage: boolean
  resolvedStatus: UserStatus
}

function getUserHoverDisplayState({
  user,
  userId,
  currentUserId,
  workspaceId,
  hasActiveWorkspaceAccess,
}: {
  user: UserPresenceData | null | undefined
  userId?: string | null
  currentUserId?: string | null
  workspaceId?: string | null
  hasActiveWorkspaceAccess: boolean
}): UserHoverDisplayState | null {
  if (!user?.name) {
    return null
  }

  const membershipState: WorkspaceUserMembershipState =
    !userId || !workspaceId
      ? "unknown"
      : hasActiveWorkspaceAccess
        ? "active"
        : "former"
  const displayUser = buildWorkspaceUserPresenceView(user, membershipState)

  if (!displayUser?.name) {
    return null
  }

  const resolvedStatus = resolveUserStatus(displayUser.status)
  const isSelf =
    userId != null && currentUserId != null && userId === currentUserId

  return {
    canEmail: Boolean(displayUser.email) && !isSelf,
    canMessage:
      userId != null &&
      currentUserId != null &&
      workspaceId != null &&
      userId !== currentUserId &&
      !displayUser.isDeletedAccount &&
      hasActiveWorkspaceAccess,
    displayUser,
    hasStatusMessage: displayUser.statusMessage.length > 0,
    resolvedStatus,
  }
}

function UserHoverPresenceDetails({
  displayUser,
  hasStatusMessage,
  resolvedStatus,
}: {
  displayUser: UserHoverDisplayState["displayUser"]
  hasStatusMessage: boolean
  resolvedStatus: UserStatus
}) {
  if (!displayUser.showPresenceDetails) {
    return null
  }

  if (!displayUser.hasExplicitStatus) {
    return (
      <>
        <div className="mt-2 text-xs text-muted-foreground/60">
          No status set
        </div>
        <div className="mt-3 text-xs text-muted-foreground/60">
          No status message
        </div>
      </>
    )
  }

  return (
    <>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserStatusDot status={resolvedStatus} />
        <span>{userStatusMeta[resolvedStatus].label}</span>
      </div>
      {hasStatusMessage ? (
        <div className="mt-3 border-l-2 border-foreground/15 pl-2.5 text-xs text-foreground">
          {displayUser.statusMessage}
        </div>
      ) : (
        <div className="mt-3 text-xs text-muted-foreground/60">
          No status message
        </div>
      )}
    </>
  )
}

function UserHoverActions({
  canEmail,
  canMessage,
  email,
  onMessage,
}: {
  canEmail: boolean
  canMessage: boolean
  email: string | null | undefined
  onMessage: () => void
}) {
  if (!canEmail && !canMessage) {
    return null
  }

  return (
    <div className="mt-4 flex gap-2">
      {canEmail ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className={cn(
            "min-w-0 border-border bg-muted text-foreground hover:bg-accent hover:text-foreground",
            canMessage ? "flex-1" : "w-full"
          )}
        >
          <a href={`mailto:${email}`}>
            <EnvelopeSimple className="size-3.5" />
            Email
          </a>
        </Button>
      ) : null}
      {canMessage ? (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "min-w-0 border-border bg-muted text-foreground hover:bg-accent hover:text-foreground",
            email ? "flex-1" : "w-full"
          )}
          onClick={onMessage}
        >
          <ChatCircle className="size-3.5" />
          Message
        </Button>
      ) : null}
    </div>
  )
}

function UserHoverCardPanel({
  state,
  onCopyEmail,
  onMessage,
}: {
  state: UserHoverDisplayState
  onCopyEmail: () => void
  onMessage: () => void
}) {
  const {
    canEmail,
    canMessage,
    displayUser,
    hasStatusMessage,
    resolvedStatus,
  } = state

  return (
    <div className="flex items-start gap-3">
      <UserAvatar
        name={displayUser.name}
        avatarImageUrl={displayUser.avatarImageUrl}
        avatarUrl={displayUser.avatarUrl}
        status={displayUser.status ?? undefined}
        size="default"
        showStatus={
          displayUser.hasExplicitStatus && !displayUser.isFormerMember
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-sm font-semibold">
            {displayUser.name}
          </div>
          {displayUser.badgeLabel ? (
            <Badge variant="outline">{displayUser.badgeLabel}</Badge>
          ) : null}
        </div>
        {displayUser.secondaryText && !displayUser.badgeLabel ? (
          <div className="truncate text-xs text-muted-foreground">
            {displayUser.secondaryText}
          </div>
        ) : null}
        {displayUser.email ? (
          <div className="mt-1 flex items-center gap-1.5">
            <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {displayUser.email}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0"
              onClick={onCopyEmail}
              aria-label="Copy email"
              title="Copy email"
            >
              <CopySimple className="size-3.5" />
            </Button>
          </div>
        ) : null}
        <UserHoverPresenceDetails
          displayUser={displayUser}
          hasStatusMessage={hasStatusMessage}
          resolvedStatus={resolvedStatus}
        />
        <UserHoverActions
          canEmail={canEmail}
          canMessage={canMessage}
          email={displayUser.email}
          onMessage={onMessage}
        />
      </div>
    </div>
  )
}

export function UserHoverCard({
  user,
  children,
  align = "start",
  side = "top",
  className,
  userId,
  currentUserId,
  workspaceId,
}: {
  user: UserPresenceData | null | undefined
  children: ReactElement
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
  className?: string
  userId?: string | null
  currentUserId?: string | null
  workspaceId?: string | null
}) {
  const router = useRouter()
  const hasActiveWorkspaceAccess = useAppStore((state) => {
    if (!userId || !workspaceId) {
      return false
    }

    return hasWorkspaceAccess(state, workspaceId, userId)
  })
  const displayState = getUserHoverDisplayState({
    user,
    userId,
    currentUserId,
    workspaceId,
    hasActiveWorkspaceAccess,
  })

  if (!displayState) {
    return <>{children}</>
  }

  const resolvedDisplayState = displayState

  async function handleCopyEmail() {
    if (!resolvedDisplayState.displayUser.email) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        resolvedDisplayState.displayUser.email
      )
      toast.success("Email copied")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to copy email"
      )
    }
  }

  function handleMessage() {
    if (!resolvedDisplayState.canMessage || !userId || !workspaceId) {
      return
    }

    const conversationId = useAppStore.getState().createWorkspaceChat({
      participantIds: [userId],
      workspaceId,
      title: "",
      description: "",
    })

    if (!conversationId) {
      return
    }

    router.push(`/chats?chatId=${conversationId}`)
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        align={align}
        side={side}
        className={cn("w-[22rem]", className)}
      >
        <UserHoverCardPanel
          state={resolvedDisplayState}
          onCopyEmail={() => void handleCopyEmail()}
          onMessage={handleMessage}
        />
      </HoverCardContent>
    </HoverCard>
  )
}

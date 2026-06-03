"use client"

import type { ReactElement } from "react"
import { useAppRouter } from "@/lib/browser/app-navigation"
import {
  CopySimple,
  EnvelopeSimple,
  Quotes,
  UserCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  type UserStatus,
  resolveUserStatus,
  userStatusMeta,
} from "@/lib/domain/types"
import { getDisplayInitials } from "@/lib/display-initials"
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
        aria-hidden="true"
        className={cn(
          "inline-flex size-2 rounded-full bg-zinc-300 ring-1 ring-zinc-500/35 dark:bg-zinc-500 dark:ring-zinc-300/35",
          className
        )}
      />
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
      <AvatarFallback>{getDisplayInitials(name ?? "", "?")}</AvatarFallback>
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
  canProfile: boolean
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
    canProfile:
      userId != null &&
      workspaceId != null &&
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
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <span
            aria-hidden="true"
            className="inline-flex size-3.5 shrink-0 items-center justify-center"
          >
            <span className="size-2 rounded-full bg-muted-foreground/40" />
          </span>
          <span className="min-w-0 flex-1 truncate">No status set</span>
        </div>
        <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground/60">
          <Quotes className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
          <span className="min-w-0 flex-1">No status message</span>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          aria-hidden="true"
          className="inline-flex size-3.5 shrink-0 items-center justify-center"
        >
          <UserStatusDot status={resolvedStatus} />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {userStatusMeta[resolvedStatus].label}
        </span>
      </div>
      {hasStatusMessage ? (
        <div className="mt-3 flex items-start gap-1.5 text-xs text-foreground">
          <Quotes className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 leading-relaxed italic">
            {displayUser.statusMessage}
          </span>
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground/60">
          <Quotes className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
          <span className="min-w-0 flex-1">No status message</span>
        </div>
      )}
    </>
  )
}

function UserHoverActions({
  canEmail,
  canProfile,
  email,
  onProfile,
}: {
  canEmail: boolean
  canProfile: boolean
  email: string | null | undefined
  onProfile: () => void
}) {
  if (!canEmail && !canProfile) {
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
            canProfile ? "flex-1" : "w-full"
          )}
        >
          <a href={`mailto:${email}`}>
            <EnvelopeSimple className="size-3.5" />
            Email
          </a>
        </Button>
      ) : null}
      {canProfile ? (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "min-w-0 border-border bg-muted text-foreground hover:bg-accent hover:text-foreground",
            email ? "flex-1" : "w-full"
          )}
          onClick={onProfile}
        >
          <UserCircle className="size-3.5" />
          Profile
        </Button>
      ) : null}
    </div>
  )
}

function UserHoverCardPanel({
  state,
  onCopyEmail,
  onProfile,
}: {
  state: UserHoverDisplayState
  onCopyEmail: () => void
  onProfile: () => void
}) {
  const {
    canEmail,
    canProfile,
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
          canProfile={canProfile}
          email={displayUser.email}
          onProfile={onProfile}
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
  portalContainer,
  userId,
  currentUserId,
  workspaceId,
  portalled = true,
}: {
  user: UserPresenceData | null | undefined
  children: ReactElement
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
  className?: string
  portalContainer?: HTMLElement | null
  userId?: string | null
  currentUserId?: string | null
  workspaceId?: string | null
  portalled?: boolean
}) {
  const router = useAppRouter()
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

  function handleProfile() {
    if (!resolvedDisplayState.canProfile || !userId || !workspaceId) {
      return
    }

    router.push(`/workspace/people/${userId}`)
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        align={align}
        side={side}
        portalContainer={portalContainer}
        portalled={portalled}
        className={cn("z-[80] w-[22rem]", className)}
      >
        <UserHoverCardPanel
          state={resolvedDisplayState}
          onCopyEmail={() => void handleCopyEmail()}
          onProfile={handleProfile}
        />
      </HoverCardContent>
    </HoverCard>
  )
}

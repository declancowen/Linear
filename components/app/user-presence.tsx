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

  if (!user?.name) {
    return <>{children}</>
  }

  const membershipState: WorkspaceUserMembershipState =
    !userId || !workspaceId
      ? "unknown"
      : hasActiveWorkspaceAccess
        ? "active"
        : "former"
  const displayUser = buildWorkspaceUserPresenceView(user, membershipState)

  if (!displayUser?.name) {
    return <>{children}</>
  }

  const resolvedDisplayUser = displayUser
  const resolvedStatus = resolveUserStatus(resolvedDisplayUser.status)
  const hasStatusMessage = resolvedDisplayUser.statusMessage.length > 0
  const isSelf =
    userId != null && currentUserId != null && userId === currentUserId
  const canMessage =
    userId != null &&
    currentUserId != null &&
    workspaceId != null &&
    userId !== currentUserId &&
    !resolvedDisplayUser.isDeletedAccount &&
    hasActiveWorkspaceAccess
  const canEmail = Boolean(resolvedDisplayUser.email) && !isSelf

  async function handleCopyEmail() {
    if (!resolvedDisplayUser.email) {
      return
    }

    try {
      await navigator.clipboard.writeText(resolvedDisplayUser.email)
      toast.success("Email copied")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to copy email"
      )
    }
  }

  function handleMessage() {
    if (!canMessage || !userId || !workspaceId) {
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
        <div className="flex items-start gap-3">
          <UserAvatar
            name={resolvedDisplayUser.name}
            avatarImageUrl={resolvedDisplayUser.avatarImageUrl}
            avatarUrl={resolvedDisplayUser.avatarUrl}
            status={resolvedDisplayUser.status ?? undefined}
            size="default"
            showStatus={
              !resolvedDisplayUser.isFormerMember &&
              resolvedDisplayUser.hasExplicitStatus
            }
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate text-sm font-semibold">
                {resolvedDisplayUser.name}
              </div>
              {resolvedDisplayUser.badgeLabel ? (
                <Badge variant="outline">
                  {resolvedDisplayUser.badgeLabel}
                </Badge>
              ) : null}
            </div>
            {resolvedDisplayUser.secondaryText &&
            !resolvedDisplayUser.badgeLabel ? (
              <div className="truncate text-xs text-muted-foreground">
                {resolvedDisplayUser.secondaryText}
              </div>
            ) : null}
            {resolvedDisplayUser.email ? (
              <div className="mt-1 flex items-center gap-1.5">
                <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {resolvedDisplayUser.email}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0"
                  onClick={handleCopyEmail}
                  aria-label="Copy email"
                  title="Copy email"
                >
                  <CopySimple className="size-3.5" />
                </Button>
              </div>
            ) : null}
            {resolvedDisplayUser.showPresenceDetails ? (
              resolvedDisplayUser.hasExplicitStatus ? (
                <>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserStatusDot status={resolvedStatus} />
                    <span>{userStatusMeta[resolvedStatus].label}</span>
                  </div>
                  {hasStatusMessage ? (
                    <div className="mt-3 border-l-2 border-foreground/15 pl-2.5 text-xs text-foreground">
                      {resolvedDisplayUser.statusMessage}
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-muted-foreground/60">
                      No status message
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mt-2 text-xs text-muted-foreground/60">
                    No status set
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground/60">
                    No status message
                  </div>
                </>
              )
            ) : null}
            {canEmail || canMessage ? (
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
                    <a href={`mailto:${resolvedDisplayUser.email}`}>
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
                      resolvedDisplayUser.email ? "flex-1" : "w-full"
                    )}
                    onClick={handleMessage}
                  >
                    <ChatCircle className="size-3.5" />
                    Message
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

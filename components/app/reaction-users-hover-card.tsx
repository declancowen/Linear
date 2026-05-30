"use client"

import type { ReactElement } from "react"

import type { UserProfile } from "@/lib/domain/types"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/app/user-presence"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

type ReactionUser = Pick<
  UserProfile,
  "id" | "name" | "avatarUrl" | "avatarImageUrl" | "status"
>

type ReactionParticipant = {
  id: string
  name: string
  avatarUrl?: string | null
  avatarImageUrl?: string | null
  status?: ReactionUser["status"]
}

function getReactionParticipants({
  userIds,
  usersById,
}: {
  userIds: string[]
  usersById: ReadonlyMap<string, ReactionUser>
}) {
  const seen = new Set<string>()
  const participants: ReactionParticipant[] = []

  for (const userId of userIds) {
    if (seen.has(userId)) {
      continue
    }

    seen.add(userId)
    const user = usersById.get(userId)

    participants.push(
      user
        ? {
            id: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            avatarImageUrl: user.avatarImageUrl,
            status: user.status,
          }
        : {
            id: userId,
            name: "Unknown user",
            avatarUrl: "",
            avatarImageUrl: null,
          }
    )
  }

  return participants
}

export function ReactionUsersHoverCard({
  align = "center",
  children,
  className,
  side = "top",
  userIds,
  usersById,
}: {
  align?: "start" | "center" | "end"
  children: ReactElement
  className?: string
  side?: "top" | "right" | "bottom" | "left"
  userIds: string[]
  usersById: ReadonlyMap<string, ReactionUser>
}) {
  const participants = getReactionParticipants({ userIds, usersById })

  if (participants.length === 0) {
    return children
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        align={align}
        side={side}
        sideOffset={6}
        className={cn(
          "max-h-64 w-48 gap-1 overflow-y-auto rounded-lg p-1.5",
          className
        )}
      >
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1"
          >
            <UserAvatar
              name={participant.name}
              avatarImageUrl={participant.avatarImageUrl}
              avatarUrl={participant.avatarUrl}
              status={participant.status}
              size="sm"
              showStatus={false}
              className="size-5"
            />
            <span className="min-w-0 truncate text-xs font-medium text-foreground">
              {participant.name}
            </span>
          </div>
        ))}
      </HoverCardContent>
    </HoverCard>
  )
}

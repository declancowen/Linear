"use client"

import { useDeferredValue, useMemo, useState, type ReactNode } from "react"
import { MagnifyingGlass, Trash } from "@phosphor-icons/react"

import type { Role, UserStatus } from "@/lib/domain/types"
import { UserAvatar } from "@/components/app/user-presence"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type MemberIdentity = {
  id: string
  name: string
  email: string
  title?: string | null
  avatarUrl?: string | null
  avatarImageUrl?: string | null
  status?: UserStatus | null
}

export const teamRoleOptions: Array<{
  value: Role
  label: string
}> = [
  {
    value: "admin",
    label: "Admin",
  },
  {
    value: "member",
    label: "Member",
  },
  {
    value: "viewer",
    label: "Viewer",
  },
  {
    value: "guest",
    label: "Guest",
  },
]

export const teamRoleRank: Record<Role, number> = {
  admin: 0,
  member: 1,
  viewer: 2,
  guest: 3,
}

export function getRoleLabel(role: Role) {
  return teamRoleOptions.find((option) => option.value === role)?.label ?? role
}

export type WorkspaceSettingsUser = MemberIdentity & {
  isOwner: boolean
  isWorkspaceAdmin: boolean
  isTeamAdmin: boolean
  isCurrentUser: boolean
  teamNames: string[]
}

export type TeamSettingsMember = MemberIdentity & {
  role: Role
  isCurrentUser: boolean
}

function getNormalizedMemberQuery(value: string) {
  return value.trim().toLowerCase()
}

function matchesMemberQuery(member: MemberIdentity, query: string) {
  if (!query) {
    return true
  }

  return (
    member.name.toLowerCase().includes(query) ||
    member.email.toLowerCase().includes(query)
  )
}

function getMemberTitle(title?: string | null) {
  const normalizedTitle = title?.trim()

  if (!normalizedTitle || normalizedTitle.toLowerCase() === "member") {
    return null
  }

  return normalizedTitle
}

function MemberSearchInput({
  query,
  onQueryChange,
}: {
  query: string
  onQueryChange: (value: string) => void
}) {
  return (
    <div className="relative max-w-md">
      <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-10 pl-9 placeholder:text-muted-foreground/60"
        placeholder="Search members..."
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </div>
  )
}

function MemberList<T extends MemberIdentity>({
  members,
  renderRow,
}: {
  members: T[]
  renderRow: (member: T) => ReactNode
}) {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = getNormalizedMemberQuery(deferredQuery)
  const filteredMembers = useMemo(() => {
    return members.filter((member) =>
      matchesMemberQuery(member, normalizedQuery)
    )
  }, [members, normalizedQuery])

  return (
    <div className="space-y-4">
      {members.length > 0 ? (
        <MemberSearchInput query={query} onQueryChange={setQuery} />
      ) : null}
      {filteredMembers.length > 0 ? (
        <div className="divide-y">
          {filteredMembers.map((member) => renderRow(member))}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No members found.
        </p>
      )}
    </div>
  )
}

function MemberTeamNote({ teamNames }: { teamNames: string[] }) {
  const note =
    teamNames.length > 0 ? teamNames.join(", ") : "No team memberships"

  if (teamNames.length === 0) {
    return <div className="truncate text-xs text-muted-foreground">{note}</div>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="truncate text-xs text-muted-foreground">{note}</div>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>
          <p className="max-w-sm leading-relaxed">{note}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function MemberIdentityBlock({
  member,
  badge,
  note,
}: {
  member: MemberIdentity
  badge?: ReactNode
  note?: ReactNode
}) {
  const title = getMemberTitle(member.title)

  return (
    <div className="flex min-w-0 items-start gap-3">
      <UserAvatar
        name={member.name}
        avatarImageUrl={member.avatarImageUrl}
        avatarUrl={member.avatarUrl}
        status={member.status}
        size="default"
        showStatus={false}
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-sm font-medium">{member.name}</div>
          {badge}
        </div>
        <div className="truncate text-sm text-muted-foreground">
          {member.email}
        </div>
        {title ? (
          <div className="truncate text-xs text-muted-foreground">{title}</div>
        ) : null}
        {note ? note : null}
      </div>
    </div>
  )
}

function MemberListRow({
  identity,
  actions,
}: {
  identity: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 px-0 py-3 sm:flex-row sm:items-start sm:justify-between">
      {identity}
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export function WorkspaceUsersList({
  members,
  canManage = false,
  pendingMemberId = null,
  onRemove,
}: {
  members: WorkspaceSettingsUser[]
  canManage?: boolean
  pendingMemberId?: string | null
  onRemove?: (member: WorkspaceSettingsUser) => void
}) {
  return (
    <MemberList
      members={members}
      renderRow={(member) => {
        const canRemove =
          canManage &&
          !member.isOwner &&
          !member.isWorkspaceAdmin &&
          !member.isTeamAdmin &&
          !member.isCurrentUser &&
          onRemove
        const isBusy = pendingMemberId === member.id

        return (
          <MemberListRow
            key={member.id}
            identity={
              <MemberIdentityBlock
                member={member}
                badge={
                  member.isOwner ? (
                    <Badge>Owner</Badge>
                  ) : member.isWorkspaceAdmin ? (
                    <Badge>Admin</Badge>
                  ) : member.isTeamAdmin ? (
                    <Badge variant="secondary">Team admin</Badge>
                  ) : member.isCurrentUser ? (
                    <Badge variant="outline">You</Badge>
                  ) : null
                }
                note={<MemberTeamNote teamNames={member.teamNames} />}
              />
            }
            actions={
              <>
                <Badge variant="outline">
                  {member.isOwner
                    ? "Workspace owner"
                    : `${member.teamNames.length} team${member.teamNames.length === 1 ? "" : "s"}`}
                </Badge>
                {canRemove ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove?.(member)}
                  >
                    <Trash className="size-3.5" />
                    {isBusy ? "Removing..." : "Remove"}
                  </Button>
                ) : null}
              </>
            }
          />
        )
      }}
    />
  )
}

export function TeamMembersList({
  members,
  canManage,
  pendingMemberId,
  pendingAction,
  onRoleChange,
  onRemove,
}: {
  members: TeamSettingsMember[]
  canManage: boolean
  pendingMemberId: string | null
  pendingAction: "role" | "remove" | null
  onRoleChange: (userId: string, role: Role) => void
  onRemove: (member: TeamSettingsMember) => void
}) {
  return (
    <MemberList
      members={members}
      renderRow={(member) => {
        const isBusy = pendingMemberId === member.id

        return (
          <MemberListRow
            key={member.id}
            identity={
              <MemberIdentityBlock
                member={member}
                badge={
                  member.isCurrentUser ? (
                    <Badge variant="outline">You</Badge>
                  ) : undefined
                }
              />
            }
            actions={
              canManage ? (
                <>
                  <Select
                    disabled={isBusy || member.isCurrentUser}
                    value={member.role}
                    onValueChange={(nextRole) =>
                      onRoleChange(member.id, nextRole as Role)
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamRoleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isBusy || member.isCurrentUser}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(member)}
                  >
                    <Trash className="size-3.5" />
                    {isBusy && pendingAction === "remove"
                      ? "Removing..."
                      : "Remove"}
                  </Button>
                </>
              ) : (
                <Badge
                  variant={member.role === "admin" ? "default" : "outline"}
                >
                  {getRoleLabel(member.role)}
                </Badge>
              )
            }
          />
        )
      }}
    />
  )
}

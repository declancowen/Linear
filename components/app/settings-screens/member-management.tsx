"use client"

import type { ReactNode } from "react"
import { Trash } from "@phosphor-icons/react"

import type { Role, UserStatus } from "@/lib/domain/types"
import { UserAvatar } from "@/components/app/user-presence"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  isCurrentUser: boolean
  teamNames: string[]
}

export type TeamSettingsMember = MemberIdentity & {
  role: Role
  isCurrentUser: boolean
}

function MemberIdentityBlock({
  member,
  badge,
  note,
}: {
  member: MemberIdentity
  badge?: ReactNode
  note?: string
}) {
  const secondaryLine = member.title?.trim() || member.email

  return (
    <div className="flex min-w-0 items-center gap-3">
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
          {secondaryLine}
        </div>
        {note ? (
          <div className="truncate text-xs text-muted-foreground">{note}</div>
        ) : null}
      </div>
    </div>
  )
}

export function WorkspaceUsersCard({
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
  if (members.length === 0) {
    return (
      <Card className="border-dashed shadow-none">
        <div className="px-5 py-6 text-sm text-muted-foreground">
          No workspace users found.
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden shadow-none">
      {members.map((member, index) => {
        const teamSummary =
          member.teamNames.length > 0
            ? `Teams: ${member.teamNames.join(", ")}`
            : "No team memberships"
        const canRemove =
          canManage &&
          !member.isOwner &&
          !member.isWorkspaceAdmin &&
          !member.isCurrentUser &&
          onRemove
        const isBusy = pendingMemberId === member.id

        return (
          <div
            key={member.id}
            className={
              index < members.length - 1
                ? "flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                : "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            }
          >
            <MemberIdentityBlock
              member={member}
              badge={
                member.isOwner ? (
                  <Badge>Owner</Badge>
                ) : member.isWorkspaceAdmin ? (
                  <Badge>Admin</Badge>
                ) : member.isCurrentUser ? (
                  <Badge variant="outline">You</Badge>
                ) : null
              }
              note={teamSummary}
            />
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
                  onClick={() => onRemove?.(member)}
                >
                  <Trash className="size-3.5" />
                  {isBusy ? "Removing..." : "Remove"}
                </Button>
              ) : null}
            </div>
          </div>
        )
      })}
    </Card>
  )
}

export function TeamMembersCard({
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
  if (members.length === 0) {
    return (
      <Card className="border-dashed shadow-none">
        <div className="px-5 py-6 text-sm text-muted-foreground">
          No team members found.
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden shadow-none">
      {members.map((member, index) => {
        const isBusy = pendingMemberId === member.id

        return (
          <div
            key={member.id}
            className={
              index < members.length - 1
                ? "flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                : "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            }
          >
            <MemberIdentityBlock
              member={member}
              badge={
                member.isCurrentUser ? (
                  <Badge variant="outline">You</Badge>
                ) : undefined
              }
            />
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Badge variant={member.role === "admin" ? "default" : "outline"}>
                {getRoleLabel(member.role)}
              </Badge>
              {canManage ? (
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
                    onClick={() => onRemove(member)}
                  >
                    <Trash className="size-3.5" />
                    {isBusy && pendingAction === "remove"
                      ? "Removing..."
                      : "Remove"}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        )
      })}
    </Card>
  )
}

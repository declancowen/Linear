"use client"

import { useEffect, useState } from "react"

import {
  ArrowsClockwise,
  Check,
  EnvelopeSimple,
  PaperPlaneTilt,
  UsersThree,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import { syncSendInvite } from "@/lib/convex/client"
import { getAccessibleTeams, getTeamRole } from "@/lib/domain/selectors"
import { normalizeTeamIconToken, type Role } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
import { TeamIconGlyph } from "@/components/app/entity-icons"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function InviteDialog({
  open,
  onOpenChange,
  mode,
  presetTeamIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "workspace" | "team"
  presetTeamIds: string[]
}) {
  const activeTeamId = useAppStore((state) => state.ui.activeTeamId)
  const teams = useAppStore(useShallow((state) => getAccessibleTeams(state)))
  const inviteableTeams = useAppStore(
    useShallow((state) =>
      getAccessibleTeams(state).filter((team) => {
        const teamRole = getTeamRole(state, team.id)
        return teamRole === "admin" || teamRole === "member"
      })
    )
  )
  const [teamIds, setTeamIds] = useState<string[]>([])
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("viewer")
  const [submitting, setSubmitting] = useState(false)
  const inviteRoleOptions: Array<{
    value: Role
    label: string
    description: string
  }> = [
    {
      value: "member",
      label: "Member",
      description: "Can create and edit work items and projects.",
    },
    {
      value: "viewer",
      label: "Viewer",
      description: "Can view work across the assigned teams.",
    },
    {
      value: "guest",
      label: "Guest",
      description: "Limited access for external collaborators.",
    },
  ]
  const workspaceInviteMode = mode === "workspace"
  const lockedToTeam = mode === "team" && presetTeamIds.length > 0
  const lockedTeam = teams.find((team) => team.id === presetTeamIds[0])
  const lockedTeamIcon = lockedTeam
    ? normalizeTeamIconToken(lockedTeam.icon, lockedTeam.settings.experience)
    : null
  const selectedRoleDescription =
    inviteRoleOptions.find((option) => option.value === role)?.description ??
    inviteRoleOptions[1].description

  useEffect(() => {
    if (!open) {
      return
    }

    setTeamIds(lockedToTeam ? presetTeamIds : [])
    setEmail("")
    setRole("viewer")
  }, [lockedToTeam, open, presetTeamIds])

  const canInvite =
    email.trim().length > 0 &&
    teamIds.length > 0 &&
    teamIds.every((teamId) =>
      inviteableTeams.some((team) => team.id === teamId)
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={`${activeTeamId}-${mode}-${open}`}
        className="max-w-lg gap-0 overflow-hidden p-0"
      >
        <div className="px-6 pt-6 pb-2">
          <DialogHeader className="items-start gap-4 p-0">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/8 ring-1 ring-border/60">
              <EnvelopeSimple
                className="size-6 text-primary"
                weight="duotone"
              />
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-lg">Invite people</DialogTitle>
              <DialogDescription className="max-w-md text-sm leading-relaxed">
                {workspaceInviteMode
                  ? "Invite someone to your workspace. Select which teams they should join."
                  : "They'll receive an email with a link to get started."}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invite-email">Email address</FieldLabel>
              <FieldContent>
                <Input
                  id="invite-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="colleague@company.com"
                  autoFocus
                />
              </FieldContent>
            </Field>
          </FieldGroup>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">
                {lockedToTeam ? "Team" : "Teams"}
              </div>
              {workspaceInviteMode ? (
                <div className="rounded-full border bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {teamIds.length} selected
                </div>
              ) : null}
            </div>
            {lockedToTeam ? (
              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-background ring-1 ring-border/60">
                  {lockedTeamIcon ? (
                    <TeamIconGlyph
                      icon={lockedTeamIcon}
                      className="size-4 text-muted-foreground"
                    />
                  ) : (
                    <UsersThree className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {lockedTeam?.name ?? "Selected team"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    This invite is locked to a single team.
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "flex flex-wrap gap-2",
                  workspaceInviteMode
                    ? "rounded-xl border bg-muted/15 p-3"
                    : undefined
                )}
              >
                {inviteableTeams.map((team) => {
                  const selected = teamIds.includes(team.id)
                  const teamIcon = normalizeTeamIconToken(
                    team.icon,
                    team.settings.experience
                  )

                  return (
                    <button
                      key={team.id}
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        selected
                          ? "border-primary/30 bg-primary/10 font-medium text-foreground"
                          : "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground"
                      )}
                      onClick={() =>
                        setTeamIds((current) =>
                          current.includes(team.id)
                            ? current.filter((value) => value !== team.id)
                            : [...current, team.id]
                        )
                      }
                    >
                      <TeamIconGlyph
                        icon={teamIcon}
                        className="size-3.5 shrink-0"
                      />
                      <span>{team.name}</span>
                      {selected ? (
                        <Check className="size-3.5 shrink-0" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invite-role">Role</FieldLabel>
              <FieldContent>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as Role)}
                >
                  <SelectTrigger id="invite-role" className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {inviteRoleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FieldContent>
              <FieldDescription>{selectedRoleDescription}</FieldDescription>
            </Field>
          </FieldGroup>
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canInvite || submitting}
            onClick={async () => {
              setSubmitting(true)

              try {
                await syncSendInvite(teamIds, email, role)

                toast.success(
                  teamIds.length === 1
                    ? "Invite email sent"
                    : `Invite emails sent for ${teamIds.length} teams`
                )
                onOpenChange(false)
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Failed to create invite"
                )
              } finally {
                setSubmitting(false)
              }
            }}
          >
            {submitting ? (
              <>
                <ArrowsClockwise className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <PaperPlaneTilt />
                Send invite
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

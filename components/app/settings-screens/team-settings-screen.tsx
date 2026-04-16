"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useShallow } from "zustand/react/shallow"

import { TeamIconGlyph } from "@/components/app/entity-icons"
import {
  canAdminTeam,
  getTeamBySlug,
  getTeamFeatureSettings,
  getTeamSurfaceDisableReasons,
} from "@/lib/domain/selectors"
import {
  normalizeTeamIconToken,
  type TeamFeatureSettings,
  type TeamExperienceType,
  type Role,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { TeamMembersCard, teamRoleRank } from "./member-management"
import { SettingsScaffold } from "./shared"
import {
  defaultTeamSurfaceDisableReasons,
  TeamEditorFields,
} from "./team-editor-fields"

export function TeamSettingsScreen({ teamSlug }: { teamSlug: string }) {
  const router = useRouter()
  const team = useAppStore((state) => getTeamBySlug(state, teamSlug))
  const canManageTeam = useAppStore((state) => {
    const currentTeam = getTeamBySlug(state, teamSlug)

    return currentTeam ? canAdminTeam(state, currentTeam.id) : false
  })
  const surfaceDisableReasons = useAppStore(
    useShallow((state) => {
      const currentTeam = getTeamBySlug(state, teamSlug)

      return currentTeam
        ? getTeamSurfaceDisableReasons(state, currentTeam.id)
        : defaultTeamSurfaceDisableReasons
    })
  )
  const { teamMemberships, users, currentUserId } = useAppStore(
    useShallow((state) => ({
      teamMemberships: state.teamMemberships,
      users: state.users,
      currentUserId: state.currentUserId,
    }))
  )
  const teamMembers = useMemo(() => {
    if (!team) {
      return []
    }

    return teamMemberships
      .filter((membership) => membership.teamId === team.id)
      .flatMap((membership) => {
        const user = users.find((entry) => entry.id === membership.userId)

        if (!user) {
          return []
        }

        return [
          {
            id: user.id,
            name: user.name,
            email: user.email,
            title: user.title,
            avatarUrl: user.avatarUrl,
            avatarImageUrl: user.avatarImageUrl,
            status: user.status,
            role: membership.role,
            isCurrentUser: user.id === currentUserId,
          },
        ]
      })
      .sort((left, right) => {
        const rankDifference = teamRoleRank[left.role] - teamRoleRank[right.role]

        if (rankDifference !== 0) {
          return rankDifference
        }

        return left.name.localeCompare(right.name)
      })
  }, [currentUserId, team, teamMemberships, users])
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTeam, setDeletingTeam] = useState(false)
  const [activeTab, setActiveTab] = useState<"team" | "users">("team")
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null)
  const [pendingMemberAction, setPendingMemberAction] = useState<
    "role" | "remove" | null
  >(null)
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string
    name: string
  } | null>(null)
  const experience: TeamExperienceType =
    team?.settings.experience ?? "software-development"
  const [name, setName] = useState(team?.name ?? "")
  const [icon, setIcon] = useState(() =>
    normalizeTeamIconToken(team?.icon, experience)
  )
  const [summary, setSummary] = useState(team?.settings.summary ?? "")
  const [features, setFeatures] = useState<TeamFeatureSettings>(
    team?.settings.features ?? getTeamFeatureSettings(team)
  )

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setName(team?.name ?? "")
      setIcon(
        normalizeTeamIconToken(
          team?.icon,
          team?.settings.experience ?? "software-development"
        )
      )
      setSummary(team?.settings.summary ?? "")
      setFeatures(team?.settings.features ?? getTeamFeatureSettings(team))
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [team])

  useEffect(() => {
    if (!team || canManageTeam) {
      return
    }

    router.replace("/workspace/projects")
  }, [canManageTeam, router, team])

  if (!team) {
    return (
      <SettingsScaffold
        title="Team settings"
        subtitle="Requested team not found"
      >
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Team unavailable</CardTitle>
            <CardDescription>
              The requested team does not exist in the current workspace.
            </CardDescription>
          </CardHeader>
        </Card>
      </SettingsScaffold>
    )
  }

  if (!canManageTeam) {
    return (
      <SettingsScaffold
        title="Team settings"
        subtitle="Team admin access required"
      >
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Redirecting</CardTitle>
            <CardDescription>
              Only team admins can open team settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </SettingsScaffold>
    )
  }

  const currentTeam = team
  const savedFeatures = getTeamFeatureSettings(team)

  async function handleDeleteTeam() {
    try {
      setDeletingTeam(true)
      const deleted = await useAppStore.getState().deleteTeam(currentTeam.id)

      if (!deleted) {
        return
      }

      setDeleteDialogOpen(false)
      router.replace("/workspace/projects")
    } finally {
      setDeletingTeam(false)
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    try {
      setPendingMemberId(userId)
      setPendingMemberAction("role")
      await useAppStore
        .getState()
        .updateTeamMemberRole(currentTeam.id, userId, {
          role,
        })
    } finally {
      setPendingMemberId(null)
      setPendingMemberAction(null)
    }
  }

  async function handleRemoveTeamMember() {
    if (!memberToRemove) {
      return
    }

    try {
      setPendingMemberId(memberToRemove.id)
      setPendingMemberAction("remove")
      const removed = await useAppStore
        .getState()
        .removeTeamMember(currentTeam.id, memberToRemove.id)

      if (removed) {
        setMemberToRemove(null)
      }
    } finally {
      setPendingMemberId(null)
      setPendingMemberAction(null)
    }
  }

  return (
    <SettingsScaffold
      title="Team settings"
      subtitle={
        activeTab === "team"
          ? "Identity, team type, and surfaces"
          : "Team members and roles"
      }
      footer={
        activeTab === "team" ? (
          <Button
            disabled={!canManageTeam || saving}
            onClick={async () => {
              setSaving(true)
              const updated = await useAppStore
                .getState()
                .updateTeamDetails(currentTeam.id, {
                  name,
                  icon,
                  summary,
                  experience,
                  features,
                })
              setSaving(false)

              if (updated) {
                router.refresh()
              }
            }}
          >
            {saving ? "Saving..." : "Save team"}
          </Button>
        ) : null
      }
    >
      <div className="max-w-3xl space-y-10">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "team" | "users")}
        >
          <Card className="overflow-hidden shadow-none">
            <div className="flex items-start gap-4 px-5 py-5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
                <TeamIconGlyph icon={icon} className="size-5 text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold">
                  {currentTeam.name}
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                  {currentTeam.settings.summary || "No summary set."}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{teamMembers.length} members</span>
                  <span>·</span>
                  <span>{currentTeam.settings.joinCode}</span>
                </div>
              </div>
            </div>
            <div className="border-t px-3">
              <TabsList
                variant="line"
                className="h-10 justify-start gap-1 rounded-none border-0 px-0"
              >
                <TabsTrigger
                  value="team"
                  className="rounded-none border-0 px-3 focus-visible:ring-0 focus-visible:outline-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Team
                </TabsTrigger>
                <TabsTrigger
                  value="users"
                  className="rounded-none border-0 px-3 focus-visible:ring-0 focus-visible:outline-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Users
                </TabsTrigger>
              </TabsList>
            </div>
          </Card>

          <TabsContent value="team" className="mt-6 space-y-10">
            <TeamEditorFields
              canChangeExperience={false}
              disabled={!canManageTeam}
              experience={experience}
              features={features}
              icon={icon}
              joinCode={currentTeam.settings.joinCode}
              joinCodeReadonlyLabel="This 12-character code is stored on the team and can be regenerated at any time."
              name={name}
              onRegenerateJoinCode={async () => {
                await useAppStore
                  .getState()
                  .regenerateTeamJoinCode(currentTeam.id)
              }}
              savedFeatures={savedFeatures}
              setFeatures={setFeatures}
              setIcon={(value) =>
                setIcon(normalizeTeamIconToken(value, experience))
              }
              setName={setName}
              setSummary={setSummary}
              summary={summary}
              surfaceDisableReasons={surfaceDisableReasons}
            />

            <section className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4">
              <div className="space-y-1">
                <h2 className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                  Danger zone
                </h2>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Delete team</div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Permanently remove this team and all associated data. This
                    action cannot be undone.
                    {!canManageTeam
                      ? " Only team admins can delete this team."
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!canManageTeam || deletingTeam}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  {deletingTeam ? "Deleting..." : "Delete team"}
                </Button>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <TeamMembersCard
              members={teamMembers}
              canManage={canManageTeam}
              pendingMemberId={pendingMemberId}
              pendingAction={pendingMemberAction}
              onRoleChange={(userId, role) =>
                void handleRoleChange(userId, role)
              }
              onRemove={(member) =>
                setMemberToRemove({
                  id: member.id,
                  name: member.name,
                })
              }
            />
          </TabsContent>
        </Tabs>
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete team"
          description="This will permanently remove the team and all associated data. This can't be undone."
          confirmLabel="Delete team"
          variant="destructive"
          loading={deletingTeam}
          onConfirm={() => void handleDeleteTeam()}
        />
        <ConfirmDialog
          open={memberToRemove != null}
          onOpenChange={(open) => {
            if (!open && pendingMemberAction !== "remove") {
              setMemberToRemove(null)
            }
          }}
          title="Remove team member"
          description={
            memberToRemove
              ? `${memberToRemove.name} will lose access to this team and get an inbox notification plus a transactional email.`
              : "This member will lose access to this team."
          }
          confirmLabel="Remove member"
          variant="destructive"
          loading={pendingMemberAction === "remove"}
          onConfirm={() => void handleRemoveTeamMember()}
        />
      </div>
    </SettingsScaffold>
  )
}

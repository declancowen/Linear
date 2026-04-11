"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  ArrowsClockwise,
  Bell,
  Buildings,
  ChartLineUp,
  CheckCircle,
  CodesandboxLogo,
  Gear,
  IdentificationBadge,
  Kanban,
  MagnifyingGlass,
  NotePencil,
  Plus,
  SignIn,
  SquaresFour,
  UserCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  getAccessibleTeams,
  getCurrentUser,
  getCurrentWorkspace,
  getTeamRole,
} from "@/lib/domain/selectors"
import type { Role } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { GlobalSearchDialog } from "@/components/app/global-search-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"

const previewRoles: Role[] = ["admin", "member", "viewer", "guest"]
const workspaceAccentOptions = ["emerald", "blue", "amber", "rose", "slate"] as const

function routeTitle(pathname: string) {
  if (pathname.startsWith("/inbox")) {
    return "Inbox"
  }

  if (pathname.startsWith("/assigned")) {
    return "Assigned to Me"
  }

  if (pathname.startsWith("/workspace/projects")) {
    return "Projects"
  }

  if (pathname.startsWith("/workspace/views")) {
    return "Views"
  }

  if (pathname.startsWith("/workspace/docs")) {
    return "Documents"
  }

  if (pathname.startsWith("/workspace/search")) {
    return "Search"
  }

  if (pathname.startsWith("/workspace/reports")) {
    return "Reports"
  }

  if (pathname.includes("/work")) {
    return "Work"
  }

  if (pathname.includes("/projects/")) {
    return "Project"
  }

  if (pathname.includes("/docs/")) {
    return "Document"
  }

  if (pathname.includes("/items/")) {
    return "Work Item"
  }

  return "Workspace"
}

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const data = useAppStore()
  const unread = data.notifications.filter(
    (notification) =>
      notification.userId === data.currentUserId && notification.readAt === null
  ).length
  const workspace = getCurrentWorkspace(data)
  const currentUser = getCurrentUser(data)
  const teams = getAccessibleTeams(data)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteMode, setInviteMode] = useState<"workspace" | "team">("workspace")
  const [invitePresetTeamIds, setInvitePresetTeamIds] = useState<string[]>([])
  const [joinCodeOpen, setJoinCodeOpen] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [teamDetailsTeamId, setTeamDetailsTeamId] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [desktopShell, setDesktopShell] = useState(false)

  useEffect(() => {
    setDesktopShell(Boolean(window.electronApp))
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen((current) => !current)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return (
    <SidebarProvider>
      <InviteDialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open)
          if (!open) {
            setInvitePresetTeamIds([])
          }
        }}
        mode={inviteMode}
        presetTeamIds={invitePresetTeamIds}
      />
      <JoinTeamDialog open={joinCodeOpen} onOpenChange={setJoinCodeOpen} />
      {workspaceOpen ? (
        <WorkspaceDialog
          key={`${workspace?.id ?? "workspace"}-${workspaceOpen}`}
          open={workspaceOpen}
          onOpenChange={setWorkspaceOpen}
        />
      ) : null}
      {teamDetailsTeamId ? (
        <TeamDetailsDialog
          open={Boolean(teamDetailsTeamId)}
          onOpenChange={(open) => {
            if (!open) {
              setTeamDetailsTeamId(null)
            }
          }}
          teamId={teamDetailsTeamId}
        />
      ) : null}
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      {searchOpen ? (
        <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      ) : null}
      <Sidebar variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      {workspace?.logoUrl}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{workspace?.name}</span>
                      <span className="truncate text-xs text-sidebar-foreground/70">
                        Multi-work workspace
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => setWorkspaceOpen(true)}>
                      <Gear />
                      Workspace details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setInviteMode("workspace")
                        setInvitePresetTeamIds([])
                        setInviteOpen(true)
                      }}
                    >
                      <Plus />
                      Invite to teams
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setJoinCodeOpen(true)}>
                      <SignIn />
                      Join a team with code
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={!useAppStore.getState().currentWorkspaceId}>
                      <Buildings />
                      Team-derived membership only
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarLink
                  href="/inbox"
                  icon={<Bell />}
                  label="Inbox"
                  active={pathname.startsWith("/inbox")}
                  badge={unread > 0 ? String(unread) : undefined}
                />
                <SidebarLink
                  href="/assigned"
                  icon={<CheckCircle />}
                  label="Assigned to Me"
                  active={pathname.startsWith("/assigned")}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarLink
                  href="/workspace/projects"
                  icon={<Kanban />}
                  label="Projects"
                  active={pathname.startsWith("/workspace/projects")}
                />
                <SidebarLink
                  href="/workspace/views"
                  icon={<SquaresFour />}
                  label="Views"
                  active={pathname.startsWith("/workspace/views")}
                />
                <SidebarLink
                  href="/workspace/docs"
                  icon={<NotePencil />}
                  label="Docs"
                  active={pathname.startsWith("/workspace/docs")}
                />
                <SidebarLink
                  href="/workspace/search"
                  icon={<MagnifyingGlass />}
                  label="Search"
                  active={pathname.startsWith("/workspace/search")}
                />
                <SidebarLink
                  href="/workspace/reports"
                  icon={<ChartLineUp />}
                  label="Reports"
                  active={pathname.startsWith("/workspace/reports")}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarGroup>
            <div className="flex items-center justify-between px-2">
              <SidebarGroupLabel>Your teams</SidebarGroupLabel>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => {
                  setInviteMode("workspace")
                  setInvitePresetTeamIds([])
                  setInviteOpen(true)
                }}
              >
                <Plus />
                <span className="sr-only">Invite people</span>
              </Button>
            </div>
            <SidebarGroupContent>
              <div className="flex flex-col gap-3">
                {teams.map((team) => (
                  <Card key={team.id} className="shadow-none">
                    <CardContent className="flex flex-col gap-2 px-3 py-3">
                      <div className="flex items-center justify-between">
                        {(() => {
                          const teamRole = getTeamRole(data, team.id)
                          const canInvite = teamRole === "admin" || teamRole === "member"
                          const canManage = teamRole === "admin"

                          return (
                            <>
                              <Link
                                className="truncate text-sm font-medium"
                                href={`/team/${team.slug}/work`}
                              >
                                {team.name}
                              </Link>
                              <div className="flex items-center gap-1">
                                <SidebarMenuBadge>{teamRole}</SidebarMenuBadge>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  disabled={!canInvite}
                                  onClick={() => {
                                    setInviteMode("team")
                                    setInvitePresetTeamIds([team.id])
                                    setInviteOpen(true)
                                  }}
                                >
                                  <Plus />
                                  <span className="sr-only">Invite to {team.name}</span>
                                </Button>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  disabled={!canManage}
                                  onClick={() => setTeamDetailsTeamId(team.id)}
                                >
                                  <Gear />
                                  <span className="sr-only">Edit {team.name}</span>
                                </Button>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                      <SidebarMenu>
                        <SidebarLink
                          href={`/team/${team.slug}/work`}
                          icon={<CodesandboxLogo />}
                          label="Work"
                          active={pathname.startsWith(`/team/${team.slug}/work`)}
                        />
                        <SidebarLink
                          href={`/team/${team.slug}/projects`}
                          icon={<Kanban />}
                          label="Projects"
                          active={pathname.startsWith(`/team/${team.slug}/projects`)}
                        />
                        <SidebarLink
                          href={`/team/${team.slug}/views`}
                          icon={<SquaresFour />}
                          label="Views"
                          active={pathname.startsWith(`/team/${team.slug}/views`)}
                        />
                        <SidebarLink
                          href={`/team/${team.slug}/docs`}
                          icon={<NotePencil />}
                          label="Docs"
                          active={pathname.startsWith(`/team/${team.slug}/docs`)}
                        />
                      </SidebarMenu>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      setInviteMode("workspace")
                      setInvitePresetTeamIds([])
                      setInviteOpen(true)
                    }}
                  >
                    <Plus />
                    <span>Invite people</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                      {currentUser.avatarUrl}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{currentUser.name}</span>
                      <span className="truncate text-xs text-sidebar-foreground/70">
                        {currentUser.title}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuLabel>Profile and preview</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                      <UserCircle />
                      Edit profile
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/auth/logout">
                        <SignIn />
                        Sign out
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => useAppStore.getState().resetDemo()}
                    >
                      <ArrowsClockwise />
                      Reset demo data
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Role preview</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onSelect={() => useAppStore.getState().setRolePreview(null)}
                    >
                      <IdentificationBadge />
                      Actual team role
                    </DropdownMenuItem>
                    {previewRoles.map((role) => (
                      <DropdownMenuItem
                        key={role}
                        onSelect={() => useAppStore.getState().setRolePreview(role)}
                      >
                        <IdentificationBadge />
                        Preview as {role}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{routeTitle(pathname)}</span>
                <span className="text-xs text-muted-foreground">
                  {workspace?.name} · {getTeamRole(data, data.ui.activeTeamId) ?? "no access"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSearchOpen(true)}
              >
                <MagnifyingGlass />
                Search
                <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  Cmd+K
                </span>
              </Button>
              {desktopShell ? (
                <Button size="sm" variant="outline">
                  <Buildings />
                  Desktop shell
                </Button>
              ) : null}
              {data.ui.rolePreview ? (
                <Button size="sm" variant="secondary">
                  <IdentificationBadge />
                  Preview: {data.ui.rolePreview}
                </Button>
              ) : null}
              <Button size="icon-sm" variant="ghost" asChild>
                <Link href="/inbox">
                  <Bell />
                  <span className="sr-only">Inbox</span>
                </Link>
              </Button>
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col px-4 py-4 md:px-6 md:py-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function SidebarLink({
  href,
  icon,
  label,
  active,
  badge,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active: boolean
  badge?: string
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}>
        <Link href={href}>
          {icon}
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
      {badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null}
    </SidebarMenuItem>
  )
}

function WorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const data = useAppStore()
  const workspace = getCurrentWorkspace(data)
  const [name, setName] = useState(workspace?.name ?? "")
  const [logoUrl, setLogoUrl] = useState(workspace?.logoUrl ?? "")
  const [accent, setAccent] = useState(workspace?.settings.accent ?? "emerald")
  const [description, setDescription] = useState(
    workspace?.settings.description ?? ""
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={`${workspace?.id ?? "workspace"}-${open}`}>
        <DialogHeader>
          <DialogTitle>Workspace details</DialogTitle>
          <DialogDescription>
            Update the current workspace identity and meta details. Workspace
            admins control these fields and the name stays synced to the linked
            WorkOS organization.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="workspace-name">Name</FieldLabel>
            <FieldContent>
              <Input
                id="workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <FieldDescription>Shown across the sidebar and headers.</FieldDescription>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="workspace-logo">Logo / initials</FieldLabel>
            <FieldContent>
              <Input
                id="workspace-logo"
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
              />
              <FieldDescription>
                Keep this short so it renders cleanly in the sidebar badge.
              </FieldDescription>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Accent</FieldLabel>
            <FieldContent>
              <Select value={accent} onValueChange={setAccent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {workspaceAccentOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                Used for workspace-level styling and future theming hooks.
              </FieldDescription>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="workspace-description">Description</FieldLabel>
            <FieldContent>
              <Input
                id="workspace-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <FieldDescription>
                Short workspace summary used in onboarding and settings.
              </FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              useAppStore.getState().updateWorkspaceBranding({
                name,
                logoUrl,
                accent,
                description,
              })
              onOpenChange(false)
            }}
          >
            Save workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TeamDetailsDialog({
  open,
  onOpenChange,
  teamId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
}) {
  const data = useAppStore()
  const team = data.teams.find((entry) => entry.id === teamId) ?? null
  const [name, setName] = useState(team?.name ?? "")
  const [icon, setIcon] = useState(team?.icon ?? "")
  const [summary, setSummary] = useState(team?.settings.summary ?? "")
  const [joinCode, setJoinCode] = useState(team?.settings.joinCode ?? "")

  if (!team) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={`${team.id}-${open}`}>
        <DialogHeader>
          <DialogTitle>Team details</DialogTitle>
          <DialogDescription>
            Update the team identity, summary, and join code. Only team admins can
            change these settings.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="team-name">Name</FieldLabel>
            <FieldContent>
              <Input
                id="team-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="team-icon">Icon token</FieldLabel>
            <FieldContent>
              <Input
                id="team-icon"
                value={icon}
                onChange={(event) => setIcon(event.target.value)}
              />
              <FieldDescription>
                Internal token used for the team glyph across the app shell.
              </FieldDescription>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="team-summary">Summary</FieldLabel>
            <FieldContent>
              <Input
                id="team-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="team-join-code">Join code</FieldLabel>
            <FieldContent>
              <Input
                id="team-join-code"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              />
              <FieldDescription>
                New members who join by code enter this code and are added as viewers.
              </FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              useAppStore.getState().updateTeamDetails(team.id, {
                name,
                icon,
                summary,
                joinCode,
              })
              onOpenChange(false)
            }}
          >
            Save team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InviteDialog({
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
  const data = useAppStore()
  const teams = getAccessibleTeams(data)
  const [teamIds, setTeamIds] = useState<string[]>([])
  const [email, setEmail] = useState("new.person@example.com")
  const [role, setRole] = useState<Role>("viewer")
  const [submitting, setSubmitting] = useState(false)
  const inviteableTeams = teams.filter((team) => {
    const teamRole = getTeamRole(data, team.id)
    return teamRole === "admin" || teamRole === "member"
  })
  const lockedToTeam = mode === "team" && presetTeamIds.length > 0

  useEffect(() => {
    if (!open) {
      return
    }

    setTeamIds(lockedToTeam ? presetTeamIds : [])
  }, [lockedToTeam, open, presetTeamIds])

  const canInvite =
    teamIds.length > 0 &&
    teamIds.every((teamId) =>
      inviteableTeams.some((team) => team.id === teamId)
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={`${data.ui.activeTeamId}-${mode}-${open}`}>
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>
            Users are always invited through one or more teams, never directly into
            a workspace.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>{lockedToTeam ? "Team" : "Teams"}</FieldLabel>
            <FieldContent>
              {lockedToTeam ? (
                <div className="rounded-xl border px-3 py-2 text-sm">
                  {teams.find((team) => team.id === presetTeamIds[0])?.name ?? "Selected team"}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 rounded-xl border p-3">
                  {inviteableTeams.map((team) => {
                    const selected = teamIds.includes(team.id)

                    return (
                      <Button
                        key={team.id}
                        type="button"
                        size="sm"
                        variant={selected ? "secondary" : "outline"}
                        onClick={() =>
                          setTeamIds((current) =>
                            current.includes(team.id)
                              ? current.filter((value) => value !== team.id)
                              : [...current, team.id]
                          )
                        }
                      >
                        {team.name}
                      </Button>
                    )
                  })}
                </div>
              )}
              <FieldDescription>
                {lockedToTeam
                  ? "This invite is scoped to the current team."
                  : "When inviting from the workspace, select one or more teams to attach access."}
              </FieldDescription>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="invite-email">Email</FieldLabel>
            <FieldContent>
              <Input
                id="invite-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Role</FieldLabel>
            <FieldContent>
              <Select value={role} onValueChange={(value) => setRole(value as Role)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="guest">Guest</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canInvite || submitting}
            onClick={async () => {
              setSubmitting(true)

              try {
                const response = await fetch("/api/invites", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ teamIds, email, role }),
                })

                const payload = (await response.json()) as { error?: string }

                if (!response.ok) {
                  throw new Error(payload.error ?? "Failed to create invite")
                }

                toast.success(
                  teamIds.length === 1
                    ? "Invite email sent"
                    : `Invite emails sent for ${teamIds.length} teams`
                )
                onOpenChange(false)
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Failed to create invite"
                )
              } finally {
                setSubmitting(false)
              }
            }}
          >
            {submitting ? "Sending..." : "Create invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function JoinTeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [code, setCode] = useState("OPSJOIN")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a team</DialogTitle>
          <DialogDescription>
            A team join code adds the current user as a viewer for that team.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="join-code">Join code</FieldLabel>
            <FieldContent>
              <Input
                id="join-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <FieldDescription>
                Enter a valid team join code to be added to that team as a viewer.
              </FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              useAppStore.getState().joinTeamByCode(code)
              onOpenChange(false)
            }}
          >
            Join team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const data = useAppStore()
  const currentUser = getCurrentUser(data)
  const [name, setName] = useState(currentUser.name)
  const [title, setTitle] = useState(currentUser.title)
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl)
  const [emailMentions, setEmailMentions] = useState(
    currentUser.preferences.emailMentions
  )
  const [emailAssignments, setEmailAssignments] = useState(
    currentUser.preferences.emailAssignments
  )
  const [emailDigest, setEmailDigest] = useState(
    currentUser.preferences.emailDigest
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={`${currentUser.id}-${open}`}>
        <DialogHeader>
          <DialogTitle>Profile settings</DialogTitle>
          <DialogDescription>
            Update the current profile details used across the app shell and comments.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="profile-name">Name</FieldLabel>
            <FieldContent>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-title">Title</FieldLabel>
            <FieldContent>
              <Input
                id="profile-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-avatar">Avatar initials</FieldLabel>
            <FieldContent>
              <Input
                id="profile-avatar"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Email mentions</FieldLabel>
            <FieldContent>
              <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                <FieldDescription>
                  Send an email when someone mentions you in a comment.
                </FieldDescription>
                <Switch checked={emailMentions} onCheckedChange={setEmailMentions} />
              </div>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Email assignments</FieldLabel>
            <FieldContent>
              <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                <FieldDescription>
                  Send an email when work is assigned to you.
                </FieldDescription>
                <Switch
                  checked={emailAssignments}
                  onCheckedChange={setEmailAssignments}
                />
              </div>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Email digest</FieldLabel>
            <FieldContent>
              <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                <FieldDescription>
                  Include unread notifications in a digest email.
                </FieldDescription>
                <Switch checked={emailDigest} onCheckedChange={setEmailDigest} />
              </div>
            </FieldContent>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              useAppStore.getState().updateCurrentUserProfile({
                name,
                title,
                avatarUrl,
                preferences: {
                  emailMentions,
                  emailAssignments,
                  emailDigest,
                },
              })
              onOpenChange(false)
            }}
          >
            Save profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

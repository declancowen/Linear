"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  ArrowsClockwise,
  Bell,
  CaretDown,
  CaretRight,
  ChatCircleDots,
  CheckCircle,
  CodesandboxLogo,
  DotsThree,
  Gear,
  HashStraight,
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
  getTeamFeatureSettings,
  getTeamRole,
  getTeamSurfaceDisableReasons,
} from "@/lib/domain/selectors"
import {
  type Role,
  type TeamExperienceType,
  teamExperienceMeta,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
import { GlobalSearchDialog } from "@/components/app/global-search-dialog"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
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
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"

const previewRoles: Role[] = ["admin", "member", "viewer", "guest"]
const workspaceAccentOptions = ["emerald", "blue", "amber", "rose", "slate"] as const

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
  const [workspaceSectionOpen, setWorkspaceSectionOpen] = useState(true)
  const [teamsSectionOpen, setTeamsSectionOpen] = useState(true)
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(() => new Set(teams.map((t) => t.id)))

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

  function toggleTeam(teamId: string) {
    setExpandedTeams((current) => {
      const next = new Set(current)
      if (next.has(teamId)) {
        next.delete(teamId)
      } else {
        next.add(teamId)
      }
      return next
    })
  }

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
          <div className="flex items-center gap-1">
            <SidebarMenu className="min-w-0 flex-1">
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton className="h-9">
                      <div className="flex size-5 items-center justify-center rounded-[5px] bg-primary text-[10px] font-bold text-primary-foreground">
                        {workspace?.logoUrl}
                      </div>
                      <span className="truncate text-[12px] font-semibold leading-none">
                        {workspace?.name}
                      </span>
                      <CaretDown
                        className="ml-auto size-2.5 text-sidebar-foreground/50"
                        weight="fill"
                      />
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
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
            <Button
              size="icon-xs"
              variant="ghost"
              className="ml-auto shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={() => setSearchOpen(true)}
            >
              <MagnifyingGlass className="size-3.5" />
            </Button>
          </div>
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
                  label="My issues"
                  active={pathname.startsWith("/assigned")}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarGroup>
            <div className="px-2">
              <button
                type="button"
                className="flex h-7 min-w-0 flex-1 items-center rounded-md text-left text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
                onClick={() => setWorkspaceSectionOpen((current) => !current)}
              >
                <span className="truncate">Workspace</span>
                {workspaceSectionOpen ? (
                  <CaretDown
                    className="ml-1.5 size-2.5 text-sidebar-foreground/60"
                    weight="fill"
                  />
                ) : (
                  <CaretRight
                    className="ml-1.5 size-2.5 text-sidebar-foreground/60"
                    weight="fill"
                  />
                )}
              </button>
            </div>
            {workspaceSectionOpen ? (
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
                    href="/chats"
                    icon={<ChatCircleDots />}
                    label="Chats"
                    active={pathname.startsWith("/chats")}
                  />
                  <SidebarMenuItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton>
                          <DotsThree />
                          <span>More</span>
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link href="/workspace/search">
                            <MagnifyingGlass />
                            Search
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/workspace/reports">
                            <Kanban />
                            Reports
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            ) : null}
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarGroup>
            <div className="group/teams-header flex items-center justify-between px-2">
              <button
                type="button"
                className="flex h-7 min-w-0 flex-1 items-center rounded-md text-left text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
                onClick={() => setTeamsSectionOpen((current) => !current)}
              >
                <span className="truncate">Your teams</span>
                {teamsSectionOpen ? (
                  <CaretDown
                    className="ml-1.5 size-2.5 text-sidebar-foreground/60"
                    weight="fill"
                  />
                ) : (
                  <CaretRight
                    className="ml-1.5 size-2.5 text-sidebar-foreground/60"
                    weight="fill"
                  />
                )}
              </button>
              <Button
                size="icon-xs"
                variant="ghost"
                className="size-6 opacity-0 pointer-events-none transition-opacity group-hover/teams-header:pointer-events-auto group-hover/teams-header:opacity-100 group-focus-within/teams-header:pointer-events-auto group-focus-within/teams-header:opacity-100"
                onClick={() => {
                  setInviteMode("workspace")
                  setInvitePresetTeamIds([])
                  setInviteOpen(true)
                }}
              >
                <Plus className="size-3.5" />
                <span className="sr-only">Invite people</span>
              </Button>
            </div>
            {teamsSectionOpen ? (
              <SidebarGroupContent>
                <SidebarMenu>
                  {teams.map((team) => {
                    const isExpanded = expandedTeams.has(team.id)
                    const teamRole = getTeamRole(data, team.id)
                    const canInvite = teamRole === "admin" || teamRole === "member"
                    const canManage = teamRole === "admin"
                    const features = getTeamFeatureSettings(team)

                    return (
                      <SidebarMenuItem key={team.id}>
                        <div className="group/team-row relative">
                          <SidebarMenuButton
                            className="pr-8 font-medium [&_svg]:size-2.5"
                            onClick={() => toggleTeam(team.id)}
                          >
                            <span className="inline-flex min-w-0 items-center">
                              <span className="truncate">{team.name}</span>
                              {isExpanded ? (
                                <CaretDown
                                  className="ml-1.5 shrink-0 text-sidebar-foreground/60"
                                  weight="fill"
                                />
                              ) : (
                                <CaretRight
                                  className="ml-1.5 shrink-0 text-sidebar-foreground/60"
                                  weight="fill"
                                />
                              )}
                            </span>
                          </SidebarMenuButton>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/50 opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover/team-row:opacity-100 group-focus-within/team-row:opacity-100 focus-visible:opacity-100">
                                <DotsThree className="size-3.5" weight="bold" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48">
                              {canInvite ? (
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setInviteMode("team")
                                    setInvitePresetTeamIds([team.id])
                                    setInviteOpen(true)
                                  }}
                                >
                                  <Plus />
                                  Invite to {team.name}
                                </DropdownMenuItem>
                              ) : null}
                              {canManage ? (
                                <DropdownMenuItem onSelect={() => setTeamDetailsTeamId(team.id)}>
                                  <Gear />
                                  Team settings
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {isExpanded ? (
                          <SidebarMenuSub>
                            {features.chat ? (
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname.startsWith(`/team/${team.slug}/chat`)}
                                >
                                  <Link href={`/team/${team.slug}/chat`}>
                                    <ChatCircleDots className="size-4" />
                                    <span>Chat</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ) : null}
                            {features.channels ? (
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname.startsWith(`/team/${team.slug}/channels`)}
                                >
                                  <Link href={`/team/${team.slug}/channels`}>
                                    <HashStraight className="size-4" />
                                    <span>Channel</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ) : null}
                            {features.issues ? (
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname.startsWith(`/team/${team.slug}/work`)}
                                >
                                  <Link href={`/team/${team.slug}/work`}>
                                    <CodesandboxLogo className="size-4" />
                                    <span>Issues</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ) : null}
                            {features.projects ? (
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname.startsWith(`/team/${team.slug}/projects`)}
                                >
                                  <Link href={`/team/${team.slug}/projects`}>
                                    <Kanban className="size-4" />
                                    <span>Projects</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ) : null}
                            {features.views ? (
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname.startsWith(`/team/${team.slug}/views`)}
                                >
                                  <Link href={`/team/${team.slug}/views`}>
                                    <SquaresFour className="size-4" />
                                    <span>Views</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ) : null}
                            {features.docs ? (
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname.startsWith(`/team/${team.slug}/docs`)}
                                >
                                  <Link href={`/team/${team.slug}/docs`}>
                                    <NotePencil className="size-4" />
                                    <span>Docs</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ) : null}
                          </SidebarMenuSub>
                        ) : null}
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            ) : null}
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
                  <SidebarMenuButton>
                    <div className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                      {currentUser.avatarUrl}
                    </div>
                    <span className="truncate text-[12px]">{currentUser.name}</span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                      <UserCircle />
                      Edit profile
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <form action="/auth/logout" method="post" className="w-full">
                        <button type="submit" className="flex w-full items-center gap-2">
                          <SignIn />
                          Sign out
                        </button>
                      </form>
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
        <div className="flex flex-1 flex-col">
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
            Update the current workspace identity and meta details.
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
  const experience: TeamExperienceType =
    team?.settings.experience ?? "software-development"
  const [features, setFeatures] = useState(
    team?.settings.features ?? getTeamFeatureSettings(team)
  )
  const [saving, setSaving] = useState(false)
  const optionalFeatures = [
    {
      key: "docs" as const,
      label: "Docs",
      description: "Long-form team documents and collaborative writing.",
    },
    {
      key: "chat" as const,
      label: "Chat",
      description: "Real-time team conversation and quick coordination.",
    },
    {
      key: "channels" as const,
      label: "Channel",
      description: "Shared forum-style posts with replies for the full team.",
    },
  ]

  if (!team) {
    return null
  }

  const savedFeatures = getTeamFeatureSettings(team)
  const surfaceDisableReasons = getTeamSurfaceDisableReasons(data, team.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={`${team.id}-${open}`}
        className="flex max-h-[88svh] flex-col overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-base">Team settings</DialogTitle>
          <DialogDescription>
            {team.name} · {teamExperienceMeta[experience].label}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid gap-8 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
            {/* Left column */}
            <div className="flex flex-col gap-8">
              {/* Identity */}
              <section>
                <h3 className="mb-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Identity
                </h3>
                <FieldGroup className="gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
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
                      </FieldContent>
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="team-summary">Summary</FieldLabel>
                    <FieldContent>
                      <Textarea
                        id="team-summary"
                        value={summary}
                        onChange={(event) => setSummary(event.target.value)}
                        className="min-h-24 resize-none"
                      />
                    </FieldContent>
                    <FieldDescription>
                      Used in team discovery and sidebars.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="team-join-code">Join code</FieldLabel>
                    <FieldContent>
                      <Input
                        id="team-join-code"
                        value={joinCode}
                        onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                      />
                    </FieldContent>
                  </Field>
                </FieldGroup>
              </section>

              {/* Surfaces */}
              <section>
                <h3 className="mb-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Surfaces
                </h3>
                {experience === "community" ? (
                  <FieldGroup className="gap-4">
                    <Field>
                      <FieldContent>
                        <div className="grid gap-3 md:grid-cols-2">
                          <button
                            type="button"
                            className={cn(
                              "rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                              features.chat
                                ? "border-primary/40 bg-primary/5"
                                : "hover:bg-accent/40"
                            )}
                            disabled={
                              savedFeatures.channels &&
                              Boolean(surfaceDisableReasons.channels)
                            }
                            onClick={() =>
                              setFeatures({
                                issues: false,
                                projects: false,
                                views: false,
                                docs: false,
                                chat: true,
                                channels: false,
                              })
                            }
                          >
                            <div className="text-sm font-medium">Chat only</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Real-time conversation.
                            </div>
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                              features.channels
                                ? "border-primary/40 bg-primary/5"
                                : "hover:bg-accent/40"
                            )}
                            disabled={
                              savedFeatures.chat && Boolean(surfaceDisableReasons.chat)
                            }
                            onClick={() =>
                              setFeatures({
                                issues: false,
                                projects: false,
                                views: false,
                                docs: false,
                                chat: false,
                                channels: true,
                              })
                            }
                          >
                            <div className="text-sm font-medium">Channels only</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Forum posts with threaded replies.
                            </div>
                          </button>
                        </div>
                      </FieldContent>
                      {savedFeatures.chat && surfaceDisableReasons.chat ? (
                        <div className="text-xs text-muted-foreground">
                          {surfaceDisableReasons.chat}
                        </div>
                      ) : null}
                      {savedFeatures.channels && surfaceDisableReasons.channels ? (
                        <div className="text-xs text-muted-foreground">
                          {surfaceDisableReasons.channels}
                        </div>
                      ) : null}
                    </Field>
                  </FieldGroup>
                ) : (
                  <div className="space-y-4">
                    {/* Required — inline row */}
                    <div className="flex flex-wrap gap-2">
                      {["issues", "projects", "views"].map((feature) => (
                        <div
                          key={feature}
                          className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5"
                        >
                          <span className="text-sm capitalize">{feature}</span>
                          <Switch checked disabled className="scale-75" />
                        </div>
                      ))}
                    </div>

                    {/* Optional toggles — flat rows */}
                    <div className="divide-y">
                      {optionalFeatures.map((feature) => (
                        <div
                          key={feature.key}
                          className="flex items-center justify-between gap-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm">{feature.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {feature.description}
                            </div>
                            {savedFeatures[feature.key] &&
                            surfaceDisableReasons[feature.key] ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {surfaceDisableReasons[feature.key]}
                              </div>
                            ) : null}
                          </div>
                          <Switch
                            checked={features[feature.key]}
                            disabled={
                              savedFeatures[feature.key] &&
                              Boolean(surfaceDisableReasons[feature.key])
                            }
                            onCheckedChange={(checked) =>
                              setFeatures((current) => ({
                                ...current,
                                issues: true,
                                projects: true,
                                views: true,
                                [feature.key]: checked,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-8">
              {/* Team type */}
              <section>
                <h3 className="mb-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Team type
                </h3>
                <div className="rounded-lg bg-muted/30 px-4 py-3">
                  <div className="text-sm font-medium">
                    {teamExperienceMeta[experience].label}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {teamExperienceMeta[experience].description}
                  </p>
                  <span className="mt-3 inline-block text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    Locked after creation
                  </span>
                </div>
              </section>

              {/* Notes */}
              <section>
                <h3 className="mb-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Notes
                </h3>
                <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                  <p>
                    Software development and issue analysis teams always keep issues,
                    projects, and views enabled.
                  </p>
                  <p>
                    Community spaces use exactly one collaboration mode at a time.
                  </p>
                  <p>
                    Non-community teams can combine chat and channels.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              const updated = await useAppStore.getState().updateTeamDetails(team.id, {
                name,
                icon,
                summary,
                joinCode,
                experience,
                features,
              })
              setSaving(false)

              if (updated) {
                onOpenChange(false)
              }
            }}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
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
            Invite users through one or more teams.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>{lockedToTeam ? "Team" : "Teams"}</FieldLabel>
            <FieldContent>
              {lockedToTeam ? (
                <div className="rounded-lg border px-3 py-2 text-sm">
                  {teams.find((team) => team.id === presetTeamIds[0])?.name ?? "Selected team"}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 rounded-lg border p-3">
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
            Enter a team join code to be added as a viewer.
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
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <FieldDescription>
                  Send an email when someone mentions you.
                </FieldDescription>
                <Switch checked={emailMentions} onCheckedChange={setEmailMentions} />
              </div>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Email assignments</FieldLabel>
            <FieldContent>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
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
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
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

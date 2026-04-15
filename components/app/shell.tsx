"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  ArrowsClockwise,
  Bell,
  CaretDown,
  CaretRight,
  ChatCircleDots,
  Check,
  CheckCircle,
  CodesandboxLogo,
  CopySimple,
  DotsThree,
  EnvelopeSimple,
  Gear,
  HashStraight,
  Kanban,
  MagnifyingGlass,
  NotePencil,
  PaperPlaneTilt,
  Plus,
  PlusCircle,
  SignIn,
  SquaresFour,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  canAdminWorkspace,
  getAccessibleTeams,
  getCurrentUser,
  getCurrentWorkspace,
  getTeamFeatureSettings,
  getTeamRole,
  getTeamSurfaceDisableReasons,
} from "@/lib/domain/selectors"
import {
  createDefaultTeamFeatureSettings,
  getDefaultWorkItemTypesForTeamExperience,
  getDisplayLabelForWorkItemType,
  getDefaultTeamIconForExperience,
  getWorkSurfaceCopy,
  normalizeTeamIconToken,
  type Role,
  type TeamFeatureSettings,
  type TeamExperienceType,
  teamExperienceMeta,
  teamIconMeta,
  teamIconTokens,
  teamExperienceTypes,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn, resolveImageAssetSource } from "@/lib/utils"
import { TeamIconGlyph } from "@/components/app/entity-icons"
import { GlobalSearchDialog } from "@/components/app/global-search-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const workspaceAccentOptions = [
  "emerald",
  "blue",
  "amber",
  "rose",
  "slate",
] as const
type TeamSurfaceDisableReasons = {
  docs: string | null
  chat: string | null
  channels: string | null
}

const defaultTeamSurfaceDisableReasons: TeamSurfaceDisableReasons = {
  docs: null,
  chat: null,
  channels: null,
}

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const data = useAppStore()
  const unread = data.notifications.filter(
    (notification) =>
      notification.userId === data.currentUserId &&
      notification.readAt === null &&
      notification.archivedAt == null
  ).length
  const workspace = getCurrentWorkspace(data)
  const currentUser = getCurrentUser(data)
  const workspaceLogoImageSrc = resolveImageAssetSource(
    workspace?.logoImageUrl,
    workspace?.logoUrl
  )
  const currentUserAvatarImageSrc = resolveImageAssetSource(
    currentUser?.avatarImageUrl,
    currentUser?.avatarUrl
  )
  const pendingInviteCount = currentUser
    ? data.invites.filter((invite) => {
        if (invite.email.toLowerCase() !== currentUser.email.toLowerCase()) {
          return false
        }

        if (invite.acceptedAt || invite.declinedAt) {
          return false
        }

        return true
      }).length
    : 0
  const teams = getAccessibleTeams(data)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteMode, setInviteMode] = useState<"workspace" | "team">(
    "workspace"
  )
  const [invitePresetTeamIds, setInvitePresetTeamIds] = useState<string[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [workspaceSectionOpen, setWorkspaceSectionOpen] = useState(true)
  const [teamsSectionOpen, setTeamsSectionOpen] = useState(true)
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(
    () => new Set(teams.map((t) => t.id))
  )
  const canCreateTeam = canAdminWorkspace(data, data.currentWorkspaceId)

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

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading workspace...
      </div>
    )
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
                        {workspaceLogoImageSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={workspace?.name ?? "Workspace"}
                            className="size-full rounded-[5px] object-cover"
                            src={workspaceLogoImageSrc}
                          />
                        ) : (
                          workspace?.logoUrl
                        )}
                      </div>
                      <span className="truncate text-[12px] leading-none font-semibold">
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
                      <DropdownMenuItem asChild>
                        <Link href="/workspace/settings">
                          <Gear />
                          Workspace settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/invites"
                          className="flex w-full items-center justify-between gap-3"
                        >
                          <span className="flex items-center gap-2">
                            <PlusCircle />
                            <span>Join a workspace</span>
                          </span>
                          {pendingInviteCount > 0 ? (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none font-medium text-muted-foreground">
                              {pendingInviteCount}
                            </span>
                          ) : null}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          setInviteMode("workspace")
                          setInvitePresetTeamIds([])
                          setInviteOpen(true)
                        }}
                      >
                        <PaperPlaneTilt />
                        Invite to workspace
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
                  href="/chats"
                  icon={<ChatCircleDots />}
                  label="Chats"
                  active={pathname.startsWith("/chats")}
                />
                <SidebarLink
                  href="/assigned"
                  icon={<CheckCircle />}
                  label="My items"
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
                className="flex h-7 min-w-0 flex-1 items-center rounded-md text-left text-[10px] font-medium tracking-[0.16em] text-sidebar-foreground/70 uppercase transition-colors hover:text-sidebar-foreground"
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
                    href="/workspace/channel"
                    icon={<HashStraight />}
                    label="Channel"
                    active={pathname.startsWith("/workspace/channel")}
                  />
                  <SidebarLink
                    href="/workspace/docs"
                    icon={<NotePencil />}
                    label="Docs"
                    active={pathname.startsWith("/workspace/docs")}
                  />
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
                    href="/workspace/search"
                    icon={<MagnifyingGlass />}
                    label="Search"
                    active={pathname.startsWith("/workspace/search")}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            ) : null}
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarGroup>
            <div className="group/teams-header flex items-center justify-between px-2">
              <button
                type="button"
                className="flex h-7 min-w-0 flex-1 items-center rounded-md text-left text-[10px] font-medium tracking-[0.16em] text-sidebar-foreground/70 uppercase transition-colors hover:text-sidebar-foreground"
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
              {canCreateTeam ? (
                <Button
                  asChild
                  size="icon-xs"
                  variant="ghost"
                  className="pointer-events-none size-6 opacity-0 transition-opacity group-focus-within/teams-header:pointer-events-auto group-focus-within/teams-header:opacity-100 group-hover/teams-header:pointer-events-auto group-hover/teams-header:opacity-100"
                >
                  <Link href="/workspace/create-team">
                    <Plus className="size-3.5" />
                    <span className="sr-only">Create team</span>
                  </Link>
                </Button>
              ) : null}
            </div>
            {teamsSectionOpen ? (
              <SidebarGroupContent>
                <SidebarMenu>
                  {teams.map((team) => {
                    const isExpanded = expandedTeams.has(team.id)
                    const teamRole = getTeamRole(data, team.id)
                    const canInvite =
                      teamRole === "admin" || teamRole === "member"
                    const canManage = teamRole === "admin"
                    const features = getTeamFeatureSettings(team)

                    return (
                      <SidebarMenuItem key={team.id}>
                        <div className="group/team-row relative">
                          <SidebarMenuButton
                            className="pr-8 font-medium [&_svg]:size-2.5"
                            onClick={() => toggleTeam(team.id)}
                          >
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <TeamIconGlyph
                                icon={team.icon}
                                className="!size-3.5 shrink-0 text-sidebar-foreground/70"
                              />
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
                              <button className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/50 opacity-0 transition-opacity group-focus-within/team-row:opacity-100 group-hover/team-row:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:opacity-100">
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
                                  Invite to Team
                                </DropdownMenuItem>
                              ) : null}
                              {canManage ? (
                                <DropdownMenuItem asChild>
                                  <Link href={`/team/${team.slug}/settings`}>
                                    <Gear />
                                    Team settings
                                  </Link>
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
                                  isActive={pathname.startsWith(
                                    `/team/${team.slug}/chat`
                                  )}
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
                                  isActive={pathname.startsWith(
                                    `/team/${team.slug}/channel`
                                  )}
                                >
                                  <Link href={`/team/${team.slug}/channel`}>
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
                                  isActive={pathname.startsWith(
                                    `/team/${team.slug}/work`
                                  )}
                                >
                                  <Link href={`/team/${team.slug}/work`}>
                                    <CodesandboxLogo className="size-4" />
                                    <span>
                                      {
                                        getWorkSurfaceCopy(
                                          team.settings.experience
                                        ).surfaceLabel
                                      }
                                    </span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ) : null}
                            {features.projects ? (
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname.startsWith(
                                    `/team/${team.slug}/projects`
                                  )}
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
                                  isActive={pathname.startsWith(
                                    `/team/${team.slug}/views`
                                  )}
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
                                  isActive={pathname.startsWith(
                                    `/team/${team.slug}/docs`
                                  )}
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
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <div className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                      {currentUserAvatarImageSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={currentUser.name}
                          className="size-full rounded-full object-cover"
                          src={currentUserAvatarImageSrc}
                        />
                      ) : (
                        currentUser.avatarUrl
                      )}
                    </div>
                    <span className="truncate text-[12px]">
                      {currentUser.name}
                    </span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/settings/profile">
                        <UserCircle />
                        User settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <form
                        action="/auth/logout"
                        method="post"
                        className="w-full"
                      >
                        <button
                          type="submit"
                          className="flex w-full items-center gap-2"
                        >
                          <SignIn />
                          Sign out
                        </button>
                      </form>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
      <DialogContent
        key={`${workspace?.id ?? "workspace"}-${open}`}
        className="max-w-lg gap-0 overflow-hidden p-0"
      >
        <div className="px-5 pt-5 pb-1">
          <DialogHeader className="mb-1 p-0">
            <DialogTitle className="text-base">Workspace</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Identity and branding for {workspace?.name ?? "workspace"}.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-col border-t px-5 py-2">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Name</span>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-7 w-48 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">
              Logo / initials
            </span>
            <Input
              id="workspace-logo"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              className="h-7 w-48 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Accent</span>
            <Select value={accent} onValueChange={setAccent}>
              <SelectTrigger className="h-7 w-auto min-w-28 border-none bg-transparent text-xs capitalize shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {workspaceAccentOptions.map((option) => (
                    <SelectItem
                      key={option}
                      value={option}
                      className="capitalize"
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Description</span>
            <Input
              id="workspace-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="h-7 w-48 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getTeamLandingHref(teamSlug: string, features: TeamFeatureSettings) {
  if (features.issues) {
    return `/team/${teamSlug}/work`
  }

  if (features.chat) {
    return `/team/${teamSlug}/chat`
  }

  if (features.channels) {
    return `/team/${teamSlug}/channel`
  }

  if (features.docs) {
    return `/team/${teamSlug}/docs`
  }

  return `/team/${teamSlug}/work`
}

function TeamEditorFields({
  name,
  icon,
  summary,
  joinCode,
  experience,
  features,
  setName,
  setIcon,
  setSummary,
  setFeatures,
  savedFeatures,
  surfaceDisableReasons,
  disabled = false,
  canChangeExperience = false,
  showJoinCode = true,
  onExperienceChange,
  onRegenerateJoinCode,
  joinCodeReadonlyLabel = "Generated automatically after the team is created.",
}: {
  name: string
  icon: string
  summary: string
  joinCode: string
  experience: TeamExperienceType
  features: TeamFeatureSettings
  setName: (value: string) => void
  setIcon: (value: string) => void
  setSummary: (value: string) => void
  setFeatures: (
    value:
      | TeamFeatureSettings
      | ((current: TeamFeatureSettings) => TeamFeatureSettings)
  ) => void
  savedFeatures: TeamFeatureSettings
  surfaceDisableReasons: TeamSurfaceDisableReasons
  disabled?: boolean
  canChangeExperience?: boolean
  showJoinCode?: boolean
  onExperienceChange?: (experience: TeamExperienceType) => void
  onRegenerateJoinCode?: (() => Promise<void>) | null
  joinCodeReadonlyLabel?: string
}) {
  const selectedIcon = normalizeTeamIconToken(icon, experience)
  const workCopy = getWorkSurfaceCopy(experience)
  const coreSurfaceItems = [
    { key: "issues", label: workCopy.surfaceLabel },
    { key: "projects", label: "Projects" },
    { key: "views", label: "Views" },
  ]
  const coreWorkModel = getDefaultWorkItemTypesForTeamExperience(experience)
    .map((itemType) => getDisplayLabelForWorkItemType(itemType, experience))
    .join(" · ")
  const [copiedJoinCode, setCopiedJoinCode] = useState<string | null>(null)
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

  async function handleCopyJoinCode() {
    if (!joinCode) {
      return
    }

    try {
      await navigator.clipboard.writeText(joinCode)
      setCopiedJoinCode(joinCode)
      window.setTimeout(() => {
        setCopiedJoinCode(null)
      }, 1500)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to copy join code"
      )
    }
  }

  return (
    <div className="grid gap-8 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
      <div className="flex flex-col gap-8">
        <section>
          <h3 className="mb-4 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
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
                <FieldLabel htmlFor="team-icon">Icon</FieldLabel>
                <FieldContent>
                  <Select value={selectedIcon} onValueChange={setIcon}>
                    <SelectTrigger id="team-icon" className="justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <TeamIconGlyph icon={selectedIcon} className="size-4" />
                        <span>{teamIconMeta[selectedIcon].label}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {teamIconTokens.map((token) => (
                          <SelectItem key={token} value={token}>
                            <div className="flex items-center gap-2">
                              <TeamIconGlyph icon={token} className="size-4" />
                              <div className="flex min-w-0 flex-col">
                                <span className="text-sm">
                                  {teamIconMeta[token].label}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {teamIconMeta[token].description}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FieldContent>
                <FieldDescription>
                  Defaults to{" "}
                  {
                    teamIconMeta[getDefaultTeamIconForExperience(experience)]
                      .label
                  }{" "}
                  for {teamExperienceMeta[experience].label.toLowerCase()}{" "}
                  teams.
                </FieldDescription>
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
            {showJoinCode ? (
              <Field>
                <FieldLabel htmlFor="team-join-code">Join code</FieldLabel>
                <FieldContent>
                  <div className="flex gap-2">
                    <Input
                      id="team-join-code"
                      value={joinCode || "Generated on create"}
                      readOnly
                    />
                    {joinCode ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleCopyJoinCode()}
                      >
                        {copiedJoinCode === joinCode ? (
                          <Check />
                        ) : (
                          <CopySimple />
                        )}
                        {copiedJoinCode === joinCode ? "Copied" : "Copy"}
                      </Button>
                    ) : null}
                    {onRegenerateJoinCode ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void onRegenerateJoinCode()}
                      >
                        <ArrowsClockwise />
                        Regenerate
                      </Button>
                    ) : null}
                  </div>
                </FieldContent>
                <FieldDescription>{joinCodeReadonlyLabel}</FieldDescription>
              </Field>
            ) : null}
          </FieldGroup>
        </section>

        <section>
          <h3 className="mb-4 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Surfaces
          </h3>
          {experience === "community" ? (
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
                      disabled ||
                      (savedFeatures[feature.key] &&
                        Boolean(surfaceDisableReasons[feature.key]))
                    }
                    onCheckedChange={(checked) =>
                      setFeatures((current) => ({
                        ...current,
                        issues: false,
                        projects: false,
                        views: false,
                        [feature.key]: checked,
                      }))
                    }
                  />
                </div>
              ))}
              {!(features.docs || features.chat || features.channels) ? (
                <div className="pt-3 text-xs text-muted-foreground">
                  Enable at least one surface for community teams.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {coreSurfaceItems.map((feature) => (
                  <div
                    key={feature.key}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5"
                  >
                    <span className="text-sm">{feature.label}</span>
                    <Switch checked disabled className="scale-75" />
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Core model: {coreWorkModel}
              </p>

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
                        disabled ||
                        (savedFeatures[feature.key] &&
                          Boolean(surfaceDisableReasons[feature.key]))
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

      <div className="flex flex-col gap-8">
        <section>
          <h3 className="mb-4 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Team type
          </h3>
          {canChangeExperience ? (
            <div className="space-y-3">
              {teamExperienceTypes.map((type) => {
                const selected = type === experience

                return (
                  <button
                    key={type}
                    type="button"
                    className={cn(
                      "w-full rounded-lg border px-4 py-3 text-left transition-colors",
                      selected
                        ? "border-primary/40 bg-primary/5"
                        : "hover:bg-accent/40"
                    )}
                    onClick={() => onExperienceChange?.(type)}
                  >
                    <div className="text-sm font-medium">
                      {teamExperienceMeta[type].label}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {teamExperienceMeta[type].description}
                    </p>
                  </button>
                )
              })}
              <span className="inline-block text-[10px] tracking-wider text-muted-foreground/70 uppercase">
                Locked after creation
              </span>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/30 px-4 py-3">
              <div className="text-sm font-medium">
                {teamExperienceMeta[experience].label}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {teamExperienceMeta[experience].description}
              </p>
              <span className="mt-3 inline-block text-[10px] tracking-wider text-muted-foreground/70 uppercase">
                Locked after creation
              </span>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-4 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Notes
          </h3>
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>
              {workCopy.surfaceLabel}, projects, and views stay on for this team
              type.
            </p>
            <p>
              Community spaces can enable docs, chat, channel, or any
              combination.
            </p>
            <p>Docs remain optional for non-community teams.</p>
          </div>
        </section>
      </div>
    </div>
  )
}

function CreateTeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const data = useAppStore()
  const router = useRouter()
  const workspace = getCurrentWorkspace(data)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState(() =>
    getDefaultTeamIconForExperience("software-development")
  )
  const [summary, setSummary] = useState("")
  const [experience, setExperience] = useState<TeamExperienceType>(
    "software-development"
  )
  const [features, setFeatures] = useState<TeamFeatureSettings>(
    createDefaultTeamFeatureSettings("software-development")
  )
  const [saving, setSaving] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={`${workspace?.id ?? "workspace"}-${open}`}
        className="flex max-h-[88svh] flex-col overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-base">Create team</DialogTitle>
          <DialogDescription>
            Add a new team to {workspace?.name ?? "the current workspace"}.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <TeamEditorFields
            name={name}
            icon={icon}
            summary={summary}
            joinCode=""
            experience={experience}
            features={features}
            setName={setName}
            setIcon={(value) =>
              setIcon(normalizeTeamIconToken(value, experience))
            }
            setSummary={setSummary}
            setFeatures={setFeatures}
            savedFeatures={features}
            surfaceDisableReasons={defaultTeamSurfaceDisableReasons}
            canChangeExperience
            showJoinCode={false}
            onExperienceChange={(nextExperience) => {
              setExperience(nextExperience)
              setIcon(getDefaultTeamIconForExperience(nextExperience))
              setFeatures(createDefaultTeamFeatureSettings(nextExperience))
            }}
            joinCodeReadonlyLabel="A 12-character join code is generated automatically when the team is created."
          />
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
              const created = await useAppStore.getState().createTeam({
                name,
                icon,
                summary,
                experience,
                features,
              })
              setSaving(false)

              if (created) {
                onOpenChange(false)
                router.push(
                  getTeamLandingHref(created.teamSlug, created.features)
                )
              }
            }}
          >
            {saving ? "Creating..." : "Create team"}
          </Button>
        </div>
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
  const experience: TeamExperienceType =
    team?.settings.experience ?? "software-development"
  const [icon, setIcon] = useState(() =>
    normalizeTeamIconToken(team?.icon, experience)
  )
  const [summary, setSummary] = useState(team?.settings.summary ?? "")
  const [features, setFeatures] = useState(
    team?.settings.features ?? getTeamFeatureSettings(team)
  )
  const [saving, setSaving] = useState(false)

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
          <TeamEditorFields
            name={name}
            icon={icon}
            summary={summary}
            joinCode={team.settings.joinCode}
            experience={experience}
            features={features}
            setName={setName}
            setIcon={(value) =>
              setIcon(normalizeTeamIconToken(value, experience))
            }
            setSummary={setSummary}
            setFeatures={setFeatures}
            savedFeatures={savedFeatures}
            surfaceDisableReasons={surfaceDisableReasons}
            onRegenerateJoinCode={async () => {
              await useAppStore.getState().regenerateTeamJoinCode(team.id)
            }}
            joinCodeReadonlyLabel="This 12-character code is stored on the team and can be regenerated at any time."
          />
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
              const updated = await useAppStore
                .getState()
                .updateTeamDetails(team.id, {
                  name,
                  icon,
                  summary,
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
  const inviteableTeams = teams.filter((team) => {
    const teamRole = getTeamRole(data, team.id)
    return teamRole === "admin" || teamRole === "member"
  })
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
        key={`${data.ui.activeTeamId}-${mode}-${open}`}
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

function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const data = useAppStore()
  const currentUser = getCurrentUser(data)
  const [name, setName] = useState(currentUser?.name ?? "")
  const [title, setTitle] = useState(currentUser?.title ?? "")
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl ?? "")
  const [email, setEmail] = useState(currentUser?.email ?? "")
  const [emailMentions, setEmailMentions] = useState(
    currentUser?.preferences.emailMentions ?? false
  )
  const [emailAssignments, setEmailAssignments] = useState(
    currentUser?.preferences.emailAssignments ?? false
  )
  const [emailDigest, setEmailDigest] = useState(
    currentUser?.preferences.emailDigest ?? false
  )
  const [changingEmail, setChangingEmail] = useState(false)
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false)

  useEffect(() => {
    if (!currentUser) {
      return
    }

    setName(currentUser.name)
    setTitle(currentUser.title)
    setAvatarUrl(currentUser.avatarUrl)
    setEmail(currentUser.email)
    setEmailMentions(currentUser.preferences.emailMentions)
    setEmailAssignments(currentUser.preferences.emailAssignments)
    setEmailDigest(currentUser.preferences.emailDigest)
  }, [currentUser?.id])

  async function handleEmailChange() {
    if (!currentUser) {
      return
    }

    if (email.trim().toLowerCase() === currentUser.email.toLowerCase()) {
      toast.error("Enter a different email address")
      return
    }

    try {
      setChangingEmail(true)
      const response = await fetch("/api/account/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
        notice?: string
        logoutRequired?: boolean
      } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update your email address")
      }

      const notice =
        payload?.notice ??
        "Email updated. Verify the new address and then sign back in."

      onOpenChange(false)
      toast.success(notice)

      if (payload?.logoutRequired && typeof document !== "undefined") {
        const form = document.createElement("form")
        form.method = "POST"
        form.action = `/auth/logout?returnTo=${encodeURIComponent(
          `/login?notice=${encodeURIComponent(notice)}`
        )}`
        document.body.appendChild(form)
        form.submit()
      }
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : "Failed to update your email"
      )
    } finally {
      setChangingEmail(false)
    }
  }

  async function handlePasswordReset() {
    try {
      setSendingPasswordReset(true)
      const response = await fetch("/api/account/password-reset", {
        method: "POST",
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to start password reset")
      }

      toast.success("Password reset email sent")
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start password reset"
      )
    } finally {
      setSendingPasswordReset(false)
    }
  }

  if (!currentUser) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={`${currentUser.id}-${open}`}
        className="max-w-lg gap-0 overflow-hidden p-0"
      >
        <div className="px-5 pt-5 pb-1">
          <DialogHeader className="mb-1 p-0">
            <DialogTitle className="text-base">Profile</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {currentUser.name} · {currentUser.email}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-col border-t px-5 py-2">
          <div className="py-1.5">
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Identity
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Name</span>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-7 w-48 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Title</span>
            <Input
              id="profile-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-7 w-48 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">
              Avatar initials
            </span>
            <Input
              id="profile-avatar"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              className="h-7 w-48 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex flex-col border-t px-5 py-2">
          <div className="py-1.5">
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Notifications
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="min-w-0">
              <div className="text-xs">Email mentions</div>
              <div className="text-[11px] text-muted-foreground">
                Notified when someone mentions you.
              </div>
            </div>
            <Switch
              checked={emailMentions}
              onCheckedChange={setEmailMentions}
              className="scale-90"
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="min-w-0">
              <div className="text-xs">Email assignments</div>
              <div className="text-[11px] text-muted-foreground">
                Notified when work is assigned to you.
              </div>
            </div>
            <Switch
              checked={emailAssignments}
              onCheckedChange={setEmailAssignments}
              className="scale-90"
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="min-w-0">
              <div className="text-xs">Email digest</div>
              <div className="text-[11px] text-muted-foreground">
                Unread notifications in a daily digest.
              </div>
            </div>
            <Switch
              checked={emailDigest}
              onCheckedChange={setEmailDigest}
              className="scale-90"
            />
          </div>
        </div>

        <div className="flex flex-col border-t px-5 py-2">
          <div className="py-1.5">
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Account
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Email</span>
            <Input
              id="profile-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="h-7 w-56 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex flex-wrap gap-2 py-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={changingEmail}
              onClick={() => {
                void handleEmailChange()
              }}
            >
              {changingEmail ? "Updating..." : "Change email"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sendingPasswordReset}
              onClick={() => {
                void handlePasswordReset()
              }}
            >
              {sendingPasswordReset ? "Sending..." : "Password reset"}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              useAppStore.getState().updateCurrentUserProfile({
                name,
                title,
                avatarUrl,
                preferences: {
                  emailMentions,
                  emailAssignments,
                  emailDigest,
                  theme: currentUser.preferences.theme,
                },
              })
              onOpenChange(false)
            }}
          >
            Save profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

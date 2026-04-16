"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"
import {
  Bell,
  CaretDown,
  CaretRight,
  ChatCircleDots,
  CheckCircle,
  CodesandboxLogo,
  DotsThree,
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
  X,
} from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import {
  canAdminWorkspace,
  getAccessibleTeams,
  getCurrentUser,
  getCurrentWorkspace,
  getTeamFeatureSettings,
} from "@/lib/domain/selectors"
import {
  getWorkSurfaceCopy,
  resolveUserStatus,
  type UserStatus,
  userStatusMeta,
  userStatuses,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { resolveImageAssetSource } from "@/lib/utils"
import { TeamIconGlyph } from "@/components/app/entity-icons"
import { GlobalSearchDialog } from "@/components/app/global-search-dialog"
import { InviteDialog } from "@/components/app/shell/invite-dialog"
import { SidebarLink } from "@/components/app/shell/sidebar-link"
import { StatusDialog } from "@/components/app/shell/status-dialog"
import { UserHoverCard, UserStatusDot } from "@/components/app/user-presence"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarSeparator,
} from "@/components/ui/sidebar"

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const unread = useAppStore(
    (state) =>
      state.notifications.filter(
        (notification) =>
          notification.userId === state.currentUserId &&
          notification.readAt === null &&
          notification.archivedAt == null
      ).length
  )
  const workspace = useAppStore(getCurrentWorkspace)
  const currentUser = useAppStore(getCurrentUser)
  const pendingInviteCount = useAppStore((state) => {
    const user = getCurrentUser(state)

    if (!user) {
      return 0
    }

    return state.invites.filter((invite) => {
      if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
        return false
      }

      if (invite.acceptedAt || invite.declinedAt) {
        return false
      }

      return true
    }).length
  })
  const teams = useAppStore(useShallow((state) => getAccessibleTeams(state)))
  const currentMemberships = useAppStore(
    useShallow((state) =>
      state.teamMemberships.filter(
        (membership) => membership.userId === state.currentUserId
      )
    )
  )
  const currentUserId = useAppStore((state) => state.currentUserId)
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId)
  const canCreateTeam = useAppStore((state) =>
    canAdminWorkspace(state, state.currentWorkspaceId)
  )
  const workspaceLogoImageSrc = resolveImageAssetSource(
    workspace?.logoImageUrl,
    workspace?.logoUrl
  )
  const currentUserAvatarImageSrc = resolveImageAssetSource(
    currentUser?.avatarImageUrl,
    currentUser?.avatarUrl
  )
  const currentUserStatus = resolveUserStatus(currentUser?.status)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteMode, setInviteMode] = useState<"workspace" | "team">(
    "workspace"
  )
  const [invitePresetTeamIds, setInvitePresetTeamIds] = useState<string[]>([])
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [workspaceSectionOpen, setWorkspaceSectionOpen] = useState(true)
  const [teamsSectionOpen, setTeamsSectionOpen] = useState(true)
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(
    () => new Set(teams.map((t) => t.id))
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
        return
      }

      event.preventDefault()

      if (event.shiftKey) {
        setSearchOpen(false)
        router.push("/workspace/search")
        return
      }

      setSearchOpen((current) => !current)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [router])

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
      <StatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
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
                    const teamRole =
                      currentMemberships.find(
                        (membership) => membership.teamId === team.id
                      )?.role ?? null
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
                    <div className="relative flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
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
                      <UserStatusDot
                        status={currentUserStatus}
                        className="absolute -right-0.5 -bottom-0.5 size-2.5 ring-2 ring-background"
                      />
                    </div>
                    <span className="truncate text-[12px]">
                      {currentUser.name}
                    </span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <UserHoverCard
                    user={currentUser}
                    userId={currentUser.id}
                    currentUserId={currentUserId}
                    workspaceId={currentWorkspaceId}
                    side="right"
                  >
                    <DropdownMenuLabel className="space-y-1.5">
                      <div className="font-medium text-foreground">
                        {currentUser.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <UserStatusDot status={currentUserStatus} />
                        <span>{userStatusMeta[currentUserStatus].label}</span>
                      </div>
                    </DropdownMenuLabel>
                  </UserHoverCard>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <UserStatusDot status={currentUserStatus} />
                        Set status
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-52">
                        <DropdownMenuRadioGroup
                          value={currentUserStatus}
                          onValueChange={(value) => {
                            useAppStore.getState().updateCurrentUserStatus({
                              status: value as UserStatus,
                              statusMessage: currentUser.statusMessage,
                            })
                          }}
                        >
                          {userStatuses.map((status) => (
                            <DropdownMenuRadioItem key={status} value={status}>
                              <UserStatusDot status={status} />
                              {userStatusMeta[status].label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem
                      onSelect={() => {
                        setStatusDialogOpen(true)
                      }}
                    >
                      <NotePencil />
                      {currentUser.statusMessage
                        ? "Edit status message"
                        : "Set status message"}
                    </DropdownMenuItem>
                    {currentUser.statusMessage ? (
                      <DropdownMenuItem
                        onSelect={() => {
                          useAppStore.getState().updateCurrentUserStatus({
                            status: currentUserStatus,
                            statusMessage: "",
                          })
                        }}
                      >
                        <X />
                        Clear status message
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
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
      </Sidebar>
      <SidebarInset>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export { WorkspaceDialog } from "@/components/app/shell/workspace-dialog"
export {
  CreateTeamDialog,
  TeamDetailsDialog,
} from "@/components/app/shell/team-dialogs"
export { ProfileDialog } from "@/components/app/shell/profile-dialog"

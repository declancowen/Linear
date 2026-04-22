"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react"
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
  SignOut,
  SquaresFour,
  UserCircle,
  X,
} from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import { fetchWorkspaceMembershipReadModel } from "@/lib/convex/client/read-models"
import {
  canAdminWorkspace,
  getAccessibleTeams,
  getCurrentUser,
  getCurrentWorkspace,
  getTeam,
  canEditWorkspace,
  getTeamFeatureSettings,
  isWorkspaceOwner,
} from "@/lib/domain/selectors"
import {
  type CreateDialogState,
  getWorkSurfaceCopy,
  resolveUserStatus,
  type UserStatus,
  userStatusMeta,
  userStatuses,
} from "@/lib/domain/types"
import { buildGlobalCreateActions } from "@/lib/domain/search-create-actions"
import {
  openManagedCreateDialog,
  openTopLevelDialog,
} from "@/lib/browser/dialog-transitions"
import { blurActiveElement } from "@/lib/browser/focus"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import {
  createShellContextScopeKey,
  createWorkspaceMembershipScopeKey,
} from "@/lib/scoped-sync/scope-keys"
import { useAppStore } from "@/lib/store/app-store"
import { resolveImageAssetSource } from "@/lib/utils"
import { TeamIconGlyph } from "@/components/app/entity-icons"
import { GlobalSearchDialog } from "@/components/app/global-search-dialog"
import { useShortcutModifierLabel } from "@/components/app/shortcut-keys"
import { CreateViewDialog } from "@/components/app/screens/create-view-dialog"
import { CreateProjectDialog } from "@/components/app/screens/project-creation"
import { CreateWorkItemDialog } from "@/components/app/screens/create-work-item-dialog"
import { InviteDialog } from "@/components/app/shell/invite-dialog"
import { SidebarLink } from "@/components/app/shell/sidebar-link"
import { StatusDialog } from "@/components/app/shell/status-dialog"
import { UserHoverCard, UserStatusDot } from "@/components/app/user-presence"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
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
  clampSidebarWidth,
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
  useSidebar,
} from "@/components/ui/sidebar"

type AppShellProps = {
  children: ReactNode
}

function SidebarInsetResizeHandle() {
  const {
    desktopWidth,
    isMobile,
    setDesktopWidth,
    isResizing,
    setIsResizing,
    state,
  } = useSidebar()
  const dragStateRef = useRef<{
    startWidth: number
    startX: number
  } | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const nextWidthRef = useRef(desktopWidth)

  useEffect(() => {
    if (!isResizing) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current

      if (!dragState) {
        return
      }

      nextWidthRef.current = clampSidebarWidth(
        dragState.startWidth + (event.clientX - dragState.startX)
      )

      if (animationFrameRef.current != null) {
        return
      }

      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null
        setDesktopWidth(nextWidthRef.current)
      })
    }

    const stopResize = () => {
      dragStateRef.current = null
      if (animationFrameRef.current != null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      setIsResizing(false)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", stopResize)
    window.addEventListener("pointercancel", stopResize)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", stopResize)
      window.removeEventListener("pointercancel", stopResize)
      if (animationFrameRef.current != null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
    }
  }, [isResizing, setDesktopWidth, setIsResizing])

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || isMobile || state === "collapsed") {
      return
    }

    event.preventDefault()
    dragStateRef.current = {
      startWidth: desktopWidth,
      startX: event.clientX,
    }
    setIsResizing(true)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  return (
    <button
      type="button"
      aria-label="Resize sidebar"
      onPointerDown={handlePointerDown}
      className="absolute inset-y-0 left-0 z-30 hidden w-4 -translate-x-1/2 cursor-col-resize touch-none bg-transparent outline-hidden select-none peer-data-[state=collapsed]:hidden md:block"
    />
  )
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
  const activeTeamId = useAppStore((state) => state.ui.activeTeamId)
  const activeCreateDialog = useAppStore((state) => state.ui.activeCreateDialog)
  useScopedReadModelRefresh({
    enabled: Boolean(currentUserId) && Boolean(currentWorkspaceId),
    scopeKeys: currentWorkspaceId
      ? [
          createShellContextScopeKey(),
          createWorkspaceMembershipScopeKey(currentWorkspaceId),
        ]
      : [],
    fetchLatest: async () => fetchWorkspaceMembershipReadModel(currentWorkspaceId),
  })
  const canCreateTeam = useAppStore((state) =>
    canAdminWorkspace(state, state.currentWorkspaceId)
  )
  const canEditCurrentWorkspace = useAppStore((state) =>
    currentWorkspaceId ? canEditWorkspace(state, currentWorkspaceId) : false
  )
  const activeTeam = useAppStore((state) => getTeam(state, activeTeamId))
  const canOpenWorkspaceSettings = useAppStore((state) => {
    const currentWorkspace = getCurrentWorkspace(state)

    return currentWorkspace
      ? isWorkspaceOwner(state, currentWorkspace.id)
      : false
  })
  const canLeaveWorkspace = useAppStore((state) => {
    const currentWorkspace = getCurrentWorkspace(state)

    if (!currentWorkspace || canAdminWorkspace(state, currentWorkspace.id)) {
      return false
    }

    const workspaceTeamIds = new Set(
      state.teams
        .filter((team) => team.workspaceId === currentWorkspace.id)
        .map((team) => team.id)
    )

    return state.teamMemberships.some(
      (membership) =>
        membership.userId === state.currentUserId &&
        workspaceTeamIds.has(membership.teamId)
    )
  })
  const workspaceLogoImageSrc = resolveImageAssetSource(
    workspace?.logoImageUrl,
    workspace?.logoUrl
  )
  const currentUserAvatarImageSrc = resolveImageAssetSource(
    currentUser?.avatarImageUrl,
    currentUser?.avatarUrl
  )
  const currentUserStatus = resolveUserStatus(currentUser?.status)
  const editableTeamIds = new Set(
    currentMemberships
      .filter(
        (membership) =>
          membership.role === "admin" || membership.role === "member"
      )
      .map((membership) => membership.teamId)
  )
  const editableTeams = teams.filter((team) => editableTeamIds.has(team.id))
  const workItemCreateTeams = editableTeams.filter(
    (team) => getTeamFeatureSettings(team).issues
  )
  const projectCreateTeams = editableTeams.filter(
    (team) => getTeamFeatureSettings(team).projects
  )
  const viewCreateTeams = editableTeams.filter(
    (team) => getTeamFeatureSettings(team).views
  )

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteMode, setInviteMode] = useState<"workspace" | "team">(
    "workspace"
  )
  const [invitePresetTeamIds, setInvitePresetTeamIds] = useState<string[]>([])
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchQueryRef = useRef("")
  const searchShortcutModifierLabel = useShortcutModifierLabel()
  const [workspaceSectionOpen, setWorkspaceSectionOpen] = useState(true)
  const [teamsSectionOpen, setTeamsSectionOpen] = useState(true)
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(
    () => new Set(teams.map((t) => t.id))
  )
  const [teamPendingLeave, setTeamPendingLeave] = useState<{
    id: string
    slug: string
    name: string
  } | null>(null)
  const [leavingTeamId, setLeavingTeamId] = useState<string | null>(null)
  const [workspacePendingLeave, setWorkspacePendingLeave] = useState<{
    id: string
    name: string
  } | null>(null)
  const [leavingWorkspaceId, setLeavingWorkspaceId] = useState<string | null>(
    null
  )

  function handleSearchOpenChange(open: boolean) {
    if (open) {
      blurActiveElement()
    }

    setSearchOpen(open)

    if (!open) {
      searchQueryRef.current = ""
    }
  }

  function openFullSearch(query = "") {
    const trimmedQuery = query.trim()
    const href =
      trimmedQuery.length > 0
        ? `/workspace/search?q=${encodeURIComponent(trimmedQuery)}`
        : "/workspace/search"

    handleSearchOpenChange(false)
    router.push(href)
  }

  function openCreateDialog(dialog: CreateDialogState) {
    openManagedCreateDialog(dialog, {
      beforeOpen: () => {
        handleSearchOpenChange(false)
      },
    })
  }

  function closeCreateDialog() {
    useAppStore.getState().closeCreateDialog()
  }

  function openWorkspaceInviteDialog() {
    openTopLevelDialog(() => {
      setInviteMode("workspace")
      setInvitePresetTeamIds([])
      setInviteOpen(true)
    })
  }

  function openTeamInviteDialog(teamId: string) {
    openTopLevelDialog(() => {
      setInviteMode("team")
      setInvitePresetTeamIds([teamId])
      setInviteOpen(true)
    })
  }

  function openStatusMessageDialog() {
    openTopLevelDialog(() => {
      setStatusDialogOpen(true)
    })
  }

  const createActions = buildGlobalCreateActions({
    activeTeamId: activeTeam?.id ?? null,
    workItemCreateTeams,
    projectCreateTeams,
    viewTeams: viewCreateTeams,
    workspaceViewOption:
      workspace && canEditCurrentWorkspace
        ? {
            id: workspace.id,
            name: workspace.name,
          }
        : null,
  })

  async function handleLeaveTeam() {
    if (!teamPendingLeave) {
      return
    }

    const targetTeam = teamPendingLeave

    try {
      setLeavingTeamId(targetTeam.id)
      const left = await useAppStore.getState().leaveTeam(targetTeam.id)

      if (!left) {
        return
      }

      setTeamPendingLeave(null)

      if (!useAppStore.getState().currentWorkspaceId) {
        router.replace("/")
        return
      }

      if (pathname.startsWith(`/team/${targetTeam.slug}`)) {
        router.replace("/workspace/projects")
        return
      }

      router.refresh()
    } finally {
      setLeavingTeamId(null)
    }
  }

  async function handleLeaveWorkspace() {
    if (!workspacePendingLeave) {
      return
    }

    try {
      setLeavingWorkspaceId(workspacePendingLeave.id)
      const left = await useAppStore.getState().leaveWorkspace()

      if (!left) {
        return
      }

      setWorkspacePendingLeave(null)
      router.replace(
        useAppStore.getState().currentWorkspaceId ? "/workspace/projects" : "/"
      )
    } finally {
      setLeavingWorkspaceId(null)
    }
  }

  const handleSearchShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (
      !(event.metaKey || event.ctrlKey) ||
      event.altKey ||
      event.shiftKey ||
      event.repeat ||
      event.key.toLowerCase() !== "k"
    ) {
      return
    }

    event.preventDefault()

    if (searchOpen) {
      openFullSearch(searchQueryRef.current)
      return
    }

    handleSearchOpenChange(true)
  })

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      handleSearchShortcut(event)
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
      <StatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
      />
      {activeCreateDialog?.kind === "workItem" ? (
        <CreateWorkItemDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              closeCreateDialog()
            }
          }}
          defaultTeamId={activeCreateDialog.defaultTeamId}
          defaultProjectId={activeCreateDialog.defaultProjectId}
          initialType={activeCreateDialog.initialType}
        />
      ) : null}
      {activeCreateDialog?.kind === "project" ? (
        <CreateProjectDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              closeCreateDialog()
            }
          }}
          defaultTeamId={activeCreateDialog.defaultTeamId}
        />
      ) : null}
      {activeCreateDialog?.kind === "view" ? (
        <CreateViewDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              closeCreateDialog()
            }
          }}
          dialog={activeCreateDialog}
        />
      ) : null}
      {searchOpen ? (
        <GlobalSearchDialog
          open={searchOpen}
          onOpenChange={handleSearchOpenChange}
          onQueryChange={(query) => {
            searchQueryRef.current = query
          }}
          onOpenFullSearch={openFullSearch}
          createActions={createActions}
          onSelectCreateAction={(action) => {
            if (action.kind === "project") {
              openCreateDialog({
                kind: "project",
                defaultTeamId: action.defaultTeamId,
              })
              return
            }

            if (action.kind === "view") {
              openCreateDialog({
                kind: "view",
                defaultScopeType: action.defaultScopeType,
                defaultScopeId: action.defaultScopeId,
              })
              return
            }

            openCreateDialog({
              kind: "workItem",
              defaultTeamId: action.defaultTeamId,
              initialType: action.workItemType,
            })
          }}
          fullSearchShortcutKeys={[searchShortcutModifierLabel, "K"]}
        />
      ) : null}
      <Sidebar variant="inset">
        <SidebarHeader className="pb-1">
          <div className="flex items-center gap-1">
            <SidebarMenu className="min-w-0 flex-1">
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton className="h-9">
                      <div className="flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-primary text-[10px] font-bold text-primary-foreground">
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
                        className="ml-auto size-2.5 shrink-0 text-sidebar-foreground/50"
                        weight="fill"
                      />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      {canOpenWorkspaceSettings ? (
                        <DropdownMenuItem asChild>
                          <Link href="/workspace/settings">
                            <Gear />
                            Workspace settings
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
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
                      <DropdownMenuItem onSelect={openWorkspaceInviteDialog}>
                        <PaperPlaneTilt />
                        Invite to workspace
                      </DropdownMenuItem>
                      {canLeaveWorkspace ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                              if (!workspace) {
                                return
                              }

                              setWorkspacePendingLeave({
                                id: workspace.id,
                                name: workspace.name,
                              })
                            }}
                          >
                            <SignOut />
                            Leave workspace
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
            <Button
              size="icon-xs"
              variant="ghost"
              className="ml-auto shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={() => handleSearchOpenChange(true)}
            >
              <MagnifyingGlass className="size-3.5" />
            </Button>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="pt-1">
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
                    const canLeave = teamRole !== null && teamRole !== "admin"
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
                              {canInvite || canManage ? (
                                <DropdownMenuGroup>
                                  {canInvite ? (
                                    <DropdownMenuItem
                                      onSelect={() => {
                                        openTeamInviteDialog(team.id)
                                      }}
                                    >
                                      <Plus />
                                      Invite to Team
                                    </DropdownMenuItem>
                                  ) : null}
                                  {canManage ? (
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/team/${team.slug}/settings`}
                                      >
                                        <Gear />
                                        Team settings
                                      </Link>
                                    </DropdownMenuItem>
                                  ) : null}
                                </DropdownMenuGroup>
                              ) : null}
                              {canLeave ? (
                                <>
                                  {canInvite || canManage ? (
                                    <DropdownMenuSeparator />
                                  ) : null}
                                  <DropdownMenuGroup>
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onSelect={() => {
                                        setTeamPendingLeave({
                                          id: team.id,
                                          slug: team.slug,
                                          name: team.name,
                                        })
                                      }}
                                    >
                                      <SignOut />
                                      Leave team
                                    </DropdownMenuItem>
                                  </DropdownMenuGroup>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {isExpanded ? (
                          <SidebarMenuSub className="mx-0 translate-x-0 gap-0.5 border-l-0 px-0 py-0">
                            {features.chat ? (
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  className="pl-8"
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
                                  className="pl-8"
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
                                  className="pl-8"
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
                                  className="pl-8"
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
                                  className="pl-8"
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
                                  className="pl-8"
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
                    <DropdownMenuItem onSelect={openStatusMessageDialog}>
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
        <SidebarInsetResizeHandle />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </SidebarInset>
      <ConfirmDialog
        open={teamPendingLeave !== null}
        onOpenChange={(open) => {
          if (open || leavingTeamId) {
            return
          }

          setTeamPendingLeave(null)
        }}
        title="Leave team"
        description={
          teamPendingLeave
            ? `You will lose access to ${teamPendingLeave.name} immediately.`
            : "You will lose access to this team immediately."
        }
        confirmLabel="Leave team"
        variant="destructive"
        loading={leavingTeamId !== null}
        onConfirm={() => void handleLeaveTeam()}
      />
      <ConfirmDialog
        open={workspacePendingLeave !== null}
        onOpenChange={(open) => {
          if (open || leavingWorkspaceId) {
            return
          }

          setWorkspacePendingLeave(null)
        }}
        title="Leave workspace"
        description={
          workspacePendingLeave
            ? `You will lose access to ${workspacePendingLeave.name} and all of its teams immediately.`
            : "You will lose access to this workspace immediately."
        }
        confirmLabel="Leave workspace"
        variant="destructive"
        loading={leavingWorkspaceId !== null}
        onConfirm={() => void handleLeaveWorkspace()}
      />
    </SidebarProvider>
  )
}

export { WorkspaceDialog } from "@/components/app/shell/workspace-dialog"
export {
  CreateTeamDialog,
  TeamDetailsDialog,
} from "@/components/app/shell/team-dialogs"
export { ProfileDialog } from "@/components/app/shell/profile-dialog"

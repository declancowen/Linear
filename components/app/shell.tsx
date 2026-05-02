"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import {
  fetchNotificationInboxReadModel,
  fetchWorkspaceMembershipReadModel,
} from "@/lib/convex/client/read-models"
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
  type Notification,
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
import { useExpiringRetainedValue } from "@/hooks/use-expiring-retained-value"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import {
  createShellContextScopeKey,
  createWorkspaceMembershipScopeKey,
} from "@/lib/scoped-sync/scope-keys"
import { getNotificationInboxScopeKeys } from "@/lib/scoped-sync/read-models"
import { useAppStore } from "@/lib/store/app-store"
import { resolveImageAssetSource } from "@/lib/utils"
import { TeamIconGlyph } from "@/components/app/entity-icons"
import { GlobalSearchDialog } from "@/components/app/global-search-dialog"
import {
  appendPendingNotificationToastIds,
  getNotificationHref,
  initializePendingNotificationToastIds,
  isViewingNotificationTarget,
} from "@/components/app/notification-routing"
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

const SHELL_CONTEXT_GRACE_PERIOD_MS = 1000
const NOTIFICATION_TOAST_DURATION_MS = 5000

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

function ShellFrameFallback() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-72 border-r bg-sidebar/40 px-4 py-5 md:block">
        <div className="space-y-3">
          <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-8 space-y-3">
          <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="border-b px-6 py-4">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        </header>
        <main className="flex-1 px-6 py-8">
          <div className="max-w-xl space-y-3">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        </main>
      </div>
    </div>
  )
}

function NotificationToastContent({
  notification,
  onDismiss,
  onOpen,
}: {
  notification: Notification
  onDismiss: () => void
  onOpen: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex w-[min(360px,calc(100vw-2rem))] cursor-pointer items-start gap-3 rounded-lg border border-line/60 bg-background/95 p-3 text-left text-foreground shadow-[0_8px_30px_-12px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-colors outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return
        }

        event.preventDefault()
        onOpen()
      }}
    >
      <span className="bg-brand/10 text-brand mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md">
        <Bell className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-5 font-medium">
          New notification
        </span>
        <span className="line-clamp-2 block text-[12px] leading-4 text-fg-3">
          {notification.message}
        </span>
      </span>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation()
          onDismiss()
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentHash, setCurrentHash] = useState("")
  const unread = useAppStore(
    (state) =>
      state.notifications.filter(
        (notification) =>
          notification.userId === state.currentUserId &&
          notification.readAt === null &&
          notification.archivedAt == null
      ).length
  )
  const notificationToastCandidates = useAppStore(
    useShallow((state) =>
      state.notifications
        .filter(
          (notification) =>
            notification.userId === state.currentUserId &&
            notification.readAt === null &&
            notification.archivedAt == null
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    )
  )
  const notificationRouteData = useAppStore(
    useShallow((state) => ({
      channelPosts: state.channelPosts,
      conversations: state.conversations,
      projects: state.projects,
      teams: state.teams,
    }))
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
  const renderedCurrentUser = useExpiringRetainedValue({
    value: currentUser,
    retentionKey: currentUserId ?? null,
    gracePeriodMs: SHELL_CONTEXT_GRACE_PERIOD_MS,
  })
  const renderedWorkspace = useExpiringRetainedValue({
    value: workspace,
    retentionKey: currentWorkspaceId ?? null,
    gracePeriodMs: SHELL_CONTEXT_GRACE_PERIOD_MS,
  })

  useScopedReadModelRefresh({
    enabled: Boolean(currentUserId) && Boolean(currentWorkspaceId),
    scopeKeys: currentWorkspaceId
      ? [
          createShellContextScopeKey(),
          createWorkspaceMembershipScopeKey(currentWorkspaceId),
        ]
      : [],
    fetchLatest: async () =>
      fetchWorkspaceMembershipReadModel(currentWorkspaceId),
  })
  const { hasLoadedOnce: hasLoadedNotificationInbox } =
    useScopedReadModelRefresh({
      enabled: Boolean(currentUserId),
      scopeKeys: currentUserId
        ? getNotificationInboxScopeKeys(currentUserId)
        : [],
      fetchLatest: async () =>
        fetchNotificationInboxReadModel(currentUserId ?? ""),
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
    renderedWorkspace?.logoImageUrl,
    renderedWorkspace?.logoUrl
  )
  const currentUserAvatarImageSrc = resolveImageAssetSource(
    renderedCurrentUser?.avatarImageUrl,
    renderedCurrentUser?.avatarUrl
  )
  const currentUserStatus = resolveUserStatus(renderedCurrentUser?.status)
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
  const knownNotificationIdsRef = useRef<Set<string> | null>(null)
  const pendingNotificationToastIdsRef = useRef<string[]>([])
  const notificationToastUserIdRef = useRef<string | null>(null)
  const notificationToastStartedAtRef = useRef("")
  const notificationToastFlushTimeoutRef = useRef<number | null>(null)
  const [notificationToastQueueTick, setNotificationToastQueueTick] =
    useState(0)
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
      renderedWorkspace && canEditCurrentWorkspace
        ? {
            id: renderedWorkspace.id,
            name: renderedWorkspace.name,
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

  useEffect(() => {
    function updateCurrentHash() {
      setCurrentHash(window.location.hash)
    }

    updateCurrentHash()
    window.addEventListener("hashchange", updateCurrentHash)

    return () => {
      window.removeEventListener("hashchange", updateCurrentHash)
    }
  }, [pathname])

  useEffect(
    () => () => {
      if (notificationToastFlushTimeoutRef.current !== null) {
        window.clearTimeout(notificationToastFlushTimeoutRef.current)
        notificationToastFlushTimeoutRef.current = null
      }
    },
    []
  )

  useEffect(() => {
    if (notificationToastUserIdRef.current !== currentUserId) {
      notificationToastUserIdRef.current = currentUserId
      notificationToastStartedAtRef.current = new Date().toISOString()
      knownNotificationIdsRef.current = null
      pendingNotificationToastIdsRef.current = []

      if (notificationToastFlushTimeoutRef.current !== null) {
        window.clearTimeout(notificationToastFlushTimeoutRef.current)
        notificationToastFlushTimeoutRef.current = null
      }
    }

    if (!currentUserId || !hasLoadedNotificationInbox) {
      return
    }

    let knownNotificationIds = knownNotificationIdsRef.current

    if (knownNotificationIds === null) {
      knownNotificationIds = new Set()
      knownNotificationIdsRef.current = knownNotificationIds
      initializePendingNotificationToastIds({
        candidates: notificationToastCandidates,
        knownIds: knownNotificationIds,
        pendingIds: pendingNotificationToastIdsRef.current,
        startedAt: notificationToastStartedAtRef.current,
      })
    } else {
      appendPendingNotificationToastIds({
        candidates: notificationToastCandidates,
        knownIds: knownNotificationIds,
        pendingIds: pendingNotificationToastIdsRef.current,
      })
    }

    if (notificationToastFlushTimeoutRef.current !== null) {
      return
    }

    while (pendingNotificationToastIdsRef.current.length > 0) {
      const nextNotificationId = pendingNotificationToastIdsRef.current.shift()
      const nextNotification =
        notificationToastCandidates.find(
          (notification) => notification.id === nextNotificationId
        ) ?? null

      if (!nextNotification) {
        continue
      }

      const href = getNotificationHref(notificationRouteData, nextNotification)

      if (
        isViewingNotificationTarget({
          notification: nextNotification,
          href,
          pathname,
          searchParams,
          hash: currentHash,
        })
      ) {
        useAppStore.getState().markNotificationRead(nextNotification.id)
        continue
      }

      toast.custom(
        (toastId) => (
          <NotificationToastContent
            notification={nextNotification}
            onDismiss={() => toast.dismiss(toastId)}
            onOpen={() => {
              toast.dismiss(toastId)

              if (!href) {
                return
              }

              useAppStore.getState().markNotificationRead(nextNotification.id)
              router.push(href)
            }}
          />
        ),
        {
          id: `notification-${nextNotification.id}`,
          duration: NOTIFICATION_TOAST_DURATION_MS,
          position: "bottom-right",
        }
      )

      notificationToastFlushTimeoutRef.current = window.setTimeout(() => {
        notificationToastFlushTimeoutRef.current = null
        setNotificationToastQueueTick((current) => current + 1)
      }, NOTIFICATION_TOAST_DURATION_MS)

      return
    }
  }, [
    currentUserId,
    currentHash,
    hasLoadedNotificationInbox,
    notificationToastCandidates,
    notificationToastQueueTick,
    notificationRouteData,
    pathname,
    router,
    searchParams,
  ])

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

  if (!renderedCurrentUser || !renderedWorkspace) {
    return <ShellFrameFallback />
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
          defaultValues={activeCreateDialog.defaultValues}
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
                            alt={renderedWorkspace.name}
                            className="size-full rounded-[5px] object-cover"
                            src={workspaceLogoImageSrc}
                          />
                        ) : (
                          renderedWorkspace.logoUrl
                        )}
                      </div>
                      <span className="truncate text-[12px] leading-none font-semibold">
                        {renderedWorkspace.name}
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
                              setWorkspacePendingLeave({
                                id: renderedWorkspace.id,
                                name: renderedWorkspace.name,
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
                          alt={renderedCurrentUser.name}
                          className="size-full rounded-full object-cover"
                          src={currentUserAvatarImageSrc}
                        />
                      ) : (
                        renderedCurrentUser.avatarUrl
                      )}
                      <UserStatusDot
                        status={currentUserStatus}
                        className="absolute -right-0.5 -bottom-0.5 size-2.5 ring-2 ring-background"
                      />
                    </div>
                    <span className="truncate text-[12px]">
                      {renderedCurrentUser.name}
                    </span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <UserHoverCard
                    user={renderedCurrentUser}
                    userId={renderedCurrentUser.id}
                    currentUserId={currentUserId}
                    workspaceId={currentWorkspaceId}
                    side="right"
                  >
                    <DropdownMenuLabel className="space-y-1.5">
                      <div className="font-medium text-foreground">
                        {renderedCurrentUser.name}
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
                              statusMessage: renderedCurrentUser.statusMessage,
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
                      {renderedCurrentUser.statusMessage
                        ? "Edit status message"
                        : "Set status message"}
                    </DropdownMenuItem>
                    {renderedCurrentUser.statusMessage ? (
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

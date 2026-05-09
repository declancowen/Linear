"use client"

import { useRouter } from "next/navigation"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import {
  getChannelPostHref,
  getConversationHref,
  getProject,
  getProjectHref,
} from "@/lib/domain/selectors"
import { type Notification } from "@/lib/domain/types"
import { fetchNotificationInboxReadModel, syncAcceptInvite } from "@/lib/convex/client"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import { getNotificationInboxScopeKeys } from "@/lib/scoped-sync/read-models"
import { useAppStore } from "@/lib/store/app-store"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { getNextActiveInboxNotificationIdAfterMove } from "@/components/app/screens/inbox-navigation"
import { ScreenHeader } from "@/components/app/screens/shared"
import {
  InboxDetailPane,
  InboxListPane,
  type InboxEntry,
  type InboxTab,
} from "@/components/app/screens/inbox-ui"

const INBOX_LIST_WIDTH_STORAGE_KEY = "inbox-list-width"
const INBOX_LIST_DEFAULT_WIDTH = 288
const INBOX_LIST_MIN_WIDTH = 240
const INBOX_LIST_MAX_WIDTH = 420

type AppStoreState = ReturnType<typeof useAppStore.getState>
type InboxUser = AppStoreState["users"][number]

function clampInboxListWidth(value: number) {
  return Math.min(INBOX_LIST_MAX_WIDTH, Math.max(INBOX_LIST_MIN_WIDTH, value))
}

function getInitialInboxListWidth() {
  if (typeof window === "undefined") {
    return INBOX_LIST_DEFAULT_WIDTH
  }

  const parsedWidth = Number(
    window.localStorage.getItem(INBOX_LIST_WIDTH_STORAGE_KEY)
  )

  return Number.isFinite(parsedWidth)
    ? clampInboxListWidth(parsedWidth)
    : INBOX_LIST_DEFAULT_WIDTH
}

function selectCurrentUserInboxNotifications(state: AppStoreState) {
  return [...state.notifications]
    .filter((notification) => notification.userId === state.currentUserId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

function buildInboxUsersById(users: AppStoreState["users"]) {
  const map: Record<string, InboxUser> = {}

  for (const user of users) {
    map[user.id] = user
  }

  return map
}

function getVisibleInboxNotifications(
  notifications: Notification[],
  inboxTab: InboxTab
) {
  return notifications.filter((notification) =>
    inboxTab === "inbox"
      ? notification.archivedAt == null
      : notification.archivedAt != null
  )
}

function getInboxCounts(notifications: Notification[]) {
  return {
    archivedCount: notifications.filter(
      (notification) => notification.archivedAt != null
    ).length,
    unreadCount: notifications.filter(
      (notification) =>
        notification.archivedAt == null && notification.readAt == null
    ).length,
  }
}

function getActiveInboxNotification({
  activeInboxNotificationId,
  visibleNotifications,
}: {
  activeInboxNotificationId: string | null
  visibleNotifications: Notification[]
}) {
  const selectedNotification =
    visibleNotifications.find(
      (notification) => notification.id === activeInboxNotificationId
    ) ?? null

  return {
    activeNotification:
      selectedNotification ??
      (activeInboxNotificationId ? (visibleNotifications[0] ?? null) : null),
    selectedNotification,
  }
}

function createInboxEntry(
  notification: Notification | null,
  usersById: Record<string, InboxUser>
): InboxEntry | null {
  return notification
    ? {
        notification,
        actor: usersById[notification.actorId] ?? null,
      }
    : null
}

function getInboxActiveChannelPostHref(
  state: AppStoreState,
  notification: Notification | null
) {
  return notification?.entityType === "channelPost"
    ? getChannelPostHref(state, notification.entityId)
    : null
}

function getInboxActiveChatHref(
  state: AppStoreState,
  notification: Notification | null
) {
  return notification?.entityType === "chat"
    ? getConversationHref(state, notification.entityId)
    : null
}

function getInboxActiveInvite(
  state: AppStoreState,
  notification: Notification | null
) {
  return notification?.entityType === "invite"
    ? (state.invites.find((invite) => invite.id === notification.entityId) ??
        null)
    : null
}

function getInboxActiveProjectHref(
  state: AppStoreState,
  notification: Notification | null
) {
  if (notification?.entityType !== "project") {
    return null
  }

  const project = getProject(state, notification.entityId)

  return project ? (getProjectHref(state, project) ?? "/workspace/projects") : null
}

function isPendingInvite(
  invite: {
    acceptedAt?: string | null
    declinedAt?: string | null
    expiresAt: string
  } | null
) {
  return Boolean(
    invite &&
      !invite.acceptedAt &&
      !invite.declinedAt &&
      new Date(invite.expiresAt).getTime() >= Date.now()
  )
}

function useInboxReadModel(currentUserId: string | null) {
  return useScopedReadModelRefresh({
    enabled: Boolean(currentUserId),
    scopeKeys: currentUserId ? getNotificationInboxScopeKeys(currentUserId) : [],
    fetchLatest: () => fetchNotificationInboxReadModel(currentUserId ?? ""),
  })
}

function useInboxListWidthController() {
  const [notificationListWidth, setNotificationListWidth] = useState(
    getInitialInboxListWidth
  )
  const [notificationListResizing, setNotificationListResizing] =
    useState(false)
  const notificationListDragRef = useRef<{
    startX: number
    startWidth: number
  } | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(
      INBOX_LIST_WIDTH_STORAGE_KEY,
      String(notificationListWidth)
    )
  }, [notificationListWidth])

  useEffect(() => {
    if (!notificationListResizing) {
      return
    }

    const handleNotificationListResizeMove = (event: PointerEvent) => {
      const dragState = notificationListDragRef.current

      if (!dragState) {
        return
      }

      setNotificationListWidth(
        clampInboxListWidth(
          dragState.startWidth + event.clientX - dragState.startX
        )
      )
    }

    const stopNotificationListResize = () => {
      notificationListDragRef.current = null
      setNotificationListResizing(false)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
    }

    window.addEventListener("pointermove", handleNotificationListResizeMove)
    window.addEventListener("pointerup", stopNotificationListResize)
    window.addEventListener("pointercancel", stopNotificationListResize)

    return () => {
      window.removeEventListener(
        "pointermove",
        handleNotificationListResizeMove
      )
      window.removeEventListener("pointerup", stopNotificationListResize)
      window.removeEventListener("pointercancel", stopNotificationListResize)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
    }
  }, [notificationListResizing])

  function handleNotificationListResizeStart(
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    notificationListDragRef.current = {
      startX: event.clientX,
      startWidth: notificationListWidth,
    }
    setNotificationListResizing(true)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  return {
    notificationListResizing,
    notificationListWidth,
    resetNotificationListWidth: () =>
      setNotificationListWidth(INBOX_LIST_DEFAULT_WIDTH),
    setNotificationListWidth,
    startNotificationListResize: handleNotificationListResizeStart,
  }
}

function useActiveInboxRouteTargets(activeNotification: Notification | null) {
  return useAppStore(
    useShallow((state) => ({
      activeChannelPostHref: getInboxActiveChannelPostHref(
        state,
        activeNotification
      ),
      activeChatHref: getInboxActiveChatHref(state, activeNotification),
      activeInvite: getInboxActiveInvite(state, activeNotification),
      activeProjectHref: getInboxActiveProjectHref(state, activeNotification),
    }))
  )
}

type ActiveInboxInvite = ReturnType<
  typeof useActiveInboxRouteTargets
>["activeInvite"]

function getPendingInviteToken(
  activeInvite: ActiveInboxInvite,
  hasPendingActiveInvite: boolean
) {
  return activeInvite && hasPendingActiveInvite ? activeInvite.token : null
}

function getAcceptedInviteHref(
  payload: Awaited<ReturnType<typeof syncAcceptInvite>>
) {
  return payload?.teamSlug ? `/team/${payload.teamSlug}/work` : "/workspace/projects"
}

function getInviteAcceptErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to accept invite"
}

function navigateToAcceptedInvite(
  router: ReturnType<typeof useRouter>,
  payload: Awaited<ReturnType<typeof syncAcceptInvite>>
) {
  router.push(getAcceptedInviteHref(payload))
  router.refresh()
}

function useInboxNotificationActions({
  activeId,
  activeInvite,
  activeNotification,
  hasPendingActiveInvite,
  inboxTab,
  router,
  visibleNotifications,
}: {
  activeId: string | null
  activeInvite: ReturnType<typeof useActiveInboxRouteTargets>["activeInvite"]
  activeNotification: Notification | null
  hasPendingActiveInvite: boolean
  inboxTab: InboxTab
  router: ReturnType<typeof useRouter>
  visibleNotifications: Notification[]
}) {
  const [acceptingInvite, setAcceptingInvite] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingNotification, setDeletingNotification] = useState(false)

  const updateActiveNotificationAfterMove = (notification: Notification) => {
    const nextActiveId = getNextActiveInboxNotificationIdAfterMove({
      activeId,
      movedNotificationId: notification.id,
      visibleNotifications,
    })

    if (nextActiveId === undefined) {
      return
    }

    useAppStore.getState().setActiveInboxNotification(nextActiveId)
  }

  const archiveNotification = (notification: Notification) => {
    updateActiveNotificationAfterMove(notification)
    useAppStore.getState().archiveNotification(notification.id)
  }

  const unarchiveNotification = (notification: Notification) => {
    updateActiveNotificationAfterMove(notification)
    useAppStore.getState().unarchiveNotification(notification.id)
  }

  const deleteNotification = async (notification: Notification) => {
    updateActiveNotificationAfterMove(notification)
    await useAppStore.getState().deleteNotification(notification.id)
  }

  const moveAllVisibleNotifications = () => {
    const notificationIds = visibleNotifications.map(
      (notification) => notification.id
    )

    if (notificationIds.length === 0) {
      return
    }

    if (inboxTab === "inbox") {
      useAppStore.getState().archiveNotifications(notificationIds)
      return
    }

    useAppStore.getState().unarchiveNotifications(notificationIds)
  }

  const markAllVisibleNotificationsRead = () => {
    const notificationIds = visibleNotifications
      .filter((notification) => notification.readAt == null)
      .map((notification) => notification.id)

    useAppStore.getState().markNotificationsRead(notificationIds)
  }

  async function handleAcceptInvite() {
    const inviteToken = getPendingInviteToken(
      activeInvite,
      hasPendingActiveInvite
    )

    if (!inviteToken) {
      return
    }

    setAcceptingInvite(true)

    try {
      const payload = await syncAcceptInvite(inviteToken)

      toast.success("Invite accepted")
      navigateToAcceptedInvite(router, payload)
    } catch (error) {
      toast.error(getInviteAcceptErrorMessage(error))
    } finally {
      setAcceptingInvite(false)
    }
  }

  async function handleDeleteNotification() {
    if (!activeNotification) {
      return
    }

    setDeletingNotification(true)

    try {
      await deleteNotification(activeNotification)
      setDeleteDialogOpen(false)
    } finally {
      setDeletingNotification(false)
    }
  }

  return {
    acceptingInvite,
    archiveNotification,
    deleteDialogOpen,
    deletingNotification,
    handleAcceptInvite,
    handleDeleteNotification,
    markAllVisibleNotificationsRead,
    moveAllVisibleNotifications,
    setDeleteDialogOpen,
    unarchiveNotification,
  }
}

function useInboxScreenController() {
  const router = useRouter()
  const currentUserId = useAppStore((state) => state.currentUserId)
  const { hasLoadedOnce: hasLoadedInbox } = useInboxReadModel(currentUserId)
  const { activeInboxNotificationId } = useAppStore(
    useShallow((state) => ({
      activeInboxNotificationId: state.ui.activeInboxNotificationId,
    }))
  )
  const notifications = useAppStore(
    useShallow(selectCurrentUserInboxNotifications)
  )
  const users = useAppStore(useShallow((state) => state.users))
  const usersById = useMemo(() => buildInboxUsersById(users), [users])
  const [inboxTab, setInboxTab] = useState<InboxTab>("inbox")
  const listWidth = useInboxListWidthController()
  const visibleNotifications = getVisibleInboxNotifications(
    notifications,
    inboxTab
  )
  const visibleEntries: InboxEntry[] = visibleNotifications.map(
    (notification) => ({
      notification,
      actor: usersById[notification.actorId] ?? null,
    })
  )
  const { archivedCount, unreadCount } = getInboxCounts(notifications)
  const { activeNotification, selectedNotification } =
    getActiveInboxNotification({
      activeInboxNotificationId,
      visibleNotifications,
    })
  const activeId = activeNotification?.id ?? null
  const activeEntry = createInboxEntry(activeNotification, usersById)
  const routeTargets = useActiveInboxRouteTargets(activeNotification)
  const hasPendingActiveInvite = isPendingInvite(routeTargets.activeInvite)
  const notificationActions = useInboxNotificationActions({
    activeId,
    activeInvite: routeTargets.activeInvite,
    activeNotification,
    hasPendingActiveInvite,
    inboxTab,
    router,
    visibleNotifications,
  })

  useEffect(() => {
    if (
      visibleNotifications.length === 0 ||
      selectedNotification ||
      activeInboxNotificationId !== null
    ) {
      return
    }

    useAppStore
      .getState()
      .setActiveInboxNotification(visibleNotifications[0].id)
  }, [activeInboxNotificationId, selectedNotification, visibleNotifications])

  return {
    activeEntry,
    activeId,
    archivedCount,
    currentUserId,
    hasLoadedInbox,
    hasPendingActiveInvite,
    inboxTab,
    notifications,
    setInboxTab,
    unreadCount,
    visibleEntries,
    visibleNotifications,
    ...listWidth,
    ...notificationActions,
    ...routeTargets,
  }
}

type InboxScreenController = ReturnType<typeof useInboxScreenController>

function InboxScreenLayout({
  acceptingInvite,
  activeChannelPostHref,
  activeChatHref,
  activeEntry,
  activeId,
  activeProjectHref,
  archivedCount,
  deleteDialogOpen,
  deletingNotification,
  hasLoadedInbox,
  hasPendingActiveInvite,
  inboxTab,
  notifications,
  notificationListResizing,
  notificationListWidth,
  setDeleteDialogOpen,
  setInboxTab,
  startNotificationListResize,
  resetNotificationListWidth,
  unreadCount,
  visibleEntries,
  visibleNotifications,
  archiveNotification,
  handleAcceptInvite,
  handleDeleteNotification,
  markAllVisibleNotificationsRead,
  moveAllVisibleNotifications,
  unarchiveNotification,
}: InboxScreenController) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <ScreenHeader title="Inbox" />
        {!hasLoadedInbox && notifications.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-20 text-sm text-muted-foreground">
            Loading inbox...
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <InboxListPane
              width={notificationListWidth}
              resizing={notificationListResizing}
              inboxTab={inboxTab}
              activeId={activeId}
              entries={visibleEntries}
              unreadCount={unreadCount}
              archivedCount={archivedCount}
              onTabChange={setInboxTab}
              onMarkAllRead={markAllVisibleNotificationsRead}
              onMoveAll={moveAllVisibleNotifications}
              onSelectNotification={(notificationId) => {
                useAppStore.getState().setActiveInboxNotification(notificationId)
                useAppStore.getState().markNotificationRead(notificationId)
              }}
              onToggleArchive={(notification) => {
                if (notification.archivedAt) {
                  unarchiveNotification(notification)
                  return
                }

                archiveNotification(notification)
              }}
              onResizeStart={startNotificationListResize}
              onResetWidth={resetNotificationListWidth}
            />
            <InboxDetailPane
              activeEntry={activeEntry}
              visibleNotificationCount={visibleNotifications.length}
              activeProjectHref={activeProjectHref}
              activeChannelPostHref={activeChannelPostHref}
              activeChatHref={activeChatHref}
              hasPendingActiveInvite={hasPendingActiveInvite}
              acceptingInvite={acceptingInvite}
              onAcceptInvite={() => void handleAcceptInvite()}
              onToggleArchive={(notification) => {
                if (notification.archivedAt) {
                  unarchiveNotification(notification)
                  return
                }

                archiveNotification(notification)
              }}
              onToggleRead={(notification) => {
                useAppStore.getState().toggleNotificationRead(notification.id)
              }}
              onDelete={() => setDeleteDialogOpen(true)}
            />
          </div>
        )}
      </div>
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete notification"
        description="This notification will be permanently removed. This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deletingNotification}
        onConfirm={() => void handleDeleteNotification()}
      />
    </>
  )
}

export function InboxScreen() {
  const controller = useInboxScreenController()

  return <InboxScreenLayout {...controller} />
}

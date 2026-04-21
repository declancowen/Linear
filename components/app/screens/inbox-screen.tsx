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
import { syncAcceptInvite } from "@/lib/convex/client"
import { useAppStore } from "@/lib/store/app-store"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
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

function clampInboxListWidth(value: number) {
  return Math.min(INBOX_LIST_MAX_WIDTH, Math.max(INBOX_LIST_MIN_WIDTH, value))
}

export function InboxScreen() {
  const router = useRouter()
  const { activeInboxNotificationId } = useAppStore(
    useShallow((state) => ({
      activeInboxNotificationId: state.ui.activeInboxNotificationId,
    }))
  )
  const notifications = useAppStore(
    useShallow((state) =>
      [...state.notifications]
        .filter((notification) => notification.userId === state.currentUserId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    )
  )
  const users = useAppStore(useShallow((state) => state.users))
  const usersById = useMemo(() => {
    const map: Record<string, (typeof users)[number]> = {}

    for (const user of users) {
      map[user.id] = user
    }

    return map
  }, [users])
  const [inboxTab, setInboxTab] = useState<InboxTab>("inbox")
  const [acceptingInvite, setAcceptingInvite] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingNotification, setDeletingNotification] = useState(false)
  const [notificationListWidth, setNotificationListWidth] = useState(() => {
    if (typeof window === "undefined") {
      return INBOX_LIST_DEFAULT_WIDTH
    }

    const storedWidth = window.localStorage.getItem(
      INBOX_LIST_WIDTH_STORAGE_KEY
    )
    const parsedWidth = Number(storedWidth)

    if (!Number.isFinite(parsedWidth)) {
      return INBOX_LIST_DEFAULT_WIDTH
    }

    return clampInboxListWidth(parsedWidth)
  })
  const [notificationListResizing, setNotificationListResizing] =
    useState(false)
  const notificationListDragRef = useRef<{
    startX: number
    startWidth: number
  } | null>(null)
  const visibleNotifications = notifications.filter((notification) =>
    inboxTab === "inbox"
      ? notification.archivedAt == null
      : notification.archivedAt != null
  )
  const visibleEntries: InboxEntry[] = visibleNotifications.map(
    (notification) => ({
      notification,
      actor: usersById[notification.actorId] ?? null,
    })
  )
  const unreadCount = notifications.filter(
    (notification) =>
      notification.archivedAt == null && notification.readAt == null
  ).length
  const archivedCount = notifications.filter(
    (notification) => notification.archivedAt != null
  ).length
  const selectedNotification =
    visibleNotifications.find(
      (notification) => notification.id === activeInboxNotificationId
    ) ?? null
  const activeNotification =
    selectedNotification ??
    (activeInboxNotificationId ? (visibleNotifications[0] ?? null) : null)
  const activeId = activeNotification?.id ?? null
  const activeEntry: InboxEntry | null = activeNotification
    ? {
        notification: activeNotification,
        actor: usersById[activeNotification.actorId] ?? null,
      }
    : null
  const {
    activeChannelPostHref,
    activeChatHref,
    activeInvite,
    activeProjectHref,
  } = useAppStore(
    useShallow((state) => {
      const entityId = activeNotification?.entityId
      const activeProject =
        activeNotification?.entityType === "project" && entityId
          ? getProject(state, entityId)
          : null

      return {
        activeChannelPostHref:
          activeNotification?.entityType === "channelPost" && entityId
            ? getChannelPostHref(state, entityId)
            : null,
        activeChatHref:
          activeNotification?.entityType === "chat" && entityId
            ? getConversationHref(state, entityId)
            : null,
        activeInvite:
          activeNotification?.entityType === "invite" && entityId
            ? (state.invites.find((invite) => invite.id === entityId) ?? null)
            : null,
        activeProjectHref: activeProject
          ? (getProjectHref(state, activeProject) ?? "/workspace/projects")
          : null,
      }
    })
  )
  const hasPendingActiveInvite = activeInvite
    ? !activeInvite.acceptedAt &&
      !activeInvite.declinedAt &&
      new Date(activeInvite.expiresAt).getTime() >= Date.now()
    : false

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

  const updateActiveNotificationAfterMove = (notification: Notification) => {
    if (activeId !== notification.id) {
      return
    }

    const nextActiveNotification =
      visibleNotifications.find((entry) => entry.id !== notification.id) ?? null

    useAppStore
      .getState()
      .setActiveInboxNotification(nextActiveNotification?.id ?? null)
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

  async function handleAcceptInvite() {
    if (!activeInvite || !hasPendingActiveInvite) {
      return
    }

    setAcceptingInvite(true)

    try {
      const payload = await syncAcceptInvite(activeInvite.token)

      toast.success("Invite accepted")
      router.push(
        payload?.teamSlug
          ? `/team/${payload.teamSlug}/work`
          : "/workspace/projects"
      )
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to accept invite"
      )
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

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <ScreenHeader title="Inbox" />
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
            onResizeStart={handleNotificationListResizeStart}
            onResetWidth={() =>
              setNotificationListWidth(INBOX_LIST_DEFAULT_WIDTH)
            }
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

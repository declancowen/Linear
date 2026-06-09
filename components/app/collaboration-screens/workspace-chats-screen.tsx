"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useEffectEvent,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"
import { useAppRouter, useAppSearchParams } from "@/lib/browser/app-navigation"
import { ChatCircleDots, Plus } from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import {
  getConversationParticipants,
  getCurrentWorkspace,
  getWorkspaceChats,
} from "@/lib/domain/selectors"
import { isChatConversationUnread } from "@/lib/domain/chat-read-state"
import type { Conversation, UserProfile, Workspace } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { UserAvatar } from "@/components/app/user-presence"
import { ChatThread } from "@/components/app/collaboration-screens/chat-thread"
import {
  useConversationListReadModelRefresh,
  useConversationThreadReadModelRefresh,
} from "@/components/app/collaboration-screens/read-model-refresh"
import {
  createCollaborationSidebarSurfaceKey,
  usePersistedCollaborationSidebarState,
} from "@/components/app/collaboration-screens/sidebar-state"
import {
  ChatHeaderActions,
  DetailsSidebarToggle,
  EmptyState,
  MembersSidebar,
  PageHeader,
  SurfaceSidebarContent,
} from "@/components/app/collaboration-screens/shared-ui"
import {
  clampWorkspaceChatListWidth,
  CreateWorkspaceChatDialog,
  WORKSPACE_CHAT_LIST_COLLAPSED_STORAGE_KEY,
  WORKSPACE_CHAT_LIST_DEFAULT_WIDTH,
  WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY,
} from "@/components/app/collaboration-screens/workspace-chat-ui"
import {
  getWorkspaceChatParticipantView,
  WorkspaceChatParticipantAvatar,
  type WorkspaceChatAccessCollections,
} from "@/components/app/collaboration-screens/workspace-chat-avatar"
import {
  WorkspaceConversationListPane,
  type WorkspaceConversationListPaneProps,
} from "@/components/app/collaboration-screens/workspace-conversation-list-pane"
import { getLatestMessagesByConversationId } from "@/components/app/collaboration-screens/workspace-conversation-preview"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type WorkspaceChatListWidth = number | null

function getInitialWorkspaceChatListWidth(): WorkspaceChatListWidth {
  if (typeof window === "undefined") {
    return null
  }

  const storedWidth = window.localStorage.getItem(
    WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY
  )
  const parsedWidth = Number(storedWidth)

  return storedWidth !== null && Number.isFinite(parsedWidth)
    ? clampWorkspaceChatListWidth(parsedWidth)
    : null
}

function getInitialWorkspaceChatListCollapsed() {
  if (typeof window === "undefined") {
    return false
  }

  return (
    window.localStorage.getItem(WORKSPACE_CHAT_LIST_COLLAPSED_STORAGE_KEY) ===
    "true"
  )
}

function subscribeToWorkspaceChatListStorage() {
  return () => {}
}

function useStoredWorkspaceChatListWidth() {
  return useSyncExternalStore(
    subscribeToWorkspaceChatListStorage,
    getInitialWorkspaceChatListWidth,
    () => null
  )
}

function useStoredWorkspaceChatListCollapsed() {
  return useSyncExternalStore(
    subscribeToWorkspaceChatListStorage,
    getInitialWorkspaceChatListCollapsed,
    () => false
  )
}

function getActiveWorkspaceChatId(
  selectedChatId: string | null,
  chats: Conversation[]
) {
  return selectedChatId && chats.some((chat) => chat.id === selectedChatId)
    ? selectedChatId
    : (chats[0]?.id ?? null)
}

function getWorkspaceChatListResizeStartWidth(
  event: ReactPointerEvent<HTMLButtonElement>,
  fallbackWidth: WorkspaceChatListWidth
) {
  return (
    event.currentTarget
      .closest<HTMLElement>("[data-workspace-chat-list-pane]")
      ?.getBoundingClientRect().width ??
    fallbackWidth ??
    WORKSPACE_CHAT_LIST_DEFAULT_WIDTH
  )
}

function getWorkspaceChatSplitContainerWidth(
  event: ReactPointerEvent<HTMLButtonElement>
) {
  return (
    event.currentTarget
      .closest<HTMLElement>("[data-workspace-chat-split]")
      ?.getBoundingClientRect().width ?? null
  )
}

function getWorkspaceChatSplitElementWidth(element: HTMLElement | null) {
  return element?.getBoundingClientRect().width ?? null
}

function getWorkspaceConversationParticipants({
  conversation,
  currentUserId,
  usersById,
}: {
  conversation: Conversation
  currentUserId: string
  usersById: Map<string, UserProfile>
}) {
  return conversation.participantIds
    .filter((userId) => userId !== currentUserId)
    .map((userId) => usersById.get(userId))
    .filter((participant): participant is UserProfile => Boolean(participant))
}

function SingleWorkspaceConversationAvatar({
  accessCollections,
  conversation,
  participant,
  workspace,
}: {
  accessCollections: WorkspaceChatAccessCollections
  conversation: Conversation
  participant: UserProfile | undefined
  workspace: Workspace
}) {
  const participantView = getWorkspaceChatParticipantView({
    accessCollections,
    participant,
    workspace,
  })
  const avatar = getSingleWorkspaceConversationAvatarProps({
    conversation,
    participant,
    participantView,
  })

  return (
    <UserAvatar
      name={avatar.name}
      avatarImageUrl={avatar.avatarImageUrl}
      avatarUrl={avatar.avatarUrl}
      status={avatar.status}
      showStatus={avatar.showStatus}
      size="sm"
    />
  )
}

function getSingleWorkspaceConversationAvatarProps({
  conversation,
  participant,
  participantView,
}: {
  conversation: Conversation
  participant: UserProfile | undefined
  participantView: ReturnType<typeof getWorkspaceChatParticipantView>
}) {
  const fallbackName = participant ? participant.name : conversation.title

  if (!participantView) {
    return {
      name: fallbackName,
      avatarImageUrl: undefined,
      avatarUrl: undefined,
      showStatus: false,
      status: undefined,
    }
  }

  return {
    name: participantView.name ?? fallbackName,
    avatarImageUrl: participantView.avatarImageUrl,
    avatarUrl: participantView.avatarUrl,
    showStatus: !participantView.isFormerMember,
    status: participantView.status ?? undefined,
  }
}

function GroupWorkspaceConversationAvatar({
  accessCollections,
  participants,
  workspace,
}: {
  accessCollections: WorkspaceChatAccessCollections
  participants: UserProfile[]
  workspace: Workspace
}) {
  const visibleParticipants = participants.slice(0, 2)
  const overflowCount = participants.length - visibleParticipants.length

  return (
    <AvatarGroup>
      {visibleParticipants.map((participant) => (
        <WorkspaceChatParticipantAvatar
          key={participant.id}
          accessCollections={accessCollections}
          participant={participant}
          workspace={workspace}
        />
      ))}
      {overflowCount > 0 ? (
        <AvatarGroupCount className="text-[9px] font-medium">
          +{overflowCount}
        </AvatarGroupCount>
      ) : null}
    </AvatarGroup>
  )
}

function WorkspaceConversationAvatar({
  conversation,
  currentUserId,
  usersById,
  workspace,
  accessCollections,
}: {
  conversation: Conversation | null
  currentUserId: string
  usersById: Map<string, UserProfile>
  workspace: Workspace
  accessCollections: WorkspaceChatAccessCollections
}) {
  if (!conversation) {
    return <UserAvatar name="Chat" size="sm" showStatus={false} />
  }

  const participants = getWorkspaceConversationParticipants({
    conversation,
    currentUserId,
    usersById,
  })

  if (participants.length <= 1) {
    return (
      <SingleWorkspaceConversationAvatar
        accessCollections={accessCollections}
        conversation={conversation}
        participant={participants[0]}
        workspace={workspace}
      />
    )
  }

  return (
    <GroupWorkspaceConversationAvatar
      accessCollections={accessCollections}
      participants={participants}
      workspace={workspace}
    />
  )
}

type WorkspaceChatsContentProps = WorkspaceConversationListPaneProps & {
  hasLoadedConversationList: boolean
  members: UserProfile[]
  hasLoadedConversationThread: boolean
  welcomeParticipant: UserProfile | null
  sidebarOpen: boolean
  onToggleConversationListCollapsed: () => void
  splitRef: RefObject<HTMLDivElement | null>
}

function WorkspaceChatsContent({
  hasLoadedConversationList,
  chats,
  activeChat,
  conversationListCollapsed,
  members,
  hasLoadedConversationThread,
  welcomeParticipant,
  sidebarOpen,
  onCreateChat,
  onToggleConversationListCollapsed,
  splitRef,
  ...conversationListPaneProps
}: WorkspaceChatsContentProps) {
  if (!hasLoadedConversationList && chats.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-20 text-sm text-muted-foreground">
        Loading chats...
      </div>
    )
  }

  if (chats.length === 0) {
    return (
      <EmptyState
        title="No chats yet"
        description="Create a direct or group chat with people in the workspace."
        action={
          <Button size="sm" className="h-7 text-xs" onClick={onCreateChat}>
            <Plus className="size-3.5" />
            Create chat
          </Button>
        }
      />
    )
  }

  return (
    <div
      ref={splitRef}
      data-workspace-chat-split
      className="flex min-h-0 flex-1 overflow-hidden"
    >
      <WorkspaceConversationListPane
        chats={chats}
        activeChat={activeChat}
        conversationListCollapsed={conversationListCollapsed}
        onCreateChat={onCreateChat}
        {...conversationListPaneProps}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {activeChat ? (
          <ChatThread
            conversationId={activeChat.id}
            title={activeChat.title}
            description=""
            members={members}
            loaded={hasLoadedConversationThread}
            welcomeParticipant={welcomeParticipant}
            conversationListAction={
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={
                  conversationListCollapsed
                    ? "Expand conversation list"
                    : "Collapse conversation list"
                }
                className="size-7 rounded-md"
                onClick={onToggleConversationListCollapsed}
              >
                <ChatCircleDots className="size-3.5" />
              </Button>
            }
          />
        ) : null}
      </div>
      <MembersSidebar
        open={sidebarOpen}
        title={activeChat?.title ?? "Chat"}
        description={activeChat?.description || "Workspace conversation"}
        members={members}
        heroMember={welcomeParticipant}
      />
    </div>
  )
}

function WorkspaceChatDetailsSheet({
  open,
  activeChat,
  members,
  welcomeParticipant,
  onOpenChange,
}: {
  open: boolean
  activeChat: Conversation | null
  members: UserProfile[]
  welcomeParticipant: UserProfile | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm p-0">
        <SheetHeader className="border-b">
          <SheetTitle>{activeChat?.title ?? "Chat"}</SheetTitle>
          <SheetDescription>Conversation details</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <SurfaceSidebarContent
            title={activeChat?.title ?? "Chat"}
            description={activeChat?.description || "Workspace conversation"}
            members={members}
            heroMember={welcomeParticipant}
          />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

export function WorkspaceChatsScreen() {
  const router = useAppRouter()
  const searchParams = useAppSearchParams()
  const {
    currentUserId,
    workspace,
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
  } = useAppStore(
    useShallow((state) => ({
      currentUserId: state.currentUserId,
      workspace: getCurrentWorkspace(state),
      workspaces: state.workspaces,
      workspaceMemberships: state.workspaceMemberships,
      teams: state.teams,
      teamMemberships: state.teamMemberships,
    }))
  )
  const chats = useAppStore(
    useShallow((state) =>
      workspace ? getWorkspaceChats(state, workspace.id) : []
    )
  )
  const chatMessages = useAppStore((state) => state.chatMessages)
  const { chatReadStates, notifications } = useAppStore(
    useShallow((state) => ({
      chatReadStates: state.chatReadStates,
      notifications: state.notifications,
    }))
  )
  const users = useAppStore((state) => state.users)
  const [dialogOpen, setDialogOpen] = useState(false)
  const storedConversationListWidth = useStoredWorkspaceChatListWidth()
  const storedConversationListCollapsed = useStoredWorkspaceChatListCollapsed()
  const [conversationListWidthOverride, setConversationListWidthOverride] =
    useState<WorkspaceChatListWidth | undefined>(undefined)
  const [conversationListResizing, setConversationListResizing] =
    useState(false)
  const [
    conversationListCollapsedOverride,
    setConversationListCollapsedOverride,
  ] = useState<boolean | undefined>(undefined)
  const conversationListWidth =
    conversationListWidthOverride === undefined
      ? storedConversationListWidth
      : conversationListWidthOverride
  const conversationListCollapsed =
    conversationListCollapsedOverride ?? storedConversationListCollapsed
  const conversationSplitRef = useRef<HTMLDivElement | null>(null)
  const conversationListDragRef = useRef<{
    containerWidth: number | null
    startX: number
    startWidth: number
  } | null>(null)

  useEffect(() => {
    if (conversationListCollapsed) {
      return
    }

    const element = conversationSplitRef.current

    if (!element) {
      return
    }

    const syncConversationListWidth = () => {
      setConversationListWidthOverride((currentWidth) => {
        const resolvedWidth =
          currentWidth === undefined
            ? storedConversationListWidth
            : currentWidth

        return resolvedWidth === null
          ? null
          : clampWorkspaceChatListWidth(
              resolvedWidth,
              getWorkspaceChatSplitElementWidth(element)
            )
      })
    }

    syncConversationListWidth()

    if (typeof ResizeObserver === "undefined") {
      return
    }

    const observer = new ResizeObserver(syncConversationListWidth)
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [chats.length, conversationListCollapsed, storedConversationListWidth])

  useEffect(() => {
    if (conversationListWidthOverride === undefined) {
      return
    }

    if (conversationListWidth === null) {
      window.localStorage.removeItem(WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(
      WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY,
      String(conversationListWidth)
    )
  }, [conversationListWidth, conversationListWidthOverride])

  useEffect(() => {
    if (conversationListCollapsedOverride === undefined) {
      return
    }

    window.localStorage.setItem(
      WORKSPACE_CHAT_LIST_COLLAPSED_STORAGE_KEY,
      conversationListCollapsed ? "true" : "false"
    )
  }, [conversationListCollapsed, conversationListCollapsedOverride])

  const stopConversationListResize = useEffectEvent(() => {
    conversationListDragRef.current = null
    setConversationListResizing(false)
    document.body.style.removeProperty("cursor")
    document.body.style.removeProperty("user-select")
  })

  const handleConversationListResizeMove = useEffectEvent(
    (event: PointerEvent) => {
      const dragState = conversationListDragRef.current

      if (!dragState) {
        return
      }

      setConversationListWidthOverride(
        clampWorkspaceChatListWidth(
          dragState.startWidth + event.clientX - dragState.startX,
          dragState.containerWidth
        )
      )
    }
  )

  useEffect(() => {
    if (!conversationListResizing) {
      return
    }

    window.addEventListener("pointermove", handleConversationListResizeMove)
    window.addEventListener("pointerup", stopConversationListResize)
    window.addEventListener("pointercancel", stopConversationListResize)

    return () => {
      window.removeEventListener(
        "pointermove",
        handleConversationListResizeMove
      )
      window.removeEventListener("pointerup", stopConversationListResize)
      window.removeEventListener("pointercancel", stopConversationListResize)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
    }
  }, [conversationListResizing])

  function handleConversationListResizeStart(
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    conversationListDragRef.current = {
      containerWidth: getWorkspaceChatSplitContainerWidth(event),
      startX: event.clientX,
      startWidth: getWorkspaceChatListResizeStartWidth(
        event,
        conversationListWidth
      ),
    }
    setConversationListResizing(true)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  const selectedChatId = searchParams.get("chatId")
  const activeChatId = getActiveWorkspaceChatId(selectedChatId, chats)
  const {
    mobileSidebarOpen,
    setMobileSidebarOpen,
    setSidebarOpen,
    sidebarOpen,
  } = usePersistedCollaborationSidebarState(
    createCollaborationSidebarSurfaceKey(
      "workspace-chat",
      activeChatId ?? workspace?.id
    )
  )
  const { hasLoadedOnce: hasLoadedConversationList } =
    useConversationListReadModelRefresh(currentUserId)
  const { hasLoadedOnce: hasLoadedConversationThread } =
    useConversationThreadReadModelRefresh(activeChatId)
  const activeChat =
    chats.find((chat) => chat.id === activeChatId) ?? chats[0] ?? null
  const members = useAppStore(
    useShallow((state) =>
      activeChat ? getConversationParticipants(state, activeChat) : []
    )
  )
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  )
  const chatsById = useMemo(
    () => new Map(chats.map((chat) => [chat.id, chat])),
    [chats]
  )
  const latestMessagesByConversationId = useMemo(
    () => getLatestMessagesByConversationId(chats, chatMessages),
    [chatMessages, chats]
  )
  const chatsWithReadState = useMemo(
    () =>
      chats.map((chat) => ({
        ...chat,
        unread: isChatConversationUnread(
          { chatReadStates, notifications },
          currentUserId,
          chat.id
        ),
      })),
    [chatReadStates, chats, currentUserId, notifications]
  )
  const otherParticipantIds = activeChat
    ? activeChat.participantIds.filter((userId) => userId !== currentUserId)
    : []
  const welcomeParticipant =
    otherParticipantIds.length === 1
      ? (usersById.get(otherParticipantIds[0]) ?? null)
      : null

  if (!workspace) {
    return (
      <EmptyState
        title="Workspace not found"
        description="Select a workspace first."
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <PageHeader
        title="Chats"
        subtitle="Direct and group conversations"
        actions={
          activeChat ? (
            <ChatHeaderActions
              detailsAction={
                <DetailsSidebarToggle
                  sidebarOpen={sidebarOpen}
                  onDesktopToggle={() => setSidebarOpen((current) => !current)}
                  onMobileOpen={() => setMobileSidebarOpen(true)}
                />
              }
            />
          ) : null
        }
      />
      <CreateWorkspaceChatDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) =>
          router.replace(`/chats?chatId=${id}`, { scroll: false })
        }
      />
      <WorkspaceChatsContent
        hasLoadedConversationList={hasLoadedConversationList}
        chats={chatsWithReadState}
        activeChat={activeChat}
        conversationListWidth={conversationListWidth}
        conversationListResizing={conversationListResizing}
        conversationListCollapsed={conversationListCollapsed}
        latestMessagesByConversationId={latestMessagesByConversationId}
        members={members}
        hasLoadedConversationThread={hasLoadedConversationThread}
        welcomeParticipant={welcomeParticipant}
        sidebarOpen={sidebarOpen}
        renderConversationAvatar={(conversationId) => (
          <WorkspaceConversationAvatar
            conversation={chatsById.get(conversationId) ?? null}
            currentUserId={currentUserId}
            usersById={usersById}
            workspace={workspace}
            accessCollections={{
              workspaces,
              workspaceMemberships,
              teams,
              teamMemberships,
            }}
          />
        )}
        onCreateChat={() => setDialogOpen(true)}
        onMarkChatRead={(id) => useAppStore.getState().markChatRead(id)}
        onMarkChatUnread={(id) => useAppStore.getState().markChatUnread(id)}
        onResizeStart={handleConversationListResizeStart}
        onResetWidth={() => setConversationListWidthOverride(null)}
        onSelectChat={(id) =>
          router.replace(`/chats?chatId=${id}`, { scroll: false })
        }
        onToggleConversationListCollapsed={() =>
          setConversationListCollapsedOverride(
            (current) => !(current ?? storedConversationListCollapsed)
          )
        }
        splitRef={conversationSplitRef}
      />

      <WorkspaceChatDetailsSheet
        open={mobileSidebarOpen}
        activeChat={activeChat}
        members={members}
        welcomeParticipant={welcomeParticipant}
        onOpenChange={setMobileSidebarOpen}
      />
    </div>
  )
}

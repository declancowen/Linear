"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useEffectEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus } from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import {
  getConversationParticipants,
  getCurrentWorkspace,
  getWorkspaceChats,
  hasWorkspaceAccessInCollections,
} from "@/lib/domain/selectors"
import { buildWorkspaceUserPresenceView } from "@/lib/domain/workspace-user-presence"
import {
  fetchConversationListReadModel,
  fetchConversationThreadReadModel,
} from "@/lib/convex/client"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import {
  getConversationListScopeKeys,
  getConversationThreadScopeKeys,
} from "@/lib/scoped-sync/read-models"
import type {
  AppData,
  Conversation,
  UserProfile,
  Workspace,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn, getPlainTextContent } from "@/lib/utils"
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { UserAvatar } from "@/components/app/user-presence"
import { CallInviteLauncher } from "@/components/app/collaboration-screens/call-invite-launcher"
import { ChatThread } from "@/components/app/collaboration-screens/chat-thread"
import {
  ChatHeaderActions,
  DetailsSidebarToggle,
  EmptyState,
  MembersSidebar,
  PageHeader,
  SurfaceSidebarContent,
} from "@/components/app/collaboration-screens/shared-ui"
import { parseCallInviteMessage } from "@/components/app/collaboration-screens/utils"
import {
  clampWorkspaceChatListWidth,
  ConversationList,
  CreateWorkspaceChatDialog,
  WORKSPACE_CHAT_LIST_DEFAULT_WIDTH,
  WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY,
} from "@/components/app/collaboration-screens/workspace-chat-ui"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type WorkspaceChatAccessCollections = Pick<
  AppData,
  "workspaces" | "workspaceMemberships" | "teams" | "teamMemberships"
>

function getActiveWorkspaceChatId(
  selectedChatId: string | null,
  chats: Conversation[]
) {
  return selectedChatId && chats.some((chat) => chat.id === selectedChatId)
    ? selectedChatId
    : (chats[0]?.id ?? null)
}

function getConversationPreview(
  latest: AppData["chatMessages"][number] | undefined
) {
  if (!latest) {
    return "Open the conversation"
  }

  if (latest.kind === "call" || latest.callId) {
    return "Started a call"
  }

  const callInvite = parseCallInviteMessage(latest.content)
  return callInvite?.title ?? getPlainTextContent(latest.content)
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
    return <UserAvatar name="Chat" size="default" showStatus={false} />
  }

  const participants = conversation.participantIds
    .filter((userId) => userId !== currentUserId)
    .map((userId) => usersById.get(userId))
    .filter((participant): participant is NonNullable<typeof participant> =>
      Boolean(participant)
    )
  const getParticipantView = (participant: UserProfile | undefined) =>
    buildWorkspaceUserPresenceView(
      participant,
      !participant
        ? "unknown"
        : hasWorkspaceAccessInCollections(
              accessCollections.workspaces,
              accessCollections.workspaceMemberships,
              accessCollections.teams,
              accessCollections.teamMemberships,
              workspace.id,
              participant.id
            )
          ? "active"
          : "former"
    )

  if (participants.length <= 1) {
    const participant = participants[0]
    const participantView = getParticipantView(participant)

    return (
      <UserAvatar
        name={participantView?.name ?? participant?.name ?? conversation.title}
        avatarImageUrl={participantView?.avatarImageUrl}
        avatarUrl={participantView?.avatarUrl}
        status={participantView?.status ?? undefined}
        showStatus={Boolean(participant) && !participantView?.isFormerMember}
        size="default"
      />
    )
  }

  const visibleParticipants = participants.slice(0, 2)
  const overflowCount = participants.length - visibleParticipants.length

  return (
    <AvatarGroup>
      {visibleParticipants.map((participant) => {
        const participantView = getParticipantView(participant)

        return (
          <UserAvatar
            key={participant.id}
            name={participantView?.name ?? participant.name}
            avatarImageUrl={participantView?.avatarImageUrl}
            avatarUrl={participantView?.avatarUrl}
            status={participantView?.status ?? undefined}
            showStatus={!participantView?.isFormerMember}
            size="default"
          />
        )
      })}
      {overflowCount > 0 ? (
        <AvatarGroupCount className="text-[10px] font-medium">
          +{overflowCount}
        </AvatarGroupCount>
      ) : null}
    </AvatarGroup>
  )
}

function WorkspaceConversationListPane({
  chats,
  activeChat,
  conversationListWidth,
  conversationListResizing,
  latestMessagesByConversationId,
  renderConversationAvatar,
  onCreateChat,
  onResizeStart,
  onResetWidth,
  onSelectChat,
}: {
  chats: Conversation[]
  activeChat: Conversation | null
  conversationListWidth: number
  conversationListResizing: boolean
  latestMessagesByConversationId: Map<string, AppData["chatMessages"][number]>
  renderConversationAvatar: (conversationId: string) => ReactNode
  onCreateChat: () => void
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onResetWidth: () => void
  onSelectChat: (id: string) => void
}) {
  return (
    <div
      className="relative flex min-h-0 shrink-0 flex-col border-r"
      style={{
        width: `${conversationListWidth}px`,
        flexBasis: `${conversationListWidth}px`,
      }}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-4">
        <span className="truncate text-sm font-medium">Conversations</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-xs"
          onClick={onCreateChat}
        >
          <Plus className="size-3.5" />
          New chat
        </Button>
      </div>
      <ConversationList
        className="h-auto min-h-0 flex-1 border-r-0"
        conversations={chats}
        selectedId={activeChat?.id ?? null}
        onSelect={onSelectChat}
        renderLeading={renderConversationAvatar}
        renderPreview={(id) =>
          getConversationPreview(latestMessagesByConversationId.get(id))
        }
      />
      <button
        type="button"
        aria-label="Resize chat list"
        className={cn(
          "group absolute top-0 -right-2 z-10 hidden h-full w-4 cursor-col-resize touch-none select-none md:block",
          conversationListResizing && "bg-primary/6"
        )}
        onPointerDown={onResizeStart}
        onDoubleClick={onResetWidth}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-2 left-1/2 w-2 -translate-x-1/2 rounded-full bg-transparent transition-colors",
            conversationListResizing ? "bg-primary/10" : "group-hover:bg-accent"
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 rounded-full bg-border/80 transition-all",
            conversationListResizing
              ? "w-0.5 bg-primary/55"
              : "group-hover:w-0.5 group-hover:bg-primary/45"
          )}
        />
      </button>
    </div>
  )
}

function WorkspaceChatsContent({
  hasLoadedConversationList,
  chats,
  activeChat,
  conversationListWidth,
  conversationListResizing,
  latestMessagesByConversationId,
  members,
  hasLoadedConversationThread,
  welcomeParticipant,
  sidebarOpen,
  renderConversationAvatar,
  onCreateChat,
  onResizeStart,
  onResetWidth,
  onSelectChat,
}: {
  hasLoadedConversationList: boolean
  chats: Conversation[]
  activeChat: Conversation | null
  conversationListWidth: number
  conversationListResizing: boolean
  latestMessagesByConversationId: Map<string, AppData["chatMessages"][number]>
  members: UserProfile[]
  hasLoadedConversationThread: boolean
  welcomeParticipant: UserProfile | null
  sidebarOpen: boolean
  renderConversationAvatar: (conversationId: string) => ReactNode
  onCreateChat: () => void
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onResetWidth: () => void
  onSelectChat: (id: string) => void
}) {
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
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <WorkspaceConversationListPane
        chats={chats}
        activeChat={activeChat}
        conversationListWidth={conversationListWidth}
        conversationListResizing={conversationListResizing}
        latestMessagesByConversationId={latestMessagesByConversationId}
        renderConversationAvatar={renderConversationAvatar}
        onCreateChat={onCreateChat}
        onResizeStart={onResizeStart}
        onResetWidth={onResetWidth}
        onSelectChat={onSelectChat}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {activeChat ? (
          <ChatThread
            conversationId={activeChat.id}
            title={activeChat.title}
            description=""
            members={members}
            loaded={hasLoadedConversationThread}
            videoAction={<CallInviteLauncher conversationId={activeChat.id} />}
            welcomeParticipant={welcomeParticipant}
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
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const users = useAppStore((state) => state.users)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [conversationListWidth, setConversationListWidth] = useState(
    WORKSPACE_CHAT_LIST_DEFAULT_WIDTH
  )
  const [conversationListResizing, setConversationListResizing] =
    useState(false)
  const [conversationListWidthReady, setConversationListWidthReady] =
    useState(false)
  const conversationListDragRef = useRef<{
    startX: number
    startWidth: number
  } | null>(null)

  useEffect(() => {
    const storedWidth = window.localStorage.getItem(
      WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY
    )
    const frameId = window.requestAnimationFrame(() => {
      const parsedWidth = Number(storedWidth)

      if (Number.isFinite(parsedWidth)) {
        setConversationListWidth(clampWorkspaceChatListWidth(parsedWidth))
      }

      setConversationListWidthReady(true)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  useEffect(() => {
    if (!conversationListWidthReady) {
      return
    }

    window.localStorage.setItem(
      WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY,
      String(conversationListWidth)
    )
  }, [conversationListWidth, conversationListWidthReady])

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

      setConversationListWidth(
        clampWorkspaceChatListWidth(
          dragState.startWidth + event.clientX - dragState.startX
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
      startX: event.clientX,
      startWidth: conversationListWidth,
    }
    setConversationListResizing(true)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  const selectedChatId = searchParams.get("chatId")
  const activeChatId = getActiveWorkspaceChatId(selectedChatId, chats)
  const { hasLoadedOnce: hasLoadedConversationList } =
    useScopedReadModelRefresh({
      enabled: Boolean(currentUserId),
      scopeKeys: currentUserId
        ? getConversationListScopeKeys(currentUserId)
        : [],
      fetchLatest: () => fetchConversationListReadModel(currentUserId ?? ""),
    })
  const { hasLoadedOnce: hasLoadedConversationThread } =
    useScopedReadModelRefresh({
      enabled: Boolean(activeChatId),
      scopeKeys: activeChatId
        ? getConversationThreadScopeKeys(activeChatId)
        : [],
      fetchLatest: () => fetchConversationThreadReadModel(activeChatId ?? ""),
    })
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
  const latestMessagesByConversationId = useMemo(() => {
    const conversationIds = new Set(chats.map((chat) => chat.id))
    const latestByConversationId = new Map<
      string,
      (typeof chatMessages)[number]
    >()

    for (const message of chatMessages) {
      if (!conversationIds.has(message.conversationId)) {
        continue
      }

      const previous = latestByConversationId.get(message.conversationId)

      if (!previous || previous.createdAt < message.createdAt) {
        latestByConversationId.set(message.conversationId, message)
      }
    }

    return latestByConversationId
  }, [chatMessages, chats])
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
        chats={chats}
        activeChat={activeChat}
        conversationListWidth={conversationListWidth}
        conversationListResizing={conversationListResizing}
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
        onResizeStart={handleConversationListResizeStart}
        onResetWidth={() =>
          setConversationListWidth(WORKSPACE_CHAT_LIST_DEFAULT_WIDTH)
        }
        onSelectChat={(id) =>
          router.replace(`/chats?chatId=${id}`, { scroll: false })
        }
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

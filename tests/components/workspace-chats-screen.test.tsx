import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"

import "@/tests/lib/fixtures/collaboration-screen-ui-mocks"
import { WorkspaceChatsScreen } from "@/components/app/collaboration-screens/workspace-chats-screen"
import { WorkspaceChatParticipantAvatar } from "@/components/app/collaboration-screens/workspace-chat-avatar"
import { WorkspaceConversationListPane } from "@/components/app/collaboration-screens/workspace-conversation-list-pane"
import {
  getConversationPreview,
  getLatestMessagesByConversationId,
} from "@/components/app/collaboration-screens/workspace-conversation-preview"
import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestUser,
  createTestWorkspace,
  createTestWorkspaceMembership,
} from "@/tests/lib/fixtures/app-data"

const useScopedReadModelRefreshMock = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/hooks/use-scoped-read-model-refresh", () => ({
  useScopedReadModelRefresh: useScopedReadModelRefreshMock,
}))

vi.mock("@/lib/convex/client", () => ({
  fetchConversationListReadModel: vi.fn(),
  fetchConversationThreadReadModel: vi.fn(),
}))

vi.mock("@/components/app/collaboration-screens/chat-thread", () => ({
  ChatThread: ({
    conversationListAction,
  }: {
    conversationListAction?: ReactNode
  }) => (
    <div>
      {conversationListAction}
      <div>Chat thread</div>
    </div>
  ),
}))

vi.mock("@/components/app/user-presence", () => ({
  UserAvatar: ({
    name,
    showStatus,
    status,
  }: {
    name?: string
    showStatus?: boolean
    status?: string | null
  }) => (
    <span
      data-show-status={String(Boolean(showStatus))}
      data-status={status ?? ""}
    >
      {name ?? "Unknown"}
    </span>
  ),
}))

vi.mock("@/components/app/collaboration-screens/workspace-chat-ui", () => ({
  WORKSPACE_CHAT_LIST_DEFAULT_WIDTH: 256,
  WORKSPACE_CHAT_LIST_DEFAULT_WIDTH_PERCENTAGE: "25%",
  WORKSPACE_CHAT_LIST_COLLAPSED_STORAGE_KEY: "workspace-chat-list-collapsed:v1",
  WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY: "workspace-chat-list-width:v2",
  clampWorkspaceChatListWidth: (value: number) => value,
  ConversationList: ({
    conversations,
    onSelect,
    renderLeading,
    renderPreview,
  }: {
    conversations: Array<{ id: string; title: string }>
    onSelect: (id: string) => void
    renderLeading?: (id: string) => ReactNode
    renderPreview: (id: string) => string
  }) => (
    <div>
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          type="button"
          onClick={() => onSelect(conversation.id)}
        >
          {renderLeading?.(conversation.id)}
          {conversation.title}
          {renderPreview(conversation.id)}
        </button>
      ))}
    </div>
  ),
  CreateWorkspaceChatDialog: () => null,
}))

describe("workspace chat display helpers", () => {
  it("derives conversation previews for empty, call, and text messages", () => {
    expect(getConversationPreview(undefined)).toBe("Open the conversation")
    expect(
      getConversationPreview({
        kind: "text",
        callId: null,
        content: "<p>Deleted</p>",
        deletedAt: "2026-05-05T12:00:00.000Z",
      } as never)
    ).toBe("Open the conversation")
    expect(
      getConversationPreview({
        kind: "call",
        callId: "call_1",
        content: "",
      } as never)
    ).toBe("Started a call")
    expect(
      getConversationPreview({
        kind: "text",
        callId: null,
        content: "<p>Hello team</p>",
      } as never)
    ).toBe("Hello team")
  })

  it("selects the latest message for visible conversations only", () => {
    const latestMessagesByConversationId = getLatestMessagesByConversationId(
      [{ id: "chat_1" }, { id: "chat_2" }] as never,
      [
        {
          id: "message_orphan",
          conversationId: "chat_orphan",
          createdAt: "2026-05-05T09:00:00.000Z",
        },
        {
          id: "message_older",
          conversationId: "chat_1",
          createdAt: "2026-05-05T10:00:00.000Z",
        },
        {
          id: "message_latest",
          conversationId: "chat_1",
          createdAt: "2026-05-05T11:00:00.000Z",
          deletedAt: "2026-05-05T11:05:00.000Z",
        },
        {
          id: "message_stale",
          conversationId: "chat_1",
          createdAt: "2026-05-05T10:30:00.000Z",
        },
        {
          id: "message_chat_2",
          conversationId: "chat_2",
          createdAt: "2026-05-05T08:00:00.000Z",
        },
      ] as never
    )

    expect(latestMessagesByConversationId.get("chat_1")).toMatchObject({
      id: "message_stale",
    })
    expect(latestMessagesByConversationId.get("chat_2")).toMatchObject({
      id: "message_chat_2",
    })
    expect(latestMessagesByConversationId.has("chat_orphan")).toBe(false)
  })

  it("renders participant avatars and the resizable conversation list pane", () => {
    const workspace = createTestWorkspace()
    const participant = createTestUser({
      id: "user_2",
      name: "Maya Patel",
      avatarImageUrl: "https://example.com/maya.png",
    })
    const conversation = {
      id: "chat_1",
      kind: "chat",
      title: "Planning",
      updatedAt: "2026-04-18T10:00:00.000Z",
    } as never
    const onCreateChat = vi.fn()
    const onResizeStart = vi.fn()
    const onResetWidth = vi.fn()
    const onSelectChat = vi.fn()
    const onMarkChatRead = vi.fn()
    const onMarkChatUnread = vi.fn()

    render(
      <>
        <WorkspaceChatParticipantAvatar
          accessCollections={{
            workspaces: [workspace],
            workspaceMemberships: [
              createTestWorkspaceMembership({ userId: participant.id }),
            ],
            teams: [],
            teamMemberships: [],
          }}
          participant={participant}
          workspace={workspace}
        />
        <WorkspaceConversationListPane
          chats={[conversation]}
          activeChat={conversation}
          conversationListWidth={288}
          conversationListResizing
          conversationListCollapsed={false}
          latestMessagesByConversationId={
            new Map([
              [
                "chat_1",
                {
                  kind: "text",
                  callId: null,
                  content: "<p>Latest update</p>",
                } as never,
              ],
            ])
          }
          renderConversationAvatar={() => <span>Avatar</span>}
          onCreateChat={onCreateChat}
          onMarkChatRead={onMarkChatRead}
          onMarkChatUnread={onMarkChatUnread}
          onResizeStart={onResizeStart}
          onResetWidth={onResetWidth}
          onSelectChat={onSelectChat}
        />
      </>
    )

    fireEvent.click(screen.getByRole("button", { name: "New chat" }))
    fireEvent.pointerDown(screen.getByLabelText("Resize chat list"))
    fireEvent.doubleClick(screen.getByLabelText("Resize chat list"))
    fireEvent.click(screen.getByRole("button", { name: /Planning/ }))

    expect(screen.getByText("Maya Patel")).toBeInTheDocument()
    expect(screen.getByText("Maya Patel")).toHaveAttribute(
      "data-show-status",
      "true"
    )
    expect(
      screen.getByRole("button", { name: /Latest update/ })
    ).toBeInTheDocument()
    expect(onCreateChat).toHaveBeenCalledTimes(1)
    expect(onResizeStart).toHaveBeenCalledTimes(1)
    expect(onResetWidth).toHaveBeenCalledTimes(1)
    expect(onSelectChat).toHaveBeenCalledWith("chat_1")
  })

  it("renders a collapsed workspace conversation icon rail without names", () => {
    const conversation = {
      id: "chat_1",
      kind: "chat",
      title: "Planning",
      unread: true,
      updatedAt: "2026-04-18T10:00:00.000Z",
    } as never
    const onCreateChat = vi.fn()
    const onSelectChat = vi.fn()

    render(
      <WorkspaceConversationListPane
        chats={[conversation]}
        activeChat={conversation}
        conversationListWidth={288}
        conversationListResizing={false}
        conversationListCollapsed
        latestMessagesByConversationId={new Map()}
        renderConversationAvatar={() => <span>Avatar</span>}
        onCreateChat={onCreateChat}
        onMarkChatRead={vi.fn()}
        onMarkChatUnread={vi.fn()}
        onResizeStart={vi.fn()}
        onResetWidth={vi.fn()}
        onSelectChat={onSelectChat}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "New chat" }))
    fireEvent.click(screen.getByRole("button", { name: "Open Planning" }))

    expect(onCreateChat).toHaveBeenCalledTimes(1)
    expect(onSelectChat).toHaveBeenCalledWith("chat_1")
    expect(screen.getByText("Avatar")).toBeInTheDocument()
    expect(screen.queryByText("Planning")).not.toBeInTheDocument()
  })
})

describe("WorkspaceChatsScreen", () => {
  beforeEach(() => {
    useScopedReadModelRefreshMock.mockReset()
    useScopedReadModelRefreshMock.mockReturnValue({
      error: null,
      hasLoadedOnce: false,
      refreshing: true,
    })

    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      users: [
        {
          id: "user_1",
          name: "Alex Example",
          handle: "alex",
          email: "alex@example.com",
          avatarUrl: "",
          avatarImageUrl: null,
          workosUserId: null,
          title: "Engineer",
          status: "active",
          statusMessage: "",
          hasExplicitStatus: false,
          accountDeletionPendingAt: null,
          accountDeletedAt: null,
          preferences: {
            emailMentions: true,
            emailAssignments: true,
            emailDigest: true,
            theme: "system",
          },
        },
      ],
      workspaces: [
        {
          id: "workspace_1",
          slug: "workspace-1",
          name: "Workspace 1",
          logoUrl: "",
          logoImageUrl: null,
          createdBy: "user_1",
          workosOrganizationId: null,
          settings: {
            accent: "#000000",
            description: "",
          },
        },
      ],
    })
  })

  it("shows a loading state before the first conversation list fetch completes", () => {
    render(<WorkspaceChatsScreen />)

    expect(screen.getByText("Loading chats...")).toBeInTheDocument()
    expect(screen.queryByText("No chats yet")).not.toBeInTheDocument()
  })

  it("shows the empty state after the conversation list has loaded", () => {
    useScopedReadModelRefreshMock.mockReturnValue({
      error: null,
      hasLoadedOnce: true,
      refreshing: false,
    })

    render(<WorkspaceChatsScreen />)

    expect(screen.getByText("No chats yet")).toBeInTheDocument()
    expect(screen.queryByText("Loading chats...")).not.toBeInTheDocument()
  })

  it("renders the conversation list collapse control above the active chat thread", () => {
    useScopedReadModelRefreshMock.mockReturnValue({
      error: null,
      hasLoadedOnce: true,
      refreshing: false,
    })
    useAppStore.setState((state) => ({
      ...state,
      conversations: [
        {
          id: "chat_1",
          kind: "chat",
          scopeType: "workspace",
          scopeId: "workspace_1",
          variant: "direct",
          title: "Planning",
          description: "",
          participantIds: ["user_1"],
          roomId: null,
          roomName: null,
          createdBy: "user_1",
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
          lastActivityAt: "2026-04-18T10:00:00.000Z",
        },
      ],
    }))

    render(<WorkspaceChatsScreen />)

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse conversation list" })
    )

    expect(
      screen.getByRole("button", { name: "Expand conversation list" })
    ).toBeInTheDocument()
  })

  it("shows status indicators on direct conversation list avatars", () => {
    useScopedReadModelRefreshMock.mockReturnValue({
      error: null,
      hasLoadedOnce: true,
      refreshing: false,
    })
    const participant = createTestUser({
      id: "user_2",
      name: "Maya Patel",
      status: "out-of-office",
      hasExplicitStatus: true,
    })

    useAppStore.setState((state) => ({
      ...state,
      users: [...state.users, participant],
      workspaceMemberships: [
        createTestWorkspaceMembership({
          workspaceId: "workspace_1",
          userId: "user_1",
          role: "member",
        }),
        createTestWorkspaceMembership({
          workspaceId: "workspace_1",
          userId: participant.id,
          role: "member",
        }),
      ],
      conversations: [
        {
          id: "chat_1",
          kind: "chat",
          scopeType: "workspace",
          scopeId: "workspace_1",
          variant: "direct",
          title: "Maya Patel",
          description: "",
          participantIds: ["user_1", participant.id],
          roomId: null,
          roomName: null,
          createdBy: "user_1",
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
          lastActivityAt: "2026-04-18T10:00:00.000Z",
        },
      ],
    }))

    render(<WorkspaceChatsScreen />)

    const avatar = screen
      .getAllByText("Maya Patel")
      .find(
        (element) => element.getAttribute("data-show-status") === "true"
      ) as HTMLElement | undefined

    expect(avatar).toBeDefined()
    expect(avatar).toHaveAttribute("data-show-status", "true")
    expect(avatar).toHaveAttribute("data-status", "out-of-office")
  })
})

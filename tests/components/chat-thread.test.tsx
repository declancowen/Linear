import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

import { ChatThread } from "@/components/app/collaboration-screens/chat-thread"
import { getChatWelcomeIntroDisplay } from "@/components/app/collaboration-screens/chat-welcome-display"
import { formatChatMessageTime } from "@/components/app/collaboration-screens/utils"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestTeam,
  createTestTeamMembership,
  createTestWorkspaceMembership,
  createTestUser,
  createTestWorkspaceShellData,
} from "@/tests/lib/fixtures/app-data"

const useChatPresenceMock = vi.hoisted(() => vi.fn())

vi.mock("@/components/app/rich-text-editor", () => ({
  RichTextEditor: ({
    content,
    placeholder,
    onChange,
  }: {
    content?: string
    placeholder?: string
    onChange?: (value: string) => void
  }) => {
    const plainContent =
      typeof content === "string" ? content.replace(/<[^>]+>/g, "").trim() : ""

    return (
      <input
        data-testid="mock-rich-text-editor"
        aria-label={placeholder}
        defaultValue={plainContent}
        onChange={(event) =>
          onChange?.(`<p>${(event.target as HTMLInputElement).value}</p>`)
        }
      />
    )
  },
}))

vi.mock("@/components/app/emoji-picker-popover", () => ({
  EmojiPickerPopover: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}))

vi.mock("@/hooks/use-chat-presence", () => ({
  useChatPresence: useChatPresenceMock,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

const currentUser = createTestUser({
  id: "user_current",
  name: "Current User",
  handle: "current-user",
  email: "current@example.com",
  title: "Founder",
  hasExplicitStatus: false,
})

const formerUser = createTestUser({
  id: "user_former",
  name: "Declan Cowen",
  handle: "declan-cowen",
  email: "declan@example.com",
  title: "Product Owner",
  status: "out-of-office",
  statusMessage: "Away",
  hasExplicitStatus: true,
})

const markUser = createTestUser({
  id: "user_mark",
  name: "Mark Chen",
  handle: "mark-chen",
  email: "mark@example.com",
  title: "Designer",
  hasExplicitStatus: false,
})

const aliceUser = createTestUser({
  id: "user_alice",
  name: "Alice Park",
  handle: "alice-park",
  email: "alice@example.com",
  title: "Engineer",
  hasExplicitStatus: false,
})

const zoeUser = createTestUser({
  id: "user_zoe",
  name: "Zoe Kim",
  handle: "zoe-kim",
  email: "zoe@example.com",
  title: "PM",
  hasExplicitStatus: false,
})

const toggleChatMessageReactionMock = vi.fn()
const updateChatMessageMock = vi.fn()
const markChatReadMock = vi.fn()

function createReactionMessage() {
  return {
    id: "message_1",
    conversationId: "conversation_1",
    kind: "text" as const,
    content: "<p>Hello</p>",
    callId: null,
    mentionUserIds: [],
    reactions: [
      {
        emoji: "👍",
        userIds: [formerUser.id],
      },
    ],
    createdBy: formerUser.id,
    createdAt: "2026-04-15T12:00:00.000Z",
  }
}

function setSingleMessageReadReceiptState(createdBy: string) {
  const readAt = "2026-04-15T12:05:00.000Z"

  useAppStore.setState({
    chatMessages: [
      {
        ...createReactionMessage(),
        createdBy,
      },
    ],
    chatReadStates: [
      {
        id: "chat_read_state_user_current_conversation_1",
        userId: currentUser.id,
        conversationId: "conversation_1",
        readAt,
        unreadAt: null,
        messageReadAtById: {
          message_1: readAt,
        },
        createdAt: readAt,
        updatedAt: readAt,
      },
    ],
  })
}

function renderDirectChatThread(
  props: Partial<Parameters<typeof ChatThread>[0]> = {}
) {
  render(
    <ChatThread
      conversationId="conversation_1"
      title="Declan Cowen"
      description=""
      members={[currentUser, formerUser]}
      {...props}
    />
  )
}

beforeEach(() => {
  toggleChatMessageReactionMock.mockReset()
  updateChatMessageMock.mockReset()
  markChatReadMock.mockReset()
  useChatPresenceMock.mockReset()
  useChatPresenceMock.mockReturnValue({
    participants: [],
    setTyping: vi.fn(),
  })
  useAppStore.setState({
    ...createTestWorkspaceShellData({
      currentUserId: currentUser.id,
      users: [currentUser, formerUser],
    }),
    conversations: [
      {
        id: "conversation_1",
        kind: "chat",
        scopeType: "workspace",
        scopeId: "workspace_1",
        variant: "direct",
        title: "Declan Cowen",
        description: "",
        participantIds: [currentUser.id, formerUser.id],
        roomId: null,
        roomName: null,
        createdBy: currentUser.id,
        createdAt: "2026-04-15T12:00:00.000Z",
        updatedAt: "2026-04-15T12:00:00.000Z",
        lastActivityAt: "2026-04-15T12:00:00.000Z",
      },
    ],
    chatMessages: [],
    markChatRead: markChatReadMock,
    toggleChatMessageReaction: toggleChatMessageReactionMock,
    updateChatMessage: updateChatMessageMock,
  })
})

describe("ChatThread", () => {
  it("resolves welcome intro display from fallback and workspace presence view", () => {
    expect(
      getChatWelcomeIntroDisplay({
        title: "Direct chat",
        welcomeParticipant: formerUser,
        welcomeParticipantView: null,
      })
    ).toMatchObject({
      avatarName: "Declan Cowen",
      name: "Declan Cowen",
      showStatus: true,
    })

    expect(
      getChatWelcomeIntroDisplay({
        title: "Direct chat",
        welcomeParticipant: formerUser,
        welcomeParticipantView: {
          avatarImageUrl: "https://example.com/declan-image.png",
          avatarUrl: "https://example.com/declan-avatar.png",
          id: formerUser.id,
          isFormerMember: true,
          name: "Former teammate",
          status: "offline",
        } as never,
      })
    ).toMatchObject({
      avatarImageUrl: "https://example.com/declan-image.png",
      avatarName: "Former teammate",
      avatarUrl: "https://example.com/declan-avatar.png",
      name: "Former teammate",
      showStatus: false,
      status: "offline",
    })
  })

  it("shows a loading state before the first thread refresh completes", () => {
    render(
      <ChatThread
        conversationId="conversation_1"
        title="Declan Cowen"
        description=""
        members={[currentUser, formerUser]}
        loaded={false}
      />
    )

    expect(screen.getByText("Loading messages...")).toBeInTheDocument()
    expect(screen.queryByText("No messages yet")).not.toBeInTheDocument()
  })

  it("hides the composer when the other participants have left the workspace", () => {
    render(
      <ChatThread
        conversationId="conversation_1"
        title="Declan Cowen"
        description=""
        members={[currentUser, formerUser]}
      />
    )

    expect(
      screen.getByText(
        "This chat is read-only because the other participants have left the workspace or deleted their account."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId("mock-rich-text-editor")
    ).not.toBeInTheDocument()
  })

  it("routes chat-message reaction clicks through the store action", () => {
    useAppStore.setState({
      chatMessages: [createReactionMessage()],
    })

    renderDirectChatThread()

    fireEvent.click(screen.getByRole("button", { name: /👍\s*1/ }))

    expect(toggleChatMessageReactionMock).toHaveBeenCalledWith(
      "message_1",
      "👍"
    )
  })

  it("keeps quote available for writable direct chat messages", () => {
    useAppStore.setState((state) => ({
      ...state,
      workspaceMemberships: [
        createTestWorkspaceMembership({
          workspaceId: "workspace_1",
          userId: currentUser.id,
          role: "admin",
        }),
        createTestWorkspaceMembership({
          workspaceId: "workspace_1",
          userId: formerUser.id,
          role: "member",
        }),
      ],
      chatMessages: [createReactionMessage()],
    }))

    renderDirectChatThread()

    expect(
      screen.getByRole("button", { name: "Quote message" })
    ).toBeInTheDocument()
  })

  it("marks visible messages read with the opened message ids", () => {
    useAppStore.setState({
      chatMessages: [
        createReactionMessage(),
        {
          ...createReactionMessage(),
          id: "message_2",
          content: "<p>Follow up</p>",
          createdAt: "2026-04-15T12:05:00.000Z",
        },
        {
          ...createReactionMessage(),
          id: "message_self",
          content: "<p>Sent by me</p>",
          createdBy: currentUser.id,
          createdAt: "2026-04-15T12:06:00.000Z",
        },
      ],
    })
    markChatReadMock.mockClear()

    renderDirectChatThread()

    expect(markChatReadMock).toHaveBeenLastCalledWith("conversation_1", [
      "message_1",
      "message_2",
    ])
  })

  it("renders seen, sent, and edited metadata in order without receipt timestamps", () => {
    const createdAt = "2026-04-15T19:04:00.000Z"
    const readAt = "2026-04-15T19:05:00.000Z"
    const editedAt = "2026-04-15T19:07:00.000Z"

    act(() => {
      useAppStore.setState({
        chatMessages: [
          {
            ...createReactionMessage(),
            createdBy: currentUser.id,
            createdAt,
            editedAt,
          },
        ],
        chatReadStates: [
          {
            id: "chat_read_state_user_former_conversation_1",
            userId: formerUser.id,
            conversationId: "conversation_1",
            readAt,
            unreadAt: null,
            messageReadAtById: {
              message_1: readAt,
            },
            createdAt: readAt,
            updatedAt: readAt,
          },
        ],
      })
    })

    renderDirectChatThread()

    const sentTimestamp = screen.getByText(formatChatMessageTime(createdAt))
    const metadata = sentTimestamp.parentElement

    expect(screen.getByLabelText("Seen")).toBeInTheDocument()
    expect(sentTimestamp).toBeInTheDocument()
    expect(screen.getByLabelText("Edited")).toBeInTheDocument()
    expect(metadata?.children[0]).toHaveAttribute("aria-label", "Seen")
    expect(metadata?.children[1]).toHaveTextContent("·")
    expect(metadata?.children[2]).toHaveAttribute("aria-label", "Edited")
    expect(metadata?.children[3]).toHaveTextContent("·")
    expect(metadata?.children[4]).toHaveTextContent(
      formatChatMessageTime(createdAt)
    )
    expect(metadata?.parentElement).toHaveStyle({
      gridTemplateColumns: "minmax(0, 1fr) max-content",
    })
    expect(sentTimestamp).not.toHaveTextContent(/AM|PM/)
    expect(sentTimestamp).not.toHaveTextContent("/")
    expect(
      screen.queryByText(formatChatMessageTime(readAt))
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(formatChatMessageTime(editedAt))
    ).not.toBeInTheDocument()
  })

  it("derives seen from conversation participants when member records are incomplete", () => {
    const readAt = "2026-04-15T12:05:00.000Z"

    useAppStore.setState({
      chatMessages: [
        {
          ...createReactionMessage(),
          createdBy: currentUser.id,
        },
      ],
      chatReadStates: [
        {
          id: "chat_read_state_user_former_conversation_1",
          userId: formerUser.id,
          conversationId: "conversation_1",
          readAt,
          unreadAt: null,
          messageReadAtById: {
            message_1: readAt,
          },
          createdAt: readAt,
          updatedAt: readAt,
        },
      ],
    })

    renderDirectChatThread({
      members: [currentUser],
    })

    expect(screen.getByLabelText("Seen")).toBeInTheDocument()
  })

  it("renders the conversation list action before the display name", () => {
    renderDirectChatThread({
      conversationListAction: (
        <button type="button" aria-label="Toggle conversation list" />
      ),
    })

    const action = screen.getByRole("button", {
      name: "Toggle conversation list",
    })
    const title = screen.getByText("Declan Cowen")

    expect(
      action.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("hides seen on messages sent by someone else", () => {
    setSingleMessageReadReceiptState(formerUser.id)

    renderDirectChatThread()

    expect(screen.queryByLabelText("Seen")).not.toBeInTheDocument()
  })

  it("hides seen when only the sender's own read state contains their sent message", () => {
    setSingleMessageReadReceiptState(currentUser.id)

    renderDirectChatThread()

    expect(screen.queryByLabelText("Seen")).not.toBeInTheDocument()
  })

  it("hides seen and sends no message receipts in team chats", () => {
    const readAt = "2026-04-15T12:05:00.000Z"

    useAppStore.setState({
      teams: [createTestTeam()],
      teamMemberships: [
        createTestTeamMembership({
          userId: currentUser.id,
          role: "member",
        }),
        createTestTeamMembership({
          userId: formerUser.id,
          role: "member",
        }),
      ],
      conversations: [
        {
          id: "conversation_1",
          kind: "chat",
          scopeType: "team",
          scopeId: "team_1",
          variant: "team",
          title: "Platform",
          description: "",
          participantIds: [currentUser.id, formerUser.id],
          roomId: null,
          roomName: null,
          createdBy: currentUser.id,
          createdAt: "2026-04-15T12:00:00.000Z",
          updatedAt: "2026-04-15T12:00:00.000Z",
          lastActivityAt: "2026-04-15T12:00:00.000Z",
        },
      ],
      chatMessages: [
        {
          ...createReactionMessage(),
          createdBy: currentUser.id,
        },
      ],
      chatReadStates: [
        {
          id: "chat_read_state_user_former_conversation_1",
          userId: formerUser.id,
          conversationId: "conversation_1",
          readAt,
          unreadAt: null,
          messageReadAtById: {
            message_1: readAt,
          },
          createdAt: readAt,
          updatedAt: readAt,
        },
      ],
    })

    renderDirectChatThread({
      title: "Platform",
      members: [currentUser, formerUser],
    })

    expect(screen.queryByLabelText("Seen")).not.toBeInTheDocument()
    expect(markChatReadMock).toHaveBeenLastCalledWith("conversation_1", [])
  })

  it("does not synthesize a read timestamp when no message receipt exists", () => {
    useAppStore.setState({
      chatMessages: [createReactionMessage()],
      chatReadStates: [
        {
          id: "chat_read_state_user_current_conversation_1",
          userId: currentUser.id,
          conversationId: "conversation_1",
          readAt: "2026-04-15T12:05:00.000Z",
          unreadAt: null,
          createdAt: "2026-04-15T12:05:00.000Z",
          updatedAt: "2026-04-15T12:05:00.000Z",
        },
      ],
    })

    renderDirectChatThread()

    expect(screen.queryByLabelText("Seen")).not.toBeInTheDocument()
    expect(screen.queryByText(/Read Apr 15/i)).not.toBeInTheDocument()
  })

  it("keeps same-sender message identity grouped across long gaps", () => {
    useAppStore.setState({
      chatMessages: [
        {
          id: "message_1",
          conversationId: "conversation_1",
          kind: "text",
          content: "<p>First</p>",
          callId: null,
          mentionUserIds: [],
          reactions: [],
          createdBy: currentUser.id,
          createdAt: "2026-04-15T12:00:00.000Z",
        },
        {
          id: "message_2",
          conversationId: "conversation_1",
          kind: "text",
          content: "<p>Thirty minutes later</p>",
          callId: null,
          mentionUserIds: [],
          reactions: [],
          createdBy: currentUser.id,
          createdAt: "2026-04-15T12:30:00.000Z",
        },
      ],
    })

    renderDirectChatThread()

    expect(screen.getAllByText("Current User")).toHaveLength(1)

    act(() => {
      useAppStore.setState({
        chatMessages: [
          {
            id: "message_1",
            conversationId: "conversation_1",
            kind: "text",
            content: "<p>First</p>",
            callId: null,
            mentionUserIds: [],
            reactions: [],
            createdBy: currentUser.id,
            createdAt: "2026-04-15T12:00:00.000Z",
          },
          {
            id: "message_2",
            conversationId: "conversation_1",
            kind: "text",
            content: "<p>Different person</p>",
            callId: null,
            mentionUserIds: [],
            reactions: [],
            createdBy: formerUser.id,
            createdAt: "2026-04-15T12:10:00.000Z",
          },
          {
            id: "message_3",
            conversationId: "conversation_1",
            kind: "text",
            content: "<p>Current user again</p>",
            callId: null,
            mentionUserIds: [],
            reactions: [],
            createdBy: currentUser.id,
            createdAt: "2026-04-15T12:40:00.000Z",
          },
        ],
      })
    })

    expect(screen.getAllByText("Current User")).toHaveLength(2)
  })

  it("unwraps stale non-url chat links while preserving visible URL links", () => {
    useAppStore.setState({
      chatMessages: [
        {
          id: "message_1",
          conversationId: "conversation_1",
          kind: "text",
          content:
            '<p>Open <a href="https://example.com">launch plan</a> today</p><p><a href="https://example.com">https://example.com</a></p>',
          callId: null,
          mentionUserIds: [],
          reactions: [],
          createdBy: currentUser.id,
          createdAt: "2026-04-15T12:00:00.000Z",
        },
      ],
    })

    const { container } = render(
      <ChatThread
        conversationId="conversation_1"
        title="Declan Cowen"
        description=""
        members={[currentUser, formerUser]}
      />
    )

    expect(
      screen.queryByRole("link", { name: "launch plan" })
    ).not.toBeInTheDocument()

    const link = screen.getByRole("link", { name: "https://example.com" })
    expect(link).toHaveAttribute("href", "https://example.com")
    expect(link).toHaveTextContent("https://example.com")
    expect(container.textContent).toContain("Open launch plan today")
    expect(container.querySelector(".tiptap")?.className).toContain(
      "[&_a]:underline"
    )
  })

  it("disables chat message actions when the current role is read-only", () => {
    useAppStore.setState((state) => ({
      ...state,
      workspaces: state.workspaces.map((workspace) => ({
        ...workspace,
        createdBy: formerUser.id,
      })),
      workspaceMemberships: [
        createTestWorkspaceMembership({
          workspaceId: "workspace_1",
          userId: currentUser.id,
          role: "viewer",
        }),
        createTestWorkspaceMembership({
          workspaceId: "workspace_1",
          userId: formerUser.id,
          role: "member",
        }),
      ],
      chatMessages: [
        {
          id: "message_current",
          conversationId: "conversation_1",
          kind: "text",
          content: "<p>Hello</p>",
          callId: null,
          mentionUserIds: [],
          reactions: [
            {
              emoji: "👍",
              userIds: [formerUser.id],
            },
          ],
          createdBy: currentUser.id,
          createdAt: "2026-04-15T12:00:00.000Z",
        },
      ],
    }))

    renderDirectChatThread()

    expect(screen.getByRole("button", { name: /👍\s*1/ })).toBeDisabled()
    expect(screen.queryByLabelText("Edit message")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Delete message")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Quote message")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("More reactions")).not.toBeInTheDocument()
  })

  it("keeps the reaction picker out of the active reaction row", () => {
    useAppStore.setState({
      chatMessages: [createReactionMessage()],
    })

    renderDirectChatThread()

    const reactionButton = screen.getByRole("button", { name: /👍\s*1/ })
    const actionsRow = reactionButton.parentElement

    expect(actionsRow).toBeTruthy()
    expect(actionsRow?.children).toHaveLength(1)
    expect(screen.queryByLabelText("React")).not.toBeInTheDocument()
    expect(screen.getByLabelText("More reactions")).toBeInTheDocument()
  })

  it("renders a typing indicator for remote chat participants", () => {
    useChatPresenceMock.mockReturnValue({
      participants: [
        {
          userId: formerUser.id,
          sessionId: "session_1",
          typing: true,
        },
      ],
      setTyping: vi.fn(),
    })

    render(
      <ChatThread
        conversationId="conversation_1"
        title="Declan Cowen"
        description=""
        members={[currentUser, formerUser]}
      />
    )

    expect(screen.getByText("Declan Cowen is typing")).toBeInTheDocument()
  })

  it("renders a combined typing indicator for two remote participants", () => {
    useChatPresenceMock.mockReturnValue({
      participants: [
        {
          userId: formerUser.id,
          sessionId: "session_1",
          typing: true,
        },
        {
          userId: markUser.id,
          sessionId: "session_2",
          typing: true,
        },
      ],
      setTyping: vi.fn(),
    })
    useAppStore.setState((state) => ({
      ...state,
      users: [...state.users, markUser],
      conversations: [
        {
          ...state.conversations[0],
          variant: "group",
          title: "Group chat",
          participantIds: [currentUser.id, formerUser.id, markUser.id],
        },
      ],
    }))

    render(
      <ChatThread
        conversationId="conversation_1"
        title="Group chat"
        description=""
        members={[currentUser, formerUser, markUser]}
      />
    )

    expect(
      screen.getByText("Declan Cowen & Mark Chen are typing")
    ).toBeInTheDocument()
  })

  it("renders a combined typing indicator for three remote participants", () => {
    useChatPresenceMock.mockReturnValue({
      participants: [
        {
          userId: formerUser.id,
          sessionId: "session_1",
          typing: true,
        },
        {
          userId: markUser.id,
          sessionId: "session_2",
          typing: true,
        },
        {
          userId: aliceUser.id,
          sessionId: "session_3",
          typing: true,
        },
      ],
      setTyping: vi.fn(),
    })
    useAppStore.setState((state) => ({
      ...state,
      users: [...state.users, markUser, aliceUser],
      conversations: [
        {
          ...state.conversations[0],
          variant: "group",
          title: "Group chat",
          participantIds: [
            currentUser.id,
            formerUser.id,
            markUser.id,
            aliceUser.id,
          ],
        },
      ],
    }))

    render(
      <ChatThread
        conversationId="conversation_1"
        title="Group chat"
        description=""
        members={[currentUser, formerUser, markUser, aliceUser]}
      />
    )

    expect(
      screen.getByText("Declan Cowen, Mark Chen and Alice Park are typing")
    ).toBeInTheDocument()
  })

  it("renders a generic typing indicator for more than three remote participants", () => {
    useChatPresenceMock.mockReturnValue({
      participants: [
        {
          userId: formerUser.id,
          sessionId: "session_1",
          typing: true,
        },
        {
          userId: markUser.id,
          sessionId: "session_2",
          typing: true,
        },
        {
          userId: aliceUser.id,
          sessionId: "session_3",
          typing: true,
        },
        {
          userId: zoeUser.id,
          sessionId: "session_4",
          typing: true,
        },
      ],
      setTyping: vi.fn(),
    })
    useAppStore.setState((state) => ({
      ...state,
      users: [...state.users, markUser, aliceUser, zoeUser],
      conversations: [
        {
          ...state.conversations[0],
          variant: "group",
          title: "Group chat",
          participantIds: [
            currentUser.id,
            formerUser.id,
            markUser.id,
            aliceUser.id,
            zoeUser.id,
          ],
        },
      ],
    }))

    render(
      <ChatThread
        conversationId="conversation_1"
        title="Group chat"
        description=""
        members={[currentUser, formerUser, markUser, aliceUser, zoeUser]}
      />
    )

    expect(screen.getByText("Several people are typing")).toBeInTheDocument()
  })

  it("publishes typing state while composing a message", () => {
    const setTypingMock = vi.fn()

    useChatPresenceMock.mockReturnValue({
      participants: [],
      setTyping: setTypingMock,
    })
    useAppStore.setState((state) => ({
      ...state,
      workspaceMemberships: [
        {
          workspaceId: "workspace_1",
          userId: currentUser.id,
          role: "member",
        },
        {
          workspaceId: "workspace_1",
          userId: formerUser.id,
          role: "member",
        },
      ],
    }))

    render(
      <ChatThread
        conversationId="conversation_1"
        title="Declan Cowen"
        description=""
        members={[currentUser, formerUser]}
      />
    )

    fireEvent.change(screen.getByTestId("mock-rich-text-editor"), {
      target: {
        value: "Hello",
      },
    })

    expect(setTypingMock).toHaveBeenCalledWith(true)
  })

  it("clears the composer after saving an edited chat message", () => {
    useAppStore.setState((state) => ({
      ...state,
      workspaceMemberships: [
        {
          workspaceId: "workspace_1",
          userId: currentUser.id,
          role: "member",
        },
        {
          workspaceId: "workspace_1",
          userId: formerUser.id,
          role: "member",
        },
      ],
      chatMessages: [
        {
          id: "message_1",
          conversationId: "conversation_1",
          kind: "text",
          content: "<p>Original</p>",
          callId: null,
          mentionUserIds: [],
          reactions: [],
          createdBy: currentUser.id,
          createdAt: "2026-04-15T12:00:00.000Z",
        },
      ],
    }))

    renderDirectChatThread()

    fireEvent.click(screen.getByRole("button", { name: "Edit message" }))

    const editor = screen.getByTestId(
      "mock-rich-text-editor"
    ) as HTMLInputElement

    expect(editor.value).toBe("Original")

    fireEvent.change(editor, {
      target: {
        value: "Edited",
      },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(updateChatMessageMock).toHaveBeenCalledWith("message_1", {
      content: "<p>Edited</p>",
    })
    expect(
      screen.getByTestId("mock-rich-text-editor") as HTMLInputElement
    ).toHaveValue("")
  })

  it("removes deleted chat messages for other participants", () => {
    useAppStore.setState((state) => ({
      ...state,
      chatMessages: [
        {
          id: "message_deleted_other",
          conversationId: "conversation_1",
          kind: "text",
          content: "",
          callId: null,
          mentionUserIds: [],
          reactions: [],
          createdBy: formerUser.id,
          createdAt: "2026-04-15T12:00:00.000Z",
          deletedAt: "2026-04-15T12:01:00.000Z",
        },
        {
          id: "message_deleted_current",
          conversationId: "conversation_1",
          kind: "text",
          content: "",
          callId: null,
          mentionUserIds: [],
          reactions: [],
          createdBy: currentUser.id,
          createdAt: "2026-04-15T12:02:00.000Z",
          deletedAt: "2026-04-15T12:03:00.000Z",
        },
      ],
    }))

    const { container } = render(
      <ChatThread
        conversationId="conversation_1"
        title="Declan Cowen"
        description=""
        members={[currentUser, formerUser]}
      />
    )

    expect(screen.getByText("You deleted a message")).toBeInTheDocument()
    expect(container.querySelectorAll('[class*="group/msg"]')).toHaveLength(1)
  })

  it("scrolls the newest message fully into view when a message is added", () => {
    const scrollIntoViewMock = vi.fn()
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0)
        return 1
      })
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {})
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    })

    try {
      render(
        <ChatThread
          conversationId="conversation_1"
          title="Declan Cowen"
          description=""
          members={[currentUser, formerUser]}
        />
      )

      scrollIntoViewMock.mockClear()

      act(() => {
        useAppStore.setState({
          chatMessages: [
            {
              id: "message_1",
              conversationId: "conversation_1",
              kind: "text",
              content: "<p>Hello</p>",
              callId: null,
              mentionUserIds: [],
              reactions: [],
              createdBy: currentUser.id,
              createdAt: "2026-04-15T12:00:00.000Z",
            },
          ],
        })
      })

      expect(scrollIntoViewMock).toHaveBeenCalled()
      expect(scrollIntoViewMock).toHaveBeenLastCalledWith({ block: "end" })
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      })
      requestAnimationFrameSpy.mockRestore()
      cancelAnimationFrameSpy.mockRestore()
    }
  })
})

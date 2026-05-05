import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

import { ChatThread } from "@/components/app/collaboration-screens/chat-thread"
import { getChatWelcomeIntroDisplay } from "@/components/app/collaboration-screens/chat-welcome-display"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestUser,
  createTestWorkspaceShellData,
} from "@/tests/lib/fixtures/app-data"

const useChatPresenceMock = vi.hoisted(() => vi.fn())

vi.mock("@/components/app/rich-text-editor", () => ({
  RichTextEditor: ({
    placeholder,
    onChange,
  }: {
    placeholder?: string
    onChange?: (value: string) => void
  }) => (
    <input
      data-testid="mock-rich-text-editor"
      aria-label={placeholder}
      onChange={(event) =>
        onChange?.(`<p>${(event.target as HTMLInputElement).value}</p>`)
      }
    />
  ),
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

function renderDirectChatThread() {
  render(
    <ChatThread
      conversationId="conversation_1"
      title="Declan Cowen"
      description=""
      members={[currentUser, formerUser]}
    />
  )
}

beforeEach(() => {
  toggleChatMessageReactionMock.mockReset()
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
    toggleChatMessageReaction: toggleChatMessageReactionMock,
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

    fireEvent.click(screen.getByText("👍").closest("button") as HTMLButtonElement)

    expect(toggleChatMessageReactionMock).toHaveBeenCalledWith("message_1", "👍")
  })

  it("renders the react trigger after active reaction pills", () => {
    useAppStore.setState({
      chatMessages: [createReactionMessage()],
    })

    renderDirectChatThread()

    const reactionButton = screen.getByText("👍").closest(
      "button"
    ) as HTMLButtonElement
    const reactButton = screen.getByLabelText("React")
    const actionsRow = reactionButton.parentElement

    expect(actionsRow).toBeTruthy()
    expect(actionsRow?.lastElementChild).toBe(reactButton)
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

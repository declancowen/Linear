import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { ChatThread } from "@/components/app/collaboration-screens/chat-thread"
import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"

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

const currentUser = {
  id: "user_current",
  name: "Current User",
  handle: "current-user",
  email: "current@example.com",
  avatarUrl: "",
  avatarImageUrl: null,
  workosUserId: null,
  title: "Founder",
  status: "active" as const,
  statusMessage: "",
  hasExplicitStatus: false,
  accountDeletionPendingAt: null,
  accountDeletedAt: null,
  preferences: {
    emailMentions: true,
    emailAssignments: true,
    emailDigest: true,
    theme: "system" as const,
  },
}

const formerUser = {
  id: "user_former",
  name: "Declan Cowen",
  handle: "declan-cowen",
  email: "declan@example.com",
  avatarUrl: "",
  avatarImageUrl: null,
  workosUserId: null,
  title: "Product Owner",
  status: "out-of-office" as const,
  statusMessage: "Away",
  hasExplicitStatus: true,
  accountDeletionPendingAt: null,
  accountDeletedAt: null,
  preferences: {
    emailMentions: true,
    emailAssignments: true,
    emailDigest: true,
    theme: "system" as const,
  },
}

const markUser = {
  id: "user_mark",
  name: "Mark Chen",
  handle: "mark-chen",
  email: "mark@example.com",
  avatarUrl: "",
  avatarImageUrl: null,
  workosUserId: null,
  title: "Designer",
  status: "active" as const,
  statusMessage: "",
  hasExplicitStatus: false,
  accountDeletionPendingAt: null,
  accountDeletedAt: null,
  preferences: {
    emailMentions: true,
    emailAssignments: true,
    emailDigest: true,
    theme: "system" as const,
  },
}

const aliceUser = {
  id: "user_alice",
  name: "Alice Park",
  handle: "alice-park",
  email: "alice@example.com",
  avatarUrl: "",
  avatarImageUrl: null,
  workosUserId: null,
  title: "Engineer",
  status: "active" as const,
  statusMessage: "",
  hasExplicitStatus: false,
  accountDeletionPendingAt: null,
  accountDeletedAt: null,
  preferences: {
    emailMentions: true,
    emailAssignments: true,
    emailDigest: true,
    theme: "system" as const,
  },
}

const zoeUser = {
  id: "user_zoe",
  name: "Zoe Kim",
  handle: "zoe-kim",
  email: "zoe@example.com",
  avatarUrl: "",
  avatarImageUrl: null,
  workosUserId: null,
  title: "PM",
  status: "active" as const,
  statusMessage: "",
  hasExplicitStatus: false,
  accountDeletionPendingAt: null,
  accountDeletedAt: null,
  preferences: {
    emailMentions: true,
    emailAssignments: true,
    emailDigest: true,
    theme: "system" as const,
  },
}

const toggleChatMessageReactionMock = vi.fn()

beforeEach(() => {
  toggleChatMessageReactionMock.mockReset()
  useChatPresenceMock.mockReset()
  useChatPresenceMock.mockReturnValue({
    participants: [],
    setTyping: vi.fn(),
  })
  useAppStore.setState({
    ...createEmptyState(),
    currentUserId: currentUser.id,
    currentWorkspaceId: "workspace_1",
    workspaces: [
      {
        id: "workspace_1",
        slug: "workspace-1",
        name: "Workspace 1",
        logoUrl: "",
        logoImageUrl: null,
        createdBy: currentUser.id,
        workosOrganizationId: null,
        settings: {
          accent: "#000000",
          description: "",
        },
      },
    ],
    workspaceMemberships: [],
    teams: [],
    teamMemberships: [],
    users: [currentUser, formerUser],
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
      chatMessages: [
        {
          id: "message_1",
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
          createdBy: formerUser.id,
          createdAt: "2026-04-15T12:00:00.000Z",
        },
      ],
    })

    render(
      <ChatThread
        conversationId="conversation_1"
        title="Declan Cowen"
        description=""
        members={[currentUser, formerUser]}
      />
    )

    fireEvent.click(screen.getByText("👍").closest("button") as HTMLButtonElement)

    expect(toggleChatMessageReactionMock).toHaveBeenCalledWith("message_1", "👍")
  })

  it("renders the react trigger after active reaction pills", () => {
    useAppStore.setState({
      chatMessages: [
        {
          id: "message_1",
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
          createdBy: formerUser.id,
          createdAt: "2026-04-15T12:00:00.000Z",
        },
      ],
    })

    render(
      <ChatThread
        conversationId="conversation_1"
        title="Declan Cowen"
        description=""
        members={[currentUser, formerUser]}
      />
    )

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
})

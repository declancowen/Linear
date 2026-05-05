import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

import "@/tests/lib/fixtures/collaboration-screen-ui-mocks"
import {
  TeamChannelsScreen,
  TeamChatScreen,
  WorkspaceChannelsScreen,
} from "@/components/app/collaboration-screens"
import type { ChannelPost, Conversation } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestAppData,
  createTestTeam,
  createTestTeamMembership,
  createTestUser,
  createTestWorkspace,
} from "@/tests/lib/fixtures/app-data"

const useScopedReadModelRefreshMock = vi.hoisted(() => vi.fn())
const createChannelMock = vi.hoisted(() => vi.fn())
const ensureTeamChatMock = vi.hoisted(() => vi.fn())
const REFRESH_LOADING = {
  error: null,
  hasLoadedOnce: false,
  refreshing: true,
}
const REFRESH_READY = {
  error: null,
  hasLoadedOnce: true,
  refreshing: false,
}

vi.mock("@/hooks/use-scoped-read-model-refresh", () => ({
  useScopedReadModelRefresh: useScopedReadModelRefreshMock,
}))

vi.mock("@/lib/convex/client", () => ({
  fetchChannelFeedReadModel: vi.fn(),
  fetchConversationListReadModel: vi.fn(),
  fetchConversationThreadReadModel: vi.fn(),
}))

vi.mock("@/components/app/collaboration-screens/chat-thread", () => ({
  ChatThread: ({ loaded }: { loaded?: boolean }) => (
    <div>{`Chat thread loaded:${String(loaded)}`}</div>
  ),
}))

vi.mock("@/components/app/collaboration-screens/call-invite-launcher", () => ({
  CallInviteLauncher: () => null,
}))

vi.mock("@/components/app/collaboration-screens/channel-ui", () => ({
  ForumPostCard: ({ postId }: { postId: string }) => <div>{`Forum post ${postId}`}</div>,
  NewPostComposer: () => <div>Composer</div>,
}))

vi.mock("@phosphor-icons/react", () => ({
  Hash: () => null,
  PaperPlaneTilt: () => null,
}))

function seedBaseState() {
  useAppStore.setState({
    ...createTestAppData({
      workspaces: [
        createTestWorkspace({
          slug: "workspace-1",
          name: "Workspace 1",
          workosOrganizationId: null,
          settings: {
            accent: "#000000",
            description: "",
          },
        }),
      ],
      teams: [
        createTestTeam({
          icon: "rocket",
          settings: {
            joinCode: "JOIN123",
            summary: "",
            features: {
              issues: true,
              projects: true,
              docs: true,
              chat: true,
              channels: true,
              views: true,
            },
          },
        }),
      ],
      teamMemberships: [
        createTestTeamMembership({
          role: "admin",
        }),
      ],
      users: [
        createTestUser({
          name: "Alex Example",
          title: "Engineer",
        }),
      ],
    }),
    createChannel: createChannelMock,
    ensureTeamChat: ensureTeamChatMock,
  })
}

function mockScopedRefreshSequence(
  ...states: Array<typeof REFRESH_LOADING | typeof REFRESH_READY>
) {
  for (const state of states) {
    useScopedReadModelRefreshMock.mockReturnValueOnce(state)
  }
}

function createConversation(overrides: Partial<Conversation>): Conversation {
  return {
    id: "conversation_1",
    kind: "channel",
    scopeType: "team",
    scopeId: "team_1",
    variant: "group",
    title: "Announcements",
    description: "",
    participantIds: ["user_1"],
    roomId: null,
    roomName: null,
    createdBy: "user_1",
    createdAt: "2026-04-22T00:00:00.000Z",
    updatedAt: "2026-04-22T00:00:00.000Z",
    lastActivityAt: "2026-04-22T00:00:00.000Z",
    ...overrides,
  }
}

function createOrderedChannelPosts(conversationId: string): ChannelPost[] {
  return [
    {
      id: "older-post",
      conversationId,
      title: "Older",
      content: "<p>Older</p>",
      createdBy: "user_1",
      mentionUserIds: [],
      reactions: [],
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    },
    {
      id: "newer-post",
      conversationId,
      title: "Newer",
      content: "<p>Newer</p>",
      createdBy: "user_1",
      mentionUserIds: [],
      reactions: [],
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    },
  ]
}

describe("collaboration screen loading", () => {
  beforeEach(() => {
    useScopedReadModelRefreshMock.mockReset()
    createChannelMock.mockReset()
    ensureTeamChatMock.mockReset()
    seedBaseState()
  })

  it("waits for the conversation list before showing workspace-channel setup or auto-creating", async () => {
    mockScopedRefreshSequence(REFRESH_LOADING, REFRESH_LOADING)

    render(<WorkspaceChannelsScreen />)

    expect(screen.getByText("Loading channel...")).toBeInTheDocument()
    expect(
      screen.queryByText("Setting up workspace channel")
    ).not.toBeInTheDocument()

    await waitFor(() => {
      expect(createChannelMock).not.toHaveBeenCalled()
    })
  })

  it("auto-creates the workspace channel only after the conversation list has loaded", async () => {
    mockScopedRefreshSequence(REFRESH_READY, REFRESH_LOADING)

    render(<WorkspaceChannelsScreen />)

    await waitFor(() => {
      expect(createChannelMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "workspace_1",
          silent: true,
        })
      )
    })
  })

  it("waits for the conversation list before showing team-chat setup or auto-creating", async () => {
    mockScopedRefreshSequence(REFRESH_LOADING, REFRESH_LOADING)

    render(<TeamChatScreen teamSlug="platform" />)

    expect(screen.getByText("Loading team chat...")).toBeInTheDocument()
    expect(screen.queryByText("Setting up team chat")).not.toBeInTheDocument()

    await waitFor(() => {
      expect(ensureTeamChatMock).not.toHaveBeenCalled()
    })
  })

  it("passes an unresolved thread through as a loading chat thread", () => {
    useAppStore.setState({
      conversations: [
        createConversation({
          kind: "chat",
          variant: "team",
          title: "Team chat",
        }),
      ],
    })
    mockScopedRefreshSequence(REFRESH_READY, REFRESH_LOADING)

    render(<TeamChatScreen teamSlug="platform" />)

    expect(screen.getByText("Chat thread loaded:false")).toBeInTheDocument()
  })

  it("shows a loading state for team-channel posts before the first feed refresh completes", () => {
    useAppStore.setState({
      conversations: [
        createConversation({
          id: "channel_1",
        }),
      ],
    })
    mockScopedRefreshSequence(REFRESH_READY, REFRESH_LOADING)

    render(<TeamChannelsScreen teamSlug="platform" />)

    expect(screen.getByText("Loading posts...")).toBeInTheDocument()
    expect(screen.queryByText("No posts yet")).not.toBeInTheDocument()
  })

  it("orders workspace channel posts by activity date", () => {
    useAppStore.setState({
      conversations: [
        createConversation({
          id: "workspace_channel_1",
          scopeType: "workspace",
          scopeId: "workspace_1",
          title: "Workspace channel",
        }),
      ],
      channelPosts: createOrderedChannelPosts("workspace_channel_1"),
    })
    mockScopedRefreshSequence(REFRESH_READY, REFRESH_READY)

    render(<WorkspaceChannelsScreen />)

    expect(
      screen.getAllByText(/Forum post/).map((node) => node.textContent)
    ).toEqual(["Forum post older-post", "Forum post newer-post"])
  })

  it("orders team channel posts by activity date", () => {
    useAppStore.setState({
      conversations: [
        createConversation({
          id: "team_channel_1",
        }),
      ],
      channelPosts: createOrderedChannelPosts("team_channel_1"),
    })
    mockScopedRefreshSequence(REFRESH_READY, REFRESH_READY)

    render(<TeamChannelsScreen teamSlug="platform" />)

    expect(
      screen.getAllByText(/Forum post/).map((node) => node.textContent)
    ).toEqual(["Forum post older-post", "Forum post newer-post"])
  })
})

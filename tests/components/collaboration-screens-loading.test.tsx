import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

import {
  TeamChannelsScreen,
  TeamChatScreen,
  WorkspaceChannelsScreen,
} from "@/components/app/collaboration-screens"
import { createEmptyState } from "@/lib/domain/empty-state"
import { createDefaultTeamWorkflowSettings } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

const useScopedReadModelRefreshMock = vi.hoisted(() => vi.fn())
const createChannelMock = vi.hoisted(() => vi.fn())
const ensureTeamChatMock = vi.hoisted(() => vi.fn())

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

vi.mock("@/components/app/collaboration-screens/shared-ui", () => ({
  ChatHeaderActions: ({
    detailsAction,
  }: {
    detailsAction?: ReactNode
  }) => <div>{detailsAction}</div>,
  DetailsSidebarToggle: () => null,
  EmptyState: ({
    title,
    description,
  }: {
    title: string
    description: string
  }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
  PageHeader: ({
    title,
  }: {
    title: string
  }) => <div>{title}</div>,
  SurfaceSidebarContent: () => null,
  TeamSurfaceSidebar: () => null,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@phosphor-icons/react", () => ({
  Hash: () => null,
  PaperPlaneTilt: () => null,
}))

function seedBaseState() {
  useAppStore.setState({
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
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
    teams: [
      {
        id: "team_1",
        workspaceId: "workspace_1",
        slug: "platform",
        name: "Platform",
        icon: "rocket",
        settings: {
          joinCode: "JOIN123",
          summary: "",
          guestProjectIds: [],
          guestDocumentIds: [],
          guestWorkItemIds: [],
          experience: "software-development",
          features: {
            issues: true,
            projects: true,
            docs: true,
            chat: true,
            channels: true,
            views: true,
          },
          workflow: createDefaultTeamWorkflowSettings("software-development"),
        },
      },
    ],
    teamMemberships: [
      {
        teamId: "team_1",
        userId: "user_1",
        role: "admin",
      },
    ],
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
    createChannel: createChannelMock,
    ensureTeamChat: ensureTeamChatMock,
  })
}

describe("collaboration screen loading", () => {
  beforeEach(() => {
    useScopedReadModelRefreshMock.mockReset()
    createChannelMock.mockReset()
    ensureTeamChatMock.mockReset()
    seedBaseState()
  })

  it("waits for the conversation list before showing workspace-channel setup or auto-creating", async () => {
    useScopedReadModelRefreshMock
      .mockReturnValueOnce({
        error: null,
        hasLoadedOnce: false,
        refreshing: true,
      })
      .mockReturnValueOnce({
        error: null,
        hasLoadedOnce: false,
        refreshing: true,
      })

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
    useScopedReadModelRefreshMock
      .mockReturnValueOnce({
        error: null,
        hasLoadedOnce: true,
        refreshing: false,
      })
      .mockReturnValueOnce({
        error: null,
        hasLoadedOnce: false,
        refreshing: true,
      })

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
    useScopedReadModelRefreshMock
      .mockReturnValueOnce({
        error: null,
        hasLoadedOnce: false,
        refreshing: true,
      })
      .mockReturnValueOnce({
        error: null,
        hasLoadedOnce: false,
        refreshing: true,
      })

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
        {
          id: "conversation_1",
          kind: "chat",
          scopeType: "team",
          scopeId: "team_1",
          variant: "team",
          title: "Team chat",
          description: "",
          participantIds: ["user_1"],
          roomId: null,
          roomName: null,
          createdBy: "user_1",
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z",
          lastActivityAt: "2026-04-22T00:00:00.000Z",
        },
      ],
    })
    useScopedReadModelRefreshMock
      .mockReturnValueOnce({
        error: null,
        hasLoadedOnce: true,
        refreshing: false,
      })
      .mockReturnValueOnce({
        error: null,
        hasLoadedOnce: false,
        refreshing: true,
      })

    render(<TeamChatScreen teamSlug="platform" />)

    expect(screen.getByText("Chat thread loaded:false")).toBeInTheDocument()
  })

  it("shows a loading state for team-channel posts before the first feed refresh completes", () => {
    useAppStore.setState({
      conversations: [
        {
          id: "channel_1",
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
        },
      ],
    })
    useScopedReadModelRefreshMock
      .mockReturnValueOnce({
        error: null,
        hasLoadedOnce: true,
        refreshing: false,
      })
      .mockReturnValueOnce({
        error: null,
        hasLoadedOnce: false,
        refreshing: true,
      })

    render(<TeamChannelsScreen teamSlug="platform" />)

    expect(screen.getByText("Loading posts...")).toBeInTheDocument()
    expect(screen.queryByText("No posts yet")).not.toBeInTheDocument()
  })

  it("orders workspace channel posts by creation date instead of reply activity", () => {
    useAppStore.setState({
      conversations: [
        {
          id: "workspace_channel_1",
          kind: "channel",
          scopeType: "workspace",
          scopeId: "workspace_1",
          variant: "group",
          title: "Workspace channel",
          description: "",
          participantIds: ["user_1"],
          roomId: null,
          roomName: null,
          createdBy: "user_1",
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z",
          lastActivityAt: "2026-04-22T00:00:00.000Z",
        },
      ],
      channelPosts: [
        {
          id: "older-post",
          conversationId: "workspace_channel_1",
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
          conversationId: "workspace_channel_1",
          title: "Newer",
          content: "<p>Newer</p>",
          createdBy: "user_1",
          mentionUserIds: [],
          reactions: [],
          createdAt: "2026-04-23T00:00:00.000Z",
          updatedAt: "2026-04-23T00:00:00.000Z",
        },
      ],
    })
    useScopedReadModelRefreshMock
      .mockReturnValueOnce({
        error: null,
        hasLoadedOnce: true,
        refreshing: false,
      })
      .mockReturnValueOnce({
        error: null,
        hasLoadedOnce: true,
        refreshing: false,
      })

    render(<WorkspaceChannelsScreen />)

    expect(
      screen.getAllByText(/Forum post/).map((node) => node.textContent)
    ).toEqual(["Forum post newer-post", "Forum post older-post"])
  })
})

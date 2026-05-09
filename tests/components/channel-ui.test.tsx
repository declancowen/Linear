import type { ReactNode } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import "@/tests/lib/fixtures/rich-text-composer-mocks"
import {
  NewPostComposer,
} from "@/components/app/collaboration-screens/channel-ui"
import {
  ForumPostAuthorLine,
  ForumPostAvatar,
  ForumPostCommentItem,
} from "@/components/app/collaboration-screens/channel-post-primitives"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { createTestUser } from "@/tests/lib/fixtures/app-data"

vi.mock("@/components/app/user-presence", () => ({
  UserAvatar: () => <span>User</span>,
  UserHoverCard: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/dropdown-menu", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createDropdownMenuStubModule()
)

vi.mock("@/components/ui/confirm-dialog", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createConfirmDialogStubModule()
)

vi.mock("@/components/app/rich-text-content", () => ({
  RichTextContent: ({ content }: { content: string }) => <div>{content}</div>,
}))

describe("Forum post display primitives", () => {
  const author = createTestUser({
    id: "user_author",
    name: "Maya Patel",
    avatarUrl: "https://example.com/avatar.png",
    status: "active",
  })

  it("renders post and comment author lines with fallback author names", () => {
    render(
      <>
        <ForumPostAuthorLine
          author={author}
          createdAt="2026-04-18T10:00:00.000Z"
          currentUserId="user_current"
          workspaceId="workspace_1"
        />
        <ForumPostAuthorLine
          author={undefined}
          createdAt="2026-04-18T11:00:00.000Z"
          currentUserId="user_current"
          workspaceId={null}
          size="comment"
        />
      </>
    )

    expect(screen.getByText("Maya Patel")).toBeInTheDocument()
    expect(screen.getByText("Unknown")).toBeInTheDocument()
  })

  it("renders comment content and avatar fallbacks through the channel owner", () => {
    const usersById = new Map([[author.id, author]])

    render(
      <>
        <ForumPostCommentItem
          comment={{
            id: "comment_1",
            postId: "post_1",
            content: "<p>Looks good.</p>",
            mentionUserIds: [],
            createdBy: author.id,
            createdAt: "2026-04-18T10:30:00.000Z",
          }}
          currentUserId="user_current"
          usersById={usersById}
          workspaceId="workspace_1"
        />
        <ForumPostAvatar author={undefined} />
      </>
    )

    expect(screen.getByText("Maya Patel")).toBeInTheDocument()
    expect(screen.getByText("<p>Looks good.</p>")).toBeInTheDocument()
    expect(screen.getAllByText("User")).toHaveLength(2)
  })
})

describe("NewPostComposer", () => {
  const createChannelPostMock = vi.fn()

  beforeEach(() => {
    createChannelPostMock.mockReset()
    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      createChannelPost: createChannelPostMock as never,
      users: [
        {
          id: "user_1",
          name: "Alex",
          handle: "alex",
          email: "alex@example.com",
          avatarUrl: "",
          avatarImageUrl: null,
          workosUserId: null,
          title: "Founder",
          status: "active",
          statusMessage: "",
          hasExplicitStatus: false,
          preferences: {
            emailMentions: true,
            emailAssignments: true,
            emailDigest: true,
            theme: "system",
          },
        },
      ],
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
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
          lastActivityAt: "2026-04-18T10:00:00.000Z",
        },
      ],
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "platform",
          name: "Platform",
          icon: "robot",
          settings: {
            joinCode: "JOIN1234",
            summary: "Platform team",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "software-development",
            features: createDefaultTeamFeatureSettings("software-development"),
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
      workspaceMemberships: [],
    })
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  it("keeps post submit disabled until the shared minimum plain-text length is met", () => {
    render(<NewPostComposer channelId="channel_1" />)

    act(() => {
      fireEvent.click(
        screen.getByRole("button", {
          name: /Start a new thread/,
        })
      )
    })

    const editor = screen.getByLabelText(
      "Write something the whole channel can read and reply to…"
    )
    const button = screen.getByRole("button", { name: "Post" })

    act(() => {
      fireEvent.change(editor, {
        target: {
          value: "a",
        },
      })
    })

    expect(button).toBeDisabled()
    expect(screen.getByText("Enter at least 2 characters")).toBeInTheDocument()

    act(() => {
      fireEvent.change(editor, {
        target: {
          value: "ab",
        },
      })
    })

    expect(button).toBeEnabled()
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import {
  PeopleProfileScreen,
  PeopleScreen,
} from "@/components/app/people-screen"
import { useAppStore } from "@/lib/store/app-store"
import type {
  AppData,
  ChannelPost,
  ChannelPostComment,
  ChatMessage,
  Comment,
  Conversation,
  ProjectUpdate,
} from "@/lib/domain/types"
import {
  createTestAppData,
  createTestDocument,
  createTestProject,
  createTestTeam,
  createTestTeamMembership,
  createTestUser,
  createTestWorkItem,
  createTestWorkspace,
  createTestWorkspaceMembership,
} from "@/tests/lib/fixtures/app-data"

const routerPushMock = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}))

vi.mock("@/hooks/use-scoped-read-model-refresh", () => ({
  useScopedReadModelRefresh: () => ({
    error: null,
    hasLoadedOnce: true,
    refreshing: false,
  }),
}))

vi.mock("@/components/ui/sidebar", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createSidebarTriggerStubModule()
)

const currentUser = createTestUser({
  id: "user_current",
  name: "Current User",
  handle: "current",
  email: "current@example.com",
  title: "Founder",
})

const maya = createTestUser({
  id: "user_maya",
  name: "Maya Singh",
  handle: "maya",
  email: "maya@example.com",
  title: "Product Designer",
})

const sam = createTestUser({
  id: "user_sam",
  name: "Sam Lee",
  handle: "sam",
  email: "sam@example.com",
  title: "Engineer",
})

const deletedUser = createTestUser({
  id: "user_deleted",
  name: "Deleted User",
  handle: "deleted",
  email: "deleted@example.com",
  accountDeletedAt: "2026-04-18T10:00:00.000Z",
})

function createComment(overrides: Partial<Comment>): Comment {
  return {
    id: "comment_1",
    targetType: "workItem",
    targetId: "item_1",
    parentCommentId: null,
    content: "Comment",
    mentionUserIds: [],
    reactions: [],
    createdBy: maya.id,
    createdAt: "2026-04-18T10:10:00.000Z",
    ...overrides,
  }
}

function createPeopleTestData(): AppData {
  const workspace = createTestWorkspace({
    id: "workspace_1",
    createdBy: currentUser.id,
  })
  const platform = createTestTeam({
    id: "team_1",
    workspaceId: workspace.id,
    name: "Platform",
  })
  const design = createTestTeam({
    id: "team_2",
    workspaceId: workspace.id,
    name: "Design",
  })
  const workItem = createTestWorkItem("item_created", {
    creatorId: maya.id,
    title: "Export CSV",
    createdAt: "2026-04-18T09:00:00.000Z",
  })
  const hiddenPrivateItem = createTestWorkItem("item_private", {
    creatorId: maya.id,
    title: "Hidden private task",
    visibility: "private",
    createdAt: "2026-04-18T09:30:00.000Z",
  })
  const document = createTestDocument({
    id: "doc_1",
    kind: "workspace-document",
    teamId: null,
    title: "Launch plan",
  })
  const project = createTestProject({
    id: "project_1",
    scopeType: "workspace",
    scopeId: workspace.id,
    name: "Website refresh",
    leadId: maya.id,
  })
  const channel: Conversation = {
    id: "channel_1",
    kind: "channel",
    scopeType: "workspace",
    scopeId: workspace.id,
    variant: "team",
    title: "Announcements",
    description: "",
    participantIds: [],
    createdBy: currentUser.id,
    createdAt: "2026-04-18T08:00:00.000Z",
    updatedAt: "2026-04-18T08:00:00.000Z",
    lastActivityAt: "2026-04-18T08:00:00.000Z",
  }
  const directChat: Conversation = {
    ...channel,
    id: "chat_1",
    kind: "chat",
    variant: "direct",
    participantIds: [currentUser.id, maya.id],
  }
  const channelPost: ChannelPost = {
    id: "post_1",
    conversationId: channel.id,
    title: "Shipping notes",
    content: "<p>Post</p>",
    mentionUserIds: [],
    reactions: [],
    createdBy: maya.id,
    createdAt: "2026-04-18T10:40:00.000Z",
    updatedAt: "2026-04-18T10:40:00.000Z",
  }
  const channelComment: ChannelPostComment = {
    id: "post_comment_1",
    postId: channelPost.id,
    content: "Looks good",
    mentionUserIds: [],
    reactions: [],
    createdBy: maya.id,
    createdAt: "2026-04-18T10:45:00.000Z",
  }
  const projectUpdate: ProjectUpdate = {
    id: "update_1",
    projectId: project.id,
    content: "Posted update",
    createdBy: maya.id,
    createdAt: "2026-04-18T10:50:00.000Z",
  }
  const directMessage: ChatMessage = {
    id: "message_1",
    conversationId: directChat.id,
    kind: "text",
    content: "secret direct chat",
    mentionUserIds: [],
    reactions: [],
    createdBy: maya.id,
    createdAt: "2026-04-18T11:00:00.000Z",
  }

  return createTestAppData({
    currentUserId: currentUser.id,
    currentWorkspaceId: workspace.id,
    workspaces: [workspace],
    workspaceMemberships: [
      createTestWorkspaceMembership({
        workspaceId: workspace.id,
        userId: currentUser.id,
        role: "admin",
      }),
      createTestWorkspaceMembership({
        workspaceId: workspace.id,
        userId: maya.id,
        role: "member",
      }),
      createTestWorkspaceMembership({
        workspaceId: workspace.id,
        userId: deletedUser.id,
        role: "member",
      }),
    ],
    teams: [platform, design],
    teamMemberships: [
      createTestTeamMembership({
        teamId: platform.id,
        userId: currentUser.id,
        role: "admin",
      }),
      createTestTeamMembership({
        teamId: platform.id,
        userId: maya.id,
        role: "member",
      }),
      createTestTeamMembership({
        teamId: design.id,
        userId: sam.id,
        role: "admin",
      }),
    ],
    users: [currentUser, maya, sam, deletedUser],
    workItems: [workItem, hiddenPrivateItem],
    workItemActivities: [
      {
        id: "activity_status",
        itemId: workItem.id,
        actorId: maya.id,
        type: "status-change",
        fromStatus: "todo",
        toStatus: "done",
        createdAt: "2026-04-18T10:05:00.000Z",
      },
      {
        id: "activity_labels",
        itemId: workItem.id,
        actorId: maya.id,
        type: "label-change",
        fromLabelIds: [],
        toLabelIds: ["label_1"],
        createdAt: "2026-04-18T10:15:00.000Z",
      },
      {
        id: "activity_private",
        itemId: hiddenPrivateItem.id,
        actorId: maya.id,
        type: "status-change",
        fromStatus: "todo",
        toStatus: "done",
        createdAt: "2026-04-18T10:25:00.000Z",
      },
    ],
    documents: [document],
    comments: [
      createComment({
        id: "comment_work",
        targetType: "workItem",
        targetId: workItem.id,
        createdAt: "2026-04-18T10:20:00.000Z",
      }),
      createComment({
        id: "comment_doc",
        targetType: "document",
        targetId: document.id,
        createdAt: "2026-04-18T10:30:00.000Z",
      }),
      createComment({
        id: "comment_private",
        targetType: "workItem",
        targetId: hiddenPrivateItem.id,
        createdAt: "2026-04-18T10:35:00.000Z",
      }),
    ],
    projects: [project],
    projectUpdates: [projectUpdate],
    conversations: [channel, directChat],
    chatMessages: [directMessage],
    channelPosts: [channelPost],
    channelPostComments: [channelComment],
  })
}

beforeEach(() => {
  routerPushMock.mockReset()
  useAppStore.setState(createPeopleTestData())
})

describe("people workspace screens", () => {
  it("renders workspace people in a width-aware responsive board", () => {
    render(<PeopleScreen />)

    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument()
    const grid = screen.getByTestId("people-grid")

    expect(grid).toHaveClass(
      "grid-cols-[repeat(auto-fill,minmax(320px,1fr))]"
    )
    expect(grid.className).not.toContain("auto-fit")
    expect(screen.getByText("Maya Singh")).toBeInTheDocument()
    expect(screen.getAllByText("Product Designer").length).toBeGreaterThan(0)
    expect(screen.getByText("Sam Lee")).toBeInTheDocument()
    expect(screen.queryByText("Deleted User")).not.toBeInTheDocument()
    expect(screen.getByTestId("person-card-user_maya")).toHaveAttribute(
      "href",
      "/workspace/people/user_maya"
    )
  })

  it("renders profile details, visible activity, and direct message action", () => {
    const createWorkspaceChat = vi.fn().mockReturnValue("chat_created")
    useAppStore.setState((state) => ({
      ...state,
      createWorkspaceChat: createWorkspaceChat as never,
    }))

    render(<PeopleProfileScreen userId={maya.id} />)

    expect(
      screen.getByRole("heading", { name: "Maya Singh" })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Product Designer").length).toBeGreaterThan(0)
    expect(screen.getByText("Teams: Platform")).toBeInTheDocument()
    expect(screen.getByText("Created work item")).toBeInTheDocument()
    expect(screen.getByText("Changed work item status")).toBeInTheDocument()
    expect(screen.getByText("Updated work item labels")).toBeInTheDocument()
    expect(screen.getByText("Commented on work item")).toBeInTheDocument()
    expect(screen.getByText("Commented on document")).toBeInTheDocument()
    expect(screen.getByText("Created channel post")).toBeInTheDocument()
    expect(screen.getByText("Commented on channel post")).toBeInTheDocument()
    expect(screen.getByText("Posted project update")).toBeInTheDocument()
    expect(screen.getAllByText("Export CSV").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Shipping notes").length).toBeGreaterThan(0)
    expect(screen.queryByText("Hidden private task")).not.toBeInTheDocument()
    expect(screen.queryByText("secret direct chat")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Message" }))

    expect(createWorkspaceChat).toHaveBeenCalledWith({
      participantIds: [maya.id],
      workspaceId: "workspace_1",
      title: "",
      description: "",
    })
    expect(routerPushMock).toHaveBeenCalledWith("/chats?chatId=chat_created")
  })
})

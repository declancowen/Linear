import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import type { AppSnapshot } from "@/lib/domain/types"

const requireSessionMock = vi.fn()
const getSnapshotServerMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
}))

vi.mock("@/lib/server/convex", () => ({
  getSnapshotServer: getSnapshotServerMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  getConvexErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  logProviderError: logProviderErrorMock,
}))

function createSnapshot(): AppSnapshot {
  return {
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
          accent: "emerald",
          description: "",
        },
      },
    ],
    workspaceMemberships: [
      {
        workspaceId: "workspace_1",
        userId: "user_1",
        role: "admin",
      },
    ],
    teams: [
      {
        id: "team_1",
        workspaceId: "workspace_1",
        slug: "team-1",
        name: "Team 1",
        icon: "sparkles",
        summary: "",
        settings: {
          experience: "software-development",
          workflow: {
            statusOrder: ["backlog", "todo", "in-progress", "done", "cancelled", "duplicate"],
            templateDefaults: {
              "software-delivery": {
                defaultViewLayout: "list",
                defaultViewGrouping: "status",
                defaultViewOrdering: "priority",
                recommendedItemTypes: ["epic", "feature", "story", "task", "bug"],
              },
              "bug-tracking": {
                defaultViewLayout: "list",
                defaultViewGrouping: "status",
                defaultViewOrdering: "priority",
                recommendedItemTypes: ["issue", "bug"],
              },
              "project-management": {
                defaultViewLayout: "list",
                defaultViewGrouping: "status",
                defaultViewOrdering: "priority",
                recommendedItemTypes: ["epic", "feature", "task"],
              },
            },
          },
          features: {
            issues: true,
            projects: true,
            documents: true,
            chat: true,
            calls: true,
          },
          guestProjectIds: [],
          guestWorkItemIds: [],
          guestDocumentIds: [],
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
        handle: "alex",
        email: "alex@example.com",
        name: "Alex",
        avatarUrl: "",
        avatarImageUrl: null,
        title: "",
        hasExplicitStatus: false,
        status: "offline",
        statusMessage: "",
        preferences: {
          emailAssignments: true,
          emailDigest: true,
          emailMentions: true,
          theme: "system",
        },
        accountDeletionPendingAt: null,
        accountDeletedAt: null,
        workosUserId: null,
      },
    ],
    labels: [
      {
        id: "label_1",
        workspaceId: "workspace_1",
        name: "Bug",
        color: "red",
      },
    ],
    invites: [
      {
        id: "invite_1",
        batchId: null,
        workspaceId: "workspace_1",
        teamId: "team_1",
        email: "alex@example.com",
        role: "member",
        token: "token_1",
        joinCode: "JOIN1234",
        invitedBy: "user_1",
        expiresAt: "2026-04-29T00:00:00.000Z",
        acceptedAt: null,
        declinedAt: null,
      },
    ],
    documents: [
      {
        id: "doc_1",
        kind: "team-document",
        workspaceId: "workspace_1",
        teamId: "team_1",
        title: "Spec",
        content: "<p>Hello</p>",
        linkedProjectIds: [],
        linkedWorkItemIds: [],
        createdBy: "user_1",
        updatedBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "doc_2",
        kind: "workspace-document",
        workspaceId: "workspace_1",
        teamId: null,
        title: "Workspace Notes",
        content: "<p>Workspace</p>",
        linkedProjectIds: [],
        linkedWorkItemIds: [],
        createdBy: "user_1",
        updatedBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "doc_3",
        kind: "private-document",
        workspaceId: "workspace_1",
        teamId: null,
        title: "Private Notes",
        content: "<p>Private</p>",
        linkedProjectIds: [],
        linkedWorkItemIds: [],
        createdBy: "user_1",
        updatedBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
    ],
    projects: [
      {
        id: "project_1",
        scopeType: "team",
        scopeId: "team_1",
        name: "Alpha",
        summary: "",
        description: "",
        status: "in-progress",
        health: "on-track",
        priority: "high",
        leadId: "user_1",
        memberIds: [],
        labelIds: [],
        startDate: null,
        targetDate: null,
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
        templateType: "software-delivery",
        presentation: {
          layout: "list",
          grouping: "status",
          ordering: "priority",
          itemLevel: "story",
          showChildItems: false,
          filters: {
            status: [],
            priority: [],
            assigneeIds: [],
            creatorIds: [],
            leadIds: [],
            health: [],
            milestoneIds: [],
            relationTypes: [],
            projectIds: [],
            parentIds: [],
            itemTypes: [],
            labelIds: [],
            teamIds: [],
            showCompleted: true,
          },
          displayProps: [],
        },
        blockingProjectIds: [],
        blockedByProjectIds: [],
      },
    ],
    workItems: [
      {
        id: "item_1",
        key: "TEAM-1",
        teamId: "team_1",
        type: "story",
        title: "Investigate",
        descriptionDocId: "doc_1",
        status: "todo",
        priority: "medium",
        assigneeId: null,
        creatorId: "user_1",
        parentId: null,
        primaryProjectId: "project_1",
        linkedProjectIds: [],
        linkedDocumentIds: [],
        labelIds: [],
        milestoneId: null,
        startDate: null,
        dueDate: null,
        targetDate: null,
        subscriberIds: [],
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
    ],
    notifications: [
      {
        id: "notification_1",
        userId: "user_1",
        type: "mention",
        entityType: "project",
        entityId: "project_1",
        actorId: "user_1",
        message: "Mentioned you",
        readAt: null,
        archivedAt: null,
        emailedAt: null,
        createdAt: "2026-04-22T00:00:00.000Z",
      },
    ],
    conversations: [
      {
        id: "chat_1",
        kind: "chat",
        scopeType: "workspace",
        scopeId: "workspace_1",
        variant: "group",
        title: "General chat",
        description: "",
        participantIds: ["user_1"],
        roomId: null,
        roomName: null,
        createdBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
        lastActivityAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "channel_1",
        kind: "channel",
        scopeType: "workspace",
        scopeId: "workspace_1",
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
    chatMessages: [
      {
        id: "message_1",
        conversationId: "chat_1",
        kind: "message",
        content: "Hello",
        callId: "call_1",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
      },
    ],
    calls: [
      {
        id: "call_1",
        conversationId: "chat_1",
        scopeType: "workspace",
        scopeId: "workspace_1",
        roomId: null,
        roomName: null,
        roomKey: "room_1",
        roomDescription: "General chat call",
        startedBy: "user_1",
        startedAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
        endedAt: null,
        participantUserIds: ["user_1"],
        lastJoinedAt: "2026-04-22T00:00:00.000Z",
        lastJoinedBy: "user_1",
        joinCount: 1,
      },
    ],
    channelPosts: [
      {
        id: "post_1",
        conversationId: "channel_1",
        title: "Launch",
        content: "We shipped it",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
    ],
    channelPostComments: [
      {
        id: "comment_1",
        postId: "post_1",
        content: "Nice",
        mentionUserIds: [],
        createdBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
      },
    ],
    views: [
      {
        id: "view_item_1",
        name: "Assigned Work",
        description: "",
        scopeType: "personal",
        scopeId: "user_1",
        entityKind: "items",
        layout: "list",
        filters: {
          status: [],
          priority: [],
          assigneeIds: [],
          creatorIds: [],
          leadIds: [],
          health: [],
          milestoneIds: [],
          relationTypes: [],
          projectIds: [],
          parentIds: [],
          itemTypes: [],
          labelIds: [],
          teamIds: [],
          showCompleted: true,
        },
        grouping: "status",
        subGrouping: null,
        ordering: "updatedAt",
        displayProps: [],
        hiddenState: {
          groups: [],
          subgroups: [],
        },
        isShared: false,
        route: "/assigned",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "view_project_1",
        name: "Workspace Projects",
        description: "",
        scopeType: "workspace",
        scopeId: "workspace_1",
        entityKind: "projects",
        layout: "list",
        filters: {
          status: [],
          priority: [],
          assigneeIds: [],
          creatorIds: [],
          leadIds: [],
          health: [],
          milestoneIds: [],
          relationTypes: [],
          projectIds: [],
          parentIds: [],
          itemTypes: [],
          labelIds: [],
          teamIds: [],
          showCompleted: true,
        },
        grouping: "status",
        subGrouping: null,
        ordering: "priority",
        displayProps: [],
        hiddenState: {
          groups: [],
          subgroups: [],
        },
        isShared: false,
        route: "/workspace/projects",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "view_doc_1",
        name: "Team Docs",
        description: "",
        scopeType: "team",
        scopeId: "team_1",
        entityKind: "docs",
        layout: "list",
        filters: {
          status: [],
          priority: [],
          assigneeIds: [],
          creatorIds: [],
          leadIds: [],
          health: [],
          milestoneIds: [],
          relationTypes: [],
          projectIds: [],
          parentIds: [],
          itemTypes: [],
          labelIds: [],
          teamIds: [],
          showCompleted: true,
        },
        grouping: "status",
        subGrouping: null,
        ordering: "updatedAt",
        displayProps: [],
        hiddenState: {
          groups: [],
          subgroups: [],
        },
        isShared: false,
        route: "/team/team-1/docs",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "view_doc_2",
        name: "Workspace Docs",
        description: "",
        scopeType: "workspace",
        scopeId: "workspace_1",
        entityKind: "docs",
        layout: "list",
        filters: {
          status: [],
          priority: [],
          assigneeIds: [],
          creatorIds: [],
          leadIds: [],
          health: [],
          milestoneIds: [],
          relationTypes: [],
          projectIds: [],
          parentIds: [],
          itemTypes: [],
          labelIds: [],
          teamIds: [],
          showCompleted: true,
        },
        grouping: "status",
        subGrouping: null,
        ordering: "updatedAt",
        displayProps: [],
        hiddenState: {
          groups: [],
          subgroups: [],
        },
        isShared: false,
        route: "/workspace/docs",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
    ],
  } as unknown as AppSnapshot
}

describe("read model route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    getSnapshotServerMock.mockReset()
    logProviderErrorMock.mockReset()

    requireSessionMock.mockResolvedValue({
      user: {
        id: "workos_1",
        email: "alex@example.com",
      },
      organizationId: "org_1",
    })
  })

  it("returns a document detail read model", async () => {
    const { GET } = await import(
      "@/app/api/read-models/documents/[documentId]/route"
    )

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({
        documentId: "doc_1",
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        documents: [{ id: "doc_1" }],
      },
    })
  })

  it("returns a workspace membership read model", async () => {
    const { GET } = await import(
      "@/app/api/read-models/workspaces/[workspaceId]/membership/route"
    )

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({
        workspaceId: "workspace_1",
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        currentWorkspaceId: "workspace_1",
        workspaces: [{ id: "workspace_1" }],
        teams: [{ id: "team_1" }],
        workspaceMemberships: [{ workspaceId: "workspace_1" }],
        teamMemberships: [{ teamId: "team_1" }],
        labels: [{ id: "label_1" }],
        invites: [{ id: "invite_1" }],
      },
    })
  })

  it("returns a project index read model", async () => {
    const { GET } = await import("@/app/api/read-models/projects/index/route")

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET(
      new Request(
        "http://localhost/api/read-models/projects/index?scopeType=workspace&scopeId=workspace_1"
      ) as never
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        projects: [{ id: "project_1" }],
        workItems: [{ id: "item_1" }],
        views: [{ id: "view_project_1" }],
      },
    })
  })

  it("returns a document index read model", async () => {
    const { GET } = await import("@/app/api/read-models/documents/index/route")

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET(
      new Request(
        "http://localhost/api/read-models/documents/index?scopeType=workspace&scopeId=workspace_1"
      ) as never
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        documents: [{ id: "doc_2" }, { id: "doc_3" }],
        views: [{ id: "view_doc_2" }],
      },
    })
  })

  it("returns a work item detail read model", async () => {
    const { GET } = await import(
      "@/app/api/read-models/items/[itemId]/route"
    )

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({
        itemId: "item_1",
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        workItems: [{ id: "item_1" }],
      },
    })
  })

  it("returns a project detail read model", async () => {
    const { GET } = await import(
      "@/app/api/read-models/projects/[projectId]/route"
    )

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({
        projectId: "project_1",
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        projects: [{ id: "project_1" }],
      },
    })
  })

  it("returns a work index read model", async () => {
    const { GET } = await import("@/app/api/read-models/work/index/route")

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET(
      new Request(
        "http://localhost/api/read-models/work/index?scopeType=personal&scopeId=user_1"
      ) as never
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        workItems: [{ id: "item_1" }],
        labels: [{ id: "label_1" }],
        views: [{ id: "view_item_1" }],
      },
    })
  })

  it("returns a view catalog read model", async () => {
    const { GET } = await import("@/app/api/read-models/views/catalog/route")

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET(
      new Request(
        "http://localhost/api/read-models/views/catalog?scopeType=workspace&scopeId=workspace_1"
      ) as never
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        views: [
          { id: "view_project_1" },
          { id: "view_doc_1" },
          { id: "view_doc_2" },
        ],
      },
    })
  })

  it("returns a notification inbox read model", async () => {
    const { GET } = await import(
      "@/app/api/read-models/notifications/inbox/route"
    )

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        notifications: [{ id: "notification_1" }],
        projects: [{ id: "project_1" }],
      },
    })
  })

  it("returns a conversation list read model", async () => {
    const { GET } = await import(
      "@/app/api/read-models/conversations/list/route"
    )

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        conversations: [{ id: "chat_1" }, { id: "channel_1" }],
        chatMessages: [{ id: "message_1" }],
      },
    })
  })

  it("returns a conversation thread read model", async () => {
    const { GET } = await import(
      "@/app/api/read-models/conversations/[conversationId]/route"
    )

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({
        conversationId: "chat_1",
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        conversations: [{ id: "chat_1" }],
        chatMessages: [{ id: "message_1" }],
        calls: [{ id: "call_1" }],
      },
    })
  })

  it("returns a channel feed read model", async () => {
    const { GET } = await import(
      "@/app/api/read-models/channels/[channelId]/feed/route"
    )

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({
        channelId: "channel_1",
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        conversations: [{ id: "channel_1" }],
        channelPosts: [{ id: "post_1" }],
        channelPostComments: [{ id: "comment_1" }],
      },
    })
  })

  it("returns a search seed read model", async () => {
    const { GET } = await import(
      "@/app/api/read-models/workspaces/[workspaceId]/search-seed/route"
    )

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({
        workspaceId: "workspace_1",
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        projects: [{ id: "project_1" }],
        documents: [{ id: "doc_2" }, { id: "doc_3" }],
        workItems: [{ id: "item_1" }],
      },
    })
  })

  it("returns 404 when a requested read model target is missing", async () => {
    const { GET } = await import(
      "@/app/api/read-models/documents/[documentId]/route"
    )

    getSnapshotServerMock.mockResolvedValue(createSnapshot())

    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({
        documentId: "doc_missing",
      }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Document not found",
      message: "Document not found",
      code: "DOCUMENT_READ_MODEL_NOT_FOUND",
    })
  })
})

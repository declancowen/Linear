import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  addSnapshotCallUserIds,
  addSnapshotViewUserIds,
  bootstrapAppWorkspaceHandler,
  bootstrapWorkspaceUserHandler,
  getBootstrapCallActivityFields,
  getAuthContextHandler,
  getInviteByTokenHandler,
  getSnapshotHandler,
  getWorkspaceMembershipBootstrapHandler,
  normalizeBootstrapChatMessage,
  resolveBootstrapTeamExperience,
  resolveBootstrapWorkspaceUser,
  upsertBootstrapTeam,
  upsertBootstrapWorkspace,
} from "@/convex/app/auth_bootstrap"
import { createMutableConvexTestCtx } from "@/tests/lib/convex/test-db"

function createBootstrapCtx() {
  const ctx = createMutableConvexTestCtx({
    users: [
      {
        _id: "user_doc_1",
        id: "user_1",
        email: "alex@example.com",
        emailNormalized: "alex@example.com",
        name: "Alex",
        avatarUrl: "AM",
        workosUserId: "workos_1",
        preferences: {},
      },
      {
        _id: "user_doc_2",
        id: "owner_1",
        email: "owner@example.com",
        emailNormalized: "owner@example.com",
        name: "Owner",
        avatarUrl: "OW",
        workosUserId: "workos_owner",
        preferences: {},
      },
    ],
    userAppStates: [
      {
        _id: "app_state_doc_1",
        userId: "user_1",
        currentWorkspaceId: "workspace_2",
      },
    ],
    workspaces: [
      {
        _id: "workspace_doc_1",
        id: "workspace_1",
        slug: "alpha",
        name: "Alpha",
        logoUrl: "",
        logoImageStorageId: null,
        createdBy: "owner_1",
        workosOrganizationId: "org_1",
        settings: {
          accent: "emerald",
          description: "Alpha",
        },
      },
      {
        _id: "workspace_doc_2",
        id: "workspace_2",
        slug: "beta",
        name: "Beta",
        logoUrl: "",
        logoImageStorageId: "logo_storage_2",
        createdBy: "owner_1",
        workosOrganizationId: null,
        settings: {
          accent: "blue",
          description: "Beta",
        },
      },
    ],
    workspaceMemberships: [
      {
        _id: "workspace_membership_doc_1",
        workspaceId: "workspace_1",
        userId: "user_1",
        role: "viewer",
      },
    ],
    teams: [
      {
        _id: "team_doc_1",
        id: "team_1",
        workspaceId: "workspace_1",
        slug: "platform",
        name: "Platform",
        icon: "robot",
        settings: {
          joinCode: "JOIN1234",
          summary: "Platform",
          guestProjectIds: [],
          guestDocumentIds: [],
          guestWorkItemIds: [],
          experience: "software-development",
          features: {
            issues: true,
            projects: true,
            views: true,
            docs: true,
            cycles: false,
            calls: true,
            channels: true,
          },
        },
      },
      {
        _id: "team_doc_2",
        id: "team_2",
        workspaceId: "workspace_2",
        slug: "design",
        name: "Design",
        icon: "users",
        settings: {
          joinCode: "JOIN5678",
          summary: "Design",
          guestProjectIds: [],
          guestDocumentIds: [],
          guestWorkItemIds: [],
          experience: "project-management",
          features: {
            issues: true,
            projects: true,
            views: true,
            docs: true,
            cycles: false,
            calls: true,
            channels: true,
          },
        },
      },
    ],
    teamMemberships: [
      {
        _id: "team_membership_doc_1",
        teamId: "team_1",
        userId: "user_1",
        role: "member",
      },
      {
        _id: "team_membership_doc_2",
        teamId: "team_2",
        userId: "user_1",
        role: "admin",
      },
    ],
    labels: [
      {
        _id: "label_doc_1",
        id: "label_1",
        workspaceId: "workspace_2",
        name: "Bug",
        color: "red",
      },
    ],
    invites: [
      {
        _id: "invite_doc_1",
        id: "invite_1",
        batchId: "batch_1",
        workspaceId: "workspace_2",
        teamId: "team_2",
        email: "alex@example.com",
        emailNormalized: "alex@example.com",
        role: "member",
        token: "token_1",
        joinCode: "JOIN5678",
        invitedBy: "owner_1",
        expiresAt: "2026-06-01T00:00:00.000Z",
        acceptedAt: null,
        declinedAt: null,
      },
    ],
    projects: [],
    milestones: [],
    workItems: [],
    documents: [],
    views: [],
    comments: [],
    attachments: [],
    notifications: [],
    projectUpdates: [],
    conversations: [],
    calls: [],
    chatMessages: [],
    channelPosts: [],
    channelPostComments: [],
  })

  return {
    ...ctx,
    storage: {
      getUrl: vi.fn(async (storageId: string) => `https://assets/${storageId}`),
    },
  }
}

describe("auth bootstrap handlers", () => {
  beforeEach(() => {
    process.env.CONVEX_SERVER_TOKEN = "server_token"
  })

  it("builds auth context from selected workspace access", async () => {
    const ctx = createBootstrapCtx()

    await expect(
      getAuthContextHandler(ctx as never, {
        serverToken: "server_token",
        workosUserId: "workos_1",
        email: "alex@example.com",
      })
    ).resolves.toMatchObject({
      currentUser: {
        id: "user_1",
        avatarImageUrl: null,
      },
      currentWorkspace: {
        id: "workspace_2",
        name: "Beta",
      },
      memberships: [
        {
          teamId: "team_1",
          role: "member",
        },
        {
          teamId: "team_2",
          role: "admin",
        },
      ],
      onboardingState: "ready",
      isWorkspaceOwner: false,
      isWorkspaceAdmin: true,
    })
  })

  it("builds workspace membership bootstrap inventories", async () => {
    const ctx = createBootstrapCtx()

    await expect(
      getWorkspaceMembershipBootstrapHandler(ctx as never, {
        serverToken: "server_token",
        workosUserId: "workos_1",
        email: "alex@example.com",
        workspaceId: "workspace_2",
      })
    ).resolves.toMatchObject({
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_2",
      workspaces: [
        expect.objectContaining({
          id: "workspace_1",
        }),
        expect.objectContaining({
          id: "workspace_2",
          logoImageUrl: "https://assets/logo_storage_2",
        }),
      ],
      teams: [
        expect.objectContaining({
          id: "team_2",
          workspaceId: "workspace_2",
        }),
      ],
      teamMemberships: [
        expect.objectContaining({
          teamId: "team_2",
          userId: "user_1",
        }),
      ],
      labels: [
        expect.objectContaining({
          id: "label_1",
        }),
      ],
      invites: [
        expect.objectContaining({
          id: "invite_1",
        }),
      ],
    })
  })

  it("upserts bootstrap workspaces and teams without changing ownership", async () => {
    const ctx = createBootstrapCtx()
    const args = {
      serverToken: "server_token",
      workspaceSlug: "beta",
      workspaceName: "Beta Updated",
      workspaceLogoUrl: "https://example.com/logo.png",
      workspaceAccent: "violet",
      workspaceDescription: "Updated workspace",
      teamSlug: "design",
      teamName: "Design Updated",
      teamIcon: "kanban",
      teamSummary: "Updated team",
      teamJoinCode: "join-5678",
      email: "alex@example.com",
      userName: "Alex",
      avatarUrl: "https://example.com/avatar.png",
      workosUserId: "workos_1",
      teamExperience: "project-management" as const,
    }

    await expect(
      upsertBootstrapWorkspace(ctx as never, args, "beta")
    ).resolves.toEqual({
      workspaceId: "workspace_2",
      workosOrganizationId: null,
    })
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "workspace_doc_2",
      expect.objectContaining({
        name: "Beta Updated",
        settings: expect.objectContaining({
          accent: "violet",
          description: "Updated workspace",
        }),
      })
    )

    await expect(
      upsertBootstrapWorkspace(ctx as never, args, "new-workspace")
    ).resolves.toEqual({
      workspaceId: "workspace_new_workspace",
      workosOrganizationId: null,
    })
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "workspaces",
      expect.objectContaining({
        id: "workspace_new_workspace",
        slug: "new-workspace",
      })
    )

    expect(resolveBootstrapTeamExperience(args, ctx.tables.teams[1] as never)).toBe(
      "project-management"
    )
    expect(
      resolveBootstrapTeamExperience(
        { ...args, teamExperience: undefined },
        ctx.tables.teams[1] as never
      )
    ).toBe("project-management")
    expect(
      resolveBootstrapTeamExperience(
        { ...args, teamExperience: undefined },
        null
      )
    ).toBe("software-development")

    await expect(
      upsertBootstrapTeam(ctx as never, {
        args,
        joinCode: "JOIN5678",
        teamSlug: "design",
        workspaceId: "workspace_2",
      })
    ).resolves.toBe("team_2")
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "team_doc_2",
      expect.objectContaining({
        joinCodeNormalized: "JOIN5678",
        name: "Design Updated",
      })
    )

    await expect(
      upsertBootstrapTeam(ctx as never, {
        args,
        joinCode: "JOIN9999",
        teamSlug: "research",
        workspaceId: "workspace_2",
      })
    ).resolves.toBe("team_research")
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "teams",
      expect.objectContaining({
        id: "team_research",
        workspaceId: "workspace_2",
        joinCodeNormalized: "JOIN9999",
      })
    )
  })

  it("normalizes snapshot branch defaults and visible user ids", () => {
    const visibleUserIds = new Set<string>()
    const input = {
      visibleUserIds,
      visibleViews: [
        {
          scopeType: "personal",
          scopeId: "personal_user",
          filters: {
            assigneeIds: ["assignee_1"],
            creatorIds: ["creator_1"],
            leadIds: ["lead_1"],
          },
        },
        {
          scopeType: "team",
          scopeId: "team_1",
          filters: {
            assigneeIds: [],
            creatorIds: ["creator_2"],
            leadIds: [],
          },
        },
      ],
      visibleCalls: [
        {
          startedBy: "starter_1",
          lastJoinedBy: "joiner_1",
          participantUserIds: ["participant_1", "participant_2"],
        },
        {
          startedBy: "starter_2",
          lastJoinedBy: null,
          participantUserIds: null,
        },
      ],
    } as never

    addSnapshotViewUserIds(input)
    addSnapshotCallUserIds(input)

    expect([...visibleUserIds].sort()).toEqual([
      "assignee_1",
      "creator_1",
      "creator_2",
      "joiner_1",
      "lead_1",
      "participant_1",
      "participant_2",
      "personal_user",
      "starter_1",
      "starter_2",
    ])
    expect(getBootstrapCallActivityFields({} as never)).toEqual({
      endedAt: null,
      joinCount: 0,
      lastJoinedAt: null,
      lastJoinedBy: null,
    })
    expect(
      getBootstrapCallActivityFields({
        endedAt: "2026-05-01T00:00:00.000Z",
        joinCount: 2,
        lastJoinedAt: "2026-05-01T00:01:00.000Z",
        lastJoinedBy: "user_1",
      } as never)
    ).toEqual({
      endedAt: "2026-05-01T00:00:00.000Z",
      joinCount: 2,
      lastJoinedAt: "2026-05-01T00:01:00.000Z",
      lastJoinedBy: "user_1",
    })
    expect(
      normalizeBootstrapChatMessage({
        id: "message_1",
        kind: null,
        callId: undefined,
        mentionUserIds: undefined,
        reactions: undefined,
      } as never)
    ).toMatchObject({
      kind: "text",
      callId: null,
      mentionUserIds: [],
      reactions: [],
    })
  })

  it("builds a full snapshot for accessible workspace data", async () => {
    const ctx = createBootstrapCtx()
    ctx.tables.projects.push({
      _id: "project_doc_1",
      id: "project_1",
      scopeType: "workspace",
      scopeId: "workspace_2",
      templateType: "project-management",
      name: "Roadmap",
      summary: "",
      description: "",
      leadId: "user_1",
      memberIds: ["owner_1"],
      health: "on-track",
      priority: "medium",
      status: "planned",
      startDate: null,
      targetDate: null,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    } as never)
    ctx.tables.views.push({
      _id: "view_doc_1",
      id: "view_1",
      name: "Mine",
      description: "",
      scopeType: "personal",
      scopeId: "user_1",
      entityKind: "items",
      layout: "list",
      filters: {
        status: [],
        priority: [],
        assigneeIds: ["user_1"],
        creatorIds: ["owner_1"],
        leadIds: [],
        health: [],
        milestoneIds: [],
        relationTypes: [],
        projectIds: [],
        parentIds: [],
        itemTypes: [],
        labelIds: [],
        teamIds: [],
        showCompleted: false,
      },
      grouping: null,
      subGrouping: null,
      ordering: "updatedAt",
      displayProps: [],
      hiddenState: { groups: [], subgroups: [] },
      isShared: false,
      route: "/assigned",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    } as never)
    ctx.tables.conversations.push({
      _id: "conversation_doc_1",
      id: "conversation_1",
      kind: "channel",
      scopeType: "workspace",
      scopeId: "workspace_2",
      variant: "team",
      title: "General",
      description: "",
      participantIds: ["user_1", "owner_1"],
      roomId: undefined,
      roomName: undefined,
      createdBy: "owner_1",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
      lastActivityAt: "2026-05-01T00:00:00.000Z",
    } as never)
    ctx.tables.calls.push({
      _id: "call_doc_1",
      id: "call_1",
      conversationId: "conversation_1",
      roomId: undefined,
      roomName: undefined,
      startedBy: "user_1",
      startedAt: "2026-05-01T00:00:00.000Z",
      endedAt: undefined,
      lastJoinedAt: undefined,
      lastJoinedBy: "owner_1",
      joinCount: undefined,
      participantUserIds: ["user_1", "owner_1"],
    } as never)
    ctx.tables.chatMessages.push({
      _id: "chat_message_doc_1",
      id: "chat_message_1",
      conversationId: "conversation_1",
      createdBy: "owner_1",
      content: "Hello",
      kind: undefined,
      callId: undefined,
      mentionUserIds: undefined,
      reactions: undefined,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    } as never)

    await expect(
      getSnapshotHandler(ctx as never, {
        serverToken: "server_token",
        workosUserId: "workos_1",
        email: "alex@example.com",
      })
    ).resolves.toMatchObject({
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_2",
      projects: [expect.objectContaining({ id: "project_1" })],
      views: [expect.objectContaining({ id: "view_1" })],
      conversations: [
        expect.objectContaining({
          id: "conversation_1",
          roomId: null,
          roomName: null,
        }),
      ],
      calls: [
        expect.objectContaining({
          id: "call_1",
          joinCount: 0,
          roomId: null,
          roomName: null,
        }),
      ],
      chatMessages: [
        expect.objectContaining({
          id: "chat_message_1",
          kind: "text",
          callId: null,
          mentionUserIds: [],
          reactions: [],
        }),
      ],
    })
  })

  it("resolves and bootstraps workspace users by preferred identity", async () => {
    const ctx = createBootstrapCtx()
    const args = {
      serverToken: "server_token",
      workspaceSlug: "beta",
      teamSlug: "design",
      existingUserId: "owner_1",
      email: "owner@example.com",
      name: "Owner Updated",
      avatarUrl: "https://example.com/owner.png",
      workosUserId: "workos_owner",
      role: "member" as const,
    }

    await expect(
      resolveBootstrapWorkspaceUser(ctx as never, {
        args,
        normalizedEmail: "owner@example.com",
      })
    ).resolves.toMatchObject({
      id: "owner_1",
    })

    await expect(
      bootstrapWorkspaceUserHandler(ctx as never, args)
    ).resolves.toMatchObject({
      userId: "owner_1",
      teamId: "team_2",
      workspaceId: "workspace_2",
      role: "member",
    })
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "user_doc_2",
      expect.objectContaining({
        email: "owner@example.com",
        name: "Owner Updated",
        workosUserId: "workos_owner",
      })
    )

    await expect(
      bootstrapWorkspaceUserHandler(ctx as never, {
        ...args,
        existingUserId: undefined,
        email: "new@example.com",
        name: "New User",
        workosUserId: "workos_new",
      })
    ).resolves.toMatchObject({
      teamId: "team_2",
      workspaceId: "workspace_2",
      role: "member",
    })
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "users",
      expect.objectContaining({
        email: "new@example.com",
        name: "New User",
        workosUserId: "workos_new",
      })
    )

    await expect(
      resolveBootstrapWorkspaceUser(ctx as never, {
        args: {
          ...args,
          existingUserId: "owner_1",
          email: "alex@example.com",
          workosUserId: "workos_1",
        },
        normalizedEmail: "alex@example.com",
      })
    ).rejects.toThrow("A different Convex user already matches this WorkOS identity")
  })

  it("bootstraps the app workspace through the public mutation owner", async () => {
    const ctx = createBootstrapCtx()

    await expect(
      bootstrapAppWorkspaceHandler(ctx as never, {
        serverToken: "server_token",
        workspaceSlug: "beta",
        workspaceName: "Beta",
        workspaceLogoUrl: "",
        workspaceAccent: "blue",
        workspaceDescription: "Beta",
        teamSlug: "design",
        teamName: "Design",
        teamIcon: "users",
        teamSummary: "Design",
        teamJoinCode: "join-5678",
        email: "alex@example.com",
        userName: "Alex",
        avatarUrl: "https://example.com/alex.png",
        workosUserId: "workos_1",
        teamExperience: "project-management",
      })
    ).resolves.toMatchObject({
      workspaceId: "workspace_2",
      workspaceSlug: "beta",
      teamId: "team_2",
      teamSlug: "design",
      userId: "user_1",
      role: "admin",
      workosOrganizationId: null,
    })
  })

  it("returns invite token payloads only for active scoped invites", async () => {
    const ctx = createBootstrapCtx()

    await expect(
      getInviteByTokenHandler(ctx as never, {
        serverToken: "server_token",
        token: "token_1",
      })
    ).resolves.toMatchObject({
      teamNames: ["Design"],
      workspace: {
        id: "workspace_2",
        name: "Beta",
      },
    })

    Object.assign(ctx.tables.invites[0], {
      acceptedAt: "2026-05-01T00:00:00.000Z",
    })

    await expect(
      getInviteByTokenHandler(ctx as never, {
        serverToken: "server_token",
        token: "token_1",
      })
    ).resolves.toMatchObject({
      invite: {
        id: "invite_1",
        acceptedAt: "2026-05-01T00:00:00.000Z",
      },
      teamNames: ["Design"],
    })

    ctx.tables.teams.length = 0
    ctx.tables.invites[0].acceptedAt = null

    await expect(
      getInviteByTokenHandler(ctx as never, {
        serverToken: "server_token",
        token: "token_1",
      })
    ).resolves.toBeNull()
  })
})

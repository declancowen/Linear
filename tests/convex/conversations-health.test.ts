import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  ensureWorkspaceChannelConversation,
  getWorkspaceUserIds,
  requireConversationAccess,
} from "@/convex/app/conversations"
import { createMutableConvexTestCtx } from "@/tests/lib/convex/test-db"

const accessMocks = vi.hoisted(() => ({
  requireEditableTeamAccess: vi.fn(),
  requireEditableWorkspaceAccess: vi.fn(),
  requireReadableTeamAccess: vi.fn(),
  requireReadableWorkspaceAccess: vi.fn(),
}))

vi.mock("@/convex/app/access", () => accessMocks)

function createConversation(overrides: Record<string, unknown> = {}) {
  return {
    _id: "conversation_doc_1",
    id: "conversation_1",
    kind: "channel",
    scopeType: "workspace",
    scopeId: "workspace_1",
    variant: "team",
    title: "General",
    description: "Workspace channel",
    participantIds: ["user_1"],
    roomId: null,
    roomName: null,
    createdBy: "owner_1",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    lastActivityAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  }
}

function createWorkspaceConversationCtx() {
  return createMutableConvexTestCtx({
    workspaces: [
      {
        _id: "workspace_doc_1",
        id: "workspace_1",
        slug: "acme",
        name: "Acme",
        logoUrl: "",
        logoImageStorageId: null,
        createdBy: "owner_1",
        workosOrganizationId: null,
        settings: {
          description: "Shared workspace",
        },
      },
    ],
    workspaceMemberships: [
      {
        _id: "workspace_membership_doc_1",
        workspaceId: "workspace_1",
        userId: "direct_1",
        role: "member",
      },
      {
        _id: "workspace_membership_doc_2",
        workspaceId: "workspace_1",
        userId: "owner_1",
        role: "admin",
      },
    ],
    teams: [
      {
        _id: "team_doc_1",
        id: "team_1",
        workspaceId: "workspace_1",
        slug: "product",
        name: "Product",
        icon: "box",
        settings: {
          summary: "Product team",
        },
      },
      {
        _id: "team_doc_2",
        id: "team_2",
        workspaceId: "other_workspace",
        slug: "outside",
        name: "Outside",
        icon: "box",
        settings: {
          summary: "Other team",
        },
      },
    ],
    teamMemberships: [
      {
        _id: "team_membership_doc_1",
        teamId: "team_1",
        userId: "team_user_1",
        role: "member",
      },
      {
        _id: "team_membership_doc_2",
        teamId: "team_1",
        userId: "direct_1",
        role: "member",
      },
      {
        _id: "team_membership_doc_3",
        teamId: "team_2",
        userId: "outside_1",
        role: "member",
      },
    ],
    conversations: [createConversation({ participantIds: ["stale_user"] })],
  })
}

describe("conversation health helpers", () => {
  beforeEach(() => {
    for (const mock of Object.values(accessMocks)) {
      mock.mockReset()
      mock.mockResolvedValue(undefined)
    }
  })

  it("authorizes workspace and team conversations with mode-specific access checks", async () => {
    const ctx = {} as never
    const workspaceConversation = createConversation()
    const teamConversation = createConversation({
      scopeType: "team",
      scopeId: "team_1",
    })

    await expect(
      requireConversationAccess(ctx, workspaceConversation as never, "user_1")
    ).resolves.toBe(workspaceConversation)
    expect(accessMocks.requireReadableWorkspaceAccess).toHaveBeenCalledWith(
      ctx,
      "workspace_1",
      "user_1"
    )

    await expect(
      requireConversationAccess(
        ctx,
        workspaceConversation as never,
        "user_1",
        "write"
      )
    ).resolves.toBe(workspaceConversation)
    expect(accessMocks.requireEditableWorkspaceAccess).toHaveBeenCalledWith(
      ctx,
      "workspace_1",
      "user_1"
    )

    await expect(
      requireConversationAccess(ctx, teamConversation as never, "user_2")
    ).resolves.toBe(teamConversation)
    expect(accessMocks.requireReadableTeamAccess).toHaveBeenCalledWith(
      ctx,
      "team_1",
      "user_2"
    )

    await expect(
      requireConversationAccess(ctx, teamConversation as never, "user_2", "write")
    ).resolves.toBe(teamConversation)
    expect(accessMocks.requireEditableTeamAccess).toHaveBeenCalledWith(
      ctx,
      "team_1",
      "user_2"
    )
  })

  it("rejects missing conversations and direct workspace chats without membership", async () => {
    await expect(
      requireConversationAccess({} as never, null, "user_1")
    ).rejects.toThrow("Conversation not found")

    await expect(
      requireConversationAccess(
        {} as never,
        createConversation({
          kind: "chat",
          participantIds: ["user_1"],
        }) as never,
        "user_2"
      )
    ).rejects.toThrow("You do not have access to this conversation")
  })

  it("collects workspace owners, direct members, and team members uniquely", async () => {
    const ctx = createWorkspaceConversationCtx()

    await expect(
      getWorkspaceUserIds(ctx as never, "workspace_1")
    ).resolves.toEqual(expect.arrayContaining(["owner_1", "direct_1", "team_user_1"]))
    await expect(
      getWorkspaceUserIds(ctx as never, "workspace_1")
    ).resolves.toHaveLength(3)
  })

  it("resyncs an existing workspace channel participant list", async () => {
    const ctx = createWorkspaceConversationCtx()

    await expect(
      ensureWorkspaceChannelConversation(ctx as never, {
        currentUserId: "owner_1",
        workspaceId: "workspace_1",
        workspaceName: " Acme ",
        workspaceDescription: " Shared workspace ",
      })
    ).resolves.toBe("conversation_1")

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "conversation_doc_1",
      expect.objectContaining({
        participantIds: ["direct_1", "owner_1", "team_user_1"],
      })
    )
  })

  it("creates the primary workspace channel when none exists", async () => {
    const ctx = createWorkspaceConversationCtx()
    ctx.tables.conversations.length = 0

    await expect(
      ensureWorkspaceChannelConversation(ctx as never, {
        currentUserId: "owner_1",
        workspaceId: "workspace_1",
        workspaceName: " Acme ",
        workspaceDescription: "",
      })
    ).resolves.toEqual(expect.stringMatching(/^conversation_/))

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "conversations",
      expect.objectContaining({
        createdBy: "owner_1",
        description:
          "Shared updates and threaded decisions for the whole workspace.",
        kind: "channel",
        participantIds: ["direct_1", "owner_1", "team_user_1"],
        scopeId: "workspace_1",
        scopeType: "workspace",
        title: "Acme",
      })
    )
  })
})

import { describe, expect, it, vi } from "vitest"

import {
  backfillInviteEmails,
  backfillTeamJoinCodes,
  backfillUserEmails,
  buildWorkspaceMembershipBackfillPlan,
  getBackfillLabelWorkspacePatch,
} from "@/convex/app/maintenance"

describe("workspace membership backfill", () => {
  it("derives missing workspace memberships from owners and team memberships", () => {
    const plan = buildWorkspaceMembershipBackfillPlan({
      workspaces: [
        {
          id: "workspace_1",
          createdBy: "user_1",
        },
      ],
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
        },
      ],
      teamMemberships: [
        {
          teamId: "team_1",
          userId: "user_2",
          role: "viewer",
        },
      ],
      workspaceMemberships: [],
    })

    expect(plan.expectedMemberships).toEqual([
      {
        workspaceId: "workspace_1",
        userId: "user_1",
        role: "admin",
      },
      {
        workspaceId: "workspace_1",
        userId: "user_2",
        role: "viewer",
      },
    ])
    expect(plan.missingMemberships).toEqual(plan.expectedMemberships)
    expect(plan.staleRoleMemberships).toEqual([])
    expect(plan.status.memberships.remaining).toBe(2)
  })

  it("uses the highest team role per workspace and updates stale workspace roles", () => {
    const plan = buildWorkspaceMembershipBackfillPlan({
      workspaces: [
        {
          id: "workspace_1",
          createdBy: "user_1",
        },
      ],
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
        },
        {
          id: "team_2",
          workspaceId: "workspace_1",
        },
      ],
      teamMemberships: [
        {
          teamId: "team_1",
          userId: "user_2",
          role: "viewer",
        },
        {
          teamId: "team_2",
          userId: "user_2",
          role: "member",
        },
      ],
      workspaceMemberships: [
        {
          workspaceId: "workspace_1",
          userId: "user_1",
          role: "admin",
        },
        {
          workspaceId: "workspace_1",
          userId: "user_2",
          role: "viewer",
        },
      ],
    })

    expect(plan.expectedMemberships).toEqual([
      {
        workspaceId: "workspace_1",
        userId: "user_1",
        role: "admin",
      },
      {
        workspaceId: "workspace_1",
        userId: "user_2",
        role: "member",
      },
    ])
    expect(plan.missingMemberships).toEqual([])
    expect(plan.staleRoleMemberships).toEqual([
      {
        workspaceId: "workspace_1",
        userId: "user_2",
        role: "member",
      },
    ])
    expect(plan.status.memberships.staleRole).toBe(1)
  })

  it("preserves full workspace and user ids in the expected membership plan", () => {
    const plan = buildWorkspaceMembershipBackfillPlan({
      workspaces: [
        {
          id: "workspace:1",
          createdBy: "user:1",
        },
      ],
      teams: [
        {
          id: "team:1",
          workspaceId: "workspace:1",
        },
      ],
      teamMemberships: [
        {
          teamId: "team:1",
          userId: "user:2",
          role: "member",
        },
      ],
      workspaceMemberships: [],
    })

    expect(plan.expectedMemberships).toEqual([
      {
        workspaceId: "workspace:1",
        userId: "user:1",
        role: "admin",
      },
      {
        workspaceId: "workspace:1",
        userId: "user:2",
        role: "member",
      },
    ])
  })
})

describe("legacy lookup backfill helpers", () => {
  function createPatchCtx() {
    return {
      db: {
        patch: vi.fn(),
      },
    }
  }

  it("patches denormalized team join codes until capacity is exhausted", async () => {
    const ctx = createPatchCtx()
    const result = await backfillTeamJoinCodes(
      ctx as never,
      [
        {
          _id: "team_doc_1",
          settings: {
            joinCode: " Alpha ",
          },
          joinCodeNormalized: "ALPHA",
        },
        {
          _id: "team_doc_2",
          settings: {
            joinCode: " Beta ",
          },
          joinCodeNormalized: null,
        },
        {
          _id: "team_doc_3",
          settings: {
            joinCode: " Gamma ",
          },
          joinCodeNormalized: null,
        },
      ] as never,
      1
    )

    expect(result).toEqual({
      patched: 1,
      remainingCapacity: 0,
    })
    expect(ctx.db.patch).toHaveBeenCalledTimes(1)
    expect(ctx.db.patch).toHaveBeenCalledWith("team_doc_2", {
      joinCodeNormalized: "BETA",
    })
  })

  it("patches user and invite normalized emails while preserving capacity", async () => {
    const userCtx = createPatchCtx()
    const inviteCtx = createPatchCtx()

    await expect(
      backfillUserEmails(
        userCtx as never,
        [
          {
            _id: "user_doc_1",
            email: "ALEX@EXAMPLE.COM ",
            emailNormalized: null,
          },
          {
            _id: "user_doc_2",
            email: "sam@example.com",
            emailNormalized: "sam@example.com",
          },
        ] as never,
        3
      )
    ).resolves.toEqual({
      patched: 1,
      remainingCapacity: 2,
    })
    await expect(
      backfillInviteEmails(
        inviteCtx as never,
        [
          {
            _id: "invite_doc_1",
            email: "Invite@Example.com ",
            normalizedEmail: null,
          },
          {
            _id: "invite_doc_2",
            email: "ready@example.com",
            normalizedEmail: "ready@example.com",
          },
        ] as never,
        1
      )
    ).resolves.toEqual({
      patched: 1,
      remainingCapacity: 0,
    })
    expect(userCtx.db.patch).toHaveBeenCalledWith("user_doc_1", {
      emailNormalized: "alex@example.com",
    })
    expect(inviteCtx.db.patch).toHaveBeenCalledWith("invite_doc_1", {
      normalizedEmail: "invite@example.com",
    })
  })

  it("builds label workspace patches only when ownership can be inferred", () => {
    const inferredLabelWorkspaceIds = new Map<string, Set<string>>([
      ["label_1", new Set(["workspace_1"])],
      ["label_2", new Set(["workspace_2", "workspace_3"])],
    ])

    expect(
      getBackfillLabelWorkspacePatch({
        inferredLabelWorkspaceIds,
        label: {
          id: "label_1",
          workspaceId: null,
        } as never,
        onlyWorkspaceId: null,
      })
    ).toEqual({
      workspaceId: "workspace_1",
    })
    expect(
      getBackfillLabelWorkspacePatch({
        inferredLabelWorkspaceIds,
        label: {
          id: "label_2",
          workspaceId: null,
        } as never,
        onlyWorkspaceId: null,
      })
    ).toBeNull()
    expect(
      getBackfillLabelWorkspacePatch({
        inferredLabelWorkspaceIds,
        label: {
          id: "label_3",
          workspaceId: "workspace_4",
        } as never,
        onlyWorkspaceId: "workspace_4",
      })
    ).toBeNull()
  })
})

import { describe, expect, it } from "vitest"

import { buildWorkspaceMembershipBackfillPlan } from "@/convex/app/maintenance"

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

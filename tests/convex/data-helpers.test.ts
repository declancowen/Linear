import { describe, expect, it } from "vitest"

import {
  getAuthLifecycleError,
  getWorkspaceEditRole,
  resolveActiveUserByIdentity,
  resolvePreferredWorkspaceId,
  resolveWorkspaceEditRole,
  syncWorkspaceMembershipRoleFromTeams,
} from "@/convex/app/data"
import { createMutableConvexTestCtx } from "@/tests/lib/convex/test-db"

function createWorkspaceRoleCtx() {
  return createMutableConvexTestCtx({
    workspaces: [
      {
        _id: "workspace_doc_1",
        id: "workspace_1",
        createdBy: "owner_1",
      },
    ],
    workspaceMemberships: [
      {
        _id: "workspace_membership_doc_1",
        workspaceId: "workspace_1",
        userId: "member_1",
        role: "viewer",
      },
    ],
    teamMemberships: [
      {
        _id: "team_membership_doc_1",
        teamId: "team_1",
        userId: "member_1",
        role: "member",
      },
      {
        _id: "team_membership_doc_2",
        teamId: "team_2",
        userId: "member_1",
        role: "admin",
      },
      {
        _id: "team_membership_doc_3",
        teamId: "other_workspace_team",
        userId: "member_1",
        role: "guest",
      },
    ],
    teams: [
      {
        _id: "team_doc_1",
        id: "team_1",
        workspaceId: "workspace_1",
      },
      {
        _id: "team_doc_2",
        id: "team_2",
        workspaceId: "workspace_1",
      },
      {
        _id: "team_doc_3",
        id: "other_workspace_team",
        workspaceId: "workspace_2",
      },
    ],
    users: [
      {
        _id: "user_doc_1",
        id: "user_1",
        workosUserId: "workos_1",
        email: "alex@example.com",
        emailNormalized: "alex@example.com",
      },
      {
        _id: "user_doc_2",
        id: "deleted_user",
        workosUserId: "workos_deleted",
        email: "deleted@example.com",
        emailNormalized: "deleted@example.com",
        accountDeletedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        _id: "user_doc_3",
        id: "pending_user",
        workosUserId: "workos_pending",
        email: "pending@example.com",
        emailNormalized: "pending@example.com",
        accountDeletionPendingAt: "2026-04-01T00:00:00.000Z",
      },
    ],
  })
}

describe("Convex data helpers", () => {
  it("classifies auth lifecycle errors", () => {
    expect(
      getAuthLifecycleError({
        accountDeletedAt: "2026-04-01T00:00:00.000Z",
      })
    ).toBe("This account has been deleted")
    expect(
      getAuthLifecycleError({
        accountDeletionPendingAt: "2026-04-01T00:00:00.000Z",
      })
    ).toBe("This account is being deleted")
    expect(getAuthLifecycleError(null)).toBeNull()
    expect(getAuthLifecycleError({})).toBeNull()
  })

  it("resolves active users by WorkOS id or email", async () => {
    const ctx = createWorkspaceRoleCtx()

    await expect(
      resolveActiveUserByIdentity(ctx as never, {
        workosUserId: "workos_1",
        email: "fallback@example.com",
      })
    ).resolves.toMatchObject({
      id: "user_1",
    })
    await expect(
      resolveActiveUserByIdentity(ctx as never, {
        workosUserId: "workos_deleted",
      })
    ).rejects.toThrow("This account has been deleted")
    await expect(
      resolveActiveUserByIdentity(ctx as never, {
        workosUserId: "workos_pending",
      })
    ).rejects.toThrow("This account is being deleted")
    await expect(
      resolveActiveUserByIdentity(ctx as never, {
        email: "alex@example.com",
      })
    ).resolves.toMatchObject({
      id: "user_1",
    })
    await expect(resolveActiveUserByIdentity(ctx as never, {})).resolves.toBeNull()
  })

  it("chooses an accessible workspace from selected and fallback candidates", () => {
    expect(
      resolvePreferredWorkspaceId({
        selectedWorkspaceId: "workspace_1",
        accessibleWorkspaceIds: ["workspace_1", "workspace_2"],
        fallbackWorkspaceIds: ["workspace_2"],
      })
    ).toBe("workspace_1")
    expect(
      resolvePreferredWorkspaceId({
        selectedWorkspaceId: "missing",
        accessibleWorkspaceIds: ["workspace_2"],
        fallbackWorkspaceIds: [null, "missing", "workspace_2"],
      })
    ).toBe("workspace_2")
    expect(
      resolvePreferredWorkspaceId({
        selectedWorkspaceId: null,
        accessibleWorkspaceIds: ["workspace_2"],
      })
    ).toBeNull()
  })

  it("merges direct and team roles for workspace edits", async () => {
    expect(
      resolveWorkspaceEditRole({
        directRole: "admin",
        teamRoles: ["viewer"],
      })
    ).toBe("admin")
    expect(
      resolveWorkspaceEditRole({
        directRole: "viewer",
        teamRoles: ["member", "admin"],
      })
    ).toBe("admin")
    expect(
      resolveWorkspaceEditRole({
        directRole: "viewer",
        teamRoles: [],
      })
    ).toBe("viewer")

    const ctx = createWorkspaceRoleCtx()

    await expect(
      getWorkspaceEditRole(ctx as never, "workspace_1", "owner_1")
    ).resolves.toBe("admin")
    await expect(
      getWorkspaceEditRole(ctx as never, "workspace_1", "member_1")
    ).resolves.toBe("admin")
    await expect(
      getWorkspaceEditRole(ctx as never, "missing_workspace", "member_1")
    ).resolves.toBeNull()
  })

  it("syncs workspace membership roles from owned workspaces and team roles", async () => {
    const ownerCtx = createWorkspaceRoleCtx()

    await expect(
      syncWorkspaceMembershipRoleFromTeams(ownerCtx as never, {
        workspaceId: "workspace_1",
        userId: "owner_1",
      })
    ).resolves.toBe("admin")
    expect(ownerCtx.tables.workspaceMemberships).toContainEqual(
      expect.objectContaining({
        workspaceId: "workspace_1",
        userId: "owner_1",
        role: "admin",
      })
    )

    const memberCtx = createWorkspaceRoleCtx()

    await expect(
      syncWorkspaceMembershipRoleFromTeams(memberCtx as never, {
        workspaceId: "workspace_1",
        userId: "member_1",
      })
    ).resolves.toBe("admin")
    expect(memberCtx.tables.workspaceMemberships).toContainEqual(
      expect.objectContaining({
        _id: "workspace_membership_doc_1",
        workspaceId: "workspace_1",
        userId: "member_1",
        role: "admin",
      })
    )

    const fallbackCtx = createWorkspaceRoleCtx()

    await expect(
      syncWorkspaceMembershipRoleFromTeams(fallbackCtx as never, {
        workspaceId: "workspace_1",
        userId: "user_without_teams",
        fallbackRole: "guest",
      })
    ).resolves.toBe("guest")
    expect(fallbackCtx.tables.workspaceMemberships).toContainEqual(
      expect.objectContaining({
        workspaceId: "workspace_1",
        userId: "user_without_teams",
        role: "guest",
      })
    )

    await expect(
      syncWorkspaceMembershipRoleFromTeams(fallbackCtx as never, {
        workspaceId: "missing_workspace",
        userId: "member_1",
      })
    ).rejects.toThrow("Workspace not found")
  })
})

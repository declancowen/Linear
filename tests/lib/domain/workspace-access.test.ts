import { describe, expect, it } from "vitest"

import {
  canAdminWorkspace,
  canEditWorkspace,
  getAccessibleTeams,
  getEditableTeamsForFeature,
  getTeamBySlug,
} from "@/lib/domain/selectors"
import {
  createTestAppData,
  createTestTeam,
  createTestTeamMembership,
  createTestWorkspace,
  createTestWorkspaceMembership,
} from "@/tests/lib/fixtures/app-data"

function createWorkspaceAccessState(teamRole: "member" | "admin") {
  return createTestAppData({
    workspaces: [
      createTestWorkspace({
        slug: "alpha",
        name: "Alpha",
        createdBy: "user_2",
        workosOrganizationId: null,
        settings: {
          accent: "emerald",
          description: "Alpha workspace",
        },
      }),
    ],
    workspaceMemberships: [
      createTestWorkspaceMembership({
        role: "viewer",
      }),
    ],
    teams: [createTestTeam()],
    teamMemberships: [
      createTestTeamMembership({
        role: teamRole,
      }),
    ],
  })
}

describe("workspace access selectors", () => {
  it("preserves editable workspace access from team member roles when the direct membership is stale", () => {
    const state = createWorkspaceAccessState("member")

    expect(canEditWorkspace(state, "workspace_1")).toBe(true)
    expect(canAdminWorkspace(state, "workspace_1")).toBe(false)
  })

  it("preserves workspace admin access from team admin roles when the direct membership is stale", () => {
    const state = createWorkspaceAccessState("admin")

    expect(canEditWorkspace(state, "workspace_1")).toBe(true)
    expect(canAdminWorkspace(state, "workspace_1")).toBe(true)
  })

  it("limits accessible team selectors to the current workspace", () => {
    const state = createTestAppData({
      currentWorkspaceId: "workspace_2",
      workspaces: [
        createTestWorkspace({
          id: "workspace_1",
          slug: "alpha",
          name: "Alpha",
        }),
        createTestWorkspace({
          id: "workspace_2",
          slug: "beta",
          name: "Beta",
        }),
      ],
      teams: [
        createTestTeam({
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "old-team",
          name: "Old team",
        }),
        createTestTeam({
          id: "team_2",
          workspaceId: "workspace_2",
          slug: "new-team",
          name: "New team",
        }),
      ],
      teamMemberships: [
        createTestTeamMembership({
          teamId: "team_1",
        }),
        createTestTeamMembership({
          teamId: "team_2",
        }),
      ],
    })

    expect(getAccessibleTeams(state).map((team) => team.id)).toEqual(["team_2"])
    expect(
      getEditableTeamsForFeature(state, "projects").map((team) => team.id)
    ).toEqual(["team_2"])
    expect(getTeamBySlug(state, "old-team")).toBeNull()
    expect(getTeamBySlug(state, "new-team")?.id).toBe("team_2")
  })
})

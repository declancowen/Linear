import { describe, expect, it } from "vitest"

import { buildWorkspaceRoleMapForUser } from "@/convex/app/data"

describe("workspace role map", () => {
  it("keeps team-admin roles even when a direct workspace membership exists", () => {
    const workspaceRoleMap = buildWorkspaceRoleMapForUser({
      userId: "user_1",
      workspaces: [
        {
          id: "workspace_1",
          createdBy: "user_2",
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
          role: "admin",
        },
      ],
      workspaceMemberships: [
        {
          workspaceId: "workspace_1",
          role: "viewer",
        },
      ],
    })

    expect(workspaceRoleMap.workspace_1).toEqual(
      expect.arrayContaining(["viewer", "admin"])
    )
  })
})

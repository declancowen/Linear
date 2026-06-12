import { describe, expect, it } from "vitest"

import { getTeamSpaceActivity } from "@/lib/domain/selectors"
import {
  createTestAppData,
  createTestTeamMembership,
  createTestWorkItem,
  createTestWorkspaceMembership,
} from "@/tests/lib/fixtures/app-data"

describe("getTeamSpaceActivity", () => {
  it("aggregates team-scoped activity for all members and attributes the actor", () => {
    const teamItem = createTestWorkItem("team_item", {
      teamId: "team_1",
      creatorId: "user_2",
      title: "Team task",
      createdAt: "2026-04-20T10:00:00.000Z",
    })
    const privateItem = createTestWorkItem("private_item", {
      teamId: null,
      workspaceId: "workspace_1",
      visibility: "private",
      creatorId: "user_2",
      title: "Private task",
      createdAt: "2026-04-20T11:00:00.000Z",
    })

    const data = createTestAppData({
      currentUserId: "user_1",
      workspaceMemberships: [
        createTestWorkspaceMembership({ userId: "user_1", role: "admin" }),
        createTestWorkspaceMembership({ userId: "user_2", role: "member" }),
      ],
      teamMemberships: [
        createTestTeamMembership({ teamId: "team_1", userId: "user_1" }),
        createTestTeamMembership({ teamId: "team_1", userId: "user_2" }),
      ],
      workItems: [teamItem, privateItem],
    })

    const activity = getTeamSpaceActivity(data, "team_1")

    expect(
      activity.some(
        (entry) =>
          entry.userId === "user_2" &&
          entry.activity.type === "workItemCreated" &&
          entry.activity.itemId === "team_item"
      )
    ).toBe(true)

    // A private item with no team must not surface in the team feed.
    expect(
      activity.some(
        (entry) =>
          entry.activity.type === "workItemCreated" &&
          entry.activity.itemId === "private_item"
      )
    ).toBe(false)
  })

  it("returns nothing for an unknown team", () => {
    const data = createTestAppData({ currentUserId: "user_1" })
    expect(getTeamSpaceActivity(data, "team_missing")).toEqual([])
  })
})

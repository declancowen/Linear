import { describe, expect, it } from "vitest"

import { getInviteWorkspaceUserMatches } from "@/lib/domain/invite-search"

const workspaceUsers = [
  {
    id: "user_current",
    name: "Current User",
    handle: "current-user",
    email: "current@example.com",
    avatarUrl: "",
    avatarImageUrl: null,
    title: "Founder",
    status: "active" as const,
  },
  {
    id: "user_alex",
    name: "Alex Morgan",
    handle: "alex-morgan",
    email: "alex@example.com",
    avatarUrl: "",
    avatarImageUrl: null,
    title: "Engineering Manager",
    status: "active" as const,
  },
  {
    id: "user_aria",
    name: "Aria Stone",
    handle: "aria-stone",
    email: "aria@example.com",
    avatarUrl: "",
    avatarImageUrl: null,
    title: "Product Designer",
    status: "active" as const,
  },
  {
    id: "user_ben",
    name: "Ben Carter",
    handle: "ben-carter",
    email: "ben@example.com",
    avatarUrl: "",
    avatarImageUrl: null,
    title: "Support",
    status: "active" as const,
  },
]

describe("getInviteWorkspaceUserMatches", () => {
  it("matches workspace users by name, handle, and email while excluding the current user", () => {
    expect(
      getInviteWorkspaceUserMatches({
        currentUserId: "user_current",
        query: "alex",
        selectedTeamIds: [],
        teamMemberships: [],
        workspaceUsers,
      }).map((user) => user.id)
    ).toEqual(["user_alex"])

    expect(
      getInviteWorkspaceUserMatches({
        currentUserId: "user_current",
        query: "aria-st",
        selectedTeamIds: [],
        teamMemberships: [],
        workspaceUsers,
      }).map((user) => user.id)
    ).toEqual(["user_aria"])

    expect(
      getInviteWorkspaceUserMatches({
        currentUserId: "user_current",
        query: "ben@example.com",
        selectedTeamIds: [],
        teamMemberships: [],
        workspaceUsers,
      }).map((user) => user.id)
    ).toEqual(["user_ben"])
  })

  it("excludes people already on every selected team", () => {
    const matches = getInviteWorkspaceUserMatches({
      currentUserId: "user_current",
      query: "a",
      selectedTeamIds: ["team_design", "team_product"],
      teamMemberships: [
        {
          teamId: "team_design",
          userId: "user_alex",
          role: "member",
        },
        {
          teamId: "team_product",
          userId: "user_alex",
          role: "member",
        },
        {
          teamId: "team_design",
          userId: "user_aria",
          role: "member",
        },
      ],
      workspaceUsers,
    })

    expect(matches.map((user) => user.id)).toEqual(["user_aria", "user_ben"])
    expect(matches.find((user) => user.id === "user_aria")).toMatchObject({
      alreadyIncludedInSelectedTeams: false,
    })
    expect(matches.find((user) => user.id === "user_alex")).toBeUndefined()
  })

  it("returns no matches for a blank query", () => {
    expect(
      getInviteWorkspaceUserMatches({
        currentUserId: "user_current",
        query: "   ",
        selectedTeamIds: ["team_design"],
        teamMemberships: [],
        workspaceUsers,
      })
    ).toEqual([])
  })
})

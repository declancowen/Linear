import { beforeEach, describe, expect, it, vi } from "vitest"

const mutationMock = vi.fn()

vi.mock("@/lib/server/convex/core", () => ({
  getConvexServerClient: () => ({
    mutation: mutationMock,
  }),
  withServerToken: <T extends Record<string, unknown>>(input: T) => input,
}))

describe("convex team-project server wrappers", () => {
  beforeEach(() => {
    mutationMock.mockReset()
  })

  it("maps regenerate-join-code authorization failures to typed application errors", async () => {
    const { regenerateTeamJoinCodeServer } = await import(
      "@/lib/server/convex/teams-projects"
    )

    mutationMock.mockRejectedValue(
      new Error("Only team admins can regenerate join codes")
    )

    await expect(
      regenerateTeamJoinCodeServer({
        currentUserId: "user_1",
        teamId: "team_1",
        joinCode: "ABC123DEF456",
      })
    ).rejects.toMatchObject({
      message: "Only team admins can regenerate join codes",
      status: 403,
      code: "TEAM_JOIN_CODE_ADMIN_REQUIRED",
    })
  })

  it("maps project domain failures to typed application errors", async () => {
    const { createProjectServer, updateProjectServer } = await import(
      "@/lib/server/convex/teams-projects"
    )

    mutationMock
      .mockRejectedValueOnce(new Error("Settings team not found"))
      .mockRejectedValueOnce(new Error("Project not found"))

    await expect(
      createProjectServer({
        currentUserId: "user_1",
        scopeType: "workspace",
        scopeId: "workspace_1",
        templateType: "software-delivery",
        name: "Launch",
        summary: "Launch summary",
        priority: "medium",
        settingsTeamId: "team_missing",
      })
    ).rejects.toMatchObject({
      message: "Settings team not found",
      status: 404,
      code: "PROJECT_SETTINGS_TEAM_NOT_FOUND",
    })

    await expect(
      updateProjectServer({
        currentUserId: "user_1",
        projectId: "project_1",
        patch: {
          status: "active",
        },
      })
    ).rejects.toMatchObject({
      message: "Project not found",
      status: 404,
      code: "PROJECT_NOT_FOUND",
    })
  })

  it("maps team lifecycle and admin failures to typed application errors", async () => {
    const {
      createTeamServer,
      joinTeamByCodeServer,
      leaveTeamServer,
      removeTeamMemberServer,
      updateTeamDetailsServer,
      updateTeamWorkflowSettingsServer,
    } = await import("@/lib/server/convex/teams-projects")

    mutationMock
      .mockRejectedValueOnce(
        new Error(
          "Non-community teams must include the work surface, projects, and views."
        )
      )
      .mockRejectedValueOnce(new Error("Join code not found"))
      .mockRejectedValueOnce(new Error("Team admins can't leave the team"))
      .mockRejectedValueOnce(new Error("Teams must keep at least one admin"))
      .mockRejectedValueOnce(
        new Error("Docs cannot be turned off while this team still has documents.")
      )
      .mockRejectedValueOnce(
        new Error("Only team admins can update workflow settings")
      )

    await expect(
      createTeamServer({
        currentUserId: "user_1",
        workspaceId: "workspace_1",
        name: "Launch",
        icon: "robot",
        summary: "Launch summary",
        joinCode: "JOIN1234",
        experience: "software-development",
        features: {
          issues: false,
          projects: true,
          views: true,
          docs: true,
          chat: true,
          channels: true,
        },
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "TEAM_FEATURES_INVALID",
    })

    await expect(
      joinTeamByCodeServer({
        currentUserId: "user_1",
        code: "MISSING",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "TEAM_JOIN_CODE_NOT_FOUND",
    })

    await expect(
      leaveTeamServer({
        currentUserId: "user_1",
        teamId: "team_1",
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "TEAM_LEAVE_ADMIN_FORBIDDEN",
    })

    await expect(
      removeTeamMemberServer({
        currentUserId: "user_1",
        teamId: "team_1",
        userId: "user_2",
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "TEAM_LAST_ADMIN_REQUIRED",
    })

    await expect(
      updateTeamDetailsServer({
        currentUserId: "user_1",
        teamId: "team_1",
        name: "Launch",
        icon: "robot",
        summary: "Launch summary",
        experience: "software-development",
        features: {
          issues: true,
          projects: true,
          views: true,
          docs: false,
          chat: true,
          channels: true,
        },
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "TEAM_FEATURE_DISABLE_CONFLICT",
    })

    await expect(
      updateTeamWorkflowSettingsServer({
        currentUserId: "user_1",
        teamId: "team_1",
        workflow: {
          statusOrder: [
            "backlog",
            "todo",
            "in-progress",
            "done",
            "cancelled",
            "duplicate",
          ],
          templateDefaults: {
            "software-delivery": {
              defaultPriority: "high",
              targetWindowDays: 28,
              defaultViewLayout: "board",
              recommendedItemTypes: ["epic", "feature", "requirement", "story"],
              summaryHint: "Delivery",
            },
            "bug-tracking": {
              defaultPriority: "high",
              targetWindowDays: 14,
              defaultViewLayout: "board",
              recommendedItemTypes: ["issue", "sub-issue", "task"],
              summaryHint: "Bug tracking",
            },
            "project-management": {
              defaultPriority: "medium",
              targetWindowDays: 21,
              defaultViewLayout: "timeline",
              recommendedItemTypes: ["epic", "feature", "task"],
              summaryHint: "Project management",
            },
          },
        },
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "TEAM_ADMIN_REQUIRED",
    })
  })
})

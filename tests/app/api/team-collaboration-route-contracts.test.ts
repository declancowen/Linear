import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const createTeamServerMock = vi.fn()
const joinTeamByCodeServerMock = vi.fn()
const updateTeamDetailsServerMock = vi.fn()
const deleteTeamServerMock = vi.fn()
const updateTeamWorkflowSettingsServerMock = vi.fn()
const updateTeamMemberRoleServerMock = vi.fn()
const removeTeamMemberServerMock = vi.fn()
const leaveTeamServerMock = vi.fn()
const createWorkspaceChatServerMock = vi.fn()
const ensureTeamChatServerMock = vi.fn()
const createChannelServerMock = vi.fn()
const withGeneratedJoinCodeMock = vi.fn()
const reconcileAuthenticatedAppContextMock = vi.fn()
const reconcileProviderMembershipCleanupMock = vi.fn()
const sendAccessChangeEmailsMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
}))

vi.mock("@/lib/server/convex", () => ({
  createTeamServer: createTeamServerMock,
  joinTeamByCodeServer: joinTeamByCodeServerMock,
  updateTeamDetailsServer: updateTeamDetailsServerMock,
  deleteTeamServer: deleteTeamServerMock,
  updateTeamWorkflowSettingsServer: updateTeamWorkflowSettingsServerMock,
  updateTeamMemberRoleServer: updateTeamMemberRoleServerMock,
  removeTeamMemberServer: removeTeamMemberServerMock,
  leaveTeamServer: leaveTeamServerMock,
  createWorkspaceChatServer: createWorkspaceChatServerMock,
  ensureTeamChatServer: ensureTeamChatServerMock,
  createChannelServer: createChannelServerMock,
}))

vi.mock("@/lib/server/join-codes", () => ({
  withGeneratedJoinCode: withGeneratedJoinCodeMock,
}))

vi.mock("@/lib/server/authenticated-app", () => ({
  reconcileAuthenticatedAppContext: reconcileAuthenticatedAppContextMock,
}))

vi.mock("@/lib/server/lifecycle", () => ({
  reconcileProviderMembershipCleanup: reconcileProviderMembershipCleanupMock,
}))

vi.mock("@/lib/server/email", () => ({
  sendAccessChangeEmails: sendAccessChangeEmailsMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  getConvexErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  logProviderError: logProviderErrorMock,
}))

describe("team and collaboration route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    createTeamServerMock.mockReset()
    joinTeamByCodeServerMock.mockReset()
    updateTeamDetailsServerMock.mockReset()
    deleteTeamServerMock.mockReset()
    updateTeamWorkflowSettingsServerMock.mockReset()
    updateTeamMemberRoleServerMock.mockReset()
    removeTeamMemberServerMock.mockReset()
    leaveTeamServerMock.mockReset()
    createWorkspaceChatServerMock.mockReset()
    ensureTeamChatServerMock.mockReset()
    createChannelServerMock.mockReset()
    withGeneratedJoinCodeMock.mockReset()
    reconcileAuthenticatedAppContextMock.mockReset()
    reconcileProviderMembershipCleanupMock.mockReset()
    sendAccessChangeEmailsMock.mockReset()
    logProviderErrorMock.mockReset()

    requireSessionMock.mockResolvedValue({
      user: {
        id: "workos_1",
        email: "alex@example.com",
      },
      organizationId: "org_1",
    })
    requireAppContextMock.mockResolvedValue({
      ensuredUser: {
        userId: "user_1",
      },
      authContext: {
        currentWorkspace: {
          id: "workspace_1",
        },
        pendingWorkspace: null,
      },
    })
    withGeneratedJoinCodeMock.mockImplementation(
      async (callback: (joinCode: string) => unknown) => callback("JOIN1234")
    )
    reconcileAuthenticatedAppContextMock.mockResolvedValue(undefined)
    reconcileProviderMembershipCleanupMock.mockResolvedValue(undefined)
    sendAccessChangeEmailsMock.mockResolvedValue(undefined)
  })

  it("maps team creation failures to typed error responses", async () => {
    const { POST } = await import("@/app/api/teams/route")

    withGeneratedJoinCodeMock.mockRejectedValue(
      new ApplicationError("Unable to generate a unique join code", 503, {
        code: "TEAM_JOIN_CODE_GENERATION_FAILED",
        retryable: true,
      })
    )

    const response = await POST(
      new Request("http://localhost/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Launch",
          icon: "robot",
          summary: "Launch summary",
          experience: "software-development",
          features: {
            issues: true,
            projects: true,
            views: true,
            docs: true,
            chat: true,
            channels: true,
          },
        }),
      }) as never
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Unable to generate a unique join code",
      message: "Unable to generate a unique join code",
      code: "TEAM_JOIN_CODE_GENERATION_FAILED",
      retryable: true,
    })
  })

  it("maps team join failures to typed error responses", async () => {
    const { POST } = await import("@/app/api/teams/join/route")

    joinTeamByCodeServerMock.mockRejectedValue(
      new ApplicationError("Join code not found", 404, {
        code: "TEAM_JOIN_CODE_NOT_FOUND",
      })
    )

    const response = await POST(
      new Request("http://localhost/api/teams/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: "MISSING",
        }),
      }) as never
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Join code not found",
      message: "Join code not found",
      code: "TEAM_JOIN_CODE_NOT_FOUND",
    })
  })

  it("maps team detail and delete failures to typed error responses", async () => {
    const route = await import("@/app/api/teams/[teamId]/details/route")

    updateTeamDetailsServerMock.mockRejectedValue(
      new ApplicationError(
        "Docs cannot be turned off while this team still has documents.",
        409,
        {
          code: "TEAM_FEATURE_DISABLE_CONFLICT",
        }
      )
    )
    deleteTeamServerMock.mockRejectedValue(
      new ApplicationError("Only team admins can delete the team", 403, {
        code: "TEAM_ADMIN_REQUIRED",
      })
    )

    const patchResponse = await route.PATCH(
      new Request("http://localhost/api/teams/team_1/details", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
      }) as never,
      {
        params: Promise.resolve({
          teamId: "team_1",
        }),
      }
    )

    expect(patchResponse.status).toBe(409)
    await expect(patchResponse.json()).resolves.toEqual({
      error: "Docs cannot be turned off while this team still has documents.",
      message: "Docs cannot be turned off while this team still has documents.",
      code: "TEAM_FEATURE_DISABLE_CONFLICT",
    })

    const deleteResponse = await route.DELETE(
      new Request("http://localhost/api/teams/team_1/details", {
        method: "DELETE",
      }) as never,
      {
        params: Promise.resolve({
          teamId: "team_1",
        }),
      }
    )

    expect(deleteResponse.status).toBe(403)
    await expect(deleteResponse.json()).resolves.toEqual({
      error: "Only team admins can delete the team",
      message: "Only team admins can delete the team",
      code: "TEAM_ADMIN_REQUIRED",
    })
  })

  it("maps team workflow and member failures to typed error responses", async () => {
    const settingsRoute = await import("@/app/api/teams/[teamId]/settings/route")
    const membersRoute = await import(
      "@/app/api/teams/[teamId]/members/[userId]/route"
    )

    updateTeamWorkflowSettingsServerMock.mockRejectedValue(
      new ApplicationError("Only team admins can update workflow settings", 403, {
        code: "TEAM_ADMIN_REQUIRED",
      })
    )
    updateTeamMemberRoleServerMock.mockRejectedValue(
      new ApplicationError("Team member not found", 404, {
        code: "TEAM_MEMBER_NOT_FOUND",
      })
    )
    removeTeamMemberServerMock.mockRejectedValue(
      new ApplicationError("Teams must keep at least one admin", 409, {
        code: "TEAM_LAST_ADMIN_REQUIRED",
      })
    )

    const settingsResponse = await settingsRoute.PATCH(
      new Request("http://localhost/api/teams/team_1/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
      }) as never,
      {
        params: Promise.resolve({
          teamId: "team_1",
        }),
      }
    )

    expect(settingsResponse.status).toBe(403)
    await expect(settingsResponse.json()).resolves.toEqual({
      error: "Only team admins can update workflow settings",
      message: "Only team admins can update workflow settings",
      code: "TEAM_ADMIN_REQUIRED",
    })

    const patchMemberResponse = await membersRoute.PATCH(
      new Request("http://localhost/api/teams/team_1/members/user_2", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "member",
        }),
      }) as never,
      {
        params: Promise.resolve({
          teamId: "team_1",
          userId: "user_2",
        }),
      }
    )

    expect(patchMemberResponse.status).toBe(404)
    await expect(patchMemberResponse.json()).resolves.toEqual({
      error: "Team member not found",
      message: "Team member not found",
      code: "TEAM_MEMBER_NOT_FOUND",
    })

    const deleteMemberResponse = await membersRoute.DELETE(
      new Request("http://localhost/api/teams/team_1/members/user_2", {
        method: "DELETE",
      }) as never,
      {
        params: Promise.resolve({
          teamId: "team_1",
          userId: "user_2",
        }),
      }
    )

    expect(deleteMemberResponse.status).toBe(409)
    await expect(deleteMemberResponse.json()).resolves.toEqual({
      error: "Teams must keep at least one admin",
      message: "Teams must keep at least one admin",
      code: "TEAM_LAST_ADMIN_REQUIRED",
    })
  })

  it("maps team leave failures to typed error responses", async () => {
    const { DELETE } = await import("@/app/api/teams/[teamId]/leave/route")

    leaveTeamServerMock.mockRejectedValue(
      new ApplicationError("Team admins can't leave the team", 409, {
        code: "TEAM_LEAVE_ADMIN_FORBIDDEN",
      })
    )

    const response = await DELETE(
      new Request("http://localhost/api/teams/team_1/leave", {
        method: "DELETE",
      }) as never,
      {
        params: Promise.resolve({
          teamId: "team_1",
        }),
      }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "Team admins can't leave the team",
      message: "Team admins can't leave the team",
      code: "TEAM_LEAVE_ADMIN_FORBIDDEN",
    })
  })

  it("reconciles provider memberships after team leave commits", async () => {
    const { DELETE } = await import("@/app/api/teams/[teamId]/leave/route")

    leaveTeamServerMock.mockResolvedValue({
      teamId: "team_1",
      workspaceId: "workspace_1",
      emailJobs: [],
      providerMemberships: [
        {
          workspaceId: "workspace_1",
          organizationId: "org_1",
          workosUserId: "workos_1",
        },
      ],
    })

    const response = await DELETE(
      new Request("http://localhost/api/teams/team_1/leave", {
        method: "DELETE",
      }) as never,
      {
        params: Promise.resolve({
          teamId: "team_1",
        }),
      }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      teamId: "team_1",
      workspaceId: "workspace_1",
    })
    expect(reconcileProviderMembershipCleanupMock).toHaveBeenCalledWith({
      label: "Failed to deactivate WorkOS membership after team leave",
      memberships: [
        {
          workspaceId: "workspace_1",
          organizationId: "org_1",
          workosUserId: "workos_1",
        },
      ],
    })
    expect(reconcileAuthenticatedAppContextMock).toHaveBeenCalledTimes(1)
  })

  it("maps workspace/team chat and channel setup failures to typed error responses", async () => {
    const chatsRoute = await import("@/app/api/chats/route")
    const teamChatRoute = await import("@/app/api/chats/team/route")
    const channelRoute = await import("@/app/api/channels/route")

    createWorkspaceChatServerMock.mockRejectedValue(
      new ApplicationError("Chats need at least two workspace members", 400, {
        code: "CHAT_PARTICIPANTS_INVALID",
      })
    )
    ensureTeamChatServerMock.mockRejectedValue(
      new ApplicationError("Chat is disabled for this team", 400, {
        code: "TEAM_CHAT_DISABLED",
      })
    )
    createChannelServerMock.mockRejectedValue(
      new ApplicationError("Channel must target exactly one team or workspace", 400, {
        code: "CHANNEL_TARGET_INVALID",
      })
    )

    const chatsResponse = await chatsRoute.POST(
      new Request("http://localhost/api/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: "workspace_1",
          participantIds: ["user_1"],
          title: "",
          description: "",
        }),
      }) as never
    )

    expect(chatsResponse.status).toBe(400)
    await expect(chatsResponse.json()).resolves.toEqual({
      error: "Chats need at least two workspace members",
      message: "Chats need at least two workspace members",
      code: "CHAT_PARTICIPANTS_INVALID",
    })

    const teamChatResponse = await teamChatRoute.POST(
      new Request("http://localhost/api/chats/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId: "team_1",
          title: "",
          description: "",
        }),
      }) as never
    )

    expect(teamChatResponse.status).toBe(400)
    await expect(teamChatResponse.json()).resolves.toEqual({
      error: "Chat is disabled for this team",
      message: "Chat is disabled for this team",
      code: "TEAM_CHAT_DISABLED",
    })

    const channelResponse = await channelRoute.POST(
      new Request("http://localhost/api/channels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "",
          description: "",
          teamId: "team_1",
        }),
      }) as never
    )

    expect(channelResponse.status).toBe(400)
    await expect(channelResponse.json()).resolves.toEqual({
      error: "Channel must target exactly one team or workspace",
      message: "Channel must target exactly one team or workspace",
      code: "CHANNEL_TARGET_INVALID",
    })
  })
})

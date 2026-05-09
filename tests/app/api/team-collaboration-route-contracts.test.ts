import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import {
  createJsonRouteRequest,
  createProviderErrorsMockModule,
  createRouteParams,
} from "@/tests/lib/fixtures/api-routes"
import { createTestWorkflowSettingsRequestBody } from "@/tests/lib/fixtures/app-data"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const createTeamServerMock = vi.fn()
const joinTeamByCodeServerMock = vi.fn()
const lookupTeamByJoinCodeServerMock = vi.fn()
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
const enqueueEmailJobsServerMock = vi.fn()
const logProviderErrorMock = vi.fn()
const bumpWorkspaceMembershipReadModelScopesServerMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
}))

vi.mock("@/lib/server/convex", () => ({
  createTeamServer: createTeamServerMock,
  joinTeamByCodeServer: joinTeamByCodeServerMock,
  lookupTeamByJoinCodeServer: lookupTeamByJoinCodeServerMock,
  updateTeamDetailsServer: updateTeamDetailsServerMock,
  deleteTeamServer: deleteTeamServerMock,
  updateTeamWorkflowSettingsServer: updateTeamWorkflowSettingsServerMock,
  updateTeamMemberRoleServer: updateTeamMemberRoleServerMock,
  removeTeamMemberServer: removeTeamMemberServerMock,
  leaveTeamServer: leaveTeamServerMock,
  createWorkspaceChatServer: createWorkspaceChatServerMock,
  ensureTeamChatServer: ensureTeamChatServerMock,
  createChannelServer: createChannelServerMock,
  enqueueEmailJobsServer: enqueueEmailJobsServerMock,
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
  buildAccessChangeEmailJobs: vi.fn(() => []),
}))

vi.mock("@/lib/server/provider-errors", () =>
  createProviderErrorsMockModule(logProviderErrorMock)
)

vi.mock("@/lib/server/scoped-read-models", () => ({
  bumpWorkspaceMembershipReadModelScopesServer:
    bumpWorkspaceMembershipReadModelScopesServerMock,
}))

function createJsonPatchRequest(url: string, body: unknown) {
  return createJsonRouteRequest(url, "PATCH", body)
}

function createTeamDetailsRequestBody(summary: string) {
  return {
    name: "Launch",
    icon: "robot",
    summary,
    experience: "software-development",
    features: {
      issues: true,
      projects: true,
      views: true,
      docs: true,
      chat: true,
      channels: true,
    },
  }
}

function createTeamSettingsPatchInput() {
  return [
    createJsonPatchRequest(
      "http://localhost/api/teams/team_1/settings",
      createTestWorkflowSettingsRequestBody()
    ),
    {
      params: Promise.resolve({
        teamId: "team_1",
      }),
    },
  ] as const
}

function createTeamMemberPatchInput() {
  return [
    createJsonPatchRequest("http://localhost/api/teams/team_1/members/user_2", {
      role: "member",
    }),
    {
      params: Promise.resolve({
        teamId: "team_1",
        userId: "user_2",
      }),
    },
  ] as const
}

function createTeamMemberDeleteInput() {
  return [
    new Request("http://localhost/api/teams/team_1/members/user_2", {
      method: "DELETE",
    }) as never,
    {
      params: Promise.resolve({
        teamId: "team_1",
        userId: "user_2",
      }),
    },
  ] as const
}

describe("team and collaboration route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    createTeamServerMock.mockReset()
    joinTeamByCodeServerMock.mockReset()
    lookupTeamByJoinCodeServerMock.mockReset()
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
    enqueueEmailJobsServerMock.mockReset()
    logProviderErrorMock.mockReset()
    bumpWorkspaceMembershipReadModelScopesServerMock.mockReset()

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
    enqueueEmailJobsServerMock.mockResolvedValue({
      queued: 0,
    })
    bumpWorkspaceMembershipReadModelScopesServerMock.mockResolvedValue(undefined)
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

  it("returns the create-team contract with the generated join code", async () => {
    const { POST } = await import("@/app/api/teams/route")

    createTeamServerMock.mockResolvedValue({
      teamId: "team_2",
      teamSlug: "platform",
      joinCode: "JOIN1234",
      features: {
        issues: true,
        projects: true,
        views: true,
        docs: true,
        chat: true,
        channels: true,
      },
    })

    const response = await POST(
      new Request("http://localhost/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Platform",
          icon: "robot",
          summary: "Platform summary",
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

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      teamId: "team_2",
      teamSlug: "platform",
      joinCode: "JOIN1234",
      features: {
        issues: true,
        projects: true,
        views: true,
        docs: true,
        chat: true,
        channels: true,
      },
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

  it("rejects empty join codes before they reach the team join and lookup providers", async () => {
    const joinRoute = await import("@/app/api/teams/join/route")
    const lookupRoute = await import("@/app/api/teams/lookup/route")

    const joinResponse = await joinRoute.POST(
      new Request("http://localhost/api/teams/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: "",
        }),
      }) as never
    )

    expect(joinResponse.status).toBe(400)
    expect(joinTeamByCodeServerMock).not.toHaveBeenCalled()

    const lookupResponse = await lookupRoute.GET(
      new NextRequest("http://localhost/api/teams/lookup?code=") as never
    )

    expect(lookupResponse.status).toBe(400)
    expect(lookupTeamByJoinCodeServerMock).not.toHaveBeenCalled()
  })

  it("maps team lookup failures without provider-error noise", async () => {
    const { GET } = await import("@/app/api/teams/lookup/route")

    lookupTeamByJoinCodeServerMock.mockRejectedValue(
      new ApplicationError("Join code not found", 404, {
        code: "TEAM_JOIN_CODE_NOT_FOUND",
      })
    )

    const response = await GET(
      new NextRequest("http://localhost/api/teams/lookup?code=MISSING") as never
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Join code not found",
      message: "Join code not found",
      code: "TEAM_JOIN_CODE_NOT_FOUND",
    })
    expect(logProviderErrorMock).not.toHaveBeenCalled()
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

  it("invalidates the mutated team's workspace membership scope", async () => {
    const route = await import("@/app/api/teams/[teamId]/details/route")

    updateTeamDetailsServerMock.mockResolvedValue({
      teamId: "team_1",
      workspaceId: "workspace_2",
    })
    deleteTeamServerMock.mockResolvedValue({
      teamId: "team_1",
      workspaceId: "workspace_2",
      deletedUserIds: [],
    })

    const patchResponse = await route.PATCH(
      createJsonPatchRequest(
        "http://localhost/api/teams/team_1/details",
        createTeamDetailsRequestBody("Launch summary")
      ),
      createRouteParams({ teamId: "team_1" })
    )

    expect(patchResponse.status).toBe(200)
    expect(bumpWorkspaceMembershipReadModelScopesServerMock).toHaveBeenNthCalledWith(
      1,
      "workspace_2"
    )

    const deleteResponse = await route.DELETE(
      new Request("http://localhost/api/teams/team_1/details", {
        method: "DELETE",
      }) as never,
      createRouteParams({ teamId: "team_1" })
    )

    expect(deleteResponse.status).toBe(200)
    expect(bumpWorkspaceMembershipReadModelScopesServerMock).toHaveBeenNthCalledWith(
      2,
      "workspace_2"
    )
  })

  it("accepts an empty team summary for detail updates", async () => {
    const route = await import("@/app/api/teams/[teamId]/details/route")

    updateTeamDetailsServerMock.mockResolvedValue({
      teamId: "team_1",
      workspaceId: "workspace_1",
    })

    const patchResponse = await route.PATCH(
      createJsonPatchRequest(
        "http://localhost/api/teams/team_1/details",
        createTeamDetailsRequestBody("")
      ),
      createRouteParams({ teamId: "team_1" })
    )

    expect(patchResponse.status).toBe(200)
    await expect(patchResponse.json()).resolves.toEqual({
      ok: true,
      teamId: "team_1",
    })
    expect(updateTeamDetailsServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      teamId: "team_1",
      name: "Launch",
      icon: "robot",
      summary: "",
      experience: "software-development",
      features: {
        issues: true,
        projects: true,
        views: true,
        docs: true,
        chat: true,
        channels: true,
      },
    })
  })

  it("invalidates the mutated team's workspace for settings and member mutations", async () => {
    const settingsRoute = await import("@/app/api/teams/[teamId]/settings/route")
    const membersRoute = await import(
      "@/app/api/teams/[teamId]/members/[userId]/route"
    )

    updateTeamWorkflowSettingsServerMock.mockResolvedValue({
      teamId: "team_1",
      workspaceId: "workspace_2",
    })
    updateTeamMemberRoleServerMock.mockResolvedValue({
      teamId: "team_1",
      workspaceId: "workspace_2",
      userId: "user_2",
      role: "member",
    })
    removeTeamMemberServerMock.mockResolvedValue({
      teamId: "team_1",
      workspaceId: "workspace_2",
      userId: "user_2",
      providerMemberships: [],
    })

    const settingsResponse = await settingsRoute.PATCH(
      ...createTeamSettingsPatchInput()
    )

    expect(settingsResponse.status).toBe(200)
    expect(bumpWorkspaceMembershipReadModelScopesServerMock).toHaveBeenNthCalledWith(
      1,
      "workspace_2"
    )

    const patchMemberResponse = await membersRoute.PATCH(
      ...createTeamMemberPatchInput()
    )

    expect(patchMemberResponse.status).toBe(200)
    expect(bumpWorkspaceMembershipReadModelScopesServerMock).toHaveBeenNthCalledWith(
      2,
      "workspace_2"
    )

    const deleteMemberResponse = await membersRoute.DELETE(
      ...createTeamMemberDeleteInput()
    )

    expect(deleteMemberResponse.status).toBe(200)
    expect(bumpWorkspaceMembershipReadModelScopesServerMock).toHaveBeenNthCalledWith(
      3,
      "workspace_2"
    )
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
      ...createTeamSettingsPatchInput()
    )

    expect(settingsResponse.status).toBe(403)
    await expect(settingsResponse.json()).resolves.toEqual({
      error: "Only team admins can update workflow settings",
      message: "Only team admins can update workflow settings",
      code: "TEAM_ADMIN_REQUIRED",
    })

    const patchMemberResponse = await membersRoute.PATCH(
      ...createTeamMemberPatchInput()
    )

    expect(patchMemberResponse.status).toBe(404)
    await expect(patchMemberResponse.json()).resolves.toEqual({
      error: "Team member not found",
      message: "Team member not found",
      code: "TEAM_MEMBER_NOT_FOUND",
    })

    const deleteMemberResponse = await membersRoute.DELETE(
      ...createTeamMemberDeleteInput()
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
      workspaceAccessRemoved: false,
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

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { createWorkspaceSlice as createWorkspaceSliceType } from "@/lib/store/app-store-internal/slices/workspace"

import { createDefaultTeamFeatureSettings } from "@/lib/domain/types"
import {
  createTestAppData,
  createTestTeam,
  createTestTeamMembership,
  createTestWorkspace,
} from "@/tests/lib/fixtures/app-data"
import { createMutableSetState } from "@/tests/lib/fixtures/store"

const syncJoinTeamByCodeMock = vi.fn()
const syncLeaveTeamMock = vi.fn()
const syncRegenerateTeamJoinCodeMock = vi.fn()
const syncUpdateCurrentUserProfileMock = vi.fn()
const syncUpdateTeamDetailsMock = vi.fn()
const syncUpdateTeamMemberRoleMock = vi.fn()
const syncUpdateWorkspaceBrandingMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

type CreateWorkspaceSlice = typeof createWorkspaceSliceType

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}))

vi.mock("@/lib/convex/client", () => ({
  syncCreateTeam: vi.fn(),
  syncDeleteCurrentWorkspace: vi.fn(),
  syncDeleteTeam: vi.fn(),
  syncJoinTeamByCode: syncJoinTeamByCodeMock,
  syncLeaveWorkspace: vi.fn(),
  syncLeaveTeam: syncLeaveTeamMock,
  syncRegenerateTeamJoinCode: syncRegenerateTeamJoinCodeMock,
  syncRemoveTeamMember: vi.fn(),
  syncRemoveWorkspaceUser: vi.fn(),
  syncUpdateCurrentUserProfile: syncUpdateCurrentUserProfileMock,
  syncUpdateTeamDetails: syncUpdateTeamDetailsMock,
  syncUpdateTeamMemberRole: syncUpdateTeamMemberRoleMock,
  syncUpdateTeamWorkflowSettings: vi.fn(),
  syncUpdateWorkspaceBranding: syncUpdateWorkspaceBrandingMock,
}))

function createWorkspaceSliceHarness(
  createWorkspaceSlice: CreateWorkspaceSlice,
  state = createTestAppData()
) {
  const refreshFromServerMock = vi.fn()
  const syncInBackgroundMock = vi.fn()
  const setState = createMutableSetState(state)
  const slice = createWorkspaceSlice(
    setState as never,
    () => state as never,
    {
      refreshFromServer: refreshFromServerMock,
      syncInBackground: syncInBackgroundMock,
    } as never
  )

  return {
    refreshFromServerMock,
    setState,
    slice,
    state,
    syncInBackgroundMock,
  }
}

describe("workspace slice", () => {
  beforeEach(() => {
    syncJoinTeamByCodeMock.mockReset()
    syncLeaveTeamMock.mockReset()
    syncRegenerateTeamJoinCodeMock.mockReset()
    syncUpdateCurrentUserProfileMock.mockReset()
    syncUpdateTeamDetailsMock.mockReset()
    syncUpdateTeamMemberRoleMock.mockReset()
    syncUpdateWorkspaceBrandingMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
  })

  it("reconciles from the server after joining a team by code", async () => {
    const { createWorkspaceSlice } =
      await import("@/lib/store/app-store-internal/slices/workspace")

    const state = {
      currentUserId: "user_1",
    }
    const refreshFromServerMock = vi.fn().mockResolvedValue(undefined)

    const slice = createWorkspaceSlice(vi.fn(), () => state as never, {
      refreshFromServer: refreshFromServerMock,
      syncInBackground: vi.fn(),
    } as never)

    syncJoinTeamByCodeMock.mockResolvedValue({
      ok: true,
      role: "member",
      teamSlug: "platform",
      workspaceId: "workspace_1",
    })

    await expect(slice.joinTeamByCode("ABC123DEF456")).resolves.toBe(true)

    expect(syncJoinTeamByCodeMock).toHaveBeenCalledWith(
      "user_1",
      "ABC123DEF456"
    )
    expect(refreshFromServerMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalledWith("Joined team")
  })

  it("refreshes from the server when enabling chat for an existing team", async () => {
    const { createWorkspaceSlice } =
      await import("@/lib/store/app-store-internal/slices/workspace")

    const { refreshFromServerMock, slice, state } = createWorkspaceSliceHarness(
      createWorkspaceSlice,
      createTestAppData({
        teams: [
          createTestTeam({
            settings: {
              features: {
                ...createDefaultTeamFeatureSettings("software-development"),
                chat: false,
                channels: false,
              },
            },
          }),
        ],
      })
    )

    syncUpdateTeamDetailsMock.mockResolvedValue(undefined)

    await expect(
      slice.updateTeamDetails("team_1", {
        name: "Platform",
        icon: "robot",
        summary: "Platform team",
        experience: "software-development",
        features: {
          ...state.teams[0].settings.features,
          chat: true,
        },
      })
    ).resolves.toBe(true)

    expect(syncUpdateTeamDetailsMock).toHaveBeenCalledWith("team_1", {
      name: "Platform",
      icon: "robot",
      summary: "Platform team",
      experience: "software-development",
      features: {
        ...state.teams[0].settings.features,
        chat: true,
      },
    })
    expect(refreshFromServerMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalledWith("Team updated")
  })

  it("accepts an empty team summary when updating an existing team", async () => {
    const { createWorkspaceSlice } =
      await import("@/lib/store/app-store-internal/slices/workspace")

    const { slice } = createWorkspaceSliceHarness(createWorkspaceSlice)

    syncUpdateTeamDetailsMock.mockResolvedValue(undefined)

    await expect(
      slice.updateTeamDetails("team_1", {
        name: "Platform",
        icon: "robot",
        summary: "",
        experience: "software-development",
        features: createDefaultTeamFeatureSettings("software-development"),
      })
    ).resolves.toBe(true)

    expect(syncUpdateTeamDetailsMock).toHaveBeenCalledWith("team_1", {
      name: "Platform",
      icon: "robot",
      summary: "",
      experience: "software-development",
      features: createDefaultTeamFeatureSettings("software-development"),
    })
  })

  it("accepts an empty workspace description when updating branding", async () => {
    const { createWorkspaceSlice } =
      await import("@/lib/store/app-store-internal/slices/workspace")

    const { slice, state, syncInBackgroundMock } = createWorkspaceSliceHarness(
      createWorkspaceSlice,
      createTestAppData({
        workspaces: [
          createTestWorkspace({
            slug: "alpha",
            name: "Alpha",
            logoUrl: "AA",
            settings: {
              accent: "emerald",
              description: "Alpha workspace",
            },
          }),
        ],
      })
    )

    syncUpdateWorkspaceBrandingMock.mockResolvedValue(undefined)

    slice.updateWorkspaceBranding({
      name: "Alpha",
      logoUrl: "AA",
      accent: "emerald",
      description: "",
    })

    expect(state.workspaces[0]?.settings.description).toBe("")
    expect(syncUpdateWorkspaceBrandingMock).toHaveBeenCalledWith(
      "workspace_1",
      "Alpha",
      "AA",
      "emerald",
      "",
      {
        clearLogoImage: undefined,
        logoImageStorageId: undefined,
      }
    )
    expect(syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })

  it("drops the workspace immediately when leaving the last accessible team removes workspace access", async () => {
    const { createWorkspaceSlice } =
      await import("@/lib/store/app-store-internal/slices/workspace")

    const { slice, state } = createWorkspaceSliceHarness(
      createWorkspaceSlice,
      createTestAppData({
        workspaces: [
          createTestWorkspace({
            slug: "alpha",
            name: "Alpha",
            createdBy: "user_2",
            workosOrganizationId: "org_1",
            settings: {
              accent: "emerald",
              description: "Alpha workspace",
            },
          }),
          createTestWorkspace({
            id: "workspace_2",
            slug: "beta",
            name: "Beta",
            createdBy: "user_3",
            workosOrganizationId: "org_2",
            settings: {
              accent: "blue",
              description: "Beta workspace",
            },
          }),
        ],
        teams: [
          createTestTeam(),
          createTestTeam({
            id: "team_2",
            workspaceId: "workspace_2",
            slug: "design",
            name: "Design",
            icon: "users",
            settings: {
              joinCode: "JOIN5678",
              summary: "Design team",
              experience: "project-management",
            },
          }),
        ],
        teamMemberships: [
          createTestTeamMembership({ role: "member" }),
          createTestTeamMembership({ teamId: "team_2", role: "member" }),
        ],
      })
    )

    syncLeaveTeamMock.mockResolvedValue({
      teamId: "team_1",
      workspaceId: "workspace_1",
      workspaceAccessRemoved: true,
    })

    await expect(slice.leaveTeam("team_1")).resolves.toBe(true)

    expect(state.currentWorkspaceId).toBe("workspace_2")
    expect(state.workspaces.map((workspace) => workspace.id)).toEqual([
      "workspace_2",
    ])
    expect(state.teams.map((team) => team.id)).toEqual(["team_2"])
    expect(toastSuccessMock).toHaveBeenCalledWith("Left team")
  })

  it("updates team member roles and regenerates team join codes", async () => {
    const { createWorkspaceSlice } =
      await import("@/lib/store/app-store-internal/slices/workspace")
    const { slice, state } = createWorkspaceSliceHarness(
      createWorkspaceSlice,
      createTestAppData({
        teamMemberships: [createTestTeamMembership({ role: "member" })],
      })
    )

    syncUpdateTeamMemberRoleMock.mockResolvedValue(undefined)
    syncRegenerateTeamJoinCodeMock.mockResolvedValue({
      joinCode: "JOIN9999",
    })

    await expect(
      slice.updateTeamMemberRole("team_1", "user_1", { role: "admin" })
    ).resolves.toBe(true)
    expect(state.teamMemberships[0]).toMatchObject({
      role: "admin",
    })
    expect(syncUpdateTeamMemberRoleMock).toHaveBeenCalledWith(
      "team_1",
      "user_1",
      "admin"
    )

    await expect(slice.regenerateTeamJoinCode("team_1")).resolves.toBe(true)
    expect(state.teams[0].settings.joinCode).toBe("JOIN9999")
    expect(toastSuccessMock).toHaveBeenCalledWith("Join code regenerated")
  })

  it("updates the current user profile optimistically before syncing", async () => {
    const { createWorkspaceSlice } =
      await import("@/lib/store/app-store-internal/slices/workspace")
    const { slice, state, syncInBackgroundMock } =
      createWorkspaceSliceHarness(createWorkspaceSlice)

    syncUpdateCurrentUserProfileMock.mockResolvedValue(undefined)

    slice.updateCurrentUserProfile({
      name: "Alex Updated",
      title: "Lead",
      avatarUrl: "AU",
      clearAvatarImage: true,
      clearStatus: true,
      preferences: {
        emailAssignments: false,
        emailDigest: true,
        emailMentions: true,
        theme: "dark",
      },
    })

    expect(state.users[0]).toMatchObject({
      avatarImageUrl: null,
      avatarUrl: "AU",
      hasExplicitStatus: false,
      name: "Alex Updated",
      title: "Lead",
    })
    expect(syncInBackgroundMock).toHaveBeenCalledTimes(1)
    expect(syncUpdateCurrentUserProfileMock).toHaveBeenCalledWith(
      "user_1",
      "Alex Updated",
      "Lead",
      "AU",
      {
        emailAssignments: false,
        emailDigest: true,
        emailMentions: true,
        theme: "dark",
      },
      {
        avatarImageStorageId: undefined,
        clearAvatarImage: true,
        clearStatus: true,
        status: undefined,
        statusMessage: undefined,
      }
    )
  })
})

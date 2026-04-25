import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"

const syncJoinTeamByCodeMock = vi.fn()
const syncLeaveTeamMock = vi.fn()
const syncUpdateTeamDetailsMock = vi.fn()
const syncUpdateWorkspaceBrandingMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

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
  syncRegenerateTeamJoinCode: vi.fn(),
  syncRemoveTeamMember: vi.fn(),
  syncRemoveWorkspaceUser: vi.fn(),
  syncUpdateCurrentUserProfile: vi.fn(),
  syncUpdateTeamDetails: syncUpdateTeamDetailsMock,
  syncUpdateTeamMemberRole: vi.fn(),
  syncUpdateTeamWorkflowSettings: vi.fn(),
  syncUpdateWorkspaceBranding: syncUpdateWorkspaceBrandingMock,
}))

describe("workspace slice", () => {
  beforeEach(() => {
    syncJoinTeamByCodeMock.mockReset()
    syncLeaveTeamMock.mockReset()
    syncUpdateTeamDetailsMock.mockReset()
    syncUpdateWorkspaceBrandingMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
  })

  it("reconciles from the server after joining a team by code", async () => {
    const { createWorkspaceSlice } = await import(
      "@/lib/store/app-store-internal/slices/workspace"
    )

    const state = {
      currentUserId: "user_1",
    }
    const refreshFromServerMock = vi.fn().mockResolvedValue(undefined)

    const slice = createWorkspaceSlice(
      vi.fn(),
      () => state as never,
      {
        refreshFromServer: refreshFromServerMock,
        syncInBackground: vi.fn(),
      } as never
    )

    syncJoinTeamByCodeMock.mockResolvedValue({
      ok: true,
      role: "member",
      teamSlug: "platform",
      workspaceId: "workspace_1",
    })

    await expect(slice.joinTeamByCode("ABC123DEF456")).resolves.toBe(true)

    expect(syncJoinTeamByCodeMock).toHaveBeenCalledWith("user_1", "ABC123DEF456")
    expect(refreshFromServerMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalledWith("Joined team")
  })

  it("refreshes from the server when enabling chat for an existing team", async () => {
    const { createWorkspaceSlice } = await import(
      "@/lib/store/app-store-internal/slices/workspace"
    )

    const baseState = createEmptyState()
    const state = {
      ...baseState,
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "platform",
          name: "Platform",
          icon: "robot",
          settings: {
            joinCode: "JOIN1234",
            summary: "Platform team",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "software-development" as const,
            features: {
              ...createDefaultTeamFeatureSettings("software-development"),
              chat: false,
              channels: false,
            },
            workflow: createDefaultTeamWorkflowSettings("software-development"),
          },
        },
      ],
      teamMemberships: [
        {
          teamId: "team_1",
          userId: "user_1",
          role: "admin" as const,
        },
      ],
      ui: {
        activeTeamId: "team_1",
        activeInboxNotificationId: null,
        selectedViewByRoute: {},
      },
    }
    const setState = vi.fn((update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      Object.assign(state, patch)
    })
    const refreshFromServerMock = vi.fn().mockResolvedValue(undefined)

    const slice = createWorkspaceSlice(
      setState as never,
      () => state as never,
      {
        refreshFromServer: refreshFromServerMock,
        syncInBackground: vi.fn(),
      } as never
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
    const { createWorkspaceSlice } = await import(
      "@/lib/store/app-store-internal/slices/workspace"
    )

    const baseState = createEmptyState()
    let state = {
      ...baseState,
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "platform",
          name: "Platform",
          icon: "robot",
          settings: {
            joinCode: "JOIN1234",
            summary: "Platform team",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "software-development" as const,
            features: createDefaultTeamFeatureSettings("software-development"),
            workflow: createDefaultTeamWorkflowSettings("software-development"),
          },
        },
      ],
    }
    const setState = vi.fn((update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    })

    const slice = createWorkspaceSlice(
      setState as never,
      () => state as never,
      {
        refreshFromServer: vi.fn(),
        syncInBackground: vi.fn(),
      } as never
    )

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
    const { createWorkspaceSlice } = await import(
      "@/lib/store/app-store-internal/slices/workspace"
    )

    let state = {
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      workspaces: [
        {
          id: "workspace_1",
          slug: "alpha",
          name: "Alpha",
          logoUrl: "AA",
          logoImageUrl: null,
          createdBy: "user_1",
          workosOrganizationId: "org_1",
          settings: {
            accent: "emerald",
            description: "Alpha workspace",
          },
        },
      ],
    }
    const syncInBackgroundMock = vi.fn()
    const setState = vi.fn((update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    })

    const slice = createWorkspaceSlice(
      setState as never,
      () => state as never,
      {
        refreshFromServer: vi.fn(),
        syncInBackground: syncInBackgroundMock,
      } as never
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
    const { createWorkspaceSlice } = await import(
      "@/lib/store/app-store-internal/slices/workspace"
    )

    let state = {
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      workspaces: [
        {
          id: "workspace_1",
          slug: "alpha",
          name: "Alpha",
          logoUrl: "",
          logoImageUrl: null,
          createdBy: "user_2",
          workosOrganizationId: "org_1",
          settings: {
            accent: "emerald",
            description: "Alpha workspace",
          },
        },
        {
          id: "workspace_2",
          slug: "beta",
          name: "Beta",
          logoUrl: "",
          logoImageUrl: null,
          createdBy: "user_3",
          workosOrganizationId: "org_2",
          settings: {
            accent: "blue",
            description: "Beta workspace",
          },
        },
      ],
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "platform",
          name: "Platform",
          icon: "robot",
          settings: {
            joinCode: "JOIN1234",
            summary: "Platform team",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "software-development" as const,
            features: createDefaultTeamFeatureSettings("software-development"),
            workflow: createDefaultTeamWorkflowSettings("software-development"),
          },
        },
        {
          id: "team_2",
          workspaceId: "workspace_2",
          slug: "design",
          name: "Design",
          icon: "users",
          settings: {
            joinCode: "JOIN5678",
            summary: "Design team",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "project-management" as const,
            features: createDefaultTeamFeatureSettings("project-management"),
            workflow: createDefaultTeamWorkflowSettings("project-management"),
          },
        },
      ],
      teamMemberships: [
        {
          teamId: "team_1",
          userId: "user_1",
          role: "member" as const,
        },
        {
          teamId: "team_2",
          userId: "user_1",
          role: "member" as const,
        },
      ],
      ui: {
        activeTeamId: "team_1",
        activeInboxNotificationId: null,
        selectedViewByRoute: {},
      },
    }
    const setState = vi.fn((update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    })

    const slice = createWorkspaceSlice(
      setState as never,
      () => state as never,
      {
        refreshFromServer: vi.fn(),
        syncInBackground: vi.fn(),
      } as never
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
})

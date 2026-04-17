import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"

const syncJoinTeamByCodeMock = vi.fn()
const syncUpdateTeamDetailsMock = vi.fn()
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
  syncLeaveTeam: vi.fn(),
  syncRegenerateTeamJoinCode: vi.fn(),
  syncRemoveTeamMember: vi.fn(),
  syncRemoveWorkspaceUser: vi.fn(),
  syncUpdateCurrentUserProfile: vi.fn(),
  syncUpdateTeamDetails: syncUpdateTeamDetailsMock,
  syncUpdateTeamMemberRole: vi.fn(),
  syncUpdateTeamWorkflowSettings: vi.fn(),
  syncUpdateWorkspaceBranding: vi.fn(),
}))

describe("workspace slice", () => {
  beforeEach(() => {
    syncJoinTeamByCodeMock.mockReset()
    syncUpdateTeamDetailsMock.mockReset()
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
})

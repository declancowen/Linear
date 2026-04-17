import { beforeEach, describe, expect, it, vi } from "vitest"

const syncJoinTeamByCodeMock = vi.fn()
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
  syncUpdateTeamDetails: vi.fn(),
  syncUpdateTeamMemberRole: vi.fn(),
  syncUpdateTeamWorkflowSettings: vi.fn(),
  syncUpdateWorkspaceBranding: vi.fn(),
}))

describe("workspace slice", () => {
  beforeEach(() => {
    syncJoinTeamByCodeMock.mockReset()
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
})

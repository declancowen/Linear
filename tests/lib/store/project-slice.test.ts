import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"

const syncCreateProjectMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}))

vi.mock("@/lib/convex/client", () => ({
  syncCreateProject: syncCreateProjectMock,
  syncUpdateProject: vi.fn(),
}))

function createProjectTestState(role: "admin" | "member" | "viewer") {
  return {
    ...createEmptyState(),
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
    teamMemberships: [
      {
        teamId: "team_1",
        userId: "user_1",
        role,
      },
    ],
  }
}

describe("project slice", () => {
  beforeEach(() => {
    syncCreateProjectMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
  })

  it("rejects workspace-scoped project creation", async () => {
    const { createProjectSlice } = await import(
      "@/lib/store/app-store-internal/slices/projects"
    )

    const state = createProjectTestState("member")
    const syncInBackgroundMock = vi.fn()
    const setState = vi.fn((update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      Object.assign(state, patch)
    })
    const slice = createProjectSlice(
      setState as never,
      () => state as never,
      {
        syncInBackground: syncInBackgroundMock,
      } as never
    )

    slice.createProject({
      scopeType: "workspace",
      scopeId: "workspace_1",
      settingsTeamId: "team_1",
      templateType: "software-delivery",
      name: "Workspace roadmap",
      summary: "Cross-team view",
      priority: "high",
    })

    expect(state.projects).toHaveLength(0)
    expect(syncInBackgroundMock).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledWith(
      "Projects must belong to a team space"
    )
  })

  it("rejects project creation for read-only team members", async () => {
    const { createProjectSlice } = await import(
      "@/lib/store/app-store-internal/slices/projects"
    )

    const state = createProjectTestState("viewer")
    const syncInBackgroundMock = vi.fn()
    const setState = vi.fn((update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      Object.assign(state, patch)
    })
    const slice = createProjectSlice(
      setState as never,
      () => state as never,
      {
        syncInBackground: syncInBackgroundMock,
      } as never
    )

    slice.createProject({
      scopeType: "team",
      scopeId: "team_1",
      templateType: "software-delivery",
      name: "Roadmap refresh",
      summary: "Next release",
      priority: "medium",
    })

    expect(state.projects).toHaveLength(0)
    expect(syncInBackgroundMock).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledWith(
      "Your current role is read-only"
    )
  })

  it("creates team-scoped projects for editable team members", async () => {
    const { createProjectSlice } = await import(
      "@/lib/store/app-store-internal/slices/projects"
    )

    const state = createProjectTestState("member")
    const syncInBackgroundMock = vi.fn()
    const setState = vi.fn((update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      Object.assign(state, patch)
    })
    const slice = createProjectSlice(
      setState as never,
      () => state as never,
      {
        syncInBackground: syncInBackgroundMock,
      } as never
    )

    slice.createProject({
      scopeType: "team",
      scopeId: "team_1",
      templateType: "software-delivery",
      name: "Roadmap refresh",
      summary: "Next release",
      priority: "medium",
    })

    expect(state.projects).toHaveLength(1)
    expect(state.projects[0]).toMatchObject({
      name: "Roadmap refresh",
      scopeType: "team",
      scopeId: "team_1",
      templateType: "software-delivery",
    })
    expect(syncInBackgroundMock).toHaveBeenCalledTimes(1)
    expect(syncCreateProjectMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalledWith("Project created")
  })
})

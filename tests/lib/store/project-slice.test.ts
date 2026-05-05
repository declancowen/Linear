import { beforeEach, describe, expect, it, vi } from "vitest"
import type { createProjectSlice as createProjectSliceType } from "@/lib/store/app-store-internal/slices/projects"

import {
  createTestAppData,
  createTestProject,
  createTestTeamMembership,
} from "@/tests/lib/fixtures/app-data"
import {
  createMutableSetState,
  createToastMockModule,
  withLosAngelesFakeSystemTime,
} from "@/tests/lib/fixtures/store"

const syncCreateProjectMock = vi.fn()
const syncRenameProjectMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock("sonner", () =>
  createToastMockModule({ error: toastErrorMock, success: toastSuccessMock })
)

vi.mock("@/lib/convex/client", () => ({
  syncCreateProject: syncCreateProjectMock,
  syncRenameProject: syncRenameProjectMock,
  syncUpdateProject: vi.fn(),
  syncDeleteProject: vi.fn(),
}))

function createProjectTestState(role: "admin" | "member" | "viewer") {
  return createTestAppData({
    teamMemberships: [createTestTeamMembership({ role })],
  })
}

type CreateProjectSlice = typeof createProjectSliceType

function createProjectSliceHarness(
  createProjectSlice: CreateProjectSlice,
  role: "admin" | "member" | "viewer"
) {
  const state = createProjectTestState(role)
  const syncInBackgroundMock = vi.fn()
  const setState = createMutableSetState(state)
  const slice = createProjectSlice(
    setState as never,
    () => state as never,
    {
      syncInBackground: syncInBackgroundMock,
    } as never
  )

  return {
    setState,
    slice,
    state,
    syncInBackgroundMock,
  }
}

describe("project slice", () => {
  beforeEach(() => {
    syncCreateProjectMock.mockReset()
    syncRenameProjectMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
  })

  it("rejects workspace-scoped project creation", async () => {
    const { createProjectSlice } = await import(
      "@/lib/store/app-store-internal/slices/projects"
    )

    const { slice, state, syncInBackgroundMock } = createProjectSliceHarness(
      createProjectSlice,
      "member"
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

    const { slice, state, syncInBackgroundMock } = createProjectSliceHarness(
      createProjectSlice,
      "viewer"
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

    const { slice, state, syncInBackgroundMock } = createProjectSliceHarness(
      createProjectSlice,
      "member"
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

  it("defaults project schedule dates from the local calendar day", async () => {
    await withLosAngelesFakeSystemTime(async () => {
      const { formatLocalCalendarDate, addLocalCalendarDays } = await import(
        "@/lib/calendar-date"
      )
      const { createProjectSlice } = await import(
        "@/lib/store/app-store-internal/slices/projects"
      )

      const { slice, state } = createProjectSliceHarness(
        createProjectSlice,
        "member"
      )

      slice.createProject({
        scopeType: "team",
        scopeId: "team_1",
        templateType: "software-delivery",
        name: "Roadmap refresh",
        summary: "Next release",
        priority: "medium",
      })

      expect(state.projects[0]).toMatchObject({
        startDate: formatLocalCalendarDate(),
        targetDate: addLocalCalendarDays(28),
      })
      expect(syncCreateProjectMock).toHaveBeenCalledWith("user_1", {
        scopeType: "team",
        scopeId: "team_1",
        templateType: "software-delivery",
        name: "Roadmap refresh",
        summary: "Next release",
        priority: "medium",
        startDate: formatLocalCalendarDate(),
        targetDate: addLocalCalendarDays(28),
      })
    })
  })

  it("rejects overly long project rename input before syncing", async () => {
    const { createProjectSlice } = await import(
      "@/lib/store/app-store-internal/slices/projects"
    )

    const { slice, state } = createProjectSliceHarness(
      createProjectSlice,
      "member"
    )
    state.projects = [
      createTestProject({
        id: "project_1",
        templateType: "software-delivery",
        name: "Launch",
        summary: "Launch summary",
        description: "Launch summary",
        memberIds: ["user_1"],
        health: "no-update",
        blockingProjectIds: [],
        blockedByProjectIds: [],
        labelIds: [],
        createdAt: "2026-04-20T10:00:00.000Z",
        updatedAt: "2026-04-20T10:00:00.000Z",
      }),
    ]

    const result = await slice.renameProject("project_1", "x".repeat(65))

    expect(result).toBe(false)
    expect(syncRenameProjectMock).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledWith(
      "Project name must be at most 64 characters"
    )
  })

  it("accepts project-status filters in persisted presentation config", async () => {
    const { createProjectSlice } = await import(
      "@/lib/store/app-store-internal/slices/projects"
    )

    const { slice, state, syncInBackgroundMock } = createProjectSliceHarness(
      createProjectSlice,
      "member"
    )

    slice.createProject({
      scopeType: "team",
      scopeId: "team_1",
      templateType: "software-delivery",
      name: "Roadmap refresh",
      summary: "Next release",
      priority: "medium",
      presentation: {
        itemLevel: null,
        showChildItems: false,
        layout: "list",
        grouping: "status",
        ordering: "priority",
        displayProps: ["id", "status"],
        filters: {
          status: ["planned", "completed"],
          priority: [],
          assigneeIds: [],
          creatorIds: [],
          leadIds: [],
          health: [],
          milestoneIds: [],
          relationTypes: [],
          projectIds: [],
          parentIds: [],
          itemTypes: [],
          labelIds: [],
          teamIds: [],
          showCompleted: true,
        },
      },
    })

    expect(state.projects).toHaveLength(1)
    expect(state.projects[0]?.presentation?.filters.status).toEqual([
      "planned",
      "completed",
    ])
    expect(syncInBackgroundMock).toHaveBeenCalledTimes(1)
    expect(syncCreateProjectMock).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({
        presentation: expect.objectContaining({
          filters: expect.objectContaining({
            status: ["planned", "completed"],
          }),
        }),
      })
    )
  })
})

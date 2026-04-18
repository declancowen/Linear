import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"

const syncCreateViewMock = vi.fn()
const syncUpdateViewConfigMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}))

vi.mock("@/lib/convex/client", () => ({
  syncClearViewFilters: vi.fn(),
  syncCreateView: syncCreateViewMock,
  syncToggleViewDisplayProperty: vi.fn(),
  syncToggleViewFilterValue: vi.fn(),
  syncToggleViewHiddenValue: vi.fn(),
  syncUpdateViewConfig: syncUpdateViewConfigMock,
}))

function createViewTestState() {
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
        role: "member" as const,
      },
    ],
    ui: {
      activeTeamId: "team_1",
      activeInboxNotificationId: null,
      selectedViewByRoute: {},
      activeCreateDialog: null,
    },
  }
}

describe("view slice", () => {
  beforeEach(() => {
    syncCreateViewMock.mockReset()
    syncUpdateViewConfigMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
  })

  it("reuses one canonical id for optimistic and persisted views", async () => {
    const { createViewSlice } = await import(
      "@/lib/store/app-store-internal/slices/views"
    )

    const state = createViewTestState()
    const refreshFromServerMock = vi.fn().mockResolvedValue(undefined)
    let backgroundTask: Promise<unknown> | null = null
    const setState = vi.fn((update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      Object.assign(state, patch)
    })

    syncCreateViewMock.mockImplementation(async (_currentUserId, input) => ({
      ok: true,
      viewId: input.id ?? null,
    }))

    const slice = createViewSlice(
      setState as never,
      () => state as never,
      {
        refreshFromServer: refreshFromServerMock,
        syncInBackground(task: Promise<unknown> | null) {
          backgroundTask = task
        },
      } as never
    )

    const createdViewId = slice.createView({
      scopeType: "team",
      scopeId: "team_1",
      entityKind: "items",
      route: "/team/platform/work",
      name: "Delivery view",
      description: "Tracks delivery work",
      layout: "board",
    })

    expect(createdViewId).toBe(state.views[0]?.id)
    expect(syncCreateViewMock).toHaveBeenCalledWith("user_1", {
      id: createdViewId,
      scopeType: "team",
      scopeId: "team_1",
      entityKind: "items",
      route: "/team/platform/work",
      name: "Delivery view",
      description: "Tracks delivery work",
      layout: "board",
    })

    await backgroundTask

    expect(refreshFromServerMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).toHaveBeenCalledWith("View created")
  })

  it("reconciles from the server if the persisted view id differs", async () => {
    const { createViewSlice } = await import(
      "@/lib/store/app-store-internal/slices/views"
    )

    const state = createViewTestState()
    const refreshFromServerMock = vi.fn().mockResolvedValue(undefined)
    let backgroundTask: Promise<unknown> | null = null
    const setState = vi.fn((update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      Object.assign(state, patch)
    })

    syncCreateViewMock.mockResolvedValue({
      ok: true,
      viewId: "view_server_1",
    })

    const slice = createViewSlice(
      setState as never,
      () => state as never,
      {
        refreshFromServer: refreshFromServerMock,
        syncInBackground(task: Promise<unknown> | null) {
          backgroundTask = task
        },
      } as never
    )

    const createdViewId = slice.createView({
      scopeType: "team",
      scopeId: "team_1",
      entityKind: "items",
      route: "/team/platform/work",
      name: "Delivery view",
      description: "Tracks delivery work",
    })

    expect(createdViewId).toBeTruthy()

    await backgroundTask

    expect(refreshFromServerMock).toHaveBeenCalledTimes(1)
  })

  it("rolls back the optimistic view when server creation fails", async () => {
    const { createViewSlice } = await import(
      "@/lib/store/app-store-internal/slices/views"
    )

    const state = createViewTestState()
    state.ui.selectedViewByRoute = {
      "/team/platform/work": "view_existing",
    }
    let backgroundTask: Promise<unknown> | null = null
    const setState = vi.fn((update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      Object.assign(state, patch)
    })

    syncCreateViewMock.mockRejectedValue(new Error("server rejected"))

    const slice = createViewSlice(
      setState as never,
      () => state as never,
      {
        refreshFromServer: vi.fn(),
        syncInBackground(task: Promise<unknown> | null) {
          backgroundTask = task?.catch(() => undefined) ?? null
        },
      } as never
    )

    const createdViewId = slice.createView({
      scopeType: "team",
      scopeId: "team_1",
      entityKind: "items",
      route: "/team/platform/work",
      name: "Delivery view",
      description: "Tracks delivery work",
    })

    expect(createdViewId).toBeTruthy()
    expect(state.views.map((view) => view.id)).toContain(createdViewId)
    expect(state.ui.selectedViewByRoute["/team/platform/work"]).toBe(createdViewId)

    await backgroundTask

    expect(state.views.map((view) => view.id)).not.toContain(createdViewId)
    expect(state.ui.selectedViewByRoute["/team/platform/work"]).toBe(
      "view_existing"
    )
  })

  it("keeps showCompleted inside filters when updating view config", async () => {
    const { createViewSlice } = await import(
      "@/lib/store/app-store-internal/slices/views"
    )

    const state = createViewTestState()
    state.views = [
      {
        id: "view_1",
        name: "Delivery view",
        description: "",
        scopeType: "team",
        scopeId: "team_1",
        entityKind: "items",
        itemLevel: "epic",
        showChildItems: true,
        layout: "board",
        filters: {
          status: [],
          priority: [],
          assigneeIds: [],
          creatorIds: [],
          leadIds: [],
          health: [],
          milestoneIds: [],
          relationTypes: [],
          projectIds: [],
          itemTypes: [],
          labelIds: [],
          teamIds: [],
          showCompleted: true,
        },
        grouping: "status",
        subGrouping: null,
        ordering: "priority",
        displayProps: ["id", "status"],
        hiddenState: {
          groups: [],
          subgroups: [],
        },
        isShared: true,
        route: "/team/platform/work",
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
      },
    ]
    const syncInBackgroundMock = vi.fn()
    const setState = vi.fn((update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      Object.assign(state, patch)
    })

    const slice = createViewSlice(
      setState as never,
      () => state as never,
      {
        refreshFromServer: vi.fn(),
        syncInBackground: syncInBackgroundMock,
      } as never
    )

    slice.updateViewConfig("view_1", {
      layout: "list",
      showCompleted: false,
    })

    expect(state.views[0]).not.toHaveProperty("showCompleted")
    expect(state.views[0]?.layout).toBe("list")
    expect(state.views[0]?.filters.showCompleted).toBe(false)
    expect(syncUpdateViewConfigMock).toHaveBeenCalledWith("view_1", {
      layout: "list",
      showCompleted: false,
    })
    expect(syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })
})

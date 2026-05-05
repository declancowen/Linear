import { beforeEach, describe, expect, it, vi } from "vitest"

import { createDefaultViewFilters, type AppData } from "@/lib/domain/types"
import { getViewerScopedDirectoryKey } from "@/lib/domain/viewer-view-config"
import { type AppStore } from "@/lib/store/app-store-internal/types"
import {
  createTestAppData,
  createTestTeamMembership,
  createTestViewDefinition,
} from "@/tests/lib/fixtures/app-data"
import { createToastMockModule } from "@/tests/lib/fixtures/store"

const syncCreateViewMock = vi.fn()
const syncReorderViewDisplayPropertiesMock = vi.fn()
const syncRenameViewMock = vi.fn()
const syncUpdateViewConfigMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock("@/lib/convex/client", () => ({
  syncClearViewFilters: vi.fn(),
  syncCreateView: syncCreateViewMock,
  syncReorderViewDisplayProperties: syncReorderViewDisplayPropertiesMock,
  syncRenameView: syncRenameViewMock,
  syncToggleViewDisplayProperty: vi.fn(),
  syncToggleViewFilterValue: vi.fn(),
  syncToggleViewHiddenValue: vi.fn(),
  syncUpdateViewConfig: syncUpdateViewConfigMock,
}))

vi.mock("sonner", () =>
  createToastMockModule({ error: toastErrorMock, success: toastSuccessMock })
)

function createViewTestState(): AppData {
  return createTestAppData({
    teamMemberships: [createTestTeamMembership({ role: "member" })],
  })
}

type CreateViewInput = Parameters<AppStore["createView"]>[0]
type BackgroundSync = (
  task: Promise<unknown> | null
) => Promise<unknown> | null | void
type MockFunction = ReturnType<typeof vi.fn>
type PendingViewConfigState = AppData & {
  pendingViewConfigById: Record<
    string,
    {
      token: string
      patch: {
        layout?: "list" | "board" | "timeline"
      }
    }
  >
}

function mockCreateViewSuccessWithInputId() {
  syncCreateViewMock.mockImplementation(async (_currentUserId, input) => ({
    ok: true,
    viewId: input.id ?? null,
  }))
}

function createDeliveryViewInput(
  overrides: Partial<CreateViewInput> = {}
): CreateViewInput {
  return {
    scopeType: "team",
    scopeId: "team_1",
    entityKind: "items",
    route: "/team/platform/work",
    name: "Delivery view",
    description: "Tracks delivery work",
    ...overrides,
  } as CreateViewInput
}

function seedSelectedView(state: AppData) {
  const selectedViewKey = getViewerScopedDirectoryKey(
    state.currentUserId,
    "/team/platform/work"
  )

  state.ui.selectedViewByRoute = {
    [selectedViewKey]: "view_existing",
  }

  return selectedViewKey
}

function seedSharedView(
  state: AppData,
  overrides: Parameters<typeof createTestViewDefinition>[0] = {}
) {
  state.views = [
    createTestViewDefinition({
      itemLevel: null,
      showChildItems: false,
      ordering: "priority",
      filters: createDefaultViewFilters(),
      displayProps: ["id", "status"],
      isShared: true,
      ...overrides,
    }),
  ]
}

function createPendingViewConfigState(): PendingViewConfigState {
  const state = createViewTestState() as PendingViewConfigState
  state.pendingViewConfigById = {}
  seedSharedView(state)

  return state
}

async function createViewSliceHarness(
  options: {
    handleSyncFailure?: MockFunction
    refreshFromServer?: MockFunction
    state?: AppData
    syncInBackground?: BackgroundSync
  } = {}
) {
  const { createViewSlice } =
    await import("@/lib/store/app-store-internal/slices/views")
  const state = options.state ?? createViewTestState()
  const refreshFromServerMock = options.refreshFromServer ?? vi.fn()
  let backgroundTask: Promise<unknown> | null = null
  const setState = vi.fn((update: unknown) => {
    const patch =
      typeof update === "function" ? update(state as never) : update

    Object.assign(state, patch)
  })
  const runtime = {
    refreshFromServer: refreshFromServerMock,
    syncInBackground(task: Promise<unknown> | null) {
      backgroundTask = options.syncInBackground?.(task) ?? task
    },
  }

  if (options.handleSyncFailure) {
    Object.assign(runtime, {
      handleSyncFailure: options.handleSyncFailure,
    })
  }

  return {
    get backgroundTask() {
      return backgroundTask
    },
    refreshFromServerMock,
    setState,
    slice: createViewSlice(
      setState as never,
      () => state as never,
      runtime as never
    ),
    state,
  }
}

async function updateTimelineConfigWithPendingState(
  state: PendingViewConfigState
) {
  const harness = await createViewSliceHarness({ state })

  harness.slice.updateViewConfig("view_1", {
    layout: "timeline",
  })

  expect(state.pendingViewConfigById.view_1?.patch.layout).toBe("timeline")

  return harness
}

describe("view slice", () => {
  beforeEach(() => {
    syncCreateViewMock.mockReset()
    syncReorderViewDisplayPropertiesMock.mockReset()
    syncRenameViewMock.mockReset()
    syncUpdateViewConfigMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
  })

  it("reuses one canonical id for optimistic and persisted views", async () => {
    const refreshFromServerMock = vi.fn().mockResolvedValue(undefined)
    mockCreateViewSuccessWithInputId()
    const harness = await createViewSliceHarness({
      refreshFromServer: refreshFromServerMock,
    })

    const createdViewId = harness.slice.createView({
      ...createDeliveryViewInput(),
      layout: "board",
    })

    expect(createdViewId).toBe(harness.state.views[0]?.id)
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

    await harness.backgroundTask

    expect(refreshFromServerMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).toHaveBeenCalledWith("View created")
  })

  it("derives the default item level from the team experience for optimistic item views", async () => {
    mockCreateViewSuccessWithInputId()
    const harness = await createViewSliceHarness()
    const createdViewId = harness.slice.createView(createDeliveryViewInput())

    expect(createdViewId).toBeTruthy()
    expect(harness.state.views[0]).toMatchObject({
      id: createdViewId,
      itemLevel: "epic",
      showChildItems: true,
    })

    await harness.backgroundTask
  })

  it("preserves container metadata on the optimistic view", async () => {
    mockCreateViewSuccessWithInputId()
    const harness = await createViewSliceHarness()
    const createdViewId = harness.slice.createView({
      ...createDeliveryViewInput(),
      containerType: "project-items",
      containerId: "project_1",
      route: "/team/platform/projects/project_1",
      name: "Billing queue",
      description: "Tracks the billing project",
    })

    expect(createdViewId).toBeTruthy()
    expect(harness.state.views[0]).toMatchObject({
      id: createdViewId,
      containerType: "project-items",
      containerId: "project_1",
      route: "/team/platform/projects/project_1",
    })

    await harness.backgroundTask
  })

  it("reconciles from the server if the persisted view id differs", async () => {
    const refreshFromServerMock = vi.fn().mockResolvedValue(undefined)
    syncCreateViewMock.mockResolvedValue({
      ok: true,
      viewId: "view_server_1",
    })
    const harness = await createViewSliceHarness({
      refreshFromServer: refreshFromServerMock,
    })

    const createdViewId = harness.slice.createView(createDeliveryViewInput())

    expect(createdViewId).toBeTruthy()

    await harness.backgroundTask

    expect(refreshFromServerMock).toHaveBeenCalledTimes(1)
  })

  it("accepts project-only status filters when creating project views", async () => {
    mockCreateViewSuccessWithInputId()
    const harness = await createViewSliceHarness()

    const createdViewId = harness.slice.createView({
      ...createDeliveryViewInput({
        entityKind: "projects",
        route: "/team/platform/projects",
        name: "Planned projects",
        description: "Tracks planned work",
      }),
      filters: {
        ...createDefaultViewFilters(),
        status: ["planned", "completed"],
      },
    })

    expect(createdViewId).toBeTruthy()
    expect(harness.state.views[0]?.filters.status).toEqual([
      "planned",
      "completed",
    ])
    expect(syncCreateViewMock).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({
        entityKind: "projects",
        filters: expect.objectContaining({
          status: ["planned", "completed"],
        }),
      })
    )

    await harness.backgroundTask
  })

  it("does not roll back the optimistic view when refresh fails after a successful create", async () => {
    const state = createViewTestState()
    const selectedViewKey = seedSelectedView(state)
    const refreshFromServerMock = vi
      .fn()
      .mockRejectedValue(new Error("refresh failed"))
    const handleSyncFailureMock = vi.fn().mockResolvedValue(undefined)
    syncCreateViewMock.mockResolvedValue({
      ok: true,
      viewId: "view_server_1",
    })
    const harness = await createViewSliceHarness({
      state,
      refreshFromServer: refreshFromServerMock,
      handleSyncFailure: handleSyncFailureMock,
    })

    const createdViewId = harness.slice.createView(createDeliveryViewInput())

    expect(createdViewId).toBeTruthy()

    await harness.backgroundTask

    expect(refreshFromServerMock).toHaveBeenCalledTimes(1)
    expect(handleSyncFailureMock).toHaveBeenCalledWith(
      expect.any(Error),
      "View created, but failed to refresh from server"
    )
    expect(state.views.map((view) => view.id)).toContain(createdViewId)
    expect(state.ui.selectedViewByRoute[selectedViewKey]).toBe(createdViewId)
  })

  it("rolls back the optimistic view when server creation fails", async () => {
    const state = createViewTestState()
    const selectedViewKey = seedSelectedView(state)
    syncCreateViewMock.mockRejectedValue(new Error("server rejected"))
    const harness = await createViewSliceHarness({
      state,
      syncInBackground(task: Promise<unknown> | null) {
        return task?.catch(() => undefined) ?? null
      },
    })

    const createdViewId = harness.slice.createView(createDeliveryViewInput())

    expect(createdViewId).toBeTruthy()
    expect(state.views.map((view) => view.id)).toContain(createdViewId)
    expect(state.ui.selectedViewByRoute[selectedViewKey]).toBe(createdViewId)

    await harness.backgroundTask

    expect(state.views.map((view) => view.id)).not.toContain(createdViewId)
    expect(state.ui.selectedViewByRoute[selectedViewKey]).toBe("view_existing")
  })

  it("keeps showCompleted inside filters when updating view config", async () => {
    const state = createViewTestState()
    seedSharedView(state, {
      itemLevel: "epic",
      layout: "board",
    })
    const syncInBackgroundMock = vi.fn()
    const harness = await createViewSliceHarness({
      state,
      syncInBackground: syncInBackgroundMock,
    })

    harness.slice.updateViewConfig("view_1", {
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

  it("clears a pending optimistic view config when the sync fails", async () => {
    const state = createPendingViewConfigState()
    syncUpdateViewConfigMock.mockRejectedValueOnce(new Error("sync failed"))
    const harness = await updateTimelineConfigWithPendingState(state)

    await expect(harness.backgroundTask).rejects.toThrow("sync failed")
    expect(state.pendingViewConfigById).toEqual({})
  })

  it("clears a pending optimistic view config when the sync succeeds", async () => {
    const state = createPendingViewConfigState()
    syncUpdateViewConfigMock.mockResolvedValueOnce({ ok: true })
    const harness = await updateTimelineConfigWithPendingState(state)

    await expect(harness.backgroundTask).resolves.toBeUndefined()
    expect(state.pendingViewConfigById).toEqual({})
  })

  it("renames editable custom views and reports validation or sync failures", async () => {
    const state = createViewTestState()
    seedSharedView(state, {
      name: "Old name",
    })
    syncRenameViewMock.mockResolvedValueOnce({ ok: true })
    const harness = await createViewSliceHarness({ state })

    await expect(harness.slice.renameView("view_1", " New name ")).resolves.toBe(
      true
    )
    expect(syncRenameViewMock).toHaveBeenCalledWith("view_1", "New name")
    expect(state.views[0]?.name).toBe("New name")
    expect(toastSuccessMock).toHaveBeenCalledWith("View renamed")

    await expect(harness.slice.renameView("view_1", "x")).resolves.toBe(false)
    expect(toastErrorMock).toHaveBeenCalledWith(
      "View name must be at least 2 characters"
    )

    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    syncRenameViewMock.mockRejectedValueOnce(new Error("server rejected"))
    await expect(harness.slice.renameView("view_1", "Again")).resolves.toBe(
      false
    )
    expect(toastErrorMock).toHaveBeenCalledWith("server rejected")
    consoleSpy.mockRestore()
  })

  it("reorders visible display properties optimistically", async () => {
    const state = createViewTestState()
    seedSharedView(state, {
      displayProps: ["status", "assignee", "progress"],
    })
    const syncInBackgroundMock = vi.fn()
    const harness = await createViewSliceHarness({
      state,
      syncInBackground: syncInBackgroundMock,
    })

    harness.slice.reorderViewDisplayProperties("view_1", [
      "progress",
      "status",
      "assignee",
    ])

    expect(state.views[0]?.displayProps).toEqual([
      "progress",
      "status",
      "assignee",
    ])
    expect(syncReorderViewDisplayPropertiesMock).toHaveBeenCalledWith(
      "view_1",
      ["progress", "status", "assignee"]
    )
    expect(syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })
})

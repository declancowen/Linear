import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"

const syncCreateViewMock = vi.fn()
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
  syncUpdateViewConfig: vi.fn(),
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
})

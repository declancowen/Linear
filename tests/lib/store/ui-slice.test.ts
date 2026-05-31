import { describe, expect, it } from "vitest"

import { getViewerScopedViewKey } from "@/lib/domain/viewer-view-config"
import { createUiSlice } from "@/lib/store/app-store-internal/slices/ui"
import {
  createTestAppData,
  createTestViewDefinition,
} from "@/tests/lib/fixtures/app-data"
import { createMutableSetState } from "@/tests/lib/fixtures/store"

function createUiSliceHarness() {
  const state = createTestAppData({
    views: [
      createTestViewDefinition({
        id: "view_1",
        route: "/team/platform/work",
        displayProps: ["id", "status"],
        hiddenState: {
          groups: ["todo"],
          subgroups: [],
        },
      }),
    ],
  })
  const setState = createMutableSetState(state)
  const slice = createUiSlice(setState as never)
  const storageKey = getViewerScopedViewKey(
    state.currentUserId,
    "/team/platform/work",
    "view_1"
  )

  return {
    slice,
    state,
    storageKey,
  }
}

describe("ui slice", () => {
  it("toggles viewer display properties and hidden group values from the base view", () => {
    const { slice, state, storageKey } = createUiSliceHarness()

    slice.toggleViewerViewDisplayProperty(
      "/team/platform/work",
      "view_1",
      "priority"
    )
    expect(state.ui.viewerViewConfigByRoute[storageKey]?.displayProps).toEqual([
      "id",
      "status",
      "priority",
    ])

    slice.toggleViewerViewDisplayProperty("/team/platform/work", "view_1", "id")
    expect(state.ui.viewerViewConfigByRoute[storageKey]?.displayProps).toEqual([
      "status",
      "priority",
    ])

    slice.toggleViewerViewHiddenValue(
      "/team/platform/work",
      "view_1",
      "groups",
      "todo"
    )
    expect(state.ui.viewerViewConfigByRoute[storageKey]?.hiddenState).toEqual({
      groups: [],
      subgroups: [],
    })

    slice.toggleViewerViewHiddenValue(
      "/team/platform/work",
      "view_1",
      "subgroups",
      "blocked"
    )
    expect(state.ui.viewerViewConfigByRoute[storageKey]?.hiddenState).toEqual({
      groups: [],
      subgroups: ["blocked"],
    })
  })

  it("resets viewer view overrides back to the base view", () => {
    const { slice, state, storageKey } = createUiSliceHarness()

    slice.toggleViewerViewDisplayProperty(
      "/team/platform/work",
      "view_1",
      "priority"
    )
    expect(state.ui.viewerViewConfigByRoute[storageKey]).toBeDefined()

    slice.resetViewerViewConfig("/team/platform/work", "view_1")

    expect(state.ui.viewerViewConfigByRoute[storageKey]).toBeUndefined()
  })

  it("preserves a local read notification while stale read models arrive", () => {
    const { slice, state } = createUiSliceHarness()
    const readAt = "2026-04-20T10:00:00.000Z"
    const notification = {
      id: "notification_1",
      userId: "user_1",
      type: "comment" as const,
      entityType: "workItem" as const,
      entityId: "item_1",
      actorId: "user_2",
      message: "Blake commented on Task",
      readAt,
      archivedAt: null,
      emailedAt: null,
      createdAt: "2026-04-20T09:00:00.000Z",
    }

    state.notifications = [notification]

    slice.mergeReadModelData({
      notifications: [
        {
          ...notification,
          readAt: null,
        },
      ],
    })

    expect(state.notifications[0]?.readAt).toBe(readAt)

    slice.replaceDomainData({
      notifications: [
        {
          ...notification,
          readAt: null,
        },
      ],
    } as never)

    expect(state.notifications[0]?.readAt).toBe(readAt)
  })
})

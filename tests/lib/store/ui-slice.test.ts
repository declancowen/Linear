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

    slice.toggleViewerViewDisplayProperty(
      "/team/platform/work",
      "view_1",
      "id"
    )
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
})

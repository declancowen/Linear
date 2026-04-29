import { afterEach, describe, expect, it } from "vitest"

import {
  createDefaultViewFilters,
  type ViewDefinition,
} from "@/lib/domain/types"
import { createEmptyState } from "@/lib/domain/empty-state"
import { getViewByRoute } from "@/lib/domain/selectors"
import {
  getViewerScopedDirectoryKey,
  getViewerScopedViewKey,
} from "@/lib/domain/viewer-view-config"
import { migratePersistedAppStore, useAppStore } from "@/lib/store/app-store"

function createView(overrides?: Partial<ViewDefinition>): ViewDefinition {
  return {
    id: "view_1",
    name: "Delivery",
    description: "",
    scopeType: "team",
    scopeId: "team_1",
    entityKind: "items",
    itemLevel: null,
    showChildItems: false,
    layout: "board",
    filters: createDefaultViewFilters(),
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
    ...overrides,
  }
}

describe("viewer-local view config", () => {
  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  it("stores selected views under the current user and route", () => {
    const route = "/team/platform/work"

    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      views: [createView()],
    })

    useAppStore.getState().setSelectedView(route, "view_1")

    expect(useAppStore.getState().ui.selectedViewByRoute).toEqual({
      [getViewerScopedDirectoryKey("user_1", route)]: "view_1",
    })

    useAppStore.setState({ currentUserId: "user_2" })

    expect(getViewByRoute(useAppStore.getState(), route)).toBeNull()

    useAppStore.getState().setSelectedView(route, "view_2")

    expect(useAppStore.getState().ui.selectedViewByRoute).toEqual({
      [getViewerScopedDirectoryKey("user_1", route)]: "view_1",
      [getViewerScopedDirectoryKey("user_2", route)]: "view_2",
    })
  })

  it("preserves legacy unscoped selected view keys as a fallback", () => {
    const route = "/team/platform/work"
    const view = createView()

    expect(
      migratePersistedAppStore({
        ui: {
          selectedViewByRoute: {
            [route]: view.id,
          },
        },
      }).ui?.selectedViewByRoute
    ).toEqual({
      [route]: view.id,
    })

    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      views: [view],
      ui: {
        ...createEmptyState().ui,
        selectedViewByRoute: {
          [route]: view.id,
        },
      },
    })

    expect(getViewByRoute(useAppStore.getState(), route)).toEqual(view)

    useAppStore.getState().setSelectedView(route, "view_2")

    expect(useAppStore.getState().ui.selectedViewByRoute).toEqual({
      [getViewerScopedDirectoryKey("user_1", route)]: "view_2",
    })
  })

  it("stores viewer overrides without mutating the shared view definition", () => {
    const route = "/team/platform/work"
    const view = createView({
      filters: {
        ...createDefaultViewFilters(),
        status: ["todo"],
      },
    })

    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      views: [view],
    })

    useAppStore.getState().patchViewerViewConfig(route, view.id, {
      layout: "list",
    })
    useAppStore
      .getState()
      .toggleViewerViewFilterValue(route, view.id, "status", "todo")

    const overrideKey = getViewerScopedViewKey("user_1", route, view.id)

    expect(useAppStore.getState().views[0]).toMatchObject({
      id: view.id,
      layout: "board",
      filters: expect.objectContaining({
        status: ["todo"],
      }),
    })
    expect(
      useAppStore.getState().ui.viewerViewConfigByRoute[overrideKey]
    ).toMatchObject({
      layout: "list",
      filters: {
        status: [],
      },
    })
  })

  it("keeps filter patches when showCompleted is patched with them", () => {
    const route = "/team/platform/work"
    const view = createView()
    const patch: {
      filters: Partial<ViewDefinition["filters"]>
      showCompleted: boolean
    } = {
      filters: {
        status: ["todo"],
      },
      showCompleted: false,
    }

    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      views: [view],
    })

    useAppStore.getState().patchViewerViewConfig(route, view.id, patch)

    const overrideKey = getViewerScopedViewKey("user_1", route, view.id)

    expect(
      useAppStore.getState().ui.viewerViewConfigByRoute[overrideKey]?.filters
    ).toEqual({
      status: ["todo"],
      showCompleted: false,
    })
  })

  it("does not persist undefined viewer directory filters for non-filter patches", () => {
    const surfaceKey = "views-directory:workspace:workspace_1"

    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
    })

    useAppStore
      .getState()
      .patchViewerDirectoryConfig(surfaceKey, { layout: "board" })

    const overrideKey = getViewerScopedDirectoryKey("user_1", surfaceKey)

    expect(
      useAppStore.getState().ui.viewerDirectoryConfigByRoute[overrideKey]
    ).toEqual({
      layout: "board",
    })
  })

  it("merges viewer directory filter patches with the current persisted filters", () => {
    const surfaceKey = "views-directory:workspace:workspace_1"

    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
    })

    useAppStore.getState().patchViewerDirectoryConfig(surfaceKey, {
      filters: {
        entityKinds: ["items"],
      },
    })
    useAppStore.getState().patchViewerDirectoryConfig(surfaceKey, {
      filters: {
        scopes: ["workspace"],
      },
    })

    const overrideKey = getViewerScopedDirectoryKey("user_1", surfaceKey)

    expect(
      useAppStore.getState().ui.viewerDirectoryConfigByRoute[overrideKey]
        ?.filters
    ).toEqual({
      entityKinds: ["items"],
      scopes: ["workspace"],
    })
  })
})

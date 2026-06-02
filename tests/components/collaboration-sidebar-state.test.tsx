import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  createCollaborationSidebarSurfaceKey,
  usePersistedCollaborationSidebarState,
} from "@/components/app/collaboration-screens/sidebar-state"
import { createEmptyState } from "@/lib/domain/empty-state"
import { getViewerScopedDirectoryKey } from "@/lib/domain/viewer-view-config"
import { useAppStore } from "@/lib/store/app-store"

describe("collaboration sidebar persisted state", () => {
  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  it("defaults open and persists desktop sidebar state for the viewer surface", () => {
    const surfaceKey = createCollaborationSidebarSurfaceKey(
      "workspace-chat",
      "conversation_1"
    )

    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
    })

    const { result } = renderHook(() =>
      usePersistedCollaborationSidebarState(surfaceKey)
    )

    expect(result.current.sidebarOpen).toBe(true)

    act(() => {
      result.current.setSidebarOpen(false)
    })

    expect(result.current.sidebarOpen).toBe(false)
    expect(useAppStore.getState().ui.collaborationSidebarOpenBySurface).toEqual(
      {
        [getViewerScopedDirectoryKey("user_1", surfaceKey as string)]: false,
      }
    )
  })

  it("does not persist desktop sidebar state before a surface key exists", () => {
    const { result } = renderHook(() =>
      usePersistedCollaborationSidebarState(null)
    )

    expect(result.current.sidebarOpen).toBe(true)

    act(() => {
      result.current.setSidebarOpen(false)
    })

    expect(
      useAppStore.getState().ui.collaborationSidebarOpenBySurface
    ).toEqual({})
  })
})

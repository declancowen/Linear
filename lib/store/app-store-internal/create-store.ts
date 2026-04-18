"use client"

import type { StateCreator } from "zustand"

import { createStoreRuntime } from "./runtime"
import { createCollaborationSlice } from "./slices/collaboration"
import { createNotificationSlice } from "./slices/notifications"
import { createProjectSlice } from "./slices/projects"
import { createUiSlice } from "./slices/ui"
import { createViewSlice } from "./slices/views"
import { createWorkSlice } from "./slices/work"
import { createWorkspaceSlice } from "./slices/workspace"
import type { AppStore } from "./types"

export const createAppStore: StateCreator<AppStore, [], [], AppStore> = (
  set,
  get
) => {
  const runtime = createStoreRuntime(get)

  return {
    ...createUiSlice(set),
    ...createNotificationSlice(set, get, runtime),
    ...createWorkspaceSlice(set, get, runtime),
    ...createViewSlice(set, get, runtime),
    ...createWorkSlice(set, get, runtime),
    ...createCollaborationSlice(set, get, runtime),
    ...createProjectSlice(set, get, runtime),
  }
}

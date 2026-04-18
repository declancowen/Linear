"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { createAppStore } from "./app-store-internal/create-store"
import { noopStorage } from "./app-store-internal/helpers"
import type { AppStore } from "./app-store-internal/types"

export type { AppStore } from "./app-store-internal/types"

export const useAppStore = create<AppStore>()(
  persist(createAppStore, {
    name: "linear-multi-work-store",
    storage: createJSONStorage(() =>
      typeof window === "undefined" ? noopStorage : localStorage
    ),
    version: 3,
    partialize: (state) => ({
      ui: {
        activeTeamId: state.ui.activeTeamId,
        activeInboxNotificationId: state.ui.activeInboxNotificationId,
        selectedViewByRoute: state.ui.selectedViewByRoute,
      },
    }),
    merge: (persistedState, currentState) => ({
      ...currentState,
      ui: {
        ...currentState.ui,
        ...((persistedState as Partial<AppStore> | undefined)?.ui ?? {}),
      },
    }),
  })
)

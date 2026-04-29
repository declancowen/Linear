"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { createAppStore } from "./app-store-internal/create-store"
import { noopStorage } from "./app-store-internal/helpers"
import type { AppStore } from "./app-store-internal/types"

export type { AppStore } from "./app-store-internal/types"

type PersistedAppStore = Omit<Partial<AppStore>, "ui"> & {
  ui?: Partial<AppStore["ui"]>
}

export function migratePersistedAppStore(
  persistedState: unknown
): PersistedAppStore {
  const state = (persistedState ?? {}) as PersistedAppStore
  const selectedViewByRoute = state.ui?.selectedViewByRoute ?? {}

  return {
    ...state,
    ui: {
      ...state.ui,
      selectedViewByRoute: Object.fromEntries(
        Object.entries(selectedViewByRoute).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      ),
      viewerViewConfigByRoute: state.ui?.viewerViewConfigByRoute ?? {},
      viewerDirectoryConfigByRoute:
        state.ui?.viewerDirectoryConfigByRoute ?? {},
    },
  }
}

export const useAppStore = create<AppStore>()(
  persist(createAppStore, {
    name: "linear-multi-work-store",
    storage: createJSONStorage(() =>
      typeof window === "undefined" ? noopStorage : localStorage
    ),
    version: 4,
    migrate: (persistedState) => migratePersistedAppStore(persistedState),
    partialize: (state) => ({
      ui: {
        activeTeamId: state.ui.activeTeamId,
        activeInboxNotificationId: state.ui.activeInboxNotificationId,
        selectedViewByRoute: state.ui.selectedViewByRoute,
        viewerViewConfigByRoute: state.ui.viewerViewConfigByRoute,
        viewerDirectoryConfigByRoute: state.ui.viewerDirectoryConfigByRoute,
      },
    }),
    merge: (persistedState, currentState) => {
      const persistedUi = (persistedState as PersistedAppStore | undefined)?.ui

      return {
        ...currentState,
        ui: {
          ...currentState.ui,
          ...(persistedUi ?? {}),
          selectedViewByRoute: persistedUi?.selectedViewByRoute ?? {},
          viewerViewConfigByRoute: persistedUi?.viewerViewConfigByRoute ?? {},
          viewerDirectoryConfigByRoute:
            persistedUi?.viewerDirectoryConfigByRoute ?? {},
        },
      }
    },
  })
)

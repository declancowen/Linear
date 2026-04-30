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

type PersistedUiSlice = Pick<
  AppStore["ui"],
  | "selectedViewByRoute"
  | "viewerViewConfigByRoute"
  | "viewerDirectoryConfigByRoute"
> &
  Partial<Pick<AppStore["ui"], "activeTeamId" | "activeInboxNotificationId">>

type ViewerViewConfigEntry = AppStore["ui"]["viewerViewConfigByRoute"][string]
type ViewerDirectoryConfigEntry =
  AppStore["ui"]["viewerDirectoryConfigByRoute"][string]

export const MAX_PERSISTED_SELECTED_VIEW_ROUTES = 500
export const MAX_PERSISTED_VIEWER_VIEW_CONFIGS = 1000
export const MAX_PERSISTED_VIEWER_DIRECTORY_CONFIGS = 500

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function limitRecordEntries<T>(
  record: Record<string, T>,
  maxEntries: number
): Record<string, T> {
  const entries = Object.entries(record)

  if (entries.length <= maxEntries) {
    return record
  }

  return Object.fromEntries(entries.slice(entries.length - maxEntries))
}

function compactStringRecord(
  value: unknown,
  maxEntries: number
): Record<string, string> {
  if (!isRecord(value)) {
    return {}
  }

  return limitRecordEntries(
    Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    ),
    maxEntries
  )
}

function compactObjectRecord<T extends object>(
  value: unknown,
  maxEntries: number
): Record<string, T> {
  if (!isRecord(value)) {
    return {}
  }

  return limitRecordEntries(
    Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, T] =>
        isRecord(entry[1])
      )
    ),
    maxEntries
  )
}

function compactPersistedUi(
  ui: Partial<AppStore["ui"]> | undefined
): PersistedUiSlice {
  const compacted: PersistedUiSlice = {
    selectedViewByRoute: compactStringRecord(
      ui?.selectedViewByRoute,
      MAX_PERSISTED_SELECTED_VIEW_ROUTES
    ),
    viewerViewConfigByRoute: compactObjectRecord<ViewerViewConfigEntry>(
      ui?.viewerViewConfigByRoute,
      MAX_PERSISTED_VIEWER_VIEW_CONFIGS
    ),
    viewerDirectoryConfigByRoute:
      compactObjectRecord<ViewerDirectoryConfigEntry>(
        ui?.viewerDirectoryConfigByRoute,
        MAX_PERSISTED_VIEWER_DIRECTORY_CONFIGS
      ),
  }

  if (typeof ui?.activeTeamId === "string") {
    compacted.activeTeamId = ui.activeTeamId
  }

  if (
    typeof ui?.activeInboxNotificationId === "string" ||
    ui?.activeInboxNotificationId === null
  ) {
    compacted.activeInboxNotificationId = ui.activeInboxNotificationId
  }

  return compacted
}

export function migratePersistedAppStore(
  persistedState: unknown
): PersistedAppStore {
  const state = (persistedState ?? {}) as PersistedAppStore

  return {
    ...state,
    ui: {
      ...state.ui,
      ...compactPersistedUi(state.ui),
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
      ui: compactPersistedUi(state.ui),
    }),
    merge: (persistedState, currentState) => {
      const persistedUi = compactPersistedUi(
        (persistedState as PersistedAppStore | undefined)?.ui
      )

      return {
        ...currentState,
        ui: {
          ...currentState.ui,
          ...persistedUi,
        },
      }
    },
  })
)

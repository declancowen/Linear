"use client"

import {
  syncClearViewFilters,
  syncToggleViewDisplayProperty,
  syncToggleViewFilterValue,
  syncToggleViewHiddenValue,
  syncUpdateViewConfig,
} from "@/lib/convex/client"

import { getNow } from "../helpers"
import { createStoreRuntime } from "../runtime"
import type { AppStore, AppStoreSet } from "../types"

type ViewSlice = Pick<
  AppStore,
  | "updateViewConfig"
  | "toggleViewDisplayProperty"
  | "toggleViewHiddenValue"
  | "toggleViewFilterValue"
  | "clearViewFilters"
>

export function createViewSlice(
  set: AppStoreSet,
  runtime: ReturnType<typeof createStoreRuntime>
): ViewSlice {
  return {
    updateViewConfig(viewId, patch) {
      set((state) => ({
        views: state.views.map((view) =>
          view.id === viewId
            ? {
                ...view,
                ...patch,
                filters:
                  patch.showCompleted === undefined
                    ? view.filters
                    : {
                        ...view.filters,
                        showCompleted: patch.showCompleted,
                      },
                updatedAt: getNow(),
              }
            : view
        ),
      }))

      runtime.syncInBackground(
        syncUpdateViewConfig(viewId, patch),
        "Failed to update view"
      )
    },
    toggleViewDisplayProperty(viewId, property) {
      set((state) => ({
        views: state.views.map((view) => {
          if (view.id !== viewId) {
            return view
          }

          const nextDisplayProps = view.displayProps.includes(property)
            ? view.displayProps.filter((value) => value !== property)
            : [...view.displayProps, property]

          return {
            ...view,
            displayProps: nextDisplayProps,
            updatedAt: getNow(),
          }
        }),
      }))

      runtime.syncInBackground(
        syncToggleViewDisplayProperty(viewId, property),
        "Failed to update view"
      )
    },
    toggleViewHiddenValue(viewId, key, value) {
      set((state) => ({
        views: state.views.map((view) => {
          if (view.id !== viewId) {
            return view
          }

          const values = view.hiddenState[key]
          const nextValues = values.includes(value)
            ? values.filter((entry) => entry !== value)
            : [...values, value]

          return {
            ...view,
            hiddenState: {
              ...view.hiddenState,
              [key]: nextValues,
            },
            updatedAt: getNow(),
          }
        }),
      }))

      runtime.syncInBackground(
        syncToggleViewHiddenValue(viewId, key, value),
        "Failed to update view"
      )
    },
    toggleViewFilterValue(viewId, key, value) {
      set((state) => ({
        views: state.views.map((view) => {
          if (view.id !== viewId) {
            return view
          }

          const current = view.filters[key]
          const next = current.includes(value as never)
            ? current.filter((entry) => entry !== value)
            : [...current, value]

          return {
            ...view,
            filters: {
              ...view.filters,
              [key]: next,
            },
            updatedAt: getNow(),
          }
        }),
      }))

      runtime.syncInBackground(
        syncToggleViewFilterValue(viewId, key, value),
        "Failed to update filters"
      )
    },
    clearViewFilters(viewId) {
      set((state) => ({
        views: state.views.map((view) => {
          if (view.id !== viewId) {
            return view
          }

          return {
            ...view,
            filters: {
              ...view.filters,
              status: [],
              priority: [],
              assigneeIds: [],
              projectIds: [],
              itemTypes: [],
              labelIds: [],
            },
            updatedAt: getNow(),
          }
        }),
      }))

      runtime.syncInBackground(
        syncClearViewFilters(viewId),
        "Failed to update filters"
      )
    },
  }
}

"use client"

import { toast } from "sonner"

import {
  syncClearViewFilters,
  syncCreateView,
  syncDeleteView,
  syncReorderViewDisplayProperties,
  syncRenameView,
  syncToggleViewDisplayProperty,
  syncToggleViewFilterValue,
  syncToggleViewHiddenValue,
  syncUpdateViewConfig,
} from "@/lib/convex/client"
import {
  canEditTeam,
  canEditWorkspace,
  getTeam,
  teamHasFeature,
} from "@/lib/domain/selectors"
import {
  createViewDefinition,
  isRouteAllowedForViewContext,
  isSystemView,
} from "@/lib/domain/default-views"
import {
  viewNameMaxLength,
  viewNameMinLength,
  viewSchema,
} from "@/lib/domain/types"

import { createId, getNow } from "../helpers"
import { createStoreRuntime } from "../runtime"
import type { AppStore, AppStoreGet, AppStoreSet } from "../types"

type ViewSlice = Pick<
  AppStore,
  | "createView"
  | "renameView"
  | "deleteView"
  | "updateViewConfig"
  | "toggleViewDisplayProperty"
  | "reorderViewDisplayProperties"
  | "toggleViewHiddenValue"
  | "toggleViewFilterValue"
  | "clearViewFilters"
>

export function createViewSlice(
  set: AppStoreSet,
  get: AppStoreGet,
  runtime: ReturnType<typeof createStoreRuntime>
): ViewSlice {
  return {
    createView(input) {
      const parsed = viewSchema.safeParse(input)

      if (!parsed.success) {
        toast.error("View input is invalid")
        return null
      }

      const state = get()
      const team =
        parsed.data.scopeType === "team"
          ? getTeam(state, parsed.data.scopeId)
          : null

      if (parsed.data.scopeType === "team") {
        if (!team) {
          toast.error("Team not found")
          return null
        }

        if (!canEditTeam(state, team.id)) {
          toast.error("Your current role is read-only")
          return null
        }

        if (!teamHasFeature(team, "views")) {
          toast.error("Views are disabled for this team")
          return null
        }

        if (
          parsed.data.entityKind === "items" &&
          !teamHasFeature(team, "issues")
        ) {
          toast.error("Work views are disabled for this team")
          return null
        }

        if (
          parsed.data.entityKind === "projects" &&
          !teamHasFeature(team, "projects")
        ) {
          toast.error("Project views are disabled for this team")
          return null
        }

        if (
          parsed.data.entityKind === "docs" &&
          !teamHasFeature(team, "docs")
        ) {
          toast.error("Document views are disabled for this team")
          return null
        }
      } else if (!canEditWorkspace(state, parsed.data.scopeId)) {
        toast.error("Your current role is read-only")
        return null
      }

      if (
        !isRouteAllowedForViewContext({
          scopeType: parsed.data.scopeType,
          entityKind: parsed.data.entityKind,
          route: parsed.data.route,
          teamSlug: team?.slug,
        })
      ) {
        toast.error("This view route is not supported for the selected scope")
        return null
      }

      const viewId = parsed.data.id ?? createId("view")
      const previousSelectedViewId =
        state.ui.selectedViewByRoute[parsed.data.route] ?? null
      const view = createViewDefinition({
        id: viewId,
        name: parsed.data.name,
        description: parsed.data.description,
        scopeType: parsed.data.scopeType,
        scopeId: parsed.data.scopeId,
        entityKind: parsed.data.entityKind,
        containerType: parsed.data.containerType,
        containerId: parsed.data.containerId,
        route: parsed.data.route,
        teamSlug: team?.slug,
        defaultItemLevelExperience: team?.settings.experience,
        createdAt: getNow(),
        overrides: {
          layout: parsed.data.layout,
          filters: parsed.data.filters,
          grouping: parsed.data.grouping,
          subGrouping: parsed.data.subGrouping,
          ordering: parsed.data.ordering,
          itemLevel: parsed.data.itemLevel,
          showChildItems: parsed.data.showChildItems,
          displayProps: parsed.data.displayProps,
          hiddenState: parsed.data.hiddenState,
        },
      })

      if (!view) {
        toast.error("This view target is not supported yet")
        return null
      }

      set((current) => ({
        views: [...current.views, view],
        ui: {
          ...current.ui,
          selectedViewByRoute: {
            ...current.ui.selectedViewByRoute,
            [view.route]: view.id,
          },
        },
      }))

      runtime.syncInBackground(
        syncCreateView(get().currentUserId, {
          ...parsed.data,
          id: viewId,
        })
          .then(async (result) => {
            if (result?.viewId && result.viewId !== viewId) {
              try {
                await runtime.refreshFromServer()
              } catch (error) {
                await runtime.handleSyncFailure(
                  error,
                  "View created, but failed to refresh from server"
                )
              }
            }
          })
          .catch((error) => {
            set((current) => {
              const nextSelectedViewByRoute = {
                ...current.ui.selectedViewByRoute,
              }

              if (nextSelectedViewByRoute[view.route] === viewId) {
                if (previousSelectedViewId) {
                  nextSelectedViewByRoute[view.route] = previousSelectedViewId
                } else {
                  delete nextSelectedViewByRoute[view.route]
                }
              }

              return {
                views: current.views.filter((entry) => entry.id !== viewId),
                ui: {
                  ...current.ui,
                  selectedViewByRoute: nextSelectedViewByRoute,
                },
              }
            })

            throw error
          }),
        "Failed to create view"
      )

      toast.success("View created")
      return view.id
    },
    async renameView(viewId, name) {
      const trimmedName = name.trim()

      if (!trimmedName) {
        toast.error("View name is required")
        return false
      }

      if (trimmedName.length < viewNameMinLength) {
        toast.error(
          `View name must be at least ${viewNameMinLength} characters`
        )
        return false
      }

      if (trimmedName.length > viewNameMaxLength) {
        toast.error(`View name must be at most ${viewNameMaxLength} characters`)
        return false
      }

      const state = get()
      const view = state.views.find((entry) => entry.id === viewId)

      if (!view) {
        toast.error("View not found")
        return false
      }

      if (isSystemView(view)) {
        toast.error("System views cannot be renamed")
        return false
      }

      try {
        await syncRenameView(viewId, trimmedName)
        set((current) => ({
          views: current.views.map((entry) =>
            entry.id === viewId
              ? {
                  ...entry,
                  name: trimmedName,
                  updatedAt: getNow(),
                }
              : entry
          ),
        }))
        toast.success("View renamed")
        return true
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to rename view"
        )
        return false
      }
    },
    async deleteView(viewId) {
      const state = get()
      const view = state.views.find((entry) => entry.id === viewId)

      if (!view) {
        toast.error("View not found")
        return false
      }

      if (isSystemView(view)) {
        toast.error("System views cannot be deleted")
        return false
      }

      try {
        await syncDeleteView(viewId)
        set((current) => ({
          views: current.views.filter((entry) => entry.id !== viewId),
          ui: {
            ...current.ui,
            selectedViewByRoute: Object.fromEntries(
              Object.entries(current.ui.selectedViewByRoute).filter(
                ([, selectedViewId]) => selectedViewId !== viewId
              )
            ),
          },
        }))
        toast.success("View deleted")
        return true
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to delete view"
        )
        return false
      }
    },
    updateViewConfig(viewId, patch) {
      const pendingToken = createId("view_sync")

      const { showCompleted, ...viewPatch } = patch

      set((state) => ({
        views: state.views.map((view) =>
          view.id === viewId
            ? {
                ...view,
                ...viewPatch,
                filters:
                  showCompleted === undefined
                    ? view.filters
                    : {
                        ...view.filters,
                        showCompleted,
                      },
                updatedAt: getNow(),
              }
            : view
        ),
        pendingViewConfigById: {
          ...(state.pendingViewConfigById ?? {}),
          [viewId]: {
            token: pendingToken,
            patch: {
              ...(state.pendingViewConfigById?.[viewId]?.patch ?? {}),
              ...patch,
            },
          },
        },
      }))

      runtime.syncInBackground(
        Promise.resolve(syncUpdateViewConfig(viewId, patch))
          .then(() => {
            set((state) => {
              const pendingConfig = state.pendingViewConfigById?.[viewId]

              if (!pendingConfig || pendingConfig.token !== pendingToken) {
                return state
              }

              const nextPendingViewConfigById = {
                ...(state.pendingViewConfigById ?? {}),
              }
              delete nextPendingViewConfigById[viewId]

              return {
                pendingViewConfigById: nextPendingViewConfigById,
              }
            })
          })
          .catch((error) => {
            set((state) => {
              const pendingConfig = state.pendingViewConfigById?.[viewId]

              if (!pendingConfig || pendingConfig.token !== pendingToken) {
                return state
              }

              const nextPendingViewConfigById = {
                ...(state.pendingViewConfigById ?? {}),
              }
              delete nextPendingViewConfigById[viewId]

              return {
                pendingViewConfigById: nextPendingViewConfigById,
              }
            })

            throw error
          }),
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
    reorderViewDisplayProperties(viewId, displayProps) {
      const nextDisplayProps = Array.from(new Set(displayProps))

      set((state) => ({
        views: state.views.map((view) =>
          view.id === viewId
            ? {
                ...view,
                displayProps: nextDisplayProps,
                updatedAt: getNow(),
              }
            : view
        ),
      }))

      runtime.syncInBackground(
        syncReorderViewDisplayProperties(viewId, nextDisplayProps),
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

          const current = (view.filters[key] ?? []) as string[]
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
              creatorIds: [],
              leadIds: [],
              health: [],
              milestoneIds: [],
              relationTypes: [],
              projectIds: [],
              parentIds: [],
              itemTypes: [],
              labelIds: [],
              teamIds: [],
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

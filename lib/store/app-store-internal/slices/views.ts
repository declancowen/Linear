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
import { getViewerScopedDirectoryKey } from "@/lib/domain/viewer-view-config"

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

type CreateViewInput = Parameters<AppStore["createView"]>[0]
type CreateViewTeam = ReturnType<typeof getTeam>

function resolveCreateViewTeam(
  state: AppStore,
  input: CreateViewInput
): CreateViewTeam | null | undefined {
  if (input.scopeType !== "team") {
    if (!canEditWorkspace(state, input.scopeId)) {
      toast.error("Your current role is read-only")
      return undefined
    }

    return null
  }

  const team = getTeam(state, input.scopeId)

  if (!team) {
    toast.error("Team not found")
    return undefined
  }

  if (!canEditTeam(state, team.id)) {
    toast.error("Your current role is read-only")
    return undefined
  }

  if (!teamHasFeature(team, "views")) {
    toast.error("Views are disabled for this team")
    return undefined
  }

  if (input.entityKind === "items" && !teamHasFeature(team, "issues")) {
    toast.error("Work views are disabled for this team")
    return undefined
  }

  if (input.entityKind === "projects" && !teamHasFeature(team, "projects")) {
    toast.error("Project views are disabled for this team")
    return undefined
  }

  if (input.entityKind === "docs" && !teamHasFeature(team, "docs")) {
    toast.error("Document views are disabled for this team")
    return undefined
  }

  return team
}

function isCreateViewRouteAllowed(
  input: CreateViewInput,
  team: CreateViewTeam
) {
  if (
    isRouteAllowedForViewContext({
      scopeType: input.scopeType,
      entityKind: input.entityKind,
      route: input.route,
      teamSlug: team?.slug,
    })
  ) {
    return true
  }

  toast.error("This view route is not supported for the selected scope")
  return false
}

function getPreviousSelectedViewId(state: AppStore, route: string) {
  const selectedViewKey = getViewerScopedDirectoryKey(
    state.currentUserId,
    route
  )

  return (
    state.ui.selectedViewByRoute[selectedViewKey] ??
    state.ui.selectedViewByRoute[route] ??
    null
  )
}

function buildOptimisticView(input: {
  createdAt: string
  input: CreateViewInput
  team: CreateViewTeam
  viewId: string
}) {
  return createViewDefinition({
    id: input.viewId,
    name: input.input.name,
    description: input.input.description,
    scopeType: input.input.scopeType,
    scopeId: input.input.scopeId,
    entityKind: input.input.entityKind,
    containerType: input.input.containerType,
    containerId: input.input.containerId,
    route: input.input.route,
    teamSlug: input.team?.slug,
    defaultItemLevelExperience: input.team?.settings.experience,
    createdAt: input.createdAt,
    overrides: {
      layout: input.input.layout,
      filters: input.input.filters,
      grouping: input.input.grouping,
      subGrouping: input.input.subGrouping,
      ordering: input.input.ordering,
      itemLevel: input.input.itemLevel,
      showChildItems: input.input.showChildItems,
      displayProps: input.input.displayProps,
      hiddenState: input.input.hiddenState,
    },
  })
}

function selectOptimisticView(
  set: AppStoreSet,
  view: NonNullable<ReturnType<typeof buildOptimisticView>>
) {
  set((current) => ({
    views: [...current.views, view],
    ui: {
      ...current.ui,
      selectedViewByRoute: {
        ...current.ui.selectedViewByRoute,
        [getViewerScopedDirectoryKey(current.currentUserId, view.route)]:
          view.id,
      },
    },
  }))
}

function rollbackOptimisticView(input: {
  previousSelectedViewId: string | null
  set: AppStoreSet
  viewId: string
  viewRoute: string
}) {
  input.set((current) => {
    const nextSelectedViewByRoute = {
      ...current.ui.selectedViewByRoute,
    }
    const nextSelectedViewKey = getViewerScopedDirectoryKey(
      current.currentUserId,
      input.viewRoute
    )

    if (nextSelectedViewByRoute[nextSelectedViewKey] === input.viewId) {
      if (input.previousSelectedViewId) {
        nextSelectedViewByRoute[nextSelectedViewKey] =
          input.previousSelectedViewId
      } else {
        delete nextSelectedViewByRoute[nextSelectedViewKey]
      }
    }

    return {
      views: current.views.filter((entry) => entry.id !== input.viewId),
      ui: {
        ...current.ui,
        selectedViewByRoute: nextSelectedViewByRoute,
      },
    }
  })
}

function syncOptimisticViewCreation(input: {
  get: AppStoreGet
  parsedInput: CreateViewInput
  previousSelectedViewId: string | null
  runtime: ReturnType<typeof createStoreRuntime>
  set: AppStoreSet
  viewId: string
  viewRoute: string
}) {
  return syncCreateView(input.get().currentUserId, {
    ...input.parsedInput,
    id: input.viewId,
  })
    .then(async (result) => {
      if (result?.viewId && result.viewId !== input.viewId) {
        try {
          await input.runtime.refreshFromServer()
        } catch (error) {
          await input.runtime.handleSyncFailure(
            error,
            "View created, but failed to refresh from server"
          )
        }
      }
    })
    .catch((error) => {
      rollbackOptimisticView({
        previousSelectedViewId: input.previousSelectedViewId,
        set: input.set,
        viewId: input.viewId,
        viewRoute: input.viewRoute,
      })

      throw error
    })
}

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
      const team = resolveCreateViewTeam(state, parsed.data)

      if (team === undefined) {
        return null
      }

      if (!isCreateViewRouteAllowed(parsed.data, team)) {
        return null
      }

      const viewId = parsed.data.id ?? createId("view")
      const previousSelectedViewId = getPreviousSelectedViewId(
        state,
        parsed.data.route
      )
      const view = buildOptimisticView({
        createdAt: getNow(),
        input: parsed.data,
        team,
        viewId,
      })

      if (!view) {
        toast.error("This view target is not supported yet")
        return null
      }

      selectOptimisticView(set, view)

      runtime.syncInBackground(
        syncOptimisticViewCreation({
          get,
          parsedInput: parsed.data,
          previousSelectedViewId,
          runtime,
          set,
          viewId,
          viewRoute: view.route,
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

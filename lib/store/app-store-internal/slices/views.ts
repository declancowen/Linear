"use client"

import { toast } from "sonner"

import {
  syncClearViewFilters,
  syncCreateView,
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
} from "@/lib/domain/default-views"
import { viewSchema } from "@/lib/domain/types"

import { createId, getNow } from "../helpers"
import { createStoreRuntime } from "../runtime"
import type { AppStore, AppStoreGet, AppStoreSet } from "../types"

type ViewSlice = Pick<
  AppStore,
  | "createView"
  | "updateViewConfig"
  | "toggleViewDisplayProperty"
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

        if (parsed.data.entityKind === "items" && !teamHasFeature(team, "issues")) {
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

        if (parsed.data.entityKind === "docs" && !teamHasFeature(team, "docs")) {
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
      const view = createViewDefinition({
        id: viewId,
        name: parsed.data.name,
        description: parsed.data.description,
        scopeType: parsed.data.scopeType,
        scopeId: parsed.data.scopeId,
        entityKind: parsed.data.entityKind,
        route: parsed.data.route,
        teamSlug: team?.slug,
        experience: team?.settings.experience,
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
        }).then(async (result) => {
          if (result?.viewId && result.viewId !== viewId) {
            await runtime.refreshFromServer()
          }
        }),
        "Failed to create view"
      )

      toast.success("View created")
      return view.id
    },
    updateViewConfig(viewId, patch) {
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
              creatorIds: [],
              leadIds: [],
              health: [],
              milestoneIds: [],
              relationTypes: [],
              projectIds: [],
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

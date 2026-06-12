"use client"

import { useMemo } from "react"
import { useShallow } from "zustand/react/shallow"

import {
  FilterPopover,
  getDisplayPropertyLabel,
  getViewDisplayPropertyOptions,
  GroupChipPopover,
  LayoutTabs,
  LevelChipPopover,
  PROJECT_DISPLAY_PROPERTY_OPTIONS,
  PROJECT_GROUP_OPTIONS,
  ProjectFilterPopover,
  ProjectLayoutTabs,
  ProjectSortChipPopover,
  PropertiesChipPopover,
  SortChipPopover,
  type ViewConfigPatch,
} from "@/components/app/screens/work-surface-controls"
import {
  DOCS_DISPLAY_PROPERTY_LABEL,
  DOCS_DISPLAY_PROPERTY_OPTIONS,
} from "@/components/app/screens/docs-view-config"
import {
  DocsFilterPopover,
  DocsGroupPopover,
  DocsSortPopover,
} from "@/components/app/screens/docs-view-controls"
import { Switch } from "@/components/ui/switch"
import type { ViewFilterKey } from "@/components/app/screens/helpers"
import { selectAppDataSnapshot } from "@/components/app/screens/helpers"
import type { ViewFilterValueKey } from "@/lib/store/app-store-internal/types"
import { getSystemViewEditCapability } from "@/lib/domain/default-views"
import {
  getPrivateDocuments,
  getProjectsForScope,
  getTeamDocuments,
  getWorkspaceDocuments,
} from "@/lib/domain/selectors"
import {
  applyViewerViewConfig,
  getViewerScopedViewKey,
} from "@/lib/domain/viewer-view-config"
import type { DisplayProperty, ViewDefinition } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const PROJECT_DISPLAY_PROPERTY_LABEL: Partial<Record<DisplayProperty, string>> =
  {
    team: "Team",
    assignee: "Lead",
    priority: "Priority",
    type: "Type",
    dueDate: "Target date",
    created: "Created",
    updated: "Updated",
  }

function getCollectionDisplayPropertyOptions(view: ViewDefinition) {
  return view.entityKind === "docs"
    ? DOCS_DISPLAY_PROPERTY_OPTIONS
    : PROJECT_DISPLAY_PROPERTY_OPTIONS
}

function getCollectionDisplayPropertyLabel(
  view: ViewDefinition,
  property: DisplayProperty
) {
  return view.entityKind === "docs"
    ? (DOCS_DISPLAY_PROPERTY_LABEL[property] ?? "Property")
    : (PROJECT_DISPLAY_PROPERTY_LABEL[property] ?? "Property")
}

function DisplayPropertySwitchList({
  activeProperties,
  getLabel,
  onToggle,
  properties,
}: {
  activeProperties: DisplayProperty[]
  getLabel: (property: DisplayProperty) => string
  onToggle: (property: DisplayProperty) => void
  properties: readonly DisplayProperty[]
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line-soft">
      {properties.map((property, index) => (
        <label
          key={property}
          className={cn(
            "flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2",
            index > 0 && "border-t border-line-soft"
          )}
        >
          <span className="text-[13px] text-fg-2">{getLabel(property)}</span>
          <Switch
            size="sm"
            checked={activeProperties.includes(property)}
            onCheckedChange={() => onToggle(property)}
          />
        </label>
      ))}
    </div>
  )
}

/**
 * Built-in (system) views are generated defaults, not editable Convex view
 * records. Per-user re-defaulting is owned by the viewer-config layer, keyed by
 * the surface route + view id — the same owner the board toolbar writes to. This
 * dialog reuses the board's own control chips so edits stay tied to what renders
 * on the surface, and constrains the available controls per the view's
 * capability (see getSystemViewEditCapability).
 */
export function SystemViewDefaultsDialog({
  view,
  open,
  onOpenChange,
}: {
  view: ViewDefinition
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const capability = getSystemViewEditCapability(view)
  const override = useAppStore(
    (state) =>
      state.ui.viewerViewConfigByRoute[
        getViewerScopedViewKey(state.currentUserId, view.route, view.id)
      ]
  )
  const allItems = useAppStore(useShallow((state) => state.workItems))
  const teams = useAppStore(useShallow((state) => state.teams))
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const actions = useAppStore(
    useShallow((state) => ({
      patchViewerViewConfig: state.patchViewerViewConfig,
      toggleViewerViewFilterValue: state.toggleViewerViewFilterValue,
      clearViewerViewFilters: state.clearViewerViewFilters,
      toggleViewerViewDisplayProperty: state.toggleViewerViewDisplayProperty,
      reorderViewerViewDisplayProperties:
        state.reorderViewerViewDisplayProperties,
      clearViewerViewDisplayProperties: state.clearViewerViewDisplayProperties,
      resetViewerViewConfig: state.resetViewerViewConfig,
    }))
  )

  const effectiveView = useMemo(
    () => applyViewerViewConfig(view, override),
    [override, view]
  )

  // Filter-option lists (labels, projects, assignees, statuses) must reflect the
  // view's own scope, matching how the create models scope a team vs workspace
  // surface. Personal/default views intentionally see everything they can reach.
  const items = useMemo(() => {
    if (view.scopeType === "team") {
      return allItems.filter((item) => item.teamId === view.scopeId)
    }

    if (view.scopeType === "workspace") {
      const workspaceTeamIds = new Set(
        teams
          .filter((team) => team.workspaceId === view.scopeId)
          .map((team) => team.id)
      )

      return allItems.filter(
        (item) => item.teamId !== null && workspaceTeamIds.has(item.teamId)
      )
    }

    return allItems
  }, [allItems, teams, view.scopeId, view.scopeType])
  const projects = useMemo(
    () =>
      view.scopeType === "team" || view.scopeType === "workspace"
        ? getProjectsForScope(data, view.scopeType, view.scopeId)
        : data.projects,
    [data, view.scopeId, view.scopeType]
  )
  const documents = useMemo(() => {
    if (view.scopeType === "team") {
      return getTeamDocuments(data, view.scopeId)
    }

    if (view.scopeType === "workspace") {
      return [
        ...getWorkspaceDocuments(data, view.scopeId),
        ...getPrivateDocuments(data, view.scopeId),
      ]
    }

    return data.documents
  }, [data, view.scopeId, view.scopeType])

  if (capability === "none") {
    return null
  }

  const surfaceKey = view.route
  const viewId = view.id
  const isFull = capability === "full"
  const isCollection = capability === "collection"
  const isPresentation = capability === "presentation"

  const onUpdateView = (patch: ViewConfigPatch) =>
    actions.patchViewerViewConfig(surfaceKey, viewId, patch)
  const onToggleFilterValue = (key: ViewFilterKey, value: string) =>
    actions.toggleViewerViewFilterValue(
      surfaceKey,
      viewId,
      key as ViewFilterValueKey,
      value,
      effectiveView
    )
  const onClearFilters = () =>
    actions.clearViewerViewFilters(surfaceKey, viewId)
  const onToggleDisplayProperty = (property: DisplayProperty) =>
    actions.toggleViewerViewDisplayProperty(
      surfaceKey,
      viewId,
      property,
      effectiveView
    )
  const onReorderDisplayProperties = (displayProps: DisplayProperty[]) =>
    actions.reorderViewerViewDisplayProperties(surfaceKey, viewId, displayProps)
  const onClearDisplayProperties = () =>
    actions.clearViewerViewDisplayProperties(surfaceKey, viewId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-visible rounded-xl border border-line bg-surface p-0 sm:max-w-[640px]">
        <DialogHeader className="space-y-1 border-b border-line-soft px-5 py-4">
          <DialogTitle className="text-[15px] font-semibold tracking-tight">
            {isFull || isCollection || isPresentation
              ? `Edit ${view.name} defaults`
              : "Displayed properties"}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-muted-foreground">
            {isFull || isCollection || isPresentation
              ? "These settings become your default for this built-in view."
              : `Choose which properties show by default on ${view.name}.`}
          </DialogDescription>
        </DialogHeader>
        {isFull ? (
          <div className="flex flex-wrap items-center gap-1.5 px-5 py-5">
            <LayoutTabs view={effectiveView} onUpdateView={onUpdateView} />
            <div aria-hidden className="mx-1 h-[18px] w-px bg-line" />
            <FilterPopover
              view={effectiveView}
              items={items}
              variant="chip"
              onToggleFilterValue={onToggleFilterValue}
              onUpdateView={onUpdateView}
              onClearFilters={onClearFilters}
            />
            <LevelChipPopover
              view={effectiveView}
              onUpdateView={onUpdateView}
            />
            <GroupChipPopover
              view={effectiveView}
              onUpdateView={onUpdateView}
            />
            <SortChipPopover view={effectiveView} onUpdateView={onUpdateView} />
            <PropertiesChipPopover
              view={effectiveView}
              onToggleDisplayProperty={onToggleDisplayProperty}
              onReorderDisplayProperties={onReorderDisplayProperties}
              onClearDisplayProperties={onClearDisplayProperties}
            />
          </div>
        ) : isPresentation ? (
          <div className="flex flex-wrap items-center gap-1.5 px-5 py-5">
            <LayoutTabs view={effectiveView} onUpdateView={onUpdateView} />
            <div aria-hidden className="mx-1 h-[18px] w-px bg-line" />
            <LevelChipPopover
              view={effectiveView}
              onUpdateView={onUpdateView}
            />
            <GroupChipPopover
              view={effectiveView}
              onUpdateView={onUpdateView}
            />
            <SortChipPopover view={effectiveView} onUpdateView={onUpdateView} />
            <PropertiesChipPopover
              view={effectiveView}
              onToggleDisplayProperty={onToggleDisplayProperty}
              onReorderDisplayProperties={onReorderDisplayProperties}
              onClearDisplayProperties={onClearDisplayProperties}
            />
          </div>
        ) : isCollection ? (
          <div className="space-y-4 px-5 py-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <ProjectLayoutTabs
                view={effectiveView}
                onUpdateView={onUpdateView}
              />
              <div aria-hidden className="mx-1 h-[18px] w-px bg-line" />
              {effectiveView.entityKind === "projects" ? (
                <>
                  <ProjectFilterPopover
                    view={effectiveView}
                    projects={projects}
                    variant="chip"
                    onToggleFilterValue={(key, value) =>
                      onToggleFilterValue(key, value)
                    }
                    onClearFilters={onClearFilters}
                  />
                  <GroupChipPopover
                    view={effectiveView}
                    groupOptions={PROJECT_GROUP_OPTIONS}
                    onUpdateView={onUpdateView}
                  />
                  <ProjectSortChipPopover
                    view={effectiveView}
                    onUpdateView={onUpdateView}
                  />
                </>
              ) : (
                <>
                  <DocsFilterPopover
                    data={data}
                    documents={documents}
                    view={effectiveView}
                    onToggleFilter={onToggleFilterValue}
                    onClearFilters={onClearFilters}
                  />
                  <DocsGroupPopover
                    view={effectiveView}
                    onUpdateView={onUpdateView}
                  />
                  <DocsSortPopover
                    view={effectiveView}
                    onUpdateView={onUpdateView}
                  />
                </>
              )}
            </div>
            <DisplayPropertySwitchList
              activeProperties={effectiveView.displayProps}
              properties={getCollectionDisplayPropertyOptions(effectiveView)}
              getLabel={(property) =>
                getCollectionDisplayPropertyLabel(effectiveView, property)
              }
              onToggle={onToggleDisplayProperty}
            />
          </div>
        ) : (
          <div className="px-5 py-4">
            <DisplayPropertySwitchList
              activeProperties={effectiveView.displayProps}
              properties={getViewDisplayPropertyOptions(effectiveView)}
              getLabel={getDisplayPropertyLabel}
              onToggle={onToggleDisplayProperty}
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-line-soft px-5 py-3.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => actions.resetViewerViewConfig(surfaceKey, viewId)}
          >
            Reset to default
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

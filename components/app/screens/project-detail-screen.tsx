"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { Plus } from "@phosphor-icons/react"

import {
  canEditTeam,
  canEditWorkspace,
  getViewByRoute,
  getVisibleItemsForView,
  getProjectDetailModel,
  getTemplateDefaultsForTeam,
} from "@/lib/domain/selectors"
import {
  createDefaultProjectPresentationConfig,
  getDefaultViewItemLevelForProjectTemplate,
  getDefaultViewItemLevelForTeamExperience,
  getWorkSurfaceCopy,
  type DisplayProperty,
  type GroupField,
  type OrderingField,
  type ProjectPresentationConfig,
  type ViewDefinition,
} from "@/lib/domain/types"
import { createViewDefinition } from "@/lib/domain/default-views"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import {
  fetchProjectDetailReadModel,
} from "@/lib/convex/client"
import { createMissingScopedReadModelResult } from "@/lib/convex/client/read-models"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import { createProjectDetailScopeKey } from "@/lib/scoped-sync/scope-keys"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { MissingState } from "@/components/app/screens/shared"
import { ViewContextMenu } from "@/components/app/screens/entity-context-menus"
import {
  cloneViewFilters,
  createEmptyViewFilters,
  type ViewFilterKey,
  selectAppDataSnapshot,
} from "@/components/app/screens/helpers"
import {
  FilterPopover,
  getAvailableGroupOptions,
  GroupChipPopover,
  LayoutTabs,
  LevelChipPopover,
  PropertiesChipPopover,
  SortChipPopover,
  type ViewConfigPatch,
  ViewConfigPopover,
} from "@/components/app/screens/work-surface-controls"
import {
  BoardView,
  ListView,
  TimelineView,
} from "@/components/app/screens/work-surface-view"
import {
  IconButton,
  Topbar,
  Viewbar,
} from "@/components/ui/template-primitives"
import { cn } from "@/lib/utils"

export function ProjectDetailScreen({ projectId }: { projectId: string }) {
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  useScopedReadModelRefresh({
    enabled: true,
    scopeKeys: [createProjectDetailScopeKey(projectId)],
    fetchLatest: () => fetchProjectDetailReadModel(projectId),
    notFoundResult: createMissingScopedReadModelResult([
      {
        kind: "project-detail",
        projectId,
      },
    ]),
  })
  const searchParams = useSearchParams()
  const projectModel = getProjectDetailModel(data, projectId)
  const projectRoute = projectModel?.detailHref ?? null
  const savedProjectItemViews = useAppStore(
    useShallow((state) => {
      if (!projectModel || !projectRoute) {
        return []
      }

      return state.views.filter(
        (view) =>
          view.entityKind === "items" &&
          ((view.containerType === "project-items" &&
            view.containerId === projectModel.project.id) ||
            (!view.containerType &&
              view.route === projectRoute &&
              view.scopeType === projectModel.project.scopeType &&
              view.scopeId === projectModel.project.scopeId))
      )
    })
  )
  const defaultProjectPresentation = useMemo(() => {
    if (!projectModel?.project) {
      return null
    }

    return (
      projectModel.project.presentation ??
      createDefaultProjectPresentationConfig(
        projectModel.project.templateType,
        {
          layout: getTemplateDefaultsForTeam(
            projectModel.team,
            projectModel.project.templateType
          ).defaultViewLayout,
        }
      )
    )
  }, [projectModel?.project, projectModel?.team])
  const initialProjectPresentation = useMemo(
    () =>
      defaultProjectPresentation ??
      createDefaultProjectPresentationConfig("software-delivery"),
    [defaultProjectPresentation]
  )
  const [projectItemsLayout, setProjectItemsLayout] = useState<
    ViewDefinition["layout"]
  >(() => initialProjectPresentation.layout)
  const [projectItemsGrouping, setProjectItemsGrouping] = useState<GroupField>(
    () => initialProjectPresentation.grouping
  )
  const [projectItemsSubGrouping, setProjectItemsSubGrouping] =
    useState<GroupField | null>(null)
  const [projectItemsOrdering, setProjectItemsOrdering] =
    useState<OrderingField>(() => initialProjectPresentation.ordering)
  const [projectItemsLevel, setProjectItemsLevel] = useState<
    ProjectPresentationConfig["itemLevel"]
  >(() => initialProjectPresentation.itemLevel)
  const [projectItemsShowChildItems, setProjectItemsShowChildItems] =
    useState<boolean>(() => initialProjectPresentation.showChildItems ?? false)
  const [projectItemsFilters, setProjectItemsFilters] = useState<
    ViewDefinition["filters"]
  >(() => cloneViewFilters(initialProjectPresentation.filters))
  const [projectItemsDisplayProps, setProjectItemsDisplayProps] = useState<
    DisplayProperty[]
  >(() => [...initialProjectPresentation.displayProps])
  const [activeBuiltinProjectViewId, setActiveBuiltinProjectViewId] = useState<
    string | null
  >(null)

  useEffect(() => {
    if (!defaultProjectPresentation) {
      return
    }

    queueMicrotask(() => {
      setProjectItemsLayout(defaultProjectPresentation.layout)
      setProjectItemsGrouping(defaultProjectPresentation.grouping)
      setProjectItemsSubGrouping(null)
      setProjectItemsOrdering(defaultProjectPresentation.ordering)
      setProjectItemsLevel(defaultProjectPresentation.itemLevel)
      setProjectItemsShowChildItems(
        defaultProjectPresentation.showChildItems ?? false
      )
      setProjectItemsFilters(
        cloneViewFilters(defaultProjectPresentation.filters)
      )
      setProjectItemsDisplayProps([...defaultProjectPresentation.displayProps])
    })
  }, [defaultProjectPresentation, projectId, projectModel?.project.id])

  const selectedProjectView = projectRoute
    ? getViewByRoute(data, projectRoute)
    : null
  const activeSavedProjectView = savedProjectItemViews.some(
    (view) => view.id === selectedProjectView?.id
  )
    ? selectedProjectView
    : null

  useEffect(() => {
    if (!projectRoute) {
      return
    }

    const requestedViewId = searchParams.get("view")

    if (
      !requestedViewId ||
      !savedProjectItemViews.some((view) => view.id === requestedViewId)
    ) {
      return
    }

    setActiveBuiltinProjectViewId(null)
    useAppStore.getState().setSelectedView(projectRoute, requestedViewId)
  }, [projectRoute, savedProjectItemViews, searchParams])

  useEffect(() => {
    setActiveBuiltinProjectViewId(`fallback-project-items-${projectId}`)
  }, [projectId])

  const projectGroupOptions = useMemo(
    () => getAvailableGroupOptions(projectModel?.project.templateType),
    [projectModel?.project.templateType]
  )

  if (!projectModel) {
    return <MissingState title="Project not found" />
  }

  const { project, team, items, detailHref } = projectModel
  const editable =
    project.scopeType === "team"
      ? Boolean(team && canEditTeam(data, team.id))
      : canEditWorkspace(data, project.scopeId)
  const workSurfaceExperience =
    team?.settings.experience ??
    (project.templateType === "bug-tracking"
      ? "issue-analysis"
      : project.templateType === "project-management"
        ? "project-management"
        : "software-development")
  const workCopy = getWorkSurfaceCopy(workSurfaceExperience)
  const baselineProjectPresentation =
    defaultProjectPresentation ?? initialProjectPresentation
  const baselineProjectItemsLevel =
    baselineProjectPresentation.itemLevel === undefined
      ? team
        ? getDefaultViewItemLevelForTeamExperience(team.settings.experience)
        : getDefaultViewItemLevelForProjectTemplate(project.templateType)
      : baselineProjectPresentation.itemLevel
  const effectiveProjectItemsLevel =
    projectItemsLevel === undefined
      ? team
        ? getDefaultViewItemLevelForTeamExperience(team.settings.experience)
        : getDefaultViewItemLevelForProjectTemplate(project.templateType)
      : projectItemsLevel

  const projectItemsView: ViewDefinition = {
    id: `project-items-${project.id}`,
    name: "Project items",
    description: "",
    scopeType: "personal",
    scopeId: data.currentUserId,
    entityKind: "items",
    itemLevel: effectiveProjectItemsLevel ?? null,
    showChildItems: projectItemsShowChildItems,
    layout: projectItemsLayout,
    filters: projectItemsFilters,
    grouping: projectItemsGrouping,
    subGrouping: projectItemsSubGrouping,
    ordering: projectItemsOrdering,
    displayProps: projectItemsDisplayProps,
    hiddenState: { groups: [], subgroups: [] },
    isShared: false,
    route: detailHref,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
  const fallbackProjectItemsView =
    createViewDefinition({
      id: `fallback-project-items-${project.id}`,
      name: `All ${workCopy.surfaceLabel.toLowerCase()}`,
      description: `All ${workCopy.surfaceLabel.toLowerCase()} linked to this project.`,
      scopeType: project.scopeType,
      scopeId: project.scopeId,
      entityKind: "items",
      route: detailHref,
      teamSlug: team?.slug,
      isShared: false,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      overrides: {
        layout: baselineProjectPresentation.layout,
        filters: cloneViewFilters(baselineProjectPresentation.filters),
        grouping: baselineProjectPresentation.grouping,
        subGrouping: null,
        ordering: baselineProjectPresentation.ordering,
        ...(baselineProjectItemsLevel !== undefined
          ? { itemLevel: baselineProjectItemsLevel }
          : {}),
        showChildItems: baselineProjectPresentation.showChildItems ?? false,
        displayProps: [...baselineProjectPresentation.displayProps],
        hiddenState: { groups: [], subgroups: [] },
      },
    }) ?? projectItemsView
  const builtinProjectItemsOverrides = {
    layout: fallbackProjectItemsView.layout,
    filters: cloneViewFilters(fallbackProjectItemsView.filters),
    grouping: fallbackProjectItemsView.grouping,
    subGrouping: fallbackProjectItemsView.subGrouping,
    ordering: fallbackProjectItemsView.ordering,
    ...(fallbackProjectItemsView.itemLevel !== undefined
      ? { itemLevel: fallbackProjectItemsView.itemLevel }
      : {}),
    showChildItems: fallbackProjectItemsView.showChildItems,
    displayProps: [...fallbackProjectItemsView.displayProps],
    hiddenState: {
      groups: [...fallbackProjectItemsView.hiddenState.groups],
      subgroups: [...fallbackProjectItemsView.hiddenState.subgroups],
    },
  }
  const activeBuiltinProjectView =
    createViewDefinition({
      id: `builtin-project-active-${project.id}`,
      name: "Active",
      description: `Current ${workCopy.surfaceLabel.toLowerCase()} linked to this project.`,
      scopeType: project.scopeType,
      scopeId: project.scopeId,
      entityKind: "items",
      route: detailHref,
      teamSlug: team?.slug,
      isShared: false,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      overrides: {
        ...builtinProjectItemsOverrides,
        layout: "board",
        filters: {
          ...cloneViewFilters(fallbackProjectItemsView.filters),
          status: ["todo", "in-progress"],
        },
        displayProps: [
          "id",
          "status",
          "assignee",
          "priority",
          "project",
          "created",
        ],
      },
    }) ?? fallbackProjectItemsView
  const backlogBuiltinProjectView =
    createViewDefinition({
      id: `builtin-project-backlog-${project.id}`,
      name: "Backlog",
      description: `Upcoming ${workCopy.surfaceLabel.toLowerCase()} linked to this project.`,
      scopeType: project.scopeType,
      scopeId: project.scopeId,
      entityKind: "items",
      route: detailHref,
      teamSlug: team?.slug,
      isShared: false,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      overrides: {
        ...builtinProjectItemsOverrides,
        filters: {
          ...cloneViewFilters(fallbackProjectItemsView.filters),
          status: ["backlog"],
        },
        grouping: "priority",
        ordering: "targetDate",
        displayProps: ["id", "project", "priority", "assignee", "dueDate"],
        hiddenState: { groups: [], subgroups: [] },
      },
    }) ?? fallbackProjectItemsView
  const builtinProjectItemViews = [
    fallbackProjectItemsView,
    activeBuiltinProjectView,
    backlogBuiltinProjectView,
  ]
  const activeProjectItemsView = activeSavedProjectView ?? projectItemsView
  const displayedProjectItemViews = [
    ...builtinProjectItemViews,
    ...savedProjectItemViews,
  ]
  const activeProjectItemsTabId =
    activeSavedProjectView?.id ??
    activeBuiltinProjectViewId ??
    fallbackProjectItemsView.id
  const visibleProjectItems = getVisibleItemsForView(
    data,
    items,
    activeProjectItemsView
  )
  const emptyProjectItemsLabel =
    items.length === 0
      ? workCopy.emptyLabel
      : activeProjectItemsView.layout === "timeline" &&
          !activeProjectItemsView.itemLevel &&
          visibleProjectItems.length === 0
        ? "Timeline only shows top-level items."
        : `No ${workCopy.surfaceLabel.toLowerCase()} match the current filters.`
  const createWorkItemTeamId =
    project.scopeType === "team"
      ? project.scopeId
      : (data.ui.activeTeamId ?? team?.id ?? data.teams[0]?.id ?? null)

  function updateProjectItemsView(patch: ViewConfigPatch) {
    if (patch.layout) {
      setProjectItemsLayout(patch.layout)
    }

    if (patch.grouping) {
      setProjectItemsGrouping(patch.grouping)
    }

    if ("subGrouping" in patch) {
      setProjectItemsSubGrouping(patch.subGrouping ?? null)
    }

    if (patch.ordering) {
      setProjectItemsOrdering(patch.ordering)
    }

    if ("itemLevel" in patch) {
      setProjectItemsLevel(patch.itemLevel)
    }

    if ("showChildItems" in patch) {
      setProjectItemsShowChildItems(Boolean(patch.showChildItems))
    }

    if (patch.showCompleted !== undefined) {
      setProjectItemsFilters((current) => ({
        ...current,
        showCompleted: patch.showCompleted ?? true,
      }))
    }
  }

  function toggleProjectItemsFilter(key: ViewFilterKey, value: string) {
    setProjectItemsFilters((current) => {
      const nextFilters = { ...current } as ViewDefinition["filters"]
      const currentValues = nextFilters[key] as string[]
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value]

      nextFilters[key] = nextValues as never
      return nextFilters
    })
  }

  function clearProjectItemsFilters() {
    setProjectItemsFilters((current) => ({
      ...createEmptyViewFilters(),
      showCompleted: current.showCompleted,
    }))
  }

  function toggleProjectItemsDisplayProperty(property: DisplayProperty) {
    setProjectItemsDisplayProps((current) =>
      current.includes(property)
        ? current.filter((value) => value !== property)
        : [...current, property]
    )
  }

  function reorderProjectItemsDisplayProperties(
    displayProps: DisplayProperty[]
  ) {
    setProjectItemsDisplayProps(displayProps)
  }

  function applyProjectItemsViewTemplate(view: ViewDefinition) {
    setProjectItemsLayout(view.layout)
    setProjectItemsGrouping(view.grouping)
    setProjectItemsSubGrouping(view.subGrouping ?? null)
    setProjectItemsOrdering(view.ordering)
    setProjectItemsLevel(view.itemLevel)
    setProjectItemsShowChildItems(Boolean(view.showChildItems))
    setProjectItemsFilters(cloneViewFilters(view.filters))
    setProjectItemsDisplayProps([...view.displayProps])
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar>
          <SidebarTrigger className="size-5 shrink-0" />
          <div className="min-w-0 shrink-0 text-sm font-medium text-foreground">
            <span className="truncate">{project.name}</span>
          </div>
          <div className="ml-2 flex items-center gap-0.5">
            {displayedProjectItemViews.map((view) => {
              const isSavedView = savedProjectItemViews.some(
                (savedView) => savedView.id === view.id
              )
              const tabButton = (
                <button
                  className={cn(
                    "h-7 rounded-md px-2 text-[12px] transition-colors",
                    view.id === activeProjectItemsTabId
                      ? "bg-surface-3 font-medium text-foreground"
                      : "text-fg-3 hover:bg-surface-3 hover:text-foreground"
                  )}
                  onClick={() => {
                    if (!projectRoute) {
                      return
                    }

                    if (isSavedView) {
                      setActiveBuiltinProjectViewId(null)
                      useAppStore
                        .getState()
                        .setSelectedView(projectRoute, view.id)
                      return
                    }

                    applyProjectItemsViewTemplate(view)
                    setActiveBuiltinProjectViewId(view.id)
                    useAppStore.getState().setSelectedView(projectRoute, "")
                  }}
                >
                  {view.name}
                </button>
              )

              return isSavedView ? (
                <ViewContextMenu key={view.id} view={view}>
                  {tabButton}
                </ViewContextMenu>
              ) : (
                <div key={view.id}>{tabButton}</div>
              )
            })}
            {editable ? (
              <IconButton
                aria-label="Create view"
                className="size-6"
                onClick={() =>
                  openManagedCreateDialog({
                    kind: "view",
                    defaultScopeType: project.scopeType,
                    defaultScopeId: project.scopeId,
                    defaultProjectId: project.id,
                    defaultEntityKind: "items",
                    defaultRoute: detailHref,
                    lockScope: true,
                    lockProject: true,
                    lockEntityKind: true,
                  })
                }
              >
                <Plus className="size-3.5" />
              </IconButton>
            ) : null}
          </div>
        </Topbar>

        <Viewbar>
          <LayoutTabs
            view={activeProjectItemsView}
            onUpdateView={
              activeSavedProjectView ? undefined : updateProjectItemsView
            }
          />
          <div aria-hidden className="mx-1.5 h-[18px] w-px bg-line" />
          <FilterPopover
            view={activeProjectItemsView}
            items={items}
            variant="chip"
            onToggleFilterValue={
              activeSavedProjectView ? undefined : toggleProjectItemsFilter
            }
            onClearFilters={
              activeSavedProjectView ? undefined : clearProjectItemsFilters
            }
          />
          <LevelChipPopover
            view={activeProjectItemsView}
            onUpdateView={
              activeSavedProjectView ? undefined : updateProjectItemsView
            }
          />
          <GroupChipPopover
            view={activeProjectItemsView}
            groupOptions={projectGroupOptions}
            onUpdateView={
              activeSavedProjectView ? undefined : updateProjectItemsView
            }
          />
          <SortChipPopover
            view={activeProjectItemsView}
            onUpdateView={
              activeSavedProjectView ? undefined : updateProjectItemsView
            }
          />
          <PropertiesChipPopover
            view={activeProjectItemsView}
            onToggleDisplayProperty={
              activeSavedProjectView
                ? undefined
                : toggleProjectItemsDisplayProperty
            }
            onReorderDisplayProperties={
              activeSavedProjectView
                ? undefined
                : reorderProjectItemsDisplayProperties
            }
          />
          <div className="ml-auto flex items-center gap-1.5">
            <ViewConfigPopover
              view={activeProjectItemsView}
              groupOptions={projectGroupOptions}
              onUpdateView={
                activeSavedProjectView ? undefined : updateProjectItemsView
              }
              onToggleDisplayProperty={
                activeSavedProjectView
                  ? undefined
                  : toggleProjectItemsDisplayProperty
              }
            />
            <Button
              size="sm"
              variant="default"
              className="h-7 gap-1.5 px-2.5 text-[12px]"
              onClick={() =>
                openManagedCreateDialog({
                  kind: "workItem",
                  defaultTeamId: createWorkItemTeamId,
                  defaultProjectId: project.id,
                })
              }
            >
              <Plus className="size-3.5" />
              New
            </Button>
          </div>
        </Viewbar>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <>
            {activeProjectItemsView.layout === "board" ? (
              <BoardView
                data={data}
                items={visibleProjectItems}
                scopedItems={items}
                view={activeProjectItemsView}
                editable={editable}
              />
            ) : null}
            {activeProjectItemsView.layout === "list" ? (
              <ListView
                data={data}
                items={visibleProjectItems}
                scopedItems={items}
                view={activeProjectItemsView}
                editable={editable}
              />
            ) : null}
            {activeProjectItemsView.layout === "timeline" ? (
              <TimelineView
                data={data}
                items={visibleProjectItems}
                view={activeProjectItemsView}
                editable={editable}
              />
            ) : null}
          </>
          {visibleProjectItems.length > 0 ? null : (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              {emptyProjectItemsLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

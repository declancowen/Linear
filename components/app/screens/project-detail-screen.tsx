"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { CaretRight, SidebarSimple } from "@phosphor-icons/react"

import {
  canEditTeam,
  canEditWorkspace,
  getProjectDetailModel,
  getTemplateDefaultsForTeam,
  itemMatchesView,
} from "@/lib/domain/selectors"
import {
  createDefaultProjectPresentationConfig,
  type DisplayProperty,
  type GroupField,
  type OrderingField,
  type ViewDefinition,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MissingState } from "@/components/app/screens/shared"
import {
  cloneViewFilters,
  createEmptyViewFilters,
  type ViewFilterKey,
  selectAppDataSnapshot,
} from "@/components/app/screens/helpers"
import {
  ProjectActivityTab,
  ProjectOverviewTab,
  ProjectPropertiesSidebar,
} from "@/components/app/screens/project-detail-ui"
import {
  FilterPopover,
  type ViewConfigPatch,
  ViewConfigPopover,
} from "@/components/app/screens/work-surface-controls"
import {
  BoardView,
  ListView,
  TimelineView,
} from "@/components/app/screens/work-surface-view"
import { cn } from "@/lib/utils"

export function ProjectDetailScreen({ projectId }: { projectId: string }) {
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const projectModel = getProjectDetailModel(data, projectId)
  const defaultProjectPresentation = projectModel?.project
    ? (projectModel.project.presentation ??
      createDefaultProjectPresentationConfig(
        projectModel.project.templateType,
        {
          layout: getTemplateDefaultsForTeam(
            projectModel.team,
            projectModel.project.templateType
          ).defaultViewLayout,
        }
      ))
    : null
  const initialProjectPresentation =
    defaultProjectPresentation ??
    createDefaultProjectPresentationConfig("software-delivery")
  const [propertiesOpen, setPropertiesOpen] = useState(true)
  const [projectTab, setProjectTab] = useState<
    "overview" | "activity" | "issues"
  >("overview")
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
  const [projectItemsFilters, setProjectItemsFilters] = useState<
    ViewDefinition["filters"]
  >(() => cloneViewFilters(initialProjectPresentation.filters))
  const [projectItemsDisplayProps, setProjectItemsDisplayProps] = useState<
    DisplayProperty[]
  >(() => [...initialProjectPresentation.displayProps])

  useEffect(() => {
    if (!defaultProjectPresentation) {
      return
    }

    queueMicrotask(() => {
      setProjectTab("overview")
      setProjectItemsLayout(defaultProjectPresentation.layout)
      setProjectItemsGrouping(defaultProjectPresentation.grouping)
      setProjectItemsSubGrouping(null)
      setProjectItemsOrdering(defaultProjectPresentation.ordering)
      setProjectItemsFilters(
        cloneViewFilters(defaultProjectPresentation.filters)
      )
      setProjectItemsDisplayProps([...defaultProjectPresentation.displayProps])
    })
  }, [defaultProjectPresentation, projectId, projectModel?.project.id])

  if (!projectModel) {
    return <MissingState title="Project not found" />
  }

  const {
    project,
    team,
    progress,
    items,
    milestones,
    updates,
    documents,
    members,
    contextLabel,
    backHref,
  } = projectModel
  const editable =
    project.scopeType === "team"
      ? Boolean(team && canEditTeam(data, team.id))
      : canEditWorkspace(data, project.scopeId)
  const linkedItemsLabel = `${progress.scope} linked item${
    progress.scope === 1 ? "" : "s"
  }`

  const projectItemsView: ViewDefinition = {
    id: `project-items-${project.id}`,
    name: "Project items",
    description: "",
    scopeType: "personal",
    scopeId: data.currentUserId,
    entityKind: "items",
    layout: projectItemsLayout,
    filters: projectItemsFilters,
    grouping: projectItemsGrouping,
    subGrouping: projectItemsSubGrouping,
    ordering: projectItemsOrdering,
    displayProps: projectItemsDisplayProps,
    hiddenState: { groups: [], subgroups: [] },
    isShared: false,
    route: backHref,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
  const filteredProjectItems = items.filter((item) =>
    itemMatchesView(data, item, projectItemsView)
  )
  const visibleProjectItems =
    projectItemsView.layout === "timeline"
      ? filteredProjectItems.filter((item) => item.parentId === null)
      : filteredProjectItems
  const emptyProjectItemsLabel =
    projectItemsView.layout === "timeline" && filteredProjectItems.length > 0
      ? "Timeline only shows top-level items."
      : "No items match the current filters."

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-10 shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <SidebarTrigger className="size-5 shrink-0" />
          <Link
            href={backHref}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {contextLabel}
          </Link>
          <CaretRight className="size-3 text-muted-foreground" />
          <span className="truncate font-medium">{project.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground">
            {linkedItemsLabel}
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            className={cn(!propertiesOpen && "text-muted-foreground")}
            onClick={() => setPropertiesOpen((current) => !current)}
          >
            <SidebarSimple className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-8">
            <div>
              <h1 className="mb-1 text-2xl font-semibold">{project.name}</h1>
              <p className="text-sm text-muted-foreground">{project.summary}</p>
            </div>

            <Tabs
              value={projectTab}
              onValueChange={(value) =>
                setProjectTab(value as "overview" | "activity" | "issues")
              }
            >
              <div className="flex items-end justify-between gap-4 border-b">
                <TabsList
                  variant="line"
                  className="h-9 justify-start gap-1 rounded-none border-0 px-0"
                >
                  <TabsTrigger
                    value="overview"
                    className="flex-none rounded-none border-0 px-3 focus-visible:ring-0 focus-visible:outline-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="activity"
                    className="flex-none rounded-none border-0 px-3 focus-visible:ring-0 focus-visible:outline-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Activity
                  </TabsTrigger>
                  <TabsTrigger
                    value="issues"
                    className="flex-none rounded-none border-0 px-3 focus-visible:ring-0 focus-visible:outline-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Items
                  </TabsTrigger>
                </TabsList>
                <div
                  className={cn(
                    "flex items-center gap-1 pb-1",
                    projectTab !== "issues" && "pointer-events-none invisible"
                  )}
                >
                  <FilterPopover
                    view={projectItemsView}
                    items={items}
                    onToggleFilterValue={toggleProjectItemsFilter}
                    onClearFilters={clearProjectItemsFilters}
                  />
                  <ViewConfigPopover
                    view={projectItemsView}
                    onUpdateView={updateProjectItemsView}
                    onToggleDisplayProperty={toggleProjectItemsDisplayProperty}
                  />
                </div>
              </div>
              <TabsContent value="overview" className="mt-4">
                <ProjectOverviewTab
                  data={data}
                  project={project}
                  documents={documents}
                  milestones={milestones}
                />
              </TabsContent>
              <TabsContent value="activity" className="mt-4">
                <ProjectActivityTab data={data} updates={updates} />
              </TabsContent>
              <TabsContent value="issues" className="mt-4">
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground">
                    No linked items yet.
                  </div>
                ) : visibleProjectItems.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border bg-card">
                    {projectItemsView.layout === "board" ? (
                      <BoardView
                        data={data}
                        items={visibleProjectItems}
                        view={projectItemsView}
                        editable={editable}
                      />
                    ) : null}
                    {projectItemsView.layout === "list" ? (
                      <ListView
                        data={data}
                        items={visibleProjectItems}
                        view={projectItemsView}
                        editable={editable}
                      />
                    ) : null}
                    {projectItemsView.layout === "timeline" ? (
                      <TimelineView
                        data={data}
                        items={visibleProjectItems}
                        view={projectItemsView}
                        editable={editable}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground">
                    {emptyProjectItemsLabel}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <ProjectPropertiesSidebar
          data={data}
          open={propertiesOpen}
          editable={editable}
          project={project}
          team={team}
          progress={progress}
          members={members}
        />
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  useEffect,
  useMemo,
  useState,
} from "react"
import { useShallow } from "zustand/react/shallow"
import {
  format,
} from "date-fns"
import {
  FileText,
  Plus,
} from "@phosphor-icons/react"

import {
  canEditTeam,
  canEditWorkspace,
  getPrivateDocuments,
  getProjectHref,
  getProjectProgress,
  getProjectsForScope,
  getTeam,
  getTeamBySlug,
  getTeamDocuments,
  getUser,
  getViewByRoute,
  getViewContextLabel,
  getVisibleProjectsForView,
  getViewsForScope,
  getVisibleWorkItems,
  getWorkspaceDocuments,
  getWorkspaceDirectoryViews,
  teamHasFeature,
} from "@/lib/domain/selectors"
import {
  getWorkSurfaceCopy,
  priorityMeta,
  type ScopeType,
  type Team,
  type ViewDefinition,
} from "@/lib/domain/types"
import {
  createViewDefinition,
  isSystemView,
} from "@/lib/domain/default-views"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CollectionDisplaySettingsPopover,
  HeaderTitle,
  MissingState,
  SCREEN_HEADER_CLASS_NAME,
  ScreenHeader,
  ViewsDisplaySettingsPopover,
  formatEntityKind,
  getDocumentPreview,
  getEntityKindIcon,
} from "@/components/app/screens/shared"
export { InboxScreen } from "@/components/app/screens/inbox-screen"
import { CreateDocumentDialog } from "@/components/app/screens/create-document-dialog"
import {
  DocumentContextMenu,
} from "@/components/app/screens/document-ui"
import {
  ProjectContextMenu,
  ViewContextMenu,
} from "@/components/app/screens/entity-context-menus"
export { ProjectDetailScreen } from "@/components/app/screens/project-detail-screen"
import {
  DocumentBoard,
  ProjectBoard,
  SavedViewsBoard,
} from "@/components/app/screens/collection-boards"
import { WorkSurface } from "@/components/app/screens/work-surface"
import { getViewHref } from "@/lib/domain/default-views"
import {
  ProjectFilterPopover,
  ProjectViewConfigPopover,
} from "@/components/app/screens/work-surface-controls"
import { cn } from "@/lib/utils"
export { DocumentDetailScreen } from "@/components/app/screens/document-detail-screen"
export { WorkItemDetailScreen } from "@/components/app/screens/work-item-detail-screen"

function useCollectionLayout(routeKey: string, views: ViewDefinition[]) {
  const selectedView = useAppStore((state) => getViewByRoute(state, routeKey))
  const searchParams = useSearchParams()
  const hasSelectedView = selectedView
    ? views.some((view) => view.id === selectedView.id)
    : false
  const activeView = hasSelectedView ? selectedView : (views[0] ?? null)
  const [localLayout, setLocalLayout] = useState<"list" | "board">("list")

  useEffect(() => {
    if (!views[0] || hasSelectedView) {
      return
    }

    useAppStore.getState().setSelectedView(routeKey, views[0].id)
  }, [hasSelectedView, routeKey, views])

  useEffect(() => {
    const requestedViewId = searchParams.get("view")

    if (
      !requestedViewId ||
      !views.some((view) => view.id === requestedViewId)
    ) {
      return
    }

    useAppStore.getState().setSelectedView(routeKey, requestedViewId)
  }, [routeKey, searchParams, views])

  const layout =
    activeView?.layout === "board"
      ? "board"
      : activeView?.layout === "list"
        ? "list"
        : localLayout

  function setLayout(nextLayout: "list" | "board") {
    if (activeView) {
      useAppStore.getState().updateViewConfig(activeView.id, {
        layout: nextLayout,
      })
      return
    }

    setLocalLayout(nextLayout)
  }

  return { activeView, layout, setLayout }
}

/* ------------------------------------------------------------------ */
/*  Screen components                                                  */
/* ------------------------------------------------------------------ */

export function TeamWorkScreen({ teamSlug }: { teamSlug: string }) {
  const team = useAppStore((state) => getTeamBySlug(state, teamSlug))
  const views = useAppStore(
    useShallow((state) =>
      team ? getViewsForScope(state, "team", team.id, "items") : []
    )
  )
  const items = useAppStore(
    useShallow((state) =>
      team ? getVisibleWorkItems(state, { teamId: team.id }) : []
    )
  )

  if (!team) {
    return <MissingState title="Team not found" />
  }

  const workCopy = getWorkSurfaceCopy(team.settings.experience)

  if (!teamHasFeature(team, "issues")) {
    return <MissingState title={workCopy.disabledLabel} />
  }

  return (
    <WorkSurface
      title={workCopy.surfaceLabel}
      routeKey={`/team/${team.slug}/work`}
      views={views}
      items={items}
      team={team}
      emptyLabel={workCopy.emptyLabel}
    />
  )
}

export function AssignedScreen() {
  const { activeTeamId, currentUserId } = useAppStore(
    useShallow((state) => ({
      activeTeamId: state.ui.activeTeamId,
      currentUserId: state.currentUserId,
    }))
  )
  const team = useAppStore((state) => getTeam(state, activeTeamId))
  const views = useAppStore(
    useShallow((state) =>
      getViewsForScope(state, "personal", currentUserId, "items")
    )
  )
  const items = useAppStore(
    useShallow((state) =>
      getVisibleWorkItems(state, { assignedToCurrentUser: true })
    )
  )

  return (
    <WorkSurface
      title="My items"
      routeKey="/assigned"
      views={views}
      items={items}
      team={team}
      emptyLabel="Nothing is assigned right now"
    />
  )
}

export function ProjectsScreen({
  scopeType,
  scopeId,
  team,
  title,
}: {
  scopeType: ScopeType
  scopeId: string
  team?: Team | null
  title: string
  description?: string
}) {
  const data = useAppStore((state) => state)
  const projects = useAppStore(
    useShallow((state) => getProjectsForScope(state, scopeType, scopeId))
  )
  const projectViews = useAppStore(
    useShallow((state) =>
      getViewsForScope(
        state,
        scopeType === "team" ? "team" : "workspace",
        scopeId,
        "projects"
      )
    )
  )
  const routeKey = team ? `/team/${team.slug}/projects` : "/workspace/projects"
  const { activeView, layout, setLayout } = useCollectionLayout(
    routeKey,
    projectViews
  )
  const editable = useAppStore((state) =>
    team ? canEditTeam(state, team.id) : canEditWorkspace(state, scopeId)
  )
  const canCreateProject = editable
  const fallbackProjectView = useMemo(() => {
    const timestamp = new Date().toISOString()

    return (
      createViewDefinition({
        id: `fallback-project-view-${scopeType}-${scopeId}`,
        name: "All projects",
        description: "All projects in this scope.",
        scopeType: team ? "team" : "workspace",
        scopeId,
        entityKind: "projects",
        route: routeKey,
        teamSlug: team?.slug,
        createdAt: timestamp,
        updatedAt: timestamp,
        overrides: {
          layout,
        },
      }) ?? null
    )
  }, [layout, routeKey, scopeId, scopeType, team])
  const effectiveProjectView = activeView ?? fallbackProjectView
  const displayedProjectViews =
    projectViews.length > 0
      ? projectViews
      : fallbackProjectView
        ? [fallbackProjectView]
        : []
  const visibleProjects =
    effectiveProjectView !== null
      ? getVisibleProjectsForView(data, projects, effectiveProjectView)
      : projects
  const emptyProjectsLabel =
    projects.length === 0 ? "No projects yet" : "No projects match the current view."

  if (team && !teamHasFeature(team, "projects")) {
    return <MissingState title="Projects are disabled for this team" />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className={SCREEN_HEADER_CLASS_NAME}>
        <div className="flex min-w-0 items-center gap-2">
          <HeaderTitle title={title} />
          {displayedProjectViews.length > 0 ? (
            <div className="flex items-center gap-1">
              {displayedProjectViews.map((view) =>
                isSystemView(view) ? (
                  <button
                    key={view.id}
                    className={cn(
                      "h-6 rounded-sm px-2 text-xs transition-colors",
                      view.id === effectiveProjectView?.id
                        ? "bg-accent font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => {
                      if (!activeView) {
                        return
                      }

                      useAppStore.getState().setSelectedView(routeKey, view.id)
                    }}
                  >
                    {view.name}
                  </button>
                ) : (
                  <ViewContextMenu key={view.id} view={view}>
                    <button
                      className={cn(
                        "h-6 rounded-sm px-2 text-xs transition-colors",
                        view.id === effectiveProjectView?.id
                          ? "bg-accent font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => {
                        if (!activeView) {
                          return
                        }

                        useAppStore.getState().setSelectedView(routeKey, view.id)
                      }}
                    >
                      {view.name}
                    </button>
                  </ViewContextMenu>
                )
              )}
            </div>
          ) : null}
          {editable ? (
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() =>
                openManagedCreateDialog({
                  kind: "view",
                  defaultScopeType: team ? "team" : "workspace",
                  defaultScopeId: scopeId,
                  defaultEntityKind: "projects",
                  defaultRoute: routeKey,
                  ...(team ? { lockScope: true } : {}),
                  lockEntityKind: true,
                })
              }
            >
              <Plus className="size-3.5" />
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {activeView ? (
            <>
              <ProjectFilterPopover view={activeView} projects={projects} />
              <ProjectViewConfigPopover view={activeView} />
            </>
          ) : (
            <CollectionDisplaySettingsPopover
              layout={layout}
              onLayoutChange={setLayout}
            />
          )}
          {canCreateProject ? (
            <Button
              size="sm"
              variant="default"
              className="h-7 gap-1.5 px-2.5 text-[12px]"
              onClick={() => {
                openManagedCreateDialog({
                  kind: "project",
                  ...(team ? { defaultTeamId: team.id } : {}),
                })
              }}
            >
              <Plus className="size-3.5" />
              New
            </Button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {visibleProjects.length === 0 ? (
          <MissingState title={emptyProjectsLabel} />
        ) : layout === "board" ? (
          <ProjectBoard data={data} projects={visibleProjects} />
        ) : (
          <div className="flex flex-col">
            {visibleProjects.map((project) => {
              const progress = getProjectProgress(data, project.id)
              return (
                <ProjectContextMenu
                  key={project.id}
                  data={data}
                  project={project}
                >
                  <Link
                    className="group flex items-center gap-4 border-b border-line-soft px-7 py-2 transition-colors hover:bg-surface-2"
                    href={getProjectHref(data, project) ?? "/workspace/projects"}
                  >
                  <div
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      project.health === "on-track"
                        ? "bg-[color:var(--status-done)]"
                        : project.health === "at-risk"
                          ? "bg-[color:var(--priority-high)]"
                          : project.health === "off-track"
                            ? "bg-[color:var(--priority-urgent)]"
                            : "bg-fg-4"
                    )}
                  />

                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground group-hover:underline">
                    {project.name}
                  </span>

                  <div className="flex w-[120px] shrink-0 items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-[color:var(--text-2)] transition-all"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[11.5px] text-fg-3 tabular-nums">
                      {progress.percent}%
                    </span>
                  </div>

                  <span className="w-16 shrink-0 text-[12.5px] text-fg-3">
                    {priorityMeta[project.priority].label}
                  </span>

                  <span className="w-24 shrink-0 truncate text-[12.5px] text-fg-3">
                    {getUser(data, project.leadId)?.name ?? "—"}
                  </span>

                  <span className="w-16 shrink-0 text-[12.5px] text-fg-3 tabular-nums">
                    {project.targetDate
                      ? format(new Date(project.targetDate), "MMM d")
                      : "—"}
                  </span>
                  </Link>
                </ProjectContextMenu>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function ViewsScreen({
  scopeType,
  scopeId,
  title,
}: {
  scopeType: "team" | "workspace"
  scopeId: string
  title: string
  description?: string
}) {
  const views = useAppStore(
    useShallow((state) =>
      scopeType === "workspace"
        ? getWorkspaceDirectoryViews(state, scopeId)
        : state.views.filter(
            (view) =>
              !view.containerType &&
              view.scopeType === scopeType &&
              view.scopeId === scopeId
          )
    )
  )
  const viewContext = useAppStore(
    useShallow((state) => ({
      teams: state.teams,
      workspaces: state.workspaces,
      currentWorkspaceId: state.currentWorkspaceId,
    }))
  )
  const viewScopeLabels = useMemo(
    () =>
      Object.fromEntries(
        views.map((view) => [view.id, getViewContextLabel(viewContext, view)])
      ),
    [viewContext, views]
  )
  const [layout, setLayout] = useState<"list" | "board">("list")
  const [sortBy, setSortBy] = useState<"updated" | "name" | "entity">("updated")
  const [showDescriptions, setShowDescriptions] = useState(true)
  const editable = useAppStore((state) =>
    scopeType === "team" ? canEditTeam(state, scopeId) : canEditWorkspace(state, scopeId)
  )
  const orderedViews = [...views].sort((left, right) => {
    if (sortBy === "name") {
      return left.name.localeCompare(right.name)
    }

    if (sortBy === "entity") {
      return (
        formatEntityKind(left.entityKind).localeCompare(
          formatEntityKind(right.entityKind)
        ) || left.name.localeCompare(right.name)
      )
    }

    return right.updatedAt.localeCompare(left.updatedAt)
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <ScreenHeader
        title={title}
        actions={
          <div className="flex items-center gap-1">
            <ViewsDisplaySettingsPopover
              layout={layout}
              onLayoutChange={setLayout}
              sortBy={sortBy}
              showDescriptions={showDescriptions}
              onSortByChange={setSortBy}
              onShowDescriptionsChange={setShowDescriptions}
            />
            {editable ? (
              <Button
                size="sm"
                variant="default"
                className="h-7 gap-1.5 px-2.5 text-[12px]"
                onClick={() =>
                  openManagedCreateDialog({
                    kind: "view",
                    defaultScopeType: scopeType,
                    defaultScopeId: scopeId,
                    ...(scopeType === "team" ? { lockScope: true } : {}),
                  })
                }
              >
                <Plus className="size-3.5" />
                New
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {views.length === 0 ? (
          <MissingState title="No saved views yet" />
        ) : layout === "board" ? (
          <SavedViewsBoard
            views={orderedViews}
            showDescriptions={showDescriptions}
            editable={editable}
            contextLabels={
              scopeType === "workspace" ? viewScopeLabels : undefined
            }
          />
        ) : (
          <div className="px-6">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-normal text-muted-foreground">
                    Name
                  </TableHead>
                  <TableHead className="text-xs font-normal text-muted-foreground">
                    Entity
                  </TableHead>
                  <TableHead className="text-xs font-normal text-muted-foreground">
                    Layout
                  </TableHead>
                  <TableHead className="text-xs font-normal text-muted-foreground">
                    Grouping
                  </TableHead>
                  <TableHead className="text-xs font-normal text-muted-foreground">
                    {scopeType === "workspace" ? "Scope" : "Sharing"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderedViews.map((view) => (
                  <ViewContextMenu key={view.id} view={view}>
                    <TableRow>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Link
                            className="flex items-center gap-2 text-sm font-medium hover:underline"
                            href={getViewHref(view)}
                          >
                            <span className="text-muted-foreground">
                              {getEntityKindIcon(view.entityKind)}
                            </span>
                            {view.name}
                          </Link>
                          {showDescriptions ? (
                            <span className="text-xs text-muted-foreground">
                              {view.description}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatEntityKind(view.entityKind)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {view.layout}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {view.grouping}
                        {view.subGrouping ? ` / ${view.subGrouping}` : ""}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {scopeType === "workspace"
                          ? (viewScopeLabels[view.id] ?? "Workspace")
                          : view.isShared
                            ? "Team"
                            : "Personal"}
                      </TableCell>
                    </TableRow>
                  </ViewContextMenu>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

export function DocsScreen({
  scopeType,
  scopeId,
  team,
  title,
}: {
  scopeType: "team" | "workspace"
  scopeId: string
  team?: Team | null
  title: string
  description?: string
}) {
  const data = useAppStore((state) => state)
  const activeTeamId = useAppStore((state) => state.ui.activeTeamId)
  const teamDocViews = useAppStore(
    useShallow((state) =>
      team ? getViewsForScope(state, "team", scopeId, "docs") : []
    )
  )
  const workspaceDocViews = useAppStore(
    useShallow((state) =>
      scopeType === "workspace" && !team
        ? getViewsForScope(state, "workspace", scopeId, "docs")
        : []
    )
  )
  const isWorkspaceDocs = scopeType === "workspace" && !team
  const [activeTab, setActiveTab] = useState<"workspace" | "private">(
    "workspace"
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const teamRouteKey = team ? `/team/${team.slug}/docs` : "/workspace/docs/team"
  const teamLayoutState = useCollectionLayout(teamRouteKey, teamDocViews)
  const workspaceLayoutState = useCollectionLayout(
    "/workspace/docs",
    workspaceDocViews
  )
  const privateLayoutState = useCollectionLayout("/workspace/docs/private", [])
  const documents = useAppStore(
    useShallow((state) =>
      isWorkspaceDocs
        ? activeTab === "workspace"
          ? getWorkspaceDocuments(state, scopeId)
          : getPrivateDocuments(state, scopeId)
        : getTeamDocuments(state, scopeId)
    )
  )
  const { layout, setLayout } = isWorkspaceDocs
    ? activeTab === "workspace"
      ? workspaceLayoutState
      : privateLayoutState
    : teamLayoutState
  const dialogInput = isWorkspaceDocs
    ? activeTab === "workspace"
      ? ({ kind: "workspace-document", workspaceId: scopeId } as const)
      : ({ kind: "private-document", workspaceId: scopeId } as const)
    : ({
        kind: "team-document",
        teamId: team?.id ?? activeTeamId,
      } as const)
  const editable = useAppStore((state) =>
    team ? canEditTeam(state, team.id) : true
  )
  const emptyTitle = isWorkspaceDocs
    ? activeTab === "workspace"
      ? "No workspace documents yet"
      : "No private documents yet"
    : "No documents yet"

  if (team && !teamHasFeature(team, "docs")) {
    return <MissingState title="Docs are disabled for this team" />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {isWorkspaceDocs ? (
        <div className={SCREEN_HEADER_CLASS_NAME}>
          <div className="flex min-w-0 items-center gap-2">
            <HeaderTitle title={title} />
            <div className="flex items-center gap-1">
              {(["workspace", "private"] as const).map((tab) => (
                <button
                  key={tab}
                  className={cn(
                    "h-6 rounded-sm px-2 text-xs transition-colors",
                    tab === activeTab
                      ? "bg-accent font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "workspace" ? "Workspace" : "Private"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <CollectionDisplaySettingsPopover
              layout={layout}
              onLayoutChange={setLayout}
            />
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <ScreenHeader
          title={title}
          actions={
            <div className="flex items-center gap-1">
              <CollectionDisplaySettingsPopover
                layout={layout}
                onLayoutChange={setLayout}
              />
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          }
        />
      )}
      <CreateDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        input={dialogInput}
        disabled={!editable}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {documents.length === 0 ? (
          <MissingState icon={FileText} title={emptyTitle} />
        ) : layout === "board" ? (
          <DocumentBoard data={data} documents={documents} />
        ) : (
          <div className="flex flex-col divide-y">
            {documents.map((document) => {
              const preview = getDocumentPreview(document)
              const author = getUser(
                data,
                document.updatedBy ?? document.createdBy
              )
              return (
                <DocumentContextMenu
                  key={document.id}
                  data={data}
                  document={document}
                >
                  <Link
                    className="flex items-start px-6 py-3.5 transition-colors hover:bg-accent/40"
                    href={`/docs/${document.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {document.title}
                        </span>
                      </div>
                      {preview ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {preview}
                        </p>
                      ) : null}
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{author?.name ?? "Unknown"}</span>
                        <span>·</span>
                        <span>
                          {format(new Date(document.updatedAt), "MMM d")}
                        </span>
                      </div>
                    </div>
                  </Link>
                </DocumentContextMenu>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Create dialogs                                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                  */

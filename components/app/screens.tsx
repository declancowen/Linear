"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  useEffect,
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
  canAdminTeam,
  canEditTeam,
  getPrivateDocuments,
  getProjectHref,
  getProjectProgress,
  getProjectsForScope,
  getTeam,
  getTeamBySlug,
  getTeamDocuments,
  getUser,
  getViewByRoute,
  getViewsForScope,
  getVisibleWorkItems,
  getWorkspaceDocuments,
  teamHasFeature,
  getWorkspacePersonalViews,
} from "@/lib/domain/selectors"
import {
  getWorkSurfaceCopy,
  priorityMeta,
  type ScopeType,
  type Team,
  type ViewDefinition,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { TeamWorkflowSettingsDialog } from "@/components/app/team-workflow-settings-dialog"
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
import { CreateProjectDialog } from "@/components/app/screens/project-creation"
import {
  DocumentContextMenu,
} from "@/components/app/screens/document-ui"
export { ProjectDetailScreen } from "@/components/app/screens/project-detail-screen"
import {
  DocumentBoard,
  ProjectBoard,
  SavedViewsBoard,
} from "@/components/app/screens/collection-boards"
import { WorkSurface } from "@/components/app/screens/work-surface"
import { getViewHref } from "@/lib/domain/default-views"
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

  return { layout, setLayout }
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
  const { layout, setLayout } = useCollectionLayout(routeKey, projectViews)
  const editable = useAppStore((state) =>
    team ? canEditTeam(state, team.id) : true
  )
  const admin = useAppStore((state) =>
    team ? canAdminTeam(state, team.id) : false
  )
  const canCreateProject = Boolean(team && editable)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (team && !teamHasFeature(team, "projects")) {
    return <MissingState title="Projects are disabled for this team" />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        title={title}
        actions={
          <div className="flex items-center gap-1">
            <CollectionDisplaySettingsPopover
              layout={layout}
              onLayoutChange={setLayout}
              extraAction={
                team && admin ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setSettingsOpen(true)}
                  >
                    Team workflow settings
                  </Button>
                ) : null
              }
            />
            {canCreateProject ? (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            ) : null}
          </div>
        }
      />
      {team && settingsOpen ? (
        <TeamWorkflowSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          teamId={team.id}
        />
      ) : null}
      {team && dialogOpen ? (
        <CreateProjectDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          teamId={team.id}
          disabled={!editable}
        />
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {projects.length === 0 ? (
          <MissingState title="No projects yet" />
        ) : layout === "board" ? (
          <ProjectBoard data={data} projects={projects} />
        ) : (
          <div className="flex flex-col">
            {projects.map((project) => {
              const progress = getProjectProgress(data, project.id)
              return (
                <Link
                  key={project.id}
                  className="group flex items-center gap-4 border-b px-6 py-2.5 transition-colors hover:bg-accent/40"
                  href={getProjectHref(data, project) ?? "/workspace/projects"}
                >
                  {/* Health dot */}
                  <div
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      project.health === "on-track"
                        ? "bg-green-500"
                        : project.health === "at-risk"
                          ? "bg-yellow-500"
                          : project.health === "off-track"
                            ? "bg-red-500"
                            : "bg-muted-foreground/30"
                    )}
                  />

                  {/* Name */}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:underline">
                    {project.name}
                  </span>

                  {/* Progress bar */}
                  <div className="flex w-20 shrink-0 items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {progress.percent}%
                    </span>
                  </div>

                  {/* Priority */}
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">
                    {priorityMeta[project.priority].label}
                  </span>

                  {/* Lead */}
                  <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">
                    {getUser(data, project.leadId)?.name ?? "—"}
                  </span>

                  {/* Target date */}
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">
                    {project.targetDate
                      ? format(new Date(project.targetDate), "MMM d")
                      : "—"}
                  </span>
                </Link>
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
        ? getWorkspacePersonalViews(state)
        : state.views.filter(
            (view) => view.scopeType === scopeType && view.scopeId === scopeId
          )
    )
  )
  const [layout, setLayout] = useState<"list" | "board">("list")
  const [sortBy, setSortBy] = useState<"updated" | "name" | "entity">("updated")
  const [showDescriptions, setShowDescriptions] = useState(true)
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
    <div className="flex min-h-0 flex-1 flex-col">
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
                    Sharing
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderedViews.map((view) => (
                  <TableRow key={view.id}>
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
                      {view.isShared
                        ? scopeType === "workspace"
                          ? "Workspace"
                          : "Team"
                        : "Personal"}
                    </TableCell>
                  </TableRow>
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
    <div className="flex min-h-0 flex-1 flex-col">
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

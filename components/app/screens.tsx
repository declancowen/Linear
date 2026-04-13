"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  format,
  startOfDay,
  subDays,
} from "date-fns"
import {
  ArrowSquareOut,
  CalendarDots,
  CaretDown,
  CaretRight,
  Circle,
  CheckCircle,
  CodesandboxLogo,
  DotsSixVertical,
  DotsThree,
  FadersHorizontal,
  GearSix,
  Kanban,
  FileText,
  NotePencil,
  Plus,
  Rows,
  XCircle,
} from "@phosphor-icons/react"

import {
  buildItemGroups,
  canAdminTeam,
  canEditTeam,
  getCommentsForTarget,
  getDocumentContextLabel,
  getDocument,
  getItemAssignees,
  getPrivateDocuments,
  getProject,
  getProjectProgress,
  getProjectsForScope,
  getTeam,
  getTeamBySlug,
  getTeamDocuments,
  getTemplateDefaultsForTeam,
  getUser,
  getViewByRoute,
  getViewsForScope,
  getVisibleWorkItems,
  getWorkspaceDocuments,
  getStatusOrderForTeam,
  itemMatchesView,
  sortItems,
  teamHasFeature,
} from "@/lib/domain/selectors"
import {
  priorityMeta,
  projectHealthMeta,
  statusMeta,
  templateMeta,
  type AppData,
  type Document,
  type DisplayProperty,
  type GroupField,
  type OrderingField,
  type Priority,
  type Project,
  type ScopeType,
  type Team,
  type ViewDefinition,
  type WorkItem,
  type WorkItemType,
  workItemTypeMeta,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { TeamWorkflowSettingsDialog } from "@/components/app/team-workflow-settings-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const displayPropertyOptions: DisplayProperty[] = [
  "id",
  "type",
  "status",
  "assignee",
  "priority",
  "project",
  "dueDate",
  "milestone",
  "labels",
  "created",
  "updated",
]

const groupOptions: GroupField[] = [
  "project",
  "status",
  "assignee",
  "priority",
  "team",
  "type",
]

const orderingOptions: OrderingField[] = [
  "priority",
  "updatedAt",
  "createdAt",
  "dueDate",
  "targetDate",
  "title",
]

function useCollectionLayout(routeKey: string, views: ViewDefinition[]) {
  const data = useAppStore()
  const selectedView = getViewByRoute(data, routeKey)
  const hasSelectedView = selectedView
    ? views.some((view) => view.id === selectedView.id)
    : false
  const activeView = hasSelectedView ? selectedView : views[0] ?? null
  const [localLayout, setLocalLayout] = useState<"list" | "board">("list")

  useEffect(() => {
    if (!views[0] || hasSelectedView) {
      return
    }

    useAppStore.getState().setSelectedView(routeKey, views[0].id)
  }, [hasSelectedView, routeKey, views])

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
  const data = useAppStore()
  const team = getTeamBySlug(data, teamSlug)

  if (!team) {
    return <MissingState title="Team not found" />
  }

  if (!teamHasFeature(team, "issues")) {
    return <MissingState title="Issues are disabled for this team" />
  }

  const views = getViewsForScope(data, "team", team.id, "items")

  return (
    <WorkSurface
      title="Issues"
      routeKey={`/team/${team.slug}/work`}
      views={views}
      items={getVisibleWorkItems(data, { teamId: team.id })}
      team={team}
      emptyLabel="No work items yet"
    />
  )
}

export function AssignedScreen() {
  const data = useAppStore()
  const views = getViewsForScope(data, "personal", data.currentUserId, "items")

  return (
    <WorkSurface
      title="My issues"
      routeKey="/assigned"
      views={views}
      items={getVisibleWorkItems(data, { assignedToCurrentUser: true })}
      team={getTeam(data, data.ui.activeTeamId)}
      emptyLabel="Nothing is assigned right now"
    />
  )
}

export function InboxScreen() {
  const data = useAppStore()
  const notifications = [...data.notifications]
    .filter((notification) => notification.userId === data.currentUserId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const activeId =
    data.ui.activeInboxNotificationId ?? notifications[0]?.id ?? null
  const activeNotification =
    notifications.find((notification) => notification.id === activeId) ?? null

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col">
      <ScreenHeader title="Inbox" />
      <div className="flex flex-1 min-h-0">
        {/* Notification list */}
        <div className="w-[22rem] shrink-0 border-r">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-medium">Inbox</span>
            <div className="flex items-center gap-1">
              <Button size="icon-xs" variant="ghost">
                <FadersHorizontal className="size-3.5" />
              </Button>
              <Button size="icon-xs" variant="ghost">
                <GearSix className="size-3.5" />
              </Button>
            </div>
          </div>
          <ScrollArea className="h-full">
            <div className="flex flex-col">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  className={cn(
                    "border-b px-4 py-3 text-left transition-colors",
                    notification.id === activeId
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  )}
                  onClick={() => {
                    useAppStore.getState().setActiveInboxNotification(notification.id)
                    useAppStore.getState().markNotificationRead(notification.id)
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className={cn(
                        "text-sm truncate",
                        !notification.readAt && "font-medium"
                      )}>
                        {notification.message}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(notification.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    {notification.readAt ? null : (
                      <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                </button>
              ))}
              {notifications.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground">
                  No notifications
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        {/* Detail pane */}
        <div className="flex-1 min-w-0">
          {activeNotification ? (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline">{activeNotification.type}</Badge>
                <Badge variant="secondary">{activeNotification.entityType}</Badge>
              </div>
              <p className="max-w-2xl text-sm leading-7 mb-4">{activeNotification.message}</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {activeNotification.entityType === "workItem" ? (
                  <Button size="sm" asChild>
                    <Link href={`/items/${activeNotification.entityId}`}>
                      Open work item
                    </Link>
                  </Button>
                ) : null}
                {activeNotification.entityType === "document" ? (
                  <Button size="sm" asChild>
                    <Link href={`/docs/${activeNotification.entityId}`}>Open document</Link>
                  </Button>
                ) : null}
                {activeNotification.entityType === "invite" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      useAppStore.getState().joinTeamByCode(
                        data.teams.find((team) => team.id === activeNotification.entityId)
                          ?.settings.joinCode ?? ""
                      )
                    }
                  >
                    Accept join code
                  </Button>
                ) : null}
              </div>
              <Separator />
              <div className="mt-4 flex gap-6 text-xs text-muted-foreground">
                <span>
                  Read:{" "}
                  {activeNotification.readAt
                    ? format(new Date(activeNotification.readAt), "MMM d, h:mm a")
                    : "Unread"}
                </span>
                <span>
                  Email:{" "}
                  {activeNotification.emailedAt
                    ? format(new Date(activeNotification.emailedAt), "MMM d, h:mm a")
                    : "In-app only"}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No notifications
            </div>
          )}
        </div>
      </div>
    </div>
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
  const data = useAppStore()
  const projects = getProjectsForScope(data, scopeType, scopeId)
  const projectViews = getViewsForScope(
    data,
    scopeType === "team" ? "team" : "workspace",
    scopeId,
    "projects"
  )
  const routeKey = team ? `/team/${team.slug}/projects` : "/workspace/projects"
  const { layout, setLayout } = useCollectionLayout(routeKey, projectViews)
  const editable = team ? canEditTeam(data, team.id) : true
  const admin = team ? canAdminTeam(data, team.id) : false
  const [dialogOpen, setDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (team && !teamHasFeature(team, "projects")) {
    return <MissingState title="Projects are disabled for this team" />
  }

  return (
    <div className="flex flex-col">
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
            <Button size="icon-xs" variant="ghost" onClick={() => setDialogOpen(true)}>
              <Plus className="size-3.5" />
            </Button>
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
      {dialogOpen ? (
        <CreateProjectDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          scopeType={scopeType}
          scopeId={scopeId}
          settingsTeamId={team?.id ?? data.ui.activeTeamId}
          disabled={!editable}
        />
      ) : null}
      {projects.length === 0 ? (
        <MissingState title="No projects yet" />
      ) : layout === "board" ? (
        <ProjectBoard data={data} projects={projects} />
      ) : (
        <div className="px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-normal text-muted-foreground">Name</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground">Health</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground">Priority</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground">Lead</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground">Target date</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                const progress = getProjectProgress(data, project.id)
                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link
                        className="text-sm font-medium hover:underline"
                        href={`/projects/${project.id}`}
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {projectHealthMeta[project.health].label}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {priorityMeta[project.priority].label}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getUser(data, project.leadId)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.targetDate
                        ? format(new Date(project.targetDate), "MMM d")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {progress.percent}%
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
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
  const data = useAppStore()
  const [layout, setLayout] = useState<"list" | "board">("list")
  const [sortBy, setSortBy] = useState<"updated" | "name" | "entity">("updated")
  const [showDescriptions, setShowDescriptions] = useState(true)
  const views = data.views.filter(
    (view) => view.scopeType === scopeType && view.scopeId === scopeId
  )
  const orderedViews = [...views].sort((left, right) => {
    if (sortBy === "name") {
      return left.name.localeCompare(right.name)
    }

    if (sortBy === "entity") {
      return (
        formatEntityKind(left.entityKind).localeCompare(formatEntityKind(right.entityKind)) ||
        left.name.localeCompare(right.name)
      )
    }

    return right.updatedAt.localeCompare(left.updatedAt)
  })

  return (
    <div className="flex flex-col">
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
      {views.length === 0 ? (
        <MissingState title="No saved views yet" />
      ) : layout === "board" ? (
        <SavedViewsBoard views={orderedViews} showDescriptions={showDescriptions} />
      ) : (
        <div className="px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-normal text-muted-foreground">Name</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground">Entity</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground">Layout</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground">Grouping</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground">Sharing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderedViews.map((view) => (
                <TableRow key={view.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <Link
                        className="flex items-center gap-2 text-sm font-medium hover:underline"
                        href={view.route}
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
  const data = useAppStore()
  const isWorkspaceDocs = scopeType === "workspace" && !team
  const [activeTab, setActiveTab] = useState<"workspace" | "private">("workspace")
  const [dialogOpen, setDialogOpen] = useState(false)
  const teamRouteKey = team ? `/team/${team.slug}/docs` : "/workspace/docs/team"
  const teamDocViews = team ? getViewsForScope(data, "team", scopeId, "docs") : []
  const workspaceDocViews = isWorkspaceDocs
    ? getViewsForScope(data, "workspace", scopeId, "docs")
    : []
  const teamLayoutState = useCollectionLayout(teamRouteKey, teamDocViews)
  const workspaceLayoutState = useCollectionLayout("/workspace/docs", workspaceDocViews)
  const privateLayoutState = useCollectionLayout("/workspace/docs/private", [])
  const documents = isWorkspaceDocs
    ? activeTab === "workspace"
      ? getWorkspaceDocuments(data, scopeId)
      : getPrivateDocuments(data, scopeId)
    : getTeamDocuments(data, scopeId)
  const { layout, setLayout } = isWorkspaceDocs
    ? activeTab === "workspace"
      ? workspaceLayoutState
      : privateLayoutState
    : teamLayoutState
  const dialogInput = isWorkspaceDocs
    ? activeTab === "workspace"
      ? ({ kind: "workspace-document", workspaceId: scopeId } as const)
      : ({ kind: "private-document", workspaceId: scopeId } as const)
    : ({ kind: "team-document", teamId: team?.id ?? data.ui.activeTeamId } as const)
  const editable = team ? canEditTeam(data, team.id) : true
  const emptyTitle = isWorkspaceDocs
    ? activeTab === "workspace"
      ? "No workspace documents yet"
      : "No private documents yet"
    : "No documents yet"

  if (team && !teamHasFeature(team, "docs")) {
    return <MissingState title="Docs are disabled for this team" />
  }

  return (
    <div className="flex flex-col">
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
            <Button size="icon-xs" variant="ghost" onClick={() => setDialogOpen(true)}>
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
              <Button size="icon-xs" variant="ghost" onClick={() => setDialogOpen(true)}>
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
      {documents.length === 0 ? (
        <MissingState title={emptyTitle} />
      ) : layout === "board" ? (
        <DocumentBoard data={data} documents={documents} />
      ) : (
        <div className="flex flex-col divide-y px-6">
          {documents.map((document) => {
            const preview = extractTextContent(document.content)
            const author = getUser(data, document.updatedBy ?? document.createdBy)
            return (
              <Link
                key={document.id}
                className="group flex items-start gap-3 px-3 py-3.5 transition-colors hover:bg-accent/40 rounded-md"
                href={`/docs/${document.id}`}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground mt-0.5">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{document.title}</span>
                  </div>
                  {preview ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {preview}
                    </p>
                  ) : null}
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{getDocumentContextLabel(data, document)}</span>
                    <span>·</span>
                    <span>{author?.name ?? "Unknown"}</span>
                    <span>·</span>
                    <span>{format(new Date(document.updatedAt), "MMM d")}</span>
                  </div>
                </div>
                <ArrowSquareOut className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProjectBoard({
  data,
  projects,
}: {
  data: AppData
  projects: Project[]
}) {
  return (
    <div className="grid gap-4 px-6 py-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const progress = getProjectProgress(data, project.id)

        return (
          <Link
            key={project.id}
            className="group flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:border-foreground/15 hover:bg-accent/30"
            href={`/projects/${project.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">
                  {templateMeta[project.templateType].label}
                </span>
                <h2 className="mt-1 text-base font-medium leading-tight">
                  {project.name}
                </h2>
              </div>
              <ArrowSquareOut className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            </div>
            <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
              {project.summary}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary">{projectHealthMeta[project.health].label}</Badge>
              <Badge variant="outline">{priorityMeta[project.priority].label}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Lead</div>
                <div className="truncate">{getUser(data, project.leadId)?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Progress</div>
                <div>{progress.percent}% complete</div>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function SavedViewsBoard({
  views,
  showDescriptions,
}: {
  views: ViewDefinition[]
  showDescriptions: boolean
}) {
  return (
    <div className="grid gap-4 px-6 py-4 sm:grid-cols-2 xl:grid-cols-3">
      {views.map((view) => (
        <Link
          key={view.id}
          className="group flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:border-foreground/15 hover:bg-accent/30"
          href={view.route}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-muted-foreground">
                {getEntityKindIcon(view.entityKind)}
              </span>
              <h2 className="truncate text-base font-medium leading-tight">{view.name}</h2>
            </div>
            <ArrowSquareOut className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>
          {showDescriptions ? (
            <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
              {view.description}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">{formatEntityKind(view.entityKind)}</Badge>
            <Badge variant="outline">{view.layout}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Grouping</div>
              <div className="truncate">
                {view.grouping}
                {view.subGrouping ? ` / ${view.subGrouping}` : ""}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Sharing</div>
              <div>{view.isShared ? "Shared" : "Personal"}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function DocumentBoard({
  data,
  documents,
}: {
  data: AppData
  documents: Document[]
}) {
  return (
    <div className="grid gap-4 px-6 py-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {documents.map((document) => {
        const preview = extractTextContent(document.content)
        const author = getUser(data, document.updatedBy ?? document.createdBy)

        return (
          <Link
            key={document.id}
            className="group flex h-full flex-col rounded-lg border bg-card p-0 transition-colors hover:border-foreground/15 hover:bg-accent/30"
            href={`/docs/${document.id}`}
          >
            {/* Card body */}
            <div className="flex flex-1 flex-col px-4 pt-4 pb-3">
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium leading-snug">
                    {document.title}
                  </h3>
                  <span className="mt-0.5 text-[11px] text-muted-foreground">
                    {getDocumentContextLabel(data, document)}
                  </span>
                </div>
                <ArrowSquareOut className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              {preview ? (
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                  {preview}
                </p>
              ) : (
                <p className="mt-3 text-xs italic text-muted-foreground/50">
                  Empty document
                </p>
              )}
            </div>

            {/* Card footer */}
            <div className="flex items-center gap-2 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
              {author ? (
                <span className="truncate">{author.name}</span>
              ) : null}
              <span className="ml-auto shrink-0">
                {format(new Date(document.updatedAt), "MMM d")}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export function WorkItemDetailScreen({ itemId }: { itemId: string }) {
  const data = useAppStore()
  const item = data.workItems.find((entry) => entry.id === itemId)
  const [propertiesOpen, setPropertiesOpen] = useState(true)

  if (!item) {
    return <MissingState title="Work item not found" />
  }

  const team = getTeam(data, item.teamId)
  const editable = team ? canEditTeam(data, team.id) : false
  const description = getDocument(data, item.descriptionDocId)
  const statusOptions = getStatusOrderForTeam(team).map((status) => ({
    value: status,
    label: statusMeta[status].label,
  }))

  return (
      <div className="flex flex-col h-[calc(100svh-3rem)]">
      {/* Breadcrumb header */}
      <div className="flex items-center justify-between border-b px-6 py-2 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <SidebarTrigger className="size-6 shrink-0" />
          <Link href={`/team/${team?.slug}/work`} className="text-muted-foreground hover:text-foreground">
            {team?.name}
          </Link>
          <CaretRight className="size-3 text-muted-foreground" />
          <span>{item.key} {item.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setPropertiesOpen(!propertiesOpen)}
            className={cn(!propertiesOpen && "text-muted-foreground")}
          >
            <GearSix className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main content — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-8">
            {/* Title */}
            <h1 className="text-2xl font-semibold mb-1">{item.title}</h1>

            {/* Description — seamless inline editor */}
            <div className="mt-4">
              <RichTextEditor
                content={description?.content ?? "<p>Add a description…</p>"}
                editable={editable}
                placeholder="Add a description…"
                onChange={(content) =>
                  useAppStore.getState().updateItemDescription(item.id, content)
                }
                onUploadAttachment={(file) =>
                  useAppStore.getState().uploadAttachment("workItem", item.id, file)
                }
              />
            </div>

            {/* Sub-issues */}
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground py-2 mt-4">
              <Plus className="size-3.5" />
              Add sub-issues
            </button>

            <Separator className="my-6" />

            {/* Activity */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Activity</h3>
              </div>
              <CommentsInline
                targetType="workItem"
                targetId={item.id}
                editable={editable}
              />
            </div>
          </div>
        </div>

        {/* Collapsible right sidebar */}
        {propertiesOpen && (
          <div className="w-72 shrink-0 border-l overflow-y-auto">
            <div className="flex flex-col p-4">
              <CollapsibleSection title="Properties" defaultOpen>
                <PropertySelect
                  label="Status"
                  value={item.status}
                  disabled={!editable}
                  options={statusOptions}
                  onValueChange={(value) =>
                    useAppStore.getState().updateWorkItem(item.id, {
                      status: value as WorkItem["status"],
                    })
                  }
                />
                <PropertySelect
                  label="Priority"
                  value={item.priority}
                  disabled={!editable}
                  options={Object.entries(priorityMeta).map(([value, meta]) => ({
                    value,
                    label: meta.label,
                  }))}
                  onValueChange={(value) =>
                    useAppStore.getState().updateWorkItem(item.id, {
                      priority: value as Priority,
                    })
                  }
                />
                <PropertySelect
                  label="Assignee"
                  value={item.assigneeId ?? "unassigned"}
                  disabled={!editable}
                  options={[
                    { value: "unassigned", label: "Assign" },
                    ...data.users.map((user) => ({ value: user.id, label: user.name })),
                  ]}
                  onValueChange={(value) =>
                    useAppStore.getState().updateWorkItem(item.id, {
                      assigneeId: value === "unassigned" ? null : value,
                    })
                  }
                />
              </CollapsibleSection>

              <Separator className="my-3" />

              <CollapsibleSection title="Labels" defaultOpen>
                <span className="text-sm text-muted-foreground">
                  {item.labelIds.length > 0
                    ? item.labelIds
                        .map((id) => data.labels.find((l) => l.id === id)?.name)
                        .filter(Boolean)
                        .join(", ")
                    : "Add label"}
                </span>
              </CollapsibleSection>

              <Separator className="my-3" />

              <CollapsibleSection title="Project" defaultOpen>
                <PropertySelect
                  label=""
                  value={item.primaryProjectId ?? "none"}
                  disabled={!editable}
                  options={[
                    { value: "none", label: "No project" },
                    ...data.projects.map((project) => ({
                      value: project.id,
                      label: project.name,
                    })),
                  ]}
                  onValueChange={(value) =>
                    useAppStore.getState().updateWorkItem(item.id, {
                      primaryProjectId: value === "none" ? null : value,
                    })
                  }
                />
              </CollapsibleSection>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function ProjectDetailScreen({ projectId }: { projectId: string }) {
  const data = useAppStore()
  const project = data.projects.find((entry) => entry.id === projectId)

  if (!project) {
    return <MissingState title="Project not found" />
  }

  const progress = getProjectProgress(data, project.id)
  const items = sortItems(
    data.workItems.filter(
      (item) =>
        item.primaryProjectId === project.id || item.linkedProjectIds.includes(project.id)
    ),
    "priority"
  )
  const milestones = data.milestones.filter((milestone) => milestone.projectId === project.id)
  const updates = data.projectUpdates.filter((update) => update.projectId === project.id)

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-2">
        <div className="flex items-center gap-2 text-sm">
          <SidebarTrigger className="size-6 shrink-0" />
          <span className="font-medium">{project.name}</span>
        </div>
      </div>

      <div className="grid flex-1 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Main content */}
        <div className="flex flex-col p-6 gap-6">
          <div>
            <h1 className="text-2xl font-semibold mb-1">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.summary}</p>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="h-9 bg-transparent border-b rounded-none w-full justify-start gap-0 px-0">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                Overview
              </TabsTrigger>
              <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                Activity
              </TabsTrigger>
              <TabsTrigger value="issues" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                Issues
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
              <div className="flex flex-col gap-4">
                {project.description && (
                  <div className="text-sm leading-7 text-muted-foreground">
                    {project.description}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Milestones</h3>
                  {milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{milestone.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {milestone.targetDate
                            ? format(new Date(milestone.targetDate), "MMM d")
                            : "No date"}
                        </span>
                      </div>
                      <Badge variant="secondary">{statusMeta[milestone.status].label}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="activity" className="mt-4">
              <div className="flex flex-col gap-3">
                {updates.map((update) => (
                  <div key={update.id} className="flex flex-col gap-1 border-b pb-3">
                    <span className="text-sm font-medium">
                      {getUser(data, update.createdBy)?.name}
                    </span>
                    <p className="text-sm text-muted-foreground">{update.content}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="issues" className="mt-4">
              <div className="flex flex-col">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    className="flex items-center justify-between border-b px-2 py-2.5 hover:bg-accent/50 transition-colors"
                    href={`/items/${item.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <StatusIcon status={item.status} />
                      <span className="text-sm">{item.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.key}</span>
                  </Link>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar */}
        <div className="border-l">
          <div className="flex flex-col gap-1 p-4">
            <SidebarSection title="Properties">
              <PropertyRow label="Status" value={projectHealthMeta[project.health].label} />
              <PropertyRow label="Priority" value={priorityMeta[project.priority].label} />
              <PropertyRow label="Lead" value={getUser(data, project.leadId)?.name ?? "—"} />
              <PropertyRow
                label="Target"
                value={
                  project.targetDate
                    ? format(new Date(project.targetDate), "MMM d, yyyy")
                    : "—"
                }
              />
            </SidebarSection>

            <Separator className="my-2" />

            <SidebarSection title="Progress">
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Scope</span>
                  <div className="font-semibold">{progress.scope}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed</span>
                  <div className="font-semibold">{progress.completed}</div>
                </div>
              </div>
            </SidebarSection>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DocumentDetailScreen({ documentId }: { documentId: string }) {
  const data = useAppStore()
  const document = data.documents.find((entry) => entry.id === documentId)

  if (!document || document.kind === "item-description") {
    return <MissingState title="Document not found" />
  }

  const team = document.teamId ? getTeam(data, document.teamId) : null
  const editable = document.kind === "team-document" ? !!team && canEditTeam(data, team.id) : true
  const updater = getUser(data, document.updatedBy ?? document.createdBy)
  const backHref = team ? `/team/${team.slug}/docs` : "/workspace/docs"

  return (
    <div className="flex flex-col h-[calc(100svh-3rem)]">
      {/* Breadcrumb header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <SidebarTrigger className="size-5 shrink-0" />
          <Link
            href={backHref}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {getDocumentContextLabel(data, document)}
          </Link>
          <CaretRight className="size-3 text-muted-foreground" />
          <span className="truncate font-medium">{document.title}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {updater ? (
            <span>
              Edited by {updater.name} · {format(new Date(document.updatedAt), "MMM d, h:mm a")}
            </span>
          ) : null}
        </div>
      </div>

      {/* Full canvas editor */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <RichTextEditor
          content={document.content}
          editable={editable}
          fullPage
          placeholder="Start writing…"
          onChange={(content) =>
            useAppStore.getState().updateDocumentContent(document.id, content)
          }
          onUploadAttachment={
            document.kind === "team-document"
              ? (file) =>
                  useAppStore.getState().uploadAttachment("document", document.id, file)
              : undefined
          }
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  WorkSurface — issues list/board/timeline container                 */
/* ------------------------------------------------------------------ */

function WorkSurface({
  title,
  routeKey,
  views,
  items,
  team,
  emptyLabel,
}: {
  title: string
  routeKey: string
  views: ViewDefinition[]
  items: WorkItem[]
  team: Team | null
  emptyLabel: string
}) {
  const data = useAppStore()
  const activeView =
    getViewByRoute(data, routeKey) ?? views[0] ?? null
  const editable = team ? canEditTeam(data, team.id) : false
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    if (!activeView && views[0]) {
      useAppStore.getState().setSelectedView(routeKey, views[0].id)
    }
  }, [activeView, routeKey, views])

  const filteredItems = activeView
    ? items.filter((item) => itemMatchesView(data, item, activeView))
    : items

  return (
    <div className="flex flex-col">
      {/* Screen header with tabs */}
      <div className={SCREEN_HEADER_CLASS_NAME}>
        <div className="flex min-w-0 items-center gap-2">
          <HeaderTitle title={title} />
          {views.length > 0 && activeView ? (
            <div className="flex items-center gap-1">
              {views.map((view) => (
                <button
                  key={view.id}
                  className={cn(
                    "h-6 rounded-sm px-2 text-xs transition-colors",
                    view.id === activeView.id
                      ? "bg-accent font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => useAppStore.getState().setSelectedView(routeKey, view.id)}
                >
                  {view.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {activeView ? (
            <>
              <FilterPopover view={activeView} items={items} />
              <ViewConfigPopover view={activeView} />
            </>
          ) : null}
          <Button size="icon-xs" variant="ghost" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      <CreateWorkItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teamId={team?.id ?? data.ui.activeTeamId}
        disabled={!editable}
      />

      {/* View content */}
      <div className="flex-1">
        {activeView ? (
          <>
            {activeView.layout === "board" ? (
              <BoardView
                data={data}
                items={filteredItems}
                view={activeView}
                editable={editable}
              />
            ) : null}
            {activeView.layout === "list" ? (
              <ListView
                data={data}
                items={filteredItems}
                view={activeView}
              />
            ) : null}
            {activeView.layout === "timeline" ? (
              <TimelineView
                data={data}
                items={filteredItems}
                view={activeView}
                editable={editable}
              />
            ) : null}
          </>
        ) : (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        )}
        {activeView && filteredItems.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Filter & View Config popovers                                      */
/* ------------------------------------------------------------------ */

function FilterPopover({
  view,
  items,
}: {
  view: ViewDefinition
  items: WorkItem[]
}) {
  const data = useAppStore()
  const teamIds = [...new Set(items.map((item) => item.teamId))]
  const singleTeam = teamIds.length === 1 ? getTeam(data, teamIds[0]) : null
  const assignees = getItemAssignees(data, items)
  const projects = data.projects.filter((project) =>
    items.some((item) => item.primaryProjectId === project.id)
  )
  const labels = data.labels.filter((label) =>
    items.some((item) => item.labelIds.includes(label.id))
  )
  const statusOptions = getStatusOrderForTeam(singleTeam)

  const activeCount =
    view.filters.status.length +
    view.filters.priority.length +
    view.filters.assigneeIds.length +
    view.filters.projectIds.length +
    view.filters.labelIds.length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="ghost" className="relative">
          <FadersHorizontal className="size-3.5" />
          {activeCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Filters</span>
        </div>
        <div className="flex flex-col gap-0 p-2">
          <FilterSection label="Status">
            {statusOptions.map((status) => (
              <FilterChip
                key={status}
                label={statusMeta[status].label}
                active={view.filters.status.includes(status)}
                onClick={() =>
                  useAppStore.getState().toggleViewFilterValue(view.id, "status", status)
                }
              />
            ))}
          </FilterSection>
          <FilterSection label="Priority">
            {Object.entries(priorityMeta).map(([priority, meta]) => (
              <FilterChip
                key={priority}
                label={meta.label}
                active={view.filters.priority.includes(priority as Priority)}
                onClick={() =>
                  useAppStore.getState().toggleViewFilterValue(view.id, "priority", priority)
                }
              />
            ))}
          </FilterSection>
          <FilterSection label="Assignee">
            {assignees.map((assignee) => (
              <FilterChip
                key={assignee.id}
                label={assignee.name}
                active={view.filters.assigneeIds.includes(assignee.id)}
                onClick={() =>
                  useAppStore.getState().toggleViewFilterValue(view.id, "assigneeIds", assignee.id)
                }
              />
            ))}
          </FilterSection>
          <FilterSection label="Project">
            {projects.map((project) => (
              <FilterChip
                key={project.id}
                label={project.name}
                active={view.filters.projectIds.includes(project.id)}
                onClick={() =>
                  useAppStore.getState().toggleViewFilterValue(view.id, "projectIds", project.id)
                }
              />
            ))}
          </FilterSection>
          <FilterSection label="Labels">
            {labels.map((label) => (
              <FilterChip
                key={label.id}
                label={label.name}
                active={view.filters.labelIds.includes(label.id)}
                onClick={() =>
                  useAppStore.getState().toggleViewFilterValue(view.id, "labelIds", label.id)
                }
              />
            ))}
          </FilterSection>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ViewConfigPopover({ view }: { view: ViewDefinition }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="ghost">
          <GearSix className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        {/* Layout toggle */}
        <div className="border-b p-2">
          <div className="flex rounded-md bg-muted/60 p-0.5">
            {[
              { value: "list", label: "List", icon: <Rows className="size-3" /> },
              { value: "board", label: "Board", icon: <Kanban className="size-3" /> },
              { value: "timeline", label: "Timeline", icon: <CalendarDots className="size-3" /> },
            ].map((layout) => (
              <button
                key={layout.value}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-sm py-1 text-xs transition-colors",
                  view.layout === layout.value
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() =>
                  useAppStore
                    .getState()
                    .updateViewConfig(view.id, { layout: layout.value as ViewDefinition["layout"] })
                }
              >
                {layout.icon}
                {layout.label}
              </button>
            ))}
          </div>
        </div>

        {/* Config options */}
        <div className="flex flex-col gap-0 p-2">
          <ConfigSelect
            label="Grouping"
            value={view.grouping}
            options={groupOptions.map((o) => ({ value: o, label: o }))}
            onValueChange={(value) =>
              useAppStore.getState().updateViewConfig(view.id, { grouping: value as GroupField })
            }
          />
          <ConfigSelect
            label="Sub-grouping"
            value={view.subGrouping ?? "none"}
            options={[
              { value: "none", label: "None" },
              ...groupOptions.map((o) => ({ value: o, label: o })),
            ]}
            onValueChange={(value) =>
              useAppStore.getState().updateViewConfig(view.id, {
                subGrouping: value === "none" ? null : (value as GroupField),
              })
            }
          />
          <ConfigSelect
            label="Ordering"
            value={view.ordering}
            options={orderingOptions.map((o) => ({ value: o, label: o }))}
            onValueChange={(value) =>
              useAppStore.getState().updateViewConfig(view.id, { ordering: value as OrderingField })
            }
          />
          <ConfigSelect
            label="Completed"
            value={String(view.filters.showCompleted)}
            options={[
              { value: "true", label: "All" },
              { value: "false", label: "Hide" },
            ]}
            onValueChange={(value) =>
              useAppStore.getState().updateViewConfig(view.id, { showCompleted: value === "true" })
            }
          />
        </div>

        <Separator />

        {/* Display properties */}
        <div className="p-2">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Properties
          </div>
          <div className="flex flex-wrap gap-1">
            {displayPropertyOptions.map((property) => (
              <button
                key={property}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs transition-colors",
                  view.displayProps.includes(property)
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
                onClick={() =>
                  useAppStore.getState().toggleViewDisplayProperty(view.id, property)
                }
              >
                {property}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------------------------------------------ */
/*  Board view                                                         */
/* ------------------------------------------------------------------ */

function BoardView({
  data,
  items,
  view,
  editable,
}: {
  data: AppData
  items: WorkItem[]
  view: ViewDefinition
  editable: boolean
}) {
  const groups = [...buildItemGroups(data, items, view).entries()]
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const hiddenGroups = groups.filter(([groupName]) =>
    view.hiddenState.groups.includes(groupName)
  )
  const visibleGroups = groups.filter(
    ([groupName]) => !view.hiddenState.groups.includes(groupName)
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveItemId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItemId(null)

    if (!editable || !event.over) {
      return
    }

    const [scope, groupValue, subgroupValue] = String(event.over.id).split("::")
    if (scope !== "board") {
      return
    }

    const patch = {
      ...getPatchForField(data, view.grouping, groupValue),
      ...getPatchForField(data, view.subGrouping, subgroupValue),
    }

    useAppStore.getState().updateWorkItem(String(event.active.id), patch)
  }

  const activeItem = items.find((item) => item.id === activeItemId) ?? null

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="w-full">
        <div className="flex min-w-max gap-2 p-3">
          {visibleGroups.map(([groupName, subgroups]) => {
            const groupCount = Array.from(subgroups.values()).flat().length
            return (
              <div key={groupName} className="flex w-[20rem] shrink-0 flex-col rounded-lg bg-muted/50">
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={groupName as WorkItem["status"]} />
                    <span className="text-sm font-medium">{groupName}</span>
                    <span className="text-xs text-muted-foreground">{groupCount}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button size="icon-xs" variant="ghost">
                      <DotsThree className="size-3.5" />
                    </Button>
                    <Button size="icon-xs" variant="ghost">
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {/* Column items */}
                <div className="flex flex-col gap-1.5 px-2 pb-2">
                  {Array.from(subgroups.entries()).map(([subgroupName, subItems]) => {
                    const hidden = view.hiddenState.subgroups.includes(subgroupName)
                    if (hidden) return null

                    return (
                      <BoardDropLane
                        key={`${groupName}-${subgroupName}`}
                        id={`board::${groupName}::${subgroupName}`}
                      >
                        {subItems.map((item) => (
                          <DraggableWorkCard
                            key={item.id}
                            item={item}
                            data={data}
                          />
                        ))}
                      </BoardDropLane>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {hiddenGroups.length > 0 ? (
        <div className="border-t px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Hidden columns</span>
            {hiddenGroups.map(([groupName]) => (
              <button
                key={groupName}
                className="rounded-md border px-2 py-0.5 text-xs hover:bg-accent"
                onClick={() =>
                  useAppStore.getState().toggleViewHiddenValue(view.id, "groups", groupName)
                }
              >
                {groupName}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <DragOverlay>
        {activeItem ? (
          <div className="w-[18rem]">
            <BoardCardBody data={data} item={activeItem} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

/* ------------------------------------------------------------------ */
/*  List view                                                          */
/* ------------------------------------------------------------------ */

function ListView({
  data,
  items,
  view,
}: {
  data: AppData
  items: WorkItem[]
  view: ViewDefinition
}) {
  const groups = [...buildItemGroups(data, items, view).entries()]
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(groupName: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col">
      {groups.map(([groupName, subgroups]) => {
        if (view.hiddenState.groups.includes(groupName)) {
          return null
        }

        const groupCount = Array.from(subgroups.values()).flat().length
        const isCollapsed = collapsedGroups.has(groupName)

        return (
          <div key={groupName}>
            {/* Group header */}
            <button
              className="flex w-full items-center gap-2 border-b px-4 py-2 hover:bg-accent/50 transition-colors"
              onClick={() => toggleGroup(groupName)}
            >
              {isCollapsed ? (
                <CaretRight className="size-3 text-muted-foreground" />
              ) : (
                <CaretDown className="size-3 text-muted-foreground" />
              )}
              <StatusIcon status={groupName as WorkItem["status"]} />
              <span className="text-sm font-medium">{groupName}</span>
              <span className="text-xs text-muted-foreground">{groupCount}</span>
            </button>

            {/* Group items */}
            {!isCollapsed && (
              <div className="flex flex-col">
                {Array.from(subgroups.entries()).map(([subgroupName, subItems]) => {
                  if (view.hiddenState.subgroups.includes(subgroupName)) {
                    return null
                  }

                  return (
                    <div key={`${groupName}-${subgroupName}`}>
                      {view.subGrouping ? (
                        <div className="border-b bg-accent/30 px-8 py-1.5 text-xs font-medium text-muted-foreground">
                          {subgroupName}
                        </div>
                      ) : null}
                      {subItems.map((item) => (
                        <ListRow
                          key={item.id}
                          data={data}
                          item={item}
                          displayProps={view.displayProps}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {view.hiddenState.groups.length > 0 ? (
        <div className="border-t px-4 py-3">
          <div className="text-xs text-muted-foreground mb-2">Hidden rows</div>
          {view.hiddenState.groups.map((groupName) => (
            <button
              key={groupName}
              className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
              onClick={() =>
                useAppStore.getState().toggleViewHiddenValue(view.id, "groups", groupName)
              }
            >
              <StatusIcon status={groupName as WorkItem["status"]} />
              <span>{groupName}</span>
              <span className="text-xs text-muted-foreground ml-auto">0</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Timeline view                                                      */
/* ------------------------------------------------------------------ */

function TimelineView({
  data,
  items,
  view,
  editable,
}: {
  data: AppData
  items: WorkItem[]
  view: ViewDefinition
  editable: boolean
}) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const today = startOfDay(new Date())
  const timelineStart = startOfDay(subDays(new Date(), 3))
  const timelineEnd = endOfDay(addDays(new Date(), 24))
  const days = eachDayOfInterval({
    start: timelineStart,
    end: timelineEnd,
  })
  const groups = [...buildItemGroups(data, items, { ...view, subGrouping: null }).entries()]

  // Find week boundaries for header grouping
  const weeks: { label: string; span: number }[] = []
  let currentWeekLabel = ""
  let currentSpan = 0
  for (const day of days) {
    const weekLabel = format(day, "MMM d")
    const weekOfYear = format(day, "'W'ww")
    if (weekOfYear !== currentWeekLabel && currentWeekLabel) {
      weeks.push({ label: format(subDays(day, currentSpan), "MMM d") + " – " + format(subDays(day, 1), "MMM d"), span: currentSpan })
      currentSpan = 0
    }
    currentWeekLabel = weekOfYear
    currentSpan++
  }
  if (currentSpan > 0) {
    weeks.push({ label: format(days[days.length - currentSpan], "MMM d") + " – " + format(days[days.length - 1], "MMM d"), span: currentSpan })
  }

  const todayIndex = differenceInCalendarDays(today, timelineStart)

  function handleDragStart(event: DragStartEvent) {
    setActiveItemId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItemId(null)

    if (!editable || !event.over) {
      return
    }

    const [scope, itemId, date] = String(event.over.id).split("::")
    if (scope !== "timeline") {
      return
    }

    useAppStore.getState().shiftTimelineItem(itemId, new Date(date).toISOString())
  }

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col overflow-x-auto">
        {/* Sticky header */}
        <div
          className="sticky top-0 z-10 grid min-w-[90rem] border-b bg-background"
          style={{ gridTemplateColumns: "14rem 1fr" }}
        >
          {/* Label column header */}
          <div className="flex items-end border-r px-3 py-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Items
            </span>
          </div>
          {/* Week + day headers */}
          <div className="flex flex-col">
            {/* Week row */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${days.length}, minmax(2.5rem, 1fr))`,
              }}
            >
              {weeks.map((week, i) => (
                <div
                  key={i}
                  className="border-b border-r px-2 py-1.5 text-center text-[10px] font-medium text-muted-foreground"
                  style={{ gridColumn: `span ${week.span}` }}
                >
                  {week.label}
                </div>
              ))}
            </div>
            {/* Day row */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${days.length}, minmax(2.5rem, 1fr))`,
              }}
            >
              {days.map((day, i) => {
                const isToday_ = differenceInCalendarDays(day, today) === 0
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-r px-1 py-1.5 text-center text-[10px]",
                      isToday_
                        ? "bg-primary/10 font-semibold text-primary"
                        : isWeekend
                          ? "text-muted-foreground/50"
                          : "text-muted-foreground"
                    )}
                  >
                    {format(day, "EEE")[0]} {format(day, "d")}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="relative min-w-[90rem]">
          {/* Today marker */}
          {todayIndex >= 0 && todayIndex < days.length ? (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-[5] w-px bg-primary/40"
              style={{
                left: `calc(14rem + (${todayIndex} + 0.5) * ((100% - 14rem) / ${days.length}))`,
              }}
            />
          ) : null}

          {groups.map(([groupName, subgroups]) => {
            if (view.hiddenState.groups.includes(groupName)) {
              return null
            }

            const groupItems = Array.from(subgroups.values()).flat()

            return (
              <div key={groupName}>
                {/* Group header */}
                <div
                  className="grid min-w-[90rem] border-b bg-muted/30"
                  style={{ gridTemplateColumns: "14rem 1fr" }}
                >
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="text-xs font-medium">{groupName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {groupItems.length}
                    </span>
                  </div>
                  <div />
                </div>

                {/* Rows */}
                {groupItems.map((item) => (
                  <TimelineRow
                    key={item.id}
                    data={data}
                    days={days}
                    item={item}
                    timelineStart={timelineStart}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <DragOverlay>
        {activeItemId ? (
          <div className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium shadow-lg">
            {data.workItems.find((item) => item.id === activeItemId)?.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

/* ------------------------------------------------------------------ */
/*  Row / card primitives                                              */
/* ------------------------------------------------------------------ */

function ListRow({
  data,
  item,
  displayProps,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
}) {
  return (
    <Link
      href={`/items/${item.id}`}
      className="flex items-center gap-3 border-b px-4 py-2 hover:bg-accent/50 transition-colors group"
    >
      {/* Three-dot menu */}
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.preventDefault()}
      >
        <DotsThree className="size-4 text-muted-foreground" />
      </button>

      {/* Issue key */}
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{item.key}</span>

      {/* Status icon */}
      <StatusIcon status={item.status} />

      {/* Title */}
      <span className="flex-1 text-sm truncate">{item.title}</span>

      {/* Display properties */}
      {displayProps.includes("priority") && (
        <span className="text-xs text-muted-foreground shrink-0">
          {priorityMeta[item.priority].label}
        </span>
      )}
      {displayProps.includes("assignee") && (
        <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] text-muted-foreground">
          {item.assigneeId
            ? getUser(data, item.assigneeId)?.avatarUrl ?? "?"
            : ""}
        </div>
      )}
      {displayProps.includes("project") && (
        <span className="text-xs text-muted-foreground shrink-0">
          {getProject(data, item.primaryProjectId)?.name ?? ""}
        </span>
      )}
      {displayProps.includes("created") && (
        <span className="text-xs text-muted-foreground shrink-0">
          {format(new Date(item.createdAt), "MMM d")}
        </span>
      )}
      {displayProps.includes("updated") && (
        <span className="text-xs text-muted-foreground shrink-0">
          {format(new Date(item.updatedAt), "MMM d")}
        </span>
      )}
    </Link>
  )
}

function BoardDropLane({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-8 flex-col gap-2 rounded-md p-1 transition-colors",
        isOver ? "bg-accent/50" : ""
      )}
    >
      {children}
    </div>
  )
}

function DraggableWorkCard({
  data,
  item,
}: {
  data: AppData
  item: WorkItem
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging ? "opacity-60" : "opacity-100")}
    >
      <BoardCardBody
        data={data}
        item={item}
        dragHandle={
          <button
            type="button"
            className="cursor-grab rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Drag ${item.title}`}
            {...listeners}
            {...attributes}
          >
            <DotsSixVertical className="size-4" />
          </button>
        }
      />
    </div>
  )
}

function BoardCardBody({
  data,
  item,
  dragHandle,
}: {
  data: AppData
  item: WorkItem
  dragHandle?: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-border/50 bg-card p-3 shadow-xs transition-shadow hover:shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-xs text-muted-foreground">{item.key}</span>
        <div className="flex items-center gap-1.5">
          <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] text-muted-foreground">
            {item.assigneeId
              ? getUser(data, item.assigneeId)?.avatarUrl ?? "?"
              : ""}
          </div>
          {dragHandle}
        </div>
      </div>
      <Link
        className="flex flex-col rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={`/items/${item.id}`}
      >
        <div className="text-sm font-medium leading-snug hover:underline">
          {item.title}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <StatusIcon status={item.status} />
          {item.primaryProjectId ? (
            <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[10px]">
              {getProject(data, item.primaryProjectId)?.name}
            </Badge>
          ) : null}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Created {format(new Date(item.createdAt), "MMM d")}
        </div>
      </Link>
    </div>
  )
}

function TimelineRow({
  data,
  item,
  days,
  timelineStart,
}: {
  data: AppData
  item: WorkItem
  days: Date[]
  timelineStart: Date
}) {
  const startDate = startOfDay(new Date(item.startDate ?? item.targetDate ?? days[0]))
  const endDate = startOfDay(
    new Date(item.targetDate ?? item.dueDate ?? item.startDate ?? days[0])
  )
  const startIndex = Math.max(
    0,
    differenceInCalendarDays(startDate, startOfDay(days[0]))
  )
  const span = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1)
  const assignees = getItemAssignees(data, [item])

  return (
    <div
      className="group/row grid min-w-[90rem] border-b transition-colors hover:bg-accent/20"
      style={{ gridTemplateColumns: "14rem 1fr" }}
    >
      {/* Left label */}
      <div className="flex items-center gap-2.5 border-r px-3 py-2">
        <div
          className={cn(
            "size-2 shrink-0 rounded-full",
            item.status === "done"
              ? "bg-green-500"
              : item.status === "in-progress"
                ? "bg-blue-500"
                : item.status === "cancelled"
                  ? "bg-red-500"
                  : "bg-muted-foreground/30"
          )}
        />
        <div className="min-w-0 flex-1">
          <Link
            className="block truncate text-sm hover:underline"
            href={`/items/${item.id}`}
          >
            {item.title}
          </Link>
        </div>
        {assignees[0] ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {assignees[0].name.split(" ")[0]}
          </span>
        ) : null}
      </div>

      {/* Grid area */}
      <div className="relative">
        {/* Drop cells */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${days.length}, minmax(2.5rem, 1fr))`,
          }}
        >
          {days.map((day) => (
            <TimelineDropCell
              key={`${item.id}-${day.toISOString()}`}
              id={`timeline::${item.id}::${day.toISOString()}`}
              isWeekend={day.getDay() === 0 || day.getDay() === 6}
            />
          ))}
        </div>

        {/* Bar overlay */}
        <div
          className="pointer-events-none absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${days.length}, minmax(2.5rem, 1fr))`,
          }}
        >
          <div
            className="pointer-events-auto flex h-full items-center px-0.5 py-1.5"
            style={{ gridColumn: `${startIndex + 1} / span ${span}` }}
          >
            <TimelineBar item={item} span={span} />
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineDropCell({ id, isWeekend }: { id: string; isWeekend: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-9 border-r transition-colors",
        isWeekend && "bg-muted/20",
        isOver && "bg-primary/10"
      )}
    />
  )
}

const barColors: Record<string, string> = {
  "backlog": "bg-muted-foreground/20 text-foreground",
  "todo": "bg-muted-foreground/30 text-foreground",
  "in-progress": "bg-blue-500/90 text-white",
  "in-review": "bg-violet-500/90 text-white",
  "done": "bg-green-500/80 text-white",
  "cancelled": "bg-red-400/60 text-white",
}

function TimelineBar({ item, span }: { item: WorkItem; span: number }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
  })

  const colorClass = barColors[item.status] ?? "bg-primary text-primary-foreground"

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "flex h-full w-full items-center rounded-[5px] px-2 text-left text-[11px] font-medium shadow-sm transition-shadow hover:shadow-md",
        colorClass
      )}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
    >
      <span className="truncate">
        {span >= 3 ? item.title : item.key}
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Comments (inline version for detail screens)                       */
/* ------------------------------------------------------------------ */

function CommentsInline({
  targetType,
  targetId,
  editable,
}: {
  targetType: "workItem" | "document"
  targetId: string
  editable: boolean
}) {
  const data = useAppStore()
  const comments = getCommentsForTarget(data, targetType, targetId)
  const [content, setContent] = useState("")

  return (
    <div className="flex flex-col gap-4">
      {comments.map((comment) => (
        <div key={comment.id} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {getUser(data, comment.createdBy)?.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(comment.createdAt), "MMM d, h:mm a")}
            </span>
          </div>
          <p className="text-sm leading-7 text-muted-foreground">{comment.content}</p>
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <Textarea
          disabled={!editable}
          placeholder="Leave a comment..."
          className="min-h-[4rem] resize-none"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            disabled={!editable || !content.trim()}
            onClick={() => {
              useAppStore.getState().addComment({ targetType, targetId, content })
              setContent("")
            }}
          >
            Comment
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Create dialogs                                                     */
/* ------------------------------------------------------------------ */

function CreateProjectDialog({
  open,
  onOpenChange,
  scopeType,
  scopeId,
  settingsTeamId,
  disabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scopeType: ScopeType
  scopeId: string
  settingsTeamId: string | null
  disabled: boolean
}) {
  const data = useAppStore()
  const settingsTeam = settingsTeamId ? getTeam(data, settingsTeamId) : null
  const initialTemplateType: Project["templateType"] = "software-delivery"
  const initialTemplateDefaults = getTemplateDefaultsForTeam(
    settingsTeam,
    initialTemplateType
  )
  const [templateType, setTemplateType] =
    useState<Project["templateType"]>(initialTemplateType)
  const [name, setName] = useState("New Project")
  const [summary, setSummary] = useState(initialTemplateDefaults.summaryHint)
  const [priority, setPriority] = useState<Priority>(
    initialTemplateDefaults.defaultPriority
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Name</FieldLabel>
            <FieldContent>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Summary</FieldLabel>
            <FieldContent>
              <Input value={summary} onChange={(event) => setSummary(event.target.value)} />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Template</FieldLabel>
            <FieldContent>
              <Select
                value={templateType}
                onValueChange={(value) => {
                  const nextTemplateType = value as Project["templateType"]
                  const nextDefaults = getTemplateDefaultsForTeam(
                    settingsTeam,
                    nextTemplateType
                  )
                  setTemplateType(nextTemplateType)
                  setPriority(nextDefaults.defaultPriority)
                  setSummary(nextDefaults.summaryHint)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(templateMeta).map(([value, meta]) => (
                      <SelectItem key={value} value={value}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Priority</FieldLabel>
            <FieldContent>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as Priority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(priorityMeta).map(([value, meta]) => (
                      <SelectItem key={value} value={value}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={disabled}
            onClick={() => {
              useAppStore.getState().createProject({
                scopeType,
                scopeId,
                templateType,
                name,
                summary,
                priority,
                settingsTeamId,
              })
              onOpenChange(false)
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateDocumentDialog({
  open,
  onOpenChange,
  input,
  disabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  input:
    | { kind: "team-document"; teamId: string }
    | { kind: "workspace-document" | "private-document"; workspaceId: string }
  disabled: boolean
}) {
  const defaultTitle =
    input.kind === "private-document"
      ? "New Private Document"
      : input.kind === "workspace-document"
        ? "New Workspace Document"
        : "New Team Document"
  const [title, setTitle] = useState(defaultTitle)
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTitle(defaultTitle)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create document</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Title</FieldLabel>
            <FieldContent>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </FieldContent>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={disabled}
            onClick={() => {
              useAppStore.getState().createDocument({ ...input, title })
              onOpenChange(false)
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateWorkItemDialog({
  open,
  onOpenChange,
  teamId,
  disabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  disabled: boolean
}) {
  const data = useAppStore()
  const teamProjects = data.projects.filter(
    (project) =>
      (project.scopeType === "team" && project.scopeId === teamId) ||
      (project.scopeType === "workspace" &&
        getTeam(data, teamId)?.workspaceId === project.scopeId)
  )
  const [type, setType] = useState<WorkItemType>("task")
  const [title, setTitle] = useState("New work item")
  const [priority, setPriority] = useState<Priority>("medium")
  const [assigneeId, setAssigneeId] = useState<string>("user_declan")
  const [projectId, setProjectId] = useState<string>("none")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create work item</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Title</FieldLabel>
            <FieldContent>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Type</FieldLabel>
            <FieldContent>
              <Select
                value={type}
                onValueChange={(value) => setType(value as WorkItemType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(workItemTypeMeta).map(([value, meta]) => (
                      <SelectItem key={value} value={value}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Priority</FieldLabel>
            <FieldContent>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as Priority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(priorityMeta).map(([value, meta]) => (
                      <SelectItem key={value} value={value}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Assignee</FieldLabel>
            <FieldContent>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {data.users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Primary project</FieldLabel>
            <FieldContent>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">No project</SelectItem>
                    {teamProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={disabled}
            onClick={() => {
              useAppStore.getState().createWorkItem({
                teamId,
                type,
                title,
                priority,
                assigneeId: assigneeId === "none" ? null : assigneeId,
                primaryProjectId: projectId === "none" ? null : projectId,
              })
              onOpenChange(false)
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                  */
/* ------------------------------------------------------------------ */

function ScreenHeader({
  title,
  icon,
  actions,
}: {
  title: string
  icon?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className={SCREEN_HEADER_CLASS_NAME}>
      <HeaderTitle icon={icon} title={title} />
      {actions}
    </div>
  )
}

function ViewsDisplaySettingsPopover({
  layout,
  onLayoutChange,
  sortBy,
  showDescriptions,
  onSortByChange,
  onShowDescriptionsChange,
}: {
  layout: "list" | "board"
  onLayoutChange: (value: "list" | "board") => void
  sortBy: "updated" | "name" | "entity"
  showDescriptions: boolean
  onSortByChange: (value: "updated" | "name" | "entity") => void
  onShowDescriptionsChange: (value: boolean) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="ghost">
          <GearSix className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Display</span>
        </div>
        <div className="flex flex-col gap-0 p-2">
          <ConfigSelect
            label="Layout"
            value={layout}
            options={[
              { value: "list", label: "List" },
              { value: "board", label: "Board" },
            ]}
            onValueChange={(value) => onLayoutChange(value as "list" | "board")}
          />
          <ConfigSelect
            label="Sort"
            value={sortBy}
            options={[
              { value: "updated", label: "Updated" },
              { value: "name", label: "Name" },
              { value: "entity", label: "Entity" },
            ]}
            onValueChange={(value) =>
              onSortByChange(value as "updated" | "name" | "entity")
            }
          />
          <ConfigSelect
            label="Descriptions"
            value={showDescriptions ? "show" : "hide"}
            options={[
              { value: "show", label: "Show" },
              { value: "hide", label: "Hide" },
            ]}
            onValueChange={(value) => onShowDescriptionsChange(value === "show")}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function CollectionDisplaySettingsPopover({
  layout,
  onLayoutChange,
  extraAction,
}: {
  layout: "list" | "board"
  onLayoutChange: (layout: "list" | "board") => void
  extraAction?: React.ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="ghost">
          <GearSix className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-0">
        <div className="border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Display</span>
        </div>
        <div className="p-2">
          <ConfigSelect
            label="Layout"
            value={layout}
            options={[
              { value: "list", label: "List" },
              { value: "board", label: "Board" },
            ]}
            onValueChange={(value) => onLayoutChange(value as "list" | "board")}
          />
          {extraAction ? (
            <>
              <Separator className="my-1" />
              {extraAction}
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

const SCREEN_HEADER_CLASS_NAME =
  "flex min-h-10 items-center justify-between gap-2 border-b px-6 py-2"

function HeaderTitle({
  icon,
  title,
}: {
  icon?: React.ReactNode
  title: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <SidebarTrigger className="size-6 shrink-0" />
      {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      <h1 className="truncate text-sm font-medium">{title}</h1>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  const statusLower = status.toLowerCase()
  if (statusLower === "done" || statusLower === "completed") {
    return <CheckCircle className="size-3.5 shrink-0 text-green-600" weight="fill" />
  }
  if (statusLower === "in-progress" || statusLower === "in progress") {
    return <Circle className="size-3.5 shrink-0 text-yellow-500" weight="fill" />
  }
  if (statusLower === "cancelled" || statusLower === "duplicate") {
    return <XCircle className="size-3.5 shrink-0 text-muted-foreground" weight="fill" />
  }
  if (statusLower === "todo") {
    return <Circle className="size-3.5 shrink-0 text-muted-foreground" />
  }
  // backlog / default
  return <Circle className="size-3.5 shrink-0 text-muted-foreground/50" />
}

function SidebarSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      {children}
    </div>
  )
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="flex flex-col">
      <button
        className="flex items-center gap-1.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <CaretDown className="size-3" />
        ) : (
          <CaretRight className="size-3" />
        )}
        {title}
      </button>
      {open && <div className="flex flex-col gap-0.5 mt-0.5">{children}</div>}
    </div>
  )
}

function PropertySelect({
  label,
  value,
  options,
  onValueChange,
  disabled,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1">
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      <Select disabled={disabled} value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-7 w-auto min-w-28 border-none bg-transparent shadow-none text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

function ConfigSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-6 w-auto min-w-24 border-none bg-transparent text-xs shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function FilterSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="py-1.5">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        "rounded-md px-2 py-0.5 text-xs transition-colors",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function MissingState({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
      {title}
    </div>
  )
}

function formatEntityKind(entityKind: ViewDefinition["entityKind"]) {
  if (entityKind === "items") {
    return "Issues"
  }

  if (entityKind === "projects") {
    return "Projects"
  }

  return "Docs"
}

function getEntityKindIcon(entityKind: ViewDefinition["entityKind"]) {
  if (entityKind === "items") {
    return <CodesandboxLogo className="size-4" />
  }

  if (entityKind === "projects") {
    return <Kanban className="size-4" />
  }

  return <NotePencil className="size-4" />
}

function extractTextContent(content: string) {
  return content
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getPatchForField(
  data: AppData,
  field: GroupField | null,
  value: string
) {
  if (!field || value === "all") return {}
  if (field === "status") return { status: value as WorkItem["status"] }
  if (field === "priority") return { priority: value as Priority }
  if (field === "assignee") {
    const user = data.users.find((entry) => entry.name === value)
    return { assigneeId: user?.id ?? null }
  }
  if (field === "project") {
    const project = data.projects.find((entry) => entry.name === value)
    return { primaryProjectId: project?.id ?? null }
  }
  return {}
}

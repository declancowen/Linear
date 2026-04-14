"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type SyntheticEvent,
} from "react"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  pointerWithin,
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
  SidebarSimple,
  Trash,
  XCircle,
} from "@phosphor-icons/react"

import {
  buildItemGroups,
  canAdminTeam,
  canEditTeam,
  getChannelPostHref,
  getCommentsForTarget,
  getConversationHref,
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
  getTeamMembers,
  getTemplateDefaultsForTeam,
  getUser,
  getViewByRoute,
  getViewsForScope,
  getVisibleWorkItems,
  getWorkItem,
  getWorkItemDescendantIds,
  getWorkspaceUsers,
  getWorkspaceDocuments,
  getStatusOrderForTeam,
  itemMatchesView,
  sortItems,
  teamHasFeature,
  getWorkspacePersonalViews,
} from "@/lib/domain/selectors"
import {
  canParentWorkItemTypeAcceptChild,
  getDisplayLabelForWorkItemType,
  getAllowedTemplateTypesForTeamExperience,
  getAllowedChildWorkItemTypesForItem,
  getAllowedWorkItemTypesForTemplate,
  getDefaultTemplateTypeForTeamExperience,
  getDefaultWorkItemTypesForTeamExperience,
  getWorkSurfaceCopy,
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
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { ProjectTemplateGlyph } from "@/components/app/entity-icons"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { TeamWorkflowSettingsDialog } from "@/components/app/team-workflow-settings-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CollapsibleRightSidebar } from "@/components/ui/collapsible-right-sidebar"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
// Field components available from @/components/ui/field if needed
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { getViewHref } from "@/lib/domain/default-views"
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
  const searchParams = useSearchParams()
  const selectedView = getViewByRoute(data, routeKey)
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
  const data = useAppStore()
  const team = getTeamBySlug(data, teamSlug)

  if (!team) {
    return <MissingState title="Team not found" />
  }

  const workCopy = getWorkSurfaceCopy(team.settings.experience)

  if (!teamHasFeature(team, "issues")) {
    return <MissingState title={workCopy.disabledLabel} />
  }

  const views = getViewsForScope(data, "team", team.id, "items")

  return (
    <WorkSurface
      title={workCopy.surfaceLabel}
      routeKey={`/team/${team.slug}/work`}
      views={views}
      items={getVisibleWorkItems(data, { teamId: team.id })}
      team={team}
      emptyLabel={workCopy.emptyLabel}
    />
  )
}

export function AssignedScreen() {
  const data = useAppStore()
  const views = getViewsForScope(data, "personal", data.currentUserId, "items")

  return (
    <WorkSurface
      title="My items"
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
  const activeChannelPostHref = activeNotification
    ? getChannelPostHref(data, activeNotification.entityId)
    : null
  const activeChatHref = activeNotification
    ? getConversationHref(data, activeNotification.entityId)
    : null

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col">
      <ScreenHeader title="Inbox" />
      <div className="flex min-h-0 flex-1">
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
                    useAppStore
                      .getState()
                      .setActiveInboxNotification(notification.id)
                    useAppStore.getState().markNotificationRead(notification.id)
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span
                        className={cn(
                          "truncate text-sm",
                          !notification.readAt && "font-medium"
                        )}
                      >
                        {notification.message}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(
                          new Date(notification.createdAt),
                          "MMM d, h:mm a"
                        )}
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
        <div className="min-w-0 flex-1">
          {activeNotification ? (
            <div className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Badge variant="outline">{activeNotification.type}</Badge>
                <Badge variant="secondary">
                  {activeNotification.entityType}
                </Badge>
              </div>
              <p className="mb-4 max-w-2xl text-sm leading-7">
                {activeNotification.message}
              </p>
              <div className="mb-6 flex flex-wrap gap-2">
                {activeNotification.entityType === "workItem" ? (
                  <Button size="sm" asChild>
                    <Link href={`/items/${activeNotification.entityId}`}>
                      Open work item
                    </Link>
                  </Button>
                ) : null}
                {activeNotification.entityType === "document" ? (
                  <Button size="sm" asChild>
                    <Link href={`/docs/${activeNotification.entityId}`}>
                      Open document
                    </Link>
                  </Button>
                ) : null}
                {activeNotification.entityType === "channelPost" &&
                activeChannelPostHref ? (
                  <Button size="sm" asChild>
                    <Link href={activeChannelPostHref}>Open channel post</Link>
                  </Button>
                ) : null}
                {activeNotification.entityType === "chat" && activeChatHref ? (
                  <Button size="sm" asChild>
                    <Link href={activeChatHref}>Open chat</Link>
                  </Button>
                ) : null}
                {activeNotification.entityType === "invite" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      useAppStore
                        .getState()
                        .joinTeamByCode(
                          data.teams.find(
                            (team) => team.id === activeNotification.entityId
                          )?.settings.joinCode ?? ""
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
                    ? format(
                        new Date(activeNotification.readAt),
                        "MMM d, h:mm a"
                      )
                    : "Unread"}
                </span>
                <span>
                  Email:{" "}
                  {activeNotification.emailedAt
                    ? format(
                        new Date(activeNotification.emailedAt),
                        "MMM d, h:mm a"
                      )
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
        <div className="flex flex-col">
          {projects.map((project, index) => {
            const progress = getProjectProgress(data, project.id)
            return (
              <Link
                key={project.id}
                className="group flex items-center gap-4 border-b px-6 py-2.5 transition-colors hover:bg-accent/40"
                href={`/projects/${project.id}`}
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
                  <span className="text-[11px] tabular-nums text-muted-foreground">
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
  const views =
    scopeType === "workspace"
      ? getWorkspacePersonalViews(data)
      : data.views.filter(
          (view) => view.scopeType === scopeType && view.scopeId === scopeId
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
  const [activeTab, setActiveTab] = useState<"workspace" | "private">(
    "workspace"
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const teamRouteKey = team ? `/team/${team.slug}/docs` : "/workspace/docs/team"
  const teamDocViews = team
    ? getViewsForScope(data, "team", scopeId, "docs")
    : []
  const workspaceDocViews = isWorkspaceDocs
    ? getViewsForScope(data, "workspace", scopeId, "docs")
    : []
  const teamLayoutState = useCollectionLayout(teamRouteKey, teamDocViews)
  const workspaceLayoutState = useCollectionLayout(
    "/workspace/docs",
    workspaceDocViews
  )
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
    : ({
        kind: "team-document",
        teamId: team?.id ?? data.ui.activeTeamId,
      } as const)
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
      {documents.length === 0 ? (
        <MissingState title={emptyTitle} />
      ) : layout === "board" ? (
        <DocumentBoard data={data} documents={documents} />
      ) : (
        <div className="flex flex-col divide-y px-6">
          {documents.map((document) => {
            const preview = extractTextContent(document.content)
            const author = getUser(
              data,
              document.updatedBy ?? document.createdBy
            )
            return (
              <Link
                key={document.id}
                className="group flex items-start gap-3 rounded-md px-3 py-3.5 transition-colors hover:bg-accent/40"
                href={`/docs/${document.id}`}
              >
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                  <FileText className="size-4" />
                </div>
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
    <div className="grid gap-3 px-6 py-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const progress = getProjectProgress(data, project.id)

        return (
          <Link
            key={project.id}
            className="group flex h-full flex-col rounded-lg border border-border/70 bg-card p-4 transition-shadow hover:shadow-md"
            href={`/projects/${project.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
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
                  <span className="text-[11px] text-muted-foreground">
                    {projectHealthMeta[project.health].label}
                  </span>
                </div>
                <h2 className="mt-1.5 text-sm leading-snug font-medium group-hover:underline">
                  {project.name}
                </h2>
              </div>
              <ArrowSquareOut className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {project.summary}
            </p>

            {/* Progress bar */}
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {progress.percent}%
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{priorityMeta[project.priority].label}</span>
              <span className="truncate">
                {getUser(data, project.leadId)?.name ?? "Unassigned"}
              </span>
              <span>
                {project.targetDate
                  ? format(new Date(project.targetDate), "MMM d")
                  : "No date"}
              </span>
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
          href={getViewHref(view)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-muted-foreground">
                {getEntityKindIcon(view.entityKind)}
              </span>
              <h2 className="truncate text-base leading-tight font-medium">
                {view.name}
              </h2>
            </div>
            <ArrowSquareOut className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>
          {showDescriptions ? (
            <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
              {view.description}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">
              {formatEntityKind(view.entityKind)}
            </Badge>
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
                  <h3 className="text-sm leading-snug font-medium">
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
                <p className="mt-3 text-xs text-muted-foreground/50 italic">
                  Empty document
                </p>
              )}
            </div>

            {/* Card footer */}
            <div className="flex items-center gap-2 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
              {author ? <span className="truncate">{author.name}</span> : null}
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

function getEligibleParentWorkItems(data: AppData, item: WorkItem) {
  const blockedIds = getWorkItemDescendantIds(data, item.id)

  if (blockedIds.size > 0) {
    return []
  }

  return sortItems(
    data.workItems.filter(
      (candidate) =>
        candidate.teamId === item.teamId &&
        candidate.id !== item.id &&
        candidate.parentId === null &&
        !blockedIds.has(candidate.id) &&
        canParentWorkItemTypeAcceptChild(candidate.type, item.type)
    ),
    "priority"
  )
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatInlineDescriptionContent(value: string) {
  return value
    .trim()
    .split(/\n{2,}/)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`
    )
    .join("")
}

export function WorkItemDetailScreen({ itemId }: { itemId: string }) {
  const router = useRouter()
  const data = useAppStore()
  const item = data.workItems.find((entry) => entry.id === itemId)
  const [deletingItem, setDeletingItem] = useState(false)
  const [childComposerOpen, setChildComposerOpen] = useState(false)
  const [subIssuesOpen, setSubIssuesOpen] = useState(true)
  const [propertiesOpen, setPropertiesOpen] = useState(true)

  if (!item) {
    if (deletingItem) {
      return null
    }

    return <MissingState title="Work item not found" />
  }

  const currentItem = item
  const team = getTeam(data, currentItem.teamId)
  const workCopy = getWorkSurfaceCopy(team?.settings.experience)
  const editable = team ? canEditTeam(data, team.id) : false
  const description = getDocument(data, currentItem.descriptionDocId)
  const statusOptions = getStatusOrderForTeam(team).map((status) => ({
    value: status,
    label: statusMeta[status].label,
  }))
  const teamMembers = team ? getTeamMembers(data, team.id) : []
  const teamProjects = team
    ? data.projects.filter(
        (project) =>
          (project.scopeType === "team" && project.scopeId === team.id) ||
          (project.scopeType === "workspace" &&
            project.scopeId === team.workspaceId)
      )
    : []
  const parentItem = currentItem.parentId
    ? getWorkItem(data, currentItem.parentId)
    : null
  const childItems = sortItems(
    data.workItems.filter((entry) => entry.parentId === currentItem.id),
    "priority"
  )
  const parentOptions = [
    { value: "none", label: "No parent" },
    ...getEligibleParentWorkItems(data, currentItem).map((candidate) => ({
      value: candidate.id,
      label: `${candidate.key} · ${candidate.title}`,
    })),
  ]
  const allowedChildTypes = getAllowedChildWorkItemTypesForItem(currentItem)
  const canCreateChildIssue = editable && allowedChildTypes.length > 0
  const descendantCount = getWorkItemDescendantIds(data, currentItem.id).size
  const completedChildItems = childItems.filter(
    (child) => child.status === "done"
  ).length
  const showSubIssuesSection =
    currentItem.parentId === null || childItems.length > 0
  const displayedEndDate = currentItem.targetDate ?? currentItem.dueDate

  function buildEndDatePatch(nextEndDate: string | null) {
    return {
      dueDate: currentItem.dueDate ? nextEndDate : undefined,
      targetDate:
        currentItem.targetDate || !currentItem.dueDate
          ? nextEndDate
          : undefined,
    }
  }

  function handleStartDateChange(nextStartDate: string | null) {
    const patch: {
      startDate?: string | null
      dueDate?: string | null
      targetDate?: string | null
    } = {
      startDate: nextStartDate,
    }

    if (
      nextStartDate &&
      displayedEndDate &&
      new Date(nextStartDate).getTime() > new Date(displayedEndDate).getTime()
    ) {
      Object.assign(patch, buildEndDatePatch(nextStartDate))
    }

    useAppStore.getState().updateWorkItem(currentItem.id, patch)
  }

  function handleEndDateChange(nextEndDate: string | null) {
    const patch: {
      startDate?: string | null
      dueDate?: string | null
      targetDate?: string | null
    } = buildEndDatePatch(nextEndDate)

    if (
      nextEndDate &&
      currentItem.startDate &&
      new Date(nextEndDate).getTime() <
        new Date(currentItem.startDate).getTime()
    ) {
      patch.startDate = nextEndDate
    }

    useAppStore.getState().updateWorkItem(currentItem.id, patch)
  }

  async function handleDeleteItem() {
    const itemLabel = getDisplayLabelForWorkItemType(
      currentItem.type,
      team?.settings.experience
    ).toLowerCase()
    const cascadeMessage =
      descendantCount > 0
        ? `Delete this ${itemLabel} and ${descendantCount} nested item${
            descendantCount === 1 ? "" : "s"
          }?`
        : `Delete this ${itemLabel}?`

    if (
      typeof window !== "undefined" &&
      !window.confirm(`${cascadeMessage} This can't be undone.`)
    ) {
      return
    }

    setDeletingItem(true)

    const deleted = await useAppStore.getState().deleteWorkItem(currentItem.id)

    if (!deleted) {
      setDeletingItem(false)
      return
    }

    router.replace(team?.slug ? `/team/${team.slug}/work` : "/inbox")
  }

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col">
      {/* Breadcrumb header */}
      <div className="flex shrink-0 items-center justify-between border-b px-6 py-2">
        <div className="flex items-center gap-2 text-sm">
          <SidebarTrigger className="size-6 shrink-0" />
          <Link
            href={`/team/${team?.slug}/work`}
            className="text-muted-foreground hover:text-foreground"
          >
            {team?.name}
          </Link>
          <CaretRight className="size-3 text-muted-foreground" />
          <span>
            {currentItem.key} {currentItem.title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {editable ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" disabled={deletingItem}>
                  <DotsThree className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 min-w-44">
                <DropdownMenuItem
                  variant="destructive"
                  disabled={deletingItem}
                  onSelect={(event) => {
                    event.preventDefault()
                    void handleDeleteItem()
                  }}
                >
                  <Trash className="size-4" />
                  Delete{" "}
                  {getDisplayLabelForWorkItemType(
                    currentItem.type,
                    team?.settings.experience
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
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
        {/* Main content — scrollable */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-8 py-8">
            {/* Title */}
            {parentItem ? (
              <Link
                href={`/items/${parentItem.id}`}
                className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <span>{workCopy.parentLabel}</span>
                <Badge variant="outline">{parentItem.key}</Badge>
                <span className="truncate">{parentItem.title}</span>
              </Link>
            ) : null}
            <h1 className="mb-1 text-2xl font-semibold">{currentItem.title}</h1>

            {/* Description — seamless inline editor */}
            <div className="mt-4">
              <RichTextEditor
                content={description?.content ?? "<p>Add a description…</p>"}
                editable={editable}
                placeholder="Add a description…"
                mentionCandidates={
                  team ? getTeamMembers(data, team.id) : data.users
                }
                onChange={(content) =>
                  useAppStore
                    .getState()
                    .updateItemDescription(currentItem.id, content)
                }
                onUploadAttachment={(file) =>
                  useAppStore
                    .getState()
                    .uploadAttachment("workItem", currentItem.id, file)
                }
              />
            </div>

            {showSubIssuesSection ? (
              <div className="mt-8">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setSubIssuesOpen((current) => !current)}
                  >
                    {subIssuesOpen ? (
                      <CaretDown className="size-3" />
                    ) : (
                      <CaretRight className="size-3" />
                    )}
                    <span>{workCopy.childPluralLabel}</span>
                    <span className="text-xs font-normal tabular-nums">
                      {completedChildItems}/{childItems.length}
                    </span>
                  </button>
                  {canCreateChildIssue ? (
                    <Button
                      size="icon-sm"
                      variant={childComposerOpen ? "outline" : "ghost"}
                      disabled={!canCreateChildIssue}
                      onClick={() => {
                        setSubIssuesOpen(true)
                        setChildComposerOpen((current) => !current)
                      }}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  ) : null}
                </div>

                {/* Progress bar */}
                {childItems.length > 0 ? (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{
                        width: `${childItems.length > 0 ? (completedChildItems / childItems.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                ) : null}

                {subIssuesOpen ? (
                  <div className="mt-3 flex flex-col rounded-lg border">
                    {childItems.map((child, index) => (
                      <Link
                        key={child.id}
                        href={`/items/${child.id}`}
                        className={cn(
                          "group/sub flex items-center gap-3 px-3 py-2 transition-colors hover:bg-accent/40",
                          index !== childItems.length - 1 && "border-b"
                        )}
                      >
                        <StatusIcon status={child.status} />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {child.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {child.key}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {priorityMeta[child.priority].label}
                        </span>
                        {child.assigneeId ? (
                          <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] text-muted-foreground">
                            {getUser(data, child.assigneeId)?.avatarUrl ?? "?"}
                          </div>
                        ) : null}
                      </Link>
                    ))}

                    {childComposerOpen ? (
                      <div className="border-t">
                        <InlineChildIssueComposer
                          teamId={currentItem.teamId}
                          parentItem={currentItem}
                          disabled={!editable}
                          onCancel={() => setChildComposerOpen(false)}
                          onCreated={() => setChildComposerOpen(false)}
                        />
                      </div>
                    ) : canCreateChildIssue ? (
                      <button
                        type="button"
                        className={cn(
                          "inline-flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground",
                          childItems.length > 0 && "border-t"
                        )}
                        onClick={() => setChildComposerOpen(true)}
                      >
                        <Plus className="size-3" />
                        <span>{workCopy.addChildLabel}</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <Separator className="my-6" />

            {/* Activity */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Activity</h3>
              </div>
              <CommentsInline
                targetType="workItem"
                targetId={currentItem.id}
                editable={editable}
              />
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <CollapsibleRightSidebar open={propertiesOpen} width="18rem">
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col p-4">
              <CollapsibleSection title="Properties" defaultOpen>
                <PropertySelect
                  label="Status"
                  value={currentItem.status}
                  disabled={!editable}
                  options={statusOptions}
                  onValueChange={(value) =>
                    useAppStore.getState().updateWorkItem(currentItem.id, {
                      status: value as WorkItem["status"],
                    })
                  }
                />
                <PropertySelect
                  label="Priority"
                  value={currentItem.priority}
                  disabled={!editable}
                  options={Object.entries(priorityMeta).map(
                    ([value, meta]) => ({
                      value,
                      label: meta.label,
                    })
                  )}
                  onValueChange={(value) =>
                    useAppStore.getState().updateWorkItem(currentItem.id, {
                      priority: value as Priority,
                    })
                  }
                />
                <PropertySelect
                  label="Assignee"
                  value={currentItem.assigneeId ?? "unassigned"}
                  disabled={!editable}
                  options={[
                    { value: "unassigned", label: "Assign" },
                    ...teamMembers.map((user) => ({
                      value: user.id,
                      label: user.name,
                    })),
                  ]}
                  onValueChange={(value) =>
                    useAppStore.getState().updateWorkItem(currentItem.id, {
                      assigneeId: value === "unassigned" ? null : value,
                    })
                  }
                />
                <PropertySelect
                  label="Parent"
                  value={currentItem.parentId ?? "none"}
                  disabled={
                    !editable ||
                    (parentOptions.length === 1 && !currentItem.parentId)
                  }
                  options={parentOptions}
                  onValueChange={(value) =>
                    useAppStore.getState().updateWorkItem(currentItem.id, {
                      parentId: value === "none" ? null : value,
                    })
                  }
                />
              </CollapsibleSection>

              <Separator className="my-3" />

              <CollapsibleSection title="Schedule" defaultOpen>
                <PropertyDateField
                  label="Start date"
                  value={currentItem.startDate}
                  disabled={!editable}
                  onValueChange={handleStartDateChange}
                />
                <PropertyDateField
                  label="End date"
                  value={displayedEndDate}
                  disabled={!editable}
                  onValueChange={handleEndDateChange}
                />
              </CollapsibleSection>

              <Separator className="my-3" />

              <CollapsibleSection title="Labels" defaultOpen>
                <span className="text-sm text-muted-foreground">
                  {currentItem.labelIds.length > 0
                    ? currentItem.labelIds
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
                  value={currentItem.primaryProjectId ?? "none"}
                  disabled={!editable}
                  options={[
                    { value: "none", label: "No project" },
                    ...teamProjects.map((project) => ({
                      value: project.id,
                      label: project.name,
                    })),
                  ]}
                  onValueChange={(value) =>
                    useAppStore.getState().updateWorkItem(currentItem.id, {
                      primaryProjectId: value === "none" ? null : value,
                    })
                  }
                />
              </CollapsibleSection>
            </div>
          </div>
        </CollapsibleRightSidebar>
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
        item.primaryProjectId === project.id ||
        item.linkedProjectIds.includes(project.id)
    ),
    "priority"
  )
  const milestones = data.milestones.filter(
    (milestone) => milestone.projectId === project.id
  )
  const updates = data.projectUpdates.filter(
    (update) => update.projectId === project.id
  )

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
        <div className="flex flex-col gap-6 p-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ProjectTemplateGlyph
                templateType={project.templateType}
                className="size-3.5"
              />
              <span>{templateMeta[project.templateType].label}</span>
            </div>
            <h1 className="mb-1 text-2xl font-semibold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.summary}</p>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="h-9 w-full justify-start gap-0 rounded-none border-b bg-transparent px-0">
              <TabsTrigger
                value="overview"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Activity
              </TabsTrigger>
              <TabsTrigger
                value="issues"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Items
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
                        <span className="text-sm font-medium">
                          {milestone.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {milestone.targetDate
                            ? format(new Date(milestone.targetDate), "MMM d")
                            : "No date"}
                        </span>
                      </div>
                      <Badge variant="secondary">
                        {statusMeta[milestone.status].label}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="activity" className="mt-4">
              <div className="flex flex-col gap-3">
                {updates.map((update) => (
                  <div
                    key={update.id}
                    className="flex flex-col gap-1 border-b pb-3"
                  >
                    <span className="text-sm font-medium">
                      {getUser(data, update.createdBy)?.name}
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {update.content}
                    </p>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="issues" className="mt-4">
              <div className="flex flex-col">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    className="flex items-center justify-between border-b px-2 py-2.5 transition-colors hover:bg-accent/50"
                    href={`/items/${item.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <StatusIcon status={item.status} />
                      <span className="text-sm">{item.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.key}
                    </span>
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
              <PropertyRow
                label="Status"
                value={projectHealthMeta[project.health].label}
              />
              <PropertyRow
                label="Priority"
                value={priorityMeta[project.priority].label}
              />
              <PropertyRow
                label="Lead"
                value={getUser(data, project.leadId)?.name ?? "—"}
              />
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
  const editable =
    document.kind === "team-document"
      ? !!team && canEditTeam(data, team.id)
      : true
  const updater = getUser(data, document.updatedBy ?? document.createdBy)
  const backHref = team ? `/team/${team.slug}/docs` : "/workspace/docs"

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col">
      {/* Breadcrumb header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <SidebarTrigger className="size-5 shrink-0" />
          <Link
            href={backHref}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {getDocumentContextLabel(data, document)}
          </Link>
          <CaretRight className="size-3 text-muted-foreground" />
          <span className="truncate font-medium">{document.title}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {updater ? (
            <span>
              Edited by {updater.name} ·{" "}
              {format(new Date(document.updatedAt), "MMM d, h:mm a")}
            </span>
          ) : null}
        </div>
      </div>

      {/* Full canvas editor */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <RichTextEditor
          content={document.content}
          editable={editable}
          fullPage
          placeholder="Start writing…"
          mentionCandidates={
            team
              ? getTeamMembers(data, team.id)
              : getWorkspaceUsers(data, data.currentWorkspaceId)
          }
          onChange={(content) =>
            useAppStore.getState().updateDocumentContent(document.id, content)
          }
          onUploadAttachment={
            document.kind === "team-document"
              ? (file) =>
                  useAppStore
                    .getState()
                    .uploadAttachment("document", document.id, file)
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
  const searchParams = useSearchParams()
  const activeView = getViewByRoute(data, routeKey) ?? views[0] ?? null
  const editable = team ? canEditTeam(data, team.id) : false
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    if (!activeView && views[0]) {
      useAppStore.getState().setSelectedView(routeKey, views[0].id)
    }
  }, [activeView, routeKey, views])

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

  const filteredItems = activeView
    ? items.filter((item) => itemMatchesView(data, item, activeView))
    : items
  const visibleItems =
    activeView?.layout === "timeline"
      ? filteredItems.filter((item) => item.parentId === null)
      : filteredItems

  return (
    <div className="flex min-w-0 flex-col">
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
                  onClick={() =>
                    useAppStore.getState().setSelectedView(routeKey, view.id)
                  }
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
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {dialogOpen ? (
        <CreateWorkItemDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          teamId={team?.id ?? data.ui.activeTeamId}
          disabled={!editable}
        />
      ) : null}

      {/* View content */}
      <div className="min-w-0 flex-1 overflow-hidden">
        {activeView ? (
          <>
            {activeView.layout === "board" ? (
              <BoardView
                data={data}
                items={visibleItems}
                view={activeView}
                editable={editable}
              />
            ) : null}
            {activeView.layout === "list" ? (
              <ListView data={data} items={visibleItems} view={activeView} />
            ) : null}
            {activeView.layout === "timeline" ? (
              <TimelineView
                data={data}
                items={visibleItems}
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
        {activeView && visibleItems.length === 0 ? (
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
            <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Filters
          </span>
          {activeCount > 0 ? (
            <button
              className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => useAppStore.getState().clearViewFilters(view.id)}
            >
              Clear all
            </button>
          ) : null}
        </div>
        <div className="flex flex-col divide-y p-0">
          <div className="px-3 py-2.5">
            <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Status
            </div>
            <div className="flex flex-wrap gap-1">
              {statusOptions.map((status) => (
                <FilterChip
                  key={status}
                  label={statusMeta[status].label}
                  active={view.filters.status.includes(status)}
                  onClick={() =>
                    useAppStore
                      .getState()
                      .toggleViewFilterValue(view.id, "status", status)
                  }
                />
              ))}
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Priority
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(priorityMeta).map(([priority, meta]) => (
                <FilterChip
                  key={priority}
                  label={meta.label}
                  active={view.filters.priority.includes(priority as Priority)}
                  onClick={() =>
                    useAppStore
                      .getState()
                      .toggleViewFilterValue(view.id, "priority", priority)
                  }
                />
              ))}
            </div>
          </div>
          {assignees.length > 0 ? (
            <div className="px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Assignee
              </div>
              <div className="flex flex-wrap gap-1">
                {assignees.map((assignee) => (
                  <FilterChip
                    key={assignee.id}
                    label={assignee.name}
                    active={view.filters.assigneeIds.includes(assignee.id)}
                    onClick={() =>
                      useAppStore
                        .getState()
                        .toggleViewFilterValue(
                          view.id,
                          "assigneeIds",
                          assignee.id
                        )
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
          {projects.length > 0 ? (
            <div className="px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Project
              </div>
              <div className="flex flex-wrap gap-1">
                {projects.map((project) => (
                  <FilterChip
                    key={project.id}
                    label={project.name}
                    active={view.filters.projectIds.includes(project.id)}
                    onClick={() =>
                      useAppStore
                        .getState()
                        .toggleViewFilterValue(
                          view.id,
                          "projectIds",
                          project.id
                        )
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
          {labels.length > 0 ? (
            <div className="px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Labels
              </div>
              <div className="flex flex-wrap gap-1">
                {labels.map((label) => (
                  <FilterChip
                    key={label.id}
                    label={label.name}
                    active={view.filters.labelIds.includes(label.id)}
                    onClick={() =>
                      useAppStore
                        .getState()
                        .toggleViewFilterValue(view.id, "labelIds", label.id)
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
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
        <div className="border-b px-3 py-2.5">
          <div className="flex rounded-md bg-muted/50 p-0.5">
            {[
              {
                value: "list",
                label: "List",
                icon: <Rows className="size-3" />,
              },
              {
                value: "board",
                label: "Board",
                icon: <Kanban className="size-3" />,
              },
              {
                value: "timeline",
                label: "Timeline",
                icon: <CalendarDots className="size-3" />,
              },
            ].map((layout) => (
              <button
                key={layout.value}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] py-1.5 text-[11px] transition-all",
                  view.layout === layout.value
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() =>
                  useAppStore.getState().updateViewConfig(view.id, {
                    layout: layout.value as ViewDefinition["layout"],
                  })
                }
              >
                {layout.icon}
                {layout.label}
              </button>
            ))}
          </div>
        </div>

        {/* Config options */}
        <div className="flex flex-col px-3 py-2">
          <div className="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Configuration
          </div>
          <ConfigSelect
            label="Grouping"
            value={view.grouping}
            options={groupOptions.map((o) => ({ value: o, label: o }))}
            onValueChange={(value) =>
              useAppStore
                .getState()
                .updateViewConfig(view.id, { grouping: value as GroupField })
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
              useAppStore
                .getState()
                .updateViewConfig(view.id, { ordering: value as OrderingField })
            }
          />
          <ConfigSelect
            label="Completed"
            value={String(view.filters.showCompleted)}
            options={[
              { value: "true", label: "Show all" },
              { value: "false", label: "Hide done" },
            ]}
            onValueChange={(value) =>
              useAppStore
                .getState()
                .updateViewConfig(view.id, { showCompleted: value === "true" })
            }
          />
        </div>

        <Separator />

        {/* Display properties */}
        <div className="px-3 py-2.5">
          <div className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Properties
          </div>
          <div className="flex flex-wrap gap-1">
            {displayPropertyOptions.map((property) => (
              <button
                key={property}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  view.displayProps.includes(property)
                    ? "border-primary/30 bg-primary/10 font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
                onClick={() =>
                  useAppStore
                    .getState()
                    .toggleViewDisplayProperty(view.id, property)
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
              <div
                key={groupName}
                className="flex w-[20rem] shrink-0 flex-col rounded-lg bg-muted/50"
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={groupName as WorkItem["status"]} />
                    <span className="text-sm font-medium">{groupName}</span>
                    <span className="text-xs text-muted-foreground">
                      {groupCount}
                    </span>
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
                  {Array.from(subgroups.entries()).map(
                    ([subgroupName, subItems]) => {
                      const hidden =
                        view.hiddenState.subgroups.includes(subgroupName)
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
                    }
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {hiddenGroups.length > 0 ? (
        <div className="border-t px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Hidden columns
            </span>
            {hiddenGroups.map(([groupName]) => (
              <button
                key={groupName}
                className="rounded-md border px-2 py-0.5 text-xs hover:bg-accent"
                onClick={() =>
                  useAppStore
                    .getState()
                    .toggleViewHiddenValue(view.id, "groups", groupName)
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
              className="flex w-full items-center gap-2 border-b px-4 py-2 transition-colors hover:bg-accent/50"
              onClick={() => toggleGroup(groupName)}
            >
              {isCollapsed ? (
                <CaretRight className="size-3 text-muted-foreground" />
              ) : (
                <CaretDown className="size-3 text-muted-foreground" />
              )}
              <StatusIcon status={groupName as WorkItem["status"]} />
              <span className="text-sm font-medium">{groupName}</span>
              <span className="text-xs text-muted-foreground">
                {groupCount}
              </span>
            </button>

            {/* Group items */}
            {!isCollapsed && (
              <div className="flex flex-col">
                {Array.from(subgroups.entries()).map(
                  ([subgroupName, subItems]) => {
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
                  }
                )}
              </div>
            )}
          </div>
        )
      })}

      {view.hiddenState.groups.length > 0 ? (
        <div className="border-t px-4 py-3">
          <div className="mb-2 text-xs text-muted-foreground">Hidden rows</div>
          {view.hiddenState.groups.map((groupName) => (
            <button
              key={groupName}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              onClick={() =>
                useAppStore
                  .getState()
                  .toggleViewHiddenValue(view.id, "groups", groupName)
              }
            >
              <StatusIcon status={groupName as WorkItem["status"]} />
              <span>{groupName}</span>
              <span className="ml-auto text-xs text-muted-foreground">0</span>
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

type TimelineRangeDraft = {
  itemId: string
  startDate: Date
  endDate: Date
}

function parseDateOnlyValue(value: string | null | undefined, fallback: Date) {
  if (!value) {
    return startOfDay(fallback)
  }

  return startOfDay(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function toDateOnlyIsoString(date: Date) {
  return `${format(startOfDay(date), "yyyy-MM-dd")}T00:00:00.000Z`
}

function getTimelineRange(item: WorkItem, fallback: Date) {
  const startDate = parseDateOnlyValue(
    item.startDate ?? item.targetDate ?? item.dueDate,
    fallback
  )
  const rawEndDate = parseDateOnlyValue(
    item.targetDate ?? item.dueDate ?? item.startDate,
    fallback
  )

  return {
    startDate,
    endDate:
      rawEndDate.getTime() < startDate.getTime() ? startDate : rawEndDate,
  }
}

function buildTimelineMovePatch(
  item: WorkItem,
  nextStartDate: Date,
  fallback: Date
) {
  const { startDate } = getTimelineRange(item, fallback)
  const delta = differenceInCalendarDays(nextStartDate, startDate)

  return {
    startDate: toDateOnlyIsoString(nextStartDate),
    dueDate: item.dueDate
      ? toDateOnlyIsoString(
          addDays(parseDateOnlyValue(item.dueDate, fallback), delta)
        )
      : undefined,
    targetDate: item.targetDate
      ? toDateOnlyIsoString(
          addDays(parseDateOnlyValue(item.targetDate, fallback), delta)
        )
      : undefined,
  }
}

function buildTimelineResizePatch(
  item: WorkItem,
  nextStartDate: Date,
  nextEndDate: Date
) {
  return {
    startDate: toDateOnlyIsoString(nextStartDate),
    dueDate: item.dueDate ? toDateOnlyIsoString(nextEndDate) : undefined,
    targetDate:
      item.targetDate || !item.dueDate
        ? toDateOnlyIsoString(nextEndDate)
        : undefined,
  }
}

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
  const [labelColWidth, setLabelColWidth] = useState(224)
  const [resizeDraft, setResizeDraft] = useState<TimelineRangeDraft | null>(
    null
  )
  const resizingRef = useRef(false)
  const resizeStartRef = useRef({ x: 0, width: 224 })
  const dragOffsetRef = useRef<{ itemId: string; offsetDays: number } | null>(
    null
  )
  const today = startOfDay(new Date())
  const timelineStart = startOfDay(subDays(new Date(), 3))
  const timelineEnd = endOfDay(addDays(new Date(), 24))
  const days = eachDayOfInterval({
    start: timelineStart,
    end: timelineEnd,
  })
  const groups = [
    ...buildItemGroups(data, items, { ...view, subGrouping: null }).entries(),
  ]

  // Find week boundaries for header grouping
  const weeks: { label: string; span: number }[] = []
  let currentWeekLabel = ""
  let currentSpan = 0
  for (const day of days) {
    const weekOfYear = format(day, "'W'ww")
    if (weekOfYear !== currentWeekLabel && currentWeekLabel) {
      weeks.push({
        label:
          format(subDays(day, currentSpan), "MMM d") +
          " – " +
          format(subDays(day, 1), "MMM d"),
        span: currentSpan,
      })
      currentSpan = 0
    }
    currentWeekLabel = weekOfYear
    currentSpan++
  }
  if (currentSpan > 0) {
    weeks.push({
      label:
        format(days[days.length - currentSpan], "MMM d") +
        " – " +
        format(days[days.length - 1], "MMM d"),
      span: currentSpan,
    })
  }

  const todayIndex = differenceInCalendarDays(today, timelineStart)

  function handleDragStart(event: DragStartEvent) {
    setActiveItemId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItemId(null)

    if (!editable || !event.over) {
      dragOffsetRef.current = null
      return
    }

    const activeId = String(event.active.id)
    const activeItem = data.workItems.find((entry) => entry.id === activeId)
    const [scope, , date] = String(event.over.id).split("::")

    if (!activeItem || scope !== "timeline") {
      dragOffsetRef.current = null
      return
    }

    const offsetDays =
      dragOffsetRef.current?.itemId === activeId
        ? dragOffsetRef.current.offsetDays
        : 0
    const nextStartDate = subDays(startOfDay(new Date(date)), offsetDays)

    useAppStore
      .getState()
      .updateWorkItem(
        activeId,
        buildTimelineMovePatch(activeItem, nextStartDate, timelineStart)
      )

    dragOffsetRef.current = null
  }

  function handleDragCancel() {
    setActiveItemId(null)
    dragOffsetRef.current = null
  }

  function captureDragOffset(
    item: WorkItem,
    span: number,
    event: React.PointerEvent<HTMLButtonElement>
  ) {
    const target = event.target as HTMLElement

    if (target.closest("[data-timeline-resize-handle]")) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const rawOffset = Math.floor((event.clientX - rect.left) / dayColumnWidth)

    dragOffsetRef.current = {
      itemId: item.id,
      offsetDays: Math.max(0, Math.min(span - 1, rawOffset)),
    }
  }

  function handleTimelineBarResizeStart(
    item: WorkItem,
    edge: "start" | "end",
    clientX: number
  ) {
    const initialRange = getTimelineRange(item, timelineStart)
    let nextDraft: TimelineRangeDraft = {
      itemId: item.id,
      startDate: initialRange.startDate,
      endDate: initialRange.endDate,
    }

    setResizeDraft(nextDraft)

    const onPointerMove = (event: PointerEvent) => {
      const diffDays = Math.round((event.clientX - clientX) / dayColumnWidth)

      if (edge === "start") {
        const candidateStart = startOfDay(
          addDays(initialRange.startDate, diffDays)
        )
        nextDraft = {
          itemId: item.id,
          startDate:
            candidateStart.getTime() > initialRange.endDate.getTime()
              ? initialRange.endDate
              : candidateStart,
          endDate: initialRange.endDate,
        }
      } else {
        const candidateEnd = startOfDay(addDays(initialRange.endDate, diffDays))
        nextDraft = {
          itemId: item.id,
          startDate: initialRange.startDate,
          endDate:
            candidateEnd.getTime() < initialRange.startDate.getTime()
              ? initialRange.startDate
              : candidateEnd,
        }
      }

      setResizeDraft(nextDraft)
    }

    const onPointerUp = () => {
      document.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("pointerup", onPointerUp)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
      setResizeDraft(null)

      if (
        nextDraft.startDate.getTime() === initialRange.startDate.getTime() &&
        nextDraft.endDate.getTime() === initialRange.endDate.getTime()
      ) {
        return
      }

      useAppStore
        .getState()
        .updateWorkItem(
          item.id,
          buildTimelineResizePatch(item, nextDraft.startDate, nextDraft.endDate)
        )
    }

    document.body.style.setProperty("cursor", "ew-resize")
    document.body.style.setProperty("user-select", "none")
    document.addEventListener("pointermove", onPointerMove)
    document.addEventListener("pointerup", onPointerUp)
  }

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    resizingRef.current = true
    resizeStartRef.current = { x: e.clientX, width: labelColWidth }

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return
      const diff = ev.clientX - resizeStartRef.current.x
      setLabelColWidth(
        Math.max(160, Math.min(480, resizeStartRef.current.width + diff))
      )
    }

    const onMouseUp = () => {
      resizingRef.current = false
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  const dayColumnWidth = 56
  const timelineGridTemplateColumns = `repeat(${days.length}, ${dayColumnWidth}px)`
  const timelineCanvasWidth = dayColumnWidth * days.length
  const visibleGroups = groups.filter(
    ([groupName]) => !view.hiddenState.groups.includes(groupName)
  )
  const activeDragItem = activeItemId
    ? (data.workItems.find((entry) => entry.id === activeItemId) ?? null)
    : null
  const activeDragRange = activeDragItem
    ? getTimelineRange(activeDragItem, timelineStart)
    : null
  const activeDragSpan = activeDragRange
    ? Math.max(
        1,
        differenceInCalendarDays(
          activeDragRange.endDate,
          activeDragRange.startDate
        ) + 1
      )
    : 1

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] overflow-hidden">
        <div
          className="relative z-10 shrink-0 overflow-hidden border-r bg-background"
          style={{ width: labelColWidth }}
        >
          <div className="sticky top-0 z-30 bg-background">
            <div className="relative flex h-10 items-end border-b px-3 py-2">
              <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                Items
              </span>
              <div
                className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize transition-colors hover:bg-primary/20 active:bg-primary/40"
                onMouseDown={handleResizeStart}
              />
            </div>
            <div className="h-9 border-b bg-background" />
          </div>

          {visibleGroups.map(([groupName, subgroups]) => {
            const groupItems = Array.from(subgroups.values()).flat()

            return (
              <div key={groupName}>
                <div className="flex h-10 items-center gap-2 border-b bg-muted/30 px-3">
                  <span className="text-xs font-medium">{groupName}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {groupItems.length}
                  </span>
                </div>

                {groupItems.map((item) => (
                  <TimelineLabelRow key={item.id} data={data} item={item} />
                ))}
              </div>
            )
          })}
        </div>

        <div className="min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain">
          <div
            className="relative min-w-max"
            style={{ width: timelineCanvasWidth }}
          >
            <div className="sticky top-0 z-20 bg-background">
              <div
                className="grid border-b"
                style={{ gridTemplateColumns: timelineGridTemplateColumns }}
              >
                {weeks.map((week, i) => (
                  <div
                    key={i}
                    className="flex h-10 items-center justify-center border-r px-2 text-center text-[10px] font-medium text-muted-foreground"
                    style={{ gridColumn: `span ${week.span}` }}
                  >
                    {week.label}
                  </div>
                ))}
              </div>
              <div
                className="grid border-b"
                style={{ gridTemplateColumns: timelineGridTemplateColumns }}
              >
                {days.map((day) => {
                  const isToday_ = differenceInCalendarDays(day, today) === 0
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "flex h-9 items-center justify-center border-r px-1 text-center text-[10px]",
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

            <div className="relative">
              {todayIndex >= 0 && todayIndex < days.length ? (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-[5] w-px bg-primary/40"
                  style={{ left: (todayIndex + 0.5) * dayColumnWidth }}
                />
              ) : null}

              {visibleGroups.map(([groupName, subgroups]) => {
                const groupItems = Array.from(subgroups.values()).flat()

                return (
                  <div key={groupName}>
                    <div className="h-10 border-b bg-muted/30" />

                    {groupItems.map((item) => (
                      <TimelineGridRow
                        key={item.id}
                        days={days}
                        gridTemplateColumns={timelineGridTemplateColumns}
                        item={item}
                        onCaptureDragOffset={captureDragOffset}
                        onResizeStart={handleTimelineBarResizeStart}
                        rangeOverride={
                          resizeDraft?.itemId === item.id ? resizeDraft : null
                        }
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDragItem ? (
          <div
            className="h-9 px-0.5 py-1"
            style={{ width: activeDragSpan * dayColumnWidth }}
          >
            <TimelineBarPreview item={activeDragItem} span={activeDragSpan} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

/* ------------------------------------------------------------------ */
/*  Row / card primitives                                              */
/* ------------------------------------------------------------------ */

function stopMenuEvent(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function IssueActionMenuContent({
  data,
  item,
  kind,
}: {
  data: AppData
  item: WorkItem
  kind: "dropdown" | "context"
}) {
  const team = getTeam(data, item.teamId)
  const editable = team ? canEditTeam(data, team.id) : false
  const itemLabel = getDisplayLabelForWorkItemType(
    item.type,
    team?.settings.experience
  ).toLowerCase()
  const teamMembers = team ? getTeamMembers(data, team.id) : []
  const statusOptions = getStatusOrderForTeam(team)
  const MenuLabel: ElementType =
    kind === "dropdown" ? DropdownMenuLabel : ContextMenuLabel
  const MenuSeparator: ElementType =
    kind === "dropdown" ? DropdownMenuSeparator : ContextMenuSeparator
  const MenuSub: ElementType =
    kind === "dropdown" ? DropdownMenuSub : ContextMenuSub
  const MenuSubTrigger: ElementType =
    kind === "dropdown" ? DropdownMenuSubTrigger : ContextMenuSubTrigger
  const MenuSubContent: ElementType =
    kind === "dropdown" ? DropdownMenuSubContent : ContextMenuSubContent
  const MenuItem: ElementType =
    kind === "dropdown" ? DropdownMenuItem : ContextMenuItem

  async function handleDelete() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete ${item.key}? This can't be undone.`)
    ) {
      return
    }

    await useAppStore.getState().deleteWorkItem(item.id)
  }

  return (
    <>
      <MenuLabel>{item.key}</MenuLabel>
      <MenuSeparator />
      <MenuSub>
        <MenuSubTrigger disabled={!editable}>Status</MenuSubTrigger>
        <MenuSubContent>
          {statusOptions.map((status) => (
            <MenuItem
              key={`${item.id}-${status}`}
              onSelect={() =>
                useAppStore.getState().updateWorkItem(item.id, { status })
              }
            >
              {statusMeta[status].label}
            </MenuItem>
          ))}
        </MenuSubContent>
      </MenuSub>
      <MenuSub>
        <MenuSubTrigger disabled={!editable}>Priority</MenuSubTrigger>
        <MenuSubContent>
          {Object.entries(priorityMeta).map(([priority, meta]) => (
            <MenuItem
              key={`${item.id}-${priority}`}
              onSelect={() =>
                useAppStore.getState().updateWorkItem(item.id, {
                  priority: priority as Priority,
                })
              }
            >
              {meta.label}
            </MenuItem>
          ))}
        </MenuSubContent>
      </MenuSub>
      <MenuSub>
        <MenuSubTrigger disabled={!editable}>Assignee</MenuSubTrigger>
        <MenuSubContent>
          <MenuItem
            onSelect={() =>
              useAppStore.getState().updateWorkItem(item.id, {
                assigneeId: null,
              })
            }
          >
            Unassigned
          </MenuItem>
          <MenuItem
            onSelect={() =>
              useAppStore.getState().updateWorkItem(item.id, {
                assigneeId: data.currentUserId,
              })
            }
          >
            Assign to me
          </MenuItem>
          <MenuSeparator />
          {teamMembers.map((member) => (
            <MenuItem
              key={`${item.id}-${member.id}`}
              onSelect={() =>
                useAppStore.getState().updateWorkItem(item.id, {
                  assigneeId: member.id,
                })
              }
            >
              {member.name}
            </MenuItem>
          ))}
        </MenuSubContent>
      </MenuSub>
      {editable ? (
        <>
          <MenuSeparator />
          <MenuItem
            variant="destructive"
            onSelect={(event: Event) => {
              event.preventDefault()
              void handleDelete()
            }}
          >
            <Trash className="size-4" />
            Delete {itemLabel}
          </MenuItem>
        </>
      ) : null}
    </>
  )
}

function IssueActionMenu({
  data,
  item,
  triggerClassName,
}: {
  data: AppData
  item: WorkItem
  triggerClassName?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={triggerClassName}
          onClick={stopMenuEvent}
        >
          <DotsThree className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <IssueActionMenuContent data={data} item={item} kind="dropdown" />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function IssueContextMenu({
  data,
  item,
  children,
}: {
  data: AppData
  item: WorkItem
  children: React.ReactNode
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <IssueActionMenuContent data={data} item={item} kind="context" />
      </ContextMenuContent>
    </ContextMenu>
  )
}

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
    <IssueContextMenu data={data} item={item}>
      <Link
        href={`/items/${item.id}`}
        className="group flex items-center gap-3 border-b px-4 py-2 transition-colors hover:bg-accent/50"
      >
        <IssueActionMenu
          data={data}
          item={item}
          triggerClassName="opacity-0 transition-opacity group-hover:opacity-100"
        />

        {/* Issue key */}
        <span className="w-20 shrink-0 text-xs text-muted-foreground">
          {item.key}
        </span>

        {/* Status icon */}
        <StatusIcon status={item.status} />

        {/* Title */}
        <span className="flex-1 truncate text-sm">{item.title}</span>

        {/* Display properties */}
        {displayProps.includes("priority") && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {priorityMeta[item.priority].label}
          </span>
        )}
        {displayProps.includes("assignee") && (
          <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] text-muted-foreground">
            {item.assigneeId
              ? (getUser(data, item.assigneeId)?.avatarUrl ?? "?")
              : ""}
          </div>
        )}
        {displayProps.includes("project") && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {getProject(data, item.primaryProjectId)?.name ?? ""}
          </span>
        )}
        {displayProps.includes("created") && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {format(new Date(item.createdAt), "MMM d")}
          </span>
        )}
        {displayProps.includes("updated") && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {format(new Date(item.updatedAt), "MMM d")}
          </span>
        )}
      </Link>
    </IssueContextMenu>
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

function DraggableWorkCard({ data, item }: { data: AppData; item: WorkItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
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
    <IssueContextMenu data={data} item={item}>
      <div className="rounded-md border border-border/50 bg-card p-3 shadow-xs transition-shadow hover:shadow-sm">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="text-xs text-muted-foreground">{item.key}</span>
          <div className="flex items-center gap-1.5">
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] text-muted-foreground">
              {item.assigneeId
                ? (getUser(data, item.assigneeId)?.avatarUrl ?? "?")
                : ""}
            </div>
            <IssueActionMenu
              data={data}
              item={item}
              triggerClassName="rounded-md p-1 transition-colors hover:bg-muted"
            />
            {dragHandle}
          </div>
        </div>
        <Link
          className="flex flex-col rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          href={`/items/${item.id}`}
        >
          <div className="text-sm leading-snug font-medium hover:underline">
            {item.title}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <StatusIcon status={item.status} />
            {item.primaryProjectId ? (
              <Badge
                variant="secondary"
                className="h-4 px-1.5 py-0 text-[10px]"
              >
                {getProject(data, item.primaryProjectId)?.name}
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Created {format(new Date(item.createdAt), "MMM d")}
          </div>
        </Link>
      </div>
    </IssueContextMenu>
  )
}

function TimelineLabelRow({ data, item }: { data: AppData; item: WorkItem }) {
  const assignees = getItemAssignees(data, [item])

  return (
    <div className="flex h-9 items-center gap-2.5 border-b bg-background px-3">
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
          className="block truncate text-xs hover:underline"
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
  )
}

function TimelineGridRow({
  item,
  days,
  gridTemplateColumns,
  onCaptureDragOffset,
  onResizeStart,
  rangeOverride,
}: {
  item: WorkItem
  days: Date[]
  gridTemplateColumns: string
  onCaptureDragOffset: (
    item: WorkItem,
    span: number,
    event: React.PointerEvent<HTMLButtonElement>
  ) => void
  onResizeStart: (
    item: WorkItem,
    edge: "start" | "end",
    clientX: number
  ) => void
  rangeOverride: TimelineRangeDraft | null
}) {
  const range = rangeOverride ?? {
    itemId: item.id,
    ...getTimelineRange(item, days[0]),
  }
  const startDate = range.startDate
  const endDate = range.endDate
  const startIndex = Math.max(
    0,
    differenceInCalendarDays(startDate, startOfDay(days[0]))
  )
  const span = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1)

  return (
    <div className="relative h-9 border-b">
      <div className="grid h-full" style={{ gridTemplateColumns }}>
        {days.map((day) => (
          <TimelineDropCell
            key={`${item.id}-${day.toISOString()}`}
            id={`timeline::${item.id}::${day.toISOString()}`}
            isWeekend={day.getDay() === 0 || day.getDay() === 6}
          />
        ))}
      </div>

      <div
        className="pointer-events-none absolute inset-0 grid"
        style={{ gridTemplateColumns }}
      >
        <div
          className="pointer-events-auto flex h-full items-center px-0.5 py-1"
          style={{ gridColumn: `${startIndex + 1} / span ${span}` }}
        >
          <TimelineBar
            item={item}
            span={span}
            onCaptureDragOffset={onCaptureDragOffset}
            onResizeStart={onResizeStart}
          />
        </div>
      </div>
    </div>
  )
}

function TimelineDropCell({
  id,
  isWeekend,
}: {
  id: string
  isWeekend: boolean
}) {
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
  backlog: "bg-muted-foreground/20 text-foreground",
  todo: "bg-muted-foreground/30 text-foreground",
  "in-progress": "bg-blue-500/90 text-white",
  "in-review": "bg-violet-500/90 text-white",
  done: "bg-green-500/80 text-white",
  cancelled: "bg-red-400/60 text-white",
}

function TimelineBarPreview({ item, span }: { item: WorkItem; span: number }) {
  const colorClass =
    barColors[item.status] ?? "bg-primary text-primary-foreground"

  return (
    <div
      className={cn(
        "flex h-full w-full items-center rounded-[5px] px-2 text-left text-[11px] font-medium shadow-sm",
        colorClass
      )}
    >
      <span className="truncate">{span >= 3 ? item.title : item.key}</span>
    </div>
  )
}

function TimelineBar({
  item,
  span,
  onCaptureDragOffset,
  onResizeStart,
}: {
  item: WorkItem
  span: number
  onCaptureDragOffset: (
    item: WorkItem,
    span: number,
    event: React.PointerEvent<HTMLButtonElement>
  ) => void
  onResizeStart: (
    item: WorkItem,
    edge: "start" | "end",
    clientX: number
  ) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
    })

  const colorClass =
    barColors[item.status] ?? "bg-primary text-primary-foreground"

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "group/timeline-bar relative flex h-full w-full items-center rounded-[5px] px-2 text-left text-[11px] font-medium shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-0",
        colorClass
      )}
      style={{
        transform: isDragging ? undefined : CSS.Translate.toString(transform),
      }}
      onPointerDownCapture={(event) => onCaptureDragOffset(item, span, event)}
      {...listeners}
      {...attributes}
    >
      <span
        data-timeline-resize-handle="start"
        className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize rounded-l-[5px] opacity-0 transition-opacity group-hover/timeline-bar:opacity-100 hover:bg-black/10"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onResizeStart(item, "start", event.clientX)
        }}
      />
      <span className="truncate">{span >= 3 ? item.title : item.key}</span>
      <span
        data-timeline-resize-handle="end"
        className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize rounded-r-[5px] opacity-0 transition-opacity group-hover/timeline-bar:opacity-100 hover:bg-black/10"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onResizeStart(item, "end", event.clientX)
        }}
      />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Comments (inline version for detail screens)                       */
/* ------------------------------------------------------------------ */

const commentReactionOptions = ["👍", "❤️", "👀"] as const

function CommentThreadItem({
  comment,
  repliesByParentId,
  editable,
  targetType,
  targetId,
}: {
  comment: AppData["comments"][number]
  repliesByParentId: Record<string, AppData["comments"]>
  editable: boolean
  targetType: "workItem" | "document"
  targetId: string
}) {
  const data = useAppStore()
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyContent, setReplyContent] = useState("")
  const replies = repliesByParentId[comment.id] ?? []

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {getUser(data, comment.createdBy)?.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {format(new Date(comment.createdAt), "MMM d, h:mm a")}
        </span>
      </div>

      <p className="text-sm leading-7 text-muted-foreground">
        {comment.content}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {comment.reactions.map((reaction) => {
          const active = reaction.userIds.includes(data.currentUserId)

          return (
            <button
              key={`${comment.id}-${reaction.emoji}`}
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors",
                active
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "hover:bg-accent"
              )}
              onClick={() =>
                useAppStore
                  .getState()
                  .toggleCommentReaction(comment.id, reaction.emoji)
              }
            >
              <span>{reaction.emoji}</span>
              <span>{reaction.userIds.length}</span>
            </button>
          )
        })}
        {editable
          ? commentReactionOptions.map((emoji) => {
              const existingReaction = comment.reactions.find(
                (reaction) => reaction.emoji === emoji
              )

              if (existingReaction) {
                return null
              }

              return (
                <button
                  key={`${comment.id}-${emoji}-new`}
                  type="button"
                  className="rounded-full border border-dashed px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() =>
                    useAppStore
                      .getState()
                      .toggleCommentReaction(comment.id, emoji)
                  }
                >
                  {emoji}
                </button>
              )
            })
          : null}
        {editable ? (
          <button
            type="button"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setReplyOpen((current) => !current)}
          >
            Reply
          </button>
        ) : null}
      </div>

      {replyOpen ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-background/70 p-3">
          <Textarea
            autoFocus
            className="min-h-[4rem] resize-none"
            placeholder="Reply to this thread..."
            value={replyContent}
            onChange={(event) => setReplyContent(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setReplyContent("")
                setReplyOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!replyContent.trim()}
              onClick={() => {
                useAppStore.getState().addComment({
                  targetType,
                  targetId,
                  parentCommentId: comment.id,
                  content: replyContent,
                })
                setReplyContent("")
                setReplyOpen(false)
              }}
            >
              Reply
            </Button>
          </div>
        </div>
      ) : null}

      {replies.length > 0 ? (
        <div className="ml-4 flex flex-col gap-3 border-l pl-4">
          {replies.map((reply) => (
            <CommentThreadItem
              key={reply.id}
              comment={reply}
              repliesByParentId={repliesByParentId}
              editable={editable}
              targetType={targetType}
              targetId={targetId}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

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
  const rootComments = comments.filter(
    (comment) => comment.parentCommentId === null
  )
  const repliesByParentId = comments.reduce<
    Record<string, AppData["comments"]>
  >((accumulator, comment) => {
    if (!comment.parentCommentId) {
      return accumulator
    }

    accumulator[comment.parentCommentId] = [
      ...(accumulator[comment.parentCommentId] ?? []),
      comment,
    ]

    return accumulator
  }, {})
  const [content, setContent] = useState("")

  return (
    <div className="flex flex-col gap-4">
      {rootComments.map((comment) => (
        <CommentThreadItem
          key={comment.id}
          comment={comment}
          repliesByParentId={repliesByParentId}
          editable={editable}
          targetType={targetType}
          targetId={targetId}
        />
      ))}
      <div className="flex flex-col gap-2">
        <Textarea
          disabled={!editable}
          placeholder="Leave a comment or mention a teammate with @handle..."
          className="min-h-[4rem] resize-none"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            disabled={!editable || !content.trim()}
            onClick={() => {
              useAppStore
                .getState()
                .addComment({ targetType, targetId, content })
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
  const availableTemplateTypes = [
    ...getAllowedTemplateTypesForTeamExperience(settingsTeam?.settings.experience),
  ]
  const initialTemplateType =
    availableTemplateTypes[0] ??
    getDefaultTemplateTypeForTeamExperience(settingsTeam?.settings.experience)
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
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <div className="px-5 pt-5 pb-1">
          <DialogHeader className="mb-3 p-0">
            <DialogTitle className="text-base">New project</DialogTitle>
          </DialogHeader>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Project name"
            className="h-auto border-none bg-transparent px-0 py-1 text-sm font-medium shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
            autoFocus
          />
          <Input
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Add a summary..."
            className="h-auto border-none bg-transparent px-0 py-1 text-sm text-muted-foreground shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
          />
        </div>

        <Separator />

        <div className="flex flex-col px-5 py-2">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Template</span>
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
              <SelectTrigger className="h-7 w-auto min-w-28 border-none bg-transparent text-xs shadow-none">
                <div className="flex items-center gap-1.5">
                  <ProjectTemplateGlyph
                    templateType={templateType}
                    className="size-3.5"
                  />
                  <span>{templateMeta[templateType].label}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {availableTemplateTypes.map((value) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <ProjectTemplateGlyph
                          templateType={value}
                          className="size-3.5"
                        />
                        <span>{templateMeta[value].label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Priority</span>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as Priority)}
            >
              <SelectTrigger className="h-7 w-auto min-w-28 border-none bg-transparent text-xs shadow-none">
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
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-end gap-2 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
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
            Create project
          </Button>
        </div>
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
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <div className="px-5 pt-5 pb-4">
          <DialogHeader className="mb-3 p-0">
            <DialogTitle className="text-base">New document</DialogTitle>
          </DialogHeader>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Document title"
            className="h-auto border-none bg-transparent px-0 py-1 text-sm font-medium shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
            autoFocus
          />
        </div>

        <Separator />

        <div className="flex items-center justify-end gap-2 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => {
              useAppStore.getState().createDocument({ ...input, title })
              onOpenChange(false)
            }}
          >
            Create document
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InlineChildIssueComposer({
  teamId,
  parentItem,
  disabled,
  onCancel,
  onCreated,
}: {
  teamId: string
  parentItem: WorkItem
  disabled: boolean
  onCancel: () => void
  onCreated: () => void
}) {
  const data = useAppStore()
  const team = getTeam(data, teamId)
  const workCopy = getWorkSurfaceCopy(team?.settings.experience)
  const teamProjects = data.projects.filter(
    (project) =>
      (project.scopeType === "team" && project.scopeId === teamId) ||
      (project.scopeType === "workspace" &&
        team?.workspaceId === project.scopeId)
  )
  const teamMembers = team ? getTeamMembers(data, teamId) : []
  const [type, setType] = useState<WorkItemType>("task")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<Priority>("medium")
  const [assigneeId, setAssigneeId] = useState<string>("none")
  const [projectId, setProjectId] = useState<string>(
    parentItem.primaryProjectId ?? "none"
  )
  const selectedProject =
    projectId === "none"
      ? null
      : (teamProjects.find((project) => project.id === projectId) ?? null)
  const baseItemTypes = selectedProject
    ? getAllowedWorkItemTypesForTemplate(selectedProject.templateType)
    : getDefaultWorkItemTypesForTeamExperience(team?.settings.experience)
  const availableItemTypes = baseItemTypes.filter((value) =>
    getAllowedChildWorkItemTypesForItem(parentItem).includes(value)
  )
  const selectedType = availableItemTypes.includes(type)
    ? type
    : (availableItemTypes[0] ?? "task")
  const normalizedTitle = title.trim()
  const canCreate =
    !disabled && normalizedTitle.length >= 2 && availableItemTypes.length > 0

  function handleCreate() {
    const createdItemId = useAppStore.getState().createWorkItem({
      teamId,
      type: selectedType,
      title: normalizedTitle,
      priority,
      parentId: parentItem.id,
      assigneeId: assigneeId === "none" ? null : assigneeId,
      primaryProjectId: projectId === "none" ? null : projectId,
    })

    if (!createdItemId) {
      return
    }

    if (description.trim()) {
      useAppStore
        .getState()
        .updateItemDescription(
          createdItemId,
          formatInlineDescriptionContent(description)
        )
    }

    onCreated()
  }

  return (
    <div className="bg-background">
      <div className="flex gap-3 px-3 py-3">
        <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={workCopy.titlePlaceholder}
            className="h-auto border-none px-0 py-0 text-sm shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
            autoFocus
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add description..."
            rows={1}
            className="mt-1 min-h-0 resize-none border-none px-0 py-0 text-xs text-muted-foreground shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2">
        <Select
          value={selectedType}
          onValueChange={(value) => setType(value as WorkItemType)}
        >
          <SelectTrigger className="h-7 rounded-full border-border/50 bg-muted/30 px-2.5 text-[11px] shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {availableItemTypes.map((value) => (
                <SelectItem key={value} value={value}>
                  {getDisplayLabelForWorkItemType(
                    value,
                    team?.settings.experience
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={priority}
          onValueChange={(value) => setPriority(value as Priority)}
        >
          <SelectTrigger className="h-7 rounded-full border-border/50 bg-muted/30 px-2.5 text-[11px] shadow-none">
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

        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger className="h-7 rounded-full border-border/50 bg-muted/30 px-2.5 text-[11px] shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="none">Unassigned</SelectItem>
              {teamMembers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="h-7 rounded-full border-border/50 bg-muted/30 px-2.5 text-[11px] shadow-none">
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

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canCreate} onClick={handleCreate}>
            Create
          </Button>
        </div>
      </div>
    </div>
  )
}

function CreateWorkItemDialog({
  open,
  onOpenChange,
  teamId,
  parentItem = null,
  disabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  parentItem?: WorkItem | null
  disabled: boolean
}) {
  const data = useAppStore()
  const team = getTeam(data, teamId)
  const workCopy = getWorkSurfaceCopy(team?.settings.experience)
  const teamProjects = data.projects.filter(
    (project) =>
      (project.scopeType === "team" && project.scopeId === teamId) ||
      (project.scopeType === "workspace" &&
        team?.workspaceId === project.scopeId)
  )
  const teamMembers = team ? getTeamMembers(data, teamId) : []
  const defaultProjectId = parentItem?.primaryProjectId ?? "none"
  const [type, setType] = useState<WorkItemType>("task")
  const [title, setTitle] = useState(
    parentItem ? `Follow-up for ${parentItem.title}` : workCopy.createLabel
  )
  const [priority, setPriority] = useState<Priority>("medium")
  const [assigneeId, setAssigneeId] = useState<string>("none")
  const [projectId, setProjectId] = useState<string>(defaultProjectId)
  const selectedProject =
    projectId === "none"
      ? null
      : (teamProjects.find((project) => project.id === projectId) ?? null)
  const baseItemTypes = selectedProject
    ? getAllowedWorkItemTypesForTemplate(selectedProject.templateType)
    : getDefaultWorkItemTypesForTeamExperience(team?.settings.experience)
  const allowedChildTypes = parentItem
    ? getAllowedChildWorkItemTypesForItem(parentItem)
    : null
  const availableItemTypes = allowedChildTypes
    ? baseItemTypes.filter((value) => allowedChildTypes.includes(value))
    : baseItemTypes
  const selectedType = availableItemTypes.includes(type)
    ? type
    : (availableItemTypes[0] ?? "task")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <div className="px-5 pt-5 pb-1">
          <DialogHeader className="mb-3 p-0">
            <DialogTitle className="text-base">
              {parentItem ? workCopy.createChildLabel : workCopy.createLabel}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={workCopy.titlePlaceholder}
            className="h-auto border-none bg-transparent px-0 py-1 text-sm font-medium shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
            autoFocus
          />
          {parentItem ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{workCopy.parentLabel}</span>
              <Badge variant="outline">{parentItem.key}</Badge>
              <span className="truncate">{parentItem.title}</span>
            </div>
          ) : null}
        </div>

        <Separator />

        <div className="flex flex-col px-5 py-2">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Type</span>
            <Select
              value={selectedType}
              onValueChange={(value) => setType(value as WorkItemType)}
            >
              <SelectTrigger className="h-7 w-auto min-w-28 border-none bg-transparent text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {availableItemTypes.map((value) => (
                    <SelectItem key={value} value={value}>
                      {getDisplayLabelForWorkItemType(
                        value,
                        team?.settings.experience
                      )}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Priority</span>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as Priority)}
            >
              <SelectTrigger className="h-7 w-auto min-w-28 border-none bg-transparent text-xs shadow-none">
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
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Assignee</span>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="h-7 w-auto min-w-28 border-none bg-transparent text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {teamMembers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Project</span>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-7 w-auto min-w-28 border-none bg-transparent text-xs shadow-none">
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
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-end gap-2 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={disabled || availableItemTypes.length === 0}
            onClick={() => {
              useAppStore.getState().createWorkItem({
                teamId,
                type: selectedType,
                title,
                priority,
                parentId: parentItem?.id ?? null,
                assigneeId: assigneeId === "none" ? null : assigneeId,
                primaryProjectId: projectId === "none" ? null : projectId,
              })
              onOpenChange(false)
            }}
          >
            Create{" "}
            {getDisplayLabelForWorkItemType(
              selectedType,
              team?.settings.experience
            ).toLowerCase()}
          </Button>
        </div>
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
        <div className="border-b px-3 py-2.5">
          <div className="flex rounded-md bg-muted/50 p-0.5">
            {[
              {
                value: "list",
                label: "List",
                icon: <Rows className="size-3" />,
              },
              {
                value: "board",
                label: "Board",
                icon: <Kanban className="size-3" />,
              },
            ].map((l) => (
              <button
                key={l.value}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] py-1.5 text-[11px] transition-all",
                  layout === l.value
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => onLayoutChange(l.value as "list" | "board")}
              >
                {l.icon}
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col px-3 py-2">
          <ConfigSelect
            label="Sort by"
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
            label="Details"
            value={showDescriptions ? "show" : "hide"}
            options={[
              { value: "show", label: "Visible" },
              { value: "hide", label: "Hidden" },
            ]}
            onValueChange={(value) =>
              onShowDescriptionsChange(value === "show")
            }
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
        <div className="px-3 py-2.5">
          <div className="flex rounded-md bg-muted/50 p-0.5">
            {[
              {
                value: "list",
                label: "List",
                icon: <Rows className="size-3" />,
              },
              {
                value: "board",
                label: "Grid",
                icon: <Kanban className="size-3" />,
              },
            ].map((l) => (
              <button
                key={l.value}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] py-1.5 text-[11px] transition-all",
                  layout === l.value
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => onLayoutChange(l.value as "list" | "board")}
              >
                {l.icon}
                {l.label}
              </button>
            ))}
          </div>
        </div>
        {extraAction ? (
          <>
            <Separator />
            <div className="px-3 py-2">{extraAction}</div>
          </>
        ) : null}
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
      {icon ? (
        <span className="shrink-0 text-muted-foreground">{icon}</span>
      ) : null}
      <h1 className="truncate text-sm font-medium">{title}</h1>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  const statusLower = status.toLowerCase()
  if (statusLower === "done" || statusLower === "completed") {
    return (
      <CheckCircle className="size-3.5 shrink-0 text-green-600" weight="fill" />
    )
  }
  if (statusLower === "in-progress" || statusLower === "in progress") {
    return (
      <Circle className="size-3.5 shrink-0 text-yellow-500" weight="fill" />
    )
  }
  if (statusLower === "cancelled" || statusLower === "duplicate") {
    return (
      <XCircle
        className="size-3.5 shrink-0 text-muted-foreground"
        weight="fill"
      />
    )
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
      <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
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
        className="flex items-center gap-1.5 py-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <CaretDown className="size-3" />
        ) : (
          <CaretRight className="size-3" />
        )}
        {title}
      </button>
      {open && <div className="mt-0.5 flex flex-col gap-0.5">{children}</div>}
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
        <SelectTrigger className="h-7 w-auto min-w-28 border-none bg-transparent text-sm shadow-none">
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

function PropertyDateField({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string
  value: string | null
  onValueChange: (value: string | null) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Input
        type="date"
        disabled={disabled}
        value={value ? value.slice(0, 10) : ""}
        onChange={(event) =>
          onValueChange(
            event.target.value ? `${event.target.value}T00:00:00.000Z` : null
          )
        }
        className="h-7 w-[9.5rem] border-none bg-transparent px-0 text-right text-sm shadow-none"
      />
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

/* FilterSection removed — filter sections now inlined in FilterPopover */

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
        "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
        active
          ? "border-primary/30 bg-primary/10 font-medium text-foreground"
          : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
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
    return "Items"
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

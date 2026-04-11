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
  CaretRight,
  ChatsCircle,
  FadersHorizontal,
  GearSix,
  Kanban,
  Plus,
  Rows,
  SquaresFour,
} from "@phosphor-icons/react"

import {
  buildItemGroups,
  canAdminTeam,
  canEditTeam,
  getCommentsForTarget,
  getDocument,
  getDocumentsForScope,
  getItemAssignees,
  getLabelMap,
  getLinkedDocuments,
  getLinkedProjects,
  getProject,
  getProjectProgress,
  getProjectsForScope,
  getTeam,
  getTeamBySlug,
  getTemplateDefaultsForTeam,
  getUser,
  getViewByRoute,
  getViewsForScope,
  getVisibleWorkItems,
  getStatusOrderForTeam,
  itemMatchesView,
  sortItems,
} from "@/lib/domain/selectors"
import {
  priorityMeta,
  projectHealthMeta,
  statusMeta,
  templateMeta,
  type AppData,
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
import { AttachmentsCard } from "@/components/app/attachments-card"
import { TeamWorkflowSettingsDialog } from "@/components/app/team-workflow-settings-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
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

export function TeamWorkScreen({ teamSlug }: { teamSlug: string }) {
  const data = useAppStore()
  const team = getTeamBySlug(data, teamSlug)

  if (!team) {
    return <MissingState title="Team not found" />
  }

  const views = getViewsForScope(data, "team", team.id, "items")

  return (
    <WorkSurface
      title={`${team.name} work`}
      description={team.settings.summary}
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
      title="Assigned to Me"
      description="Cross-team work assigned to the current user."
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
    <div className="grid min-h-[calc(100svh-10rem)] gap-4 lg:grid-cols-[26rem_minmax(0,1fr)]">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>
            Persistent notifications for mentions, assignments, comments, and invite activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[65svh]">
            <div className="flex flex-col gap-1 p-3">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition-colors",
                    notification.id === activeId
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  )}
                  onClick={() => {
                    useAppStore.getState().setActiveInboxNotification(notification.id)
                    useAppStore.getState().markNotificationRead(notification.id)
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">{notification.message}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(notification.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    {notification.readAt ? null : (
                      <Badge variant="secondary">Unread</Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Notification detail</CardTitle>
          <CardDescription>
            Open linked work or documents directly from the inbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-[20rem] flex-col gap-4">
          {activeNotification ? (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{activeNotification.type}</Badge>
                <Badge variant="secondary">{activeNotification.entityType}</Badge>
              </div>
              <p className="max-w-2xl text-sm leading-7">{activeNotification.message}</p>
              <div className="flex flex-wrap gap-2">
                {activeNotification.entityType === "workItem" ? (
                  <Button asChild>
                    <Link href={`/items/${activeNotification.entityId}`}>
                      Open work item
                    </Link>
                  </Button>
                ) : null}
                {activeNotification.entityType === "document" ? (
                  <Button asChild>
                    <Link href={`/docs/${activeNotification.entityId}`}>Open document</Link>
                  </Button>
                ) : null}
                {activeNotification.entityType === "invite" ? (
                  <Button
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
              <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                <span>
                  Read status:{" "}
                  {activeNotification.readAt
                    ? format(new Date(activeNotification.readAt), "MMM d, h:mm a")
                    : "Unread"}
                </span>
                <span>
                  Email status:{" "}
                  {activeNotification.emailedAt
                    ? format(new Date(activeNotification.emailedAt), "MMM d, h:mm a")
                    : "In-app only"}
                </span>
              </div>
            </>
          ) : (
            <EmptyCard
              title="No notifications"
              description="Mention or assign the current user to populate the inbox."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function ProjectsScreen({
  scopeType,
  scopeId,
  team,
  title,
  description,
}: {
  scopeType: ScopeType
  scopeId: string
  team?: Team | null
  title: string
  description: string
}) {
  const data = useAppStore()
  const projects = getProjectsForScope(data, scopeType, scopeId)
  const editable = team ? canEditTeam(data, team.id) : true
  const admin = team ? canAdminTeam(data, team.id) : false
  const [dialogOpen, setDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {team ? (
              <Button
                variant="outline"
                disabled={!admin}
                onClick={() => setSettingsOpen(true)}
              >
                <GearSix />
                Workflow settings
              </Button>
            ) : null}
            <Button onClick={() => setDialogOpen(true)}>
              <Plus />
              New project
            </Button>
          </div>
        }
      />
      {team ? (
        <>
          <TeamWorkflowOverviewCard team={team} />
          {settingsOpen ? (
            <TeamWorkflowSettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              teamId={team.id}
            />
          ) : null}
        </>
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
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Project inventory</CardTitle>
          <CardDescription>
            Templates, health, owners, target dates, and aggregate progress.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                const progress = getProjectProgress(data, project.id)
                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Link
                          className="font-medium hover:underline"
                          href={`/projects/${project.id}`}
                        >
                          {project.name}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {project.summary}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{templateMeta[project.templateType].label}</TableCell>
                    <TableCell>{projectHealthMeta[project.health].label}</TableCell>
                    <TableCell>{priorityMeta[project.priority].label}</TableCell>
                    <TableCell>{getUser(data, project.leadId)?.name ?? "Unknown"}</TableCell>
                    <TableCell>
                      {project.targetDate
                        ? format(new Date(project.targetDate), "MMM d")
                        : "TBD"}
                    </TableCell>
                    <TableCell>{progress.percent}%</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function TeamWorkflowOverviewCard({ team }: { team: Team }) {
  const softwareDefaults = getTemplateDefaultsForTeam(team, "software-delivery")
  const qaDefaults = getTemplateDefaultsForTeam(team, "bug-tracking")
  const opsDefaults = getTemplateDefaultsForTeam(team, "project-management")

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Workflow and template defaults</CardTitle>
        <CardDescription>
          Admin-configured lane ordering and project launch defaults for {team.name}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr]">
        <div className="flex flex-col gap-3">
          <div className="text-sm font-medium">Status lane order</div>
          <div className="flex flex-wrap gap-2">
            {getStatusOrderForTeam(team).map((status) => (
              <Badge key={status} variant="secondary">
                {statusMeta[status].label}
              </Badge>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              label: templateMeta["software-delivery"].label,
              defaults: softwareDefaults,
            },
            {
              label: templateMeta["bug-tracking"].label,
              defaults: qaDefaults,
            },
            {
              label: templateMeta["project-management"].label,
              defaults: opsDefaults,
            },
          ].map(({ label, defaults }) => (
            <div key={label} className="rounded-2xl border px-4 py-4">
              <div className="mb-2 text-sm font-medium">{label}</div>
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <span>Priority: {priorityMeta[defaults.defaultPriority].label}</span>
                <span>Window: {defaults.targetWindowDays} days</span>
                <span>View: {defaults.defaultViewLayout}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function ViewsScreen({
  scopeType,
  scopeId,
  title,
  description,
}: {
  scopeType: "team" | "workspace"
  scopeId: string
  title: string
  description: string
}) {
  const data = useAppStore()
  const views = data.views.filter(
    (view) => view.scopeType === scopeType && view.scopeId === scopeId
  )

  return (
    <div className="flex flex-col gap-4">
      <PageIntro title={title} description={description} />
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Saved views</CardTitle>
          <CardDescription>
            Shared team and workspace views with interactive layout preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Layout</TableHead>
                <TableHead>Grouping</TableHead>
                <TableHead>Owner scope</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {views.map((view) => (
                <TableRow key={view.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Link className="font-medium hover:underline" href={view.route}>
                        {view.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {view.description}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{view.entityKind}</TableCell>
                  <TableCell>{view.layout}</TableCell>
                  <TableCell>
                    {view.grouping}
                    {view.subGrouping ? ` → ${view.subGrouping}` : ""}
                  </TableCell>
                  <TableCell>{view.isShared ? scopeType : "personal"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export function DocsScreen({
  scopeType,
  scopeId,
  team,
  title,
  description,
}: {
  scopeType: "team" | "workspace"
  scopeId: string
  team?: Team | null
  title: string
  description: string
}) {
  const data = useAppStore()
  const documents = getDocumentsForScope(data, scopeType, scopeId)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        title={title}
        description={description}
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus />
            New document
          </Button>
        }
      />
      <CreateDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teamId={team?.id ?? data.ui.activeTeamId}
        disabled={team ? !canEditTeam(data, team.id) : false}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {documents.map((document) => (
          <Card key={document.id} className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                <Link href={`/docs/${document.id}`}>{document.title}</Link>
              </CardTitle>
              <CardDescription>
                {getTeam(data, document.teamId)?.name} · updated{" "}
                {format(new Date(document.updatedAt), "MMM d")}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Linked projects {document.linkedProjectIds.length} · linked items{" "}
              {document.linkedWorkItemIds.length}
            </CardContent>
            <CardFooter>
              <Button asChild variant="outline">
                <Link href={`/docs/${document.id}`}>
                  Open document
                  <ArrowSquareOut />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function WorkItemDetailScreen({ itemId }: { itemId: string }) {
  const data = useAppStore()
  const item = data.workItems.find((entry) => entry.id === itemId)

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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex flex-col gap-4">
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{item.key}</Badge>
              <Badge variant="secondary">{workItemTypeMeta[item.type].label}</Badge>
              <Badge variant="secondary">{statusMeta[item.status].label}</Badge>
            </div>
            <CardTitle className="text-3xl">{item.title}</CardTitle>
            <CardDescription>
              {getTeam(data, item.teamId)?.name} · created{" "}
              {format(new Date(item.createdAt), "MMM d")}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Description</CardTitle>
            <CardDescription>
              Tiptap-backed editor for rich item descriptions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RichTextEditor
              content={description?.content ?? "<p>Add a description…</p>"}
              editable={editable}
              onChange={(content) =>
                useAppStore.getState().updateItemDescription(item.id, content)
              }
              onUploadAttachment={(file) =>
                useAppStore.getState().uploadAttachment("workItem", item.id, file)
              }
            />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Linked references</CardTitle>
            <CardDescription>
              Primary project plus any linked projects and documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {item.primaryProjectId ? (
              <Badge variant="secondary">
                Primary: {getProject(data, item.primaryProjectId)?.name}
              </Badge>
            ) : (
              <Badge variant="outline">No primary project</Badge>
            )}
            {getLinkedProjects(data, item).map((project) => (
              <Badge key={project.id} variant="outline">
                {project.name}
              </Badge>
            ))}
            {getLinkedDocuments(data, item).map((document) => (
              <Badge key={document.id} variant="outline">
                {document.title}
              </Badge>
            ))}
          </CardContent>
        </Card>
        <AttachmentsCard
          editable={editable}
          targetId={item.id}
          targetType="workItem"
        />
        <CommentsCard
          targetType="workItem"
          targetId={item.id}
          editable={editable}
          title="Comments"
        />
      </div>
      <div className="flex flex-col gap-4">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Properties</CardTitle>
            <CardDescription>
              Inline editing is role-gated for viewers and guests.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <InlineSelect
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
            <InlineSelect
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
            <InlineSelect
              label="Assignee"
              value={item.assigneeId ?? "unassigned"}
              disabled={!editable}
              options={[
                { value: "unassigned", label: "Unassigned" },
                ...data.users.map((user) => ({ value: user.id, label: user.name })),
              ]}
              onValueChange={(value) =>
                useAppStore.getState().updateWorkItem(item.id, {
                  assigneeId: value === "unassigned" ? null : value,
                })
              }
            />
            <InlineSelect
              label="Primary project"
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
            <DateField
              label="Start"
              value={item.startDate}
              disabled={!editable}
              onChange={(value) =>
                useAppStore.getState().updateWorkItem(item.id, {
                  startDate: value ? new Date(value).toISOString() : null,
                })
              }
            />
            <DateField
              label="Target"
              value={item.targetDate}
              disabled={!editable}
              onChange={(value) =>
                useAppStore.getState().updateWorkItem(item.id, {
                  targetDate: value ? new Date(value).toISOString() : null,
                })
              }
            />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Recent item events and watchers.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <span>Creator: {getUser(data, item.creatorId)?.name}</span>
            <span>
              Subscribers:{" "}
              {item.subscriberIds
                .map((userId) => getUser(data, userId)?.name)
                .filter(Boolean)
                .join(", ")}
            </span>
            <span>Updated {format(new Date(item.updatedAt), "MMM d, h:mm a")}</span>
          </CardContent>
        </Card>
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-4">
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{templateMeta[project.templateType].label}</Badge>
              <Badge variant="outline">{projectHealthMeta[project.health].label}</Badge>
            </div>
            <CardTitle className="text-3xl">{project.name}</CardTitle>
            <CardDescription>{project.summary}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-7 text-muted-foreground">
            {project.description}
          </CardContent>
        </Card>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="work">Work</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Milestones</CardTitle>
                <CardDescription>
                  Project management and software-delivery templates can both use milestones.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex items-center justify-between rounded-xl border px-3 py-3"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{milestone.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {milestone.targetDate
                          ? format(new Date(milestone.targetDate), "MMM d")
                          : "No date"}
                      </span>
                    </div>
                    <Badge variant="secondary">{statusMeta[milestone.status].label}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Project updates</CardTitle>
                <CardDescription>Activity feed without threaded comments.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {updates.map((update) => (
                  <div key={update.id} className="rounded-xl border px-3 py-3">
                    <div className="mb-1 text-sm font-medium">
                      {getUser(data, update.createdBy)?.name}
                    </div>
                    <p className="text-sm text-muted-foreground">{update.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="work" className="mt-4">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Linked work</CardTitle>
                <CardDescription>
                  Primary and linked items contributing to project progress.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border px-3 py-3 hover:bg-muted"
                    href={`/items/${item.id}`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs text-muted-foreground">{item.key}</span>
                    </div>
                    <Badge variant="secondary">{statusMeta[item.status].label}</Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <div className="flex flex-col gap-4">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>Live rollup from linked work items.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <StatCard label="Scope" value={String(progress.scope)} />
            <StatCard label="Completed" value={String(progress.completed)} />
            <StatCard label="Progress" value={`${progress.percent}%`} />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Properties</CardTitle>
            <CardDescription>Lead, dates, status, and template metadata.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <PropertyRow label="Lead" value={getUser(data, project.leadId)?.name ?? "—"} />
            <PropertyRow label="Priority" value={priorityMeta[project.priority].label} />
            <PropertyRow label="Health" value={projectHealthMeta[project.health].label} />
            <PropertyRow label="Template" value={templateMeta[project.templateType].label} />
            <PropertyRow
              label="Target"
              value={
                project.targetDate
                  ? format(new Date(project.targetDate), "MMM d, yyyy")
                  : "TBD"
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function DocumentDetailScreen({ documentId }: { documentId: string }) {
  const data = useAppStore()
  const document = data.documents.find((entry) => entry.id === documentId)

  if (!document || document.kind !== "team-document") {
    return <MissingState title="Document not found" />
  }

  const team = getTeam(data, document.teamId)
  const editable = team ? canEditTeam(data, team.id) : false

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-4">
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{team?.name ?? "Unknown team"}</Badge>
              <Badge variant="outline">Team document</Badge>
            </div>
            <div className="flex flex-col gap-2">
              <Input
                aria-label="Document title"
                className="h-11 text-3xl font-semibold"
                disabled={!editable}
                value={document.title}
                onChange={(event) =>
                  useAppStore
                    .getState()
                    .renameDocument(document.id, event.target.value)
                }
              />
              <CardDescription>
                Updated {format(new Date(document.updatedAt), "MMM d, h:mm a")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Document editor</CardTitle>
            <CardDescription>
              Structured rich text for team docs with a clean upgrade path to deeper block editing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RichTextEditor
              content={document.content}
              editable={editable}
              onChange={(content) =>
                useAppStore.getState().updateDocumentContent(document.id, content)
              }
              onUploadAttachment={(file) =>
                useAppStore.getState().uploadAttachment("document", document.id, file)
              }
            />
          </CardContent>
        </Card>
        <CommentsCard
          targetType="document"
          targetId={document.id}
          editable={editable}
          title="Discussion"
        />
      </div>
      <div className="flex flex-col gap-4">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Links</CardTitle>
            <CardDescription>Projects and work items referenced by this document.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {document.linkedProjectIds.map((projectId) => {
                const project = getProject(data, projectId)
                if (!project) {
                  return null
                }

                return (
                  <Badge key={project.id} variant="secondary">
                    {project.name}
                  </Badge>
                )
              })}
            </div>
            <div className="flex flex-col gap-2">
              {document.linkedWorkItemIds.map((itemId) => {
                const item = data.workItems.find((entry) => entry.id === itemId)
                if (!item) {
                  return null
                }

                return (
                  <Link
                    key={item.id}
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted"
                    href={`/items/${item.id}`}
                  >
                    {item.key} · {item.title}
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
        <AttachmentsCard
          editable={editable}
          targetId={document.id}
          targetType="document"
        />
      </div>
    </div>
  )
}

function WorkSurface({
  title,
  description,
  routeKey,
  views,
  items,
  team,
  emptyLabel,
}: {
  title: string
  description: string
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
    <div className="flex flex-col gap-4">
      <PageIntro
        title={title}
        description={description}
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus />
            New item
          </Button>
        }
      />
      <CreateWorkItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teamId={team?.id ?? data.ui.activeTeamId}
        disabled={!editable}
      />
      {views.length > 0 && activeView ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={activeView.id}
            onValueChange={(value) => useAppStore.getState().setSelectedView(routeKey, value)}
          >
            <TabsList>
              {views.map((view) => (
                <TabsTrigger key={view.id} value={view.id}>
                  {view.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <FilterPopover view={activeView} items={items} />
            <ViewConfigPopover view={activeView} />
          </div>
        </div>
      ) : null}
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
              editable={editable}
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
        <EmptyCard title="No views" description={emptyLabel} />
      )}
      {activeView && filteredItems.length === 0 ? (
        <EmptyCard
          title="Nothing matches this view"
          description={emptyLabel}
        />
      ) : null}
    </div>
  )
}

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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <FadersHorizontal />
          Filters
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 text-sm font-medium">Status</div>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={
                    view.filters.status.includes(status) ? "secondary" : "outline"
                  }
                  onClick={() =>
                    useAppStore
                      .getState()
                      .toggleViewFilterValue(view.id, "status", status)
                  }
                >
                  {statusMeta[status].label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Priority</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(priorityMeta).map(([priority, meta]) => (
                <Button
                  key={priority}
                  size="sm"
                  variant={
                    view.filters.priority.includes(priority as Priority)
                      ? "secondary"
                      : "outline"
                  }
                  onClick={() =>
                    useAppStore
                      .getState()
                      .toggleViewFilterValue(view.id, "priority", priority)
                  }
                >
                  {meta.label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Assignee</div>
            <div className="flex flex-wrap gap-2">
              {assignees.map((assignee) => (
                <Button
                  key={assignee.id}
                  size="sm"
                  variant={
                    view.filters.assigneeIds.includes(assignee.id)
                      ? "secondary"
                      : "outline"
                  }
                  onClick={() =>
                    useAppStore
                      .getState()
                      .toggleViewFilterValue(view.id, "assigneeIds", assignee.id)
                  }
                >
                  {assignee.name}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Projects</div>
            <div className="flex flex-wrap gap-2">
              {projects.map((project) => (
                <Button
                  key={project.id}
                  size="sm"
                  variant={
                    view.filters.projectIds.includes(project.id)
                      ? "secondary"
                      : "outline"
                  }
                  onClick={() =>
                    useAppStore
                      .getState()
                      .toggleViewFilterValue(view.id, "projectIds", project.id)
                  }
                >
                  {project.name}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Labels</div>
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <Button
                  key={label.id}
                  size="sm"
                  variant={
                    view.filters.labelIds.includes(label.id) ? "secondary" : "outline"
                  }
                  onClick={() =>
                    useAppStore
                      .getState()
                      .toggleViewFilterValue(view.id, "labelIds", label.id)
                  }
                >
                  {label.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ViewConfigPopover({ view }: { view: ViewDefinition }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <SquaresFour />
          View config
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[28rem]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            {[
              { value: "list", label: "List", icon: <Rows /> },
              { value: "board", label: "Board", icon: <Kanban /> },
              { value: "timeline", label: "Timeline", icon: <CalendarDots /> },
            ].map((layout) => (
              <Button
                key={layout.value}
                variant={view.layout === layout.value ? "secondary" : "outline"}
                onClick={() =>
                  useAppStore
                    .getState()
                    .updateViewConfig(view.id, { layout: layout.value as ViewDefinition["layout"] })
                }
              >
                {layout.icon}
                {layout.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <InlineSelect
              label="Grouping"
              value={view.grouping}
              options={groupOptions.map((option) => ({ value: option, label: option }))}
              onValueChange={(value) =>
                useAppStore
                  .getState()
                  .updateViewConfig(view.id, { grouping: value as GroupField })
              }
            />
            <InlineSelect
              label="Sub-grouping"
              value={view.subGrouping ?? "none"}
              options={[
                { value: "none", label: "None" },
                ...groupOptions.map((option) => ({ value: option, label: option })),
              ]}
              onValueChange={(value) =>
                useAppStore.getState().updateViewConfig(view.id, {
                  subGrouping: value === "none" ? null : (value as GroupField),
                })
              }
            />
            <InlineSelect
              label="Ordering"
              value={view.ordering}
              options={orderingOptions.map((option) => ({ value: option, label: option }))}
              onValueChange={(value) =>
                useAppStore
                  .getState()
                  .updateViewConfig(view.id, { ordering: value as OrderingField })
              }
            />
            <InlineSelect
              label="Completed work"
              value={String(view.filters.showCompleted)}
              options={[
                { value: "true", label: "Show" },
                { value: "false", label: "Hide" },
              ]}
              onValueChange={(value) =>
                useAppStore
                  .getState()
                  .updateViewConfig(view.id, { showCompleted: value === "true" })
              }
            />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Display properties</div>
            <div className="flex flex-wrap gap-2">
              {displayPropertyOptions.map((property) => (
                <Button
                  key={property}
                  size="sm"
                  variant={
                    view.displayProps.includes(property) ? "secondary" : "outline"
                  }
                  onClick={() =>
                    useAppStore.getState().toggleViewDisplayProperty(view.id, property)
                  }
                >
                  {property}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

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
    <div className="flex flex-col gap-4">
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="w-full">
          <div className="flex min-w-max gap-4 pb-4">
            {visibleGroups.map(([groupName, subgroups]) => (
              <Card key={groupName} className="w-[21rem] shrink-0 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">{groupName}</CardTitle>
                  <CardDescription>
                    {Array.from(subgroups.values()).flat().length} items
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {Array.from(subgroups.entries()).map(([subgroupName, subItems]) => {
                    const hidden = view.hiddenState.subgroups.includes(subgroupName)

                    if (hidden) {
                      return null
                    }

                    return (
                      <BoardDropLane
                        key={`${groupName}-${subgroupName}`}
                        id={`board::${groupName}::${subgroupName}`}
                        label={subgroupName}
                      >
                        {subItems.map((item) => (
                          <DraggableWorkCard
                            key={item.id}
                            item={item}
                            data={data}
                            compact
                          />
                        ))}
                      </BoardDropLane>
                    )
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
        {hiddenGroups.length > 0 ? (
          <HiddenStateBar
            label="Hidden columns"
            values={hiddenGroups.map(([groupName]) => groupName)}
            onToggle={(value) =>
              useAppStore.getState().toggleViewHiddenValue(view.id, "groups", value)
            }
          />
        ) : null}
        {view.hiddenState.subgroups.length > 0 ? (
          <HiddenStateBar
            label="Hidden rows"
            values={view.hiddenState.subgroups}
            onToggle={(value) =>
              useAppStore
                .getState()
                .toggleViewHiddenValue(view.id, "subgroups", value)
            }
          />
        ) : null}
        <DragOverlay>
          {activeItem ? (
            <div className="w-[18rem]">
              <WorkCardBody data={data} item={activeItem} compact />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function ListView({
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

  return (
    <div className="flex flex-col gap-4">
      {groups.map(([groupName, subgroups]) => {
        if (view.hiddenState.groups.includes(groupName)) {
          return null
        }

        return (
          <Card key={groupName} className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">{groupName}</CardTitle>
              <CardDescription>
                {Array.from(subgroups.values()).flat().length} items
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {Array.from(subgroups.entries()).map(([subgroupName, subItems]) => {
                if (view.hiddenState.subgroups.includes(subgroupName)) {
                  return null
                }

                return (
                  <div key={`${groupName}-${subgroupName}`} className="flex flex-col gap-2">
                    {view.subGrouping ? (
                      <div className="text-sm font-medium text-muted-foreground">
                        {subgroupName}
                      </div>
                    ) : null}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          {view.displayProps.map((property) => (
                            <TableHead key={property}>{property}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subItems.map((item) => (
                          <ListRow
                            key={item.id}
                            data={data}
                            item={item}
                            editable={editable}
                            displayProps={view.displayProps}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}
      {view.hiddenState.groups.length > 0 ? (
        <HiddenStateBar
          label="Hidden groups"
          values={view.hiddenState.groups}
          onToggle={(value) =>
            useAppStore.getState().toggleViewHiddenValue(view.id, "groups", value)
          }
        />
      ) : null}
      {view.hiddenState.subgroups.length > 0 ? (
        <HiddenStateBar
          label="Hidden rows"
          values={view.hiddenState.subgroups}
          onToggle={(value) =>
            useAppStore.getState().toggleViewHiddenValue(view.id, "subgroups", value)
          }
        />
      ) : null}
    </div>
  )
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
  const timelineStart = startOfDay(subDays(new Date(), 2))
  const timelineEnd = endOfDay(addDays(new Date(), 18))
  const days = eachDayOfInterval({
    start: timelineStart,
    end: timelineEnd,
  })
  const groups = [...buildItemGroups(data, items, { ...view, subGrouping: null }).entries()]

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
    <div className="flex flex-col gap-4">
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>
              Drag bars horizontally to shift item schedules.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 overflow-x-auto">
            <div
              className="grid min-w-[90rem] gap-3"
              style={{ gridTemplateColumns: "16rem 1fr" }}
            >
              <div />
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${days.length}, minmax(3rem, 1fr))`,
                }}
              >
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="rounded-lg border px-2 py-2 text-center text-xs text-muted-foreground"
                  >
                    {format(day, "MMM d")}
                  </div>
                ))}
              </div>
            </div>
            {groups.map(([groupName, subgroups]) => {
              if (view.hiddenState.groups.includes(groupName)) {
                return null
              }

              const groupItems = Array.from(subgroups.values()).flat()

              return (
                <div key={groupName} className="flex flex-col gap-3">
                  <div className="text-sm font-medium">{groupName}</div>
                  {groupItems.map((item) => (
                    <TimelineRow
                      key={item.id}
                      data={data}
                      days={days}
                      item={item}
                    />
                  ))}
                </div>
              )
            })}
          </CardContent>
        </Card>
        <DragOverlay>
          {activeItemId ? (
            <div className="rounded-xl border bg-card px-3 py-2 text-sm shadow-lg">
              {data.workItems.find((item) => item.id === activeItemId)?.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function ListRow({
  data,
  item,
  editable,
  displayProps,
}: {
  data: AppData
  item: WorkItem
  editable: boolean
  displayProps: DisplayProperty[]
}) {
  const team = getTeam(data, item.teamId)
  const projectOptions = [
    { value: "none", label: "No project" },
    ...data.projects.map((project) => ({ value: project.id, label: project.name })),
  ]

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Link className="font-medium hover:underline" href={`/items/${item.id}`}>
            {item.title}
          </Link>
          <span className="text-xs text-muted-foreground">{item.key}</span>
        </div>
      </TableCell>
      {displayProps.map((property) => (
        <TableCell key={property}>
          {property === "status" ? (
            <MiniSelect
              disabled={!editable}
              value={item.status}
              options={getStatusOrderForTeam(team).map((status) => ({
                value: status,
                label: statusMeta[status].label,
              }))}
              onValueChange={(value) =>
                useAppStore.getState().updateWorkItem(item.id, {
                  status: value as WorkItem["status"],
                })
              }
            />
          ) : null}
          {property === "priority" ? (
            <MiniSelect
              disabled={!editable}
              value={item.priority}
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
          ) : null}
          {property === "assignee" ? (
            <MiniSelect
              disabled={!editable}
              value={item.assigneeId ?? "unassigned"}
              options={[
                { value: "unassigned", label: "Unassigned" },
                ...data.users.map((user) => ({ value: user.id, label: user.name })),
              ]}
              onValueChange={(value) =>
                useAppStore.getState().updateWorkItem(item.id, {
                  assigneeId: value === "unassigned" ? null : value,
                })
              }
            />
          ) : null}
          {property === "project" ? (
            <MiniSelect
              disabled={!editable}
              value={item.primaryProjectId ?? "none"}
              options={projectOptions}
              onValueChange={(value) =>
                useAppStore.getState().updateWorkItem(item.id, {
                  primaryProjectId: value === "none" ? null : value,
                })
              }
            />
          ) : null}
          {!["status", "priority", "assignee", "project"].includes(property) ? (
            <span className="text-sm text-muted-foreground">
              {formatPropertyValue(data, item, property)}
            </span>
          ) : null}
        </TableCell>
      ))}
    </TableRow>
  )
}

function TimelineRow({
  data,
  item,
  days,
}: {
  data: AppData
  item: WorkItem
  days: Date[]
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

  return (
    <div
      className="grid min-w-[90rem] gap-3"
      style={{ gridTemplateColumns: "16rem 1fr" }}
    >
      <div className="rounded-xl border px-3 py-3">
        <div className="flex flex-col gap-1">
          <Link className="font-medium hover:underline" href={`/items/${item.id}`}>
            {item.title}
          </Link>
          <span className="text-xs text-muted-foreground">
            {getProject(data, item.primaryProjectId)?.name ?? "No project"}
          </span>
        </div>
      </div>
      <div className="relative">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${days.length}, minmax(3rem, 1fr))`,
          }}
        >
          {days.map((day) => (
            <TimelineDropCell
              key={`${item.id}-${day.toISOString()}`}
              id={`timeline::${item.id}::${day.toISOString()}`}
            />
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-0 grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${days.length}, minmax(3rem, 1fr))`,
          }}
        >
          <div
            className="pointer-events-auto h-full"
            style={{
              gridColumn: `${startIndex + 1} / span ${span}`,
            }}
          >
            <TimelineBar item={item} />
          </div>
        </div>
      </div>
    </div>
  )
}

function CommentsCard({
  targetType,
  targetId,
  editable,
  title,
}: {
  targetType: "workItem" | "document"
  targetId: string
  editable: boolean
  title: string
}) {
  const data = useAppStore()
  const comments = getCommentsForTarget(data, targetType, targetId)
  const [content, setContent] = useState("")

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Comments create inbox records and mention notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-xl border px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium">
                {getUser(data, comment.createdBy)?.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(comment.createdAt), "MMM d, h:mm a")}
              </span>
            </div>
            <p className="text-sm leading-7">{comment.content}</p>
          </div>
        ))}
        <div className="flex flex-col gap-3">
          <Textarea
            disabled={!editable}
            placeholder="Leave a comment. Use @declan style mentions."
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <div className="flex justify-end">
            <Button
              disabled={!editable}
              onClick={() => {
                useAppStore.getState().addComment({ targetType, targetId, content })
                setContent("")
              }}
            >
              <ChatsCircle />
              Comment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

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
  const templateDefaults = getTemplateDefaultsForTeam(settingsTeam, templateType)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Launch templates cover software delivery, bug tracking, and project
            management.
          </DialogDescription>
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
              <FieldDescription>
                {settingsTeam
                  ? `${settingsTeam.name} defaults to ${priorityMeta[templateDefaults.defaultPriority].label.toLowerCase()} priority, ${templateDefaults.targetWindowDays} days, and ${templateDefaults.defaultViewLayout} layout for this template.`
                  : templateMeta[templateType].description}
              </FieldDescription>
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
  teamId,
  disabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  disabled: boolean
}) {
  const [title, setTitle] = useState("New Team Document")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create document</DialogTitle>
          <DialogDescription>
            Documents are team-owned and roll up into workspace-level document views.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Title</FieldLabel>
            <FieldContent>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              <FieldDescription>
                The document will be created under the current team context.
              </FieldDescription>
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
              useAppStore.getState().createDocument({ teamId, title })
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
          <DialogDescription>
            Shared work-item engine with typed records for bugs, tasks, features, and more.
          </DialogDescription>
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

function HiddenStateBar({
  label,
  values,
  onToggle,
}: {
  label: string
  values: string[]
  onToggle: (value: string) => void
}) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {values.map((value) => (
          <Button key={value} variant="outline" onClick={() => onToggle(value)}>
            <CaretRight />
            {value}
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}

function BoardDropLane({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-col gap-2 rounded-xl border border-dashed p-2 transition-colors",
          isOver ? "border-primary bg-primary/5" : "border-border"
        )}
      >
        {children}
      </div>
    </div>
  )
}

function DraggableWorkCard({
  data,
  item,
  compact = false,
}: {
  data: AppData
  item: WorkItem
  compact?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
      }}
      className={cn(isDragging ? "opacity-60" : "opacity-100")}
      {...listeners}
      {...attributes}
    >
      <WorkCardBody data={data} item={item} compact={compact} />
    </div>
  )
}

function WorkCardBody({
  data,
  item,
  compact = false,
}: {
  data: AppData
  item: WorkItem
  compact?: boolean
}) {
  const labelMap = getLabelMap(data)

  return (
    <Card className="shadow-none">
      <CardContent className={cn("flex flex-col gap-3 px-3 py-3", compact ? "" : "py-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{item.key}</span>
            <Link className="font-medium hover:underline" href={`/items/${item.id}`}>
              {item.title}
            </Link>
          </div>
          <Badge variant="outline">{priorityMeta[item.priority].label}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {getProject(data, item.primaryProjectId)?.name ?? "No project"}
          </Badge>
          {item.assigneeId ? (
            <Badge variant="outline">{getUser(data, item.assigneeId)?.name}</Badge>
          ) : null}
          {item.labelIds.slice(0, 2).map((labelId) => (
            <Badge key={labelId} variant="outline">
              {labelMap[labelId]?.name}
            </Badge>
          ))}
        </div>
        {!compact && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Due{" "}
              {item.dueDate ? format(new Date(item.dueDate), "MMM d") : "not set"}
            </span>
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/items/${item.id}`}>Open</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TimelineDropCell({ id }: { id: string }) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-12 rounded-lg border transition-colors",
        isOver ? "border-primary bg-primary/10" : "border-border"
      )}
    />
  )
}

function TimelineBar({ item }: { item: WorkItem }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      className="flex h-full w-full items-center rounded-lg bg-primary px-3 text-left text-xs font-medium text-primary-foreground"
      style={{
        transform: CSS.Translate.toString(transform),
      }}
      {...listeners}
      {...attributes}
    >
      {item.title}
    </button>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-3 py-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}

function PageIntro({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function InlineSelect({
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
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldContent>
        <Select disabled={disabled} value={value} onValueChange={onValueChange}>
          <SelectTrigger>
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
      </FieldContent>
    </Field>
  )
}

function MiniSelect({
  value,
  options,
  onValueChange,
  disabled,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <Select disabled={disabled} value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 min-w-36">
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
  )
}

function DateField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string | null
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldContent>
        <Input
          disabled={disabled}
          type="date"
          value={value ? format(new Date(value), "yyyy-MM-dd") : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      </FieldContent>
    </Field>
  )
}

function MissingState({ title }: { title: string }) {
  return <EmptyCard title={title} description="The requested entity does not exist." />
}

function EmptyCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function formatPropertyValue(
  data: AppData,
  item: WorkItem,
  property: DisplayProperty
) {
  if (property === "id") {
    return item.key
  }

  if (property === "type") {
    return workItemTypeMeta[item.type].label
  }

  if (property === "dueDate") {
    return item.dueDate ? format(new Date(item.dueDate), "MMM d") : "—"
  }

  if (property === "milestone") {
    return (
      data.milestones.find((milestone) => milestone.id === item.milestoneId)?.name ??
      "—"
    )
  }

  if (property === "labels") {
    return item.labelIds
      .map((labelId) => data.labels.find((label) => label.id === labelId)?.name)
      .filter(Boolean)
      .join(", ")
  }

  if (property === "created") {
    return format(new Date(item.createdAt), "MMM d")
  }

  if (property === "updated") {
    return format(new Date(item.updatedAt), "MMM d")
  }

  return "—"
}

function getPatchForField(
  data: AppData,
  field: GroupField | null,
  value: string
) {
  if (!field || value === "all") {
    return {}
  }

  if (field === "status") {
    return { status: value as WorkItem["status"] }
  }

  if (field === "priority") {
    return { priority: value as Priority }
  }

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

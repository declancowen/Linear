"use client"

import { useMemo, type MouseEvent, type ReactNode } from "react"
import {
  CaretRight,
  CopySimple,
  UserCircle,
  Users,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import { AppLink, useAppRouter } from "@/lib/browser/app-navigation"
import { fetchWorkspacePeopleReadModel } from "@/lib/convex/client/read-models"
import {
  getChannelPostHref,
  getCurrentWorkspace,
  getProjectHref,
  getWorkspacePeople,
  getWorkspacePerson,
  getWorkspacePersonActivity,
  hasWorkspaceAccess,
  type PersonActivity,
} from "@/lib/domain/selectors"
import {
  resolveUserStatus,
  statusMeta,
  userStatusMeta,
  type AppData,
  type UserProfile,
  type UserStatus,
} from "@/lib/domain/types"
import { getWorkspacePeopleScopeKeys } from "@/lib/scoped-sync/read-models"
import { useAppStore } from "@/lib/store/app-store"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import { UserAvatar, UserStatusDot } from "@/components/app/user-presence"
import { formatTimestamp } from "@/components/app/collaboration-screens/utils"
import { selectAppDataSnapshot } from "@/components/app/screens/helpers"
import {
  MissingState,
  SCREEN_HEADER_CLASS_NAME,
  ScreenHeader,
} from "@/components/app/screens/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn, getPlainTextContent } from "@/lib/utils"

type WorkspacePersonMeta = {
  isSelf: boolean
  roleLabels: string[]
  teamNames: string[]
  teamSummary: string
}

const STATUS_ACCENT_CLASSES: Record<UserStatus, string> = {
  active: "bg-emerald-500",
  away: "bg-amber-500",
  busy: "bg-rose-500",
  "out-of-office": "bg-violet-500",
  offline: "bg-zinc-400 dark:bg-zinc-500",
}

function formatRoleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function getPersonName(person: UserProfile) {
  return person.name.trim() || person.email || person.handle || "Unknown user"
}

function getPersonTitle(person: UserProfile) {
  return person.title.trim() || "No title"
}

function getWorkspacePersonMeta(
  data: AppData,
  workspaceId: string,
  person: UserProfile
): WorkspacePersonMeta {
  const workspace = data.workspaces.find((entry) => entry.id === workspaceId)
  const workspaceTeams = data.teams.filter(
    (team) => team.workspaceId === workspaceId
  )
  const workspaceTeamById = new Map(
    workspaceTeams.map((team) => [team.id, team])
  )
  const teamMemberships = data.teamMemberships.filter(
    (membership) =>
      membership.userId === person.id &&
      workspaceTeamById.has(membership.teamId)
  )
  const workspaceMembership = data.workspaceMemberships.find(
    (membership) =>
      membership.workspaceId === workspaceId && membership.userId === person.id
  )
  const isOwner = workspace?.createdBy === person.id
  const roleLabels = new Set<string>()

  if (isOwner) {
    roleLabels.add("Owner")
  } else if (workspaceMembership) {
    roleLabels.add(formatRoleLabel(workspaceMembership.role))
  }

  if (
    !roleLabels.has("Owner") &&
    !roleLabels.has("Admin") &&
    teamMemberships.some((membership) => membership.role === "admin")
  ) {
    roleLabels.add("Team admin")
  }

  if (person.id === data.currentUserId) {
    roleLabels.add("You")
  }

  const teamNames = teamMemberships
    .map((membership) => workspaceTeamById.get(membership.teamId)?.name ?? "")
    .filter(Boolean)
    .sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: "base" })
    )
  const teamSummary =
    teamNames.length === 0
      ? "No teams"
      : `${teamNames.slice(0, 2).join(", ")}${teamNames.length > 2 ? ` +${teamNames.length - 2}` : ""}`

  return {
    isSelf: person.id === data.currentUserId,
    roleLabels: [...roleLabels],
    teamNames,
    teamSummary,
  }
}

function PeopleReadModelBoundary({ children }: { children: ReactNode }) {
  const workspaceId = useAppStore((state) => state.currentWorkspaceId)

  useScopedReadModelRefresh({
    enabled: Boolean(workspaceId),
    scopeKeys: workspaceId ? getWorkspacePeopleScopeKeys(workspaceId) : [],
    fetchLatest: () => fetchWorkspacePeopleReadModel(workspaceId),
    diagnostics: {
      retainedData: Boolean(workspaceId),
      surface: "people",
    },
  })

  return <>{children}</>
}

function startMessageWithPerson(person: UserProfile, workspaceId: string) {
  return useAppStore.getState().createWorkspaceChat({
    participantIds: [person.id],
    workspaceId,
    title: "",
    description: "",
  })
}

function PersonCard({
  data,
  person,
  workspaceId,
}: {
  data: AppData
  person: UserProfile
  workspaceId: string
}) {
  const router = useAppRouter()
  const meta = getWorkspacePersonMeta(data, workspaceId, person)
  const resolvedStatus = resolveUserStatus(person.status)
  const canMessage =
    !meta.isSelf && hasWorkspaceAccess(data, workspaceId, person.id)
  const canEmail = Boolean(person.email) && !meta.isSelf

  function handleEmail(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (person.email) {
      window.location.href = `mailto:${person.email}`
    }
  }

  function handleMessage(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    const conversationId = startMessageWithPerson(person, workspaceId)
    if (conversationId) {
      router.push(`/chats?chatId=${conversationId}`)
    }
  }

  return (
    <AppLink
      data-testid={`person-card-${person.id}`}
      href={`/workspace/people/${person.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all hover:-translate-y-0.5 hover:border-fg-4 hover:shadow-md"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-0.5",
          STATUS_ACCENT_CLASSES[resolvedStatus]
        )}
      />

      <div className="flex flex-col items-center gap-3 px-5 pt-7 pb-5 text-center">
        <UserAvatar
          name={person.name}
          avatarImageUrl={person.avatarImageUrl}
          avatarUrl={person.avatarUrl}
          status={person.status}
          size="lg"
          className="size-16 ring-2 ring-line-soft ring-offset-2 ring-offset-surface"
        />

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight text-foreground group-hover:underline">
            {getPersonName(person)}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {getPersonTitle(person)}
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-fg-2">
          <UserStatusDot status={resolvedStatus} />
          {userStatusMeta[resolvedStatus].label}
        </span>

        {meta.roleLabels.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-1.5">
            {meta.roleLabels.map((label) => (
              <Badge key={label} variant="outline" className="font-normal">
                {label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {canEmail || canMessage ? (
        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-line bg-surface px-4 py-3">
          <Button
            variant="default"
            size="sm"
            className="w-full"
            disabled={!canMessage}
            onClick={handleMessage}
          >
            Message
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!canEmail}
            onClick={handleEmail}
          >
            Email
          </Button>
        </div>
      ) : null}
    </AppLink>
  )
}

export function PeopleScreen() {
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const workspace = getCurrentWorkspace(data)
  const people = useMemo(
    () => (workspace ? getWorkspacePeople(data, workspace.id) : []),
    [data, workspace]
  )

  return (
    <PeopleReadModelBoundary>
      <div className="flex h-full min-h-0 flex-col bg-background">
        <ScreenHeader title="People" />
        {!workspace ? (
          <MissingState
            icon={Users}
            title="No workspace selected"
            subtitle="Select a workspace to view its people."
          />
        ) : people.length === 0 ? (
          <MissingState
            icon={Users}
            title="No people found"
            subtitle="Workspace members will appear here."
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-6">
              <div
                data-testid="people-grid"
                className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4"
              >
                {people.map((person) => (
                  <PersonCard
                    key={person.id}
                    data={data}
                    person={person}
                    workspaceId={workspace.id}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </PeopleReadModelBoundary>
  )
}

function truncateActivityDetail(value: string) {
  const compact = value.replace(/\s+/g, " ").trim()

  if (compact.length <= 120) {
    return compact
  }

  return `${compact.slice(0, 117)}...`
}

function getCommentPreview(
  data: AppData,
  commentId: string,
  fallback = "Comment detail unavailable"
) {
  const comment = data.comments.find((entry) => entry.id === commentId)
  const preview = comment
    ? truncateActivityDetail(getPlainTextContent(comment.content))
    : ""

  return preview || fallback
}

function getChannelCommentPreview(data: AppData, commentId: string) {
  const comment = data.channelPostComments.find(
    (entry) => entry.id === commentId
  )
  const preview = comment
    ? truncateActivityDetail(getPlainTextContent(comment.content))
    : ""

  return preview || "Comment detail unavailable"
}

function getLabelNameById(data: AppData, labelId: string) {
  return data.labels.find((label) => label.id === labelId)?.name ?? labelId
}

function getUserNameById(data: AppData, userId: string) {
  const user = data.users.find((entry) => entry.id === userId)
  return user ? getPersonName(user) : userId
}

function getChangeListDetail(input: {
  property: string
  fromValues: string[]
  toValues: string[]
  emptyLabel: string
}) {
  const fromSet = new Set(input.fromValues)
  const toSet = new Set(input.toValues)
  const added = input.toValues.filter((value) => !fromSet.has(value))
  const removed = input.fromValues.filter((value) => !toSet.has(value))
  const detailParts = [
    added.length > 0 ? `added ${added.join(", ")}` : "",
    removed.length > 0 ? `removed ${removed.join(", ")}` : "",
  ].filter(Boolean)

  return `${input.property}: ${
    detailParts.length > 0 ? detailParts.join("; ") : input.emptyLabel
  }`
}

function getWorkItemActivityDetail(data: AppData, activityId: string) {
  const activity = data.workItemActivities.find(
    (entry) => entry.id === activityId
  )

  if (!activity) {
    return null
  }

  switch (activity.type) {
    case "status-change":
      return `Status: ${statusMeta[activity.fromStatus].label} to ${
        statusMeta[activity.toStatus].label
      }`
    case "label-change":
      return getChangeListDetail({
        property: "Labels",
        fromValues: activity.fromLabelIds.map((labelId) =>
          getLabelNameById(data, labelId)
        ),
        toValues: activity.toLabelIds.map((labelId) =>
          getLabelNameById(data, labelId)
        ),
        emptyLabel: "no visible label change",
      })
    case "assignee-change":
      return getChangeListDetail({
        property: "Assignees",
        fromValues: activity.fromAssigneeIds.map((userId) =>
          getUserNameById(data, userId)
        ),
        toValues: activity.toAssigneeIds.map((userId) =>
          getUserNameById(data, userId)
        ),
        emptyLabel: "no visible assignee change",
      })
  }
}

function getProjectUpdatePreview(data: AppData, updateId: string) {
  const update = data.projectUpdates.find((entry) => entry.id === updateId)
  const preview = update
    ? truncateActivityDetail(getPlainTextContent(update.content))
    : ""

  return preview || null
}

function getActivityPresentation(data: AppData, activity: PersonActivity) {
  switch (activity.type) {
    case "workItemCreated":
      return {
        label: "Created work item",
        category: "Work",
        href: `/items/${activity.itemId}`,
      }
    case "workItemCommented":
      return {
        label: "Commented on work item",
        category: "Work",
        href: `/items/${activity.itemId}`,
        detail: getCommentPreview(data, activity.commentId),
      }
    case "workItemStatusChanged":
      return {
        label: "Changed work item status",
        category: "Work",
        href: `/items/${activity.itemId}`,
        detail: getWorkItemActivityDetail(data, activity.activityId),
      }
    case "workItemLabelsChanged":
      return {
        label: "Updated work item labels",
        category: "Work",
        href: `/items/${activity.itemId}`,
        detail: getWorkItemActivityDetail(data, activity.activityId),
      }
    case "workItemAssigneesChanged":
      return {
        label: "Updated work item assignees",
        category: "Work",
        href: `/items/${activity.itemId}`,
        detail: getWorkItemActivityDetail(data, activity.activityId),
      }
    case "documentCommented":
      return {
        label: "Commented on document",
        category: "Docs",
        href: `/docs/${activity.documentId}`,
        detail: getCommentPreview(data, activity.commentId),
      }
    case "channelPostCreated":
      return {
        label: "Created channel post",
        category: "Channel",
        href: getChannelPostHref(data, activity.postId) ?? "/workspace/channel",
      }
    case "channelPostCommented":
      return {
        label: "Commented on channel post",
        category: "Channel",
        href: getChannelPostHref(data, activity.postId) ?? "/workspace/channel",
        detail: getChannelCommentPreview(data, activity.commentId),
      }
    case "projectUpdatePosted":
      return {
        label: "Posted project update",
        category: "Projects",
        href: getProjectHref(data, activity.projectId) ?? "/workspace/projects",
        detail: getProjectUpdatePreview(data, activity.updateId),
      }
  }
}

const ACTIVITY_CATEGORY_CLASSES: Record<string, string> = {
  Work: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Docs: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  Channel: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Projects: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
}

function ActivityRow({
  activity,
  data,
}: {
  activity: PersonActivity
  data: AppData
}) {
  const presentation = getActivityPresentation(data, activity)

  return (
    <AppLink
      href={presentation.href}
      className="group relative flex items-start gap-4 rounded-md px-3 py-2.5 transition-colors hover:bg-surface-3"
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] leading-4 font-semibold tracking-wide uppercase",
          ACTIVITY_CATEGORY_CLASSES[presentation.category] ??
            "bg-muted text-muted-foreground"
        )}
      >
        {presentation.category}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] leading-5 text-fg-2">
          {presentation.label}
          <span className="px-1.5 text-muted-foreground/50">·</span>
          <span className="font-medium text-foreground group-hover:underline">
            {activity.title}
          </span>
        </div>
        {presentation.detail ? (
          <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-4 text-muted-foreground">
            {presentation.detail}
          </div>
        ) : null}
      </div>
      <time
        className="shrink-0 text-xs text-muted-foreground"
        dateTime={activity.createdAt}
      >
        {formatTimestamp(activity.createdAt)}
      </time>
    </AppLink>
  )
}

function getActivityKey(activity: PersonActivity) {
  switch (activity.type) {
    case "workItemCreated":
      return `${activity.type}-${activity.itemId}`
    case "workItemCommented":
      return `${activity.type}-${activity.commentId}`
    case "workItemStatusChanged":
    case "workItemLabelsChanged":
    case "workItemAssigneesChanged":
      return `${activity.type}-${activity.activityId}`
    case "documentCommented":
      return `${activity.type}-${activity.commentId}`
    case "channelPostCreated":
      return `${activity.type}-${activity.postId}`
    case "channelPostCommented":
      return `${activity.type}-${activity.commentId}`
    case "projectUpdatePosted":
      return `${activity.type}-${activity.updateId}`
  }
}

function getActivityDayKey(activity: PersonActivity) {
  return activity.createdAt.slice(0, 10)
}

function formatActivityDayLabel(dayKey: string) {
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)

  if (dayKey === todayKey) {
    return "Today"
  }

  if (dayKey === yesterdayKey) {
    return "Yesterday"
  }

  const date = new Date(`${dayKey}T00:00:00Z`)

  if (Number.isNaN(date.valueOf())) {
    return dayKey
  }

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year:
      date.getUTCFullYear() === today.getUTCFullYear() ? undefined : "numeric",
  })
}

function groupActivityByDay(activity: PersonActivity[]) {
  const groups = new Map<string, PersonActivity[]>()

  for (const entry of activity) {
    const key = getActivityDayKey(entry)
    const existing = groups.get(key)

    if (existing) {
      existing.push(entry)
    } else {
      groups.set(key, [entry])
    }
  }

  return [...groups.entries()].map(([dayKey, entries]) => ({
    dayKey,
    entries,
  }))
}

function PersonProfileBreadcrumb({ person }: { person: UserProfile | null }) {
  return (
    <nav
      aria-label="Profile breadcrumb"
      className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] text-fg-2"
    >
      <SidebarTrigger className="size-5 shrink-0" />
      <AppLink
        href="/workspace/people"
        className="shrink-0 text-fg-3 hover:text-foreground"
      >
        People
      </AppLink>
      <CaretRight className="size-3 shrink-0 text-fg-4" />
      <span
        aria-current="page"
        className="min-w-0 truncate font-medium text-foreground"
      >
        {person ? getPersonName(person) : "Profile"}
      </span>
    </nav>
  )
}

export function PeopleProfileScreen({ userId }: { userId: string }) {
  const router = useAppRouter()
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const workspace = getCurrentWorkspace(data)
  const person = workspace
    ? getWorkspacePerson(data, workspace.id, userId)
    : null
  const activity = useMemo(
    () =>
      workspace && person
        ? getWorkspacePersonActivity(data, workspace.id, person.id)
        : [],
    [data, person, workspace]
  )

  return (
    <PeopleReadModelBoundary>
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className={SCREEN_HEADER_CLASS_NAME}>
          <PersonProfileBreadcrumb person={person} />
        </div>
        {!workspace || !person ? (
          <MissingState
            icon={UserCircle}
            title="Person not found"
            subtitle="This person is not part of the current workspace."
          />
        ) : (
          <PersonProfileContent
            activity={activity}
            data={data}
            onMessage={() => {
              const conversationId = startMessageWithPerson(
                person,
                workspace.id
              )

              if (conversationId) {
                router.push(`/chats?chatId=${conversationId}`)
              }
            }}
            person={person}
            workspaceId={workspace.id}
          />
        )}
      </div>
    </PeopleReadModelBoundary>
  )
}

function ProfileHero({
  canEmail,
  canMessage,
  meta,
  onMessage,
  person,
}: {
  canEmail: boolean
  canMessage: boolean
  meta: WorkspacePersonMeta
  onMessage: () => void
  person: UserProfile
}) {
  const resolvedStatus = resolveUserStatus(person.status)

  async function handleCopyEmail() {
    if (!person.email) {
      return
    }

    try {
      await navigator.clipboard.writeText(person.email)
      toast.success("Email copied")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to copy email"
      )
    }
  }

  return (
    <section className="border-b border-line bg-background">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-6 py-7 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-5">
          <UserAvatar
            name={person.name}
            avatarImageUrl={person.avatarImageUrl}
            avatarUrl={person.avatarUrl}
            status={person.status}
            size="lg"
            className="size-20 shrink-0 ring-4 ring-background ring-offset-0"
            badgeClassName="size-3.5"
          />

          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              {getPersonName(person)}
            </h1>
            <div className="mt-1 truncate text-sm text-muted-foreground">
              {getPersonTitle(person)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-medium text-fg-2">
                <UserStatusDot status={resolvedStatus} />
                {userStatusMeta[resolvedStatus].label}
              </span>
              {meta.roleLabels.map((label) => (
                <Badge key={label} variant="outline" className="font-normal">
                  {label}
                </Badge>
              ))}
              {person.email ? (
                <span className="inline-flex items-center gap-1">
                  <a
                    href={`mailto:${person.email}`}
                    className="truncate hover:text-foreground hover:underline"
                  >
                    {person.email}
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0"
                    aria-label="Copy email"
                    title="Copy email"
                    onClick={() => void handleCopyEmail()}
                  >
                    <CopySimple className="size-3.5" />
                  </Button>
                </span>
              ) : null}
            </div>
            {person.statusMessage.trim() ? (
              <p className="mt-3 max-w-2xl text-sm text-foreground italic">
                “{person.statusMessage}”
              </p>
            ) : null}
          </div>
        </div>

        {canEmail || canMessage ? (
          <div className="flex shrink-0 gap-2">
            {canMessage ? (
              <Button size="sm" onClick={onMessage}>
                Message
              </Button>
            ) : null}
            {canEmail ? (
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${person.email}`}>Email</a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SectionCardHeader({
  title,
  meta,
}: {
  title: string
  meta?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
      <h3 className="text-[11px] font-semibold tracking-wide text-fg-3 uppercase">
        {title}
      </h3>
      {meta}
    </div>
  )
}

function ProfileSidebar({
  meta,
  person,
}: {
  meta: WorkspacePersonMeta
  person: UserProfile
}) {
  const resolvedStatus = resolveUserStatus(person.status)

  return (
    <aside className="flex flex-col gap-4">
      <div className="flex flex-col rounded-xl border border-line bg-background">
        <SectionCardHeader title="About" />
        <dl className="grid grid-cols-1 gap-x-4 gap-y-4 px-5 py-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="mt-1 inline-flex items-center gap-1.5 text-fg-2">
              <UserStatusDot status={resolvedStatus} />
              {userStatusMeta[resolvedStatus].label}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="mt-1 truncate text-fg-2">
              {person.email ? (
                <a
                  href={`mailto:${person.email}`}
                  className="hover:text-foreground hover:underline"
                >
                  {person.email}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Handle</dt>
            <dd className="mt-1 truncate text-fg-2">
              {person.handle ? `@${person.handle}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Title</dt>
            <dd className="mt-1 truncate text-fg-2">
              {getPersonTitle(person)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {meta.teamNames.length > 0
                ? `Teams: ${meta.teamSummary}`
                : "Teams"}
            </dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {meta.teamNames.length === 0 ? (
                <span className="text-fg-3">No teams</span>
              ) : (
                meta.teamNames.map((teamName) => (
                  <Badge
                    key={teamName}
                    variant="outline"
                    className="font-normal"
                  >
                    {teamName}
                  </Badge>
                ))
              )}
            </dd>
          </div>
          {meta.roleLabels.length > 0 ? (
            <div>
              <dt className="text-xs text-muted-foreground">Roles</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {meta.roleLabels.map((label) => (
                  <Badge key={label} variant="outline" className="font-normal">
                    {label}
                  </Badge>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </aside>
  )
}

function ActivityFeed({
  activity,
  data,
}: {
  activity: PersonActivity[]
  data: AppData
}) {
  const groups = useMemo(() => groupActivityByDay(activity), [activity])

  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-line bg-background">
      <SectionCardHeader
        title="Activity"
        meta={
          <span className="text-xs text-muted-foreground">
            {activity.length} {activity.length === 1 ? "entry" : "entries"}
          </span>
        }
      />
      {activity.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No visible activity yet.
        </div>
      ) : (
        <div>
          {groups.map((group, groupIndex) => (
            <div
              key={group.dayKey}
              className={cn(groupIndex > 0 && "border-t border-line")}
            >
              <div className="px-5 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-fg-3 uppercase">
                {formatActivityDayLabel(group.dayKey)}
              </div>
              <div className="flex flex-col px-2 pt-1 pb-3">
                {group.entries.map((entry) => (
                  <ActivityRow
                    key={getActivityKey(entry)}
                    activity={entry}
                    data={data}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function PersonProfileContent({
  activity,
  data,
  onMessage,
  person,
  workspaceId,
}: {
  activity: PersonActivity[]
  data: AppData
  onMessage: () => void
  person: UserProfile
  workspaceId: string
}) {
  const meta = getWorkspacePersonMeta(data, workspaceId, person)
  const canMessage =
    !meta.isSelf && hasWorkspaceAccess(data, workspaceId, person.id)
  const canEmail = Boolean(person.email) && !meta.isSelf

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background">
      <ProfileHero
        canEmail={canEmail}
        canMessage={canMessage}
        meta={meta}
        onMessage={onMessage}
        person={person}
      />
      <div className="mx-auto grid w-full max-w-[1100px] grid-cols-1 items-start gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ActivityFeed activity={activity} data={data} />
        <ProfileSidebar meta={meta} person={person} />
      </div>
    </div>
  )
}

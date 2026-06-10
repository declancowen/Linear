"use client"

import { useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"

import { selectAppDataSnapshot } from "@/components/app/screens/helpers"
import {
  getTeamDashboardCompletion,
  getTeamDashboardProjectProgress,
  getTeamDashboardStatusBreakdown,
} from "@/lib/domain/selectors-internal/team-dashboard"
import {
  getTeamSpaceActivity,
  type TeamActivityEntry,
} from "@/lib/domain/selectors"
import {
  getDisplayLabelForWorkItemType,
  statusMeta,
  type Project,
  type TeamExperienceType,
  type UserProfile,
  type ViewDefinition,
  type WorkItem,
} from "@/lib/domain/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getDisplayInitials } from "@/lib/display-initials"
import { useAppStore } from "@/lib/store/app-store"
import { cn, resolveImageAssetSource } from "@/lib/utils"

type DashboardTab = "overview" | "work" | "activity"

const DASHBOARD_TABS: { id: DashboardTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "work", label: "Work" },
  { id: "activity", label: "Activity" },
]

function ThemeBar({
  label,
  value,
  caption,
}: {
  label: string
  value: number
  caption?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className="truncate text-fg-2">{label}</span>
        <span className="shrink-0 tabular-nums text-fg-3">
          {caption ?? `${clamped}%`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className="h-full rounded-full bg-foreground transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

function DashboardCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-line-soft bg-surface p-4",
        className
      )}
    >
      <h2 className="mb-3 text-[12px] font-semibold tracking-wide text-fg-3 uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-fg-3">{children}</p>
}

function OverviewTab({
  items,
  experience,
}: {
  items: WorkItem[]
  experience?: TeamExperienceType | null
}) {
  const completion = useMemo(() => getTeamDashboardCompletion(items), [items])
  const statusBreakdown = useMemo(
    () => getTeamDashboardStatusBreakdown(items),
    [items]
  )
  const maxStatusCount = statusBreakdown.reduce(
    (max, entry) => Math.max(max, entry.count),
    0
  )

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <DashboardCard title="Completion">
        <div className="space-y-4">
          <ThemeBar
            label="Overall complete"
            value={completion.overall.percent}
            caption={`${completion.overall.completed}/${completion.overall.total} · ${completion.overall.percent}%`}
          />
          {completion.byType.length > 0 ? (
            <div className="space-y-3 border-t border-line-soft pt-3">
              {completion.byType.map((entry) => (
                <ThemeBar
                  key={entry.type}
                  label={getDisplayLabelForWorkItemType(
                    entry.type,
                    experience
                  )}
                  value={entry.percent}
                  caption={`${entry.completed}/${entry.total} · ${entry.percent}%`}
                />
              ))}
            </div>
          ) : (
            <EmptyHint>No work items yet.</EmptyHint>
          )}
        </div>
      </DashboardCard>

      <DashboardCard title="Issue status">
        {statusBreakdown.length > 0 ? (
          <div className="space-y-3">
            {statusBreakdown.map((entry) => (
              <ThemeBar
                key={entry.status}
                label={statusMeta[entry.status].label}
                value={
                  maxStatusCount > 0
                    ? Math.round((entry.count / maxStatusCount) * 100)
                    : 0
                }
                caption={String(entry.count)}
              />
            ))}
          </div>
        ) : (
          <EmptyHint>No work items yet.</EmptyHint>
        )}
      </DashboardCard>
    </div>
  )
}

function WorkTab({
  items,
  projects,
  views,
}: {
  items: WorkItem[]
  projects: Project[]
  views: ViewDefinition[]
}) {
  const projectProgress = useMemo(
    () => getTeamDashboardProjectProgress(projects, items),
    [projects, items]
  )

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <DashboardCard title="Views">
        {views.length > 0 ? (
          <ul className="divide-y divide-line-soft">
            {views.map((view) => (
              <li
                key={view.id}
                className="flex items-center justify-between gap-2 py-2 text-[13px]"
              >
                <span className="truncate text-foreground">{view.name}</span>
                <span className="shrink-0 text-[11.5px] text-fg-3 capitalize">
                  {view.layout}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyHint>No saved views in this team space.</EmptyHint>
        )}
      </DashboardCard>

      <DashboardCard title="Projects">
        {projectProgress.length > 0 ? (
          <div className="space-y-3">
            {projectProgress.map((entry) => (
              <ThemeBar
                key={entry.projectId}
                label={entry.name}
                value={entry.completion.percent}
                caption={`${entry.completion.completed}/${entry.completion.total} · ${entry.completion.percent}%`}
              />
            ))}
          </div>
        ) : (
          <EmptyHint>No projects in this team space.</EmptyHint>
        )}
      </DashboardCard>
    </div>
  )
}

function describeActivity(activity: TeamActivityEntry["activity"]): string {
  switch (activity.type) {
    case "workItemCreated":
      return "created"
    case "workItemCommented":
    case "documentCommented":
    case "channelPostCommented":
      return "commented on"
    case "workItemStatusChanged":
      return "changed status on"
    case "workItemLabelsChanged":
      return "updated labels on"
    case "workItemAssigneesChanged":
      return "changed assignees on"
    case "channelPostCreated":
      return "posted"
    case "projectUpdatePosted":
      return "posted an update on"
  }
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()

  if (Number.isNaN(then)) {
    return ""
  }

  const minutes = Math.floor((Date.now() - then) / 60000)

  if (minutes < 1) {
    return "just now"
  }
  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h`
  }

  const days = Math.floor(hours / 24)
  if (days < 7) {
    return `${days}d`
  }

  const weeks = Math.floor(days / 7)
  if (weeks < 5) {
    return `${weeks}w`
  }

  return new Date(iso).toLocaleDateString()
}

function ActivityTab({
  entries,
  usersById,
}: {
  entries: TeamActivityEntry[]
  usersById: Map<string, UserProfile>
}) {
  if (entries.length === 0) {
    return <EmptyHint>No recent activity in this team space.</EmptyHint>
  }

  return (
    <DashboardCard title="Recent activity">
      <ul className="space-y-3">
        {entries.map((entry, index) => {
          const user = usersById.get(entry.userId)
          const name = user?.name?.trim() || "Someone"
          const imageSrc = resolveImageAssetSource(
            user?.avatarImageUrl,
            user?.avatarUrl
          )

          return (
            <li
              key={`${entry.userId}:${entry.activity.type}:${entry.activity.createdAt}:${index}`}
              className="flex items-start gap-2.5"
            >
              <Avatar
                size="sm"
                className="mt-0.5 size-5 data-[size=sm]:size-5"
              >
                {imageSrc ? <AvatarImage src={imageSrc} alt={name} /> : null}
                <AvatarFallback>{getDisplayInitials(name, "?")}</AvatarFallback>
              </Avatar>
              <p className="min-w-0 flex-1 text-[12.5px] text-fg-2">
                <span className="font-medium text-foreground">{name}</span>{" "}
                {describeActivity(entry.activity)}{" "}
                <span className="text-foreground">{entry.activity.title}</span>
              </p>
              <span className="shrink-0 text-[11.5px] tabular-nums text-fg-3">
                {formatRelativeTime(entry.activity.createdAt)}
              </span>
            </li>
          )
        })}
      </ul>
    </DashboardCard>
  )
}

export function TeamDashboardScreen({ teamSlug }: { teamSlug: string }) {
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const [tab, setTab] = useState<DashboardTab>("overview")
  const team = data.teams.find((entry) => entry.slug === teamSlug) ?? null
  const teamId = team?.id ?? null
  const experience = team?.settings.experience

  const items = useMemo<WorkItem[]>(
    () =>
      teamId ? data.workItems.filter((item) => item.teamId === teamId) : [],
    [data.workItems, teamId]
  )
  const projects = useMemo<Project[]>(
    () =>
      teamId
        ? data.projects.filter(
            (project) =>
              project.scopeType === "team" && project.scopeId === teamId
          )
        : [],
    [data.projects, teamId]
  )
  const views = useMemo<ViewDefinition[]>(
    () =>
      teamId
        ? data.views.filter(
            (view) =>
              view.scopeType === "team" && view.scopeId === teamId
          )
        : [],
    [data.views, teamId]
  )
  const activity = useMemo<TeamActivityEntry[]>(
    () => (teamId ? getTeamSpaceActivity(data, teamId) : []),
    [data, teamId]
  )
  const usersById = useMemo(
    () => new Map<string, UserProfile>(data.users.map((user) => [user.id, user])),
    [data.users]
  )

  if (!team) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-20 text-sm text-muted-foreground">
        Team space not found.
      </div>
    )
  }

  return (
    <div className="no-scrollbar mx-auto w-full max-w-[1100px] space-y-5 overflow-y-auto px-6 py-6">
      <header className="space-y-0.5">
        <h1 className="text-[18px] font-semibold tracking-tight text-foreground">
          {team.name}
        </h1>
        <p className="text-[13px] text-fg-3">Dashboard</p>
      </header>

      <div
        role="tablist"
        aria-label="Dashboard sections"
        className="flex items-center gap-1 border-b border-line-soft"
      >
        {DASHBOARD_TABS.map((entry) => {
          const active = tab === entry.id
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(entry.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-[13px] transition-colors",
                active
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-fg-3 hover:text-foreground"
              )}
            >
              {entry.label}
            </button>
          )
        })}
      </div>

      {tab === "overview" ? (
        <OverviewTab items={items} experience={experience} />
      ) : null}
      {tab === "work" ? (
        <WorkTab items={items} projects={projects} views={views} />
      ) : null}
      {tab === "activity" ? (
        <ActivityTab entries={activity} usersById={usersById} />
      ) : null}
    </div>
  )
}

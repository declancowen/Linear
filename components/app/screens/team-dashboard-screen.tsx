"use client"

import { useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { ChartBar, Kanban, Pulse } from "@phosphor-icons/react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { selectAppDataSnapshot } from "@/components/app/screens/helpers"
import { STATUS_ACCENTS } from "@/components/app/screens/work-surface-view/event-accent"
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { getDisplayInitials } from "@/lib/display-initials"
import { useAppStore } from "@/lib/store/app-store"
import { cn, resolveImageAssetSource } from "@/lib/utils"

type DashboardTab = "overview" | "work" | "activity"

const DASHBOARD_TABS: { id: DashboardTab; label: string; icon: typeof ChartBar }[] =
  [
    { id: "overview", label: "Overview", icon: ChartBar },
    { id: "work", label: "Work", icon: Kanban },
    { id: "activity", label: "Activity", icon: Pulse },
  ]

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

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-line-soft bg-surface px-4 py-3">
      <div className="text-[11.5px] font-medium tracking-wide text-fg-3 uppercase">
        {label}
      </div>
      <div className="mt-1 text-[22px] leading-none font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {hint ? <div className="mt-1 text-[11.5px] text-fg-3">{hint}</div> : null}
    </div>
  )
}

function ProgressTrack({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className="h-full rounded-full bg-foreground transition-[width]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

function CompletionByTypeCard({
  items,
  experience,
}: {
  items: WorkItem[]
  experience?: TeamExperienceType | null
}) {
  const completion = useMemo(() => getTeamDashboardCompletion(items), [items])
  const data = completion.byType.map((entry) => ({
    label: getDisplayLabelForWorkItemType(entry.type, experience),
    percent: entry.percent,
    completed: entry.completed,
    total: entry.total,
  }))
  const config: ChartConfig = {
    percent: { label: "Complete", color: "var(--foreground)" },
  }

  return (
    <DashboardCard title="Completion by type">
      {data.length > 0 ? (
        <ChartContainer
          config={config}
          className="aspect-auto h-[240px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{ left: 8, right: 28, top: 4, bottom: 4 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={92}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => (
                    <span className="text-fg-2">
                      {item?.payload?.label}:{" "}
                      <span className="font-medium text-foreground">
                        {item?.payload?.completed}/{item?.payload?.total} (
                        {value}%)
                      </span>
                    </span>
                  )}
                />
              }
            />
            <Bar dataKey="percent" fill="var(--color-percent)" radius={5}>
              <LabelList
                dataKey="percent"
                position="right"
                offset={8}
                className="fill-fg-2"
                fontSize={11}
                formatter={(value: number) => `${value}%`}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      ) : (
        <EmptyHint>No work items yet.</EmptyHint>
      )}
    </DashboardCard>
  )
}

function StatusBreakdownCard({ items }: { items: WorkItem[] }) {
  const breakdown = useMemo(
    () => getTeamDashboardStatusBreakdown(items),
    [items]
  )
  const data = breakdown.map((entry) => ({
    status: entry.status,
    label: statusMeta[entry.status].label,
    value: entry.count,
    fill: STATUS_ACCENTS[entry.status],
  }))
  const config: ChartConfig = Object.fromEntries(
    data.map((entry) => [entry.status, { label: entry.label, color: entry.fill }])
  )
  const total = data.reduce((sum, entry) => sum + entry.value, 0)

  return (
    <DashboardCard title="Issue status">
      {data.length > 0 ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <ChartContainer
            config={config}
            className="aspect-square h-[200px] w-[200px] shrink-0"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent nameKey="label" hideLabel />}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={56}
                outerRadius={88}
                paddingAngle={2}
                strokeWidth={2}
                stroke="var(--surface)"
              >
                {data.map((entry) => (
                  <Cell key={entry.status} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {data.map((entry) => (
              <li
                key={entry.status}
                className="flex items-center gap-2 text-[12.5px]"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: entry.fill }}
                />
                <span className="min-w-0 flex-1 truncate text-fg-2">
                  {entry.label}
                </span>
                <span className="shrink-0 tabular-nums text-fg-3">
                  {entry.value}
                  <span className="ml-1 text-fg-4">
                    {total > 0 ? `${Math.round((entry.value / total) * 100)}%` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyHint>No work items yet.</EmptyHint>
      )}
    </DashboardCard>
  )
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
  const inProgress =
    statusBreakdown.find((entry) => entry.status === "in-progress")?.count ?? 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Items" value={items.length} />
        <StatCard
          label="Completed"
          value={completion.overall.completed}
          hint={`of ${completion.overall.total} active`}
        />
        <StatCard label="In progress" value={inProgress} />
        <StatCard label="Complete" value={`${completion.overall.percent}%`} />
      </div>
      <DashboardCard title="Overall completion">
        <ProgressTrack value={completion.overall.percent} />
        <p className="mt-2 text-[12px] text-fg-3">
          {completion.overall.completed}/{completion.overall.total} actionable
          items done · {completion.overall.percent}%
        </p>
      </DashboardCard>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CompletionByTypeCard items={items} experience={experience} />
        <StatusBreakdownCard items={items} />
      </div>
    </div>
  )
}

function ProjectProgressCard({
  items,
  projects,
}: {
  items: WorkItem[]
  projects: Project[]
}) {
  const projectProgress = useMemo(
    () => getTeamDashboardProjectProgress(projects, items),
    [projects, items]
  )

  return (
    <DashboardCard title="Projects">
      {projectProgress.length > 0 ? (
        <div className="space-y-3">
          {projectProgress.map((entry) => (
            <div key={entry.projectId} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                <span className="truncate text-fg-2">{entry.name}</span>
                <span className="shrink-0 tabular-nums text-fg-3">
                  {entry.completion.completed}/{entry.completion.total} ·{" "}
                  {entry.completion.percent}%
                </span>
              </div>
              <ProgressTrack value={entry.completion.percent} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyHint>No projects in this team space.</EmptyHint>
      )}
    </DashboardCard>
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
      <ProjectProgressCard items={items} projects={projects} />
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
              <Avatar size="sm" className="mt-0.5 size-5 data-[size=sm]:size-5">
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
            (view) => view.scopeType === "team" && view.scopeId === teamId
          )
        : [],
    [data.views, teamId]
  )
  const activity = useMemo<TeamActivityEntry[]>(
    () => (teamId ? getTeamSpaceActivity(data, teamId) : []),
    [data, teamId]
  )
  const usersById = useMemo(
    () =>
      new Map<string, UserProfile>(data.users.map((user) => [user.id, user])),
    [data.users]
  )

  if (!team) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-background px-3.5">
          <SidebarTrigger className="size-5 shrink-0" />
          <h1 className="text-sm font-medium">Dashboard</h1>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-20 text-sm text-muted-foreground">
          Team space not found.
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-background px-3.5">
        <SidebarTrigger className="size-5 shrink-0" />
        <h1 className="text-sm font-medium">Dashboard</h1>
        <div className="ml-2 flex items-center gap-0.5">
          {DASHBOARD_TABS.map((entry) => {
            const active = tab === entry.id
            const Icon = entry.icon
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(entry.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] transition-colors",
                  active
                    ? "bg-surface-3 font-medium text-foreground"
                    : "text-fg-3 hover:bg-surface-3 hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {entry.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto w-full max-w-[1100px]">
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
      </div>
    </div>
  )
}

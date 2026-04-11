"use client"

import { useMemo } from "react"
import { format, startOfWeek, subWeeks } from "date-fns"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"

import {
  getAccessibleTeams,
  getDocumentsForScope,
  getLateItems,
  getProjectProgress,
  getProjectsForScope,
  getVisibleWorkItems,
} from "@/lib/domain/selectors"
import { priorityMeta, statusMeta, workStatuses } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const deliveryConfig = {
  items: {
    label: "Items",
    color: "var(--chart-1)",
  },
  attachments: {
    label: "Attachments",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const statusConfig = {
  count: {
    label: "Items",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

export function WorkspaceReportsScreen() {
  const data = useAppStore()

  const report = useMemo(() => {
    const teams = getAccessibleTeams(data)
    const teamIds = new Set(teams.map((team) => team.id))
    const projects = getProjectsForScope(data, "workspace", data.currentWorkspaceId)
    const documents = getDocumentsForScope(data, "workspace", data.currentWorkspaceId)
    const items = getVisibleWorkItems(data, { workspaceId: data.currentWorkspaceId })
    const overdue = getLateItems(data).filter((item) => teamIds.has(item.teamId))
    const attachments = data.attachments.filter((attachment) => teamIds.has(attachment.teamId))
    const unread = data.notifications.filter(
      (notification) =>
        notification.userId === data.currentUserId && notification.readAt === null
    ).length

    const statusData = workStatuses.map((status) => ({
      status: statusMeta[status].label,
      count: items.filter((item) => item.status === status).length,
    }))

    const teamLoadData = teams.map((team) => ({
      team: team.name,
      items: items.filter(
        (item) => item.teamId === team.id && item.status !== "done"
      ).length,
      attachments: attachments.filter((attachment) => attachment.teamId === team.id).length,
    }))

    const weeklyThroughputData = Array.from({ length: 6 }, (_, index) => {
      const weekStart = startOfWeek(subWeeks(new Date(), 5 - index), {
        weekStartsOn: 1,
      })
      const weekLabel = format(weekStart, "MMM d")

      return {
        week: weekLabel,
        items: items.filter(
          (item) =>
            format(startOfWeek(new Date(item.createdAt), { weekStartsOn: 1 }), "yyyy-MM-dd") ===
            format(weekStart, "yyyy-MM-dd")
        ).length,
        attachments: attachments.filter(
          (attachment) =>
            format(
              startOfWeek(new Date(attachment.createdAt), { weekStartsOn: 1 }),
              "yyyy-MM-dd"
            ) === format(weekStart, "yyyy-MM-dd")
        ).length,
      }
    })

    const riskProjects = projects
      .map((project) => ({
        project,
        progress: getProjectProgress(data, project.id),
      }))
      .sort((left, right) => {
        const healthWeight = {
          "off-track": 3,
          "at-risk": 2,
          "no-update": 1,
          "on-track": 0,
        }

        return (
          healthWeight[right.project.health] - healthWeight[left.project.health] ||
          left.progress.percent - right.progress.percent
        )
      })
      .slice(0, 6)

    const priorityBreakdown = (
      ["urgent", "high", "medium", "low", "none"] as const
    ).map(
      (priority) => ({
        priority: priorityMeta[priority].label,
        count: items.filter((item) => item.priority === priority).length,
      })
    )

    return {
      projects,
      documents,
      items,
      overdue,
      attachments,
      unread,
      statusData,
      teamLoadData,
      weeklyThroughputData,
      riskProjects,
      priorityBreakdown,
    }
  }, [data])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Open work", report.items.filter((item) => item.status !== "done").length],
          ["Overdue", report.overdue.length],
          ["Projects", report.projects.length],
          ["Docs", report.documents.length],
          ["Unread", report.unread],
        ].map(([label, value]) => (
          <Card key={label} className="shadow-none">
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Weekly delivery flow</CardTitle>
            <CardDescription>
              Created work and stored files over the last six weeks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={deliveryConfig} className="min-h-[260px] w-full">
              <LineChart accessibilityLayer data={report.weeklyThroughputData}>
                <CartesianGrid vertical={false} />
                <XAxis axisLine={false} dataKey="week" tickLine={false} tickMargin={10} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  dataKey="items"
                  stroke="var(--color-items)"
                  strokeWidth={2}
                  type="monotone"
                />
                <Line
                  dataKey="attachments"
                  stroke="var(--color-attachments)"
                  strokeWidth={2}
                  type="monotone"
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Status distribution</CardTitle>
            <CardDescription>
              Current workload spread across the shared team workflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={statusConfig} className="min-h-[260px] w-full">
              <BarChart accessibilityLayer data={report.statusData}>
                <CartesianGrid vertical={false} />
                <XAxis axisLine={false} dataKey="status" tickLine={false} tickMargin={10} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={8} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Projects needing attention</CardTitle>
            <CardDescription>
              Prioritized by health first, then by completion signal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Scope</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.riskProjects.map(({ project, progress }) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{project.health}</Badge>
                    </TableCell>
                    <TableCell>{progress.percent}%</TableCell>
                    <TableCell>{progress.scope}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Team load</CardTitle>
              <CardDescription>
                Open work and attachment volume by team.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {report.teamLoadData.map((entry) => (
                <div key={entry.team} className="rounded-xl border px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-medium">{entry.team}</span>
                    <Badge variant="secondary">{entry.items} open</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {entry.attachments} attachments stored
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Priority mix</CardTitle>
              <CardDescription>
                Current distribution of work priorities.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {report.priorityBreakdown.map((entry) => (
                <div
                  key={entry.priority}
                  className="flex items-center justify-between rounded-xl border px-3 py-3"
                >
                  <span>{entry.priority}</span>
                  <Badge variant="outline">{entry.count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

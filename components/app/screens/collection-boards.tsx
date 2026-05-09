"use client"

import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowSquareOut,
  CalendarDots,
  FileText,
  Rows,
  SquaresFour,
} from "@phosphor-icons/react"

import {
  formatEntityKind,
  getDocumentPreview,
} from "@/components/app/screens/shared"
import {
  DocumentAuthorAvatar,
  DocumentContextMenu,
} from "@/components/app/screens/document-ui"
import {
  ProjectContextMenu,
  ViewContextMenu,
} from "@/components/app/screens/entity-context-menus"
import {
  ProjectProgressMeter,
  ViewCardHeader,
} from "@/components/app/screens/project-card-primitives"
import { getViewHref } from "@/lib/domain/default-views"
import {
  getProjectHref,
  getProjectProgress,
  getTeam,
  getUser,
} from "@/lib/domain/selectors"
import {
  formatCalendarDateLabel,
  getCalendarDateDayOffset,
} from "@/lib/date-input"
import {
  priorityMeta,
  projectHealthMeta,
  type AppData,
  type Document,
  type Project,
  type ViewDefinition,
} from "@/lib/domain/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getGroupFieldOptionLabel } from "./work-surface-controls"

const projectHealthAccent: Record<Project["health"], string> = {
  "on-track": "var(--status-done)",
  "at-risk": "var(--priority-high)",
  "off-track": "var(--priority-urgent)",
  "no-update": "var(--text-3)",
}

const projectIconTint: Record<Project["health"], string> = {
  "on-track": "var(--label-4)",
  "at-risk": "var(--label-2)",
  "off-track": "var(--label-1)",
  "no-update": "var(--label-5)",
}

const viewLayoutMeta: Record<
  ViewDefinition["layout"],
  {
    label: string
    icon: typeof Rows
    accent: string
  }
> = {
  list: {
    label: "List",
    icon: Rows,
    accent: "var(--status-todo)",
  },
  board: {
    label: "Board",
    icon: SquaresFour,
    accent: "var(--status-doing)",
  },
  timeline: {
    label: "Timeline",
    icon: CalendarDots,
    accent: "var(--status-review)",
  },
}

type ProjectBoardDueDateState = {
  label: string
  isOverdue: boolean
  isSoon: boolean
}

function getProjectBoardDueDateState(
  targetDate: Project["targetDate"],
  today: Date
): ProjectBoardDueDateState | null {
  const label = formatCalendarDateLabel(targetDate, "")

  if (!label) {
    return null
  }

  const daysUntilDue = getCalendarDateDayOffset(targetDate, today)
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0

  return {
    label,
    isOverdue,
    isSoon: daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 14,
  }
}

export function ProjectBoard({
  data,
  projects,
}: {
  data: AppData
  projects: Project[]
}) {
  const today = new Date()

  return (
    <div className="grid gap-3.5 px-7 py-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectBoardCard
          key={project.id}
          data={data}
          project={project}
          today={today}
        />
      ))}
    </div>
  )
}

function ProjectBoardCard({
  data,
  project,
  today,
}: {
  data: AppData
  project: Project
  today: Date
}) {
  const progress = getProjectProgress(data, project.id)
  const lead = getUser(data, project.leadId)
  const projectTeam =
    project.scopeType === "team" ? getTeam(data, project.scopeId) : null
  const accent = projectHealthAccent[project.health]
  const tint = projectIconTint[project.health]
  const summary = project.summary || project.description
  const dueDate = getProjectBoardDueDateState(project.targetDate, today)

  return (
    <ProjectContextMenu data={data} project={project}>
      <Link
        className="group flex min-h-[168px] flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 transition-all hover:-translate-y-px hover:border-fg-4 hover:shadow-sm"
        href={getProjectHref(data, project) ?? "/workspace/projects"}
      >
        <ProjectBoardCardHeader
          priorityLabel={priorityMeta[project.priority].label}
          project={project}
          projectTeamName={projectTeam?.name ?? "Workspace"}
          tint={tint}
        />

        {summary ? (
          <p className="line-clamp-2 text-[12.5px] leading-[1.5] text-fg-2">
            {summary}
          </p>
        ) : null}

        <ProjectBoardCardProgress
          accent={accent}
          healthLabel={projectHealthMeta[project.health].label}
          progress={progress}
        />
        <ProjectBoardCardFooter
          dueDate={dueDate}
          leadName={lead?.name ?? "Unassigned"}
          progressScope={progress.scope}
        />
      </Link>
    </ProjectContextMenu>
  )
}

function ProjectBoardCardHeader({
  priorityLabel,
  project,
  projectTeamName,
  tint,
}: {
  priorityLabel: string
  project: Project
  projectTeamName: string
  tint: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-md text-[15px]"
        style={{
          background: `color-mix(in oklch, ${tint} 22%, transparent)`,
          color: tint,
        }}
      >
        {project.name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[14px] leading-[1.3] font-semibold tracking-[-0.005em] text-foreground group-hover:underline">
          {project.name}
        </h2>
        <div className="mt-px truncate text-[11.5px] text-fg-3">
          {projectTeamName + " · " + priorityLabel}
        </div>
      </div>
      <ArrowSquareOut className="size-3.5 shrink-0 text-fg-4 opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  )
}

function ProjectBoardCardProgress({
  accent,
  healthLabel,
  progress,
}: {
  accent: string
  healthLabel: string
  progress: ReturnType<typeof getProjectProgress>
}) {
  return (
    <div className="flex items-center gap-2.5 text-[11.5px] text-fg-3">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
        style={{
          background: `color-mix(in oklch, ${accent} 14%, transparent)`,
          color: accent,
        }}
      >
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ background: accent }}
        />
        {healthLabel}
      </span>
      <ProjectProgressMeter progress={progress} />
    </div>
  )
}

function ProjectBoardCardFooter({
  dueDate,
  leadName,
  progressScope,
}: {
  dueDate: ProjectBoardDueDateState | null
  leadName: string
  progressScope: number
}) {
  return (
    <div className="mt-auto flex items-center gap-2 border-t border-dashed border-line pt-2 text-[11.5px] text-fg-3">
      <span className="truncate">{leadName}</span>
      {progressScope > 0 ? (
        <>
          <span aria-hidden>·</span>
          <span className="shrink-0">{progressScope} items</span>
        </>
      ) : null}
      {dueDate ? <ProjectBoardDueDateLabel dueDate={dueDate} /> : null}
    </div>
  )
}

function ProjectBoardDueDateLabel({
  dueDate,
}: {
  dueDate: ProjectBoardDueDateState
}) {
  return (
    <span
      className={cn(
        "ml-auto shrink-0 tabular-nums",
        dueDate.isOverdue && "text-[color:var(--priority-urgent)]",
        !dueDate.isOverdue &&
          dueDate.isSoon &&
          "text-[color:var(--priority-high)]"
      )}
    >
      {dueDate.isOverdue ? "Overdue · " : ""}
      {dueDate.label}
    </span>
  )
}

export function SavedViewsBoard({
  views,
  showDescriptions,
  contextLabels,
}: {
  views: ViewDefinition[]
  showDescriptions: boolean
  contextLabels?: Record<string, string>
}) {
  return (
    <div className="grid gap-3.5 px-7 py-4 sm:grid-cols-2 xl:grid-cols-3">
      {views.map((view) => {
        const layoutMeta = viewLayoutMeta[view.layout]
        const LayoutIcon = layoutMeta.icon
        const scopeLabel =
          contextLabels?.[view.id] ?? (view.isShared ? "Shared" : "Personal")

        return (
          <ViewContextMenu key={view.id} view={view}>
            <Link
              className="group flex h-full min-h-[168px] flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 transition-all hover:-translate-y-px hover:border-fg-4 hover:shadow-sm"
              href={getViewHref(view)}
            >
              <ViewCardHeader
                layoutMeta={layoutMeta}
                showOpenIcon
                subtitle={`${scopeLabel} · ${format(new Date(view.updatedAt), "MMM d")}`}
                view={view}
              />
              {showDescriptions && view.description ? (
                <p className="line-clamp-2 text-[12.5px] leading-[1.5] text-fg-2">
                  {view.description}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-fg-3">
                <Badge
                  variant="secondary"
                  className="h-5 rounded-md border border-line bg-surface-2 px-1.5 text-[10.5px] font-normal text-fg-2"
                >
                  {formatEntityKind(view.entityKind)}
                </Badge>
                <Badge
                  variant="outline"
                  className="h-5 rounded-md border-line bg-transparent px-1.5 text-[10.5px] font-normal text-fg-3"
                >
                  Group · {getGroupFieldOptionLabel(view.grouping)}
                </Badge>
                {view.subGrouping ? (
                  <Badge
                    variant="outline"
                    className="h-5 rounded-md border-line bg-transparent px-1.5 text-[10.5px] font-normal text-fg-3"
                  >
                    Sub · {getGroupFieldOptionLabel(view.subGrouping)}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-auto flex items-center gap-2 border-t border-dashed border-line pt-2 text-[11.5px] text-fg-3">
                <span className="inline-flex items-center gap-1.5">
                  <LayoutIcon className="size-3.5" />
                  {layoutMeta.label}
                </span>
                {view.ordering ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">Sort {view.ordering}</span>
                  </>
                ) : null}
                <span className="ml-auto truncate">{scopeLabel}</span>
              </div>
            </Link>
          </ViewContextMenu>
        )
      })}
    </div>
  )
}

const DOC_ACCENT = "oklch(0.6 0.09 240)"

function DocumentPreviewArt({ seed }: { seed: number }) {
  const widths = [
    [88, 70, 78, 60],
    [82, 76, 64, 86],
    [90, 62, 80, 72],
    [70, 84, 66, 78],
  ]
  const rows = widths[seed % widths.length] ?? widths[0]

  return (
    <div
      aria-hidden
      className="relative h-[88px] overflow-hidden rounded-t-xl border-b"
      style={{
        background: `linear-gradient(135deg, color-mix(in oklch, ${DOC_ACCENT} 14%, var(--surface)) 0%, color-mix(in oklch, ${DOC_ACCENT} 4%, var(--surface)) 100%)`,
        borderColor: `color-mix(in oklch, ${DOC_ACCENT} 22%, transparent)`,
      }}
    >
      <div
        className="absolute inset-x-4 top-4 flex flex-col gap-1.5"
        style={{ opacity: 0.55 }}
      >
        <div
          className="h-1.5 rounded-full"
          style={{
            width: "44%",
            background: `color-mix(in oklch, ${DOC_ACCENT} 65%, transparent)`,
          }}
        />
        {rows.map((width, idx) => (
          <div
            key={idx}
            className="h-1 rounded-full"
            style={{
              width: `${width}%`,
              background: `color-mix(in oklch, ${DOC_ACCENT} ${idx === rows.length - 1 ? 28 : 38}%, transparent)`,
            }}
          />
        ))}
      </div>
      <span
        aria-hidden
        className="absolute right-3 top-3 grid size-7 place-items-center rounded-md border"
        style={{
          background: `color-mix(in oklch, ${DOC_ACCENT} 18%, var(--surface))`,
          borderColor: `color-mix(in oklch, ${DOC_ACCENT} 32%, transparent)`,
          color: DOC_ACCENT,
        }}
      >
        <FileText className="size-3.5" />
      </span>
    </div>
  )
}

function hashDocumentId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function DocumentBoard({
  data,
  documents,
}: {
  data: AppData
  documents: Document[]
}) {
  return (
    <div className="grid gap-4 px-7 py-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {documents.map((document) => {
        const preview = getDocumentPreview(document)
        const author = getUser(data, document.updatedBy ?? document.createdBy)
        const seed = hashDocumentId(document.id)

        return (
          <DocumentContextMenu
            key={document.id}
            data={data}
            document={document}
          >
            <Link
              className="group flex min-h-[228px] flex-col self-start overflow-hidden rounded-xl border border-line bg-surface transition-all hover:-translate-y-0.5 hover:border-fg-4 hover:shadow-md"
              href={`/docs/${document.id}`}
            >
              <DocumentPreviewArt seed={seed} />
              <div className="flex flex-1 flex-col gap-2 px-4 pt-3.5 pb-3">
                <h3 className="line-clamp-2 text-[14.5px] leading-[1.3] font-semibold tracking-[-0.005em] text-foreground group-hover:underline">
                  {document.title}
                </h3>
                {preview ? (
                  <p className="line-clamp-3 text-[12.5px] leading-[1.5] text-fg-2">
                    {preview}
                  </p>
                ) : (
                  <p className="text-[12.5px] italic text-fg-4">
                    No content yet
                  </p>
                )}
                <div className="mt-auto flex items-center gap-2 border-t border-dashed border-line pt-2.5 text-[11.5px] text-fg-3">
                  <DocumentAuthorAvatar
                    avatarImageUrl={author?.avatarImageUrl}
                    avatarUrl={author?.avatarUrl}
                    name={author?.name ?? "Unknown"}
                    size="xs"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {author?.name ?? "Unknown"}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {format(new Date(document.updatedAt), "MMM d")}
                  </span>
                </div>
              </div>
            </Link>
          </DocumentContextMenu>
        )
      })}
    </div>
  )
}

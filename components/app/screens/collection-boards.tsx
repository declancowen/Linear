"use client"

import Link from "next/link"
import { format } from "date-fns"
import { ArrowSquareOut } from "@phosphor-icons/react"

import {
  formatEntityKind,
  getDocumentPreview,
  getEntityKindIcon,
} from "@/components/app/screens/shared"
import {
  DocumentAuthorAvatar,
  DocumentContextMenu,
} from "@/components/app/screens/document-ui"
import {
  ProjectContextMenu,
  ViewContextMenu,
} from "@/components/app/screens/entity-context-menus"
import { getViewHref } from "@/lib/domain/default-views"
import {
  getProjectHref,
  getProjectProgress,
  getUser,
} from "@/lib/domain/selectors"
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
      {projects.map((project) => {
        const progress = getProjectProgress(data, project.id)
        const lead = getUser(data, project.leadId)
        const accent = projectHealthAccent[project.health]
        const tint = projectIconTint[project.health]
        const targetDate = project.targetDate ? new Date(project.targetDate) : null
        const daysUntilDue = targetDate
          ? Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : null
        const isOverdue = daysUntilDue !== null && daysUntilDue < 0
        const isSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 14

        return (
          <ProjectContextMenu
            key={project.id}
            data={data}
            project={project}
          >
            <Link
              className="group flex min-h-[168px] flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 transition-all hover:-translate-y-px hover:border-fg-4 hover:shadow-sm"
              href={getProjectHref(data, project) ?? "/workspace/projects"}
            >
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
                  {priorityMeta[project.priority].label} · {lead?.name ?? "Unassigned"}
                </div>
              </div>
              <ArrowSquareOut className="size-3.5 shrink-0 text-fg-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            {project.summary ? (
              <p className="line-clamp-2 text-[12.5px] leading-[1.5] text-fg-2">
                {project.summary}
              </p>
            ) : null}

            <div className="flex items-center gap-2.5 text-[11.5px] text-fg-3">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ background: accent }}
                />
                {projectHealthMeta[project.health].label}
              </span>
              <div className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="absolute inset-y-0 left-0 rounded-full opacity-90 transition-all"
                  style={{
                    width: `${progress.inProgressPercent}%`,
                    background: "var(--status-doing)",
                  }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                  style={{
                    width: `${progress.percent}%`,
                    background: "var(--status-done)",
                  }}
                />
              </div>
              <span className="tabular-nums">{progress.percent}%</span>
            </div>

              <div className="mt-auto flex items-center gap-2 border-t border-dashed border-line pt-2 text-[11.5px] text-fg-3">
              <span className="truncate">{lead?.name ?? "Unassigned"}</span>
              {progress.scope > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="shrink-0">{progress.scope} items</span>
                </>
              ) : null}
              {targetDate ? (
                <span
                  className={cn(
                    "ml-auto shrink-0 tabular-nums",
                    isOverdue && "text-[color:var(--priority-urgent)]",
                    !isOverdue && isSoon && "text-[color:var(--priority-high)]"
                  )}
                >
                  {isOverdue ? "Overdue · " : ""}
                  {format(targetDate, "MMM d")}
                </span>
              ) : null}
              </div>
            </Link>
          </ProjectContextMenu>
        )
      })}
    </div>
  )
}

const viewLayoutAccent: Record<ViewDefinition["layout"], string> = {
  list: "var(--status-todo)",
  board: "var(--status-doing)",
  timeline: "var(--status-review)",
}

export function SavedViewsBoard({
  views,
  showDescriptions,
  contextLabels,
  editable,
}: {
  views: ViewDefinition[]
  showDescriptions: boolean
  contextLabels?: Record<string, string>
  editable: boolean
}) {
  return (
    <div className="grid gap-3.5 px-7 py-4 sm:grid-cols-2 xl:grid-cols-3">
      {views.map((view) => (
        <ViewContextMenu key={view.id} view={view}>
          <Link
            className="group flex h-full min-h-[168px] flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 transition-all hover:-translate-y-px hover:border-fg-4 hover:shadow-sm"
            href={getViewHref(view)}
          >
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-md text-white"
              style={{ background: viewLayoutAccent[view.layout] }}
            >
              {getEntityKindIcon(view.entityKind)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[14px] leading-[1.3] font-semibold tracking-[-0.005em] text-foreground">
                {view.name}
              </h2>
              <div className="mt-px truncate text-[11.5px] text-fg-3">
                {formatEntityKind(view.entityKind)} · {view.layout}
              </div>
            </div>
            <ArrowSquareOut className="size-3.5 shrink-0 text-fg-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
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
              Group by {view.grouping}
            </Badge>
            {view.subGrouping ? (
              <Badge
                variant="outline"
                className="h-5 rounded-md border-line bg-transparent px-1.5 text-[10.5px] font-normal text-fg-3"
              >
                / {view.subGrouping}
              </Badge>
            ) : null}
          </div>
          <div className="mt-auto flex items-center gap-2 border-t border-dashed border-line pt-2 text-[11.5px] text-fg-3">
            <span>{contextLabels?.[view.id] ?? (view.isShared ? "Shared" : "Personal")}</span>
            {view.ordering ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">Sort {view.ordering}</span>
              </>
            ) : null}
          </div>
          </Link>
        </ViewContextMenu>
      ))}
    </div>
  )
}

export function DocumentBoard({
  data,
  documents,
}: {
  data: AppData
  documents: Document[]
}) {
  return (
    <div className="grid gap-3.5 px-7 py-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {documents.map((document) => {
        const preview = getDocumentPreview(document)
        const author = getUser(data, document.updatedBy ?? document.createdBy)

        return (
          <DocumentContextMenu
            key={document.id}
            data={data}
            document={document}
          >
            <Link
              className="group flex flex-col self-start rounded-xl border border-line bg-surface transition-all hover:-translate-y-px hover:border-fg-4 hover:shadow-sm"
              href={`/docs/${document.id}`}
            >
              <div className="px-4 pt-4 pb-3">
                <h3 className="text-[14px] leading-[1.3] font-semibold tracking-[-0.005em] text-foreground group-hover:underline">
                  {document.title}
                </h3>
                {preview ? (
                  <p className="mt-2 line-clamp-3 text-[12.5px] leading-[1.5] text-fg-2">
                    {preview}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2 border-t border-line-soft px-4 py-2.5 text-[11.5px] text-fg-3">
                <DocumentAuthorAvatar
                  avatarImageUrl={author?.avatarImageUrl}
                  avatarUrl={author?.avatarUrl}
                  name={author?.name ?? "Unknown"}
                />
                <span className="truncate">{author?.name ?? "Unknown"}</span>
                <span className="ml-auto shrink-0 tabular-nums">
                  {format(new Date(document.updatedAt), "MMM d")}
                </span>
              </div>
            </Link>
          </DocumentContextMenu>
        )
      })}
    </div>
  )
}

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

export function ProjectBoard({
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
            href={getProjectHref(data, project) ?? "/workspace/projects"}
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

            <div className="mt-3 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
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

export function SavedViewsBoard({
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

export function DocumentBoard({
  data,
  documents,
}: {
  data: AppData
  documents: Document[]
}) {
  return (
    <div className="grid gap-4 px-6 py-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
              className="flex flex-col self-start rounded-lg border bg-card p-0 transition-colors hover:border-foreground/15 hover:bg-accent/30"
              href={`/docs/${document.id}`}
            >
              <div className="px-4 pt-4 pb-3">
                <h3 className="text-sm leading-snug font-medium">
                  {document.title}
                </h3>
                {preview ? (
                  <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {preview}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
                <DocumentAuthorAvatar
                  avatarImageUrl={author?.avatarImageUrl}
                  avatarUrl={author?.avatarUrl}
                  name={author?.name ?? "Unknown"}
                />
                <span className="truncate">{author?.name ?? "Unknown"}</span>
                <span className="ml-auto shrink-0">
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

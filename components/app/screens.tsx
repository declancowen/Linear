"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { format } from "date-fns"
import {
  CalendarDots,
  FileText,
  Plus,
  Rows,
  SquaresFour,
} from "@phosphor-icons/react"

import {
  canEditTeam,
  canEditWorkspace,
  getPrivateDocuments,
  getProjectHref,
  getProjectProgress,
  getProjectsForScope,
  getTeam,
  getTeamBySlug,
  getTeamDocuments,
  getUser,
  getViewByRoute,
  getViewContextLabel,
  getVisibleProjectsForView,
  getViewsForScope,
  getVisibleWorkItems,
  getWorkspaceDocuments,
  getWorkspaceDirectoryViews,
  teamHasFeature,
} from "@/lib/domain/selectors"
import { formatCalendarDateLabel } from "@/lib/date-input"
import {
  getWorkSurfaceCopy,
  projectStatusMeta,
  priorityMeta,
  templateMeta,
  type DisplayProperty,
  type GroupField,
  type Project,
  type ScopeType,
  type Team,
  type ViewDefinition,
} from "@/lib/domain/types"
import { createViewDefinition, isSystemView } from "@/lib/domain/default-views"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  CollectionDisplaySettingsPopover,
  HeaderTitle,
  MissingState,
  SCREEN_HEADER_CLASS_NAME,
  ScreenHeader,
  formatEntityKind,
  getDocumentPreview,
} from "@/components/app/screens/shared"
export { InboxScreen } from "@/components/app/screens/inbox-screen"
import { CreateDocumentDialog } from "@/components/app/screens/create-document-dialog"
import { DocumentContextMenu } from "@/components/app/screens/document-ui"
import {
  ProjectContextMenu,
  ViewContextMenu,
} from "@/components/app/screens/entity-context-menus"
export { ProjectDetailScreen } from "@/components/app/screens/project-detail-screen"
import {
  createEmptyViewFilters,
  type ViewFilterKey,
} from "@/components/app/screens/helpers"
import { DocumentBoard } from "@/components/app/screens/collection-boards"
import { WorkSurface } from "@/components/app/screens/work-surface"
import { getViewHref } from "@/lib/domain/default-views"
import {
  GroupChipPopover,
  PROJECT_DISPLAY_PROPERTY_OPTIONS,
  PROJECT_GROUP_OPTIONS,
  ProjectFilterPopover,
  ProjectLayoutTabs,
  ProjectSortChipPopover,
  PropertiesChipPopover,
  type ViewConfigPatch,
  getGroupFieldOptionLabel,
} from "@/components/app/screens/work-surface-controls"
import {
  type ViewsDirectoryFilters,
  type ViewsDirectoryGroupField,
  type ViewsDirectoryProperty,
  type ViewsDirectoryScopeFilter,
  type ViewsDirectorySortField,
  ViewsDirectoryFilterPopover,
  ViewsDirectoryGroupChipPopover,
  ViewsDirectoryLayoutTabs,
  ViewsDirectoryPropertiesChipPopover,
  ViewsDirectorySortChipPopover,
} from "@/components/app/screens/directory-controls"
import {
  IconButton,
  Topbar,
  Viewbar,
} from "@/components/ui/template-primitives"
import { cn } from "@/lib/utils"
export { DocumentDetailScreen } from "@/components/app/screens/document-detail-screen"
export { WorkItemDetailScreen } from "@/components/app/screens/work-item-detail-screen"

function useCollectionLayout(routeKey: string, views: ViewDefinition[]) {
  const selectedView = useAppStore((state) => getViewByRoute(state, routeKey))
  const searchParams = useSearchParams()
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

  return { activeView, layout, setLayout }
}

const viewDirectoryLayoutMeta: Record<
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

type GroupedSection<T> = {
  key: string
  label: string
  items: T[]
  children: GroupedSection<T>[] | null
}

const PROJECT_STATUS_ORDER = [
  "backlog",
  "planned",
  "in-progress",
  "completed",
  "cancelled",
] as const

const DEFAULT_PROJECT_DISPLAY_PROPS: DisplayProperty[] = [
  "id",
  "status",
  "assignee",
  "priority",
  "updated",
]

const DEFAULT_VIEW_DIRECTORY_PROPERTIES: ViewsDirectoryProperty[] = [
  "description",
  "scope",
  "updated",
  "configuration",
]

function getProjectGroupOptionLabel(field: GroupField) {
  if (field === "assignee") {
    return "Lead"
  }

  if (field === "type") {
    return "Template"
  }

  return getGroupFieldOptionLabel(field)
}

function getProjectPropertyLabel(property: DisplayProperty) {
  if (property === "assignee") {
    return "Lead"
  }

  if (property === "dueDate") {
    return "Target date"
  }

  if (property === "type") {
    return "Template"
  }

  if (property === "created") {
    return "Created"
  }

  if (property === "updated") {
    return "Updated"
  }

  if (property === "status") {
    return "Status"
  }

  if (property === "priority") {
    return "Priority"
  }

  if (property === "id") {
    return "ID"
  }

  return property
}

function buildGroupedSections<T>({
  items,
  grouping,
  subGrouping,
  getGroupKey,
  getGroupLabel,
  compareGroupKeys,
}: {
  items: T[]
  grouping: string | null
  subGrouping: string | null
  getGroupKey: (item: T, field: string) => string
  getGroupLabel: (field: string, key: string) => string
  compareGroupKeys: (field: string, left: string, right: string) => number
}): GroupedSection<T>[] {
  if (!grouping || grouping === "none") {
    return [
      {
        key: "all",
        label: "All",
        items,
        children: null,
      },
    ]
  }

  const groups = new Map<string, T[]>()

  for (const item of items) {
    const key = getGroupKey(item, grouping)
    const current = groups.get(key)

    if (current) {
      current.push(item)
      continue
    }

    groups.set(key, [item])
  }

  const orderedKeys = [...groups.keys()].sort((left, right) =>
    compareGroupKeys(grouping, left, right)
  )

  return orderedKeys.map((key) => {
    const groupedItems = groups.get(key) ?? []

    if (!subGrouping || subGrouping === "none" || subGrouping === grouping) {
      return {
        key,
        label: getGroupLabel(grouping, key),
        items: groupedItems,
        children: null,
      }
    }

    const subGroups = new Map<string, T[]>()

    for (const item of groupedItems) {
      const subKey = getGroupKey(item, subGrouping)
      const current = subGroups.get(subKey)

      if (current) {
        current.push(item)
        continue
      }

      subGroups.set(subKey, [item])
    }

    const orderedSubKeys = [...subGroups.keys()].sort((left, right) =>
      compareGroupKeys(subGrouping, left, right)
    )

    return {
      key,
      label: getGroupLabel(grouping, key),
      items: groupedItems,
      children: orderedSubKeys.map((subKey) => ({
        key: `${key}:${subKey}`,
        label: getGroupLabel(subGrouping, subKey),
        items: subGroups.get(subKey) ?? [],
        children: null,
      })),
    }
  })
}

function getProjectGroupKey(project: Project, field: string) {
  if (field === "priority") {
    return project.priority
  }

  if (field === "team") {
    return project.scopeType === "team" ? project.scopeId : "__workspace__"
  }

  if (field === "assignee") {
    return project.leadId || "__unassigned__"
  }

  if (field === "type") {
    return project.templateType
  }

  return project.status
}

function getProjectGroupLabel(
  data: ReturnType<typeof useAppStore.getState>,
  field: string,
  key: string
) {
  if (field === "priority") {
    return priorityMeta[key as keyof typeof priorityMeta]?.label ?? "None"
  }

  if (field === "team") {
    return key === "__workspace__"
      ? "Workspace"
      : (getTeam(data, key)?.name ?? "Unknown team")
  }

  if (field === "assignee") {
    return key === "__unassigned__"
      ? "Unassigned"
      : (getUser(data, key)?.name ?? "Unknown lead")
  }

  if (field === "type") {
    return templateMeta[key as keyof typeof templateMeta]?.label ?? "Template"
  }

  return (
    projectStatusMeta[key as keyof typeof projectStatusMeta]?.label ?? "Status"
  )
}

function compareProjectGroupKeys(
  data: ReturnType<typeof useAppStore.getState>,
  field: string,
  left: string,
  right: string
) {
  if (field === "priority") {
    return (
      priorityMeta[right as keyof typeof priorityMeta].weight -
      priorityMeta[left as keyof typeof priorityMeta].weight
    )
  }

  if (field === "team") {
    if (left === "__workspace__" && right !== "__workspace__") {
      return -1
    }

    if (right === "__workspace__" && left !== "__workspace__") {
      return 1
    }

    return getProjectGroupLabel(data, field, left).localeCompare(
      getProjectGroupLabel(data, field, right)
    )
  }

  if (field === "status") {
    return (
      PROJECT_STATUS_ORDER.indexOf(
        left as (typeof PROJECT_STATUS_ORDER)[number]
      ) -
      PROJECT_STATUS_ORDER.indexOf(
        right as (typeof PROJECT_STATUS_ORDER)[number]
      )
    )
  }

  return getProjectGroupLabel(data, field, left).localeCompare(
    getProjectGroupLabel(data, field, right)
  )
}

function getProjectDisplayTokens(
  data: ReturnType<typeof useAppStore.getState>,
  project: Project,
  displayProps: DisplayProperty[]
) {
  const tokens: Array<{ key: string; label: string }> = []

  for (const property of displayProps) {
    if (property === "id") {
      tokens.push({
        key: property,
        label: `ID ${project.id.slice(0, 8)}`,
      })
      continue
    }

    if (property === "status") {
      tokens.push({
        key: property,
        label:
          projectStatusMeta[project.status as keyof typeof projectStatusMeta]
            ?.label ?? "Status",
      })
      continue
    }

    if (property === "priority") {
      tokens.push({
        key: property,
        label: priorityMeta[project.priority].label,
      })
      continue
    }

    if (property === "assignee") {
      tokens.push({
        key: property,
        label: getUser(data, project.leadId)?.name ?? "Unassigned",
      })
      continue
    }

    if (property === "type") {
      tokens.push({
        key: property,
        label: templateMeta[project.templateType].label,
      })
      continue
    }

    if (property === "dueDate") {
      const targetDateLabel = formatCalendarDateLabel(project.targetDate, "")

      if (targetDateLabel) {
        tokens.push({
          key: property,
          label: targetDateLabel,
        })
      }
      continue
    }

    if (property === "created") {
      tokens.push({
        key: property,
        label: `Created ${format(new Date(project.createdAt), "MMM d")}`,
      })
      continue
    }

    if (property === "updated") {
      tokens.push({
        key: property,
        label: `Updated ${format(new Date(project.updatedAt), "MMM d")}`,
      })
    }
  }

  return tokens
}

function getViewDirectoryScopeFilter(
  view: ViewDefinition,
  scopeType: "team" | "workspace"
): ViewsDirectoryScopeFilter {
  if (scopeType === "workspace") {
    if (view.scopeType === "team") {
      return "team"
    }

    if (view.scopeType === "workspace") {
      return "workspace"
    }

    return "personal"
  }

  return view.isShared ? "team" : "personal"
}

function getViewDirectoryScopeLabel(input: {
  view: ViewDefinition
  scopeType: "team" | "workspace"
  scopeLabels: Record<string, string>
}) {
  if (input.scopeType === "workspace") {
    return input.scopeLabels[input.view.id] ?? "Workspace"
  }

  return input.view.isShared ? "Team" : "Personal"
}

function getViewDirectoryGroupKey(
  view: ViewDefinition,
  field: ViewsDirectoryGroupField,
  scopeType: "team" | "workspace",
  scopeLabels: Record<string, string>
) {
  if (field === "entity") {
    return view.entityKind
  }

  return getViewDirectoryScopeLabel({
    view,
    scopeType,
    scopeLabels,
  })
}

function getViewDirectoryGroupLabel(
  field: ViewsDirectoryGroupField,
  key: string
) {
  if (field === "entity") {
    return formatEntityKind(key as ViewDefinition["entityKind"])
  }

  return key
}

function ProjectHealthPill({ project }: { project: Project }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
        project.health === "on-track" &&
          "bg-[color:color-mix(in_oklch,var(--status-done)_14%,transparent)] text-[color:var(--status-done)]",
        project.health === "at-risk" &&
          "bg-[color:color-mix(in_oklch,var(--priority-high)_14%,transparent)] text-[color:var(--priority-high)]",
        project.health === "off-track" &&
          "bg-[color:color-mix(in_oklch,var(--priority-urgent)_14%,transparent)] text-[color:var(--priority-urgent)]",
        project.health === "no-update" && "bg-surface-2 text-fg-3"
      )}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{
          background:
            project.health === "on-track"
              ? "var(--status-done)"
              : project.health === "at-risk"
                ? "var(--priority-high)"
                : project.health === "off-track"
                  ? "var(--priority-urgent)"
                  : "var(--text-4)",
        }}
      />
      {project.health === "no-update"
        ? "No update"
        : project.health === "on-track"
          ? "On track"
          : project.health === "at-risk"
            ? "At risk"
            : "Off track"}
    </span>
  )
}

function ProjectIconTile({ project }: { project: Project }) {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-3 text-fg-2"
    >
      <span className="text-[13px] font-semibold">
        {project.name.charAt(0).toUpperCase()}
      </span>
    </span>
  )
}

function ProjectDisplayTokenRow({
  data,
  project,
  displayProps,
  className,
}: {
  data: ReturnType<typeof useAppStore.getState>
  project: Project
  displayProps: DisplayProperty[]
  className?: string
}) {
  const projectTeam =
    project.scopeType === "team" ? getTeam(data, project.scopeId) : null
  const tokens = getProjectDisplayTokens(data, project, displayProps)

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-fg-3",
        className
      )}
    >
      <span>{projectTeam?.name ?? "Workspace"}</span>
      {tokens.map((token) => (
        <span key={token.key} className="inline-flex items-center gap-2">
          <span aria-hidden className="text-fg-4">
            ·
          </span>
          <span>{token.label}</span>
        </span>
      ))}
    </div>
  )
}

function ProjectRow({
  data,
  project,
  displayProps,
}: {
  data: ReturnType<typeof useAppStore.getState>
  project: Project
  displayProps: DisplayProperty[]
}) {
  const progress = getProjectProgress(data, project.id)
  const summary = project.summary || project.description

  return (
    <ProjectContextMenu data={data} project={project}>
      <Link
        className="group block border-b border-line-soft px-7 py-3 transition-colors hover:bg-surface-2"
        href={getProjectHref(data, project) ?? "/workspace/projects"}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <ProjectIconTile project={project} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-[14px] font-semibold tracking-[-0.005em] text-foreground group-hover:underline">
                  {project.name}
                </span>
                <ProjectHealthPill project={project} />
              </div>
              <ProjectDisplayTokenRow
                className="mt-1"
                data={data}
                project={project}
                displayProps={displayProps}
              />
              {summary ? (
                <p className="mt-1.5 line-clamp-2 max-w-2xl text-[12.5px] leading-5 text-fg-2">
                  {summary}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:w-[340px] lg:shrink-0">
            <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
              <div className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="absolute inset-y-0 left-0 rounded-full opacity-90"
                  style={{
                    width: `${progress.inProgressPercent}%`,
                    background: "var(--status-doing)",
                  }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${progress.percent}%`,
                    background: "var(--status-done)",
                  }}
                />
              </div>
              <span className="w-9 text-right tabular-nums">
                {progress.percent}%
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
              <span>{progress.scope} items</span>
            </div>
          </div>
        </div>
      </Link>
    </ProjectContextMenu>
  )
}

function ProjectCard({
  data,
  project,
  displayProps,
}: {
  data: ReturnType<typeof useAppStore.getState>
  project: Project
  displayProps: DisplayProperty[]
}) {
  const progress = getProjectProgress(data, project.id)
  const summary = project.summary || project.description

  return (
    <ProjectContextMenu data={data} project={project}>
      <Link
        className="group flex min-h-[168px] flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 transition-all hover:-translate-y-px hover:border-fg-4 hover:shadow-sm"
        href={getProjectHref(data, project) ?? "/workspace/projects"}
      >
        <div className="flex items-center gap-2.5">
          <ProjectIconTile project={project} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] leading-[1.3] font-semibold tracking-[-0.005em] text-foreground group-hover:underline">
              {project.name}
            </h2>
            <ProjectDisplayTokenRow
              className="mt-px"
              data={data}
              project={project}
              displayProps={displayProps}
            />
          </div>
        </div>

        {summary ? (
          <p className="line-clamp-2 text-[12.5px] leading-[1.5] text-fg-2">
            {summary}
          </p>
        ) : null}

        <div className="flex items-center gap-2.5 text-[11.5px] text-fg-3">
          <ProjectHealthPill project={project} />
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
          <span>{progress.scope} items</span>
        </div>
      </Link>
    </ProjectContextMenu>
  )
}

function GroupHeading({
  label,
  count,
  className,
}: {
  label: string
  count: number
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <h2 className="text-[12px] font-semibold tracking-[0.02em] text-foreground">
        {label}
      </h2>
      <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-3">
        {count}
      </span>
    </div>
  )
}

function ViewConfigurationBadges({ view }: { view: ViewDefinition }) {
  const layoutMeta = viewDirectoryLayoutMeta[view.layout]

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-fg-3">
      <span className="rounded-md border border-line bg-surface px-1.5 py-1">
        {formatEntityKind(view.entityKind)}
      </span>
      <span className="rounded-md border border-line bg-surface px-1.5 py-1">
        {layoutMeta.label}
      </span>
      <span className="rounded-md border border-line bg-surface px-1.5 py-1">
        {getGroupFieldOptionLabel(view.grouping)}
        {view.subGrouping
          ? ` / ${getGroupFieldOptionLabel(view.subGrouping)}`
          : ""}
      </span>
    </div>
  )
}

function SavedViewRow({
  scopeLabel,
  showConfiguration,
  showDescription,
  showScope,
  showUpdated,
  view,
}: {
  scopeLabel: string
  showConfiguration: boolean
  showDescription: boolean
  showScope: boolean
  showUpdated: boolean
  view: ViewDefinition
}) {
  const layoutMeta = viewDirectoryLayoutMeta[view.layout]
  const LayoutIcon = layoutMeta.icon

  return (
    <ViewContextMenu view={view}>
      <Link
        className="group flex items-start gap-3 border-b border-line-soft px-6 py-3 transition-colors hover:bg-surface-2 sm:px-7"
        href={getViewHref(view)}
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-md text-white"
          style={{ background: layoutMeta.accent }}
        >
          <LayoutIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[13.5px] font-medium text-foreground group-hover:underline">
              {view.name}
            </span>
            {showScope ? (
              <span className="text-[11.5px] text-fg-3">{scopeLabel}</span>
            ) : null}
          </div>
          {showDescription && view.description ? (
            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-fg-3">
              {view.description}
            </p>
          ) : null}
          {showConfiguration ? (
            <div className="mt-2">
              <ViewConfigurationBadges view={view} />
            </div>
          ) : null}
        </div>
        {showUpdated ? (
          <div className="shrink-0 text-[12px] text-fg-3 tabular-nums">
            {format(new Date(view.updatedAt), "MMM d")}
          </div>
        ) : null}
      </Link>
    </ViewContextMenu>
  )
}

function SavedViewCard({
  scopeLabel,
  showConfiguration,
  showDescription,
  showScope,
  showUpdated,
  view,
}: {
  scopeLabel: string
  showConfiguration: boolean
  showDescription: boolean
  showScope: boolean
  showUpdated: boolean
  view: ViewDefinition
}) {
  const layoutMeta = viewDirectoryLayoutMeta[view.layout]
  const LayoutIcon = layoutMeta.icon

  return (
    <ViewContextMenu view={view}>
      <Link
        className="group flex h-full min-h-[168px] flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 transition-all hover:-translate-y-px hover:border-fg-4 hover:shadow-sm"
        href={getViewHref(view)}
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-md"
            style={{
              color: layoutMeta.accent,
              background: `color-mix(in oklch, ${layoutMeta.accent} 18%, transparent)`,
            }}
          >
            <LayoutIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] leading-[1.3] font-semibold tracking-[-0.005em] text-foreground">
              {view.name}
            </h2>
            {showScope || showUpdated ? (
              <div className="mt-px truncate text-[11.5px] text-fg-3">
                {[
                  showScope ? scopeLabel : null,
                  showUpdated
                    ? format(new Date(view.updatedAt), "MMM d")
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            ) : null}
          </div>
        </div>
        {showDescription && view.description ? (
          <p className="line-clamp-2 text-[12.5px] leading-[1.5] text-fg-2">
            {view.description}
          </p>
        ) : null}
        {showConfiguration ? <ViewConfigurationBadges view={view} /> : null}
      </Link>
    </ViewContextMenu>
  )
}

/* ------------------------------------------------------------------ */
/*  Screen components                                                  */
/* ------------------------------------------------------------------ */

export function TeamWorkScreen({ teamSlug }: { teamSlug: string }) {
  const team = useAppStore((state) => getTeamBySlug(state, teamSlug))
  const views = useAppStore(
    useShallow((state) =>
      team ? getViewsForScope(state, "team", team.id, "items") : []
    )
  )
  const items = useAppStore(
    useShallow((state) =>
      team ? getVisibleWorkItems(state, { teamId: team.id }) : []
    )
  )

  if (!team) {
    return <MissingState title="Team not found" />
  }

  const workCopy = getWorkSurfaceCopy(team.settings.experience)

  if (!teamHasFeature(team, "issues")) {
    return <MissingState title={workCopy.disabledLabel} />
  }

  return (
    <WorkSurface
      title={workCopy.surfaceLabel}
      routeKey={`/team/${team.slug}/work`}
      views={views}
      items={items}
      team={team}
      emptyLabel={workCopy.emptyLabel}
    />
  )
}

export function AssignedScreen() {
  const { activeTeamId, currentUserId } = useAppStore(
    useShallow((state) => ({
      activeTeamId: state.ui.activeTeamId,
      currentUserId: state.currentUserId,
    }))
  )
  const team = useAppStore((state) => getTeam(state, activeTeamId))
  const views = useAppStore(
    useShallow((state) =>
      getViewsForScope(state, "personal", currentUserId, "items")
    )
  )
  const items = useAppStore(
    useShallow((state) =>
      getVisibleWorkItems(state, { assignedToCurrentUser: true })
    )
  )

  return (
    <WorkSurface
      title="My items"
      routeKey="/assigned"
      views={views}
      items={items}
      team={team}
      emptyLabel="Nothing is assigned right now"
    />
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
  const data = useAppStore((state) => state)
  const projects = useAppStore(
    useShallow((state) => getProjectsForScope(state, scopeType, scopeId))
  )
  const projectViews = useAppStore(
    useShallow((state) =>
      getViewsForScope(
        state,
        scopeType === "team" ? "team" : "workspace",
        scopeId,
        "projects"
      )
    )
  )
  const routeKey = team ? `/team/${team.slug}/projects` : "/workspace/projects"
  const { activeView, layout, setLayout } = useCollectionLayout(
    routeKey,
    projectViews
  )
  const [projectFilters, setProjectFilters] = useState(() =>
    createEmptyViewFilters()
  )
  const [projectGrouping, setProjectGrouping] = useState<GroupField>("status")
  const [projectSubGrouping, setProjectSubGrouping] =
    useState<GroupField | null>(null)
  const [projectOrdering, setProjectOrdering] =
    useState<ViewDefinition["ordering"]>("priority")
  const [projectDisplayProperties, setProjectDisplayProperties] = useState<
    DisplayProperty[]
  >(DEFAULT_PROJECT_DISPLAY_PROPS)
  const editable = useAppStore((state) =>
    team ? canEditTeam(state, team.id) : canEditWorkspace(state, scopeId)
  )
  const canCreateProject = editable
  const hasSavedProjectView = activeView !== null
  const fallbackProjectView = useMemo(() => {
    const timestamp = new Date().toISOString()

    return (
      createViewDefinition({
        id: `fallback-project-view-${scopeType}-${scopeId}`,
        name: "All projects",
        description: "All projects in this scope.",
        scopeType: team ? "team" : "workspace",
        scopeId,
        entityKind: "projects",
        route: routeKey,
        teamSlug: team?.slug,
        createdAt: timestamp,
        updatedAt: timestamp,
        overrides: {
          layout,
          filters: projectFilters,
          grouping: projectGrouping,
          subGrouping: projectSubGrouping,
          ordering: projectOrdering,
          displayProps: projectDisplayProperties,
        },
      }) ?? null
    )
  }, [
    layout,
    projectDisplayProperties,
    projectFilters,
    projectGrouping,
    projectOrdering,
    projectSubGrouping,
    routeKey,
    scopeId,
    scopeType,
    team,
  ])
  const displayedProjectViews =
    projectViews.length > 0
      ? projectViews
      : fallbackProjectView
        ? [fallbackProjectView]
        : []
  const effectiveProjectView = useMemo(() => {
    const source = activeView ?? fallbackProjectView

    if (!source) {
      return null
    }

    const grouping = PROJECT_GROUP_OPTIONS.includes(source.grouping)
      ? source.grouping
      : "status"
    const subGrouping =
      source.subGrouping &&
      PROJECT_GROUP_OPTIONS.includes(source.subGrouping) &&
      source.subGrouping !== grouping
        ? source.subGrouping
        : null

    return {
      ...source,
      ...(activeView ? {} : { layout }),
      grouping,
      subGrouping,
    }
  }, [activeView, fallbackProjectView, layout])
  const visibleProjects =
    effectiveProjectView !== null
      ? getVisibleProjectsForView(data, projects, effectiveProjectView)
      : projects
  const projectSections = useMemo(
    () =>
      effectiveProjectView
        ? buildGroupedSections({
            items: visibleProjects,
            grouping: effectiveProjectView.grouping,
            subGrouping: effectiveProjectView.subGrouping,
            getGroupKey: (project, field) => getProjectGroupKey(project, field),
            getGroupLabel: (field, key) =>
              getProjectGroupLabel(data, field, key),
            compareGroupKeys: (field, left, right) =>
              compareProjectGroupKeys(data, field, left, right),
          })
        : [],
    [data, effectiveProjectView, visibleProjects]
  )
  const projectDisplayProps = effectiveProjectView?.displayProps ?? []
  const projectLayout = effectiveProjectView?.layout ?? layout
  const emptyProjectsLabel =
    projects.length === 0
      ? "No projects yet"
      : "No projects match the current view."

  function updateProjectView(patch: ViewConfigPatch) {
    if (patch.layout) {
      setLayout(patch.layout === "board" ? "board" : "list")
    }

    if (patch.grouping) {
      setProjectGrouping(patch.grouping)
    }

    if ("subGrouping" in patch) {
      setProjectSubGrouping(patch.subGrouping ?? null)
    }

    if (patch.ordering) {
      setProjectOrdering(patch.ordering)
    }

    if (patch.showCompleted !== undefined) {
      setProjectFilters((current) => ({
        ...current,
        showCompleted: patch.showCompleted ?? true,
      }))
    }
  }

  function toggleProjectFilterValue(key: ViewFilterKey, value: string) {
    setProjectFilters((current) => {
      const nextFilters = { ...current } as ViewDefinition["filters"]
      const currentValues = nextFilters[key] as string[]
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value]

      nextFilters[key] = nextValues as never
      return nextFilters
    })
  }

  function clearProjectFilters() {
    setProjectFilters((current) => ({
      ...createEmptyViewFilters(),
      showCompleted: current.showCompleted,
    }))
  }

  function toggleProjectDisplayProperty(property: DisplayProperty) {
    setProjectDisplayProperties((current) =>
      current.includes(property)
        ? current.filter((value) => value !== property)
        : [...current, property]
    )
  }

  function reorderProjectDisplayProperties(displayProps: DisplayProperty[]) {
    setProjectDisplayProperties(displayProps)
  }

  function clearProjectDisplayProperties() {
    setProjectDisplayProperties([])
  }

  if (team && !teamHasFeature(team, "projects")) {
    return <MissingState title="Projects are disabled for this team" />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <Topbar>
        <HeaderTitle title={title} />
        {displayedProjectViews.length > 0 ? (
          <div className="ml-2 flex items-center gap-0.5">
            {displayedProjectViews.map((view) =>
              isSystemView(view) ? (
                <button
                  key={view.id}
                  className={cn(
                    "h-7 rounded-md px-2 text-[12px] transition-colors",
                    view.id === effectiveProjectView?.id
                      ? "bg-surface-3 font-medium text-foreground"
                      : "text-fg-3 hover:bg-surface-3 hover:text-foreground"
                  )}
                  onClick={() => {
                    if (!activeView) {
                      return
                    }

                    useAppStore.getState().setSelectedView(routeKey, view.id)
                  }}
                >
                  {view.name}
                </button>
              ) : (
                <ViewContextMenu key={view.id} view={view}>
                  <button
                    className={cn(
                      "h-7 rounded-md px-2 text-[12px] transition-colors",
                      view.id === effectiveProjectView?.id
                        ? "bg-surface-3 font-medium text-foreground"
                        : "text-fg-3 hover:bg-surface-3 hover:text-foreground"
                    )}
                    onClick={() => {
                      if (!activeView) {
                        return
                      }

                      useAppStore.getState().setSelectedView(routeKey, view.id)
                    }}
                  >
                    {view.name}
                  </button>
                </ViewContextMenu>
              )
            )}
            {editable ? (
              <IconButton
                className="size-6"
                onClick={() =>
                  openManagedCreateDialog({
                    kind: "view",
                    defaultScopeType: team ? "team" : "workspace",
                    defaultScopeId: scopeId,
                    defaultEntityKind: "projects",
                    defaultRoute: routeKey,
                    ...(team ? { lockScope: true } : {}),
                    lockEntityKind: true,
                  })
                }
              >
                <Plus className="size-3.5" />
              </IconButton>
            ) : null}
          </div>
        ) : null}
      </Topbar>
      {effectiveProjectView ? (
        <Viewbar>
          <ProjectLayoutTabs
            view={effectiveProjectView}
            onUpdateView={hasSavedProjectView ? undefined : updateProjectView}
          />
          <div aria-hidden className="mx-1.5 h-[18px] w-px bg-line" />
          <ProjectFilterPopover
            view={effectiveProjectView}
            projects={projects}
            variant="chip"
            onToggleFilterValue={
              hasSavedProjectView ? undefined : toggleProjectFilterValue
            }
            onClearFilters={hasSavedProjectView ? undefined : clearProjectFilters}
          />
          <GroupChipPopover
            view={effectiveProjectView}
            getOptionLabel={getProjectGroupOptionLabel}
            groupOptions={PROJECT_GROUP_OPTIONS}
            onUpdateView={hasSavedProjectView ? undefined : updateProjectView}
          />
          <ProjectSortChipPopover
            view={effectiveProjectView}
            onUpdateView={hasSavedProjectView ? undefined : updateProjectView}
          />
          <PropertiesChipPopover
            view={effectiveProjectView}
            getPropertyLabel={getProjectPropertyLabel}
            propertyOptions={PROJECT_DISPLAY_PROPERTY_OPTIONS}
            onToggleDisplayProperty={
              hasSavedProjectView ? undefined : toggleProjectDisplayProperty
            }
            onReorderDisplayProperties={
              hasSavedProjectView
                ? undefined
                : reorderProjectDisplayProperties
            }
            onClearDisplayProperties={
              hasSavedProjectView ? undefined : clearProjectDisplayProperties
            }
          />
          <div className="ml-auto flex items-center gap-1.5">
            {canCreateProject ? (
              <Button
                size="sm"
                variant="default"
                className="h-7 gap-1.5 px-2.5 text-[12px]"
                onClick={() => {
                  openManagedCreateDialog({
                    kind: "project",
                    ...(team ? { defaultTeamId: team.id } : {}),
                  })
                }}
              >
                <Plus className="size-3.5" />
                New
              </Button>
            ) : null}
          </div>
        </Viewbar>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {visibleProjects.length === 0 ? (
          <MissingState title={emptyProjectsLabel} />
        ) : (
          <>
            {projectLayout === "board" ? (
              <div className="flex flex-col gap-6 px-7 py-4">
                {projectSections.map((section) => (
                  <section key={section.key} className="flex flex-col gap-3">
                    <GroupHeading
                      label={section.label}
                      count={section.items.length}
                    />
                    {section.children ? (
                      <div className="flex flex-col gap-4">
                        {section.children.map((child) => (
                          <div key={child.key} className="flex flex-col gap-2">
                            <GroupHeading
                              className="pl-1"
                              label={child.label}
                              count={child.items.length}
                            />
                            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                              {child.items.map((project) => (
                                <ProjectCard
                                  key={project.id}
                                  data={data}
                                  displayProps={projectDisplayProps}
                                  project={project}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                        {section.items.map((project) => (
                          <ProjectCard
                            key={project.id}
                            data={data}
                            displayProps={projectDisplayProps}
                            project={project}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex flex-col pb-4">
                {projectSections.map((section) => (
                  <section key={section.key} className="flex flex-col">
                    <GroupHeading
                      className="px-7 py-3"
                      label={section.label}
                      count={section.items.length}
                    />
                    {section.children ? (
                      <div className="flex flex-col">
                        {section.children.map((child) => (
                          <div key={child.key} className="flex flex-col">
                            <GroupHeading
                              className="border-y border-line-soft px-7 py-2.5"
                              label={child.label}
                              count={child.items.length}
                            />
                            {child.items.map((project) => (
                              <ProjectRow
                                key={project.id}
                                data={data}
                                displayProps={projectDisplayProps}
                                project={project}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      section.items.map((project) => (
                        <ProjectRow
                          key={project.id}
                          data={data}
                          displayProps={projectDisplayProps}
                          project={project}
                        />
                      ))
                    )}
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
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
  const views = useAppStore(
    useShallow((state) =>
      scopeType === "workspace"
        ? getWorkspaceDirectoryViews(state, scopeId)
        : state.views.filter(
            (view) =>
              !view.containerType &&
              view.scopeType === scopeType &&
              view.scopeId === scopeId
          )
    )
  )
  const viewContext = useAppStore(
    useShallow((state) => ({
      teams: state.teams,
      workspaces: state.workspaces,
      currentWorkspaceId: state.currentWorkspaceId,
    }))
  )
  const viewScopeLabels = useMemo(
    () =>
      Object.fromEntries(
        views.map((view) => [view.id, getViewContextLabel(viewContext, view)])
      ),
    [viewContext, views]
  )
  const [layout, setLayout] = useState<"list" | "board">("list")
  const [sortBy, setSortBy] = useState<ViewsDirectorySortField>("updated")
  const [filters, setFilters] = useState<ViewsDirectoryFilters>({
    entityKinds: [],
    scopes: [],
  })
  const [grouping, setGrouping] = useState<ViewsDirectoryGroupField>("none")
  const [subGrouping, setSubGrouping] =
    useState<ViewsDirectoryGroupField>("none")
  const [properties, setProperties] = useState<ViewsDirectoryProperty[]>(
    DEFAULT_VIEW_DIRECTORY_PROPERTIES
  )
  const editable = useAppStore((state) =>
    scopeType === "team"
      ? canEditTeam(state, scopeId)
      : canEditWorkspace(state, scopeId)
  )
  const availableEntityKinds = useMemo(
    () => [...new Set(views.map((view) => view.entityKind))],
    [views]
  )
  const availableScopes = useMemo(
    () =>
      [
        ...new Set(
          views.map((view) => getViewDirectoryScopeFilter(view, scopeType))
        ),
      ] as ViewsDirectoryScopeFilter[],
    [scopeType, views]
  )
  const filteredViews = useMemo(
    () =>
      views.filter((view) => {
        if (
          filters.entityKinds.length > 0 &&
          !filters.entityKinds.includes(view.entityKind)
        ) {
          return false
        }

        if (
          filters.scopes.length > 0 &&
          !filters.scopes.includes(getViewDirectoryScopeFilter(view, scopeType))
        ) {
          return false
        }

        return true
      }),
    [filters.entityKinds, filters.scopes, scopeType, views]
  )
  const orderedViews = useMemo(
    () =>
      [...filteredViews].sort((left, right) => {
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
      }),
    [filteredViews, sortBy]
  )
  const viewSections = useMemo(
    () =>
      buildGroupedSections({
        items: orderedViews,
        grouping,
        subGrouping,
        getGroupKey: (view, field) =>
          getViewDirectoryGroupKey(
            view,
            field as ViewsDirectoryGroupField,
            scopeType,
            viewScopeLabels
          ),
        getGroupLabel: (field, key) =>
          getViewDirectoryGroupLabel(field as ViewsDirectoryGroupField, key),
        compareGroupKeys: (field, left, right) =>
          getViewDirectoryGroupLabel(
            field as ViewsDirectoryGroupField,
            left
          ).localeCompare(
            getViewDirectoryGroupLabel(field as ViewsDirectoryGroupField, right)
          ),
      }),
    [grouping, orderedViews, scopeType, subGrouping, viewScopeLabels]
  )
  const showDescription = properties.includes("description")
  const showScope = properties.includes("scope")
  const showUpdated = properties.includes("updated")
  const showConfiguration = properties.includes("configuration")
  const emptyTitle =
    views.length === 0
      ? "No saved views yet"
      : "No saved views match the current settings."

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <Topbar>
        <HeaderTitle title={title} />
      </Topbar>
      <Viewbar>
        <ViewsDirectoryLayoutTabs layout={layout} onLayoutChange={setLayout} />
        <div aria-hidden className="mx-1.5 h-[18px] w-px bg-line" />
        <ViewsDirectoryFilterPopover
          availableEntityKinds={availableEntityKinds}
          availableScopes={availableScopes}
          filters={filters}
          onClearFilters={() =>
            setFilters({
              entityKinds: [],
              scopes: [],
            })
          }
          onToggleEntityKind={(entityKind) =>
            setFilters((current) => ({
              ...current,
              entityKinds: current.entityKinds.includes(entityKind)
                ? current.entityKinds.filter((value) => value !== entityKind)
                : [...current.entityKinds, entityKind],
            }))
          }
          onToggleScope={(scope) =>
            setFilters((current) => ({
              ...current,
              scopes: current.scopes.includes(scope)
                ? current.scopes.filter((value) => value !== scope)
                : [...current.scopes, scope],
            }))
          }
        />
        <ViewsDirectoryGroupChipPopover
          grouping={grouping}
          onGroupingChange={(nextGrouping) => {
            setGrouping(nextGrouping)
            if (nextGrouping !== "none" && subGrouping === nextGrouping) {
              setSubGrouping("none")
            }
          }}
          onSubGroupingChange={setSubGrouping}
          subGrouping={subGrouping}
        />
        <ViewsDirectorySortChipPopover
          sortBy={sortBy}
          onSortByChange={setSortBy}
        />
        <ViewsDirectoryPropertiesChipPopover
          onClearProperties={() =>
            setProperties(DEFAULT_VIEW_DIRECTORY_PROPERTIES)
          }
          onToggleProperty={(property) =>
            setProperties((current) =>
              current.includes(property)
                ? current.filter((value) => value !== property)
                : [...current, property]
            )
          }
          properties={properties}
        />
        <div className="ml-auto flex items-center gap-1.5">
          {editable ? (
            <Button
              size="sm"
              variant="default"
              className="h-7 gap-1.5 px-2.5 text-[12px]"
              onClick={() =>
                openManagedCreateDialog({
                  kind: "view",
                  defaultScopeType: scopeType,
                  defaultScopeId: scopeId,
                  ...(scopeType === "team" ? { lockScope: true } : {}),
                })
              }
            >
              <Plus className="size-3.5" />
              New
            </Button>
          ) : null}
        </div>
      </Viewbar>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {orderedViews.length === 0 ? (
          <MissingState title={emptyTitle} />
        ) : (
          <>
            {layout === "board" ? (
              <div className="flex flex-col gap-6 px-7 py-4">
                {viewSections.map((section) => (
                  <section key={section.key} className="flex flex-col gap-3">
                    {grouping !== "none" ? (
                      <GroupHeading
                        label={section.label}
                        count={section.items.length}
                      />
                    ) : null}
                    {section.children ? (
                      <div className="flex flex-col gap-4">
                        {section.children.map((child) => (
                          <div key={child.key} className="flex flex-col gap-2">
                            <GroupHeading
                              className="pl-1"
                              label={child.label}
                              count={child.items.length}
                            />
                            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                              {child.items.map((view) => (
                                <SavedViewCard
                                  key={view.id}
                                  scopeLabel={getViewDirectoryScopeLabel({
                                    view,
                                    scopeLabels: viewScopeLabels,
                                    scopeType,
                                  })}
                                  showConfiguration={showConfiguration}
                                  showDescription={showDescription}
                                  showScope={showScope}
                                  showUpdated={showUpdated}
                                  view={view}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                        {section.items.map((view) => (
                          <SavedViewCard
                            key={view.id}
                            scopeLabel={getViewDirectoryScopeLabel({
                              view,
                              scopeLabels: viewScopeLabels,
                              scopeType,
                            })}
                            showConfiguration={showConfiguration}
                            showDescription={showDescription}
                            showScope={showScope}
                            showUpdated={showUpdated}
                            view={view}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex flex-col pb-4">
                {viewSections.map((section) => (
                  <section key={section.key} className="flex flex-col">
                    {grouping !== "none" ? (
                      <GroupHeading
                        className="px-7 py-3"
                        label={section.label}
                        count={section.items.length}
                      />
                    ) : null}
                    {section.children ? (
                      <div className="flex flex-col">
                        {section.children.map((child) => (
                          <div key={child.key} className="flex flex-col">
                            <GroupHeading
                              className="border-y border-line-soft px-7 py-2.5"
                              label={child.label}
                              count={child.items.length}
                            />
                            {child.items.map((view) => (
                              <SavedViewRow
                                key={view.id}
                                scopeLabel={getViewDirectoryScopeLabel({
                                  view,
                                  scopeLabels: viewScopeLabels,
                                  scopeType,
                                })}
                                showConfiguration={showConfiguration}
                                showDescription={showDescription}
                                showScope={showScope}
                                showUpdated={showUpdated}
                                view={view}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      section.items.map((view) => (
                        <SavedViewRow
                          key={view.id}
                          scopeLabel={getViewDirectoryScopeLabel({
                            view,
                            scopeLabels: viewScopeLabels,
                            scopeType,
                          })}
                          showConfiguration={showConfiguration}
                          showDescription={showDescription}
                          showScope={showScope}
                          showUpdated={showUpdated}
                          view={view}
                        />
                      ))
                    )}
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
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
  const data = useAppStore((state) => state)
  const activeTeamId = useAppStore((state) => state.ui.activeTeamId)
  const teamDocViews = useAppStore(
    useShallow((state) =>
      team ? getViewsForScope(state, "team", scopeId, "docs") : []
    )
  )
  const workspaceDocViews = useAppStore(
    useShallow((state) =>
      scopeType === "workspace" && !team
        ? getViewsForScope(state, "workspace", scopeId, "docs")
        : []
    )
  )
  const isWorkspaceDocs = scopeType === "workspace" && !team
  const [activeTab, setActiveTab] = useState<"workspace" | "private">(
    "workspace"
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const teamRouteKey = team ? `/team/${team.slug}/docs` : "/workspace/docs/team"
  const teamLayoutState = useCollectionLayout(teamRouteKey, teamDocViews)
  const workspaceLayoutState = useCollectionLayout(
    "/workspace/docs",
    workspaceDocViews
  )
  const privateLayoutState = useCollectionLayout("/workspace/docs/private", [])
  const documents = useAppStore(
    useShallow((state) =>
      isWorkspaceDocs
        ? activeTab === "workspace"
          ? getWorkspaceDocuments(state, scopeId)
          : getPrivateDocuments(state, scopeId)
        : getTeamDocuments(state, scopeId)
    )
  )
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
        teamId: team?.id ?? activeTeamId,
      } as const)
  const editable = useAppStore((state) =>
    team ? canEditTeam(state, team.id) : true
  )
  const emptyTitle = isWorkspaceDocs
    ? activeTab === "workspace"
      ? "No workspace documents yet"
      : "No private documents yet"
    : "No documents yet"

  if (team && !teamHasFeature(team, "docs")) {
    return <MissingState title="Docs are disabled for this team" />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {documents.length === 0 ? (
          <MissingState icon={FileText} title={emptyTitle} />
        ) : layout === "board" ? (
          <DocumentBoard data={data} documents={documents} />
        ) : (
          <div className="flex flex-col divide-y">
            {documents.map((document) => {
              const preview = getDocumentPreview(document)
              const author = getUser(
                data,
                document.updatedBy ?? document.createdBy
              )
              return (
                <DocumentContextMenu
                  key={document.id}
                  data={data}
                  document={document}
                >
                  <Link
                    className="flex items-start px-6 py-3.5 transition-colors hover:bg-accent/40"
                    href={`/docs/${document.id}`}
                  >
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
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{author?.name ?? "Unknown"}</span>
                        <span>·</span>
                        <span>
                          {format(new Date(document.updatedAt), "MMM d")}
                        </span>
                      </div>
                    </div>
                  </Link>
                </DocumentContextMenu>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Create dialogs                                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                  */

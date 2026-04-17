import type { AppData, Priority, Team, WorkStatus } from "@/lib/domain/types"
import {
  getDisplayLabelForWorkItemType,
  statusMeta,
  templateMeta,
  workStatuses,
} from "@/lib/domain/types"

import {
  getAccessibleTeams,
  getProjectsForScope,
} from "@/lib/domain/selectors-internal/core"
import { getSearchableDocuments } from "@/lib/domain/selectors-internal/content"
import { getVisibleWorkItems } from "@/lib/domain/selectors-internal/work-items"

export type GlobalSearchResult = {
  id: string
  kind: "navigation" | "team" | "project" | "item" | "document"
  title: string
  subtitle?: string | null
  href: string
  keywords: string[]
  teamId?: string | null
  status?: WorkStatus | null
  priority?: Priority | null
}

type WorkspaceSearchIndexEntry = GlobalSearchResult & {
  searchableText: string
  teamSearchText: string | null
}

export interface WorkspaceSearchIndex {
  workspaceId: string
  teams: Team[]
  results: WorkspaceSearchIndexEntry[]
}

export type WorkspaceSearchOptions = {
  kind?: GlobalSearchResult["kind"] | "all"
  teamId?: string | "all" | null
  status?: WorkStatus | "all" | null
  limit?: number
}

const workspaceSearchIndexCache = new WeakMap<AppData, WorkspaceSearchIndex>()

const navigationResults: GlobalSearchResult[] = [
  {
    id: "nav-inbox",
    kind: "navigation",
    title: "Inbox",
    subtitle: "Unread notifications and mentions",
    href: "/inbox",
    keywords: ["notifications", "mentions", "inbox"],
  },
  {
    id: "nav-chats",
    kind: "navigation",
    title: "Chats",
    subtitle: "Direct and group conversations across the workspace",
    href: "/chats",
    keywords: ["chat", "messages", "direct", "group"],
  },
  {
    id: "nav-assigned",
    kind: "navigation",
    title: "My items",
    subtitle: "Cross-team work assigned to the current user",
    href: "/assigned",
    keywords: ["assigned", "tasks", "items", "issues"],
  },
  {
    id: "nav-channels",
    kind: "navigation",
    title: "Workspace Channel",
    subtitle: "Shared updates and threaded decisions for the whole workspace",
    href: "/workspace/channel",
    keywords: ["workspace", "channel", "channels", "announcements"],
  },
  {
    id: "nav-docs",
    kind: "navigation",
    title: "Workspace Docs",
    subtitle: "Workspace knowledge plus your private notes",
    href: "/workspace/docs",
    keywords: ["docs", "documents", "knowledge"],
  },
  {
    id: "nav-projects",
    kind: "navigation",
    title: "Workspace Projects",
    subtitle: "Aggregate projects across your joined teams",
    href: "/workspace/projects",
    keywords: ["workspace", "projects"],
  },
  {
    id: "nav-views",
    kind: "navigation",
    title: "Workspace Views",
    subtitle: "Saved list, board, and timeline views",
    href: "/workspace/views",
    keywords: ["views", "boards", "timeline"],
  },
  {
    id: "nav-search",
    kind: "navigation",
    title: "Workspace Search",
    subtitle: "Expanded search with faceted results across the workspace graph",
    href: "/workspace/search",
    keywords: ["search", "discover", "workspace"],
  },
]

function toSearchText(parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase()
}

function toSearchIndexEntry(
  result: GlobalSearchResult,
  teamSearchText: string | null = null
): WorkspaceSearchIndexEntry {
  return {
    ...result,
    searchableText: toSearchText([
      result.title,
      result.subtitle,
      ...result.keywords,
    ]),
    teamSearchText,
  }
}

function toSearchResult(entry: WorkspaceSearchIndexEntry): GlobalSearchResult {
  return {
    href: entry.href,
    id: entry.id,
    keywords: entry.keywords,
    kind: entry.kind,
    priority: entry.priority,
    status: entry.status,
    subtitle: entry.subtitle,
    teamId: entry.teamId,
    title: entry.title,
  }
}

function resolveProjectContextLabel(
  project: AppData["projects"][number],
  accessibleTeamsById: Map<string, Team>,
  workspaceName: string
) {
  if (project.scopeType === "team") {
    return accessibleTeamsById.get(project.scopeId)?.name ?? "Team"
  }

  return workspaceName
}

function resolveProjectHref(
  project: AppData["projects"][number],
  accessibleTeamsById: Map<string, Team>
) {
  if (project.scopeType === "team") {
    const team = accessibleTeamsById.get(project.scopeId)
    return team
      ? `/team/${team.slug}/projects/${project.id}`
      : "/workspace/projects"
  }

  return `/workspace/projects/${project.id}`
}

function resolveDocumentContextLabel(
  document: AppData["documents"][number],
  accessibleTeamsById: Map<string, Team>
) {
  if (document.kind === "workspace-document") {
    return "Workspace"
  }

  if (document.kind === "private-document") {
    return "Private"
  }

  return accessibleTeamsById.get(document.teamId ?? "")?.name ?? "Team"
}

function parseWorkspaceSearchQuery(query: string) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const textTokens: string[] = []
  const kinds = new Set<GlobalSearchResult["kind"]>()
  let teamToken: string | null = null
  let statusToken: WorkStatus | null = null

  for (const token of tokens) {
    if (token.startsWith("kind:")) {
      const rawKind = token.slice(5)
      if (rawKind === "nav" || rawKind === "navigation") {
        kinds.add("navigation")
      } else if (rawKind === "team" || rawKind === "teams") {
        kinds.add("team")
      } else if (rawKind === "project" || rawKind === "projects") {
        kinds.add("project")
      } else if (
        rawKind === "item" ||
        rawKind === "issue" ||
        rawKind === "issues"
      ) {
        kinds.add("item")
      } else if (
        rawKind === "doc" ||
        rawKind === "docs" ||
        rawKind === "document"
      ) {
        kinds.add("document")
      }
      continue
    }

    if (token.startsWith("team:")) {
      teamToken = token.slice(5)
      continue
    }

    if (token.startsWith("status:")) {
      const nextStatus = token.slice(7) as WorkStatus
      if (workStatuses.includes(nextStatus)) {
        statusToken = nextStatus
      }
      continue
    }

    textTokens.push(token)
  }

  return {
    kinds,
    statusToken,
    teamToken,
    textTokens,
  }
}

export function getWorkspaceSearchIndex(data: AppData): WorkspaceSearchIndex {
  const cached = workspaceSearchIndexCache.get(data)

  if (cached) {
    return cached
  }

  const accessibleTeams = getAccessibleTeams(data)
  const accessibleTeamsById = new Map(
    accessibleTeams.map((team) => [team.id, team])
  )
  const teamSearchTexts = new Map(
    accessibleTeams.map((team) => [
      team.id,
      toSearchText([
        team.name,
        team.slug,
        team.settings.joinCode,
        team.settings.summary,
        team.id,
      ]),
    ])
  )
  const usersById = new Map(data.users.map((user) => [user.id, user]))
  const projectsById = new Map(
    data.projects.map((project) => [project.id, project])
  )
  const workspaceName =
    data.workspaces.find(
      (workspace) => workspace.id === data.currentWorkspaceId
    )?.name ?? "Workspace"
  const projects = getProjectsForScope(
    data,
    "workspace",
    data.currentWorkspaceId
  )
  const documents = getSearchableDocuments(data, data.currentWorkspaceId)
  const items = getVisibleWorkItems(data, {
    workspaceId: data.currentWorkspaceId,
  })

  const results = [
    ...navigationResults.map((result) => toSearchIndexEntry(result)),
    ...accessibleTeams.map((team) =>
      toSearchIndexEntry(
        {
          id: `team-${team.id}`,
          kind: "team" as const,
          title: team.name,
          subtitle: team.settings.summary,
          href: `/team/${team.slug}/work`,
          keywords: [team.slug, team.settings.joinCode, team.id],
          teamId: team.id,
          status: null,
          priority: null,
        },
        teamSearchTexts.get(team.id) ?? null
      )
    ),
    ...projects.map((project) => {
      const projectContextLabel = resolveProjectContextLabel(
        project,
        accessibleTeamsById,
        workspaceName
      )
      const team =
        project.scopeType === "team"
          ? accessibleTeamsById.get(project.scopeId)
          : null

      return toSearchIndexEntry(
        {
          id: `project-${project.id}`,
          kind: "project" as const,
          title: project.name,
          subtitle: `${projectContextLabel} · ${templateMeta[project.templateType].label} · ${project.summary}`,
          href: resolveProjectHref(project, accessibleTeamsById),
          keywords: [
            project.id,
            project.summary,
            project.templateType,
            usersById.get(project.leadId)?.name ?? "",
            projectContextLabel,
            team?.settings.experience ?? "",
          ],
          teamId: project.scopeType === "team" ? project.scopeId : null,
          status: null,
          priority: project.priority,
        },
        project.scopeType === "team"
          ? (teamSearchTexts.get(project.scopeId) ?? null)
          : null
      )
    }),
    ...documents.map((document) => {
      const contextLabel = resolveDocumentContextLabel(
        document,
        accessibleTeamsById
      )

      return toSearchIndexEntry(
        {
          id: `document-${document.id}`,
          kind: "document" as const,
          title: document.title,
          subtitle: `${contextLabel} · document`,
          href: `/docs/${document.id}`,
          keywords: [
            document.id,
            document.content,
            accessibleTeamsById.get(document.teamId ?? "")?.slug ?? "",
            contextLabel.toLowerCase(),
          ],
          teamId: document.teamId,
          status: null,
          priority: null,
        },
        document.teamId ? (teamSearchTexts.get(document.teamId) ?? null) : null
      )
    }),
    ...items.map((item) => {
      const team = accessibleTeamsById.get(item.teamId) ?? null

      return toSearchIndexEntry(
        {
          id: `item-${item.id}`,
          kind: "item" as const,
          title: `${item.key} · ${item.title}`,
          subtitle: `${statusMeta[item.status].label} · ${team?.name ?? "Team"} · ${getDisplayLabelForWorkItemType(item.type, team?.settings.experience)}`,
          href: `/items/${item.id}`,
          keywords: [
            item.id,
            item.key,
            item.title,
            item.type,
            item.status,
            team?.slug ?? "",
            projectsById.get(item.primaryProjectId ?? "")?.name ?? "",
            usersById.get(item.assigneeId ?? "")?.name ?? "",
          ],
          teamId: item.teamId,
          status: item.status,
          priority: item.priority,
        },
        teamSearchTexts.get(item.teamId) ?? null
      )
    }),
  ]

  const index: WorkspaceSearchIndex = {
    workspaceId: data.currentWorkspaceId,
    teams: accessibleTeams,
    results,
  }

  workspaceSearchIndexCache.set(data, index)

  return index
}

export function queryWorkspaceSearchIndex(
  index: WorkspaceSearchIndex,
  query: string,
  options: WorkspaceSearchOptions = {}
) {
  const { kinds, statusToken, teamToken, textTokens } =
    parseWorkspaceSearchQuery(query)
  const kindFilter =
    options.kind && options.kind !== "all" ? options.kind : null
  const teamIdFilter =
    options.teamId && options.teamId !== "all" ? options.teamId : null
  const statusFilter =
    options.status && options.status !== "all" ? options.status : null
  const limit = options.limit ?? null
  const results: GlobalSearchResult[] = []

  for (const entry of index.results) {
    if (kindFilter && entry.kind !== kindFilter) {
      continue
    }

    if (kinds.size > 0 && !kinds.has(entry.kind)) {
      continue
    }

    if (teamIdFilter && entry.teamId !== teamIdFilter) {
      continue
    }

    if (teamToken && !entry.teamSearchText?.includes(teamToken)) {
      continue
    }

    if (statusToken) {
      if (entry.kind !== "item" || entry.status !== statusToken) {
        continue
      }
    }

    if (statusFilter) {
      if (entry.kind !== "item" || entry.status !== statusFilter) {
        continue
      }
    }

    if (textTokens.length > 0) {
      const matchesTextTokens = textTokens.every((token) =>
        entry.searchableText.includes(token)
      )

      if (!matchesTextTokens) {
        continue
      }
    }

    results.push(toSearchResult(entry))

    if (limit && results.length >= limit) {
      break
    }
  }

  return results
}

export function searchWorkspace(
  data: AppData,
  query: string,
  options: WorkspaceSearchOptions = {}
) {
  return queryWorkspaceSearchIndex(
    getWorkspaceSearchIndex(data),
    query,
    options
  )
}

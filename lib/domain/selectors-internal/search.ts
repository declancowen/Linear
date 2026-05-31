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
import { getWorkspacePeople } from "@/lib/domain/selectors-internal/people"
import { getVisibleWorkItems } from "@/lib/domain/selectors-internal/work-items"
import { getWorkItemAssigneeIds } from "@/lib/domain/work-item-assignees"

export type GlobalSearchResult = {
  id: string
  kind: "navigation" | "team" | "project" | "item" | "document" | "person"
  title: string
  subtitle?: string | null
  href: string
  keywords: string[]
  teamId?: string | null
  teamIds?: string[]
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

type WorkspaceSearchFilters = {
  kinds: Set<GlobalSearchResult["kind"]>
  kindFilter: GlobalSearchResult["kind"] | null
  teamIdFilter: string | null
  statusFilter: string | null
  statusToken: string | null
  teamToken: string | null
  textTokens: string[]
}

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
    id: "nav-people",
    kind: "navigation",
    title: "People",
    subtitle: "Workspace members, teams, and profile activity",
    href: "/workspace/people",
    keywords: ["people", "members", "users", "profiles", "workspace"],
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
    teamIds: entry.teamIds,
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

const SEARCH_KIND_ALIASES: Record<string, GlobalSearchResult["kind"]> = {
  doc: "document",
  docs: "document",
  document: "document",
  issue: "item",
  issues: "item",
  item: "item",
  nav: "navigation",
  navigation: "navigation",
  project: "project",
  projects: "project",
  people: "person",
  person: "person",
  profile: "person",
  profiles: "person",
  team: "team",
  teams: "team",
  user: "person",
  users: "person",
}

function getPersonName(person: AppData["users"][number]) {
  return person.name.trim() || person.email || person.handle || "Unknown user"
}

function getPersonTeamIds(
  data: AppData,
  workspaceId: string,
  personId: string,
  accessibleTeamsById: Map<string, Team>
) {
  return data.teamMemberships
    .filter((membership) => {
      const team = accessibleTeamsById.get(membership.teamId)

      return membership.userId === personId && team?.workspaceId === workspaceId
    })
    .map((membership) => membership.teamId)
}

function getPersonSubtitle(
  person: AppData["users"][number],
  teamNames: string[]
) {
  return [
    person.title.trim() || null,
    person.email || null,
    teamNames.length > 0
      ? `${teamNames.length} ${teamNames.length === 1 ? "team" : "teams"}`
      : "No teams",
  ]
    .filter(Boolean)
    .join(" · ")
}

function parseWorkspaceSearchQuery(query: string) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const textTokens: string[] = []
  const kinds = new Set<GlobalSearchResult["kind"]>()
  let teamToken: string | null = null
  let statusToken: WorkStatus | null = null

  for (const token of tokens) {
    if (token.startsWith("kind:")) {
      const aliasedKind = SEARCH_KIND_ALIASES[token.slice(5)]
      if (aliasedKind) {
        kinds.add(aliasedKind)
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
  const people = getWorkspacePeople(data, data.currentWorkspaceId)

  const results = [
    ...navigationResults.map((result) => toSearchIndexEntry(result)),
    ...people.map((person) => {
      const teamIds = getPersonTeamIds(
        data,
        data.currentWorkspaceId,
        person.id,
        accessibleTeamsById
      )
      const teamNames = teamIds
        .map((teamId) => accessibleTeamsById.get(teamId)?.name ?? "")
        .filter(Boolean)
      const teamSearchText = toSearchText(
        teamIds.flatMap((teamId) => {
          const team = accessibleTeamsById.get(teamId)

          return team
            ? [
                team.id,
                team.name,
                team.slug,
                team.settings.joinCode,
                team.settings.summary,
              ]
            : []
        })
      )

      return toSearchIndexEntry(
        {
          id: `person-${person.id}`,
          kind: "person" as const,
          title: getPersonName(person),
          subtitle: getPersonSubtitle(person, teamNames),
          href: `/workspace/people/${person.id}`,
          keywords: [
            person.id,
            person.handle,
            person.email,
            person.title,
            person.status,
            person.statusMessage,
          ],
          teamId: null,
          teamIds,
          status: null,
          priority: null,
        },
        teamSearchText || null
      )
    }),
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
            document.previewText ?? document.content,
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
      const isPrivateItem = (item.visibility ?? "team") === "private"
      const team = item.teamId
        ? (accessibleTeamsById.get(item.teamId) ?? null)
        : null
      const contextLabel = isPrivateItem
        ? "Private tasks"
        : (team?.name ?? "Team")
      const experience = isPrivateItem
        ? "project-management"
        : team?.settings.experience

      return toSearchIndexEntry(
        {
          id: `item-${item.id}`,
          kind: "item" as const,
          title: `${item.key} · ${item.title}`,
          subtitle: `${statusMeta[item.status].label} · ${contextLabel} · ${getDisplayLabelForWorkItemType(item.type, experience)}`,
          href: `/items/${item.id}`,
          keywords: [
            item.id,
            item.key,
            item.title,
            item.type,
            item.status,
            team?.slug ?? "",
            projectsById.get(item.primaryProjectId ?? "")?.name ?? "",
            ...getWorkItemAssigneeIds(item).map(
              (assigneeId) => usersById.get(assigneeId)?.name ?? ""
            ),
          ],
          teamId: isPrivateItem ? null : item.teamId,
          status: item.status,
          priority: item.priority,
        },
        item.teamId ? (teamSearchTexts.get(item.teamId) ?? null) : null
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
  const filters: WorkspaceSearchFilters = {
    kinds,
    kindFilter: options.kind && options.kind !== "all" ? options.kind : null,
    teamIdFilter:
      options.teamId && options.teamId !== "all" ? options.teamId : null,
    statusFilter:
      options.status && options.status !== "all" ? options.status : null,
    statusToken,
    teamToken,
    textTokens,
  }
  const limit = options.limit ?? null
  const results: GlobalSearchResult[] = []

  for (const entry of index.results) {
    if (!entryMatchesWorkspaceSearch(entry, filters)) {
      continue
    }

    results.push(toSearchResult(entry))

    if (limit && results.length >= limit) {
      break
    }
  }

  return results
}

function entryMatchesWorkspaceSearch(
  entry: WorkspaceSearchIndexEntry,
  filters: WorkspaceSearchFilters
) {
  return (
    matchesKindFilter(entry, filters) &&
    matchesTeamFilter(entry, filters) &&
    matchesStatusFilter(entry, filters.statusToken) &&
    matchesStatusFilter(entry, filters.statusFilter) &&
    filters.textTokens.every((token) => entry.searchableText.includes(token))
  )
}

function matchesKindFilter(
  entry: WorkspaceSearchIndexEntry,
  filters: WorkspaceSearchFilters
) {
  if (filters.kindFilter && entry.kind !== filters.kindFilter) {
    return false
  }

  return filters.kinds.size === 0 || filters.kinds.has(entry.kind)
}

function matchesTeamFilter(
  entry: WorkspaceSearchIndexEntry,
  filters: WorkspaceSearchFilters
) {
  if (filters.teamIdFilter && entry.teamId !== filters.teamIdFilter) {
    if (!entry.teamIds?.includes(filters.teamIdFilter)) {
      return false
    }
  }

  return (
    !filters.teamToken ||
    entry.teamSearchText?.includes(filters.teamToken) === true
  )
}

function matchesStatusFilter(
  entry: WorkspaceSearchIndexEntry,
  status: string | null
) {
  return !status || (entry.kind === "item" && entry.status === status)
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

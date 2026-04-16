import type { AppData, Priority, WorkStatus } from "@/lib/domain/types"
import {
  getDisplayLabelForWorkItemType,
  statusMeta,
  templateMeta,
  workStatuses,
} from "@/lib/domain/types"

import {
  getAccessibleTeams,
  getProject,
  getProjectContextLabel,
  getProjectHref,
  getProjectTeam,
  getProjectsForScope,
  getTeam,
  getUser,
} from "@/lib/domain/selectors-internal/core"
import {
  getDocumentContextLabel,
  getSearchableDocuments,
} from "@/lib/domain/selectors-internal/content"
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

export function searchWorkspace(data: AppData, query: string) {
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

  const accessibleTeams = getAccessibleTeams(data)
  const projects = getProjectsForScope(
    data,
    "workspace",
    data.currentWorkspaceId
  )
  const documents = getSearchableDocuments(data, data.currentWorkspaceId)
  const items = getVisibleWorkItems(data, {
    workspaceId: data.currentWorkspaceId,
  })

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
      subtitle:
        "Expanded search with faceted results across the workspace graph",
      href: "/workspace/search",
      keywords: ["search", "discover", "workspace"],
    },
  ]

  const results: GlobalSearchResult[] = [
    ...navigationResults,
    ...accessibleTeams.map((team) => ({
      id: `team-${team.id}`,
      kind: "team" as const,
      title: team.name,
      subtitle: team.settings.summary,
      href: `/team/${team.slug}/work`,
      keywords: [team.slug, team.settings.joinCode, team.id],
      teamId: team.id,
      status: null,
      priority: null,
    })),
    ...projects.map((project) => ({
      id: `project-${project.id}`,
      kind: "project" as const,
      title: project.name,
      subtitle: `${getProjectContextLabel(data, project)} · ${templateMeta[project.templateType].label} · ${project.summary}`,
      href: getProjectHref(data, project) ?? "/workspace/projects",
      keywords: [
        project.id,
        project.summary,
        project.templateType,
        getUser(data, project.leadId)?.name ?? "",
        getProjectContextLabel(data, project),
        getProjectTeam(data, project)?.settings.experience ?? "",
      ],
      teamId: project.scopeType === "team" ? project.scopeId : null,
      status: null,
      priority: project.priority,
    })),
    ...documents.map((document) => ({
      id: `document-${document.id}`,
      kind: "document" as const,
      title: document.title,
      subtitle: `${getDocumentContextLabel(data, document)} · document`,
      href: `/docs/${document.id}`,
      keywords: [
        document.id,
        document.content,
        getTeam(data, document.teamId ?? "")?.slug ?? "",
        getDocumentContextLabel(data, document).toLowerCase(),
      ],
      teamId: document.teamId,
      status: null,
      priority: null,
    })),
    ...items.map((item) => {
      const team = getTeam(data, item.teamId)

      return {
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
          getProject(data, item.primaryProjectId)?.name ?? "",
          getUser(data, item.assigneeId)?.name ?? "",
        ],
        teamId: item.teamId,
        status: item.status,
        priority: item.priority,
      }
    }),
  ]

  return results.filter((result) => {
    if (kinds.size > 0 && !kinds.has(result.kind)) {
      return false
    }

    if (teamToken) {
      if (result.kind === "team") {
        const matchesTeam = [result.title, ...result.keywords]
          .join(" ")
          .toLowerCase()
          .includes(teamToken)
        if (!matchesTeam) {
          return false
        }
      } else if (
        result.kind === "project" ||
        result.kind === "item" ||
        result.kind === "document"
      ) {
        const entityTeamId =
          result.kind === "project"
            ? projects.find((project) => `project-${project.id}` === result.id)
                ?.scopeId
            : result.kind === "item"
              ? items.find((item) => `item-${item.id}` === result.id)?.teamId
              : documents.find(
                  (document) => `document-${document.id}` === result.id
                )?.teamId

        if (
          !entityTeamId ||
          !accessibleTeams.some(
            (team) =>
              team.id === entityTeamId &&
              [team.id, team.slug, team.name, team.settings.joinCode]
                .join(" ")
                .toLowerCase()
                .includes(teamToken)
          )
        ) {
          return false
        }
      } else {
        return false
      }
    }

    if (statusToken && result.kind === "item") {
      const item = items.find((entry) => `item-${entry.id}` === result.id)
      if (!item || item.status !== statusToken) {
        return false
      }
    }

    if (statusToken && result.kind !== "item") {
      return false
    }

    if (textTokens.length === 0) {
      return true
    }

    const haystack = [result.title, result.subtitle ?? "", ...result.keywords]
      .join(" ")
      .toLowerCase()

    return textTokens.every((token) => haystack.includes(token))
  })
}

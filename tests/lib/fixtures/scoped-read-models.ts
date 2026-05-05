import type { AppSnapshot } from "@/lib/domain/types"

const SCOPED_READ_MODEL_TIMESTAMP = "2026-04-22T00:00:00.000Z"

function createScopedReadModelFilters() {
  return {
    status: [],
    priority: [],
    assigneeIds: [],
    creatorIds: [],
    leadIds: [],
    health: [],
    milestoneIds: [],
    relationTypes: [],
    projectIds: [],
    parentIds: [],
    itemTypes: [],
    labelIds: [],
    teamIds: [],
    showCompleted: true,
  }
}

export function createScopedReadModelTeam(
  overrides: Partial<AppSnapshot["teams"][number]> = {}
): AppSnapshot["teams"][number] {
  const team = {
    id: "team_1",
    workspaceId: "workspace_1",
    slug: "team-1",
    name: "Team 1",
    icon: "sparkles",
    summary: "",
    settings: {
      experience: "software-development",
      workflow: {
        statusOrder: [
          "backlog",
          "todo",
          "in-progress",
          "done",
          "cancelled",
          "duplicate",
        ],
        templateDefaults: {
          "software-delivery": {
            defaultViewLayout: "list",
            defaultViewGrouping: "status",
            defaultViewOrdering: "priority",
            recommendedItemTypes: ["epic", "feature", "story", "task", "bug"],
          },
          "bug-tracking": {
            defaultViewLayout: "list",
            defaultViewGrouping: "status",
            defaultViewOrdering: "priority",
            recommendedItemTypes: ["issue", "bug"],
          },
          "project-management": {
            defaultViewLayout: "list",
            defaultViewGrouping: "status",
            defaultViewOrdering: "priority",
            recommendedItemTypes: ["epic", "feature", "task"],
          },
        },
      },
      features: {
        issues: true,
        projects: true,
        documents: true,
        chat: true,
        calls: true,
      },
      guestProjectIds: [],
      guestWorkItemIds: [],
      guestDocumentIds: [],
    },
    ...overrides,
  }

  return team as unknown as AppSnapshot["teams"][number]
}

export function createScopedReadModelUser(
  overrides: Partial<AppSnapshot["users"][number]> = {}
): AppSnapshot["users"][number] {
  return {
    id: "user_1",
    handle: "alex",
    email: "alex@example.com",
    name: "Alex",
    avatarUrl: "",
    avatarImageUrl: null,
    title: "",
    hasExplicitStatus: false,
    status: "offline",
    statusMessage: "",
    preferences: {
      emailAssignments: true,
      emailDigest: true,
      emailMentions: true,
      theme: "system",
    },
    accountDeletionPendingAt: null,
    accountDeletedAt: null,
    workosUserId: null,
    ...overrides,
  }
}

export function createScopedReadModelProject(
  overrides: Partial<AppSnapshot["projects"][number]> = {}
): AppSnapshot["projects"][number] {
  const project = {
    id: "project_1",
    scopeType: "team",
    scopeId: "team_1",
    name: "Alpha",
    summary: "",
    description: "",
    status: "in-progress",
    health: "on-track",
    priority: "high",
    leadId: "user_1",
    memberIds: [],
    labelIds: [],
    startDate: null,
    targetDate: null,
    createdAt: SCOPED_READ_MODEL_TIMESTAMP,
    updatedAt: SCOPED_READ_MODEL_TIMESTAMP,
    templateType: "software-delivery",
    presentation: {
      layout: "list",
      grouping: "status",
      ordering: "priority",
      itemLevel: "story",
      showChildItems: false,
      filters: createScopedReadModelFilters(),
      displayProps: [],
    },
    blockingProjectIds: [],
    blockedByProjectIds: [],
    ...overrides,
  }

  return project as unknown as AppSnapshot["projects"][number]
}

export function createScopedReadModelView(
  overrides: Partial<AppSnapshot["views"][number]> = {}
): AppSnapshot["views"][number] {
  const view = {
    id: "view_1",
    name: "Project Items",
    description: "",
    scopeType: "team",
    scopeId: "team_1",
    entityKind: "items",
    layout: "list",
    filters: createScopedReadModelFilters(),
    grouping: "status",
    subGrouping: null,
    ordering: "priority",
    displayProps: [],
    hiddenState: {
      groups: [],
      subgroups: [],
    },
    isShared: false,
    route: "/projects/project_1",
    createdAt: SCOPED_READ_MODEL_TIMESTAMP,
    updatedAt: SCOPED_READ_MODEL_TIMESTAMP,
    itemLevel: "story",
    showChildItems: false,
    ...overrides,
  }

  return view as unknown as AppSnapshot["views"][number]
}

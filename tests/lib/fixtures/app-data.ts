import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  createDefaultViewFilters,
  type AppData,
  type Document,
  type Project,
  type Team,
  type TeamMembership,
  type TeamWorkflowSettings,
  type UserProfile,
  type ViewDefinition,
  type WorkItem,
  type Workspace,
  type WorkspaceMembership,
} from "@/lib/domain/types"

const DEFAULT_TIMESTAMP = "2026-04-18T10:00:00.000Z"

type TestTeamOverrides = Omit<Partial<Team>, "settings"> & {
  settings?: Partial<Team["settings"]>
}

export function createTestUser(
  overrides: Partial<UserProfile> = {}
): UserProfile {
  return {
    id: "user_1",
    name: "Alex",
    handle: "alex",
    email: "alex@example.com",
    avatarUrl: "",
    avatarImageUrl: null,
    workosUserId: null,
    title: "Engineer",
    status: "active",
    statusMessage: "",
    preferences: {
      emailMentions: true,
      emailAssignments: true,
      emailDigest: true,
      theme: "system",
    },
    ...overrides,
  }
}

export function createTestWorkspace(
  overrides: Partial<Workspace> = {}
): Workspace {
  return {
    id: "workspace_1",
    slug: "workspace",
    name: "Workspace",
    logoUrl: "",
    logoImageUrl: null,
    createdBy: "user_1",
    workosOrganizationId: "org_1",
    settings: {
      accent: "#5b5bd6",
      description: "Workspace description",
    },
    ...overrides,
  }
}

export function createTestWorkspaceMembership(
  overrides: Partial<WorkspaceMembership> = {}
): WorkspaceMembership {
  return {
    workspaceId: "workspace_1",
    userId: "user_1",
    role: "admin",
    ...overrides,
  }
}

export function createTestTeam(overrides: TestTeamOverrides = {}): Team {
  const experience = overrides.settings?.experience ?? "software-development"
  const settings = {
    joinCode: "JOIN1234",
    summary: "Platform team",
    guestProjectIds: [],
    guestDocumentIds: [],
    guestWorkItemIds: [],
    experience,
    features: createDefaultTeamFeatureSettings(experience),
    workflow: createDefaultTeamWorkflowSettings(experience),
    ...overrides.settings,
  } as Team["settings"]

  return {
    id: "team_1",
    workspaceId: "workspace_1",
    slug: "platform",
    name: "Platform",
    icon: "robot",
    ...overrides,
    settings,
  }
}

export function createTestTeamMembership(
  overrides: Partial<TeamMembership> = {}
): TeamMembership {
  return {
    teamId: "team_1",
    userId: "user_1",
    role: "admin",
    ...overrides,
  }
}

export function createTestWorkflowSettingsRequestBody(): TeamWorkflowSettings {
  return {
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
        defaultPriority: "high",
        targetWindowDays: 28,
        defaultViewLayout: "board",
        recommendedItemTypes: ["epic", "feature", "requirement", "story"],
        summaryHint: "Delivery",
      },
      "bug-tracking": {
        defaultPriority: "high",
        targetWindowDays: 14,
        defaultViewLayout: "board",
        recommendedItemTypes: ["issue", "sub-issue", "task"],
        summaryHint: "Bug tracking",
      },
      "project-management": {
        defaultPriority: "medium",
        targetWindowDays: 21,
        defaultViewLayout: "timeline",
        recommendedItemTypes: ["epic", "feature", "task"],
        summaryHint: "Project management",
      },
    },
  }
}

export function createTestProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project_1",
    scopeType: "team",
    scopeId: "team_1",
    templateType: "project-management",
    name: "Platform roadmap",
    summary: "",
    description: "",
    leadId: "user_1",
    memberIds: [],
    health: "on-track",
    priority: "medium",
    status: "backlog",
    startDate: null,
    targetDate: null,
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  }
}

export function createTestDocument(
  overrides: Partial<Document> = {}
): Document {
  return {
    id: "doc_1",
    kind: "team-document",
    workspaceId: "workspace_1",
    teamId: "team_1",
    title: "Document",
    content: "<p>Document</p>",
    linkedProjectIds: [],
    linkedWorkItemIds: [],
    createdBy: "user_1",
    updatedBy: "user_1",
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  }
}

export function createTestWorkItem(
  id = "item_1",
  overrides: Partial<WorkItem> = {}
): WorkItem {
  return {
    id,
    key: `PLA-${id}`,
    teamId: "team_1",
    type: "task",
    title: `Item ${id}`,
    descriptionDocId: `doc_${id}`,
    status: "todo",
    priority: "medium",
    assigneeId: null,
    creatorId: "user_1",
    parentId: null,
    primaryProjectId: null,
    linkedProjectIds: [],
    linkedDocumentIds: [],
    labelIds: [],
    milestoneId: null,
    startDate: null,
    dueDate: null,
    targetDate: null,
    subscriberIds: ["user_1"],
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  }
}

export function createTestViewDefinition(
  overrides: Partial<ViewDefinition> = {}
): ViewDefinition {
  return {
    id: "view_1",
    name: "Delivery view",
    description: "Tracks delivery work",
    scopeType: "team",
    scopeId: "team_1",
    entityKind: "items",
    itemLevel: "task",
    showChildItems: true,
    layout: "list",
    filters: createDefaultViewFilters(),
    grouping: "status",
    subGrouping: null,
    ordering: "priority",
    displayProps: [],
    hiddenState: {
      groups: [],
      subgroups: [],
    },
    isShared: false,
    route: "/team/platform/work",
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  }
}

export function createTestWorkspaceDirectoryView(
  overrides: Partial<ViewDefinition> = {}
): ViewDefinition {
  return createTestViewDefinition({
    name: "All work",
    description: "",
    itemLevel: null,
    showChildItems: false,
    layout: "board",
    displayProps: ["id", "status"],
    isShared: true,
    ...overrides,
  })
}

export function createTestWorkspaceDirectoryViews(): ViewDefinition[] {
  return [
    createTestWorkspaceDirectoryView({
      id: "workspace-view",
      name: "Workspace roadmap",
      scopeType: "workspace",
      scopeId: "workspace_1",
      entityKind: "projects",
      route: "/workspace/projects",
    }),
    createTestWorkspaceDirectoryView({
      id: "team-view",
      name: "Platform board",
      scopeType: "team",
      scopeId: "team_1",
      entityKind: "projects",
      route: "/team/platform/projects",
    }),
    createTestWorkspaceDirectoryView({
      id: "legacy-view",
      name: "Legacy workspace board",
      scopeType: "personal",
      scopeId: "user_1",
      entityKind: "projects",
      isShared: false,
      route: "/workspace/projects",
    }),
    createTestWorkspaceDirectoryView({
      id: "hidden-team-view",
      name: "Design board",
      scopeType: "team",
      scopeId: "team_2",
      entityKind: "projects",
      route: "/team/design/projects",
    }),
  ]
}

export function createTestAppData(overrides: Partial<AppData> = {}): AppData {
  const emptyState = createEmptyState()
  const ui = {
    ...emptyState.ui,
    activeTeamId: "team_1",
    ...overrides.ui,
  }

  return {
    ...emptyState,
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    workspaces: [createTestWorkspace()],
    workspaceMemberships: [createTestWorkspaceMembership()],
    teams: [createTestTeam()],
    teamMemberships: [createTestTeamMembership()],
    users: [createTestUser()],
    ui,
    ...overrides,
  }
}

export function createTestWorkspaceShellData(input: {
  currentUserId: string
  users: UserProfile[]
  overrides?: Partial<AppData>
}): AppData {
  return createTestAppData({
    currentUserId: input.currentUserId,
    currentWorkspaceId: "workspace_1",
    workspaces: [
      createTestWorkspace({
        id: "workspace_1",
        slug: "workspace-1",
        name: "Workspace 1",
        createdBy: input.currentUserId,
        workosOrganizationId: null,
        settings: {
          accent: "#000000",
          description: "",
        },
      }),
    ],
    workspaceMemberships: [],
    teams: [],
    teamMemberships: [],
    users: input.users,
    ...input.overrides,
  })
}

export function createTestWorkspaceDirectoryAppData(
  overrides: Partial<AppData> = {}
): AppData {
  return createTestAppData({
    workspaces: [
      createTestWorkspace({
        slug: "acme",
        name: "Acme",
        workosOrganizationId: null,
        settings: {
          accent: "#000000",
          description: "",
        },
      }),
    ],
    teams: [
      createTestTeam({
        icon: "rocket",
        settings: {
          summary: "",
        },
      }),
      createTestTeam({
        id: "team_2",
        slug: "design",
        name: "Design",
        icon: "palette",
        settings: {
          joinCode: "JOIN5678",
          summary: "",
        },
      }),
    ],
    teamMemberships: [createTestTeamMembership()],
    views: createTestWorkspaceDirectoryViews(),
    ...overrides,
  })
}

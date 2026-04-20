import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type AppData,
} from "@/lib/domain/types"
import {
  getWorkspaceSearchIndex,
  searchWorkspace,
} from "@/lib/domain/selectors"

function createSearchFixture(): AppData {
  const data = createEmptyState()

  data.currentUserId = "user_current"
  data.currentWorkspaceId = "workspace_1"
  data.workspaces = [
    {
      id: "workspace_1",
      slug: "acme",
      name: "Acme",
      logoUrl: "",
      logoImageUrl: null,
      createdBy: "user_current",
      workosOrganizationId: null,
      settings: {
        accent: "emerald",
        description: "Main workspace",
      },
    },
  ]
  data.users = [
    {
      id: "user_current",
      name: "Alex Owner",
      handle: "alex",
      email: "alex@example.com",
      avatarUrl: "",
      avatarImageUrl: null,
      workosUserId: null,
      title: "Owner",
      status: "in-progress",
      statusMessage: "",
      preferences: {
        emailMentions: true,
        emailAssignments: true,
        emailDigest: true,
        theme: "system",
      },
    },
    {
      id: "user_lead",
      name: "Priya Lead",
      handle: "priya",
      email: "priya@example.com",
      avatarUrl: "",
      avatarImageUrl: null,
      workosUserId: null,
      title: "Lead",
      status: "in-progress",
      statusMessage: "",
      preferences: {
        emailMentions: true,
        emailAssignments: true,
        emailDigest: true,
        theme: "system",
      },
    },
    {
      id: "user_assignee",
      name: "Sam Builder",
      handle: "sam",
      email: "sam@example.com",
      avatarUrl: "",
      avatarImageUrl: null,
      workosUserId: null,
      title: "Engineer",
      status: "in-progress",
      statusMessage: "",
      preferences: {
        emailMentions: true,
        emailAssignments: true,
        emailDigest: true,
        theme: "system",
      },
    },
  ]
  data.teams = [
    {
      id: "team_alpha",
      workspaceId: "workspace_1",
      slug: "alpha",
      name: "Alpha Team",
      icon: "code",
      settings: {
        joinCode: "ALPHA",
        summary: "Owns the platform roadmap",
        guestProjectIds: [],
        guestDocumentIds: [],
        guestWorkItemIds: [],
        experience: "software-development",
        features: createDefaultTeamFeatureSettings("software-development"),
        workflow: createDefaultTeamWorkflowSettings("software-development"),
      },
    },
    {
      id: "team_beta",
      workspaceId: "workspace_1",
      slug: "beta",
      name: "Beta Team",
      icon: "kanban",
      settings: {
        joinCode: "BETA",
        summary: "Runs launch coordination",
        guestProjectIds: [],
        guestDocumentIds: [],
        guestWorkItemIds: [],
        experience: "project-management",
        features: createDefaultTeamFeatureSettings("project-management"),
        workflow: createDefaultTeamWorkflowSettings("project-management"),
      },
    },
    {
      id: "team_hidden",
      workspaceId: "workspace_1",
      slug: "hidden",
      name: "Hidden Team",
      icon: "qa",
      settings: {
        joinCode: "HIDDEN",
        summary: "Not accessible to the current user",
        guestProjectIds: [],
        guestDocumentIds: [],
        guestWorkItemIds: [],
        experience: "issue-analysis",
        features: createDefaultTeamFeatureSettings("issue-analysis"),
        workflow: createDefaultTeamWorkflowSettings("issue-analysis"),
      },
    },
  ]
  data.teamMemberships = [
    {
      teamId: "team_alpha",
      userId: "user_current",
      role: "admin",
    },
    {
      teamId: "team_beta",
      userId: "user_current",
      role: "member",
    },
  ]
  data.projects = [
    {
      id: "project_alpha",
      scopeType: "team",
      scopeId: "team_alpha",
      templateType: "software-delivery",
      name: "Platform Refresh",
      summary: "Refresh the alpha platform foundations",
      description: "Alpha platform work",
      leadId: "user_lead",
      memberIds: ["user_current", "user_lead"],
      health: "on-track",
      priority: "high",
      status: "in-progress",
      startDate: "2026-04-01",
      targetDate: "2026-05-01",
      createdAt: "2026-04-01T09:00:00.000Z",
      updatedAt: "2026-04-01T09:00:00.000Z",
    },
    {
      id: "project_workspace",
      scopeType: "workspace",
      scopeId: "workspace_1",
      templateType: "project-management",
      name: "Launch Plan",
      summary: "Coordinate the company launch",
      description: "Launch plan",
      leadId: "user_current",
      memberIds: ["user_current"],
      health: "at-risk",
      priority: "medium",
      status: "planned",
      startDate: "2026-04-02",
      targetDate: "2026-06-01",
      createdAt: "2026-04-02T09:00:00.000Z",
      updatedAt: "2026-04-02T09:00:00.000Z",
    },
    {
      id: "project_hidden",
      scopeType: "team",
      scopeId: "team_hidden",
      templateType: "bug-tracking",
      name: "Secret Bugs",
      summary: "Should stay outside the search index",
      description: "Hidden work",
      leadId: "user_lead",
      memberIds: ["user_lead"],
      health: "off-track",
      priority: "urgent",
      status: "in-progress",
      startDate: "2026-04-03",
      targetDate: "2026-05-15",
      createdAt: "2026-04-03T09:00:00.000Z",
      updatedAt: "2026-04-03T09:00:00.000Z",
    },
  ]
  data.documents = [
    {
      id: "document_alpha",
      kind: "team-document",
      workspaceId: "workspace_1",
      teamId: "team_alpha",
      title: "Alpha Runbook",
      content: "Operational runbook for the alpha platform",
      linkedProjectIds: ["project_alpha"],
      linkedWorkItemIds: [],
      createdBy: "user_current",
      updatedBy: "user_current",
      createdAt: "2026-04-01T09:00:00.000Z",
      updatedAt: "2026-04-01T09:00:00.000Z",
    },
    {
      id: "document_workspace",
      kind: "workspace-document",
      workspaceId: "workspace_1",
      teamId: null,
      title: "Launch Narrative",
      content: "Shared launch planning context",
      linkedProjectIds: ["project_workspace"],
      linkedWorkItemIds: [],
      createdBy: "user_current",
      updatedBy: "user_current",
      createdAt: "2026-04-02T09:00:00.000Z",
      updatedAt: "2026-04-02T09:00:00.000Z",
    },
    {
      id: "document_private",
      kind: "private-document",
      workspaceId: "workspace_1",
      teamId: null,
      title: "Private Notes",
      content: "My launch checklist",
      linkedProjectIds: [],
      linkedWorkItemIds: [],
      createdBy: "user_current",
      updatedBy: "user_current",
      createdAt: "2026-04-03T09:00:00.000Z",
      updatedAt: "2026-04-03T09:00:00.000Z",
    },
    {
      id: "document_private_other",
      kind: "private-document",
      workspaceId: "workspace_1",
      teamId: null,
      title: "Lead Private Notes",
      content: "Lead-only operating notes",
      linkedProjectIds: [],
      linkedWorkItemIds: [],
      createdBy: "user_lead",
      updatedBy: "user_lead",
      createdAt: "2026-04-03T10:00:00.000Z",
      updatedAt: "2026-04-03T10:00:00.000Z",
    },
    {
      id: "document_hidden",
      kind: "team-document",
      workspaceId: "workspace_1",
      teamId: "team_hidden",
      title: "Hidden Notes",
      content: "Not visible",
      linkedProjectIds: ["project_hidden"],
      linkedWorkItemIds: [],
      createdBy: "user_lead",
      updatedBy: "user_lead",
      createdAt: "2026-04-04T09:00:00.000Z",
      updatedAt: "2026-04-04T09:00:00.000Z",
    },
  ]
  data.workItems = [
    {
      id: "item_alpha",
      key: "ALPHA-12",
      teamId: "team_alpha",
      type: "feature",
      title: "Alpha search refresh",
      descriptionDocId: "document_alpha",
      status: "in-progress",
      priority: "high",
      assigneeId: "user_assignee",
      creatorId: "user_current",
      parentId: null,
      primaryProjectId: "project_alpha",
      linkedProjectIds: ["project_alpha"],
      linkedDocumentIds: ["document_alpha"],
      labelIds: [],
      milestoneId: null,
      startDate: "2026-04-04",
      dueDate: null,
      targetDate: null,
      subscriberIds: ["user_current"],
      createdAt: "2026-04-04T09:00:00.000Z",
      updatedAt: "2026-04-04T09:00:00.000Z",
    },
    {
      id: "item_beta",
      key: "BETA-7",
      teamId: "team_beta",
      type: "task",
      title: "Launch approvals",
      descriptionDocId: "document_workspace",
      status: "done",
      priority: "medium",
      assigneeId: "user_current",
      creatorId: "user_current",
      parentId: null,
      primaryProjectId: "project_workspace",
      linkedProjectIds: ["project_workspace"],
      linkedDocumentIds: ["document_workspace"],
      labelIds: [],
      milestoneId: null,
      startDate: "2026-04-05",
      dueDate: null,
      targetDate: null,
      subscriberIds: ["user_current"],
      createdAt: "2026-04-05T09:00:00.000Z",
      updatedAt: "2026-04-05T09:00:00.000Z",
    },
    {
      id: "item_hidden",
      key: "HID-1",
      teamId: "team_hidden",
      type: "issue",
      title: "Hidden production issue",
      descriptionDocId: "document_hidden",
      status: "todo",
      priority: "urgent",
      assigneeId: "user_lead",
      creatorId: "user_lead",
      parentId: null,
      primaryProjectId: "project_hidden",
      linkedProjectIds: ["project_hidden"],
      linkedDocumentIds: ["document_hidden"],
      labelIds: [],
      milestoneId: null,
      startDate: "2026-04-06",
      dueDate: null,
      targetDate: null,
      subscriberIds: ["user_lead"],
      createdAt: "2026-04-06T09:00:00.000Z",
      updatedAt: "2026-04-06T09:00:00.000Z",
    },
  ]

  return data
}

describe("workspace search read model", () => {
  it("caches a workspace-scoped search index per app snapshot", () => {
    const data = createSearchFixture()

    expect(getWorkspaceSearchIndex(data)).toBe(getWorkspaceSearchIndex(data))
  })

  it("keeps inaccessible team content out of the index", () => {
    const data = createSearchFixture()

    const hiddenIds = searchWorkspace(data, "hidden").map((result) => result.id)

    expect(hiddenIds).toEqual([])
  })

  it("only indexes private documents owned by the current user", () => {
    const data = createSearchFixture()

    expect(
      searchWorkspace(data, "lead-only").map((result) => result.id)
    ).toEqual([])
    expect(
      searchWorkspace(data, "checklist").map((result) => result.id)
    ).toEqual(["document-document_private"])
  })

  it("supports query syntax and explicit UI filters through one search contract", () => {
    const data = createSearchFixture()

    expect(searchWorkspace(data, "alpha").map((result) => result.id)).toEqual([
      "team-team_alpha",
      "project-project_alpha",
      "document-document_alpha",
      "item-item_alpha",
    ])

    expect(
      searchWorkspace(data, "team:beta").map((result) => result.id)
    ).toEqual(["team-team_beta", "item-item_beta"])

    expect(
      searchWorkspace(data, "kind:doc narrative").map((result) => result.id)
    ).toEqual(["document-document_workspace"])

    expect(
      searchWorkspace(data, "status:done").map((result) => result.id)
    ).toEqual(["item-item_beta"])

    expect(
      searchWorkspace(data, "", { kind: "project", teamId: "team_alpha" }).map(
        (result) => result.id
      )
    ).toEqual(["project-project_alpha"])

    expect(
      searchWorkspace(data, "", { status: "done" }).map((result) => result.id)
    ).toEqual(["item-item_beta"])

    expect(searchWorkspace(data, "", { limit: 2 })).toHaveLength(2)
  })
})

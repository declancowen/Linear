import { describe, expect, it } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  getViewContextLabel,
  getWorkspaceDirectoryViews,
} from "@/lib/domain/selectors"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type ViewDefinition,
} from "@/lib/domain/types"

function createView(overrides?: Partial<ViewDefinition>): ViewDefinition {
  return {
    id: "view_1",
    name: "All work",
    description: "",
    scopeType: "team",
    scopeId: "team_1",
    entityKind: "items",
    itemLevel: null,
    showChildItems: false,
    layout: "board",
    filters: {
      status: [],
      priority: [],
      assigneeIds: [],
      creatorIds: [],
      leadIds: [],
      health: [],
      milestoneIds: [],
      relationTypes: [],
      projectIds: [],
      itemTypes: [],
      labelIds: [],
      teamIds: [],
      showCompleted: true,
    },
    grouping: "status",
    subGrouping: null,
    ordering: "priority",
    displayProps: ["id", "status"],
    hiddenState: {
      groups: [],
      subgroups: [],
    },
    isShared: true,
    route: "/team/platform/work",
    createdAt: "2026-04-18T10:00:00.000Z",
    updatedAt: "2026-04-18T10:00:00.000Z",
    ...overrides,
  }
}

function createWorkspaceState() {
  const state = createEmptyState()

  state.currentUserId = "user_1"
  state.currentWorkspaceId = "workspace_1"
  state.workspaces = [
    {
      id: "workspace_1",
      slug: "acme",
      name: "Acme",
      logoUrl: "",
      logoImageUrl: null,
      createdBy: "user_1",
      workosOrganizationId: null,
      settings: {
        accent: "#000000",
        description: "",
      },
    },
  ]
  state.teams = [
    {
      id: "team_1",
      workspaceId: "workspace_1",
      slug: "platform",
      name: "Platform",
      icon: "rocket",
      settings: {
        joinCode: "JOIN1234",
        summary: "",
        guestProjectIds: [],
        guestDocumentIds: [],
        guestWorkItemIds: [],
        experience: "software-development",
        features: createDefaultTeamFeatureSettings("software-development"),
        workflow: createDefaultTeamWorkflowSettings("software-development"),
      },
    },
    {
      id: "team_2",
      workspaceId: "workspace_1",
      slug: "design",
      name: "Design",
      icon: "palette",
      settings: {
        joinCode: "JOIN5678",
        summary: "",
        guestProjectIds: [],
        guestDocumentIds: [],
        guestWorkItemIds: [],
        experience: "software-development",
        features: createDefaultTeamFeatureSettings("software-development"),
        workflow: createDefaultTeamWorkflowSettings("software-development"),
      },
    },
  ]
  state.teamMemberships = [
    {
      teamId: "team_1",
      userId: "user_1",
      role: "admin",
    },
  ]

  return state
}

describe("workspace view directory", () => {
  it("aggregates workspace and accessible team views without treating them as separate inventories", () => {
    const state = createWorkspaceState()

    state.views = [
      createView({
        id: "workspace-view",
        name: "Workspace roadmap",
        scopeType: "workspace",
        scopeId: "workspace_1",
        entityKind: "projects",
        route: "/workspace/projects",
      }),
      createView({
        id: "team-view",
        name: "Platform board",
        scopeType: "team",
        scopeId: "team_1",
        entityKind: "projects",
        route: "/team/platform/projects",
      }),
      createView({
        id: "legacy-view",
        name: "Legacy workspace board",
        scopeType: "personal",
        scopeId: "user_1",
        entityKind: "projects",
        isShared: false,
        route: "/workspace/projects",
      }),
      createView({
        id: "hidden-team-view",
        name: "Design board",
        scopeType: "team",
        scopeId: "team_2",
        entityKind: "projects",
        route: "/team/design/projects",
      }),
    ]

    expect(
      getWorkspaceDirectoryViews(state, "workspace_1", "projects")
        .map((view) => view.id)
        .sort()
    ).toEqual(["legacy-view", "team-view", "workspace-view"])
  })

  it("labels aggregated views by their real scope", () => {
    const state = createWorkspaceState()
    const workspaceView = createView({
      id: "workspace-view",
      scopeType: "workspace",
      scopeId: "workspace_1",
      route: "/workspace/projects",
    })
    const teamView = createView({
      id: "team-view",
      scopeType: "team",
      scopeId: "team_1",
      route: "/team/platform/work",
    })
    const legacyView = createView({
      id: "legacy-view",
      scopeType: "personal",
      scopeId: "user_1",
      isShared: false,
      route: "/workspace/docs",
    })

    expect(getViewContextLabel(state, workspaceView)).toBe("Acme")
    expect(getViewContextLabel(state, teamView)).toBe("Platform")
    expect(getViewContextLabel(state, legacyView)).toBe("Acme")
  })
})

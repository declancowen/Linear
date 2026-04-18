import { describe, expect, it } from "vitest"

import { createViewDefinition } from "@/lib/domain/default-views"
import { createEmptyState } from "@/lib/domain/empty-state"
import { getProjectDetailModel, getVisibleProjectsForView } from "@/lib/domain/selectors"
import type { Project, ViewDefinition } from "@/lib/domain/types"

function createProject(id: string, overrides?: Partial<Project>): Project {
  return {
    id,
    scopeType: "team",
    scopeId: "team_1",
    templateType: "software-delivery",
    name: `Project ${id}`,
    summary: "",
    description: "",
    leadId: "user_1",
    memberIds: [],
    health: "on-track",
    priority: "medium",
    status: "active",
    startDate: null,
    targetDate: null,
    createdAt: "2026-04-18T09:00:00.000Z",
    updatedAt: "2026-04-18T10:00:00.000Z",
    ...overrides,
  }
}

function createProjectView(
  overrides?: Partial<ViewDefinition>
): ViewDefinition {
  return {
    id: "view_1",
    name: "All projects",
    description: "",
    scopeType: "team",
    scopeId: "team_1",
    entityKind: "projects",
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
    displayProps: ["id", "status", "priority", "updated"],
    hiddenState: {
      groups: [],
      subgroups: [],
    },
    isShared: true,
    route: "/team/platform/projects",
    createdAt: "2026-04-18T09:00:00.000Z",
    updatedAt: "2026-04-18T10:00:00.000Z",
    ...overrides,
  }
}

describe("project views", () => {
  it("filters projects using project-relevant view fields", () => {
    const state = createEmptyState()
    const projects = [
      createProject("launch", {
        priority: "high",
        leadId: "user_1",
        health: "on-track",
      }),
      createProject("migration", {
        priority: "low",
        leadId: "user_2",
        health: "at-risk",
      }),
      createProject("cleanup", {
        priority: "high",
        leadId: "user_1",
        health: "off-track",
      }),
    ]

    expect(
      getVisibleProjectsForView(
        state,
        projects,
        createProjectView({
          filters: {
            ...createProjectView().filters,
            priority: ["high"],
            leadIds: ["user_1"],
            health: ["on-track"],
          },
        })
      ).map((project) => project.id)
    ).toEqual(["launch"])
  })

  it("hides completed projects when the view excludes completed work", () => {
    const state = createEmptyState()
    const projects = [
      createProject("active", { status: "active" }),
      createProject("completed", { status: "completed" }),
    ]

    expect(
      getVisibleProjectsForView(
        state,
        projects,
        createProjectView({
          filters: {
            ...createProjectView().filters,
            showCompleted: false,
          },
        })
      ).map((project) => project.id)
    ).toEqual(["active"])
  })

  it("orders visible projects using the active view ordering", () => {
    const state = createEmptyState()
    const projects = [
      createProject("older", {
        name: "Older",
        updatedAt: "2026-04-18T09:00:00.000Z",
      }),
      createProject("newer", {
        name: "Newer",
        updatedAt: "2026-04-18T11:00:00.000Z",
      }),
      createProject("middle", {
        name: "Middle",
        updatedAt: "2026-04-18T10:00:00.000Z",
      }),
    ]

    expect(
      getVisibleProjectsForView(
        state,
        projects,
        createProjectView({
          ordering: "updatedAt",
        })
      ).map((project) => project.id)
    ).toEqual(["newer", "middle", "older"])
  })

  it("allows explicit fallback item views for project detail routes", () => {
    const view = createViewDefinition({
      id: "project-items-fallback",
      name: "All items",
      description: "All items linked to this project.",
      scopeType: "team",
      scopeId: "team_1",
      entityKind: "items",
      route: "/team/platform/projects/project_1",
      teamSlug: "platform",
      experience: "software-development",
      isShared: false,
      createdAt: "2026-04-18T09:00:00.000Z",
    })

    expect(view).toMatchObject({
      id: "project-items-fallback",
      name: "All items",
      route: "/team/platform/projects/project_1",
      entityKind: "items",
      scopeType: "team",
      scopeId: "team_1",
      isShared: false,
    })
    expect(view?.itemLevel).toBe("epic")
  })

  it("uses the project detail route for project item views", () => {
    const state = createEmptyState()
    state.projects = [
      createProject("launch", {
        scopeType: "team",
        scopeId: "team_1",
      }),
    ]
    state.teams = [
      {
        id: "team_1",
        workspaceId: "workspace_1",
        slug: "platform",
        name: "Platform",
        icon: "code",
        settings: {
          joinCode: "JOIN1234",
          summary: "",
          guestProjectIds: [],
          guestDocumentIds: [],
          guestWorkItemIds: [],
          experience: "software-development",
          features: {
            issues: true,
            projects: true,
            views: true,
            docs: true,
            chat: false,
            channels: false,
          },
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
                defaultPriority: "high",
                targetWindowDays: 28,
                defaultViewLayout: "board",
                recommendedItemTypes: [
                  "epic",
                  "feature",
                  "requirement",
                  "story",
                ],
                summaryHint: "",
              },
              "bug-tracking": {
                defaultPriority: "high",
                targetWindowDays: 14,
                defaultViewLayout: "list",
                recommendedItemTypes: ["issue", "sub-issue"],
                summaryHint: "",
              },
              "project-management": {
                defaultPriority: "medium",
                targetWindowDays: 35,
                defaultViewLayout: "timeline",
                recommendedItemTypes: ["task", "sub-task"],
                summaryHint: "",
              },
            },
          },
        },
      },
    ]

    expect(getProjectDetailModel(state, "launch")).toMatchObject({
      backHref: "/team/platform/projects",
      detailHref: "/team/platform/projects/launch",
    })
  })
})

import { describe, expect, it } from "vitest"

import { createViewDefinition } from "@/lib/domain/default-views"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  getProjectDetailModel,
  getProjectProgress,
  getVisibleProjectsForView,
} from "@/lib/domain/selectors"
import {
  createDefaultProjectPresentationConfig,
  getDefaultViewItemLevelForProjectTemplate,
  getDefaultViewItemLevelForTeamExperience,
  type Project,
  type ViewDefinition,
} from "@/lib/domain/types"
import { createTestTeam } from "@/tests/lib/fixtures/app-data"

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
    status: "in-progress",
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

function createProjectItemsViewFromPresentation(input: {
  defaultItemLevelExperience?: Parameters<
    typeof createViewDefinition
  >[0]["defaultItemLevelExperience"]
  effectiveItemLevel: ViewDefinition["itemLevel"] | undefined
  presentation: ReturnType<typeof createDefaultProjectPresentationConfig>
  route: string
  scopeId: string
  scopeType: "team" | "workspace"
  teamSlug?: string
}) {
  return createViewDefinition({
    id: `${input.scopeType}-project-items-default`,
    name: "All items",
    description: "All items linked to this project.",
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    entityKind: "items",
    route: input.route,
    teamSlug: input.teamSlug,
    defaultItemLevelExperience: input.defaultItemLevelExperience,
    isShared: false,
    createdAt: "2026-04-18T09:00:00.000Z",
    overrides: {
      layout: input.presentation.layout,
      filters: input.presentation.filters,
      grouping: input.presentation.grouping,
      subGrouping: null,
      ordering: input.presentation.ordering,
      ...(input.effectiveItemLevel !== undefined
        ? { itemLevel: input.effectiveItemLevel }
        : {}),
      showChildItems: input.presentation.showChildItems ?? false,
      displayProps: input.presentation.displayProps,
      hiddenState: {
        groups: [],
        subgroups: [],
      },
    },
  })
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

  it("filters projects by status when the view selects specific statuses", () => {
    const state = createEmptyState()
    const projects = [
      createProject("backlog", { status: "backlog" }),
      createProject("active", { status: "in-progress" }),
      createProject("done", { status: "completed" }),
    ]

    expect(
      getVisibleProjectsForView(
        state,
        projects,
        createProjectView({
          filters: {
            ...createProjectView().filters,
            status: [
              "in-progress",
              "completed",
            ] as ViewDefinition["filters"]["status"],
          },
        })
      ).map((project) => project.id)
    ).toEqual(["active", "done"])
  })

  it("hides completed projects when the view excludes completed work", () => {
    const state = createEmptyState()
    const projects = [
      createProject("active", { status: "in-progress" }),
      createProject("completed", { status: "completed" }),
      createProject("cancelled", { status: "cancelled" }),
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

  it("reports completed and active project progress separately", () => {
    const state = createEmptyState()
    state.workItems = [
      {
        id: "item_done",
        key: "PLA-1",
        teamId: "team_1",
        type: "task",
        title: "Done item",
        descriptionDocId: "",
        status: "done",
        priority: "medium",
        assigneeId: null,
        creatorId: "user_1",
        parentId: null,
        primaryProjectId: "project_1",
        linkedProjectIds: [],
        linkedDocumentIds: [],
        labelIds: [],
        milestoneId: null,
        startDate: null,
        dueDate: null,
        targetDate: null,
        subscriberIds: [],
        createdAt: "2026-04-18T09:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
      },
      {
        id: "item_active",
        key: "PLA-2",
        teamId: "team_1",
        type: "task",
        title: "Active item",
        descriptionDocId: "",
        status: "in-progress",
        priority: "medium",
        assigneeId: null,
        creatorId: "user_1",
        parentId: null,
        primaryProjectId: "project_1",
        linkedProjectIds: [],
        linkedDocumentIds: [],
        labelIds: [],
        milestoneId: null,
        startDate: null,
        dueDate: null,
        targetDate: null,
        subscriberIds: [],
        createdAt: "2026-04-18T09:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
      },
      {
        id: "item_backlog",
        key: "PLA-3",
        teamId: "team_1",
        type: "task",
        title: "Backlog item",
        descriptionDocId: "",
        status: "backlog",
        priority: "medium",
        assigneeId: null,
        creatorId: "user_1",
        parentId: null,
        primaryProjectId: "project_1",
        linkedProjectIds: [],
        linkedDocumentIds: [],
        labelIds: [],
        milestoneId: null,
        startDate: null,
        dueDate: null,
        targetDate: null,
        subscriberIds: [],
        createdAt: "2026-04-18T09:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
      },
    ]

    expect(getProjectProgress(state, "project_1")).toMatchObject({
      scope: 3,
      completed: 1,
      inProgress: 1,
      completedPercent: 33,
      activePercent: 67,
      inProgressOnlyPercent: 34,
    })
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
      defaultItemLevelExperience: "software-development",
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

  it("keeps the team-default item level when project presentation omits it", () => {
    const presentation =
      createDefaultProjectPresentationConfig("software-delivery")
    const effectiveItemLevel =
      presentation.itemLevel === undefined
        ? getDefaultViewItemLevelForTeamExperience("software-development")
        : presentation.itemLevel
    const view = createProjectItemsViewFromPresentation({
      defaultItemLevelExperience: "software-development",
      teamSlug: "platform",
      effectiveItemLevel,
      presentation,
      route: "/team/platform/projects/project_1",
      scopeId: "team_1",
      scopeType: "team",
    })

    expect(presentation.itemLevel).toBeUndefined()
    expect(view?.itemLevel).toBe("epic")
  })

  it("falls back to the project template level for workspace-scoped project detail views", () => {
    const presentation =
      createDefaultProjectPresentationConfig("project-management")
    const effectiveItemLevel =
      presentation.itemLevel === undefined
        ? getDefaultViewItemLevelForProjectTemplate("project-management")
        : presentation.itemLevel
    const view = createProjectItemsViewFromPresentation({
      effectiveItemLevel,
      presentation,
      route: "/workspace/projects/project_1",
      scopeId: "workspace_1",
      scopeType: "workspace",
    })

    expect(presentation.itemLevel).toBeUndefined()
    expect(view?.itemLevel).toBe("task")
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
      createTestTeam({
        icon: "code",
        settings: {
          summary: "",
        },
      }),
    ]

    expect(getProjectDetailModel(state, "launch")).toMatchObject({
      backHref: "/team/platform/projects",
      detailHref: "/team/platform/projects/launch",
    })
  })
})

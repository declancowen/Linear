import { describe, expect, it } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  EMPTY_PARENT_FILTER_VALUE,
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type ViewDefinition,
  type WorkItem,
} from "@/lib/domain/types"
import {
  buildItemGroupsWithEmptyGroups,
  getDirectChildWorkItemsForDisplay,
  getVisibleWorkItems,
  getViewsForScope,
  getVisibleItemsForView,
} from "@/lib/domain/selectors"

function createItem(id: string, overrides?: Partial<WorkItem>): WorkItem {
  return {
    id,
    key: `ITEM-${id}`,
    teamId: "team_1",
    type: "story",
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
    createdAt: "2026-04-18T10:00:00.000Z",
    updatedAt: "2026-04-18T10:00:00.000Z",
    ...overrides,
  }
}

function createView(overrides?: Partial<ViewDefinition>): ViewDefinition {
  return {
    id: "view_1",
    name: "All work",
    description: "",
    scopeType: "team",
    scopeId: "team_1",
    entityKind: "items",
    itemLevel: null,
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
      parentIds: [],
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

describe("view item levels", () => {
  it("filters visible items to the configured item level", () => {
    const state = createEmptyState()
    const items = [
      createItem("epic", { type: "epic" }),
      createItem("feature", { type: "feature", parentId: "epic" }),
      createItem("requirement", {
        type: "requirement",
        parentId: "feature",
      }),
    ]

    expect(
      getVisibleItemsForView(
        state,
        items,
        createView({
          itemLevel: "feature",
        })
      ).map((item) => item.id)
    ).toEqual(["feature"])
  })

  it("filters item levels to entries with an empty under value", () => {
    const state = createEmptyState()
    const items = [
      createItem("feature-root", { type: "feature" }),
      createItem("feature-child", { type: "feature", parentId: "epic_1" }),
    ]

    expect(
      getVisibleItemsForView(
        state,
        items,
        createView({
          itemLevel: "feature",
          filters: {
            ...createView().filters,
            parentIds: [EMPTY_PARENT_FILTER_VALUE],
          },
        })
      ).map((item) => item.id)
    ).toEqual(["feature-root"])
  })

  it("does not synthesize empty groups when filtering for empty under values", () => {
    const state = createEmptyState()
    const filteredItems = [createItem("root-todo", { status: "todo" })]

    expect([
      ...buildItemGroupsWithEmptyGroups(
        state,
        filteredItems,
        createView({
          grouping: "status",
          filters: {
            ...createView().filters,
            parentIds: [EMPTY_PARENT_FILTER_VALUE],
          },
        })
      ).keys(),
    ]).toEqual(["todo"])
  })

  it("does not synthesize filtered-out status groups when status filters are active", () => {
    const state = createEmptyState()
    const filteredItems = [createItem("todo-only", { status: "todo" })]

    expect([
      ...buildItemGroupsWithEmptyGroups(
        state,
        filteredItems,
        createView({
          grouping: "status",
          filters: {
            ...createView().filters,
            status: ["todo"],
          },
        })
      ).keys(),
    ]).toEqual(["todo"])
  })

  it("does not synthesize filtered-out type groups when type filters are active", () => {
    const state = createEmptyState()
    const filteredItems = [createItem("task-only", { type: "task" })]

    expect([
      ...buildItemGroupsWithEmptyGroups(
        state,
        filteredItems,
        createView({
          grouping: "type",
          filters: {
            ...createView().filters,
            itemTypes: ["task"],
          },
        })
      ).keys(),
    ]).toEqual(["task"])
  })

  it("synthesizes empty type groups from the active project template context", () => {
    const state = {
      ...createEmptyState(),
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "ops",
          name: "Ops",
          icon: "kanban" as const,
          settings: {
            joinCode: "JOIN1234",
            summary: "",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "project-management" as const,
            features: createDefaultTeamFeatureSettings("project-management"),
            workflow: createDefaultTeamWorkflowSettings("project-management"),
          },
        },
      ],
      projects: [
        {
          id: "project_1",
          scopeType: "team" as const,
          scopeId: "team_1",
          templateType: "project-management" as const,
          name: "Launch plan",
          summary: "",
          description: "",
          leadId: "user_1",
          memberIds: [],
          health: "on-track" as const,
          priority: "medium" as const,
          status: "in-progress" as const,
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
      ],
    }

    expect([
      ...buildItemGroupsWithEmptyGroups(
        state,
        [],
        createView({
          grouping: "type",
        }),
        {
          teamId: "team_1",
          projectId: "project_1",
        }
      ).keys(),
    ]).toEqual(["task", "sub-task"])
  })

  it("does not force timeline views back to top-level items when a level is set", () => {
    const state = createEmptyState()
    const items = [
      createItem("epic", { type: "epic" }),
      createItem("feature", { type: "feature", parentId: "epic" }),
    ]

    expect(
      getVisibleItemsForView(
        state,
        items,
        createView({
          layout: "timeline",
          itemLevel: "feature",
        })
      ).map((item) => item.id)
    ).toEqual(["feature"])

    expect(
      getVisibleItemsForView(
        state,
        items,
        createView({
          layout: "timeline",
          itemLevel: null,
        })
      ).map((item) => item.id)
    ).toEqual(["epic"])
  })

  it("returns only the next direct child level for display under a parent", () => {
    const state = createEmptyState()
    const parent = createItem("feature", { type: "feature" })
    const directChildren = [
      createItem("requirement-high", {
        type: "requirement",
        parentId: parent.id,
        priority: "high",
      }),
      createItem("requirement-low", {
        type: "requirement",
        parentId: parent.id,
        priority: "low",
      }),
    ]

    state.workItems = [
      parent,
      ...directChildren,
      createItem("story", {
        type: "story",
        parentId: "requirement-high",
      }),
    ]

    expect(
      getDirectChildWorkItemsForDisplay(state, parent, "priority").map(
        (item) => item.id
      )
    ).toEqual(["requirement-high", "requirement-low"])
  })

  it("applies active view filters to direct child disclosure rows without reapplying the parent level filter", () => {
    const state = createEmptyState()
    const parent = createItem("task-parent", { type: "task" })
    const view = createView({
      itemLevel: "task",
      filters: {
        ...createView().filters,
        showCompleted: false,
        assigneeIds: ["user_1"],
      },
    })

    state.workItems = [
      parent,
      createItem("subtask-visible", {
        type: "sub-task",
        parentId: parent.id,
        assigneeId: "user_1",
        status: "todo",
      }),
      createItem("subtask-hidden-complete", {
        type: "sub-task",
        parentId: parent.id,
        assigneeId: "user_1",
        status: "done",
      }),
      createItem("subtask-hidden-assignee", {
        type: "sub-task",
        parentId: parent.id,
        assigneeId: "user_2",
        status: "todo",
      }),
    ]

    expect(
      getDirectChildWorkItemsForDisplay(state, parent, "priority", view).map(
        (item) => item.id
      )
    ).toEqual(["subtask-visible"])
  })

  it("scopes direct child disclosure to the caller-provided item set", () => {
    const state = createEmptyState()
    const parent = createItem("feature-parent", {
      type: "feature",
      primaryProjectId: "project_1",
    })
    const scopedChild = createItem("requirement-scoped", {
      type: "requirement",
      parentId: parent.id,
      primaryProjectId: "project_1",
    })
    const unscopedChild = createItem("requirement-unscoped", {
      type: "requirement",
      parentId: parent.id,
      primaryProjectId: "project_2",
    })

    state.workItems = [parent, scopedChild, unscopedChild]

    expect(
      getDirectChildWorkItemsForDisplay(
        state,
        parent,
        "priority",
        createView({
          itemLevel: "feature",
        }),
        [parent, scopedChild]
      ).map((item) => item.id)
    ).toEqual(["requirement-scoped"])
  })

  it("includes ancestor context for current-user work without pulling in unrelated items", () => {
    const state = createEmptyState()
    state.currentUserId = "user_1"
    state.currentWorkspaceId = "workspace_1"
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
    ]
    state.teamMemberships = [
      {
        teamId: "team_1",
        userId: "user_1",
        role: "member",
      },
    ]
    state.workItems = [
      createItem("epic", { type: "epic" }),
      createItem("feature", { type: "feature", parentId: "epic" }),
      createItem("story", {
        type: "story",
        parentId: "feature",
        assigneeId: "user_1",
      }),
      createItem("unrelated", {
        type: "task",
        assigneeId: "user_2",
      }),
    ]

    expect(
      getVisibleWorkItems(state, {
        assignedToCurrentUserWithAncestors: true,
      }).map((item) => item.id)
    ).toEqual(["epic", "feature", "story"])
  })

  it("returns the lowest assigned descendants when compressing personal work hierarchies", () => {
    const state = createEmptyState()
    state.currentUserId = "user_1"
    const epic = createItem("epic", { type: "epic" })
    const feature = createItem("feature", {
      type: "feature",
      parentId: epic.id,
      assigneeId: "user_1",
    })
    const requirement = createItem("requirement", {
      type: "requirement",
      parentId: feature.id,
    })
    const story = createItem("story", {
      type: "story",
      parentId: requirement.id,
      assigneeId: "user_1",
    })

    state.workItems = [epic, feature, requirement, story]

    expect(
      getDirectChildWorkItemsForDisplay(
        state,
        epic,
        "priority",
        createView({
          itemLevel: "epic",
          showChildItems: true,
        }),
        state.workItems,
        {
          mode: "assigned-descendants",
        }
      ).map((item) => item.id)
    ).toEqual(["story"])
  })

  it("matches assigned descendant filters against assigned items while rendering the parent level", () => {
    const state = createEmptyState()
    const epic = createItem("epic", {
      type: "epic",
      status: "backlog",
    })
    const feature = createItem("feature", {
      type: "feature",
      parentId: epic.id,
      status: "backlog",
    })
    const story = createItem("story", {
      type: "story",
      parentId: feature.id,
      assigneeId: "user_1",
      status: "in-progress",
    })

    expect(
      getVisibleItemsForView(
        state,
        [epic, feature, story],
        createView({
          itemLevel: "epic",
          filters: {
            ...createView().filters,
            status: ["todo", "in-progress"],
          },
        }),
        {
          matchItems: [story],
          childDisplayMode: "assigned-descendants",
        }
      ).map((item) => item.id)
    ).toEqual(["epic"])
  })

  it("includes workspace-scoped views when listing workspace views", () => {
    const state = createEmptyState()
    state.currentWorkspaceId = "workspace_1"
    state.currentUserId = "user_1"
    state.views = [
      createView({
        id: "workspace-view",
        name: "Workspace projects",
        scopeType: "workspace",
        scopeId: "workspace_1",
        entityKind: "projects",
      }),
      createView({
        id: "legacy-view",
        name: "Legacy projects",
        scopeType: "personal",
        scopeId: "user_1",
        entityKind: "projects",
        route: "/workspace/projects",
      }),
    ]

    expect(
      getViewsForScope(state, "workspace", "workspace_1", "projects").map(
        (view) => view.id
      )
    ).toEqual(["legacy-view", "workspace-view"])
  })
})

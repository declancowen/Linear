import { describe, expect, it } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  getDirectChildWorkItemsForDisplay,
  getViewsForScope,
  getVisibleItemsForView,
} from "@/lib/domain/selectors"
import type { ViewDefinition, WorkItem } from "@/lib/domain/types"

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

import { describe, expect, it } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import { getWorkItemChildProgress } from "@/lib/domain/selectors"
import type { WorkItem } from "@/lib/domain/types"

function createWorkItem(id: string, overrides?: Partial<WorkItem>) {
  return {
    ...buildBaseItem(id),
    ...overrides,
  }
}

function buildBaseItem(id: string): WorkItem {
  return {
    id,
    key: `ITEM-${id}`,
    teamId: "team_1",
    type: "task" as const,
    title: `Item ${id}`,
    descriptionDocId: `doc_${id}`,
    status: "todo" as const,
    priority: "medium" as const,
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
  }
}

describe("work item child progress", () => {
  it("rolls up only first-level children and excludes cancelled and duplicate", () => {
    const state = createEmptyState()

    state.workItems = [
      createWorkItem("parent", { type: "epic" }),
      createWorkItem("done", {
        parentId: "parent",
        type: "feature",
        status: "done",
      }),
      createWorkItem("in-progress", {
        parentId: "parent",
        type: "feature",
        status: "in-progress",
      }),
      createWorkItem("cancelled", {
        parentId: "parent",
        type: "feature",
        status: "cancelled",
      }),
      createWorkItem("duplicate", {
        parentId: "parent",
        type: "feature",
        status: "duplicate",
      }),
      createWorkItem("grandchild-done", {
        parentId: "in-progress",
        type: "requirement",
        status: "done",
      }),
    ]

    expect(getWorkItemChildProgress(state, "parent")).toEqual({
      totalChildren: 4,
      includedChildren: 2,
      completedChildren: 1,
      excludedChildren: 2,
      percent: 50,
    })
  })

  it("returns zero progress when a parent only has excluded children", () => {
    const state = createEmptyState()

    state.workItems = [
      createWorkItem("parent"),
      createWorkItem("cancelled", {
        parentId: "parent",
        status: "cancelled",
      }),
      createWorkItem("duplicate", {
        parentId: "parent",
        status: "duplicate",
      }),
    ]

    expect(getWorkItemChildProgress(state, "parent")).toEqual({
      totalChildren: 2,
      includedChildren: 0,
      completedChildren: 0,
      excludedChildren: 2,
      percent: 0,
    })
  })
})

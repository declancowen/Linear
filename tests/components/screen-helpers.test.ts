import { describe, expect, it } from "vitest"

import {
  getContainerItemsForDisplay,
  isPersistedViewFilterKey,
} from "@/components/app/screens/helpers"
import type { WorkItem } from "@/lib/domain/types"

function createItem(
  id: string,
  overrides?: Partial<WorkItem>
): WorkItem {
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
    subscriberIds: [],
    createdAt: "2026-04-18T10:00:00.000Z",
    updatedAt: "2026-04-18T10:00:00.000Z",
    ...overrides,
  }
}

describe("screen helpers", () => {
  it("treats all persisted view filter keys as persistable", () => {
    expect(isPersistedViewFilterKey("status")).toBe(true)
    expect(isPersistedViewFilterKey("priority")).toBe(true)
    expect(isPersistedViewFilterKey("assigneeIds")).toBe(true)
    expect(isPersistedViewFilterKey("creatorIds")).toBe(true)
    expect(isPersistedViewFilterKey("leadIds")).toBe(true)
    expect(isPersistedViewFilterKey("health")).toBe(true)
    expect(isPersistedViewFilterKey("milestoneIds")).toBe(true)
    expect(isPersistedViewFilterKey("relationTypes")).toBe(true)
    expect(isPersistedViewFilterKey("projectIds")).toBe(true)
    expect(isPersistedViewFilterKey("parentIds")).toBe(true)
    expect(isPersistedViewFilterKey("itemTypes")).toBe(true)
    expect(isPersistedViewFilterKey("labelIds")).toBe(true)
    expect(isPersistedViewFilterKey("teamIds")).toBe(true)
  })

  it("collapses subgroup child containers against the full visible item set", () => {
    const parent = createItem("parent", {
      type: "feature",
      status: "todo",
    })
    const child = createItem("child", {
      type: "requirement",
      parentId: parent.id,
      status: "in-progress",
    })

    expect(getContainerItemsForDisplay([child], [parent, child], true)).toEqual(
      []
    )
    expect(getContainerItemsForDisplay([child], [child], true)).toEqual([child])
  })
})

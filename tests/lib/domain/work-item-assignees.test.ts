import { describe, expect, it } from "vitest"

import {
  getWorkItemAssigneeFields,
  getWorkItemAssigneeIds,
} from "@/lib/domain/work-item-assignees"

describe("work item assignee helpers", () => {
  it("treats explicit assigneeIds as authoritative over the single assignee projection", () => {
    expect(
      getWorkItemAssigneeIds({
        assigneeId: "user_1",
        assigneeIds: [],
      })
    ).toEqual([])
    expect(
      getWorkItemAssigneeIds({
        assigneeId: "user_1",
        assigneeIds: ["user_2"],
      })
    ).toEqual(["user_2"])
  })

  it("normalizes assignee fields and keeps the primary projection in sync", () => {
    expect(getWorkItemAssigneeFields(["user_2", "user_1", "user_2"])).toEqual({
      assigneeId: "user_2",
      assigneeIds: ["user_2", "user_1"],
    })
  })
})

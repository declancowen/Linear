import { describe, expect, it } from "vitest"

import { isProjectAvailableGroupKey } from "@/lib/domain/selectors-internal/work-item-grouping"
import { compareOptionalDescendingValues } from "@/lib/domain/selectors-internal/work-item-ordering"

describe("work item selector helpers", () => {
  it("sorts optional values descending with empty values last", () => {
    expect(compareOptionalDescendingValues(null, undefined)).toBe(0)
    expect(compareOptionalDescendingValues(null, "2026-05-01")).toBe(1)
    expect(compareOptionalDescendingValues("2026-05-01", null)).toBe(-1)
    expect(
      compareOptionalDescendingValues("2026-05-02", "2026-05-01")
    ).toBeLessThan(0)
  })

  it("matches available project group keys by owning team or workspace scope", () => {
    const context = {
      teamIds: new Set(["team_1"]),
      workspaceIds: new Set(["workspace_1"]),
    }

    expect(
      isProjectAvailableGroupKey(
        {
          scopeType: "team",
          scopeId: "team_1",
        },
        context
      )
    ).toBe(true)
    expect(
      isProjectAvailableGroupKey(
        {
          scopeType: "workspace",
          scopeId: "workspace_1",
        },
        context
      )
    ).toBe(true)
    expect(
      isProjectAvailableGroupKey(
        {
          scopeType: "team",
          scopeId: "team_2",
        },
        context
      )
    ).toBe(false)
  })
})

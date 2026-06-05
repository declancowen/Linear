import { describe, expect, it } from "vitest"

import { createViewDefinition } from "@/lib/domain/default-views"
import { createEmptyState } from "@/lib/domain/empty-state"
import { buildItemGroupsWithEmptyGroups } from "@/lib/domain/selectors"
import {
  createDefaultProjectPresentationConfig,
  createDefaultViewFilters,
  projectSchema,
  viewConfigPatchSchema,
  viewSchema,
  type ViewDefinition,
} from "@/lib/domain/types"
import { createTestWorkItem } from "@/tests/lib/fixtures/app-data"

describe("view config contract", () => {
  it("represents no primary grouping as null across domain and schemas", () => {
    const view = createViewDefinition({
      id: "view_no_grouping",
      name: "No grouping",
      description: "",
      scopeType: "team",
      scopeId: "team_1",
      entityKind: "items",
      route: "/team/platform/work",
      teamSlug: "platform",
      createdAt: "2026-06-05T10:00:00.000Z",
      overrides: {
        grouping: null,
        subGrouping: null,
      },
    })

    expect(view?.grouping).toBeNull()
    expect(viewConfigPatchSchema.parse({ grouping: null })).toEqual({
      grouping: null,
    })
    expect(viewSchema.parse(view).grouping).toBeNull()
  })

  it("allows project presentation config to persist no primary grouping", () => {
    const presentation = {
      ...createDefaultProjectPresentationConfig("software-delivery"),
      grouping: null,
    }

    const result = projectSchema.safeParse({
      id: "project_1",
      scopeType: "team",
      scopeId: "team_1",
      templateType: "software-delivery",
      name: "Launch",
      summary: "",
      description: "",
      leadId: "user_1",
      memberIds: [],
      health: "on-track",
      priority: "medium",
      status: "in-progress",
      startDate: null,
      targetDate: null,
      createdAt: "2026-06-05T10:00:00.000Z",
      updatedAt: "2026-06-05T10:00:00.000Z",
      presentation,
    })

    expect(result.success).toBe(true)
    expect(result.data?.presentation?.grouping).toBeNull()
  })

  it("does not synthesize status or parent lanes for no-grouping item groups", () => {
    const state = createEmptyState()
    const items = [
      createTestWorkItem("todo", { status: "todo" }),
      createTestWorkItem("done", { status: "done" }),
    ]
    const view: ViewDefinition = {
      id: "view_no_grouping",
      name: "No grouping",
      description: "",
      scopeType: "team" as const,
      scopeId: "team_1",
      entityKind: "items" as const,
      itemLevel: null,
      showChildItems: false,
      layout: "board" as const,
      filters: createDefaultViewFilters(),
      grouping: null,
      subGrouping: null,
      ordering: "priority" as const,
      displayProps: ["id", "status"],
      hiddenState: {
        groups: [],
        subgroups: [],
      },
      isShared: true,
      route: "/team/platform/work",
      createdAt: "2026-06-05T10:00:00.000Z",
      updatedAt: "2026-06-05T10:00:00.000Z",
    }

    expect([
      ...buildItemGroupsWithEmptyGroups(state, items, view).keys(),
    ]).toEqual(["all"])
  })
})

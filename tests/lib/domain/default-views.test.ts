import { describe, expect, it } from "vitest"

import {
  createViewDefinition,
  isSystemView,
} from "@/lib/domain/default-views"

describe("isSystemView", () => {
  it("treats canonical built-in ids as system views", () => {
    expect(
      isSystemView({
        id: "view_team_1_all_items",
        entityKind: "items",
      })
    ).toBe(true)

    expect(
      isSystemView({
        id: "view_workspace_1_all_projects",
        entityKind: "projects",
      })
    ).toBe(true)
  })

  it("does not classify custom views by label alone", () => {
    expect(
      isSystemView({
        id: "view_custom_1",
        entityKind: "items",
      })
    ).toBe(false)

    expect(
      isSystemView({
        id: "view_custom_2",
        entityKind: "projects",
      })
    ).toBe(false)
  })
})

describe("createViewDefinition", () => {
  it("deep-clones parentIds in override filters", () => {
    const parentIds = ["parent_1"]
    const view = createViewDefinition({
      id: "view_1",
      name: "Child items",
      description: "",
      scopeType: "team",
      scopeId: "team_1",
      entityKind: "items",
      route: "/team/platform/work",
      teamSlug: "platform",
      experience: "software-development",
      createdAt: "2026-04-20T00:00:00.000Z",
      overrides: {
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
          parentIds,
          itemTypes: [],
          labelIds: [],
          teamIds: [],
          showCompleted: true,
        },
      },
    })

    if (!view) {
      throw new Error("Expected view definition")
    }

    parentIds.push("parent_2")

    expect(view.filters.parentIds).toEqual(["parent_1"])
  })
})

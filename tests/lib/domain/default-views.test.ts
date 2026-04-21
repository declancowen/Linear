import { describe, expect, it } from "vitest"

import {
  buildAssignedWorkViews,
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
  it("supports personal assigned item routes", () => {
    const view = createViewDefinition({
      id: "view_assigned_all_items",
      name: "All work",
      description: "",
      scopeType: "personal",
      scopeId: "user_1",
      entityKind: "items",
      experience: "software-development",
      createdAt: "2026-04-20T00:00:00.000Z",
    })

    expect(view).toMatchObject({
      route: "/assigned",
      scopeType: "personal",
      itemLevel: "epic",
      showChildItems: true,
    })
  })

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

describe("buildAssignedWorkViews", () => {
  it("builds the default my items tabs", () => {
    const views = buildAssignedWorkViews({
      userId: "user_1",
      createdAt: "2026-04-20T00:00:00.000Z",
      experience: "project-management",
    })

    expect(views.map((view) => view.name)).toEqual([
      "All tasks",
      "Active",
      "Backlog",
    ])
    expect(views.every((view) => view.route === "/assigned")).toBe(true)
    expect(views.every((view) => view.scopeType === "personal")).toBe(true)
  })
})

import { describe, expect, it } from "vitest"

import {
  buildAssignedWorkViews,
  buildTeamDocumentViews,
  buildTeamProjectViews,
  buildWorkspaceDocumentViews,
  buildWorkspaceProjectViews,
  createViewDefinition,
  getCanonicalAllCollectionIcon,
  getDefaultRouteForViewContext,
  getSharedTeamExperience,
  getSystemViewEditCapability,
  getViewIconName,
  isRouteAllowedForViewContext,
  isSystemView,
} from "@/lib/domain/default-views"

describe("getViewIconName", () => {
  it("uses one canonical icon per All collection label", () => {
    expect(getCanonicalAllCollectionIcon("items")).toBe("ListBullets")
    expect(getCanonicalAllCollectionIcon("projects")).toBe("Kanban")
    expect(getCanonicalAllCollectionIcon("docs")).toBe("FileText")
    expect(getCanonicalAllCollectionIcon("views")).toBe("SquaresFour")
  })

  it("returns distinct default icons for built-in views", () => {
    const icon = (id: string, entityKind: "items" | "projects" | "docs") =>
      getViewIconName({ id, entityKind, icon: null })

    expect(icon("view_assigned_private_tasks", "items")).toBe("LockSimple")
    expect(icon("view_assigned_subscribed_items", "items")).toBe("Bell")
    expect(icon("view_team_1_active_items", "items")).toBe("Lightning")
    expect(icon("view_team_1_backlog_items", "items")).toBe("ClipboardText")
    expect(icon("view_team_1_all_items", "items")).toBe("ListBullets")
    expect(icon("view_workspace_1_all_projects", "projects")).toBe("Kanban")
    expect(icon("view_workspace_1_private_docs", "docs")).toBe("LockSimple")
    expect(icon("view_team_1_team_docs", "docs")).toBe("FileText")
  })

  it("prefers the chosen icon for custom views", () => {
    expect(
      getViewIconName({
        id: "view_custom_1",
        entityKind: "items",
        icon: "Rocket",
      })
    ).toBe("Rocket")
  })
})

describe("built-in collection views", () => {
  const createdAt = "2026-04-20T00:00:00.000Z"

  it("uses the collection tab labels and icons for workspace docs", () => {
    const views = buildWorkspaceDocumentViews({
      workspaceId: "workspace_1",
      userId: "user_1",
      createdAt,
    })

    expect(views.map((view) => ({ name: view.name, icon: view.icon }))).toEqual(
      [
        { name: "Private", icon: "LockSimple" },
        { name: "Workspace", icon: "FileText" },
      ]
    )
  })

  it("uses All docs and All projects with their collection icons", () => {
    expect(
      buildTeamDocumentViews({
        teamId: "team_1",
        teamSlug: "platform",
        createdAt,
      })[0]
    ).toMatchObject({ name: "All docs", icon: "FileText" })
    expect(
      buildWorkspaceProjectViews({
        workspaceId: "workspace_1",
        createdAt,
      })[0]
    ).toMatchObject({ name: "All projects", icon: "Kanban" })
    expect(
      buildTeamProjectViews({
        teamId: "team_1",
        teamSlug: "platform",
        createdAt,
      })[0]
    ).toMatchObject({ name: "All projects", icon: "Kanban" })
  })
})

describe("getSystemViewEditCapability", () => {
  it("allows a full re-default for private tasks", () => {
    expect(
      getSystemViewEditCapability({
        id: "view_assigned_private_tasks",
        entityKind: "items",
      })
    ).toBe("full")
  })

  it("allows presentation edits but keeps filters locked on shared built-in item views", () => {
    for (const id of [
      "view_team_1_all_items",
      "view_team_1_active_items",
      "view_team_1_backlog_items",
      "view_assigned_subscribed_items",
    ]) {
      expect(getSystemViewEditCapability({ id, entityKind: "items" })).toBe(
        "presentation"
      )
    }
  })

  it("allows collection presentation defaults for built-in projects and docs", () => {
    expect(
      getSystemViewEditCapability({
        id: "view_workspace_1_all_projects",
        entityKind: "projects",
      })
    ).toBe("collection")
    expect(
      getSystemViewEditCapability({
        id: "view_workspace_1_workspace_docs",
        entityKind: "docs",
      })
    ).toBe("collection")
  })

  it("returns none for custom (non-system) views", () => {
    expect(
      getSystemViewEditCapability({
        id: "view_custom_abc123",
        entityKind: "items",
      })
    ).toBe("none")
  })
})

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
  it("uses a workspace item surface when item views are not project-specific", () => {
    expect(
      getDefaultRouteForViewContext({
        scopeType: "workspace",
        entityKind: "items",
      })
    ).toBe("/workspace/items")

    expect(
      isRouteAllowedForViewContext({
        scopeType: "workspace",
        entityKind: "items",
        route: "/workspace/items",
      })
    ).toBe(true)
  })

  it("supports personal assigned item routes", () => {
    const view = createViewDefinition({
      id: "view_assigned_all_items",
      name: "All work",
      description: "",
      scopeType: "personal",
      scopeId: "user_1",
      entityKind: "items",
      defaultItemLevelExperience: "software-development",
      createdAt: "2026-04-20T00:00:00.000Z",
    })

    expect(view).toMatchObject({
      route: "/assigned",
      scopeType: "personal",
      itemLevel: "epic",
      showChildItems: true,
    })
  })

  it("does not infer an item level unless the caller opts in explicitly", () => {
    const view = createViewDefinition({
      id: "view_assigned_all_items",
      name: "All work",
      description: "",
      scopeType: "personal",
      scopeId: "user_1",
      entityKind: "items",
      createdAt: "2026-04-20T00:00:00.000Z",
    })

    expect(view).toMatchObject({
      route: "/assigned",
      itemLevel: null,
      showChildItems: false,
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
      "Private tasks",
      "All tasks",
      "Active",
      "Backlog",
      "Subscribed",
    ])
    expect(views.every((view) => view.route === "/assigned")).toBe(true)
    expect(views.every((view) => view.scopeType === "personal")).toBe(true)
    expect(views[0]?.displayProps).toContain("labels")
  })

  it("keeps mixed-template personal fallback views generic", () => {
    const views = buildAssignedWorkViews({
      userId: "user_1",
      createdAt: "2026-04-20T00:00:00.000Z",
    })

    expect(views.map((view) => view.name)).toEqual([
      "Private tasks",
      "All work",
      "Active",
      "Backlog",
      "Subscribed",
    ])
    expect(views[0]?.itemLevel).toBe("task")
    expect(views[0]?.layout).toBe("list")
    expect(views[0]?.filters.itemTypes).toEqual(["task", "sub-task"])
    expect(views[0]?.filters.visibility).toEqual(["private"])
    expect(views.at(-1)?.filters.subscriberIds).toEqual(["user_1"])
    expect(views[0]?.displayProps).not.toContain("assignee")
    expect(views[0]?.displayProps).not.toContain("project")
    expect(
      views.slice(1).every((view) => !view.displayProps.includes("assignee"))
    ).toBe(true)
    expect(views.slice(1).every((view) => view.itemLevel === null)).toBe(true)
    expect(views.every((view) => view.showChildItems === true)).toBe(true)
  })
})

describe("getSharedTeamExperience", () => {
  it("returns the shared experience when all teams match", () => {
    expect(
      getSharedTeamExperience(["software-development", "software-development"])
    ).toBe("software-development")
  })

  it("falls back to a generic experience when teams differ", () => {
    expect(
      getSharedTeamExperience(["software-development", "project-management"])
    ).toBeNull()
  })
})

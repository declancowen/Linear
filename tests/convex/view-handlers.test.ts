import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const requireEditableTeamAccessMock = vi.fn()
const requireReadableTeamAccessMock = vi.fn()
const requireEditableWorkspaceAccessMock = vi.fn()
const requireReadableWorkspaceAccessMock = vi.fn()
const getCustomPropertyDefinitionDocMock = vi.fn()
const getTeamDocMock = vi.fn()
const normalizeTeamMock = vi.fn()
const assertViewLabelIdsMock = vi.fn()
const assertWorkspaceLabelIdsMock = vi.fn()
const requireViewMutationAccessMock = vi.fn()
const resolveViewWorkspaceIdMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  createId: () => "view_1",
  getNow: () => "2026-04-21T09:00:00.000Z",
}))

vi.mock("@/convex/app/access", () => ({
  requireEditableTeamAccess: requireEditableTeamAccessMock,
  requireReadableTeamAccess: requireReadableTeamAccessMock,
  requireEditableWorkspaceAccess: requireEditableWorkspaceAccessMock,
  requireReadableWorkspaceAccess: requireReadableWorkspaceAccessMock,
}))

vi.mock("@/convex/app/data", () => ({
  getCustomPropertyDefinitionDoc: getCustomPropertyDefinitionDocMock,
  getTeamDoc: getTeamDocMock,
}))

vi.mock("@/convex/app/normalization", () => ({
  normalizeTeam: normalizeTeamMock,
}))

vi.mock("@/convex/app/work_helpers", () => ({
  assertViewLabelIds: assertViewLabelIdsMock,
  assertWorkspaceLabelIds: assertWorkspaceLabelIdsMock,
  requireViewMutationAccess: requireViewMutationAccessMock,
  resolveViewWorkspaceId: resolveViewWorkspaceIdMock,
}))

function createCtx() {
  return {
    db: {
      insert: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      query: vi.fn(),
    },
  }
}

function mockPersonalWorkView() {
  requireViewMutationAccessMock.mockResolvedValue({
    _id: "view_doc_1",
    scopeType: "personal",
    scopeId: "user_1",
    entityKind: "items",
    filters: { visibility: ["team"] },
    isShared: false,
    displayProps: ["status"],
  })
}

function mockPrivatePersonalWorkView(overrides: Record<string, unknown> = {}) {
  requireViewMutationAccessMock.mockResolvedValue({
    _id: "view_doc_1",
    scopeType: "personal",
    scopeId: "user_1",
    entityKind: "items",
    filters: { visibility: ["private"] },
    isShared: false,
    displayProps: ["status"],
    ...overrides,
  })
}

function mockWorkItemCustomPropertyDefinition(overrides: {
  scopeType: "private" | "team"
  ownerId: string | null
}) {
  getCustomPropertyDefinitionDocMock.mockResolvedValue({
    id: "property_1",
    teamId: "team_1",
    targetType: "workItem",
    isArchived: false,
    createdBy: "user_2",
    workspaceId: "workspace_1",
    ...overrides,
  })
}

describe("view handlers", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    requireEditableTeamAccessMock.mockReset()
    requireReadableTeamAccessMock.mockReset()
    requireEditableWorkspaceAccessMock.mockReset()
    requireReadableWorkspaceAccessMock.mockReset()
    getCustomPropertyDefinitionDocMock.mockReset()
    getTeamDocMock.mockReset()
    normalizeTeamMock.mockReset()
    assertViewLabelIdsMock.mockReset()
    assertWorkspaceLabelIdsMock.mockReset()
    requireViewMutationAccessMock.mockReset()
    resolveViewWorkspaceIdMock.mockReset()
  })

  it("derives the default item level from the team experience on create", async () => {
    const { createViewHandler } = await import("@/convex/app/view_handlers")
    const ctx = createCtx()

    getTeamDocMock.mockResolvedValue({
      _id: "team_doc_1",
    })
    normalizeTeamMock.mockReturnValue({
      id: "team_1",
      workspaceId: "workspace_1",
      slug: "platform",
      settings: {
        experience: "software-development",
        features: {
          views: true,
          issues: true,
          projects: true,
          docs: true,
        },
      },
    })

    const view = await createViewHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      scopeType: "team",
      scopeId: "team_1",
      entityKind: "items",
      route: "/team/platform/work",
      name: "Delivery view",
      description: "Tracks delivery work",
    })

    expect(view).toMatchObject({
      itemLevel: "epic",
      showChildItems: true,
    })
    expect(ctx.db.insert).toHaveBeenCalledWith("views", view)
  })

  it("toggles view filter values while preserving other filters", async () => {
    const { toggleViewFilterValueHandler } =
      await import("@/convex/app/view_handlers")
    const ctx = createCtx()

    requireViewMutationAccessMock.mockResolvedValue({
      _id: "view_doc_1",
      scopeType: "personal",
      scopeId: "user_1",
      entityKind: "items",
      isShared: false,
      filters: {
        labelIds: ["label_1", "label_2"],
        status: ["todo"],
      },
    })
    resolveViewWorkspaceIdMock.mockResolvedValue("workspace_1")

    await toggleViewFilterValueHandler(
      ctx as never,
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        viewId: "view_1",
        key: "labelIds",
        value: "label_2",
      } as never
    )
    await toggleViewFilterValueHandler(
      ctx as never,
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        viewId: "view_1",
        key: "labelIds",
        value: "label_3",
      } as never
    )

    expect(ctx.db.patch).toHaveBeenNthCalledWith(1, "view_doc_1", {
      filters: {
        labelIds: ["label_1"],
        status: ["todo"],
      },
      updatedAt: "2026-04-21T09:00:00.000Z",
    })
    expect(ctx.db.patch).toHaveBeenNthCalledWith(2, "view_doc_1", {
      filters: {
        labelIds: ["label_1", "label_2", "label_3"],
        status: ["todo"],
      },
      updatedAt: "2026-04-21T09:00:00.000Z",
    })
    expect(assertViewLabelIdsMock).toHaveBeenCalledWith(ctx, {
      currentUserId: "user_1",
      labelIds: ["label_1", "label_2", "label_3"],
      view: {
        _id: "view_doc_1",
        scopeType: "personal",
        scopeId: "user_1",
        entityKind: "items",
        isShared: false,
        filters: {
          labelIds: ["label_1", "label_2", "label_3"],
          status: ["todo"],
        },
      },
      workspaceId: "workspace_1",
    })
  })

  it("revalidates existing label filters when visibility changes", async () => {
    const { toggleViewFilterValueHandler } =
      await import("@/convex/app/view_handlers")
    const ctx = createCtx()

    requireViewMutationAccessMock.mockResolvedValue({
      _id: "view_doc_1",
      scopeType: "personal",
      scopeId: "user_1",
      entityKind: "items",
      isShared: false,
      filters: {
        labelIds: ["label_private"],
        status: ["todo"],
        visibility: [],
      },
    })
    resolveViewWorkspaceIdMock.mockResolvedValue("workspace_1")

    await toggleViewFilterValueHandler(
      ctx as never,
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        viewId: "view_1",
        key: "visibility",
        value: "private",
      } as never
    )

    expect(assertViewLabelIdsMock).toHaveBeenCalledWith(ctx, {
      currentUserId: "user_1",
      labelIds: ["label_private"],
      view: expect.objectContaining({
        filters: {
          labelIds: ["label_private"],
          status: ["todo"],
          visibility: ["private"],
        },
      }),
      workspaceId: "workspace_1",
    })
  })

  it("allows readable team custom properties in personal work views", async () => {
    const { toggleViewDisplayPropertyHandler } =
      await import("@/convex/app/view_handlers")
    const ctx = createCtx()

    mockPersonalWorkView()
    mockWorkItemCustomPropertyDefinition({
      scopeType: "team",
      ownerId: null,
    })
    requireReadableTeamAccessMock.mockResolvedValue("member")

    await toggleViewDisplayPropertyHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      viewId: "view_1",
      property: "custom:property_1",
    })

    expect(requireReadableTeamAccessMock).toHaveBeenCalledWith(
      ctx,
      "team_1",
      "user_1"
    )
    expect(ctx.db.patch).toHaveBeenCalledWith("view_doc_1", {
      displayProps: ["status", "custom:property_1"],
      updatedAt: "2026-04-21T09:00:00.000Z",
    })
  })

  it("allows owner private custom properties in private personal work views", async () => {
    const { toggleViewDisplayPropertyHandler } =
      await import("@/convex/app/view_handlers")
    const ctx = createCtx()

    mockPrivatePersonalWorkView()
    mockWorkItemCustomPropertyDefinition({
      scopeType: "private",
      ownerId: "user_1",
    })

    await toggleViewDisplayPropertyHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      viewId: "view_1",
      property: "custom:property_1",
    })

    expect(requireReadableWorkspaceAccessMock).toHaveBeenCalledWith(
      ctx,
      "workspace_1",
      "user_1"
    )
    expect(ctx.db.patch).toHaveBeenCalledWith("view_doc_1", {
      displayProps: ["status", "custom:property_1"],
      updatedAt: "2026-04-21T09:00:00.000Z",
    })
  })

  it("rejects private custom properties in mixed personal work views", async () => {
    const { toggleViewDisplayPropertyHandler } =
      await import("@/convex/app/view_handlers")
    const ctx = createCtx()

    mockPersonalWorkView()
    mockWorkItemCustomPropertyDefinition({
      scopeType: "private",
      ownerId: "user_1",
    })

    await expect(
      toggleViewDisplayPropertyHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        viewId: "view_1",
        property: "custom:property_1",
      })
    ).rejects.toThrow("Custom property is not available in this view scope")
    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  it("revalidates private custom display properties when visibility changes", async () => {
    const { toggleViewFilterValueHandler } =
      await import("@/convex/app/view_handlers")
    const ctx = createCtx()

    mockPrivatePersonalWorkView({
      displayProps: ["status", "custom:property_1"],
    })
    mockWorkItemCustomPropertyDefinition({
      scopeType: "private",
      ownerId: "user_1",
    })

    await expect(
      toggleViewFilterValueHandler(
        ctx as never,
        {
          serverToken: "server_token",
          currentUserId: "user_1",
          viewId: "view_1",
          key: "visibility",
          value: "team",
        } as never
      )
    ).rejects.toThrow("Custom property is not available in this view scope")
    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  it("revalidates private custom display properties when filters are cleared", async () => {
    const { clearViewFiltersHandler } =
      await import("@/convex/app/view_handlers")
    const ctx = createCtx()

    mockPrivatePersonalWorkView({
      displayProps: ["status", "custom:property_1"],
    })
    mockWorkItemCustomPropertyDefinition({
      scopeType: "private",
      ownerId: "user_1",
    })

    await expect(
      clearViewFiltersHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        viewId: "view_1",
      })
    ).rejects.toThrow("Custom property is not available in this view scope")
    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  function mockTeamItemsViewForMove() {
    requireViewMutationAccessMock.mockResolvedValue({
      _id: "view_doc_1",
      scopeType: "team",
      scopeId: "team_1",
      entityKind: "items",
      route: "/team/platform/work",
      description: "",
      layout: "list",
      containerType: null,
      containerId: null,
      itemLevel: null,
      showChildItems: false,
      grouping: null,
      subGrouping: null,
      ordering: "updatedAt",
      filters: { visibility: ["team"] },
      hiddenState: { groups: [], subgroups: [] },
      isShared: true,
      displayProps: ["status"],
    })
  }

  it("re-links (moves) a team items view to a workspace project without duplicating", async () => {
    const { updateViewConfigHandler } =
      await import("@/convex/app/view_handlers")
    const ctx = createCtx()

    mockTeamItemsViewForMove()

    await updateViewConfigHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      viewId: "view_1",
      scopeType: "workspace",
      scopeId: "workspace_1",
      containerType: "project-items",
      containerId: "project_1",
      route: "/workspace/projects/project_1",
    })

    expect(requireEditableWorkspaceAccessMock).toHaveBeenCalledWith(
      ctx,
      "workspace_1",
      "user_1"
    )
    expect(ctx.db.insert).not.toHaveBeenCalled()
    expect(ctx.db.delete).not.toHaveBeenCalled()
    expect(ctx.db.patch).toHaveBeenCalledTimes(1)
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "view_doc_1",
      expect.objectContaining({
        scopeType: "workspace",
        scopeId: "workspace_1",
        containerType: "project-items",
        containerId: "project_1",
        route: "/workspace/projects/project_1",
      })
    )
  })

  it("re-links a team items view to a different team and enforces target features", async () => {
    const { updateViewConfigHandler } =
      await import("@/convex/app/view_handlers")
    const ctx = createCtx()

    mockTeamItemsViewForMove()
    getTeamDocMock.mockResolvedValue({ _id: "team_doc_2" })
    normalizeTeamMock.mockReturnValue({
      id: "team_2",
      workspaceId: "workspace_1",
      slug: "other",
      settings: {
        experience: "software-development",
        features: { views: true, issues: true, projects: true, docs: true },
      },
    })

    await updateViewConfigHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      viewId: "view_1",
      scopeType: "team",
      scopeId: "team_2",
      route: "/team/other/work",
    })

    expect(requireEditableTeamAccessMock).toHaveBeenCalledWith(
      ctx,
      "team_2",
      "user_1"
    )
    expect(ctx.db.insert).not.toHaveBeenCalled()
    expect(ctx.db.delete).not.toHaveBeenCalled()
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "view_doc_1",
      expect.objectContaining({
        scopeType: "team",
        scopeId: "team_2",
        route: "/team/other/work",
      })
    )
  })

  it("refuses to move a personal view to another scope", async () => {
    const { updateViewConfigHandler } =
      await import("@/convex/app/view_handlers")
    const ctx = createCtx()

    requireViewMutationAccessMock.mockResolvedValue({
      _id: "view_doc_1",
      scopeType: "personal",
      scopeId: "user_1",
      entityKind: "items",
      route: "/assigned",
      description: "",
      layout: "list",
      containerType: null,
      containerId: null,
      itemLevel: null,
      showChildItems: false,
      grouping: null,
      subGrouping: null,
      ordering: "updatedAt",
      filters: {},
      hiddenState: { groups: [], subgroups: [] },
      isShared: false,
      displayProps: [],
    })

    await expect(
      updateViewConfigHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        viewId: "view_1",
        scopeType: "workspace",
        scopeId: "workspace_1",
      })
    ).rejects.toThrow("Personal views cannot be moved to another scope")
    expect(ctx.db.patch).not.toHaveBeenCalled()
  })
})

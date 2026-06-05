import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const requireEditableTeamAccessMock = vi.fn()
const requireEditableTeamDocMock = vi.fn()
const requireReadableTeamAccessMock = vi.fn()
const requireReadableWorkspaceAccessMock = vi.fn()
const requireEditableWorkItemAccessMock = vi.fn()
const getCustomPropertyDefinitionDocMock = vi.fn()
const getCustomPropertyValueDocMock = vi.fn()
const getCustomPropertyValueDocByTargetMock = vi.fn()
const getTeamMembershipDocMock = vi.fn()
const getUserDocMock = vi.fn()
const getWorkItemDocMock = vi.fn()
const listCustomPropertyDefinitionsByTeamMock = vi.fn()
const listPrivateCustomPropertyDefinitionsByWorkspaceOwnerMock = vi.fn()
const listCustomPropertyValuesByPropertyMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  createId: () => "property_1",
  getNow: () => "2026-05-12T10:00:00.000Z",
}))

vi.mock("@/convex/app/access", () => ({
  requireEditableTeamAccess: requireEditableTeamAccessMock,
  requireEditableTeamDoc: requireEditableTeamDocMock,
  requireReadableTeamAccess: requireReadableTeamAccessMock,
  requireReadableWorkspaceAccess: requireReadableWorkspaceAccessMock,
  requireEditableWorkItemAccess: requireEditableWorkItemAccessMock,
}))

vi.mock("@/convex/app/data", () => ({
  getCustomPropertyDefinitionDoc: getCustomPropertyDefinitionDocMock,
  getCustomPropertyValueDoc: getCustomPropertyValueDocMock,
  getCustomPropertyValueDocByTarget: getCustomPropertyValueDocByTargetMock,
  getTeamMembershipDoc: getTeamMembershipDocMock,
  getUserDoc: getUserDocMock,
  getWorkItemDoc: getWorkItemDocMock,
  listCustomPropertyDefinitionsByTeam: listCustomPropertyDefinitionsByTeamMock,
  listPrivateCustomPropertyDefinitionsByWorkspaceOwner:
    listPrivateCustomPropertyDefinitionsByWorkspaceOwnerMock,
  listCustomPropertyValuesByProperty: listCustomPropertyValuesByPropertyMock,
}))

function createCtx() {
  return {
    db: {
      insert: vi.fn(),
      patch: vi.fn(),
    },
  }
}

function createDefinition() {
  return {
    _id: "db_property_1",
    id: "property_1",
    workspaceId: "workspace_1",
    teamId: "team_1",
    targetType: "workItem",
    name: "Risk",
    icon: "Flag",
    type: "select",
    options: [{ id: "option_1", label: "High", color: "red" }],
    isArchived: false,
    createdBy: "user_1",
    createdAt: "2026-05-12T09:00:00.000Z",
    updatedAt: "2026-05-12T09:00:00.000Z",
  }
}

function createPrivatePersonDefinition() {
  return {
    ...createDefinition(),
    _id: "db_property_private_person",
    id: "property_private_person",
    teamId: null,
    scopeType: "private",
    ownerId: "user_1",
    name: "Reviewer",
    icon: "User",
    type: "person",
    options: [],
  }
}

const duplicatedOptionIdInput = [
  { id: "option_1", label: "High", color: "red" },
  { id: "option_1", label: "Low", color: "blue" },
]

describe("custom property handlers", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    requireEditableTeamAccessMock.mockReset()
    requireEditableTeamDocMock.mockReset()
    requireReadableTeamAccessMock.mockReset()
    requireReadableWorkspaceAccessMock.mockReset()
    requireEditableWorkItemAccessMock.mockReset()
    getCustomPropertyDefinitionDocMock.mockReset()
    getCustomPropertyValueDocMock.mockReset()
    getCustomPropertyValueDocByTargetMock.mockReset()
    getTeamMembershipDocMock.mockReset()
    getUserDocMock.mockReset()
    getWorkItemDocMock.mockReset()
    listCustomPropertyDefinitionsByTeamMock.mockReset()
    listPrivateCustomPropertyDefinitionsByWorkspaceOwnerMock.mockReset()
    listCustomPropertyValuesByPropertyMock.mockReset()

    requireEditableTeamDocMock.mockResolvedValue({
      id: "team_1",
      workspaceId: "workspace_1",
    })
    getCustomPropertyDefinitionDocMock.mockResolvedValue(createDefinition())
    getCustomPropertyValueDocByTargetMock.mockResolvedValue(null)
    getWorkItemDocMock.mockResolvedValue({
      _id: "db_item_1",
      id: "item_1",
      teamId: "team_1",
      workspaceId: "workspace_1",
      visibility: "private",
      creatorId: "user_1",
      assigneeId: null,
    })
    requireEditableWorkItemAccessMock.mockResolvedValue("member")
    listCustomPropertyDefinitionsByTeamMock.mockResolvedValue([])
    listPrivateCustomPropertyDefinitionsByWorkspaceOwnerMock.mockResolvedValue(
      []
    )
    listCustomPropertyValuesByPropertyMock.mockResolvedValue([])
  })

  it("rejects duplicate option ids on create before inserting", async () => {
    const { createCustomPropertyDefinitionHandler } =
      await import("@/convex/app/custom_property_handlers")
    const ctx = createCtx()

    await expect(
      createCustomPropertyDefinitionHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        teamId: "team_1",
        name: "Risk",
        icon: "Flag",
        type: "select",
        options: duplicatedOptionIdInput,
      })
    ).rejects.toThrow("Property option ids must be unique")

    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("requires a workspace id for private custom property creation", async () => {
    const { createCustomPropertyDefinitionHandler } =
      await import("@/convex/app/custom_property_handlers")
    const ctx = createCtx()

    await expect(
      createCustomPropertyDefinitionHandler(
        ctx as never,
        {
          serverToken: "server_token",
          currentUserId: "user_1",
          teamId: "team_1",
          scopeType: "private",
          name: "Private field",
          icon: "TextAa",
          type: "text",
          options: [],
        } as never
      )
    ).rejects.toThrow("Workspace not found")

    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("rejects workspace custom properties for work items", async () => {
    const { createCustomPropertyDefinitionHandler } =
      await import("@/convex/app/custom_property_handlers")
    const ctx = createCtx()

    await expect(
      createCustomPropertyDefinitionHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        workspaceId: "workspace_1",
        scopeType: "workspace",
        targetType: "workItem",
        name: "Workspace field",
        icon: "TextAa",
        type: "text",
        options: [],
      })
    ).rejects.toThrow("Workspace properties can only target documents")

    expect(ctx.db.insert).not.toHaveBeenCalled()
    expect(requireReadableWorkspaceAccessMock).not.toHaveBeenCalled()
  })

  it("creates private custom properties with server-derived owner", async () => {
    const { createCustomPropertyDefinitionHandler } =
      await import("@/convex/app/custom_property_handlers")
    const ctx = createCtx()

    await expect(
      createCustomPropertyDefinitionHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        workspaceId: "workspace_1",
        scopeType: "private",
        name: "Private field",
        icon: "TextAa",
        type: "text",
        options: [],
      })
    ).resolves.toMatchObject({
      property: {
        workspaceId: "workspace_1",
        teamId: null,
        scopeType: "private",
        ownerId: "user_1",
      },
    })

    expect(requireReadableWorkspaceAccessMock).toHaveBeenCalledWith(
      ctx,
      "workspace_1",
      "user_1"
    )
    expect(
      listPrivateCustomPropertyDefinitionsByWorkspaceOwnerMock
    ).toHaveBeenCalledWith(ctx, "workspace_1", "user_1")
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "customPropertyDefinitions",
      expect.objectContaining({
        workspaceId: "workspace_1",
        teamId: null,
        scopeType: "private",
        ownerId: "user_1",
      })
    )
  })

  it("rejects duplicate option ids on update before patching", async () => {
    const { updateCustomPropertyDefinitionHandler } =
      await import("@/convex/app/custom_property_handlers")
    const ctx = createCtx()

    await expect(
      updateCustomPropertyDefinitionHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        propertyId: "property_1",
        patch: {
          options: duplicatedOptionIdInput,
        },
      })
    ).rejects.toThrow("Property option ids must be unique")

    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  it("uses item-level private access before setting work item property values", async () => {
    const { setCustomPropertyValueHandler } =
      await import("@/convex/app/custom_property_handlers")
    const ctx = createCtx()

    requireEditableWorkItemAccessMock.mockRejectedValueOnce(
      new Error("Work item not found")
    )

    await expect(
      setCustomPropertyValueHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_2",
        workItemId: "item_1",
        propertyId: "property_1",
        value: "option_1",
      })
    ).rejects.toThrow("Work item not found")

    expect(requireEditableWorkItemAccessMock).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        id: "item_1",
      }),
      "user_2"
    )
    expect(getCustomPropertyDefinitionDocMock).not.toHaveBeenCalled()
    expect(ctx.db.patch).not.toHaveBeenCalled()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("validates private person values against workspace access", async () => {
    const { setCustomPropertyValueHandler } =
      await import("@/convex/app/custom_property_handlers")
    const ctx = createCtx()

    getCustomPropertyDefinitionDocMock.mockResolvedValueOnce(
      createPrivatePersonDefinition()
    )
    getCustomPropertyValueDocMock.mockResolvedValueOnce(null)
    getUserDocMock.mockResolvedValueOnce({
      id: "user_2",
    })

    await expect(
      setCustomPropertyValueHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        workItemId: "item_1",
        propertyId: "property_private_person",
        value: "user_2",
      })
    ).resolves.toEqual({ ok: true })

    expect(requireReadableWorkspaceAccessMock).toHaveBeenCalledWith(
      ctx,
      "workspace_1",
      "user_2"
    )
    expect(getTeamMembershipDocMock).not.toHaveBeenCalled()
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "customPropertyValues",
      expect.objectContaining({
        workspaceId: "workspace_1",
        teamId: null,
        workItemId: "item_1",
        propertyId: "property_private_person",
        value: "user_2",
      })
    )
  })

  it("rejects private person values outside the workspace", async () => {
    const { setCustomPropertyValueHandler } =
      await import("@/convex/app/custom_property_handlers")
    const ctx = createCtx()

    getCustomPropertyDefinitionDocMock.mockResolvedValueOnce(
      createPrivatePersonDefinition()
    )
    getUserDocMock.mockResolvedValueOnce({
      id: "user_2",
    })
    requireReadableWorkspaceAccessMock.mockRejectedValueOnce(
      new Error("Workspace not found")
    )

    await expect(
      setCustomPropertyValueHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        workItemId: "item_1",
        propertyId: "property_private_person",
        value: "user_2",
      })
    ).rejects.toThrow("Person value must reference a workspace member")

    expect(getTeamMembershipDocMock).not.toHaveBeenCalled()
    expect(ctx.db.patch).not.toHaveBeenCalled()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })
})

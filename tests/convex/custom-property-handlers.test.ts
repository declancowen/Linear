import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const requireEditableTeamAccessMock = vi.fn()
const requireEditableTeamDocMock = vi.fn()
const requireReadableTeamAccessMock = vi.fn()
const requireEditableWorkItemAccessMock = vi.fn()
const getCustomPropertyDefinitionDocMock = vi.fn()
const getCustomPropertyValueDocMock = vi.fn()
const getTeamMembershipDocMock = vi.fn()
const getUserDocMock = vi.fn()
const getWorkItemDocMock = vi.fn()
const listCustomPropertyDefinitionsByTeamMock = vi.fn()
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
  requireEditableWorkItemAccess: requireEditableWorkItemAccessMock,
}))

vi.mock("@/convex/app/data", () => ({
  getCustomPropertyDefinitionDoc: getCustomPropertyDefinitionDocMock,
  getCustomPropertyValueDoc: getCustomPropertyValueDocMock,
  getTeamMembershipDoc: getTeamMembershipDocMock,
  getUserDoc: getUserDocMock,
  getWorkItemDoc: getWorkItemDocMock,
  listCustomPropertyDefinitionsByTeam: listCustomPropertyDefinitionsByTeamMock,
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
    requireEditableWorkItemAccessMock.mockReset()
    getCustomPropertyDefinitionDocMock.mockReset()
    getCustomPropertyValueDocMock.mockReset()
    getTeamMembershipDocMock.mockReset()
    getUserDocMock.mockReset()
    getWorkItemDocMock.mockReset()
    listCustomPropertyDefinitionsByTeamMock.mockReset()
    listCustomPropertyValuesByPropertyMock.mockReset()

    requireEditableTeamDocMock.mockResolvedValue({
      id: "team_1",
      workspaceId: "workspace_1",
    })
    getCustomPropertyDefinitionDocMock.mockResolvedValue(createDefinition())
    getWorkItemDocMock.mockResolvedValue({
      _id: "db_item_1",
      id: "item_1",
      teamId: "team_1",
      visibility: "private",
      creatorId: "user_1",
      assigneeId: null,
    })
    requireEditableWorkItemAccessMock.mockResolvedValue("member")
    listCustomPropertyDefinitionsByTeamMock.mockResolvedValue([])
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
})

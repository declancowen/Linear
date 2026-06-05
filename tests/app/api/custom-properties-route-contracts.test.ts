import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import type { AppSnapshot } from "@/lib/domain/types"
import {
  createJsonRouteRequest,
  createRouteParams,
} from "@/tests/lib/fixtures/api-routes"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const getSnapshotServerMock = vi.fn()
const createCustomPropertyDefinitionServerMock = vi.fn()
const updateCustomPropertyDefinitionServerMock = vi.fn()
const archiveCustomPropertyDefinitionServerMock = vi.fn()
const bumpScopedReadModelVersionsServerMock = vi.fn()
const resolveCustomPropertyDefinitionReadModelScopeKeysServerMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
}))

vi.mock("@/lib/server/convex", () => ({
  getSnapshotServer: getSnapshotServerMock,
  createCustomPropertyDefinitionServer:
    createCustomPropertyDefinitionServerMock,
  updateCustomPropertyDefinitionServer:
    updateCustomPropertyDefinitionServerMock,
  archiveCustomPropertyDefinitionServer:
    archiveCustomPropertyDefinitionServerMock,
  bumpScopedReadModelVersionsServer: bumpScopedReadModelVersionsServerMock,
}))

vi.mock("@/lib/server/scoped-read-models", () => ({
  resolveCustomPropertyDefinitionReadModelScopeKeysServer:
    resolveCustomPropertyDefinitionReadModelScopeKeysServerMock,
}))

const authenticatedSession = {
  user: {
    id: "workos_1",
    email: "alex@example.com",
  },
  organizationId: "org_1",
}

const propertyScopeKeys = [
  "work-index:team_team_1",
  "work-item-detail:item_1",
  "view-catalog:team_team_1",
]

const selectPropertyOptions = [{ id: "option_1", label: "High", color: "red" }]

function createSelectPropertyPayload(overrides?: Record<string, unknown>) {
  return {
    teamId: "team_1",
    targetType: "workItem",
    name: "Risk",
    icon: "Flag",
    type: "select",
    options: selectPropertyOptions,
    ...overrides,
  }
}

function createPrivatePropertyPayload(overrides?: Record<string, unknown>) {
  return {
    workspaceId: "workspace_1",
    scopeType: "private",
    targetType: "workItem",
    name: "Private field",
    icon: "Lock",
    type: "text",
    options: [],
    ...overrides,
  }
}

async function expectInvalidCustomPropertyCreateResponse(response: Response) {
  expect(response.status).toBe(400)
  await expect(response.json()).resolves.toEqual({
    error: "Invalid custom property payload",
    message: "Invalid custom property payload",
    code: "ROUTE_INVALID_BODY",
  })
  expect(createCustomPropertyDefinitionServerMock).not.toHaveBeenCalled()
  expect(
    resolveCustomPropertyDefinitionReadModelScopeKeysServerMock
  ).not.toHaveBeenCalled()
  expect(bumpScopedReadModelVersionsServerMock).not.toHaveBeenCalled()
}

function createSnapshotFixture(): AppSnapshot {
  return {
    ...createEmptyState(),
    customPropertyDefinitions: [
      {
        id: "property_1",
        workspaceId: "workspace_1",
        teamId: "team_1",
        targetType: "workItem",
        name: "Risk",
        icon: "Flag",
        type: "select",
        options: selectPropertyOptions,
        isArchived: false,
        createdBy: "user_1",
        createdAt: "2026-05-12T10:00:00.000Z",
        updatedAt: "2026-05-12T10:00:00.000Z",
      },
    ],
  } as AppSnapshot
}

function createPrivateSnapshotFixture(): AppSnapshot {
  return {
    ...createEmptyState(),
    customPropertyDefinitions: [
      {
        id: "property_1",
        workspaceId: "workspace_1",
        teamId: null,
        scopeType: "private",
        ownerId: "user_1",
        targetType: "workItem",
        name: "Private field",
        icon: "Lock",
        type: "text",
        options: [],
        isArchived: false,
        createdBy: "user_1",
        createdAt: "2026-05-12T10:00:00.000Z",
        updatedAt: "2026-05-12T10:00:00.000Z",
      },
    ],
  } as AppSnapshot
}

function createWorkspaceSnapshotFixture(): AppSnapshot {
  return {
    ...createEmptyState(),
    customPropertyDefinitions: [
      {
        id: "property_1",
        workspaceId: "workspace_1",
        teamId: null,
        scopeType: "workspace",
        ownerId: null,
        targetType: "document",
        name: "Workspace field",
        icon: "Tag",
        type: "text",
        options: [],
        isArchived: false,
        createdBy: "user_1",
        createdAt: "2026-05-12T10:00:00.000Z",
        updatedAt: "2026-05-12T10:00:00.000Z",
      },
    ],
  } as AppSnapshot
}

function createPropertyRouteParams() {
  return createRouteParams({
    propertyId: "property_1",
  })
}

async function expectOkResponse(response: Response) {
  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toEqual({ ok: true })
}

type PropertyReadModelTarget =
  | {
      scopeType: "team"
      teamId: string
    }
  | {
      scopeType: "workspace"
      workspaceId: string
    }
  | {
      scopeType: "private"
      ownerId: string
      workspaceId: string
    }

async function expectArchiveCustomPropertyInvalidates(
  target: PropertyReadModelTarget
) {
  const { DELETE } =
    await import("@/app/api/custom-properties/[propertyId]/route")

  const response = await DELETE(
    new Request("http://localhost/api/custom-properties/property_1", {
      method: "DELETE",
    }) as never,
    createPropertyRouteParams()
  )

  await expectOkResponse(response)
  expect(archiveCustomPropertyDefinitionServerMock).toHaveBeenCalledWith({
    currentUserId: "user_1",
    propertyId: "property_1",
  })
  expect(
    resolveCustomPropertyDefinitionReadModelScopeKeysServerMock
  ).toHaveBeenCalledWith(authenticatedSession, target)
  expect(bumpScopedReadModelVersionsServerMock).toHaveBeenCalledWith({
    scopeKeys: propertyScopeKeys,
  })
}

describe("custom property route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    getSnapshotServerMock.mockReset()
    createCustomPropertyDefinitionServerMock.mockReset()
    updateCustomPropertyDefinitionServerMock.mockReset()
    archiveCustomPropertyDefinitionServerMock.mockReset()
    bumpScopedReadModelVersionsServerMock.mockReset()
    resolveCustomPropertyDefinitionReadModelScopeKeysServerMock.mockReset()

    requireSessionMock.mockResolvedValue(authenticatedSession)
    requireAppContextMock.mockResolvedValue({
      ensuredUser: {
        userId: "user_1",
      },
    })
    getSnapshotServerMock.mockResolvedValue(createSnapshotFixture())
    createCustomPropertyDefinitionServerMock.mockResolvedValue({
      property: {
        id: "property_1",
      },
    })
    updateCustomPropertyDefinitionServerMock.mockResolvedValue({ ok: true })
    archiveCustomPropertyDefinitionServerMock.mockResolvedValue({ ok: true })
    bumpScopedReadModelVersionsServerMock.mockResolvedValue(undefined)
    resolveCustomPropertyDefinitionReadModelScopeKeysServerMock.mockResolvedValue(
      propertyScopeKeys
    )
  })

  it("creates custom properties and invalidates all property definition read models", async () => {
    const { POST } = await import("@/app/api/custom-properties/route")

    const response = await POST(
      createJsonRouteRequest(
        "http://localhost/api/custom-properties",
        "POST",
        createSelectPropertyPayload()
      )
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      property: {
        id: "property_1",
      },
    })
    expect(createCustomPropertyDefinitionServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      teamId: "team_1",
      scopeType: "team",
      targetType: "workItem",
      name: "Risk",
      icon: "Flag",
      type: "select",
      options: selectPropertyOptions,
    })
    expect(
      resolveCustomPropertyDefinitionReadModelScopeKeysServerMock
    ).toHaveBeenCalledWith(authenticatedSession, "team_1")
    expect(bumpScopedReadModelVersionsServerMock).toHaveBeenCalledWith({
      scopeKeys: propertyScopeKeys,
    })
  })

  it("rejects duplicate option ids before creating custom properties", async () => {
    const { POST } = await import("@/app/api/custom-properties/route")

    const response = await POST(
      createJsonRouteRequest(
        "http://localhost/api/custom-properties",
        "POST",
        createSelectPropertyPayload({
          options: [
            { id: "option_1", label: "High", color: "red" },
            { id: "option_1", label: "Low", color: "blue" },
          ],
        })
      )
    )

    await expectInvalidCustomPropertyCreateResponse(response)
  })

  it("rejects workspace custom properties for work items", async () => {
    const { POST } = await import("@/app/api/custom-properties/route")

    const response = await POST(
      createJsonRouteRequest(
        "http://localhost/api/custom-properties",
        "POST",
        createSelectPropertyPayload({
          teamId: undefined,
          workspaceId: "workspace_1",
          scopeType: "workspace",
          targetType: "workItem",
        })
      )
    )

    await expectInvalidCustomPropertyCreateResponse(response)
  })

  it("creates private custom properties and invalidates owner private scopes", async () => {
    const { POST } = await import("@/app/api/custom-properties/route")

    const response = await POST(
      createJsonRouteRequest(
        "http://localhost/api/custom-properties",
        "POST",
        createPrivatePropertyPayload({
          ownerId: "user_2",
        })
      )
    )

    expect(response.status).toBe(200)
    expect(createCustomPropertyDefinitionServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      workspaceId: "workspace_1",
      scopeType: "private",
      targetType: "workItem",
      name: "Private field",
      icon: "Lock",
      type: "text",
      options: [],
    })
    expect(
      resolveCustomPropertyDefinitionReadModelScopeKeysServerMock
    ).toHaveBeenCalledWith(authenticatedSession, {
      scopeType: "private",
      ownerId: "user_1",
      workspaceId: "workspace_1",
    })
    expect(bumpScopedReadModelVersionsServerMock).toHaveBeenCalledWith({
      scopeKeys: propertyScopeKeys,
    })
  })

  it("updates custom properties and invalidates all property definition read models", async () => {
    const { PATCH } =
      await import("@/app/api/custom-properties/[propertyId]/route")

    const response = await PATCH(
      createJsonRouteRequest(
        "http://localhost/api/custom-properties/property_1",
        "PATCH",
        {
          name: "Severity",
        }
      ),
      createPropertyRouteParams()
    )

    await expectOkResponse(response)
    expect(updateCustomPropertyDefinitionServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      propertyId: "property_1",
      patch: {
        name: "Severity",
      },
    })
    expect(
      resolveCustomPropertyDefinitionReadModelScopeKeysServerMock
    ).toHaveBeenCalledWith(authenticatedSession, {
      scopeType: "team",
      teamId: "team_1",
    })
    expect(bumpScopedReadModelVersionsServerMock).toHaveBeenCalledWith({
      scopeKeys: propertyScopeKeys,
    })
  })

  it("updates private custom properties and invalidates owner private scopes", async () => {
    getSnapshotServerMock.mockResolvedValueOnce(createPrivateSnapshotFixture())
    const { PATCH } =
      await import("@/app/api/custom-properties/[propertyId]/route")

    const response = await PATCH(
      createJsonRouteRequest(
        "http://localhost/api/custom-properties/property_1",
        "PATCH",
        {
          name: "Personal focus",
        }
      ),
      createPropertyRouteParams()
    )

    await expectOkResponse(response)
    expect(updateCustomPropertyDefinitionServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      propertyId: "property_1",
      patch: {
        name: "Personal focus",
      },
    })
    expect(
      resolveCustomPropertyDefinitionReadModelScopeKeysServerMock
    ).toHaveBeenCalledWith(authenticatedSession, {
      scopeType: "private",
      ownerId: "user_1",
      workspaceId: "workspace_1",
    })
    expect(bumpScopedReadModelVersionsServerMock).toHaveBeenCalledWith({
      scopeKeys: propertyScopeKeys,
    })
  })

  it("updates workspace custom properties and invalidates workspace scopes", async () => {
    getSnapshotServerMock.mockResolvedValueOnce(createWorkspaceSnapshotFixture())
    const { PATCH } =
      await import("@/app/api/custom-properties/[propertyId]/route")

    const response = await PATCH(
      createJsonRouteRequest(
        "http://localhost/api/custom-properties/property_1",
        "PATCH",
        {
          name: "Workspace status",
        }
      ),
      createPropertyRouteParams()
    )

    await expectOkResponse(response)
    expect(updateCustomPropertyDefinitionServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      propertyId: "property_1",
      patch: {
        name: "Workspace status",
      },
    })
    expect(
      resolveCustomPropertyDefinitionReadModelScopeKeysServerMock
    ).toHaveBeenCalledWith(authenticatedSession, {
      scopeType: "workspace",
      workspaceId: "workspace_1",
    })
    expect(bumpScopedReadModelVersionsServerMock).toHaveBeenCalledWith({
      scopeKeys: propertyScopeKeys,
    })
  })

  it("archives custom properties and invalidates all property definition read models", async () => {
    await expectArchiveCustomPropertyInvalidates({
      scopeType: "team",
      teamId: "team_1",
    })
  })

  it("archives private custom properties and invalidates owner private scopes", async () => {
    getSnapshotServerMock.mockResolvedValueOnce(createPrivateSnapshotFixture())
    await expectArchiveCustomPropertyInvalidates({
      scopeType: "private",
      ownerId: "user_1",
      workspaceId: "workspace_1",
    })
  })

  it("archives workspace custom properties and invalidates workspace scopes", async () => {
    getSnapshotServerMock.mockResolvedValueOnce(createWorkspaceSnapshotFixture())
    await expectArchiveCustomPropertyInvalidates({
      scopeType: "workspace",
      workspaceId: "workspace_1",
    })
  })
})

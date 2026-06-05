import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createTestAppData,
  createTestTeamMembership,
  createTestWorkItem,
} from "@/tests/lib/fixtures/app-data"
import { createMutableSetState } from "@/tests/lib/fixtures/store"

const storeTestMocks = vi.hoisted(() => ({
  syncArchiveCustomPropertyDefinition: vi.fn(),
  syncCreateCustomPropertyDefinition: vi.fn(),
  syncSetCustomPropertyValue: vi.fn(),
  syncUpdateCustomPropertyDefinition: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: storeTestMocks.toastError,
    success: storeTestMocks.toastSuccess,
  },
}))

vi.mock("@/lib/convex/client", () => ({
  syncArchiveCustomPropertyDefinition:
    storeTestMocks.syncArchiveCustomPropertyDefinition,
  syncCreateCustomPropertyDefinition:
    storeTestMocks.syncCreateCustomPropertyDefinition,
  syncSetCustomPropertyValue: storeTestMocks.syncSetCustomPropertyValue,
  syncUpdateCustomPropertyDefinition:
    storeTestMocks.syncUpdateCustomPropertyDefinition,
}))

async function createCustomPropertyHarness(
  state = createTestAppData({
    workItems: [
      createTestWorkItem("private_item", {
        teamId: null,
        workspaceId: "workspace_1",
        visibility: "private",
        creatorId: "user_1",
      }),
    ],
  })
) {
  const { createCustomPropertySlice } =
    await import("@/lib/store/app-store-internal/slices/custom-properties")
  const harness = {
    actions: null as ReturnType<typeof createCustomPropertySlice> | null,
    state,
    refreshFromServerMock: vi.fn(),
    syncInBackgroundMock: vi.fn(),
  }
  const setState = createMutableSetState(harness.state)

  harness.actions = createCustomPropertySlice(
    setState as never,
    () => harness.state as never,
    {
      refreshFromServer: harness.refreshFromServerMock,
      syncInBackground: harness.syncInBackgroundMock,
    } as never
  )

  return harness as typeof harness & {
    actions: ReturnType<typeof createCustomPropertySlice>
  }
}

describe("custom property store slice", () => {
  beforeEach(() => {
    storeTestMocks.syncArchiveCustomPropertyDefinition.mockReset()
    storeTestMocks.syncCreateCustomPropertyDefinition.mockReset()
    storeTestMocks.syncSetCustomPropertyValue.mockReset()
    storeTestMocks.syncUpdateCustomPropertyDefinition.mockReset()
    storeTestMocks.toastError.mockReset()
    storeTestMocks.toastSuccess.mockReset()

    storeTestMocks.syncCreateCustomPropertyDefinition.mockResolvedValue({
      property: {
        id: "property_server",
      },
    })
    storeTestMocks.syncSetCustomPropertyValue.mockResolvedValue({ ok: true })
  })

  it("creates private custom properties with the current user as optimistic owner", async () => {
    const harness = await createCustomPropertyHarness()

    const result = await harness.actions.createCustomPropertyDefinition({
      scopeType: "private",
      workspaceId: "workspace_1",
      name: " Focus ",
      icon: "TextAa",
      type: "text",
      options: [],
    })

    expect(result).toMatchObject({
      workspaceId: "workspace_1",
      teamId: null,
      scopeType: "private",
      ownerId: "user_1",
      name: "Focus",
    })
    expect(harness.state.customPropertyDefinitions[0]).toMatchObject({
      workspaceId: "workspace_1",
      teamId: null,
      scopeType: "private",
      ownerId: "user_1",
    })
    expect(
      storeTestMocks.syncCreateCustomPropertyDefinition
    ).toHaveBeenCalledWith({
      scopeType: "private",
      workspaceId: "workspace_1",
      targetType: "workItem",
      name: "Focus",
      icon: "TextAa",
      type: "text",
      options: [],
    })
    expect(harness.refreshFromServerMock).toHaveBeenCalledTimes(1)
  })

  it("stores private custom property values without assigning a team", async () => {
    const harness = await createCustomPropertyHarness(
      createTestAppData({
        customPropertyDefinitions: [
          {
            id: "property_private",
            workspaceId: "workspace_1",
            teamId: null,
            scopeType: "private",
            ownerId: "user_1",
            targetType: "workItem",
            name: "Focus",
            icon: "TextAa",
            type: "text",
            options: [],
            isArchived: false,
            createdBy: "user_1",
            createdAt: "2026-05-12T10:00:00.000Z",
            updatedAt: "2026-05-12T10:00:00.000Z",
          },
        ],
        workItems: [
          createTestWorkItem("private_item", {
            teamId: null,
            workspaceId: "workspace_1",
            visibility: "private",
            creatorId: "user_1",
          }),
        ],
      })
    )

    harness.actions.setCustomPropertyValue(
      "workItem",
      "private_item",
      "property_private",
      "Needs review"
    )

    expect(harness.state.customPropertyValues[0]).toMatchObject({
      workspaceId: "workspace_1",
      teamId: null,
      workItemId: "private_item",
      propertyId: "property_private",
      value: "Needs review",
      createdBy: "user_1",
      updatedBy: "user_1",
    })
    expect(storeTestMocks.syncSetCustomPropertyValue).toHaveBeenCalledWith(
      "workItem",
      "private_item",
      "property_private",
      "Needs review"
    )
    expect(harness.syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })

  it("does not archive team custom properties for read-only users", async () => {
    const harness = await createCustomPropertyHarness(
      createTestAppData({
        teamMemberships: [createTestTeamMembership({ role: "viewer" })],
        customPropertyDefinitions: [
          {
            id: "property_team",
            workspaceId: "workspace_1",
            teamId: "team_1",
            scopeType: "team",
            ownerId: null,
            targetType: "workItem",
            name: "Risk",
            icon: "Signal",
            type: "text",
            options: [],
            isArchived: false,
            createdBy: "user_1",
            createdAt: "2026-05-12T10:00:00.000Z",
            updatedAt: "2026-05-12T10:00:00.000Z",
          },
        ],
      })
    )

    const result =
      await harness.actions.archiveCustomPropertyDefinition("property_team")

    expect(result).toBe(false)
    expect(harness.state.customPropertyDefinitions[0]).toMatchObject({
      id: "property_team",
      isArchived: false,
    })
    expect(storeTestMocks.syncArchiveCustomPropertyDefinition).not.toHaveBeenCalled()
    expect(storeTestMocks.toastError).toHaveBeenCalledWith(
      "Your current role is read-only"
    )
  })
})

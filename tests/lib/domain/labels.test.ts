import { describe, expect, it } from "vitest"

import {
  isCustomPropertyDefinitionForWorkItem,
  isLabelAssignableToWorkItem,
} from "@/lib/domain/labels"

describe("label and custom property scope helpers", () => {
  it("keeps labels assignable only to team work items", () => {
    const workspaceLabel = {
      id: "label_workspace",
      workspaceId: "workspace_1",
      scopeType: "workspace" as const,
      ownerId: null,
    }
    const privateLabel = {
      id: "label_private",
      workspaceId: "workspace_1",
      scopeType: "private" as const,
      ownerId: "user_1",
    }

    expect(
      isLabelAssignableToWorkItem(
        workspaceLabel,
        { visibility: "team" },
        "workspace_1",
        "user_1"
      )
    ).toBe(true)
    expect(
      isLabelAssignableToWorkItem(
        workspaceLabel,
        { visibility: "private" },
        "workspace_1",
        "user_1"
      )
    ).toBe(false)
    expect(
      isLabelAssignableToWorkItem(
        privateLabel,
        { visibility: "private" },
        "workspace_1",
        "user_1"
      )
    ).toBe(false)
    expect(
      isLabelAssignableToWorkItem(
        privateLabel,
        { visibility: "team" },
        "workspace_1",
        "user_1"
      )
    ).toBe(false)
  })

  it("keeps custom properties team-scoped and unavailable to private tasks", () => {
    const teamDefinition = {
      id: "property_team",
      teamId: "team_1",
      scopeType: "team" as const,
      ownerId: null,
      createdBy: "user_1",
      isArchived: false,
      targetType: "workItem" as const,
    }
    const privateDefinition = {
      id: "property_private",
      teamId: "team_1",
      scopeType: "private" as const,
      ownerId: "user_1",
      createdBy: "user_1",
      isArchived: false,
      targetType: "workItem" as const,
    }

    expect(
      isCustomPropertyDefinitionForWorkItem(
        teamDefinition,
        { teamId: "team_1", visibility: "team" },
        "user_1"
      )
    ).toBe(true)
    expect(
      isCustomPropertyDefinitionForWorkItem(
        teamDefinition,
        { teamId: "team_1", visibility: "private" },
        "user_1"
      )
    ).toBe(false)
    expect(
      isCustomPropertyDefinitionForWorkItem(
        privateDefinition,
        { teamId: null, visibility: "private" },
        "user_1"
      )
    ).toBe(false)
    expect(
      isCustomPropertyDefinitionForWorkItem(
        privateDefinition,
        { teamId: "team_1", visibility: "team" },
        "user_1"
      )
    ).toBe(false)
  })
})

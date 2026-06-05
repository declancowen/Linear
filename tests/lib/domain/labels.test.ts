import { describe, expect, it } from "vitest"

import {
  isLabelVisibleToUser,
  isCustomPropertyDefinitionForWorkItem,
  isLabelAssignableToWorkItem,
} from "@/lib/domain/labels"

describe("label and custom property scope helpers", () => {
  it("keeps labels assignable to their matching workspace or private owner scope", () => {
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
    ).toBe(true)
    expect(
      isLabelAssignableToWorkItem(
        privateLabel,
        { visibility: "private" },
        "workspace_1",
        "user_2"
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

  it("shows private labels only to their owner", () => {
    expect(
      isLabelVisibleToUser(
        { scopeType: "private", ownerId: "user_1" },
        "user_1"
      )
    ).toBe(true)
    expect(
      isLabelVisibleToUser(
        { scopeType: "private", ownerId: "user_1" },
        "user_2"
      )
    ).toBe(false)
    expect(
      isLabelVisibleToUser({ scopeType: "workspace", ownerId: null }, "user_2")
    ).toBe(true)
  })

  it("scopes custom properties to team work or owner private tasks", () => {
    const teamDefinition = {
      id: "property_team",
      teamId: "team_1",
      workspaceId: "workspace_1",
      scopeType: "team" as const,
      ownerId: null,
      createdBy: "user_1",
      isArchived: false,
      targetType: "workItem" as const,
    }
    const privateDefinition = {
      id: "property_private",
      teamId: null,
      workspaceId: "workspace_1",
      scopeType: "private" as const,
      ownerId: "user_1",
      createdBy: "user_1",
      isArchived: false,
      targetType: "workItem" as const,
    }

    expect(
      isCustomPropertyDefinitionForWorkItem(
        teamDefinition,
        {
          creatorId: "user_2",
          teamId: "team_1",
          visibility: "team",
          workspaceId: "workspace_1",
        },
        "user_1"
      )
    ).toBe(true)
    expect(
      isCustomPropertyDefinitionForWorkItem(
        teamDefinition,
        {
          creatorId: "user_1",
          teamId: null,
          visibility: "private",
          workspaceId: "workspace_1",
        },
        "user_1"
      )
    ).toBe(false)
    expect(
      isCustomPropertyDefinitionForWorkItem(
        privateDefinition,
        {
          creatorId: "user_1",
          teamId: null,
          visibility: "private",
          workspaceId: "workspace_1",
        },
        "user_1"
      )
    ).toBe(true)
    expect(
      isCustomPropertyDefinitionForWorkItem(
        privateDefinition,
        {
          creatorId: "user_1",
          teamId: "team_1",
          visibility: "team",
          workspaceId: "workspace_1",
        },
        "user_1"
      )
    ).toBe(false)
    expect(
      isCustomPropertyDefinitionForWorkItem(
        privateDefinition,
        {
          creatorId: "user_2",
          teamId: null,
          visibility: "private",
          workspaceId: "workspace_1",
        },
        "user_1"
      )
    ).toBe(false)
  })
})

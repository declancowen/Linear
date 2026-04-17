import { describe, expect, it } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import { canAdminWorkspace, canEditWorkspace } from "@/lib/domain/selectors"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"

describe("workspace access selectors", () => {
  it("preserves editable workspace access from team member roles when the direct membership is stale", () => {
    const state = {
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      workspaces: [
        {
          id: "workspace_1",
          slug: "alpha",
          name: "Alpha",
          logoUrl: "",
          logoImageUrl: null,
          createdBy: "user_2",
          workosOrganizationId: null,
          settings: {
            accent: "emerald",
            description: "Alpha workspace",
          },
        },
      ],
      workspaceMemberships: [
        {
          workspaceId: "workspace_1",
          userId: "user_1",
          role: "viewer" as const,
        },
      ],
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "platform",
          name: "Platform",
          icon: "robot",
          settings: {
            joinCode: "JOIN1234",
            summary: "Platform team",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "software-development" as const,
            features: createDefaultTeamFeatureSettings("software-development"),
            workflow: createDefaultTeamWorkflowSettings("software-development"),
          },
        },
      ],
      teamMemberships: [
        {
          teamId: "team_1",
          userId: "user_1",
          role: "member" as const,
        },
      ],
    }

    expect(canEditWorkspace(state, "workspace_1")).toBe(true)
    expect(canAdminWorkspace(state, "workspace_1")).toBe(false)
  })

  it("preserves workspace admin access from team admin roles when the direct membership is stale", () => {
    const state = {
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      workspaces: [
        {
          id: "workspace_1",
          slug: "alpha",
          name: "Alpha",
          logoUrl: "",
          logoImageUrl: null,
          createdBy: "user_2",
          workosOrganizationId: null,
          settings: {
            accent: "emerald",
            description: "Alpha workspace",
          },
        },
      ],
      workspaceMemberships: [
        {
          workspaceId: "workspace_1",
          userId: "user_1",
          role: "viewer" as const,
        },
      ],
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "platform",
          name: "Platform",
          icon: "robot",
          settings: {
            joinCode: "JOIN1234",
            summary: "Platform team",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "software-development" as const,
            features: createDefaultTeamFeatureSettings("software-development"),
            workflow: createDefaultTeamWorkflowSettings("software-development"),
          },
        },
      ],
      teamMemberships: [
        {
          teamId: "team_1",
          userId: "user_1",
          role: "admin" as const,
        },
      ],
    }

    expect(canEditWorkspace(state, "workspace_1")).toBe(true)
    expect(canAdminWorkspace(state, "workspace_1")).toBe(true)
  })
})

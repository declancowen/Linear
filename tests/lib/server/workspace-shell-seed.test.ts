import { describe, expect, it } from "vitest"

import { createMinimalWorkspaceShellSeed } from "@/lib/server/workspace-shell-seed"

describe("createMinimalWorkspaceShellSeed", () => {
  it("maps auth context into a minimal workspace shell seed", () => {
    const seed = createMinimalWorkspaceShellSeed({
      authContext: {
        currentUser: {
          id: "user_1",
          email: "alex@example.com",
          name: "Alex Example",
          workosUserId: "workos_1",
          avatarUrl: "AE",
          avatarImageUrl: "https://example.com/avatar.png",
        },
        memberships: [],
        currentWorkspace: {
          id: "workspace_1",
          slug: "workspace-1",
          name: "Workspace 1",
          logoUrl: "https://example.com/logo.png",
          workosOrganizationId: "org_1",
        },
        pendingWorkspace: null,
        pendingInvites: [],
        onboardingState: "ready",
        isWorkspaceOwner: false,
        isWorkspaceAdmin: false,
      },
    })

    expect(seed).toEqual({
      data: {
        currentUserId: "user_1",
        currentWorkspaceId: "workspace_1",
        users: [
          expect.objectContaining({
            id: "user_1",
            handle: "alex",
            email: "alex@example.com",
            avatarUrl: "AE",
            avatarImageUrl: "https://example.com/avatar.png",
            workosUserId: "workos_1",
            title: "",
            status: "offline",
            statusMessage: "",
            hasExplicitStatus: false,
            preferences: {
              emailMentions: true,
              emailAssignments: true,
              emailDigest: true,
              theme: "light",
            },
          }),
        ],
        workspaces: [
          expect.objectContaining({
            id: "workspace_1",
            slug: "workspace-1",
            name: "Workspace 1",
            logoUrl: "https://example.com/logo.png",
            logoImageUrl: null,
            createdBy: null,
            workosOrganizationId: "org_1",
            settings: {
              accent: "#000000",
              description: "",
            },
          }),
        ],
      },
      replace: [
        {
          kind: "workspace-membership",
          workspaceId: "workspace_1",
        },
      ],
    })
  })
})

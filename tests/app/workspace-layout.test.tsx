import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMinimalWorkspaceShellSeed } from "@/lib/server/workspace-shell-seed"

const withAuthMock = vi.hoisted(() => vi.fn())
const redirectMock = vi.hoisted(() => vi.fn())
const authenticatedWorkspaceClientMock = vi.hoisted(() => vi.fn())
const ensureAuthenticatedAppContextMock = vi.hoisted(() => vi.fn())
const getWorkspaceMembershipBootstrapServerMock = vi.hoisted(() => vi.fn())

vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: withAuthMock,
}))

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}))

vi.mock("@/components/app/authenticated-workspace-client", () => ({
  AuthenticatedWorkspaceClient: ({
    children,
    ...props
  }: {
    children: ReactNode
  }) => {
    authenticatedWorkspaceClientMock(props)
    return <>{children}</>
  },
}))

vi.mock("@/lib/server/authenticated-app", () => ({
  ensureAuthenticatedAppContext: ensureAuthenticatedAppContextMock,
}))

vi.mock("@/lib/server/convex", () => ({
  getWorkspaceMembershipBootstrapServer: getWorkspaceMembershipBootstrapServerMock,
}))

describe("WorkspaceLayout", () => {
  const authContext = {
    currentUser: {
      id: "user_1",
      email: "alex@example.com",
      name: "Alex Example",
      workosUserId: "workos_1",
      avatarUrl: "AE",
      avatarImageUrl: null,
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
    onboardingState: "ready" as const,
    isWorkspaceOwner: false,
    isWorkspaceAdmin: false,
  }

  async function renderWorkspaceLayout() {
    const { default: WorkspaceLayout } = await import(
      "@/app/(workspace)/layout"
    )

    render(
      await WorkspaceLayout({
        children: <div>Workspace content</div>,
      })
    )
  }

  beforeEach(() => {
    withAuthMock.mockReset()
    redirectMock.mockReset()
    authenticatedWorkspaceClientMock.mockReset()
    ensureAuthenticatedAppContextMock.mockReset()
    getWorkspaceMembershipBootstrapServerMock.mockReset()

    withAuthMock.mockResolvedValue({
      user: {
        id: "workos_1",
        email: "alex@example.com",
      },
      organizationId: "org_1",
    })
    ensureAuthenticatedAppContextMock.mockResolvedValue({
      authenticatedUser: {
        workosUserId: "workos_1",
        email: "alex@example.com",
        name: "Alex Example",
        avatarUrl: "AE",
        organizationId: "org_1",
      },
      authContext,
    })
  })

  it("passes the bounded workspace shell bootstrap when it loads successfully", async () => {
    getWorkspaceMembershipBootstrapServerMock.mockResolvedValue({
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      users: [{ id: "user_1" }],
      workspaces: [{ id: "workspace_1" }],
      teams: [],
      workspaceMemberships: [],
      teamMemberships: [],
      labels: [],
      invites: [],
    })

    await renderWorkspaceLayout()

    expect(screen.getByText("Workspace content")).toBeInTheDocument()
    expect(authenticatedWorkspaceClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialWorkspaceId: "workspace_1",
        initialShellSeed: {
          data: {
            currentUserId: "user_1",
            currentWorkspaceId: "workspace_1",
            users: [{ id: "user_1" }],
            workspaces: [{ id: "workspace_1" }],
            teams: [],
            workspaceMemberships: [],
            teamMemberships: [],
            labels: [],
            invites: [],
          },
          replace: [
            {
              kind: "workspace-membership",
              workspaceId: "workspace_1",
            },
          ],
        },
      })
    )
  })

  it("falls back to the minimal shell seed when the bounded bootstrap fails", async () => {
    getWorkspaceMembershipBootstrapServerMock.mockRejectedValue(
      new Error("boom")
    )

    await renderWorkspaceLayout()

    expect(screen.getByText("Workspace content")).toBeInTheDocument()
    expect(authenticatedWorkspaceClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialWorkspaceId: "workspace_1",
        initialShellSeed: createMinimalWorkspaceShellSeed({
          authContext,
        }),
      })
    )
  })
})

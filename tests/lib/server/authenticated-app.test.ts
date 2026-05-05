import { beforeEach, describe, expect, it, vi } from "vitest"

const ensureConvexUserFromAuthMock = vi.fn()
const ensureWorkspaceScaffoldingServerMock = vi.fn()
const getAuthContextServerMock = vi.fn()
const getWorkspaceMembershipBootstrapServerMock = vi.fn()
const setWorkspaceWorkosOrganizationServerMock = vi.fn()
const ensureUserOrganizationMembershipMock = vi.fn()
const ensureWorkspaceOrganizationMock = vi.fn()
const getSelectedWorkspaceIdFromCookiesMock = vi.fn()
const toAuthenticatedAppUserMock = vi.fn()

vi.mock("@/lib/server/convex", () => ({
  ensureConvexUserFromAuth: ensureConvexUserFromAuthMock,
  ensureWorkspaceScaffoldingServer: ensureWorkspaceScaffoldingServerMock,
  getAuthContextServer: getAuthContextServerMock,
  getWorkspaceMembershipBootstrapServer: getWorkspaceMembershipBootstrapServerMock,
  setWorkspaceWorkosOrganizationServer: setWorkspaceWorkosOrganizationServerMock,
}))

vi.mock("@/lib/server/workos", () => ({
  ensureUserOrganizationMembership: ensureUserOrganizationMembershipMock,
  ensureWorkspaceOrganization: ensureWorkspaceOrganizationMock,
}))

vi.mock("@/lib/server/workspace-selection", () => ({
  getSelectedWorkspaceIdFromCookies: getSelectedWorkspaceIdFromCookiesMock,
}))

vi.mock("@/lib/workos/auth", () => ({
  toAuthenticatedAppUser: toAuthenticatedAppUserMock,
}))

const sessionUser = {
  id: "workos_1",
  email: "alex@example.com",
  firstName: "Alex",
  lastName: "Morgan",
}

function createAuthenticatedUser() {
  return {
    workosUserId: "workos_1",
    email: "alex@example.com",
    name: "Alex Morgan",
    avatarUrl: "AM",
  }
}

function createAuthContext() {
  return {
    currentUser: {
      id: "user_1",
    },
    currentWorkspace: {
      id: "workspace_1",
      slug: "alpha",
      name: "Alpha",
      logoUrl: "",
      workosOrganizationId: "org_existing",
    },
    isWorkspaceOwner: false,
    isWorkspaceAdmin: false,
    memberships: [
      {
        teamId: "team_1",
        role: "member",
      },
    ],
    pendingInvites: [
      {
        id: "invite_1",
      },
    ],
  }
}

function createSelectedWorkspaceBootstrap() {
  return {
    currentWorkspaceId: "workspace_2",
    workspaces: [
      {
        id: "workspace_2",
        slug: "beta",
        name: "Beta",
        logoUrl: "https://example.com/beta.png",
        workosOrganizationId: "org_beta",
        createdBy: "user_2",
      },
    ],
    teams: [
      {
        id: "team_2",
        workspaceId: "workspace_2",
      },
    ],
    workspaceMemberships: [
      {
        workspaceId: "workspace_2",
        userId: "user_1",
        role: "viewer",
      },
    ],
    teamMemberships: [
      {
        teamId: "team_2",
        userId: "user_1",
        role: "admin",
      },
    ],
  }
}

describe("authenticated app context", () => {
  beforeEach(() => {
    ensureConvexUserFromAuthMock.mockReset()
    ensureWorkspaceScaffoldingServerMock.mockReset()
    getAuthContextServerMock.mockReset()
    getWorkspaceMembershipBootstrapServerMock.mockReset()
    setWorkspaceWorkosOrganizationServerMock.mockReset()
    ensureUserOrganizationMembershipMock.mockReset()
    ensureWorkspaceOrganizationMock.mockReset()
    getSelectedWorkspaceIdFromCookiesMock.mockReset()
    toAuthenticatedAppUserMock.mockReset()

    toAuthenticatedAppUserMock.mockReturnValue(createAuthenticatedUser())
    getAuthContextServerMock.mockResolvedValue(createAuthContext())
    getSelectedWorkspaceIdFromCookiesMock.mockResolvedValue(null)
    ensureConvexUserFromAuthMock.mockResolvedValue({
      userId: "user_1",
      bootstrapped: true,
    })
    ensureWorkspaceOrganizationMock.mockResolvedValue({
      id: "org_reconciled",
    })
  })

  it("applies an accessible selected workspace override", async () => {
    const { ensureAuthenticatedAppContext } = await import(
      "@/lib/server/authenticated-app"
    )

    getSelectedWorkspaceIdFromCookiesMock.mockResolvedValue("workspace_2")
    getWorkspaceMembershipBootstrapServerMock.mockResolvedValue(
      createSelectedWorkspaceBootstrap()
    )

    const context = await ensureAuthenticatedAppContext(sessionUser as never, "org_1")

    expect(getWorkspaceMembershipBootstrapServerMock).toHaveBeenCalledWith({
      workosUserId: "workos_1",
      email: "alex@example.com",
      workspaceId: "workspace_2",
    })
    expect(context.authContext?.currentWorkspace).toEqual({
      id: "workspace_2",
      slug: "beta",
      name: "Beta",
      logoUrl: "https://example.com/beta.png",
      workosOrganizationId: "org_beta",
    })
    expect(context.authContext?.isWorkspaceOwner).toBe(false)
    expect(context.authContext?.isWorkspaceAdmin).toBe(true)
  })

  it("keeps the current context when the selected workspace is invalid", async () => {
    const { ensureAuthenticatedAppContext } = await import(
      "@/lib/server/authenticated-app"
    )

    getSelectedWorkspaceIdFromCookiesMock.mockResolvedValue("workspace_2")
    getWorkspaceMembershipBootstrapServerMock
      .mockResolvedValueOnce({
        ...createSelectedWorkspaceBootstrap(),
        currentWorkspaceId: "workspace_3",
      })
      .mockRejectedValueOnce(new Error("Provider unavailable"))

    await expect(
      ensureAuthenticatedAppContext(sessionUser as never, "org_1")
    ).resolves.toMatchObject({
      authContext: {
        currentWorkspace: {
          id: "workspace_1",
        },
      },
    })
    await expect(
      ensureAuthenticatedAppContext(sessionUser as never, "org_1")
    ).resolves.toMatchObject({
      authContext: {
        currentWorkspace: {
          id: "workspace_1",
        },
      },
    })
  })

  it("ensures a Convex user when auth context has no current user", async () => {
    const { ensureAuthenticatedAppContext } = await import(
      "@/lib/server/authenticated-app"
    )

    getAuthContextServerMock
      .mockResolvedValueOnce({
        ...createAuthContext(),
        currentUser: null,
      })
      .mockResolvedValueOnce(createAuthContext())

    const context = await ensureAuthenticatedAppContext(sessionUser as never, "org_1")

    expect(ensureConvexUserFromAuthMock).toHaveBeenCalledWith(
      createAuthenticatedUser()
    )
    expect(context.ensuredUser).toEqual({
      userId: "user_1",
      bootstrapped: true,
    })
  })

  it("returns workspace entry join state from the authenticated context", async () => {
    const { getWorkspaceEntryJoinState } = await import(
      "@/lib/server/authenticated-app"
    )

    await expect(
      getWorkspaceEntryJoinState(sessionUser as never, "org_1")
    ).resolves.toEqual({
      authContext: createAuthContext(),
      currentWorkspace: createAuthContext().currentWorkspace,
      joinedTeamIds: ["team_1"],
      pendingInvites: [
        {
          id: "invite_1",
        },
      ],
    })
  })

  it("reconciles organization membership and workspace scaffolding", async () => {
    const { reconcileAuthenticatedAppContext } = await import(
      "@/lib/server/authenticated-app"
    )

    const context = await reconcileAuthenticatedAppContext(
      sessionUser as never,
      "org_1"
    )

    expect(ensureWorkspaceOrganizationMock).toHaveBeenCalledWith({
      workspaceId: "workspace_1",
      slug: "alpha",
      name: "Alpha",
      existingOrganizationId: "org_existing",
    })
    expect(setWorkspaceWorkosOrganizationServerMock).toHaveBeenCalledWith({
      workspaceId: "workspace_1",
      workosOrganizationId: "org_reconciled",
    })
    expect(ensureUserOrganizationMembershipMock).toHaveBeenCalledWith({
      organizationId: "org_reconciled",
      workosUserId: "workos_1",
    })
    expect(ensureWorkspaceScaffoldingServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      workspaceId: "workspace_1",
    })
    expect(context.authContext?.currentWorkspace?.workosOrganizationId).toBe(
      "org_reconciled"
    )
  })
})

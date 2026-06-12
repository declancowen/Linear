import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ensureAuthenticatedAppContextMock = vi.fn()
const getWorkspaceMembershipBootstrapServerMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/authenticated-app", () => ({
  ensureAuthenticatedAppContext: ensureAuthenticatedAppContextMock,
}))

vi.mock("@/lib/server/convex", () => ({
  getWorkspaceMembershipBootstrapServer:
    getWorkspaceMembershipBootstrapServerMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  logProviderError: logProviderErrorMock,
}))

const session = {
  user: {
    id: "workos_user_1",
    email: "alex@example.com",
  },
  organizationId: "org_1",
} as never

const authContextWithWorkspace = {
  authContext: {
    currentWorkspace: {
      id: "ws_1",
      slug: "workspace-1",
      name: "Workspace 1",
    },
  },
}

describe("resolveTeamScopeFromSlug", () => {
  beforeEach(() => {
    ensureAuthenticatedAppContextMock.mockReset()
    getWorkspaceMembershipBootstrapServerMock.mockReset()
    logProviderErrorMock.mockReset()
    ensureAuthenticatedAppContextMock.mockResolvedValue(
      authContextWithWorkspace
    )
  })

  afterEach(() => {
    vi.resetModules()
  })

  it("resolves an accessible team slug to its team id and workspace id", async () => {
    getWorkspaceMembershipBootstrapServerMock.mockResolvedValue({
      teams: [
        { id: "team_1", slug: "platform", workspaceId: "ws_1" },
        { id: "team_2", slug: "design", workspaceId: "ws_1" },
      ],
    })

    const { resolveTeamScopeFromSlug } = await import(
      "@/lib/server/team-routing"
    )

    const scope = await resolveTeamScopeFromSlug(session, "design")

    expect(scope).toEqual({
      teamId: "team_2",
      workspaceId: "ws_1",
      teamSlug: "design",
    })
    expect(getWorkspaceMembershipBootstrapServerMock).toHaveBeenCalledWith({
      workosUserId: "workos_user_1",
      email: "alex@example.com",
      workspaceId: "ws_1",
    })
  })

  it("returns null when no team in the workspace matches the slug", async () => {
    getWorkspaceMembershipBootstrapServerMock.mockResolvedValue({
      teams: [{ id: "team_1", slug: "platform", workspaceId: "ws_1" }],
    })

    const { resolveTeamScopeFromSlug } = await import(
      "@/lib/server/team-routing"
    )

    const scope = await resolveTeamScopeFromSlug(session, "missing")

    expect(scope).toBeNull()
  })

  it("returns null and trims an empty slug without calling the loader", async () => {
    const { resolveTeamScopeFromSlug } = await import(
      "@/lib/server/team-routing"
    )

    const scope = await resolveTeamScopeFromSlug(session, "   ")

    expect(scope).toBeNull()
    expect(getWorkspaceMembershipBootstrapServerMock).not.toHaveBeenCalled()
  })

  it("returns null when the authenticated app context has no current workspace", async () => {
    ensureAuthenticatedAppContextMock.mockResolvedValue({
      authContext: { currentWorkspace: null },
    })

    const { resolveTeamScopeFromSlug } = await import(
      "@/lib/server/team-routing"
    )

    const scope = await resolveTeamScopeFromSlug(session, "platform")

    expect(scope).toBeNull()
    expect(getWorkspaceMembershipBootstrapServerMock).not.toHaveBeenCalled()
  })

  it("returns null and logs a provider error when the membership loader throws", async () => {
    getWorkspaceMembershipBootstrapServerMock.mockRejectedValue(
      new Error("convex unavailable")
    )

    const { resolveTeamScopeFromSlug } = await import(
      "@/lib/server/team-routing"
    )

    const scope = await resolveTeamScopeFromSlug(session, "platform")

    expect(scope).toBeNull()
    expect(logProviderErrorMock).toHaveBeenCalledTimes(1)
  })
})

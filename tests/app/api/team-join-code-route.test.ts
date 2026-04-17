import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const withGeneratedJoinCodeMock = vi.fn()
const regenerateTeamJoinCodeServerMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
}))

vi.mock("@/lib/server/join-codes", () => ({
  withGeneratedJoinCode: withGeneratedJoinCodeMock,
}))

vi.mock("@/lib/server/convex", () => ({
  regenerateTeamJoinCodeServer: regenerateTeamJoinCodeServerMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  getConvexErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  logProviderError: logProviderErrorMock,
}))

describe("team join-code route", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    withGeneratedJoinCodeMock.mockReset()
    regenerateTeamJoinCodeServerMock.mockReset()
    logProviderErrorMock.mockReset()

    withGeneratedJoinCodeMock.mockImplementation(
      async (task: (joinCode: string) => Promise<unknown>) =>
        task("ABC123DEF456")
    )
  })

  it("regenerates join codes through the narrow command path", async () => {
    const { POST } = await import("@/app/api/teams/[teamId]/join-code/route")

    requireSessionMock.mockResolvedValue({
      user: {
        id: "workos_1",
        email: "alex@example.com",
      },
      organizationId: "org_1",
    })
    requireAppContextMock.mockResolvedValue({
      ensuredUser: {
        userId: "user_1",
      },
    })
    regenerateTeamJoinCodeServerMock.mockResolvedValue({
      teamId: "team_1",
      joinCode: "ABC123DEF456",
    })

    const response = await POST(
      new Request("http://localhost/api/teams/team_1/join-code") as never,
      {
        params: Promise.resolve({
          teamId: "team_1",
        }),
      }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      joinCode: "ABC123DEF456",
    })
    expect(regenerateTeamJoinCodeServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      teamId: "team_1",
      joinCode: "ABC123DEF456",
    })
  })

  it("maps typed join-code failures onto stable route responses", async () => {
    const { POST } = await import("@/app/api/teams/[teamId]/join-code/route")

    requireSessionMock.mockResolvedValue({
      user: {
        id: "workos_1",
        email: "alex@example.com",
      },
      organizationId: "org_1",
    })
    requireAppContextMock.mockResolvedValue({
      ensuredUser: {
        userId: "user_1",
      },
    })
    regenerateTeamJoinCodeServerMock.mockRejectedValue(
      new ApplicationError("Only team admins can regenerate join codes", 403, {
        code: "TEAM_JOIN_CODE_ADMIN_REQUIRED",
      })
    )

    const response = await POST(
      new Request("http://localhost/api/teams/team_1/join-code") as never,
      {
        params: Promise.resolve({
          teamId: "team_1",
        }),
      }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: "Only team admins can regenerate join codes",
      message: "Only team admins can regenerate join codes",
      code: "TEAM_JOIN_CODE_ADMIN_REQUIRED",
    })
  })
})

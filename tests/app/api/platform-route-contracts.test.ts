import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const requireConvexUserMock = vi.fn()
const deleteChannelPostServerMock = vi.fn()
const toggleChannelPostReactionServerMock = vi.fn()
const getSnapshotServerMock = vi.fn()
const getSnapshotVersionServerMock = vi.fn()
const updateWorkOSUserEmailMock = vi.fn()
const requestWorkOSPasswordResetMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
  requireConvexUser: requireConvexUserMock,
}))

vi.mock("@/lib/server/convex", () => ({
  deleteChannelPostServer: deleteChannelPostServerMock,
  toggleChannelPostReactionServer: toggleChannelPostReactionServerMock,
  getSnapshotServer: getSnapshotServerMock,
  getSnapshotVersionServer: getSnapshotVersionServerMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  getConvexErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  getWorkOSErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  logProviderError: logProviderErrorMock,
}))

vi.mock("@/lib/server/workos", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/workos")>(
    "@/lib/server/workos"
  )

  return {
    ...actual,
    updateWorkOSUserEmail: updateWorkOSUserEmailMock,
    requestWorkOSPasswordReset: requestWorkOSPasswordResetMock,
  }
})

describe("platform route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    requireConvexUserMock.mockReset()
    deleteChannelPostServerMock.mockReset()
    toggleChannelPostReactionServerMock.mockReset()
    getSnapshotServerMock.mockReset()
    getSnapshotVersionServerMock.mockReset()
    updateWorkOSUserEmailMock.mockReset()
    requestWorkOSPasswordResetMock.mockReset()
    logProviderErrorMock.mockReset()

    requireSessionMock.mockResolvedValue({
      user: {
        id: "workos_1",
        email: "alex@example.com",
        firstName: "Alex",
        lastName: "Morgan",
      },
      organizationId: "org_1",
    })
    requireAppContextMock.mockResolvedValue({
      authenticatedUser: {
        workosUserId: "workos_1",
      },
      ensuredUser: {
        userId: "user_1",
      },
      authContext: {
        currentWorkspace: {
          id: "workspace_1",
        },
      },
    })
    requireConvexUserMock.mockResolvedValue({
      currentUser: {
        id: "user_1",
      },
    })
    getSnapshotVersionServerMock.mockResolvedValue({
      version: 0,
      currentUserId: "user_1",
    })
  })

  it("maps channel-post delete and reaction failures to typed error responses", async () => {
    const deleteRoute = await import("@/app/api/channel-posts/[postId]/route")
    const reactionsRoute = await import(
      "@/app/api/channel-posts/[postId]/reactions/route"
    )

    deleteChannelPostServerMock.mockRejectedValue(
      new ApplicationError("You can only delete your own posts", 403, {
        code: "CHANNEL_POST_DELETE_FORBIDDEN",
      })
    )
    toggleChannelPostReactionServerMock.mockRejectedValue(
      new ApplicationError("Post not found", 404, {
        code: "CHANNEL_POST_NOT_FOUND",
      })
    )

    const deleteResponse = await deleteRoute.DELETE(
      new Request("http://localhost/api/channel-posts/post_1", {
        method: "DELETE",
      }) as never,
      {
        params: Promise.resolve({
          postId: "post_1",
        }),
      }
    )

    expect(deleteResponse.status).toBe(403)
    await expect(deleteResponse.json()).resolves.toEqual({
      error: "You can only delete your own posts",
      message: "You can only delete your own posts",
      code: "CHANNEL_POST_DELETE_FORBIDDEN",
    })

    const reactionResponse = await reactionsRoute.POST(
      new Request("http://localhost/api/channel-posts/post_1/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emoji: ":+1:",
        }),
      }) as never,
      {
        params: Promise.resolve({
          postId: "post_1",
        }),
      }
    )

    expect(reactionResponse.status).toBe(404)
    await expect(reactionResponse.json()).resolves.toEqual({
      error: "Post not found",
      message: "Post not found",
      code: "CHANNEL_POST_NOT_FOUND",
    })
    expect(logProviderErrorMock).not.toHaveBeenCalled()
  })

  it("maps snapshot failures to typed error responses", async () => {
    const { GET } = await import("@/app/api/snapshot/route")

    getSnapshotServerMock.mockRejectedValue(
      new ApplicationError("Authenticated user not found", 404, {
        code: "SNAPSHOT_USER_NOT_FOUND",
      })
    )

    const response = await GET()

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Authenticated user not found",
      message: "Authenticated user not found",
      code: "SNAPSHOT_USER_NOT_FOUND",
    })
    expect(logProviderErrorMock).not.toHaveBeenCalled()
  })

  it("maps snapshot version outer failures without provider-error noise", async () => {
    const { GET } = await import("@/app/api/snapshot/version/route")

    requireConvexUserMock.mockRejectedValue(
      new ApplicationError("Authenticated user not found", 404, {
        code: "SNAPSHOT_USER_NOT_FOUND",
      })
    )

    const response = await GET()

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Authenticated user not found",
      message: "Authenticated user not found",
      code: "SNAPSHOT_USER_NOT_FOUND",
    })
    expect(logProviderErrorMock).not.toHaveBeenCalled()
  })

  it("maps WorkOS account failures to typed error responses", async () => {
    const emailRoute = await import("@/app/api/account/email/route")
    const passwordResetRoute = await import(
      "@/app/api/account/password-reset/route"
    )

    updateWorkOSUserEmailMock.mockRejectedValue({ status: 409 })
    requestWorkOSPasswordResetMock.mockRejectedValue({
      rawData: {
        error: "user_not_found",
      },
    })

    const emailResponse = await emailRoute.POST(
      new Request("http://localhost/api/account/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "updated@example.com",
        }),
      }) as never
    )

    expect(emailResponse.status).toBe(409)
    await expect(emailResponse.json()).resolves.toEqual({
      error: "That email address is already in use.",
      message: "That email address is already in use.",
      code: "ACCOUNT_EMAIL_CONFLICT",
    })

    const passwordResetResponse = await passwordResetRoute.POST()

    expect(passwordResetResponse.status).toBe(404)
    await expect(passwordResetResponse.json()).resolves.toEqual({
      error: "We couldn't find an account for that email.",
      message: "We couldn't find an account for that email.",
      code: "WORKOS_USER_NOT_FOUND",
    })
  })
})

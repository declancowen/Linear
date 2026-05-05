import { beforeEach, describe, expect, it, vi } from "vitest"

import { createFormRouteRequest } from "@/tests/lib/fixtures/api-routes"
import {
  getMockWorkOSAuthErrorCode,
  getMockWorkOSAuthErrorMessage,
  getMockWorkOSPendingAuthentication,
} from "@/tests/lib/fixtures/workos-auth-mocks"

const saveSessionMock = vi.fn()
const reconcileAuthenticatedAppContextMock = vi.fn()
const getWorkOSClientMock = vi.fn()
const requestWorkOSPasswordResetMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@workos-inc/authkit-nextjs", () => ({
  saveSession: saveSessionMock,
}))

vi.mock("@/lib/server/authenticated-app", () => ({
  reconcileAuthenticatedAppContext: reconcileAuthenticatedAppContextMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  logProviderError: logProviderErrorMock,
}))

vi.mock("@/lib/server/workos", () => ({
  getWorkOSClient: getWorkOSClientMock,
  requestWorkOSPasswordReset: requestWorkOSPasswordResetMock,
  getWorkOSAuthErrorCode: getMockWorkOSAuthErrorCode,
  getWorkOSAuthErrorMessage: getMockWorkOSAuthErrorMessage,
  getWorkOSPendingAuthentication: getMockWorkOSPendingAuthentication,
}))

describe("auth route provider logging", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    saveSessionMock.mockReset()
    reconcileAuthenticatedAppContextMock.mockReset()
    getWorkOSClientMock.mockReset()
    requestWorkOSPasswordResetMock.mockReset()
    logProviderErrorMock.mockReset()
  })

  it("logs signup creation failures through the sanitized provider logger", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)

    const createUserMock = vi.fn().mockRejectedValue({
      rawData: {
        error: "provider_down",
        message: "Provider unavailable",
        pending_authentication_token: "secret-token",
      },
    })

    getWorkOSClientMock.mockReturnValue({
      userManagement: {
        createUser: createUserMock,
        authenticateWithPassword: vi.fn(),
      },
    })

    const { POST } = await import("@/app/auth/signup/route")
    const response = await POST(
      createFormRouteRequest("http://localhost/auth/signup", {
        firstName: "Alex",
        lastName: "Morgan",
        email: "alex@example.com",
        password: "super-secret",
        next: "/workspace",
      })
    )

    expect(response.status).toBe(303)
    expect(logProviderErrorMock).toHaveBeenCalledWith(
      "WorkOS signup failed",
      expect.objectContaining({
        rawData: expect.objectContaining({
          pending_authentication_token: "secret-token",
        }),
      })
    )
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("logs signup authentication failures through the sanitized provider logger", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)

    const authenticateWithPasswordMock = vi.fn().mockRejectedValue({
      rawData: {
        error: "invalid_password",
        message: "Password policy rejected",
      },
    })

    getWorkOSClientMock.mockReturnValue({
      userManagement: {
        createUser: vi.fn().mockResolvedValue({}),
        authenticateWithPassword: authenticateWithPasswordMock,
      },
    })

    const { POST } = await import("@/app/auth/signup/route")
    const response = await POST(
      createFormRouteRequest("http://localhost/auth/signup", {
        firstName: "Alex",
        lastName: "Morgan",
        email: "alex@example.com",
        password: "weak-password",
        next: "/workspace",
      })
    )

    expect(response.status).toBe(303)
    expect(logProviderErrorMock).toHaveBeenCalledWith(
      "WorkOS signup authentication failed",
      expect.objectContaining({
        rawData: expect.objectContaining({
          error: "invalid_password",
        }),
      })
    )
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("logs forgot-password failures through the sanitized provider logger", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)

    requestWorkOSPasswordResetMock.mockRejectedValue({
      rawData: {
        error: "rate_limited",
        message: "Try again later",
      },
    })

    const { POST } = await import("@/app/auth/forgot-password/route")
    const response = await POST(
      createFormRouteRequest("http://localhost/auth/forgot-password", {
        email: "alex@example.com",
        next: "/login",
      })
    )

    expect(response.status).toBe(303)
    expect(logProviderErrorMock).toHaveBeenCalledWith(
      "Failed to request password reset",
      expect.objectContaining({
        rawData: expect.objectContaining({
          error: "rate_limited",
        }),
      })
    )
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"

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
  getWorkOSAuthErrorCode: (error: unknown) => {
    if (typeof error !== "object" || error === null) {
      return null
    }

    const rawData =
      "rawData" in error &&
      typeof error.rawData === "object" &&
      error.rawData !== null
        ? error.rawData
        : null

    if (
      rawData &&
      "error" in rawData &&
      typeof rawData.error === "string"
    ) {
      return rawData.error
    }

    return "error" in error && typeof error.error === "string"
      ? error.error
      : null
  },
  getWorkOSAuthErrorMessage: (error: unknown) => {
    if (typeof error !== "object" || error === null) {
      return null
    }

    const rawData =
      "rawData" in error &&
      typeof error.rawData === "object" &&
      error.rawData !== null
        ? error.rawData
        : null

    if (
      rawData &&
      "message" in rawData &&
      typeof rawData.message === "string"
    ) {
      return rawData.message
    }

    return "message" in error && typeof error.message === "string"
      ? error.message
      : null
  },
  getWorkOSPendingAuthentication: (error: unknown) => {
    if (typeof error !== "object" || error === null) {
      return null
    }

    const rawData =
      "rawData" in error &&
      typeof error.rawData === "object" &&
      error.rawData !== null
        ? error.rawData
        : null

    const pendingAuthenticationToken =
      rawData &&
      "pending_authentication_token" in rawData &&
      typeof rawData.pending_authentication_token === "string"
        ? rawData.pending_authentication_token
        : "pendingAuthenticationToken" in error &&
            typeof error.pendingAuthenticationToken === "string"
          ? error.pendingAuthenticationToken
          : null

    if (!pendingAuthenticationToken) {
      return null
    }

    return {
      email:
        rawData && "email" in rawData && typeof rawData.email === "string"
          ? rawData.email
          : null,
      pendingAuthenticationToken,
    }
  },
}))

function buildFormRequest(url: string, entries: Record<string, string>) {
  const formData = new FormData()

  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value)
  }

  return new Request(url, {
    method: "POST",
    body: formData,
  })
}

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
      buildFormRequest("http://localhost/auth/signup", {
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
      buildFormRequest("http://localhost/auth/signup", {
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
      buildFormRequest("http://localhost/auth/forgot-password", {
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

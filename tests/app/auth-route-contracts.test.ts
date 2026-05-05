import { beforeEach, describe, expect, it, vi } from "vitest"

import { createFormRouteRequest } from "@/tests/lib/fixtures/api-routes"
import {
  pendingEmailVerificationCookieName,
  serializePendingEmailVerificationState,
} from "@/lib/auth-email-verification"
import {
  getMockWorkOSAuthErrorCode,
  getMockWorkOSPendingAuthentication,
} from "@/tests/lib/fixtures/workos-auth-mocks"

const saveSessionMock = vi.fn()
const reconcileAuthenticatedAppContextMock = vi.fn()
const authenticateWithCodeMock = vi.fn()
const authenticateWithEmailVerificationMock = vi.fn()
const authenticateWithPasswordMock = vi.fn()
const authenticateWithOrganizationSelectionMock = vi.fn()
const listUsersMock = vi.fn()
const listOrganizationMembershipsMock = vi.fn()
const resetWorkOSPasswordMock = vi.fn()
const requestWorkOSPasswordResetMock = vi.fn()
const mapWorkOSAccountErrorMock = vi.fn()
const listWorkspacesForSyncServerMock = vi.fn()

vi.mock("@workos-inc/authkit-nextjs", () => ({
  saveSession: saveSessionMock,
}))

vi.mock("@/lib/server/authenticated-app", () => ({
  reconcileAuthenticatedAppContext: reconcileAuthenticatedAppContextMock,
}))

vi.mock("@/lib/server/workos", () => ({
  getWorkOSClient: () => ({
    userManagement: {
      authenticateWithCode: authenticateWithCodeMock,
      authenticateWithEmailVerification: authenticateWithEmailVerificationMock,
      authenticateWithPassword: authenticateWithPasswordMock,
      authenticateWithOrganizationSelection:
        authenticateWithOrganizationSelectionMock,
      listUsers: listUsersMock,
      listOrganizationMemberships: listOrganizationMembershipsMock,
    },
  }),
  getWorkOSAuthErrorCode: getMockWorkOSAuthErrorCode,
  getWorkOSPendingAuthentication: getMockWorkOSPendingAuthentication,
  resetWorkOSPassword: resetWorkOSPasswordMock,
  requestWorkOSPasswordReset: requestWorkOSPasswordResetMock,
  mapWorkOSAccountError: mapWorkOSAccountErrorMock,
}))

vi.mock("@/lib/server/convex/auth", () => ({
  listWorkspacesForSyncServer: listWorkspacesForSyncServerMock,
}))

function getRedirectPath(response: Response) {
  const location = response.headers.get("location")
  expect(location).toBeTruthy()
  return new URL(location ?? "http://localhost", "http://localhost")
}

function expectLoginErrorRedirect(response: Response, error: string) {
  const redirectUrl = getRedirectPath(response)

  expect(response.status).toBe(307)
  expect(redirectUrl.pathname).toBe("/login")
  expect(redirectUrl.searchParams.get("error")).toBe(error)
}

function expectForgotPasswordRedirect(response: Response) {
  const redirectUrl = getRedirectPath(response)

  expect(response.status).toBe(303)
  expect(redirectUrl.pathname).toBe("/forgot-password")
  expect(redirectUrl.searchParams.get("next")).toBe("/workspace/docs")
  expect(redirectUrl.searchParams.has("nextPath")).toBe(false)

  return redirectUrl
}

function buildAuthState(input: { mode: "login" | "signup"; nextPath: string }) {
  return JSON.stringify(input)
}

function resetAuthRouteMocks() {
  vi.restoreAllMocks()
  saveSessionMock.mockReset()
  reconcileAuthenticatedAppContextMock.mockReset()
  authenticateWithCodeMock.mockReset()
  authenticateWithEmailVerificationMock.mockReset()
  authenticateWithPasswordMock.mockReset()
  authenticateWithOrganizationSelectionMock.mockReset()
  listUsersMock.mockReset()
  listOrganizationMembershipsMock.mockReset()
  resetWorkOSPasswordMock.mockReset()
  requestWorkOSPasswordResetMock.mockReset()
  mapWorkOSAccountErrorMock.mockReset()
  mapWorkOSAccountErrorMock.mockReturnValue("Provider account error")
  listWorkspacesForSyncServerMock.mockReset()
  listWorkspacesForSyncServerMock.mockResolvedValue([])
}

function createForgotPasswordRequest(
  entries: Partial<{
    email: string
    next: string
  }> = {}
) {
  return createFormRouteRequest("http://localhost/auth/forgot-password", {
    email: "alex@example.com",
    next: "/workspace/docs",
    ...entries,
  })
}

function createResetPasswordRequest(
  entries: Partial<{
    token: string
    password: string
    confirmPassword: string
    next: string
  }> = {}
) {
  return createFormRouteRequest("http://localhost/auth/reset-password", {
    token: "reset-token",
    password: "new-password",
    confirmPassword: "new-password",
    next: "/workspace/docs",
    ...entries,
  })
}

async function postResetPassword(
  entries?: Parameters<typeof createResetPasswordRequest>[0]
) {
  const { POST } = await import("@/app/auth/reset-password/route")
  const response = await POST(createResetPasswordRequest(entries))

  return {
    response,
    redirectUrl: getRedirectPath(response),
  }
}

function createEmailVerificationRequest(
  entries: Partial<{
    code: string
    email: string
    mode: string
    next: string
  }> = {},
  cookieValue?: string
) {
  const request = createFormRouteRequest(
    "http://localhost/auth/verify-email",
    {
      code: "123456",
      email: "alex@example.com",
      mode: "login",
      next: "/workspace/docs",
      ...entries,
    }
  ) as Request & {
    cookies: {
      get: ReturnType<typeof vi.fn>
    }
  }

  Object.defineProperty(request, "cookies", {
    value: {
      get: vi.fn(() =>
        cookieValue
          ? {
              value: cookieValue,
            }
          : undefined
      ),
    },
  })

  return request
}

function createPendingEmailVerificationCookie(
  overrides: Partial<{
    email: string
    mode: "login" | "signup"
    nextPath: string
    pendingAuthenticationToken: string
  }> = {}
) {
  return serializePendingEmailVerificationState({
    email: "alex@example.com",
    mode: "login",
    nextPath: "/workspace/docs",
    pendingAuthenticationToken: "pending-token",
    ...overrides,
  })
}

function createLoginRequest(
  entries: Partial<{
    email: string
    password: string
    next: string
  }> = {}
) {
  return createFormRouteRequest("http://localhost/auth/login", {
    email: "declan@reciperoom.io",
    password: "password-123",
    next: "/workspace/chats",
    ...entries,
  })
}

describe("auth callback route", () => {
  beforeEach(resetAuthRouteMocks)

  it("redirects missing authorization codes back to the requested auth page", async () => {
    const { GET } = await import("@/app/auth/callback/route")
    const state = buildAuthState({
      mode: "signup",
      nextPath: "/workspace/projects",
    })
    const response = await GET(
      new Request(
        `http://localhost/auth/callback?state=${encodeURIComponent(state)}`
      )
    )
    const redirectUrl = getRedirectPath(response)

    expect(response.status).toBe(307)
    expect(redirectUrl.pathname).toBe("/signup")
    expect(redirectUrl.searchParams.get("next")).toBe("/workspace/projects")
    expect(redirectUrl.searchParams.get("error")).toBe(
      "Missing authorization code from WorkOS."
    )
    expect(authenticateWithCodeMock).not.toHaveBeenCalled()
  })

  it("uses provider error descriptions when WorkOS returns callback errors", async () => {
    const { GET } = await import("@/app/auth/callback/route")
    const response = await GET(
      new Request(
        "http://localhost/auth/callback?error=access_denied&error_description=Denied"
      )
    )

    expectLoginErrorRedirect(response, "Denied")
  })

  it("saves the WorkOS session and redirects to the post-auth destination", async () => {
    const authResponse = {
      user: { id: "workos_user" },
      organizationId: "org_123",
    }
    authenticateWithCodeMock.mockResolvedValue(authResponse)
    const { GET } = await import("@/app/auth/callback/route")
    const state = buildAuthState({
      mode: "login",
      nextPath: "/workspace/settings",
    })
    const response = await GET(
      new Request(
        `http://localhost/auth/callback?code=abc123&state=${encodeURIComponent(state)}`
      )
    )
    const redirectUrl = getRedirectPath(response)

    expect(response.status).toBe(307)
    expect(authenticateWithCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "abc123",
      })
    )
    expect(saveSessionMock).toHaveBeenCalledWith(
      authResponse,
      expect.stringContaining("/auth/callback")
    )
    expect(reconcileAuthenticatedAppContextMock).toHaveBeenCalledWith(
      authResponse.user,
      "org_123"
    )
    expect(redirectUrl.pathname).toBe("/workspace/settings")
  })

  it("redirects failed code exchanges back to the login page", async () => {
    authenticateWithCodeMock.mockRejectedValue(new Error("provider down"))
    const { GET } = await import("@/app/auth/callback/route")
    const response = await GET(
      new Request("http://localhost/auth/callback?code=abc123")
    )

    expectLoginErrorRedirect(
      response,
      "We couldn't complete authentication with that provider."
    )
  })
})

describe("auth email verification route", () => {
  beforeEach(resetAuthRouteMocks)

  it("redirects expired verification sessions to the fallback auth page", async () => {
    const { POST } = await import("@/app/auth/verify-email/route")
    const response = await POST(
      createEmailVerificationRequest({
        mode: "signup",
        email: "sam@example.com",
        next: "/workspace/projects",
      }) as never
    )
    const redirectUrl = getRedirectPath(response)

    expect(response.status).toBe(303)
    expect(redirectUrl.pathname).toBe("/signup")
    expect(redirectUrl.searchParams.get("email")).toBe("sam@example.com")
    expect(redirectUrl.searchParams.get("next")).toBe("/workspace/projects")
    expect(redirectUrl.searchParams.get("error")).toBe(
      "Your verification session expired. Sign in again."
    )
    expect(authenticateWithEmailVerificationMock).not.toHaveBeenCalled()
  })

  it("redirects missing verification codes back to the verification form", async () => {
    const { POST } = await import("@/app/auth/verify-email/route")
    const response = await POST(
      createEmailVerificationRequest(
        {
          code: "",
        },
        createPendingEmailVerificationCookie({
          mode: "signup",
          email: "sam@example.com",
          nextPath: "/workspace/chats",
        })
      ) as never
    )
    const redirectUrl = getRedirectPath(response)

    expect(response.status).toBe(303)
    expect(redirectUrl.pathname).toBe("/verify-email")
    expect(redirectUrl.searchParams.get("mode")).toBe("signup")
    expect(redirectUrl.searchParams.get("email")).toBe("sam@example.com")
    expect(redirectUrl.searchParams.get("next")).toBe("/workspace/chats")
    expect(redirectUrl.searchParams.get("error")).toBe(
      "Enter the verification code from WorkOS."
    )
  })

  it("authenticates verification codes and clears the pending cookie", async () => {
    const authResponse = {
      user: { id: "workos_user" },
      organizationId: "org_recipe",
    }
    authenticateWithEmailVerificationMock.mockResolvedValue(authResponse)
    const { POST } = await import("@/app/auth/verify-email/route")
    const response = await POST(
      createEmailVerificationRequest(
        {
          code: " 654321 ",
        },
        createPendingEmailVerificationCookie()
      ) as never
    )
    const redirectUrl = getRedirectPath(response)

    expect(authenticateWithEmailVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "654321",
        pendingAuthenticationToken: "pending-token",
      })
    )
    expect(saveSessionMock).toHaveBeenCalledWith(
      authResponse,
      "http://localhost/auth/verify-email"
    )
    expect(reconcileAuthenticatedAppContextMock).toHaveBeenCalledWith(
      authResponse.user,
      "org_recipe"
    )
    expect(redirectUrl.pathname).toBe("/workspace/docs")
    expect(response.headers.get("set-cookie")).toContain(
      `${pendingEmailVerificationCookieName}=`
    )
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0")
  })

  it("keeps pending authentication state when provider verification fails", async () => {
    authenticateWithEmailVerificationMock.mockRejectedValue({
      rawData: {
        error: "invalid_grant",
        email: "retry@example.com",
        pending_authentication_token: "pending-token-2",
      },
    })
    const { POST } = await import("@/app/auth/verify-email/route")
    const response = await POST(
      createEmailVerificationRequest(
        {},
        createPendingEmailVerificationCookie({
          email: "alex@example.com",
        })
      ) as never
    )
    const redirectUrl = getRedirectPath(response)
    const setCookie = response.headers.get("set-cookie") ?? ""

    expect(response.status).toBe(303)
    expect(redirectUrl.pathname).toBe("/verify-email")
    expect(redirectUrl.searchParams.get("email")).toBe("retry@example.com")
    expect(redirectUrl.searchParams.get("error")).toBe(
      "That verification code was not accepted."
    )
    expect(setCookie).toContain(`${pendingEmailVerificationCookieName}=`)
    expect(
      Buffer.from(
        setCookie.match(/pending_email_verification=([^;]+)/)?.[1] ?? "",
        "base64url"
      ).toString("utf8")
    ).toContain("pending-token-2")
  })
})

describe("auth login route", () => {
  beforeEach(resetAuthRouteMocks)

  it("completes WorkOS organization selection for a known workspace member", async () => {
    const authResponse = {
      user: { id: "workos_user" },
      organizationId: "org_recipe",
    }

    authenticateWithPasswordMock.mockRejectedValue({
      rawData: {
        error: "organization_selection_required",
        pending_authentication_token: "pending_token",
      },
    })
    authenticateWithOrganizationSelectionMock.mockResolvedValue(authResponse)
    listUsersMock.mockResolvedValue({
      data: [
        {
          id: "workos_user",
          email: "declan@reciperoom.io",
        },
      ],
    })
    listOrganizationMembershipsMock.mockResolvedValue({
      data: [
        {
          organizationId: "org_seed",
          status: "active",
        },
        {
          organizationId: "org_recipe",
          status: "active",
        },
      ],
    })
    listWorkspacesForSyncServerMock.mockResolvedValue([
      {
        id: "workspace_seed",
        slug: "acme",
        name: "Acme",
        workosOrganizationId: "org_seed",
      },
      {
        id: "workspace_recipe",
        slug: "recipe-room",
        name: "Recipe Room",
        workosOrganizationId: "org_recipe",
      },
    ])

    const { POST } = await import("@/app/auth/login/route")
    const response = await POST(createLoginRequest())
    const redirectUrl = getRedirectPath(response)

    expect(response.status).toBe(303)
    expect(redirectUrl.pathname).toBe("/workspace/chats")
    expect(authenticateWithOrganizationSelectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingAuthenticationToken: "pending_token",
        organizationId: "org_recipe",
      })
    )
    expect(saveSessionMock).toHaveBeenCalledWith(
      authResponse,
      expect.stringContaining("/auth/login")
    )
    expect(reconcileAuthenticatedAppContextMock).toHaveBeenCalledWith(
      authResponse.user,
      "org_recipe"
    )
  })
})

describe("forgot password route", () => {
  beforeEach(resetAuthRouteMocks)

  it("preserves the next query parameter on validation redirects", async () => {
    const { POST } = await import("@/app/auth/forgot-password/route")
    const response = await POST(
      createForgotPasswordRequest({
        email: "",
        next: "/workspace/docs",
      })
    )
    const redirectUrl = expectForgotPasswordRedirect(response)

    expect(redirectUrl.searchParams.get("error")).toBe(
      "Enter the email you use to sign in."
    )
    expect(requestWorkOSPasswordResetMock).not.toHaveBeenCalled()
  })

  it("preserves the next query parameter on notice redirects", async () => {
    requestWorkOSPasswordResetMock.mockResolvedValue(undefined)
    const { POST } = await import("@/app/auth/forgot-password/route")
    const response = await POST(createForgotPasswordRequest())
    const redirectUrl = expectForgotPasswordRedirect(response)

    expect(redirectUrl.searchParams.get("email")).toBe("alex@example.com")
    expect(redirectUrl.searchParams.get("notice")).toBe(
      "If an account exists for that email, a password reset link has been sent."
    )
    expect(requestWorkOSPasswordResetMock).toHaveBeenCalledWith(
      "alex@example.com"
    )
  })
})

describe("reset password route", () => {
  beforeEach(resetAuthRouteMocks)

  it("requires the reset token and password fields", async () => {
    const { POST } = await import("@/app/auth/reset-password/route")

    const missingToken = await POST(
      createResetPasswordRequest({
        token: "",
        next: "/workspace",
      })
    )
    const missingPassword = await POST(
      createResetPasswordRequest({
        password: "",
        next: "/workspace",
      })
    )

    expect(getRedirectPath(missingToken).searchParams.get("error")).toBe(
      "That password reset link is missing its token."
    )
    expect(getRedirectPath(missingToken).searchParams.get("next")).toBe(
      "/workspace"
    )
    expect(getRedirectPath(missingToken).searchParams.has("nextPath")).toBe(
      false
    )
    expect(getRedirectPath(missingPassword).searchParams.get("error")).toBe(
      "Enter a new password."
    )
    expect(getRedirectPath(missingPassword).searchParams.get("next")).toBe(
      "/workspace"
    )
    expect(getRedirectPath(missingPassword).searchParams.has("nextPath")).toBe(
      false
    )
    expect(resetWorkOSPasswordMock).not.toHaveBeenCalled()
  })

  it("rejects mismatched password confirmation", async () => {
    const { POST } = await import("@/app/auth/reset-password/route")
    const response = await POST(
      createResetPasswordRequest({
        confirmPassword: "different-password",
        next: "/workspace",
      })
    )
    const redirectUrl = getRedirectPath(response)

    expect(response.status).toBe(303)
    expect(redirectUrl.pathname).toBe("/reset-password")
    expect(redirectUrl.searchParams.get("error")).toBe(
      "The passwords do not match."
    )
    expect(redirectUrl.searchParams.get("next")).toBe("/workspace")
    expect(redirectUrl.searchParams.has("nextPath")).toBe(false)
    expect(resetWorkOSPasswordMock).not.toHaveBeenCalled()
  })

  it("resets the password and redirects to login with a notice", async () => {
    resetWorkOSPasswordMock.mockResolvedValue(undefined)
    const { response, redirectUrl } = await postResetPassword()

    expect(response.status).toBe(303)
    expect(resetWorkOSPasswordMock).toHaveBeenCalledWith({
      token: "reset-token",
      newPassword: "new-password",
    })
    expect(redirectUrl.pathname).toBe("/login")
    expect(redirectUrl.searchParams.get("next")).toBe("/workspace/docs")
    expect(redirectUrl.searchParams.get("notice")).toBe(
      "Password updated. Sign in with your new password."
    )
  })

  it("maps provider failures back to the reset password page", async () => {
    const providerError = new Error("provider down")
    resetWorkOSPasswordMock.mockRejectedValue(providerError)
    mapWorkOSAccountErrorMock.mockReturnValue("Try again later.")
    const { response, redirectUrl } = await postResetPassword()

    expect(response.status).toBe(303)
    expect(mapWorkOSAccountErrorMock).toHaveBeenCalledWith(
      providerError,
      "We couldn't reset your password."
    )
    expect(redirectUrl.pathname).toBe("/reset-password")
    expect(redirectUrl.searchParams.get("next")).toBe("/workspace/docs")
    expect(redirectUrl.searchParams.has("nextPath")).toBe(false)
    expect(redirectUrl.searchParams.get("error")).toBe("Try again later.")
  })
})

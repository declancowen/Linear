import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createFormRouteRequest,
  createJsonRouteRequest,
} from "@/tests/lib/fixtures/api-routes"
import {
  pendingEmailVerificationCookieName,
  serializePendingEmailVerificationState,
} from "@/lib/auth-email-verification"
import { desktopAuthStateCookieName } from "@/lib/server/desktop-auth"
import {
  getMockWorkOSAuthErrorCode,
  getMockWorkOSAuthErrorMessage,
  getMockWorkOSPendingAuthentication,
} from "@/tests/lib/fixtures/workos-auth-mocks"

const saveSessionMock = vi.fn()
const reconcileAuthenticatedAppContextMock = vi.fn()
const authenticateWithCodeMock = vi.fn()
const getAuthorizationUrlMock = vi.fn()
const authenticateWithEmailVerificationMock = vi.fn()
const authenticateWithPasswordMock = vi.fn()
const authenticateWithOrganizationSelectionMock = vi.fn()
const createUserMock = vi.fn()
const listUsersMock = vi.fn()
const listOrganizationMembershipsMock = vi.fn()
const resetWorkOSPasswordMock = vi.fn()
const requestWorkOSPasswordResetMock = vi.fn()
const mapWorkOSAccountErrorMock = vi.fn()
const listWorkspacesForSyncServerMock = vi.fn()
const consumeDesktopHandoffTicketServerMock = vi.fn()

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
      getAuthorizationUrl: getAuthorizationUrlMock,
      authenticateWithEmailVerification: authenticateWithEmailVerificationMock,
      authenticateWithPassword: authenticateWithPasswordMock,
      authenticateWithOrganizationSelection:
        authenticateWithOrganizationSelectionMock,
      createUser: createUserMock,
      listUsers: listUsersMock,
      listOrganizationMemberships: listOrganizationMembershipsMock,
    },
  }),
  getWorkOSAuthErrorCode: getMockWorkOSAuthErrorCode,
  getWorkOSAuthErrorMessage: getMockWorkOSAuthErrorMessage,
  getWorkOSPendingAuthentication: getMockWorkOSPendingAuthentication,
  resetWorkOSPassword: resetWorkOSPasswordMock,
  requestWorkOSPasswordReset: requestWorkOSPasswordResetMock,
  mapWorkOSAccountError: mapWorkOSAccountErrorMock,
}))

vi.mock("@/lib/server/convex/auth", () => ({
  consumeDesktopHandoffTicketServer: consumeDesktopHandoffTicketServerMock,
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

function buildDesktopCallbackState(input: {
  mode: "login" | "signup"
  nextPath: string
  nonce: string
}) {
  return JSON.stringify({
    ...input,
    surface: "desktop",
  })
}

function buildDesktopAuthCookie(nonce: string) {
  return `${desktopAuthStateCookieName}=${encodeURIComponent(nonce)}`
}

function expectSavedWorkOSSession(
  authResponse: {
    organizationId: string
    user: unknown
  },
  callbackPath: string
) {
  expect(authenticateWithCodeMock).toHaveBeenCalledWith(
    expect.objectContaining({
      code: "abc123",
    })
  )
  expect(saveSessionMock).toHaveBeenCalledWith(
    authResponse,
    expect.stringContaining(callbackPath)
  )
  expect(reconcileAuthenticatedAppContextMock).toHaveBeenCalledWith(
    authResponse.user,
    authResponse.organizationId
  )
}

function expectDesktopHandoffRedirect(
  redirectUrl: URL,
  expectedNextPath: string
) {
  expect(redirectUrl.protocol).toBe("recipe-room:")
  expect(redirectUrl.hostname).toBe("open")
  expect(redirectUrl.searchParams.get("path")).toEqual(
    expect.stringContaining("/auth/desktop/complete?ticket=")
  )
  expect(redirectUrl.searchParams.get("path")).toEqual(
    expect.stringContaining(`next=${encodeURIComponent(expectedNextPath)}`)
  )
}

function expectDesktopRendererRedirect(response: Response, expectedPath: string) {
  const redirectUrl = getRedirectPath(response)
  const handoffPath = redirectUrl.searchParams.get("path") ?? ""
  const localUrl = new URL(handoffPath, "https://desktop.local")

  expect(response.status).toBe(303)
  expect(redirectUrl.protocol).toBe("recipe-room:")
  expect(localUrl.pathname).toBe(expectedPath)

  return localUrl
}

async function postDesktopPasswordLogin() {
  const { POST } = await import("@/app/auth/desktop/login/route")

  return POST(
    createFormRouteRequest("http://localhost/auth/desktop/login", {
      email: "declan@reciperoom.io",
      password: "password-123",
      next: "/workspace/chats",
    })
  )
}

async function postDesktopPasswordSignup(
  entries: Partial<{
    email: string
    firstName: string
    lastName: string
    password: string
    next: string
  }> = {}
) {
  const { POST } = await import("@/app/auth/desktop/signup/route")

  return POST(
    createFormRouteRequest("http://localhost/auth/desktop/signup", {
      email: "alex@example.com",
      firstName: "Alex",
      lastName: "Morgan",
      password: "password-123",
      next: "/workspace/docs",
      ...entries,
    })
  )
}

async function getCallbackSuccessRedirect(input: {
  loadRoute: () => Promise<{
    GET: (request: Request) => Promise<Response>
  }>
  routePath: string
  state?: string
  cookie?: string
}) {
  const { GET } = await input.loadRoute()
  const state =
    input.state ??
    buildAuthState({
      mode: "login",
      nextPath: "/workspace/settings",
    })
  const response = await GET(
    new Request(
      `http://localhost${input.routePath}?code=abc123&state=${encodeURIComponent(state)}`,
      input.cookie
        ? {
            headers: {
              cookie: input.cookie,
            },
          }
        : undefined
    )
  )

  return {
    redirectUrl: getRedirectPath(response),
    response,
  }
}

function resetAuthRouteMocks() {
  vi.restoreAllMocks()
  saveSessionMock.mockReset()
  reconcileAuthenticatedAppContextMock.mockReset()
  authenticateWithCodeMock.mockReset()
  getAuthorizationUrlMock.mockReset()
  getAuthorizationUrlMock.mockReturnValue("https://auth.workos.com/oauth")
  authenticateWithEmailVerificationMock.mockReset()
  authenticateWithPasswordMock.mockReset()
  authenticateWithOrganizationSelectionMock.mockReset()
  createUserMock.mockReset()
  listUsersMock.mockReset()
  listOrganizationMembershipsMock.mockReset()
  resetWorkOSPasswordMock.mockReset()
  requestWorkOSPasswordResetMock.mockReset()
  mapWorkOSAccountErrorMock.mockReset()
  mapWorkOSAccountErrorMock.mockReturnValue("Provider account error")
  listWorkspacesForSyncServerMock.mockReset()
  listWorkspacesForSyncServerMock.mockResolvedValue([])
  consumeDesktopHandoffTicketServerMock.mockReset()
  consumeDesktopHandoffTicketServerMock.mockResolvedValue({
    consumed: true,
  })
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
  const request = createFormRouteRequest("http://localhost/auth/verify-email", {
    code: "123456",
    email: "alex@example.com",
    mode: "login",
    next: "/workspace/docs",
    ...entries,
  }) as Request & {
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
    const { redirectUrl, response } = await getCallbackSuccessRedirect({
      loadRoute: () => import("@/app/auth/callback/route"),
      routePath: "/auth/callback",
    })

    expect(response.status).toBe(307)
    expectSavedWorkOSSession(authResponse, "/auth/callback")
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

describe("desktop auth routes", () => {
  const originalAppUrl = process.env.APP_URL
  const originalDesktopRedirectUri = process.env.DESKTOP_WORKOS_REDIRECT_URI
  const originalDesktopDeepLinkScheme = process.env.DESKTOP_DEEP_LINK_SCHEME
  const originalDesktopSessionSecret = process.env.DESKTOP_SESSION_SECRET

  beforeEach(() => {
    resetAuthRouteMocks()
    process.env.APP_URL = "https://teams.example.com"
    delete process.env.DESKTOP_WORKOS_REDIRECT_URI
    process.env.DESKTOP_DEEP_LINK_SCHEME = "recipe-room"
    process.env.DESKTOP_SESSION_SECRET = "x".repeat(32)
  })

  afterEach(() => {
    process.env.APP_URL = originalAppUrl
    process.env.DESKTOP_WORKOS_REDIRECT_URI = originalDesktopRedirectUri
    process.env.DESKTOP_DEEP_LINK_SCHEME = originalDesktopDeepLinkScheme
    process.env.DESKTOP_SESSION_SECRET = originalDesktopSessionSecret
  })

  it("starts desktop auth through hosted WorkOS with a desktop callback", async () => {
    const { GET } = await import("@/app/auth/desktop/start/route")
    const response = await GET(
      new Request(
        "http://localhost/auth/desktop/start?mode=signup&next=/workspace/docs"
      )
    )
    const redirectUrl = getRedirectPath(response)
    const state = JSON.parse(getAuthorizationUrlMock.mock.calls[0][0].state)

    expect(response.status).toBe(307)
    expect(redirectUrl.toString()).toBe("https://auth.workos.com/oauth")
    expect(getAuthorizationUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "authkit",
        redirectUri: "https://teams.example.com/auth/desktop/callback",
        screenHint: "sign-up",
      })
    )
    expect(state).toMatchObject({
      mode: "signup",
      nextPath: "/workspace/docs",
      nonce: expect.any(String),
      surface: "desktop",
    })
    expect(response.headers.get("set-cookie")).toContain(
      `${desktopAuthStateCookieName}=`
    )
  })

  it("starts desktop Google auth through the hosted desktop callback", async () => {
    const { GET } = await import("@/app/auth/desktop/start/route")
    const response = await GET(
      new Request(
        "http://localhost/auth/desktop/start?mode=login&provider=google&next=/workspace/docs"
      )
    )
    const state = JSON.parse(getAuthorizationUrlMock.mock.calls[0][0].state)

    expect(response.status).toBe(307)
    expect(getAuthorizationUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "GoogleOAuth",
        redirectUri: "https://teams.example.com/auth/desktop/callback",
        screenHint: undefined,
      })
    )
    expect(state).toMatchObject({
      mode: "login",
      nextPath: "/workspace/docs",
      nonce: expect.any(String),
      surface: "desktop",
    })
    expect(response.headers.get("set-cookie")).toContain(
      `${desktopAuthStateCookieName}=`
    )
  })

  it("saves the hosted session then redirects back to the desktop app", async () => {
    const stateNonce = "desktop_state_nonce"
    const authResponse = {
      user: { id: "workos_user", email: "alex@example.com" },
      organizationId: "org_123",
    }
    authenticateWithCodeMock.mockResolvedValue(authResponse)
    const { redirectUrl, response } = await getCallbackSuccessRedirect({
      loadRoute: () => import("@/app/auth/desktop/callback/route"),
      routePath: "/auth/desktop/callback",
      state: buildDesktopCallbackState({
        mode: "login",
        nextPath: "/workspace/settings",
        nonce: stateNonce,
      }),
      cookie: buildDesktopAuthCookie(stateNonce),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0")
    expectSavedWorkOSSession(authResponse, "/auth/desktop/callback")
    expectDesktopHandoffRedirect(redirectUrl, "/workspace/settings")
  })

  it("rejects desktop provider callbacks without the matching state cookie", async () => {
    const { GET } = await import("@/app/auth/desktop/callback/route")
    const state = buildDesktopCallbackState({
      mode: "login",
      nextPath: "/workspace/settings",
      nonce: "state_nonce",
    })
    const response = await GET(
      new Request(
        `http://localhost/auth/desktop/callback?code=abc123&state=${encodeURIComponent(state)}`,
        {
          headers: {
            cookie: buildDesktopAuthCookie("different_nonce"),
          },
        }
      )
    )
    const redirectUrl = getRedirectPath(response)
    const handoffPath = redirectUrl.searchParams.get("path") ?? ""
    const localUrl = new URL(handoffPath, "https://desktop.local")

    expect(response.status).toBe(307)
    expect(localUrl.pathname).toBe("/login")
    expect(localUrl.searchParams.get("error")).toBe(
      "Desktop sign-in request expired. Start sign-in again."
    )
    expect(authenticateWithCodeMock).not.toHaveBeenCalled()
  })

  it("turns desktop password login into a desktop session handoff", async () => {
    const authResponse = {
      user: { id: "workos_user", email: "alex@example.com" },
      organizationId: "org_123",
    }
    authenticateWithPasswordMock.mockResolvedValue(authResponse)
    const response = await postDesktopPasswordLogin()
    const redirectUrl = getRedirectPath(response)

    expect(response.status).toBe(303)
    expect(authenticateWithPasswordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "declan@reciperoom.io",
        password: "password-123",
      })
    )
    expect(saveSessionMock).toHaveBeenCalledWith(
      authResponse,
      expect.stringContaining("/auth/desktop/login")
    )
    expect(reconcileAuthenticatedAppContextMock).toHaveBeenCalledWith(
      authResponse.user,
      "org_123"
    )
    expectDesktopHandoffRedirect(redirectUrl, "/workspace/chats")
  })

  it("redirects desktop password login failures back into the packaged renderer", async () => {
    authenticateWithPasswordMock.mockRejectedValue({
      rawData: { error: "invalid_credentials" },
    })
    const response = await postDesktopPasswordLogin()
    const localUrl = expectDesktopRendererRedirect(response, "/login")

    expect(localUrl.searchParams.get("error")).toBe(
      "Invalid email or password."
    )
  })

  it("turns desktop password signup into a desktop session handoff", async () => {
    const authResponse = {
      user: { id: "workos_user", email: "alex@example.com" },
      organizationId: "org_123",
    }
    authenticateWithPasswordMock.mockResolvedValue(authResponse)
    const response = await postDesktopPasswordSignup()
    const redirectUrl = getRedirectPath(response)

    expect(response.status).toBe(303)
    expect(createUserMock).toHaveBeenCalledWith({
      email: "alex@example.com",
      firstName: "Alex",
      lastName: "Morgan",
      password: "password-123",
    })
    expect(authenticateWithPasswordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "alex@example.com",
        password: "password-123",
      })
    )
    expect(saveSessionMock).toHaveBeenCalledWith(
      authResponse,
      expect.stringContaining("/auth/desktop/signup")
    )
    expect(reconcileAuthenticatedAppContextMock).toHaveBeenCalledWith(
      authResponse.user,
      "org_123"
    )
    expectDesktopHandoffRedirect(redirectUrl, "/workspace/docs")
  })

  it("redirects incomplete desktop password signup back to signup in the packaged renderer", async () => {
    const response = await postDesktopPasswordSignup({ firstName: "" })
    const localUrl = expectDesktopRendererRedirect(response, "/signup")

    expect(localUrl.searchParams.get("email")).toBe("alex@example.com")
    expect(localUrl.searchParams.get("lastName")).toBe("Morgan")
    expect(localUrl.searchParams.get("error")).toBe(
      "Complete every field to create your account."
    )
    expect(createUserMock).not.toHaveBeenCalled()
  })

  it("redirects existing desktop signup accounts back to desktop login", async () => {
    createUserMock.mockRejectedValue({ status: 409 })
    const response = await postDesktopPasswordSignup()
    const localUrl = expectDesktopRendererRedirect(response, "/login")

    expect(localUrl.searchParams.get("email")).toBe("alex@example.com")
    expect(localUrl.searchParams.get("notice")).toBe(
      "Account already created. Please sign in."
    )
    expect(authenticateWithPasswordMock).not.toHaveBeenCalled()
  })

  it("exchanges desktop handoff tickets for user-scoped desktop session tokens", async () => {
    const { createDesktopHandoffTicket, verifyDesktopSessionToken } =
      await import("@/lib/server/desktop-session")
    const { POST } = await import("@/app/api/auth/desktop/session/route")
    const { ticket } = createDesktopHandoffTicket({
      organizationId: "org_123",
      user: {
        id: "workos_user",
        email: "alex@example.com",
      },
    })
    const response = await POST(
      createJsonRouteRequest(
        "http://localhost/api/auth/desktop/session",
        "POST",
        { ticket }
      )
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      expiresAt: expect.any(Number),
      token: expect.any(String),
    })
    expect(verifyDesktopSessionToken(payload.token)).toMatchObject({
      email: "alex@example.com",
      organizationId: "org_123",
      sub: "workos_user",
      typ: "desktop-session",
    })
  })

  it("rejects invalid desktop handoff tickets", async () => {
    const { POST } = await import("@/app/api/auth/desktop/session/route")
    const response = await POST(
      createJsonRouteRequest(
        "http://localhost/api/auth/desktop/session",
        "POST",
        { ticket: "not-a-real-ticket" }
      )
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      code: "DESKTOP_AUTH_TICKET_INVALID",
      message: "Invalid desktop authentication ticket",
    })
  })

  it("rejects replayed desktop handoff tickets", async () => {
    const { createDesktopHandoffTicket } = await import(
      "@/lib/server/desktop-session"
    )
    const { POST } = await import("@/app/api/auth/desktop/session/route")
    const { ticket } = createDesktopHandoffTicket({
      user: {
        id: "workos_user",
        email: "alex@example.com",
      },
    })

    consumeDesktopHandoffTicketServerMock.mockResolvedValueOnce({
      consumed: false,
    })

    const response = await POST(
      createJsonRouteRequest(
        "http://localhost/api/auth/desktop/session",
        "POST",
        { ticket }
      )
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      code: "DESKTOP_AUTH_TICKET_INVALID",
      message: "Invalid desktop authentication ticket",
    })
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

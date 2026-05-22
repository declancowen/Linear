import { randomBytes, timingSafeEqual } from "node:crypto"

import {
  type AuthMode,
  buildAuthPageHref,
  getAppOrigin,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"

const DEFAULT_DESKTOP_DEEP_LINK_SCHEME = "recipe-room"
const DESKTOP_DEEP_LINK_OPEN_HOST = "open"
const DESKTOP_AUTH_STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60
export const desktopAuthStateCookieName = "desktop_auth_state"

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function readHttpUrlEnv(value: string | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return null
  }

  try {
    const url = new URL(trimmed)

    return url.protocol === "https:" || url.protocol === "http:"
      ? trimTrailingSlash(trimmed)
      : null
  } catch {
    return null
  }
}

function normalizeDesktopDeepLinkScheme(value: string | undefined) {
  const trimmed = value?.trim()

  if (!trimmed || !/^[a-z][a-z0-9+.-]*$/i.test(trimmed)) {
    return null
  }

  return trimmed.toLowerCase()
}

function getDesktopDeepLinkScheme() {
  return (
    normalizeDesktopDeepLinkScheme(process.env.DESKTOP_DEEP_LINK_SCHEME) ??
    DEFAULT_DESKTOP_DEEP_LINK_SCHEME
  )
}

export function getDesktopWorkOSRedirectUri() {
  const configured = readHttpUrlEnv(process.env.DESKTOP_WORKOS_REDIRECT_URI)

  if (configured) {
    return configured
  }

  return new URL("/auth/desktop/callback", getAppOrigin()).toString()
}

function createDesktopAuthStateNonce() {
  return randomBytes(32).toString("base64url")
}

function secretsMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

function parseCookieHeader(value: string | null) {
  const cookies = new Map<string, string>()

  if (!value) {
    return cookies
  }

  for (const part of value.split(";")) {
    const separatorIndex = part.indexOf("=")

    if (separatorIndex === -1) {
      continue
    }

    const name = part.slice(0, separatorIndex).trim()
    const rawValue = part.slice(separatorIndex + 1).trim()

    if (!name) {
      continue
    }

    try {
      cookies.set(name, decodeURIComponent(rawValue))
    } catch {
      cookies.set(name, rawValue)
    }
  }

  return cookies
}

function buildDesktopAuthStateCookie(
  request: Request,
  value: string,
  maxAge: number
) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : ""

  return [
    `${desktopAuthStateCookieName}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
  ].join("; ") + secure
}

export function setDesktopAuthStateCookie(
  response: Response,
  request: Request,
  nonce: string
) {
  response.headers.append(
    "Set-Cookie",
    buildDesktopAuthStateCookie(
      request,
      nonce,
      DESKTOP_AUTH_STATE_COOKIE_MAX_AGE_SECONDS
    )
  )
}

export function clearDesktopAuthStateCookie(
  response: Response,
  request: Request
) {
  response.headers.append(
    "Set-Cookie",
    buildDesktopAuthStateCookie(request, "", 0)
  )
}

export function createDesktopAuthState(input: {
  mode: "login" | "signup"
  nextPath?: string | null
}) {
  const nonce = createDesktopAuthStateNonce()

  return {
    nonce,
    state: JSON.stringify({
      mode: input.mode,
      nextPath: normalizeAuthNextPath(input.nextPath),
      nonce,
      surface: "desktop",
    }),
  }
}

function parseDesktopAuthState(
  state: string | null | undefined
):
  | {
      mode: AuthMode
      nextPath: string
      nonce: string
    }
  | null {
  if (!state) {
    return null
  }

  try {
    const parsed = JSON.parse(state) as {
      mode?: string
      nextPath?: string
      nonce?: string
      surface?: string
    }

    if (
      (parsed.mode !== "login" && parsed.mode !== "signup") ||
      parsed.surface !== "desktop" ||
      typeof parsed.nonce !== "string" ||
      parsed.nonce.length === 0
    ) {
      return null
    }

    return {
      mode: parsed.mode,
      nextPath: normalizeAuthNextPath(parsed.nextPath),
      nonce: parsed.nonce,
    }
  } catch {
    return null
  }
}

export function validateDesktopAuthCallbackState(
  request: Request,
  state: string | null | undefined
) {
  const parsedState = parseDesktopAuthState(state)
  const cookieNonce = parseCookieHeader(request.headers.get("cookie")).get(
    desktopAuthStateCookieName
  )

  if (!parsedState || !cookieNonce) {
    return null
  }

  return secretsMatch(cookieNonce, parsedState.nonce) ? parsedState : null
}

export function buildDesktopAuthCompleteUrl(input: {
  nextPath?: string | null
  email?: string | null
  error?: string | null
  firstName?: string | null
  lastName?: string | null
  mode?: AuthMode | null
  notice?: string | null
  ticket?: string | null
}) {
  const targetPath = input.ticket
    ? buildDesktopAuthCompletePath({
        nextPath: input.nextPath,
        ticket: input.ticket,
      })
    : input.error || input.notice || input.mode
      ? buildAuthPageHref(input.mode ?? "login", {
          nextPath: input.nextPath,
          error: input.error,
          notice: input.notice,
          email: input.email,
          firstName: input.mode === "signup" ? input.firstName : null,
          lastName: input.mode === "signup" ? input.lastName : null,
        })
      : normalizeAuthNextPath(input.nextPath)
  const url = new URL(
    `${getDesktopDeepLinkScheme()}://${DESKTOP_DEEP_LINK_OPEN_HOST}`
  )

  url.searchParams.set("path", targetPath)

  return url.toString()
}

function buildDesktopAuthCompletePath(input: {
  nextPath?: string | null
  ticket: string
}) {
  const url = new URL("/auth/desktop/complete", "https://desktop.local")

  url.searchParams.set("ticket", input.ticket)
  url.searchParams.set("next", normalizeAuthNextPath(input.nextPath))

  return `${url.pathname}${url.search}`
}

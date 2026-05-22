import {
  type AuthMode,
  buildAuthPageHref,
  getAppOrigin,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"

const DEFAULT_DESKTOP_DEEP_LINK_SCHEME = "recipe-room"
const DESKTOP_DEEP_LINK_OPEN_HOST = "open"

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

export function buildDesktopAuthState(input: {
  mode: "login" | "signup"
  nextPath?: string | null
}) {
  return JSON.stringify({
    mode: input.mode,
    nextPath: normalizeAuthNextPath(input.nextPath),
    surface: "desktop",
  })
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

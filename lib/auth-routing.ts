export type AuthMode = "login" | "signup"

const DEFAULT_APP_ORIGIN = "https://teams.reciperoom.io"
const DEFAULT_APP_PATH = "/workspace/projects"

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function readUrlEnv(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimTrailingSlash(trimmed) : null
}

function getConfiguredAppOrigin() {
  return (
    readUrlEnv(process.env.APP_URL) ??
    readUrlEnv(process.env.NEXT_PUBLIC_APP_URL) ??
    readUrlEnv(process.env.TEAMS_URL)
  )
}

function createAuthRouteUrl(path: string) {
  return new URL(path, "https://teams.placeholder")
}

function appendOptionalSearchParams(
  url: URL,
  params: Record<string, string | null | undefined>
) {
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value)
    }
  }
}

function serializeAuthRouteUrl(url: URL) {
  return `${url.pathname}${url.search}`
}

function buildAuthRoutePath(
  path: string,
  params: Record<string, string | null | undefined>
) {
  const url = createAuthRouteUrl(path)
  appendOptionalSearchParams(url, params)
  return serializeAuthRouteUrl(url)
}

export function getAppOrigin() {
  return getConfiguredAppOrigin() ?? DEFAULT_APP_ORIGIN
}

export function normalizeAuthNextPath(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return DEFAULT_APP_PATH
  }

  try {
    const absolute = new URL(trimmed)
    return `${absolute.pathname}${absolute.search}${absolute.hash}` || DEFAULT_APP_PATH
  } catch {
    const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    return normalized || DEFAULT_APP_PATH
  }
}

export function buildAuthHref(mode: AuthMode, nextPath?: string | null) {
  return buildAuthRoutePath(`/${mode}`, {
    next: normalizeAuthNextPath(nextPath),
  })
}

export function buildAuthPageHref(
  mode: AuthMode,
  options?: {
    nextPath?: string | null
    error?: string | null
    notice?: string | null
    email?: string | null
  }
) {
  return buildAuthRoutePath(`/${mode}`, {
    next: normalizeAuthNextPath(options?.nextPath),
    error: options?.error,
    notice: options?.notice,
    email: options?.email,
  })
}

export function buildLogoutPath(returnTo?: string | null) {
  return buildAuthRoutePath("/auth/logout", { returnTo })
}

export function buildSessionResolvePath(options?: {
  mode?: AuthMode | null
  nextPath?: string | null
}) {
  return buildAuthRoutePath("/auth/session", {
    next: normalizeAuthNextPath(options?.nextPath),
    mode: options?.mode,
  })
}

export function buildEmailVerificationPageHref(options: {
  mode: AuthMode
  nextPath?: string | null
  error?: string | null
  notice?: string | null
  email?: string | null
}) {
  return buildAuthRoutePath("/verify-email", {
    mode: options.mode,
    next: normalizeAuthNextPath(options.nextPath),
    error: options.error,
    notice: options.notice,
    email: options.email,
  })
}

export function buildForgotPasswordPageHref(input: {
  nextPath: string
  email: string
  error?: string | null
  notice?: string | null
}) {
  return buildAuthRoutePath("/forgot-password", input)
}

export function buildResetPasswordPageHref(input: {
  token: string
  nextPath?: string | null
  error?: string | null
  notice?: string | null
}) {
  return buildAuthRoutePath("/reset-password", input)
}

export function buildPostAuthPath(nextPath?: string | null) {
  return normalizeAuthNextPath(nextPath)
}

export function buildAppDestination(nextPath?: string | null) {
  const url = new URL(getAppOrigin())
  const destination = new URL(normalizeAuthNextPath(nextPath), url)
  return destination.toString()
}

export function parseAuthMode(value: string | null | undefined): AuthMode | null {
  return value === "signup" || value === "login" ? value : null
}

export function parseAuthState(
  state: string | undefined
):
  | {
      mode: AuthMode
      nextPath: string
    }
  | null {
  if (!state) {
    return null
  }

  try {
    const parsed = JSON.parse(state) as {
      nextPath?: string
      mode?: string
    }
    const mode = parseAuthMode(parsed.mode)

    if (!mode) {
      return null
    }

    return {
      mode,
      nextPath: normalizeAuthNextPath(parsed.nextPath),
    }
  } catch {
    return null
  }
}

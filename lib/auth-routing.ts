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
  const url = new URL(`/${mode}`, "https://teams.placeholder")
  url.searchParams.set("next", normalizeAuthNextPath(nextPath))
  return `${url.pathname}${url.search}`
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
  const url = new URL(`/${mode}`, "https://teams.placeholder")
  url.searchParams.set("next", normalizeAuthNextPath(options?.nextPath))

  if (options?.error) {
    url.searchParams.set("error", options.error)
  }

  if (options?.notice) {
    url.searchParams.set("notice", options.notice)
  }

  if (options?.email) {
    url.searchParams.set("email", options.email)
  }

  return `${url.pathname}${url.search}`
}

export function buildLogoutPath(returnTo?: string | null) {
  const url = new URL("/auth/logout", "https://teams.placeholder")

  if (returnTo) {
    url.searchParams.set("returnTo", returnTo)
  }

  return `${url.pathname}${url.search}`
}

export function buildSessionResolvePath(options?: {
  mode?: AuthMode | null
  nextPath?: string | null
}) {
  const url = new URL("/auth/session", "https://teams.placeholder")
  url.searchParams.set("next", normalizeAuthNextPath(options?.nextPath))

  if (options?.mode) {
    url.searchParams.set("mode", options.mode)
  }

  return `${url.pathname}${url.search}`
}

export function buildEmailVerificationPageHref(options: {
  mode: AuthMode
  nextPath?: string | null
  error?: string | null
  notice?: string | null
  email?: string | null
}) {
  const url = new URL("/verify-email", "https://teams.placeholder")
  url.searchParams.set("mode", options.mode)
  url.searchParams.set("next", normalizeAuthNextPath(options.nextPath))

  if (options.error) {
    url.searchParams.set("error", options.error)
  }

  if (options.notice) {
    url.searchParams.set("notice", options.notice)
  }

  if (options.email) {
    url.searchParams.set("email", options.email)
  }

  return `${url.pathname}${url.search}`
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

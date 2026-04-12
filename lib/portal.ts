export type PortalAppId = "teams" | "projects"
export type PortalAuthMode = "login" | "signup"

export type AppMode = "portal" | "projects"
type HeadersLike = Pick<Headers, "get">

type PortalAppDefinition = {
  id: PortalAppId
  name: string
  description: string
  defaultPath: string
  origin: () => string
}

const DEFAULT_PORTAL_ORIGIN = "https://portal.reciperoom.io"
const DEFAULT_PROJECTS_ORIGIN = "https://projects.reciperoom.io"
const DEFAULT_TEAMS_ORIGIN = "https://teams.reciperoom.io"

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function readUrlEnv(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimTrailingSlash(trimmed) : null
}

export function getAppMode(): AppMode {
  return process.env.APP_MODE?.trim().toLowerCase() === "portal"
    ? "portal"
    : "projects"
}

function normalizeHost(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return null
  }

  const host = trimmed.split(",")[0]?.trim()?.toLowerCase()

  if (!host) {
    return null
  }

  return host.replace(/:\d+$/, "")
}

function getOriginHost(origin: string) {
  try {
    return new URL(origin).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function getPortalOrigin() {
  return (
    readUrlEnv(process.env.PORTAL_URL) ??
    (getAppMode() === "portal" ? readUrlEnv(process.env.APP_URL) : null) ??
    DEFAULT_PORTAL_ORIGIN
  )
}

export function getProjectsOrigin() {
  return (
    (getAppMode() === "projects" ? readUrlEnv(process.env.APP_URL) : null) ??
    readUrlEnv(process.env.PROJECTS_URL) ??
    DEFAULT_PROJECTS_ORIGIN
  )
}

export function getTeamsOrigin() {
  return readUrlEnv(process.env.TEAMS_URL) ?? DEFAULT_TEAMS_ORIGIN
}

export function getAppModeForHost(host: string | null | undefined): AppMode {
  const normalizedHost = normalizeHost(host)
  const portalHost = getOriginHost(getPortalOrigin())
  const projectsHost = getOriginHost(getProjectsOrigin())

  if (normalizedHost && portalHost && normalizedHost === portalHost) {
    return "portal"
  }

  if (normalizedHost && projectsHost && normalizedHost === projectsHost) {
    return "projects"
  }

  return getAppMode()
}

export function getAppModeFromHeaders(headers: HeadersLike) {
  return getAppModeForHost(
    headers.get("x-forwarded-host") ?? headers.get("host")
  )
}

export function isSingleHostLocalDev() {
  const portalOrigin = getPortalOrigin()
  const projectsOrigin = getProjectsOrigin()
  const teamsOrigin = getTeamsOrigin()
  const portalHost = getOriginHost(portalOrigin)
  const projectsHost = getOriginHost(projectsOrigin)
  const teamsHost = getOriginHost(teamsOrigin)

  if (!portalHost || !projectsHost || !teamsHost) {
    return false
  }

  const isLocalHost =
    portalHost === "localhost" || portalHost === "127.0.0.1"

  return (
    isLocalHost &&
    portalHost === projectsHost &&
    portalHost === teamsHost
  )
}

export const portalApps: Record<PortalAppId, PortalAppDefinition> = {
  teams: {
    id: "teams",
    name: "Teams",
    description:
      "Open the team collaboration workspace for operational work, members, and day-to-day delivery.",
    defaultPath: "/",
    origin: getTeamsOrigin,
  },
  projects: {
    id: "projects",
    name: "Projects",
    description:
      "Open the projects workspace for planning, issues, roadmaps, docs, and the Linear-style product surface.",
    defaultPath: "/inbox",
    origin: getProjectsOrigin,
  },
}

export function parsePortalAppId(value: string | null | undefined) {
  return value === "teams" || value === "projects" ? value : null
}

export function normalizeNextPath(
  value: string | null | undefined,
  appId: PortalAppId = "projects"
) {
  const fallback = portalApps[appId].defaultPath
  const trimmed = value?.trim()

  if (!trimmed) {
    return fallback
  }

  try {
    const absolute = new URL(trimmed)
    return `${absolute.pathname}${absolute.search}${absolute.hash}` || fallback
  } catch {
    const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    return normalized || fallback
  }
}

export function normalizePortalAuthNextPath(
  value: string | null | undefined,
  appId: PortalAppId | null | undefined
) {
  if (appId) {
    return normalizeNextPath(value, appId)
  }

  const trimmed = value?.trim()

  if (!trimmed) {
    return "/"
  }

  try {
    const absolute = new URL(trimmed)
    return `${absolute.pathname}${absolute.search}${absolute.hash}` || "/"
  } catch {
    const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    return normalized || "/"
  }
}

export function buildPortalAuthHref(
  mode: PortalAuthMode,
  appId: PortalAppId,
  nextPath?: string | null
) {
  const url = new URL(`/${mode}`, getPortalOrigin())
  url.searchParams.set("app", appId)
  url.searchParams.set("next", normalizeNextPath(nextPath, appId))
  return url.toString()
}

export function buildPortalPageHref(
  mode: PortalAuthMode,
  options?: {
    appId?: PortalAppId | null
    nextPath?: string | null
    error?: string | null
    notice?: string | null
    email?: string | null
  }
) {
  const url = new URL(`/${mode}`, "https://portal.placeholder")
  const normalizedNextPath = normalizePortalAuthNextPath(
    options?.nextPath,
    options?.appId
  )

  if (options?.appId) {
    url.searchParams.set("app", options.appId)
  }

  url.searchParams.set("next", normalizedNextPath)

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

export function buildPortalPostAuthPath(
  appId: PortalAppId | null | undefined,
  nextPath?: string | null
) {
  const normalizedNextPath = normalizePortalAuthNextPath(nextPath, appId)

  if (!appId) {
    return normalizedNextPath
  }

  return buildPortalCompletionPath(appId, normalizedNextPath)
}

export function buildPortalCompletionPath(
  appId: PortalAppId,
  nextPath?: string | null
) {
  const url = new URL("/auth/complete", "https://portal.placeholder")
  url.searchParams.set("app", appId)
  url.searchParams.set("next", normalizeNextPath(nextPath, appId))
  return `${url.pathname}${url.search}`
}

export function buildAppDestination(appId: PortalAppId, nextPath?: string | null) {
  const url = new URL(portalApps[appId].origin())
  const destination = new URL(normalizeNextPath(nextPath, appId), url)
  return destination.toString()
}

export function parsePortalState(state: string | undefined) {
  if (!state) {
    return null
  }

  try {
    const parsed = JSON.parse(state) as {
      appId?: string
      nextPath?: string
    }

    const appId = parsePortalAppId(parsed.appId)

    if (!appId) {
      return null
    }

    return {
      appId,
      nextPath: normalizeNextPath(parsed.nextPath, appId),
    }
  } catch {
    return null
  }
}

export function parsePortalAuthMode(
  value: string | null | undefined
): PortalAuthMode | null {
  return value === "signup" || value === "login" ? value : null
}

export function parsePortalAuthState(
  state: string | undefined
):
  | {
      appId: PortalAppId | null
      mode: PortalAuthMode
      nextPath: string
    }
  | null {
  if (!state) {
    return null
  }

  try {
    const parsed = JSON.parse(state) as {
      appId?: string
      nextPath?: string
      mode?: string
    }

    const appId = parsePortalAppId(parsed.appId)
    const mode = parsePortalAuthMode(parsed.mode)

    if (!mode) {
      return null
    }

    return {
      appId,
      mode,
      nextPath: normalizePortalAuthNextPath(parsed.nextPath, appId),
    }
  } catch {
    return null
  }
}

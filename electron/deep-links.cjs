const DEFAULT_DEEP_LINK_SCHEME = "recipe-room"
const DEFAULT_DEEP_LINK_TARGET_PATH = "/workspace/projects"

function normalizeDeepLinkScheme(value) {
  const trimmed = value?.trim()

  if (!trimmed || !/^[a-z][a-z0-9+.-]*$/i.test(trimmed)) {
    return null
  }

  return trimmed.toLowerCase()
}

function resolveDeepLinkScheme(env = process.env) {
  return (
    normalizeDeepLinkScheme(env.ELECTRON_DEEP_LINK_SCHEME) ??
    normalizeDeepLinkScheme(env.DESKTOP_DEEP_LINK_SCHEME) ??
    DEFAULT_DEEP_LINK_SCHEME
  )
}

function normalizeDeepLinkTargetPath(value) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return DEFAULT_DEEP_LINK_TARGET_PATH
  }

  try {
    const absolute = new URL(trimmed)

    return normalizeDeepLinkTargetPath(
      `${absolute.pathname}${absolute.search}${absolute.hash}`
    )
  } catch {}

  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`

  if (normalized.startsWith("//")) {
    return DEFAULT_DEEP_LINK_TARGET_PATH
  }

  return normalized
}

function isDesktopDeepLinkUrl(url, scheme = resolveDeepLinkScheme()) {
  try {
    return new URL(url).protocol === `${scheme}:`
  } catch {
    return false
  }
}

function findDesktopDeepLinkUrl(values, scheme = resolveDeepLinkScheme()) {
  return values.find((value) => isDesktopDeepLinkUrl(value, scheme)) ?? null
}

function parseDesktopDeepLinkUrl(url, scheme = resolveDeepLinkScheme()) {
  let parsed

  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.protocol !== `${scheme}:`) {
    return null
  }

  const explicitPath = parsed.searchParams.get("path")
  const explicitNextPath = parsed.searchParams.get("next")
  const targetPath =
    explicitPath ??
    (parsed.hostname === "open" ? explicitNextPath : null) ??
    (parsed.hostname
      ? `/${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`
      : parsed.pathname)
  const targetUrl = new URL(
    normalizeDeepLinkTargetPath(targetPath),
    "https://desktop.local"
  )

  for (const [key, value] of parsed.searchParams) {
    if (key === "path" || (parsed.hostname === "open" && key === "next")) {
      continue
    }

    targetUrl.searchParams.append(key, value)
  }

  return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
}

module.exports = {
  findDesktopDeepLinkUrl,
  isDesktopDeepLinkUrl,
  normalizeDeepLinkScheme,
  parseDesktopDeepLinkUrl,
  resolveDeepLinkScheme,
}

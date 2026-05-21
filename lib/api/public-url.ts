const configuredPublicApiBaseUrl = normalizePublicApiBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL
)

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)

    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

function isApiRoutePath(value: string) {
  return value === "/api" || value.startsWith("/api/") || value.startsWith("/api?")
}

export function normalizePublicApiBaseUrl(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed || !isHttpUrl(trimmed)) {
    return null
  }

  return trimTrailingSlash(trimmed)
}

export function buildPublicApiUrl(
  path: string,
  options?: {
    baseUrl?: string | null
  }
) {
  const baseUrl =
    options && "baseUrl" in options
      ? normalizePublicApiBaseUrl(options.baseUrl)
      : configuredPublicApiBaseUrl

  if (!baseUrl || !isApiRoutePath(path) || isHttpUrl(path)) {
    return path
  }

  return `${baseUrl}${path}`
}

export function buildPublicApiRequestInput(input: RequestInfo | URL) {
  return typeof input === "string" ? buildPublicApiUrl(input) : input
}

export function getPublicApiEventSourceInit(): EventSourceInit | undefined {
  return configuredPublicApiBaseUrl ? { withCredentials: true } : undefined
}

const DEFAULT_RENDERER_URL = "https://teams.reciperoom.io"
const DESKTOP_API_BASE_URL_ENV_KEYS = [
  "DESKTOP_HOSTED_APP_URL",
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "APP_URL",
  "TEAMS_URL",
]

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "")
}

function readUrlValue(value) {
  const trimmed = value?.trim()

  return trimmed ? trimTrailingSlash(trimmed) : null
}

function resolveConfiguredRendererUrl(env = process.env) {
  return readUrlValue(env.ELECTRON_RENDERER_URL)
}

function resolveConfiguredDesktopApiBaseUrl(env = process.env) {
  for (const key of DESKTOP_API_BASE_URL_ENV_KEYS) {
    const value = readUrlValue(env[key])

    if (value) {
      return value
    }
  }

  return null
}

module.exports = {
  DEFAULT_RENDERER_URL,
  readUrlValue,
  resolveConfiguredDesktopApiBaseUrl,
  resolveConfiguredRendererUrl,
}

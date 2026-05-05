const DEFAULT_RENDERER_URL = "https://teams.reciperoom.io"

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "")
}

function readUrlValue(value) {
  const trimmed = value?.trim()

  return trimmed ? trimTrailingSlash(trimmed) : null
}

function resolveConfiguredRendererUrl(env = process.env) {
  return (
    readUrlValue(env.APP_URL) ??
    readUrlValue(env.NEXT_PUBLIC_APP_URL) ??
    readUrlValue(env.TEAMS_URL) ??
    readUrlValue(env.ELECTRON_RENDERER_URL)
  )
}

module.exports = {
  DEFAULT_RENDERER_URL,
  readUrlValue,
  resolveConfiguredRendererUrl,
}

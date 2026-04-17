/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs")
const path = require("node:path")

const DEFAULT_RENDERER_URL = "https://teams.reciperoom.io"
const DESKTOP_RUNTIME_CONFIG_FILE = "desktop-runtime.json"

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

function getDesktopRuntimeConfigPath(appPath) {
  return path.join(appPath, DESKTOP_RUNTIME_CONFIG_FILE)
}

function readDesktopRuntimeConfig(appPath) {
  try {
    const fileContents = fs.readFileSync(
      getDesktopRuntimeConfigPath(appPath),
      "utf8"
    )
    const parsed = JSON.parse(fileContents)

    return {
      rendererUrl:
        parsed && typeof parsed === "object"
          ? readUrlValue(parsed.rendererUrl)
          : null,
    }
  } catch {
    return {
      rendererUrl: null,
    }
  }
}

function resolvePackagedRendererUrl(appPath, env = process.env) {
  return (
    resolveConfiguredRendererUrl(env) ??
    readDesktopRuntimeConfig(appPath).rendererUrl ??
    DEFAULT_RENDERER_URL
  )
}

module.exports = {
  DEFAULT_RENDERER_URL,
  DESKTOP_RUNTIME_CONFIG_FILE,
  readDesktopRuntimeConfig,
  readUrlValue,
  resolveConfiguredRendererUrl,
  resolvePackagedRendererUrl,
}

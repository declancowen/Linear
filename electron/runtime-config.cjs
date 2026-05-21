/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs")
const path = require("node:path")
const { pathToFileURL } = require("node:url")
const {
  DEFAULT_RENDERER_URL,
  readUrlValue,
  resolveConfiguredDesktopApiBaseUrl,
  resolveConfiguredRendererUrl,
} = require("./renderer-url-config.cjs")

const DESKTOP_RUNTIME_CONFIG_FILE = "desktop-runtime.json"
const DESKTOP_RENDERER_DIR = "desktop-renderer"
const DESKTOP_RENDERER_ENTRY_FILE = "index.html"

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
      rendererMode:
        parsed && typeof parsed === "object"
          ? readRendererModeValue(parsed.rendererMode)
          : "hosted",
      rendererUrl:
        parsed && typeof parsed === "object"
          ? readUrlValue(parsed.rendererUrl)
          : null,
      apiBaseUrl:
        parsed && typeof parsed === "object"
          ? readUrlValue(parsed.apiBaseUrl)
          : null,
    }
  } catch {
    return {
      apiBaseUrl: null,
      rendererMode: "hosted",
      rendererUrl: null,
    }
  }
}

function readRendererModeValue(value) {
  return value === "packaged" ? "packaged" : "hosted"
}

function getPackagedRendererEntryPath(appPath) {
  return path.join(
    appPath,
    DESKTOP_RENDERER_DIR,
    DESKTOP_RENDERER_ENTRY_FILE
  )
}

function resolvePackagedRendererFileUrl(appPath) {
  const rendererEntryPath = getPackagedRendererEntryPath(appPath)

  if (!fs.existsSync(rendererEntryPath)) {
    throw new Error(
      `Packaged desktop renderer entry not found at ${rendererEntryPath}`
    )
  }

  return pathToFileURL(rendererEntryPath).toString()
}

function resolvePackagedRendererUrl(appPath, env = process.env) {
  const configuredRendererUrl = resolveConfiguredRendererUrl(env)

  if (configuredRendererUrl) {
    return configuredRendererUrl
  }

  const runtimeConfig = readDesktopRuntimeConfig(appPath)

  if (runtimeConfig.rendererMode === "packaged") {
    return resolvePackagedRendererFileUrl(appPath)
  }

  return runtimeConfig.rendererUrl ?? DEFAULT_RENDERER_URL
}

function resolveDesktopApiBaseUrl(appPath, env = process.env) {
  const configuredApiBaseUrl = resolveConfiguredDesktopApiBaseUrl(env)

  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl
  }

  const runtimeConfig = readDesktopRuntimeConfig(appPath)

  return runtimeConfig.apiBaseUrl ?? DEFAULT_RENDERER_URL
}

module.exports = {
  DESKTOP_RENDERER_DIR,
  DESKTOP_RENDERER_ENTRY_FILE,
  resolveDesktopApiBaseUrl,
  resolvePackagedRendererUrl,
}

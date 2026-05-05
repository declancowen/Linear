/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs")
const path = require("node:path")
const {
  DEFAULT_RENDERER_URL,
  readUrlValue,
  resolveConfiguredRendererUrl,
} = require("./renderer-url-config.cjs")

const DESKTOP_RUNTIME_CONFIG_FILE = "desktop-runtime.json"

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
  resolvePackagedRendererUrl,
}

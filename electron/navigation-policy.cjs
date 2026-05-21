/* eslint-disable @typescript-eslint/no-require-imports */
const { DEFAULT_RENDERER_URL } = require("./renderer-url-config.cjs")

const trustedInAppExactHosts = new Set([
  "api.workos.com",
  "accounts.google.com",
  "appleid.apple.com",
])
const trustedInAppHostSuffixes = [
  ".workos.com",
  ".google.com",
  ".googleusercontent.com",
]

function readTrustedHostname(value) {
  try {
    const parsed = new URL(value)

    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.hostname
      : null
  } catch {
    return null
  }
}

function getTrustedHostedAppHostnames(env = process.env, additionalUrls = []) {
  const hostnames = new Set()

  for (const value of [
    DEFAULT_RENDERER_URL,
    env.APP_URL,
    env.NEXT_PUBLIC_APP_URL,
    env.TEAMS_URL,
    env.NEXT_PUBLIC_API_BASE_URL,
    ...additionalUrls,
  ]) {
    const hostname = readTrustedHostname(value)

    if (hostname) {
      hostnames.add(hostname)
    }
  }

  return hostnames
}

function isTrustedInAppHttpsHost(hostname, options = {}) {
  return (
    trustedInAppExactHosts.has(hostname) ||
    getTrustedHostedAppHostnames(
      options.env,
      options.additionalTrustedUrls
    ).has(hostname) ||
    trustedInAppHostSuffixes.some((suffix) => hostname.endsWith(suffix))
  )
}

function isTrustedInAppUrl(url, rendererOrigin, options = {}) {
  try {
    const parsed = new URL(url)

    if (parsed.origin === rendererOrigin) {
      return true
    }

    return (
      parsed.protocol === "https:" &&
      isTrustedInAppHttpsHost(parsed.hostname, options)
    )
  } catch {
    return false
  }
}

function isAllowedExternalUrl(url) {
  try {
    const parsed = new URL(url)

    if (parsed.protocol === "mailto:") {
      return true
    }

    return parsed.protocol === "https:"
  } catch {
    return false
  }
}

module.exports = {
  getTrustedHostedAppHostnames,
  isAllowedExternalUrl,
  isTrustedInAppUrl,
}

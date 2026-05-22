/* eslint-disable @typescript-eslint/no-require-imports */
const { DEFAULT_RENDERER_URL } = require("./renderer-url-config.cjs")

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeNextPath(value) {
  const trimmed = normalizeText(value)

  if (!trimmed) {
    return "/workspace/projects"
  }

  try {
    const parsed = new URL(trimmed, "https://desktop.local")

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  }
}

function getDesktopPasswordLoginUrl(baseUrl = DEFAULT_RENDERER_URL) {
  return new URL("/auth/desktop/login", baseUrl).toString()
}

function getDesktopPasswordSignupUrl(baseUrl = DEFAULT_RENDERER_URL) {
  return new URL("/auth/desktop/signup", baseUrl).toString()
}

function createDesktopPasswordLoginBody(input) {
  const body = new URLSearchParams()

  setDesktopPasswordBodyFields(body, input)

  return body
}

function setDesktopPasswordBodyFields(body, input) {
  body.set("email", normalizeText(input?.email))
  body.set("password", readPassword(input))
  body.set("next", normalizeNextPath(input?.nextPath))
}

function readPassword(input) {
  return typeof input?.password === "string" ? input.password : ""
}

function createDesktopPasswordSignupBody(input) {
  const body = new URLSearchParams()

  body.set("firstName", normalizeText(input?.firstName))
  body.set("lastName", normalizeText(input?.lastName))
  setDesktopPasswordBodyFields(body, input)

  return body
}

async function submitDesktopPasswordAuth(input, options, config) {
  const fetchImpl = options.fetchImpl ?? fetch
  const url =
    options[config.urlOptionName] ?? config.getUrl(options.apiBaseUrl)
  const response = await fetchImpl(url, {
    body: config.createBody(input),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
    redirect: "manual",
  })
  const location = response.headers.get("location")

  if (!location) {
    const status = typeof response.status === "number" ? response.status : null

    return {
      error:
        status === 404
          ? `Desktop ${config.actionLabel} is not deployed on the configured hosted API.`
          : `Desktop ${config.actionLabel} did not return an authentication handoff.`,
      ok: false,
    }
  }

  if (options.isDesktopDeepLinkUrl?.(location)) {
    await options.handleDesktopDeepLink?.(location)

    return { ok: true }
  }

  return {
    error: `Desktop ${config.actionLabel} returned an unexpected authentication destination.`,
    ok: false,
  }
}

async function submitDesktopPasswordLogin(input, options = {}) {
  return submitDesktopPasswordAuth(input, options, {
    actionLabel: "sign-in",
    createBody: createDesktopPasswordLoginBody,
    getUrl: getDesktopPasswordLoginUrl,
    urlOptionName: "loginUrl",
  })
}

async function submitDesktopPasswordSignup(input, options = {}) {
  return submitDesktopPasswordAuth(input, options, {
    actionLabel: "sign-up",
    createBody: createDesktopPasswordSignupBody,
    getUrl: getDesktopPasswordSignupUrl,
    urlOptionName: "signupUrl",
  })
}

module.exports = {
  createDesktopPasswordLoginBody,
  createDesktopPasswordSignupBody,
  getDesktopPasswordLoginUrl,
  getDesktopPasswordSignupUrl,
  normalizeNextPath,
  submitDesktopPasswordLogin,
  submitDesktopPasswordSignup,
}

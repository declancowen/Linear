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

function createDesktopPasswordLoginBody(input) {
  const body = new URLSearchParams()

  body.set("email", normalizeText(input?.email))
  body.set(
    "password",
    typeof input?.password === "string" ? input.password : ""
  )
  body.set("next", normalizeNextPath(input?.nextPath))

  return body
}

async function submitDesktopPasswordLogin(input, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const loginUrl =
    options.loginUrl ?? getDesktopPasswordLoginUrl(options.apiBaseUrl)
  const response = await fetchImpl(loginUrl, {
    body: createDesktopPasswordLoginBody(input),
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
          ? "Desktop sign-in is not deployed on the configured hosted API."
          : "Desktop sign-in did not return an authentication handoff.",
      ok: false,
    }
  }

  if (options.isDesktopDeepLinkUrl?.(location)) {
    await options.handleDesktopDeepLink?.(location)

    return { ok: true }
  }

  return {
    error: "Desktop sign-in returned an unexpected authentication destination.",
    ok: false,
  }
}

module.exports = {
  createDesktopPasswordLoginBody,
  getDesktopPasswordLoginUrl,
  normalizeNextPath,
  submitDesktopPasswordLogin,
}

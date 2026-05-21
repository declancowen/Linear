import { NextResponse } from "next/server"

const DEFAULT_ALLOWED_METHODS = ["DELETE", "GET", "PATCH", "POST", "PUT"]
const DEFAULT_ALLOWED_HEADERS = ["authorization", "content-type"]
const DEFAULT_MAX_AGE_SECONDS = "600"

type ApiCorsOptions = {
  allowedOrigins?: readonly string[]
}

function parseAllowedOrigins(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function getAllowedOrigins(options?: ApiCorsOptions) {
  return (
    options?.allowedOrigins ??
    parseAllowedOrigins(process.env.DESKTOP_API_ALLOWED_ORIGINS)
  )
}

function getRequestPathname(request: Request) {
  try {
    return new URL(request.url).pathname
  } catch {
    return ""
  }
}

function isApiRequest(request: Request) {
  const pathname = getRequestPathname(request)

  return pathname === "/api" || pathname.startsWith("/api/")
}

function appendVaryHeader(response: Response, value: string) {
  const existingValues = new Set(
    (response.headers.get("Vary") ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  )

  existingValues.add(value)
  response.headers.set("Vary", [...existingValues].join(", "))
}

function getAllowedRequestOrigin(
  request: Request,
  options?: ApiCorsOptions
) {
  const origin = request.headers.get("Origin")?.trim()

  if (!origin) {
    return null
  }

  return getAllowedOrigins(options).includes(origin) ? origin : null
}

export function applyApiCorsHeaders(
  response: Response,
  request: Request,
  options?: ApiCorsOptions
) {
  if (!isApiRequest(request)) {
    return response
  }

  const origin = getAllowedRequestOrigin(request, options)

  if (!origin) {
    return response
  }

  response.headers.set("Access-Control-Allow-Origin", origin)
  response.headers.set("Access-Control-Allow-Credentials", "true")
  appendVaryHeader(response, "Origin")

  return response
}

export function createApiCorsPreflightResponse(
  request: Request,
  options?: ApiCorsOptions
) {
  if (request.method !== "OPTIONS" || !isApiRequest(request)) {
    return null
  }

  const origin = getAllowedRequestOrigin(request, options)

  if (!origin) {
    return new NextResponse(null, {
      status: 403,
    })
  }

  const response = new NextResponse(null, {
    status: 204,
  })
  const requestedHeaders = request.headers
    .get("Access-Control-Request-Headers")
    ?.trim()

  applyApiCorsHeaders(response, request, options)
  response.headers.set(
    "Access-Control-Allow-Methods",
    DEFAULT_ALLOWED_METHODS.join(", ")
  )
  response.headers.set(
    "Access-Control-Allow-Headers",
    requestedHeaders || DEFAULT_ALLOWED_HEADERS.join(", ")
  )
  response.headers.set("Access-Control-Max-Age", DEFAULT_MAX_AGE_SECONDS)
  appendVaryHeader(response, "Access-Control-Request-Headers")
  appendVaryHeader(response, "Access-Control-Request-Method")

  return response
}

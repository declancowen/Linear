"use client"

import { buildPublicApiRequestInput } from "@/lib/api/public-url"
import { buildDesktopAuthHeaders } from "@/lib/browser/desktop-auth-token"

import { RouteMutationError } from "./route-mutation-error"

const ROUTE_ERROR_PAYLOAD_KEYS = [
  "error",
  "message",
  "code",
  "retryable",
  "details",
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseRouteErrorPayload(payload: unknown) {
  if (!isRecord(payload)) {
    return null
  }

  return {
    message: getRouteErrorMessage(payload),
    code: typeof payload.code === "string" ? payload.code : null,
    retryable:
      typeof payload.retryable === "boolean" ? payload.retryable : null,
    details: getRouteErrorDetails(payload),
  }
}

function getRouteErrorMessage(payload: Record<string, unknown>) {
  if (typeof payload.error === "string") {
    return payload.error
  }

  return typeof payload.message === "string" ? payload.message : null
}

function getRouteErrorDetails(payload: Record<string, unknown>) {
  if (isRecord(payload.details)) {
    return payload.details
  }

  const legacyDetails = getLegacyRouteErrorDetails(payload)

  return Object.keys(legacyDetails).length > 0 ? legacyDetails : null
}

function getLegacyRouteErrorDetails(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([key]) => !ROUTE_ERROR_PAYLOAD_KEYS.includes(key as never)
    )
  )
}

async function parseRouteMutationPayload(response: Response) {
  const fallbackBody = response.clone()

  return response.json().catch(async () => {
    const text = await fallbackBody.text().catch(() => "")
    const message = text.trim()

    if (message.length === 0) {
      return null
    }

    return {
      error: message.startsWith("<")
        ? response.statusText || "Request failed"
        : message,
    }
  }) as Promise<unknown>
}

function createNetworkRouteMutationError(error: unknown) {
  return new RouteMutationError(getNetworkRouteMutationMessage(error), 0, {
    retryable: true,
  })
}

function getNetworkRouteMutationMessage(error: unknown) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "Network request failed"
}

function createFailedRouteMutationError(response: Response, payload: unknown) {
  const parsedError = parseRouteErrorPayload(payload)

  return new RouteMutationError(
    getFailedRouteMutationMessage(response, parsedError),
    response.status,
    getFailedRouteMutationOptions(parsedError)
  )
}

function getFailedRouteMutationMessage(
  response: Response,
  parsedError: ReturnType<typeof parseRouteErrorPayload>
) {
  return parsedError?.message ?? response.statusText ?? "Request failed"
}

function getFailedRouteMutationOptions(
  parsedError: ReturnType<typeof parseRouteErrorPayload>
) {
  return {
    code: parsedError?.code ?? null,
    retryable: parsedError?.retryable ?? null,
    details: parsedError?.details ?? null,
  }
}

async function fetchRouteMutation(input: RequestInfo | URL, init: RequestInit) {
  try {
    const headers = await buildDesktopAuthHeaders(init.headers)

    return await fetch(buildPublicApiRequestInput(input), {
      credentials: "include",
      ...init,
      headers,
    })
  } catch (error) {
    throw createNetworkRouteMutationError(error)
  }
}

function isDesktopSessionRefreshRequest(input: RequestInfo | URL) {
  const inputString =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.pathname
        : input.url

  return inputString.includes("/api/auth/desktop/session/refresh")
}

function canRefreshDesktopSession() {
  return (
    typeof window !== "undefined" &&
    window.electronApp?.isElectron === true &&
    typeof window.electronApp.getDesktopAuthToken === "function" &&
    typeof window.electronApp.setDesktopAuthToken === "function"
  )
}

function isDesktopSessionRetryCandidate(
  input: RequestInfo | URL,
  response: Response
) {
  return (
    response.status === 401 &&
    canRefreshDesktopSession() &&
    !isDesktopSessionRefreshRequest(input)
  )
}

function isDesktopSessionRefreshPayload(
  value: unknown
): value is { token: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { token?: unknown }).token === "string" &&
    (value as { token: string }).token.trim().length > 0
  )
}

async function refreshDesktopSessionForRouteRetry() {
  const currentToken = await window.electronApp?.getDesktopAuthToken?.()

  if (typeof currentToken !== "string" || currentToken.trim().length === 0) {
    return false
  }

  const refreshResponse = await fetch(
    buildPublicApiRequestInput("/api/auth/desktop/session/refresh"),
    {
      credentials: "include",
      headers: await buildDesktopAuthHeaders(),
      method: "POST",
    }
  ).catch(() => null)

  if (!refreshResponse?.ok) {
    return false
  }

  const refreshPayload = await refreshResponse.json().catch(() => null)

  if (!isDesktopSessionRefreshPayload(refreshPayload)) {
    return false
  }

  await window.electronApp?.setDesktopAuthToken?.(refreshPayload.token)

  return true
}

export async function runRouteMutation<T>(
  input: RequestInfo | URL,
  init: RequestInit
): Promise<T> {
  if (typeof window === "undefined") {
    throw new RouteMutationError(
      "Route mutations require a browser environment",
      500
    )
  }

  let response = await fetchRouteMutation(input, init)
  let payload = await parseRouteMutationPayload(response)

  if (isDesktopSessionRetryCandidate(input, response)) {
    const didRefresh = await refreshDesktopSessionForRouteRetry()

    if (didRefresh) {
      response = await fetchRouteMutation(input, init)
      payload = await parseRouteMutationPayload(response)
    }
  }

  if (!response.ok) {
    throw createFailedRouteMutationError(response, payload)
  }

  return payload as T
}

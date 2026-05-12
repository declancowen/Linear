"use client"

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
    return await fetch(input, init)
  } catch (error) {
    throw createNetworkRouteMutationError(error)
  }
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

  const response = await fetchRouteMutation(input, init)
  const payload = await parseRouteMutationPayload(response)

  if (!response.ok) {
    throw createFailedRouteMutationError(response, payload)
  }

  return payload as T
}

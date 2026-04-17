import { NextResponse } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"

type RouteErrorDetails = Record<string, unknown>

type JsonErrorInit = Omit<ResponseInit, "status"> & {
  code?: string
  retryable?: boolean
  details?: RouteErrorDetails
}

const RESERVED_ROUTE_ERROR_KEYS = new Set([
  "error",
  "message",
  "code",
  "retryable",
  "details",
])

function sanitizeRouteErrorDetails(details?: RouteErrorDetails) {
  if (!details) {
    return null
  }

  const entries = Object.entries(details).filter(
    ([key]) => !RESERVED_ROUTE_ERROR_KEYS.has(key)
  )

  if (entries.length === 0) {
    return null
  }

  return Object.fromEntries(entries)
}

export function jsonOk<T>(payload: T, init?: ResponseInit) {
  return NextResponse.json(payload, init)
}

export function jsonError(
  error: string,
  status: number,
  init?: JsonErrorInit
) {
  const details = sanitizeRouteErrorDetails(init?.details)
  const responseInit: ResponseInit = {
    statusText: init?.statusText,
    headers: init?.headers,
  }

  return NextResponse.json(
    {
      error,
      message: error,
      ...(typeof init?.code === "string" ? { code: init.code } : {}),
      ...(typeof init?.retryable === "boolean"
        ? { retryable: init.retryable }
        : {}),
      ...(details ? { details } : {}),
      ...(details ?? {}),
    },
    {
      ...responseInit,
      status,
    }
  )
}

export function jsonApplicationError(
  error: ApplicationError,
  init?: Omit<ResponseInit, "status">
) {
  return jsonError(error.message, error.status, {
    ...init,
    code: error.code,
    retryable: error.retryable ?? undefined,
    details: error.details ?? undefined,
  })
}

export function isRouteResponse(value: unknown): value is Response {
  return value instanceof Response
}

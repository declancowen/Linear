import { NextResponse } from "next/server"

export function jsonOk<T>(payload: T, init?: ResponseInit) {
  return NextResponse.json(payload, init)
}

export function jsonError(
  error: string,
  status: number,
  init?: Omit<ResponseInit, "status"> & {
    details?: Record<string, unknown>
  }
) {
  return NextResponse.json(
    {
      error,
      ...(init?.details ?? {}),
    },
    {
      ...init,
      status,
    }
  )
}

export function isRouteResponse(value: unknown): value is Response {
  return value instanceof Response
}

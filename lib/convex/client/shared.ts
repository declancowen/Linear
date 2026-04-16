"use client"

export const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? ""
export const hasConvex = convexUrl.length > 0

export class RouteMutationError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "RouteMutationError"
    this.status = status
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

  const response = await fetch(input, init)
  const payload = (await response.json().catch(() => null)) as {
    error?: string
  } | null

  if (!response.ok) {
    throw new RouteMutationError(
      payload?.error ?? "Request failed",
      response.status
    )
  }

  return payload as T
}

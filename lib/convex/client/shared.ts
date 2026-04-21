"use client"

export const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? ""
export const hasConvex = convexUrl.length > 0

export class RouteMutationError extends Error {
  status: number
  code: string | null
  retryable: boolean | null
  details: Record<string, unknown> | null

  constructor(
    message: string,
    status: number,
    options?: {
      code?: string | null
      retryable?: boolean | null
      details?: Record<string, unknown> | null
    }
  ) {
    super(message)
    this.name = "RouteMutationError"
    this.status = status
    this.code = options?.code ?? null
    this.retryable = options?.retryable ?? null
    this.details = options?.details ?? null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseRouteErrorPayload(payload: unknown) {
  if (!isRecord(payload)) {
    return null
  }

  const explicitDetails =
    isRecord(payload.details) ? payload.details : null
  const legacyDetails = Object.fromEntries(
    Object.entries(payload).filter(
      ([key]) =>
        !["error", "message", "code", "retryable", "details"].includes(key)
    )
  )
  const details =
    explicitDetails ??
    (Object.keys(legacyDetails).length > 0 ? legacyDetails : null)

  return {
    message:
      typeof payload.error === "string"
        ? payload.error
        : typeof payload.message === "string"
          ? payload.message
          : null,
    code: typeof payload.code === "string" ? payload.code : null,
    retryable:
      typeof payload.retryable === "boolean" ? payload.retryable : null,
    details,
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

  let response: Response

  try {
    response = await fetch(input, init)
  } catch (error) {
    throw new RouteMutationError(
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Network request failed",
      0,
      {
        retryable: true,
      }
    )
  }

  const fallbackBody = response.clone()
  const payload = (await response.json().catch(async () => {
    const text = await fallbackBody.text().catch(() => "")
    const message = text.trim()

    if (message.length === 0) {
      return null
    }

    return {
      error: message.startsWith("<") ? response.statusText || "Request failed" : message,
    }
  })) as unknown

  if (!response.ok) {
    const parsedError = parseRouteErrorPayload(payload)

    throw new RouteMutationError(
      parsedError?.message ?? response.statusText ?? "Request failed",
      response.status,
      {
        code: parsedError?.code ?? null,
        retryable: parsedError?.retryable ?? null,
        details: parsedError?.details ?? null,
      }
    )
  }

  return payload as T
}

const CONVEX_RETRY_DELAYS_MS = [150, 400]
const TRANSIENT_CONVEX_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
])

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

export function getErrorProperty(error: unknown, property: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    property in error &&
    typeof error[property as keyof typeof error] === "string"
  ) {
    return error[property as keyof typeof error] as string
  }

  return null
}

function getErrorCause(error: unknown) {
  if (typeof error === "object" && error !== null && "cause" in error) {
    return error.cause
  }

  return null
}

function getNestedErrorDiagnostics(error: unknown, depth: number) {
  const cause = getErrorCause(error)

  return cause ? getErrorDiagnostics(cause, depth + 1) : null
}

function getErrorObjectDiagnostics(error: unknown, depth: number) {
  return {
    name: getErrorProperty(error, "name"),
    message: getErrorProperty(error, "message"),
    code: getErrorProperty(error, "code"),
    cause: getNestedErrorDiagnostics(error, depth),
  }
}

export function getErrorDiagnostics(error: unknown, depth = 0): unknown {
  if (depth >= 4) {
    return {
      message: "Error cause depth exceeded",
    }
  }

  if (error instanceof Error) {
    return {
      ...getErrorObjectDiagnostics(error, depth),
      name: error.name,
      message: error.message,
    }
  }

  if (typeof error === "object" && error !== null) {
    return getErrorObjectDiagnostics(error, depth)
  }

  return {
    message: String(error),
  }
}

function hasTransientConvexErrorCode(error: unknown): boolean {
  let current: unknown = error
  let depth = 0

  while (current && depth < 4) {
    const code = getErrorProperty(current, "code")

    if (code && TRANSIENT_CONVEX_ERROR_CODES.has(code)) {
      return true
    }

    current = getErrorCause(current)
    depth += 1
  }

  return false
}

function isTransientConvexTransportError(error: unknown) {
  if (hasTransientConvexErrorCode(error)) {
    return true
  }

  let current: unknown = error
  let depth = 0

  while (current && depth < 4) {
    const message = getErrorProperty(current, "message")?.toLowerCase()

    if (
      message?.includes("fetch failed") ||
      message?.includes("network") ||
      message?.includes("socket") ||
      message?.includes("timed out")
    ) {
      return true
    }

    current = getErrorCause(current)
    depth += 1
  }

  return false
}

export async function runConvexRequestWithRetry<T>(
  label: string,
  request: () => Promise<T>,
  options?: {
    getWarningDetails?: (error: unknown) => Record<string, unknown>
  }
) {
  for (
    let attempt = 0;
    attempt <= CONVEX_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    try {
      return await request()
    } catch (error) {
      if (
        !isTransientConvexTransportError(error) ||
        attempt === CONVEX_RETRY_DELAYS_MS.length
      ) {
        throw error
      }

      console.warn(`Retrying ${label} after transient Convex failure`, {
        attempt: attempt + 1,
        ...(options?.getWarningDetails?.(error) ?? {
          error: getErrorDiagnostics(error),
        }),
      })

      await sleep(CONVEX_RETRY_DELAYS_MS[attempt]!)
    }
  }

  throw new Error(`Exhausted retries for ${label}`)
}

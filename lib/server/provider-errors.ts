import { getErrorDiagnostics } from "@/lib/server/convex"
import {
  getWorkOSAuthErrorCode,
  getWorkOSAuthErrorMessage,
} from "@/lib/server/workos"

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error
  }

  return null
}

export function getConvexErrorMessage(error: unknown, fallback: string) {
  return getUnknownErrorMessage(error) ?? fallback
}

export function getWorkOSErrorMessage(error: unknown, fallback: string) {
  const workosMessage = getWorkOSAuthErrorMessage(error)

  if (workosMessage) {
    return workosMessage
  }

  const workosCode = getWorkOSAuthErrorCode(error)

  if (workosCode) {
    return workosCode.replaceAll("_", " ")
  }

  return getUnknownErrorMessage(error) ?? fallback
}

export function getHmsErrorMessage(error: unknown, fallback: string) {
  return getUnknownErrorMessage(error) ?? fallback
}

export function logProviderError(label: string, error: unknown) {
  console.error(label, getErrorDiagnostics(error))
}

import { isApplicationError } from "@/lib/server/application-errors"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { jsonApplicationError, jsonError } from "@/lib/server/route-response"

export function handleCustomPropertyRouteError(
  error: unknown,
  logMessage: string,
  code: string
) {
  if (isApplicationError(error)) {
    return jsonApplicationError(error)
  }

  logProviderError(logMessage, error)
  return jsonError(getConvexErrorMessage(error, logMessage), 500, { code })
}

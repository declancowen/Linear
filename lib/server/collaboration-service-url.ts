import { resolveCollaborationServiceUrl } from "@/lib/collaboration/config"
import { ApplicationError } from "@/lib/server/application-errors"

function isSecureRequest(request: Request) {
  const requestUrl = new URL(request.url)

  if (requestUrl.protocol === "https:") {
    return true
  }

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase()

  return forwardedProto === "https"
}

export function getCollaborationServiceUrlForRequest(request: Request) {
  const serviceUrl = resolveCollaborationServiceUrl(process.env)

  if (!serviceUrl) {
    throw new Error("Collaboration service URL is not configured")
  }

  const parsedServiceUrl = new URL(serviceUrl)

  if (isSecureRequest(request) && parsedServiceUrl.protocol !== "https:") {
    throw new ApplicationError(
      "Collaboration service must use HTTPS/WSS when the app is served over HTTPS",
      503,
      {
        code: "COLLABORATION_UNAVAILABLE",
      }
    )
  }

  return serviceUrl
}

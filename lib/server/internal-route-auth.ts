import { timingSafeEqual } from "node:crypto"

import { resolveCollaborationInternalSecret } from "@/lib/collaboration/config"
import { jsonError } from "@/lib/server/route-response"

function getRequiredInternalSecret() {
  const secret = resolveCollaborationInternalSecret(process.env)

  if (!secret) {
    throw new Error("COLLABORATION_INTERNAL_SECRET is not configured")
  }

  return secret
}

function hasValidBearerSecret(
  authorization: string | null,
  expectedSecret: string
) {
  if (!authorization) {
    return false
  }

  const expectedAuthorization = `Bearer ${expectedSecret}`
  const providedBuffer = Buffer.from(authorization)
  const expectedBuffer = Buffer.from(expectedAuthorization)

  if (providedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(providedBuffer, expectedBuffer)
}

export function requireInternalBearerAuthorization(request: Request) {
  const authorization = request.headers.get("authorization")
  const secret = getRequiredInternalSecret()

  if (!hasValidBearerSecret(authorization, secret)) {
    return jsonError("Unauthorized", 401, {
      code: "AUTH_UNAUTHORIZED",
    })
  }

  return null
}

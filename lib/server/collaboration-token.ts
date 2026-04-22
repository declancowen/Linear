import { createHmac, timingSafeEqual } from "node:crypto"

import { resolveCollaborationTokenSecret } from "@/lib/collaboration/config"
import type { CollaborationSessionTokenClaims } from "@/lib/collaboration/transport"

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function getCollaborationTokenSecret() {
  const secret = resolveCollaborationTokenSecret(process.env)

  if (!secret) {
    throw new Error("COLLABORATION_TOKEN_SECRET is not configured")
  }

  return secret
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

export function createSignedCollaborationToken(
  claims: CollaborationSessionTokenClaims
) {
  const encodedClaims = base64UrlEncode(JSON.stringify(claims))
  const signature = sign(encodedClaims, getCollaborationTokenSecret())

  return `${encodedClaims}.${signature}`
}

export function verifySignedCollaborationToken(token: string) {
  const [encodedClaims, providedSignature, ...rest] = token.split(".")

  if (!encodedClaims || !providedSignature || rest.length > 0) {
    throw new Error("Invalid collaboration token")
  }

  const expectedSignature = sign(encodedClaims, getCollaborationTokenSecret())
  const providedBuffer = Buffer.from(providedSignature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid collaboration token signature")
  }

  return JSON.parse(
    base64UrlDecode(encodedClaims)
  ) as CollaborationSessionTokenClaims
}

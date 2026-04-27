import { createHmac, timingSafeEqual } from "node:crypto"

import { resolveCollaborationTokenSecret } from "@/lib/collaboration/config"
import {
  COLLABORATION_PROTOCOL_VERSION,
  RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
} from "@/lib/collaboration/protocol"
import type {
  CollaborationSessionTokenClaims,
  DocumentCollaborationSessionTokenClaims,
} from "@/lib/collaboration/transport"

type LegacyDocumentCollaborationSessionTokenClaims = Omit<
  DocumentCollaborationSessionTokenClaims,
  "protocolVersion" | "schemaVersion"
> &
  Partial<
    Pick<
      DocumentCollaborationSessionTokenClaims,
      "protocolVersion" | "schemaVersion"
    >
  >

type SignableCollaborationSessionTokenClaims =
  | CollaborationSessionTokenClaims
  | LegacyDocumentCollaborationSessionTokenClaims

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
  claims: SignableCollaborationSessionTokenClaims
) {
  const normalizedClaims =
    claims.kind === "doc"
      ? {
          ...claims,
          protocolVersion:
            claims.protocolVersion ?? COLLABORATION_PROTOCOL_VERSION,
          schemaVersion:
            claims.schemaVersion ?? RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
        }
      : claims
  const encodedClaims = base64UrlEncode(JSON.stringify(normalizedClaims))
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

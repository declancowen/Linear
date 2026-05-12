import type { Request as PartyRequest } from "partykit/server"

import {
  parseCollaborationSessionTokenClaims,
  type CollaborationSessionTokenClaims,
  type DocumentCollaborationSessionTokenClaims,
} from "../../../lib/collaboration/transport"
import {
  isSupportedCollaborationProtocolVersion,
  isSupportedRichTextCollaborationSchemaVersion,
} from "../../../lib/collaboration/protocol"

function base64UrlToBase64(value: string) {
  const withPadding = value.replace(/-/g, "+").replace(/_/g, "/")
  const remainder = withPadding.length % 4

  if (remainder === 0) {
    return withPadding
  }

  return `${withPadding}${"=".repeat(4 - remainder)}`
}

function decodeBase64UrlUtf8(value: string) {
  const normalized = base64UrlToBase64(value)
  const binary = atob(normalized)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

function decodeBase64UrlBytes(value: string) {
  const normalized = base64UrlToBase64(value)
  const binary = atob(normalized)

  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function signPayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  )

  return new Uint8Array(signature)
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false
  }

  let mismatch = 0

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index]! ^ right[index]!
  }

  return mismatch === 0
}

function getCollaborationRequestToken(
  request: PartyRequest | Request,
  url: URL
) {
  const authorization = request.headers.get("authorization")?.trim()
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null
  const token = bearerToken || url.searchParams.get("token")?.trim()

  if (!token) {
    throw new Error("Missing collaboration token")
  }

  return token
}

function splitCollaborationToken(token: string) {
  const [encodedClaims, providedSignature, ...rest] = token.split(".")

  if (!encodedClaims || !providedSignature || rest.length > 0) {
    throw new Error("Invalid collaboration token")
  }

  return {
    encodedClaims,
    providedSignature,
  }
}

function decodeProvidedSignature(providedSignature: string) {
  try {
    return decodeBase64UrlBytes(providedSignature)
  } catch {
    throw new Error("Invalid collaboration token")
  }
}

async function assertCollaborationTokenSignature(input: {
  encodedClaims: string
  providedSignature: string
  secret: string
}) {
  const expectedSignature = await signPayload(input.encodedClaims, input.secret)
  const providedSignatureBytes = decodeProvidedSignature(
    input.providedSignature
  )

  if (!timingSafeEqual(expectedSignature, providedSignatureBytes)) {
    throw new Error("Invalid collaboration token signature")
  }
}

function decodeCollaborationTokenClaims(encodedClaims: string) {
  try {
    return JSON.parse(decodeBase64UrlUtf8(encodedClaims))
  } catch {
    throw new Error("Invalid collaboration token")
  }
}

function parseVerifiedCollaborationClaims(
  decodedClaims: unknown
): CollaborationSessionTokenClaims {
  try {
    return parseCollaborationSessionTokenClaims(decodedClaims)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (
      message.includes("schemaVersion") ||
      message.includes("protocolVersion")
    ) {
      throw error
    }

    throw new Error("Invalid collaboration token")
  }
}

function assertCollaborationClaimsMatchRequest(
  claims: CollaborationSessionTokenClaims,
  expectedRoomId: string
) {
  if (claims.exp * 1000 <= Date.now()) {
    throw new Error("Expired collaboration token")
  }

  if (claims.roomId !== expectedRoomId) {
    throw new Error("Collaboration room mismatch")
  }
}

export async function verifyCollaborationRequestClaims(input: {
  request: PartyRequest | Request
  secret: string
  expectedRoomId: string
  requireClientVersionParams?: boolean
  allowLegacyClientVersionParams?: boolean
}): Promise<CollaborationSessionTokenClaims> {
  const url = new URL(input.request.url)
  const token = getCollaborationRequestToken(input.request, url)
  const { encodedClaims, providedSignature } = splitCollaborationToken(token)

  await assertCollaborationTokenSignature({
    encodedClaims,
    providedSignature,
    secret: input.secret,
  })

  const claims = parseVerifiedCollaborationClaims(
    decodeCollaborationTokenClaims(encodedClaims)
  )

  assertCollaborationClaimsMatchRequest(claims, input.expectedRoomId)

  if (claims.kind === "doc") {
    assertDocumentClientVersionParams({
      url,
      claims,
      requireClientVersionParams: input.requireClientVersionParams === true,
      allowLegacyClientVersionParams:
        input.allowLegacyClientVersionParams === true,
    })
  }

  return claims
}

function parseVersionParam(value: string | null, name: string) {
  if (value === null) {
    throw new Error(`${name} is required`)
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} is unsupported`)
  }

  return parsed
}

function assertDocumentClientVersionParams(input: {
  url: URL
  claims: DocumentCollaborationSessionTokenClaims
  requireClientVersionParams: boolean
  allowLegacyClientVersionParams: boolean
}) {
  const protocolVersionParam = input.url.searchParams.get("protocolVersion")
  const schemaVersionParam = input.url.searchParams.get("schemaVersion")
  const hasVersionParams =
    protocolVersionParam !== null || schemaVersionParam !== null

  if (!input.requireClientVersionParams && !hasVersionParams) {
    return
  }

  if (
    input.requireClientVersionParams &&
    !hasVersionParams &&
    input.allowLegacyClientVersionParams
  ) {
    return
  }

  const protocolVersion = parseVersionParam(
    protocolVersionParam,
    "protocolVersion"
  )
  const schemaVersion = parseVersionParam(schemaVersionParam, "schemaVersion")

  if (
    protocolVersion !== input.claims.protocolVersion ||
    !isSupportedCollaborationProtocolVersion(protocolVersion)
  ) {
    throw new Error("protocolVersion is unsupported")
  }

  if (
    schemaVersion !== input.claims.schemaVersion ||
    !isSupportedRichTextCollaborationSchemaVersion(schemaVersion)
  ) {
    throw new Error("schemaVersion is unsupported")
  }
}

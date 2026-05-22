import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

import { headers } from "next/headers"

import { consumeDesktopHandoffTicketServer } from "@/lib/server/convex/auth"

const DESKTOP_HANDOFF_TOKEN_TYPE = "desktop-handoff"
const DESKTOP_SESSION_TOKEN_TYPE = "desktop-session"
const DESKTOP_HANDOFF_TTL_MS = 2 * 60 * 1000
const DESKTOP_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DESKTOP_SESSION_SECRET_MIN_LENGTH = 32

type DesktopTokenType =
  | typeof DESKTOP_HANDOFF_TOKEN_TYPE
  | typeof DESKTOP_SESSION_TOKEN_TYPE

type DesktopSessionUser = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
}

type DesktopTokenPayload = {
  typ: DesktopTokenType
  sub: string
  email: string
  firstName?: string | null
  lastName?: string | null
  organizationId?: string | null
  iat: number
  exp: number
  jti: string
}

export type DesktopSessionTokenResult = {
  expiresAt: number
  token: string
}

type DesktopHandoffTicketConsumer = (input: {
  ticketId: string
  expiresAt: number
  consumedAt: number
}) => Promise<{ consumed: boolean }> | { consumed: boolean }

type DesktopSessionExchangeOptions = {
  consumeHandoffTicket?: DesktopHandoffTicketConsumer
  now?: number
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url")
}

function base64UrlJson(value: unknown) {
  return base64UrlEncode(JSON.stringify(value))
}

function decodeBase64UrlJson(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown
  } catch {
    return null
  }
}

function getDesktopSessionSecret() {
  const secret = process.env.DESKTOP_SESSION_SECRET?.trim()

  if (!secret || secret.length < DESKTOP_SESSION_SECRET_MIN_LENGTH) {
    throw new Error(
      "DESKTOP_SESSION_SECRET must be set to at least 32 characters."
    )
  }

  return secret
}

function signTokenPayload(payload: DesktopTokenPayload) {
  const encodedPayload = base64UrlJson(payload)
  const signature = createHmac("sha256", getDesktopSessionSecret())
    .update(encodedPayload)
    .digest("base64url")

  return `${encodedPayload}.${signature}`
}

function signaturesMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

function verifySignedToken(token: string) {
  const [encodedPayload, signature, extra] = token.split(".")

  if (!encodedPayload || !signature || extra) {
    return null
  }

  const expectedSignature = createHmac("sha256", getDesktopSessionSecret())
    .update(encodedPayload)
    .digest("base64url")

  if (!signaturesMatch(signature, expectedSignature)) {
    return null
  }

  return decodeBase64UrlJson(encodedPayload)
}

function isDesktopTokenPayload(value: unknown): value is DesktopTokenPayload {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const payload = value as Record<string, unknown>

  return (
    (payload.typ === DESKTOP_HANDOFF_TOKEN_TYPE ||
      payload.typ === DESKTOP_SESSION_TOKEN_TYPE) &&
    typeof payload.sub === "string" &&
    typeof payload.email === "string" &&
    typeof payload.iat === "number" &&
    typeof payload.exp === "number" &&
    typeof payload.jti === "string" &&
    (payload.organizationId === undefined ||
      payload.organizationId === null ||
      typeof payload.organizationId === "string") &&
    (payload.firstName === undefined ||
      payload.firstName === null ||
      typeof payload.firstName === "string") &&
    (payload.lastName === undefined ||
      payload.lastName === null ||
      typeof payload.lastName === "string")
  )
}

function verifyDesktopToken(
  token: string,
  expectedType: DesktopTokenType,
  now = Date.now()
) {
  const payload = verifySignedToken(token)

  if (!isDesktopTokenPayload(payload) || payload.typ !== expectedType) {
    return null
  }

  if (payload.exp <= now || payload.iat > now + 30_000) {
    return null
  }

  return payload
}

function createDesktopTokenPayload(input: {
  expiresAt: number
  issuedAt: number
  organizationId?: string | null
  type: DesktopTokenType
  user: DesktopSessionUser
}) {
  return {
    typ: input.type,
    sub: input.user.id,
    email: input.user.email,
    firstName: input.user.firstName ?? null,
    lastName: input.user.lastName ?? null,
    organizationId: input.organizationId ?? null,
    iat: input.issuedAt,
    exp: input.expiresAt,
    jti: randomUUID(),
  } satisfies DesktopTokenPayload
}

export function createDesktopHandoffTicket(input: {
  organizationId?: string | null
  user: DesktopSessionUser
  now?: number
}) {
  const issuedAt = input.now ?? Date.now()
  const expiresAt = issuedAt + DESKTOP_HANDOFF_TTL_MS

  return {
    expiresAt,
    ticket: signTokenPayload(
      createDesktopTokenPayload({
        expiresAt,
        issuedAt,
        organizationId: input.organizationId,
        type: DESKTOP_HANDOFF_TOKEN_TYPE,
        user: input.user,
      })
    ),
  }
}

function normalizeDesktopSessionExchangeOptions(
  value?: number | DesktopSessionExchangeOptions
): Required<DesktopSessionExchangeOptions> {
  if (typeof value === "number") {
    return {
      consumeHandoffTicket: consumeDesktopHandoffTicketServer,
      now: value,
    }
  }

  return {
    consumeHandoffTicket:
      value?.consumeHandoffTicket ?? consumeDesktopHandoffTicketServer,
    now: value?.now ?? Date.now(),
  }
}

export async function createDesktopSessionTokenFromHandoffTicket(
  ticket: string,
  options?: number | DesktopSessionExchangeOptions
): Promise<DesktopSessionTokenResult | null> {
  const { consumeHandoffTicket, now } =
    normalizeDesktopSessionExchangeOptions(options)
  const handoffPayload = verifyDesktopToken(
    ticket,
    DESKTOP_HANDOFF_TOKEN_TYPE,
    now
  )

  if (!handoffPayload) {
    return null
  }

  const consumptionResult = await consumeHandoffTicket({
    consumedAt: now,
    expiresAt: handoffPayload.exp,
    ticketId: handoffPayload.jti,
  })

  if (!consumptionResult.consumed) {
    return null
  }

  const expiresAt = now + DESKTOP_SESSION_TTL_MS
  const token = signTokenPayload(
    createDesktopTokenPayload({
      expiresAt,
      issuedAt: now,
      organizationId: handoffPayload.organizationId,
      type: DESKTOP_SESSION_TOKEN_TYPE,
      user: {
        id: handoffPayload.sub,
        email: handoffPayload.email,
        firstName: handoffPayload.firstName,
        lastName: handoffPayload.lastName,
      },
    })
  )

  return {
    expiresAt,
    token,
  }
}

export function verifyDesktopSessionToken(token: string, now = Date.now()) {
  try {
    return verifyDesktopToken(token, DESKTOP_SESSION_TOKEN_TYPE, now)
  } catch {
    return null
  }
}

function parseBearerToken(value: string | null) {
  const match = value?.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()

  return token && token.length > 0 ? token : null
}

async function getNextRequestHeaders() {
  try {
    return await headers()
  } catch {
    return null
  }
}

function createDesktopAuthenticatedSession(payload: DesktopTokenPayload) {
  return {
    organizationId: payload.organizationId ?? undefined,
    user: {
      id: payload.sub,
      email: payload.email,
      firstName: payload.firstName ?? null,
      lastName: payload.lastName ?? null,
    },
  }
}

export async function getDesktopSessionFromRequestHeaders(
  requestHeaders?: Headers | null
) {
  const resolvedHeaders = requestHeaders ?? (await getNextRequestHeaders())
  const token = parseBearerToken(resolvedHeaders?.get("authorization") ?? null)

  if (!token) {
    return null
  }

  const payload = verifyDesktopSessionToken(token)

  return payload ? createDesktopAuthenticatedSession(payload) : null
}

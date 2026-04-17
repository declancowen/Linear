import { createHmac, randomUUID } from "node:crypto"

const HMS_API_BASE_URL = "https://api.100ms.live/v2"
const MANAGEMENT_TOKEN_TTL_SECONDS = 24 * 60 * 60
const APP_TOKEN_TTL_SECONDS = 24 * 60 * 60

type HmsRoom = {
  id: string
  name: string
}

export type TeamMeetingRole = "host" | "guest"

type ConversationMeetingInput = {
  roomKey: string
  roomDescription: string
  userId: string
  userName: string
  role: TeamMeetingRole
}

function getHmsConfig() {
  const accessKey = process.env.HMS_ACCESS_KEY?.trim()
  const secret = process.env.HMS_SECRET?.trim()
  const templateId = process.env.HMS_TEMPLATE_ID?.trim()
  const templateSubdomain = process.env.HMS_TEMPLATE_SUBDOMAIN?.trim()

  if (!accessKey || !secret || !templateId || !templateSubdomain) {
    throw new Error(
      "100ms is not configured. Set HMS_ACCESS_KEY, HMS_SECRET, HMS_TEMPLATE_ID, and HMS_TEMPLATE_SUBDOMAIN."
    )
  }

  return {
    accessKey,
    secret,
    templateId,
    templateSubdomain,
  }
}

function createJwt(payload: Record<string, string | number>, secret: string) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  }

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
    "base64url"
  )
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  )
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url")

  return `${encodedHeader}.${encodedPayload}.${signature}`
}

function createManagementToken(accessKey: string, secret: string) {
  const now = Math.floor(Date.now() / 1000)

  return createJwt(
    {
      access_key: accessKey,
      type: "management",
      version: 2,
      jti: randomUUID(),
      iat: now,
      nbf: now,
      exp: now + MANAGEMENT_TOKEN_TTL_SECONDS,
    },
    secret
  )
}

function createAppToken(input: {
  accessKey: string
  secret: string
  roomId: string
  userId: string
  role: TeamMeetingRole
}) {
  const now = Math.floor(Date.now() / 1000)

  return createJwt(
    {
      access_key: input.accessKey,
      room_id: input.roomId,
      user_id: input.userId,
      role: input.role,
      type: "app",
      version: 2,
      jti: randomUUID(),
      iat: now,
      nbf: now,
      exp: now + APP_TOKEN_TTL_SECONDS,
    },
    input.secret
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null
}

function formatHmsError(payload: unknown, fallbackMessage: string) {
  if (!isRecord(payload)) {
    return fallbackMessage
  }

  const message = readString(payload.message)
  const details = Array.isArray(payload.details)
    ? payload.details.filter(
        (entry): entry is string => typeof entry === "string"
      )
    : []

  if (message && details.length > 0) {
    return `${message}: ${details.join(", ")}`
  }

  return message ?? fallbackMessage
}

async function hmsRequest<T>(path: string, init?: RequestInit) {
  const { accessKey, secret } = getHmsConfig()
  const managementToken = createManagementToken(accessKey, secret)
  const response = await fetch(`${HMS_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${managementToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })

  const payload = (await response.json().catch(() => null)) as T | null

  if (!response.ok) {
    throw new Error(
      formatHmsError(
        payload,
        `100ms request failed with status ${response.status}`
      )
    )
  }

  if (!payload) {
    throw new Error("100ms returned an empty response")
  }

  return payload
}

function extractRoom(payload: unknown): HmsRoom {
  const candidates = [payload, isRecord(payload) ? payload.data : null]

  for (const candidate of candidates) {
    if (!isRecord(candidate)) {
      continue
    }

    const id = readString(candidate.id)
    const name = readString(candidate.name)

    if (id && name) {
      return { id, name }
    }
  }

  throw new Error("100ms room response is missing the room identifier")
}

function createRoomName(roomKey: string) {
  return `linear-${roomKey}`.slice(0, 128)
}

async function ensureRoom(input: { roomKey: string; roomDescription: string }) {
  const { templateId } = getHmsConfig()
  const payload = await hmsRequest("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: createRoomName(input.roomKey),
      description: input.roomDescription,
      template_id: templateId,
    }),
  })

  return extractRoom(payload)
}

function createDirectJoinUrl(input: {
  templateSubdomain: string
  accessKey: string
  secret: string
  roomId: string
  role: TeamMeetingRole
  userId: string
  userName: string
}) {
  const authToken = createAppToken({
    accessKey: input.accessKey,
    secret: input.secret,
    roomId: input.roomId,
    userId: input.userId,
    role: input.role,
  })
  const query = new URLSearchParams({
    skip_preview_headful: "true",
    auth_token: authToken,
    name: input.userName,
  })

  return `https://${input.templateSubdomain}.app.100ms.live/preview/${input.roomId}/${input.role}?${query.toString()}`
}

export async function createConversationJoinUrl(
  input: ConversationMeetingInput & {
    roomId?: string | null
  }
) {
  const { accessKey, secret, templateSubdomain } = getHmsConfig()
  const room = input.roomId
    ? {
        id: input.roomId,
      }
    : await ensureRoom({
        roomKey: input.roomKey,
        roomDescription: input.roomDescription,
      })

  return createDirectJoinUrl({
    templateSubdomain,
    accessKey,
    secret,
    roomId: room.id,
    role: input.role,
    userId: input.userId,
    userName: input.userName,
  })
}

export async function ensureConversationRoom(input: {
  roomKey: string
  roomDescription: string
}) {
  return ensureRoom(input)
}

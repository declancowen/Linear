import {
  normalizeAuthNextPath,
  parseAuthMode,
  type AuthMode,
} from "@/lib/auth-routing"

export const pendingEmailVerificationCookieName =
  "pending_email_verification"

const pendingEmailVerificationCookieMaxAge = 60 * 15

export type PendingEmailVerificationState = {
  email: string
  mode: AuthMode
  nextPath: string
  pendingAuthenticationToken: string
}

function encodeState(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function decodeState(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

export function serializePendingEmailVerificationState(
  state: PendingEmailVerificationState
) {
  return encodeState(JSON.stringify(state))
}

export function parsePendingEmailVerificationState(
  value: string | undefined | null
) {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(
      decodeState(value)
    ) as Partial<PendingEmailVerificationState>
    const mode = parseAuthMode(parsed.mode)

    if (
      !mode ||
      typeof parsed.email !== "string" ||
      typeof parsed.pendingAuthenticationToken !== "string"
    ) {
      return null
    }

    return {
      email: parsed.email,
      mode,
      nextPath: normalizeAuthNextPath(parsed.nextPath),
      pendingAuthenticationToken: parsed.pendingAuthenticationToken,
    }
  } catch {
    return null
  }
}

export const pendingEmailVerificationCookieOptions = {
  httpOnly: true,
  maxAge: pendingEmailVerificationCookieMaxAge,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
}

export const clearPendingEmailVerificationCookieOptions = {
  ...pendingEmailVerificationCookieOptions,
  maxAge: 0,
}

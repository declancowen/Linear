type CollaborationEnvSource = Record<string, unknown>

export const DEFAULT_COLLABORATION_REFRESH_TIMEOUT_MS = 1500

function readEnvString(
  env: CollaborationEnvSource,
  key: string
): string | null {
  const value = env[key]

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

export function resolveCollaborationServiceUrl(
  env: CollaborationEnvSource
): string | null {
  return (
    readEnvString(env, "NEXT_PUBLIC_PARTYKIT_URL") ??
    readEnvString(env, "PARTYKIT_URL") ??
    readEnvString(env, "NEXT_PUBLIC_COLLABORATION_SERVICE_URL") ??
    readEnvString(env, "COLLABORATION_SERVICE_URL")
  )
}

export function resolveCollaborationTokenSecret(
  env: CollaborationEnvSource
): string | null {
  return readEnvString(env, "COLLABORATION_TOKEN_SECRET")
}

export function resolveCollaborationRefreshTimeoutMs(
  env: CollaborationEnvSource
) {
  const rawValue = readEnvString(env, "COLLABORATION_REFRESH_TIMEOUT_MS")

  if (!rawValue) {
    return DEFAULT_COLLABORATION_REFRESH_TIMEOUT_MS
  }

  const parsed = Number(rawValue)

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_COLLABORATION_REFRESH_TIMEOUT_MS
}

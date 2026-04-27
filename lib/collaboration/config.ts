type CollaborationEnvSource = Record<string, unknown>

function readEnvString(env: CollaborationEnvSource, key: string): string | null {
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

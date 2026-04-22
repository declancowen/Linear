const DEFAULT_LOCAL_PARTYKIT_URL = "http://127.0.0.1:1999"
const DEFAULT_LOCAL_APP_ORIGIN = "http://127.0.0.1:3000"
const DEFAULT_LOCAL_INTERNAL_SECRET =
  "linear-local-collaboration-internal-secret"
const DEFAULT_LOCAL_TOKEN_SECRET = "linear-local-collaboration-token-secret"

type CollaborationEnvSource = Record<string, unknown>

function readEnvString(
  env: CollaborationEnvSource,
  key: string
): string | null {
  const value = env[key]

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function isNextLocalFallbackAllowed() {
  return (
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production"
  )
}

function isLocalPartyKitHost(env: CollaborationEnvSource) {
  const host =
    readEnvString(env, "PARTYKIT_HOST") ??
    readEnvString(env, "HOST") ??
    readEnvString(env, "COLLABORATION_SERVICE_URL") ??
    readEnvString(env, "NEXT_PUBLIC_PARTYKIT_URL")

  if (!host) {
    return false
  }

  return /(?:^|:\/\/)(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(host)
}

function isLocalFallbackAllowed(env: CollaborationEnvSource) {
  return isNextLocalFallbackAllowed() || isLocalPartyKitHost(env)
}

export function resolveCollaborationServiceUrl(
  env: CollaborationEnvSource
): string | null {
  return (
    readEnvString(env, "NEXT_PUBLIC_PARTYKIT_URL") ??
    readEnvString(env, "PARTYKIT_URL") ??
    readEnvString(env, "NEXT_PUBLIC_COLLABORATION_SERVICE_URL") ??
    readEnvString(env, "COLLABORATION_SERVICE_URL") ??
    (isLocalFallbackAllowed(env) ? DEFAULT_LOCAL_PARTYKIT_URL : null)
  )
}

export function resolveCollaborationAppOrigin(
  env: CollaborationEnvSource
): string | null {
  return (
    readEnvString(env, "COLLABORATION_APP_ORIGIN") ??
    readEnvString(env, "APP_URL") ??
    readEnvString(env, "NEXT_PUBLIC_APP_URL") ??
    (isLocalFallbackAllowed(env) ? DEFAULT_LOCAL_APP_ORIGIN : null)
  )
}

export function resolveCollaborationInternalSecret(
  env: CollaborationEnvSource
): string | null {
  return (
    readEnvString(env, "COLLABORATION_INTERNAL_SECRET") ??
    (isLocalFallbackAllowed(env) ? DEFAULT_LOCAL_INTERNAL_SECRET : null)
  )
}

export function resolveCollaborationTokenSecret(
  env: CollaborationEnvSource
): string | null {
  return (
    readEnvString(env, "COLLABORATION_TOKEN_SECRET") ??
    (isLocalFallbackAllowed(env) ? DEFAULT_LOCAL_TOKEN_SECRET : null)
  )
}

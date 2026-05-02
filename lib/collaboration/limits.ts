export type CollaborationLimits = {
  maxConnectionsPerRoom: number
  maxEditorsPerRoom: number
  maxFlushBodyBytes: number
  maxContentJsonBytes: number
  maxCanonicalHtmlBytes: number
}

export const DEFAULT_COLLABORATION_LIMITS: CollaborationLimits = {
  maxConnectionsPerRoom: 50,
  maxEditorsPerRoom: 25,
  maxFlushBodyBytes: 2_000_000,
  maxContentJsonBytes: 1_500_000,
  maxCanonicalHtmlBytes: 1_000_000,
}

type CollaborationLimitEnvKey =
  | "COLLABORATION_MAX_CONNECTIONS_PER_ROOM"
  | "COLLABORATION_MAX_EDITORS_PER_ROOM"
  | "COLLABORATION_MAX_FLUSH_BODY_BYTES"
  | "COLLABORATION_MAX_CONTENT_JSON_BYTES"
  | "COLLABORATION_MAX_CANONICAL_HTML_BYTES"

const LIMIT_ENV_MAP: Array<{
  key: keyof CollaborationLimits
  envKey: CollaborationLimitEnvKey
}> = [
  {
    key: "maxConnectionsPerRoom",
    envKey: "COLLABORATION_MAX_CONNECTIONS_PER_ROOM",
  },
  {
    key: "maxEditorsPerRoom",
    envKey: "COLLABORATION_MAX_EDITORS_PER_ROOM",
  },
  {
    key: "maxFlushBodyBytes",
    envKey: "COLLABORATION_MAX_FLUSH_BODY_BYTES",
  },
  {
    key: "maxContentJsonBytes",
    envKey: "COLLABORATION_MAX_CONTENT_JSON_BYTES",
  },
  {
    key: "maxCanonicalHtmlBytes",
    envKey: "COLLABORATION_MAX_CANONICAL_HTML_BYTES",
  },
]

const warnedInvalidLimitKeys = new Set<string>()

function readLimitOverride(
  env: Record<string, unknown>,
  envKey: CollaborationLimitEnvKey
) {
  const raw = env[envKey]

  if (typeof raw === "undefined" || raw === null || raw === "") {
    return null
  }

  const parsed =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN

  if (!Number.isInteger(parsed) || parsed <= 0) {
    if (!warnedInvalidLimitKeys.has(envKey)) {
      warnedInvalidLimitKeys.add(envKey)
      console.warn("[collaboration] invalid limit override ignored", {
        envKey,
        value: raw,
      })
    }

    return null
  }

  return parsed
}

export function resolveCollaborationLimits(
  env: Record<string, unknown>
): CollaborationLimits {
  const limits: CollaborationLimits = {
    ...DEFAULT_COLLABORATION_LIMITS,
  }

  for (const { key, envKey } of LIMIT_ENV_MAP) {
    const override = readLimitOverride(env, envKey)

    if (override !== null) {
      limits[key] = override
    }
  }

  return limits
}

export function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength
}

export function getJsonByteLength(value: unknown) {
  return getUtf8ByteLength(JSON.stringify(value))
}

type RealtimeEnvSource = Record<string, string | undefined>

function parseEnvBoolean(
  env: RealtimeEnvSource,
  key: string,
  defaultValue: boolean
) {
  const rawValue = env[key]?.trim().toLowerCase()

  if (!rawValue) {
    return defaultValue
  }

  if (["1", "true", "yes", "on"].includes(rawValue)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(rawValue)) {
    return false
  }

  return defaultValue
}

export function isScopedSyncEnabled(env: RealtimeEnvSource = process.env) {
  return parseEnvBoolean(env, "NEXT_PUBLIC_ENABLE_SCOPED_SYNC", true)
}

export function isLegacySnapshotStreamEnabled(
  env: RealtimeEnvSource = process.env
) {
  return parseEnvBoolean(
    env,
    "NEXT_PUBLIC_ENABLE_LEGACY_SNAPSHOT_STREAM",
    false
  )
}

export function shouldUseLegacySnapshotSync(
  env: RealtimeEnvSource = process.env
) {
  return !isScopedSyncEnabled(env) || isLegacySnapshotStreamEnabled(env)
}

export function isCollaborationEnabled(env: RealtimeEnvSource = process.env) {
  return parseEnvBoolean(env, "NEXT_PUBLIC_ENABLE_COLLABORATION", true)
}

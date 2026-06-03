type RealtimeCostEnvSource = Record<string, string | undefined>

export const REALTIME_STREAM_DEFAULT_POLL_INTERVAL_MS = 15000
export const REALTIME_STREAM_MIN_POLL_INTERVAL_MS = 15000
export const REALTIME_STREAM_HEARTBEAT_INTERVAL_MS = 15000
export const REALTIME_STREAM_MAX_DURATION_MS = 55000
export const REALTIME_STREAM_DEFAULT_RETRY_MS = 15000
export const REALTIME_STREAM_UNAVAILABLE_RETRY_MS = 30000
export const SCOPED_DEGRADED_REFRESH_INTERVAL_MS = 30000
export const SCOPED_FOREGROUND_REFRESH_STALE_MS = 30000

export function resolveRealtimeStreamPollIntervalMs(
  env: RealtimeCostEnvSource = process.env
) {
  const rawValue = env.REALTIME_STREAM_POLL_INTERVAL_MS?.trim()

  if (!rawValue) {
    return REALTIME_STREAM_DEFAULT_POLL_INTERVAL_MS
  }

  const parsedValue = Number(rawValue)

  if (!Number.isFinite(parsedValue)) {
    return REALTIME_STREAM_DEFAULT_POLL_INTERVAL_MS
  }

  return Math.max(
    REALTIME_STREAM_MIN_POLL_INTERVAL_MS,
    Math.round(parsedValue)
  )
}

export function isForegroundScopedRefreshStale(input: {
  lastRefreshRequestedAt: number
  now: number
}) {
  return (
    input.now - input.lastRefreshRequestedAt >=
    SCOPED_FOREGROUND_REFRESH_STALE_MS
  )
}

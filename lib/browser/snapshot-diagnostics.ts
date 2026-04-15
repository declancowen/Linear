import type { AppSnapshot } from "@/lib/domain/types"

type SnapshotDiagnosticsState = {
  reconnectCount: number
}

declare global {
  interface Window {
    __linearSnapshotDiagnostics?: SnapshotDiagnosticsState
  }
}

function isEnabled() {
  return process.env.NODE_ENV !== "production" && typeof window !== "undefined"
}

function getState() {
  if (!window.__linearSnapshotDiagnostics) {
    window.__linearSnapshotDiagnostics = {
      reconnectCount: 0,
    }
  }

  return window.__linearSnapshotDiagnostics
}

function roundDuration(durationMs: number) {
  return Math.round(durationMs * 10) / 10
}

function getSnapshotBytes(snapshot: AppSnapshot) {
  return new TextEncoder().encode(JSON.stringify(snapshot)).length
}

export function reportSnapshotFetchDiagnostic(input: {
  durationMs: number
  version: number
  snapshot: AppSnapshot
}) {
  if (!isEnabled()) {
    return
  }

  console.debug("[snapshot] fetched", {
    version: input.version,
    durationMs: roundDuration(input.durationMs),
    bytes: getSnapshotBytes(input.snapshot),
  })
}

export function reportSnapshotApplyDiagnostic(input: {
  durationMs: number
  version: number
}) {
  if (!isEnabled()) {
    return
  }

  console.debug("[snapshot] applied", {
    version: input.version,
    durationMs: roundDuration(input.durationMs),
  })
}

export function reportSnapshotStreamReconnectDiagnostic(delayMs: number) {
  if (!isEnabled()) {
    return
  }

  const state = getState()
  state.reconnectCount += 1

  console.debug("[snapshot] reconnect scheduled", {
    delayMs,
    reconnectCount: state.reconnectCount,
  })
}

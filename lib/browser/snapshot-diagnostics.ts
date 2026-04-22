import type { AppSnapshot } from "@/lib/domain/types"

type SnapshotDiagnosticsState = {
  collaborationFailureCount: number
  collaborationJoinCount: number
  fallbackCount: number
  reconnectCount: number
  scopedReconnectCount: number
  scopedRefreshCount: number
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
      scopedReconnectCount: 0,
      scopedRefreshCount: 0,
      fallbackCount: 0,
      collaborationJoinCount: 0,
      collaborationFailureCount: 0,
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

export function reportBootstrapModeDiagnostic(mode: string) {
  if (!isEnabled()) {
    return
  }

  console.debug("[realtime] bootstrap mode", {
    mode,
  })
}

export function reportRealtimeFallbackDiagnostic(input: {
  reason: string
  target: string
}) {
  if (!isEnabled()) {
    return
  }

  const state = getState()
  state.fallbackCount += 1

  console.warn("[realtime] fallback activated", {
    reason: input.reason,
    target: input.target,
    fallbackCount: state.fallbackCount,
  })
}

export function reportScopedReadModelDiagnostic(input: {
  durationMs: number
  scopeKeys: string[]
  status: "success" | "failure"
  errorMessage?: string
}) {
  if (!isEnabled()) {
    return
  }

  const state = getState()
  state.scopedRefreshCount += 1

  console.debug("[scoped-sync] read model refresh", {
    durationMs: roundDuration(input.durationMs),
    scopeKeys: input.scopeKeys,
    status: input.status,
    errorMessage: input.errorMessage,
    refreshCount: state.scopedRefreshCount,
  })
}

export function reportScopedStreamReconnectDiagnostic(scopeKeys: string[]) {
  if (!isEnabled()) {
    return
  }

  const state = getState()
  state.scopedReconnectCount += 1

  console.debug("[scoped-sync] reconnect scheduled", {
    reconnectCount: state.scopedReconnectCount,
    scopeKeys,
  })
}

export function reportCollaborationSessionDiagnostic(input: {
  documentId: string
  durationMs: number
  status: "success" | "failure"
  errorMessage?: string
}) {
  if (!isEnabled()) {
    return
  }

  const state = getState()

  if (input.status === "success") {
    state.collaborationJoinCount += 1
  } else {
    state.collaborationFailureCount += 1
  }

  console.debug("[collaboration] session open", {
    documentId: input.documentId,
    durationMs: roundDuration(input.durationMs),
    status: input.status,
    errorMessage: input.errorMessage,
    joinCount: state.collaborationJoinCount,
    failureCount: state.collaborationFailureCount,
  })
}

"use client"

import { buildScopedInvalidationStreamUrl } from "@/lib/convex/client"

export type ScopedInvalidationEntry = {
  scopeKey: string
  version: number
}

export type ScopedInvalidationEnvelope = {
  versions: ScopedInvalidationEntry[]
}

export function openScopedInvalidationStream(input: {
  scopeKeys: string[]
  onReady?: (envelope: ScopedInvalidationEnvelope) => void
  onInvalidate?: (envelope: ScopedInvalidationEnvelope) => void
  onError?: (error: Event) => void
}) {
  if (typeof EventSource === "undefined") {
    return () => {}
  }

  const eventSource = new EventSource(
    buildScopedInvalidationStreamUrl(input.scopeKeys)
  )

  const handleReady = (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as ScopedInvalidationEnvelope
      input.onReady?.(payload)
    } catch {}
  }

  const handleInvalidate = (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as ScopedInvalidationEnvelope
      input.onInvalidate?.(payload)
    } catch {}
  }

  const handleError = (event: Event) => {
    input.onError?.(event)
  }

  eventSource.addEventListener("ready", handleReady)
  eventSource.addEventListener("scope", handleInvalidate)
  eventSource.onerror = handleError

  return () => {
    eventSource.removeEventListener("ready", handleReady)
    eventSource.removeEventListener("scope", handleInvalidate)
    eventSource.close()
  }
}

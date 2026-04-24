"use client"

import { buildScopedInvalidationStreamUrl } from "@/lib/convex/client"

export type ScopedInvalidationEntry = {
  scopeKey: string
  version: number
}

export type ScopedInvalidationEnvelope = {
  versions: ScopedInvalidationEntry[]
}

export type ScopedInvalidationUnavailableEnvelope = {
  code: string
  message: string
}

type ScopedInvalidationSubscriber = {
  id: number
  scopeKeys: Set<string>
  onReady?: (envelope: ScopedInvalidationEnvelope) => void
  onInvalidate?: (envelope: ScopedInvalidationEnvelope) => void
  onUnavailable?: (envelope: ScopedInvalidationUnavailableEnvelope) => void
  onError?: (error: Event) => void
}

let nextSubscriberId = 1
const subscribers = new Map<number, ScopedInvalidationSubscriber>()
let activeEventSource: EventSource | null = null
let activeScopeSignature = ""
let lastReadyEnvelope: ScopedInvalidationEnvelope | null = null
let rebuildScheduled = false

function normalizeScopeKeys(scopeKeys: string[]) {
  return [...new Set(scopeKeys.map((scopeKey) => scopeKey.trim()).filter(Boolean))].sort()
}

function getUnionScopeKeys() {
  const scopeKeys = new Set<string>()

  for (const subscriber of subscribers.values()) {
    for (const scopeKey of subscriber.scopeKeys) {
      scopeKeys.add(scopeKey)
    }
  }

  return [...scopeKeys].sort()
}

function filterEnvelopeForSubscriber(
  envelope: ScopedInvalidationEnvelope,
  subscriber: ScopedInvalidationSubscriber
) {
  return {
    versions: envelope.versions.filter((entry) =>
      subscriber.scopeKeys.has(entry.scopeKey)
    ),
  }
}

function dispatchReady(envelope: ScopedInvalidationEnvelope) {
  lastReadyEnvelope = envelope

  for (const subscriber of subscribers.values()) {
    subscriber.onReady?.(filterEnvelopeForSubscriber(envelope, subscriber))
  }
}

function dispatchInvalidate(envelope: ScopedInvalidationEnvelope) {
  for (const subscriber of subscribers.values()) {
    const filteredEnvelope = filterEnvelopeForSubscriber(envelope, subscriber)

    if (filteredEnvelope.versions.length === 0) {
      continue
    }

    subscriber.onInvalidate?.(filteredEnvelope)
  }
}

function dispatchUnavailable(envelope: ScopedInvalidationUnavailableEnvelope) {
  for (const subscriber of subscribers.values()) {
    subscriber.onUnavailable?.(envelope)
  }
}

function dispatchError(error: Event) {
  for (const subscriber of subscribers.values()) {
    subscriber.onError?.(error)
  }
}

function closeActiveEventSource() {
  if (!activeEventSource) {
    return
  }

  activeEventSource.close()
  activeEventSource = null
  activeScopeSignature = ""
  lastReadyEnvelope = null
}

function rebuildScopedInvalidationStream() {
  if (typeof EventSource === "undefined") {
    return
  }

  const scopeKeys = getUnionScopeKeys()
  const nextScopeSignature = scopeKeys.join("|")

  if (nextScopeSignature === activeScopeSignature) {
    return
  }

  closeActiveEventSource()

  if (scopeKeys.length === 0) {
    return
  }

  const eventSource = new EventSource(buildScopedInvalidationStreamUrl(scopeKeys))

  eventSource.addEventListener("ready", (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as ScopedInvalidationEnvelope
      dispatchReady(payload)
    } catch {}
  })

  eventSource.addEventListener("scope", (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as ScopedInvalidationEnvelope
      dispatchInvalidate(payload)
    } catch {}
  })

  eventSource.addEventListener("unavailable", (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(
        event.data
      ) as ScopedInvalidationUnavailableEnvelope
      dispatchUnavailable(payload)
    } catch {}
  })

  eventSource.onerror = (event) => {
    dispatchError(event)
  }

  activeEventSource = eventSource
  activeScopeSignature = nextScopeSignature
}

function scheduleScopedInvalidationStreamRebuild() {
  if (rebuildScheduled) {
    return
  }

  rebuildScheduled = true

  queueMicrotask(() => {
    rebuildScheduled = false
    rebuildScopedInvalidationStream()
  })
}

export function openScopedInvalidationStream(input: {
  scopeKeys: string[]
  onReady?: (envelope: ScopedInvalidationEnvelope) => void
  onInvalidate?: (envelope: ScopedInvalidationEnvelope) => void
  onUnavailable?: (envelope: ScopedInvalidationUnavailableEnvelope) => void
  onError?: (error: Event) => void
}) {
  if (typeof EventSource === "undefined") {
    return () => {}
  }

  const subscriber: ScopedInvalidationSubscriber = {
    id: nextSubscriberId++,
    scopeKeys: new Set(normalizeScopeKeys(input.scopeKeys)),
    onReady: input.onReady,
    onInvalidate: input.onInvalidate,
    onUnavailable: input.onUnavailable,
    onError: input.onError,
  }

  subscribers.set(subscriber.id, subscriber)
  scheduleScopedInvalidationStreamRebuild()

  if (lastReadyEnvelope) {
    const cachedReadyEnvelope = lastReadyEnvelope

    queueMicrotask(() => {
      if (!subscribers.has(subscriber.id)) {
        return
      }

      subscriber.onReady?.(
        filterEnvelopeForSubscriber(cachedReadyEnvelope, subscriber)
      )
    })
  }

  return () => {
    subscribers.delete(subscriber.id)
    scheduleScopedInvalidationStreamRebuild()
  }
}

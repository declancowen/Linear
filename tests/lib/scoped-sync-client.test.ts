import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { setMockDesktopAuthBridge } from "@/tests/lib/fixtures/electron-app"

class EventSourceMock {
  static instances: EventSourceMock[] = []

  readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>()
  onerror: ((event: Event) => void) | null = null
  closed = false

  constructor(
    readonly url: string,
    readonly options?: EventSourceInit
  ) {
    EventSourceMock.instances.push(this)
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listenersFor(type).add(listener)
  }

  removeEventListener(
    type: string,
    listener: (event: MessageEvent<string>) => void
  ) {
    this.listeners.get(type)?.delete(listener)
  }

  close() {
    this.closed = true
  }

  emit(type: string, payload: unknown) {
    const event = {
      data: JSON.stringify(payload),
    } as MessageEvent<string>

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }

  private listenersFor(type: string) {
    const listeners = this.listeners.get(type)

    if (listeners) {
      return listeners
    }

    const nextListeners = new Set<(event: MessageEvent<string>) => void>()
    this.listeners.set(type, nextListeners)

    return nextListeners
  }
}

describe("openScopedInvalidationStream", () => {
  beforeEach(() => {
    vi.resetModules()
    EventSourceMock.instances = []
    vi.stubGlobal("EventSource", EventSourceMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: undefined,
    })
  })

  it("shares one EventSource across subscribers and filters invalidations", async () => {
    const { openScopedInvalidationStream } = await import(
      "@/lib/scoped-sync/client"
    )
    const firstInvalidate = vi.fn()
    const secondInvalidate = vi.fn()

    const closeFirst = openScopedInvalidationStream({
      scopeKeys: ["scope:a"],
      onInvalidate: firstInvalidate,
    })
    const closeSecond = openScopedInvalidationStream({
      scopeKeys: ["scope:b"],
      onInvalidate: secondInvalidate,
    })

    await Promise.resolve()

    expect(EventSourceMock.instances).toHaveLength(1)

    const connection = EventSourceMock.instances[0]
    const url = new URL(connection.url, "http://localhost")

    expect(url.searchParams.getAll("scopeKey").sort()).toEqual([
      "scope:a",
      "scope:b",
    ])

    connection.emit("scope", {
      versions: [
        { scopeKey: "scope:a", version: 1 },
        { scopeKey: "scope:b", version: 2 },
      ],
    })

    expect(firstInvalidate).toHaveBeenCalledWith({
      versions: [{ scopeKey: "scope:a", version: 1 }],
    })
    expect(secondInvalidate).toHaveBeenCalledWith({
      versions: [{ scopeKey: "scope:b", version: 2 }],
    })

    closeFirst()
    closeSecond()
  })

  it("dispatches unavailable events to subscribers", async () => {
    const { openScopedInvalidationStream } = await import(
      "@/lib/scoped-sync/client"
    )
    const onUnavailable = vi.fn()

    openScopedInvalidationStream({
      scopeKeys: ["scope:a"],
      onUnavailable,
    })

    await Promise.resolve()

    const connection = EventSourceMock.instances[0]

    connection.emit("unavailable", {
      code: "SCOPED_READ_MODELS_UNAVAILABLE",
      message: "Scoped read model versions are unavailable",
    })

    expect(onUnavailable).toHaveBeenCalledWith({
      code: "SCOPED_READ_MODELS_UNAVAILABLE",
      message: "Scoped read model versions are unavailable",
    })
  })

  it("opens scoped streams against the configured public API base URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://teams.example.com/")
    const { openScopedInvalidationStream } = await import(
      "@/lib/scoped-sync/client"
    )

    openScopedInvalidationStream({
      scopeKeys: ["scope:a"],
    })

    await Promise.resolve()

    expect(EventSourceMock.instances).toHaveLength(1)
    expect(EventSourceMock.instances[0].url).toBe(
      "https://teams.example.com/api/events/scoped?scopeKey=scope%3Aa"
    )
    expect(EventSourceMock.instances[0].options).toEqual({
      withCredentials: true,
    })
  })

  it("uses fetch-backed desktop auth when native EventSource cannot attach headers", async () => {
    vi.stubGlobal("EventSource", undefined)
    setMockDesktopAuthBridge()
    const stream = new ReadableStream<Uint8Array>()
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(stream, {
        status: 200,
      })
    )
    const { openScopedInvalidationStream } = await import(
      "@/lib/scoped-sync/client"
    )

    const close = openScopedInvalidationStream({
      scopeKeys: ["scope:a"],
    })

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    const headers = fetchMock.mock.calls[0]?.[1]?.headers

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/events/scoped?scopeKey=scope%3Aa"
    )
    expect(headers).toBeInstanceOf(Headers)
    expect((headers as Headers).get("Authorization")).toBe(
      "Bearer desktop_token"
    )

    close()
  })
})

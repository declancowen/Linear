import { beforeEach, describe, expect, it, vi } from "vitest"

class EventSourceMock {
  static instances: EventSourceMock[] = []

  readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>()
  onerror: ((event: Event) => void) | null = null
  closed = false

  constructor(readonly url: string) {
    EventSourceMock.instances.push(this)
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
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
}

describe("openScopedInvalidationStream", () => {
  beforeEach(() => {
    vi.resetModules()
    EventSourceMock.instances = []
    vi.stubGlobal("EventSource", EventSourceMock)
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
})

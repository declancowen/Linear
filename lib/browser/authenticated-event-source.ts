"use client"

import { buildDesktopAuthHeaders } from "@/lib/browser/desktop-auth-token"

type EventSourceListener = (event: MessageEvent<string>) => void

export type AuthenticatedEventSource = {
  addEventListener: (type: string, listener: EventSourceListener) => void
  close: () => void
  onerror: ((event: Event) => void) | null
  removeEventListener: (type: string, listener: EventSourceListener) => void
}

function hasDesktopAuthBridge() {
  return (
    typeof window !== "undefined" &&
    typeof window.electronApp?.getDesktopAuthToken === "function"
  )
}

export function canCreateAuthenticatedEventSource() {
  return (
    typeof EventSource === "function" ||
    (hasDesktopAuthBridge() && typeof fetch === "function")
  )
}

function normalizeSseLine(line: string) {
  return line.endsWith("\r") ? line.slice(0, -1) : line
}

class FetchAuthenticatedEventSource implements AuthenticatedEventSource {
  private readonly abortController = new AbortController()
  private readonly listeners = new Map<string, Set<EventSourceListener>>()
  private closed = false
  onerror: ((event: Event) => void) | null = null

  constructor(private readonly url: string) {
    void this.open()
  }

  addEventListener(type: string, listener: EventSourceListener) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventSourceListener) {
    this.listeners.get(type)?.delete(listener)
  }

  close() {
    this.closed = true
    this.abortController.abort()
    this.listeners.clear()
  }

  private dispatch(type: string, data: string) {
    const event = new MessageEvent(type, {
      data,
    }) as MessageEvent<string>

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }

  private dispatchError() {
    if (!this.closed) {
      this.onerror?.(new Event("error"))
    }
  }

  private async open() {
    try {
      const response = await fetch(this.url, {
        credentials: "include",
        headers: await buildDesktopAuthHeaders(),
        signal: this.abortController.signal,
      })

      if (!response.ok || !response.body) {
        this.dispatchError()
        return
      }

      await this.readStream(response.body)

      if (!this.closed) {
        this.dispatchError()
      }
    } catch {
      if (!this.closed && !this.abortController.signal.aborted) {
        this.dispatchError()
      }
    }
  }

  private async readStream(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let eventType = "message"
    let dataLines: string[] = []

    const dispatchBufferedEvent = () => {
      if (dataLines.length > 0) {
        this.dispatch(eventType, dataLines.join("\n"))
      }

      eventType = "message"
      dataLines = []
    }

    const processLine = (rawLine: string) => {
      const line = normalizeSseLine(rawLine)

      if (line.length === 0) {
        dispatchBufferedEvent()
        return
      }

      if (line.startsWith(":")) {
        return
      }

      const separatorIndex = line.indexOf(":")
      const field =
        separatorIndex === -1 ? line : line.slice(0, separatorIndex)
      let value =
        separatorIndex === -1 ? "" : line.slice(separatorIndex + 1)

      if (value.startsWith(" ")) {
        value = value.slice(1)
      }

      if (field === "event") {
        eventType = value || "message"
      } else if (field === "data") {
        dataLines.push(value)
      }
    }

    while (!this.closed) {
      const result = await reader.read()

      if (result.done) {
        break
      }

      buffer += decoder.decode(result.value, { stream: true })

      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        processLine(line)
      }
    }

    buffer += decoder.decode()

    if (buffer.length > 0) {
      processLine(buffer)
    }
  }
}

export function createAuthenticatedEventSource(
  url: string,
  init?: EventSourceInit
): AuthenticatedEventSource {
  if (hasDesktopAuthBridge()) {
    return new FetchAuthenticatedEventSource(url)
  }

  return new EventSource(url, init)
}

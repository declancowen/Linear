"use client"

import YPartyKitProvider from "y-partykit/provider"
import * as Y from "yjs"

import {
  createCollaborationAwarenessState,
  type CollaborationAwarenessState,
} from "@/lib/collaboration/awareness"
import {
  COLLABORATION_FLUSH_PATH,
  COLLABORATION_PARTY_NAME,
} from "@/lib/collaboration/constants"
import { encodeDocumentStateVector } from "@/lib/collaboration/state-vectors"
import type {
  CollaborationAwarenessChange,
  CollaborationFlushInput,
  CollaborationStatusChange,
  CollaborationTransportAdapter,
  CollaborationTransportSession,
} from "@/lib/collaboration/transport"

export type PartyKitDocumentCollaborationBinding = {
  doc: Y.Doc
  provider: YPartyKitProvider
}

const COLLABORATION_CONNECT_TIMEOUT_MS = 10_000
const COLLABORATION_TOKEN_REFRESH_BUFFER_SECONDS = 30

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeProviderAwarenessState(
  value: unknown
): CollaborationAwarenessState | null {
  if (!isRecord(value)) {
    return null
  }

  const userValue = isRecord(value.user) ? value.user : value
  const userId = typeof userValue.userId === "string" ? userValue.userId : null
  const sessionId =
    typeof userValue.sessionId === "string" ? userValue.sessionId : null
  const name = typeof userValue.name === "string" ? userValue.name : null
  const cursorRectValue = isRecord(userValue.cursorRect)
    ? userValue.cursorRect
    : null

  if (!userId || !sessionId || !name) {
    return null
  }

  return createCollaborationAwarenessState({
    userId,
    sessionId,
    name,
    avatarUrl:
      typeof userValue.avatarUrl === "string" ? userValue.avatarUrl : null,
    color: typeof userValue.color === "string" ? userValue.color : null,
    typing: userValue.typing === true,
    activeBlockId:
      typeof userValue.activeBlockId === "string"
        ? userValue.activeBlockId
        : null,
    cursorSide:
      userValue.cursorSide === "before" || userValue.cursorSide === "after"
        ? userValue.cursorSide
        : null,
    cursorRect:
      cursorRectValue &&
      typeof cursorRectValue.left === "number" &&
      typeof cursorRectValue.top === "number" &&
      typeof cursorRectValue.height === "number"
        ? {
            left: cursorRectValue.left,
            top: cursorRectValue.top,
            height: cursorRectValue.height,
          }
        : null,
  })
}

function createRoomRequestUrl(baseUrl: string, roomId: string) {
  const serviceUrl = new URL(baseUrl)
  const normalizedPath = serviceUrl.pathname.replace(/\/$/, "")
  const roomUrl = new URL(
    `${normalizedPath}/parties/${COLLABORATION_PARTY_NAME}/${encodeURIComponent(roomId)}`,
    serviceUrl.origin
  )

  roomUrl.searchParams.set("action", COLLABORATION_FLUSH_PATH.replace("/", ""))

  return roomUrl
}

function parseServiceUrl(baseUrl: string) {
  const serviceUrl = new URL(baseUrl)
  const prefix = serviceUrl.pathname.replace(/\/$/, "")

  return {
    host: serviceUrl.host,
    protocol: serviceUrl.protocol === "https:" ? "wss" : "ws",
    prefix: prefix.length > 0 ? prefix : undefined,
  } as const
}

function isLoopbackHostname(hostname: string) {
  const normalized =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  )
}

function assertSecureBrowserTransport(baseUrl: string) {
  if (typeof window === "undefined") {
    return
  }

  const serviceUrl = new URL(baseUrl)
  const allowsLocalInsecureTransport =
    isLoopbackHostname(window.location.hostname) &&
    isLoopbackHostname(serviceUrl.hostname)
  const requiresSecureTransport =
    window.location.protocol === "https:" ||
    (window.isSecureContext && !allowsLocalInsecureTransport)

  if (requiresSecureTransport && serviceUrl.protocol !== "https:") {
    throw new Error(
      "Collaboration service must use HTTPS/WSS in a secure browser context"
    )
  }
}

function createAwarenessChange(
  provider: YPartyKitProvider
): CollaborationAwarenessChange<CollaborationAwarenessState> {
  const states = [...provider.awareness.getStates().values()]
    .map(normalizeProviderAwarenessState)
    .filter(
      (value): value is CollaborationAwarenessState => value !== null
    )

  const localSessionId =
    normalizeProviderAwarenessState(provider.awareness.getLocalState())
      ?.sessionId ?? null

  return {
    local:
      normalizeProviderAwarenessState(provider.awareness.getLocalState()) ?? null,
    remote: localSessionId
      ? states.filter((state) => state.sessionId !== localSessionId)
      : states,
  }
}

function createStatusEmitter() {
  const listeners = new Set<(change: CollaborationStatusChange) => void>()

  return {
    emit(change: CollaborationStatusChange) {
      for (const listener of listeners) {
        listener(change)
      }
    },
    subscribe(listener: (change: CollaborationStatusChange) => void) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function createAwarenessEmitter() {
  const listeners = new Set<
    (
      change: CollaborationAwarenessChange<CollaborationAwarenessState>
    ) => void
  >()

  return {
    emit(change: CollaborationAwarenessChange<CollaborationAwarenessState>) {
      for (const listener of listeners) {
        listener(change)
      }
    },
    subscribe(
      listener: (
        change: CollaborationAwarenessChange<CollaborationAwarenessState>
      ) => void
    ) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function isCollaborationSyncTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Timed out waiting for collaboration document sync")
  )
}

export function createPartyKitCollaborationAdapter(): CollaborationTransportAdapter<
  CollaborationAwarenessState,
  PartyKitDocumentCollaborationBinding
  > {
  return {
    openDocumentSession(bootstrap) {
      let activeBootstrap = bootstrap
      let bootstrapRefreshPromise: Promise<typeof bootstrap> | null = null

      const assertBootstrapIdentity = (nextBootstrap: typeof bootstrap) => {
        if (
          nextBootstrap.documentId !== activeBootstrap.documentId ||
          nextBootstrap.roomId !== activeBootstrap.roomId ||
          nextBootstrap.serviceUrl !== activeBootstrap.serviceUrl
        ) {
          throw new Error(
            "Refreshed collaboration session changed room identity"
          )
        }
      }

      const getValidBootstrap = async (forceRefresh = false) => {
        const shouldRefresh =
          forceRefresh ||
          (typeof activeBootstrap.expiresAt === "number" &&
            activeBootstrap.expiresAt - Math.floor(Date.now() / 1000) <=
              COLLABORATION_TOKEN_REFRESH_BUFFER_SECONDS)

        if (!shouldRefresh || !activeBootstrap.getFreshBootstrap) {
          return activeBootstrap
        }

        if (!bootstrapRefreshPromise) {
          bootstrapRefreshPromise = activeBootstrap
            .getFreshBootstrap()
            .then((nextBootstrap) => {
              assertBootstrapIdentity(nextBootstrap)
              activeBootstrap = {
                ...nextBootstrap,
                getFreshBootstrap: activeBootstrap.getFreshBootstrap,
              }
              return activeBootstrap
            })
            .finally(() => {
              bootstrapRefreshPromise = null
            })
        }

        return bootstrapRefreshPromise
      }

      assertSecureBrowserTransport(activeBootstrap.serviceUrl)
      const doc = new Y.Doc()
      const service = parseServiceUrl(bootstrap.serviceUrl)
      let provider: YPartyKitProvider

      try {
        provider = new YPartyKitProvider(service.host, bootstrap.roomId, doc, {
          connect: false,
          disableBc: true,
          resyncInterval: 2000,
          party: COLLABORATION_PARTY_NAME,
          prefix: service.prefix,
          protocol: service.protocol,
          params: async () => {
            const nextBootstrap = await getValidBootstrap()

            return {
              token: nextBootstrap.token,
            }
          },
        })
      } catch (error) {
        doc.destroy()
        throw error
      }
      const status = createStatusEmitter()
      const awareness = createAwarenessEmitter()

      const handleProviderStatus = (event: { status: string }) => {
        status.emit({
          state:
            event.status === "connected" ? "connected" : "disconnected",
          reason: event.status,
        })
      }
      const handleProviderError = (event: unknown) => {
        status.emit({
          state: "errored",
          reason:
            event instanceof Error ? event.message : "Partykit connection error",
        })
      }
      const handleAwarenessChange = () => {
        awareness.emit(createAwarenessChange(provider))
      }

      provider.on("status", handleProviderStatus)
      provider.on("connection-error", handleProviderError)
      provider.awareness.on("change", handleAwarenessChange)
      provider.awareness.on("update", handleAwarenessChange)

      const session: CollaborationTransportSession<
        CollaborationAwarenessState,
        PartyKitDocumentCollaborationBinding
      > = {
        binding: {
          doc,
          provider,
        },
        async connect() {
          status.emit({
            state: "connecting",
          })

          try {
            if (provider.synced) {
              return
            }

            await new Promise<void>((resolve, reject) => {
              let settled = false
              let timeoutId: ReturnType<typeof setTimeout> | null = null

              const cleanup = () => {
                provider.off("synced", handleSynced)

                if (timeoutId !== null) {
                  clearTimeout(timeoutId)
                  timeoutId = null
                }
              }

              const resolveOnce = () => {
                if (settled) {
                  return
                }

                settled = true
                cleanup()
                resolve()
              }

              const rejectOnce = (error: unknown) => {
                if (settled) {
                  return
                }

                settled = true
                cleanup()
                reject(
                  error instanceof Error
                    ? error
                    : new Error("Partykit connection error")
                )
              }

              const handleSynced = (synced: boolean) => {
                if (synced) {
                  resolveOnce()
                }
              }

              provider.on("synced", handleSynced)

              timeoutId = setTimeout(() => {
                rejectOnce(
                  new Error("Timed out waiting for collaboration document sync")
                )
              }, COLLABORATION_CONNECT_TIMEOUT_MS)

              if (!provider.wsconnected) {
                provider.connect()
              }

              if (provider.synced) {
                resolveOnce()
              }
            })

          } catch (error) {
            if (isCollaborationSyncTimeoutError(error)) {
              status.emit({
                state: provider.wsconnected ? "connected" : "connecting",
                reason:
                  error instanceof Error
                    ? error.message
                    : "Timed out waiting for collaboration document sync",
              })
            } else {
              handleProviderError(error)
            }
            throw error
          }
        },
        disconnect(reason) {
          provider.awareness.off("change", handleAwarenessChange)
          provider.awareness.off("update", handleAwarenessChange)
          provider.off("status", handleProviderStatus)
          provider.off("connection-error", handleProviderError)
          provider.disconnect()
          provider.destroy()
          doc.destroy()
          status.emit({
            state: "disconnected",
            reason,
          })
        },
        updateLocalAwareness(nextState) {
          if (!nextState) {
            provider.awareness.setLocalState(null)
            awareness.emit(createAwarenessChange(provider))
            return
          }

          const currentState = provider.awareness.getLocalState()

          provider.awareness.setLocalState({
            ...(isRecord(currentState) ? currentState : {}),
            user: {
              userId: nextState.userId,
              sessionId: nextState.sessionId,
              name: nextState.name,
              avatarUrl: nextState.avatarUrl,
              color: nextState.color,
              typing: nextState.typing,
              activeBlockId: nextState.activeBlockId,
              cursor: nextState.cursor,
              selection: nextState.selection,
              cursorSide: nextState.cursorSide,
              cursorRect: nextState.cursorRect,
            },
          })
          awareness.emit(createAwarenessChange(provider))
        },
        async flush(input?: CollaborationFlushInput) {
          const nextBootstrap = await getValidBootstrap()
          const stateVector = encodeDocumentStateVector(session.binding.doc)
          const response = await fetch(
            createRoomRequestUrl(
              nextBootstrap.serviceUrl,
              nextBootstrap.roomId
            ),
            {
              method: "POST",
              keepalive: true,
              headers: {
                Authorization: `Bearer ${nextBootstrap.token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                stateVector,
                ...(input?.workItemExpectedUpdatedAt
                  ? {
                      workItemExpectedUpdatedAt:
                        input.workItemExpectedUpdatedAt,
                    }
                  : {}),
                ...(input?.workItemTitle
                  ? {
                      workItemTitle: input.workItemTitle,
                    }
                  : {}),
              }),
            },
          )

          if (!response.ok) {
            const message = await response.text()

            throw new Error(message || "Failed to flush collaboration state")
          }
        },
        onStatusChange(listener) {
          return status.subscribe(listener)
        },
        onAwarenessChange(listener) {
          listener(createAwarenessChange(provider))
          return awareness.subscribe(listener)
        },
      }

      return session
    },
  }
}

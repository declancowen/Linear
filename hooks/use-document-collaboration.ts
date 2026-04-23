"use client"

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react"

import { RouteMutationError } from "@/lib/convex/client/shared"
import {
  reportCollaborationSessionDiagnostic,
  reportRealtimeFallbackDiagnostic,
} from "@/lib/browser/snapshot-diagnostics"
import {
  createCollaborationAwarenessState,
  type CollaborationAwarenessState,
} from "@/lib/collaboration/awareness"
import { createPartyKitCollaborationAdapter, type PartyKitDocumentCollaborationBinding } from "@/lib/collaboration/adapters/partykit"
import { getCollaborationUserColor } from "@/lib/collaboration/colors"
import { openDocumentCollaborationSession } from "@/lib/collaboration/client-session"
import type {
  CollaborationConnectionState,
  CollaborationFlushInput,
  CollaborationSessionRole,
  CollaborationTransportSession,
} from "@/lib/collaboration/transport"
import type { DocumentPresenceViewer } from "@/lib/domain/types"
import { isCollaborationEnabled } from "@/lib/realtime/feature-flags"
import { resolveImageAssetSource } from "@/lib/utils"

type CollaborationViewerUser = {
  id: string
  name: string
  avatarImageUrl?: string | null
  avatarUrl?: string | null
}

function mapAwarenessViewer(
  entry: CollaborationAwarenessState
): DocumentPresenceViewer {
  return {
    userId: entry.userId,
    name: entry.name,
    avatarImageUrl: null,
    avatarUrl: entry.avatarUrl ?? "",
    activeBlockId: entry.activeBlockId ?? null,
    lastSeenAt: new Date().toISOString(),
  }
}

export type DocumentCollaborationState = {
  binding: PartyKitDocumentCollaborationBinding
  localUser: CollaborationAwarenessState
}

export type CollaborationLifecycleState =
  | "legacy"
  | "bootstrapping"
  | "attached"
  | "degraded"

const EMPTY_VIEWERS: DocumentPresenceViewer[] = []
const COLLABORATION_CONNECT_MAX_ATTEMPTS = 3
const COLLABORATION_CONNECT_RETRY_BASE_DELAY_MS = 500

type ActiveDocumentCollaborationState = {
  documentId: string | null
  error: string | null
  role: CollaborationSessionRole | null
  connectionState: CollaborationConnectionState
  session: CollaborationTransportSession<
    CollaborationAwarenessState,
    PartyKitDocumentCollaborationBinding
  > | null
  collaboration: DocumentCollaborationState | null
  viewers: DocumentPresenceViewer[]
}

const EMPTY_COLLABORATION_STATE: ActiveDocumentCollaborationState = {
  documentId: null,
  error: null,
  role: null,
  connectionState: "idle",
  session: null,
  collaboration: null,
  viewers: EMPTY_VIEWERS,
}

function isExpectedCollaborationUnavailable(error: unknown) {
  if (
    error instanceof Error &&
    error.message.includes("Collaboration service must use HTTPS/WSS")
  ) {
    return true
  }

  if (!(error instanceof RouteMutationError)) {
    return false
  }

  return (
    error.status === 503 ||
    error.code === "COLLABORATION_UNAVAILABLE" ||
    error.code === "COLLABORATION_SESSION_CREATE_FAILED"
  )
}

function isCollaborationSyncTimeout(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Timed out waiting for collaboration document sync")
  )
}

function waitForDelay(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs)
  })
}

export function useDocumentCollaboration(input: {
  documentId: string | null
  currentUser: CollaborationViewerUser | null
  enabled?: boolean
}) {
  const adapter = useMemo(() => createPartyKitCollaborationAdapter(), [])
  const currentUserId = input.currentUser?.id ?? null
  const currentUserName = input.currentUser?.name ?? null
  const currentUserAvatarImageUrl =
    input.currentUser?.avatarImageUrl ?? null
  const currentUserAvatarUrl = input.currentUser?.avatarUrl ?? null
  const currentUserResolvedAvatarUrl = useMemo(
    () =>
      resolveImageAssetSource(
        currentUserAvatarImageUrl,
        currentUserAvatarUrl
      ),
    [currentUserAvatarImageUrl, currentUserAvatarUrl]
  )
  const collaborationEnabled = isCollaborationEnabled()
  const [state, setState] = useState<ActiveDocumentCollaborationState>(
    EMPTY_COLLABORATION_STATE
  )
  const isEnabled = Boolean(
    collaborationEnabled &&
      input.enabled &&
      input.documentId &&
      currentUserId &&
      currentUserName
  )
  const activeSessionKey =
    isEnabled && input.documentId && currentUserId
      ? `${currentUserId}:${input.documentId}`
      : null

  useEffect(() => {
    setState(EMPTY_COLLABORATION_STATE)
  }, [activeSessionKey])

  const handleStatusChange = useEffectEvent(
    (nextState: CollaborationConnectionState) => {
      setState((current) => ({
        ...current,
        connectionState: nextState,
      }))
    }
  )
  const handleViewersChange = useEffectEvent(
    (
      local: CollaborationAwarenessState | null,
      remote: CollaborationAwarenessState[]
    ) => {
      setState((current) => ({
        ...current,
        viewers: [
          ...(local ? [mapAwarenessViewer(local)] : []),
          ...remote.map(mapAwarenessViewer),
        ],
      }))
    }
  )

  useEffect(() => {
    if (!isEnabled || !input.documentId || !currentUserId || !currentUserName) {
      return
    }

    let cancelled = false
    let disposeStatus: (() => void) | null = null
    let disposeAwareness: (() => void) | null = null
    let disposeSynced: (() => void) | null = null
    let activeSession: CollaborationTransportSession<
      CollaborationAwarenessState,
      PartyKitDocumentCollaborationBinding
    > | null = null
    let activeRole: CollaborationSessionRole | null = null

    async function open() {
      const startedAt = window.performance.now()
      let latestError: unknown = null

      try {
        const localCurrentUserId = currentUserId
        const localCurrentUserName = currentUserName
        const localDocumentId = input.documentId

        if (!localCurrentUserId || !localCurrentUserName || !localDocumentId) {
          return
        }

        for (
          let attempt = 1;
          attempt <= COLLABORATION_CONNECT_MAX_ATTEMPTS;
          attempt += 1
        ) {
          let attemptDisposeStatus: (() => void) | null = null
          let attemptDisposeAwareness: (() => void) | null = null
          let attemptDisposeSynced: (() => void) | null = null
          let bootstrap: Awaited<
            ReturnType<typeof openDocumentCollaborationSession>
          >["bootstrap"] | null = null
          let openedSession: CollaborationTransportSession<
            CollaborationAwarenessState,
            PartyKitDocumentCollaborationBinding
          > | null = null
          let localUser: CollaborationAwarenessState | null = null
          let collaborationState: DocumentCollaborationState | null = null

          try {
            const opened = await openDocumentCollaborationSession({
                documentId: localDocumentId,
                adapter,
              })
            bootstrap = opened.bootstrap
            openedSession = opened.session
            const activeBootstrap = bootstrap
            const activeOpenedSession = openedSession

            activeSession = activeOpenedSession
            activeRole = activeBootstrap.role

            if (cancelled) {
              activeOpenedSession.disconnect("cancelled")
              return
            }

            localUser = createCollaborationAwarenessState({
              userId: localCurrentUserId,
              sessionId: activeBootstrap.sessionId,
              name: localCurrentUserName,
              avatarUrl: currentUserResolvedAvatarUrl,
              color: getCollaborationUserColor(localCurrentUserId),
            })
            const activeLocalUser = localUser
            collaborationState = {
              binding: activeOpenedSession.binding,
              localUser: activeLocalUser,
            }

            attemptDisposeStatus = activeOpenedSession.onStatusChange(({ state }) => {
              handleStatusChange(state)
            })
            attemptDisposeAwareness = activeOpenedSession.onAwarenessChange(
              ({ local, remote }) => {
                handleViewersChange(local, remote)
              }
            )
            const handleSynced = (synced: boolean) => {
              if (!synced || cancelled) {
                return
              }

              setState((current) =>
                current.session === activeOpenedSession
                  ? {
                      ...current,
                      error: null,
                      role: activeBootstrap.role,
                      collaboration:
                        current.collaboration ?? collaborationState,
                    }
                  : current
              )
            }
            activeOpenedSession.binding.provider.on("synced", handleSynced)
            attemptDisposeSynced = () => {
              activeOpenedSession.binding.provider.off("synced", handleSynced)
            }

            disposeStatus = attemptDisposeStatus
            disposeAwareness = attemptDisposeAwareness
            disposeSynced = attemptDisposeSynced

            activeOpenedSession.updateLocalAwareness(activeLocalUser)
            setState({
              documentId: input.documentId,
              error: null,
              role: activeBootstrap.role,
              connectionState: "connecting",
              session: activeOpenedSession,
              collaboration: null,
              viewers: EMPTY_VIEWERS,
            })

            await activeOpenedSession.connect()

            if (cancelled) {
              activeOpenedSession.disconnect("cancelled")
              return
            }

            setState((current) => ({
              ...current,
              documentId: input.documentId,
              error: null,
              role: activeBootstrap.role,
              connectionState:
                activeOpenedSession.binding.provider.wsconnected
                  ? "connected"
                  : "connecting",
              session: activeOpenedSession,
              collaboration:
                current.collaboration ?? collaborationState,
            }))
            reportCollaborationSessionDiagnostic({
              documentId: localDocumentId,
              durationMs: window.performance.now() - startedAt,
              status: "success",
            })
            return
          } catch (nextError) {
            latestError = nextError

            if (
              !cancelled &&
              bootstrap &&
              openedSession &&
              localUser &&
              isCollaborationSyncTimeout(nextError)
            ) {
              const activeBootstrap = bootstrap
              const activeOpenedSession = openedSession
              setState((current) =>
                current.session === activeOpenedSession
                  ? {
                      ...current,
                      error: null,
                      role: activeBootstrap.role,
                      connectionState:
                        activeOpenedSession.binding.provider.wsconnected
                          ? "connected"
                          : "connecting",
                      collaboration:
                        current.collaboration ?? collaborationState,
                    }
                  : current
              )
              return
            }

            attemptDisposeStatus?.()
            attemptDisposeAwareness?.()
            attemptDisposeSynced?.()
            disposeStatus = null
            disposeAwareness = null
            disposeSynced = null
            activeSession?.disconnect(`connect-failed:${attempt}`)
            activeSession = null
            activeRole = null

            if (cancelled) {
              return
            }

            const shouldRetry =
              attempt < COLLABORATION_CONNECT_MAX_ATTEMPTS &&
              !isExpectedCollaborationUnavailable(nextError)

            if (!shouldRetry) {
              throw nextError
            }

            await waitForDelay(
              COLLABORATION_CONNECT_RETRY_BASE_DELAY_MS * attempt
            )
          }
        }

        throw latestError ?? new Error("Failed to open collaboration session")
      } catch (nextError) {
        if (cancelled) {
          return
        }

        reportCollaborationSessionDiagnostic({
          documentId: input.documentId ?? "unknown-document",
          durationMs: window.performance.now() - startedAt,
          status: "failure",
          errorMessage:
            nextError instanceof Error
              ? nextError.message
              : "Failed to open collaboration session",
        })
        if (!isExpectedCollaborationUnavailable(nextError)) {
          console.error("Failed to open collaboration session", nextError)
        }
        activeSession?.disconnect("connect-failed")
        activeSession = null
        activeRole = null
        setState({
          documentId: input.documentId,
          error:
            nextError instanceof Error
              ? nextError.message
              : "Failed to open collaboration session",
          role: null,
          connectionState: "errored",
          session: null,
          collaboration: null,
          viewers: EMPTY_VIEWERS,
        })
      }
    }

    void open()

    return () => {
      cancelled = true
      disposeStatus?.()
      disposeAwareness?.()
      disposeSynced?.()
      const sessionToClose = activeSession
      const roleToClose = activeRole
      activeSession = null
      activeRole = null

      if (sessionToClose && roleToClose === "editor") {
        void sessionToClose
          .flush()
          .catch((error) => {
            console.error("Failed to flush collaboration session on unmount", error)
          })
          .finally(() => {
            sessionToClose.disconnect("component-unmount")
          })
        return
      }

      sessionToClose?.disconnect("component-unmount")
    }
  }, [
    adapter,
    input.documentId,
    currentUserId,
    isEnabled,
  ])

  const isActiveDocument =
    isEnabled && state.documentId === input.documentId && input.documentId !== null
  const connectionState = isActiveDocument
    ? state.connectionState
    : isEnabled
      ? "connecting"
      : "idle"
  const isSessionAttached =
    isActiveDocument &&
    state.collaboration !== null &&
    state.session !== null &&
    (connectionState === "connected" || connectionState === "connecting")
  const collaboration = isSessionAttached ? state.collaboration : null
  const session = isSessionAttached ? state.session : null
  const role = isSessionAttached ? state.role : null
  const error = isActiveDocument ? state.error : null
  const viewers = isSessionAttached ? state.viewers : EMPTY_VIEWERS
  const lifecycle: CollaborationLifecycleState =
    !isEnabled || input.documentId === null
      ? "legacy"
      : isSessionAttached
        ? "attached"
        : isActiveDocument &&
            (connectionState === "errored" ||
              connectionState === "disconnected")
          ? "degraded"
          : "bootstrapping"
  const isAwaitingCollaboration = lifecycle === "bootstrapping"
  const mode = lifecycle === "attached" ? "collaboration" : "legacy"

  useEffect(() => {
    if (
      !isActiveDocument ||
      !state.session ||
      !state.collaboration ||
      !currentUserId ||
      !currentUserName
    ) {
      return
    }

    const currentLocalUser = state.collaboration.localUser
    const nextLocalUser = createCollaborationAwarenessState({
      ...currentLocalUser,
      userId: currentUserId,
      name: currentUserName,
      avatarUrl: currentUserResolvedAvatarUrl,
    })

    if (
      currentLocalUser.name === nextLocalUser.name &&
      currentLocalUser.avatarUrl === nextLocalUser.avatarUrl
    ) {
      return
    }

    state.session.updateLocalAwareness(nextLocalUser)
    setState((current) =>
      current.session === state.session && current.collaboration
        ? {
            ...current,
            collaboration: {
              ...current.collaboration,
              localUser: nextLocalUser,
            },
          }
        : current
    )
  }, [
    currentUserId,
    currentUserName,
    currentUserResolvedAvatarUrl,
    isActiveDocument,
    state.collaboration,
    state.session,
  ])

  useEffect(() => {
    if (collaborationEnabled || !input.enabled || !input.documentId) {
      return
    }

    reportRealtimeFallbackDiagnostic({
      reason: "collaboration-disabled",
      target: "legacy-rich-text-sync",
    })
  }, [collaborationEnabled, input.documentId, input.enabled])

  useEffect(() => {
    if (!session || role !== "editor") {
      return
    }

    const handlePageHide = () => {
      void session.flush().catch((error) => {
        console.error("Failed to flush collaboration session on page hide", error)
      })
    }

    window.addEventListener("pagehide", handlePageHide)

    return () => {
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [role, session])

  const flush = useCallback(async (input?: CollaborationFlushInput) => {
    await session?.flush(input)
  }, [session])

  return {
    lifecycle,
    mode,
    error,
    role,
    connectionState,
    collaboration,
    isAwaitingCollaboration,
    viewers,
    flush,
  }
}

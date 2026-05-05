"use client"

import type { JSONContent } from "@tiptap/core"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react"

import {
  reportCollaborationSessionDiagnostic,
  reportRealtimeFallbackDiagnostic,
} from "@/lib/browser/snapshot-diagnostics"
import {
  createCollaborationAwarenessState,
  type CollaborationAwarenessState,
} from "@/lib/collaboration/awareness"
import { createPartyKitCollaborationAdapter } from "@/lib/collaboration/adapters/partykit"
import { getCollaborationUserColor } from "@/lib/collaboration/colors"
import { openDocumentCollaborationSession } from "@/lib/collaboration/client-session"
import {
  getSyncedCollaborationState,
  isExpectedCollaborationUnavailable,
  type ActiveDocumentCollaborationState,
  type DocumentCollaborationSession,
  type DocumentCollaborationState,
  type OpenDocumentCollaborationBootstrap,
} from "@/hooks/document-collaboration-state"
import type {
  CollaborationStatusChange,
  CollaborationConnectionState,
  CollaborationFlushInput,
  CollaborationSessionRole,
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

type CollaborationLifecycleState =
  | "legacy"
  | "bootstrapping"
  | "attached"
  | "degraded"

type SetActiveDocumentCollaborationState = Dispatch<
  SetStateAction<ActiveDocumentCollaborationState>
>

type CollaborationRuntime = {
  activeSession: DocumentCollaborationSession | null
  activeRole: CollaborationSessionRole | null
  disposeStatus: (() => void) | null
  disposeAwareness: (() => void) | null
  disposeSynced: (() => void) | null
}

type CollaborationOpenSnapshot = {
  documentId: string
  userId: string
  userName: string
  avatarUrl: string | null
}

type CollaborationAttemptParams = {
  adapter: ReturnType<typeof createPartyKitCollaborationAdapter>
  runtime: CollaborationRuntime
  snapshot: CollaborationOpenSnapshot
  startedAt: number
  isCancelled: () => boolean
  onStatusChange: (change: CollaborationStatusChange) => void
  onViewersChange: (
    local: CollaborationAwarenessState | null,
    remote: CollaborationAwarenessState[]
  ) => void
  setState: SetActiveDocumentCollaborationState
}

type DerivedDocumentCollaborationState = {
  bootstrapContent: JSONContent | string | null
  collaboration: DocumentCollaborationState | null
  connectionState: CollaborationConnectionState
  editorCollaboration: DocumentCollaborationState | null
  error: string | null
  hasActiveEditorSession: boolean
  hasAttachedOnce: boolean
  isActiveDocument: boolean
  isAwaitingCollaboration: boolean
  lifecycle: CollaborationLifecycleState
  mode: "collaboration" | "legacy"
  role: CollaborationSessionRole | null
  session: DocumentCollaborationSession | null
  viewers: DocumentPresenceViewer[]
}

const EMPTY_VIEWERS: DocumentPresenceViewer[] = []
const COLLABORATION_CONNECT_MAX_ATTEMPTS = 3
const COLLABORATION_CONNECT_RETRY_BASE_DELAY_MS = 500

const EMPTY_COLLABORATION_STATE: ActiveDocumentCollaborationState = {
  documentId: null,
  error: null,
  hasAttachedOnce: false,
  role: null,
  connectionState: "idle",
  session: null,
  editorCollaboration: null,
  collaboration: null,
  bootstrapContent: null,
  viewers: EMPTY_VIEWERS,
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

function createCollaborationRuntime(): CollaborationRuntime {
  return {
    activeSession: null,
    activeRole: null,
    disposeStatus: null,
    disposeAwareness: null,
    disposeSynced: null,
  }
}

function getBootstrapContent(bootstrap: OpenDocumentCollaborationBootstrap) {
  return bootstrap.contentJson ?? bootstrap.contentHtml ?? null
}

function getSessionConnectionState(session: DocumentCollaborationSession) {
  return session.binding.provider.wsconnected ? "connected" : "connecting"
}

function getCollaborationErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Failed to open collaboration session"
}

function shouldRetryCollaborationAttempt(attempt: number, error: unknown) {
  return (
    attempt < COLLABORATION_CONNECT_MAX_ATTEMPTS &&
    !isExpectedCollaborationUnavailable(error)
  )
}

function disposeCollaborationRuntimeSubscriptions(
  runtime: CollaborationRuntime
) {
  runtime.disposeStatus?.()
  runtime.disposeAwareness?.()
  runtime.disposeSynced?.()
  runtime.disposeStatus = null
  runtime.disposeAwareness = null
  runtime.disposeSynced = null
}

function disconnectCollaborationRuntimeSession(
  runtime: CollaborationRuntime,
  reason: string
) {
  runtime.activeSession?.disconnect(reason)
  runtime.activeSession = null
  runtime.activeRole = null
}

function closeCollaborationRuntimeOnUnmount(runtime: CollaborationRuntime) {
  disposeCollaborationRuntimeSubscriptions(runtime)
  const sessionToClose = runtime.activeSession
  const roleToClose = runtime.activeRole
  runtime.activeSession = null
  runtime.activeRole = null

  if (sessionToClose && roleToClose === "editor") {
    void sessionToClose
      .flush({ kind: "teardown-content" })
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

function createLocalCollaborationUser({
  snapshot,
  sessionId,
}: {
  snapshot: CollaborationOpenSnapshot
  sessionId: string
}) {
  return createCollaborationAwarenessState({
    userId: snapshot.userId,
    sessionId,
    name: snapshot.userName,
    avatarUrl: snapshot.avatarUrl,
    color: getCollaborationUserColor(snapshot.userId),
  })
}

function setSyncedCollaborationState({
  bootstrap,
  bootstrapContent,
  collaborationState,
  session,
  setState,
}: {
  bootstrap: OpenDocumentCollaborationBootstrap
  bootstrapContent: JSONContent | string | null
  collaborationState: DocumentCollaborationState
  session: DocumentCollaborationSession
  setState: SetActiveDocumentCollaborationState
}) {
  setState((current) =>
    getSyncedCollaborationState(current, {
      bootstrap,
      bootstrapContent,
      collaborationState,
      session,
    })
  )
}

function setConnectingCollaborationState({
  bootstrap,
  bootstrapContent,
  collaborationState,
  documentId,
  session,
  setState,
}: {
  bootstrap: OpenDocumentCollaborationBootstrap
  bootstrapContent: JSONContent | string | null
  collaborationState: DocumentCollaborationState
  documentId: string
  session: DocumentCollaborationSession
  setState: SetActiveDocumentCollaborationState
}) {
  setState({
    documentId,
    error: null,
    hasAttachedOnce: false,
    role: bootstrap.role,
    connectionState: "connecting",
    session,
    editorCollaboration: collaborationState,
    collaboration: null,
    bootstrapContent,
    viewers: EMPTY_VIEWERS,
  })
}

function setConnectedCollaborationState({
  bootstrap,
  bootstrapContent,
  collaborationState,
  documentId,
  session,
  setState,
}: {
  bootstrap: OpenDocumentCollaborationBootstrap
  bootstrapContent: JSONContent | string | null
  collaborationState: DocumentCollaborationState
  documentId: string
  session: DocumentCollaborationSession
  setState: SetActiveDocumentCollaborationState
}) {
  setState((current) => ({
    ...current,
    documentId,
    error: null,
    hasAttachedOnce: true,
    role: bootstrap.role,
    connectionState: getSessionConnectionState(session),
    session,
    editorCollaboration: current.editorCollaboration ?? collaborationState,
    collaboration: current.collaboration ?? collaborationState,
    bootstrapContent: current.bootstrapContent ?? bootstrapContent,
  }))
}

function handleCollaborationSyncTimeout({
  bootstrap,
  bootstrapContent,
  collaborationState,
  error,
  isCancelled,
  session,
  setState,
}: {
  bootstrap: OpenDocumentCollaborationBootstrap
  bootstrapContent: JSONContent | string | null
  collaborationState: DocumentCollaborationState
  error: unknown
  isCancelled: () => boolean
  session: DocumentCollaborationSession
  setState: SetActiveDocumentCollaborationState
}) {
  if (isCancelled() || !isCollaborationSyncTimeout(error)) {
    return false
  }

  setState((current) =>
    current.session === session
      ? {
          ...current,
          error: null,
          hasAttachedOnce: current.hasAttachedOnce,
          role: bootstrap.role,
          connectionState: getSessionConnectionState(session),
          editorCollaboration:
            current.editorCollaboration ?? collaborationState,
          bootstrapContent: current.bootstrapContent ?? bootstrapContent,
        }
      : current
  )
  return true
}

function attachCollaborationSessionListeners({
  bootstrap,
  bootstrapContent,
  collaborationState,
  isCancelled,
  onStatusChange,
  onViewersChange,
  runtime,
  session,
  setState,
}: {
  bootstrap: OpenDocumentCollaborationBootstrap
  bootstrapContent: JSONContent | string | null
  collaborationState: DocumentCollaborationState
  isCancelled: () => boolean
  onStatusChange: (change: CollaborationStatusChange) => void
  onViewersChange: (
    local: CollaborationAwarenessState | null,
    remote: CollaborationAwarenessState[]
  ) => void
  runtime: CollaborationRuntime
  session: DocumentCollaborationSession
  setState: SetActiveDocumentCollaborationState
}) {
  const handleSynced = (synced: boolean) => {
    if (!synced || isCancelled()) {
      return
    }

    setSyncedCollaborationState({
      bootstrap,
      bootstrapContent,
      collaborationState,
      session,
      setState,
    })
  }

  runtime.disposeStatus = session.onStatusChange(onStatusChange)
  runtime.disposeAwareness = session.onAwarenessChange(({ local, remote }) => {
    onViewersChange(local, remote)
  })
  session.binding.provider.on("synced", handleSynced)
  runtime.disposeSynced = () => {
    session.binding.provider.off("synced", handleSynced)
  }
}

async function openCollaborationAttempt(params: CollaborationAttemptParams) {
  const { adapter, runtime, snapshot, isCancelled, setState } = params
  const opened = await openDocumentCollaborationSession({
    documentId: snapshot.documentId,
    adapter,
  })
  const bootstrap = opened.bootstrap
  const session = opened.session

  runtime.activeSession = session
  runtime.activeRole = bootstrap.role

  if (isCancelled()) {
    disconnectCollaborationRuntimeSession(runtime, "cancelled")
    return "cancelled"
  }

  const localUser = createLocalCollaborationUser({
    snapshot,
    sessionId: bootstrap.sessionId,
  })
  const collaborationState = {
    binding: session.binding,
    localUser,
  }
  const bootstrapContent = getBootstrapContent(bootstrap)

  attachCollaborationSessionListeners({
    bootstrap,
    bootstrapContent,
    collaborationState,
    isCancelled,
    onStatusChange: params.onStatusChange,
    onViewersChange: params.onViewersChange,
    runtime,
    session,
    setState,
  })

  session.updateLocalAwareness(localUser)
  setConnectingCollaborationState({
    bootstrap,
    bootstrapContent,
    collaborationState,
    documentId: snapshot.documentId,
    session,
    setState,
  })

  try {
    await session.connect()
  } catch (error) {
    if (
      handleCollaborationSyncTimeout({
        bootstrap,
        bootstrapContent,
        collaborationState,
        error,
        isCancelled,
        session,
        setState,
      })
    ) {
      return "attached"
    }

    throw error
  }

  if (isCancelled()) {
    disconnectCollaborationRuntimeSession(runtime, "cancelled")
    return "cancelled"
  }

  setConnectedCollaborationState({
    bootstrap,
    bootstrapContent,
    collaborationState,
    documentId: snapshot.documentId,
    session,
    setState,
  })
  reportCollaborationSessionDiagnostic({
    documentId: snapshot.documentId,
    durationMs: window.performance.now() - params.startedAt,
    status: "success",
  })
  return "attached"
}

async function runCollaborationOpenAttempts(
  params: CollaborationAttemptParams
) {
  let latestError: unknown = null

  for (
    let attempt = 1;
    attempt <= COLLABORATION_CONNECT_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const status = await openCollaborationAttempt(params)

      if (status === "attached" || status === "cancelled") {
        return
      }
    } catch (error) {
      latestError = error
      disposeCollaborationRuntimeSubscriptions(params.runtime)
      disconnectCollaborationRuntimeSession(
        params.runtime,
        `connect-failed:${attempt}`
      )

      if (params.isCancelled()) {
        return
      }

      if (!shouldRetryCollaborationAttempt(attempt, error)) {
        throw error
      }

      await waitForDelay(COLLABORATION_CONNECT_RETRY_BASE_DELAY_MS * attempt)
    }
  }

  throw latestError ?? new Error("Failed to open collaboration session")
}

function handleCollaborationOpenFailure({
  documentId,
  error,
  isCancelled,
  runtime,
  setState,
  startedAt,
}: {
  documentId: string
  error: unknown
  isCancelled: () => boolean
  runtime: CollaborationRuntime
  setState: SetActiveDocumentCollaborationState
  startedAt: number
}) {
  if (isCancelled()) {
    return
  }

  reportCollaborationSessionDiagnostic({
    documentId,
    durationMs: window.performance.now() - startedAt,
    status: "failure",
    errorMessage: getCollaborationErrorMessage(error),
  })

  if (!isExpectedCollaborationUnavailable(error)) {
    console.error("Failed to open collaboration session", error)
  }

  disconnectCollaborationRuntimeSession(runtime, "connect-failed")
  setState({
    documentId,
    error: getCollaborationErrorMessage(error),
    hasAttachedOnce: false,
    role: null,
    connectionState: "errored",
    session: null,
    editorCollaboration: null,
    collaboration: null,
    bootstrapContent: null,
    viewers: EMPTY_VIEWERS,
  })
}

async function openActiveDocumentCollaboration(
  params: Omit<CollaborationAttemptParams, "startedAt">
) {
  const startedAt = window.performance.now()

  try {
    await runCollaborationOpenAttempts({
      ...params,
      startedAt,
    })
  } catch (error) {
    handleCollaborationOpenFailure({
      documentId: params.snapshot.documentId,
      error,
      isCancelled: params.isCancelled,
      runtime: params.runtime,
      setState: params.setState,
      startedAt,
    })
  }
}

function isActiveCollaborationDocument({
  documentId,
  state,
  wantsCollaboration,
}: {
  documentId: string | null
  state: ActiveDocumentCollaborationState
  wantsCollaboration: boolean
}) {
  return (
    wantsCollaboration && state.documentId === documentId && documentId !== null
  )
}

function resolveCollaborationConnectionState({
  isActiveDocument,
  state,
  wantsCollaboration,
}: {
  isActiveDocument: boolean
  state: ActiveDocumentCollaborationState
  wantsCollaboration: boolean
}): CollaborationConnectionState {
  if (isActiveDocument) {
    return state.connectionState
  }

  return wantsCollaboration ? "connecting" : "idle"
}

function isCollaborationSessionAttached({
  connectionState,
  isActiveDocument,
  state,
}: {
  connectionState: CollaborationConnectionState
  isActiveDocument: boolean
  state: ActiveDocumentCollaborationState
}) {
  return (
    isActiveDocument &&
    state.collaboration !== null &&
    state.session !== null &&
    connectionState === "connected"
  )
}

function hasActiveEditorCollaborationSession({
  connectionState,
  isActiveDocument,
  state,
}: {
  connectionState: CollaborationConnectionState
  isActiveDocument: boolean
  state: ActiveDocumentCollaborationState
}) {
  return (
    isActiveDocument &&
    state.editorCollaboration !== null &&
    state.session !== null &&
    (connectionState === "connected" || connectionState === "connecting")
  )
}

function resolveCollaborationLifecycle({
  connectionState,
  documentId,
  isActiveDocument,
  isSessionAttached,
  wantsCollaboration,
}: {
  connectionState: CollaborationConnectionState
  documentId: string | null
  isActiveDocument: boolean
  isSessionAttached: boolean
  wantsCollaboration: boolean
}): CollaborationLifecycleState {
  if (!wantsCollaboration || documentId === null) {
    return "legacy"
  }

  if (isSessionAttached) {
    return "attached"
  }

  if (
    isActiveDocument &&
    (connectionState === "errored" || connectionState === "disconnected")
  ) {
    return "degraded"
  }

  return "bootstrapping"
}

function hasDocumentAttachedOnce(
  isActiveDocument: boolean,
  state: ActiveDocumentCollaborationState
) {
  return (
    isActiveDocument && (state.hasAttachedOnce || state.collaboration !== null)
  )
}

function getDerivedDocumentCollaborationState({
  documentId,
  state,
  wantsCollaboration,
}: {
  documentId: string | null
  state: ActiveDocumentCollaborationState
  wantsCollaboration: boolean
}): DerivedDocumentCollaborationState {
  const isActiveDocument = isActiveCollaborationDocument({
    documentId,
    state,
    wantsCollaboration,
  })
  const connectionState = resolveCollaborationConnectionState({
    isActiveDocument,
    state,
    wantsCollaboration,
  })
  const isSessionAttached = isCollaborationSessionAttached({
    connectionState,
    isActiveDocument,
    state,
  })
  const hasActiveEditorSession = hasActiveEditorCollaborationSession({
    connectionState,
    isActiveDocument,
    state,
  })
  const lifecycle = resolveCollaborationLifecycle({
    connectionState,
    documentId,
    isActiveDocument,
    isSessionAttached,
    wantsCollaboration,
  })

  return {
    bootstrapContent: isActiveDocument ? state.bootstrapContent : null,
    collaboration: isSessionAttached ? state.collaboration : null,
    connectionState,
    editorCollaboration: hasActiveEditorSession
      ? state.editorCollaboration
      : null,
    error: isActiveDocument ? state.error : null,
    hasActiveEditorSession,
    hasAttachedOnce: hasDocumentAttachedOnce(isActiveDocument, state),
    isActiveDocument,
    isAwaitingCollaboration: lifecycle === "bootstrapping",
    lifecycle,
    mode: lifecycle === "attached" ? "collaboration" : "legacy",
    role: isSessionAttached ? state.role : null,
    session: isSessionAttached ? state.session : null,
    viewers: hasActiveEditorSession ? state.viewers : EMPTY_VIEWERS,
  }
}

function useCollaborationViewerProfile(
  currentUser: CollaborationViewerUser | null
) {
  const currentUserId = currentUser?.id ?? null
  const currentUserName = currentUser?.name ?? null
  const currentUserAvatarImageUrl = currentUser?.avatarImageUrl ?? null
  const currentUserAvatarUrl = currentUser?.avatarUrl ?? null
  const currentUserResolvedAvatarUrl = useMemo(
    () =>
      resolveImageAssetSource(currentUserAvatarImageUrl, currentUserAvatarUrl),
    [currentUserAvatarImageUrl, currentUserAvatarUrl]
  )
  const currentUserNameRef = useRef(currentUserName)
  const currentUserResolvedAvatarUrlRef = useRef(currentUserResolvedAvatarUrl)

  useEffect(() => {
    currentUserNameRef.current = currentUserName
    currentUserResolvedAvatarUrlRef.current = currentUserResolvedAvatarUrl
  }, [currentUserName, currentUserResolvedAvatarUrl])

  return {
    currentUserId,
    currentUserName,
    currentUserNameRef,
    currentUserResolvedAvatarUrl,
    currentUserResolvedAvatarUrlRef,
  }
}

function useCollaborationStateResets({
  activeSessionKey,
  documentId,
  setState,
}: {
  activeSessionKey: string | null
  documentId: string | null
  setState: SetActiveDocumentCollaborationState
}) {
  const lastKnownDocumentIdRef = useRef<string | null>(null)

  useEffect(() => {
    setState(EMPTY_COLLABORATION_STATE)
  }, [activeSessionKey, setState])

  useEffect(() => {
    if (!documentId || documentId === lastKnownDocumentIdRef.current) {
      return
    }

    lastKnownDocumentIdRef.current = documentId
    setState(EMPTY_COLLABORATION_STATE)
  }, [documentId, setState])
}

function useCollaborationStateEvents(
  setState: SetActiveDocumentCollaborationState
) {
  const handleStatusChange = useCallback(
    (change: CollaborationStatusChange) => {
      setState((current) => ({
        ...current,
        connectionState: change.state,
        error:
          change.state === "errored" || change.reloadRequired
            ? (change.reason ?? current.error)
            : current.error,
      }))
    },
    [setState]
  )
  const handleViewersChange = useCallback(
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
    },
    [setState]
  )

  return {
    handleStatusChange,
    handleViewersChange,
  }
}

function useActiveDocumentCollaboration({
  adapter,
  currentUserId,
  currentUserNameRef,
  currentUserResolvedAvatarUrlRef,
  documentId,
  isEnabled,
  onStatusChange,
  onViewersChange,
  setState,
}: {
  adapter: ReturnType<typeof createPartyKitCollaborationAdapter>
  currentUserId: string | null
  currentUserNameRef: RefObject<string | null>
  currentUserResolvedAvatarUrlRef: RefObject<string | null>
  documentId: string | null
  isEnabled: boolean
  onStatusChange: (change: CollaborationStatusChange) => void
  onViewersChange: (
    local: CollaborationAwarenessState | null,
    remote: CollaborationAwarenessState[]
  ) => void
  setState: SetActiveDocumentCollaborationState
}) {
  useEffect(() => {
    const currentUserName = currentUserNameRef.current

    if (!isEnabled || !documentId || !currentUserId || !currentUserName) {
      return
    }

    let cancelled = false
    const runtime = createCollaborationRuntime()
    const snapshot = {
      documentId,
      userId: currentUserId,
      userName: currentUserName,
      avatarUrl: currentUserResolvedAvatarUrlRef.current,
    }
    const openTimer = window.setTimeout(() => {
      void openActiveDocumentCollaboration({
        adapter,
        runtime,
        snapshot,
        isCancelled: () => cancelled,
        onStatusChange,
        onViewersChange,
        setState,
      })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(openTimer)
      closeCollaborationRuntimeOnUnmount(runtime)
    }
  }, [
    adapter,
    currentUserId,
    currentUserNameRef,
    currentUserResolvedAvatarUrlRef,
    documentId,
    isEnabled,
    onStatusChange,
    onViewersChange,
    setState,
  ])
}

function useCollaborationAwarenessProfileSync({
  currentUserId,
  currentUserName,
  currentUserResolvedAvatarUrl,
  isActiveDocument,
  setState,
  state,
}: {
  currentUserId: string | null
  currentUserName: string | null
  currentUserResolvedAvatarUrl: string | null
  isActiveDocument: boolean
  setState: SetActiveDocumentCollaborationState
  state: ActiveDocumentCollaborationState
}) {
  useEffect(() => {
    if (
      !isActiveDocument ||
      !state.session ||
      !state.editorCollaboration ||
      !currentUserId ||
      !currentUserName
    ) {
      return
    }

    const currentLocalUser = state.editorCollaboration.localUser
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
      current.session === state.session && current.editorCollaboration
        ? {
            ...current,
            editorCollaboration: {
              ...current.editorCollaboration,
              localUser: nextLocalUser,
            },
            collaboration: {
              ...(current.collaboration ?? current.editorCollaboration),
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
    setState,
    state.editorCollaboration,
    state.session,
  ])
}

function useRealtimeFallbackDiagnostic({
  collaborationEnabled,
  documentId,
  enabled,
}: {
  collaborationEnabled: boolean
  documentId: string | null
  enabled?: boolean
}) {
  useEffect(() => {
    if (collaborationEnabled || !enabled || !documentId) {
      return
    }

    reportRealtimeFallbackDiagnostic({
      reason: "collaboration-disabled",
      target: "legacy-rich-text-sync",
    })
  }, [collaborationEnabled, documentId, enabled])
}

function useEditorSessionPageHideFlush(
  session: DocumentCollaborationSession | null,
  role: CollaborationSessionRole | null
) {
  useEffect(() => {
    if (!session || role !== "editor") {
      return
    }

    const handlePageHide = () => {
      void session.flush({ kind: "teardown-content" }).catch((error) => {
        console.error(
          "Failed to flush collaboration session on page hide",
          error
        )
      })
    }

    window.addEventListener("pagehide", handlePageHide)

    return () => {
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [role, session])
}

export function useDocumentCollaboration(input: {
  documentId: string | null
  currentUser: CollaborationViewerUser | null
  enabled?: boolean
}) {
  const adapter = useMemo(() => createPartyKitCollaborationAdapter(), [])
  const documentId = input.documentId
  const {
    currentUserId,
    currentUserName,
    currentUserNameRef,
    currentUserResolvedAvatarUrl,
    currentUserResolvedAvatarUrlRef,
  } = useCollaborationViewerProfile(input.currentUser)
  const collaborationEnabled = isCollaborationEnabled()
  const wantsCollaboration = Boolean(
    collaborationEnabled && input.enabled && documentId
  )
  const [state, setState] = useState<ActiveDocumentCollaborationState>(
    EMPTY_COLLABORATION_STATE
  )
  const isEnabled = Boolean(
    wantsCollaboration && currentUserId && currentUserName
  )
  const activeSessionKey =
    isEnabled && documentId && currentUserId
      ? `${currentUserId}:${documentId}`
      : null

  useCollaborationStateResets({
    activeSessionKey,
    documentId,
    setState,
  })
  const { handleStatusChange, handleViewersChange } =
    useCollaborationStateEvents(setState)

  useActiveDocumentCollaboration({
    adapter,
    currentUserId,
    currentUserNameRef,
    currentUserResolvedAvatarUrlRef,
    documentId,
    isEnabled,
    onStatusChange: handleStatusChange,
    onViewersChange: handleViewersChange,
    setState,
  })

  const derived = getDerivedDocumentCollaborationState({
    documentId,
    state,
    wantsCollaboration,
  })

  useCollaborationAwarenessProfileSync({
    currentUserId,
    currentUserName,
    currentUserResolvedAvatarUrl,
    isActiveDocument: derived.isActiveDocument,
    setState,
    state,
  })
  useRealtimeFallbackDiagnostic({
    collaborationEnabled,
    documentId,
    enabled: input.enabled,
  })
  useEditorSessionPageHideFlush(derived.session, derived.role)

  const flush = useCallback(
    async (input?: CollaborationFlushInput) => {
      await derived.session?.flush(input)
    },
    [derived.session]
  )

  return {
    lifecycle: derived.lifecycle,
    mode: derived.mode,
    error: derived.error,
    role: derived.role,
    connectionState: derived.connectionState,
    editorCollaboration: derived.editorCollaboration,
    collaboration: derived.collaboration,
    bootstrapContent: derived.bootstrapContent,
    hasAttachedOnce: derived.hasAttachedOnce,
    isAwaitingCollaboration: derived.isAwaitingCollaboration,
    viewers: derived.viewers,
    flush,
  }
}

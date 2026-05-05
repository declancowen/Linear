import type { JSONContent } from "@tiptap/core"

import { RouteMutationError } from "@/lib/convex/client/shared"
import type { PartyKitDocumentCollaborationBinding } from "@/lib/collaboration/adapters/partykit"
import type {
  CollaborationConnectionState,
  CollaborationSessionRole,
  CollaborationTransportSession,
} from "@/lib/collaboration/transport"
import type { DocumentPresenceViewer } from "@/lib/domain/types"
import type { openDocumentCollaborationSession } from "@/lib/collaboration/client-session"
import type { CollaborationAwarenessState } from "@/lib/collaboration/awareness"

export type DocumentCollaborationState = {
  binding: PartyKitDocumentCollaborationBinding
  localUser: CollaborationAwarenessState
}

export type DocumentCollaborationSession = CollaborationTransportSession<
  CollaborationAwarenessState,
  PartyKitDocumentCollaborationBinding
>

export type OpenDocumentCollaborationBootstrap = Awaited<
  ReturnType<typeof openDocumentCollaborationSession>
>["bootstrap"]

export type ActiveDocumentCollaborationState = {
  documentId: string | null
  error: string | null
  hasAttachedOnce: boolean
  role: CollaborationSessionRole | null
  connectionState: CollaborationConnectionState
  session: DocumentCollaborationSession | null
  editorCollaboration: DocumentCollaborationState | null
  collaboration: DocumentCollaborationState | null
  bootstrapContent: JSONContent | string | null
  viewers: DocumentPresenceViewer[]
}

export function isExpectedCollaborationUnavailable(error: unknown) {
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

export function getSyncedCollaborationState(
  current: ActiveDocumentCollaborationState,
  input: {
    bootstrap: OpenDocumentCollaborationBootstrap
    bootstrapContent: JSONContent | string | null
    collaborationState: DocumentCollaborationState
    session: DocumentCollaborationSession
  }
) {
  return current.session === input.session
    ? {
        ...current,
        error: null,
        hasAttachedOnce: true,
        role: input.bootstrap.role,
        editorCollaboration:
          current.editorCollaboration ?? input.collaborationState,
        collaboration: current.collaboration ?? input.collaborationState,
        bootstrapContent: current.bootstrapContent ?? input.bootstrapContent,
      }
    : current
}

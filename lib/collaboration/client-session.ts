"use client"

import type {
  CollaborationTransportAdapter,
  CollaborationTransportSession,
} from "@/lib/collaboration/transport"
import {
  type DocumentCollaborationSessionPayload,
  syncCreateDocumentCollaborationSession,
} from "@/lib/convex/client"

export type OpenDocumentCollaborationSessionResult<
  TAwarenessState,
  TBinding = unknown,
> = {
  bootstrap: DocumentCollaborationSessionPayload
  session: CollaborationTransportSession<TAwarenessState, TBinding>
}

export async function openDocumentCollaborationSession<
  TAwarenessState,
  TBinding = unknown,
>(
  input: {
    documentId: string
    adapter: CollaborationTransportAdapter<TAwarenessState, TBinding>
  }
): Promise<
  OpenDocumentCollaborationSessionResult<TAwarenessState, TBinding>
> {
  const bootstrap = await syncCreateDocumentCollaborationSession(
    input.documentId
  )
  const session = input.adapter.openDocumentSession({
    ...bootstrap,
    getFreshBootstrap: () =>
      syncCreateDocumentCollaborationSession(input.documentId),
  })

  return {
    bootstrap,
    session,
  }
}

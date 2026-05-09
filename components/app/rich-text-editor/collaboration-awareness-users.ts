import {
  createCollaborationAwarenessState,
  type CollaborationAwarenessState,
} from "@/lib/collaboration/awareness"

import {
  normalizeCollaborationRelativeRange,
  type CollaborationRelativeRange,
} from "./collaboration-relative-range"
import {
  getCollaborationAwarenessUser,
  type CollaborationAwarenessUser,
} from "./collaboration-awareness-user"

type CollaborationAwareness = {
  getLocalState: () => unknown
  getStates: () => Map<number, unknown>
  setLocalStateField: (field: string, value: unknown) => void
}

export type RichTextEditorCollaborationAwarenessInput = {
  binding: {
    provider: {
      awareness: CollaborationAwareness
    }
  }
  localUser: CollaborationAwarenessState
}

export type CollaborationAwarenessPatch = Partial<CollaborationAwarenessState> & {
  relativeCursor?: CollaborationRelativeRange | null
  relativeSelection?: CollaborationRelativeRange | null
}

function getStoredCollaborationRelativeRange(
  localAwarenessUser: Record<string, unknown> | null,
  key: "relativeCursor" | "relativeSelection"
) {
  return normalizeCollaborationRelativeRange(localAwarenessUser?.[key])
}

export function createMergedCollaborationAwarenessUser(
  collaboration: RichTextEditorCollaborationAwarenessInput,
  localAwarenessUser: Record<string, unknown> | null,
  patch?: CollaborationAwarenessPatch
) {
  const relativeCursor =
    patch?.relativeCursor ??
    getStoredCollaborationRelativeRange(localAwarenessUser, "relativeCursor")
  const relativeSelection =
    patch?.relativeSelection ??
    getStoredCollaborationRelativeRange(localAwarenessUser, "relativeSelection")
  const mergedUserBase = createCollaborationAwarenessState({
    ...collaboration.localUser,
    ...(localAwarenessUser ?? {}),
    ...patch,
  })

  return {
    ...mergedUserBase,
    relativeCursor,
    relativeSelection,
  }
}

function getLocalCollaborationSessionId(
  collaboration: RichTextEditorCollaborationAwarenessInput
) {
  return (
    getCollaborationAwarenessUser(
      collaboration.binding.provider.awareness.getLocalState()
    )?.sessionId ?? collaboration.localUser.sessionId
  )
}

export function forEachRemoteCollaborationAwarenessUser(
  input: {
    collaboration: RichTextEditorCollaborationAwarenessInput
    currentPresenceUserId: string | null
  },
  visit: (
    value: unknown,
    clientId: number,
    user: CollaborationAwarenessUser
  ) => void
) {
  const localSessionId = getLocalCollaborationSessionId(input.collaboration)

  input.collaboration.binding.provider.awareness
    .getStates()
    .forEach((value, clientId) => {
      const user = getCollaborationAwarenessUser(value)

      if (!user) {
        return
      }

      if (
        user.sessionId === localSessionId ||
        (input.currentPresenceUserId &&
          user.userId === input.currentPresenceUserId)
      ) {
        return
      }

      visit(value, clientId, user)
    })
}

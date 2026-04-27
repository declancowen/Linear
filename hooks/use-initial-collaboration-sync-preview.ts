"use client"

import { useEffect, useReducer } from "react"

function hasSeenInitialSyncPreview(storageKey: string) {
  if (typeof window === "undefined") {
    return false
  }

  return window.sessionStorage.getItem(storageKey) === "true"
}

function markInitialSyncPreviewSeen(storageKey: string) {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.setItem(storageKey, "true")
}

export function useInitialCollaborationSyncPreview(input: {
  id: string | null
  storagePrefix: string
  eligible?: boolean
  bootstrapping: boolean
  attached: boolean
}) {
  const storageKey = input.id ? `${input.storagePrefix}${input.id}` : null
  const [previewState, dispatchPreviewState] = useReducer(
    (
      state: {
        storageKey: string | null
        seen: boolean
        activePreviewId: string | null
      },
      action:
        | {
            type: "reset-storage-key"
            storageKey: string | null
          }
        | {
            type: "start"
            id: string
            storageKey: string
          }
        | {
            type: "stop"
            id: string
          }
    ) => {
      if (action.type === "reset-storage-key") {
        return {
          storageKey: action.storageKey,
          seen: action.storageKey
            ? hasSeenInitialSyncPreview(action.storageKey)
            : false,
          activePreviewId: null,
        }
      }

      if (action.type === "start") {
        return {
          storageKey: action.storageKey,
          seen: true,
          activePreviewId: action.id,
        }
      }

      if (state.activePreviewId !== action.id) {
        return state
      }

      return {
        ...state,
        activePreviewId: null,
      }
    },
    storageKey,
    (initialStorageKey) => ({
      storageKey: initialStorageKey,
      seen: initialStorageKey
        ? hasSeenInitialSyncPreview(initialStorageKey)
        : false,
      activePreviewId: null,
    })
  )
  const seenPreview = {
    storageKey,
    value: previewState.storageKey === storageKey ? previewState.seen : true,
  }
  const activePreviewId = previewState.activePreviewId
  const hasSeenPreview =
    seenPreview.storageKey === storageKey ? seenPreview.value : true

  useEffect(() => {
    dispatchPreviewState({
      type: "reset-storage-key",
      storageKey,
    })
  }, [storageKey])

  const eligible = input.eligible ?? true
  const shouldStartPreview = Boolean(
    input.id &&
    storageKey &&
    eligible &&
    input.bootstrapping &&
    !hasSeenPreview &&
    activePreviewId !== input.id
  )

  useEffect(() => {
    if (!input.id || !storageKey || !shouldStartPreview) {
      return
    }

    markInitialSyncPreviewSeen(storageKey)
    dispatchPreviewState({
      type: "start",
      id: input.id,
      storageKey,
    })
  }, [input.id, shouldStartPreview, storageKey])

  useEffect(() => {
    if (!input.id || activePreviewId !== input.id) {
      return
    }

    if (!eligible || !input.bootstrapping || input.attached) {
      dispatchPreviewState({
        type: "stop",
        id: input.id,
      })
    }
  }, [activePreviewId, eligible, input.attached, input.bootstrapping, input.id])

  return Boolean(
    input.id &&
    eligible &&
    input.bootstrapping &&
    (!hasSeenPreview || activePreviewId === input.id)
  )
}

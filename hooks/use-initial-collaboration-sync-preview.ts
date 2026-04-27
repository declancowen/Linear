"use client"

import { useEffect, useState } from "react"

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
  const [seenPreview, setSeenPreview] = useState(() => ({
    storageKey,
    value: storageKey ? hasSeenInitialSyncPreview(storageKey) : false,
  }))
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null)
  const hasSeenPreview =
    seenPreview.storageKey === storageKey ? seenPreview.value : true

  useEffect(() => {
    setActivePreviewId(null)
    setSeenPreview({
      storageKey,
      value: storageKey ? hasSeenInitialSyncPreview(storageKey) : false,
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
    setSeenPreview({
      storageKey,
      value: true,
    })
    setActivePreviewId(input.id)
  }, [input.id, shouldStartPreview, storageKey])

  useEffect(() => {
    if (!input.id || activePreviewId !== input.id) {
      return
    }

    if (!eligible || !input.bootstrapping || input.attached) {
      setActivePreviewId(null)
    }
  }, [
    activePreviewId,
    eligible,
    input.attached,
    input.bootstrapping,
    input.id,
  ])

  return Boolean(
    input.id &&
      eligible &&
      input.bootstrapping &&
      (!hasSeenPreview || activePreviewId === input.id)
  )
}

"use client"

import { toast } from "sonner"

import { reportRealtimeFallbackDiagnostic } from "@/lib/browser/snapshot-diagnostics"
import { fetchSnapshot } from "@/lib/convex/client"
import { RouteMutationError } from "@/lib/convex/client/shared"

import type { AppStoreGet, RichTextSyncTask } from "./types"

const RICH_TEXT_SYNC_DELAY_MS = 350

type QueuedSyncEntry = {
  fallbackMessage: string
  inFlight: boolean
  idleWaiters: Array<() => void>
  latestTask: RichTextSyncTask | null
  refreshStrategy: "none" | "snapshot"
  timeoutId: ReturnType<typeof setTimeout> | null
}

const queuedRichTextSyncs = new Map<string, QueuedSyncEntry>()

export function createStoreRuntime(get: AppStoreGet) {
  function isProtectedRichTextSyncKey(key: string) {
    const state = get()

    if (key.startsWith("document:")) {
      const documentId = key.slice("document:".length)
      return state.protectedDocumentIds.includes(documentId)
    }

    if (key.startsWith("item-description:")) {
      const itemId = key.slice("item-description:".length)
      const item = state.workItems.find((entry) => entry.id === itemId)
      const descriptionDocumentId = item?.descriptionDocId ?? null

      if (!descriptionDocumentId) {
        return false
      }

      return state.protectedDocumentIds.includes(descriptionDocumentId)
    }

    return false
  }

  function shouldIgnoreRichTextSyncFailure(key: string, error: unknown) {
    if (!(error instanceof RouteMutationError)) {
      return false
    }

    if (
      error.code !== "DOCUMENT_EDIT_CONFLICT" &&
      error.code !== "ITEM_DESCRIPTION_EDIT_CONFLICT"
    ) {
      return false
    }

    return isProtectedRichTextSyncKey(key)
  }

  function cancelRichTextSync(key: string) {
    const entry = queuedRichTextSyncs.get(key)

    if (!entry) {
      return
    }

    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId)
      entry.timeoutId = null
    }

    entry.latestTask = null
    resolveRichTextSyncIdle(key)
  }

  function resolveRichTextSyncIdle(key: string) {
    const entry = queuedRichTextSyncs.get(key)

    if (!entry || entry.inFlight || entry.latestTask || entry.timeoutId) {
      return
    }

    queuedRichTextSyncs.delete(key)

    for (const resolve of entry.idleWaiters.splice(0)) {
      resolve()
    }
  }

  async function refreshFromServer() {
    reportRealtimeFallbackDiagnostic({
      reason: "store-runtime-refresh",
      target: "legacy-snapshot-bootstrap",
    })
    const snapshot = await fetchSnapshot()

    if (snapshot) {
      get().replaceDomainData(snapshot)
    }
  }

  async function handleSyncFailure(
    error: unknown,
    fallbackMessage: string,
    options?: {
      refreshStrategy?: "none" | "snapshot"
    }
  ) {
    console.error(error)
    if ((options?.refreshStrategy ?? "snapshot") === "snapshot") {
      void refreshFromServer().catch((refreshError) => {
        console.error(
          "Failed to reconcile store state after sync failure",
          refreshError
        )
      })
    }
    toast.error(fallbackMessage)
  }

  async function flushQueuedRichTextSync(key: string) {
    const entry = queuedRichTextSyncs.get(key)

    if (!entry || entry.inFlight || !entry.latestTask) {
      resolveRichTextSyncIdle(key)
      return
    }

    const task = entry.latestTask
    entry.latestTask = null
    entry.inFlight = true

    try {
      await task()
    } catch (error) {
      if (shouldIgnoreRichTextSyncFailure(key, error)) {
        return
      }

      if (
        error instanceof RouteMutationError &&
        (error.code === "WORK_ITEM_NOT_FOUND" ||
          error.code === "DOCUMENT_NOT_FOUND") &&
        entry.refreshStrategy === "snapshot"
      ) {
        void refreshFromServer().catch((refreshError) => {
          console.error(
            "Failed to reconcile store state after benign rich text sync failure",
            refreshError
          )
        })
      } else {
        await handleSyncFailure(error, entry.fallbackMessage, {
          refreshStrategy: entry.refreshStrategy,
        })
      }
    } finally {
      entry.inFlight = false

      if (entry.latestTask) {
        void flushQueuedRichTextSync(key)
        return
      }

      resolveRichTextSyncIdle(key)
    }
  }

  function queueRichTextSync(
    key: string,
    task: RichTextSyncTask,
    fallbackMessage: string,
    options?: {
      refreshStrategy?: "none" | "snapshot"
    }
  ) {
    const existingEntry = queuedRichTextSyncs.get(key)

    if (existingEntry?.timeoutId) {
      clearTimeout(existingEntry.timeoutId)
    }

    const entry: QueuedSyncEntry = existingEntry ?? {
      fallbackMessage,
      inFlight: false,
      idleWaiters: [],
      latestTask: null,
      refreshStrategy: "snapshot",
      timeoutId: null,
    }

    entry.fallbackMessage = fallbackMessage
    entry.latestTask = task
    entry.refreshStrategy = options?.refreshStrategy ?? "snapshot"
    entry.timeoutId = setTimeout(() => {
      entry.timeoutId = null
      void flushQueuedRichTextSync(key)
    }, RICH_TEXT_SYNC_DELAY_MS)

    queuedRichTextSyncs.set(key, entry)
  }

  async function flushRichTextSync(key: string) {
    const entry = queuedRichTextSyncs.get(key)

    if (!entry) {
      return
    }

    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId)
      entry.timeoutId = null
    }

    void flushQueuedRichTextSync(key)

    const latestEntry = queuedRichTextSyncs.get(key)

    if (
      !latestEntry ||
      (!latestEntry.inFlight &&
        !latestEntry.latestTask &&
        !latestEntry.timeoutId)
    ) {
      resolveRichTextSyncIdle(key)
      return
    }

    await new Promise<void>((resolve) => {
      latestEntry.idleWaiters.push(resolve)
      void flushQueuedRichTextSync(key)
    })
  }

  function syncInBackground(task: Promise<unknown> | null, fallbackMessage: string) {
    if (!task) {
      return
    }

    void task.catch((error) => handleSyncFailure(error, fallbackMessage))
  }

  return {
    cancelRichTextSync,
    flushRichTextSync,
    handleSyncFailure,
    queueRichTextSync,
    refreshFromServer,
    syncInBackground,
  }
}

"use client"

import { toast } from "sonner"

import { fetchSnapshot } from "@/lib/convex/client"

import type { AppStoreGet, RichTextSyncTask } from "./types"

const RICH_TEXT_SYNC_DELAY_MS = 350

type QueuedSyncEntry = {
  fallbackMessage: string
  inFlight: boolean
  idleWaiters: Array<() => void>
  latestTask: RichTextSyncTask | null
  timeoutId: ReturnType<typeof setTimeout> | null
}

const queuedRichTextSyncs = new Map<string, QueuedSyncEntry>()

export function createStoreRuntime(get: AppStoreGet) {
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
    const snapshot = await fetchSnapshot()

    if (snapshot) {
      get().replaceDomainData(snapshot)
    }
  }

  async function handleSyncFailure(error: unknown, fallbackMessage: string) {
    console.error(error)
    void refreshFromServer().catch((refreshError) => {
      console.error("Failed to reconcile store state after sync failure", refreshError)
    })
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
      await handleSyncFailure(error, entry.fallbackMessage)
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
    fallbackMessage: string
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
      timeoutId: null,
    }

    entry.fallbackMessage = fallbackMessage
    entry.latestTask = task
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
    flushRichTextSync,
    handleSyncFailure,
    queueRichTextSync,
    refreshFromServer,
    syncInBackground,
  }
}

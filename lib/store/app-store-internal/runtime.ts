"use client"

import { toast } from "sonner"

import { fetchSnapshot } from "@/lib/convex/client"

import type { AppStoreGet, RichTextSyncTask } from "./types"

const RICH_TEXT_SYNC_DELAY_MS = 350

type QueuedSyncEntry = {
  fallbackMessage: string
  inFlight: boolean
  latestTask: RichTextSyncTask | null
  timeoutId: ReturnType<typeof setTimeout> | null
}

const queuedRichTextSyncs = new Map<string, QueuedSyncEntry>()

export function createStoreRuntime(get: AppStoreGet) {
  async function refreshFromServer() {
    const snapshot = await fetchSnapshot()

    if (snapshot) {
      get().replaceDomainData(snapshot)
    }
  }

  async function handleSyncFailure(error: unknown, fallbackMessage: string) {
    console.error(error)
    await refreshFromServer()
    toast.error(fallbackMessage)
  }

  async function flushQueuedRichTextSync(key: string) {
    const entry = queuedRichTextSyncs.get(key)

    if (!entry || entry.inFlight || !entry.latestTask) {
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

      if (!entry.timeoutId) {
        queuedRichTextSyncs.delete(key)
      }
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

  function syncInBackground(task: Promise<unknown> | null, fallbackMessage: string) {
    if (!task) {
      return
    }

    void task.catch((error) => handleSyncFailure(error, fallbackMessage))
  }

  return {
    handleSyncFailure,
    queueRichTextSync,
    refreshFromServer,
    syncInBackground,
  }
}

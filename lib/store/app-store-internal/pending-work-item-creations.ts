"use client"

const pendingWorkItemCreations = new Map<string, Promise<boolean>>()

export function registerPendingWorkItemCreation(
  itemId: string,
  task: Promise<unknown> | null | undefined
) {
  if (!task || typeof task.then !== "function") {
    pendingWorkItemCreations.delete(itemId)
    return null
  }

  const trackedTask = task
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      if (pendingWorkItemCreations.get(itemId) === trackedTask) {
        pendingWorkItemCreations.delete(itemId)
      }
    })

  pendingWorkItemCreations.set(itemId, trackedTask)
  return trackedTask
}

export function waitForPendingWorkItemCreation(itemId: string) {
  return pendingWorkItemCreations.get(itemId) ?? null
}

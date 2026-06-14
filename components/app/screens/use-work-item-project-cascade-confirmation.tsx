"use client"

import { useCallback, useState } from "react"

import { useAppStore, type AppStore } from "@/lib/store/app-store"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

type PendingProjectCascadeUpdate = {
  itemIds: string[]
  itemUpdatedAts?: Record<string, string>
  patch: Parameters<AppStore["updateWorkItem"]>[1]
  cascadeItemCount: number
  mode: "single" | "bulk"
}

export function useWorkItemProjectCascadeConfirmation() {
  const [pendingUpdate, setPendingUpdate] =
    useState<PendingProjectCascadeUpdate | null>(null)

  const requestUpdate = useCallback(
    (itemId: string, patch: Parameters<AppStore["updateWorkItem"]>[1]) => {
      const result = useAppStore.getState().updateWorkItem(itemId, patch)

      if (result.status === "project-confirmation-required") {
        setPendingUpdate({
          itemIds: [itemId],
          patch,
          cascadeItemCount: result.cascadeItemCount,
          mode: "single",
        })
      }

      return result
    },
    []
  )

  const requestBulkUpdate = useCallback(
    (itemIds: string[], patch: Parameters<AppStore["updateWorkItem"]>[1]) => {
      const uniqueItemIds = Array.from(new Set(itemIds))

      if (uniqueItemIds.length === 0) {
        return
      }

      if (uniqueItemIds.length === 1) {
        requestUpdate(uniqueItemIds[0], patch)
        return
      }

      setPendingUpdate({
        itemIds: uniqueItemIds,
        itemUpdatedAts: Object.fromEntries(
          useAppStore
            .getState()
            .workItems.filter((item) => uniqueItemIds.includes(item.id))
            .map((item) => [item.id, item.updatedAt])
        ),
        patch,
        cascadeItemCount: uniqueItemIds.length,
        mode: "bulk",
      })
    },
    [requestUpdate]
  )

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setPendingUpdate(null)
    }
  }, [])

  const handleConfirm = useCallback(() => {
    if (!pendingUpdate) {
      return
    }

    if (pendingUpdate.mode === "bulk") {
      void useAppStore.getState().bulkUpdateWorkItems(
        pendingUpdate.itemIds.map((itemId) => ({
          itemId,
          patch: {
            ...pendingUpdate.patch,
            expectedUpdatedAt: pendingUpdate.itemUpdatedAts?.[itemId] ?? "",
          },
        }))
      )
    } else {
      useAppStore
        .getState()
        .updateWorkItem(pendingUpdate.itemIds[0]!, pendingUpdate.patch, {
          confirmProjectCascade: true,
        })
    }
    setPendingUpdate(null)
  }, [pendingUpdate])

  const affectedItemLabel =
    pendingUpdate && pendingUpdate.cascadeItemCount > 1
      ? `${pendingUpdate.cascadeItemCount} items`
      : "this hierarchy"
  const isBulkUpdate = pendingUpdate?.mode === "bulk"

  return {
    requestUpdate,
    requestBulkUpdate,
    confirmationDialog: (
      <ConfirmDialog
        open={pendingUpdate !== null}
        onOpenChange={handleOpenChange}
        title={
          isBulkUpdate
            ? "Update project for selected items"
            : "Update project for hierarchy"
        }
        description={
          isBulkUpdate
            ? "Changing the project for selected items may also update their child hierarchies."
            : `Changing the project for this item will also update ${affectedItemLabel}.`
        }
        confirmLabel="Update"
        variant="default"
        onConfirm={handleConfirm}
      />
    ),
  }
}

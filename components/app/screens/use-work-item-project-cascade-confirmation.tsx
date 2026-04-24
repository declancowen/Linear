"use client"

import { useCallback, useState } from "react"

import { useAppStore, type AppStore } from "@/lib/store/app-store"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

type PendingProjectCascadeUpdate = {
  itemId: string
  patch: Parameters<AppStore["updateWorkItem"]>[1]
  cascadeItemCount: number
}

export function useWorkItemProjectCascadeConfirmation() {
  const [pendingUpdate, setPendingUpdate] =
    useState<PendingProjectCascadeUpdate | null>(null)

  const requestUpdate = useCallback(
    (itemId: string, patch: Parameters<AppStore["updateWorkItem"]>[1]) => {
      const result = useAppStore.getState().updateWorkItem(itemId, patch)

      if (result.status === "project-confirmation-required") {
        setPendingUpdate({
          itemId,
          patch,
          cascadeItemCount: result.cascadeItemCount,
        })
      }

      return result
    },
    []
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

    useAppStore.getState().updateWorkItem(pendingUpdate.itemId, pendingUpdate.patch, {
      confirmProjectCascade: true,
    })
    setPendingUpdate(null)
  }, [pendingUpdate])

  const affectedItemLabel =
    pendingUpdate && pendingUpdate.cascadeItemCount > 1
      ? `${pendingUpdate.cascadeItemCount} items`
      : "this hierarchy"

  return {
    requestUpdate,
    confirmationDialog: (
      <ConfirmDialog
        open={pendingUpdate !== null}
        onOpenChange={handleOpenChange}
        title="Update project for hierarchy"
        description={`Changing the project for this item will also update ${affectedItemLabel}.`}
        confirmLabel="Update"
        variant="default"
        onConfirm={handleConfirm}
      />
    ),
  }
}

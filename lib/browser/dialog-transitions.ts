"use client"

import type { CreateDialogState } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

import { blurActiveElement } from "./focus"

type TopLevelDialogTransitionOptions = {
  beforeOpen?: () => void
  defer?: boolean
}

export function openTopLevelDialog(
  openDialog: () => void,
  { beforeOpen, defer = true }: TopLevelDialogTransitionOptions = {}
) {
  blurActiveElement()
  beforeOpen?.()

  if (
    defer &&
    typeof window !== "undefined" &&
    typeof window.requestAnimationFrame === "function"
  ) {
    window.requestAnimationFrame(() => {
      openDialog()
    })
    return
  }

  openDialog()
}

export function openManagedCreateDialog(
  dialog: CreateDialogState,
  options?: TopLevelDialogTransitionOptions
) {
  openTopLevelDialog(() => {
    useAppStore.getState().openCreateDialog(dialog)
  }, options)
}

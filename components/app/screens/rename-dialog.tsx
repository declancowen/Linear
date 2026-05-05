"use client"

import { useState, type KeyboardEvent } from "react"

import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import {
  getTextInputLimitState,
} from "@/lib/domain/input-constraints"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function RenameDialog({
  open,
  onOpenChange,
  title,
  description,
  initialValue,
  confirmLabel,
  minLength,
  maxLength,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  initialValue: string
  confirmLabel: string
  minLength: number
  maxLength: number
  onConfirm: (value: string) => Promise<boolean> | boolean
}) {
  const [value, setValue] = useState(initialValue)
  const [submitting, setSubmitting] = useState(false)
  const limitState = getTextInputLimitState(value, {
    min: minLength,
    max: maxLength,
    trim: true,
  })

  async function handleConfirm() {
    const trimmedValue = value.trim()

    if (!trimmedValue || submitting || !limitState.canSubmit) {
      return
    }

    setSubmitting(true)
    const didSucceed = await onConfirm(trimmedValue)

    if (didSucceed) {
      onOpenChange(false)
    }

    setSubmitting(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.defaultPrevented || submitting) {
      return
    }

    const target = event.target

    if (
      target instanceof HTMLElement &&
      ["BUTTON", "A", "TEXTAREA"].includes(target.tagName)
    ) {
      return
    }

    event.preventDefault()
    void handleConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm gap-0 p-0"
        showCloseButton={false}
        onKeyDown={handleKeyDown}
      >
        <div className="space-y-4 px-5 pt-5 pb-4">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base font-semibold">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={maxLength}
          />
          <FieldCharacterLimit state={limitState} limit={maxLength} />
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={submitting || !limitState.canSubmit}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

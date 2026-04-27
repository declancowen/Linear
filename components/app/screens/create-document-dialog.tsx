"use client"

import { useEffect, useRef, useState } from "react"

import {
  documentTitleConstraints,
  getTextInputLimitState,
} from "@/lib/domain/input-constraints"
import { getTeam } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import {
  ShortcutKeys,
  useCommandEnterSubmit,
  useShortcutModifierLabel,
} from "@/components/app/shortcut-keys"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function CreateDocumentDialog({
  open,
  onOpenChange,
  input,
  disabled,
  mode = "create",
  documentId,
  initialTitle = "",
  dialogTitle,
  dialogDescription,
  submitLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  input?:
    | { kind: "team-document"; teamId: string }
    | { kind: "workspace-document" | "private-document"; workspaceId: string }
  disabled: boolean
  mode?: "create" | "rename"
  documentId?: string
  initialTitle?: string
  dialogTitle?: string
  dialogDescription?: string
  submitLabel?: string
}) {
  const team = useAppStore((state) =>
    input?.kind === "team-document" ? getTeam(state, input.teamId) : null
  )
  const contextLabel =
    input?.kind === "private-document"
      ? "Private document"
      : input?.kind === "workspace-document"
        ? "Workspace document"
        : team
          ? `Team document · ${team.name}`
          : "Team document"
  const [title, setTitle] = useState(initialTitle)
  const [creating, setCreating] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const shortcutModifierLabel = useShortcutModifierLabel()
  const titleConstraint = {
    ...documentTitleConstraints,
    allowEmpty: mode === "create",
  }
  const titleLimitState = getTextInputLimitState(title, titleConstraint)

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setTitle(initialTitle)
        setCreating(false)
      })
    }
  }, [initialTitle, input?.kind, open])

  function handleClose() {
    titleInputRef.current?.blur()
    onOpenChange(false)
  }

  async function handleCreate() {
    if (creating || disabled || !titleLimitState.canSubmit) {
      return
    }

    setCreating(true)

    try {
      if (mode === "rename") {
        if (!documentId) {
          return
        }

        await useAppStore.getState().renameDocument(documentId, title.trim())
        handleClose()

        return
      }

      if (!input) {
        return
      }

      const nextDocumentId = await useAppStore.getState().createDocument({
        ...input,
        title: title.trim() || "Untitled document",
      })

      if (nextDocumentId) {
        handleClose()
      }
    } finally {
      setCreating(false)
    }
  }

  useCommandEnterSubmit(open && !disabled && !creating, () => {
    void handleCreate()
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (creating) {
          return
        }

        if (!nextOpen) {
          handleClose()
          return
        }

        onOpenChange(true)
      }}
    >
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <div className="px-5 pt-5 pb-4">
          <DialogHeader className="items-start gap-1 p-0">
            <DialogTitle className="text-base">
              {dialogTitle ?? (mode === "rename" ? "Rename document" : "New document")}
            </DialogTitle>
            <DialogDescription className="space-y-1">
              {dialogDescription ? (
                <span className="block text-xs text-muted-foreground">
                  {dialogDescription}
                </span>
              ) : mode === "rename" ? (
                <span className="block text-xs text-muted-foreground">
                  Update the document title.
                </span>
              ) : (
                <>
                  <span className="block text-xs text-muted-foreground">
                    {contextLabel}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Create the document first, then start editing once the server
                    write succeeds.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Input
            ref={titleInputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled document"
            className="mt-3"
            autoFocus
            maxLength={documentTitleConstraints.max}
          />
          <FieldCharacterLimit
            state={titleLimitState}
            limit={documentTitleConstraints.max}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={creating}
            onClick={handleClose}
          >
            Cancel
            <ShortcutKeys
              keys={["Esc"]}
              className="ml-1"
              keyClassName="h-[18px] min-w-0 rounded-[4px] border-line bg-surface-2 px-1 text-[10.5px] text-fg-3 shadow-none"
            />
          </Button>
          <Button
            size="sm"
            disabled={disabled || creating || !titleLimitState.canSubmit}
            onClick={() => void handleCreate()}
            className="gap-1"
          >
            {creating
              ? mode === "rename"
                ? "Renaming..."
                : "Creating..."
              : submitLabel ?? (mode === "rename" ? "Rename document" : "Create document")}
            {!creating ? (
              <ShortcutKeys
                keys={[shortcutModifierLabel, "Enter"]}
                variant="inline"
                className="ml-0.5 gap-0.5 text-background/65"
              />
            ) : null}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

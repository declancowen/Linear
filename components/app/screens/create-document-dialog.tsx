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

type CreateDocumentDialogInput =
  | { kind: "team-document"; teamId: string }
  | { kind: "workspace-document" | "private-document"; workspaceId: string }

type CreateDocumentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  input?: CreateDocumentDialogInput
  disabled: boolean
  mode?: "create" | "rename"
  documentId?: string
  initialTitle?: string
  dialogTitle?: string
  dialogDescription?: string
  submitLabel?: string
}

function getDocumentContextLabel(input: {
  dialogInput: CreateDocumentDialogInput | undefined
  teamName: string | null
}) {
  switch (input.dialogInput?.kind) {
    case "private-document":
      return "Private document"
    case "workspace-document":
      return "Workspace document"
    case "team-document":
      return input.teamName
        ? `Team document · ${input.teamName}`
        : "Team document"
    default:
      return "Team document"
  }
}

function getDocumentDialogTitle(input: {
  dialogTitle: string | undefined
  mode: "create" | "rename"
}) {
  return (
    input.dialogTitle ??
    (input.mode === "rename" ? "Rename document" : "New document")
  )
}

function getDocumentSubmitLabel(input: {
  creating: boolean
  mode: "create" | "rename"
  submitLabel: string | undefined
}) {
  if (input.creating) {
    return input.mode === "rename" ? "Renaming..." : "Creating..."
  }

  return (
    input.submitLabel ??
    (input.mode === "rename" ? "Rename document" : "Create document")
  )
}

function CreateDocumentDialogDescription({
  contextLabel,
  dialogDescription,
  mode,
}: {
  contextLabel: string
  dialogDescription: string | undefined
  mode: "create" | "rename"
}) {
  if (dialogDescription) {
    return (
      <span className="block text-xs text-muted-foreground">
        {dialogDescription}
      </span>
    )
  }

  if (mode === "rename") {
    return (
      <span className="block text-xs text-muted-foreground">
        Update the document title.
      </span>
    )
  }

  return (
    <>
      <span className="block text-xs text-muted-foreground">
        {contextLabel}
      </span>
      <span className="block text-xs text-muted-foreground">
        Create the document first, then start editing once the server write
        succeeds.
      </span>
    </>
  )
}

function CreateDocumentDialogFooter({
  creating,
  disabled,
  mode,
  shortcutModifierLabel,
  submitDisabled,
  submitLabel,
  onClose,
  onSubmit,
}: {
  creating: boolean
  disabled: boolean
  mode: "create" | "rename"
  shortcutModifierLabel: string
  submitDisabled: boolean
  submitLabel: string | undefined
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
      <Button variant="ghost" size="sm" disabled={creating} onClick={onClose}>
        Cancel
        <ShortcutKeys
          keys={["Esc"]}
          className="ml-1"
          keyClassName="h-[18px] min-w-0 rounded-[4px] border-line bg-surface-2 px-1 text-[10.5px] text-fg-3 shadow-none"
        />
      </Button>
      <Button
        size="sm"
        disabled={disabled || submitDisabled}
        onClick={onSubmit}
        className="gap-1"
      >
        {getDocumentSubmitLabel({ creating, mode, submitLabel })}
        {!creating ? (
          <ShortcutKeys
            keys={[shortcutModifierLabel, "Enter"]}
            variant="inline"
            className="ml-0.5 gap-0.5 text-background/65"
          />
        ) : null}
      </Button>
    </div>
  )
}

async function submitDocumentDialog(input: {
  dialogInput: CreateDocumentDialogInput | undefined
  documentId: string | undefined
  mode: "create" | "rename"
  title: string
  onClose: () => void
}) {
  if (input.mode === "rename") {
    if (!input.documentId) {
      return
    }

    await useAppStore
      .getState()
      .renameDocument(input.documentId, input.title.trim())
    input.onClose()
    return
  }

  if (!input.dialogInput) {
    return
  }

  const nextDocumentId = await useAppStore.getState().createDocument({
    ...input.dialogInput,
    title: input.title.trim() || "Untitled document",
  })

  if (nextDocumentId) {
    input.onClose()
  }
}

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
}: CreateDocumentDialogProps) {
  const team = useAppStore((state) =>
    input?.kind === "team-document" ? getTeam(state, input.teamId) : null
  )
  const contextLabel = getDocumentContextLabel({
    dialogInput: input,
    teamName: team?.name ?? null,
  })
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
      await submitDocumentDialog({
        dialogInput: input,
        documentId,
        mode,
        title,
        onClose: handleClose,
      })
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
              {getDocumentDialogTitle({ dialogTitle, mode })}
            </DialogTitle>
            <DialogDescription className="space-y-1">
              <CreateDocumentDialogDescription
                contextLabel={contextLabel}
                dialogDescription={dialogDescription}
                mode={mode}
              />
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

        <CreateDocumentDialogFooter
          creating={creating}
          disabled={disabled}
          mode={mode}
          shortcutModifierLabel={shortcutModifierLabel}
          submitDisabled={creating || !titleLimitState.canSubmit}
          submitLabel={submitLabel}
          onClose={handleClose}
          onSubmit={() => void handleCreate()}
        />
      </DialogContent>
    </Dialog>
  )
}

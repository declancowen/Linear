"use client"

import { useEffect, useRef, useState } from "react"

import { getTeam } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  input:
    | { kind: "team-document"; teamId: string }
    | { kind: "workspace-document" | "private-document"; workspaceId: string }
  disabled: boolean
}) {
  const team = useAppStore((state) =>
    input.kind === "team-document" ? getTeam(state, input.teamId) : null
  )
  const contextLabel =
    input.kind === "private-document"
      ? "Private document"
      : input.kind === "workspace-document"
        ? "Workspace document"
        : team
          ? `Team document · ${team.name}`
          : "Team document"
  const [title, setTitle] = useState("")
  const [creating, setCreating] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setTitle("")
        setCreating(false)
      })
    }
  }, [input.kind, open])

  function handleClose() {
    titleInputRef.current?.blur()
    onOpenChange(false)
  }

  async function handleCreate() {
    if (creating || disabled) {
      return
    }

    setCreating(true)

    try {
      const documentId = await useAppStore.getState().createDocument({
        ...input,
        title: title.trim() || "Untitled document",
      })

      if (documentId) {
        handleClose()
      }
    } finally {
      setCreating(false)
    }
  }

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
            <DialogTitle className="text-base">New document</DialogTitle>
            <DialogDescription className="space-y-1">
              <span className="block text-xs text-muted-foreground">
                {contextLabel}
              </span>
              <span className="block text-xs text-muted-foreground">
                Create the document first, then start editing once the server
                write succeeds.
              </span>
            </DialogDescription>
          </DialogHeader>
          <Input
            ref={titleInputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled document"
            className="mt-3"
            autoFocus
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
          </Button>
          <Button
            size="sm"
            disabled={disabled || creating}
            onClick={() => void handleCreate()}
          >
            {creating ? "Creating..." : "Create document"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

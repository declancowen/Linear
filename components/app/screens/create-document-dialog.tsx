"use client"

import { useEffect, useState } from "react"

import { getTeam } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setTitle("")
      })
    }
  }, [input.kind, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <div className="px-5 pt-5 pb-4">
          <DialogHeader className="items-start gap-1 p-0">
            <DialogTitle className="text-base">New document</DialogTitle>
            <p className="text-xs text-muted-foreground">{contextLabel}</p>
          </DialogHeader>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled document"
            className="mt-3"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => {
              const normalizedTitle = title.trim() || "Untitled document"
              useAppStore
                .getState()
                .createDocument({ ...input, title: normalizedTitle })
              onOpenChange(false)
            }}
          >
            Create document
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, type KeyboardEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowSquareOut,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react"

import { useAppStore } from "@/lib/store/app-store"
import { getProjectHref } from "@/lib/domain/selectors"
import { getViewHref, isSystemView } from "@/lib/domain/default-views"
import type { AppData, Project, ViewDefinition } from "@/lib/domain/types"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

function RenameDialog({
  open,
  onOpenChange,
  title,
  description,
  initialValue,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  initialValue: string
  confirmLabel: string
  onConfirm: (value: string) => Promise<boolean> | boolean
}) {
  const [value, setValue] = useState(initialValue)
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    const trimmedValue = value.trim()

    if (!trimmedValue || submitting) {
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
            <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
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
            disabled={submitting || value.trim().length === 0}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ViewContextMenu({
  view,
  editable,
  children,
}: {
  view: ViewDefinition
  editable: boolean
  children: ReactNode
}) {
  const router = useRouter()
  const currentUserId = useAppStore((state) => state.currentUserId)
  const renameView = useAppStore((state) => state.renameView)
  const deleteView = useAppStore((state) => state.deleteView)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const canMutate =
    !isSystemView(view) &&
    (view.scopeType === "personal"
      ? view.scopeId === currentUserId
      : editable)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuLabel className="truncate">{view.name}</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => router.push(getViewHref(view))}>
            <ArrowSquareOut className="size-4" />
            Open view
          </ContextMenuItem>
          {canMutate ? (
            <>
              <ContextMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  setRenameOpen(true)
                }}
              >
                <PencilSimple className="size-4" />
                Rename view
              </ContextMenuItem>
              <ContextMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault()
                  setDeleteOpen(true)
                }}
              >
                <Trash className="size-4" />
                Delete view
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
      <RenameDialog
        key={`${view.id}:${renameOpen ? "open" : "closed"}:${view.name}`}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename view"
        description="Update the saved view name."
        initialValue={view.name}
        confirmLabel="Rename"
        onConfirm={(value) => renameView(view.id, value)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${view.name}`}
        description="This saved view will be permanently removed. This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          void deleteView(view.id).then((didSucceed) => {
            if (didSucceed) {
              setDeleteOpen(false)
            }
          })
        }}
      />
    </>
  )
}

export function ProjectContextMenu({
  data,
  project,
  editable,
  children,
}: {
  data: AppData
  project: Project
  editable: boolean
  children: ReactNode
}) {
  const router = useRouter()
  const renameProject = useAppStore((state) => state.renameProject)
  const deleteProject = useAppStore((state) => state.deleteProject)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const href = getProjectHref(data, project) ?? "/workspace/projects"

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuLabel className="truncate">{project.name}</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => router.push(href)}>
            <ArrowSquareOut className="size-4" />
            Open project
          </ContextMenuItem>
          {editable ? (
            <>
              <ContextMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  setRenameOpen(true)
                }}
              >
                <PencilSimple className="size-4" />
                Rename project
              </ContextMenuItem>
              <ContextMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault()
                  setDeleteOpen(true)
                }}
              >
                <Trash className="size-4" />
                Delete project
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
      <RenameDialog
        key={`${project.id}:${renameOpen ? "open" : "closed"}:${project.name}`}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename project"
        description="Update the project name."
        initialValue={project.name}
        confirmLabel="Rename"
        onConfirm={(value) => renameProject(project.id, value)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${project.name}`}
        description="This project and its saved project views will be permanently removed. This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          void deleteProject(project.id).then((didSucceed) => {
            if (didSucceed) {
              setDeleteOpen(false)
            }
          })
        }}
      />
    </>
  )
}

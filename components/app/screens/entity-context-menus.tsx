"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useShallow } from "zustand/react/shallow"
import {
  ArrowSquareOut,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react"

import { useAppStore } from "@/lib/store/app-store"
import {
  projectNameConstraints,
  viewNameConstraints,
} from "@/lib/domain/input-constraints"
import {
  canMutateProject,
  canMutateView,
  getProjectHref,
} from "@/lib/domain/selectors"
import { getViewHref, isSystemView } from "@/lib/domain/default-views"
import type { AppData, Project, ViewDefinition } from "@/lib/domain/types"
import { selectAppDataSnapshot } from "@/components/app/screens/helpers"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { RenameDialog } from "@/components/app/screens/rename-dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
function EntityActionsContextMenu({
  canMutate,
  children,
  entityName,
  entityTypeLabel,
  onDelete,
  onOpen,
  onRename,
}: {
  canMutate: boolean
  children: ReactNode
  entityName: string
  entityTypeLabel: string
  onDelete: () => void
  onOpen: () => void
  onRename: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="truncate">{entityName}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onOpen}>
          <ArrowSquareOut className="size-4" />
          {`Open ${entityTypeLabel}`}
        </ContextMenuItem>
        {canMutate ? (
          <>
            <ContextMenuItem
              onSelect={(event) => {
                event.preventDefault()
                onRename()
              }}
            >
              <PencilSimple className="size-4" />
              {`Rename ${entityTypeLabel}`}
            </ContextMenuItem>
            <ContextMenuItem
              variant="destructive"
              onSelect={(event) => {
                event.preventDefault()
                onDelete()
              }}
            >
              <Trash className="size-4" />
              {`Delete ${entityTypeLabel}`}
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function ViewContextMenu({
  view,
  children,
}: {
  view: ViewDefinition
  children: ReactNode
}) {
  const router = useRouter()
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const renameView = useAppStore((state) => state.renameView)
  const deleteView = useAppStore((state) => state.deleteView)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isPersistedView = data.views.some((entry) => entry.id === view.id)
  const canMutate =
    isPersistedView && !isSystemView(view) && canMutateView(data, view)

  return (
    <>
      <EntityActionsContextMenu
        canMutate={canMutate}
        entityName={view.name}
        entityTypeLabel="view"
        onDelete={() => setDeleteOpen(true)}
        onOpen={() => router.push(getViewHref(view))}
        onRename={() => setRenameOpen(true)}
      >
        {children}
      </EntityActionsContextMenu>
      <RenameDialog
        key={`${view.id}:${renameOpen ? "open" : "closed"}:${view.name}`}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename view"
        description="Update the saved view name."
        initialValue={view.name}
        confirmLabel="Rename"
        minLength={viewNameConstraints.min ?? 1}
        maxLength={viewNameConstraints.max}
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
  children,
}: {
  data: AppData
  project: Project
  children: ReactNode
}) {
  const router = useRouter()
  const renameProject = useAppStore((state) => state.renameProject)
  const deleteProject = useAppStore((state) => state.deleteProject)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const href = getProjectHref(data, project) ?? "/workspace/projects"
  const canMutate = canMutateProject(data, project)

  return (
    <>
      <EntityActionsContextMenu
        canMutate={canMutate}
        entityName={project.name}
        entityTypeLabel="project"
        onDelete={() => setDeleteOpen(true)}
        onOpen={() => router.push(href)}
        onRename={() => setRenameOpen(true)}
      >
        {children}
      </EntityActionsContextMenu>
      <RenameDialog
        key={`${project.id}:${renameOpen ? "open" : "closed"}:${project.name}`}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename project"
        description="Update the project name."
        initialValue={project.name}
        confirmLabel="Rename"
        minLength={projectNameConstraints.min ?? 1}
        maxLength={projectNameConstraints.max}
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

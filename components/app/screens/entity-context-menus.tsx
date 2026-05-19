"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useShallow } from "zustand/react/shallow"
import { ArrowSquareOut, PencilSimple, Trash } from "@phosphor-icons/react"

import { useAppStore } from "@/lib/store/app-store"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
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
import {
  type AppData,
  type Project,
  type ViewDefinition,
} from "@/lib/domain/types"
import { selectAppDataSnapshot } from "@/components/app/screens/helpers"
import { CreateProjectDialog } from "@/components/app/screens/project-creation"
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
  onEdit,
  onOpen,
  onRename,
}: {
  canMutate: boolean
  children: ReactNode
  entityName: string
  entityTypeLabel: string
  onDelete: () => void
  onEdit?: () => void
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
            {onEdit ? (
              <ContextMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  onEdit()
                }}
              >
                <PencilSimple className="size-4" />
                {`Edit ${entityTypeLabel}`}
              </ContextMenuItem>
            ) : null}
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
  const editableScope =
    view.scopeType === "team" || view.scopeType === "workspace"
      ? {
          scopeType: view.scopeType,
          scopeId: view.scopeId,
        }
      : null

  return (
    <>
      <EntityActionsContextMenu
        canMutate={canMutate}
        entityName={view.name}
        entityTypeLabel="view"
        onDelete={() => setDeleteOpen(true)}
        onEdit={() =>
          openManagedCreateDialog({
            kind: "view",
            editViewId: view.id,
            defaultScopeType: editableScope?.scopeType,
            defaultScopeId: editableScope?.scopeId,
            defaultEntityKind: view.entityKind,
            defaultRoute: view.route,
            lockScope: true,
            lockEntityKind: true,
            initialConfig: {
              layout: view.layout,
              filters: view.filters,
              grouping: view.grouping,
              subGrouping: view.subGrouping,
              ordering: view.ordering,
              itemLevel: view.itemLevel ?? null,
              showChildItems: Boolean(view.showChildItems),
              displayProps: view.displayProps,
              hiddenState: view.hiddenState,
            },
          })
        }
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
  const [editOpen, setEditOpen] = useState(false)
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
        onEdit={() => setEditOpen(true)}
        onOpen={() => router.push(href)}
        onRename={() => setRenameOpen(true)}
      >
        {children}
      </EntityActionsContextMenu>
      <CreateProjectDialog
        key={`${project.id}:${editOpen ? "open" : "closed"}:${project.updatedAt ?? project.name}`}
        open={editOpen}
        onOpenChange={setEditOpen}
        defaultTeamId={project.scopeType === "team" ? project.scopeId : null}
        project={project}
      />
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

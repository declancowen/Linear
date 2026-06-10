"use client"

import { useState, type ReactNode } from "react"
import { useAppRouter } from "@/lib/browser/app-navigation"
import { useShallow } from "zustand/react/shallow"
import {
  ArrowSquareOut,
  Check,
  CircleDashed,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react"

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
import {
  getSystemViewEditCapability,
  getViewHref,
  isSystemView,
} from "@/lib/domain/default-views"
import { SystemViewDefaultsDialog } from "@/components/app/screens/system-view-defaults-dialog"
import {
  type AppData,
  type Project,
  projectStatuses,
  projectStatusMeta,
  type ProjectStatus,
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
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
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
  onSystemEdit,
  systemEditLabel,
  statusSection,
}: {
  canMutate: boolean
  children: ReactNode
  entityName: string
  entityTypeLabel: string
  onDelete: () => void
  onEdit?: () => void
  onOpen: () => void
  onRename: () => void
  onSystemEdit?: () => void
  systemEditLabel?: string
  statusSection?: ReactNode
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
        {onSystemEdit ? (
          <ContextMenuItem
            onSelect={(event) => {
              event.preventDefault()
              onSystemEdit()
            }}
          >
            <PencilSimple className="size-4" />
            {systemEditLabel ?? `Edit ${entityTypeLabel}`}
          </ContextMenuItem>
        ) : null}
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
            {statusSection}
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

function ProjectStatusContextMenuSection({
  project,
  onStatusChange,
}: {
  project: Project
  onStatusChange: (status: ProjectStatus) => void
}) {
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <CircleDashed className="size-4" />
        <span>Status</span>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-44">
        {projectStatuses.map((status) => (
          <ContextMenuItem
            key={`${project.id}-${status}`}
            onSelect={() => onStatusChange(status)}
          >
            {status === project.status ? (
              <Check className="size-4" />
            ) : (
              <span aria-hidden className="size-4" />
            )}
            <span>{projectStatusMeta[status].label}</span>
          </ContextMenuItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  )
}

function ProjectContextMenuDialogs({
  deleteOpen,
  editOpen,
  onDeleteOpenChange,
  onEditOpenChange,
  onRenameOpenChange,
  project,
  renameOpen,
}: {
  deleteOpen: boolean
  editOpen: boolean
  onDeleteOpenChange: (open: boolean) => void
  onEditOpenChange: (open: boolean) => void
  onRenameOpenChange: (open: boolean) => void
  project: Project
  renameOpen: boolean
}) {
  const renameProject = useAppStore((state) => state.renameProject)
  const deleteProject = useAppStore((state) => state.deleteProject)

  return (
    <>
      <CreateProjectDialog
        key={`${project.id}:${editOpen ? "open" : "closed"}:${project.updatedAt ?? project.name}`}
        open={editOpen}
        onOpenChange={onEditOpenChange}
        defaultTeamId={project.scopeType === "team" ? project.scopeId : null}
        project={project}
      />
      <RenameDialog
        key={`${project.id}:${renameOpen ? "open" : "closed"}:${project.name}`}
        open={renameOpen}
        onOpenChange={onRenameOpenChange}
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
        onOpenChange={onDeleteOpenChange}
        title={`Delete ${project.name}`}
        description="This project and its saved project views will be permanently removed. This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          void deleteProject(project.id).then((didSucceed) => {
            if (didSucceed) {
              onDeleteOpenChange(false)
            }
          })
        }}
      />
    </>
  )
}

export function ViewContextMenu({
  view,
  children,
}: {
  view: ViewDefinition
  children: ReactNode
}) {
  const router = useAppRouter()
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const renameView = useAppStore((state) => state.renameView)
  const deleteView = useAppStore((state) => state.deleteView)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [systemEditOpen, setSystemEditOpen] = useState(false)
  const isPersistedView = data.views.some((entry) => entry.id === view.id)
  const canMutate =
    isPersistedView && !isSystemView(view) && canMutateView(data, view)
  const systemCapability = getSystemViewEditCapability(view)
  const systemEditLabel =
    systemCapability === "full" ? "Edit view" : "Edit displayed properties"
  const editableScope =
    view.scopeType === "team" || view.scopeType === "workspace"
      ? {
          scopeType: view.scopeType,
          scopeId: view.scopeId,
        }
      : null
  const shouldLockScope = editableScope !== null

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
            lockScope: shouldLockScope,
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
        onSystemEdit={
          systemCapability === "none" ? undefined : () => setSystemEditOpen(true)
        }
        systemEditLabel={systemEditLabel}
      >
        {children}
      </EntityActionsContextMenu>
      {systemCapability === "none" ? null : (
        <SystemViewDefaultsDialog
          view={view}
          open={systemEditOpen}
          onOpenChange={setSystemEditOpen}
        />
      )}
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
  const router = useAppRouter()
  const updateProject = useAppStore((state) => state.updateProject)
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
        statusSection={
          <ProjectStatusContextMenuSection
            project={project}
            onStatusChange={(status) => updateProject(project.id, { status })}
          />
        }
      >
        {children}
      </EntityActionsContextMenu>
      <ProjectContextMenuDialogs
        deleteOpen={deleteOpen}
        editOpen={editOpen}
        onDeleteOpenChange={setDeleteOpen}
        onEditOpenChange={setEditOpen}
        onRenameOpenChange={setRenameOpen}
        project={project}
        renameOpen={renameOpen}
      />
    </>
  )
}

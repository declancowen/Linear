"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useShallow } from "zustand/react/shallow"
import { ArrowSquareOut, PencilSimple, Trash } from "@phosphor-icons/react"

import { useAppStore } from "@/lib/store/app-store"
import {
  projectNameConstraints,
  projectSummaryConstraints,
  viewNameConstraints,
} from "@/lib/domain/input-constraints"
import {
  canMutateProject,
  canMutateView,
  getProjectHref,
} from "@/lib/domain/selectors"
import { getViewHref, isSystemView } from "@/lib/domain/default-views"
import {
  priorityMeta,
  projectStatusMeta,
  type AppData,
  type DisplayProperty,
  type GroupField,
  type OrderingField,
  type Priority,
  type Project,
  type ProjectStatus,
  type ViewDefinition,
  type ViewLayout,
} from "@/lib/domain/types"
import {
  selectAppDataSnapshot,
  toggleDisplayPropertyValue,
} from "@/components/app/screens/helpers"
import { PhosphorIconPicker } from "@/components/app/phosphor-icon-picker"
import {
  getGroupFieldOptionLabel,
  PropertiesChipPopover,
} from "@/components/app/screens/work-surface-controls"
import { Button } from "@/components/ui/button"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const PROJECT_STATUS_OPTIONS: ProjectStatus[] = [
  "backlog",
  "planned",
  "in-progress",
  "completed",
  "cancelled",
]

const PRIORITY_OPTIONS: Priority[] = ["none", "low", "medium", "high", "urgent"]
const VIEW_LAYOUT_OPTIONS: ViewLayout[] = ["list", "board", "timeline"]
const VIEW_GROUP_OPTIONS: GroupField[] = [
  "project",
  "status",
  "assignee",
  "priority",
  "label",
  "team",
  "type",
  "kind",
  "createdBy",
  "updatedBy",
]
const DOCS_VIEW_GROUP_OPTIONS: GroupField[] = [
  "kind",
  "team",
  "createdBy",
  "updatedBy",
]
const VIEW_ORDERING_OPTIONS: OrderingField[] = [
  "priority",
  "updatedAt",
  "createdAt",
  "dueDate",
  "targetDate",
  "title",
]
const DOCS_VIEW_ORDERING_OPTIONS: OrderingField[] = [
  "title",
  "updatedAt",
  "createdAt",
]
const DOCS_VIEW_DISPLAY_PROPERTY_OPTIONS: DisplayProperty[] = [
  "kind",
  "team",
  "createdBy",
  "updatedBy",
  "created",
  "updated",
  "linkedProjects",
  "linkedItems",
]

const ORDERING_LABELS: Record<OrderingField, string> = {
  priority: "Priority",
  updatedAt: "Updated",
  createdAt: "Created",
  dueDate: "Due date",
  targetDate: "Target date",
  title: "Name",
}
const DOCS_DISPLAY_PROPERTY_LABELS: Partial<Record<DisplayProperty, string>> = {
  kind: "Kind",
  team: "Team",
  createdBy: "Created by",
  updatedBy: "Updated by",
  created: "Created",
  updated: "Updated",
  linkedProjects: "Linked projects",
  linkedItems: "Linked work items",
}

const EDIT_DIALOG_FIELD = "grid gap-1.5 text-[12px] font-medium text-fg-2"

function EditDialogActions({
  canSave,
  onCancel,
  onSave,
}: {
  canSave: boolean
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button disabled={!canSave} onClick={onSave}>
        Save
      </Button>
    </div>
  )
}

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

function EditProjectDialog({
  open,
  project,
  onOpenChange,
}: {
  open: boolean
  project: Project
  onOpenChange: (open: boolean) => void
}) {
  const updateProject = useAppStore((state) => state.updateProject)
  const [name, setName] = useState(project.name)
  const [icon, setIcon] = useState(project.icon ?? "FolderSimple")
  const [summary, setSummary] = useState(project.summary)
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [priority, setPriority] = useState<Priority>(project.priority)
  const trimmedName = name.trim()
  const trimmedSummary = summary.trim()
  const canSave =
    trimmedName.length >= (projectNameConstraints.min ?? 1) &&
    trimmedName.length <= projectNameConstraints.max &&
    trimmedSummary.length <= projectSummaryConstraints.max

  function handleSave() {
    if (!canSave) {
      return
    }

    updateProject(project.id, {
      name: trimmedName,
      icon,
      summary: trimmedSummary,
      status,
      priority,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            Update the project identity and planning defaults.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className={EDIT_DIALOG_FIELD}>
            <Label htmlFor="project-edit-name">Name</Label>
            <div className="flex gap-2">
              <PhosphorIconPicker value={icon} onValueChange={setIcon} />
              <Input
                id="project-edit-name"
                value={name}
                maxLength={projectNameConstraints.max}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>
          <div className={EDIT_DIALOG_FIELD}>
            <Label htmlFor="project-edit-summary">Summary</Label>
            <Textarea
              id="project-edit-summary"
              value={summary}
              maxLength={projectSummaryConstraints.max}
              rows={3}
              onChange={(event) => setSummary(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={EDIT_DIALOG_FIELD}>
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as ProjectStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {projectStatusMeta[option].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={EDIT_DIALOG_FIELD}>
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as Priority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {priorityMeta[option].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <EditDialogActions
            canSave={canSave}
            onCancel={() => onOpenChange(false)}
            onSave={handleSave}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditViewDialog({
  open,
  view,
  onOpenChange,
}: {
  open: boolean
  view: ViewDefinition
  onOpenChange: (open: boolean) => void
}) {
  const renameView = useAppStore((state) => state.renameView)
  const updateViewConfig = useAppStore((state) => state.updateViewConfig)
  const reorderViewDisplayProperties = useAppStore(
    (state) => state.reorderViewDisplayProperties
  )
  const [name, setName] = useState(view.name)
  const [layout, setLayout] = useState<ViewLayout>(view.layout)
  const [grouping, setGrouping] = useState<GroupField>(view.grouping)
  const [ordering, setOrdering] = useState<OrderingField>(view.ordering)
  const [displayProps, setDisplayProps] = useState<DisplayProperty[]>([
    ...view.displayProps,
  ])
  const layoutOptions: ViewLayout[] =
    view.entityKind === "docs" ? ["list", "board"] : VIEW_LAYOUT_OPTIONS
  const groupOptions =
    view.entityKind === "docs" ? DOCS_VIEW_GROUP_OPTIONS : VIEW_GROUP_OPTIONS
  const orderingOptions =
    view.entityKind === "docs"
      ? DOCS_VIEW_ORDERING_OPTIONS
      : VIEW_ORDERING_OPTIONS
  const displayPropertyOptions =
    view.entityKind === "docs" ? DOCS_VIEW_DISPLAY_PROPERTY_OPTIONS : undefined
  const trimmedName = name.trim()
  const canSave =
    trimmedName.length >= (viewNameConstraints.min ?? 1) &&
    trimmedName.length <= viewNameConstraints.max
  const draftView = useMemo<ViewDefinition>(
    () => ({
      ...view,
      name: trimmedName || view.name,
      layout,
      grouping,
      ordering,
      displayProps,
    }),
    [displayProps, grouping, layout, ordering, trimmedName, view]
  )

  function toggleDraftDisplayProperty(property: DisplayProperty) {
    setDisplayProps((current) => toggleDisplayPropertyValue(current, property))
  }

  async function handleSave() {
    if (!canSave) {
      return
    }

    if (trimmedName !== view.name) {
      await renameView(view.id, trimmedName)
    }

    updateViewConfig(view.id, {
      layout,
      grouping,
      ordering,
    })

    if (JSON.stringify(displayProps) !== JSON.stringify(view.displayProps)) {
      reorderViewDisplayProperties(view.id, displayProps)
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Edit view</DialogTitle>
          <DialogDescription>
            Update the saved view configuration for this surface.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className={EDIT_DIALOG_FIELD}>
            <Label htmlFor="view-edit-name">Name</Label>
            <Input
              id="view-edit-name"
              value={name}
              maxLength={viewNameConstraints.max}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={EDIT_DIALOG_FIELD}>
              <Label>Layout</Label>
              <Select
                value={layout}
                onValueChange={(value) => setLayout(value as ViewLayout)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {layoutOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option[0].toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={EDIT_DIALOG_FIELD}>
              <Label>Group</Label>
              <Select
                value={grouping}
                onValueChange={(value) => setGrouping(value as GroupField)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groupOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {getGroupFieldOptionLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={EDIT_DIALOG_FIELD}>
              <Label>Sort</Label>
              <Select
                value={ordering}
                onValueChange={(value) => setOrdering(value as OrderingField)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orderingOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {ORDERING_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className={EDIT_DIALOG_FIELD}>
            <Label>Display properties</Label>
            <div>
              <PropertiesChipPopover
                view={draftView}
                tone="default"
                propertyOptions={displayPropertyOptions}
                getPropertyLabel={
                  view.entityKind === "docs"
                    ? (property) =>
                        DOCS_DISPLAY_PROPERTY_LABELS[property] ?? "Property"
                    : undefined
                }
                onToggleDisplayProperty={toggleDraftDisplayProperty}
                onReorderDisplayProperties={setDisplayProps}
                onClearDisplayProperties={() => setDisplayProps([])}
              />
            </div>
          </div>
          <EditDialogActions
            canSave={canSave}
            onCancel={() => onOpenChange(false)}
            onSave={handleSave}
          />
        </div>
      </DialogContent>
    </Dialog>
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
  const [editOpen, setEditOpen] = useState(false)
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
        onEdit={() => setEditOpen(true)}
        onOpen={() => router.push(getViewHref(view))}
        onRename={() => setRenameOpen(true)}
      >
        {children}
      </EntityActionsContextMenu>
      <EditViewDialog
        key={`${view.id}:${editOpen ? "open" : "closed"}:${view.updatedAt ?? view.name}`}
        open={editOpen}
        view={view}
        onOpenChange={setEditOpen}
      />
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
      <EditProjectDialog
        key={`${project.id}:${editOpen ? "open" : "closed"}:${project.updatedAt ?? project.name}`}
        open={editOpen}
        project={project}
        onOpenChange={setEditOpen}
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

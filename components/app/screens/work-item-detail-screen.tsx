"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useShallow } from "zustand/react/shallow"
import {
  CaretDown,
  CaretRight,
  DotsThree,
  Plus,
  SidebarSimple,
  Trash,
} from "@phosphor-icons/react"

import {
  canEditTeam,
  getDocument,
  getStatusOrderForTeam,
  getTeam,
  getTeamMembers,
  getUser,
  getWorkItem,
  getWorkItemDescendantIds,
  getWorkItemHierarchyIds,
  sortItems,
} from "@/lib/domain/selectors"
import {
  getAllowedChildWorkItemTypesForItem,
  getChildWorkItemCopy,
  getDisplayLabelForWorkItemType,
  getWorkSurfaceCopy,
  priorityMeta,
  type Priority,
  type WorkItem,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CollapsibleRightSidebar } from "@/components/ui/collapsible-right-sidebar"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

import { getEligibleParentWorkItems, getTeamProjectOptions, selectAppDataSnapshot } from "./helpers"
import {
  CollapsibleSection,
  MissingState,
  PriorityDot,
  PropertyDateField,
  PropertyRow,
  PropertySelect,
  StatusIcon,
  WorkItemLabelsEditor,
  buildPropertyStatusOptions,
} from "./shared"
import {
  CommentsInline,
  InlineChildIssueComposer,
  WorkItemTypeBadge,
} from "./work-item-ui"
import { cn } from "@/lib/utils"

export function WorkItemDetailScreen({ itemId }: { itemId: string }) {
  const router = useRouter()
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const item = data.workItems.find((entry) => entry.id === itemId)
  const [deletingItem, setDeletingItem] = useState(false)
  const [projectConfirmOpen, setProjectConfirmOpen] = useState(false)
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [childComposerOpen, setChildComposerOpen] = useState(false)
  const [subIssuesOpen, setSubIssuesOpen] = useState(true)
  const [propertiesOpen, setPropertiesOpen] = useState(true)

  if (!item) {
    if (deletingItem) {
      return null
    }

    return <MissingState title="Work item not found" />
  }

  const currentItem = item
  const team = getTeam(data, currentItem.teamId)
  const workCopy = getWorkSurfaceCopy(team?.settings.experience)
  const editable = team ? canEditTeam(data, team.id) : false
  const description = getDocument(data, currentItem.descriptionDocId)
  const statusOptions = buildPropertyStatusOptions(getStatusOrderForTeam(team))
  const teamMembers = team ? getTeamMembers(data, team.id) : []
  const teamProjects = getTeamProjectOptions(
    data,
    team?.id,
    currentItem.primaryProjectId
  )
  const parentItem = currentItem.parentId
    ? getWorkItem(data, currentItem.parentId)
    : null
  const childItems = sortItems(
    data.workItems.filter((entry) => entry.parentId === currentItem.id),
    "priority"
  )
  const parentOptions = [
    { value: "none", label: "No parent" },
    ...getEligibleParentWorkItems(data, currentItem).map((candidate) => ({
      value: candidate.id,
      label: `${candidate.key} · ${candidate.title}`,
    })),
  ]
  const allowedChildTypes = getAllowedChildWorkItemTypesForItem(currentItem)
  const childCopy = getChildWorkItemCopy(
    currentItem.type,
    team?.settings.experience
  )
  const canCreateChildItem = editable && allowedChildTypes.length > 0
  const descendantCount = getWorkItemDescendantIds(data, currentItem.id).size
  const hierarchySize = getWorkItemHierarchyIds(data, currentItem.id).size
  const itemLabel = getDisplayLabelForWorkItemType(
    currentItem.type,
    team?.settings.experience
  ).toLowerCase()
  const cascadeMessage =
    descendantCount > 0
      ? `Delete this ${itemLabel} and ${descendantCount} nested item${
          descendantCount === 1 ? "" : "s"
        }?`
      : `Delete this ${itemLabel}?`
  const completedChildItems = childItems.filter(
    (child) => child.status === "done"
  ).length
  const showSubIssuesSection =
    childItems.length > 0 || allowedChildTypes.length > 0
  const displayedEndDate = currentItem.targetDate ?? currentItem.dueDate

  function buildEndDatePatch(nextEndDate: string | null) {
    return {
      dueDate: currentItem.dueDate ? nextEndDate : undefined,
      targetDate:
        currentItem.targetDate || !currentItem.dueDate
          ? nextEndDate
          : undefined,
    }
  }

  function handleStartDateChange(nextStartDate: string | null) {
    const patch: {
      startDate?: string | null
      dueDate?: string | null
      targetDate?: string | null
    } = {
      startDate: nextStartDate,
    }

    if (
      nextStartDate &&
      displayedEndDate &&
      new Date(nextStartDate).getTime() > new Date(displayedEndDate).getTime()
    ) {
      Object.assign(patch, buildEndDatePatch(nextStartDate))
    }

    useAppStore.getState().updateWorkItem(currentItem.id, patch)
  }

  function handleProjectChange(value: string) {
    const nextProjectId = value === "none" ? null : value

    if (nextProjectId === currentItem.primaryProjectId) {
      return
    }

    if (hierarchySize > 1) {
      setPendingProjectId(nextProjectId)
      setProjectConfirmOpen(true)
      return
    }

    useAppStore.getState().updateWorkItem(currentItem.id, {
      primaryProjectId: nextProjectId,
    })
  }

  function handleEndDateChange(nextEndDate: string | null) {
    const patch: {
      startDate?: string | null
      dueDate?: string | null
      targetDate?: string | null
    } = buildEndDatePatch(nextEndDate)

    if (
      nextEndDate &&
      currentItem.startDate &&
      new Date(nextEndDate).getTime() <
        new Date(currentItem.startDate).getTime()
    ) {
      patch.startDate = nextEndDate
    }

    useAppStore.getState().updateWorkItem(currentItem.id, patch)
  }

  async function handleDeleteItem() {
    setDeletingItem(true)

    const deleted = await useAppStore.getState().deleteWorkItem(currentItem.id)

    if (!deleted) {
      setDeletingItem(false)
      return
    }

    setDeleteDialogOpen(false)
    router.replace(team?.slug ? `/team/${team.slug}/work` : "/inbox")
  }

  function handleProjectConfirmOpenChange(open: boolean) {
    setProjectConfirmOpen(open)

    if (!open) {
      setPendingProjectId(null)
    }
  }

  function handleConfirmProjectChange() {
    useAppStore.getState().updateWorkItem(currentItem.id, {
      primaryProjectId: pendingProjectId,
    })
    setProjectConfirmOpen(false)
    setPendingProjectId(null)
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <div className="flex min-h-10 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <SidebarTrigger className="size-5 shrink-0" />
            <Link
              href={`/team/${team?.slug}/work`}
              className="text-muted-foreground hover:text-foreground"
            >
              {team?.name}
            </Link>
            <CaretRight className="size-3 text-muted-foreground" />
            <span>
              {currentItem.key} {currentItem.title}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {editable ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={deletingItem}
                  >
                    <DotsThree className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 min-w-44">
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={deletingItem}
                    onSelect={(event) => {
                      event.preventDefault()
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Trash className="size-4" />
                    Delete{" "}
                    {getDisplayLabelForWorkItemType(
                      currentItem.type,
                      team?.settings.experience
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Button
              size="icon-sm"
              variant="ghost"
              className={cn(!propertiesOpen && "text-muted-foreground")}
              onClick={() => setPropertiesOpen((current) => !current)}
            >
              <SidebarSimple className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-8 py-8">
              {parentItem ? (
                <Link
                  href={`/items/${parentItem.id}`}
                  className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span>{workCopy.parentLabel}</span>
                  <Badge variant="outline">{parentItem.key}</Badge>
                  <span className="truncate">{parentItem.title}</span>
                </Link>
              ) : null}
              <h1 className="mb-1 text-2xl font-semibold">
                {currentItem.title}
              </h1>
              <div className="mb-4">
                <WorkItemTypeBadge data={data} item={currentItem} />
              </div>

              <div className="mt-4">
                <RichTextEditor
                  content={description?.content ?? "<p>Add a description…</p>"}
                  editable={editable}
                  placeholder="Add a description…"
                  mentionCandidates={
                    team ? getTeamMembers(data, team.id) : data.users
                  }
                  onChange={(content) =>
                    useAppStore
                      .getState()
                      .updateItemDescription(currentItem.id, content)
                  }
                  onUploadAttachment={(file) =>
                    useAppStore
                      .getState()
                      .uploadAttachment("workItem", currentItem.id, file)
                  }
                />
              </div>

              {showSubIssuesSection ? (
                <div className="mt-8">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setSubIssuesOpen((current) => !current)}
                    >
                      {subIssuesOpen ? (
                        <CaretDown className="size-3" />
                      ) : (
                        <CaretRight className="size-3" />
                      )}
                      <span>{childCopy.childPluralLabel}</span>
                      <span className="text-xs font-normal tabular-nums">
                        {completedChildItems}/{childItems.length}
                      </span>
                    </button>
                    {canCreateChildItem ? (
                      <Button
                        size="icon-sm"
                        variant={childComposerOpen ? "outline" : "ghost"}
                        disabled={!canCreateChildItem}
                        onClick={() => {
                          setSubIssuesOpen(true)
                          setChildComposerOpen((current) => !current)
                        }}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>

                  {childItems.length > 0 ? (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{
                          width: `${childItems.length > 0 ? (completedChildItems / childItems.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  ) : null}

                  {subIssuesOpen ? (
                    <div className="mt-3 flex flex-col rounded-lg border">
                      {childItems.map((child, index) => (
                        <Link
                          key={child.id}
                          href={`/items/${child.id}`}
                          className={cn(
                            "group/sub flex items-center gap-3 px-3 py-2 transition-colors hover:bg-accent/40",
                            index !== childItems.length - 1 && "border-b"
                          )}
                        >
                          <StatusIcon status={child.status} />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {child.title}
                          </span>
                          <WorkItemTypeBadge data={data} item={child} />
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {child.key}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {priorityMeta[child.priority].label}
                          </span>
                          {child.assigneeId ? (
                            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] text-muted-foreground">
                              {getUser(data, child.assigneeId)?.avatarUrl ??
                                "?"}
                            </div>
                          ) : null}
                        </Link>
                      ))}

                      {childComposerOpen ? (
                        <div className="border-t">
                          <InlineChildIssueComposer
                            teamId={currentItem.teamId}
                            parentItem={currentItem}
                            disabled={!editable}
                            onCancel={() => setChildComposerOpen(false)}
                            onCreated={() => setChildComposerOpen(false)}
                          />
                        </div>
                      ) : canCreateChildItem ? (
                        <button
                          type="button"
                          className={cn(
                            "inline-flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground",
                            childItems.length > 0 && "border-t"
                          )}
                          onClick={() => setChildComposerOpen(true)}
                        >
                          <Plus className="size-3" />
                          <span>{childCopy.addChildLabel}</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Separator className="my-6" />

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Activity</h3>
                </div>
                <CommentsInline
                  targetType="workItem"
                  targetId={currentItem.id}
                  editable={editable}
                />
              </div>
            </div>
          </div>

          <CollapsibleRightSidebar open={propertiesOpen} width="18rem">
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col p-4">
                <CollapsibleSection title="Properties" defaultOpen>
                  <PropertyRow
                    label="Type"
                    value={getDisplayLabelForWorkItemType(
                      currentItem.type,
                      team?.settings.experience
                    )}
                  />
                  <PropertySelect
                    label="Status"
                    value={currentItem.status}
                    disabled={!editable}
                    options={statusOptions}
                    renderValue={(value, label) => (
                      <div className="flex min-w-0 items-center gap-2">
                        <StatusIcon status={value} />
                        <span className="truncate">{label}</span>
                      </div>
                    )}
                    renderOption={(value, label) => (
                      <div className="flex items-center gap-2">
                        <StatusIcon status={value} />
                        <span>{label}</span>
                      </div>
                    )}
                    onValueChange={(value) =>
                      useAppStore.getState().updateWorkItem(currentItem.id, {
                        status: value as WorkItem["status"],
                      })
                    }
                  />
                  <PropertySelect
                    label="Priority"
                    value={currentItem.priority}
                    disabled={!editable}
                    options={Object.entries(priorityMeta).map(
                      ([value, meta]) => ({
                        value,
                        label: meta.label,
                      })
                    )}
                    renderValue={(value, label) => (
                      <div className="flex min-w-0 items-center gap-2">
                        <PriorityDot priority={value} />
                        <span className="truncate">{label}</span>
                      </div>
                    )}
                    renderOption={(value, label) => (
                      <div className="flex items-center gap-2">
                        <PriorityDot priority={value} />
                        <span>{label}</span>
                      </div>
                    )}
                    onValueChange={(value) =>
                      useAppStore.getState().updateWorkItem(currentItem.id, {
                        priority: value as Priority,
                      })
                    }
                  />
                  <PropertySelect
                    label="Assignee"
                    value={currentItem.assigneeId ?? "unassigned"}
                    disabled={!editable}
                    options={[
                      { value: "unassigned", label: "Assign" },
                      ...teamMembers.map((user) => ({
                        value: user.id,
                        label: user.name,
                      })),
                    ]}
                    onValueChange={(value) =>
                      useAppStore.getState().updateWorkItem(currentItem.id, {
                        assigneeId: value === "unassigned" ? null : value,
                      })
                    }
                  />
                  <PropertySelect
                    label="Parent"
                    value={currentItem.parentId ?? "none"}
                    disabled={
                      !editable ||
                      (parentOptions.length === 1 && !currentItem.parentId)
                    }
                    options={parentOptions}
                    onValueChange={(value) =>
                      useAppStore.getState().updateWorkItem(currentItem.id, {
                        parentId: value === "none" ? null : value,
                      })
                    }
                  />
                </CollapsibleSection>

                <Separator className="my-3" />

                <CollapsibleSection title="Schedule" defaultOpen>
                  <PropertyDateField
                    label="Start date"
                    value={currentItem.startDate}
                    disabled={!editable}
                    onValueChange={handleStartDateChange}
                  />
                  <PropertyDateField
                    label="End date"
                    value={displayedEndDate}
                    disabled={!editable}
                    onValueChange={handleEndDateChange}
                  />
                </CollapsibleSection>

                <Separator className="my-3" />

                <CollapsibleSection title="Labels" defaultOpen>
                  <WorkItemLabelsEditor
                    item={currentItem}
                    editable={editable}
                  />
                </CollapsibleSection>

                <Separator className="my-3" />

                <CollapsibleSection title="Project" defaultOpen>
                  <PropertySelect
                    label=""
                    value={currentItem.primaryProjectId ?? "none"}
                    disabled={!editable}
                    options={[
                      { value: "none", label: "No project" },
                      ...teamProjects.map((project) => ({
                        value: project.id,
                        label: project.name,
                      })),
                    ]}
                    onValueChange={handleProjectChange}
                  />
                </CollapsibleSection>
              </div>
            </div>
          </CollapsibleRightSidebar>
        </div>
      </div>
      <ConfirmDialog
        open={projectConfirmOpen}
        onOpenChange={handleProjectConfirmOpenChange}
        title="Update project for hierarchy"
        description="Changing the project for this item will also update all parent and child items in this hierarchy."
        confirmLabel="Update"
        variant="default"
        onConfirm={handleConfirmProjectChange}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete item"
        description={`${cascadeMessage} This can't be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deletingItem}
        onConfirm={() => void handleDeleteItem()}
      />
    </>
  )
}

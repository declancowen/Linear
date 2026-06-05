"use client"

import { useRef, useState } from "react"
import { Check, PencilSimple, Plus, Tag } from "@phosphor-icons/react"

import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { labelNameConstraints } from "@/lib/domain/input-constraints"
import type { AppData, WorkItem } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  detailChipClassName,
  renderDetailSidebarTerm,
  renderDetailSidebarValueButton,
} from "@/components/app/screens/detail-sidebar-primitives"
import {
  LabelColorDot,
  useWorkItemLabelEditorState,
} from "@/components/app/screens/shared"
import { useWorkItemSurfacePortalContainer } from "@/components/app/screens/work-item-surface-portal-context"

export function DetailSidebarLabelsRow({
  item,
  workspaceId,
  labels,
  editable,
}: {
  item: WorkItem
  workspaceId: string | null | undefined
  labels: AppData["labels"]
  editable: boolean
}) {
  const portalContainer = useWorkItemSurfacePortalContainer()
  const {
    availableLabels = labels,
    handleCreateLabel,
    labelNameLimitState,
    newLabelName,
    selectedLabels,
    setNewLabelName,
    toggleLabel,
  } = useWorkItemLabelEditorState({
    item,
    labels,
    requireTrimmedName: true,
    requireWorkspace: true,
    workspaceId,
  })
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const skipRenameCommitRef = useRef(false)

  function startRename(label: AppData["labels"][number]) {
    skipRenameCommitRef.current = false
    setRenameDraft(label.name)
    setRenamingId(label.id)
  }

  function cancelRename() {
    skipRenameCommitRef.current = true
    setRenamingId(null)
  }

  async function commitRename(labelId: string) {
    if (skipRenameCommitRef.current) {
      skipRenameCommitRef.current = false
      return
    }

    setRenamingId(null)
    await useAppStore.getState().updateLabel(labelId, renameDraft)
  }

  return (
    <>
      {renderDetailSidebarTerm("Labels", <Tag className="size-[13px]" />)}
      <dd className="m-0">
        <Popover>
          <PopoverTrigger asChild>
            {renderDetailSidebarValueButton({
              disabled: !editable,
              label: "Manage labels",
              children: (
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {selectedLabels.length > 0 ? (
                    selectedLabels.map((label) => (
                      <span key={label.id} className={detailChipClassName}>
                        <LabelColorDot
                          color={label.color}
                          className="size-1.5"
                        />
                        <span>{label.name}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-fg-4">No labels</span>
                  )}
                  {editable ? (
                    <span
                      className={cn(
                        detailChipClassName,
                        "border-dashed bg-transparent text-fg-3"
                      )}
                    >
                      <Plus className="size-3" />
                    </span>
                  ) : null}
                </span>
              ),
            })}
          </PopoverTrigger>
          <PopoverContent
            align="end"
            portalContainer={portalContainer}
            className="w-72 overflow-hidden rounded-xl border border-line bg-surface p-0 shadow-lg"
          >
            <div className="border-b border-line-soft px-3 py-2 text-[11px] font-semibold tracking-[0.06em] text-fg-3 uppercase">
              Labels
            </div>
            <div className="no-scrollbar max-h-56 overflow-y-auto p-1.5">
              {availableLabels.length > 0 ? (
                availableLabels.map((label) => {
                  const selected = item.labelIds.includes(label.id)

                  if (renamingId === label.id) {
                    return (
                      <div
                        key={label.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5"
                      >
                        <LabelColorDot
                          color={label.color}
                          className="size-2 shrink-0"
                        />
                        <input
                          autoFocus
                          value={renameDraft}
                          maxLength={labelNameConstraints.max}
                          onChange={(event) =>
                            setRenameDraft(event.target.value)
                          }
                          onBlur={() => void commitRename(label.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              event.currentTarget.blur()
                            } else if (event.key === "Escape") {
                              event.preventDefault()
                              cancelRename()
                            }
                          }}
                          className="h-5 min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none"
                        />
                      </div>
                    )
                  }

                  return (
                    <div
                      key={label.id}
                      className="group/label flex items-center rounded-md transition-colors hover:bg-surface-3"
                    >
                      <button
                        type="button"
                        disabled={!editable}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[13px] text-fg-2 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60",
                          selected && "text-foreground"
                        )}
                        onClick={() => toggleLabel(label.id)}
                      >
                        <LabelColorDot
                          color={label.color}
                          className="size-2 shrink-0"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {label.name}
                        </span>
                        {selected ? (
                          <Check className="size-3.5 shrink-0 text-foreground" />
                        ) : null}
                      </button>
                      {editable ? (
                        <button
                          type="button"
                          aria-label={`Rename ${label.name}`}
                          title="Rename label"
                          className="mr-1 inline-grid size-6 shrink-0 place-items-center rounded-md text-fg-3 opacity-0 transition-opacity hover:bg-surface-2 hover:text-foreground focus-visible:opacity-100 group-hover/label:opacity-100"
                          onClick={() => startRename(label)}
                        >
                          <PencilSimple className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  )
                })
              ) : (
                <div className="px-2 py-6 text-center text-[12.5px] text-fg-4">
                  No labels yet
                </div>
              )}
            </div>

            <div className="border-t border-line-soft p-1.5">
              <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors focus-within:bg-surface-3">
                <Plus className="size-3.5 shrink-0 text-fg-3" />
                <input
                  value={newLabelName}
                  onChange={(event) => setNewLabelName(event.target.value)}
                  placeholder="Create new label"
                  maxLength={labelNameConstraints.max}
                  disabled={!editable || !workspaceId}
                  className="h-5 min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-fg-4 disabled:cursor-not-allowed"
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return
                    }

                    event.preventDefault()

                    if (
                      newLabelName.trim().length > 0 &&
                      labelNameLimitState.canSubmit
                    ) {
                      void handleCreateLabel()
                    }
                  }}
                />
                {newLabelName.trim().length > 0 ? (
                  <button
                    type="button"
                    disabled={
                      !editable ||
                      !workspaceId ||
                      !labelNameLimitState.canSubmit
                    }
                    className="shrink-0 text-[11px] font-medium text-fg-2 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void handleCreateLabel()}
                  >
                    Add
                  </button>
                ) : null}
              </div>
              {newLabelName.length > 0 ? (
                <FieldCharacterLimit
                  state={labelNameLimitState}
                  limit={labelNameConstraints.max}
                  className="mt-0 px-2"
                />
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </dd>
    </>
  )
}

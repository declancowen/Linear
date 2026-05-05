"use client"

import { Plus, Tag } from "@phosphor-icons/react"

import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { labelNameConstraints } from "@/lib/domain/input-constraints"
import type { AppData, WorkItem } from "@/lib/domain/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const {
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
            className="w-72 rounded-lg border border-line bg-surface p-3 shadow-lg"
          >
            <div className="flex flex-col gap-3">
              <div className="space-y-1">
                <div className="text-[11.5px] font-semibold tracking-[0.05em] text-fg-3 uppercase">
                  Labels
                </div>
                <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                  {labels.length > 0 ? (
                    labels.map((label) => {
                      const selected = item.labelIds.includes(label.id)

                      return (
                        <button
                          key={label.id}
                          type="button"
                          disabled={!editable}
                          className={cn(
                            detailChipClassName,
                            selected &&
                              "border-transparent bg-accent-bg text-accent-fg"
                          )}
                          onClick={() => toggleLabel(label.id)}
                        >
                          <LabelColorDot
                            color={label.color}
                            className="size-1.5"
                          />
                          <span>{label.name}</span>
                        </button>
                      )
                    })
                  ) : (
                    <span className="text-[12.5px] text-fg-4">
                      No labels yet
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11.5px] font-semibold tracking-[0.05em] text-fg-3 uppercase">
                  New label
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newLabelName}
                    onChange={(event) => setNewLabelName(event.target.value)}
                    placeholder="Add label"
                    maxLength={labelNameConstraints.max}
                    disabled={!editable || !workspaceId}
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    disabled={
                      !editable ||
                      !workspaceId ||
                      newLabelName.trim().length === 0 ||
                      !labelNameLimitState.canSubmit
                    }
                    onClick={() => void handleCreateLabel()}
                  >
                    Create
                  </Button>
                </div>
                {newLabelName.length > 0 ? (
                  <FieldCharacterLimit
                    state={labelNameLimitState}
                    limit={labelNameConstraints.max}
                    className="mt-0"
                  />
                ) : null}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </dd>
    </>
  )
}

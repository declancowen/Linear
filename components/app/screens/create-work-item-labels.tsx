"use client"

import { type Dispatch, type SetStateAction } from "react"
import { Plus } from "@phosphor-icons/react"

import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import {
  getTextInputLimitState,
  labelNameConstraints,
} from "@/lib/domain/input-constraints"
import type { Team } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

type TextLimitState = ReturnType<typeof getTextInputLimitState>

export function NewLabelInput({
  creatingLabel,
  labelNameLimitState,
  newLabelName,
  team,
  onCreateLabel,
  onNewLabelNameChange,
}: {
  creatingLabel: boolean
  labelNameLimitState: TextLimitState
  newLabelName: string
  team: Team | null
  onCreateLabel: () => void
  onNewLabelNameChange: (name: string) => void
}) {
  const trimmedNewLabelName = newLabelName.trim()

  return (
    <>
      <div className="mt-1 flex items-center gap-2 border-t border-line-soft px-2.5 pt-2 pb-1 text-fg-3">
        <Plus className="size-[14px] shrink-0" />
        <input
          value={newLabelName}
          onChange={(event) => onNewLabelNameChange(event.target.value)}
          maxLength={labelNameConstraints.max}
          placeholder="Create new label"
          className="h-5 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none placeholder:text-fg-4"
          onKeyDown={(event) => {
            if (event.key !== "Enter") {
              return
            }
            event.preventDefault()
            onCreateLabel()
          }}
          disabled={!team || creatingLabel}
        />
        {trimmedNewLabelName.length > 0 ? (
          <button
            type="button"
            className="text-[11px] font-medium text-fg-2 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!team || creatingLabel || !labelNameLimitState.canSubmit}
            onClick={onCreateLabel}
          >
            Add
          </button>
        ) : null}
      </div>
      {newLabelName.length > 0 ? (
        <FieldCharacterLimit
          state={labelNameLimitState}
          limit={labelNameConstraints.max}
          className="mt-0 border-t border-line-soft px-2.5 pt-2"
        />
      ) : null}
    </>
  )
}

export async function createLabelAndSelect({
  newLabelName,
  creatingLabel,
  canSubmit,
  workspaceId,
  setCreatingLabel,
  setNewLabelName,
  setSelectedLabelIds,
}: {
  newLabelName: string
  creatingLabel: boolean
  canSubmit: boolean
  workspaceId: string | null
  setCreatingLabel: Dispatch<SetStateAction<boolean>>
  setNewLabelName: Dispatch<SetStateAction<string>>
  setSelectedLabelIds: Dispatch<SetStateAction<string[]>>
}) {
  const normalizedName = newLabelName.trim()

  if (!normalizedName || creatingLabel || !canSubmit) {
    return
  }

  setCreatingLabel(true)
  const created = await useAppStore
    .getState()
    .createLabel(normalizedName, workspaceId)
  setCreatingLabel(false)

  if (!created) {
    return
  }

  setNewLabelName("")
  setSelectedLabelIds((current) =>
    current.includes(created.id) ? current : [...current, created.id]
  )
}

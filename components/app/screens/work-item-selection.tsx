"use client"

import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react"
import { Check } from "@phosphor-icons/react"

import { getWorkItem } from "@/lib/domain/selectors"
import type { AppData, WorkItem } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids))
}

function getVisibleSelectedIds(selectedIds: Set<string>, visibleItemIds: string[]) {
  const visibleIds = new Set(visibleItemIds)

  return Array.from(selectedIds).filter((id) => visibleIds.has(id))
}

function getSelectionRange(
  visibleItemIds: string[],
  anchorId: string,
  itemId: string
) {
  const anchorIndex = visibleItemIds.indexOf(anchorId)
  const itemIndex = visibleItemIds.indexOf(itemId)

  if (anchorIndex === -1 || itemIndex === -1) {
    return [itemId]
  }

  const start = Math.min(anchorIndex, itemIndex)
  const end = Math.max(anchorIndex, itemIndex)

  return visibleItemIds.slice(start, end + 1)
}

export function useWorkItemSelection(visibleItemIds: string[]) {
  const orderedVisibleItemIds = useMemo(
    () => uniqueIds(visibleItemIds),
    [visibleItemIds]
  )
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set()
  )
  const [anchorItemId, setAnchorItemId] = useState<string | null>(null)

  const getContextItemIds = useCallback(
    (itemId: string) => {
      const selectedVisibleIds = getVisibleSelectedIds(
        selectedItemIds,
        orderedVisibleItemIds
      )

      return selectedVisibleIds.includes(itemId) && selectedVisibleIds.length > 0
        ? selectedVisibleIds
        : [itemId]
    },
    [orderedVisibleItemIds, selectedItemIds]
  )

  const setSingleSelection = useCallback((itemId: string) => {
    setAnchorItemId(itemId)
    setSelectedItemIds(new Set([itemId]))
  }, [])

  const toggleItem = useCallback((itemId: string, checked?: boolean) => {
    setAnchorItemId(itemId)
    setSelectedItemIds((current) => {
      const next = new Set(current)
      const shouldSelect = checked ?? !next.has(itemId)

      if (shouldSelect) {
        next.add(itemId)
      } else {
        next.delete(itemId)
      }

      return next
    })
  }, [])

  const selectRange = useCallback(
    (itemId: string) => {
      const anchorId = anchorItemId ?? itemId
      const rangeIds = getSelectionRange(orderedVisibleItemIds, anchorId, itemId)

      setSelectedItemIds((current) => new Set([...current, ...rangeIds]))
    },
    [anchorItemId, orderedVisibleItemIds]
  )

  const handleModifiedClick = useCallback(
    (itemId: string, event: MouseEvent) => {
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (event.shiftKey) {
        selectRange(itemId)
        return
      }

      toggleItem(itemId)
    },
    [selectRange, toggleItem]
  )

  const handleCheckboxChange = useCallback(
    (itemId: string, event: ChangeEvent<HTMLInputElement>) => {
      event.stopPropagation()
      toggleItem(itemId, event.currentTarget.checked)
    },
    [toggleItem]
  )

  const handleContextMenu = useCallback(
    (itemId: string) => {
      if (!selectedItemIds.has(itemId)) {
        setSingleSelection(itemId)
      }
    },
    [selectedItemIds, setSingleSelection]
  )

  return {
    getContextItemIds,
    handleCheckboxChange,
    handleContextMenu,
    handleModifiedClick,
    isSelected: useCallback(
      (itemId: string) => selectedItemIds.has(itemId),
      [selectedItemIds]
    ),
    orderedVisibleItemIds,
    selectedItemIds,
    setSingleSelection,
    toggleItem,
  }
}

export type WorkItemSelectionController = ReturnType<typeof useWorkItemSelection>

export function getWorkItemSelectionContextItems({
  data,
  item,
  selection,
}: {
  data: AppData
  item: WorkItem
  selection?: WorkItemSelectionController
}) {
  return (
    selection
      ?.getContextItemIds(item.id)
      .map((itemId) => getWorkItem(data, itemId))
      .filter((entry): entry is WorkItem => entry !== null) ?? [item]
  )
}

export function WorkItemSelectionCheckbox({
  checked,
  className,
  label,
  onChange,
}: {
  checked: boolean
  className?: string
  label: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label
      data-no-drag="true"
      className={cn(
        "inline-grid size-4 shrink-0 cursor-pointer place-items-center",
        className
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        className="peer sr-only"
        onChange={onChange}
      />
      <span
        aria-hidden
        className={cn(
          "grid size-3.5 place-items-center rounded-[3px] border-0 bg-surface-3 text-transparent transition-colors",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--brand)] peer-focus-visible:outline-none",
          "peer-checked:bg-surface-3 peer-checked:text-foreground"
        )}
      >
        <Check className="size-3 text-current" weight="bold" />
      </span>
    </label>
  )
}

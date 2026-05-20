"use client"

import { Check } from "@phosphor-icons/react"

import {
  getDocsFilterValues,
  type DocsFilterOption,
} from "@/components/app/screens/docs-view-config"
import type { ViewFilterKey } from "@/components/app/screens/helpers"
import type { ViewDefinition } from "@/lib/domain/types"
import {
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
} from "@/components/ui/template-primitives"

export function DocsFilterOptionsList({
  checkClassName,
  emptyLabel = "No document fields yet",
  optionGroups,
  view,
  onToggleFilter,
}: {
  checkClassName: string
  emptyLabel?: string
  optionGroups: Array<{ group: string; options: DocsFilterOption[] }>
  view: ViewDefinition
  onToggleFilter: (key: ViewFilterKey, value: string) => void
}) {
  return (
    <PropertyPopoverList>
      {optionGroups.length > 0 ? (
        optionGroups.map((group) => (
          <div key={group.group} className="contents">
            <PropertyPopoverGroup>{group.group}</PropertyPopoverGroup>
            {group.options.map((option) => {
              const selected = getDocsFilterValues(view, option.key).includes(
                option.value
              )

              return (
                <PropertyPopoverItem
                  key={`${option.key}:${option.value}`}
                  selected={selected}
                  onClick={() =>
                    onToggleFilter(option.key as ViewFilterKey, option.value)
                  }
                  trailing={
                    selected ? <Check className={checkClassName} /> : null
                  }
                >
                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                  </span>
                </PropertyPopoverItem>
              )
            })}
          </div>
        ))
      ) : (
        <PropertyPopoverItem muted className="pointer-events-none">
          {emptyLabel}
        </PropertyPopoverItem>
      )}
    </PropertyPopoverList>
  )
}

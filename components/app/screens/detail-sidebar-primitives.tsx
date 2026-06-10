import type { ReactNode } from "react"
import { NotePencil, Plus, Trash } from "@phosphor-icons/react"

import { PhosphorIconGlyph } from "@/components/app/phosphor-icon-picker"
import { AppLink } from "@/lib/browser/app-navigation"
import { cn } from "@/lib/utils"

const detailPropertyValueClassName =
  "flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] text-foreground transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:text-fg-4 disabled:hover:bg-transparent"

export const detailChipClassName =
  "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11.5px] text-fg-2"

export function renderDetailSidebarTerm(label: string, icon: ReactNode) {
  return (
    <dt className="flex items-center gap-2 self-center py-1.5 text-fg-3">
      <span className="text-fg-4">{icon}</span>
      <span>{label}</span>
    </dt>
  )
}

export function renderDetailSidebarValueButton({
  children,
  disabled,
  label,
}: {
  children: ReactNode
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={detailPropertyValueClassName}
    >
      {children}
    </button>
  )
}

export function DetailRelationLink({
  href,
  icon,
  label,
  title,
}: {
  href: string
  icon: ReactNode
  label: string
  title: ReactNode
}) {
  return (
    <AppLink
      href={href}
      className={cn(detailChipClassName, "w-fit hover:bg-surface-3")}
    >
      {icon}
      <b className="min-w-0 truncate font-medium text-foreground">{title}</b>
      <span className="text-fg-3" aria-hidden="true">
        •
      </span>
      <span className="text-fg-3">{label}</span>
    </AppLink>
  )
}

export function DetailSidebarCustomPropertyRow({
  children,
  definition,
  editable,
  onEditProperty,
  onRemoveProperty,
}: {
  children: ReactNode
  definition: {
    id: string
    icon: string
    name: string
  }
  editable: boolean
  onEditProperty: () => void
  onRemoveProperty: () => void
}) {
  return (
    <div className="contents">
      {renderDetailSidebarTerm(
        definition.name,
        <PhosphorIconGlyph icon={definition.icon} className="size-[13px]" />
      )}
      <dd className="group/prop flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1">{children}</div>
        {editable ? (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/prop:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              aria-label={`Edit ${definition.name}`}
              title="Edit property"
              className="inline-grid size-6 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
              onClick={onEditProperty}
            >
              <NotePencil className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Remove ${definition.name}`}
              title="Remove property"
              className="inline-grid size-6 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-destructive"
              onClick={onRemoveProperty}
            >
              <Trash className="size-3.5" />
            </button>
          </div>
        ) : null}
      </dd>
    </div>
  )
}

export function DetailSidebarAddPropertyRow({
  canCreate = true,
  disabled,
  onOpen,
}: {
  canCreate?: boolean
  disabled: boolean
  onOpen: () => void
}) {
  if (!canCreate) {
    return null
  }

  return (
    <div className="contents">
      {renderDetailSidebarTerm("Properties", <Plus className="size-[13px]" />)}
      <dd>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed border-line px-2 text-[12px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground disabled:opacity-60"
          onClick={onOpen}
        >
          <Plus className="size-3.5" />
          Add property
        </button>
      </dd>
    </div>
  )
}

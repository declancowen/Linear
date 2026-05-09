import type { ReactNode } from "react"

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

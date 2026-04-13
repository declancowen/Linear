"use client"

import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

type CollapsibleRightSidebarProps = ComponentProps<"aside"> & {
  open: boolean
  width?: string
  containerClassName?: string
}

export function CollapsibleRightSidebar({
  open,
  width = "19rem",
  containerClassName,
  className,
  children,
  ...props
}: CollapsibleRightSidebarProps) {
  const sidebarWidth = open ? width : "0rem"

  return (
    <div
      className={cn(
        "min-h-0 shrink-0 overflow-hidden transition-[width,flex-basis] duration-200 ease-linear",
        containerClassName
      )}
      style={{ width: sidebarWidth, flexBasis: sidebarWidth }}
    >
      <aside
        aria-hidden={!open}
        inert={!open ? true : undefined}
        className={cn(
          "flex h-full min-h-0 flex-col border-l bg-background transition-transform duration-200 ease-linear",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
          className
        )}
        style={{ width }}
        {...props}
      >
        {children}
      </aside>
    </div>
  )
}

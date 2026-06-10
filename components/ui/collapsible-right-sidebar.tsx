"use client"

import { forwardRef, useCallback, useState, type ComponentProps } from "react"

import { cn } from "@/lib/utils"
import { FloatingBoundaryProvider } from "@/components/ui/floating-boundary"

type CollapsibleRightSidebarProps = ComponentProps<"aside"> & {
  open: boolean
  width?: string
  containerClassName?: string
}

export const CollapsibleRightSidebar = forwardRef<
  HTMLElement,
  CollapsibleRightSidebarProps
>(function CollapsibleRightSidebar(
  { open, width = "19rem", containerClassName, className, children, ...props },
  ref
) {
  const sidebarWidth = open ? width : "0rem"
  const [boundary, setBoundary] = useState<HTMLElement | null>(null)

  const mergedRef = useCallback(
    (node: HTMLElement | null) => {
      setBoundary(node)

      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    },
    [ref]
  )

  return (
    <div
      className={cn("min-h-0 shrink-0 overflow-hidden", containerClassName)}
      style={{ width: sidebarWidth, flexBasis: sidebarWidth }}
    >
      <aside
        ref={mergedRef}
        aria-hidden={!open}
        inert={!open ? true : undefined}
        className={cn(
          "flex h-full min-h-0 flex-col border-l bg-background [contain:layout_paint_style]",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
          className
        )}
        style={{ width }}
        {...props}
      >
        <FloatingBoundaryProvider boundary={boundary}>
          {children}
        </FloatingBoundaryProvider>
      </aside>
    </div>
  )
})

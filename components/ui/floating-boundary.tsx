"use client"

import * as React from "react"

/**
 * Shared collision boundary for floating surfaces (popovers, dropdown menus,
 * selects) rendered inside a constrained container such as a sidebar or
 * taskbar. When a boundary is provided, floating content is kept inside that
 * element instead of escaping into adjacent panels.
 *
 * Opt-in only: with no provider in the tree, floating content keeps the default
 * viewport-based collision behavior.
 */
const FloatingBoundaryContext = React.createContext<HTMLElement | null>(null)

export function FloatingBoundaryProvider({
  boundary,
  children,
}: {
  boundary: HTMLElement | null
  children: React.ReactNode
}) {
  return (
    <FloatingBoundaryContext.Provider value={boundary}>
      {children}
    </FloatingBoundaryContext.Provider>
  )
}

export function useFloatingBoundary() {
  return React.useContext(FloatingBoundaryContext)
}

/**
 * Renders a container element that acts as the collision boundary for any
 * floating content (popovers, menus, selects) rendered by its descendants.
 */
export const FloatingBoundaryRegion = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(function FloatingBoundaryRegion({ children, ...props }, ref) {
  const [boundary, setBoundary] = React.useState<HTMLElement | null>(null)

  const mergedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
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
    <div ref={mergedRef} {...props}>
      <FloatingBoundaryProvider boundary={boundary}>
        {children}
      </FloatingBoundaryProvider>
    </div>
  )
})

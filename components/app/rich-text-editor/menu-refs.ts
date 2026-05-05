import type * as React from "react"

export function assignMenuItemRef(
  itemRefs: React.MutableRefObject<Array<HTMLDivElement | null>>,
  index: number,
  node: HTMLDivElement | null
) {
  itemRefs.current[index] = node
}

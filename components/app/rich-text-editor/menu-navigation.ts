import type { Dispatch, SetStateAction } from "react"

export function handleRichTextMenuNavigationKeyDown(input: {
  event: KeyboardEvent
  maxIndex: number
  onEnter: () => boolean
  onEscape: () => void
  setIndex: Dispatch<SetStateAction<number>>
}) {
  if (input.event.key === "Escape") {
    input.onEscape()
    return true
  }

  if (input.event.key === "ArrowDown") {
    input.event.preventDefault()
    input.setIndex((current) =>
      Math.min(Math.min(current, input.maxIndex) + 1, input.maxIndex)
    )
    return true
  }

  if (input.event.key === "ArrowUp") {
    input.event.preventDefault()
    input.setIndex((current) =>
      Math.max(0, Math.min(current, input.maxIndex) - 1)
    )
    return true
  }

  if (input.event.key === "Enter") {
    return input.onEnter()
  }

  return null
}

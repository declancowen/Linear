"use client"

export function blurActiveElement() {
  if (typeof document === "undefined") {
    return
  }

  const activeElement = document.activeElement

  if (!(activeElement instanceof HTMLElement)) {
    return
  }

  if (activeElement === document.body) {
    return
  }

  activeElement.blur()
}

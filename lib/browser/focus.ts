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

  const shouldBlur =
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLSelectElement ||
    activeElement.isContentEditable

  if (!shouldBlur) {
    return
  }

  activeElement.blur()
}

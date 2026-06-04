export function getCurrentHashTargetId() {
  if (typeof window === "undefined" || !window.location.hash) {
    return ""
  }

  try {
    return decodeURIComponent(window.location.hash.slice(1))
  } catch {
    return window.location.hash.slice(1)
  }
}

export function getHashTargetElement(hashTargetId: string) {
  return hashTargetId ? document.getElementById(hashTargetId) : null
}

export function scheduleScrollElementIntoCenteredView(target: Element) {
  const frame = window.requestAnimationFrame(() => {
    target.scrollIntoView({ block: "center" })
  })

  return () => window.cancelAnimationFrame(frame)
}

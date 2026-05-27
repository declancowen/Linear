"use client"

type DesktopNotificationPayload = {
  body?: string
  path?: string | null
  silent?: boolean
  title: string
}

function isElectronDesktop() {
  return (
    typeof window !== "undefined" &&
    window.electronApp?.isElectron === true &&
    typeof window.electronApp.showNotification === "function"
  )
}

function isForegroundDocument() {
  if (typeof document === "undefined") {
    return false
  }

  return document.visibilityState === "visible" && document.hasFocus()
}

export async function showDesktopNotification(
  payload: DesktopNotificationPayload
) {
  if (!isElectronDesktop() || isForegroundDocument()) {
    return false
  }

  try {
    return (await window.electronApp?.showNotification?.(payload)) === true
  } catch {
    return false
  }
}

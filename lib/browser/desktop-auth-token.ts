"use client"

async function getElectronDesktopAuthToken() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const token = await window.electronApp?.getDesktopAuthToken?.()

    return typeof token === "string" && token.trim().length > 0 ? token : null
  } catch {
    return null
  }
}

let desktopAppInfoPromise: ReturnType<
  NonNullable<NonNullable<Window["electronApp"]>["getDesktopAppInfo"]>
> | null = null

async function getElectronDesktopAppInfo() {
  if (
    typeof window === "undefined" ||
    window.electronApp?.isElectron !== true ||
    typeof window.electronApp.getDesktopAppInfo !== "function"
  ) {
    return null
  }

  desktopAppInfoPromise ??= window.electronApp.getDesktopAppInfo()

  return desktopAppInfoPromise.catch(() => null)
}

export async function buildDesktopAuthHeaders(headersInit?: HeadersInit) {
  const headers = new Headers(headersInit)
  const appInfo = await getElectronDesktopAppInfo()

  if (appInfo?.version) {
    headers.set("X-Recipe-Room-Desktop-Version", appInfo.version)
  }

  if (appInfo?.platform) {
    headers.set("X-Recipe-Room-Desktop-Platform", appInfo.platform)
  }

  if (!headers.has("Authorization")) {
    const token = await getElectronDesktopAuthToken()

    if (!token) {
      return headers
    }

    headers.set("Authorization", `Bearer ${token}`)
  }

  return headers
}

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

export async function buildDesktopAuthHeaders(headersInit?: HeadersInit) {
  const headers = new Headers(headersInit)

  if (headers.has("Authorization")) {
    return headers
  }

  const token = await getElectronDesktopAuthToken()

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  return headers
}

export type BrowserThemeMode = "light" | "dark"

const FALLBACK_THEME_COLORS: Record<BrowserThemeMode, string> = {
  light: "#fdfdfd",
  dark: "#161616",
}

function ensureMetaTag(
  name: string,
  documentObject: Document
): HTMLMetaElement {
  const existingTag = documentObject.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`
  )

  if (existingTag) {
    return existingTag
  }

  const metaTag = documentObject.createElement("meta")
  metaTag.name = name
  documentObject.head.appendChild(metaTag)
  return metaTag
}

function isUsableThemeColor(
  value: string | null | undefined
): value is string {
  if (!value) {
    return false
  }

  const normalizedValue = value.trim().toLowerCase()

  return (
    normalizedValue.length > 0 &&
    normalizedValue !== "transparent" &&
    normalizedValue !== "rgba(0, 0, 0, 0)"
  )
}

export function resolveBrowserThemeColor(
  theme: BrowserThemeMode,
  documentObject: Document = document
): string {
  const windowObject = documentObject.defaultView
  const bodyBackgroundColor =
    windowObject && documentObject.body
      ? windowObject.getComputedStyle(documentObject.body).backgroundColor
      : null

  if (isUsableThemeColor(bodyBackgroundColor)) {
    return bodyBackgroundColor
  }

  return FALLBACK_THEME_COLORS[theme]
}

export function syncBrowserThemeMetadata(
  theme: BrowserThemeMode,
  documentObject: Document = document
): string {
  const themeColor = resolveBrowserThemeColor(theme, documentObject)

  ensureMetaTag("theme-color", documentObject).content = themeColor
  ensureMetaTag("color-scheme", documentObject).content = theme
  ensureMetaTag("supported-color-schemes", documentObject).content = theme
  documentObject.documentElement.style.colorScheme = theme

  return themeColor
}

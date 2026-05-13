import { isImageAssetSource } from "./utils"

export function getDisplayInitials(value: string, fallback: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || fallback
  )
}

export function getDisplayAvatarFallback(
  name: string,
  fallbackValue: string | null | undefined,
  fallback: string
) {
  const trimmedFallback = fallbackValue?.trim()

  if (trimmedFallback && !isImageAssetSource(trimmedFallback)) {
    return trimmedFallback
  }

  return getDisplayInitials(name, fallback)
}

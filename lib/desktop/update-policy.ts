export const DEFAULT_DESKTOP_MAC_DOWNLOAD_URL =
  "https://github.com/declancowen/Linear/releases/latest/download/Recipe-Room-mac-arm64.dmg"

function parseVersionParts(version: string) {
  return version
    .trim()
    .replace(/^v/u, "")
    .split(/[.-]/u)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part))
}

export function compareDesktopVersions(left: string, right: string) {
  const leftParts = parseVersionParts(left)
  const rightParts = parseVersionParts(right)
  const maxLength = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0
    const rightPart = rightParts[index] ?? 0

    if (leftPart > rightPart) {
      return 1
    }

    if (leftPart < rightPart) {
      return -1
    }
  }

  return 0
}

export function isDesktopVersionUnsupported({
  currentVersion,
  minSupportedVersion,
}: {
  currentVersion: string | null | undefined
  minSupportedVersion: string | null | undefined
}) {
  if (!currentVersion?.trim() || !minSupportedVersion?.trim()) {
    return false
  }

  return compareDesktopVersions(currentVersion, minSupportedVersion) < 0
}

export const DEFAULT_DESKTOP_MAC_DOWNLOAD_URL =
  "https://github.com/declancowen/Linear/releases/latest/download/Recipe-Room-mac-arm64.dmg"

type ParsedDesktopVersion = {
  core: number[]
  prerelease: string[] | null
}

function parseDesktopVersion(version: string): ParsedDesktopVersion {
  const withoutBuildMetadata = version.trim().replace(/^v/u, "").split("+")[0]
  const prereleaseSeparatorIndex = withoutBuildMetadata.indexOf("-")
  const coreText =
    prereleaseSeparatorIndex === -1
      ? withoutBuildMetadata
      : withoutBuildMetadata.slice(0, prereleaseSeparatorIndex)
  const prereleaseText =
    prereleaseSeparatorIndex === -1
      ? null
      : withoutBuildMetadata.slice(prereleaseSeparatorIndex + 1)

  return {
    core: coreText
      .split(".")
      .map((part) => Number.parseInt(part, 10))
      .filter((part) => Number.isFinite(part)),
    prerelease: prereleaseText?.trim()
      ? prereleaseText.split(".").filter(Boolean)
      : null,
  }
}

function comparePrereleaseIdentifiers(left: string, right: string) {
  const leftNumber = /^\d+$/u.test(left) ? Number.parseInt(left, 10) : null
  const rightNumber = /^\d+$/u.test(right) ? Number.parseInt(right, 10) : null

  if (leftNumber !== null && rightNumber !== null) {
    return Math.sign(leftNumber - rightNumber)
  }

  if (leftNumber !== null) {
    return -1
  }

  if (rightNumber !== null) {
    return 1
  }

  return Math.sign(left.localeCompare(right))
}

function comparePrereleaseVersions(
  left: string[] | null,
  right: string[] | null
) {
  if (!left && !right) {
    return 0
  }

  if (left && !right) {
    return -1
  }

  if (!left && right) {
    return 1
  }

  const leftParts = left ?? []
  const rightParts = right ?? []
  const maxLength = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index]
    const rightPart = rightParts[index]

    if (leftPart === undefined) {
      return -1
    }

    if (rightPart === undefined) {
      return 1
    }

    const comparison = comparePrereleaseIdentifiers(leftPart, rightPart)

    if (comparison !== 0) {
      return comparison
    }
  }

  return 0
}

export function compareDesktopVersions(left: string, right: string) {
  const leftVersion = parseDesktopVersion(left)
  const rightVersion = parseDesktopVersion(right)
  const leftParts = leftVersion.core
  const rightParts = rightVersion.core
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

  return comparePrereleaseVersions(
    leftVersion.prerelease,
    rightVersion.prerelease
  )
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

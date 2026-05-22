type UserAgentDataHighEntropyValues = {
  architecture?: string
  platform?: string
}

type UserAgentDataWithArchitecture = {
  getHighEntropyValues?: (
    hints: string[]
  ) => Promise<UserAgentDataHighEntropyValues>
  mobile?: boolean
  platform?: string
}

const APPLE_SILICON_ARCHITECTURES = new Set(["aarch64", "arm", "arm64"])

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

function isAppleMobileTablet({
  maxTouchPoints,
  platform,
  userAgent,
  userAgentData,
}: {
  maxTouchPoints: number
  platform: string
  userAgent: string
  userAgentData?: UserAgentDataWithArchitecture
}) {
  return (
    userAgentData?.mobile === true ||
    /iPad|iPhone|iPod/u.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  )
}

function isMacPlatform(platform: string, userAgent: string) {
  return /Mac|macOS|MacIntel/u.test(platform) || /Macintosh/u.test(userAgent)
}

function getUserAgentArchitecture(userAgent: string) {
  const match = /\b(aarch64|arm64)\b/iu.exec(userAgent)

  return normalize(match?.[1])
}

async function getUserAgentDataArchitecture(
  userAgentData?: UserAgentDataWithArchitecture
) {
  if (!userAgentData?.getHighEntropyValues) {
    return null
  }

  try {
    return await userAgentData.getHighEntropyValues([
      "architecture",
      "platform",
    ])
  } catch {
    return null
  }
}

export async function isSupportedMacDesktopDownloadBrowser() {
  if (typeof window === "undefined" || window.electronApp?.isElectron) {
    return false
  }

  const navigatorWithUserAgentData = window.navigator as Navigator & {
    userAgentData?: UserAgentDataWithArchitecture
  }
  const userAgentData = navigatorWithUserAgentData.userAgentData
  const platform = userAgentData?.platform ?? window.navigator.platform ?? ""
  const userAgent = window.navigator.userAgent

  if (
    !isMacPlatform(platform, userAgent) ||
    isAppleMobileTablet({
      maxTouchPoints: window.navigator.maxTouchPoints,
      platform,
      userAgent,
      userAgentData,
    })
  ) {
    return false
  }

  const highEntropyValues = await getUserAgentDataArchitecture(userAgentData)
  const highEntropyPlatform = highEntropyValues?.platform ?? platform

  if (!isMacPlatform(highEntropyPlatform, userAgent)) {
    return false
  }

  const architecture =
    normalize(highEntropyValues?.architecture) ||
    getUserAgentArchitecture(userAgent)

  return APPLE_SILICON_ARCHITECTURES.has(architecture)
}

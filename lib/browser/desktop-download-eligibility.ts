import type {
  DesktopDownloadArchitecture,
  DesktopDownloadTarget,
} from "@/lib/desktop/update-policy"

type UserAgentDataHighEntropyValues = {
  architecture?: string
  bitness?: string
  platform?: string
  wow64?: boolean
}

type UserAgentDataWithArchitecture = {
  getHighEntropyValues?: (
    hints: string[]
  ) => Promise<UserAgentDataHighEntropyValues>
  mobile?: boolean
  platform?: string
}

const APPLE_SILICON_ARCHITECTURES = new Set(["aarch64", "arm", "arm64"])
const INTEL_64_ARCHITECTURES = new Set(["amd64", "x64", "x86_64"])
const INTEL_32_ARCHITECTURES = new Set(["i386", "i686", "ia32", "x86"])

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

function isWindowsPlatform(platform: string, userAgent: string) {
  return /Windows/iu.test(platform) || /Windows NT/iu.test(userAgent)
}

function isWindowsPhone(userAgent: string) {
  return /Windows Phone|IEMobile/iu.test(userAgent)
}

function normalizeHighEntropyArchitecture({
  architecture,
  bitness,
  wow64,
}: UserAgentDataHighEntropyValues): DesktopDownloadArchitecture | null {
  const normalizedArchitecture = normalize(architecture)
  const normalizedBitness = normalize(bitness)

  if (APPLE_SILICON_ARCHITECTURES.has(normalizedArchitecture)) {
    return "arm64"
  }

  if (INTEL_64_ARCHITECTURES.has(normalizedArchitecture)) {
    return "x64"
  }

  if (INTEL_32_ARCHITECTURES.has(normalizedArchitecture)) {
    return normalizedBitness === "64" || wow64 === true ? "x64" : "ia32"
  }

  if (normalizedBitness === "64") {
    return "x64"
  }

  if (normalizedBitness === "32") {
    return "ia32"
  }

  return null
}

function getUserAgentMacArchitecture(
  userAgent: string
): DesktopDownloadArchitecture | null {
  if (/\b(aarch64|arm64)\b/iu.test(userAgent)) {
    return "arm64"
  }

  if (/\b(amd64|x64|x86_64)\b/iu.test(userAgent)) {
    return "x64"
  }

  return null
}

function getUserAgentWindowsArchitecture(
  userAgent: string
): DesktopDownloadArchitecture | null {
  if (/\b(aarch64|arm64)\b/iu.test(userAgent)) {
    return "arm64"
  }

  if (/\b(amd64|win64|wow64|x64|x86_64)\b/iu.test(userAgent)) {
    return "x64"
  }

  if (/\b(i386|i686|ia32|x86)\b/iu.test(userAgent)) {
    return "ia32"
  }

  return null
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
      "bitness",
      "platform",
      "wow64",
    ])
  } catch {
    return null
  }
}

type DesktopDownloadBrowserContext = {
  maxTouchPoints: number
  navigatorPlatform: string
  platform: string
  userAgent: string
  userAgentData?: UserAgentDataWithArchitecture
}

function getDesktopDownloadBrowserContext(): DesktopDownloadBrowserContext | null {
  if (typeof window === "undefined" || window.electronApp?.isElectron) {
    return null
  }

  const navigatorWithUserAgentData = window.navigator as Navigator & {
    userAgentData?: UserAgentDataWithArchitecture
  }
  const userAgentData = navigatorWithUserAgentData.userAgentData
  const navigatorPlatform = window.navigator.platform ?? ""
  return {
    maxTouchPoints: window.navigator.maxTouchPoints,
    navigatorPlatform,
    platform: userAgentData?.platform ?? navigatorPlatform,
    userAgent: window.navigator.userAgent,
    userAgentData,
  }
}

function supportsDesktopDownloadBrowserPlatform({
  maxTouchPoints,
  platform,
  userAgent,
  userAgentData,
}: DesktopDownloadBrowserContext) {
  const macSupported =
    isMacPlatform(platform, userAgent) &&
    !isAppleMobileTablet({
      maxTouchPoints,
      platform,
      userAgent,
      userAgentData,
    })

  return (
    macSupported ||
    (isWindowsPlatform(platform, userAgent) && !isWindowsPhone(userAgent))
  )
}

function resolveMacDesktopDownloadTarget({
  highEntropyValues,
  navigatorPlatform,
  userAgent,
}: {
  highEntropyValues: UserAgentDataHighEntropyValues | null
  navigatorPlatform: string
  userAgent: string
}): DesktopDownloadTarget | null {
  const detectedArchitecture =
    (highEntropyValues
      ? normalizeHighEntropyArchitecture(highEntropyValues)
      : null) ??
    getUserAgentMacArchitecture(userAgent) ??
    (navigatorPlatform === "MacIntel" ? "x64" : null)
  const architecture =
    detectedArchitecture === "ia32" ? "x64" : detectedArchitecture

  return architecture
    ? {
        architecture,
        platform: "mac",
      }
    : null
}

function resolveWindowsDesktopDownloadTarget({
  highEntropyValues,
  userAgent,
}: {
  highEntropyValues: UserAgentDataHighEntropyValues | null
  userAgent: string
}): DesktopDownloadTarget {
  const architecture =
    (highEntropyValues
      ? normalizeHighEntropyArchitecture(highEntropyValues)
      : null) ??
    getUserAgentWindowsArchitecture(userAgent) ??
    "x64"

  return {
    architecture,
    platform: "windows",
  }
}

export async function getSupportedDesktopDownloadTarget(): Promise<DesktopDownloadTarget | null> {
  const browserContext = getDesktopDownloadBrowserContext()

  if (
    !browserContext ||
    !supportsDesktopDownloadBrowserPlatform(browserContext)
  ) {
    return null
  }

  const highEntropyValues = await getUserAgentDataArchitecture(
    browserContext.userAgentData
  )
  const highEntropyPlatform = highEntropyValues?.platform ?? browserContext.platform

  if (isMacPlatform(highEntropyPlatform, browserContext.userAgent)) {
    return resolveMacDesktopDownloadTarget({
      highEntropyValues,
      navigatorPlatform: browserContext.navigatorPlatform,
      userAgent: browserContext.userAgent,
    })
  }

  if (!isWindowsPlatform(highEntropyPlatform, browserContext.userAgent)) {
    return null
  }

  return resolveWindowsDesktopDownloadTarget({
    highEntropyValues,
    userAgent: browserContext.userAgent,
  })
}

export async function isSupportedMacDesktopDownloadBrowser() {
  return (await getSupportedDesktopDownloadTarget())?.platform === "mac"
}

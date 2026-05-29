import { NextResponse } from "next/server"

import {
  DEFAULT_DESKTOP_DOWNLOAD_URLS,
  DEFAULT_DESKTOP_MAC_DOWNLOAD_URL,
  type DesktopDownloadArchitecture,
  type DesktopDownloadPlatform,
  type DesktopDownloadUrlMap,
} from "@/lib/desktop/update-policy"

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim()

  return value && value.length > 0 ? value : null
}

function readDesktopDownloadUrl(
  platform: DesktopDownloadPlatform,
  architecture: DesktopDownloadArchitecture,
  envNames: string[]
) {
  for (const envName of envNames) {
    const value = readOptionalEnv(envName)

    if (value) {
      return value
    }
  }

  return DEFAULT_DESKTOP_DOWNLOAD_URLS[platform][architecture]
}

function getDesktopDownloadUrls(): DesktopDownloadUrlMap {
  return {
    mac: {
      arm64:
        readDesktopDownloadUrl("mac", "arm64", [
          "DESKTOP_MAC_ARM64_DOWNLOAD_URL",
          "NEXT_PUBLIC_DESKTOP_MAC_ARM64_DOWNLOAD_URL",
          "DESKTOP_MAC_DOWNLOAD_URL",
          "NEXT_PUBLIC_DESKTOP_MAC_DOWNLOAD_URL",
        ]) ?? DEFAULT_DESKTOP_MAC_DOWNLOAD_URL,
      x64:
        readDesktopDownloadUrl("mac", "x64", [
          "DESKTOP_MAC_X64_DOWNLOAD_URL",
          "NEXT_PUBLIC_DESKTOP_MAC_X64_DOWNLOAD_URL",
        ]) ?? DEFAULT_DESKTOP_DOWNLOAD_URLS.mac.x64,
    },
    windows: {
      arm64:
        readDesktopDownloadUrl("windows", "arm64", [
          "DESKTOP_WINDOWS_ARM64_DOWNLOAD_URL",
          "NEXT_PUBLIC_DESKTOP_WINDOWS_ARM64_DOWNLOAD_URL",
        ]) ?? DEFAULT_DESKTOP_DOWNLOAD_URLS.windows.arm64,
      ia32:
        readDesktopDownloadUrl("windows", "ia32", [
          "DESKTOP_WINDOWS_IA32_DOWNLOAD_URL",
          "NEXT_PUBLIC_DESKTOP_WINDOWS_IA32_DOWNLOAD_URL",
        ]) ?? DEFAULT_DESKTOP_DOWNLOAD_URLS.windows.ia32,
      x64:
        readDesktopDownloadUrl("windows", "x64", [
          "DESKTOP_WINDOWS_X64_DOWNLOAD_URL",
          "NEXT_PUBLIC_DESKTOP_WINDOWS_X64_DOWNLOAD_URL",
        ]) ?? DEFAULT_DESKTOP_DOWNLOAD_URLS.windows.x64,
    },
  }
}

export async function GET() {
  const latestDownloadUrls = getDesktopDownloadUrls()

  return NextResponse.json(
    {
      latestDownloadUrl: latestDownloadUrls.mac.arm64,
      latestDownloadUrls,
      minSupportedVersion: readOptionalEnv("DESKTOP_MIN_SUPPORTED_VERSION"),
      unsupportedMessage:
        readOptionalEnv("DESKTOP_UNSUPPORTED_VERSION_MESSAGE") ??
        "This desktop version is out of date and cannot be used with the current service version.",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}

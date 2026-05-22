import { NextResponse } from "next/server"

import { DEFAULT_DESKTOP_MAC_DOWNLOAD_URL } from "@/lib/desktop/update-policy"

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim()

  return value && value.length > 0 ? value : null
}

export async function GET() {
  return NextResponse.json(
    {
      latestDownloadUrl:
        readOptionalEnv("DESKTOP_MAC_DOWNLOAD_URL") ??
        readOptionalEnv("NEXT_PUBLIC_DESKTOP_MAC_DOWNLOAD_URL") ??
        DEFAULT_DESKTOP_MAC_DOWNLOAD_URL,
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

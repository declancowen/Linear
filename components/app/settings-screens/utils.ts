"use client"

import { syncGenerateSettingsImageUploadUrl } from "@/lib/convex/client"
import { type TeamFeatureSettings } from "@/lib/domain/types"

const IMAGE_UPLOAD_MAX_SIZE = 10 * 1024 * 1024

export function getUserInitials(name: string | null | undefined) {
  const parts = (name ?? "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
}

export function getTeamLandingHref(
  teamSlug: string,
  features: TeamFeatureSettings
) {
  if (features.issues) {
    return `/team/${teamSlug}/work`
  }

  if (features.chat) {
    return `/team/${teamSlug}/chat`
  }

  if (features.channels) {
    return `/team/${teamSlug}/channel`
  }

  if (features.docs) {
    return `/team/${teamSlug}/docs`
  }

  return `/team/${teamSlug}/work`
}

export async function uploadSettingsImage(
  kind: "user-avatar" | "workspace-logo",
  file: File
) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file")
  }

  if (file.size > IMAGE_UPLOAD_MAX_SIZE) {
    throw new Error("Images must be 10 MB or smaller")
  }

  const uploadUrlPayload = await syncGenerateSettingsImageUploadUrl(kind)

  if (!uploadUrlPayload?.uploadUrl) {
    throw new Error("Failed to prepare the image upload")
  }

  const storageResponse = await fetch(uploadUrlPayload.uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  })
  const storagePayload = (await storageResponse.json().catch(() => null)) as {
    storageId?: string
  } | null

  if (!storageResponse.ok || !storagePayload?.storageId) {
    throw new Error("Image upload failed")
  }

  return {
    storageId: storagePayload.storageId,
    previewUrl: URL.createObjectURL(file),
  }
}

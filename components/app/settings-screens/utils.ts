"use client"

import { syncGenerateSettingsImageUploadUrl } from "@/lib/convex/client"
import { getDisplayInitials } from "@/lib/display-initials"
import { useAppStore } from "@/lib/store/app-store"

export const IMAGE_UPLOAD_MAX_SIZE = 10 * 1024 * 1024

export function getUserInitials(name: string | null | undefined) {
  return getDisplayInitials(name ?? "", "?")
}

export function getTeamLandingHref(teamSlug: string) {
  // The Dashboard is an always-on surface and the team's first page, so every
  // team lands there regardless of which optional surfaces are enabled.
  return `/team/${teamSlug}/dashboard`
}

export async function cancelSettingsInvite(
  invite: { id: string } | null,
  handlers: {
    setCancellingInviteId: (inviteId: string | null) => void
    setInviteToCancel: (invite: null) => void
  }
) {
  if (!invite) {
    return
  }

  try {
    handlers.setCancellingInviteId(invite.id)
    const cancelled = await useAppStore.getState().cancelInvite(invite.id)

    if (cancelled) {
      handlers.setInviteToCancel(null)
    }
  } finally {
    handlers.setCancellingInviteId(null)
  }
}

function assertSettingsImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file")
  }

  if (file.size > IMAGE_UPLOAD_MAX_SIZE) {
    throw new Error("Images must be 10 MB or smaller")
  }
}

function getSettingsImageUploadContentType(file: File) {
  return file.type || "application/octet-stream"
}

async function getSettingsImageUploadUrl(
  kind: "user-avatar" | "workspace-logo",
  prepareErrorMessage: string
) {
  const uploadUrlPayload = await syncGenerateSettingsImageUploadUrl(kind)

  if (!uploadUrlPayload?.uploadUrl) {
    throw new Error(prepareErrorMessage)
  }

  return uploadUrlPayload.uploadUrl
}

async function parseSettingsImageStoragePayload(response: Response) {
  return (await response.json().catch(() => null)) as {
    storageId?: string
  } | null
}

async function uploadSettingsImageFile(
  uploadUrl: string,
  file: File,
  uploadErrorMessage: string
) {
  const storageResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": getSettingsImageUploadContentType(file),
    },
    body: file,
  })
  const storagePayload = await parseSettingsImageStoragePayload(storageResponse)

  if (!storageResponse.ok || !storagePayload?.storageId) {
    throw new Error(uploadErrorMessage)
  }

  return storagePayload.storageId
}

export async function uploadSettingsImageStorage(
  kind: "user-avatar" | "workspace-logo",
  file: File,
  messages: {
    prepare: string
    upload: string
  } = {
    prepare: "Failed to prepare the image upload",
    upload: "Image upload failed",
  }
) {
  assertSettingsImageFile(file)
  const uploadUrl = await getSettingsImageUploadUrl(kind, messages.prepare)

  return uploadSettingsImageFile(uploadUrl, file, messages.upload)
}

export async function uploadSettingsImage(
  kind: "user-avatar" | "workspace-logo",
  file: File
) {
  const storageId = await uploadSettingsImageStorage(kind, file)

  return {
    storageId,
    previewUrl: URL.createObjectURL(file),
  }
}

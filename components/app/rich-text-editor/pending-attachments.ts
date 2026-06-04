import { escapeHtml } from "@/lib/html"

import type { RichTextAttachmentUploader } from "./attachment-upload-one"

type PendingAttachment = {
  file: File
  uploadedFileUrl?: string
}

const pendingFiles = new Map<string, PendingAttachment>()

/** Holds a file locally and returns a blob URL used as a pending attachment href. */
export function registerPendingAttachment(file: File) {
  const url = URL.createObjectURL(file)
  pendingFiles.set(url, { file })

  return url
}

export function hasPendingAttachments(html: string) {
  for (const url of pendingFiles.keys()) {
    if (html.includes(url)) {
      return true
    }
  }

  return false
}

/**
 * Uploads every pending attachment still present in `html` and rewrites its
 * blob URL to the uploaded URL. Pending attachments removed before submit are
 * never uploaded. Returns `null` if any upload fails so the caller can abort.
 */
export async function flushPendingAttachmentUploads(
  html: string,
  uploadAttachment: RichTextAttachmentUploader
): Promise<string | null> {
  const replacements: Array<{ fileUrl: string; url: string }> = []

  for (const [url, pending] of [...pendingFiles.entries()]) {
    if (!html.includes(url)) {
      continue
    }

    let fileUrl = pending.uploadedFileUrl

    if (!fileUrl) {
      const uploaded = await uploadAttachment(pending.file)

      if (!uploaded?.fileUrl) {
        return null
      }

      fileUrl = uploaded.fileUrl
      pendingFiles.set(url, {
        ...pending,
        uploadedFileUrl: fileUrl,
      })
    }

    replacements.push({
      fileUrl,
      url,
    })
  }

  let next = html

  for (const { fileUrl, url } of replacements) {
    next = next.split(url).join(escapeHtml(fileUrl))
    URL.revokeObjectURL(url)
    pendingFiles.delete(url)
  }

  return next
}

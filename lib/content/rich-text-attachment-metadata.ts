import { parseHTML } from "linkedom"

const ATTACHMENT_ID_PATTERN = /^attachment_[a-z0-9][a-z0-9_-]{0,127}$/u

export function normalizeRichTextAttachmentId(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return ATTACHMENT_ID_PATTERN.test(normalized) ? normalized : null
}

export function extractRichTextAttachmentIds(content: string) {
  const ids = new Set<string>()

  for (const match of content.matchAll(
    /data-attachment-id\s*=\s*["']([^"']+)["']/giu
  )) {
    const id = normalizeRichTextAttachmentId(match[1])
    if (id) {
      ids.add(id)
    }
  }

  return ids
}

export function removeRichTextAttachmentById(
  content: string,
  attachmentId: string
) {
  const normalizedAttachmentId = normalizeRichTextAttachmentId(attachmentId)
  if (!normalizedAttachmentId || !content.includes(normalizedAttachmentId)) {
    return content
  }

  const { document } = parseHTML(
    `<!DOCTYPE html><html><head></head><body>${content}</body></html>`
  )
  const attachments = document.body.querySelectorAll(
    'img[data-attachment-id], a[data-type="attachment"][data-attachment-id]'
  )
  let removed = false

  for (const attachment of attachments) {
    if (
      normalizeRichTextAttachmentId(
        attachment.getAttribute("data-attachment-id")
      ) === normalizedAttachmentId
    ) {
      attachment.remove()
      removed = true
    }
  }

  return removed ? document.body.innerHTML : content
}

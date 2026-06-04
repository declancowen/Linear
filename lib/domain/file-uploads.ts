export const MAX_ATTACHMENT_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024

const SUPPORTED_ATTACHMENT_MIME_TYPES = new Set([
  "application/msword",
  "application/pdf",
  "application/rtf",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "text/csv",
  "text/markdown",
  "text/plain",
])

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
])

const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set([
  "avif",
  "csv",
  "doc",
  "docx",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "md",
  "pdf",
  "png",
  "ppt",
  "pptx",
  "rtf",
  "txt",
  "webp",
  "xls",
  "xlsx",
  "zip",
])

export const ATTACHMENT_FILE_INPUT_ACCEPT = [
  "image/*",
  ".avif",
  ".heic",
  ".heif",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".ppt",
  ".pptx",
  ".txt",
  ".md",
  ".rtf",
  ".zip",
].join(",")

export const ATTACHMENT_IMAGE_INPUT_ACCEPT = "image/*,.heic,.heif"

export type AttachmentFileLike = {
  name?: string | null
  size?: number | null
  type?: string | null
}

export type AttachmentFileKind =
  | "excel"
  | "file"
  | "image"
  | "pdf"
  | "powerpoint"
  | "word"

function getFileExtension(fileName: string | null | undefined) {
  const normalized = fileName?.trim().toLowerCase() ?? ""
  const extensionStart = normalized.lastIndexOf(".")

  return extensionStart >= 0 ? normalized.slice(extensionStart + 1) : ""
}

function isSupportedImageFileType(
  fileName: string | null | undefined,
  contentType: string | null | undefined
) {
  const normalizedContentType = contentType?.trim().toLowerCase() ?? ""

  return (
    SUPPORTED_IMAGE_MIME_TYPES.has(normalizedContentType) ||
    ["avif", "gif", "heic", "heif", "jpeg", "jpg", "png", "webp"].includes(
      getFileExtension(fileName)
    )
  )
}

export function isSupportedAttachmentFileType(
  fileName: string | null | undefined,
  contentType: string | null | undefined
) {
  const normalizedContentType = contentType?.trim().toLowerCase() ?? ""

  if (isSupportedImageFileType(fileName, normalizedContentType)) {
    return true
  }

  if (SUPPORTED_ATTACHMENT_MIME_TYPES.has(normalizedContentType)) {
    return true
  }

  return SUPPORTED_ATTACHMENT_EXTENSIONS.has(getFileExtension(fileName))
}

export function isImageAttachmentFile(
  fileName: string | null | undefined,
  contentType: string | null | undefined
) {
  return isSupportedImageFileType(fileName, contentType)
}

export function getAttachmentFileKind(
  fileName: string | null | undefined,
  contentType: string | null | undefined
): AttachmentFileKind {
  const normalizedContentType = contentType?.trim().toLowerCase() ?? ""
  const extension = getFileExtension(fileName)

  if (isSupportedImageFileType(fileName, normalizedContentType)) {
    return "image"
  }

  if (normalizedContentType === "application/pdf" || extension === "pdf") {
    return "pdf"
  }

  if (
    normalizedContentType === "application/msword" ||
    normalizedContentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "doc" ||
    extension === "docx"
  ) {
    return "word"
  }

  if (
    normalizedContentType === "application/vnd.ms-excel" ||
    normalizedContentType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    extension === "xls" ||
    extension === "xlsx" ||
    extension === "csv"
  ) {
    return "excel"
  }

  if (
    normalizedContentType === "application/vnd.ms-powerpoint" ||
    normalizedContentType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    extension === "ppt" ||
    extension === "pptx"
  ) {
    return "powerpoint"
  }

  return "file"
}

export function getAttachmentFileValidationMessage(
  file: AttachmentFileLike | null | undefined
) {
  if (!file || (file.size ?? 0) <= 0) {
    return "Choose a file to upload"
  }

  if (file.size && file.size > MAX_ATTACHMENT_UPLOAD_SIZE_BYTES) {
    return "Files must be 25 MB or smaller"
  }

  if (!isSupportedAttachmentFileType(file.name, file.type)) {
    return "Supported files include images, PDFs, Office files, text, CSV, and ZIP archives"
  }

  return null
}

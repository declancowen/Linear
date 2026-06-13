import { describe, expect, it } from "vitest"

import {
  getAttachmentFileKind,
  getAttachmentFileValidationMessage,
  isImageAttachmentFile,
  isSupportedAttachmentFileType,
  MAX_ATTACHMENT_UPLOAD_SIZE_BYTES,
  ATTACHMENT_FILE_INPUT_ACCEPT,
} from "@/lib/domain/file-uploads"

describe("attachment file upload policy", () => {
  it.each([
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", ""],
    ["photo.heic", ""],
    ["brief.pdf", "application/pdf"],
    [
      "proposal.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    [
      "forecast.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    [
      "roadmap.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    ["notes.txt", "text/plain"],
    ["export.csv", "text/csv"],
  ])("accepts supported attachment files: %s", (name, type) => {
    expect(isSupportedAttachmentFileType(name, type)).toBe(true)
    expect(getAttachmentFileValidationMessage({ name, size: 1, type })).toBeNull()
  })

  it("identifies image attachments by MIME type or extension", () => {
    expect(isImageAttachmentFile("photo.heic", "")).toBe(true)
    expect(isImageAttachmentFile("photo", "image/png")).toBe(true)
    expect(isImageAttachmentFile("vector.svg", "image/svg+xml")).toBe(false)
    expect(isImageAttachmentFile("deck.pptx", "")).toBe(false)
  })

  it.each([
    ["site.html", "text/html"],
    ["readme.md", "text/markdown"],
    ["archive.zip", "application/zip"],
    ["vector.svg", "image/svg+xml"],
    ["installer.exe", "application/x-msdownload"],
  ])("allows any non-empty file upload: %s", (name, type) => {
    expect(getAttachmentFileValidationMessage({ name, size: 1, type })).toBeNull()
  })

  it("allows every file type in the generic file picker", () => {
    expect(ATTACHMENT_FILE_INPUT_ACCEPT).toBe("*/*")
  })

  it.each([
    ["photo.jpg", "", "image"],
    ["brief.pdf", "", "pdf"],
    ["notes.docx", "", "word"],
    ["forecast.xlsx", "", "excel"],
    ["export.csv", "", "excel"],
    ["deck.pptx", "", "powerpoint"],
    ["archive.zip", "", "file"],
  ] as const)(
    "classifies attachment references for inline icons: %s",
    (name, type, kind) => {
      expect(getAttachmentFileKind(name, type)).toBe(kind)
    }
  )

  it("rejects empty and oversized files", () => {
    expect(
      getAttachmentFileValidationMessage({
        name: "empty.pdf",
        size: 0,
        type: "application/pdf",
      })
    ).toBe("Choose a file to upload")
    expect(
      getAttachmentFileValidationMessage({
        name: "large.pdf",
        size: MAX_ATTACHMENT_UPLOAD_SIZE_BYTES + 1,
        type: "application/pdf",
      })
    ).toBe("Files must be 25 MB or smaller")
  })
})

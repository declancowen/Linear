import { describe, expect, it } from "vitest"

import {
  extractRichTextAttachmentIds,
  removeRichTextAttachmentById,
} from "@/lib/content/rich-text-attachment-metadata"

describe("rich-text attachment metadata", () => {
  it("removes only the embedded attachment with the requested stable id", () => {
    const content =
      '<p><img src="https://example.com/one.png" data-attachment-id="attachment_one"><a data-type="attachment" href="https://example.com/two.pdf" data-attachment-id="attachment_two">two.pdf</a></p>'

    const result = removeRichTextAttachmentById(content, "attachment_one")

    expect(result).not.toContain("attachment_one")
    expect(result).toContain("attachment_two")
    expect([...extractRichTextAttachmentIds(result)]).toEqual(["attachment_two"])
  })

  it("does not change content for malformed or absent ids", () => {
    const content = '<p data-attachment-id="attachment_one">Keep me</p>'

    expect(removeRichTextAttachmentById(content, "bad id")).toBe(content)
    expect(removeRichTextAttachmentById(content, "attachment_one")).toBe(
      content
    )
    expect(removeRichTextAttachmentById(content, "attachment_missing")).toBe(
      content
    )
  })
})

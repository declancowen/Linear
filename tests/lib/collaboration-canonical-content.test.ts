import { describe, expect, it } from "vitest"

import {
  createCanonicalContentJson,
  prepareCanonicalCollaborationContent,
} from "@/lib/collaboration/canonical-content"
import {
  getNormalizedStyleValue,
  normalizeCanonicalUrl,
} from "@/lib/collaboration/canonical-content-normalization"

describe("canonical collaboration content helpers", () => {
  it("normalizes only explicitly allowed URL schemes", () => {
    const allowedSchemes = new Set(["https", "mailto"])

    expect(
      normalizeCanonicalUrl(" HTTPS://example.com/doc ", allowedSchemes)
    ).toBe("HTTPS://example.com/doc")
    expect(
      normalizeCanonicalUrl("mailto:alex@example.com", allowedSchemes)
    ).toBe("mailto:alex@example.com")
    expect(normalizeCanonicalUrl("/relative/path", allowedSchemes)).toBeNull()
    expect(
      normalizeCanonicalUrl("javascript:alert(1)", allowedSchemes)
    ).toBeNull()
    expect(normalizeCanonicalUrl(" ", allowedSchemes)).toBeNull()
  })

  it("normalizes table length and text alignment styles by tag owner", () => {
    expect(
      getNormalizedStyleValue({
        tagName: "td",
        propertyName: "width",
        propertyValue: " 42PX ",
      })
    ).toBe("42px")
    expect(
      getNormalizedStyleValue({
        tagName: "p",
        propertyName: "text-align",
        propertyValue: " CENTER ",
      })
    ).toBe("center")
    expect(
      getNormalizedStyleValue({
        tagName: "span",
        propertyName: "width",
        propertyValue: "42px",
      })
    ).toBeNull()
    expect(
      getNormalizedStyleValue({
        tagName: "p",
        propertyName: "text-align",
        propertyValue: "sideways",
      })
    ).toBeNull()
  })

  it("preserves only validated chat quote source metadata through canonical normalization", () => {
    const valid = prepareCanonicalCollaborationContent(
      createCanonicalContentJson(
        '<blockquote data-chat-source-message-id="message_1"><p>Quote</p></blockquote>'
      )
    )
    const invalid = prepareCanonicalCollaborationContent(
      createCanonicalContentJson(
        '<blockquote data-chat-source-message-id="bad id"><p>Quote</p></blockquote>'
      )
    )

    expect(valid.contentHtml).toContain(
      'data-chat-source-message-id="message_1"'
    )
    expect(invalid.contentHtml).not.toContain("data-chat-source-message-id")
  })
})

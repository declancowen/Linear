import { describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"

import { getMentionRenderLabel } from "@/lib/rich-text/mention-label"
import { createRichTextBaseExtensions } from "@/lib/rich-text/extensions"
import {
  renderMentionHTML,
  renderMentionText,
} from "@/lib/rich-text/mention-rendering"

describe("rich text extension helpers", () => {
  it("renders mention text with label, id, and trigger fallbacks", () => {
    expect(
      getMentionRenderLabel({
        attrs: {
          label: "Alex",
          id: "user_1",
        },
      })
    ).toBe("Alex")
    expect(
      renderMentionText({
        node: {
          attrs: {
            label: "Alex",
            id: "user_1",
          },
        },
      })
    ).toBe("@Alex")
    expect(
      renderMentionText({
        node: {
          attrs: {
            id: "team_1",
          },
        },
        suggestion: {
          char: "#",
        },
      })
    ).toBe("#team_1")
    expect(
      renderMentionText({
        node: {
          attrs: {},
        },
      })
    ).toBe("@")
  })

  it("renders mention HTML through the same text fallback", () => {
    expect(
      renderMentionHTML({
        options: {
          HTMLAttributes: {
            class: "editor-mention",
          },
        },
        node: {
          attrs: {
            label: "Sam",
          },
        },
        suggestion: {
          char: "@",
        },
      })
    ).toEqual(["span", { class: "editor-mention" }, "@Sam"])
  })

  it("keeps typed text after an existing URL link outside the link mark", () => {
    const editor = new Editor({
      extensions: createRichTextBaseExtensions({
        includeCharacterCount: false,
      }),
      content:
        '<p><a href="https://example.com">https://example.com</a></p>',
    })

    editor.commands.focus("end")
    editor.commands.insertContent(" after")

    expect(editor.getHTML()).toContain(
      '<a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">https://example.com</a> after'
    )

    editor.destroy()
  })

  it("round-trips valid attachment ids and drops malformed ids", () => {
    const editor = new Editor({
      extensions: createRichTextBaseExtensions({
        includeCharacterCount: false,
      }),
      content:
        '<p><img class="editor-image" src="https://example.com/image.png" data-attachment-id="attachment_12345678"><a data-type="attachment" class="editor-attachment" href="https://example.com/file.pdf" data-file-name="file.pdf" data-attachment-id="invalid">file.pdf</a></p>',
    })

    expect(editor.getHTML()).toContain(
      'data-attachment-id="attachment_12345678"'
    )
    expect(editor.getHTML()).not.toContain('data-attachment-id="invalid"')

    editor.destroy()
  })
})

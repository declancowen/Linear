import { describe, expect, it } from "vitest"

import { getMentionRenderLabel } from "@/lib/rich-text/mention-label"
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
})

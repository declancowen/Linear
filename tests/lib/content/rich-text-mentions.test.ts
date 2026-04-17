import { afterEach, describe, expect, it } from "vitest"

import {
  extractRichTextMentionCounts,
  extractRichTextMentionUserIds,
  filterPendingDocumentMentionsByContent,
  summarizePendingDocumentMentions,
} from "@/lib/content/rich-text-mentions"

describe("rich text mentions", () => {
  const originalDOMParser = globalThis.DOMParser

  afterEach(() => {
    globalThis.DOMParser = originalDOMParser
  })

  it("extracts unique mention user ids from rich text content", () => {
    expect(
      extractRichTextMentionUserIds(
        [
          "<p>",
          '<span class="editor-mention" data-type="mention" data-id="user_1" data-label="alex">@alex</span>',
          '<span class="editor-mention" data-type="mention" data-id="user_1" data-label="alex">@alex</span>',
          '<span class="editor-mention" data-type="mention" data-id="user_2" data-label="sam">@sam</span>',
          "</p>",
        ].join("")
      )
    ).toEqual(["user_1", "user_2"])
  })

  it("counts repeated mentions per user", () => {
    expect(
      extractRichTextMentionCounts(
        [
          "<p>",
          '<span class="editor-mention" data-type="mention" data-id="user_1">@alex</span>',
          '<span class="editor-mention" data-type="mention" data-id="user_1">@alex</span>',
          '<span class="editor-mention" data-type="mention" data-id="user_2">@sam</span>',
          "</p>",
        ].join("")
      )
    ).toEqual({
      user_1: 2,
      user_2: 1,
    })
  })

  it("keeps the non-DOM fallback aligned with mention spans only", () => {
    globalThis.DOMParser = undefined as never

    expect(
      extractRichTextMentionUserIds(
        [
          "<p>",
          "<span data-id='user_ignored'>ignored</span>",
          "<span data-type='mention' data-id='user_1'>@alex</span>",
          "<span class='chip editor-mention' data-id='user_2'>@sam</span>",
          "</p>",
        ].join("")
      )
    ).toEqual(["user_1", "user_2"])
  })

  it("supports multiline and unquoted attributes in the non-DOM fallback", () => {
    globalThis.DOMParser = undefined as never

    expect(
      extractRichTextMentionUserIds(
        [
          "<p>",
          `<span
             data-type="mention"
             data-id=user_1
           >@alex</span>`,
          "</p>",
        ].join("")
      )
    ).toEqual(["user_1"])
  })

  it("filters pending mentions to the users that still appear in the document", () => {
    expect(
      filterPendingDocumentMentionsByContent(
        [
          {
            userId: "user_1",
            count: 3,
          },
          {
            userId: "user_2",
            count: 1,
          },
        ],
        '<p><span class="editor-mention" data-type="mention" data-id="user_2" data-label="sam">@sam</span></p>'
      )
    ).toEqual([
      {
        userId: "user_2",
        count: 1,
      },
    ])
  })

  it("summarizes pending mention counts for the send bar", () => {
    expect(
      summarizePendingDocumentMentions([
        {
          userId: "user_1",
          count: 3,
        },
        {
          userId: "user_2",
          count: 1,
        },
      ])
    ).toEqual({
      recipientCount: 2,
      mentionCount: 4,
    })
  })
})

import { describe, expect, it } from "vitest"

import {
  extractRichTextMentionUserIds,
  filterPendingDocumentMentionsByContent,
  summarizePendingDocumentMentions,
} from "@/lib/content/rich-text-mentions"

describe("rich text mentions", () => {
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

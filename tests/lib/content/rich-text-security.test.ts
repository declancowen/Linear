import {
  prepareRichTextMessageForStorage,
  prepareRichTextForStorage,
  sanitizeRichTextMessageContent,
  sanitizeRichTextContent,
} from "@/lib/content/rich-text-security"

describe("rich-text security", () => {
  it("strips scripts, unsafe URLs, and event handlers while preserving allowed markup", () => {
    const sanitized = sanitizeRichTextContent(
      [
        '<p style="text-align:center">',
        '<a href="javascript:alert(1)" target="_blank" onclick="evil()">bad</a>',
        '<a href="/api/calls/join?callId=call_1" target="_blank">join</a>',
        '<img src="https://cdn.example.com/file.png" onerror="evil()" class="editor-image" />',
        '<span class="editor-mention evil" data-type="mention" data-id="user_1" data-label="alex">@alex</span>',
        "<script>alert(1)</script>",
        "</p>",
      ].join("")
    )

    expect(sanitized).toContain('style="text-align:center"')
    expect(sanitized).toContain(
      'href="/api/calls/join?callId=call_1" target="_blank" rel="noopener noreferrer"'
    )
    expect(sanitized).toContain('class="editor-image"')
    expect(sanitized).toContain(
      'class="editor-mention" data-type="mention" data-id="user_1" data-label="alex"'
    )
    expect(sanitized).not.toContain("<script")
    expect(sanitized).not.toContain("javascript:")
    expect(sanitized).not.toContain("onclick")
    expect(sanitized).not.toContain("onerror")
  })

  it("preserves task-list markup and detects when sanitized content loses meaningful text", () => {
    const taskList = sanitizeRichTextContent(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label contenteditable="false"><input type="checkbox" checked><span></span></label><div><p>Task</p></div></li></ul>'
    )

    expect(taskList).toContain('data-type="taskList"')
    expect(taskList).toContain('data-type="taskItem"')
    expect(taskList).toContain("<input")

    const maliciousOnly = prepareRichTextForStorage(
      '<img src="javascript:alert(1)" /><script>alert(1)</script>',
      {
        minPlainTextCharacters: 1,
      }
    )

    expect(maliciousOnly.sanitized).toBe("<img />")
    expect(maliciousOnly.plainText).toBe("")
    expect(maliciousOnly.isMeaningful).toBe(false)
  })

  it("drops raw-text containers instead of reactivating their contents", () => {
    const sanitized = sanitizeRichTextContent(
      "<p>Safe</p><xmp><img src=x onerror=alert(1)><script>alert(1)</script></xmp>"
    )

    expect(sanitized).toBe("<p>Safe</p>")
    expect(sanitized).not.toContain("<img")
    expect(sanitized).not.toContain("<script")
  })

  it("preserves safe entity reference metadata and strips invalid reference attributes", () => {
    const sanitized = sanitizeRichTextContent(
      [
        '<a class="editor-reference editor-reference-workItem evil" data-type="entity-reference" data-reference-type="workItem" data-reference-id="item_1" data-label="PLA-1" href="/items/item_1" onclick="evil()">PLA-1</a>',
        '<a class="editor-reference" data-type="entity-reference" data-reference-type="invalid" data-reference-id="item_2" data-label="Bad" href="/items/item_2">Bad</a>',
        '<a class="editor-reference" data-type="entity-reference" data-reference-type="workItem" data-reference-id="item_3" data-label="External" href="https://example.com">External</a>',
      ].join("")
    )

    expect(sanitized).toContain(
      'class="editor-reference editor-reference-workItem" data-type="entity-reference" data-reference-type="workItem" data-reference-id="item_1" data-label="PLA-1"'
    )
    expect(sanitized).not.toContain("evil")
    expect(sanitized).not.toContain('data-reference-type="invalid"')
    expect(sanitized).not.toContain('data-reference-id="item_2"')
    expect(sanitized).not.toContain('data-label="Bad"')
    expect(sanitized).toContain('data-reference-id="item_3"')
    expect(sanitized).not.toContain('href="https://example.com"')
  })

  it("preserves the preview display variant on entity references", () => {
    const sanitized = sanitizeRichTextContent(
      '<a class="editor-reference editor-reference-workItem editor-reference-preview" data-type="entity-reference" data-reference-type="workItem" data-reference-id="item_1" data-label="PLA-1" data-display="preview" href="/items/item_1">PLA-1</a>'
    )

    expect(sanitized).toContain("editor-reference-preview")
    expect(sanitized).toContain('data-display="preview"')

    const inline = sanitizeRichTextContent(
      '<a class="editor-reference editor-reference-workItem" data-type="entity-reference" data-reference-type="workItem" data-reference-id="item_1" data-label="PLA-1" href="/items/item_1">PLA-1</a>'
    )

    expect(inline).not.toContain("editor-reference-preview")
    expect(inline).not.toContain("data-display")
  })

  it("preserves mixed text anchors outside chat message normalization", () => {
    expect(
      sanitizeRichTextContent(
        '<p><a href="https://example.com">see https://example.com</a></p>'
      )
    ).toBe('<p><a href="https://example.com">see https://example.com</a></p>')
  })

  it("keeps only URL substrings linked when pasted URLs over-extend link marks", () => {
    const prepared = prepareRichTextMessageForStorage(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">hey look at this link https://example.com</a></p>',
      {
        minPlainTextCharacters: 1,
      }
    )

    expect(prepared.sanitized).toBe(
      '<p>hey look at this link <a href="https://example.com" target="_blank" rel="nofollow noopener noreferrer">https://example.com</a></p>'
    )
    expect(prepared.plainText).toBe("hey look at this link https://example.com")
  })

  it("unwraps stale non-url links from chat message content", () => {
    expect(
      sanitizeRichTextMessageContent(
        '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">hey look at this link</a></p>'
      )
    ).toBe("<p>hey look at this link</p>")
  })

  it("preserves only validated chat quote source metadata", () => {
    const sanitized = sanitizeRichTextMessageContent(
      [
        '<blockquote data-chat-source-message-id="message_1" data-bad="x"><p>Quote</p></blockquote>',
        '<blockquote data-chat-source-message-id="bad id"><p>Bad quote</p></blockquote>',
      ].join("")
    )

    expect(sanitized).toContain(
      '<blockquote data-chat-source-message-id="message_1"><p>Quote</p></blockquote>'
    )
    expect(sanitized).toContain("<blockquote><p>Bad quote</p></blockquote>")
    expect(sanitized).not.toContain("data-bad")
    expect(sanitized).not.toContain("bad id")
  })

  it("trims trailing hard breaks and empty blocks from message content", () => {
    const trailingBreaks = prepareRichTextMessageForStorage(
      "<p>Hello<br><br></p>",
      {
        minPlainTextCharacters: 1,
      }
    )

    expect(trailingBreaks.sanitized).toBe("<p>Hello</p>")
    expect(trailingBreaks.plainText).toBe("Hello")
    expect(trailingBreaks.isMeaningful).toBe(true)

    const trailingEmptyParagraphs = prepareRichTextMessageForStorage(
      "<p>Hello<br>World</p><p><br></p><p></p>",
      {
        minPlainTextCharacters: 1,
      }
    )

    expect(trailingEmptyParagraphs.sanitized).toBe("<p>Hello<br>World</p>")
  })

  it("allows local blob URLs while editing but removes them before storage", () => {
    const pendingContent =
      '<p><img src="BLOB:http://local/image" class="editor-image" alt="pending.png" /><a data-type="attachment" class="editor-attachment" href="blob:http://local/file" data-file-name="pending.pdf">pending.pdf</a></p>'

    expect(sanitizeRichTextContent(pendingContent)).toContain(
      'src="BLOB:http://local/image"'
    )
    expect(sanitizeRichTextContent(pendingContent)).toContain(
      'href="blob:http://local/file"'
    )

    const preparedComment = prepareRichTextForStorage(pendingContent)
    const preparedMessage = prepareRichTextMessageForStorage(pendingContent, {
      minPlainTextCharacters: 1,
    })

    expect(preparedComment.sanitized).not.toMatch(/blob:/iu)
    expect(preparedMessage.sanitized).not.toMatch(/blob:/iu)
    expect(preparedMessage.isMeaningful).toBe(false)
  })
})

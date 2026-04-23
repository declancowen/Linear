import {
  prepareRichTextMessageForStorage,
  prepareRichTextForStorage,
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
})

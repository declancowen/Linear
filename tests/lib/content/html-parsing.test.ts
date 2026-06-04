import { afterEach, describe, expect, it, vi } from "vitest"

import { parseHtmlDocument } from "@/lib/content/html-parsing"

describe("html parsing", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("parses HTML without a browser DOMParser", () => {
    vi.stubGlobal("DOMParser", undefined)

    const doc = parseHtmlDocument(
      '<p><a href="https://files.example.com/spec.pdf">spec.pdf</a></p>'
    )

    expect(doc.querySelector("a")?.textContent).toBe("spec.pdf")
  })
})

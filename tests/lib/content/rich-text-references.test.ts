import { afterEach, describe, expect, it } from "vitest"

import { extractRichTextEntityReferences } from "@/lib/content/rich-text-references"

describe("rich text entity references", () => {
  const originalDOMParser = globalThis.DOMParser

  afterEach(() => {
    globalThis.DOMParser = originalDOMParser
  })

  it("extracts unique typed references from entity reference anchors", () => {
    expect(
      extractRichTextEntityReferences(
        [
          "<p>",
          '<a class="editor-reference editor-reference-workItem" data-type="entity-reference" data-reference-type="workItem" data-reference-id="item_1" href="/items/item_1">PLA-1</a>',
          '<a class="editor-reference editor-reference-document" data-type="entity-reference" data-reference-type="document" data-reference-id="doc_1" href="/docs/doc_1">Spec</a>',
          '<a class="editor-reference editor-reference-document" data-type="entity-reference" data-reference-type="document" data-reference-id="doc_1" href="/docs/doc_1">Spec</a>',
          '<a class="editor-reference" data-type="entity-reference" data-reference-type="invalid" data-reference-id="bad">Bad</a>',
          "</p>",
        ].join("")
      )
    ).toEqual([
      {
        type: "workItem",
        id: "item_1",
      },
      {
        type: "document",
        id: "doc_1",
      },
    ])
  })

  it("keeps the non-DOM fallback aligned with safe reference anchors", () => {
    globalThis.DOMParser = undefined as never

    expect(
      extractRichTextEntityReferences(
        [
          "<p>",
          "<a data-reference-type='workItem' data-reference-id='ignored'>Ignored</a>",
          "<a class='chip editor-reference' data-reference-type='project' data-reference-id=project_1>Roadmap</a>",
          `<a
             data-type="entity-reference"
             data-reference-type="view"
             data-reference-id=view_1
           >View</a>`,
          "</p>",
        ].join("")
      )
    ).toEqual([
      {
        type: "project",
        id: "project_1",
      },
      {
        type: "view",
        id: "view_1",
      },
    ])
  })
})

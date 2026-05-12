import { generateHTML, getSchema, type JSONContent } from "@tiptap/core"
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model"
import { parseHTML } from "linkedom"

import {
  getNormalizedStyleValue,
  normalizeCanonicalUrl,
} from "@/lib/collaboration/canonical-content-normalization"
import { extractDocumentTitleFromContent } from "@/lib/content/document-title"
import { createRichTextBaseExtensions } from "@/lib/rich-text/extensions"

const EMPTY_DOCUMENT_HTML = "<p></p>"
const EMPTY_DOCUMENT_JSON: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
}

const richTextExtensions = createRichTextBaseExtensions({
  includeCharacterCount: false,
})
const richTextSchema = getSchema(richTextExtensions)
const ALLOWED_HTML_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "col",
  "colgroup",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "hr",
  "img",
  "input",
  "label",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
])
const ALLOWED_SPAN_CLASSES = new Set(["editor-highlight", "editor-mention"])
const ALLOWED_IMAGE_CLASSES = new Set(["editor-image"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function withDocument<T>(nextDocument: Document, callback: () => T) {
  const documentWithImplementation = nextDocument as Document & {
    implementation?: DOMImplementation & {
      createHTMLDocument: () => Document
    }
  }
  const globalScope = globalThis as typeof globalThis & {
    document?: Document
    window?: Window & typeof globalThis
  }
  const hadDocument = "document" in globalScope
  const hadWindow = "window" in globalScope
  const previousDocument = globalScope.document
  const previousWindow = globalScope.window

  if (!documentWithImplementation.implementation) {
    documentWithImplementation.implementation = {
      createDocument: () => nextDocument,
      createDocumentType: () => nextDocument.doctype ?? ({} as DocumentType),
      createHTMLDocument: () =>
        parseHTML("<!DOCTYPE html><html><head></head><body></body></html>")
          .document,
      hasFeature: () => true,
    }
  }

  globalScope.document = documentWithImplementation
  globalScope.window = {
    document: documentWithImplementation,
  } as Window & typeof globalThis

  try {
    return callback()
  } finally {
    if (hadDocument) {
      globalScope.document = previousDocument
    } else {
      delete (globalScope as { document?: Document }).document
    }

    if (hadWindow) {
      globalScope.window = previousWindow
    } else {
      delete (globalScope as { window?: Window & typeof globalThis }).window
    }
  }
}

export function normalizeCollaborationDocumentJson(
  value: unknown
): JSONContent {
  if (isRecord(value) && typeof value.type === "string") {
    return value as JSONContent
  }

  return EMPTY_DOCUMENT_JSON
}

export function createCanonicalContentJson(contentHtml: string): JSONContent {
  const normalizedHtml = contentHtml.trim() || EMPTY_DOCUMENT_HTML
  const { document } = parseHTML(
    `<!DOCTYPE html><html><head></head><body>${normalizedHtml}</body></html>`
  )
  const parsedDocument = ProseMirrorDOMParser.fromSchema(richTextSchema).parse(
    document.body
  )

  return parsedDocument.toJSON()
}

function serializeCanonicalContentJson(contentJson: JSONContent) {
  const normalizedJson = normalizeCollaborationDocumentJson(contentJson)
  const { document } = parseHTML(
    "<!DOCTYPE html><html><head></head><body></body></html>"
  )

  return withDocument(document, () => {
    const html = generateHTML(normalizedJson, richTextExtensions).trim()

    return html.length > 0 ? html : EMPTY_DOCUMENT_HTML
  })
}

function normalizeClassNames(
  value: string | null,
  allowedClasses: ReadonlySet<string>
) {
  if (!value) {
    return null
  }

  const normalized = value
    .split(/\s+/)
    .map((className) => className.trim())
    .filter((className) => allowedClasses.has(className))

  if (normalized.length === 0) {
    return null
  }

  return [...new Set(normalized)].sort().join(" ")
}

function parseStyleDeclarationEntry(entry: string) {
  const separatorIndex = entry.indexOf(":")

  if (separatorIndex < 0) {
    return null
  }

  const propertyName = entry.slice(0, separatorIndex).trim().toLowerCase()
  const propertyValue = entry.slice(separatorIndex + 1).trim()

  if (propertyName.length === 0 || propertyValue.length === 0) {
    return null
  }

  return {
    propertyName,
    propertyValue,
  }
}

function normalizeStyleDeclaration(tagName: string, styleValue: string | null) {
  if (!styleValue) {
    return null
  }

  const declarations = new Map<string, string>()

  for (const entry of styleValue.split(";")) {
    const parsedEntry = parseStyleDeclarationEntry(entry)

    if (!parsedEntry) {
      continue
    }

    const normalizedValue = getNormalizedStyleValue({
      tagName,
      ...parsedEntry,
    })

    if (normalizedValue) {
      declarations.set(parsedEntry.propertyName, normalizedValue)
    }
  }

  if (declarations.size === 0) {
    return null
  }

  return [...declarations.entries()]
    .map(([propertyName, propertyValue]) => `${propertyName}: ${propertyValue}`)
    .join("; ")
}

function replaceNodeWithChildren(element: Element) {
  const parent = element.parentNode

  if (!parent) {
    element.remove()
    return
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }

  parent.removeChild(element)
}

function setTrimmedAttribute(
  target: Map<string, string>,
  element: Element,
  attributeName: string
) {
  const value = element.getAttribute(attributeName)?.trim()

  if (value) {
    target.set(attributeName, value)
  }
}

function collectAnchorAttributes(
  element: Element,
  target: Map<string, string>
) {
  const href = normalizeCanonicalUrl(
    element.getAttribute("href"),
    new Set(["http", "https", "mailto", "tel"])
  )

  if (href) {
    target.set("href", href)
  }

  if (element.getAttribute("target") === "_blank") {
    target.set("target", "_blank")
    target.set("rel", "noopener noreferrer")
  }
}

function collectStyledBlockAttributes(
  tagName: string,
  element: Element,
  target: Map<string, string>
) {
  const style = normalizeStyleDeclaration(
    tagName,
    element.getAttribute("style")
  )

  if (style) {
    target.set("style", style)
  }

  if (tagName === "td" || tagName === "th") {
    setTrimmedAttribute(target, element, "colspan")
    setTrimmedAttribute(target, element, "rowspan")
    setTrimmedAttribute(target, element, "colwidth")
  }
}

function collectImageAttributes(element: Element, target: Map<string, string>) {
  const src = normalizeCanonicalUrl(
    element.getAttribute("src"),
    new Set(["http", "https"])
  )

  if (src) {
    target.set("src", src)
  }

  const className = normalizeClassNames(
    element.getAttribute("class"),
    ALLOWED_IMAGE_CLASSES
  )

  setTrimmedAttribute(target, element, "alt")
  setTrimmedAttribute(target, element, "title")

  if (className) {
    target.set("class", className)
  }
}

function collectInputAttributes(element: Element, target: Map<string, string>) {
  if (element.getAttribute("type")?.trim().toLowerCase() === "checkbox") {
    target.set("type", "checkbox")
  }

  if (element.hasAttribute("checked")) {
    target.set("checked", "")
  }

  if (element.hasAttribute("disabled")) {
    target.set("disabled", "")
  }
}

function collectSpanAttributes(element: Element, target: Map<string, string>) {
  const className = normalizeClassNames(
    element.getAttribute("class"),
    ALLOWED_SPAN_CLASSES
  )

  if (className) {
    target.set("class", className)
  }

  setTrimmedAttribute(target, element, "data-type")
  setTrimmedAttribute(target, element, "data-id")
  setTrimmedAttribute(target, element, "data-label")
}

type AttributeCollector = (
  tagName: string,
  element: Element,
  target: Map<string, string>
) => void

const styledBlockTagNames = new Set(["col", "p", "h1", "h2", "h3", "td", "th"])

const attributeCollectors: Record<string, AttributeCollector> = {
  a: (_tagName, element, target) => collectAnchorAttributes(element, target),
  div: (tagName, element, target) =>
    setTrimmedAttribute(target, element, getDataAttributeForTag(tagName)),
  img: (_tagName, element, target) => collectImageAttributes(element, target),
  input: (_tagName, element, target) => collectInputAttributes(element, target),
  label: (tagName, element, target) =>
    setTrimmedAttribute(target, element, getDataAttributeForTag(tagName)),
  li: (_tagName, element, target) => {
    setTrimmedAttribute(target, element, "data-type")
    setTrimmedAttribute(target, element, "data-checked")
  },
  span: (_tagName, element, target) => collectSpanAttributes(element, target),
  ul: (tagName, element, target) =>
    setTrimmedAttribute(target, element, getDataAttributeForTag(tagName)),
}

for (const tagName of styledBlockTagNames) {
  attributeCollectors[tagName] = (blockTagName, element, target) =>
    collectStyledBlockAttributes(blockTagName, element, target)
}

function getDataAttributeForTag(tagName: string) {
  return tagName === "label" ? "contenteditable" : "data-type"
}

function collectAllowedAttributes(tagName: string, element: Element) {
  const nextAttributes = new Map<string, string>()
  const collectAttributes = attributeCollectors[tagName]

  if (collectAttributes) {
    collectAttributes(tagName, element, nextAttributes)
  }

  return nextAttributes
}

function sanitizeCollaborationElement(element: Element) {
  const tagName = element.tagName.toLowerCase()

  if (!ALLOWED_HTML_TAGS.has(tagName)) {
    replaceNodeWithChildren(element)
    return
  }

  const nextAttributes = collectAllowedAttributes(tagName, element)

  for (const attributeName of element.getAttributeNames()) {
    element.removeAttribute(attributeName)
  }

  for (const [attributeName, attributeValue] of nextAttributes.entries()) {
    element.setAttribute(attributeName, attributeValue)
  }

  for (const childNode of [...element.children]) {
    sanitizeCollaborationElement(childNode)
  }
}

function sanitizeCollaborationHtml(contentHtml: string) {
  const normalizedHtml = contentHtml.trim() || EMPTY_DOCUMENT_HTML
  const { document } = parseHTML(
    `<!DOCTYPE html><html><head></head><body>${normalizedHtml}</body></html>`
  )

  for (const childNode of [...document.body.children]) {
    sanitizeCollaborationElement(childNode)
  }

  const sanitizedHtml = document.body.innerHTML.trim()
  return sanitizedHtml.length > 0 ? sanitizedHtml : EMPTY_DOCUMENT_HTML
}

export function prepareCanonicalCollaborationContent(contentJson: JSONContent) {
  const serializedHtml = serializeCanonicalContentJson(contentJson)
  const contentHtml = sanitizeCollaborationHtml(serializedHtml)

  return {
    contentHtml,
    derivedTitle: extractDocumentTitleFromContent(contentHtml),
  }
}

import {
  generateHTML,
  getSchema,
  type JSONContent,
} from "@tiptap/core"
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model"
import { parseHTML } from "linkedom"

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
const ALLOWED_TEXT_ALIGN_VALUES = new Set(["left", "center", "right", "justify"])
const LENGTH_STYLE_VALUE = /^\d+(\.\d+)?(px|%)$/
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
      createDocumentType: () =>
        nextDocument.doctype ?? ({} as DocumentType),
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

export function normalizeCollaborationDocumentJson(value: unknown): JSONContent {
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

export function serializeCanonicalContentJson(contentJson: JSONContent) {
  const normalizedJson = normalizeCollaborationDocumentJson(contentJson)
  const { document } = parseHTML(
    "<!DOCTYPE html><html><head></head><body></body></html>"
  )

  return withDocument(document, () => {
    const html = generateHTML(normalizedJson, richTextExtensions).trim()

    return html.length > 0 ? html : EMPTY_DOCUMENT_HTML
  })
}

function normalizeUrl(
  value: string | null,
  allowedSchemes: ReadonlySet<string>
) {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim()

  if (normalizedValue.length === 0) {
    return null
  }

  const schemeMatch = normalizedValue.match(/^([a-z][a-z0-9+.-]*):/i)

  if (!schemeMatch) {
    return null
  }

  const scheme = schemeMatch[1]?.toLowerCase()

  if (!scheme || !allowedSchemes.has(scheme)) {
    return null
  }

  return normalizedValue
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

function normalizeLengthStyleValue(value: string | null) {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()
  return LENGTH_STYLE_VALUE.test(normalizedValue) ? normalizedValue : null
}

function normalizeTextAlignValue(value: string | null) {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()
  return ALLOWED_TEXT_ALIGN_VALUES.has(normalizedValue)
    ? normalizedValue
    : null
}

function normalizeStyleDeclaration(tagName: string, styleValue: string | null) {
  if (!styleValue) {
    return null
  }

  const declarations = new Map<string, string>()

  for (const entry of styleValue.split(";")) {
    const separatorIndex = entry.indexOf(":")

    if (separatorIndex < 0) {
      continue
    }

    const propertyName = entry.slice(0, separatorIndex).trim().toLowerCase()
    const propertyValue = entry.slice(separatorIndex + 1).trim()

    if (propertyName.length === 0 || propertyValue.length === 0) {
      continue
    }

    if (
      (tagName === "col" || tagName === "td" || tagName === "th") &&
      (propertyName === "width" || propertyName === "min-width")
    ) {
      const normalizedValue = normalizeLengthStyleValue(propertyValue)

      if (normalizedValue) {
        declarations.set(propertyName, normalizedValue)
      }

      continue
    }

    if (
      (tagName === "p" ||
        tagName === "h1" ||
        tagName === "h2" ||
        tagName === "h3" ||
        tagName === "td" ||
        tagName === "th") &&
      propertyName === "text-align"
    ) {
      const normalizedValue = normalizeTextAlignValue(propertyValue)

      if (normalizedValue) {
        declarations.set(propertyName, normalizedValue)
      }
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

function sanitizeCollaborationElement(element: Element) {
  const tagName = element.tagName.toLowerCase()

  if (!ALLOWED_HTML_TAGS.has(tagName)) {
    replaceNodeWithChildren(element)
    return
  }

  const nextAttributes = new Map<string, string>()

  switch (tagName) {
    case "a": {
      const href = normalizeUrl(element.getAttribute("href"), new Set(["http", "https", "mailto", "tel"]))

      if (href) {
        nextAttributes.set("href", href)
      }

      if (element.getAttribute("target") === "_blank") {
        nextAttributes.set("target", "_blank")
        nextAttributes.set("rel", "noopener noreferrer")
      }

      break
    }

    case "col":
    case "p":
    case "h1":
    case "h2":
    case "h3":
    case "td":
    case "th": {
      const style = normalizeStyleDeclaration(tagName, element.getAttribute("style"))

      if (style) {
        nextAttributes.set("style", style)
      }

      if (tagName === "td" || tagName === "th") {
        const colspan = element.getAttribute("colspan")?.trim()
        const rowspan = element.getAttribute("rowspan")?.trim()
        const colwidth = element.getAttribute("colwidth")?.trim()

        if (colspan) {
          nextAttributes.set("colspan", colspan)
        }

        if (rowspan) {
          nextAttributes.set("rowspan", rowspan)
        }

        if (colwidth) {
          nextAttributes.set("colwidth", colwidth)
        }
      }

      break
    }

    case "div": {
      const dataType = element.getAttribute("data-type")?.trim()

      if (dataType) {
        nextAttributes.set("data-type", dataType)
      }

      break
    }

    case "img": {
      const src = normalizeUrl(element.getAttribute("src"), new Set(["http", "https"]))

      if (src) {
        nextAttributes.set("src", src)
      }

      const alt = element.getAttribute("alt")?.trim()
      const title = element.getAttribute("title")?.trim()
      const className = normalizeClassNames(
        element.getAttribute("class"),
        ALLOWED_IMAGE_CLASSES
      )

      if (alt) {
        nextAttributes.set("alt", alt)
      }

      if (title) {
        nextAttributes.set("title", title)
      }

      if (className) {
        nextAttributes.set("class", className)
      }

      break
    }

    case "input": {
      if (element.getAttribute("type")?.trim().toLowerCase() === "checkbox") {
        nextAttributes.set("type", "checkbox")
      }

      if (element.hasAttribute("checked")) {
        nextAttributes.set("checked", "")
      }

      if (element.hasAttribute("disabled")) {
        nextAttributes.set("disabled", "")
      }

      break
    }

    case "label": {
      const contentEditable = element.getAttribute("contenteditable")?.trim()

      if (contentEditable) {
        nextAttributes.set("contenteditable", contentEditable)
      }

      break
    }

    case "li": {
      const dataType = element.getAttribute("data-type")?.trim()
      const dataChecked = element.getAttribute("data-checked")?.trim()

      if (dataType) {
        nextAttributes.set("data-type", dataType)
      }

      if (dataChecked) {
        nextAttributes.set("data-checked", dataChecked)
      }

      break
    }

    case "span": {
      const className = normalizeClassNames(
        element.getAttribute("class"),
        ALLOWED_SPAN_CLASSES
      )
      const dataType = element.getAttribute("data-type")?.trim()
      const dataId = element.getAttribute("data-id")?.trim()
      const dataLabel = element.getAttribute("data-label")?.trim()

      if (className) {
        nextAttributes.set("class", className)
      }

      if (dataType) {
        nextAttributes.set("data-type", dataType)
      }

      if (dataId) {
        nextAttributes.set("data-id", dataId)
      }

      if (dataLabel) {
        nextAttributes.set("data-label", dataLabel)
      }

      break
    }

    case "ul": {
      const dataType = element.getAttribute("data-type")?.trim()

      if (dataType) {
        nextAttributes.set("data-type", dataType)
      }

      break
    }
  }

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

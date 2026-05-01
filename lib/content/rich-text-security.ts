import sanitizeHtml from "sanitize-html"
import { parseHTML } from "linkedom"

import { getPlainTextContent } from "@/lib/utils"

const TEXT_ALIGN_STYLE_VALUES = [/^left$/, /^center$/, /^right$/, /^justify$/]

const LENGTH_STYLE_VALUES = [/^\d+(\.\d+)?(px|%)$/]

const RICH_TEXT_ALLOWED_TAGS = [
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
] satisfies string[]

const RICH_TEXT_EMBEDDED_CONTENT_TAGS = new Set(["hr", "img", "input", "table"])

function normalizeAnchorAttributes(attributes: sanitizeHtml.Attributes) {
  const href =
    typeof attributes.href === "string" ? attributes.href.trim() : null
  const target = attributes.target === "_blank" ? "_blank" : null
  const relValues = new Set(
    typeof attributes.rel === "string"
      ? attributes.rel
          .split(/\s+/)
          .map((value) => value.trim())
          .filter(Boolean)
      : []
  )

  if (target === "_blank") {
    relValues.add("noopener")
    relValues.add("noreferrer")
  }

  return {
    ...(href ? { href } : {}),
    ...(target ? { target } : {}),
    ...(relValues.size > 0 ? { rel: [...relValues].sort().join(" ") } : {}),
  }
}

const RICH_TEXT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: RICH_TEXT_ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "target", "rel"],
    col: ["style"],
    div: ["data-type"],
    h1: ["style"],
    h2: ["style"],
    h3: ["style"],
    img: ["src", "alt", "title", "class"],
    input: ["type", "checked", "disabled"],
    label: ["contenteditable"],
    li: ["data-type", "data-checked"],
    p: ["style"],
    span: ["class", "data-type", "data-id", "data-label"],
    td: ["colspan", "rowspan", "colwidth", "style"],
    th: ["colspan", "rowspan", "colwidth", "style"],
    ul: ["data-type"],
  },
  allowedClasses: {
    img: ["editor-image"],
    span: ["editor-highlight", "editor-mention"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowedSchemesByTag: {
    img: ["http", "https"],
  },
  allowedStyles: {
    col: {
      width: LENGTH_STYLE_VALUES,
      "min-width": LENGTH_STYLE_VALUES,
    },
    h1: {
      "text-align": TEXT_ALIGN_STYLE_VALUES,
    },
    h2: {
      "text-align": TEXT_ALIGN_STYLE_VALUES,
    },
    h3: {
      "text-align": TEXT_ALIGN_STYLE_VALUES,
    },
    p: {
      "text-align": TEXT_ALIGN_STYLE_VALUES,
    },
    td: {
      width: LENGTH_STYLE_VALUES,
      "min-width": LENGTH_STYLE_VALUES,
      "text-align": TEXT_ALIGN_STYLE_VALUES,
    },
    th: {
      width: LENGTH_STYLE_VALUES,
      "min-width": LENGTH_STYLE_VALUES,
      "text-align": TEXT_ALIGN_STYLE_VALUES,
    },
  },
  nonBooleanAttributes: [
    ...sanitizeHtml.defaults.nonBooleanAttributes,
    "data-type",
    "data-id",
    "data-label",
    "data-checked",
    "colwidth",
  ],
  transformTags: {
    a: (_tagName, attributes) => ({
      tagName: "a",
      attribs: normalizeAnchorAttributes(attributes),
    }),
  },
}

export function sanitizeRichTextContent(content: string) {
  return sanitizeHtml(content, RICH_TEXT_SANITIZE_OPTIONS).trim()
}

function hasMeaningfulRichTextNode(node: Node): boolean {
  if (node.nodeType === 3) {
    return (node.textContent ?? "").trim().length > 0
  }

  if (node.nodeType !== 1) {
    return false
  }

  const element = node as HTMLElement
  const tagName = element.tagName.toLowerCase()

  if (RICH_TEXT_EMBEDDED_CONTENT_TAGS.has(tagName)) {
    return true
  }

  return [...element.childNodes].some((child) =>
    hasMeaningfulRichTextNode(child)
  )
}

function trimTrailingTextNode(node: ChildNode) {
  const textContent = node.textContent ?? ""
  const trimmedTextContent = textContent.replace(/\s+$/u, "")

  if (trimmedTextContent.length === 0) {
    node.remove()
    return true
  }

  if (trimmedTextContent !== textContent) {
    node.textContent = trimmedTextContent
  }

  return false
}

function trimTrailingRichTextNode(node: ChildNode) {
  if (node.nodeType === 3) {
    return trimTrailingTextNode(node)
  }

  if (node.nodeType !== 1) {
    node.remove()
    return true
  }

  const element = node as HTMLElement

  if (element.tagName.toLowerCase() === "br") {
    element.remove()
    return true
  }

  trimTrailingRichTextNodes(element)

  if (!hasMeaningfulRichTextNode(element)) {
    element.remove()
    return true
  }

  return false
}

function trimTrailingRichTextNodes(container: ParentNode) {
  while (container.lastChild) {
    const shouldContinue = trimTrailingRichTextNode(container.lastChild)

    if (!shouldContinue) {
      return
    }
  }
}

export function trimTrailingRichTextDisplayWhitespace(content: string) {
  const trimmedContent = content.trim()

  if (trimmedContent.length === 0) {
    return ""
  }

  const { document } = parseHTML(
    `<!DOCTYPE html><html><head></head><body>${trimmedContent}</body></html>`
  )

  trimTrailingRichTextNodes(document.body)

  return document.body.innerHTML.trim()
}

function sanitizeRichTextMessageContent(content: string) {
  const sanitized = sanitizeRichTextContent(content)
  const normalized = trimTrailingRichTextDisplayWhitespace(sanitized)

  return normalized.length > 0 ? normalized : sanitized
}

export function prepareRichTextForStorage(
  content: string,
  options?: {
    minPlainTextCharacters?: number
  }
) {
  const sanitized = sanitizeRichTextContent(content)
  const plainText = getPlainTextContent(sanitized)
  const minPlainTextCharacters = options?.minPlainTextCharacters ?? 0

  return {
    sanitized,
    plainText,
    isMeaningful: plainText.length >= minPlainTextCharacters,
  }
}

export function prepareRichTextMessageForStorage(
  content: string,
  options?: {
    minPlainTextCharacters?: number
  }
) {
  const sanitized = sanitizeRichTextMessageContent(content)
  const plainText = getPlainTextContent(sanitized)
  const minPlainTextCharacters = options?.minPlainTextCharacters ?? 0

  return {
    sanitized,
    plainText,
    isMeaningful: plainText.length >= minPlainTextCharacters,
  }
}

import { parseHTML } from "linkedom"

import {
  CHAT_QUOTE_SOURCE_MESSAGE_ID_ATTRIBUTE,
  normalizeChatQuoteSourceMessageId,
} from "@/lib/content/chat-message-quote-metadata"
import { normalizeRichTextAttachmentId } from "@/lib/content/rich-text-attachment-metadata"
import { isRichTextEntityReferenceType } from "@/lib/content/rich-text-references"
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

const RICH_TEXT_ALLOWED_TAG_SET = new Set<string>(RICH_TEXT_ALLOWED_TAGS)

const RICH_TEXT_EMBEDDED_CONTENT_TAGS = new Set(["hr", "img", "input", "table"])

const RICH_TEXT_DROP_CONTENT_TAGS = new Set([
  "script",
  "style",
  "textarea",
  "option",
  "xmp",
])

const RICH_TEXT_VOID_TAGS = new Set(["br", "hr", "img", "input"])

const RICH_TEXT_BOOLEAN_ATTRIBUTES = new Set(["checked", "disabled"])

const RICH_TEXT_ALLOWED_ATTRIBUTES: Record<string, readonly string[]> = {
  a: [
    "href",
    "target",
    "rel",
    "class",
    "data-type",
    "data-reference-type",
    "data-reference-id",
    "data-label",
    "data-display",
    "data-attachment-id",
    "data-attachment-kind",
    "data-file-name",
  ],
  blockquote: [CHAT_QUOTE_SOURCE_MESSAGE_ID_ATTRIBUTE],
  col: ["style"],
  div: ["data-type"],
  h1: ["style"],
  h2: ["style"],
  h3: ["style"],
  img: ["src", "alt", "title", "class", "data-attachment-id"],
  input: ["type", "checked", "disabled"],
  label: ["contenteditable"],
  li: ["data-type", "data-checked"],
  p: ["style"],
  span: ["class", "data-type", "data-id", "data-label"],
  td: ["colspan", "rowspan", "colwidth", "style"],
  th: ["colspan", "rowspan", "colwidth", "style"],
  ul: ["data-type"],
}

const RICH_TEXT_ALLOWED_CLASSES: Record<string, readonly string[]> = {
  a: [
    "editor-attachment",
    "editor-reference",
    "editor-reference-document",
    "editor-reference-project",
    "editor-reference-view",
    "editor-reference-workItem",
    "editor-reference-preview",
  ],
  img: ["editor-image"],
  span: ["editor-highlight", "editor-mention"],
}

const RICH_TEXT_ALLOWED_STYLES: Record<
  string,
  Record<string, readonly RegExp[]>
> = {
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
}

const INLINE_URL_PATTERN = /https?:\/\/[^\s<>"']+/giu

function getAttributeMap(element: Element) {
  return Object.fromEntries(
    [...element.attributes].map((attribute) => [
      attribute.name.toLowerCase(),
      attribute.value,
    ])
  )
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/"/g, "&quot;")
}

function isSafeUrlAttribute(
  tagName: string,
  attributeName: string,
  value: string
) {
  if (attributeName !== "href" && attributeName !== "src") {
    return true
  }

  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return false
  }

  const compactValue = trimmedValue
    .replace(/[\u0000-\u001F\u007F\s]+/gu, "")
    .toLowerCase()
  const schemeMatch = compactValue.match(/^([a-z][a-z0-9+.-]*):/u)

  if (!schemeMatch) {
    return true
  }

  const scheme = schemeMatch[1]

  if (tagName === "img") {
    return scheme === "http" || scheme === "https" || scheme === "blob"
  }

  return (
    scheme === "http" ||
    scheme === "https" ||
    scheme === "mailto" ||
    scheme === "tel" ||
    scheme === "blob"
  )
}

function isLocalBlobUrl(value: string | null | undefined) {
  const compactValue =
    value
      ?.trim()
      .replace(/[\u0000-\u001F\u007F\s]+/gu, "")
      .toLowerCase() ?? ""

  return compactValue.startsWith("blob:")
}

function removeLocalBlobUrlsFromStorageContent(content: string) {
  if (!/blob:/iu.test(content) && !content.includes('data-type="attachment"')) {
    return content
  }

  const { document } = parseHTML(
    `<!DOCTYPE html><html><head></head><body>${content}</body></html>`
  )

  document.body.querySelectorAll("img[src]").forEach((element) => {
    const src = element.getAttribute("src")

    if (isLocalBlobUrl(src)) {
      element.remove()
    }
  })

  document.body.querySelectorAll("a[href]").forEach((element) => {
    const href = element.getAttribute("href")

    if (!isLocalBlobUrl(href) && href) {
      return
    }

    if (element.getAttribute("data-type") === "attachment") {
      element.remove()
      return
    }

    element.replaceWith(...[...element.childNodes])
  })

  return document.body.innerHTML.trim()
}

function sanitizeStyleAttribute(tagName: string, value: string) {
  const allowedStyles = RICH_TEXT_ALLOWED_STYLES[tagName]

  if (!allowedStyles) {
    return null
  }

  const sanitizedDeclarations = value
    .split(";")
    .map((declaration) => declaration.trim())
    .map((declaration) => {
      const separatorIndex = declaration.indexOf(":")

      if (separatorIndex === -1) {
        return null
      }

      const property = declaration.slice(0, separatorIndex).trim().toLowerCase()
      const propertyValue = declaration.slice(separatorIndex + 1).trim()
      const allowedValues = allowedStyles[property]

      if (!allowedValues?.some((pattern) => pattern.test(propertyValue))) {
        return null
      }

      return `${property}:${propertyValue}`
    })
    .filter((declaration): declaration is string => Boolean(declaration))

  return sanitizedDeclarations.length > 0
    ? sanitizedDeclarations.join(";")
    : null
}

function sanitizeClassAttribute(tagName: string, value: string) {
  const allowedClasses = RICH_TEXT_ALLOWED_CLASSES[tagName]

  if (!allowedClasses) {
    return null
  }

  const sanitizedClasses = value
    .split(/\s+/u)
    .map((className) => className.trim())
    .filter((className) => allowedClasses.includes(className))

  return sanitizedClasses.length > 0 ? sanitizedClasses.join(" ") : null
}

function getAnchorRelValues(rel: string | undefined, target: string | null) {
  const relValues = new Set(
    rel
      ?.split(/\s+/u)
      .map((value) => value.trim())
      .filter(Boolean) ?? []
  )

  if (target === "_blank") {
    relValues.add("noopener")
    relValues.add("noreferrer")
  }

  return relValues
}

function normalizeAttachmentAnchorAttributes(
  attributes: Record<string, string>,
  href: string | null
) {
  const relValues = getAnchorRelValues(attributes.rel, "_blank")
  const attachmentId = normalizeRichTextAttachmentId(
    attributes["data-attachment-id"]
  )
  const attachmentKind = attributes["data-attachment-kind"]?.trim()
  const fileName = attributes["data-file-name"]?.trim()
  const safeHref = href && isSafeUrlAttribute("a", "href", href) ? href : null

  return {
    ...(safeHref ? { href: safeHref } : {}),
    target: "_blank",
    rel: [...relValues].sort().join(" "),
    class: "editor-attachment",
    "data-type": "attachment",
    ...(attachmentId ? { "data-attachment-id": attachmentId } : {}),
    ...(attachmentKind ? { "data-attachment-kind": attachmentKind } : {}),
    ...(fileName ? { "data-file-name": fileName } : {}),
  }
}

function getEntityReferenceAttributes(attributes: Record<string, string>) {
  const dataType =
    attributes["data-type"] === "entity-reference" ? "entity-reference" : null
  const referenceType = isRichTextEntityReferenceType(
    attributes["data-reference-type"]
  )
    ? attributes["data-reference-type"]
    : null
  const referenceId = attributes["data-reference-id"]?.trim() ?? null
  const referenceLabel = attributes["data-label"]?.trim() ?? null
  const referenceDisplay =
    attributes["data-display"]?.trim() === "preview" ? "preview" : null
  return dataType && referenceType && referenceId
    ? {
        "data-type": dataType,
        "data-reference-type": referenceType,
        "data-reference-id": referenceId,
        ...(referenceLabel ? { "data-label": referenceLabel } : {}),
        ...(referenceDisplay ? { "data-display": referenceDisplay } : {}),
      }
    : null
}

function getSafeAnchorHref(
  href: string | null,
  entityReferenceAttributes: ReturnType<typeof getEntityReferenceAttributes>
) {
  if (!href || !isSafeUrlAttribute("a", "href", href)) {
    return null
  }

  if (
    entityReferenceAttributes &&
    !href.startsWith("/") &&
    !href.startsWith("#")
  ) {
    return null
  }

  return href
}

function normalizeAnchorAttributes(attributes: Record<string, string>) {
  const href = attributes.href?.trim() ?? null
  const target = attributes.target === "_blank" ? "_blank" : null
  const className = attributes.class
    ? sanitizeClassAttribute("a", attributes.class)
    : null

  if (isAttachmentAnchor(attributes)) {
    return normalizeAttachmentAnchorAttributes(attributes, href)
  }

  const entityReferenceAttributes = getEntityReferenceAttributes(attributes)
  const safeHref = getSafeAnchorHref(href, entityReferenceAttributes)
  const relValues = getAnchorRelValues(attributes.rel, target)

  return {
    ...(safeHref ? { href: safeHref } : {}),
    ...(target ? { target } : {}),
    ...(relValues.size > 0 ? { rel: [...relValues].sort().join(" ") } : {}),
    ...(className ? { class: className } : {}),
    ...(entityReferenceAttributes ?? {}),
  }
}

function sanitizeAttribute(
  tagName: string,
  attributeName: string,
  value: string,
  attributes: Record<string, string>
) {
  if (tagName === "a") {
    const normalizedAttributes = normalizeAnchorAttributes(attributes)
    return normalizedAttributes[
      attributeName as keyof typeof normalizedAttributes
    ]
  }

  if (!RICH_TEXT_ALLOWED_ATTRIBUTES[tagName]?.includes(attributeName)) {
    return null
  }

  if (attributeName === "style") {
    return sanitizeStyleAttribute(tagName, value)
  }

  if (attributeName === "class") {
    return sanitizeClassAttribute(tagName, value)
  }

  if (
    tagName === "blockquote" &&
    attributeName === CHAT_QUOTE_SOURCE_MESSAGE_ID_ATTRIBUTE
  ) {
    return normalizeChatQuoteSourceMessageId(value)
  }

  if (attributeName === "data-attachment-id") {
    return normalizeRichTextAttachmentId(value)
  }

  if (!isSafeUrlAttribute(tagName, attributeName, value)) {
    return null
  }

  return value.trim()
}

function isEntityReferenceAnchor(attributes: Record<string, string>) {
  return (
    attributes["data-type"] === "entity-reference" &&
    isRichTextEntityReferenceType(attributes["data-reference-type"]) &&
    Boolean(attributes["data-reference-id"]?.trim())
  )
}

function isAttachmentAnchor(attributes: Record<string, string>) {
  return attributes["data-type"] === "attachment"
}

function hasOnlyTextChildren(element: Element) {
  return [...element.childNodes].every((child) => child.nodeType === 3)
}

function isSingleUrlText(value: string) {
  const trimmedValue = value.trim()
  const matches = [...trimmedValue.matchAll(INLINE_URL_PATTERN)]

  return matches.length === 1 && matches[0]?.[0] === trimmedValue
}

function normalizeMixedTextAnchor(element: Element) {
  const attributes = getAttributeMap(element)

  if (isEntityReferenceAnchor(attributes) || !hasOnlyTextChildren(element)) {
    return null
  }

  if (isAttachmentAnchor(attributes)) {
    return null
  }

  const textContent = element.textContent ?? ""
  const matches = [...textContent.matchAll(INLINE_URL_PATTERN)]

  if (matches.length === 0 || isSingleUrlText(textContent)) {
    return null
  }

  let cursor = 0
  const parts: string[] = []

  for (const match of matches) {
    const url = match[0]
    const index = match.index ?? 0

    parts.push(escapeHtml(textContent.slice(cursor, index)))

    const anchorAttributes = normalizeAnchorAttributes({
      ...attributes,
      href: url,
    })
    const attributesFragment = Object.entries(anchorAttributes)
      .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
      .join(" ")

    parts.push(
      `<a${attributesFragment ? ` ${attributesFragment}` : ""}>${escapeHtml(url)}</a>`
    )
    cursor = index + url.length
  }

  parts.push(escapeHtml(textContent.slice(cursor)))

  return parts.join("")
}

function sanitizeElementAttributes(element: Element, tagName: string) {
  const attributes = getAttributeMap(element)
  const attributeNames =
    tagName === "a"
      ? RICH_TEXT_ALLOWED_ATTRIBUTES.a
      : (RICH_TEXT_ALLOWED_ATTRIBUTES[tagName] ?? [])

  return attributeNames
    .map((attributeName) => {
      if (
        !Object.hasOwn(attributes, attributeName) &&
        !(tagName === "a" && attributeName === "rel")
      ) {
        return null
      }

      if (RICH_TEXT_BOOLEAN_ATTRIBUTES.has(attributeName)) {
        return attributeName
      }

      const value = sanitizeAttribute(
        tagName,
        attributeName,
        attributes[attributeName] ?? "",
        attributes
      )

      return value ? `${attributeName}="${escapeAttribute(value)}"` : null
    })
    .filter((attribute): attribute is string => Boolean(attribute))
    .join(" ")
}

function serializePrimitiveRichTextNode(node: Node) {
  if (node.nodeType === 3) {
    return escapeHtml(node.textContent ?? "")
  }

  if (node.nodeType !== 1) {
    return ""
  }

  return null
}

function serializeSanitizedElement(
  tagName: string,
  attributes: string,
  content: string
) {
  if (!RICH_TEXT_ALLOWED_TAG_SET.has(tagName)) {
    return content
  }

  const attributesFragment = attributes ? ` ${attributes}` : ""

  if (tagName === "br" || tagName === "hr") {
    return `<${tagName}${attributesFragment}>`
  }

  if (RICH_TEXT_VOID_TAGS.has(tagName)) {
    return `<${tagName}${attributesFragment} />`
  }

  return `<${tagName}${attributesFragment}>${content}</${tagName}>`
}

function sanitizeNode(node: Node): string {
  const primitiveNode = serializePrimitiveRichTextNode(node)

  if (primitiveNode !== null) {
    return primitiveNode
  }

  const element = node as Element
  const tagName = element.tagName.toLowerCase()

  if (RICH_TEXT_DROP_CONTENT_TAGS.has(tagName)) {
    return ""
  }

  const content = [...element.childNodes].map(sanitizeNode).join("")

  if (!RICH_TEXT_ALLOWED_TAG_SET.has(tagName)) {
    return content
  }

  const attributes = sanitizeElementAttributes(element, tagName)
  return serializeSanitizedElement(tagName, attributes, content)
}

function normalizeMessageLinkNode(node: Node): string {
  const primitiveNode = serializePrimitiveRichTextNode(node)

  if (primitiveNode !== null) {
    return primitiveNode
  }

  const element = node as Element
  const tagName = element.tagName.toLowerCase()
  const attributes = getAttributeMap(element)

  if (
    tagName === "a" &&
    !isEntityReferenceAnchor(attributes) &&
    !isAttachmentAnchor(attributes)
  ) {
    const mixedTextAnchor = normalizeMixedTextAnchor(element)

    if (mixedTextAnchor !== null) {
      return mixedTextAnchor
    }

    if (!isSingleUrlText(element.textContent ?? "")) {
      return [...element.childNodes].map(normalizeMessageLinkNode).join("")
    }
  }

  const content = [...element.childNodes].map(normalizeMessageLinkNode).join("")
  const sanitizedAttributes = sanitizeElementAttributes(element, tagName)
  return serializeSanitizedElement(tagName, sanitizedAttributes, content)
}

export function sanitizeRichTextContent(content: string) {
  const { document } = parseHTML(
    `<!DOCTYPE html><html><head></head><body>${content}</body></html>`
  )

  return [...document.body.childNodes].map(sanitizeNode).join("").trim()
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

export function sanitizeRichTextMessageContent(content: string) {
  const sanitized = sanitizeRichTextContent(content)
  const { document } = parseHTML(
    `<!DOCTYPE html><html><head></head><body>${sanitized}</body></html>`
  )
  const messageLinkNormalized = [...document.body.childNodes]
    .map(normalizeMessageLinkNode)
    .join("")
  const normalized = trimTrailingRichTextDisplayWhitespace(
    messageLinkNormalized
  )

  return normalized.length > 0 ? normalized : sanitized
}

export function prepareRichTextForStorage(
  content: string,
  options?: {
    minPlainTextCharacters?: number
  }
) {
  const sanitized = removeLocalBlobUrlsFromStorageContent(
    sanitizeRichTextContent(content)
  )
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
  const sanitized = removeLocalBlobUrlsFromStorageContent(
    sanitizeRichTextMessageContent(content)
  )
  const plainText = getPlainTextContent(sanitized)
  const minPlainTextCharacters = options?.minPlainTextCharacters ?? 0

  return {
    sanitized,
    plainText,
    isMeaningful: plainText.length >= minPlainTextCharacters,
  }
}

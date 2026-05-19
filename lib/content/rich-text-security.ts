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
}

const RICH_TEXT_ALLOWED_CLASSES: Record<string, readonly string[]> = {
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

function isSafeUrlAttribute(tagName: string, attributeName: string, value: string) {
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
    return scheme === "http" || scheme === "https"
  }

  return (
    scheme === "http" ||
    scheme === "https" ||
    scheme === "mailto" ||
    scheme === "tel"
  )
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

function normalizeAnchorAttributes(attributes: Record<string, string>) {
  const href = attributes.href?.trim() ?? null
  const target = attributes.target === "_blank" ? "_blank" : null
  const relValues = new Set(
    attributes.rel
      ?.split(/\s+/u)
      .map((value) => value.trim())
      .filter(Boolean) ?? []
  )

  if (target === "_blank") {
    relValues.add("noopener")
    relValues.add("noreferrer")
  }

  return {
    ...(href && isSafeUrlAttribute("a", "href", href) ? { href } : {}),
    ...(target ? { target } : {}),
    ...(relValues.size > 0 ? { rel: [...relValues].sort().join(" ") } : {}),
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
    return normalizedAttributes[attributeName as keyof typeof normalizedAttributes]
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

  if (!isSafeUrlAttribute(tagName, attributeName, value)) {
    return null
  }

  return value.trim()
}

function sanitizeElementAttributes(element: Element, tagName: string) {
  const attributes = getAttributeMap(element)
  const attributeNames =
    tagName === "a"
      ? (["href", "target", "rel"] as const)
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

function sanitizeNode(node: Node): string {
  if (node.nodeType === 3) {
    return escapeHtml(node.textContent ?? "")
  }

  if (node.nodeType !== 1) {
    return ""
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
  const attributesFragment = attributes ? ` ${attributes}` : ""

  if (tagName === "br" || tagName === "hr") {
    return `<${tagName}${attributesFragment}>`
  }

  if (RICH_TEXT_VOID_TAGS.has(tagName)) {
    return `<${tagName}${attributesFragment} />`
  }

  return `<${tagName}${attributesFragment}>${content}</${tagName}>`
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

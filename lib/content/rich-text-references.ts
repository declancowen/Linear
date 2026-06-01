export const richTextEntityReferenceTypes = [
  "workItem",
  "document",
  "project",
  "view",
] as const

export type RichTextEntityReferenceType =
  (typeof richTextEntityReferenceTypes)[number]

export type RichTextEntityReference = {
  type: RichTextEntityReferenceType
  id: string
}
export type RichTextEntityReferenceCandidate = RichTextEntityReference & {
  label: string
  href: string
  subtitle?: string
  keywords?: string[]
}

const richTextEntityReferenceTypeSet = new Set<string>(
  richTextEntityReferenceTypes
)

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function extractHtmlAttribute(content: string, attributeName: string) {
  const escapedAttributeName = escapeRegExp(attributeName)
  const match = content.match(
    new RegExp(
      `${escapedAttributeName}\\s*=\\s*(?:(["'])([\\s\\S]*?)\\1|([^\\s"'=<>\\x60]+))`,
      "i"
    )
  )

  return match?.[2] ?? match?.[3]
}

export function isRichTextEntityReferenceType(
  value: string | null | undefined
): value is RichTextEntityReferenceType {
  return Boolean(value && richTextEntityReferenceTypeSet.has(value))
}

function normalizeReference(
  type: string | undefined,
  id: string | undefined
): RichTextEntityReference | null {
  if (!isRichTextEntityReferenceType(type) || !isNonEmptyString(id)) {
    return null
  }

  return {
    type,
    id,
  }
}

function getUniqueReferenceKey(reference: RichTextEntityReference) {
  return `${reference.type}:${reference.id}`
}

function dedupeReferences(references: RichTextEntityReference[]) {
  const seenKeys = new Set<string>()
  const uniqueReferences: RichTextEntityReference[] = []

  for (const reference of references) {
    const key = getUniqueReferenceKey(reference)

    if (seenKeys.has(key)) {
      continue
    }

    seenKeys.add(key)
    uniqueReferences.push(reference)
  }

  return uniqueReferences
}

function extractReferencesWithRegex(content: string) {
  const matches = content.matchAll(/<a\b([^>]*)>/gi)

  return dedupeReferences(
    [...matches].flatMap((match) => {
      const attributes = match[1] ?? ""
      const dataType = extractHtmlAttribute(attributes, "data-type")
      const className = extractHtmlAttribute(attributes, "class")
      const isReferenceAnchor =
        dataType === "entity-reference" ||
        className?.split(/\s+/).includes("editor-reference")

      if (!isReferenceAnchor) {
        return []
      }

      const reference = normalizeReference(
        extractHtmlAttribute(attributes, "data-reference-type"),
        extractHtmlAttribute(attributes, "data-reference-id")
      )

      return reference ? [reference] : []
    })
  )
}

export function extractRichTextEntityReferences(content: string) {
  const normalizedContent = content.trim()

  if (normalizedContent.length === 0) {
    return []
  }

  if (typeof DOMParser === "undefined") {
    return extractReferencesWithRegex(normalizedContent)
  }

  const parser = new DOMParser()
  const document = parser.parseFromString(normalizedContent, "text/html")
  const nodes = document.querySelectorAll<HTMLElement>(
    'a[data-type="entity-reference"][data-reference-type][data-reference-id], a.editor-reference[data-reference-type][data-reference-id]'
  )

  return dedupeReferences(
    [...nodes].flatMap((node) => {
      const reference = normalizeReference(
        node.dataset.referenceType,
        node.dataset.referenceId
      )

      return reference ? [reference] : []
    })
  )
}

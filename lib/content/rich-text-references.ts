import { isNonEmptyString, parseHtmlDocument } from "@/lib/content/html-parsing"

const richTextEntityReferenceTypes = [
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

export function extractRichTextEntityReferences(content: string) {
  const normalizedContent = content.trim()

  if (normalizedContent.length === 0) {
    return []
  }

  const document = parseHtmlDocument(normalizedContent)
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

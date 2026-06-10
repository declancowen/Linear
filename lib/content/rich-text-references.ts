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

export type RichTextEntityReferenceDisplay = "inline" | "preview"

export type ResolvedEntityReferenceNodeAttrs = {
  referenceType: RichTextEntityReferenceType
  referenceId: string
  label: string
  display: RichTextEntityReferenceDisplay
}

/**
 * Normalizes the attributes of an `EntityReference` ProseMirror node into the
 * shape both the editor extension (`renderHTML`) and the React NodeView render
 * from. Owning this read in one place keeps the attribute-defaulting invariant
 * consistent across the serialization and editing surfaces.
 */
export function resolveEntityReferenceNodeAttrs(
  attrs: Record<string, unknown>
): ResolvedEntityReferenceNodeAttrs {
  const rawReferenceType =
    typeof attrs.referenceType === "string" ? attrs.referenceType : null
  const referenceType: RichTextEntityReferenceType =
    isRichTextEntityReferenceType(rawReferenceType)
      ? rawReferenceType
      : "workItem"
  const referenceId =
    typeof attrs.referenceId === "string" ? attrs.referenceId : ""
  const label =
    typeof attrs.label === "string" && attrs.label.length > 0
      ? attrs.label
      : referenceId
  const display: RichTextEntityReferenceDisplay =
    attrs.display === "preview" ? "preview" : "inline"

  return { referenceType, referenceId, label, display }
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

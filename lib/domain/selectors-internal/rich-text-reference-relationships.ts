import { extractRichTextEntityReferences } from "@/lib/content/rich-text-references"
import type {
  RichTextEntityReference,
  RichTextEntityReferenceType,
} from "@/lib/content/rich-text-references"
import type { AppData, Document, WorkItem } from "@/lib/domain/types"

import {
  getRichTextReferenceCandidates,
  type RichTextReferenceContext,
} from "./rich-text-references"

export type RichTextReferenceRelationships = {
  documentIds: string[]
  projectIds: string[]
  viewIds: string[]
  workItemIds: string[]
}

const emptyRelationships: RichTextReferenceRelationships = {
  documentIds: [],
  projectIds: [],
  viewIds: [],
  workItemIds: [],
}

function getReferenceKey(reference: RichTextEntityReference) {
  return `${reference.type}:${reference.id}`
}

function getAllowedReferenceKeys(
  data: AppData,
  context: RichTextReferenceContext
) {
  return new Set(
    getRichTextReferenceCandidates(data, context).map(getReferenceKey)
  )
}

function idsForType(
  references: RichTextEntityReference[],
  type: RichTextEntityReferenceType
) {
  return references
    .filter((reference) => reference.type === type)
    .map((reference) => reference.id)
}

export function getRichTextReferenceRelationships(
  data: AppData,
  context: RichTextReferenceContext,
  content: string
): RichTextReferenceRelationships {
  const allowedReferenceKeys = getAllowedReferenceKeys(data, context)

  if (allowedReferenceKeys.size === 0) {
    return emptyRelationships
  }

  const references = extractRichTextEntityReferences(content).filter(
    (reference) => allowedReferenceKeys.has(getReferenceKey(reference))
  )

  return {
    documentIds: idsForType(references, "document"),
    projectIds: idsForType(references, "project"),
    viewIds: idsForType(references, "view"),
    workItemIds: idsForType(references, "workItem"),
  }
}

export function getDocumentRichTextReferenceRelationships(
  data: AppData,
  document: Document,
  content = document.content
) {
  return getRichTextReferenceRelationships(
    data,
    {
      type: "document",
      documentId: document.id,
    },
    content
  )
}

export function getWorkItemDescriptionRichTextReferenceRelationships(
  data: AppData,
  item: WorkItem,
  content: string
) {
  return getRichTextReferenceRelationships(
    data,
    {
      type: "workItemDescription",
      itemId: item.id,
    },
    content
  )
}

export function getWorkItemCommentRichTextReferenceRelationships(
  data: AppData,
  item: WorkItem,
  content: string
) {
  return getRichTextReferenceRelationships(
    data,
    {
      type: "workItemComment",
      itemId: item.id,
    },
    content
  )
}

import {
  FileText,
  Folders,
  SquaresFour,
  Target,
  type Icon,
} from "@phosphor-icons/react"

import type { RichTextEntityReferenceType } from "@/lib/content/rich-text-references"

/**
 * Single source of truth for entity-reference icons. The work item, document,
 * and project icons mirror the global search model (`workspace-search-icon`) so
 * a referenced entity reads with the same icon everywhere it appears (inline
 * chip, preview card, and the reference picker).
 */
const REFERENCE_TYPE_ICON: Record<RichTextEntityReferenceType, Icon> = {
  workItem: Target,
  document: FileText,
  project: Folders,
  view: SquaresFour,
}

export function getReferenceTypeIcon(type: string): Icon {
  return REFERENCE_TYPE_ICON[type as RichTextEntityReferenceType] ?? Target
}

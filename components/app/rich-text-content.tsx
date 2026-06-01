"use client"

import { useMemo, type MouseEvent } from "react"
import { toast } from "sonner"

import { sanitizeRichTextContent } from "@/lib/content/rich-text-security"
import type { RichTextEntityReferenceCandidate } from "@/lib/content/rich-text-references"
import { cn } from "@/lib/utils"

function getReferenceKey(type: string | undefined, id: string | undefined) {
  return type && id ? `${type}:${id}` : null
}

function isPlainReferenceNavigationClick(event: MouseEvent) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

function getReferenceAnchor(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  const anchor = target.closest('a[data-type="entity-reference"]')

  return anchor instanceof HTMLAnchorElement ? anchor : null
}

export function RichTextContent({
  content,
  className,
  referenceCandidates,
}: {
  content: string
  className?: string
  referenceCandidates?: RichTextEntityReferenceCandidate[]
}) {
  const sanitizedContent = useMemo(
    () => sanitizeRichTextContent(content),
    [content]
  )
  const accessibleReferenceKeys = useMemo(
    () =>
      referenceCandidates
        ? new Set(
            referenceCandidates.map((candidate) =>
              getReferenceKey(candidate.type, candidate.id)
            )
          )
        : null,
    [referenceCandidates]
  )

  return (
    <div
      className={cn(
        "tiptap break-words [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline [&_li]:ml-4 [&_ol]:list-decimal [&_p+p]:mt-2 [&_ul]:list-disc",
        className
      )}
      onClickCapture={(event) => {
        if (
          !accessibleReferenceKeys ||
          !isPlainReferenceNavigationClick(event)
        ) {
          return
        }

        const anchor = getReferenceAnchor(event.target)

        if (!anchor) {
          return
        }

        const referenceKey = getReferenceKey(
          anchor.dataset.referenceType,
          anchor.dataset.referenceId
        )

        if (!referenceKey || accessibleReferenceKeys.has(referenceKey)) {
          return
        }

        event.preventDefault()
        toast.error("You do not have access to this reference")
      }}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  )
}

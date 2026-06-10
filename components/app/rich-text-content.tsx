"use client"

import { useMemo, useState, type MouseEvent } from "react"
import { DownloadSimple } from "@phosphor-icons/react"
import { toast } from "sonner"

import { useAppRouter } from "@/lib/browser/app-navigation"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { parseHtmlDocument } from "@/lib/content/html-parsing"
import { sanitizeRichTextContent } from "@/lib/content/rich-text-security"
import type { RichTextEntityReferenceCandidate } from "@/lib/content/rich-text-references"
import {
  getAttachmentFileKind,
  isImageAttachmentFile,
  isSupportedAttachmentFileType,
  type AttachmentFileKind,
} from "@/lib/domain/file-uploads"
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

/**
 * Resolves the in-app destination for an embedded entity reference. Prefers the
 * precomputed candidate href (covers views and access-scoped routing); falls
 * back to the deterministic entity routes so references stay navigable even in
 * surfaces that do not supply candidates (chat, channel posts/comments). The
 * stored anchor href is unreliable here because the canonical sanitizer strips
 * relative routes to "#".
 */
function resolveReferenceDestination(
  referenceType: string | undefined,
  referenceId: string | undefined,
  hrefByKey: Map<string, string> | null
) {
  const key = getReferenceKey(referenceType, referenceId)
  const candidateHref = key ? (hrefByKey?.get(key) ?? null) : null

  if (candidateHref) {
    return candidateHref
  }

  if (!referenceId) {
    return null
  }

  if (referenceType === "workItem") {
    return `/items/${referenceId}`
  }

  if (referenceType === "document") {
    return `/docs/${referenceId}`
  }

  if (referenceType === "project") {
    return `/projects/${referenceId}`
  }

  return null
}

type ImagePreviewState = {
  label: string
  src: string
}

type AttachmentDisplayMode = "default" | "inline"

function getUrlPathname(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    const baseUrl =
      typeof window === "undefined"
        ? "https://app.linear.local"
        : window.location.href

    return new URL(value, baseUrl).pathname
  } catch {
    return value
  }
}

function isImageHrefCandidate(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href")
  const label = anchor.textContent?.trim() ?? ""
  const pathname = getUrlPathname(href)

  return [label, href, pathname].some((candidate) =>
    isImageAttachmentFile(candidate, null)
  )
}

function getInlineImageReferenceLabel(image: Element) {
  const label =
    image.getAttribute("alt")?.trim() ||
    image.getAttribute("title")?.trim() ||
    image.getAttribute("data-file-name")?.trim() ||
    image.getAttribute("src")?.split("/").filter(Boolean).at(-1)?.trim()

  return label || "Image"
}

function replaceImagePreviewsWithAttachmentLinks(container: HTMLElement) {
  const images = container.querySelectorAll("img.editor-image")

  images.forEach((image) => {
    const src =
      (image as HTMLImageElement).currentSrc ||
      image.getAttribute("src") ||
      (image as HTMLImageElement).src

    if (!src) {
      return
    }

    const ownerDocument = image.ownerDocument

    if (!ownerDocument) {
      return
    }

    const anchor = ownerDocument.createElement("a")
    anchor.href = src
    anchor.target = "_blank"
    anchor.rel = "noreferrer"
    anchor.className = "editor-attachment"
    anchor.dataset.type = "attachment"
    anchor.dataset.attachmentKind = "image"
    anchor.dataset.richTextGeneratedImageReference = "true"
    anchor.textContent = getInlineImageReferenceLabel(image)
    image.replaceWith(anchor)
  })
}

function getAnchorAttachmentKind(
  anchor: Element
): AttachmentFileKind | null {
  if (anchor.getAttribute("data-type") === "entity-reference") {
    return null
  }

  const label = anchor.textContent?.trim() ?? ""
  const href = anchor.getAttribute("href")
  const candidate = label || getUrlPathname(href) || href || ""

  return isSupportedAttachmentFileType(candidate, null)
    ? getAttachmentFileKind(candidate, null)
    : null
}

/**
 * Bakes attachment presentation into the HTML so the chip + type icon render
 * from static markup + CSS, instead of mutating the DOM after render. In inline
 * mode image previews become reference chips; supported file links upgrade to
 * chips in every mode.
 */
function transformAttachmentReferences(
  html: string,
  options: { inline: boolean; download: boolean }
) {
  const doc = parseHtmlDocument(html)

  if (options.inline) {
    replaceImagePreviewsWithAttachmentLinks(doc.body)
  }

  doc.body.querySelectorAll("a[href]").forEach((anchor) => {
    if (anchor.getAttribute("data-type") === "attachment") {
      return
    }

    const kind = getAnchorAttachmentKind(anchor)

    if (!kind) {
      return
    }

    anchor.classList.add("editor-attachment")
    anchor.setAttribute("data-type", "attachment")
    anchor.setAttribute("data-attachment-kind", kind)
  })

  if (options.download) {
    appendAttachmentDownloadControls(doc.body)
  }

  return doc.body.innerHTML
}

function appendAttachmentDownloadControls(container: HTMLElement) {
  container
    .querySelectorAll('a[data-type="attachment"]')
    .forEach((anchor) => {
      if (anchor.nextElementSibling?.hasAttribute("data-attachment-download")) {
        return
      }

      const href = anchor.getAttribute("href")

      if (!href) {
        return
      }

      const ownerDocument = anchor.ownerDocument

      if (!ownerDocument) {
        return
      }

      const fileName =
        anchor.getAttribute("data-file-name") ||
        anchor.textContent?.trim() ||
        "file"
      const download = ownerDocument.createElement("a")
      download.setAttribute("href", href)
      download.setAttribute("download", fileName)
      download.setAttribute("data-attachment-download", "true")
      download.setAttribute("class", "editor-attachment-download")
      download.setAttribute("aria-label", `Download ${fileName}`)
      download.setAttribute("title", `Download ${fileName}`)
      anchor.after(download)
    })
}

function getImagePreviewFromTarget(
  target: EventTarget | null
): ImagePreviewState | null {
  if (!(target instanceof Element)) {
    return null
  }

  const image = target.closest("img.editor-image")

  if (image instanceof HTMLImageElement) {
    const src = image.currentSrc || image.src || image.getAttribute("src")

    if (!src) {
      return null
    }

    return {
      label:
        image.alt.trim() ||
        image.title.trim() ||
        image.getAttribute("src") ||
        "Image preview",
      src,
    }
  }

  const anchor = target.closest("a[href]")

  if (
    anchor instanceof HTMLAnchorElement &&
    !anchor.hasAttribute("data-attachment-download") &&
    anchor.dataset.type !== "entity-reference" &&
    isImageHrefCandidate(anchor)
  ) {
    return {
      label: anchor.textContent?.trim() || "Image preview",
      src: anchor.href,
    }
  }

  return null
}

export function RichTextContent({
  content,
  className,
  attachmentDisplay = "default",
  enableAttachmentDownload = false,
  referenceCandidates,
}: {
  content: string
  className?: string
  attachmentDisplay?: AttachmentDisplayMode
  enableAttachmentDownload?: boolean
  referenceCandidates?: RichTextEntityReferenceCandidate[]
}) {
  const [imagePreview, setImagePreview] = useState<ImagePreviewState | null>(
    null
  )
  const router = useAppRouter()
  const sanitizedContent = useMemo(
    () => sanitizeRichTextContent(content),
    [content]
  )
  const displayedContent = useMemo(
    () =>
      transformAttachmentReferences(sanitizedContent, {
        inline: attachmentDisplay === "inline",
        download: enableAttachmentDownload,
      }),
    [attachmentDisplay, enableAttachmentDownload, sanitizedContent]
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
  const referenceHrefByKey = useMemo(() => {
    if (!referenceCandidates) {
      return null
    }

    const map = new Map<string, string>()

    for (const candidate of referenceCandidates) {
      const key = getReferenceKey(candidate.type, candidate.id)

      if (key && candidate.href) {
        map.set(key, candidate.href)
      }
    }

    return map
  }, [referenceCandidates])

  return (
    <>
      <div
        className={cn(
          "tiptap break-words [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline [&_li]:ml-4 [&_ol]:list-decimal [&_p+p]:mt-2 [&_ul]:list-disc",
          className
        )}
        onClickCapture={(event) => {
          if (!isPlainReferenceNavigationClick(event)) {
            return
          }

          const preview = getImagePreviewFromTarget(event.target)

          if (preview) {
            event.preventDefault()
            setImagePreview(preview)
            return
          }

          const anchor = getReferenceAnchor(event.target)

          if (!anchor) {
            return
          }

          const referenceType = anchor.dataset.referenceType
          const referenceId = anchor.dataset.referenceId
          const referenceKey = getReferenceKey(referenceType, referenceId)

          // The stored reference href is "#"; control navigation ourselves.
          event.preventDefault()

          if (
            accessibleReferenceKeys &&
            referenceKey &&
            !accessibleReferenceKeys.has(referenceKey)
          ) {
            toast.error("You do not have access to this reference")
            return
          }

          const destination = resolveReferenceDestination(
            referenceType,
            referenceId,
            referenceHrefByKey
          )

          if (destination) {
            router.push(destination)
          }
        }}
        dangerouslySetInnerHTML={{ __html: displayedContent }}
      />
      <Dialog
        open={imagePreview !== null}
        onOpenChange={(open) => {
          if (!open) {
            setImagePreview(null)
          }
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] gap-3 bg-black/90 p-3 text-white sm:max-w-[calc(100vw-2rem)]"
        >
          <DialogTitle className="sr-only">
            {imagePreview?.label ?? "Image preview"}
          </DialogTitle>
          {imagePreview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- Uploaded rich-text images use user-provided URLs that are not statically known. */}
              <img
                src={imagePreview.src}
                alt={imagePreview.label}
                className="mx-auto max-h-[calc(100vh-7rem)] max-w-full rounded-md object-contain"
              />
              <div className="flex items-center justify-center gap-3 px-8">
                <span className="truncate text-xs text-white/75">
                  {imagePreview.label}
                </span>
                <a
                  href={imagePreview.src}
                  download={imagePreview.label}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Download ${imagePreview.label}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs text-white transition-colors hover:bg-white/20"
                >
                  <DownloadSimple className="size-3.5" />
                  Download
                </a>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

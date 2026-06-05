import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isImageAssetSource(value: string | null | undefined) {
  if (!value) {
    return false
  }

  return /^(https?:\/\/|\/|data:|blob:)/.test(value.trim())
}

export function resolveImageAssetSource(
  imageUrl?: string | null,
  fallbackValue?: string | null
): string | null {
  if (imageUrl) {
    return imageUrl
  }

  return isImageAssetSource(fallbackValue) ? (fallbackValue ?? null) : null
}

function getHtmlAttributeValue(tag: string, attributeName: string) {
  const match = tag.match(
    new RegExp(
      `${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
      "i"
    )
  )

  return match?.[1] ?? match?.[2] ?? match?.[3] ?? ""
}

function replaceRichTextImagesWithText(value: string) {
  return value.replace(/<img\b[^>]*>/gi, (tag) => {
    const label =
      getHtmlAttributeValue(tag, "alt") || getHtmlAttributeValue(tag, "title")

    return label ? ` ${label} ` : " "
  })
}

export function getPlainTextContent(value: string) {
  return replaceRichTextImagesWithText(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|blockquote|h[1-6]|pre)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

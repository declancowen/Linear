import { parseHTML } from "linkedom"

export function parseHtmlDocument(html: string): Document {
  if (typeof DOMParser !== "undefined") {
    return new DOMParser().parseFromString(html, "text/html")
  }

  return parseHTML(html).document as unknown as Document
}

export function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0
}

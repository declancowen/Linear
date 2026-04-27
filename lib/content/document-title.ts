export function extractDocumentTitleFromContent(content: string) {
  const match = content.match(/<h1[^>]*>(.*?)<\/h1>/i)

  if (!match?.[1]) {
    return null
  }

  const plainTitle = match[1].replace(/<[^>]*>/g, "").trim()

  return plainTitle.length > 0 ? plainTitle : null
}

function escapeDocumentHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function replaceDocumentHeading(content: string, title: string) {
  const escapedTitle = escapeDocumentHtml(title)
  const headingPattern = /(<h1[^>]*>)[\s\S]*?(<\/h1>)/i

  if (headingPattern.test(content)) {
    return content.replace(headingPattern, `$1${escapedTitle}$2`)
  }

  return `<h1>${escapedTitle}</h1>${content}`
}

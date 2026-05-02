export function extractDocumentTitleFromContent(content: string) {
  const match = content.match(/<h1[^>]*>(.*?)<\/h1>/i)

  if (!match?.[1]) {
    return null
  }

  const plainTitle = match[1].replace(/<[^>]*>/g, "").trim()

  return plainTitle.length > 0 ? plainTitle : null
}

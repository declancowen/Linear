export function getCaretCoordinatesFromTextNode(input: {
  textNode: Text
  offset: number
}) {
  const textLength = input.textNode.data.length
  const safeOffset = Math.min(Math.max(input.offset, 0), textLength)
  const documentRoot = input.textNode.ownerDocument

  if (!documentRoot) {
    return null
  }

  const range = documentRoot.createRange()

  if (safeOffset > 0) {
    range.setStart(input.textNode, safeOffset - 1)
    range.setEnd(input.textNode, safeOffset)

    const rect = Array.from(range.getClientRects()).at(-1)

    if (rect) {
      return {
        left: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      }
    }
  }

  if (safeOffset < textLength) {
    range.setStart(input.textNode, safeOffset)
    range.setEnd(input.textNode, safeOffset + 1)

    const rect = range.getClientRects()[0]

    if (rect) {
      return {
        left: rect.left,
        top: rect.top,
        bottom: rect.bottom,
      }
    }
  }

  return null
}

import type { Editor } from "@tiptap/react"

export function getCollapsedRangeCaretCoordinates(
  currentEditor: Editor,
  position: number
) {
  try {
    const domPosition = currentEditor.view.domAtPos(position)
    const baseNode = domPosition.node
    const ownerDocument = baseNode.ownerDocument

    if (!ownerDocument) {
      return null
    }

    const range = ownerDocument.createRange()

    setCollapsedRangeAtDomPosition(range, domPosition)

    const rect =
      range.getClientRects()[0] ?? range.getBoundingClientRect() ?? null

    if (!rect) {
      return null
    }

    return {
      left: rect.left,
      top: rect.top,
      bottom: rect.bottom,
    }
  } catch {
    return null
  }
}

function getDomPositionLimit(node: Node) {
  return node.nodeType === Node.TEXT_NODE
    ? (node as Text).data.length
    : node.childNodes.length
}

function getSafeDomOffset(node: Node, offset: number) {
  return Math.min(Math.max(offset, 0), getDomPositionLimit(node))
}

function setCollapsedRangeAtDomPosition(
  range: Range,
  domPosition: {
    node: Node
    offset: number
  }
) {
  const safeOffset = getSafeDomOffset(domPosition.node, domPosition.offset)

  range.setStart(domPosition.node, safeOffset)
  range.setEnd(domPosition.node, safeOffset)
}

function setRangeBoundaryAtDomPosition(
  range: Range,
  boundary: "end" | "start",
  domPosition: {
    node: Node
    offset: number
  }
) {
  const safeOffset = getSafeDomOffset(domPosition.node, domPosition.offset)

  if (boundary === "start") {
    range.setStart(domPosition.node, safeOffset)
    return
  }

  range.setEnd(domPosition.node, safeOffset)
}

export function getClientRectsForDocumentRange(
  currentEditor: Editor,
  startPosition: number,
  endPosition: number
) {
  try {
    const ownerDocument = currentEditor.view.dom.ownerDocument

    if (!ownerDocument) {
      return [] as DOMRect[]
    }

    const startDomPosition = currentEditor.view.domAtPos(startPosition)
    const endDomPosition = currentEditor.view.domAtPos(endPosition)
    const range = ownerDocument.createRange()

    setRangeBoundaryAtDomPosition(range, "start", startDomPosition)
    setRangeBoundaryAtDomPosition(range, "end", endDomPosition)

    return Array.from(range.getClientRects()).filter(
      (rect) => rect.width > 0 && rect.height > 0
    )
  } catch {
    return [] as DOMRect[]
  }
}

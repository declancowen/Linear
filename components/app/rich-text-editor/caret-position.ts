import type { Editor } from "@tiptap/react"

import { getCaretCoordinatesFromTextNode } from "./caret-text-node"
import { getCollapsedRangeCaretCoordinates } from "./collapsed-range"
import { getTextNode } from "./text-node"
import { getLocalTextblockBoundarySide } from "./textblock-boundary"

function getFirstTextNode(node: Node | null): Text | null {
  return getTextNode(node, "first")
}

function getLastTextNode(node: Node | null): Text | null {
  return getTextNode(node, "last")
}

function getTextCaretCoordinatesBeforeDomPosition(domPosition: {
  node: Node
  offset: number
}) {
  const textCoordinates = getTextCaretCoordinatesAtDomOffset(
    domPosition.node,
    domPosition.offset
  )

  if (textCoordinates) {
    return textCoordinates
  }

  const beforeTextNode = getPreviousTextNodeBeforeDomOffset(
    domPosition.node,
    domPosition.offset
  )

  return beforeTextNode
    ? getCaretCoordinatesFromTextNode({
        textNode: beforeTextNode,
        offset: beforeTextNode.data.length,
      })
    : null
}

function getTextCaretCoordinatesAtDomOffset(node: Node, offset: number) {
  if (node.nodeType !== Node.TEXT_NODE || offset <= 0) {
    return null
  }

  return getCaretCoordinatesFromTextNode({
    textNode: node as Text,
    offset,
  })
}

function getPreviousTextNodeBeforeDomOffset(node: Node, offset: number) {
  if (!(node instanceof HTMLElement) || offset <= 0) {
    return null
  }

  return getLastTextNode(node.childNodes[offset - 1] ?? null)
}

function getFallbackCaretCoordinatesBeforePosition(
  currentEditor: Editor,
  position: number
) {
  const before = currentEditor.view.coordsAtPos(position, -1)

  return {
    left: Math.max(before.left, before.right),
    top: before.top,
    bottom: before.bottom,
  }
}

function getCaretCoordinatesBeforePosition(
  currentEditor: Editor,
  position: number
) {
  try {
    const textCoordinates = getTextCaretCoordinatesBeforeDomPosition(
      currentEditor.view.domAtPos(position)
    )

    if (textCoordinates) {
      return textCoordinates
    }
  } catch {
    // Fall through to ProseMirror coordinates.
  }

  return getFallbackCaretCoordinatesBeforePosition(currentEditor, position)
}

function getCaretCoordinatesAfterPosition(
  currentEditor: Editor,
  position: number
) {
  try {
    const textCoordinates = getTextCaretCoordinatesAfterDomPosition(
      currentEditor.view.domAtPos(position)
    )

    if (textCoordinates) {
      return textCoordinates
    }
  } catch {
    // Fall through to ProseMirror coordinates.
  }

  return getFallbackCaretCoordinatesAfterPosition(currentEditor, position)
}

function getTextCaretCoordinatesAfterDomPosition(domPosition: {
  node: Node
  offset: number
}) {
  return (
    getTextNodeCaretCoordinatesAfterDomPosition(domPosition) ??
    getElementCaretCoordinatesAfterDomPosition(domPosition)
  )
}

function getTextNodeCaretCoordinatesAfterDomPosition(domPosition: {
  node: Node
  offset: number
}) {
  if (domPosition.node.nodeType !== Node.TEXT_NODE) {
    return null
  }

  const textNode = domPosition.node as Text

  return domPosition.offset < textNode.data.length
    ? getCaretCoordinatesFromTextNode({
        textNode,
        offset: domPosition.offset,
      })
    : null
}

function getElementCaretCoordinatesAfterDomPosition(domPosition: {
  node: Node
  offset: number
}) {
  if (!(domPosition.node instanceof HTMLElement)) {
    return null
  }

  const afterTextNode = getFirstTextNode(
    domPosition.node.childNodes[domPosition.offset] ?? null
  )

  return afterTextNode
    ? getCaretCoordinatesFromTextNode({
        textNode: afterTextNode,
        offset: 0,
      })
    : null
}

function getFallbackCaretCoordinatesAfterPosition(
  currentEditor: Editor,
  position: number
) {
  const after = currentEditor.view.coordsAtPos(position, 1)

  return {
    left: after.left,
    top: after.top,
    bottom: after.bottom,
  }
}

export function resolveCollaborationCaretCoordinates(
  currentEditor: Editor,
  position: number
) {
  const localBoundarySide = getLocalTextblockBoundarySide(
    currentEditor,
    position
  )

  if (localBoundarySide === "before" && position > 0) {
    return getCaretCoordinatesBeforePosition(currentEditor, position)
  }

  if (localBoundarySide === "after") {
    return getCaretCoordinatesAfterPosition(currentEditor, position)
  }

  const collapsedRangeCoordinates = getCollapsedRangeCaretCoordinates(
    currentEditor,
    position
  )

  if (collapsedRangeCoordinates) {
    return collapsedRangeCoordinates
  }

  return getCaretCoordinatesAfterPosition(currentEditor, position)
}

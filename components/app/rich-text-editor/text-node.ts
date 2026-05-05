export function getTextNode(
  node: Node | null,
  edge: "first" | "last"
): Text | null {
  if (!node) {
    return null
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node as Text
  }

  const documentRoot = node.ownerDocument

  if (!documentRoot) {
    return null
  }

  const walker = documentRoot.createTreeWalker(node, NodeFilter.SHOW_TEXT)

  if (edge === "first") {
    return walker.nextNode() as Text | null
  }

  let lastTextNode: Text | null = null
  let currentNode = walker.nextNode()

  while (currentNode) {
    lastTextNode = currentNode as Text
    currentNode = walker.nextNode()
  }

  return lastTextNode
}

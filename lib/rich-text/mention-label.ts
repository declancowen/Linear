export function getMentionRenderLabel(node: {
  attrs: {
    id?: unknown
    label?: unknown
  }
}) {
  return String(node.attrs.label ?? node.attrs.id ?? "")
}

const COLLABORATION_BODY_SOURCE_CONVEX_HTML = "convex-html"
const COLLABORATION_BODY_SOURCE_CLOUDFLARE_YJS = "cloudflare-yjs"

export type CollaborationBodySource = "convex-html" | "cloudflare-yjs"

function isCollaborationBodySource(
  value: unknown
): value is CollaborationBodySource {
  return (
    value === COLLABORATION_BODY_SOURCE_CONVEX_HTML ||
    value === COLLABORATION_BODY_SOURCE_CLOUDFLARE_YJS
  )
}

export function normalizeCollaborationBodySource(
  value: unknown
): CollaborationBodySource {
  return isCollaborationBodySource(value)
    ? value
    : COLLABORATION_BODY_SOURCE_CONVEX_HTML
}

export function isCloudflareYjsBodySource(value: unknown) {
  return (
    normalizeCollaborationBodySource(value) ===
    COLLABORATION_BODY_SOURCE_CLOUDFLARE_YJS
  )
}

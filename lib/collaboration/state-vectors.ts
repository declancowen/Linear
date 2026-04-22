import * as Y from "yjs"

function encodeBase64UrlBytes(value: Uint8Array) {
  let binary = ""

  for (const byte of value) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "")
}

function decodeBase64UrlBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const remainder = normalized.length % 4
  const padded =
    remainder === 0 ? normalized : `${normalized}${"=".repeat(4 - remainder)}`
  const binary = atob(padded)

  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export function encodeDocumentStateVector(doc: Y.Doc) {
  return encodeBase64UrlBytes(Y.encodeStateVector(doc))
}

export function decodeDocumentStateVector(value: string) {
  return Y.decodeStateVector(decodeBase64UrlBytes(value))
}

export function getDocumentStateVector(doc: Y.Doc) {
  return Y.decodeStateVector(Y.encodeStateVector(doc))
}

export function doesStateVectorDominate(
  current: Map<number, number>,
  expected: Map<number, number>
) {
  for (const [clientId, clock] of expected) {
    if ((current.get(clientId) ?? 0) < clock) {
      return false
    }
  }

  return true
}

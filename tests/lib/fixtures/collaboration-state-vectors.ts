import * as Y from "yjs"

export type DocumentStateVector = Map<number, number>

export function getDocumentStateVector(doc: Y.Doc): DocumentStateVector {
  return Y.decodeStateVector(Y.encodeStateVector(doc))
}

export function encodeDocumentStateVector(doc: Y.Doc) {
  return bytesToBase64Url(Y.encodeStateVector(doc))
}

export function decodeDocumentStateVector(
  encoded: string
): DocumentStateVector {
  return Y.decodeStateVector(base64UrlToBytes(encoded))
}

export function doesStateVectorDominate(
  candidate: DocumentStateVector,
  required: DocumentStateVector
) {
  for (const [clientId, requiredClock] of required) {
    if ((candidate.get(clientId) ?? 0) < requiredClock) {
      return false
    }
  }

  return true
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ""

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlToBytes(encoded: string) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

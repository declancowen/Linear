import { describe, expect, it } from "vitest"
import * as Y from "yjs"

import {
  decodeDocumentStateVector,
  doesStateVectorDominate,
  encodeDocumentStateVector,
  getDocumentStateVector,
} from "@/lib/collaboration/state-vectors"

describe("collaboration state vectors", () => {
  it("round-trips a document state vector through base64url encoding", () => {
    const doc = new Y.Doc()

    doc.getMap("root").set("title", "Spec")

    const encoded = encodeDocumentStateVector(doc)
    const decoded = decodeDocumentStateVector(encoded)

    expect(decoded).toEqual(getDocumentStateVector(doc))
  })

  it("detects when one state vector dominates another", () => {
    const roomDoc = new Y.Doc()
    const clientDoc = new Y.Doc()

    roomDoc.getMap("root").set("title", "Spec")
    Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(roomDoc))

    clientDoc.getMap("root").set("body", "Hello")

    expect(
      doesStateVectorDominate(
        getDocumentStateVector(roomDoc),
        getDocumentStateVector(clientDoc)
      )
    ).toBe(false)

    Y.applyUpdate(roomDoc, Y.encodeStateAsUpdate(clientDoc, Y.encodeStateVector(roomDoc)))

    expect(
      doesStateVectorDominate(
        getDocumentStateVector(roomDoc),
        getDocumentStateVector(clientDoc)
      )
    ).toBe(true)
  })
})

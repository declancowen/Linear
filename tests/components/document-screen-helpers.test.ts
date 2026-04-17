import { beforeEach, describe, expect, it } from "vitest"

import { getDocumentPresenceSessionId } from "@/components/app/screens/helpers"

describe("document presence session helpers", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("reuses the same presence session for the same user", () => {
    const firstSessionId = getDocumentPresenceSessionId("user_1")
    const secondSessionId = getDocumentPresenceSessionId("user_1")

    expect(secondSessionId).toBe(firstSessionId)
  })

  it("rotates the presence session when the authenticated user changes", () => {
    const firstSessionId = getDocumentPresenceSessionId("user_1")
    const secondSessionId = getDocumentPresenceSessionId("user_2")

    expect(secondSessionId).not.toBe(firstSessionId)
  })
})

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

  it("backfills the user key for legacy stored sessions before rotating", () => {
    window.sessionStorage.setItem(
      "linear.document-presence-session-id",
      "legacy_session"
    )

    const firstSessionId = getDocumentPresenceSessionId("user_1")
    const secondSessionId = getDocumentPresenceSessionId("user_2")

    expect(firstSessionId).toBe("legacy_session")
    expect(secondSessionId).not.toBe(firstSessionId)
    expect(
      window.sessionStorage.getItem("linear.document-presence-session-user-id")
    ).toBe("user_2")
  })
})

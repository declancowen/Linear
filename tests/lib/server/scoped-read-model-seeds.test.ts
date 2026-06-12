import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const loadScopedReadModelForSessionMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/scoped-read-model-route-handlers", () => ({
  loadScopedReadModelForSession: loadScopedReadModelForSessionMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  logProviderError: logProviderErrorMock,
}))

const session = {
  user: {
    id: "workos_user_1",
    email: "alex@example.com",
  },
  organizationId: "org_1",
} as never

describe("scoped-read-model-seeds", () => {
  beforeEach(() => {
    loadScopedReadModelForSessionMock.mockReset()
    logProviderErrorMock.mockReset()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it("wraps the loaded data with the matching replace instruction for document-index", async () => {
    loadScopedReadModelForSessionMock.mockResolvedValue({
      currentUserId: "user_1",
      documents: [],
    })

    const { buildDocumentIndexSeed } = await import(
      "@/lib/server/scoped-read-model-seeds"
    )

    const seed = await buildDocumentIndexSeed(session, "workspace", "ws_1")

    expect(loadScopedReadModelForSessionMock).toHaveBeenCalledWith(session, {
      kind: "document-index",
      scopeType: "workspace",
      scopeId: "ws_1",
    })
    expect(seed).toEqual({
      data: {
        currentUserId: "user_1",
        documents: [],
      },
      replace: [
        { kind: "document-index", scopeType: "workspace", scopeId: "ws_1" },
      ],
    })
  })

  it("propagates work-index personal scope through to the server instruction", async () => {
    loadScopedReadModelForSessionMock.mockResolvedValue({ workItems: [] })

    const { buildWorkIndexSeed } = await import(
      "@/lib/server/scoped-read-model-seeds"
    )

    await buildWorkIndexSeed(session, "personal", "user_1")

    expect(loadScopedReadModelForSessionMock).toHaveBeenCalledWith(session, {
      kind: "work-index",
      scopeType: "personal",
      scopeId: "user_1",
    })
  })

  it("attaches the explicit userId to the notification-inbox replace instruction", async () => {
    loadScopedReadModelForSessionMock.mockResolvedValue({ notifications: [] })

    const { buildNotificationInboxSeed } = await import(
      "@/lib/server/scoped-read-model-seeds"
    )

    const seed = await buildNotificationInboxSeed(session, "user_1")

    expect(loadScopedReadModelForSessionMock).toHaveBeenCalledWith(session, {
      kind: "notification-inbox",
    })
    expect(seed?.replace).toEqual([
      { kind: "notification-inbox", userId: "user_1" },
    ])
  })

  it("returns null and does not throw when the loader returns null", async () => {
    loadScopedReadModelForSessionMock.mockResolvedValue(null)

    const { buildWorkItemDetailSeed } = await import(
      "@/lib/server/scoped-read-model-seeds"
    )

    const seed = await buildWorkItemDetailSeed(session, "item_1")

    expect(seed).toBeNull()
    expect(logProviderErrorMock).not.toHaveBeenCalled()
  })

  it("returns null and logs a provider error when the loader throws", async () => {
    loadScopedReadModelForSessionMock.mockRejectedValue(new Error("boom"))

    const { buildProjectIndexSeed } = await import(
      "@/lib/server/scoped-read-model-seeds"
    )

    const seed = await buildProjectIndexSeed(session, "team", "team_1")

    expect(seed).toBeNull()
    expect(logProviderErrorMock).toHaveBeenCalledTimes(1)
    expect(logProviderErrorMock.mock.calls[0]?.[0]).toContain("project-index")
  })
})

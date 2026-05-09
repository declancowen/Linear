import { beforeEach, describe, expect, it, vi } from "vitest"

import { RouteMutationError } from "@/lib/convex/client/shared"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"

const syncCreateAttachmentMock = vi.fn()
const syncCreateDocumentMock = vi.fn()
const syncDeleteAttachmentMock = vi.fn()
const syncGenerateAttachmentUploadUrlMock = vi.fn()
const syncRenameDocumentMock = vi.fn()
const syncUpdateDocumentContentMock = vi.fn()
const syncUpdateItemDescriptionMock = vi.fn()
const syncUpdateWorkItemMock = vi.fn()
const toastErrorMock = vi.fn()
const toastSuccessMock = vi.fn()
const waitForPendingWorkItemCreationMock = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}))

vi.mock("@/lib/convex/client", () => ({
  syncCreateAttachment: syncCreateAttachmentMock,
  syncCreateDocument: syncCreateDocumentMock,
  syncDeleteAttachment: syncDeleteAttachmentMock,
  syncDeleteDocument: vi.fn(),
  syncGenerateAttachmentUploadUrl: syncGenerateAttachmentUploadUrlMock,
  syncRenameDocument: syncRenameDocumentMock,
  syncUpdateDocumentContent: syncUpdateDocumentContentMock,
  syncUpdateWorkItem: syncUpdateWorkItemMock,
  syncUpdateItemDescription: syncUpdateItemDescriptionMock,
}))

vi.mock("@/lib/store/app-store-internal/pending-work-item-creations", () => ({
  waitForPendingWorkItemCreation: waitForPendingWorkItemCreationMock,
}))

const ACTIVE_SYNC_CONTEXT = {
  generation: 0,
  isCurrent: () => true,
} as const

type ActiveSyncTask = (
  context: typeof ACTIVE_SYNC_CONTEXT
) => Promise<void> | null

function createState() {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    protectedDocumentIds: [],
    teams: [
      {
        id: "team_1",
        workspaceId: "workspace_1",
        slug: "platform",
        name: "Platform",
        icon: "robot",
        settings: {
          joinCode: "JOIN1234",
          summary: "Platform team",
          guestProjectIds: [],
          guestDocumentIds: [],
          guestWorkItemIds: [],
          experience: "software-development" as const,
          features: createDefaultTeamFeatureSettings("software-development"),
          workflow: createDefaultTeamWorkflowSettings("software-development"),
        },
      },
    ],
    teamMemberships: [
      {
        teamId: "team_1",
        userId: "user_1",
        role: "admin" as const,
      },
    ],
    documents: [
      {
        id: "document_1",
        kind: "team-document" as const,
        workspaceId: "workspace_1",
        teamId: "team_1",
        title: "Spec",
        content: "<h1>Spec</h1>",
        linkedProjectIds: [],
        linkedWorkItemIds: [],
        createdBy: "user_1",
        updatedBy: "user_1",
        createdAt: "2026-04-17T10:00:00.000Z",
        updatedAt: "2026-04-17T10:00:00.000Z",
      },
    ],
    workItems: [
      {
        id: "item_1",
        key: "PLA-1",
        teamId: "team_1",
        type: "task" as const,
        title: "Plan launch",
        descriptionDocId: "document_1",
        status: "todo" as const,
        priority: "medium" as const,
        assigneeId: null,
        creatorId: "user_1",
        parentId: null,
        primaryProjectId: null,
        linkedProjectIds: [],
        linkedDocumentIds: ["document_1"],
        labelIds: [],
        milestoneId: null,
        startDate: null,
        dueDate: null,
        targetDate: null,
        subscriberIds: [],
        createdAt: "2026-04-17T10:00:00.000Z",
        updatedAt: "2026-04-17T10:00:00.000Z",
      },
    ],
    ui: {
      activeTeamId: "team_1",
      activeInboxNotificationId: null,
      selectedViewByRoute: {},
    },
  }
}

function createReplacingStoreState(initialState = createState()) {
  let current = initialState

  return {
    get current() {
      return current
    },
    set(update: unknown) {
      const patch =
        typeof update === "function" ? update(current as never) : update

      current = {
        ...current,
        ...(patch as object),
      }
    },
  }
}

async function createWorkDocumentActionsHarness(
  initialState = createState(),
  runtimeOverrides: {
    handleSyncFailure?: ReturnType<typeof vi.fn>
    queueRichTextSync?: ReturnType<typeof vi.fn>
    refreshFromServer?: ReturnType<typeof vi.fn>
  } = {}
) {
  const { createWorkDocumentActions } = await import(
    "@/lib/store/app-store-internal/slices/work-document-actions"
  )
  let state = initialState
  const handleSyncFailureMock = runtimeOverrides.handleSyncFailure ?? vi.fn()
  const queueRichTextSyncMock = runtimeOverrides.queueRichTextSync ?? vi.fn()
  const refreshFromServerMock = runtimeOverrides.refreshFromServer ?? vi.fn()
  const setState = (update: unknown) => {
    const patch = typeof update === "function" ? update(state as never) : update

    state = {
      ...state,
      ...(patch as object),
    }
  }

  return {
    actions: createWorkDocumentActions({
      get: () => state as never,
      runtime: {
        refreshFromServer: refreshFromServerMock,
        handleSyncFailure: handleSyncFailureMock,
        queueRichTextSync: queueRichTextSyncMock,
      } as never,
      set: setState as never,
    }),
    get state() {
      return state
    },
    handleSyncFailureMock,
    queueRichTextSyncMock,
    replaceState(nextState: typeof state) {
      state = nextState
    },
    refreshFromServerMock,
  }
}

function getQueuedRichTextSyncTask(queueRichTextSyncMock: ReturnType<typeof vi.fn>) {
  return queueRichTextSyncMock.mock.calls[0]?.[1] as ActiveSyncTask | undefined
}

describe("work document actions", () => {
  beforeEach(() => {
    syncCreateAttachmentMock.mockReset()
    syncCreateDocumentMock.mockReset()
    syncDeleteAttachmentMock.mockReset()
    syncGenerateAttachmentUploadUrlMock.mockReset()
    syncRenameDocumentMock.mockReset()
    syncUpdateDocumentContentMock.mockReset()
    syncUpdateItemDescriptionMock.mockReset()
    syncUpdateWorkItemMock.mockReset()
    waitForPendingWorkItemCreationMock.mockReset()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("uses one canonical id for optimistic and persisted documents", async () => {
    const harness = await createWorkDocumentActionsHarness(createState(), {
      handleSyncFailure: vi.fn().mockResolvedValue(undefined),
      refreshFromServer: vi.fn().mockResolvedValue(undefined),
    })

    syncCreateDocumentMock.mockImplementation(
      async (_currentUserId, input) => ({
        ok: true,
        documentId: input.id ?? null,
      })
    )

    const createdDocumentId = await harness.actions.createDocument({
      kind: "team-document",
      teamId: "team_1",
      title: "Launch doc",
    })

    expect(createdDocumentId).toBe(harness.state.documents[0]?.id)
    expect(syncCreateDocumentMock).toHaveBeenCalledWith("user_1", {
      id: createdDocumentId,
      kind: "team-document",
      teamId: "team_1",
      title: "Launch doc",
    })
    expect(harness.handleSyncFailureMock).not.toHaveBeenCalled()
    expect(harness.refreshFromServerMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).toHaveBeenCalledWith("Document created")
  })

  it("rolls back optimistic documents when creation fails", async () => {
    const harness = await createWorkDocumentActionsHarness(createState(), {
      handleSyncFailure: vi.fn().mockResolvedValue(undefined),
    })

    syncCreateDocumentMock.mockRejectedValue(new Error("convex failed"))

    await expect(
      harness.actions.createDocument({
        kind: "team-document",
        teamId: "team_1",
        title: "Launch doc",
      })
    ).resolves.toBeNull()

    expect(harness.state.documents.map((document) => document.id)).toEqual([
      "document_1",
    ])
    expect(harness.handleSyncFailureMock).toHaveBeenCalledWith(
      expect.any(Error),
      "Failed to create document"
    )
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it("reconciles attachments from the server after an ambiguous upload failure", async () => {
    const { createWorkDocumentActions } =
      await import("@/lib/store/app-store-internal/slices/work-document-actions")

    const storeState = createReplacingStoreState()
    const refreshFromServerMock = vi.fn().mockResolvedValue(undefined)

    syncGenerateAttachmentUploadUrlMock.mockResolvedValue({
      uploadUrl: "https://uploads.example.com",
    })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          storageId: "storage_1",
        }),
      })
    )
    syncCreateAttachmentMock.mockRejectedValue(new Error("convex failed"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    const actions = createWorkDocumentActions({
      get: () => storeState.current as never,
      runtime: {
        refreshFromServer: refreshFromServerMock,
        handleSyncFailure: vi.fn(),
        queueRichTextSync: vi.fn(),
      } as never,
      set: storeState.set as never,
    })

    const result = await actions.uploadAttachment(
      "document",
      "document_1",
      new File(["hello"], "spec.txt", { type: "text/plain" })
    )

    expect(result).toBeNull()
    expect(refreshFromServerMock).toHaveBeenCalledTimes(1)
    expect(storeState.current.attachments).toEqual([])
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to upload attachment")
  })

  it("restores only the failed attachment on delete failure", async () => {
    const { createWorkDocumentActions } =
      await import("@/lib/store/app-store-internal/slices/work-document-actions")

    let state = {
      ...createState(),
      attachments: [
        {
          id: "attachment_1",
          targetType: "document" as const,
          targetId: "document_1",
          teamId: "team_1",
          storageId: "storage_1",
          fileName: "old.pdf",
          contentType: "application/pdf",
          size: 128,
          uploadedBy: "user_1",
          createdAt: "2026-04-17T10:00:00.000Z",
          fileUrl: "/files/old.pdf",
        },
        {
          id: "attachment_2",
          targetType: "document" as const,
          targetId: "document_1",
          teamId: "team_1",
          storageId: "storage_2",
          fileName: "keep.pdf",
          contentType: "application/pdf",
          size: 256,
          uploadedBy: "user_1",
          createdAt: "2026-04-17T10:05:00.000Z",
          fileUrl: "/files/keep.pdf",
        },
      ],
    }
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function" ? update(state as never) : update

      state = {
        ...state,
        ...(patch as object),
      }
    }
    let rejectDelete!: (error: Error) => void
    syncDeleteAttachmentMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectDelete = reject
        })
    )
    vi.spyOn(console, "error").mockImplementation(() => {})

    const actions = createWorkDocumentActions({
      get: () => state as never,
      runtime: {
        refreshFromServer: vi.fn(),
        handleSyncFailure: vi.fn(),
        queueRichTextSync: vi.fn(),
      } as never,
      set: setState as never,
    })

    const deletePromise = actions.deleteAttachment("attachment_1")

    expect(state.attachments.map((attachment) => attachment.id)).toEqual([
      "attachment_2",
    ])

    state = {
      ...state,
      attachments: [
        {
          id: "attachment_3",
          targetType: "document",
          targetId: "document_1",
          teamId: "team_1",
          storageId: "storage_3",
          fileName: "new.pdf",
          contentType: "application/pdf",
          size: 512,
          uploadedBy: "user_1",
          createdAt: "2026-04-17T10:06:00.000Z",
          fileUrl: "/files/new.pdf",
        },
        ...state.attachments,
      ],
    }

    rejectDelete(new Error("delete failed"))
    await deletePromise

    expect(state.attachments.map((attachment) => attachment.id)).toEqual([
      "attachment_1",
      "attachment_3",
      "attachment_2",
    ])
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to delete attachment")
  })

  it("blocks main-section saves when the item changed during edit mode", async () => {
    const { createWorkDocumentActions } =
      await import("@/lib/store/app-store-internal/slices/work-document-actions")

    const actions = createWorkDocumentActions({
      get: () => createState() as never,
      runtime: {
        refreshFromServer: vi.fn(),
        handleSyncFailure: vi.fn(),
        queueRichTextSync: vi.fn(),
      } as never,
      set: vi.fn() as never,
    })

    const saved = await actions.saveWorkItemMainSection({
      itemId: "item_1",
      title: "Updated title",
      description: "<p>Updated details</p>",
      expectedUpdatedAt: "2026-04-17T09:59:00.000Z",
    })

    expect(saved).toBe(false)
    expect(syncUpdateWorkItemMock).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledWith(
      "This work item changed while you were editing. Review the latest version and try again."
    )
  })

  it("surfaces server edit conflicts with a specific message", async () => {
    const { createWorkDocumentActions } =
      await import("@/lib/store/app-store-internal/slices/work-document-actions")

    const storeState = createReplacingStoreState()
    const handleSyncFailureMock = vi.fn().mockResolvedValue(undefined)

    syncUpdateWorkItemMock.mockRejectedValue(
      new RouteMutationError("Work item changed while you were editing", 409, {
        code: "WORK_ITEM_EDIT_CONFLICT",
      })
    )

    const actions = createWorkDocumentActions({
      get: () => storeState.current as never,
      runtime: {
        refreshFromServer: vi.fn(),
        handleSyncFailure: handleSyncFailureMock,
        queueRichTextSync: vi.fn(),
      } as never,
      set: storeState.set as never,
    })

    const saved = await actions.saveWorkItemMainSection({
      itemId: "item_1",
      title: "Updated title",
      description: "<p>Updated details</p>",
      expectedUpdatedAt: "2026-04-17T10:00:00.000Z",
    })

    expect(saved).toBe(false)
    expect(syncUpdateWorkItemMock).toHaveBeenCalledWith("user_1", "item_1", {
      title: "Updated title",
      description: "<p>Updated details</p>",
      expectedUpdatedAt: "2026-04-17T10:00:00.000Z",
    })
    expect(
      storeState.current.workItems.find((item) => item.id === "item_1")
    ).toMatchObject({
      title: "Plan launch",
      updatedAt: "2026-04-17T10:00:00.000Z",
    })
    expect(
      storeState.current.documents.find(
        (document) => document.id === "document_1"
      )
    ).toMatchObject({
      content: "<h1>Spec</h1>",
      title: "Spec",
      updatedAt: "2026-04-17T10:00:00.000Z",
      updatedBy: "user_1",
    })
    expect(handleSyncFailureMock).toHaveBeenCalledWith(
      expect.any(RouteMutationError),
      "This work item changed while you were editing. Review the latest version and try again."
    )
  })

  it("sends the last known server version for document body syncs", async () => {
    syncUpdateDocumentContentMock.mockResolvedValue({
      ok: true,
      updatedAt: "2026-04-17T10:05:00.000Z",
    })
    const harness = await createWorkDocumentActionsHarness()

    harness.actions.updateDocumentContent(
      "document_1",
      "<h1>Launch plan</h1><p>Updated details</p>"
    )

    expect(
      harness.state.documents.find((document) => document.id === "document_1")
    ).toMatchObject({
      title: "Spec",
      content: "<h1>Launch plan</h1><p>Updated details</p>",
      updatedAt: "2026-04-17T10:00:00.000Z",
      updatedBy: "user_1",
    })

    const queuedTask = getQueuedRichTextSyncTask(harness.queueRichTextSyncMock)

    expect(queuedTask).toBeTypeOf("function")

    await queuedTask?.(ACTIVE_SYNC_CONTEXT)

    expect(syncUpdateDocumentContentMock).toHaveBeenCalledWith(
      "user_1",
      "document_1",
      "<h1>Launch plan</h1><p>Updated details</p>",
      "2026-04-17T10:00:00.000Z"
    )
    expect(
      harness.state.documents.find((document) => document.id === "document_1")
    ).toMatchObject({
      updatedAt: "2026-04-17T10:05:00.000Z",
      updatedBy: "user_1",
    })
  })

  it("sends the last known server version for item-description syncs", async () => {
    syncUpdateItemDescriptionMock.mockResolvedValue({
      ok: true,
      updatedAt: "2026-04-17T10:06:00.000Z",
    })
    waitForPendingWorkItemCreationMock.mockReturnValue(null)
    const harness = await createWorkDocumentActionsHarness()

    harness.actions.updateItemDescription("item_1", "<p>Updated item description</p>")

    expect(
      harness.state.documents.find((document) => document.id === "document_1")
    ).toMatchObject({
      content: "<p>Updated item description</p>",
      updatedAt: "2026-04-17T10:00:00.000Z",
      updatedBy: "user_1",
    })
    expect(
      harness.state.workItems.find((item) => item.id === "item_1")
    ).toMatchObject({ updatedAt: "2026-04-17T10:00:00.000Z" })

    const queuedTask = getQueuedRichTextSyncTask(harness.queueRichTextSyncMock)

    expect(queuedTask).toBeTypeOf("function")

    await queuedTask?.(ACTIVE_SYNC_CONTEXT)

    expect(syncUpdateItemDescriptionMock).toHaveBeenCalledWith(
      "user_1",
      "item_1",
      "<p>Updated item description</p>",
      "2026-04-17T10:00:00.000Z"
    )
    expect(
      harness.state.documents.find((document) => document.id === "document_1")
    ).toMatchObject({
      updatedAt: "2026-04-17T10:06:00.000Z",
      updatedBy: "user_1",
    })
    expect(
      harness.state.workItems.find((item) => item.id === "item_1")
    ).toMatchObject({ updatedAt: "2026-04-17T10:06:00.000Z" })
  })

  it("skips a queued document sync once collaboration protects the document", async () => {
    const harness = await createWorkDocumentActionsHarness()

    harness.actions.updateDocumentContent(
      "document_1",
      "<h1>Spec</h1><p>Queued before collaboration</p>"
    )

    harness.replaceState({
      ...harness.state,
      protectedDocumentIds: [
        "document_1",
      ] as typeof harness.state.protectedDocumentIds,
    })

    const queuedTask = getQueuedRichTextSyncTask(harness.queueRichTextSyncMock)

    await queuedTask?.(ACTIVE_SYNC_CONTEXT)

    expect(syncUpdateDocumentContentMock).not.toHaveBeenCalled()
  })

  it("applies collaboration title metadata locally without queueing a legacy sync", async () => {
    const { createWorkDocumentActions } =
      await import("@/lib/store/app-store-internal/slices/work-document-actions")

    let state = createState()
    const cancelRichTextSyncMock = vi.fn()
    const queueRichTextSyncMock = vi.fn()
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function" ? update(state as never) : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    const actions = createWorkDocumentActions({
      get: () => state as never,
      runtime: {
        cancelRichTextSync: cancelRichTextSyncMock,
        refreshFromServer: vi.fn(),
        handleSyncFailure: vi.fn(),
        queueRichTextSync: queueRichTextSyncMock,
      } as never,
      set: setState as never,
    })

    actions.applyDocumentCollaborationTitle(
      "document_1",
      "Metadata-only collaborative rename"
    )

    expect(cancelRichTextSyncMock).toHaveBeenCalledWith("document:document_1")
    expect(queueRichTextSyncMock).not.toHaveBeenCalled()
    expect(syncRenameDocumentMock).not.toHaveBeenCalled()
    expect(state.documents.find((document) => document.id === "document_1"))
      .toMatchObject({
        title: "Metadata-only collaborative rename",
        content: "<h1>Spec</h1>",
      })
  })

  it("renames document metadata without rewriting the body content", async () => {
    syncRenameDocumentMock.mockResolvedValue({
      ok: true,
      updatedAt: "2026-04-17T10:07:00.000Z",
    })
    const harness = await createWorkDocumentActionsHarness()

    harness.actions.renameDocument("document_1", "Renamed metadata only")

    expect(
      harness.state.documents.find((document) => document.id === "document_1")
    ).toMatchObject({
      title: "Renamed metadata only",
      content: "<h1>Spec</h1>",
    })

    const queuedTask = getQueuedRichTextSyncTask(harness.queueRichTextSyncMock)

    expect(queuedTask).toBeTypeOf("function")

    await queuedTask?.(ACTIVE_SYNC_CONTEXT)

    expect(syncRenameDocumentMock).toHaveBeenCalledWith(
      "user_1",
      "document_1",
      "Renamed metadata only"
    )
  })

  it("skips a queued item-description sync once collaboration protects the description document", async () => {
    const harness = await createWorkDocumentActionsHarness()

    harness.actions.updateItemDescription(
      "item_1",
      "<p>Queued before collaboration</p>"
    )

    harness.replaceState({
      ...harness.state,
      protectedDocumentIds: [
        "document_1",
      ] as typeof harness.state.protectedDocumentIds,
    })

    const queuedTask = getQueuedRichTextSyncTask(harness.queueRichTextSyncMock)

    await queuedTask?.(ACTIVE_SYNC_CONTEXT)

    expect(syncUpdateItemDescriptionMock).not.toHaveBeenCalled()
  })

  it("waits for pending work-item creation before syncing an item description", async () => {
    let resolvePendingCreation: ((value: boolean) => void) | undefined
    waitForPendingWorkItemCreationMock.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolvePendingCreation = resolve
      })
    )
    syncUpdateItemDescriptionMock.mockResolvedValue({
      ok: true,
      updatedAt: "2026-04-17T10:06:00.000Z",
    })
    const harness = await createWorkDocumentActionsHarness()

    harness.actions.updateItemDescription("item_1", "<p>Queued after create</p>")

    const queuedTask = getQueuedRichTextSyncTask(harness.queueRichTextSyncMock)
    const taskPromise = queuedTask?.(ACTIVE_SYNC_CONTEXT)

    await Promise.resolve()

    expect(syncUpdateItemDescriptionMock).not.toHaveBeenCalled()

    expect(resolvePendingCreation).toBeTypeOf("function")

    if (!resolvePendingCreation) {
      throw new Error("Expected pending creation resolver")
    }

    resolvePendingCreation(true)
    await taskPromise

    expect(syncUpdateItemDescriptionMock).toHaveBeenCalledWith(
      "user_1",
      "item_1",
      "<p>Queued after create</p>",
      "2026-04-17T10:00:00.000Z"
    )
  })
})

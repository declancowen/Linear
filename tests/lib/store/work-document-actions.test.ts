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
const syncUpdateWorkItemMock = vi.fn()
const toastErrorMock = vi.fn()
const toastSuccessMock = vi.fn()

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
  syncUpdateDocument: vi.fn(),
  syncUpdateWorkItem: syncUpdateWorkItemMock,
  syncUpdateItemDescription: vi.fn(),
}))

function createState() {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
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

describe("work document actions", () => {
  beforeEach(() => {
    syncCreateAttachmentMock.mockReset()
    syncCreateDocumentMock.mockReset()
    syncDeleteAttachmentMock.mockReset()
    syncGenerateAttachmentUploadUrlMock.mockReset()
    syncUpdateWorkItemMock.mockReset()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("uses one canonical id for optimistic and persisted documents", async () => {
    const { createWorkDocumentActions } =
      await import("@/lib/store/app-store-internal/slices/work-document-actions")

    let state = createState()
    const handleSyncFailureMock = vi.fn().mockResolvedValue(undefined)
    const refreshFromServerMock = vi.fn().mockResolvedValue(undefined)
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function" ? update(state as never) : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    syncCreateDocumentMock.mockImplementation(
      async (_currentUserId, input) => ({
        ok: true,
        documentId: input.id ?? null,
      })
    )

    const actions = createWorkDocumentActions({
      get: () => state as never,
      runtime: {
        refreshFromServer: refreshFromServerMock,
        handleSyncFailure: handleSyncFailureMock,
        queueRichTextSync: vi.fn(),
      } as never,
      set: setState as never,
    })

    const createdDocumentId = await actions.createDocument({
      kind: "team-document",
      teamId: "team_1",
      title: "Launch doc",
    })

    expect(createdDocumentId).toBe(state.documents[0]?.id)
    expect(syncCreateDocumentMock).toHaveBeenCalledWith("user_1", {
      id: createdDocumentId,
      kind: "team-document",
      teamId: "team_1",
      title: "Launch doc",
    })
    expect(handleSyncFailureMock).not.toHaveBeenCalled()
    expect(refreshFromServerMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).toHaveBeenCalledWith("Document created")
  })

  it("rolls back optimistic documents when creation fails", async () => {
    const { createWorkDocumentActions } =
      await import("@/lib/store/app-store-internal/slices/work-document-actions")

    let state = createState()
    const handleSyncFailureMock = vi.fn().mockResolvedValue(undefined)
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function" ? update(state as never) : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    syncCreateDocumentMock.mockRejectedValue(new Error("convex failed"))

    const actions = createWorkDocumentActions({
      get: () => state as never,
      runtime: {
        refreshFromServer: vi.fn(),
        handleSyncFailure: handleSyncFailureMock,
        queueRichTextSync: vi.fn(),
      } as never,
      set: setState as never,
    })

    await expect(
      actions.createDocument({
        kind: "team-document",
        teamId: "team_1",
        title: "Launch doc",
      })
    ).resolves.toBeNull()

    expect(state.documents.map((document) => document.id)).toEqual([
      "document_1",
    ])
    expect(handleSyncFailureMock).toHaveBeenCalledWith(
      expect.any(Error),
      "Failed to create document"
    )
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it("reconciles attachments from the server after an ambiguous upload failure", async () => {
    const { createWorkDocumentActions } =
      await import("@/lib/store/app-store-internal/slices/work-document-actions")

    let state = createState()
    const refreshFromServerMock = vi.fn().mockResolvedValue(undefined)
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function" ? update(state as never) : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

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
      get: () => state as never,
      runtime: {
        refreshFromServer: refreshFromServerMock,
        handleSyncFailure: vi.fn(),
        queueRichTextSync: vi.fn(),
      } as never,
      set: setState as never,
    })

    const result = await actions.uploadAttachment(
      "document",
      "document_1",
      new File(["hello"], "spec.txt", { type: "text/plain" })
    )

    expect(result).toBeNull()
    expect(refreshFromServerMock).toHaveBeenCalledTimes(1)
    expect(state.attachments).toEqual([])
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

    let state = createState()
    const handleSyncFailureMock = vi.fn().mockResolvedValue(undefined)
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function" ? update(state as never) : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    syncUpdateWorkItemMock.mockRejectedValue(
      new RouteMutationError("Work item changed while you were editing", 409, {
        code: "WORK_ITEM_EDIT_CONFLICT",
      })
    )

    const actions = createWorkDocumentActions({
      get: () => state as never,
      runtime: {
        refreshFromServer: vi.fn(),
        handleSyncFailure: handleSyncFailureMock,
        queueRichTextSync: vi.fn(),
      } as never,
      set: setState as never,
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
    expect(state.workItems.find((item) => item.id === "item_1")).toMatchObject({
      title: "Plan launch",
      updatedAt: "2026-04-17T10:00:00.000Z",
    })
    expect(
      state.documents.find((document) => document.id === "document_1")
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
})

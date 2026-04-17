import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"

const syncCreateAttachmentMock = vi.fn()
const syncDeleteAttachmentMock = vi.fn()
const syncGenerateAttachmentUploadUrlMock = vi.fn()
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
  syncCreateDocument: vi.fn(),
  syncDeleteAttachment: syncDeleteAttachmentMock,
  syncDeleteDocument: vi.fn(),
  syncGenerateAttachmentUploadUrl: syncGenerateAttachmentUploadUrlMock,
  syncUpdateDocument: vi.fn(),
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
    syncDeleteAttachmentMock.mockReset()
    syncGenerateAttachmentUploadUrlMock.mockReset()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("reconciles attachments from the server after an ambiguous upload failure", async () => {
    const { createWorkDocumentActions } = await import(
      "@/lib/store/app-store-internal/slices/work-document-actions"
    )

    let state = createState()
    const refreshFromServerMock = vi.fn().mockResolvedValue(undefined)
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

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
    const { createWorkDocumentActions } = await import(
      "@/lib/store/app-store-internal/slices/work-document-actions"
    )

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
        typeof update === "function"
          ? update(state as never)
          : update

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
})

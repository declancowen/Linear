"use client"

import { toast } from "sonner"

import { RouteMutationError } from "@/lib/convex/client/shared"
import {
  syncCreateAttachment,
  syncCreateDocument,
  syncDeleteAttachment,
  syncDeleteDocument,
  syncGenerateAttachmentUploadUrl,
  syncRenameDocument,
  syncUpdateDocumentContent,
  syncUpdateItemDescription,
  syncUpdateWorkItem,
} from "@/lib/convex/client"
import { documentSchema } from "@/lib/domain/types"

import {
  createId,
  getAttachmentTeamId,
  getNow,
} from "../helpers"
import {
  canEditWorkspaceDocuments,
  effectiveRole,
  getDocumentCreationValidationMessage,
  getWorkItemValidationMessage,
} from "../validation"
import type { WorkSlice, WorkSliceFactoryArgs } from "./work-shared"

export function createWorkDocumentActions({
  get,
  runtime,
  set,
}: WorkSliceFactoryArgs): Pick<
  WorkSlice,
  | "updateDocumentContent"
  | "cancelDocumentSync"
  | "applyDocumentCollaborationContent"
  | "applyDocumentCollaborationTitle"
  | "flushDocumentSync"
  | "renameDocument"
  | "deleteDocument"
  | "updateItemDescription"
  | "cancelItemDescriptionSync"
  | "applyItemDescriptionCollaborationContent"
  | "saveWorkItemMainSection"
  | "uploadAttachment"
  | "deleteAttachment"
  | "createDocument"
> {
  function markDocumentPersisted(
    documentId: string,
    updatedAt: string,
    currentUserId: string
  ) {
    set((state) => ({
      documents: state.documents.map((document) =>
        document.id === documentId
          ? {
              ...document,
              updatedAt,
              updatedBy: currentUserId,
            }
          : document
      ),
    }))
  }

  function markItemDescriptionPersisted(
    itemId: string,
    documentId: string,
    updatedAt: string,
    currentUserId: string
  ) {
    set((state) => ({
      documents: state.documents.map((document) =>
        document.id === documentId
          ? {
              ...document,
              updatedAt,
              updatedBy: currentUserId,
            }
          : document
      ),
      workItems: state.workItems.map((entry) =>
        entry.id === itemId
          ? {
              ...entry,
              updatedAt,
            }
          : entry
      ),
    }))
  }

  return {
    updateDocumentContent(documentId, content) {
      set((state) => ({
        documents: state.documents.map((document) =>
          document.id === documentId
            ? {
                ...document,
                content,
              }
            : document
        ),
      }))

      if (get().protectedDocumentIds.includes(documentId)) {
        return
      }

      runtime.queueRichTextSync(
        `document:${documentId}`,
        (syncContext) => {
          const state = get()
          if (state.protectedDocumentIds.includes(documentId)) {
            return null
          }

          const document = state.documents.find(
            (entry) => entry.id === documentId
          )

          if (!document || document.kind === "item-description") {
            return null
          }

          return syncUpdateDocumentContent(
            state.currentUserId,
            documentId,
            document.content,
            document.updatedAt
          ).then((result) => {
            if (!syncContext.isCurrent()) {
              return
            }

            markDocumentPersisted(documentId, result.updatedAt, state.currentUserId)
          })
        },
        "Failed to update document",
        {
          refreshStrategy: "none",
        }
      )
    },
    cancelDocumentSync(documentId) {
      runtime.cancelRichTextSync(`document:${documentId}`)
    },
    applyDocumentCollaborationContent(documentId, content) {
      runtime.cancelRichTextSync(`document:${documentId}`)

      set((state) => ({
        documents: state.documents.map((document) =>
          document.id === documentId
            ? {
                ...document,
                content,
              }
            : document
        ),
      }))
    },
    applyDocumentCollaborationTitle(documentId, title) {
      const normalizedTitle = title.trim() || "Untitled document"

      runtime.cancelRichTextSync(`document:${documentId}`)
      set((state) => ({
        documents: state.documents.map((document) =>
          document.id === documentId
            ? {
                ...document,
                title: normalizedTitle,
              }
            : document
        ),
      }))
    },
    async flushDocumentSync(documentId) {
      await runtime.flushRichTextSync(`document:${documentId}`)
    },
    renameDocument(documentId, title) {
      const normalizedTitle = title.trim() || "Untitled document"

      set((state) => ({
        documents: state.documents.map((document) =>
          document.id === documentId
            ? {
                ...document,
                title: normalizedTitle,
              }
            : document
        ),
      }))

      if (get().protectedDocumentIds.includes(documentId)) {
        return
      }

      runtime.queueRichTextSync(
        `document:${documentId}`,
        (syncContext) => {
          const state = get()
          if (state.protectedDocumentIds.includes(documentId)) {
            return null
          }

          const document = state.documents.find(
            (entry) => entry.id === documentId
          )

          if (!document || document.kind === "item-description") {
            return null
          }

          return syncRenameDocument(
            state.currentUserId,
            documentId,
            document.title
          ).then((result) => {
            if (!syncContext.isCurrent()) {
              return
            }

            markDocumentPersisted(documentId, result.updatedAt, state.currentUserId)
          })
        },
        "Failed to update document",
        {
          refreshStrategy: "none",
        }
      )
    },
    async deleteDocument(documentId) {
      set((state) => {
        const deletedNotificationIds = new Set(
          state.notifications
            .filter(
              (notification) =>
                notification.entityType === "document" &&
                notification.entityId === documentId
            )
            .map((notification) => notification.id)
        )

        return {
          documents: state.documents.filter(
            (document) => document.id !== documentId
          ),
          comments: state.comments.filter(
            (comment) =>
              !(
                comment.targetType === "document" &&
                comment.targetId === documentId
              )
          ),
          attachments: state.attachments.filter(
            (attachment) =>
              !(
                attachment.targetType === "document" &&
                attachment.targetId === documentId
              )
          ),
          notifications: state.notifications.filter(
            (notification) =>
              !(
                notification.entityType === "document" &&
                notification.entityId === documentId
              )
          ),
          workItems: state.workItems.map((item) => ({
            ...item,
            linkedDocumentIds: item.linkedDocumentIds.filter(
              (linkedDocumentId) => linkedDocumentId !== documentId
            ),
          })),
          ui: {
            ...state.ui,
            activeInboxNotificationId:
              state.ui.activeInboxNotificationId &&
              deletedNotificationIds.has(state.ui.activeInboxNotificationId)
                ? null
                : state.ui.activeInboxNotificationId,
          },
        }
      })

      try {
        await syncDeleteDocument(documentId)
      } catch (error) {
        await runtime.handleSyncFailure(error, "Failed to delete document")
      }
    },
    updateItemDescription(itemId, content) {
      set((state) => {
        const item = state.workItems.find((entry) => entry.id === itemId)
        if (!item) {
          return state
        }

        return {
          ...state,
          documents: state.documents.map((document) =>
            document.id === item.descriptionDocId
              ? {
                  ...document,
                  content,
                }
              : document
          ),
        }
      })

      const currentItem = get().workItems.find((entry) => entry.id === itemId)
      const descriptionDocumentId = currentItem?.descriptionDocId ?? null

      if (
        descriptionDocumentId &&
        get().protectedDocumentIds.includes(descriptionDocumentId)
      ) {
        return
      }

      runtime.queueRichTextSync(
        `item-description:${itemId}`,
        (syncContext) => {
          const state = get()
          const item = state.workItems.find((entry) => entry.id === itemId)

          if (!item) {
            return null
          }

          if (
            item.descriptionDocId &&
            state.protectedDocumentIds.includes(item.descriptionDocId)
          ) {
            return null
          }

          const descriptionDocument = state.documents.find(
            (document) => document.id === item.descriptionDocId
          )

          if (!descriptionDocument) {
            return null
          }

          return syncUpdateItemDescription(
            state.currentUserId,
            itemId,
            descriptionDocument.content,
            descriptionDocument.updatedAt
          ).then((result) => {
            if (!syncContext.isCurrent()) {
              return
            }

            markItemDescriptionPersisted(
              itemId,
              descriptionDocument.id,
              result.updatedAt,
              state.currentUserId
            )
          })
        },
        "Failed to update description",
        {
          refreshStrategy: "none",
        }
      )
    },
    cancelItemDescriptionSync(itemId) {
      runtime.cancelRichTextSync(`item-description:${itemId}`)
    },
    applyItemDescriptionCollaborationContent(itemId, content) {
      runtime.cancelRichTextSync(`item-description:${itemId}`)

      set((state) => {
        const item = state.workItems.find((entry) => entry.id === itemId)

        if (!item) {
          return state
        }

        return {
          ...state,
          documents: state.documents.map((document) =>
            document.id === item.descriptionDocId
              ? {
                  ...document,
                  content,
                }
              : document
          ),
        }
      })
    },
    async saveWorkItemMainSection(input) {
      const state = get()
      const item = state.workItems.find((entry) => entry.id === input.itemId)

      if (!item) {
        toast.error("Work item not found")
        return false
      }

      const role = effectiveRole(state, item.teamId)

      if (role === "viewer" || role === "guest" || !role) {
        toast.error("Your current role is read-only")
        return false
      }

      const normalizedTitle = input.title.trim()
      const validationMessage = getWorkItemValidationMessage(state, {
        teamId: item.teamId,
        type: item.type,
        title: normalizedTitle,
        priority: item.priority,
        assigneeId: item.assigneeId,
        parentId: item.parentId,
        primaryProjectId: item.primaryProjectId,
        labelIds: item.labelIds,
        currentItemId: item.id,
      })

      if (validationMessage) {
        toast.error(validationMessage)
        return false
      }

      const descriptionDocument = state.documents.find(
        (document) => document.id === item.descriptionDocId
      )

      if (!descriptionDocument) {
        toast.error("Work item description document not found")
        return false
      }

      const titleChanged = normalizedTitle !== item.title
      const descriptionChanged =
        input.description !== descriptionDocument.content
      const previousItem = item
      const previousDescriptionDocument = descriptionDocument

      if (!titleChanged && !descriptionChanged) {
        return true
      }

      if (item.updatedAt !== input.expectedUpdatedAt) {
        toast.error(
          "This work item changed while you were editing. Review the latest version and try again."
        )
        return false
      }

      const updatedAt = getNow()

      set((current) => ({
        documents: current.documents.map((document) =>
          document.id === item.descriptionDocId
            ? {
                ...document,
                content: input.description,
                title: `${normalizedTitle} description`,
                updatedAt,
                updatedBy: current.currentUserId,
              }
            : document
        ),
        workItems: current.workItems.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                title: normalizedTitle,
                updatedAt,
              }
            : entry
        ),
      }))

      try {
        await syncUpdateWorkItem(get().currentUserId, item.id, {
          ...(titleChanged ? { title: normalizedTitle } : {}),
          ...(descriptionChanged ? { description: input.description } : {}),
          expectedUpdatedAt: input.expectedUpdatedAt,
        })

        return true
      } catch (error) {
        set((current) => ({
          documents: current.documents.map((document) =>
            document.id === previousDescriptionDocument.id
              ? previousDescriptionDocument
              : document
          ),
          workItems: current.workItems.map((entry) =>
            entry.id === previousItem.id ? previousItem : entry
          ),
        }))

        const fallbackMessage =
          error instanceof RouteMutationError &&
          error.code === "WORK_ITEM_EDIT_CONFLICT"
            ? "This work item changed while you were editing. Review the latest version and try again."
            : "Failed to save work item"

        await runtime.handleSyncFailure(error, fallbackMessage)
        return false
      }
    },
    async uploadAttachment(targetType, targetId, file) {
      const state = get()
      const maxSize = 25 * 1024 * 1024
      const teamId = getAttachmentTeamId(state, targetType, targetId)
      const role = effectiveRole(state, teamId)

      if (role === "viewer" || role === "guest" || !role) {
        toast.error("Your current role is read-only")
        return null
      }

      if (!file || file.size <= 0) {
        toast.error("Choose a file to upload")
        return null
      }

      if (file.size > maxSize) {
        toast.error("Files must be 25 MB or smaller")
        return null
      }

      try {
        const upload = await syncGenerateAttachmentUploadUrl(
          targetType,
          targetId
        )

        if (!upload?.uploadUrl) {
          throw new Error("Upload URL was not returned")
        }

        const uploadResponse = await fetch(upload.uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        })
        const uploadPayload = (await uploadResponse.json()) as {
          storageId?: string
        }

        if (!uploadResponse.ok || !uploadPayload.storageId) {
          throw new Error("File upload failed")
        }

        const storageId = uploadPayload.storageId
        const createdAttachment = await syncCreateAttachment({
          targetType,
          targetId,
          storageId,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        })

        if (createdAttachment?.attachmentId) {
          set((current) => ({
            attachments: [
              {
                id: createdAttachment.attachmentId,
                targetType,
                targetId,
                teamId,
                storageId,
                fileName: file.name,
                contentType: file.type || "application/octet-stream",
                size: file.size,
                uploadedBy: current.currentUserId,
                createdAt: getNow(),
                fileUrl: createdAttachment.fileUrl ?? null,
              },
              ...current.attachments,
            ],
          }))
        }

        toast.success(`${file.name} uploaded`)
        return {
          fileName: file.name,
          fileUrl: createdAttachment?.fileUrl ?? null,
        }
      } catch (error) {
        console.error(error)
        void runtime.refreshFromServer().catch((refreshError) => {
          console.error(
            "Failed to reconcile attachments after upload failure",
            refreshError
          )
        })
        toast.error("Failed to upload attachment")
        return null
      }
    },
    async deleteAttachment(attachmentId) {
      const state = get()
      const attachment = state.attachments.find(
        (entry) => entry.id === attachmentId
      )

      if (!attachment) {
        return
      }

      const role = effectiveRole(state, attachment.teamId)

      if (role === "viewer" || role === "guest" || !role) {
        toast.error("Your current role is read-only")
        return
      }

      set((current) => ({
        attachments: current.attachments.filter(
          (entry) => entry.id !== attachmentId
        ),
      }))

      try {
        await syncDeleteAttachment(attachmentId)
        toast.success("Attachment deleted")
      } catch (error) {
        console.error(error)
        set((current) => ({
          attachments: current.attachments.some(
            (entry) => entry.id === attachment.id
          )
            ? current.attachments
            : [attachment, ...current.attachments],
        }))
        toast.error("Failed to delete attachment")
      }
    },
    async createDocument(input) {
      const parsed = documentSchema.safeParse(input)
      if (!parsed.success) {
        toast.error("Document input is invalid")
        return null
      }
      const documentInput = parsed.data
      const validationMessage = getDocumentCreationValidationMessage(
        get(),
        documentInput
      )

      if (validationMessage) {
        toast.error(validationMessage)
        return null
      }

      if (documentInput.kind === "team-document") {
        const role = effectiveRole(get(), documentInput.teamId)

        if (role === "viewer" || role === "guest" || !role) {
          toast.error("Your current role is read-only")
          return null
        }
      } else if (!canEditWorkspaceDocuments(get(), documentInput.workspaceId)) {
        toast.error("Your current role is read-only")
        return null
      }

      const documentId = createId("document")
      const createdAt = getNow()

      set((state) => {
        if (documentInput.kind === "team-document") {
          const workspaceId =
            state.teams.find((team) => team.id === documentInput.teamId)
              ?.workspaceId ?? ""
          const document = {
            id: documentId,
            kind: documentInput.kind,
            workspaceId,
            teamId: documentInput.teamId,
            title: documentInput.title,
            content: `<h1>${documentInput.title}</h1><p>New team document.</p>`,
            linkedProjectIds: [],
            linkedWorkItemIds: [],
            createdBy: state.currentUserId,
            updatedBy: state.currentUserId,
            createdAt,
            updatedAt: createdAt,
          }

          return {
            ...state,
            documents: [document, ...state.documents],
          }
        }

        const contentTemplate =
          documentInput.kind === "private-document"
            ? "New private document."
            : "New workspace document."

        const document = {
          id: documentId,
          kind: documentInput.kind,
          workspaceId: documentInput.workspaceId,
          teamId: null,
          title: documentInput.title,
          content: `<h1>${documentInput.title}</h1><p>${contentTemplate}</p>`,
          linkedProjectIds: [],
          linkedWorkItemIds: [],
          createdBy: state.currentUserId,
          updatedBy: state.currentUserId,
          createdAt,
          updatedAt: createdAt,
        }

        return {
          ...state,
          documents: [document, ...state.documents],
        }
      })

      try {
        const result = await syncCreateDocument(get().currentUserId, {
          ...documentInput,
          id: documentId,
        })

        if (result?.documentId && result.documentId !== documentId) {
          await runtime.refreshFromServer()
          toast.success("Document created")
          return result.documentId
        }

        toast.success("Document created")
        return documentId
      } catch (error) {
        set((state) => ({
          documents: state.documents.filter(
            (document) => document.id !== documentId
          ),
        }))
        await runtime.handleSyncFailure(error, "Failed to create document")
        return null
      }
    },
  }
}

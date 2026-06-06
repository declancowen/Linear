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
  syncUpdateDocument,
  syncUpdateItemDescription,
  syncUpdateWorkItem,
} from "@/lib/convex/client"
import {
  getDocumentRichTextReferenceRelationships,
  getWorkItemDescriptionRichTextReferenceRelationships,
  hasWorkspaceAccess,
} from "@/lib/domain/selectors"
import { documentSchema } from "@/lib/domain/types"
import { getAttachmentFileValidationMessage } from "@/lib/domain/file-uploads"
import { getWorkItemAssigneeIds } from "@/lib/domain/work-item-assignees"

import { createId, getNow } from "../helpers"
import { waitForPendingWorkItemCreation } from "../pending-work-item-creations"
import {
  canEditWorkspaceDocuments,
  effectiveRole,
  getDocumentCreationValidationMessage,
  getWorkItemValidationMessage,
} from "../validation"
import type { AppStore } from "../types"
import type { WorkSlice, WorkSliceFactoryArgs } from "./work-shared"

const DEFAULT_ATTACHMENT_CONTENT_TYPE = "application/octet-stream"

type AttachmentUploadTargetType = Parameters<WorkSlice["uploadAttachment"]>[0]
type SaveWorkItemMainSectionInput = Parameters<
  WorkSlice["saveWorkItemMainSection"]
>[0]
type WorkDocumentRuntime = WorkSliceFactoryArgs["runtime"]
type WorkDocumentSet = WorkSliceFactoryArgs["set"]
type WorkDocumentGet = WorkSliceFactoryArgs["get"]
type WorkItemRecord = AppStore["workItems"][number]
type DocumentRecord = AppStore["documents"][number]

type AttachmentUploadValidationResult =
  | {
      ok: true
      teamId: string | null
    }
  | {
      ok: false
      message: string
    }

type SaveWorkItemMainSectionTarget =
  | {
      ok: true
      descriptionDocument: DocumentRecord
      item: WorkItemRecord
      normalizedTitle: string
    }
  | {
      ok: false
      message: string
    }

type WorkItemMainSectionChanges = {
  descriptionChanged: boolean
  titleChanged: boolean
}

function getAttachmentContentType(file: File) {
  return file.type || DEFAULT_ATTACHMENT_CONTENT_TYPE
}

function canEditPrivateWorkItem(
  state: AppStore,
  item: AppStore["workItems"][number]
) {
  const workspaceId = item.workspaceId ?? null

  if (!workspaceId) {
    return false
  }

  return (
    item.creatorId === state.currentUserId &&
    hasWorkspaceAccess(state, workspaceId, state.currentUserId)
  )
}

function canEditWorkItemMainSection(state: AppStore, item: WorkItemRecord) {
  if ((item.visibility ?? "team") === "private") {
    return canEditPrivateWorkItem(state, item)
  }

  return !["viewer", "guest", null].includes(effectiveRole(state, item.teamId))
}

function getWorkItemMainSectionValidationMessage(
  state: AppStore,
  item: WorkItemRecord,
  normalizedTitle: string
) {
  return getWorkItemValidationMessage(state, {
    teamId: item.teamId,
    type: item.type,
    title: normalizedTitle,
    priority: item.priority,
    assigneeId: item.assigneeId,
    assigneeIds: getWorkItemAssigneeIds(item),
    parentId: item.parentId,
    primaryProjectId: item.primaryProjectId,
    labelIds: item.labelIds,
    visibility: item.visibility ?? "team",
    workspaceId: item.workspaceId ?? null,
    currentItemId: item.id,
  })
}

function resolveWorkItemMainSectionTarget(
  state: AppStore,
  input: SaveWorkItemMainSectionInput
): SaveWorkItemMainSectionTarget {
  const item = state.workItems.find((entry) => entry.id === input.itemId)

  if (!item) {
    return { ok: false, message: "Work item not found" }
  }

  if (!canEditWorkItemMainSection(state, item)) {
    return { ok: false, message: "Your current role is read-only" }
  }

  const normalizedTitle = input.title.trim()
  const validationMessage = getWorkItemMainSectionValidationMessage(
    state,
    item,
    normalizedTitle
  )

  if (validationMessage) {
    return { ok: false, message: validationMessage }
  }

  const descriptionDocument = state.documents.find(
    (document) => document.id === item.descriptionDocId
  )

  return descriptionDocument
    ? { ok: true, descriptionDocument, item, normalizedTitle }
    : { ok: false, message: "Work item description document not found" }
}

function getWorkItemMainSectionChanges(
  input: SaveWorkItemMainSectionInput,
  target: Extract<SaveWorkItemMainSectionTarget, { ok: true }>
): WorkItemMainSectionChanges {
  return {
    descriptionChanged:
      input.description !== target.descriptionDocument.content,
    titleChanged: target.normalizedTitle !== target.item.title,
  }
}

function hasWorkItemMainSectionChanges(changes: WorkItemMainSectionChanges) {
  return changes.descriptionChanged || changes.titleChanged
}

function getWorkItemMainSectionConflictMessage(
  item: WorkItemRecord,
  input: SaveWorkItemMainSectionInput
) {
  return item.updatedAt === input.expectedUpdatedAt
    ? null
    : "This work item changed while you were editing. Review the latest version and try again."
}

function applyOptimisticWorkItemMainSectionUpdate({
  changes,
  input,
  normalizedTitle,
  set,
  target,
  updatedAt,
}: {
  changes: WorkItemMainSectionChanges
  input: SaveWorkItemMainSectionInput
  normalizedTitle: string
  set: WorkDocumentSet
  target: Extract<SaveWorkItemMainSectionTarget, { ok: true }>
  updatedAt: string
}) {
  set((current) => {
    const relationships = changes.descriptionChanged
      ? getWorkItemDescriptionRichTextReferenceRelationships(
          current,
          target.item,
          input.description
        )
      : null

    return {
      documents: current.documents.map((document) =>
        document.id === target.item.descriptionDocId
          ? {
              ...document,
              ...(changes.descriptionChanged
                ? { content: input.description }
                : {}),
              ...(changes.titleChanged
                ? { title: `${normalizedTitle} description` }
                : {}),
              updatedAt,
              updatedBy: current.currentUserId,
            }
          : document
      ),
      workItems: current.workItems.map((entry) =>
        entry.id === target.item.id
          ? {
              ...entry,
              title: normalizedTitle,
              ...(relationships
                ? {
                    linkedDocumentIds: relationships.documentIds,
                    linkedWorkItemIds: relationships.workItemIds,
                    referencedProjectIds: relationships.projectIds,
                    referencedViewIds: relationships.viewIds,
                  }
                : {}),
              updatedAt,
            }
          : entry
      ),
    }
  })
}

function restoreWorkItemMainSectionSnapshot({
  previousDescriptionDocument,
  previousItem,
  set,
}: {
  previousDescriptionDocument: DocumentRecord
  previousItem: WorkItemRecord
  set: WorkDocumentSet
}) {
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
}

function getWorkItemMainSectionSyncPatch({
  changes,
  input,
  normalizedTitle,
}: {
  changes: WorkItemMainSectionChanges
  input: SaveWorkItemMainSectionInput
  normalizedTitle: string
}) {
  return {
    ...(changes.titleChanged ? { title: normalizedTitle } : {}),
    ...(changes.descriptionChanged ? { description: input.description } : {}),
    expectedUpdatedAt: input.expectedUpdatedAt,
  }
}

function getWorkItemMainSectionSyncFailureMessage(error: unknown) {
  return error instanceof RouteMutationError &&
    error.code === "WORK_ITEM_EDIT_CONFLICT"
    ? "This work item changed while you were editing. Review the latest version and try again."
    : "Failed to save work item"
}

async function persistWorkItemMainSectionUpdate({
  changes,
  get,
  input,
  normalizedTitle,
  runtime,
  set,
  target,
}: {
  changes: WorkItemMainSectionChanges
  get: WorkDocumentGet
  input: SaveWorkItemMainSectionInput
  normalizedTitle: string
  runtime: WorkDocumentRuntime
  set: WorkDocumentSet
  target: Extract<SaveWorkItemMainSectionTarget, { ok: true }>
}) {
  const updatedAt = getNow()
  const previousItem = target.item
  const previousDescriptionDocument = target.descriptionDocument

  applyOptimisticWorkItemMainSectionUpdate({
    changes,
    input,
    normalizedTitle,
    set,
    target,
    updatedAt,
  })

  try {
    await syncUpdateWorkItem(
      get().currentUserId,
      target.item.id,
      getWorkItemMainSectionSyncPatch({ changes, input, normalizedTitle })
    )

    return true
  } catch (error) {
    restoreWorkItemMainSectionSnapshot({
      previousDescriptionDocument,
      previousItem,
      set,
    })

    await runtime.handleSyncFailure(
      error,
      getWorkItemMainSectionSyncFailureMessage(error)
    )
    return false
  }
}

function readOnlyAttachmentTarget() {
  return {
    ok: false,
    message: "Your current role is read-only",
  } satisfies AttachmentUploadValidationResult
}

function validateEditableWorkItemAttachmentTarget(
  state: AppStore,
  targetId: string
): AttachmentUploadValidationResult {
  const item = state.workItems.find((entry) => entry.id === targetId)

  if (!item) {
    return {
      ok: false,
      message: "Work item not found",
    }
  }

  if ((item.visibility ?? "team") === "private") {
    return canEditPrivateWorkItem(state, item)
      ? { ok: true, teamId: null }
      : readOnlyAttachmentTarget()
  }

  const role = effectiveRole(state, item.teamId)

  return role === "viewer" || role === "guest" || !role
    ? readOnlyAttachmentTarget()
    : { ok: true, teamId: item.teamId }
}

function validateEditableConversationAttachmentTarget(
  state: AppStore,
  targetId: string
): AttachmentUploadValidationResult {
  const conversation = state.conversations.find(
    (entry) => entry.id === targetId
  )

  if (!conversation) {
    return {
      ok: false,
      message: "Conversation not found",
    }
  }

  if (
    conversation.kind === "chat" &&
    !conversation.participantIds.includes(state.currentUserId)
  ) {
    return {
      ok: false,
      message: "You do not have access to this chat",
    }
  }

  if (conversation.scopeType === "workspace") {
    return canEditWorkspaceDocuments(state, conversation.scopeId)
      ? { ok: true, teamId: null }
      : readOnlyAttachmentTarget()
  }

  const role = effectiveRole(state, conversation.scopeId)

  return role === "viewer" || role === "guest" || !role
    ? readOnlyAttachmentTarget()
    : { ok: true, teamId: conversation.scopeId }
}

function validateEditableDocumentAttachmentTarget(
  state: AppStore,
  targetId: string
): AttachmentUploadValidationResult {
  const document = state.documents.find((entry) => entry.id === targetId)
  const role = effectiveRole(state, document?.teamId)

  return role === "viewer" || role === "guest" || !role
    ? readOnlyAttachmentTarget()
    : { ok: true, teamId: document?.teamId ?? null }
}

function validateEditableAttachmentTarget(
  state: AppStore,
  targetType: AttachmentUploadTargetType,
  targetId: string
): AttachmentUploadValidationResult {
  if (targetType === "workItem") {
    return validateEditableWorkItemAttachmentTarget(state, targetId)
  }

  if (targetType === "conversation") {
    return validateEditableConversationAttachmentTarget(state, targetId)
  }

  return validateEditableDocumentAttachmentTarget(state, targetId)
}

function validateAttachmentUpload(
  state: AppStore,
  targetType: AttachmentUploadTargetType,
  targetId: string,
  file: File | null | undefined
): AttachmentUploadValidationResult {
  const targetValidation = validateEditableAttachmentTarget(
    state,
    targetType,
    targetId
  )

  if (!targetValidation.ok) {
    return targetValidation
  }

  const fileValidation = validateAttachmentFile(file)

  return fileValidation.ok
    ? { ok: true, teamId: targetValidation.teamId }
    : fileValidation
}

function validateAttachmentFile(
  file: File | null | undefined
): AttachmentUploadValidationResult {
  const message = getAttachmentFileValidationMessage(file)

  return message ? { ok: false, message } : { ok: true, teamId: null }
}

async function uploadAttachmentFileToStorage(uploadUrl: string, file: File) {
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": getAttachmentContentType(file),
    },
    body: file,
  })
  const uploadPayload = (await uploadResponse.json()) as {
    storageId?: string
  }

  if (!uploadResponse.ok || !uploadPayload.storageId) {
    throw new Error("File upload failed")
  }

  return uploadPayload.storageId
}

function createOptimisticAttachmentRecord(input: {
  attachmentId: string
  createdAt: string
  currentUserId: string
  file: File
  fileUrl: string | null
  storageId: string
  targetId: string
  targetType: AttachmentUploadTargetType
  teamId: string | null
}): AppStore["attachments"][number] {
  return {
    id: input.attachmentId,
    targetType: input.targetType,
    targetId: input.targetId,
    teamId: input.teamId,
    storageId: input.storageId,
    fileName: input.file.name,
    contentType: getAttachmentContentType(input.file),
    size: input.file.size,
    uploadedBy: input.currentUserId,
    createdAt: input.createdAt,
    fileUrl: input.fileUrl,
  }
}

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
  | "flushItemDescriptionSync"
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
  function updatePersistedDocumentMetadata(
    documents: AppStore["documents"],
    documentId: string,
    updatedAt: string,
    currentUserId: string,
    relationships?: ReturnType<typeof getDocumentRichTextReferenceRelationships>
  ) {
    return documents.map((document) =>
      document.id === documentId
        ? {
            ...document,
            updatedAt,
            updatedBy: currentUserId,
            ...(relationships
              ? {
                  linkedProjectIds: relationships.projectIds,
                  linkedWorkItemIds: relationships.workItemIds,
                  linkedDocumentIds: relationships.documentIds,
                  linkedViewIds: relationships.viewIds,
                }
              : {}),
          }
        : document
    )
  }

  function markDocumentPersisted(
    documentId: string,
    updatedAt: string,
    currentUserId: string,
    relationships?: ReturnType<typeof getDocumentRichTextReferenceRelationships>
  ) {
    set((state) => ({
      documents: updatePersistedDocumentMetadata(
        state.documents,
        documentId,
        updatedAt,
        currentUserId,
        relationships
      ),
    }))
  }

  function markItemDescriptionPersisted(
    itemId: string,
    documentId: string,
    updatedAt: string,
    currentUserId: string,
    relationships?: ReturnType<
      typeof getWorkItemDescriptionRichTextReferenceRelationships
    >
  ) {
    set((state) => ({
      documents: updatePersistedDocumentMetadata(
        state.documents,
        documentId,
        updatedAt,
        currentUserId
      ),
      workItems: state.workItems.map((entry) =>
        entry.id === itemId
          ? {
              ...entry,
              updatedAt,
              ...(relationships
                ? {
                    linkedDocumentIds: relationships.documentIds,
                    linkedWorkItemIds: relationships.workItemIds,
                    referencedProjectIds: relationships.projectIds,
                    referencedViewIds: relationships.viewIds,
                  }
                : {}),
            }
          : entry
      ),
    }))
  }

  function patchItemDescriptionContent(itemId: string, content: string) {
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
  }

  function markPendingDocumentContentSync(documentId: string, token: string) {
    set((state) => ({
      pendingDocumentContentSyncs: {
        ...(state.pendingDocumentContentSyncs ?? {}),
        [documentId]: token,
      },
    }))
  }

  function clearPendingDocumentContentSync(documentId: string, token?: string) {
    set((state) => {
      const currentToken = state.pendingDocumentContentSyncs?.[documentId]

      if (!currentToken || (token && currentToken !== token)) {
        return state
      }

      const nextPendingSyncs = { ...state.pendingDocumentContentSyncs }
      delete nextPendingSyncs[documentId]

      return {
        pendingDocumentContentSyncs: nextPendingSyncs,
      }
    })
  }

  function queueDocumentMetadataSync(
    documentId: string,
    syncDocument: (
      state: ReturnType<typeof get>,
      document: ReturnType<typeof get>["documents"][number]
    ) => Promise<{ updatedAt: string }>,
    options?: {
      deriveRelationships?: boolean
      pendingContentToken?: string
    }
  ) {
    if (get().protectedDocumentIds.includes(documentId)) {
      if (options?.pendingContentToken) {
        clearPendingDocumentContentSync(documentId, options.pendingContentToken)
      }
      return
    }

    runtime.queueRichTextSync(
      `document:${documentId}`,
      async (syncContext) => {
        let shouldClearPendingContentSync = false

        try {
          const state = get()
          if (state.protectedDocumentIds.includes(documentId)) {
            shouldClearPendingContentSync = true
            return null
          }

          const document = state.documents.find(
            (entry) => entry.id === documentId
          )

          if (!document || document.kind === "item-description") {
            shouldClearPendingContentSync = true
            return null
          }

          const relationships = options?.deriveRelationships
            ? getDocumentRichTextReferenceRelationships(
                state,
                document,
                document.content
              )
            : undefined

          const result = await syncDocument(state, document)
          if (!syncContext.isCurrent()) {
            return
          }

          markDocumentPersisted(
            documentId,
            result.updatedAt,
            state.currentUserId,
            relationships
          )
          shouldClearPendingContentSync = true
        } finally {
          if (options?.pendingContentToken && shouldClearPendingContentSync) {
            clearPendingDocumentContentSync(
              documentId,
              options.pendingContentToken
            )
          }
        }
      },
      "Failed to update document",
      {
        refreshStrategy: "none",
      }
    )
  }

  return {
    updateDocumentContent(documentId, content) {
      const pendingContentToken = createId("document-content-sync")

      set((state) => {
        return {
          documents: state.documents.map((entry) =>
            entry.id === documentId
              ? {
                  ...entry,
                  content,
                }
              : entry
          ),
        }
      })
      markPendingDocumentContentSync(documentId, pendingContentToken)

      queueDocumentMetadataSync(
        documentId,
        (state, document) =>
          syncUpdateDocument(documentId, {
            title: document.title,
            content: document.content,
            expectedUpdatedAt: document.updatedAt,
          }),
        { deriveRelationships: true, pendingContentToken }
      )
    },
    cancelDocumentSync(documentId) {
      runtime.cancelRichTextSync(`document:${documentId}`)
      clearPendingDocumentContentSync(documentId)
    },
    applyDocumentCollaborationContent(documentId, content) {
      runtime.cancelRichTextSync(`document:${documentId}`)
      clearPendingDocumentContentSync(documentId)

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
      clearPendingDocumentContentSync(documentId)
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
    async flushItemDescriptionSync(itemId) {
      await runtime.flushRichTextSync(`item-description:${itemId}`)
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

      const currentPendingContentToken =
        get().pendingDocumentContentSyncs?.[documentId] ?? undefined
      const pendingContentToken = currentPendingContentToken
        ? createId("document-content-sync")
        : undefined

      if (pendingContentToken) {
        markPendingDocumentContentSync(documentId, pendingContentToken)
      }

      queueDocumentMetadataSync(
        documentId,
        (state, document) =>
          pendingContentToken
            ? syncUpdateDocument(documentId, {
                title: document.title,
                content: document.content,
                expectedUpdatedAt: document.updatedAt,
              })
            : syncRenameDocument(
                state.currentUserId,
                documentId,
                document.title
              ),
        {
          deriveRelationships: Boolean(pendingContentToken),
          ...(pendingContentToken ? { pendingContentToken } : {}),
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
      patchItemDescriptionContent(itemId, content)

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
        async (syncContext) => {
          const pendingCreation = waitForPendingWorkItemCreation(itemId)

          if (pendingCreation) {
            const created = await pendingCreation

            if (!created || !syncContext.isCurrent()) {
              return
            }
          }

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

          const relationships =
            getWorkItemDescriptionRichTextReferenceRelationships(
              state,
              item,
              descriptionDocument.content
            )

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
              state.currentUserId,
              relationships
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
      patchItemDescriptionContent(itemId, content)
    },
    async saveWorkItemMainSection(input) {
      const state = get()
      const target = resolveWorkItemMainSectionTarget(state, input)

      if (!target.ok) {
        toast.error(target.message)
        return false
      }

      const changes = getWorkItemMainSectionChanges(input, target)

      if (!hasWorkItemMainSectionChanges(changes)) {
        return true
      }

      const conflictMessage = getWorkItemMainSectionConflictMessage(
        target.item,
        input
      )

      if (conflictMessage) {
        toast.error(conflictMessage)
        return false
      }

      return persistWorkItemMainSectionUpdate({
        changes,
        get,
        input,
        normalizedTitle: target.normalizedTitle,
        runtime,
        set,
        target,
      })
    },
    async uploadAttachment(targetType, targetId, file) {
      const state = get()
      const validation = validateAttachmentUpload(
        state,
        targetType,
        targetId,
        file
      )

      if (!validation.ok) {
        toast.error(validation.message)
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

        const storageId = await uploadAttachmentFileToStorage(
          upload.uploadUrl,
          file
        )
        const createdAttachment = await syncCreateAttachment({
          targetType,
          targetId,
          storageId,
          fileName: file.name,
          contentType: getAttachmentContentType(file),
          size: file.size,
        })

        if (createdAttachment?.attachmentId) {
          set((current) => ({
            attachments: [
              createOptimisticAttachmentRecord({
                attachmentId: createdAttachment.attachmentId,
                createdAt: getNow(),
                currentUserId: current.currentUserId,
                file,
                fileUrl: createdAttachment.fileUrl ?? null,
                storageId,
                targetType,
                targetId,
                teamId: validation.teamId,
              }),
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

      const validation = validateEditableAttachmentTarget(
        state,
        attachment.targetType,
        attachment.targetId
      )

      if (!validation.ok) {
        toast.error(validation.message)
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
            bodySource: "convex-html" as const,
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
          bodySource: "convex-html" as const,
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

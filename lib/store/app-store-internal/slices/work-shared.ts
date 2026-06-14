"use client"

import { createStoreRuntime } from "../runtime"
import type { AppStore, AppStoreGet, AppStoreSet } from "../types"

export type WorkSlice = Pick<
  AppStore,
  | "createLabel"
  | "updateLabel"
  | "updateWorkItem"
  | "bulkUpdateWorkItems"
  | "setWorkItemSubscription"
  | "deleteWorkItem"
  | "deleteWorkItems"
  | "shiftTimelineItem"
  | "updateDocumentContent"
  | "cancelDocumentSync"
  | "applyDocumentCollaborationContent"
  | "applyDocumentCollaborationTitle"
  | "flushDocumentSync"
  | "renameDocument"
  | "deleteDocument"
  | "saveWorkItemMainSection"
  | "uploadAttachment"
  | "deleteAttachment"
  | "addComment"
  | "updateComment"
  | "deleteComment"
  | "toggleCommentReaction"
  | "createDocument"
  | "createWorkItem"
>

export type WorkSliceFactoryArgs = {
  set: AppStoreSet
  get: AppStoreGet
  runtime: ReturnType<typeof createStoreRuntime>
}

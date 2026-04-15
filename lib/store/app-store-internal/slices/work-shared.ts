"use client"

import { createStoreRuntime } from "../runtime"
import type { AppStore, AppStoreGet, AppStoreSet } from "../types"

export type WorkSlice = Pick<
  AppStore,
  | "createLabel"
  | "updateWorkItem"
  | "deleteWorkItem"
  | "shiftTimelineItem"
  | "updateDocumentContent"
  | "renameDocument"
  | "deleteDocument"
  | "updateItemDescription"
  | "uploadAttachment"
  | "deleteAttachment"
  | "addComment"
  | "toggleCommentReaction"
  | "createDocument"
  | "createWorkItem"
>

export type WorkSliceFactoryArgs = {
  set: AppStoreSet
  get: AppStoreGet
  runtime: ReturnType<typeof createStoreRuntime>
}

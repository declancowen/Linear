"use client"

import { createStoreRuntime } from "../runtime"
import type { AppStoreGet, AppStoreSet } from "../types"
import { createWorkCommentActions } from "./work-comment-actions"
import { createWorkDocumentActions } from "./work-document-actions"
import { createWorkItemActions } from "./work-item-actions"
import type { WorkSlice } from "./work-shared"

export function createWorkSlice(
  set: AppStoreSet,
  get: AppStoreGet,
  runtime: ReturnType<typeof createStoreRuntime>
): WorkSlice {
  return {
    ...createWorkItemActions({ set, get, runtime }),
    ...createWorkDocumentActions({ set, get, runtime }),
    ...createWorkCommentActions({ set, get, runtime }),
  }
}

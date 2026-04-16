"use client"

import { createStoreRuntime } from "../runtime"
import type { AppStoreGet, AppStoreSet } from "../types"
import { createCollaborationChannelActions } from "./collaboration-channel-actions"
import { createCollaborationConversationActions } from "./collaboration-conversation-actions"
import { createCollaborationInviteActions } from "./collaboration-invite-actions"
import type { CollaborationSlice } from "./collaboration-shared"

export function createCollaborationSlice(
  set: AppStoreSet,
  get: AppStoreGet,
  runtime: ReturnType<typeof createStoreRuntime>
): CollaborationSlice {
  return {
    ...createCollaborationConversationActions({ set, get, runtime }),
    ...createCollaborationChannelActions({ set, get, runtime }),
    ...createCollaborationInviteActions({ set, get, runtime }),
  }
}

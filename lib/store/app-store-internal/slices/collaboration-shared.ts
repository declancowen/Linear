"use client"

import { createStoreRuntime } from "../runtime"
import type { AppStore, AppStoreGet, AppStoreSet } from "../types"

export type CollaborationSlice = Pick<
  AppStore,
  | "createWorkspaceChat"
  | "ensureTeamChat"
  | "createChannel"
  | "startConversationCall"
  | "sendChatMessage"
  | "updateChatMessage"
  | "deleteChatMessage"
  | "markChatRead"
  | "markChatUnread"
  | "toggleChatMessageReaction"
  | "createChannelPost"
  | "updateChannelPost"
  | "addChannelPostComment"
  | "updateChannelPostComment"
  | "deleteChannelPost"
  | "deleteChannelPostComment"
  | "toggleChannelPostReaction"
  | "toggleChannelPostCommentReaction"
  | "createInvite"
  | "cancelInvite"
>

export type CollaborationSliceFactoryArgs = {
  set: AppStoreSet
  get: AppStoreGet
  runtime: ReturnType<typeof createStoreRuntime>
}

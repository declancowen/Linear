export type ScopedReadModelInstruction =
  | { kind: "document-detail"; documentId: string }
  | {
      kind: "document-index"
      scopeType: "team" | "workspace"
      scopeId: string
    }
  | { kind: "work-item-detail"; itemId: string }
  | {
      kind: "work-index"
      scopeType: "personal" | "team" | "workspace"
      scopeId: string
    }
  | { kind: "project-detail"; projectId: string }
  | {
      kind: "project-index"
      scopeType: "team" | "workspace"
      scopeId: string
    }
  | { kind: "workspace-people"; workspaceId: string }
  | {
      kind: "view-catalog"
      scopeType: "team" | "workspace"
      scopeId: string
    }
  | { kind: "notification-inbox" }
  | { kind: "conversation-list" }
  | { kind: "conversation-thread"; conversationId: string }
  | { kind: "channel-feed"; conversationId: string }
  | { kind: "search-seed"; workspaceId: string }

export type ScopedReadModelScopeKeyTarget =
  | { kind: "document"; documentId: string }
  | { kind: "work-item"; itemId: string }
  | { kind: "private-label"; ownerId: string; workspaceId: string }
  | {
      kind: "custom-property-definition"
      scopeType?: "team"
      teamId: string
    }
  | {
      kind: "custom-property-definition"
      scopeType: "workspace"
      workspaceId: string
    }
  | {
      kind: "custom-property-definition"
      scopeType: "private"
      ownerId: string
      workspaceId: string
    }
  | { kind: "project"; projectId: string }
  | { kind: "view"; viewId: string }
  | { kind: "conversation"; conversationId: string }
  | { kind: "channel-post"; postId: string }
  | { kind: "chat-message"; messageId: string }
  | { kind: "user-workspace-membership"; userId: string }

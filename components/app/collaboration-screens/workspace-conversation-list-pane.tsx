"use client"

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { Plus } from "@phosphor-icons/react"

import type { AppData, Conversation } from "@/lib/domain/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ConversationList,
  WORKSPACE_CHAT_LIST_DEFAULT_WIDTH_PERCENTAGE,
} from "@/components/app/collaboration-screens/workspace-chat-ui"
import { getConversationPreview } from "@/components/app/collaboration-screens/workspace-conversation-preview"

type WorkspaceChatListWidth = number | null

export function WorkspaceConversationListPane({
  chats,
  activeChat,
  conversationListWidth,
  conversationListResizing,
  latestMessagesByConversationId,
  renderConversationAvatar,
  onCreateChat,
  onMarkChatRead,
  onMarkChatUnread,
  onResizeStart,
  onResetWidth,
  onSelectChat,
}: {
  chats: Array<Conversation & { unread?: boolean }>
  activeChat: Conversation | null
  conversationListWidth: WorkspaceChatListWidth
  conversationListResizing: boolean
  latestMessagesByConversationId: Map<
    AppData["chatMessages"][number]["conversationId"],
    AppData["chatMessages"][number]
  >
  renderConversationAvatar: (conversationId: string) => ReactNode
  onCreateChat: () => void
  onMarkChatRead: (id: string) => void
  onMarkChatUnread: (id: string) => void
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onResetWidth: () => void
  onSelectChat: (id: string) => void
}) {
  const paneWidth =
    conversationListWidth === null
      ? WORKSPACE_CHAT_LIST_DEFAULT_WIDTH_PERCENTAGE
      : `${conversationListWidth}px`

  return (
    <div
      data-workspace-chat-list-pane
      className="relative flex min-h-0 shrink-0 flex-col border-r"
      style={{
        width: paneWidth,
        flexBasis: paneWidth,
        minWidth: WORKSPACE_CHAT_LIST_DEFAULT_WIDTH_PERCENTAGE,
      }}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-4">
        <span className="truncate text-sm font-medium">Conversations</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-xs"
          onClick={onCreateChat}
        >
          <Plus className="size-3.5" />
          New chat
        </Button>
      </div>
      <ConversationList
        className="h-auto min-h-0 flex-1 border-r-0"
        conversations={chats}
        selectedId={activeChat?.id ?? null}
        onSelect={onSelectChat}
        onMarkRead={onMarkChatRead}
        onMarkUnread={onMarkChatUnread}
        renderLeading={renderConversationAvatar}
        renderPreview={(id) =>
          getConversationPreview(latestMessagesByConversationId.get(id))
        }
      />
      <button
        type="button"
        aria-label="Resize chat list"
        className={cn(
          "group absolute top-0 -right-2 z-10 hidden h-full w-4 cursor-col-resize touch-none select-none md:block",
          conversationListResizing && "bg-primary/6"
        )}
        onPointerDown={onResizeStart}
        onDoubleClick={onResetWidth}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-2 left-1/2 w-2 -translate-x-1/2 rounded-full bg-transparent transition-colors",
            conversationListResizing ? "bg-primary/10" : "group-hover:bg-accent"
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 rounded-full bg-border/80 transition-all",
            conversationListResizing
              ? "w-0.5 bg-primary/55"
              : "group-hover:w-0.5 group-hover:bg-primary/45"
          )}
        />
      </button>
    </div>
  )
}

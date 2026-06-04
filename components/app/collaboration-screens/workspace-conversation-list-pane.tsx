"use client"

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { Plus } from "@phosphor-icons/react"

import type { AppData, Conversation } from "@/lib/domain/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ConversationList,
  WORKSPACE_CHAT_LIST_DEFAULT_WIDTH,
} from "@/components/app/collaboration-screens/workspace-chat-ui"
import { getConversationPreview } from "@/components/app/collaboration-screens/workspace-conversation-preview"

type WorkspaceChatListWidth = number | null

export type WorkspaceConversationListPaneProps = {
  chats: Array<Conversation & { unread?: boolean }>
  activeChat: Conversation | null
  conversationListWidth: WorkspaceChatListWidth
  conversationListResizing: boolean
  conversationListCollapsed: boolean
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
}

export function WorkspaceConversationListPane({
  chats,
  activeChat,
  conversationListWidth,
  conversationListResizing,
  conversationListCollapsed,
  latestMessagesByConversationId,
  renderConversationAvatar,
  onCreateChat,
  onMarkChatRead,
  onMarkChatUnread,
  onResizeStart,
  onResetWidth,
  onSelectChat,
}: WorkspaceConversationListPaneProps) {
  const paneWidth = conversationListCollapsed
    ? "44px"
    : conversationListWidth === null
      ? `${WORKSPACE_CHAT_LIST_DEFAULT_WIDTH}px`
      : `${conversationListWidth}px`

  if (conversationListCollapsed) {
    return (
      <div
        data-workspace-chat-list-pane
        data-collapsed="true"
        className="relative flex min-h-0 shrink-0 flex-col items-center border-r"
        style={{
          width: paneWidth,
          flexBasis: paneWidth,
          minWidth: paneWidth,
        }}
      >
        <div className="flex h-10 w-full shrink-0 items-center justify-center border-b">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="New chat"
            className="size-7 rounded-md"
            onClick={onCreateChat}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        <div className="no-scrollbar flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto py-2">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              aria-label={`Open ${chat.title}`}
              title={chat.title}
              className={cn(
                "relative inline-grid size-8 place-items-center rounded-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activeChat?.id === chat.id && "bg-accent"
              )}
              onClick={() => onSelectChat(chat.id)}
            >
              {chat.unread ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 size-1.5 rounded-full bg-primary"
                />
              ) : null}
              {renderConversationAvatar(chat.id)}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      data-workspace-chat-list-pane
      className="relative flex min-h-0 shrink-0 flex-col border-r"
      style={{
        width: paneWidth,
        flexBasis: paneWidth,
        minWidth: `${WORKSPACE_CHAT_LIST_DEFAULT_WIDTH}px`,
      }}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">Conversations</span>
        </div>
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

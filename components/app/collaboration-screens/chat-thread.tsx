"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import type { Editor } from "@tiptap/react"
import {
  ArrowUp,
  ArrowSquareOut,
  PaperPlaneTilt,
  Smiley,
} from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import {
  canEditWorkspace,
  getChatMessages,
  getConversationParticipants,
  getTeamRole,
  getUser,
  hasWorkspaceAccessInCollections,
} from "@/lib/domain/selectors"
import { getChatReadState } from "@/lib/domain/chat-read-state"
import { chatMessageContentConstraints } from "@/lib/domain/input-constraints"
import { buildWorkspaceUserPresenceView } from "@/lib/domain/workspace-user-presence"
import { useAppStore } from "@/lib/store/app-store"
import { useChatPresence } from "@/hooks/use-chat-presence"
import { cn, getPlainTextContent } from "@/lib/utils"
import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
import { createQuotedRichText } from "@/components/app/message-quote"
import { MessageHoverActionBar } from "@/components/app/message-hover-action-bar"
import { ReactionUsersHoverCard } from "@/components/app/reaction-users-hover-card"
import { RichTextContent } from "@/components/app/rich-text-content"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { UserAvatar } from "@/components/app/user-presence"
import {
  ChatHeaderActions,
  EmptyState,
} from "@/components/app/collaboration-screens/shared-ui"
import { getChatWelcomeIntroDisplay } from "@/components/app/collaboration-screens/chat-welcome-display"
import {
  buildCallJoinHref,
  formatDayDivider,
  formatTimestamp,
  getChatMessageMarkup,
  getLocalDayKey,
  parseCallInviteMessage,
} from "@/components/app/collaboration-screens/utils"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

const EMPTY_MESSAGE_READ_AT_BY_ID: Record<string, string> = {}

function getLiveComposerContent(
  editorInstanceRef: RefObject<Editor | null>,
  fallbackContent: string
) {
  return (
    editorInstanceRef.current?.getHTML() ??
    editorInstanceRef.current?.getText() ??
    fallbackContent
  )
}

function clearTypingTimeout(typingTimeoutRef: RefObject<number | null>) {
  if (typingTimeoutRef.current === null) {
    return
  }

  window.clearTimeout(typingTimeoutRef.current)
  typingTimeoutRef.current = null
}

function ChatComposer({
  placeholder = "Write a message…",
  onSend,
  mentionCandidates,
  currentUserId,
  editable = true,
  disabledReason,
  draftContent,
  editing,
  onCancelEdit,
  onTypingChange,
}: {
  placeholder?: string
  onSend: (content: string) => void
  mentionCandidates: ReturnType<typeof getConversationParticipants>
  currentUserId: string
  editable?: boolean
  disabledReason?: string | null
  draftContent?: string
  editing?: boolean
  onCancelEdit?: () => void
  onTypingChange?: (typing: boolean) => void
}) {
  const EMPTY_COMPOSER_CONTENT = "<p></p>"
  const [content, setContent] = useState(
    () => draftContent ?? EMPTY_COMPOSER_CONTENT
  )
  const [composerKey, setComposerKey] = useState(0)
  const editorInstanceRef = useRef<Editor | null>(null)
  const typingTimeoutRef = useRef<number | null>(null)
  const contentText = getPlainTextContent(content).trim()
  const filteredMentionCandidates = useMemo(
    () =>
      mentionCandidates.filter((candidate) => candidate.id !== currentUserId),
    [currentUserId, mentionCandidates]
  )

  const handleSend = () => {
    const liveContent = getLiveComposerContent(editorInstanceRef, content)
    const livePlainText = getPlainTextContent(liveContent).trim()

    if (!editable || livePlainText.length === 0) {
      return
    }

    clearTypingTimeout(typingTimeoutRef)
    onTypingChange?.(false)
    onSend(liveContent)
    setContent(EMPTY_COMPOSER_CONTENT)
    setComposerKey((current) => current + 1)
  }

  const handleCancelEdit = () => {
    onCancelEdit?.()
    setContent(EMPTY_COMPOSER_CONTENT)
    setComposerKey((current) => current + 1)
  }

  const handleInsertEmoji = (emoji: string) => {
    editorInstanceRef.current?.chain().focus().insertContent(emoji).run()
  }

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current)
      }

      onTypingChange?.(false)
    }
  }, [onTypingChange])

  const handleChange = (nextContent: string) => {
    setContent(nextContent)

    if (!editable) {
      return
    }

    const nextText = getPlainTextContent(nextContent)
    const isTyping = nextText.trim().length > 0

    onTypingChange?.(isTyping)

    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    if (!isTyping) {
      return
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      typingTimeoutRef.current = null
      onTypingChange?.(false)
    }, 2_500)
  }

  return (
    <div className="px-4 pt-2.5 pb-3.5">
      <div className="rounded-md border border-line bg-surface px-3 pt-2 pb-1.5 transition-colors focus-within:border-fg-3">
        <RichTextEditor
          key={composerKey}
          content={content}
          onChange={handleChange}
          editable={editable}
          compact
          allowSlashCommands={false}
          autoFocus={composerKey > 0}
          showToolbar={false}
          showStats={false}
          placeholder={placeholder}
          editorInstanceRef={editorInstanceRef}
          mentionMenuPlacement="above"
          mentionCandidates={filteredMentionCandidates}
          minPlainTextCharacters={chatMessageContentConstraints.min}
          maxPlainTextCharacters={chatMessageContentConstraints.max}
          enforcePlainTextLimit
          onSubmitShortcut={handleSend}
          submitOnEnter
          className="min-w-0 [&_.ProseMirror]:max-h-40 [&_.ProseMirror]:min-h-[1.55em] [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror]:bg-transparent [&_.ProseMirror]:text-[13.5px] [&_.ProseMirror]:leading-[1.55] [&_.ProseMirror]:outline-none"
        />
        <div className="mt-1 flex items-center gap-0.5 border-t border-dashed border-line pt-1.5 text-fg-3">
          <EmojiPickerPopover
            align="start"
            side="top"
            onEmojiSelect={handleInsertEmoji}
            trigger={
              <button
                type="button"
                disabled={!editable}
                aria-label="Emoji"
                className="inline-grid size-7 place-items-center rounded-md transition-colors hover:bg-surface-3 hover:text-foreground disabled:cursor-default disabled:opacity-60"
              >
                <Smiley className="size-[13px]" />
              </button>
            }
          />
          <span className="flex-1" />
          <kbd className="mr-1 inline-flex h-[18px] items-center rounded-[4px] border border-line bg-surface-2 px-1 font-sans text-[10.5px] font-medium text-fg-3">
            ⏎
          </kbd>
          {editing ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleCancelEdit}
              className="h-7 rounded-md px-2.5 text-[12px]"
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={!editable || !contentText}
            className="h-7 gap-1.5 rounded-md px-2.5 text-[12px]"
          >
            <ArrowUp className="size-3" weight="bold" />
            {editing ? "Save" : "Send"}
          </Button>
        </div>
      </div>
      {!editable && disabledReason ? (
        <div className="mt-2 text-xs text-muted-foreground">
          {disabledReason}
        </div>
      ) : null}
    </div>
  )
}

function formatTypingIndicatorLabel(names: string[]) {
  if (names.length === 0) {
    return ""
  }

  if (names.length === 1) {
    return `${names[0]} is typing`
  }

  if (names.length === 2) {
    return `${names[0]} & ${names[1]} are typing`
  }

  if (names.length === 3) {
    return `${names[0]}, ${names[1]} and ${names[2]} are typing`
  }

  return "Several people are typing"
}

type ChatThreadMessage = ReturnType<typeof getChatMessages>[number]
type ChatMessageReaction = NonNullable<ChatThreadMessage["reactions"]>[number]
type ChatThreadUser = NonNullable<ReturnType<typeof getUser>>
type ChatThreadMember = ReturnType<typeof getConversationParticipants>[number]
type WorkspaceUserPresenceView = ReturnType<
  typeof buildWorkspaceUserPresenceView
>
type AppState = ReturnType<typeof useAppStore.getState>
type WorkspaceMembershipState = "active" | "former" | "unknown"

function isCallThreadMessage(message: ChatThreadMessage | null | undefined) {
  return Boolean(
    message &&
    (message.kind === "call" ||
      message.callId ||
      parseCallInviteMessage(message.content))
  )
}

function resolveMessageCallJoinHref({
  legacyCallInvite,
  message,
}: {
  legacyCallInvite: ReturnType<typeof parseCallInviteMessage>
  message: ChatThreadMessage
}) {
  return message.callId
    ? buildCallJoinHref(message.callId)
    : (legacyCallInvite?.href ?? null)
}

function getChatMessageRowMeta({
  index,
  message,
  previousMessage,
}: {
  index: number
  message: ChatThreadMessage
  previousMessage?: ChatThreadMessage
}) {
  const dayKey = getLocalDayKey(message.createdAt)
  const prevDayKey = previousMessage
    ? getLocalDayKey(previousMessage.createdAt)
    : null
  const showDayDivider = dayKey !== prevDayKey
  const legacyCallInvite =
    message.callId || message.kind === "call"
      ? null
      : parseCallInviteMessage(message.content)
  const callJoinHref = resolveMessageCallJoinHref({
    legacyCallInvite,
    message,
  })
  const isCallMessage =
    message.kind === "call" ||
    Boolean(message.callId) ||
    Boolean(legacyCallInvite)
  const groupedWithPrev =
    !showDayDivider &&
    !isCallMessage &&
    !isCallThreadMessage(previousMessage) &&
    previousMessage?.createdBy === message.createdBy &&
    new Date(message.createdAt).getTime() -
      new Date(previousMessage.createdAt).getTime() <
      5 * 60_000

  return {
    callJoinHref,
    groupedWithPrev,
    showDayDivider,
    showTopMargin: !showDayDivider && index > 0 && !groupedWithPrev,
  }
}

function ChatWelcomeIntro({
  title,
  welcomeParticipant,
  welcomeParticipantView,
}: {
  title: string
  welcomeParticipant: ChatThreadUser
  welcomeParticipantView: WorkspaceUserPresenceView
}) {
  const display = getChatWelcomeIntroDisplay({
    title,
    welcomeParticipant,
    welcomeParticipantView,
  })

  return (
    <div className="px-4 pt-6">
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <UserAvatar
          name={display.avatarName}
          avatarImageUrl={display.avatarImageUrl}
          avatarUrl={display.avatarUrl}
          status={display.status}
          showStatus={display.showStatus}
          size="lg"
          className="size-12"
        />
        <p className="mt-3 text-sm font-medium">{display.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This is the beginning of your conversation with {display.name}.
        </p>
      </div>
    </div>
  )
}

function ChatDayDivider({
  createdAt,
  index,
}: {
  createdAt: string
  index: number
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-4 pb-1 text-[11.5px] text-fg-3",
        index === 0 ? "pt-1" : "pt-3"
      )}
    >
      <span aria-hidden className="h-px flex-1 bg-line-soft" />
      <span>{formatDayDivider(createdAt)}</span>
      <span aria-hidden className="h-px flex-1 bg-line-soft" />
    </div>
  )
}

function ChatMessageAvatar({
  author,
  authorView,
}: {
  author?: ChatThreadUser
  authorView: WorkspaceUserPresenceView
}) {
  return (
    <div className="mt-[4px]">
      <UserAvatar
        name={authorView?.name ?? author?.name}
        avatarImageUrl={authorView?.avatarImageUrl}
        avatarUrl={authorView?.avatarUrl}
        status={authorView?.status ?? undefined}
        showStatus={!authorView?.isFormerMember}
        size="sm"
      />
    </div>
  )
}

function ChatMessageHeader({
  author,
  authorView,
  isCurrentUser,
  message,
  readAt,
}: {
  author?: ChatThreadUser
  authorView: WorkspaceUserPresenceView
  isCurrentUser: boolean
  message: ChatThreadMessage
  readAt?: string | null
}) {
  return (
    <div className="-mt-px flex items-baseline gap-2">
      <span className="text-[13.5px] font-semibold text-foreground">
        {authorView?.name ??
          author?.name ??
          (isCurrentUser ? "You" : "Unknown")}
      </span>
      <ChatMessageMetadata message={message} readAt={readAt} />
    </div>
  )
}

function ChatMessageMetadata({
  className,
  message,
  readAt,
}: {
  className?: string
  message: ChatThreadMessage
  readAt?: string | null
}) {
  const metadata = [formatTimestamp(message.createdAt)]

  if (readAt && !message.deletedAt) {
    metadata.push(`Read ${formatTimestamp(readAt)}`)
  }

  if (message.editedAt && !message.deletedAt) {
    metadata.push(`Edited ${formatTimestamp(message.editedAt)}`)
  }

  return (
    <span className={cn("text-[11.5px] text-fg-3", className)}>
      {metadata.join(" · ")}
    </span>
  )
}

function ChatMessageBody({
  callJoinHref,
  content,
  deletedAt,
  isCurrentUser,
}: {
  callJoinHref: string | null
  content: string
  deletedAt?: string | null
  isCurrentUser: boolean
}) {
  if (deletedAt) {
    return isCurrentUser ? (
      <p className="mt-0.5 text-[13px] text-fg-4 italic">
        You deleted a message
      </p>
    ) : null
  }

  if (callJoinHref) {
    return (
      <div className="mt-0.5 flex flex-col items-start gap-2 text-[13.5px] leading-[1.55] [overflow-wrap:anywhere] text-foreground">
        <p>Started a call</p>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <a href={callJoinHref} target="_blank" rel="noopener noreferrer">
            <ArrowSquareOut className="size-3.5" />
            Join call
          </a>
        </Button>
      </div>
    )
  }

  return (
    <RichTextContent
      content={getChatMessageMarkup(content)}
      className="max-w-full text-[13.5px] leading-[1.55] [overflow-wrap:anywhere] break-words text-foreground [&_.editor-mention]:rounded [&_.editor-mention]:bg-accent-bg [&_.editor-mention]:px-1 [&_.editor-mention]:font-medium [&_.editor-mention]:text-accent-fg [&_a]:break-all [&_code]:rounded [&_code]:bg-surface-3 [&_code]:px-1.5 [&_code]:py-[1px] [&_code]:text-[12.5px] [&_p]:my-0 [&_p+p]:mt-1 [&_pre]:max-w-full [&_pre]:overflow-x-hidden [&_pre]:whitespace-pre-wrap"
    />
  )
}

function ChatMessageReactionButton({
  canReact,
  currentUserId,
  messageId,
  reaction,
  usersById,
}: {
  canReact: boolean
  currentUserId: string
  messageId: string
  reaction: ChatMessageReaction
  usersById: Map<string, ChatThreadUser>
}) {
  const active = reaction.userIds.includes(currentUserId)

  return (
    <ReactionUsersHoverCard userIds={reaction.userIds} usersById={usersById}>
      <button
        type="button"
        disabled={!canReact}
        onClick={() =>
          useAppStore
            .getState()
            .toggleChatMessageReaction(messageId, reaction.emoji)
        }
        className={cn(
          "flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11.5px] tabular-nums transition-colors",
          active
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-line bg-surface text-fg-2 hover:bg-surface-2 hover:text-foreground",
          !canReact && "cursor-default opacity-70 hover:bg-surface hover:text-fg-2"
        )}
      >
        <span>{reaction.emoji}</span>
        <span>{reaction.userIds.length}</span>
      </button>
    </ReactionUsersHoverCard>
  )
}

function ChatMessageReactions({
  canReact,
  currentUserId,
  message,
  usersById,
}: {
  canReact: boolean
  currentUserId: string
  message: ChatThreadMessage
  usersById: Map<string, ChatThreadUser>
}) {
  const reactions = message.reactions ?? []

  if (message.deletedAt || reactions.length === 0) {
    return null
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {reactions.map((reaction) => (
        <ChatMessageReactionButton
          key={`${message.id}-${reaction.emoji}`}
          canReact={canReact}
          currentUserId={currentUserId}
          messageId={message.id}
          reaction={reaction}
          usersById={usersById}
        />
      ))}
    </div>
  )
}

function ChatMessageRow({
  author,
  authorView,
  canCurrentUserWrite,
  currentUserId,
  index,
  message,
  onDeleteMessage,
  onEditMessage,
  onQuoteMessage,
  previousMessage,
  readAt,
  usersById,
}: {
  author?: ChatThreadUser
  authorView: WorkspaceUserPresenceView
  canCurrentUserWrite: boolean
  currentUserId: string
  index: number
  message: ChatThreadMessage
  onDeleteMessage: (message: ChatThreadMessage) => void
  onEditMessage: (message: ChatThreadMessage) => void
  onQuoteMessage: (
    message: ChatThreadMessage,
    authorName: string | undefined
  ) => void
  previousMessage?: ChatThreadMessage
  readAt?: string | null
  usersById: Map<string, ChatThreadUser>
}) {
  const isCurrentUser = message.createdBy === currentUserId
  const canMutateMessage =
    canCurrentUserWrite &&
    isCurrentUser &&
    message.kind === "text" &&
    !message.deletedAt
  const { callJoinHref, groupedWithPrev, showDayDivider, showTopMargin } =
    getChatMessageRowMeta({
      index,
      message,
      previousMessage,
    })

  return (
    <div>
      {showDayDivider ? (
        <ChatDayDivider createdAt={message.createdAt} index={index} />
      ) : null}
      <div
        className={cn(
          "group/msg relative grid items-start gap-x-2.5 px-4 transition-colors hover:bg-surface-2",
          groupedWithPrev ? "py-0" : "py-0.5",
          showTopMargin && "mt-2"
        )}
        style={{ gridTemplateColumns: "24px 1fr" }}
      >
        {!message.deletedAt ? (
          <MessageHoverActionBar
            canDelete={canMutateMessage}
            canEdit={canMutateMessage}
            canQuote={canCurrentUserWrite}
            canReact={canCurrentUserWrite}
            className="top-0 right-4 -translate-y-1/2 group-hover/msg:flex focus-within:flex"
            deleteLabel="Delete message"
            editLabel="Edit message"
            onDelete={() => onDeleteMessage(message)}
            onEdit={() => onEditMessage(message)}
            onQuote={() =>
              onQuoteMessage(message, authorView?.name ?? author?.name)
            }
            quoteLabel="Quote message"
            onReact={(emoji) => {
              useAppStore
                .getState()
                .toggleChatMessageReaction(message.id, emoji)
            }}
          />
        ) : null}
        {groupedWithPrev ? (
          <div aria-hidden />
        ) : (
          <ChatMessageAvatar author={author} authorView={authorView} />
        )}
        <div className="flex min-w-0 flex-col">
          {!groupedWithPrev ? (
            <ChatMessageHeader
              author={author}
              authorView={authorView}
              isCurrentUser={isCurrentUser}
              message={message}
              readAt={readAt}
            />
          ) : (
            <ChatMessageMetadata
              className="mb-0.5 text-fg-4"
              message={message}
              readAt={readAt}
            />
          )}
          <ChatMessageBody
            callJoinHref={callJoinHref}
            content={message.content}
            deletedAt={message.deletedAt}
            isCurrentUser={isCurrentUser}
          />
          <ChatMessageReactions
            canReact={canCurrentUserWrite}
            currentUserId={currentUserId}
            message={message}
            usersById={usersById}
          />
        </div>
      </div>
    </div>
  )
}

function ChatThreadHeader({
  description,
  detailsAction,
  membersCount,
  title,
  videoAction,
}: {
  description: string
  detailsAction?: ReactNode
  membersCount: number
  title: string
  videoAction?: ReactNode
}) {
  const hasHeaderActions = videoAction != null || detailsAction != null

  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium">{title}</span>
        {description ? (
          <span className="hidden truncate text-xs text-muted-foreground 2xl:inline">
            {description}
          </span>
        ) : null}
        <span className="hidden text-xs text-muted-foreground xl:inline">
          {membersCount} members
        </span>
      </div>
      {hasHeaderActions ? (
        <div className="flex items-center gap-1.5">
          <ChatHeaderActions
            videoAction={videoAction}
            detailsAction={detailsAction}
          />
        </div>
      ) : null}
    </div>
  )
}

function ChatMessageList({
  canCurrentUserWrite,
  currentUserId,
  getMembershipState,
  messages,
  messageReadAtById,
  onDeleteMessage,
  onEditMessage,
  onQuoteMessage,
  usersById,
}: {
  canCurrentUserWrite: boolean
  currentUserId: string
  getMembershipState: (
    userId: string | null | undefined
  ) => WorkspaceMembershipState
  messages: ChatThreadMessage[]
  messageReadAtById: Record<string, string>
  onDeleteMessage: (message: ChatThreadMessage) => void
  onEditMessage: (message: ChatThreadMessage) => void
  onQuoteMessage: (
    message: ChatThreadMessage,
    authorName: string | undefined
  ) => void
  usersById: Map<string, ChatThreadUser>
}) {
  const visibleMessages = messages.filter(
    (message) => !message.deletedAt || message.createdBy === currentUserId
  )

  return (
    <div className="flex flex-col py-3">
      {visibleMessages.map((message, idx) => {
        const author = usersById.get(message.createdBy)
        const authorView = buildWorkspaceUserPresenceView(
          author,
          getMembershipState(author?.id)
        )
        const previousMessage = visibleMessages[idx - 1]

        return (
          <ChatMessageRow
            key={message.id}
            author={author}
            authorView={authorView}
            canCurrentUserWrite={canCurrentUserWrite}
            currentUserId={currentUserId}
            index={idx}
            message={message}
            onDeleteMessage={onDeleteMessage}
            onEditMessage={onEditMessage}
            onQuoteMessage={onQuoteMessage}
            previousMessage={previousMessage}
            readAt={messageReadAtById[message.id] ?? null}
            usersById={usersById}
          />
        )
      })}
    </div>
  )
}

function ChatMessagesPane({
  canCurrentUserWrite,
  currentUserId,
  emptyStateDescription,
  getMembershipState,
  loaded,
  messages,
  messageReadAtById,
  messagesEndRef,
  onDeleteMessage,
  onEditMessage,
  onQuoteMessage,
  scrollRef,
  showWelcomeIntro,
  title,
  usersById,
  welcomeParticipant,
  welcomeParticipantView,
}: {
  canCurrentUserWrite: boolean
  currentUserId: string
  emptyStateDescription: string
  getMembershipState: (
    userId: string | null | undefined
  ) => WorkspaceMembershipState
  loaded: boolean
  messages: ChatThreadMessage[]
  messageReadAtById: Record<string, string>
  messagesEndRef: RefObject<HTMLDivElement | null>
  onDeleteMessage: (message: ChatThreadMessage) => void
  onEditMessage: (message: ChatThreadMessage) => void
  onQuoteMessage: (
    message: ChatThreadMessage,
    authorName: string | undefined
  ) => void
  scrollRef: RefObject<HTMLDivElement | null>
  showWelcomeIntro: boolean
  title: string
  usersById: Map<string, ChatThreadUser>
  welcomeParticipant?: ChatThreadUser | null
  welcomeParticipantView: WorkspaceUserPresenceView
}) {
  return (
    <div
      ref={scrollRef}
      className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
    >
      {!loaded && messages.length === 0 ? (
        <div className="mt-auto px-4 py-3">
          <div className="flex justify-center py-6 text-sm text-muted-foreground">
            Loading messages...
          </div>
        </div>
      ) : messages.length === 0 ? (
        <div className="mt-auto px-4 py-3">
          <EmptyState
            title="No messages yet"
            description={emptyStateDescription}
            icon={<PaperPlaneTilt className="size-5 text-muted-foreground" />}
            className="flex-none px-0 py-6"
          />
        </div>
      ) : (
        <>
          {showWelcomeIntro && welcomeParticipant ? (
            <ChatWelcomeIntro
              title={title}
              welcomeParticipant={welcomeParticipant}
              welcomeParticipantView={welcomeParticipantView}
            />
          ) : null}
          <div className="mt-auto" />
          <ChatMessageList
            canCurrentUserWrite={canCurrentUserWrite}
            currentUserId={currentUserId}
            getMembershipState={getMembershipState}
            messages={messages}
            messageReadAtById={messageReadAtById}
            onDeleteMessage={onDeleteMessage}
            onEditMessage={onEditMessage}
            onQuoteMessage={onQuoteMessage}
            usersById={usersById}
          />
          <div ref={messagesEndRef} aria-hidden className="h-px shrink-0" />
        </>
      )}
    </div>
  )
}

function ChatTypingIndicator({
  label,
  typingUsers,
}: {
  label: string
  typingUsers: Array<{
    id: string
    name: string
    avatarImageUrl?: string | null
    avatarUrl?: string | null
  }>
}) {
  if (typingUsers.length === 0) {
    return null
  }

  return (
    <div className="shrink-0 border-t border-line-soft bg-background px-4 py-2">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <div className="flex -space-x-1">
          {typingUsers.slice(0, 3).map((user) => (
            <UserAvatar
              key={user.id}
              name={user.name}
              avatarImageUrl={user.avatarImageUrl}
              avatarUrl={user.avatarUrl}
              size="xs"
              showStatus={false}
              className="ring-2 ring-background"
            />
          ))}
        </div>
        <span>{label}</span>
      </div>
    </div>
  )
}

function ChatComposerPanel({
  composerDisabledReason,
  composerEditable,
  conversationId,
  currentUserId,
  draftContent,
  draftKey,
  editingMessageId,
  hideComposer,
  messageableMembers,
  messagesLength,
  onCancelEdit,
  onSaveEdit,
  onTypingChange,
  title,
  typingUsersCount,
}: {
  composerDisabledReason: string | null
  composerEditable: boolean
  conversationId: string
  currentUserId: string
  draftContent?: string
  draftKey?: number
  editingMessageId: string | null
  hideComposer: boolean
  messageableMembers: ChatThreadMember[]
  messagesLength: number
  onCancelEdit: () => void
  onSaveEdit: (messageId: string, content: string) => void
  onTypingChange: (typing: boolean) => void
  title: string
  typingUsersCount: number
}) {
  if (hideComposer && !editingMessageId) {
    if (messagesLength === 0 || !composerDisabledReason) {
      return null
    }

    return (
      <div
        className={cn(
          "shrink-0 bg-background/95 px-4 py-3 text-xs text-muted-foreground backdrop-blur",
          typingUsersCount > 0 ? "" : "border-t"
        )}
      >
        {composerDisabledReason}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "shrink-0 bg-background",
        typingUsersCount > 0 ? "" : "border-t border-line-soft"
      )}
    >
      <ChatComposer
        key={draftKey}
        placeholder={editingMessageId ? "Edit message…" : `Message ${title}…`}
        mentionCandidates={messageableMembers}
        currentUserId={currentUserId}
        editable={composerEditable}
        disabledReason={composerDisabledReason}
        draftContent={draftContent}
        editing={Boolean(editingMessageId)}
        onCancelEdit={onCancelEdit}
        onTypingChange={onTypingChange}
        onSend={(content) => {
          if (editingMessageId) {
            onSaveEdit(editingMessageId, content)
            return
          }

          useAppStore.getState().sendChatMessage({ conversationId, content })
        }}
      />
    </div>
  )
}

function resolveWorkspaceMembershipState({
  currentWorkspaceId,
  membershipStateByUserId,
  userId,
}: {
  currentWorkspaceId: string | null
  membershipStateByUserId: Map<string, WorkspaceMembershipState>
  userId: string | null | undefined
}) {
  if (!userId || !currentWorkspaceId) {
    return "unknown"
  }

  return membershipStateByUserId.get(userId) ?? "unknown"
}

function resolveComposerDisabledReason({
  canCurrentUserSend,
  conversationScopeType,
  hasMessageableMembers,
}: {
  canCurrentUserSend: boolean
  conversationScopeType: "workspace" | "team" | null
  hasMessageableMembers: boolean
}) {
  if (!canCurrentUserSend) {
    return "Messaging is read-only for your current role."
  }

  if (hasMessageableMembers) {
    return null
  }

  if (conversationScopeType === "team") {
    return "This chat is read-only because the other participants have left the team or deleted their account."
  }

  return "This chat is read-only because the other participants have left the workspace or deleted their account."
}

function resolveChatEmptyStateDescription({
  composerDisabledReason,
  hideComposer,
  messagesLength,
}: {
  composerDisabledReason: string | null
  hideComposer: boolean
  messagesLength: number
}) {
  if (messagesLength === 0 && hideComposer && composerDisabledReason) {
    return composerDisabledReason
  }

  return "Start the conversation below."
}

function useChatThreadScope(conversationId: string) {
  return useAppStore(
    useShallow((state) => {
      const conversation = state.conversations.find(
        (entry) => entry.id === conversationId
      )

      if (!conversation || conversation.kind !== "chat") {
        return {
          canCurrentUserSend: false,
          conversationScopeType: null,
          conversationScopeId: null,
        }
      }

      if (conversation.scopeType === "workspace") {
        return {
          canCurrentUserSend:
            conversation.participantIds.includes(state.currentUserId) &&
            canEditWorkspace(state, conversation.scopeId),
          conversationScopeType: conversation.scopeType,
          conversationScopeId: conversation.scopeId,
        }
      }

      const role = getTeamRole(state, conversation.scopeId)

      return {
        canCurrentUserSend: role === "admin" || role === "member",
        conversationScopeType: conversation.scopeType,
        conversationScopeId: conversation.scopeId,
      }
    })
  )
}

function useChatThreadWorkspaceContext() {
  return useAppStore(
    useShallow((state) => ({
      currentUserId: state.currentUserId,
      currentWorkspaceId: state.currentWorkspaceId,
      users: state.users,
      workspaces: state.workspaces,
      workspaceMemberships: state.workspaceMemberships,
      teams: state.teams,
      teamMemberships: state.teamMemberships,
    }))
  )
}

function useMessageableMembers({
  conversationScopeId,
  conversationScopeType,
  currentUserId,
  members,
  teamMemberships,
  teams,
  workspaces,
  workspaceMemberships,
}: {
  conversationScopeId: string | null
  conversationScopeType: "workspace" | "team" | null
  currentUserId: string
  members: ChatThreadMember[]
  teamMemberships: AppState["teamMemberships"]
  teams: AppState["teams"]
  workspaces: AppState["workspaces"]
  workspaceMemberships: AppState["workspaceMemberships"]
}) {
  return useMemo(
    () =>
      members.filter((member) => {
        if (member.id === currentUserId) {
          return true
        }

        if (!conversationScopeId || member.accountDeletedAt) {
          return false
        }

        if (conversationScopeType === "team") {
          return teamMemberships.some(
            (membership) =>
              membership.teamId === conversationScopeId &&
              membership.userId === member.id
          )
        }

        return hasWorkspaceAccessInCollections(
          workspaces,
          workspaceMemberships,
          teams,
          teamMemberships,
          conversationScopeId,
          member.id
        )
      }),
    [
      conversationScopeId,
      conversationScopeType,
      currentUserId,
      members,
      teamMemberships,
      teams,
      workspaces,
      workspaceMemberships,
    ]
  )
}

function useMessageAuthorIdsKey(messages: ChatThreadMessage[]) {
  return useMemo(() => {
    return [...new Set(messages.map((message) => message.createdBy))]
      .sort()
      .join("\u001f")
  }, [messages])
}

function useWorkspaceMembershipStateByUserId({
  currentWorkspaceId,
  members,
  messageAuthorIdsKey,
  teamMemberships,
  teams,
  welcomeParticipant,
  workspaces,
  workspaceMemberships,
}: {
  currentWorkspaceId: string | null
  members: ChatThreadMember[]
  messageAuthorIdsKey: string
  teamMemberships: AppState["teamMemberships"]
  teams: AppState["teams"]
  welcomeParticipant?: ChatThreadUser | null
  workspaces: AppState["workspaces"]
  workspaceMemberships: AppState["workspaceMemberships"]
}) {
  return useMemo(() => {
    const membershipStates = new Map<string, WorkspaceMembershipState>()

    if (!currentWorkspaceId) {
      return membershipStates
    }

    const relevantUserIds = new Set<string>()

    if (welcomeParticipant?.id) {
      relevantUserIds.add(welcomeParticipant.id)
    }

    for (const member of members) {
      relevantUserIds.add(member.id)
    }

    if (messageAuthorIdsKey.length > 0) {
      for (const userId of messageAuthorIdsKey.split("\u001f")) {
        relevantUserIds.add(userId)
      }
    }

    for (const userId of relevantUserIds) {
      membershipStates.set(
        userId,
        hasWorkspaceAccessInCollections(
          workspaces,
          workspaceMemberships,
          teams,
          teamMemberships,
          currentWorkspaceId,
          userId
        )
          ? "active"
          : "former"
      )
    }

    return membershipStates
  }, [
    currentWorkspaceId,
    members,
    messageAuthorIdsKey,
    teamMemberships,
    teams,
    welcomeParticipant,
    workspaces,
    workspaceMemberships,
  ])
}

function useChatTypingUsers({
  chatPresenceParticipants,
  currentUserId,
  members,
  usersById,
}: {
  chatPresenceParticipants: ReturnType<typeof useChatPresence>["participants"]
  currentUserId: string
  members: ChatThreadMember[]
  usersById: Map<string, ChatThreadUser>
}) {
  return useMemo(
    () =>
      collectChatTypingUsers({
        chatPresenceParticipants,
        currentUserId,
        members,
        usersById,
      }),
    [chatPresenceParticipants, currentUserId, members, usersById]
  )
}

type ChatTypingUser = {
  id: string
  name: string
  avatarImageUrl?: string | null
  avatarUrl?: string | null
}

function collectChatTypingUsers(input: {
  chatPresenceParticipants: ReturnType<typeof useChatPresence>["participants"]
  currentUserId: string
  members: ChatThreadMember[]
  usersById: Map<string, ChatThreadUser>
}) {
  const uniqueTypingUsers = new Map<string, ChatTypingUser>()

  for (const participant of input.chatPresenceParticipants) {
    if (
      shouldSkipTypingParticipant({
        currentUserId: input.currentUserId,
        participant,
        uniqueTypingUsers,
      })
    ) {
      continue
    }

    uniqueTypingUsers.set(
      participant.userId,
      toChatTypingUser({
        members: input.members,
        participantUserId: participant.userId,
        usersById: input.usersById,
      })
    )
  }

  return [...uniqueTypingUsers.values()]
}

function shouldSkipTypingParticipant(input: {
  currentUserId: string
  participant: ReturnType<typeof useChatPresence>["participants"][number]
  uniqueTypingUsers: Map<string, ChatTypingUser>
}) {
  return (
    !input.participant.typing ||
    input.participant.userId === input.currentUserId ||
    input.uniqueTypingUsers.has(input.participant.userId)
  )
}

function toChatTypingUser(input: {
  members: ChatThreadMember[]
  participantUserId: string
  usersById: Map<string, ChatThreadUser>
}): ChatTypingUser {
  const user =
    input.usersById.get(input.participantUserId) ??
    input.members.find((member) => member.id === input.participantUserId)

  if (!user) {
    return {
      id: input.participantUserId,
      name: "Someone",
      avatarImageUrl: null,
      avatarUrl: null,
    }
  }

  return {
    id: input.participantUserId,
    name: user.name,
    avatarImageUrl: user.avatarImageUrl ?? null,
    avatarUrl: user.avatarUrl ?? null,
  }
}

function useChatMessagesAutoScroll(latestMessageId: string | null) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    const messagesEnd = messagesEndRef.current

    if (!el || !messagesEnd) {
      return
    }

    const scrollToBottom = () => {
      if (typeof messagesEnd.scrollIntoView === "function") {
        messagesEnd.scrollIntoView({ block: "end" })
      }
      el.scrollTop = el.scrollHeight
    }

    scrollToBottom()

    const frameId = window.requestAnimationFrame(() => {
      scrollToBottom()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [latestMessageId])

  return {
    messagesEndRef,
    scrollRef,
  }
}

export function ChatThread({
  conversationId,
  title,
  description,
  members,
  loaded = true,
  showHeader = true,
  videoAction,
  detailsAction,
  welcomeParticipant,
}: {
  conversationId: string
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
  loaded?: boolean
  showHeader?: boolean
  videoAction?: ReactNode
  detailsAction?: ReactNode
  welcomeParticipant?: NonNullable<ReturnType<typeof getUser>> | null
}) {
  const messages = useAppStore(
    useShallow((state) => getChatMessages(state, conversationId))
  )
  const messageReadAtById = useAppStore(
    (state) =>
      getChatReadState(state, state.currentUserId, conversationId)
        ?.messageReadAtById ?? EMPTY_MESSAGE_READ_AT_BY_ID
  )
  const { canCurrentUserSend, conversationScopeType, conversationScopeId } =
    useChatThreadScope(conversationId)
  const {
    currentUserId,
    currentWorkspaceId,
    users,
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
  } = useChatThreadWorkspaceContext()
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  )
  const [composerDraft, setComposerDraft] = useState<{
    content: string
    key: number
  }>({
    content: "<p></p>",
    key: 0,
  })
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [deleteMessage, setDeleteMessage] = useState<ChatThreadMessage | null>(
    null
  )
  const { participants: chatPresenceParticipants, setTyping } = useChatPresence(
    {
      conversationId,
      currentUserId,
      enabled: true,
    }
  )
  const showWelcomeIntro =
    welcomeParticipant && messages.length > 0 && messages.length < 5
  const messageableMembers = useMessageableMembers({
    conversationScopeId,
    conversationScopeType,
    currentUserId,
    members,
    teamMemberships,
    teams,
    workspaces,
    workspaceMemberships,
  })
  const activeOtherMemberCount = useMemo(
    () =>
      messageableMembers.filter((member) => member.id !== currentUserId).length,
    [currentUserId, messageableMembers]
  )
  const hasMessageableMembers = activeOtherMemberCount > 0
  const hideComposer = !hasMessageableMembers
  const composerEditable = canCurrentUserSend && hasMessageableMembers
  const composerDisabledReason = resolveComposerDisabledReason({
    canCurrentUserSend,
    conversationScopeType,
    hasMessageableMembers,
  })
  const emptyStateDescription = resolveChatEmptyStateDescription({
    composerDisabledReason,
    hideComposer,
    messagesLength: messages.length,
  })
  const messageAuthorIdsKey = useMessageAuthorIdsKey(messages)
  const workspaceMembershipStateByUserId = useWorkspaceMembershipStateByUserId({
    currentWorkspaceId,
    members,
    messageAuthorIdsKey,
    teamMemberships,
    teams,
    welcomeParticipant,
    workspaces,
    workspaceMemberships,
  })
  const typingUsers = useChatTypingUsers({
    chatPresenceParticipants,
    currentUserId,
    members,
    usersById,
  })
  const typingIndicatorLabel = useMemo(
    () => formatTypingIndicatorLabel(typingUsers.map((user) => user.name)),
    [typingUsers]
  )
  const latestMessageId = messages[messages.length - 1]?.id ?? null
  const readableMessageIds = useMemo(
    () =>
      messages
        .filter(
          (message) => !message.deletedAt || message.createdBy === currentUserId
        )
        .filter((message) => !messageReadAtById[message.id])
        .map((message) => message.id),
    [currentUserId, messageReadAtById, messages]
  )
  const { messagesEndRef, scrollRef } =
    useChatMessagesAutoScroll(latestMessageId)

  useEffect(() => {
    if (!loaded) {
      return
    }

    useAppStore.getState().markChatRead(conversationId, readableMessageIds)
  }, [conversationId, loaded, readableMessageIds])

  const seedComposer = (content: string) => {
    setComposerDraft((current) => ({
      content,
      key: current.key + 1,
    }))
  }
  const handleQuoteMessage = (
    message: ChatThreadMessage,
    authorName: string | undefined
  ) => {
    setEditingMessageId(null)
    seedComposer(createQuotedRichText(message.content, authorName))
  }
  const handleEditMessage = (message: ChatThreadMessage) => {
    if (
      !canCurrentUserSend ||
      message.createdBy !== currentUserId ||
      message.deletedAt
    ) {
      return
    }

    setEditingMessageId(message.id)
    seedComposer(message.content)
  }
  const handleCancelEdit = () => {
    setEditingMessageId(null)
    seedComposer("<p></p>")
  }
  const handleSaveEdit = (messageId: string, content: string) => {
    if (!canCurrentUserSend) {
      handleCancelEdit()
      return
    }

    useAppStore.getState().updateChatMessage(messageId, {
      content,
    })
    setEditingMessageId(null)
    seedComposer("<p></p>")
  }
  const handleConfirmDeleteMessage = () => {
    if (!deleteMessage) {
      return
    }

    useAppStore.getState().deleteChatMessage(deleteMessage.id)
    if (editingMessageId === deleteMessage.id) {
      handleCancelEdit()
    }
    setDeleteMessage(null)
  }
  const getWorkspaceMembershipState = (userId: string | null | undefined) =>
    resolveWorkspaceMembershipState({
      currentWorkspaceId,
      membershipStateByUserId: workspaceMembershipStateByUserId,
      userId,
    })
  const welcomeParticipantView =
    showWelcomeIntro && welcomeParticipant
      ? buildWorkspaceUserPresenceView(
          welcomeParticipant,
          getWorkspaceMembershipState(welcomeParticipant.id)
        )
      : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {showHeader ? (
        <ChatThreadHeader
          description={description}
          detailsAction={detailsAction}
          membersCount={members.length}
          title={title}
          videoAction={videoAction}
        />
      ) : null}

      <ChatMessagesPane
        canCurrentUserWrite={canCurrentUserSend}
        currentUserId={currentUserId}
        emptyStateDescription={emptyStateDescription}
        getMembershipState={getWorkspaceMembershipState}
        loaded={loaded}
        messages={messages}
        messageReadAtById={messageReadAtById}
        messagesEndRef={messagesEndRef}
        onDeleteMessage={setDeleteMessage}
        onEditMessage={handleEditMessage}
        onQuoteMessage={handleQuoteMessage}
        scrollRef={scrollRef}
        showWelcomeIntro={Boolean(showWelcomeIntro)}
        title={title}
        usersById={usersById}
        welcomeParticipant={welcomeParticipant}
        welcomeParticipantView={welcomeParticipantView}
      />

      <ChatTypingIndicator
        label={typingIndicatorLabel}
        typingUsers={typingUsers}
      />

      <ChatComposerPanel
        composerDisabledReason={composerDisabledReason}
        composerEditable={composerEditable}
        conversationId={conversationId}
        currentUserId={currentUserId}
        draftContent={composerDraft.content}
        draftKey={composerDraft.key}
        editingMessageId={editingMessageId}
        hideComposer={hideComposer}
        messageableMembers={messageableMembers}
        messagesLength={messages.length}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
        onTypingChange={setTyping}
        title={title}
        typingUsersCount={typingUsers.length}
      />
      <ConfirmDialog
        open={Boolean(deleteMessage)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteMessage(null)
          }
        }}
        title="Delete message"
        description="This message will be removed for everyone else and shown as deleted for you."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDeleteMessage}
      />
    </div>
  )
}

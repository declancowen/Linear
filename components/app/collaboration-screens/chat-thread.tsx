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
import { chatMessageContentConstraints } from "@/lib/domain/input-constraints"
import { buildWorkspaceUserPresenceView } from "@/lib/domain/workspace-user-presence"
import { useAppStore } from "@/lib/store/app-store"
import { useChatPresence } from "@/hooks/use-chat-presence"
import { cn, getPlainTextContent } from "@/lib/utils"
import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
import { RichTextContent } from "@/components/app/rich-text-content"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { UserAvatar, UserHoverCard } from "@/components/app/user-presence"
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
  onTypingChange,
}: {
  placeholder?: string
  onSend: (content: string) => void
  mentionCandidates: ReturnType<typeof getConversationParticipants>
  currentUserId: string
  editable?: boolean
  disabledReason?: string | null
  onTypingChange?: (typing: boolean) => void
}) {
  const EMPTY_COMPOSER_CONTENT = "<p></p>"
  const [content, setContent] = useState(EMPTY_COMPOSER_CONTENT)
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
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={!editable || !contentText}
            className="h-7 gap-1.5 rounded-md px-2.5 text-[12px]"
          >
            <ArrowUp className="size-3" weight="bold" />
            Send
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
  currentUserId,
  currentWorkspaceId,
  title,
  welcomeParticipant,
  welcomeParticipantView,
}: {
  currentUserId: string
  currentWorkspaceId: string | null
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
        <UserHoverCard
          user={welcomeParticipant}
          userId={welcomeParticipant.id}
          currentUserId={currentUserId}
          workspaceId={currentWorkspaceId}
        >
          <p className="mt-3 text-sm font-medium">{display.name}</p>
        </UserHoverCard>
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
  currentUserId,
  currentWorkspaceId,
  isCurrentUser,
  message,
}: {
  author?: ChatThreadUser
  authorView: WorkspaceUserPresenceView
  currentUserId: string
  currentWorkspaceId: string | null
  isCurrentUser: boolean
  message: ChatThreadMessage
}) {
  return (
    <div className="-mt-px flex items-baseline gap-2">
      <UserHoverCard
        user={author}
        userId={author?.id}
        currentUserId={currentUserId}
        workspaceId={currentWorkspaceId}
      >
        <span className="text-[13.5px] font-semibold text-foreground">
          {authorView?.name ??
            author?.name ??
            (isCurrentUser ? "You" : "Unknown")}
        </span>
      </UserHoverCard>
      <span className="text-[11.5px] text-fg-3">
        {formatTimestamp(message.createdAt)}
      </span>
    </div>
  )
}

function ChatMessageBody({
  callJoinHref,
  content,
}: {
  callJoinHref: string | null
  content: string
}) {
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
  currentUserId,
  messageId,
  reaction,
}: {
  currentUserId: string
  messageId: string
  reaction: ChatMessageReaction
}) {
  const active = reaction.userIds.includes(currentUserId)

  return (
    <button
      type="button"
      onClick={() =>
        useAppStore
          .getState()
          .toggleChatMessageReaction(messageId, reaction.emoji)
      }
      className={cn(
        "flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11.5px] tabular-nums transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-line bg-surface text-fg-2 hover:bg-surface-2 hover:text-foreground"
      )}
    >
      <span>{reaction.emoji}</span>
      <span>{reaction.userIds.length}</span>
    </button>
  )
}

function ChatMessageReactions({
  currentUserId,
  message,
}: {
  currentUserId: string
  message: ChatThreadMessage
}) {
  const reactions = message.reactions ?? []

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {reactions.map((reaction) => (
        <ChatMessageReactionButton
          key={`${message.id}-${reaction.emoji}`}
          currentUserId={currentUserId}
          messageId={message.id}
          reaction={reaction}
        />
      ))}
      <EmojiPickerPopover
        align="start"
        side="top"
        onEmojiSelect={(emoji) => {
          useAppStore.getState().toggleChatMessageReaction(message.id, emoji)
        }}
        trigger={
          <button
            type="button"
            aria-label="React"
            className="flex h-6 items-center gap-1.5 rounded-full border border-dashed border-line bg-surface px-2 text-[11.5px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Smiley className="size-3.5" />
            <span>React</span>
          </button>
        }
      />
    </div>
  )
}

function ChatMessageRow({
  author,
  authorView,
  currentUserId,
  currentWorkspaceId,
  index,
  message,
  previousMessage,
}: {
  author?: ChatThreadUser
  authorView: WorkspaceUserPresenceView
  currentUserId: string
  currentWorkspaceId: string | null
  index: number
  message: ChatThreadMessage
  previousMessage?: ChatThreadMessage
}) {
  const isCurrentUser = message.createdBy === currentUserId
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
          "group/msg grid items-start gap-x-2.5 px-4 transition-colors hover:bg-surface-2",
          groupedWithPrev ? "py-0" : "py-0.5",
          showTopMargin && "mt-2"
        )}
        style={{ gridTemplateColumns: "24px 1fr" }}
      >
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
              currentUserId={currentUserId}
              currentWorkspaceId={currentWorkspaceId}
              isCurrentUser={isCurrentUser}
              message={message}
            />
          ) : null}
          <ChatMessageBody
            callJoinHref={callJoinHref}
            content={message.content}
          />
          <ChatMessageReactions
            currentUserId={currentUserId}
            message={message}
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
  currentUserId,
  currentWorkspaceId,
  getMembershipState,
  messages,
  usersById,
}: {
  currentUserId: string
  currentWorkspaceId: string | null
  getMembershipState: (
    userId: string | null | undefined
  ) => WorkspaceMembershipState
  messages: ChatThreadMessage[]
  usersById: Map<string, ChatThreadUser>
}) {
  return (
    <div className="flex flex-col py-3">
      {messages.map((message, idx) => {
        const author = usersById.get(message.createdBy)
        const authorView = buildWorkspaceUserPresenceView(
          author,
          getMembershipState(author?.id)
        )
        const previousMessage = messages[idx - 1]

        return (
          <ChatMessageRow
            key={message.id}
            author={author}
            authorView={authorView}
            currentUserId={currentUserId}
            currentWorkspaceId={currentWorkspaceId}
            index={idx}
            message={message}
            previousMessage={previousMessage}
          />
        )
      })}
    </div>
  )
}

function ChatMessagesPane({
  currentUserId,
  currentWorkspaceId,
  emptyStateDescription,
  getMembershipState,
  loaded,
  messages,
  messagesEndRef,
  scrollRef,
  showWelcomeIntro,
  title,
  usersById,
  welcomeParticipant,
  welcomeParticipantView,
}: {
  currentUserId: string
  currentWorkspaceId: string | null
  emptyStateDescription: string
  getMembershipState: (
    userId: string | null | undefined
  ) => WorkspaceMembershipState
  loaded: boolean
  messages: ChatThreadMessage[]
  messagesEndRef: RefObject<HTMLDivElement | null>
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
      className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
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
              currentUserId={currentUserId}
              currentWorkspaceId={currentWorkspaceId}
              title={title}
              welcomeParticipant={welcomeParticipant}
              welcomeParticipantView={welcomeParticipantView}
            />
          ) : null}
          <div className="mt-auto" />
          <ChatMessageList
            currentUserId={currentUserId}
            currentWorkspaceId={currentWorkspaceId}
            getMembershipState={getMembershipState}
            messages={messages}
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
  hideComposer,
  messageableMembers,
  messagesLength,
  onTypingChange,
  title,
  typingUsersCount,
}: {
  composerDisabledReason: string | null
  composerEditable: boolean
  conversationId: string
  currentUserId: string
  hideComposer: boolean
  messageableMembers: ChatThreadMember[]
  messagesLength: number
  onTypingChange: (typing: boolean) => void
  title: string
  typingUsersCount: number
}) {
  if (hideComposer) {
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
        placeholder={`Message ${title}…`}
        mentionCandidates={messageableMembers}
        currentUserId={currentUserId}
        editable={composerEditable}
        disabledReason={composerDisabledReason}
        onTypingChange={onTypingChange}
        onSend={(content) => {
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
  const { messagesEndRef, scrollRef } =
    useChatMessagesAutoScroll(latestMessageId)
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
        currentUserId={currentUserId}
        currentWorkspaceId={currentWorkspaceId}
        emptyStateDescription={emptyStateDescription}
        getMembershipState={getWorkspaceMembershipState}
        loaded={loaded}
        messages={messages}
        messagesEndRef={messagesEndRef}
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
        hideComposer={hideComposer}
        messageableMembers={messageableMembers}
        messagesLength={messages.length}
        onTypingChange={setTyping}
        title={title}
        typingUsersCount={typingUsers.length}
      />
    </div>
  )
}

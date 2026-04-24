"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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
import {
  buildCallJoinHref,
  formatDayDivider,
  formatTimestamp,
  getChatMessageMarkup,
  getLocalDayKey,
  parseCallInviteMessage,
} from "@/components/app/collaboration-screens/utils"
import { Button } from "@/components/ui/button"

function ChatComposer({
  placeholder = "Write a message…",
  onSend,
  mentionCandidates,
  currentUserId,
  action,
  editable = true,
  disabledReason,
  onTypingChange,
}: {
  placeholder?: string
  onSend: (content: string) => void
  mentionCandidates: ReturnType<typeof getConversationParticipants>
  currentUserId: string
  action?: ReactNode
  editable?: boolean
  disabledReason?: string | null
  onTypingChange?: (typing: boolean) => void
}) {
  const EMPTY_COMPOSER_CONTENT = "<p></p>"
  const [content, setContent] = useState(EMPTY_COMPOSER_CONTENT)
  const [composerKey, setComposerKey] = useState(0)
  const editorInstanceRef = useRef<Editor | null>(null)
  const typingTimeoutRef = useRef<number | null>(null)
  const contentText = getPlainTextContent(content)
  const filteredMentionCandidates = useMemo(
    () =>
      mentionCandidates.filter((candidate) => candidate.id !== currentUserId),
    [currentUserId, mentionCandidates]
  )

  const handleSend = () => {
    if (!editable || !contentText) return
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    onTypingChange?.(false)
    onSend(content)
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
    const isTyping = nextText.length > 0

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
          {action ? <span className="shrink-0">{action}</span> : null}
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
    useAppStore(
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
  const {
    currentUserId,
    currentWorkspaceId,
    users,
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
  } = useAppStore(
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
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  )
  const { participants: chatPresenceParticipants, setTyping } = useChatPresence({
    conversationId,
    currentUserId,
    enabled: true,
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasHeaderActions = detailsAction != null
  const showWelcomeIntro =
    welcomeParticipant && messages.length > 0 && messages.length < 5
  const messageableMembers = useMemo(
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
  const activeOtherMemberCount = useMemo(
    () =>
      messageableMembers.filter((member) => member.id !== currentUserId).length,
    [currentUserId, messageableMembers]
  )
  const hasMessageableMembers = activeOtherMemberCount > 0
  const hideComposer = !hasMessageableMembers
  const composerEditable = canCurrentUserSend && hasMessageableMembers
  const composerDisabledReason = !canCurrentUserSend
    ? "Messaging is read-only for your current role."
    : !hasMessageableMembers
      ? conversationScopeType === "team"
        ? "This chat is read-only because the other participants have left the team or deleted their account."
        : "This chat is read-only because the other participants have left the workspace or deleted their account."
      : null
  const emptyStateDescription =
    messages.length === 0 && hideComposer && composerDisabledReason
      ? composerDisabledReason
      : "Start the conversation below."
  const messageAuthorIdsKey = useMemo(() => {
    return [...new Set(messages.map((message) => message.createdBy))]
      .sort()
      .join("\u001f")
  }, [messages])
  const workspaceMembershipStateByUserId = useMemo(() => {
    const membershipStates = new Map<
      string,
      "active" | "former" | "unknown"
    >()

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
  const typingUsers = useMemo(() => {
    const uniqueTypingUsers = new Map<
      string,
      {
        id: string
        name: string
        avatarImageUrl?: string | null
        avatarUrl?: string | null
      }
    >()

    for (const participant of chatPresenceParticipants) {
      if (
        !participant.typing ||
        participant.userId === currentUserId ||
        uniqueTypingUsers.has(participant.userId)
      ) {
        continue
      }

      const user =
        usersById.get(participant.userId) ??
        members.find((member) => member.id === participant.userId)

      uniqueTypingUsers.set(participant.userId, {
        id: participant.userId,
        name: user?.name ?? "Someone",
        avatarImageUrl: user?.avatarImageUrl ?? null,
        avatarUrl: user?.avatarUrl ?? null,
      })
    }

    return [...uniqueTypingUsers.values()]
  }, [chatPresenceParticipants, currentUserId, members, usersById])
  const typingIndicatorLabel = useMemo(
    () => formatTypingIndicatorLabel(typingUsers.map((user) => user.name)),
    [typingUsers]
  )
  const latestMessageId = messages[messages.length - 1]?.id ?? null

  function getWorkspaceMembershipState(userId: string | null | undefined) {
    if (!userId || !currentWorkspaceId) {
      return "unknown" as const
    }

    return workspaceMembershipStateByUserId.get(userId) ?? ("unknown" as const)
  }

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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {showHeader ? (
        <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{title}</span>
            {description ? (
              <span className="hidden truncate text-xs text-muted-foreground 2xl:inline">
                {description}
              </span>
            ) : null}
            <span className="hidden text-xs text-muted-foreground xl:inline">
              {members.length} members
            </span>
          </div>
          {hasHeaderActions ? (
            <div className="flex items-center gap-1.5">
              <ChatHeaderActions detailsAction={detailsAction} />
            </div>
          ) : null}
        </div>
      ) : null}

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
            {showWelcomeIntro
              ? (() => {
                  const welcomeParticipantView = buildWorkspaceUserPresenceView(
                    welcomeParticipant,
                    getWorkspaceMembershipState(welcomeParticipant.id)
                  )

                  return (
                    <div className="px-4 pt-6">
                      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                        <UserAvatar
                          name={
                            welcomeParticipantView?.name ??
                            welcomeParticipant.name
                          }
                          avatarImageUrl={
                            welcomeParticipantView?.avatarImageUrl
                          }
                          avatarUrl={welcomeParticipantView?.avatarUrl}
                          status={welcomeParticipantView?.status ?? undefined}
                          showStatus={!welcomeParticipantView?.isFormerMember}
                          size="lg"
                          className="size-12"
                        />
                        <UserHoverCard
                          user={welcomeParticipant}
                          userId={welcomeParticipant.id}
                          currentUserId={currentUserId}
                          workspaceId={currentWorkspaceId}
                        >
                          <p className="mt-3 text-sm font-medium">
                            {welcomeParticipantView?.name ??
                              welcomeParticipant.name ??
                              title}
                          </p>
                        </UserHoverCard>
                        <p className="mt-1 text-xs text-muted-foreground">
                          This is the beginning of your conversation with{" "}
                          {welcomeParticipantView?.name ??
                            welcomeParticipant.name ??
                            title}
                          .
                        </p>
                      </div>
                    </div>
                  )
                })()
              : null}
            <div className="mt-auto" />
            <div className="flex flex-col py-3">
              {messages.map((message, idx) => {
                const author = usersById.get(message.createdBy)
                const authorView = buildWorkspaceUserPresenceView(
                  author,
                  getWorkspaceMembershipState(author?.id)
                )
                const prevMessage = messages[idx - 1]
                const isCurrentUser = message.createdBy === currentUserId
                const dayKey = getLocalDayKey(message.createdAt)
                const prevDayKey = prevMessage
                  ? getLocalDayKey(prevMessage.createdAt)
                  : null
                const showDayDivider = dayKey !== prevDayKey
                const legacyCallInvite =
                  message.callId || message.kind === "call"
                    ? null
                    : parseCallInviteMessage(message.content)
                const callJoinHref = message.callId
                  ? buildCallJoinHref(message.callId)
                  : (legacyCallInvite?.href ?? null)
                const isCallMessage =
                  message.kind === "call" ||
                  Boolean(message.callId) ||
                  Boolean(legacyCallInvite)
                const reactions = message.reactions ?? []
                const prevIsCall = Boolean(
                  prevMessage &&
                  (prevMessage.kind === "call" ||
                    prevMessage.callId ||
                    parseCallInviteMessage(prevMessage.content))
                )
                const groupedWithPrev =
                  !showDayDivider &&
                  !isCallMessage &&
                  !prevIsCall &&
                  prevMessage?.createdBy === message.createdBy &&
                  new Date(message.createdAt).getTime() -
                    new Date(prevMessage.createdAt).getTime() <
                    5 * 60_000
                return (
                  <div key={message.id}>
                    {showDayDivider ? (
                      <div
                        className={cn(
                          "flex items-center gap-2.5 px-4 pb-1 text-[11.5px] text-fg-3",
                          idx === 0 ? "pt-1" : "pt-3"
                        )}
                      >
                        <span
                          aria-hidden
                          className="h-px flex-1 bg-line-soft"
                        />
                        <span>{formatDayDivider(message.createdAt)}</span>
                        <span
                          aria-hidden
                          className="h-px flex-1 bg-line-soft"
                        />
                      </div>
                    ) : null}
                    <div
                    className={cn(
                      "group/msg grid items-start gap-x-2.5 px-4 transition-colors hover:bg-surface-2",
                      groupedWithPrev ? "py-0" : "py-0.5",
                      !showDayDivider && idx > 0 && !groupedWithPrev && "mt-2"
                    )}
                    style={{ gridTemplateColumns: "24px 1fr" }}
                  >
                    {groupedWithPrev ? (
                      <div aria-hidden />
                    ) : (
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
                    )}
                    <div className="flex min-w-0 flex-col">
                      {!groupedWithPrev ? (
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
                      ) : null}
                      {callJoinHref ? (
                        <div className="mt-0.5 flex flex-col items-start gap-2 [overflow-wrap:anywhere] text-[13.5px] leading-[1.55] text-foreground">
                          <p>Started a call</p>
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                          >
                            <a
                              href={callJoinHref}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ArrowSquareOut className="size-3.5" />
                              Join call
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <RichTextContent
                          content={getChatMessageMarkup(message.content)}
                          className="max-w-full text-[13.5px] leading-[1.55] text-foreground [overflow-wrap:anywhere] break-words [&_.editor-mention]:rounded [&_.editor-mention]:bg-accent-bg [&_.editor-mention]:px-1 [&_.editor-mention]:font-medium [&_.editor-mention]:text-accent-fg [&_a]:break-all [&_code]:rounded [&_code]:bg-surface-3 [&_code]:px-1.5 [&_code]:py-[1px] [&_code]:text-[12.5px] [&_p]:my-0 [&_p+p]:mt-1 [&_pre]:max-w-full [&_pre]:overflow-x-hidden [&_pre]:whitespace-pre-wrap"
                        />
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {reactions.map((reaction) => {
                          const active = reaction.userIds.includes(
                            currentUserId
                          )

                          return (
                            <button
                              key={`${message.id}-${reaction.emoji}`}
                              type="button"
                              onClick={() =>
                                useAppStore
                                  .getState()
                                  .toggleChatMessageReaction(
                                    message.id,
                                    reaction.emoji
                                  )
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
                        })}
                        <EmojiPickerPopover
                          align="start"
                          side="top"
                          onEmojiSelect={(emoji) => {
                            useAppStore
                              .getState()
                              .toggleChatMessageReaction(message.id, emoji)
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
                    </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div ref={messagesEndRef} aria-hidden className="h-px shrink-0" />
          </>
        )}
      </div>

      {typingUsers.length > 0 ? (
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
            <span>{typingIndicatorLabel}</span>
          </div>
        </div>
      ) : null}

      {hideComposer ? (
        messages.length > 0 && composerDisabledReason ? (
          <div
            className={cn(
              "shrink-0 bg-background/95 px-4 py-3 text-xs text-muted-foreground backdrop-blur",
              typingUsers.length > 0 ? "" : "border-t"
            )}
          >
            {composerDisabledReason}
          </div>
        ) : null
      ) : (
        <div
          className={cn(
            "shrink-0 bg-background",
            typingUsers.length > 0 ? "" : "border-t border-line-soft"
          )}
        >
          <ChatComposer
            placeholder={`Message ${title}…`}
            mentionCandidates={messageableMembers}
            currentUserId={currentUserId}
            action={videoAction}
            editable={composerEditable}
            disabledReason={composerDisabledReason}
            onTypingChange={setTyping}
            onSend={(content) => {
              useAppStore
                .getState()
                .sendChatMessage({ conversationId, content })
            }}
          />
        </div>
      )}
    </div>
  )
}

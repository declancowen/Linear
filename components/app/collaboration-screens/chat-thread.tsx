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
import { useAppStore } from "@/lib/store/app-store"
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
  formatTimestamp,
  getChatMessageMarkup,
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
}: {
  placeholder?: string
  onSend: (content: string) => void
  mentionCandidates: ReturnType<typeof getConversationParticipants>
  currentUserId: string
  action?: ReactNode
  editable?: boolean
  disabledReason?: string | null
}) {
  const [content, setContent] = useState("")
  const [composerKey, setComposerKey] = useState(0)
  const editorInstanceRef = useRef<Editor | null>(null)
  const contentText = getPlainTextContent(content)
  const filteredMentionCandidates = useMemo(
    () =>
      mentionCandidates.filter((candidate) => candidate.id !== currentUserId),
    [currentUserId, mentionCandidates]
  )

  const handleSend = () => {
    if (!editable || !contentText) return
    onSend(content)
    setContent("")
    setComposerKey((current) => current + 1)
  }

  const handleInsertEmoji = (emoji: string) => {
    editorInstanceRef.current?.chain().focus().insertContent(emoji).run()
  }

  return (
    <div className="px-4 py-3">
      <div className="flex min-h-[2.75rem] items-end gap-2 rounded-lg border bg-background px-3 py-2.5 shadow-sm focus-within:ring-1 focus-within:ring-ring/40">
        <RichTextEditor
          key={composerKey}
          content={content}
          onChange={setContent}
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
          className="min-w-0 flex-1 [&_.ProseMirror]:max-h-40 [&_.ProseMirror]:min-h-[1.5rem] [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror]:bg-transparent [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-5 [&_.ProseMirror]:outline-none"
        />
        <div className="flex shrink-0 items-center gap-1.5">
          {action ?? null}
          <EmojiPickerPopover
            align="end"
            side="top"
            onEmojiSelect={handleInsertEmoji}
            trigger={
              <button
                type="button"
                disabled={!editable}
                className="rounded-md p-1 text-foreground transition-colors hover:bg-accent"
              >
                <Smiley className="size-4" />
              </button>
            }
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!editable || !contentText}
            className={cn(
              "flex size-7 items-center justify-center rounded-full transition-colors",
              editable && contentText
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground/50"
            )}
          >
            <ArrowUp className="size-3.5" weight="bold" />
          </button>
        </div>
      </div>
      {!editable && disabledReason ? (
        <div className="mt-2 text-xs text-muted-foreground">{disabledReason}</div>
      ) : null}
    </div>
  )
}

export function ChatThread({
  conversationId,
  title,
  description,
  members,
  showHeader = true,
  videoAction,
  detailsAction,
  welcomeParticipant,
}: {
  conversationId: string
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
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
    teams,
    teamMemberships,
  } = useAppStore(
    useShallow((state) => ({
      currentUserId: state.currentUserId,
      currentWorkspaceId: state.currentWorkspaceId,
      users: state.users,
      workspaces: state.workspaces,
      teams: state.teams,
      teamMemberships: state.teamMemberships,
    }))
  )
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  )
  const scrollRef = useRef<HTMLDivElement>(null)
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
    ]
  )
  const activeOtherMemberCount = useMemo(
    () =>
      messageableMembers.filter((member) => member.id !== currentUserId).length,
    [currentUserId, messageableMembers]
  )
  const hasMessageableMembers = activeOtherMemberCount > 0
  const composerEditable = canCurrentUserSend && hasMessageableMembers
  const composerDisabledReason =
    !canCurrentUserSend
      ? "Messaging is read-only for your current role."
      : !hasMessageableMembers
        ? conversationScopeType === "team"
          ? "This chat is read-only because the other participants have left the team or deleted their account."
          : "This chat is read-only because the other participants have left the workspace or deleted their account."
        : null

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {showHeader ? (
        <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-4">
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
        {messages.length === 0 ? (
          <div className="mt-auto px-4 py-3">
            <EmptyState
              title="No messages yet"
              description="Start the conversation below."
              icon={<PaperPlaneTilt className="size-5 text-muted-foreground" />}
              className="flex-none px-0 py-6"
            />
          </div>
        ) : (
          <>
            {showWelcomeIntro ? (
              <div className="px-4 pt-6">
                <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                  <UserAvatar
                    name={welcomeParticipant.name}
                    avatarImageUrl={welcomeParticipant.avatarImageUrl}
                    avatarUrl={welcomeParticipant.avatarUrl}
                    status={welcomeParticipant.status}
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
                      {welcomeParticipant.name ?? title}
                    </p>
                  </UserHoverCard>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This is the beginning of your conversation with{" "}
                    {welcomeParticipant.name ?? title}.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="mt-auto" />
            <div className="flex flex-col gap-0.5 px-4 py-3">
              {messages.map((message, idx) => {
                const author = usersById.get(message.createdBy)
                const prevMessage = messages[idx - 1]
                const nextMessage = messages[idx + 1]
                const isCurrentUser = message.createdBy === currentUserId
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
                const prevIsCall = Boolean(
                  prevMessage &&
                    (prevMessage.kind === "call" ||
                      prevMessage.callId ||
                      parseCallInviteMessage(prevMessage.content))
                )
                const nextIsCall = Boolean(
                  nextMessage &&
                    (nextMessage.kind === "call" ||
                      nextMessage.callId ||
                      parseCallInviteMessage(nextMessage.content))
                )
                const groupedWithPrev =
                  !isCallMessage &&
                  !prevIsCall &&
                  prevMessage?.createdBy === message.createdBy &&
                  new Date(message.createdAt).getTime() -
                    new Date(prevMessage.createdAt).getTime() <
                    5 * 60_000
                const groupedWithNext =
                  !isCallMessage &&
                  !nextIsCall &&
                  nextMessage?.createdBy === message.createdBy &&
                  new Date(nextMessage.createdAt).getTime() -
                    new Date(message.createdAt).getTime() <
                    5 * 60_000

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex px-4 py-0.5",
                      isCurrentUser ? "justify-end" : "justify-start",
                      idx > 0 && !groupedWithPrev && "mt-3"
                    )}
                  >
                    <div
                      className={cn(
                        "flex min-w-0 w-fit max-w-[min(100%,42rem)] items-end gap-2",
                        isCurrentUser && "flex-row-reverse"
                      )}
                    >
                      {!isCurrentUser ? (
                        groupedWithPrev ? (
                          <div className="size-8 shrink-0" />
                        ) : (
                          <UserAvatar
                            name={author?.name}
                            avatarImageUrl={author?.avatarImageUrl}
                            avatarUrl={author?.avatarUrl}
                            status={author?.status}
                            size="default"
                          />
                        )
                      ) : null}
                      <div
                        className={cn(
                          "flex min-w-0 max-w-full flex-col",
                          isCurrentUser ? "items-end" : "items-start"
                        )}
                      >
                        {!groupedWithPrev ? (
                          <div
                            className={cn(
                              "mb-1 flex items-center gap-2 px-1",
                              isCurrentUser ? "justify-end" : "justify-start"
                            )}
                          >
                            {!isCurrentUser ? (
                              <UserHoverCard
                                user={author}
                                userId={author?.id}
                                currentUserId={currentUserId}
                                workspaceId={currentWorkspaceId}
                              >
                                <span className="text-[11px] font-medium">
                                  {author?.name ?? "Unknown"}
                                </span>
                              </UserHoverCard>
                            ) : null}
                            <span className="text-[10px] text-muted-foreground">
                              {formatTimestamp(message.createdAt)}
                            </span>
                          </div>
                        ) : null}
                        <div
                          className={cn(
                            "max-w-full rounded-2xl px-3 py-2.5 text-[13px] leading-5 shadow-sm",
                            isCurrentUser
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground",
                            isCurrentUser
                              ? groupedWithPrev && "rounded-tr-md"
                              : groupedWithPrev && "rounded-tl-md",
                            isCurrentUser
                              ? groupedWithNext && "rounded-br-md"
                              : groupedWithNext && "rounded-bl-md"
                          )}
                        >
                          {callJoinHref ? (
                            <div className="max-w-full space-y-2 whitespace-normal break-words [overflow-wrap:anywhere]">
                              <p className="text-[13px] leading-5">
                                Started a call
                              </p>
                              <Button
                                asChild
                                size="sm"
                                variant={
                                  isCurrentUser ? "secondary" : "outline"
                                }
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
                              className={cn(
                                "max-w-full break-words text-[13px] leading-5 [overflow-wrap:anywhere] [&_.editor-mention]:max-w-full [&_.editor-mention]:whitespace-normal [&_.editor-mention]:[overflow-wrap:anywhere] [&_a]:break-all [&_p]:leading-5 [&_p+p]:mt-1.5 [&_pre]:max-w-full [&_pre]:overflow-x-hidden [&_pre]:whitespace-pre-wrap [&_pre_code]:whitespace-pre-wrap",
                                isCurrentUser &&
                                  "[&_a]:text-primary-foreground hover:[&_a]:text-primary-foreground/90"
                              )}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 border-t bg-background/95 backdrop-blur">
        <ChatComposer
          placeholder={`Message ${title}…`}
          mentionCandidates={messageableMembers}
          currentUserId={currentUserId}
          action={videoAction}
          editable={composerEditable}
          disabledReason={composerDisabledReason}
          onSend={(content) => {
            useAppStore.getState().sendChatMessage({ conversationId, content })
          }}
        />
      </div>
    </div>
  )
}

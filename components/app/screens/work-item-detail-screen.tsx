"use client"

import type { Editor } from "@tiptap/react"
import { format, formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useShallow } from "zustand/react/shallow"
import {
  CalendarBlank,
  CaretDown,
  CaretRight,
  Clock,
  DotsThree,
  Flag,
  FolderSimple,
  LinkSimple,
  NotePencil,
  PaperPlaneTilt,
  Plus,
  SidebarSimple,
  Smiley,
  Tag,
  Trash,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"

import {
  filterPendingDocumentMentionsByContent,
  getPendingRichTextMentionEntries,
  mergePendingDocumentMentions,
  type PendingDocumentMention,
} from "@/lib/content/rich-text-mentions"
import { useDocumentCollaboration } from "@/hooks/use-document-collaboration"
import {
  fetchWorkItemDetailReadModel,
  syncClearWorkItemPresence,
  syncHeartbeatWorkItemPresence,
  syncSendItemDescriptionMentionNotifications,
} from "@/lib/convex/client"
import { RouteMutationError } from "@/lib/convex/client/shared"
import { createMissingScopedReadModelResult } from "@/lib/convex/client/read-models"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import { createWorkItemDetailScopeKey } from "@/lib/scoped-sync/scope-keys"
import {
  canEditTeam,
  getCommentsForTarget,
  getDirectChildWorkItems,
  getDocument,
  getLabelsForTeamScope,
  getProjectHref,
  getStatusOrderForTeam,
  getTeam,
  getTeamMembers,
  getUser,
  getWorkItemChildProgress,
  getWorkItem,
  getWorkItemDescendantIds,
  getWorkItemHierarchyIds,
  sortItems,
} from "@/lib/domain/selectors"
import {
  getAllowedChildWorkItemTypesForItem,
  getChildWorkItemCopy,
  getDisplayLabelForWorkItemType,
  getWorkSurfaceCopy,
  priorityMeta,
  statusMeta,
  type AppData,
  type DocumentPresenceViewer,
  type Priority,
  type WorkItem,
} from "@/lib/domain/types"
import { RichTextContent } from "@/components/app/rich-text-content"
import { useAppStore } from "@/lib/store/app-store"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { ShortcutKeys } from "@/components/app/shortcut-keys"
import { UserAvatar } from "@/components/app/user-presence"
import { Button } from "@/components/ui/button"
import { CollapsibleRightSidebar } from "@/components/ui/collapsible-right-sidebar"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { SidebarTrigger } from "@/components/ui/sidebar"

import { DocumentPresenceAvatarGroup } from "./document-ui"
import {
  getEligibleParentWorkItems,
  getTeamProjectOptions,
  getWorkItemPresenceSessionId,
  selectAppDataSnapshot,
} from "./helpers"
import {
  MissingState,
  PROPERTY_SELECT_SEPARATOR_VALUE,
  PriorityIcon,
  StatusIcon,
  buildPropertyStatusOptions,
} from "./shared"
import {
  WorkItemAssigneeAvatar,
  InlineChildIssueComposer,
} from "./work-item-ui"
import { formatWorkItemDetailDate } from "./date-presentation"
import { cn, getPlainTextContent } from "@/lib/utils"

const WORK_ITEM_PRESENCE_HEARTBEAT_INTERVAL_MS = 15 * 1000
const WORK_ITEM_PRESENCE_BLOCK_CHANGE_DELAY_MS = 250

function formatConcurrentEditorLabel(viewers: DocumentPresenceViewer[]) {
  const names = viewers
    .map((viewer) => viewer.name.trim())
    .filter((name) => name.length > 0)

  if (names.length === 0) {
    return null
  }

  if (names.length === 1) {
    return `${names[0]} is also editing this item`
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are also editing this item`
  }

  return `${names[0]} and ${names.length - 1} others are also editing this item`
}

function isAlreadyDeliveredMentionConflict(error: unknown) {
  return (
    error instanceof RouteMutationError &&
    error.code === "ITEM_DESCRIPTION_MENTION_ALREADY_SENT"
  )
}

const detailIconButtonClassName =
  "inline-grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground disabled:cursor-default disabled:opacity-60"

const detailPropertyValueClassName =
  "flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] text-foreground transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:text-fg-4 disabled:hover:bg-transparent"

const detailChipClassName =
  "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11.5px] text-fg-2"

function formatDetailDate(value: string | null) {
  if (!value) {
    return "—"
  }

  return formatWorkItemDetailDate(value)
}

function formatRelativeTimestamp(value: string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true })
}

function isDescriptionPlaceholder(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim()

  return (
    normalized === "<p>Add a description…</p>" ||
    normalized === "<p>Add a description...</p>" ||
    normalized === "<p></p>"
  )
}

function DetailSidebarSection({
  title,
  count,
  action,
  children,
}: {
  title: string
  count?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mt-7">
      <div className="mb-2.5 flex items-center gap-2 text-[11.5px] font-semibold tracking-[0.05em] text-fg-3 uppercase">
        <span>{title}</span>
        {count ? (
          <span className="font-medium text-fg-4">· {count}</span>
        ) : null}
        {action ? (
          <div className="ml-auto text-[11.5px] font-medium tracking-normal text-fg-3 normal-case">
            {action}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function DetailSidebarStaticRow({
  label,
  icon,
  children,
}: {
  label: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <dt className="flex items-center gap-2 self-center py-1.5 text-fg-3">
        <span className="text-fg-4">{icon}</span>
        <span>{label}</span>
      </dt>
      <dd className="m-0">
        <div className="flex min-h-7 items-center gap-2 rounded-md px-1.5 py-1 text-[12.5px] text-foreground">
          {children}
        </div>
      </dd>
    </>
  )
}

function DetailSidebarSelectRow({
  label,
  icon,
  value,
  options,
  onValueChange,
  disabled,
  renderValue,
  renderOption,
}: {
  label: string
  icon: ReactNode
  value: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
  disabled?: boolean
  renderValue?: (value: string, label: string) => ReactNode
  renderOption?: (value: string, label: string) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const selectedOption =
    options.find((option) => option.value === value) ??
    options.find(
      (option) => option.value !== PROPERTY_SELECT_SEPARATOR_VALUE
    ) ??
    null
  const selectedValue = selectedOption?.value ?? value
  const selectedLabel = selectedOption?.label ?? value

  return (
    <>
      <dt className="flex items-center gap-2 self-center py-1.5 text-fg-3">
        <span className="text-fg-4">{icon}</span>
        <span>{label}</span>
      </dt>
      <dd className="m-0">
        <Popover open={disabled ? false : open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={label}
              disabled={disabled}
              className={detailPropertyValueClassName}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {renderValue ? (
                  renderValue(selectedValue, selectedLabel)
                ) : (
                  <span className="truncate">{selectedLabel}</span>
                )}
              </span>
              <CaretDown className="size-3 shrink-0 text-fg-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[280px] overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-lg"
          >
            <div className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto">
              {options.map((option, index) =>
                option.value === PROPERTY_SELECT_SEPARATOR_VALUE ? (
                  <div
                    key={`separator-${index}`}
                    className="my-1 h-px bg-line-soft"
                  />
                ) : (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "flex min-h-8 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground",
                      option.value === selectedValue &&
                        "bg-surface-3 text-foreground"
                    )}
                    onClick={() => {
                      onValueChange(option.value)
                      setOpen(false)
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      {renderOption
                        ? renderOption(option.value, option.label)
                        : option.label}
                    </span>
                  </button>
                )
              )}
            </div>
          </PopoverContent>
        </Popover>
      </dd>
    </>
  )
}

function DetailSidebarDateRow({
  label,
  icon,
  value,
  onValueChange,
  disabled,
}: {
  label: string
  icon: ReactNode
  value: string | null
  onValueChange: (value: string | null) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <dt className="flex items-center gap-2 self-center py-1.5 text-fg-3">
        <span className="text-fg-4">{icon}</span>
        <span>{label}</span>
      </dt>
      <dd className="m-0">
        <Popover open={disabled ? false : open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={label}
              disabled={disabled}
              className={detailPropertyValueClassName}
            >
              <span className={cn(!value && "text-fg-4")}>
                {value ? formatDetailDate(value) : "Set date"}
              </span>
              <CaretDown className="ml-auto size-3 shrink-0 text-fg-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-64 rounded-lg border border-line bg-surface p-3 shadow-lg"
          >
            <div className="flex flex-col gap-3">
              <Input
                type="date"
                value={value ? value.slice(0, 10) : ""}
                onChange={(event) => {
                  onValueChange(
                    event.target.value
                      ? `${event.target.value}T00:00:00.000Z`
                      : null
                  )
                }}
                className="h-8"
              />
              <div className="flex justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!value}
                  onClick={() => {
                    onValueChange(null)
                    setOpen(false)
                  }}
                >
                  Clear
                </Button>
                <Button size="sm" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </dd>
    </>
  )
}

function DetailSidebarLabelsRow({
  item,
  workspaceId,
  labels,
  editable,
}: {
  item: WorkItem
  workspaceId: string | null | undefined
  labels: AppData["labels"]
  editable: boolean
}) {
  const [newLabelName, setNewLabelName] = useState("")
  const selectedLabels = labels.filter((label) =>
    item.labelIds.includes(label.id)
  )

  function toggleLabel(labelId: string) {
    const nextLabelIds = item.labelIds.includes(labelId)
      ? item.labelIds.filter((currentId) => currentId !== labelId)
      : [...item.labelIds, labelId]

    useAppStore.getState().updateWorkItem(item.id, {
      labelIds: nextLabelIds,
    })
  }

  async function handleCreateLabel() {
    if (!workspaceId || newLabelName.trim().length === 0) {
      return
    }

    const created = await useAppStore
      .getState()
      .createLabel(newLabelName, workspaceId)

    if (!created) {
      return
    }

    const latestItem =
      useAppStore.getState().workItems.find((entry) => entry.id === item.id) ??
      item

    setNewLabelName("")
    useAppStore.getState().updateWorkItem(item.id, {
      labelIds: latestItem.labelIds.includes(created.id)
        ? latestItem.labelIds
        : [...latestItem.labelIds, created.id],
    })
  }

  return (
    <>
      <dt className="flex items-center gap-2 self-center py-1.5 text-fg-3">
        <span className="text-fg-4">
          <Tag className="size-[13px]" />
        </span>
        <span>Labels</span>
      </dt>
      <dd className="m-0">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Manage labels"
              disabled={!editable}
              className={detailPropertyValueClassName}
            >
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {selectedLabels.length > 0 ? (
                  selectedLabels.map((label) => (
                    <span key={label.id} className={detailChipClassName}>
                      <span
                        className="inline-block size-1.5 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      <span>{label.name}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-fg-4">No labels</span>
                )}
                {editable ? (
                  <span
                    className={cn(
                      detailChipClassName,
                      "border-dashed bg-transparent text-fg-3"
                    )}
                  >
                    <Plus className="size-3" />
                  </span>
                ) : null}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-72 rounded-lg border border-line bg-surface p-3 shadow-lg"
          >
            <div className="flex flex-col gap-3">
              <div className="space-y-1">
                <div className="text-[11.5px] font-semibold tracking-[0.05em] text-fg-3 uppercase">
                  Labels
                </div>
                <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                  {labels.length > 0 ? (
                    labels.map((label) => {
                      const selected = item.labelIds.includes(label.id)

                      return (
                        <button
                          key={label.id}
                          type="button"
                          disabled={!editable}
                          className={cn(
                            detailChipClassName,
                            selected &&
                              "border-transparent bg-accent-bg text-accent-fg"
                          )}
                          onClick={() => toggleLabel(label.id)}
                        >
                          <span
                            className="inline-block size-1.5 rounded-full"
                            style={{ backgroundColor: label.color }}
                          />
                          <span>{label.name}</span>
                        </button>
                      )
                    })
                  ) : (
                    <span className="text-[12.5px] text-fg-4">
                      No labels yet
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11.5px] font-semibold tracking-[0.05em] text-fg-3 uppercase">
                  New label
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newLabelName}
                    onChange={(event) => setNewLabelName(event.target.value)}
                    placeholder="Add label"
                    disabled={!editable || !workspaceId}
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    disabled={
                      !editable ||
                      !workspaceId ||
                      newLabelName.trim().length === 0
                    }
                    onClick={() => void handleCreateLabel()}
                  >
                    Create
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </dd>
    </>
  )
}

function DetailSidebarComment({
  data,
  comment,
  repliesByParentId,
  currentUserId,
  editable,
  depth = 0,
}: {
  data: AppData
  comment: AppData["comments"][number]
  repliesByParentId: Record<string, AppData["comments"]>
  currentUserId: string
  editable: boolean
  depth?: number
}) {
  const author = getUser(data, comment.createdBy)
  const replies = repliesByParentId[comment.id] ?? []

  return (
    <div className={cn(depth > 0 && "mt-3 ml-6 border-l border-line pl-4")}>
      <div className="flex gap-2.5 rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5">
        <UserAvatar
          name={author?.name ?? "Unknown"}
          avatarImageUrl={author?.avatarImageUrl}
          avatarUrl={author?.avatarUrl}
          status={author?.status}
          size="sm"
          showStatus={false}
          className="size-7"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[12.5px]">
            <span className="font-semibold text-foreground">
              {author?.name ?? "Unknown"}
            </span>
            <span className="text-[11.5px] text-fg-4">
              {formatRelativeTimestamp(comment.createdAt)}
            </span>
          </div>
          <div className="mt-1 text-[13px] leading-[1.55] whitespace-pre-wrap text-fg-2">
            <RichTextContent
              content={comment.content}
              className="[&_p]:my-0 [&_p+p]:mt-1"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {comment.reactions.map((reaction) => {
              const active = reaction.userIds.includes(currentUserId)

              return (
                <button
                  key={`${comment.id}-${reaction.emoji}`}
                  type="button"
                  disabled={!editable}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors",
                    active
                      ? "border-transparent bg-accent-bg text-accent-fg"
                      : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3"
                  )}
                  onClick={() =>
                    useAppStore
                      .getState()
                      .toggleCommentReaction(comment.id, reaction.emoji)
                  }
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.userIds.length}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {replies.map((reply) => (
        <DetailSidebarComment
          key={reply.id}
          data={data}
          comment={reply}
          repliesByParentId={repliesByParentId}
          currentUserId={currentUserId}
          editable={editable}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

function DetailSidebarActivity({
  data,
  currentUserId,
  item,
  editable,
}: {
  data: AppData
  currentUserId: string
  item: WorkItem
  editable: boolean
}) {
  const comments = getCommentsForTarget(data, "workItem", item.id)
  const rootComments = comments.filter(
    (comment) => comment.parentCommentId === null
  )
  const repliesByParentId = comments.reduce<
    Record<string, AppData["comments"]>
  >((accumulator, comment) => {
    if (!comment.parentCommentId) {
      return accumulator
    }

    accumulator[comment.parentCommentId] = [
      ...(accumulator[comment.parentCommentId] ?? []),
      comment,
    ]

    return accumulator
  }, {})
  const creator = getUser(data, item.creatorId)
  const assignee = item.assigneeId ? getUser(data, item.assigneeId) : null
  const [content, setContent] = useState("")
  const commentEditorRef = useRef<Editor | null>(null)
  const contentText = getPlainTextContent(content)
  const mentionCandidates = getTeamMembers(data, item.teamId).filter(
    (candidate) => candidate.id !== currentUserId
  )

  function handleComment() {
    if (!contentText) {
      return
    }

    useAppStore.getState().addComment({
      targetType: "workItem",
      targetId: item.id,
      content,
    })
    setContent("")
  }

  const activityEvents = [
    {
      id: `${item.id}-created`,
      user: creator,
      body: "created this item",
      when: item.createdAt,
    },
    ...(assignee && assignee.id !== creator?.id
      ? [
          {
            id: `${item.id}-assignee`,
            user: assignee,
            body: "is assigned to this item",
            when: item.updatedAt,
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-3.5">
      {activityEvents.map((event) =>
        event.user ? (
          <div key={event.id} className="flex gap-2.5 text-[12.5px] text-fg-2">
            <UserAvatar
              name={event.user.name}
              avatarImageUrl={event.user.avatarImageUrl}
              avatarUrl={event.user.avatarUrl}
              status={event.user.status}
              size="sm"
              showStatus={false}
              className="mt-0.5 size-5"
            />
            <div className="leading-[1.55]">
              <span className="font-medium text-foreground">
                {event.user.name}
              </span>{" "}
              <span>{event.body}</span>
              <span className="ml-1 text-[11.5px] text-fg-4">
                {formatRelativeTimestamp(event.when)}
              </span>
            </div>
          </div>
        ) : null
      )}

      {rootComments.map((comment) => (
        <DetailSidebarComment
          key={comment.id}
          data={data}
          comment={comment}
          repliesByParentId={repliesByParentId}
          currentUserId={currentUserId}
          editable={editable}
        />
      ))}

      <div className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5 transition-colors focus-within:border-fg-3">
        <RichTextEditor
          content={content}
          onChange={setContent}
          editable={editable}
          compact
          allowSlashCommands={false}
          showToolbar={false}
          showStats={false}
          placeholder="Leave a comment or mention a teammate with @handle..."
          editorInstanceRef={commentEditorRef}
          mentionCandidates={mentionCandidates}
          onSubmitShortcut={handleComment}
          submitOnEnter
          className="[&_.ProseMirror]:min-h-[3rem] [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-[1.55]"
        />
        <div className="mt-1.5 flex items-center justify-end gap-2 border-t border-dashed border-line pt-1.5">
          <ShortcutKeys
            keys={["Enter"]}
            keyClassName="h-[18px] min-w-0 rounded-[4px] border-line bg-surface-2 px-1 text-[10.5px] text-fg-3 shadow-none"
          />
          <Button
            size="sm"
            disabled={!editable || contentText.length === 0}
            onClick={handleComment}
          >
            <PaperPlaneTilt className="size-3.5" />
            Comment
          </Button>
        </div>
      </div>
    </div>
  )
}

function MainActivityThreadItem({
  avatar,
  children,
  showLine = true,
  variant = "event",
}: {
  avatar: ReactNode
  children: ReactNode
  showLine?: boolean
  variant?: "event" | "comment" | "composer"
}) {
  return (
    <li className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3">
      {showLine ? (
        <span
          aria-hidden
          className="pointer-events-none absolute top-7 bottom-0 left-[13px] w-px bg-line-soft"
        />
      ) : null}
      <div className="relative z-[1] flex h-7 w-7 items-start justify-center pt-0.5">
        {avatar}
      </div>
      <div
        className={cn(
          "min-w-0",
          variant === "event" && "flex min-h-7 items-center pb-5",
          variant === "comment" && "pb-5",
          variant === "composer" && "pb-0"
        )}
      >
        {children}
      </div>
    </li>
  )
}

function MainActivityReactionButton({
  emoji,
  count,
  active,
  disabled,
  onToggle,
}: {
  emoji: string
  count: number
  active: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors",
        active
          ? "border-transparent bg-accent-bg text-accent-fg"
          : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-foreground",
        disabled && "opacity-60"
      )}
    >
      <span>{emoji}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  )
}

function MainActivityCommentCard({
  data,
  comment,
  repliesByParentId,
  currentUserId,
  editable,
  mentionCandidates,
  nested = false,
}: {
  data: AppData
  comment: AppData["comments"][number]
  repliesByParentId: Record<string, AppData["comments"]>
  currentUserId: string
  editable: boolean
  mentionCandidates: AppData["users"]
  nested?: boolean
}) {
  const author = getUser(data, comment.createdBy)
  const replies = repliesByParentId[comment.id] ?? []
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyContent, setReplyContent] = useState("")
  const replyEditorRef = useRef<Editor | null>(null)
  const replyText = getPlainTextContent(replyContent)

  function handleReply() {
    if (!replyText) {
      return
    }

    useAppStore.getState().addComment({
      targetType: "workItem",
      targetId: comment.targetId,
      parentCommentId: comment.id,
      content: replyContent,
    })
    setReplyContent("")
    setReplyOpen(false)
  }

  return (
    <article
      className={cn(
        "group/comment overflow-hidden rounded-xl border border-line bg-surface transition-colors",
        !nested && "shadow-[0_1px_0_0_var(--line-soft)]"
      )}
    >
      <header className="flex items-center gap-2 px-3.5 pt-2.5">
        {nested ? (
          <UserAvatar
            name={author?.name ?? "Unknown"}
            avatarImageUrl={author?.avatarImageUrl}
            avatarUrl={author?.avatarUrl}
            status={author?.status}
            size="sm"
            showStatus={false}
            className="size-5"
          />
        ) : null}
        <span className="text-[12.5px] font-semibold text-foreground">
          {author?.name ?? "Unknown"}
        </span>
        <span className="text-[11px] text-fg-4">
          commented {formatRelativeTimestamp(comment.createdAt)}
        </span>
        <span className="ml-auto hidden text-[11px] text-fg-4 group-hover/comment:inline">
          {format(new Date(comment.createdAt), "MMM d, h:mm a")}
        </span>
      </header>
      <div className="px-3.5 pt-1 pb-3">
        <RichTextContent
          content={comment.content}
          className="text-[13px] leading-[1.6] text-fg-2 [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:my-1 [&_ul]:ml-4 [&_ul]:list-disc"
        />
      </div>
      {comment.reactions.length > 0 || editable ? (
        <footer className="flex flex-wrap items-center gap-1.5 border-t border-line-soft bg-surface-2/40 px-3.5 py-1.5">
          {comment.reactions.map((reaction) => (
            <MainActivityReactionButton
              key={`${comment.id}-${reaction.emoji}`}
              emoji={reaction.emoji}
              count={reaction.userIds.length}
              active={reaction.userIds.includes(currentUserId)}
              disabled={!editable}
              onToggle={() =>
                useAppStore
                  .getState()
                  .toggleCommentReaction(comment.id, reaction.emoji)
              }
            />
          ))}
          {editable ? (
            <>
              <EmojiPickerPopover
                align="start"
                side="top"
                onEmojiSelect={(emoji) => {
                  useAppStore
                    .getState()
                    .toggleCommentReaction(comment.id, emoji)
                }}
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-[11.5px] text-fg-3 transition-colors hover:border-fg-4 hover:bg-surface-3 hover:text-foreground"
                  >
                    <Smiley className="size-3" />
                    <span>React</span>
                  </button>
                }
              />
              <button
                type="button"
                className="ml-1 text-[11.5px] text-fg-3 transition-colors hover:text-foreground"
                onClick={() => setReplyOpen((current) => !current)}
              >
                {replyOpen ? "Cancel reply" : "Reply"}
              </button>
            </>
          ) : null}
        </footer>
      ) : null}

      {replies.length > 0 ? (
        <div className="border-t border-line-soft bg-surface-2/30 px-3.5 py-3">
          <ul className="flex flex-col gap-2.5">
            {replies.map((reply) => (
              <li key={reply.id}>
                <MainActivityCommentCard
                  data={data}
                  comment={reply}
                  repliesByParentId={repliesByParentId}
                  currentUserId={currentUserId}
                  editable={editable}
                  mentionCandidates={mentionCandidates}
                  nested
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {replyOpen ? (
        <div className="border-t border-line-soft bg-background px-3.5 py-3">
          <div className="rounded-lg border border-line bg-surface transition-colors focus-within:border-fg-3">
            <div className="px-3 py-2">
              <RichTextEditor
                content={replyContent}
                onChange={setReplyContent}
                editable={editable}
                compact
                autoFocus
                allowSlashCommands={false}
                showToolbar={false}
                showStats={false}
                placeholder="Write a reply…"
                editorInstanceRef={replyEditorRef}
                mentionCandidates={mentionCandidates}
                onSubmitShortcut={handleReply}
                submitOnEnter
                className="[&_.ProseMirror]:min-h-[2.5rem] [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-[1.55]"
              />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-dashed border-line px-3 py-1.5">
              <EmojiPickerPopover
                align="start"
                side="top"
                onEmojiSelect={(emoji) =>
                  replyEditorRef.current
                    ?.chain()
                    .focus()
                    .insertContent(emoji)
                    .run()
                }
                trigger={
                  <button
                    type="button"
                    className="rounded-md p-1 text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
                  >
                    <Smiley className="size-3.5" />
                  </button>
                }
              />
              <div className="flex items-center gap-2">
                <ShortcutKeys
                  keys={["Enter"]}
                  keyClassName="h-[18px] min-w-0 rounded-[4px] border-line bg-surface-2 px-1 text-[10.5px] text-fg-3 shadow-none"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setReplyContent("")
                    setReplyOpen(false)
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" disabled={!replyText} onClick={handleReply}>
                  Reply
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function MainActivityTimeline({
  data,
  item,
  currentUserId,
  editable,
}: {
  data: AppData
  item: WorkItem
  currentUserId: string
  editable: boolean
}) {
  const comments = getCommentsForTarget(data, "workItem", item.id)
  const rootComments = comments.filter(
    (comment) => comment.parentCommentId === null
  )
  const repliesByParentId = comments.reduce<
    Record<string, AppData["comments"]>
  >((accumulator, comment) => {
    if (!comment.parentCommentId) {
      return accumulator
    }

    accumulator[comment.parentCommentId] = [
      ...(accumulator[comment.parentCommentId] ?? []),
      comment,
    ]

    return accumulator
  }, {})
  const creator = getUser(data, item.creatorId)
  const assignee = item.assigneeId ? getUser(data, item.assigneeId) : null
  const currentUser = getUser(data, currentUserId)
  const mentionCandidates = getTeamMembers(data, item.teamId).filter(
    (candidate) => candidate.id !== currentUserId
  )
  const [content, setContent] = useState("")
  const commentEditorRef = useRef<Editor | null>(null)
  const contentText = getPlainTextContent(content)

  function handleComment() {
    if (!contentText) {
      return
    }

    useAppStore.getState().addComment({
      targetType: "workItem",
      targetId: item.id,
      content,
    })
    setContent("")
  }

  type TimelineEntry =
    | {
        kind: "event"
        id: string
        user: AppData["users"][number]
        body: string
        when: string
      }
    | {
        kind: "comment"
        id: string
        comment: AppData["comments"][number]
        when: string
      }

  const entries: TimelineEntry[] = []

  if (creator) {
    entries.push({
      kind: "event",
      id: `${item.id}-created`,
      user: creator,
      body: "created this item",
      when: item.createdAt,
    })
  }

  if (assignee && assignee.id !== creator?.id) {
    entries.push({
      kind: "event",
      id: `${item.id}-assignee`,
      user: assignee,
      body: "was assigned to this item",
      when: item.updatedAt,
    })
  }

  for (const rootComment of rootComments) {
    entries.push({
      kind: "comment",
      id: rootComment.id,
      comment: rootComment,
      when: rootComment.createdAt,
    })
  }

  entries.sort((left, right) => left.when.localeCompare(right.when))

  return (
    <ol className="flex flex-col">
      {entries.map((entry) => {
        if (entry.kind === "event") {
          return (
            <MainActivityThreadItem
              key={entry.id}
              avatar={
                <UserAvatar
                  name={entry.user.name}
                  avatarImageUrl={entry.user.avatarImageUrl}
                  avatarUrl={entry.user.avatarUrl}
                  status={entry.user.status}
                  size="sm"
                  showStatus={false}
                  className="size-6"
                />
              }
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[12.5px] leading-[1.55] text-fg-2">
                <span className="font-medium text-foreground">
                  {entry.user.name}
                </span>
                <span className="text-fg-3">{entry.body}</span>
                <span className="text-[11px] text-fg-4">
                  · {formatRelativeTimestamp(entry.when)}
                </span>
              </div>
            </MainActivityThreadItem>
          )
        }

        const author = getUser(data, entry.comment.createdBy)

        return (
          <MainActivityThreadItem
            key={entry.id}
            variant="comment"
            avatar={
              <UserAvatar
                name={author?.name ?? "Unknown"}
                avatarImageUrl={author?.avatarImageUrl}
                avatarUrl={author?.avatarUrl}
                status={author?.status}
                size="sm"
                showStatus={false}
                className="size-7"
              />
            }
          >
            <MainActivityCommentCard
              data={data}
              comment={entry.comment}
              repliesByParentId={repliesByParentId}
              currentUserId={currentUserId}
              editable={editable}
              mentionCandidates={mentionCandidates}
            />
          </MainActivityThreadItem>
        )
      })}

      <MainActivityThreadItem
        showLine={false}
        variant="composer"
        avatar={
          currentUser ? (
            <UserAvatar
              name={currentUser.name}
              avatarImageUrl={currentUser.avatarImageUrl}
              avatarUrl={currentUser.avatarUrl}
              status={currentUser.status}
              size="sm"
              showStatus={false}
              className="size-7"
            />
          ) : (
            <span className="size-7 rounded-full bg-surface-3" />
          )
        }
      >
        <div className="rounded-xl border border-line bg-surface transition-colors focus-within:border-fg-3">
          <div className="px-3 py-2">
            <RichTextEditor
              content={content}
              onChange={setContent}
              editable={editable}
              compact
              allowSlashCommands={false}
              showToolbar={false}
              showStats={false}
              placeholder="Leave a comment or mention a teammate with @handle…"
              editorInstanceRef={commentEditorRef}
              mentionCandidates={mentionCandidates}
              onSubmitShortcut={handleComment}
              submitOnEnter
              className="[&_.ProseMirror]:min-h-[3rem] [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-[1.55]"
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-dashed border-line px-3 py-1.5">
            <EmojiPickerPopover
              align="start"
              side="top"
              onEmojiSelect={(emoji) =>
                commentEditorRef.current
                  ?.chain()
                  .focus()
                  .insertContent(emoji)
                  .run()
              }
              trigger={
                <button
                  type="button"
                  disabled={!editable}
                  className="rounded-md p-1 text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground disabled:text-fg-4 disabled:hover:bg-transparent"
                >
                  <Smiley className="size-4" />
                </button>
              }
            />
            <div className="flex items-center gap-2">
              <ShortcutKeys
                keys={["Enter"]}
                keyClassName="h-[18px] min-w-0 rounded-[4px] border-line bg-surface-2 px-1 text-[10.5px] text-fg-3 shadow-none"
              />
              <Button
                size="sm"
                disabled={!editable || contentText.length === 0}
                onClick={handleComment}
              >
                <PaperPlaneTilt className="size-3.5" />
                Comment
              </Button>
            </div>
          </div>
        </div>
      </MainActivityThreadItem>
    </ol>
  )
}

export function WorkItemDetailScreen({ itemId }: { itemId: string }) {
  const router = useRouter()
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const currentUserId = useAppStore((state) => state.currentUserId)
  const currentUser = getUser(data, currentUserId) ?? null
  const item = data.workItems.find((entry) => entry.id === itemId)
  const [deletingItem, setDeletingItem] = useState(false)
  const [projectConfirmOpen, setProjectConfirmOpen] = useState(false)
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [mainChildComposerOpen, setMainChildComposerOpen] = useState(false)
  const [sidebarChildComposerOpen, setSidebarChildComposerOpen] =
    useState(false)
  const [subIssuesOpen, setSubIssuesOpen] = useState(true)
  const [propertiesOpen, setPropertiesOpen] = useState(true)
  const [mainEditing, setMainEditing] = useState(false)
  const [mainDraftItemId, setMainDraftItemId] = useState<string | null>(null)
  const [mainDraftUpdatedAt, setMainDraftUpdatedAt] = useState<string | null>(
    null
  )
  const [mainDraftTitle, setMainDraftTitle] = useState("")
  const [mainDraftDescription, setMainDraftDescription] = useState("")
  const [
    mainPendingMentionRetryEntriesByItemId,
    setMainPendingMentionRetryEntriesByItemId,
  ] = useState<Record<string, PendingDocumentMention[]>>({})
  const [savingMainSection, setSavingMainSection] = useState(false)
  const [workItemPresenceViewers, setWorkItemPresenceViewers] = useState<
    DocumentPresenceViewer[]
  >([])
  const [legacyActiveBlockId, setLegacyActiveBlockId] = useState<string | null>(
    null
  )
  const legacyActiveBlockIdRef = useRef<string | null>(null)
  const sendLegacyPresenceRef = useRef<(() => void) | null>(null)
  const description = item ? getDocument(data, item.descriptionDocId) : null
  const descriptionContent = description?.content ?? "<p>Add a description…</p>"
  const activeDescriptionDocumentId = description?.id ?? null
  const activePresenceItemId = item?.id ?? null
  const isEditingCurrentItem =
    item !== undefined && mainEditing && mainDraftItemId === item.id
  const {
    collaboration,
    flush: flushCollaboration,
    isAwaitingCollaboration,
    lifecycle: collaborationLifecycle,
    viewers: collaborationViewers,
  } = useDocumentCollaboration({
    documentId: description?.id ?? null,
    currentUser,
    enabled: Boolean(description?.id),
  })
  const {
    hasLoadedOnce: hasLoadedWorkItemReadModel,
  } = useScopedReadModelRefresh({
    enabled:
      !item ||
      collaborationLifecycle === "legacy" ||
      collaborationLifecycle === "degraded",
    scopeKeys: [createWorkItemDetailScopeKey(itemId)],
    fetchLatest: () => fetchWorkItemDetailReadModel(itemId),
    notFoundResult: createMissingScopedReadModelResult([
      {
        kind: "work-item-detail",
        itemId,
      },
    ]),
  })
  const isCollaborationAttached = collaborationLifecycle === "attached"
  const isCollaborationBootstrapping =
    collaborationLifecycle === "bootstrapping"
  const isProtectingDescriptionBody = Boolean(
    activeDescriptionDocumentId &&
      (isEditingCurrentItem ||
        isCollaborationBootstrapping ||
        isCollaborationAttached)
  )

  useEffect(() => {
    if (!activeDescriptionDocumentId) {
      return
    }

    useAppStore
      .getState()
      .setDocumentBodyProtection(
        activeDescriptionDocumentId,
        isProtectingDescriptionBody
      )

    return () => {
      useAppStore
        .getState()
        .setDocumentBodyProtection(activeDescriptionDocumentId, false)
    }
  }, [activeDescriptionDocumentId, isProtectingDescriptionBody])

  useEffect(() => {
    if (!activePresenceItemId) {
      return
    }

    if (
      collaborationLifecycle === "legacy" ||
      collaborationLifecycle === "degraded"
    ) {
      return
    }

    useAppStore.getState().cancelItemDescriptionSync(activePresenceItemId)
  }, [
    activePresenceItemId,
    collaborationLifecycle,
  ])

  useEffect(() => {
    if (!activePresenceItemId) {
      sendLegacyPresenceRef.current = null
      setWorkItemPresenceViewers([])
      setLegacyActiveBlockId(null)
      legacyActiveBlockIdRef.current = null
      return
    }

    if (
      collaborationLifecycle === "attached"
    ) {
      sendLegacyPresenceRef.current = null
      setWorkItemPresenceViewers([])
      return
    }

    let cancelled = false
    let presenceActive = window.document.visibilityState === "visible"
    let heartbeatTimeoutId: number | null = null
    const activeItemId = activePresenceItemId
    const sessionId = getWorkItemPresenceSessionId(currentUserId)

    function clearHeartbeatTimeout() {
      if (heartbeatTimeoutId !== null) {
        window.clearTimeout(heartbeatTimeoutId)
        heartbeatTimeoutId = null
      }
    }

    function scheduleHeartbeat(delayMs: number) {
      clearHeartbeatTimeout()

      if (
        cancelled ||
        !presenceActive ||
        window.document.visibilityState !== "visible"
      ) {
        return
      }

      heartbeatTimeoutId = window.setTimeout(() => {
        void sendHeartbeat()
      }, delayMs)
    }

    async function sendHeartbeat() {
      if (
        cancelled ||
        !presenceActive ||
        window.document.visibilityState !== "visible"
      ) {
        return
      }

      try {
        const viewers = await syncHeartbeatWorkItemPresence(
          activeItemId,
          sessionId,
          legacyActiveBlockIdRef.current
        )

        if (
          !cancelled &&
          presenceActive &&
          window.document.visibilityState === "visible"
        ) {
          setWorkItemPresenceViewers(viewers)
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to sync work item presence", error)
        }
      } finally {
        scheduleHeartbeat(WORK_ITEM_PRESENCE_HEARTBEAT_INTERVAL_MS)
      }
    }

    sendLegacyPresenceRef.current = () => {
      void sendHeartbeat()
    }

    function resumePresence() {
      if (cancelled || window.document.visibilityState !== "visible") {
        return
      }

      presenceActive = true
      void sendHeartbeat()
    }

    function leaveWorkItem(options?: { keepalive?: boolean }) {
      presenceActive = false
      clearHeartbeatTimeout()

      if (!cancelled) {
        setWorkItemPresenceViewers([])
      }

      void syncClearWorkItemPresence(activeItemId, sessionId, {
        keepalive: options?.keepalive,
      }).catch((error) => {
        if (!cancelled && window.document.visibilityState === "visible") {
          console.error("Failed to clear work item presence", error)
        }
      })
    }

    const handleVisibilityChange = () => {
      if (window.document.visibilityState === "visible") {
        resumePresence()
        return
      }

      leaveWorkItem({ keepalive: true })
    }
    const handleWindowFocus = () => {
      resumePresence()
    }
    const handleWindowOnline = () => {
      resumePresence()
    }
    const handlePageShow = () => {
      resumePresence()
    }
    const handlePageHide = () => {
      leaveWorkItem({ keepalive: true })
    }

    resumePresence()

    window.addEventListener("focus", handleWindowFocus)
    window.addEventListener("online", handleWindowOnline)
    window.addEventListener("pageshow", handlePageShow)
    window.document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      cancelled = true
      clearHeartbeatTimeout()
      window.removeEventListener("focus", handleWindowFocus)
      window.removeEventListener("online", handleWindowOnline)
      window.removeEventListener("pageshow", handlePageShow)
      window.document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      )
      window.removeEventListener("pagehide", handlePageHide)
      sendLegacyPresenceRef.current = null
      void syncClearWorkItemPresence(activeItemId, sessionId, {
        keepalive: true,
      }).catch(() => {})
    }
  }, [
    activePresenceItemId,
    collaborationLifecycle,
    currentUserId,
  ])

  useEffect(() => {
    setMainChildComposerOpen(false)
    setSidebarChildComposerOpen(false)
  }, [itemId])

  const hasLiveDescriptionPresence =
    collaborationLifecycle === "attached"
  const activeDescriptionViewers =
    hasLiveDescriptionPresence
      ? collaborationViewers
      : currentUser
        ? [
            {
              userId: currentUser.id,
              name: currentUser.name,
              avatarUrl: currentUser.avatarUrl,
              avatarImageUrl: currentUser.avatarImageUrl ?? null,
              activeBlockId: legacyActiveBlockId,
              lastSeenAt: new Date().toISOString(),
            },
            ...workItemPresenceViewers,
          ]
        : workItemPresenceViewers
  const otherDescriptionViewers = activeDescriptionViewers.filter(
    (viewer) => viewer.userId !== currentUserId
  )
  const handleLegacyActiveBlockChange = useCallback(
    (activeBlockId: string | null) => {
      legacyActiveBlockIdRef.current = activeBlockId
      setLegacyActiveBlockId(activeBlockId)
    },
    []
  )

  useEffect(() => {
    if (
      hasLiveDescriptionPresence ||
      !activePresenceItemId ||
      !isEditingCurrentItem
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      sendLegacyPresenceRef.current?.()
    }, WORK_ITEM_PRESENCE_BLOCK_CHANGE_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    activePresenceItemId,
    hasLiveDescriptionPresence,
    isEditingCurrentItem,
    legacyActiveBlockId,
  ])

  if (!item) {
    if (deletingItem) {
      return null
    }

    if (!hasLoadedWorkItemReadModel) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading work item...
        </div>
      )
    }

    return <MissingState title="Work item not found" />
  }

  const currentItem = item
  const team = getTeam(data, currentItem.teamId)
  const workCopy = getWorkSurfaceCopy(team?.settings.experience)
  const editable = team ? canEditTeam(data, team.id) : false
  // Title and description stay behind explicit edit mode; sidebar properties do not.
  const sidebarEditable = editable
  const statusOptions = buildPropertyStatusOptions(getStatusOrderForTeam(team))
  const teamMembers = team ? getTeamMembers(data, team.id) : []
  const teamProjects = getTeamProjectOptions(
    data,
    team?.id,
    currentItem.primaryProjectId
  )
  const selectedProject = currentItem.primaryProjectId
    ? (data.projects.find(
        (project) => project.id === currentItem.primaryProjectId
      ) ?? null)
    : null
  const selectedMilestone = currentItem.milestoneId
    ? (data.milestones.find(
        (milestone) => milestone.id === currentItem.milestoneId
      ) ?? null)
    : null
  const availableLabels = team
    ? [...getLabelsForTeamScope(data, team.id)].sort((left, right) =>
        left.name.localeCompare(right.name)
      )
    : []
  const parentItem = currentItem.parentId
    ? getWorkItem(data, currentItem.parentId)
    : null
  const childItems = sortItems(
    getDirectChildWorkItems(data, currentItem.id),
    "priority"
  )
  const childProgress = getWorkItemChildProgress(data, currentItem.id)
  const parentOptions = [
    { value: "none", label: "No parent" },
    ...getEligibleParentWorkItems(data, currentItem).map((candidate) => ({
      value: candidate.id,
      label: `${candidate.key} · ${candidate.title}`,
    })),
  ]
  const allowedChildTypes = getAllowedChildWorkItemTypesForItem(currentItem)
  const childCopy = getChildWorkItemCopy(
    currentItem.type,
    team?.settings.experience
  )
  const canCreateChildItem = editable && allowedChildTypes.length > 0
  const descendantCount = getWorkItemDescendantIds(data, currentItem.id).size
  const hierarchySize = getWorkItemHierarchyIds(data, currentItem.id).size
  const itemLabel = getDisplayLabelForWorkItemType(
    currentItem.type,
    team?.settings.experience
  ).toLowerCase()
  const linkedProjects = currentItem.linkedProjectIds
    .map(
      (projectId) =>
        data.projects.find((project) => project.id === projectId) ?? null
    )
    .filter(
      (project): project is NonNullable<typeof project> => project !== null
    )
  const linkedDocuments = currentItem.linkedDocumentIds
    .map((documentId) => getDocument(data, documentId))
    .filter(
      (document): document is NonNullable<typeof document> => document !== null
    )
  const cascadeMessage =
    descendantCount > 0
      ? `Delete this ${itemLabel} and ${descendantCount} nested item${
          descendantCount === 1 ? "" : "s"
        }?`
      : `Delete this ${itemLabel}?`
  const showSubIssuesSection =
    childItems.length > 0 || allowedChildTypes.length > 0
  const displayedEndDate = currentItem.targetDate ?? currentItem.dueDate
  const isMainEditing = mainEditing && mainDraftItemId === currentItem.id
  const sidebarTitle =
    isMainEditing && mainDraftTitle.trim().length > 0
      ? mainDraftTitle
      : currentItem.title
  const sidebarDescription = isMainEditing
    ? mainDraftDescription
    : descriptionContent
  const sidebarHasDescription = !isDescriptionPlaceholder(sidebarDescription)
  const activeMainPendingMentionRetryEntries =
    filterPendingDocumentMentionsByContent(
      mainPendingMentionRetryEntriesByItemId[currentItem.id] ?? [],
      mainDraftDescription
    )
  const otherWorkItemEditors = otherDescriptionViewers
  const concurrentEditorLabel =
    formatConcurrentEditorLabel(otherWorkItemEditors)
  const pendingMainMentionEntries = isMainEditing
    ? mergePendingDocumentMentions(
        activeMainPendingMentionRetryEntries,
        getPendingRichTextMentionEntries(
          descriptionContent,
          mainDraftDescription
        )
      )
    : []
  const normalizedMainDraftTitle = mainDraftTitle.trim()
  const mainTitleDirty =
    isMainEditing && normalizedMainDraftTitle !== currentItem.title
  const mainDescriptionDirty =
    isMainEditing && mainDraftDescription !== descriptionContent
  const mainDirty = mainTitleDirty || mainDescriptionDirty
  const mainDraftStale =
    !isCollaborationAttached &&
    isMainEditing &&
    Boolean(mainDraftUpdatedAt) &&
    mainDraftUpdatedAt !== currentItem.updatedAt
  const canSaveMainSection =
    isCollaborationAttached
      ? isMainEditing && !savingMainSection
      : !isAwaitingCollaboration &&
          isMainEditing &&
          normalizedMainDraftTitle.length >= 2 &&
          normalizedMainDraftTitle.length <= 96 &&
          (mainDirty || pendingMainMentionEntries.length > 0) &&
          !savingMainSection &&
          !mainDraftStale

  function buildEndDatePatch(nextEndDate: string | null) {
    return {
      dueDate: currentItem.dueDate ? nextEndDate : undefined,
      targetDate:
        currentItem.targetDate || !currentItem.dueDate
          ? nextEndDate
          : undefined,
    }
  }

  function handleStartDateChange(nextStartDate: string | null) {
    const patch: {
      startDate?: string | null
      dueDate?: string | null
      targetDate?: string | null
    } = {
      startDate: nextStartDate,
    }

    if (
      nextStartDate &&
      displayedEndDate &&
      new Date(nextStartDate).getTime() > new Date(displayedEndDate).getTime()
    ) {
      Object.assign(patch, buildEndDatePatch(nextStartDate))
    }

    useAppStore.getState().updateWorkItem(currentItem.id, patch)
  }

  function handleProjectChange(value: string) {
    const nextProjectId = value === "none" ? null : value

    if (nextProjectId === currentItem.primaryProjectId) {
      return
    }

    if (hierarchySize > 1) {
      setPendingProjectId(nextProjectId)
      setProjectConfirmOpen(true)
      return
    }

    useAppStore.getState().updateWorkItem(currentItem.id, {
      primaryProjectId: nextProjectId,
    })
  }

  function handleEndDateChange(nextEndDate: string | null) {
    const patch: {
      startDate?: string | null
      dueDate?: string | null
      targetDate?: string | null
    } = buildEndDatePatch(nextEndDate)

    if (
      nextEndDate &&
      currentItem.startDate &&
      new Date(nextEndDate).getTime() <
        new Date(currentItem.startDate).getTime()
    ) {
      patch.startDate = nextEndDate
    }

    useAppStore.getState().updateWorkItem(currentItem.id, patch)
  }

  function handleStartMainEdit() {
    if (!editable || isCollaborationBootstrapping) {
      return
    }

    setMainDraftItemId(currentItem.id)
    setMainDraftUpdatedAt(currentItem.updatedAt)
    setMainDraftTitle(currentItem.title)
    setMainDraftDescription(descriptionContent)
    setMainEditing(true)
  }

  function handleCancelMainEdit() {
    setMainDraftItemId(null)
    setMainDraftUpdatedAt(null)
    setMainDraftTitle(currentItem.title)
    setMainDraftDescription(descriptionContent)
    setMainEditing(false)
  }

  function handleReloadMainDraft() {
    setMainDraftUpdatedAt(currentItem.updatedAt)
    setMainDraftTitle(currentItem.title)
    setMainDraftDescription(descriptionContent)
  }

  async function handleSaveMainEdit() {
    if (!canSaveMainSection) {
      return
    }

    setSavingMainSection(true)
    const savedItemId = currentItem.id
    const pendingMentionEntries = [...pendingMainMentionEntries]

    if (isCollaborationAttached) {
      try {
        await flushCollaboration({
          ...(mainTitleDirty
            ? {
                workItemExpectedUpdatedAt:
                  mainDraftUpdatedAt ?? currentItem.updatedAt,
                workItemTitle: normalizedMainDraftTitle,
              }
            : {}),
        })
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to persist the latest description changes"
        )
        setSavingMainSection(false)
        return
      }
    } else {
      const saved = await useAppStore.getState().saveWorkItemMainSection({
        itemId: savedItemId,
        title: normalizedMainDraftTitle,
        description: mainDraftDescription,
        expectedUpdatedAt: mainDraftUpdatedAt ?? currentItem.updatedAt,
      })

      if (!saved) {
        setSavingMainSection(false)
        return
      }
    }

    setMainDraftItemId(null)
    setMainDraftUpdatedAt(null)
    setMainEditing(false)

    if (pendingMentionEntries.length > 0) {
      try {
        const result = await syncSendItemDescriptionMentionNotifications(
          savedItemId,
          pendingMentionEntries
        )

        setMainPendingMentionRetryEntriesByItemId((current) => {
          const next = { ...current }
          delete next[savedItemId]
          return next
        })

        toast.success(
          `Saved changes and notified ${result.recipientCount} ${result.recipientCount === 1 ? "person" : "people"}.`
        )
      } catch (error) {
        if (isAlreadyDeliveredMentionConflict(error)) {
          setMainPendingMentionRetryEntriesByItemId((current) => {
            const next = { ...current }
            delete next[savedItemId]
            return next
          })
          toast.success("Saved changes and delivered mention notifications.")
        } else {
          setMainPendingMentionRetryEntriesByItemId((current) => ({
            ...current,
            [savedItemId]: pendingMentionEntries,
          }))
          toast.error(
            error instanceof Error
              ? error.message
              : "Saved changes but failed to notify mentions"
          )
        }
      }
    } else {
      setMainPendingMentionRetryEntriesByItemId((current) => {
        if (!(savedItemId in current)) {
          return current
        }

        const next = { ...current }
        delete next[savedItemId]
        return next
      })
    }

    setSavingMainSection(false)
  }

  async function handleDeleteItem() {
    setDeletingItem(true)

    const deleted = await useAppStore.getState().deleteWorkItem(currentItem.id)

    if (!deleted) {
      setDeletingItem(false)
      return
    }

    setDeleteDialogOpen(false)
    router.replace(team?.slug ? `/team/${team.slug}/work` : "/inbox")
  }

  function handleProjectConfirmOpenChange(open: boolean) {
    setProjectConfirmOpen(open)

    if (!open) {
      setPendingProjectId(null)
    }
  }

  function handleConfirmProjectChange() {
    useAppStore.getState().updateWorkItem(currentItem.id, {
      primaryProjectId: pendingProjectId,
    })
    setProjectConfirmOpen(false)
    setPendingProjectId(null)
  }

  async function handleCopyItemLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Item link copied")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to copy item link"
      )
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <div className="flex min-h-10 shrink-0 items-center justify-between gap-1 border-b border-line-soft bg-surface px-3 py-2">
          <div className="flex items-center gap-1.5 text-[12px] text-fg-2">
            <SidebarTrigger className="size-5 shrink-0" />
            <span className="mr-2 font-mono text-[12px] text-fg-3">
              {currentItem.key}
            </span>
            <Link
              href={`/team/${team?.slug}/work`}
              className="text-fg-3 hover:text-foreground"
            >
              {team?.name}
            </Link>
            <CaretRight className="size-3 text-fg-4" />
            <span className="truncate">{currentItem.title}</span>
          </div>
          <div className="flex items-center gap-1">
            {editable ? (
              <>
                {otherDescriptionViewers.length > 0 ? (
                  <DocumentPresenceAvatarGroup
                    viewers={otherDescriptionViewers}
                    compact
                  />
                ) : null}
                {isMainEditing ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={savingMainSection}
                      onClick={handleCancelMainEdit}
                    >
                      {isCollaborationAttached ? "Close" : "Cancel"}
                    </Button>
                    <Button
                      size="sm"
                      disabled={!canSaveMainSection}
                      onClick={() => void handleSaveMainEdit()}
                    >
                      {savingMainSection
                        ? "Saving..."
                        : isCollaborationAttached
                          ? "Done"
                          : "Save"}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStartMainEdit}
                  >
                    Edit
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={deletingItem}
                    >
                      <DotsThree className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 min-w-44">
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={deletingItem}
                      onSelect={(event) => {
                        event.preventDefault()
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash className="size-4" />
                      Delete{" "}
                      {getDisplayLabelForWorkItemType(
                        currentItem.type,
                        team?.settings.experience
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : null}
            <Button
              size="icon-sm"
              variant="ghost"
              className={cn(!propertiesOpen && "text-muted-foreground")}
              onClick={() => setPropertiesOpen((current) => !current)}
            >
              <SidebarSimple className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-y-auto">
            <article className="mx-auto flex max-w-[60rem] flex-col px-10 pt-12 pb-24">
              {parentItem ? (
                <div className="mb-6">
                  <Link
                    href={`/items/${parentItem.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] text-fg-2 transition-colors hover:border-fg-4 hover:bg-surface-3 hover:text-foreground"
                  >
                    <span className="text-[10px] font-semibold tracking-[0.06em] text-fg-4 uppercase">
                      {workCopy.parentLabel}
                    </span>
                    <span className="font-mono text-[11px] text-fg-4">
                      {parentItem.key}
                    </span>
                    <span className="max-w-[20rem] truncate">
                      {parentItem.title}
                    </span>
                  </Link>
                </div>
              ) : null}

              <header className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] leading-none">
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-fg-3 uppercase">
                    <span
                      aria-hidden
                      className="inline-block size-1.5 rounded-full bg-fg-4"
                    />
                    <span>
                      {getDisplayLabelForWorkItemType(
                        currentItem.type,
                        team?.settings.experience
                      )}
                    </span>
                  </span>
                  <span aria-hidden className="text-fg-4">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-fg-2">
                    <StatusIcon status={currentItem.status} />
                    <span>{statusMeta[currentItem.status].label}</span>
                  </span>
                  {currentItem.priority !== "none" ? (
                    <>
                      <span aria-hidden className="text-fg-4">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-fg-2">
                        <PriorityIcon priority={currentItem.priority} />
                        <span>{priorityMeta[currentItem.priority].label}</span>
                      </span>
                    </>
                  ) : null}
                </div>
                {isMainEditing ? (
                  <Input
                    value={mainDraftTitle}
                    onChange={(event) => setMainDraftTitle(event.target.value)}
                    placeholder={`${getDisplayLabelForWorkItemType(
                      currentItem.type,
                      team?.settings.experience
                    )} title`}
                    className="h-auto border-none bg-transparent px-0 py-0 text-[28px] leading-[1.18] font-semibold tracking-[-0.018em] shadow-none focus-visible:ring-0 dark:bg-transparent"
                    autoFocus
                  />
                ) : (
                  <h1 className="text-[28px] leading-[1.18] font-semibold tracking-[-0.018em] text-foreground">
                    {currentItem.title}
                  </h1>
                )}
              </header>

              {mainDraftStale ? (
                <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      This item changed while you were editing
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Reload the latest title and description before saving your
                      draft.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReloadMainDraft}
                  >
                    Reload latest
                  </Button>
                </div>
              ) : null}
              {isMainEditing && concurrentEditorLabel ? (
                <div className="mt-5 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2.5">
                  <div className="text-sm font-medium">
                    {concurrentEditorLabel}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    You can keep editing, but you may need to reload before
                    saving if they update the item first.
                  </div>
                </div>
              ) : null}

              <section className="mt-7">
                {isMainEditing ? (
                  <div className="rounded-xl border border-line bg-surface px-4 py-3 transition-colors focus-within:border-fg-3">
                    <RichTextEditor
                      content={mainDraftDescription}
                      collaboration={collaboration ?? undefined}
                      currentPresenceUserId={currentUserId}
                      editable={editable && !isCollaborationBootstrapping}
                      placeholder="Add a description…"
                      presenceViewers={otherDescriptionViewers}
                      onActiveBlockChange={handleLegacyActiveBlockChange}
                      mentionCandidates={
                        team ? getTeamMembers(data, team.id) : data.users
                      }
                      onChange={(content) => {
                        setMainDraftDescription(content)

                        if (isCollaborationAttached) {
                          useAppStore
                            .getState()
                            .applyItemDescriptionCollaborationContent(
                              currentItem.id,
                              content
                            )
                          return
                        }

                        if (isCollaborationBootstrapping) {
                          return
                        }
                      }}
                      onUploadAttachment={(file) =>
                        useAppStore
                          .getState()
                          .uploadAttachment("workItem", currentItem.id, file)
                      }
                    />
                  </div>
                ) : isDescriptionPlaceholder(descriptionContent) ? (
                  editable ? (
                    <button
                      type="button"
                      onClick={handleStartMainEdit}
                      className="flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-left text-[13px] text-fg-4 transition-colors hover:border-fg-4 hover:bg-surface hover:text-fg-2"
                    >
                      <NotePencil className="size-3.5" />
                      <span>Add a description…</span>
                    </button>
                  ) : (
                    <p className="text-[13px] text-fg-4">No description yet.</p>
                  )
                ) : (
                  <RichTextContent
                    content={descriptionContent}
                    className="text-fg-1 text-[14px] leading-[1.65] [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-fg-2 [&_h1]:mt-5 [&_h1]:mb-2 [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:mt-4 [&_h3]:mb-1.5 [&_li]:mb-1 [&_ol]:my-2 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:my-2 [&_ul]:ml-5 [&_ul]:list-disc"
                  />
                )}
              </section>

              {showSubIssuesSection ? (
                <section className="mt-8 overflow-hidden rounded-xl border border-line bg-surface">
                  <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-[13px] font-semibold text-foreground transition-colors hover:text-fg-2"
                      onClick={() => setSubIssuesOpen((current) => !current)}
                    >
                      {subIssuesOpen ? (
                        <CaretDown className="size-3 text-fg-4" />
                      ) : (
                        <CaretRight className="size-3 text-fg-4" />
                      )}
                      <span>{childCopy.childPluralLabel}</span>
                    </button>
                    {childItems.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-fg-2 tabular-nums">
                        <span>
                          {childProgress.completedChildren}/
                          {childProgress.includedChildren > 0
                            ? childProgress.includedChildren
                            : childItems.length}
                        </span>
                        <span className="text-fg-4">·</span>
                        <span>{childProgress.percent}%</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-fg-4">None yet</span>
                    )}
                    {canCreateChildItem ? (
                      <Button
                        size="icon-sm"
                        variant={mainChildComposerOpen ? "outline" : "ghost"}
                        className="ml-auto"
                        onClick={() => {
                          setSubIssuesOpen(true)
                          setMainChildComposerOpen((current) => {
                            const next = !current
                            if (next) {
                              setSidebarChildComposerOpen(false)
                            }
                            return next
                          })
                        }}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>

                  {childItems.length > 0 ? (
                    <div className="mx-4 mb-3 h-[3px] overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-status-done transition-all"
                        style={{
                          width: `${childProgress.percent}%`,
                        }}
                      />
                    </div>
                  ) : null}

                  {subIssuesOpen ? (
                    <div className="border-t border-line-soft">
                      {childItems.length > 0 ? (
                        <ul className="flex flex-col divide-y divide-line-soft">
                          {childItems.map((child) => {
                            const childDone = child.status === "done"

                            return (
                              <li key={child.id}>
                                <Link
                                  href={`/items/${child.id}`}
                                  className="group/sub flex items-center gap-3 px-4 py-2 text-[12.5px] transition-colors hover:bg-surface-2"
                                >
                                  <StatusIcon status={child.status} />
                                  <span className="shrink-0 font-mono text-[11px] text-fg-4">
                                    {child.key}
                                  </span>
                                  <span
                                    className={cn(
                                      "min-w-0 flex-1 truncate",
                                      childDone &&
                                        "text-fg-3 line-through decoration-line"
                                    )}
                                  >
                                    {child.title}
                                  </span>
                                  {child.priority !== "none" ? (
                                    <span className="hidden shrink-0 items-center gap-1 text-[11px] text-fg-4 sm:inline-flex">
                                      <PriorityIcon priority={child.priority} />
                                      <span>
                                        {priorityMeta[child.priority].label}
                                      </span>
                                    </span>
                                  ) : null}
                                  {child.assigneeId ? (
                                    <WorkItemAssigneeAvatar
                                      user={getUser(data, child.assigneeId)}
                                      className="shrink-0"
                                    />
                                  ) : (
                                    <span className="size-5 shrink-0" />
                                  )}
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}

                      {mainChildComposerOpen ? (
                        <div className="border-t border-line-soft bg-background">
                          <InlineChildIssueComposer
                            teamId={currentItem.teamId}
                            parentItem={currentItem}
                            disabled={!editable}
                            onCancel={() => setMainChildComposerOpen(false)}
                            onCreated={() => setMainChildComposerOpen(false)}
                          />
                        </div>
                      ) : canCreateChildItem ? (
                        <button
                          type="button"
                          className={cn(
                            "inline-flex w-full items-center gap-2 px-4 py-2 text-[12px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground",
                            childItems.length > 0 && "border-t border-line-soft"
                          )}
                          onClick={() => {
                            setSidebarChildComposerOpen(false)
                            setMainChildComposerOpen(true)
                          }}
                        >
                          <Plus className="size-3" />
                          <span>{childCopy.addChildLabel}</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section className="mt-10">
                <div className="mb-5 flex items-center gap-2">
                  <h2 className="text-[10.5px] font-semibold tracking-[0.08em] text-fg-3 uppercase">
                    Activity
                  </h2>
                  <span aria-hidden className="h-px flex-1 bg-line-soft" />
                </div>
                <MainActivityTimeline
                  data={data}
                  item={currentItem}
                  currentUserId={currentUserId}
                  editable={editable}
                />
              </section>
            </article>
          </div>

          <CollapsibleRightSidebar
            open={propertiesOpen}
            width="26.25rem"
            className="border-l border-line bg-surface"
          >
            <div className="flex items-center gap-1 border-b border-line-soft px-3 py-2">
              <span className="mr-2 font-mono text-[12px] text-fg-3">
                {currentItem.key}
              </span>
              <span className="flex items-center gap-1.5 text-[12px] text-fg-2">
                <StatusIcon status={currentItem.status} />
                <span>{statusMeta[currentItem.status].label}</span>
              </span>
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  className={detailIconButtonClassName}
                  aria-label="Copy item link"
                  onClick={() => void handleCopyItemLink()}
                >
                  <LinkSimple className="size-[14px]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-[22px]">
              <h2 className="mb-2.5 text-[22px] leading-[1.25] font-semibold tracking-[-0.012em]">
                {sidebarTitle}
              </h2>

              {sidebarHasDescription ? (
                <RichTextContent
                  content={sidebarDescription}
                  className="text-[13.5px] leading-[1.6] text-fg-2 [&_li]:mb-1 [&_p]:mb-2.5 [&_p:last-child]:mb-0 [&_ul]:mb-2.5 [&_ul]:ml-[18px] [&_ul]:list-disc"
                />
              ) : (
                <p className="text-[13.5px] leading-[1.6] text-fg-4">
                  No description yet.
                </p>
              )}

              <dl className="mt-5 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12.5px]">
                <DetailSidebarSelectRow
                  label="Status"
                  icon={<StatusIcon status={currentItem.status} />}
                  value={currentItem.status}
                  disabled={!sidebarEditable}
                  options={statusOptions}
                  renderValue={(value, optionLabel) => (
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-grid size-3.5 shrink-0 place-items-center">
                        <StatusIcon status={value} />
                      </span>
                      <span className="truncate">{optionLabel}</span>
                    </div>
                  )}
                  renderOption={(value, optionLabel) => (
                    <div className="flex items-center gap-2">
                      <span className="inline-grid size-3.5 shrink-0 place-items-center">
                        <StatusIcon status={value} />
                      </span>
                      <span>{optionLabel}</span>
                    </div>
                  )}
                  onValueChange={(value) =>
                    useAppStore.getState().updateWorkItem(currentItem.id, {
                      status: value as WorkItem["status"],
                    })
                  }
                />
                <DetailSidebarSelectRow
                  label="Priority"
                  icon={<Flag className="size-[13px]" />}
                  value={currentItem.priority}
                  disabled={!sidebarEditable}
                  options={Object.entries(priorityMeta).map(
                    ([value, meta]) => ({
                      value,
                      label: meta.label,
                    })
                  )}
                  renderValue={(value, optionLabel) => (
                    <div className="flex min-w-0 items-center gap-2">
                      <PriorityIcon priority={value as Priority} />
                      <span className="truncate">{optionLabel}</span>
                    </div>
                  )}
                  renderOption={(value, optionLabel) => (
                    <div className="flex items-center gap-2">
                      <PriorityIcon priority={value as Priority} />
                      <span>{optionLabel}</span>
                    </div>
                  )}
                  onValueChange={(value) =>
                    useAppStore.getState().updateWorkItem(currentItem.id, {
                      priority: value as Priority,
                    })
                  }
                />
                <DetailSidebarSelectRow
                  label="Assignee"
                  icon={<Plus className="size-[13px]" />}
                  value={currentItem.assigneeId ?? "unassigned"}
                  disabled={!sidebarEditable}
                  options={[
                    { value: "unassigned", label: "Assign" },
                    ...teamMembers.map((user) => ({
                      value: user.id,
                      label: user.name,
                    })),
                  ]}
                  renderValue={(value, optionLabel) => {
                    if (value === "unassigned") {
                      return <span className="truncate">{optionLabel}</span>
                    }

                    const selectedUser =
                      teamMembers.find((user) => user.id === value) ?? null

                    return selectedUser ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <WorkItemAssigneeAvatar
                          user={selectedUser}
                          className="data-[size=sm]:size-4"
                        />
                        <span className="truncate">{selectedUser.name}</span>
                      </div>
                    ) : (
                      <span className="truncate">{optionLabel}</span>
                    )
                  }}
                  renderOption={(value, optionLabel) => {
                    if (value === "unassigned") {
                      return <span>{optionLabel}</span>
                    }

                    const optionUser =
                      teamMembers.find((user) => user.id === value) ?? null

                    return optionUser ? (
                      <div className="flex items-center gap-2">
                        <WorkItemAssigneeAvatar
                          user={optionUser}
                          className="data-[size=sm]:size-4"
                        />
                        <span>{optionUser.name}</span>
                      </div>
                    ) : (
                      <span>{optionLabel}</span>
                    )
                  }}
                  onValueChange={(value) =>
                    useAppStore.getState().updateWorkItem(currentItem.id, {
                      assigneeId: value === "unassigned" ? null : value,
                    })
                  }
                />
                <DetailSidebarDateRow
                  label="Start"
                  icon={<Clock className="size-[13px]" />}
                  value={currentItem.startDate}
                  disabled={!sidebarEditable}
                  onValueChange={handleStartDateChange}
                />
                <DetailSidebarDateRow
                  label="Due"
                  icon={<CalendarBlank className="size-[13px]" />}
                  value={displayedEndDate}
                  disabled={!sidebarEditable}
                  onValueChange={handleEndDateChange}
                />
                <DetailSidebarLabelsRow
                  item={currentItem}
                  workspaceId={team?.workspaceId}
                  labels={availableLabels}
                  editable={sidebarEditable}
                />
                <DetailSidebarSelectRow
                  label="Project"
                  icon={<FolderSimple className="size-[13px]" />}
                  value={currentItem.primaryProjectId ?? "none"}
                  disabled={!sidebarEditable}
                  options={[
                    { value: "none", label: "No project" },
                    ...teamProjects.map((project) => ({
                      value: project.id,
                      label: project.name,
                    })),
                  ]}
                  renderValue={(value, optionLabel) =>
                    value === "none" ? (
                      <span className="truncate text-fg-4">{optionLabel}</span>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-block size-1.5 rounded-full bg-fg-3" />
                        <span className="truncate">{optionLabel}</span>
                      </div>
                    )
                  }
                  onValueChange={handleProjectChange}
                />
                {selectedMilestone ? (
                  <DetailSidebarStaticRow
                    label="Milestone"
                    icon={<Flag className="size-[13px]" />}
                  >
                    <span className="truncate">{selectedMilestone.name}</span>
                    {selectedMilestone.targetDate ? (
                      <span className="text-fg-4">
                        · {format(new Date(selectedMilestone.targetDate), "MMM d")}
                      </span>
                    ) : null}
                  </DetailSidebarStaticRow>
                ) : null}
                {currentItem.parentId || parentOptions.length > 1 ? (
                  <DetailSidebarSelectRow
                    label="Parent"
                    icon={<FolderSimple className="size-[13px]" />}
                    value={currentItem.parentId ?? "none"}
                    disabled={!sidebarEditable}
                    options={parentOptions}
                    renderValue={(value, optionLabel) =>
                      value === "none" ? (
                        <span className="truncate text-fg-4">{optionLabel}</span>
                      ) : (
                        <span className="truncate">{optionLabel}</span>
                      )
                    }
                    onValueChange={(value) =>
                      useAppStore.getState().updateWorkItem(currentItem.id, {
                        parentId: value === "none" ? null : value,
                      })
                    }
                  />
                ) : null}
              </dl>

              <DetailSidebarSection
                title="Subtasks"
                count={`${childProgress.completedChildren} of ${childItems.length || 0}`}
                action={
                  canCreateChildItem ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                      onClick={() =>
                        setSidebarChildComposerOpen((current) => {
                          const next = !current
                          if (next) {
                            setMainChildComposerOpen(false)
                          }
                          return next
                        })
                      }
                    >
                      <Plus className="size-3" />
                      {childCopy.addChildLabel}
                    </button>
                  ) : null
                }
              >
                <div className="flex flex-col gap-1">
                  {childItems.length > 0 ? (
                    <div className="mb-2 px-2">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-fg-3 tabular-nums">
                        <span className="text-fg-4">
                          {childProgress.includedChildren > 0
                            ? `${childProgress.completedChildren}/${childProgress.includedChildren} active`
                            : `${childProgress.completedChildren}/${childItems.length}`}
                        </span>
                        <span>{childProgress.percent}%</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-status-done transition-all"
                          style={{
                            width: `${childProgress.percent}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                  {childItems.map((child) => (
                    <Link
                      key={child.id}
                      href={`/items/${child.id}`}
                      className="grid grid-cols-[16px_80px_minmax(0,1fr)] items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-surface-2"
                    >
                      <StatusIcon status={child.status} />
                      <span className="font-mono text-[11.5px] text-fg-3">
                        {child.key}
                      </span>
                      <span
                        className={cn(
                          "truncate",
                          child.status === "done" && "text-fg-3 line-through"
                        )}
                      >
                        {child.title}
                      </span>
                    </Link>
                  ))}
                  {sidebarChildComposerOpen ? (
                    <div className="mt-1 rounded-md border border-line">
                      <InlineChildIssueComposer
                        teamId={currentItem.teamId}
                        parentItem={currentItem}
                        disabled={!editable}
                        onCancel={() => setSidebarChildComposerOpen(false)}
                        onCreated={() => setSidebarChildComposerOpen(false)}
                      />
                    </div>
                  ) : null}
                </div>
              </DetailSidebarSection>

              {linkedProjects.length > 0 ||
              linkedDocuments.length > 0 ||
              selectedProject ? (
                <DetailSidebarSection title="Relations">
                  <div className="flex flex-col gap-1.5">
                    {selectedProject ? (
                      <Link
                        href={
                          getProjectHref(data, selectedProject) ??
                          `/projects/${selectedProject.id}`
                        }
                        className={cn(
                          detailChipClassName,
                          "w-fit hover:bg-surface-3"
                        )}
                      >
                        <FolderSimple className="size-3" />
                        <span>Project</span>
                        <b className="font-medium text-foreground">
                          {selectedProject.name}
                        </b>
                      </Link>
                    ) : null}
                    {linkedProjects.map((project) => (
                      <Link
                        key={project.id}
                        href={
                          getProjectHref(data, project) ??
                          `/projects/${project.id}`
                        }
                        className={cn(
                          detailChipClassName,
                          "w-fit hover:bg-surface-3"
                        )}
                      >
                        <FolderSimple className="size-3" />
                        <span>Linked project</span>
                        <b className="font-medium text-foreground">
                          {project.name}
                        </b>
                      </Link>
                    ))}
                    {linkedDocuments.map((document) => (
                      <Link
                        key={document.id}
                        href={`/docs/${document.id}`}
                        className={cn(
                          detailChipClassName,
                          "w-fit hover:bg-surface-3"
                        )}
                      >
                        <LinkSimple className="size-3" />
                        <span>Linked doc</span>
                        <b className="font-medium text-foreground">
                          {document.title}
                        </b>
                      </Link>
                    ))}
                  </div>
                </DetailSidebarSection>
              ) : null}

              <DetailSidebarSection title="Activity">
                <DetailSidebarActivity
                  data={data}
                  currentUserId={currentUserId}
                  item={currentItem}
                  editable={editable}
                />
              </DetailSidebarSection>
            </div>
          </CollapsibleRightSidebar>
        </div>
      </div>
      <ConfirmDialog
        open={projectConfirmOpen}
        onOpenChange={handleProjectConfirmOpenChange}
        title="Update project for hierarchy"
        description="Changing the project for this item will also update all parent and child items in this hierarchy."
        confirmLabel="Update"
        variant="default"
        onConfirm={handleConfirmProjectChange}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete item"
        description={`${cascadeMessage} This can't be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deletingItem}
        onConfirm={() => void handleDeleteItem()}
      />
    </>
  )
}

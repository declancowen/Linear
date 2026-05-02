"use client"

import type { Editor } from "@tiptap/react"
import { format, formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
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
import { useInitialCollaborationSyncPreview } from "@/hooks/use-initial-collaboration-sync-preview"
import {
  fetchWorkItemDetailReadModel,
  syncClearWorkItemPresence,
  syncHeartbeatWorkItemPresence,
  syncSendItemDescriptionMentionNotifications,
} from "@/lib/convex/client"
import { RouteMutationError } from "@/lib/convex/client/shared"
import { createMissingScopedReadModelResult } from "@/lib/convex/client/read-models"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import {
  commentContentConstraints,
  getTextInputLimitState,
  labelNameConstraints,
  workItemTitleConstraints,
} from "@/lib/domain/input-constraints"
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
  type Document as AppDocument,
  type DocumentPresenceViewer,
  type Milestone,
  type Priority,
  type Project,
  type Team,
  type UserProfile,
  type WorkItem,
} from "@/lib/domain/types"
import { RichTextContent } from "@/components/app/rich-text-content"
import { useAppStore } from "@/lib/store/app-store"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { ShortcutKeys } from "@/components/app/shortcut-keys"
import { UserAvatar } from "@/components/app/user-presence"
import { Button } from "@/components/ui/button"
import { CollapsibleRightSidebar } from "@/components/ui/collapsible-right-sidebar"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { InlineWorkItemPropertyControl } from "./work-item-inline-property-control"
import {
  getEligibleParentWorkItems,
  getTeamProjectOptions,
  getWorkItemPresenceSessionId,
  selectAppDataSnapshot,
} from "./helpers"
import {
  LabelColorDot,
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
import { useWorkItemProjectCascadeConfirmation } from "./use-work-item-project-cascade-confirmation"
import { formatWorkItemDetailDate } from "./date-presentation"
import { cn } from "@/lib/utils"

const WORK_ITEM_PRESENCE_HEARTBEAT_INTERVAL_MS = 15 * 1000
const WORK_ITEM_PRESENCE_BLOCK_CHANGE_DELAY_MS = 250
const ITEM_DESCRIPTION_SYNC_MODAL_SEEN_STORAGE_PREFIX =
  "linear:collaboration:item-description-sync-modal-seen:"
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
  const labelNameLimitState = getTextInputLimitState(
    newLabelName,
    labelNameConstraints
  )
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
    if (
      !workspaceId ||
      newLabelName.trim().length === 0 ||
      !labelNameLimitState.canSubmit
    ) {
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
                      <LabelColorDot color={label.color} className="size-1.5" />
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
                          <LabelColorDot
                            color={label.color}
                            className="size-1.5"
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
                    maxLength={labelNameConstraints.max}
                    disabled={!editable || !workspaceId}
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    disabled={
                      !editable ||
                      !workspaceId ||
                      newLabelName.trim().length === 0 ||
                      !labelNameLimitState.canSubmit
                    }
                    onClick={() => void handleCreateLabel()}
                  >
                    Create
                  </Button>
                </div>
                {newLabelName.length > 0 ? (
                  <FieldCharacterLimit
                    state={labelNameLimitState}
                    limit={labelNameConstraints.max}
                    className="mt-0"
                  />
                ) : null}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </dd>
    </>
  )
}

function DetailChildWorkItemRow({
  data,
  item,
  variant = "main",
}: {
  data: AppData
  item: WorkItem
  variant?: "main" | "sidebar"
}) {
  const childDone = item.status === "done"
  const showMainPriority = item.priority !== "none"
  const showMainAssignee = item.assigneeId !== null
  const showMainProject = item.primaryProjectId !== null
  const showProperties = variant !== "sidebar"

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2",
        variant === "sidebar" ? "gap-y-1.5" : "gap-y-2"
      )}
    >
      <Link
        href={`/items/${item.id}`}
        className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
      >
        <span className="font-mono text-[11.5px] text-fg-3">{item.key}</span>
        <span
          className={cn(
            "truncate text-[12.5px]",
            childDone && "text-fg-3 line-through decoration-line"
          )}
        >
          {item.title}
        </span>
      </Link>
      {showProperties ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <InlineWorkItemPropertyControl
            data={data}
            item={item}
            property="status"
            variant="child"
          />
          {showMainPriority ? (
            <InlineWorkItemPropertyControl
              data={data}
              item={item}
              property="priority"
              variant="child"
            />
          ) : null}
          {showMainAssignee ? (
            <InlineWorkItemPropertyControl
              data={data}
              item={item}
              property="assignee"
              variant="child"
            />
          ) : null}
          {showMainProject ? (
            <InlineWorkItemPropertyControl
              data={data}
              item={item}
              property="project"
              variant="child"
            />
          ) : null}
        </div>
      ) : null}
    </div>
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
  const commentLimitState = getTextInputLimitState(
    content,
    commentContentConstraints,
    {
      plainText: true,
    }
  )
  const mentionCandidates = getTeamMembers(data, item.teamId).filter(
    (candidate) => candidate.id !== currentUserId
  )

  function handleComment() {
    if (!commentLimitState.canSubmit) {
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
          minPlainTextCharacters={commentContentConstraints.min}
          maxPlainTextCharacters={commentContentConstraints.max}
          enforcePlainTextLimit
          onSubmitShortcut={handleComment}
          submitOnEnter
          className="[&_.ProseMirror]:min-h-[3rem] [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-[1.55]"
        />
        <div className="mt-1.5 border-t border-dashed border-line pt-1.5">
          <FieldCharacterLimit
            state={commentLimitState}
            limit={commentContentConstraints.max}
            className="mt-0 mb-1.5"
          />
          <div className="flex items-center justify-end gap-2">
            <ShortcutKeys
              keys={["Enter"]}
              keyClassName="h-[18px] min-w-0 rounded-[4px] border-line bg-surface-2 px-1 text-[10.5px] text-fg-3 shadow-none"
            />
            <Button
              size="sm"
              disabled={!editable || !commentLimitState.canSubmit}
              onClick={handleComment}
            >
              <PaperPlaneTilt className="size-3.5" />
              Comment
            </Button>
          </div>
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
  const replyLimitState = getTextInputLimitState(
    replyContent,
    commentContentConstraints,
    {
      plainText: true,
    }
  )

  function handleReply() {
    if (!replyLimitState.canSubmit) {
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
                minPlainTextCharacters={commentContentConstraints.min}
                maxPlainTextCharacters={commentContentConstraints.max}
                enforcePlainTextLimit
                onSubmitShortcut={handleReply}
                submitOnEnter
                className="[&_.ProseMirror]:min-h-[2.5rem] [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-[1.55]"
              />
            </div>
            <div className="border-t border-dashed border-line px-3 py-1.5">
              <FieldCharacterLimit
                state={replyLimitState}
                limit={commentContentConstraints.max}
                className="mt-0 mb-1.5"
              />
              <div className="flex items-center justify-between gap-2">
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
                  <Button
                    size="sm"
                    disabled={!replyLimitState.canSubmit}
                    onClick={handleReply}
                  >
                    Reply
                  </Button>
                </div>
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
  const commentLimitState = getTextInputLimitState(
    content,
    commentContentConstraints,
    {
      plainText: true,
    }
  )

  function handleComment() {
    if (!commentLimitState.canSubmit) {
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
              minPlainTextCharacters={commentContentConstraints.min}
              maxPlainTextCharacters={commentContentConstraints.max}
              enforcePlainTextLimit
              onSubmitShortcut={handleComment}
              submitOnEnter
              className="[&_.ProseMirror]:min-h-[3rem] [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-[1.55]"
            />
          </div>
          <div className="border-t border-dashed border-line px-3 py-1.5">
            <FieldCharacterLimit
              state={commentLimitState}
              limit={commentContentConstraints.max}
              className="mt-0 mb-1.5"
            />
            <div className="flex items-center justify-between gap-2">
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
                  disabled={!editable || !commentLimitState.canSubmit}
                  onClick={handleComment}
                >
                  <PaperPlaneTilt className="size-3.5" />
                  Comment
                </Button>
              </div>
            </div>
          </div>
        </div>
      </MainActivityThreadItem>
    </ol>
  )
}

type WorkItemCollaborationLifecycle = ReturnType<
  typeof useDocumentCollaboration
>["lifecycle"]

type StableCollaborationUser = {
  id: string
  name: string
  avatarUrl?: string | null
  avatarImageUrl?: string | null
}

type DetailSelectOption = { value: string; label: string }
type DetailTextLimitState = ReturnType<typeof getTextInputLimitState>
type DetailChildProgress = ReturnType<typeof getWorkItemChildProgress>
type DetailChildCopy = ReturnType<typeof getChildWorkItemCopy>
type DetailWorkCopy = ReturnType<typeof getWorkSurfaceCopy>
type DetailCollaborationState = ReturnType<typeof useDocumentCollaboration>
type DetailBootstrapContent = DetailCollaborationState["bootstrapContent"]
type DetailEditorCollaboration = DetailCollaborationState["editorCollaboration"]
type DetailCollaborationBinding = DetailCollaborationState["collaboration"]
type DetailUploadAttachmentHandler = NonNullable<
  ComponentProps<typeof RichTextEditor>["onUploadAttachment"]
>
type DetailFlushCollaboration = DetailCollaborationState["flush"]
type DetailRouter = ReturnType<typeof useRouter>
type DetailRequestWorkItemUpdate = ReturnType<
  typeof useWorkItemProjectCascadeConfirmation
>["requestUpdate"]
type DetailMainMentionRetryEntries = Record<string, PendingDocumentMention[]>
type DetailSetMainMentionRetryEntries = Dispatch<
  SetStateAction<DetailMainMentionRetryEntries>
>

function getMissingWorkItemDetailContent({
  deletingItem,
  hasLoadedWorkItemReadModel,
}: {
  deletingItem: boolean
  hasLoadedWorkItemReadModel: boolean
}) {
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

function getActiveDescriptionViewers({
  hasLiveDescriptionPresence,
  collaborationViewers,
  currentUser,
  legacyActiveBlockId,
  workItemPresenceViewers,
}: {
  hasLiveDescriptionPresence: boolean
  collaborationViewers: DocumentPresenceViewer[]
  currentUser: UserProfile | null
  legacyActiveBlockId: string | null
  workItemPresenceViewers: DocumentPresenceViewer[]
}) {
  if (hasLiveDescriptionPresence) {
    return collaborationViewers
  }

  if (!currentUser) {
    return workItemPresenceViewers
  }

  return [
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
}

function getSelectedWorkItemProject(data: AppData, currentItem: WorkItem) {
  if (!currentItem.primaryProjectId) {
    return null
  }

  return (
    data.projects.find(
      (project) => project.id === currentItem.primaryProjectId
    ) ?? null
  )
}

function getSelectedWorkItemMilestone(data: AppData, currentItem: WorkItem) {
  if (!currentItem.milestoneId) {
    return null
  }

  return (
    data.milestones.find(
      (milestone) => milestone.id === currentItem.milestoneId
    ) ?? null
  )
}

function getAvailableWorkItemLabels(data: AppData, team: Team | null) {
  if (!team) {
    return []
  }

  return [...getLabelsForTeamScope(data, team.id)].sort((left, right) =>
    left.name.localeCompare(right.name)
  )
}

function getWorkItemParentOptions(data: AppData, currentItem: WorkItem) {
  return [
    { value: "none", label: "No parent" },
    ...getEligibleParentWorkItems(data, currentItem).map((candidate) => ({
      value: candidate.id,
      label: `${candidate.key} · ${candidate.title}`,
    })),
  ]
}

function getLinkedWorkItemProjects(data: AppData, currentItem: WorkItem) {
  return currentItem.linkedProjectIds
    .map(
      (projectId) =>
        data.projects.find((project) => project.id === projectId) ?? null
    )
    .filter(
      (project): project is NonNullable<typeof project> => project !== null
    )
}

function getLinkedWorkItemDocuments(data: AppData, currentItem: WorkItem) {
  return currentItem.linkedDocumentIds
    .map((documentId) => getDocument(data, documentId))
    .filter(
      (document): document is NonNullable<typeof document> => document !== null
    )
}

function getWorkItemDeleteCascadeMessage({
  data,
  currentItem,
  team,
}: {
  data: AppData
  currentItem: WorkItem
  team: Team | null
}) {
  const descendantCount = getWorkItemDescendantIds(data, currentItem.id).size
  const itemLabel = getDisplayLabelForWorkItemType(
    currentItem.type,
    team?.settings.experience
  ).toLowerCase()

  if (descendantCount === 0) {
    return `Delete this ${itemLabel}?`
  }

  return `Delete this ${itemLabel} and ${descendantCount} nested item${
    descendantCount === 1 ? "" : "s"
  }?`
}

function getWorkItemSidebarTitle({
  currentItem,
  mainSection,
}: {
  currentItem: WorkItem
  mainSection: ReturnType<typeof useWorkItemMainSectionController>
}) {
  return mainSection.isMainEditing &&
    mainSection.mainDraftTitle.trim().length > 0
    ? mainSection.mainDraftTitle
    : currentItem.title
}

function getWorkItemDetailModel({
  currentItem,
  data,
  editable,
  mainSection,
  team,
}: {
  currentItem: WorkItem
  data: AppData
  editable: boolean
  mainSection: ReturnType<typeof useWorkItemMainSectionController>
  team: Team | null
}) {
  const teamExperience = team?.settings.experience
  const teamMembers = team ? getTeamMembers(data, team.id) : []
  const allowedChildTypes = getAllowedChildWorkItemTypesForItem(currentItem)

  return {
    availableLabels: getAvailableWorkItemLabels(data, team),
    canCreateChildItem: editable && allowedChildTypes.length > 0,
    cascadeMessage: getWorkItemDeleteCascadeMessage({
      data,
      currentItem,
      team,
    }),
    childCopy: getChildWorkItemCopy(currentItem.type, teamExperience),
    childItems: sortItems(
      getDirectChildWorkItems(data, currentItem.id),
      "priority"
    ),
    childProgress: getWorkItemChildProgress(data, currentItem.id),
    displayedEndDate: currentItem.targetDate ?? currentItem.dueDate,
    linkedDocuments: getLinkedWorkItemDocuments(data, currentItem),
    linkedProjects: getLinkedWorkItemProjects(data, currentItem),
    mentionCandidates: team ? teamMembers : data.users,
    parentItem: currentItem.parentId
      ? getWorkItem(data, currentItem.parentId)
      : null,
    parentOptions: getWorkItemParentOptions(data, currentItem),
    selectedMilestone: getSelectedWorkItemMilestone(data, currentItem),
    selectedProject: getSelectedWorkItemProject(data, currentItem),
    sidebarEditable: editable,
    sidebarTitle: getWorkItemSidebarTitle({ currentItem, mainSection }),
    statusOptions: buildPropertyStatusOptions(getStatusOrderForTeam(team)),
    teamMembers,
    teamProjects: getTeamProjectOptions(
      data,
      team?.id,
      currentItem.primaryProjectId
    ),
    workCopy: getWorkSurfaceCopy(teamExperience),
  }
}

function buildWorkItemEndDatePatch(
  currentItem: WorkItem,
  nextEndDate: string | null
) {
  return {
    dueDate: currentItem.dueDate ? nextEndDate : undefined,
    targetDate:
      currentItem.targetDate || !currentItem.dueDate ? nextEndDate : undefined,
  }
}

function updateWorkItemStartDate({
  currentItem,
  displayedEndDate,
  nextStartDate,
}: {
  currentItem: WorkItem
  displayedEndDate: string | null
  nextStartDate: string | null
}) {
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
    Object.assign(patch, buildWorkItemEndDatePatch(currentItem, nextStartDate))
  }

  useAppStore.getState().updateWorkItem(currentItem.id, patch)
}

function updateWorkItemEndDate({
  currentItem,
  nextEndDate,
}: {
  currentItem: WorkItem
  nextEndDate: string | null
}) {
  const patch: {
    startDate?: string | null
    dueDate?: string | null
    targetDate?: string | null
  } = buildWorkItemEndDatePatch(currentItem, nextEndDate)

  if (
    nextEndDate &&
    currentItem.startDate &&
    new Date(nextEndDate).getTime() < new Date(currentItem.startDate).getTime()
  ) {
    patch.startDate = nextEndDate
  }

  useAppStore.getState().updateWorkItem(currentItem.id, patch)
}

function requestWorkItemProjectChange({
  currentItem,
  requestConfirmedWorkItemUpdate,
  value,
}: {
  currentItem: WorkItem
  requestConfirmedWorkItemUpdate: DetailRequestWorkItemUpdate
  value: string
}) {
  const nextProjectId = value === "none" ? null : value

  if (nextProjectId === currentItem.primaryProjectId) {
    return
  }

  requestConfirmedWorkItemUpdate(currentItem.id, {
    primaryProjectId: nextProjectId,
  })
}

function requestWorkItemParentChange({
  currentItem,
  requestConfirmedWorkItemUpdate,
  value,
}: {
  currentItem: WorkItem
  requestConfirmedWorkItemUpdate: DetailRequestWorkItemUpdate
  value: string
}) {
  const nextParentId = value === "none" ? null : value

  if (nextParentId === currentItem.parentId) {
    return
  }

  requestConfirmedWorkItemUpdate(currentItem.id, {
    parentId: nextParentId,
  })
}

async function deleteWorkItemAndNavigate({
  currentItem,
  router,
  setDeleteDialogOpen,
  setDeletingItem,
  team,
}: {
  currentItem: WorkItem
  router: DetailRouter
  setDeleteDialogOpen: Dispatch<SetStateAction<boolean>>
  setDeletingItem: Dispatch<SetStateAction<boolean>>
  team: Team | null
}) {
  setDeletingItem(true)

  const deleted = await useAppStore.getState().deleteWorkItem(currentItem.id)

  if (!deleted) {
    setDeletingItem(false)
    return
  }

  setDeleteDialogOpen(false)
  router.replace(team?.slug ? `/team/${team.slug}/work` : "/inbox")
}

async function copyCurrentItemLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    toast.success("Item link copied")
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Failed to copy item link"
    )
  }
}

function useStableCollaborationUser(
  currentUser: UserProfile | null,
  currentUserId: string
) {
  const stableCollaborationUserRef = useRef<StableCollaborationUser | null>(
    null
  )

  useEffect(() => {
    if (!currentUser) {
      return
    }

    stableCollaborationUserRef.current = {
      id: currentUserId,
      name: currentUser.name,
      avatarUrl: currentUser.avatarUrl,
      avatarImageUrl: currentUser.avatarImageUrl ?? null,
    }
  }, [currentUser, currentUserId])

  // eslint-disable-next-line react-hooks/refs -- keep the last user available while auth state refreshes.
  return currentUser ?? stableCollaborationUserRef.current ?? null
}

function useStableDescriptionDocumentId(
  itemId: string,
  activeDescriptionDocumentId: string | null
) {
  const [stableDescriptionDocumentId, setStableDescriptionDocumentId] =
    useState<string | null>(null)
  const previousItemIdRef = useRef(itemId)

  useEffect(() => {
    if (previousItemIdRef.current === itemId) {
      return
    }

    previousItemIdRef.current = itemId
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route changes must discard the previous collaboration document.
    setStableDescriptionDocumentId(null)
  }, [itemId])

  useEffect(() => {
    if (!activeDescriptionDocumentId) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- promote the loaded document id into a stable collaboration target.
    setStableDescriptionDocumentId(activeDescriptionDocumentId)
  }, [activeDescriptionDocumentId])

  return stableDescriptionDocumentId
}

function useLegacyWorkItemPresence({
  activeItemId,
  currentUserId,
  collaborationLifecycle,
  isEditingCurrentItem,
}: {
  activeItemId: string | null
  currentUserId: string
  collaborationLifecycle: WorkItemCollaborationLifecycle
  isEditingCurrentItem: boolean
}) {
  const [workItemPresenceViewers, setWorkItemPresenceViewers] = useState<
    DocumentPresenceViewer[]
  >([])
  const [legacyActiveBlockId, setLegacyActiveBlockId] = useState<string | null>(
    null
  )
  const legacyActiveBlockIdRef = useRef<string | null>(null)
  const sendLegacyPresenceRef = useRef<(() => void) | null>(null)
  const hasLiveDescriptionPresence = collaborationLifecycle === "attached"

  useEffect(() => {
    if (!activeItemId) {
      sendLegacyPresenceRef.current = null
      setWorkItemPresenceViewers([])
      setLegacyActiveBlockId(null)
      legacyActiveBlockIdRef.current = null
      return
    }

    if (
      collaborationLifecycle === "bootstrapping" ||
      collaborationLifecycle === "attached"
    ) {
      sendLegacyPresenceRef.current = null
      setWorkItemPresenceViewers([])
      return
    }

    let cancelled = false
    let presenceActive = window.document.visibilityState === "visible"
    let heartbeatTimeoutId: number | null = null
    const activeItemIdValue = activeItemId
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
          activeItemIdValue,
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

      void syncClearWorkItemPresence(activeItemIdValue, sessionId, {
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
      void syncClearWorkItemPresence(activeItemIdValue, sessionId, {
        keepalive: true,
      }).catch(() => {})
    }
  }, [activeItemId, collaborationLifecycle, currentUserId])

  const handleLegacyActiveBlockChange = useCallback(
    (activeBlockId: string | null) => {
      legacyActiveBlockIdRef.current = activeBlockId
      setLegacyActiveBlockId(activeBlockId)
    },
    []
  )

  useEffect(() => {
    if (hasLiveDescriptionPresence || !activeItemId || !isEditingCurrentItem) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      sendLegacyPresenceRef.current?.()
    }, WORK_ITEM_PRESENCE_BLOCK_CHANGE_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    activeItemId,
    hasLiveDescriptionPresence,
    isEditingCurrentItem,
    legacyActiveBlockId,
  ])

  return {
    handleLegacyActiveBlockChange,
    legacyActiveBlockId,
    workItemPresenceViewers,
  }
}

function clearMainPendingMentionRetryEntries(
  setEntries: DetailSetMainMentionRetryEntries,
  itemId: string
) {
  setEntries((current) => {
    if (!(itemId in current)) {
      return current
    }

    const next = { ...current }
    delete next[itemId]
    return next
  })
}

async function persistWorkItemMainSection({
  currentItem,
  flushCollaboration,
  isCollaborationAttached,
  mainDraftDescription,
  mainDraftUpdatedAt,
  mainTitleDirty,
  normalizedMainDraftTitle,
}: {
  currentItem: WorkItem
  flushCollaboration: DetailFlushCollaboration
  isCollaborationAttached: boolean
  mainDraftDescription: string
  mainDraftUpdatedAt: string | null
  mainTitleDirty: boolean
  normalizedMainDraftTitle: string
}) {
  if (isCollaborationAttached) {
    try {
      await flushCollaboration({
        kind: "work-item-main",
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
      return false
    }

    return true
  }

  return useAppStore.getState().saveWorkItemMainSection({
    itemId: currentItem.id,
    title: normalizedMainDraftTitle,
    description: mainDraftDescription,
    expectedUpdatedAt: mainDraftUpdatedAt ?? currentItem.updatedAt,
  })
}

async function deliverWorkItemMainMentionNotifications({
  pendingMentionEntries,
  savedItemId,
  setPendingMentionRetryEntriesByItemId,
}: {
  pendingMentionEntries: PendingDocumentMention[]
  savedItemId: string
  setPendingMentionRetryEntriesByItemId: DetailSetMainMentionRetryEntries
}) {
  if (pendingMentionEntries.length === 0) {
    clearMainPendingMentionRetryEntries(
      setPendingMentionRetryEntriesByItemId,
      savedItemId
    )
    return
  }

  try {
    const result = await syncSendItemDescriptionMentionNotifications(
      savedItemId,
      pendingMentionEntries
    )

    clearMainPendingMentionRetryEntries(
      setPendingMentionRetryEntriesByItemId,
      savedItemId
    )

    toast.success(
      `Saved changes and notified ${result.recipientCount} ${result.recipientCount === 1 ? "person" : "people"}.`
    )
  } catch (error) {
    if (isAlreadyDeliveredMentionConflict(error)) {
      clearMainPendingMentionRetryEntries(
        setPendingMentionRetryEntriesByItemId,
        savedItemId
      )
      toast.success("Saved changes and delivered mention notifications.")
      return
    }

    setPendingMentionRetryEntriesByItemId((current) => ({
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

function getIsMainSectionEditing({
  currentItem,
  mainDraftItemId,
  mainEditing,
}: {
  currentItem: WorkItem | undefined
  mainDraftItemId: string | null
  mainEditing: boolean
}) {
  return (
    currentItem !== undefined &&
    mainEditing &&
    mainDraftItemId === currentItem.id
  )
}

function getPendingMainMentionEntries({
  currentItem,
  descriptionContent,
  isMainEditing,
  mainDraftDescription,
  pendingMentionRetryEntriesByItemId,
}: {
  currentItem: WorkItem | undefined
  descriptionContent: string
  isMainEditing: boolean
  mainDraftDescription: string
  pendingMentionRetryEntriesByItemId: DetailMainMentionRetryEntries
}) {
  if (!currentItem || !isMainEditing) {
    return []
  }

  const activeRetryEntries = filterPendingDocumentMentionsByContent(
    pendingMentionRetryEntriesByItemId[currentItem.id] ?? [],
    mainDraftDescription
  )

  return mergePendingDocumentMentions(
    activeRetryEntries,
    getPendingRichTextMentionEntries(descriptionContent, mainDraftDescription)
  )
}

function getMainSectionDraftState({
  currentItem,
  descriptionContent,
  isCollaborationAttached,
  isMainEditing,
  mainDraftDescription,
  mainDraftTitle,
  mainDraftUpdatedAt,
}: {
  currentItem: WorkItem | undefined
  descriptionContent: string
  isCollaborationAttached: boolean
  isMainEditing: boolean
  mainDraftDescription: string
  mainDraftTitle: string
  mainDraftUpdatedAt: string | null
}) {
  const normalizedTitle = mainDraftTitle.trim()
  const titleDirty = Boolean(
    currentItem && isMainEditing && normalizedTitle !== currentItem.title
  )
  const descriptionDirty =
    isMainEditing && mainDraftDescription !== descriptionContent
  const stale = Boolean(
    currentItem &&
    !isCollaborationAttached &&
    isMainEditing &&
    mainDraftUpdatedAt &&
    mainDraftUpdatedAt !== currentItem.updatedAt
  )

  return {
    descriptionDirty,
    dirty: titleDirty || descriptionDirty,
    normalizedTitle,
    stale,
    titleDirty,
  }
}

function getCanSaveMainSection({
  currentItem,
  draftDirty,
  isAwaitingCollaboration,
  isCollaborationAttached,
  isMainEditing,
  mainDraftStale,
  mainTitleCanSubmit,
  pendingMentionCount,
  savingMainSection,
}: {
  currentItem: WorkItem | undefined
  draftDirty: boolean
  isAwaitingCollaboration: boolean
  isCollaborationAttached: boolean
  isMainEditing: boolean
  mainDraftStale: boolean
  mainTitleCanSubmit: boolean
  pendingMentionCount: number
  savingMainSection: boolean
}) {
  if (!currentItem) {
    return false
  }

  if (isCollaborationAttached) {
    return isMainEditing && !savingMainSection
  }

  return (
    !isAwaitingCollaboration &&
    isMainEditing &&
    mainTitleCanSubmit &&
    (draftDirty || pendingMentionCount > 0) &&
    !savingMainSection &&
    !mainDraftStale
  )
}

function useWorkItemMainSectionController({
  currentItem,
  descriptionContent,
  editable,
  flushCollaboration,
  isAwaitingCollaboration,
  isCollaborationAttached,
  isCollaborationBootstrapping,
}: {
  currentItem: WorkItem | undefined
  descriptionContent: string
  editable: boolean
  flushCollaboration: DetailFlushCollaboration
  isAwaitingCollaboration: boolean
  isCollaborationAttached: boolean
  isCollaborationBootstrapping: boolean
}) {
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
  ] = useState<DetailMainMentionRetryEntries>({})
  const [savingMainSection, setSavingMainSection] = useState(false)

  const isMainEditing = getIsMainSectionEditing({
    currentItem,
    mainDraftItemId,
    mainEditing,
  })
  const pendingMainMentionEntries = getPendingMainMentionEntries({
    currentItem,
    descriptionContent,
    isMainEditing,
    mainDraftDescription,
    pendingMentionRetryEntriesByItemId: mainPendingMentionRetryEntriesByItemId,
  })
  const mainTitleLimitState = getTextInputLimitState(
    mainDraftTitle,
    workItemTitleConstraints
  )
  const draftState = getMainSectionDraftState({
    currentItem,
    descriptionContent,
    isCollaborationAttached,
    isMainEditing,
    mainDraftDescription,
    mainDraftTitle,
    mainDraftUpdatedAt,
  })
  const canSaveMainSection = getCanSaveMainSection({
    currentItem,
    draftDirty: draftState.dirty,
    isAwaitingCollaboration,
    isCollaborationAttached,
    isMainEditing,
    mainDraftStale: draftState.stale,
    mainTitleCanSubmit: mainTitleLimitState.canSubmit,
    pendingMentionCount: pendingMainMentionEntries.length,
    savingMainSection,
  })

  function handleStartMainEdit() {
    if (!currentItem || !editable || isCollaborationBootstrapping) {
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
    setMainDraftTitle(currentItem?.title ?? "")
    setMainDraftDescription(currentItem ? descriptionContent : "")
    setMainEditing(false)
  }

  function handleReloadMainDraft() {
    if (!currentItem) {
      return
    }

    setMainDraftUpdatedAt(currentItem.updatedAt)
    setMainDraftTitle(currentItem.title)
    setMainDraftDescription(descriptionContent)
  }

  function handleDescriptionChange(content: string) {
    setMainDraftDescription(content)

    if (currentItem && isCollaborationAttached) {
      useAppStore
        .getState()
        .applyItemDescriptionCollaborationContent(currentItem.id, content)
    }
  }

  async function handleSaveMainEdit() {
    if (!currentItem || !canSaveMainSection) {
      return
    }

    setSavingMainSection(true)
    const savedItemId = currentItem.id
    const pendingMentionEntries = [...pendingMainMentionEntries]
    const saved = await persistWorkItemMainSection({
      currentItem,
      flushCollaboration,
      isCollaborationAttached,
      mainDraftDescription,
      mainDraftUpdatedAt,
      mainTitleDirty: draftState.titleDirty,
      normalizedMainDraftTitle: draftState.normalizedTitle,
    })

    if (!saved) {
      setSavingMainSection(false)
      return
    }

    setMainDraftItemId(null)
    setMainDraftUpdatedAt(null)
    setMainEditing(false)

    await deliverWorkItemMainMentionNotifications({
      pendingMentionEntries,
      savedItemId,
      setPendingMentionRetryEntriesByItemId:
        setMainPendingMentionRetryEntriesByItemId,
    })
    setSavingMainSection(false)
  }

  return {
    canSaveMainSection,
    handleCancelMainEdit,
    handleDescriptionChange,
    handleReloadMainDraft,
    handleSaveMainEdit,
    handleStartMainEdit,
    isMainEditing,
    mainDraftDescription,
    mainDraftStale: draftState.stale,
    mainDraftTitle,
    mainTitleLimitState,
    savingMainSection,
    setMainDraftTitle,
  }
}

function WorkItemDetailBreadcrumb({
  currentItem,
  team,
}: {
  currentItem: WorkItem
  team: Team | null
}) {
  return (
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
  )
}

function WorkItemTopBarEditActions({
  isMainEditing,
  savingMainSection,
  canSaveMainSection,
  isCollaborationAttached,
  onCancelMainEdit,
  onSaveMainEdit,
  onStartMainEdit,
}: {
  isMainEditing: boolean
  savingMainSection: boolean
  canSaveMainSection: boolean
  isCollaborationAttached: boolean
  onCancelMainEdit: () => void
  onSaveMainEdit: () => void
  onStartMainEdit: () => void
}) {
  if (!isMainEditing) {
    return (
      <Button size="sm" variant="outline" onClick={onStartMainEdit}>
        Edit
      </Button>
    )
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={savingMainSection}
        onClick={onCancelMainEdit}
      >
        {isCollaborationAttached ? "Close" : "Cancel"}
      </Button>
      <Button size="sm" disabled={!canSaveMainSection} onClick={onSaveMainEdit}>
        {savingMainSection
          ? "Saving..."
          : isCollaborationAttached
            ? "Done"
            : "Save"}
      </Button>
    </>
  )
}

function WorkItemTopBarDeleteMenu({
  deletingItem,
  itemTypeLabel,
  onOpenDeleteDialog,
}: {
  deletingItem: boolean
  itemTypeLabel: string
  onOpenDeleteDialog: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" disabled={deletingItem}>
          <DotsThree className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 min-w-44">
        <DropdownMenuItem
          variant="destructive"
          disabled={deletingItem}
          onSelect={(event) => {
            event.preventDefault()
            onOpenDeleteDialog()
          }}
        >
          <Trash className="size-4" />
          Delete {itemTypeLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function WorkItemTopBarActions({
  editable,
  otherDescriptionViewers,
  isMainEditing,
  savingMainSection,
  canSaveMainSection,
  isCollaborationAttached,
  deletingItem,
  itemTypeLabel,
  propertiesOpen,
  onCancelMainEdit,
  onSaveMainEdit,
  onStartMainEdit,
  onOpenDeleteDialog,
  onToggleProperties,
}: {
  editable: boolean
  otherDescriptionViewers: DocumentPresenceViewer[]
  isMainEditing: boolean
  savingMainSection: boolean
  canSaveMainSection: boolean
  isCollaborationAttached: boolean
  deletingItem: boolean
  itemTypeLabel: string
  propertiesOpen: boolean
  onCancelMainEdit: () => void
  onSaveMainEdit: () => void
  onStartMainEdit: () => void
  onOpenDeleteDialog: () => void
  onToggleProperties: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      {editable ? (
        <>
          {otherDescriptionViewers.length > 0 ? (
            <DocumentPresenceAvatarGroup
              viewers={otherDescriptionViewers}
              compact
            />
          ) : null}
          <WorkItemTopBarEditActions
            isMainEditing={isMainEditing}
            savingMainSection={savingMainSection}
            canSaveMainSection={canSaveMainSection}
            isCollaborationAttached={isCollaborationAttached}
            onCancelMainEdit={onCancelMainEdit}
            onSaveMainEdit={onSaveMainEdit}
            onStartMainEdit={onStartMainEdit}
          />
          <WorkItemTopBarDeleteMenu
            deletingItem={deletingItem}
            itemTypeLabel={itemTypeLabel}
            onOpenDeleteDialog={onOpenDeleteDialog}
          />
        </>
      ) : null}
      <Button
        size="icon-sm"
        variant="ghost"
        className={cn(!propertiesOpen && "text-muted-foreground")}
        onClick={onToggleProperties}
      >
        <SidebarSimple className="size-4" />
      </Button>
    </div>
  )
}

function WorkItemDetailTopBar({
  currentItem,
  team,
  editable,
  otherDescriptionViewers,
  isMainEditing,
  savingMainSection,
  canSaveMainSection,
  isCollaborationAttached,
  deletingItem,
  propertiesOpen,
  onCancelMainEdit,
  onSaveMainEdit,
  onStartMainEdit,
  onOpenDeleteDialog,
  onToggleProperties,
}: {
  currentItem: WorkItem
  team: Team | null
  editable: boolean
  otherDescriptionViewers: DocumentPresenceViewer[]
  isMainEditing: boolean
  savingMainSection: boolean
  canSaveMainSection: boolean
  isCollaborationAttached: boolean
  deletingItem: boolean
  propertiesOpen: boolean
  onCancelMainEdit: () => void
  onSaveMainEdit: () => void
  onStartMainEdit: () => void
  onOpenDeleteDialog: () => void
  onToggleProperties: () => void
}) {
  const itemTypeLabel = getDisplayLabelForWorkItemType(
    currentItem.type,
    team?.settings.experience
  )

  return (
    <div className="flex min-h-10 shrink-0 items-center justify-between gap-1 border-b border-line-soft bg-surface px-3 py-2">
      <WorkItemDetailBreadcrumb currentItem={currentItem} team={team} />
      <WorkItemTopBarActions
        editable={editable}
        otherDescriptionViewers={otherDescriptionViewers}
        isMainEditing={isMainEditing}
        savingMainSection={savingMainSection}
        canSaveMainSection={canSaveMainSection}
        isCollaborationAttached={isCollaborationAttached}
        deletingItem={deletingItem}
        itemTypeLabel={itemTypeLabel}
        propertiesOpen={propertiesOpen}
        onCancelMainEdit={onCancelMainEdit}
        onSaveMainEdit={onSaveMainEdit}
        onStartMainEdit={onStartMainEdit}
        onOpenDeleteDialog={onOpenDeleteDialog}
        onToggleProperties={onToggleProperties}
      />
    </div>
  )
}

function WorkItemParentPill({
  parentItem,
  workCopy,
}: {
  parentItem: WorkItem | null
  workCopy: DetailWorkCopy
}) {
  if (!parentItem) {
    return null
  }

  return (
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
        <span className="max-w-[20rem] truncate">{parentItem.title}</span>
      </Link>
    </div>
  )
}

function WorkItemMainHeader({
  currentItem,
  team,
  isMainEditing,
  mainDraftTitle,
  mainTitleLimitState,
  onMainDraftTitleChange,
}: {
  currentItem: WorkItem
  team: Team | null
  isMainEditing: boolean
  mainDraftTitle: string
  mainTitleLimitState: DetailTextLimitState
  onMainDraftTitleChange: (title: string) => void
}) {
  const itemTypeLabel = getDisplayLabelForWorkItemType(
    currentItem.type,
    team?.settings.experience
  )

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] leading-none">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-fg-3 uppercase">
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full bg-fg-4"
          />
          <span>{itemTypeLabel}</span>
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
        <div>
          <Input
            value={mainDraftTitle}
            onChange={(event) => onMainDraftTitleChange(event.target.value)}
            placeholder={`${itemTypeLabel} title`}
            maxLength={workItemTitleConstraints.max}
            className="h-auto border-none bg-transparent px-0 py-0 text-[28px] leading-[1.18] font-semibold tracking-[-0.018em] shadow-none focus-visible:ring-0 dark:bg-transparent"
            autoFocus
          />
          <FieldCharacterLimit
            state={mainTitleLimitState}
            limit={workItemTitleConstraints.max}
            className="mt-1"
          />
        </div>
      ) : (
        <h1 className="text-[28px] leading-[1.18] font-semibold tracking-[-0.018em] text-foreground">
          {currentItem.title}
        </h1>
      )}
    </header>
  )
}

function WorkItemStaleDraftNotice({
  stale,
  onReload,
}: {
  stale: boolean
  onReload: () => void
}) {
  if (!stale) {
    return null
  }

  return (
    <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">
          This item changed while you were editing
        </div>
        <div className="text-xs text-muted-foreground">
          Reload the latest title and description before saving your draft.
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onReload}>
        Reload latest
      </Button>
    </div>
  )
}

function WorkItemDescriptionEditor({
  showDescriptionBootPreview,
  bootstrapContent,
  collaborationDescriptionContent,
  isCollaborationAttached,
  editorCollaboration,
  collaboration,
  currentUserId,
  editable,
  isCollaborationBootstrapping,
  otherDescriptionViewers,
  mentionCandidates,
  onLegacyActiveBlockChange,
  onDescriptionChange,
  onUploadAttachment,
}: {
  showDescriptionBootPreview: boolean
  bootstrapContent: DetailBootstrapContent
  collaborationDescriptionContent: string
  isCollaborationAttached: boolean
  editorCollaboration: DetailEditorCollaboration
  collaboration: DetailCollaborationBinding
  currentUserId: string
  editable: boolean
  isCollaborationBootstrapping: boolean
  otherDescriptionViewers: DocumentPresenceViewer[]
  mentionCandidates: UserProfile[]
  onLegacyActiveBlockChange: (activeBlockId: string | null) => void
  onDescriptionChange: (content: string) => void
  onUploadAttachment: DetailUploadAttachmentHandler
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 transition-colors focus-within:border-fg-3">
      {showDescriptionBootPreview ? (
        <RichTextContent
          content={
            typeof bootstrapContent === "string"
              ? bootstrapContent
              : collaborationDescriptionContent
          }
          className="text-fg-1 min-h-24 text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-fg-2 [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:leading-tight [&_h1]:font-semibold [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:leading-tight [&_h2]:font-semibold [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:leading-tight [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mt-0 [&_p]:leading-7 [&_p+p]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
        />
      ) : (
        <RichTextEditor
          content={collaborationDescriptionContent}
          collaboration={
            isCollaborationAttached
              ? (editorCollaboration ?? collaboration ?? undefined)
              : undefined
          }
          currentPresenceUserId={currentUserId}
          editable={editable && !isCollaborationBootstrapping}
          showStats={false}
          placeholder="Add a description…"
          presenceViewers={otherDescriptionViewers}
          onActiveBlockChange={onLegacyActiveBlockChange}
          mentionCandidates={mentionCandidates}
          onChange={onDescriptionChange}
          onUploadAttachment={onUploadAttachment}
        />
      )}
    </div>
  )
}

function WorkItemDescriptionReadView({
  descriptionContent,
  editable,
  onStartMainEdit,
}: {
  descriptionContent: string
  editable: boolean
  onStartMainEdit: () => void
}) {
  if (isDescriptionPlaceholder(descriptionContent)) {
    return editable ? (
      <button
        type="button"
        onClick={onStartMainEdit}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-left text-[13px] text-fg-4 transition-colors hover:border-fg-4 hover:bg-surface hover:text-fg-2"
      >
        <NotePencil className="size-3.5" />
        <span>Add a description…</span>
      </button>
    ) : (
      <p className="text-[13px] text-fg-4">No description yet.</p>
    )
  }

  return (
    <RichTextContent
      content={descriptionContent}
      className="text-fg-1 text-[14px] leading-[1.65] [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-fg-2 [&_h1]:mt-5 [&_h1]:mb-2 [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:mt-4 [&_h3]:mb-1.5 [&_li]:mb-1 [&_ol]:my-2 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:my-2 [&_ul]:ml-5 [&_ul]:list-disc"
    />
  )
}

function WorkItemDescriptionSection({
  isMainEditing,
  showDescriptionBootPreview,
  bootstrapContent,
  collaborationDescriptionContent,
  isCollaborationAttached,
  editorCollaboration,
  collaboration,
  currentUserId,
  editable,
  isCollaborationBootstrapping,
  otherDescriptionViewers,
  mentionCandidates,
  descriptionContent,
  onLegacyActiveBlockChange,
  onDescriptionChange,
  onUploadAttachment,
  onStartMainEdit,
}: {
  isMainEditing: boolean
  showDescriptionBootPreview: boolean
  bootstrapContent: DetailBootstrapContent
  collaborationDescriptionContent: string
  isCollaborationAttached: boolean
  editorCollaboration: DetailEditorCollaboration
  collaboration: DetailCollaborationBinding
  currentUserId: string
  editable: boolean
  isCollaborationBootstrapping: boolean
  otherDescriptionViewers: DocumentPresenceViewer[]
  mentionCandidates: UserProfile[]
  descriptionContent: string
  onLegacyActiveBlockChange: (activeBlockId: string | null) => void
  onDescriptionChange: (content: string) => void
  onUploadAttachment: DetailUploadAttachmentHandler
  onStartMainEdit: () => void
}) {
  return (
    <section className="mt-7">
      {isMainEditing ? (
        <WorkItemDescriptionEditor
          showDescriptionBootPreview={showDescriptionBootPreview}
          bootstrapContent={bootstrapContent}
          collaborationDescriptionContent={collaborationDescriptionContent}
          isCollaborationAttached={isCollaborationAttached}
          editorCollaboration={editorCollaboration}
          collaboration={collaboration}
          currentUserId={currentUserId}
          editable={editable}
          isCollaborationBootstrapping={isCollaborationBootstrapping}
          otherDescriptionViewers={otherDescriptionViewers}
          mentionCandidates={mentionCandidates}
          onLegacyActiveBlockChange={onLegacyActiveBlockChange}
          onDescriptionChange={onDescriptionChange}
          onUploadAttachment={onUploadAttachment}
        />
      ) : (
        <WorkItemDescriptionReadView
          descriptionContent={descriptionContent}
          editable={editable}
          onStartMainEdit={onStartMainEdit}
        />
      )}
    </section>
  )
}

function WorkItemChildItemsHeader({
  childItems,
  childProgress,
  childCopy,
  canCreateChildItem,
  open,
  mainChildComposerOpen,
  onToggleOpen,
  onToggleComposer,
}: {
  childItems: WorkItem[]
  childProgress: DetailChildProgress
  childCopy: DetailChildCopy
  canCreateChildItem: boolean
  open: boolean
  mainChildComposerOpen: boolean
  onToggleOpen: () => void
  onToggleComposer: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
      <button
        type="button"
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-foreground transition-colors hover:text-fg-2"
        onClick={onToggleOpen}
      >
        {open ? (
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
          onClick={onToggleComposer}
        >
          <Plus className="size-3.5" />
        </Button>
      ) : null}
    </div>
  )
}

function WorkItemChildProgressBar({
  childItems,
  childProgress,
}: {
  childItems: WorkItem[]
  childProgress: DetailChildProgress
}) {
  if (childItems.length === 0) {
    return null
  }

  return (
    <div className="mx-4 mb-3 h-[3px] overflow-hidden rounded-full bg-surface-3">
      <div
        className="h-full rounded-full bg-status-done transition-all"
        style={{
          width: `${childProgress.percent}%`,
        }}
      />
    </div>
  )
}

function WorkItemChildRows({
  data,
  childItems,
}: {
  data: AppData
  childItems: WorkItem[]
}) {
  if (childItems.length === 0) {
    return null
  }

  return (
    <ul className="flex flex-col divide-y divide-line-soft">
      {childItems.map((child) => (
        <li key={child.id}>
          <DetailChildWorkItemRow data={data} item={child} variant="main" />
        </li>
      ))}
    </ul>
  )
}

function WorkItemChildComposerSlot({
  currentItem,
  childItems,
  childCopy,
  editable,
  canCreateChildItem,
  mainChildComposerOpen,
  onOpenComposer,
  onCloseComposer,
}: {
  currentItem: WorkItem
  childItems: WorkItem[]
  childCopy: DetailChildCopy
  editable: boolean
  canCreateChildItem: boolean
  mainChildComposerOpen: boolean
  onOpenComposer: () => void
  onCloseComposer: () => void
}) {
  if (mainChildComposerOpen) {
    return (
      <div className="border-t border-line-soft bg-background">
        <InlineChildIssueComposer
          teamId={currentItem.teamId}
          parentItem={currentItem}
          disabled={!editable}
          onCancel={onCloseComposer}
          onCreated={onCloseComposer}
        />
      </div>
    )
  }

  if (!canCreateChildItem) {
    return null
  }

  return (
    <button
      type="button"
      className={cn(
        "inline-flex w-full items-center gap-2 px-4 py-2 text-[12px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground",
        childItems.length > 0 && "border-t border-line-soft"
      )}
      onClick={onOpenComposer}
    >
      <Plus className="size-3" />
      <span>{childCopy.addChildLabel}</span>
    </button>
  )
}

function WorkItemChildItemsSection({
  data,
  currentItem,
  childItems,
  childProgress,
  childCopy,
  editable,
  canCreateChildItem,
  open,
  mainChildComposerOpen,
  onToggleOpen,
  onToggleComposer,
  onOpenComposer,
  onCloseComposer,
}: {
  data: AppData
  currentItem: WorkItem
  childItems: WorkItem[]
  childProgress: DetailChildProgress
  childCopy: DetailChildCopy
  editable: boolean
  canCreateChildItem: boolean
  open: boolean
  mainChildComposerOpen: boolean
  onToggleOpen: () => void
  onToggleComposer: () => void
  onOpenComposer: () => void
  onCloseComposer: () => void
}) {
  if (childItems.length === 0 && !canCreateChildItem) {
    return null
  }

  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-line bg-surface">
      <WorkItemChildItemsHeader
        childItems={childItems}
        childProgress={childProgress}
        childCopy={childCopy}
        canCreateChildItem={canCreateChildItem}
        open={open}
        mainChildComposerOpen={mainChildComposerOpen}
        onToggleOpen={onToggleOpen}
        onToggleComposer={onToggleComposer}
      />

      <WorkItemChildProgressBar
        childItems={childItems}
        childProgress={childProgress}
      />

      {open ? (
        <div className="border-t border-line-soft">
          <WorkItemChildRows data={data} childItems={childItems} />
          <WorkItemChildComposerSlot
            currentItem={currentItem}
            childItems={childItems}
            childCopy={childCopy}
            editable={editable}
            canCreateChildItem={canCreateChildItem}
            mainChildComposerOpen={mainChildComposerOpen}
            onOpenComposer={onOpenComposer}
            onCloseComposer={onCloseComposer}
          />
        </div>
      ) : null}
    </section>
  )
}

function WorkItemMainArticle({
  data,
  currentItem,
  team,
  workCopy,
  parentItem,
  isMainEditing,
  mainDraftTitle,
  mainTitleLimitState,
  mainDraftStale,
  descriptionContent,
  showDescriptionBootPreview,
  bootstrapContent,
  collaborationDescriptionContent,
  isCollaborationAttached,
  editorCollaboration,
  collaboration,
  currentUserId,
  editable,
  isCollaborationBootstrapping,
  otherDescriptionViewers,
  mentionCandidates,
  childItems,
  childProgress,
  childCopy,
  canCreateChildItem,
  subIssuesOpen,
  mainChildComposerOpen,
  onMainDraftTitleChange,
  onReloadMainDraft,
  onLegacyActiveBlockChange,
  onDescriptionChange,
  onUploadAttachment,
  onStartMainEdit,
  onToggleSubIssues,
  onToggleMainChildComposer,
  onOpenMainChildComposer,
  onCloseMainChildComposer,
}: {
  data: AppData
  currentItem: WorkItem
  team: Team | null
  workCopy: DetailWorkCopy
  parentItem: WorkItem | null
  isMainEditing: boolean
  mainDraftTitle: string
  mainTitleLimitState: DetailTextLimitState
  mainDraftStale: boolean
  descriptionContent: string
  showDescriptionBootPreview: boolean
  bootstrapContent: DetailBootstrapContent
  collaborationDescriptionContent: string
  isCollaborationAttached: boolean
  editorCollaboration: DetailEditorCollaboration
  collaboration: DetailCollaborationBinding
  currentUserId: string
  editable: boolean
  isCollaborationBootstrapping: boolean
  otherDescriptionViewers: DocumentPresenceViewer[]
  mentionCandidates: UserProfile[]
  childItems: WorkItem[]
  childProgress: DetailChildProgress
  childCopy: DetailChildCopy
  canCreateChildItem: boolean
  subIssuesOpen: boolean
  mainChildComposerOpen: boolean
  onMainDraftTitleChange: (title: string) => void
  onReloadMainDraft: () => void
  onLegacyActiveBlockChange: (activeBlockId: string | null) => void
  onDescriptionChange: (content: string) => void
  onUploadAttachment: DetailUploadAttachmentHandler
  onStartMainEdit: () => void
  onToggleSubIssues: () => void
  onToggleMainChildComposer: () => void
  onOpenMainChildComposer: () => void
  onCloseMainChildComposer: () => void
}) {
  return (
    <div className="min-w-0 flex-1 overflow-y-auto">
      <article className="mx-auto flex max-w-[60rem] flex-col px-10 pt-12 pb-24">
        <WorkItemParentPill parentItem={parentItem} workCopy={workCopy} />

        <WorkItemMainHeader
          currentItem={currentItem}
          team={team}
          isMainEditing={isMainEditing}
          mainDraftTitle={mainDraftTitle}
          mainTitleLimitState={mainTitleLimitState}
          onMainDraftTitleChange={onMainDraftTitleChange}
        />

        <WorkItemStaleDraftNotice
          stale={mainDraftStale}
          onReload={onReloadMainDraft}
        />

        <WorkItemDescriptionSection
          isMainEditing={isMainEditing}
          showDescriptionBootPreview={showDescriptionBootPreview}
          bootstrapContent={bootstrapContent}
          collaborationDescriptionContent={collaborationDescriptionContent}
          isCollaborationAttached={isCollaborationAttached}
          editorCollaboration={editorCollaboration}
          collaboration={collaboration}
          currentUserId={currentUserId}
          editable={editable}
          isCollaborationBootstrapping={isCollaborationBootstrapping}
          otherDescriptionViewers={otherDescriptionViewers}
          mentionCandidates={mentionCandidates}
          descriptionContent={descriptionContent}
          onLegacyActiveBlockChange={onLegacyActiveBlockChange}
          onDescriptionChange={onDescriptionChange}
          onUploadAttachment={onUploadAttachment}
          onStartMainEdit={onStartMainEdit}
        />

        <WorkItemChildItemsSection
          data={data}
          currentItem={currentItem}
          childItems={childItems}
          childProgress={childProgress}
          childCopy={childCopy}
          editable={editable}
          canCreateChildItem={canCreateChildItem}
          open={subIssuesOpen}
          mainChildComposerOpen={mainChildComposerOpen}
          onToggleOpen={onToggleSubIssues}
          onToggleComposer={onToggleMainChildComposer}
          onOpenComposer={onOpenMainChildComposer}
          onCloseComposer={onCloseMainChildComposer}
        />

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
  )
}

function WorkItemSidebarProperties({
  currentItem,
  team,
  teamMembers,
  teamProjects,
  selectedMilestone,
  availableLabels,
  parentOptions,
  displayedEndDate,
  sidebarEditable,
  statusOptions,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onStartDateChange,
  onEndDateChange,
  onProjectChange,
  onParentChange,
}: {
  currentItem: WorkItem
  team: Team | null
  teamMembers: UserProfile[]
  teamProjects: Project[]
  selectedMilestone: Milestone | null
  availableLabels: AppData["labels"]
  parentOptions: DetailSelectOption[]
  displayedEndDate: string | null
  sidebarEditable: boolean
  statusOptions: DetailSelectOption[]
  onStatusChange: (value: string) => void
  onPriorityChange: (value: string) => void
  onAssigneeChange: (value: string) => void
  onStartDateChange: (value: string | null) => void
  onEndDateChange: (value: string | null) => void
  onProjectChange: (value: string) => void
  onParentChange: (value: string) => void
}) {
  return (
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
        onValueChange={onStatusChange}
      />
      <DetailSidebarSelectRow
        label="Priority"
        icon={<Flag className="size-[13px]" />}
        value={currentItem.priority}
        disabled={!sidebarEditable}
        options={Object.entries(priorityMeta).map(([value, meta]) => ({
          value,
          label: meta.label,
        }))}
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
        onValueChange={onPriorityChange}
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
        onValueChange={onAssigneeChange}
      />
      <DetailSidebarDateRow
        label="Start"
        icon={<Clock className="size-[13px]" />}
        value={currentItem.startDate}
        disabled={!sidebarEditable}
        onValueChange={onStartDateChange}
      />
      <DetailSidebarDateRow
        label="Due"
        icon={<CalendarBlank className="size-[13px]" />}
        value={displayedEndDate}
        disabled={!sidebarEditable}
        onValueChange={onEndDateChange}
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
        onValueChange={onProjectChange}
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
          onValueChange={onParentChange}
        />
      ) : null}
    </dl>
  )
}

function WorkItemSidebarSubtasks({
  data,
  currentItem,
  childItems,
  childProgress,
  childCopy,
  editable,
  canCreateChildItem,
  sidebarChildComposerOpen,
  onToggleComposer,
  onCloseComposer,
}: {
  data: AppData
  currentItem: WorkItem
  childItems: WorkItem[]
  childProgress: DetailChildProgress
  childCopy: DetailChildCopy
  editable: boolean
  canCreateChildItem: boolean
  sidebarChildComposerOpen: boolean
  onToggleComposer: () => void
  onCloseComposer: () => void
}) {
  return (
    <DetailSidebarSection
      title="Subtasks"
      count={`${childProgress.completedChildren} of ${childItems.length || 0}`}
      action={
        canCreateChildItem ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            onClick={onToggleComposer}
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
          <DetailChildWorkItemRow
            key={child.id}
            data={data}
            item={child}
            variant="sidebar"
          />
        ))}
        {sidebarChildComposerOpen ? (
          <div className="mt-1 rounded-md border border-line">
            <InlineChildIssueComposer
              teamId={currentItem.teamId}
              parentItem={currentItem}
              disabled={!editable}
              onCancel={onCloseComposer}
              onCreated={onCloseComposer}
            />
          </div>
        ) : null}
      </div>
    </DetailSidebarSection>
  )
}

function WorkItemRelationsSection({
  data,
  selectedProject,
  linkedProjects,
  linkedDocuments,
}: {
  data: AppData
  selectedProject: Project | null
  linkedProjects: Project[]
  linkedDocuments: AppDocument[]
}) {
  if (
    linkedProjects.length === 0 &&
    linkedDocuments.length === 0 &&
    !selectedProject
  ) {
    return null
  }

  return (
    <DetailSidebarSection title="Relations">
      <div className="flex flex-col gap-1.5">
        {selectedProject ? (
          <Link
            href={
              getProjectHref(data, selectedProject) ??
              `/projects/${selectedProject.id}`
            }
            className={cn(detailChipClassName, "w-fit hover:bg-surface-3")}
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
            href={getProjectHref(data, project) ?? `/projects/${project.id}`}
            className={cn(detailChipClassName, "w-fit hover:bg-surface-3")}
          >
            <FolderSimple className="size-3" />
            <span>Linked project</span>
            <b className="font-medium text-foreground">{project.name}</b>
          </Link>
        ))}
        {linkedDocuments.map((document) => (
          <Link
            key={document.id}
            href={`/docs/${document.id}`}
            className={cn(detailChipClassName, "w-fit hover:bg-surface-3")}
          >
            <LinkSimple className="size-3" />
            <span>Linked doc</span>
            <b className="font-medium text-foreground">{document.title}</b>
          </Link>
        ))}
      </div>
    </DetailSidebarSection>
  )
}

function WorkItemDetailSidebar({
  open,
  data,
  currentItem,
  team,
  sidebarTitle,
  sidebarEditable,
  statusOptions,
  teamMembers,
  teamProjects,
  selectedProject,
  selectedMilestone,
  availableLabels,
  parentOptions,
  childItems,
  childProgress,
  childCopy,
  editable,
  canCreateChildItem,
  sidebarChildComposerOpen,
  linkedProjects,
  linkedDocuments,
  currentUserId,
  onCopyItemLink,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onStartDateChange,
  onEndDateChange,
  onProjectChange,
  onParentChange,
  onToggleChildComposer,
  onCloseChildComposer,
}: {
  open: boolean
  data: AppData
  currentItem: WorkItem
  team: Team | null
  sidebarTitle: string
  sidebarEditable: boolean
  statusOptions: DetailSelectOption[]
  teamMembers: UserProfile[]
  teamProjects: Project[]
  selectedProject: Project | null
  selectedMilestone: Milestone | null
  availableLabels: AppData["labels"]
  parentOptions: DetailSelectOption[]
  childItems: WorkItem[]
  childProgress: DetailChildProgress
  childCopy: DetailChildCopy
  editable: boolean
  canCreateChildItem: boolean
  sidebarChildComposerOpen: boolean
  linkedProjects: Project[]
  linkedDocuments: AppDocument[]
  currentUserId: string
  onCopyItemLink: () => void
  onStatusChange: (value: string) => void
  onPriorityChange: (value: string) => void
  onAssigneeChange: (value: string) => void
  onStartDateChange: (value: string | null) => void
  onEndDateChange: (value: string | null) => void
  onProjectChange: (value: string) => void
  onParentChange: (value: string) => void
  onToggleChildComposer: () => void
  onCloseChildComposer: () => void
}) {
  const displayedEndDate = currentItem.targetDate ?? currentItem.dueDate

  return (
    <CollapsibleRightSidebar
      open={open}
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
            onClick={onCopyItemLink}
          >
            <LinkSimple className="size-[14px]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-[22px]">
        <h2 className="mb-2.5 text-[22px] leading-[1.25] font-semibold tracking-[-0.012em]">
          {sidebarTitle}
        </h2>

        <WorkItemSidebarProperties
          currentItem={currentItem}
          team={team}
          teamMembers={teamMembers}
          teamProjects={teamProjects}
          selectedMilestone={selectedMilestone}
          availableLabels={availableLabels}
          parentOptions={parentOptions}
          displayedEndDate={displayedEndDate}
          sidebarEditable={sidebarEditable}
          statusOptions={statusOptions}
          onStatusChange={onStatusChange}
          onPriorityChange={onPriorityChange}
          onAssigneeChange={onAssigneeChange}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          onProjectChange={onProjectChange}
          onParentChange={onParentChange}
        />

        <WorkItemSidebarSubtasks
          data={data}
          currentItem={currentItem}
          childItems={childItems}
          childProgress={childProgress}
          childCopy={childCopy}
          editable={editable}
          canCreateChildItem={canCreateChildItem}
          sidebarChildComposerOpen={sidebarChildComposerOpen}
          onToggleComposer={onToggleChildComposer}
          onCloseComposer={onCloseChildComposer}
        />

        <WorkItemRelationsSection
          data={data}
          selectedProject={selectedProject}
          linkedProjects={linkedProjects}
          linkedDocuments={linkedDocuments}
        />

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
  )
}

export function WorkItemDetailScreen({ itemId }: { itemId: string }) {
  const router = useRouter()
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const currentUserId = useAppStore((state) => state.currentUserId)
  const currentUser = getUser(data, currentUserId) ?? null
  const item = data.workItems.find((entry) => entry.id === itemId)
  const [deletingItem, setDeletingItem] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [mainChildComposerOpen, setMainChildComposerOpen] = useState(false)
  const [sidebarChildComposerOpen, setSidebarChildComposerOpen] =
    useState(false)
  const [subIssuesOpen, setSubIssuesOpen] = useState(true)
  const [propertiesOpen, setPropertiesOpen] = useState(true)
  const { requestUpdate: requestConfirmedWorkItemUpdate, confirmationDialog } =
    useWorkItemProjectCascadeConfirmation()
  const description = item ? getDocument(data, item.descriptionDocId) : null
  const descriptionContent = description?.content ?? "<p>Add a description…</p>"
  const activeDescriptionDocumentId = description?.id ?? null
  const stableDescriptionDocumentId = useStableDescriptionDocumentId(
    itemId,
    activeDescriptionDocumentId
  )
  const activePresenceItemId = item?.id ?? null
  const collaborationCurrentUser = useStableCollaborationUser(
    currentUser,
    currentUserId
  )
  const {
    bootstrapContent,
    editorCollaboration,
    collaboration,
    flush: flushCollaboration,
    isAwaitingCollaboration,
    lifecycle: collaborationLifecycle,
    viewers: collaborationViewers,
  } = useDocumentCollaboration({
    documentId: stableDescriptionDocumentId,
    currentUser: collaborationCurrentUser,
    enabled: Boolean(stableDescriptionDocumentId),
  })
  const { hasLoadedOnce: hasLoadedWorkItemReadModel } =
    useScopedReadModelRefresh({
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
  const team = item ? getTeam(data, item.teamId) : null
  const editable = team ? canEditTeam(data, team.id) : false
  const showDescriptionBootPreview = useInitialCollaborationSyncPreview({
    id: itemId,
    storagePrefix: ITEM_DESCRIPTION_SYNC_MODAL_SEEN_STORAGE_PREFIX,
    bootstrapping: isCollaborationBootstrapping,
    attached: isCollaborationAttached,
  })
  const mainSection = useWorkItemMainSectionController({
    currentItem: item,
    descriptionContent,
    editable,
    flushCollaboration,
    isAwaitingCollaboration,
    isCollaborationAttached,
    isCollaborationBootstrapping,
  })
  const isEditingCurrentItem = mainSection.isMainEditing
  const showDescriptionSyncDialog =
    isEditingCurrentItem && showDescriptionBootPreview
  const collaborationDescriptionContent = mainSection.mainDraftDescription
  const protectedDescriptionDocumentId =
    activeDescriptionDocumentId ?? stableDescriptionDocumentId
  const isProtectingDescriptionBody = Boolean(
    protectedDescriptionDocumentId &&
    (isEditingCurrentItem ||
      isCollaborationBootstrapping ||
      isCollaborationAttached)
  )

  useEffect(() => {
    if (!protectedDescriptionDocumentId) {
      return
    }

    useAppStore
      .getState()
      .setDocumentBodyProtection(
        protectedDescriptionDocumentId,
        isProtectingDescriptionBody
      )

    return () => {
      useAppStore
        .getState()
        .setDocumentBodyProtection(protectedDescriptionDocumentId, false)
    }
  }, [protectedDescriptionDocumentId, isProtectingDescriptionBody])

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
  }, [activePresenceItemId, collaborationLifecycle])

  const {
    handleLegacyActiveBlockChange,
    legacyActiveBlockId,
    workItemPresenceViewers,
  } = useLegacyWorkItemPresence({
    activeItemId: activePresenceItemId,
    currentUserId,
    collaborationLifecycle,
    isEditingCurrentItem,
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- switching items closes stale child composers.
    setMainChildComposerOpen(false)
    setSidebarChildComposerOpen(false)
  }, [itemId])

  const hasLiveDescriptionPresence = collaborationLifecycle === "attached"
  const activeDescriptionViewers = getActiveDescriptionViewers({
    hasLiveDescriptionPresence,
    collaborationViewers,
    currentUser,
    legacyActiveBlockId,
    workItemPresenceViewers,
  })
  const otherDescriptionViewers = activeDescriptionViewers.filter(
    (viewer) => viewer.userId !== currentUserId
  )

  if (!item) {
    return getMissingWorkItemDetailContent({
      deletingItem,
      hasLoadedWorkItemReadModel,
    })
  }

  const currentItem = item
  const detailModel = getWorkItemDetailModel({
    currentItem,
    data,
    editable,
    mainSection,
    team,
  })
  const {
    canSaveMainSection,
    handleCancelMainEdit,
    handleDescriptionChange,
    handleReloadMainDraft,
    handleSaveMainEdit,
    handleStartMainEdit,
    isMainEditing,
    mainDraftStale,
    mainDraftTitle,
    mainTitleLimitState,
    savingMainSection,
    setMainDraftTitle,
  } = mainSection
  const {
    availableLabels,
    canCreateChildItem,
    cascadeMessage,
    childCopy,
    childItems,
    childProgress,
    displayedEndDate,
    linkedDocuments,
    linkedProjects,
    mentionCandidates,
    parentItem,
    parentOptions,
    selectedMilestone,
    selectedProject,
    sidebarEditable,
    sidebarTitle,
    statusOptions,
    teamMembers,
    teamProjects,
    workCopy,
  } = detailModel

  function handleStartDateChange(nextStartDate: string | null) {
    updateWorkItemStartDate({
      currentItem,
      displayedEndDate,
      nextStartDate,
    })
  }

  function handleProjectChange(value: string) {
    requestWorkItemProjectChange({
      currentItem,
      requestConfirmedWorkItemUpdate,
      value,
    })
  }

  function handleParentChange(value: string) {
    requestWorkItemParentChange({
      currentItem,
      requestConfirmedWorkItemUpdate,
      value,
    })
  }

  function handleEndDateChange(nextEndDate: string | null) {
    updateWorkItemEndDate({ currentItem, nextEndDate })
  }

  async function handleDeleteItem() {
    await deleteWorkItemAndNavigate({
      currentItem,
      router,
      setDeleteDialogOpen,
      setDeletingItem,
      team,
    })
  }

  async function handleCopyItemLink() {
    await copyCurrentItemLink()
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <WorkItemDetailTopBar
          currentItem={currentItem}
          team={team}
          editable={editable}
          otherDescriptionViewers={otherDescriptionViewers}
          isMainEditing={isMainEditing}
          savingMainSection={savingMainSection}
          canSaveMainSection={canSaveMainSection}
          isCollaborationAttached={isCollaborationAttached}
          deletingItem={deletingItem}
          propertiesOpen={propertiesOpen}
          onCancelMainEdit={handleCancelMainEdit}
          onSaveMainEdit={() => {
            void handleSaveMainEdit()
          }}
          onStartMainEdit={handleStartMainEdit}
          onOpenDeleteDialog={() => setDeleteDialogOpen(true)}
          onToggleProperties={() => setPropertiesOpen((current) => !current)}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <WorkItemMainArticle
            data={data}
            currentItem={currentItem}
            team={team}
            workCopy={workCopy}
            parentItem={parentItem}
            isMainEditing={isMainEditing}
            mainDraftTitle={mainDraftTitle}
            mainTitleLimitState={mainTitleLimitState}
            mainDraftStale={mainDraftStale}
            descriptionContent={descriptionContent}
            showDescriptionBootPreview={showDescriptionBootPreview}
            bootstrapContent={bootstrapContent}
            collaborationDescriptionContent={collaborationDescriptionContent}
            isCollaborationAttached={isCollaborationAttached}
            editorCollaboration={editorCollaboration}
            collaboration={collaboration}
            currentUserId={currentUserId}
            editable={editable}
            isCollaborationBootstrapping={isCollaborationBootstrapping}
            otherDescriptionViewers={otherDescriptionViewers}
            mentionCandidates={mentionCandidates}
            childItems={childItems}
            childProgress={childProgress}
            childCopy={childCopy}
            canCreateChildItem={canCreateChildItem}
            subIssuesOpen={subIssuesOpen}
            mainChildComposerOpen={mainChildComposerOpen}
            onMainDraftTitleChange={setMainDraftTitle}
            onReloadMainDraft={handleReloadMainDraft}
            onLegacyActiveBlockChange={handleLegacyActiveBlockChange}
            onDescriptionChange={handleDescriptionChange}
            onUploadAttachment={(file) =>
              useAppStore
                .getState()
                .uploadAttachment("workItem", currentItem.id, file)
            }
            onStartMainEdit={handleStartMainEdit}
            onToggleSubIssues={() => setSubIssuesOpen((current) => !current)}
            onToggleMainChildComposer={() => {
              setSubIssuesOpen(true)
              setMainChildComposerOpen((current) => {
                const next = !current
                if (next) {
                  setSidebarChildComposerOpen(false)
                }
                return next
              })
            }}
            onOpenMainChildComposer={() => {
              setSidebarChildComposerOpen(false)
              setMainChildComposerOpen(true)
            }}
            onCloseMainChildComposer={() => setMainChildComposerOpen(false)}
          />

          <WorkItemDetailSidebar
            open={propertiesOpen}
            data={data}
            currentItem={currentItem}
            team={team}
            sidebarTitle={sidebarTitle}
            sidebarEditable={sidebarEditable}
            statusOptions={statusOptions}
            teamMembers={teamMembers}
            teamProjects={teamProjects}
            selectedProject={selectedProject}
            selectedMilestone={selectedMilestone}
            availableLabels={availableLabels}
            parentOptions={parentOptions}
            childItems={childItems}
            childProgress={childProgress}
            childCopy={childCopy}
            editable={editable}
            canCreateChildItem={canCreateChildItem}
            sidebarChildComposerOpen={sidebarChildComposerOpen}
            linkedProjects={linkedProjects}
            linkedDocuments={linkedDocuments}
            currentUserId={currentUserId}
            onCopyItemLink={() => {
              void handleCopyItemLink()
            }}
            onStatusChange={(value) =>
              useAppStore.getState().updateWorkItem(currentItem.id, {
                status: value as WorkItem["status"],
              })
            }
            onPriorityChange={(value) =>
              useAppStore.getState().updateWorkItem(currentItem.id, {
                priority: value as Priority,
              })
            }
            onAssigneeChange={(value) =>
              useAppStore.getState().updateWorkItem(currentItem.id, {
                assigneeId: value === "unassigned" ? null : value,
              })
            }
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
            onProjectChange={handleProjectChange}
            onParentChange={handleParentChange}
            onToggleChildComposer={() =>
              setSidebarChildComposerOpen((current) => {
                const next = !current
                if (next) {
                  setMainChildComposerOpen(false)
                }
                return next
              })
            }
            onCloseChildComposer={() => setSidebarChildComposerOpen(false)}
          />
        </div>
      </div>
      {confirmationDialog}
      <Dialog open={showDescriptionSyncDialog}>
        <DialogContent className="max-w-sm gap-0 p-0" showCloseButton={false}>
          <div className="px-5 py-5">
            <DialogHeader className="p-0">
              <DialogTitle className="text-base font-semibold">
                Syncing latest changes
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Loading the latest description state. Editing will unlock
                automatically in a moment.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span
                aria-hidden="true"
                className="size-2 animate-pulse rounded-full bg-primary"
              />
              <span>Syncing latest changes…</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

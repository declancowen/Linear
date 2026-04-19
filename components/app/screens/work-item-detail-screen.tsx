"use client"

import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
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
  PaperPlaneTilt,
  Plus,
  SidebarSimple,
  Tag,
  Trash,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  filterPendingDocumentMentionsByContent,
  getPendingRichTextMentionEntries,
  mergePendingDocumentMentions,
  type PendingDocumentMention,
} from "@/lib/content/rich-text-mentions"
import {
  syncClearWorkItemPresence,
  syncHeartbeatWorkItemPresence,
  syncSendItemDescriptionMentionNotifications,
} from "@/lib/convex/client"
import { RouteMutationError } from "@/lib/convex/client/shared"
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
import { UserAvatar } from "@/components/app/user-presence"
import { Badge } from "@/components/ui/badge"
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
import { Separator } from "@/components/ui/separator"
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
  CommentsInline,
  WorkItemAssigneeAvatar,
  InlineChildIssueComposer,
  WorkItemTypeBadge,
} from "./work-item-ui"
import { cn } from "@/lib/utils"

const WORK_ITEM_PRESENCE_HEARTBEAT_INTERVAL_MS = 15 * 1000

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

  const date = new Date(value)

  if (isToday(date)) {
    return `Today, ${format(date, "MMM d")}`
  }

  if (isTomorrow(date)) {
    return `Tomorrow, ${format(date, "MMM d")}`
  }

  return format(date, "EEEE, MMM d")
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
        {count ? <span className="font-medium text-fg-4">· {count}</span> : null}
        {action ? (
          <div className="ml-auto text-[11.5px] font-medium tracking-normal normal-case text-fg-3">
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
    options.find((option) => option.value !== PROPERTY_SELECT_SEPARATOR_VALUE) ??
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
                  <div key={`separator-${index}`} className="my-1 h-px bg-line-soft" />
                ) : (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "flex min-h-8 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground",
                      option.value === selectedValue && "bg-surface-3 text-foreground"
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
  const selectedLabels = labels.filter((label) => item.labelIds.includes(label.id))

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

    const created = await useAppStore.getState().createLabel(newLabelName, workspaceId)

    if (!created) {
      return
    }

    setNewLabelName("")
    useAppStore.getState().updateWorkItem(item.id, {
      labelIds: item.labelIds.includes(created.id)
        ? item.labelIds
        : [...item.labelIds, created.id],
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
                  <span className={cn(detailChipClassName, "border-dashed bg-transparent text-fg-3")}>
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
                            selected && "border-transparent bg-accent-bg text-accent-fg"
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
                    <span className="text-[12.5px] text-fg-4">No labels yet</span>
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
                    disabled={!editable || !workspaceId || newLabelName.trim().length === 0}
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
    <div className={cn(depth > 0 && "ml-6 mt-3 border-l border-line pl-4")}>
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
            {comment.content}
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
  const rootComments = comments.filter((comment) => comment.parentCommentId === null)
  const repliesByParentId = comments.reduce<Record<string, AppData["comments"]>>(
    (accumulator, comment) => {
      if (!comment.parentCommentId) {
        return accumulator
      }

      accumulator[comment.parentCommentId] = [
        ...(accumulator[comment.parentCommentId] ?? []),
        comment,
      ]

      return accumulator
    },
    {}
  )
  const creator = getUser(data, item.creatorId)
  const assignee = item.assigneeId ? getUser(data, item.assigneeId) : null
  const [content, setContent] = useState("")

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
              <span className="font-medium text-foreground">{event.user.name}</span>{" "}
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
        <textarea
          rows={2}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={!editable}
          placeholder="Leave a comment…"
          className="min-h-10 w-full resize-none border-0 bg-transparent text-[13px] leading-[1.55] outline-none placeholder:text-fg-4 disabled:cursor-not-allowed"
        />
        <div className="mt-1.5 flex items-center justify-end border-t border-dashed border-line pt-1.5">
          <Button
            size="sm"
            disabled={!editable || content.trim().length === 0}
            onClick={() => {
              useAppStore
                .getState()
                .addComment({ targetType: "workItem", targetId: item.id, content })
              setContent("")
            }}
          >
            <PaperPlaneTilt className="size-3.5" />
            Comment
          </Button>
        </div>
      </div>
    </div>
  )
}

export function WorkItemDetailScreen({ itemId }: { itemId: string }) {
  const router = useRouter()
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const currentUserId = useAppStore((state) => state.currentUserId)
  const item = data.workItems.find((entry) => entry.id === itemId)
  const [deletingItem, setDeletingItem] = useState(false)
  const [projectConfirmOpen, setProjectConfirmOpen] = useState(false)
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [childComposerOpen, setChildComposerOpen] = useState(false)
  const [subIssuesOpen, setSubIssuesOpen] = useState(true)
  const [propertiesOpen, setPropertiesOpen] = useState(true)
  const [mainEditing, setMainEditing] = useState(false)
  const [mainDraftItemId, setMainDraftItemId] = useState<string | null>(null)
  const [mainDraftUpdatedAt, setMainDraftUpdatedAt] = useState<string | null>(
    null
  )
  const [mainDraftTitle, setMainDraftTitle] = useState("")
  const [mainDraftDescription, setMainDraftDescription] = useState("")
  const [mainPendingMentionRetryEntriesByItemId, setMainPendingMentionRetryEntriesByItemId] =
    useState<Record<string, PendingDocumentMention[]>>({})
  const [savingMainSection, setSavingMainSection] = useState(false)
  const [workItemPresenceViewers, setWorkItemPresenceViewers] = useState<
    DocumentPresenceViewer[]
  >([])
  const description = item ? getDocument(data, item.descriptionDocId) : null
  const descriptionContent = description?.content ?? "<p>Add a description…</p>"
  const activePresenceItemId = item?.id ?? null
  const isEditingCurrentItem =
    item !== undefined && mainEditing && mainDraftItemId === item.id

  useEffect(() => {
    if (!activePresenceItemId || !isEditingCurrentItem) {
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
          sessionId
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
      void syncClearWorkItemPresence(activeItemId, sessionId, {
        keepalive: true,
      }).catch(() => {})
    }
  }, [activePresenceItemId, currentUserId, isEditingCurrentItem])

  if (!item) {
    if (deletingItem) {
      return null
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
    ? data.projects.find((project) => project.id === currentItem.primaryProjectId) ??
      null
    : null
  const selectedMilestone = currentItem.milestoneId
    ? data.milestones.find((milestone) => milestone.id === currentItem.milestoneId) ??
      null
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
    .map((projectId) => data.projects.find((project) => project.id === projectId) ?? null)
    .filter((project): project is NonNullable<typeof project> => project !== null)
  const linkedDocuments = currentItem.linkedDocumentIds
    .map((documentId) => getDocument(data, documentId))
    .filter((document): document is NonNullable<typeof document> => document !== null)
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
  const activeMainPendingMentionRetryEntries = filterPendingDocumentMentionsByContent(
    mainPendingMentionRetryEntriesByItemId[currentItem.id] ?? [],
    mainDraftDescription
  )
  const otherWorkItemEditors = workItemPresenceViewers.filter(
    (viewer) => viewer.userId !== currentUserId
  )
  const concurrentEditorLabel = formatConcurrentEditorLabel(otherWorkItemEditors)
  const pendingMainMentionEntries = isMainEditing
    ? mergePendingDocumentMentions(
        activeMainPendingMentionRetryEntries,
        getPendingRichTextMentionEntries(descriptionContent, mainDraftDescription)
      )
    : []
  const normalizedMainDraftTitle = mainDraftTitle.trim()
  const mainTitleDirty =
    isMainEditing && normalizedMainDraftTitle !== currentItem.title
  const mainDescriptionDirty =
    isMainEditing && mainDraftDescription !== descriptionContent
  const mainDirty = mainTitleDirty || mainDescriptionDirty
  const mainDraftStale =
    isMainEditing &&
    Boolean(mainDraftUpdatedAt) &&
    mainDraftUpdatedAt !== currentItem.updatedAt
  const canSaveMainSection =
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
    if (!editable) {
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
    const savedDescription = mainDraftDescription
    const pendingMentionEntries = [...pendingMainMentionEntries]

    const saved = await useAppStore.getState().saveWorkItemMainSection({
      itemId: savedItemId,
      title: normalizedMainDraftTitle,
      description: savedDescription,
      expectedUpdatedAt: mainDraftUpdatedAt ?? currentItem.updatedAt,
    })

    if (!saved) {
      setSavingMainSection(false)
      return
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
                {isMainEditing ? (
                  <DocumentPresenceAvatarGroup viewers={workItemPresenceViewers} />
                ) : null}
                {isMainEditing ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={savingMainSection}
                      onClick={handleCancelMainEdit}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!canSaveMainSection}
                      onClick={() => void handleSaveMainEdit()}
                    >
                      {savingMainSection ? "Saving..." : "Save"}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleStartMainEdit}>
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
            <div className="mx-auto max-w-3xl px-8 py-8">
              {parentItem ? (
                <Link
                  href={`/items/${parentItem.id}`}
                  className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span>{workCopy.parentLabel}</span>
                  <Badge variant="outline">{parentItem.key}</Badge>
                  <span className="truncate">{parentItem.title}</span>
                </Link>
              ) : null}
              {isMainEditing ? (
                <Input
                  value={mainDraftTitle}
                  onChange={(event) => setMainDraftTitle(event.target.value)}
                  placeholder={`${getDisplayLabelForWorkItemType(
                    currentItem.type,
                    team?.settings.experience
                  )} title`}
                  className="mb-2.5 h-auto border-none bg-transparent px-0 py-0 text-[22px] leading-[1.25] font-semibold tracking-[-0.012em] shadow-none focus-visible:ring-0 dark:bg-transparent"
                  autoFocus
                />
              ) : (
                <h1 className="mb-2.5 text-[22px] leading-[1.25] font-semibold tracking-[-0.012em]">
                  {currentItem.title}
                </h1>
              )}
              <div className="mb-4">
                <WorkItemTypeBadge data={data} item={currentItem} />
              </div>

              {mainDraftStale ? (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2.5">
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
                <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2.5">
                  <div className="text-sm font-medium">
                    {concurrentEditorLabel}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    You can keep editing, but you may need to reload before
                    saving if they update the item first.
                  </div>
                </div>
              ) : null}

              <div className="mt-4">
                <RichTextEditor
                  content={isMainEditing ? mainDraftDescription : descriptionContent}
                  editable={editable && isMainEditing}
                  placeholder="Add a description…"
                  mentionCandidates={
                    team ? getTeamMembers(data, team.id) : data.users
                  }
                  onChange={setMainDraftDescription}
                  onUploadAttachment={(file) =>
                    useAppStore
                      .getState()
                      .uploadAttachment("workItem", currentItem.id, file)
                  }
                />
              </div>

              {showSubIssuesSection ? (
                <div className="mt-8">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setSubIssuesOpen((current) => !current)}
                    >
                      {subIssuesOpen ? (
                        <CaretDown className="size-3" />
                      ) : (
                        <CaretRight className="size-3" />
                      )}
                      <span>{childCopy.childPluralLabel}</span>
                      <span className="text-xs font-normal tabular-nums">
                        {childItems.length > 0
                          ? `${childProgress.percent}%`
                          : "0%"}
                      </span>
                    </button>
                    {canCreateChildItem ? (
                      <Button
                        size="icon-sm"
                        variant={childComposerOpen ? "outline" : "ghost"}
                        disabled={!canCreateChildItem}
                        onClick={() => {
                          setSubIssuesOpen(true)
                          setChildComposerOpen((current) => !current)
                        }}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>

                  {childItems.length > 0 ? (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{
                          width: `${childProgress.percent}%`,
                        }}
                      />
                    </div>
                  ) : null}

                  {childItems.length > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {childProgress.includedChildren > 0
                        ? `${childProgress.completedChildren} of ${childProgress.includedChildren} active ${childCopy.childPluralLabel.toLowerCase()} done`
                        : `No active ${childCopy.childPluralLabel.toLowerCase()} in progress tracking`}
                    </p>
                  ) : null}

                  {subIssuesOpen ? (
                    <div className="mt-2 flex flex-col gap-0.5">
                      {childItems.map((child) => (
                        <Link
                          key={child.id}
                          href={`/items/${child.id}`}
                          className="group/sub flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-surface-2"
                        >
                          <StatusIcon status={child.status} />
                          <span className="shrink-0 font-mono text-[11.5px] text-fg-3">
                            {child.key}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {child.title}
                          </span>
                          <WorkItemTypeBadge data={data} item={child} />
                          <span className="shrink-0 text-[11.5px] text-fg-4">
                            {priorityMeta[child.priority].label}
                          </span>
                          {child.assigneeId ? (
                            <WorkItemAssigneeAvatar
                              user={getUser(data, child.assigneeId)}
                              className="shrink-0"
                            />
                          ) : null}
                        </Link>
                      ))}

                      {childComposerOpen ? (
                        <div className="mt-1 rounded-md border border-line">
                          <InlineChildIssueComposer
                            teamId={currentItem.teamId}
                            parentItem={currentItem}
                            disabled={!editable}
                            onCancel={() => setChildComposerOpen(false)}
                            onCreated={() => setChildComposerOpen(false)}
                          />
                        </div>
                      ) : canCreateChildItem ? (
                        <button
                          type="button"
                          className="inline-flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
                          onClick={() => setChildComposerOpen(true)}
                        >
                          <Plus className="size-3" />
                          <span>{childCopy.addChildLabel}</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Separator className="my-6" />

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Activity</h3>
                </div>
                <CommentsInline
                  targetType="workItem"
                  targetId={currentItem.id}
                  editable={editable}
                />
              </div>
            </div>
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
                {editable ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={detailIconButtonClassName}
                        aria-label="More actions"
                        disabled={deletingItem}
                      >
                        <DotsThree className="size-[15px]" />
                      </button>
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
                ) : null}
                <button
                  type="button"
                  className={detailIconButtonClassName}
                  aria-label="Close sidebar"
                  onClick={() => setPropertiesOpen(false)}
                >
                  <X className="size-[15px]" />
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
                  className="text-[13.5px] leading-[1.6] text-fg-2 [&_p]:mb-2.5 [&_p:last-child]:mb-0 [&_ul]:mb-2.5 [&_ul]:ml-[18px] [&_ul]:list-disc [&_li]:mb-1"
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
                        <WorkItemAssigneeAvatar user={selectedUser} />
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
                        <WorkItemAssigneeAvatar user={optionUser} />
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
                      onClick={() => setChildComposerOpen((current) => !current)}
                    >
                      <Plus className="size-3" />
                      {childCopy.addChildLabel}
                    </button>
                  ) : null
                }
              >
                <div className="flex flex-col gap-1">
                  {childItems.map((child) => (
                    <Link
                      key={child.id}
                      href={`/items/${child.id}`}
                      className="grid grid-cols-[16px_80px_minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-surface-2"
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
                      <span className="text-[11.5px] text-fg-4">
                        {child.targetDate || child.dueDate
                          ? formatDetailDate(child.targetDate ?? child.dueDate)
                          : "—"}
                      </span>
                      {child.assigneeId ? (
                        <WorkItemAssigneeAvatar
                          user={getUser(data, child.assigneeId)}
                          className="shrink-0"
                        />
                      ) : (
                        <span />
                      )}
                    </Link>
                  ))}
                  {childComposerOpen ? (
                    <div className="mt-1 rounded-md border border-line">
                      <InlineChildIssueComposer
                        teamId={currentItem.teamId}
                        parentItem={currentItem}
                        disabled={!editable}
                        onCancel={() => setChildComposerOpen(false)}
                        onCreated={() => setChildComposerOpen(false)}
                      />
                    </div>
                  ) : null}
                </div>
              </DetailSidebarSection>

              {linkedProjects.length > 0 || linkedDocuments.length > 0 || selectedProject ? (
                <DetailSidebarSection title="Relations">
                  <div className="flex flex-col gap-1.5">
                    {selectedProject ? (
                      <Link
                        href={getProjectHref(data, selectedProject) ?? `/projects/${selectedProject.id}`}
                        className={cn(detailChipClassName, "w-fit hover:bg-surface-3")}
                      >
                        <FolderSimple className="size-3" />
                        <span>Project</span>
                        <b className="font-medium text-foreground">{selectedProject.name}</b>
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

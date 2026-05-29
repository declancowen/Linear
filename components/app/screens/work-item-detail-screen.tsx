"use client"

import type { Editor } from "@tiptap/react"
import { format, formatDistanceToNow } from "date-fns"
import {
  AppLink,
  type AppRouter,
  useAppRouter,
} from "@/lib/browser/app-navigation"
import { getAppOrigin } from "@/lib/auth-routing"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react"
import { useShallow } from "zustand/react/shallow"
import {
  CalendarBlank,
  CaretDown,
  CaretRight,
  CircleDashed,
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
  Trash,
  X,
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
  workItemTitleConstraints,
} from "@/lib/domain/input-constraints"
import { createWorkItemDetailScopeKey } from "@/lib/scoped-sync/scope-keys"
import {
  applyViewerViewConfig,
  getViewerScopedViewKey,
} from "@/lib/domain/viewer-view-config"
import {
  buildItemGroups,
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
  workItemMatchesView,
} from "@/lib/domain/selectors"
import {
  getRootComments,
  groupCommentsByParentId,
} from "@/lib/domain/comment-threads"
import { isCustomPropertyDefinitionForWorkItem } from "@/lib/domain/labels"
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
  type ViewDefinition,
  type WorkItem,
} from "@/lib/domain/types"
import { RichTextContent } from "@/components/app/rich-text-content"
import { useAppStore } from "@/lib/store/app-store"
import {
  formatTimeZoneLabel,
  getSupportedTimeZones,
  normalizeTimeZone,
} from "@/lib/time-zone"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { DetailSidebarLabelsRow } from "@/components/app/screens/detail-sidebar-labels-row"
import {
  detailChipClassName,
  renderDetailSidebarTerm,
  renderDetailSidebarValueButton,
} from "@/components/app/screens/detail-sidebar-primitives"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { ShortcutKeys } from "@/components/app/shortcut-keys"
import { UserAvatar } from "@/components/app/user-presence"
import { Button } from "@/components/ui/button"
import { CollapsibleRightSidebar } from "@/components/ui/collapsible-right-sidebar"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  CustomPropertyDefinitionDialog,
  CustomPropertyValueControl,
} from "@/components/app/screens/custom-property-controls"
import { PhosphorIconGlyph } from "@/components/app/phosphor-icon-picker"
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

import { CollaborationSyncDialog } from "./collaboration-sync-dialog"
import { DocumentPresenceAvatarGroup } from "./document-ui"
import { useLegacyPresenceHeartbeat } from "./legacy-presence-heartbeat"
import { InlineWorkItemPropertyControl } from "./work-item-inline-property-control"
import {
  getEligibleParentWorkItems,
  createEmptyViewFilters,
  getTeamProjectOptions,
  getWorkItemPresenceSessionId,
  selectAppDataSnapshot,
  type ViewFilterKey,
} from "./helpers"
import {
  MissingState,
  PROPERTY_SELECT_SEPARATOR_VALUE,
  PriorityIcon,
  StatusIcon,
  buildPropertyStatusOptions,
  getSelectedPropertySelectOption,
  type PropertySelectCommonProps,
  type PropertySelectOption,
} from "./shared"
import {
  WORK_ITEM_COMMENT_SHORTCUT_KEY_CLASS,
  CommentReactionButtons,
  InlineChildIssueComposer,
  WorkItemAssigneeAvatar,
  WorkItemCommentComposerActions,
} from "./work-item-ui"
import { useCommentComposer } from "./use-comment-composer"
import { useWorkItemProjectCascadeConfirmation } from "./use-work-item-project-cascade-confirmation"
import { formatWorkItemDetailDate } from "./date-presentation"
import {
  FilterPopover,
  GroupChipPopover,
  PropertiesChipPopover,
  type ViewConfigPatch,
} from "./work-surface-controls"
import { getGroupValueLabel } from "./work-surface-view/shared"
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
  "inline-grid size-6 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground disabled:cursor-default disabled:opacity-60"

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
  collapsible = false,
  children,
}: {
  title: string
  count?: string
  action?: ReactNode
  collapsible?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  const headerContent = (
    <>
      {collapsible ? (
        open ? (
          <CaretDown className="size-3 text-fg-4" />
        ) : (
          <CaretRight className="size-3 text-fg-4" />
        )
      ) : null}
      <span>{title}</span>
      {count ? <span className="font-medium text-fg-4">· {count}</span> : null}
    </>
  )

  return (
    <section className="mt-7">
      <div className="mb-2.5 flex items-center gap-2 text-[11.5px] font-semibold tracking-[0.05em] text-fg-3 uppercase">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            className="flex min-w-0 items-center gap-1.5 text-left transition-colors hover:text-foreground"
            onClick={() => setOpen((current) => !current)}
          >
            {headerContent}
          </button>
        ) : (
          headerContent
        )}
        {action ? (
          <div className="ml-auto text-[11.5px] font-medium tracking-normal text-fg-3 normal-case">
            {action}
          </div>
        ) : null}
      </div>
      {open ? children : null}
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
      {renderDetailSidebarTerm(label, icon)}
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
} & PropertySelectCommonProps) {
  const [open, setOpen] = useState(false)
  const selectedOption = getSelectedPropertySelectOption(options, value)
  const selectedValue = selectedOption?.value ?? value
  const selectedLabel = selectedOption?.label ?? value

  return (
    <>
      {renderDetailSidebarTerm(label, icon)}
      <dd className="m-0">
        <Popover open={disabled ? false : open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {renderDetailSidebarValueButton({
              disabled,
              label,
              children: (
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {renderValue ? (
                    renderValue(selectedValue, selectedLabel)
                  ) : (
                    <span className="truncate">{selectedLabel}</span>
                  )}
                </span>
              ),
            })}
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[280px] overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-lg"
          >
            <div className="no-scrollbar flex max-h-[320px] flex-col gap-0.5 overflow-y-auto">
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
                      "flex min-h-8 w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[12px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground",
                      option.value === selectedValue &&
                        "bg-primary/10 text-foreground"
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
  timeValue,
  timeZoneOptions,
  timeZoneValue,
  onValueChange,
  onTimeValueChange,
  onTimeZoneValueChange,
  disabled,
}: {
  label: string
  icon: ReactNode
  value: string | null
  timeValue?: string | null
  timeZoneOptions?: DetailSelectOption[]
  timeZoneValue?: string | null
  onValueChange: (value: string | null) => void
  onTimeValueChange?: (value: string | null) => void
  onTimeZoneValueChange?: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {renderDetailSidebarTerm(label, icon)}
      <dd className="m-0">
        <Popover open={disabled ? false : open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {renderDetailSidebarValueButton({
              disabled,
              label,
              children: (
                <>
                  <span
                    className={cn("min-w-0 truncate", !value && "text-fg-4")}
                  >
                    {value ? formatDetailDate(value) : "Set date"}
                  </span>
                  {timeValue ? (
                    <span className="shrink-0 text-[11.5px] text-fg-3">
                      {timeValue}
                    </span>
                  ) : null}
                  <CaretDown className="ml-auto size-3 shrink-0 text-fg-4" />
                </>
              ),
            })}
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
              {onTimeValueChange ? (
                <Input
                  type="time"
                  value={timeValue ?? ""}
                  onChange={(event) =>
                    onTimeValueChange(event.target.value || null)
                  }
                  className="h-8"
                />
              ) : null}
              {timeZoneValue && timeZoneOptions && onTimeZoneValueChange ? (
                <select
                  value={timeZoneValue}
                  onChange={(event) =>
                    onTimeZoneValueChange(event.target.value)
                  }
                  className="h-8 w-full rounded-md border border-line bg-background px-3 pr-8 text-[12px] text-foreground outline-none"
                  aria-label={`${label} time zone`}
                >
                  {timeZoneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="flex justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!value}
                  onClick={() => {
                    onValueChange(null)
                    onTimeValueChange?.(null)
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

const DETAIL_CHILD_DEFAULT_DISPLAY_PROPS: ViewDefinition["displayProps"] = [
  "status",
  "priority",
  "assignee",
  "project",
]

function getDetailChildDisplayProps(
  displayProps: ViewDefinition["displayProps"] | undefined,
  variant: "main" | "sidebar"
) {
  return (
    displayProps ??
    (variant === "sidebar" ? [] : DETAIL_CHILD_DEFAULT_DISPLAY_PROPS)
  )
}

function getDetailChildCustomPropertyEntries({
  data,
  item,
  selectedDisplayProps,
}: {
  data: AppData
  item: WorkItem
  selectedDisplayProps: ViewDefinition["displayProps"]
}) {
  return data.customPropertyDefinitions
    .filter((definition) =>
      selectedDisplayProps.includes(`custom:${definition.id}`)
    )
    .filter((definition) =>
      isCustomPropertyDefinitionForWorkItem(
        definition,
        item,
        data.currentUserId
      )
    )
    .map((definition) => ({
      definition,
      value:
        data.customPropertyValues.find(
          (entry) =>
            entry.workItemId === item.id && entry.propertyId === definition.id
        ) ?? null,
    }))
    .filter((entry) => entry.value !== null)
}

function DetailChildPropertyChips({
  data,
  item,
  selectedDisplayProps,
}: {
  data: AppData
  item: WorkItem
  selectedDisplayProps: ViewDefinition["displayProps"]
}) {
  const customPropertyEntries = getDetailChildCustomPropertyEntries({
    data,
    item,
    selectedDisplayProps,
  })
  const showMainAssignee =
    (item.visibility ?? "team") !== "private" && item.assigneeId !== null
  const showMainPriority = item.priority !== "none"
  const showMainProject =
    (item.visibility ?? "team") !== "private" && item.primaryProjectId !== null

  if (selectedDisplayProps.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selectedDisplayProps.includes("status") ? (
        <InlineWorkItemPropertyControl
          data={data}
          item={item}
          property="status"
          variant="child"
        />
      ) : null}
      {selectedDisplayProps.includes("priority") && showMainPriority ? (
        <InlineWorkItemPropertyControl
          data={data}
          item={item}
          property="priority"
          variant="child"
        />
      ) : null}
      {selectedDisplayProps.includes("assignee") && showMainAssignee ? (
        <InlineWorkItemPropertyControl
          data={data}
          item={item}
          property="assignee"
          variant="child"
        />
      ) : null}
      {selectedDisplayProps.includes("project") && showMainProject ? (
        <InlineWorkItemPropertyControl
          data={data}
          item={item}
          property="project"
          variant="child"
        />
      ) : null}
      {selectedDisplayProps.includes("dueDate") && item.dueDate ? (
        <span className={detailChipClassName}>
          <CalendarBlank className="size-3" />
          {format(new Date(item.dueDate), "MMM d")}
        </span>
      ) : null}
      {customPropertyEntries.map(({ definition, value }) => (
        <CustomPropertyValueControl
          key={definition.id}
          data={data}
          definition={definition}
          item={item}
          value={value}
          editable={false}
          variant="chip"
        />
      ))}
    </div>
  )
}

function DetailChildWorkItemRow({
  data,
  displayProps,
  item,
  variant = "main",
}: {
  data: AppData
  displayProps?: ViewDefinition["displayProps"]
  item: WorkItem
  variant?: "main" | "sidebar"
}) {
  const childDone = item.status === "done"
  const selectedDisplayProps = getDetailChildDisplayProps(displayProps, variant)

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md py-1.5 transition-colors hover:bg-surface-2",
        variant === "sidebar" ? "gap-y-1.5 px-2" : "gap-y-2 px-4"
      )}
    >
      <AppLink
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
      </AppLink>
      <DetailChildPropertyChips
        data={data}
        item={item}
        selectedDisplayProps={selectedDisplayProps}
      />
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
            <CommentReactionButtons
              activeClassName="border-transparent bg-accent-bg text-accent-fg"
              buttonClassName="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors"
              comment={comment}
              currentUserId={currentUserId}
              disabled={!editable}
              inactiveClassName="border-line bg-surface-2 text-fg-2 hover:bg-surface-3"
            />
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

function getWorkItemActivityContext(input: {
  currentUserId: string
  data: AppData
  item: WorkItem
}) {
  const comments = getCommentsForTarget(input.data, "workItem", input.item.id)
  const rootComments = getRootComments(comments)
  const repliesByParentId = groupCommentsByParentId(comments)

  return {
    assignee: input.item.assigneeId
      ? getUser(input.data, input.item.assigneeId)
      : null,
    creator: getUser(input.data, input.item.creatorId),
    mentionCandidates: getTeamMembers(input.data, input.item.teamId).filter(
      (candidate) => candidate.id !== input.currentUserId
    ),
    repliesByParentId,
    rootComments,
  }
}

function useWorkItemCommentComposer(itemId: string) {
  return useCommentComposer("workItem", itemId)
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
  const {
    assignee,
    creator,
    mentionCandidates,
    repliesByParentId,
    rootComments,
  } = getWorkItemActivityContext({ currentUserId, data, item })
  const {
    commentEditorRef,
    commentLimitState,
    content,
    handleComment,
    setContent,
  } = useWorkItemCommentComposer(item.id)

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
      <MainActivityCommentHeader
        author={author}
        comment={comment}
        nested={nested}
      />
      <div className="px-3.5 pt-1 pb-3">
        <RichTextContent
          content={comment.content}
          className="text-[13px] leading-[1.6] text-fg-2 [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:my-1 [&_ul]:ml-4 [&_ul]:list-disc"
        />
      </div>
      <MainActivityCommentFooter
        comment={comment}
        currentUserId={currentUserId}
        editable={editable}
        replyOpen={replyOpen}
        onToggleReply={() => setReplyOpen((current) => !current)}
      />
      <MainActivityCommentReplies
        data={data}
        replies={replies}
        repliesByParentId={repliesByParentId}
        currentUserId={currentUserId}
        editable={editable}
        mentionCandidates={mentionCandidates}
      />

      {replyOpen ? (
        <MainActivityReplyComposer
          editable={editable}
          mentionCandidates={mentionCandidates}
          replyContent={replyContent}
          replyEditorRef={replyEditorRef}
          replyLimitState={replyLimitState}
          onCancel={() => {
            setReplyContent("")
            setReplyOpen(false)
          }}
          onReply={handleReply}
          onReplyContentChange={setReplyContent}
        />
      ) : null}
    </article>
  )
}

function MainActivityCommentHeader({
  author,
  comment,
  nested,
}: {
  author: AppData["users"][number] | null | undefined
  comment: AppData["comments"][number]
  nested: boolean
}) {
  return (
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
  )
}

function MainActivityCommentFooter({
  comment,
  currentUserId,
  editable,
  replyOpen,
  onToggleReply,
}: {
  comment: AppData["comments"][number]
  currentUserId: string
  editable: boolean
  replyOpen: boolean
  onToggleReply: () => void
}) {
  if (comment.reactions.length === 0 && !editable) {
    return null
  }

  return (
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
              useAppStore.getState().toggleCommentReaction(comment.id, emoji)
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
            onClick={onToggleReply}
          >
            {replyOpen ? "Cancel reply" : "Reply"}
          </button>
        </>
      ) : null}
    </footer>
  )
}

function MainActivityCommentReplies({
  data,
  replies,
  repliesByParentId,
  currentUserId,
  editable,
  mentionCandidates,
}: {
  data: AppData
  replies: AppData["comments"]
  repliesByParentId: Record<string, AppData["comments"]>
  currentUserId: string
  editable: boolean
  mentionCandidates: AppData["users"]
}) {
  if (replies.length === 0) {
    return null
  }

  return (
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
  )
}

function MainActivityReplyComposer({
  editable,
  mentionCandidates,
  replyContent,
  replyEditorRef,
  replyLimitState,
  onCancel,
  onReply,
  onReplyContentChange,
}: {
  editable: boolean
  mentionCandidates: AppData["users"]
  replyContent: string
  replyEditorRef: MutableRefObject<Editor | null>
  replyLimitState: ReturnType<typeof getTextInputLimitState>
  onCancel: () => void
  onReply: () => void
  onReplyContentChange: (content: string) => void
}) {
  return (
    <div className="border-t border-line-soft bg-background px-3.5 py-3">
      <div className="rounded-lg border border-line bg-surface transition-colors focus-within:border-fg-3">
        <div className="px-3 py-2">
          <RichTextEditor
            content={replyContent}
            onChange={onReplyContentChange}
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
            onSubmitShortcut={onReply}
            submitOnEnter
            className="[&_.ProseMirror]:min-h-[2.5rem] [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-[1.55]"
          />
        </div>
        <div className="border-t border-dashed border-line px-3 py-1.5">
          <WorkItemCommentComposerActions
            editable={editable}
            editorRef={replyEditorRef}
            emojiButtonClassName="rounded-md p-1 text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground disabled:text-fg-4 disabled:hover:bg-transparent"
            emojiIconClassName="size-3.5"
            limitState={replyLimitState}
          >
            <div className="flex items-center gap-2">
              <ShortcutKeys
                keys={["Enter"]}
                keyClassName={WORK_ITEM_COMMENT_SHORTCUT_KEY_CLASS}
              />
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!replyLimitState.canSubmit}
                onClick={onReply}
              >
                Reply
              </Button>
            </div>
          </WorkItemCommentComposerActions>
        </div>
      </div>
    </div>
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
  const {
    assignee,
    creator,
    mentionCandidates,
    repliesByParentId,
    rootComments,
  } = getWorkItemActivityContext({ currentUserId, data, item })
  const currentUser = getUser(data, currentUserId)
  const {
    commentEditorRef,
    commentLimitState,
    content,
    handleComment,
    setContent,
  } = useWorkItemCommentComposer(item.id)

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
            <WorkItemCommentComposerActions
              editable={editable}
              editorRef={commentEditorRef}
              emojiButtonClassName="rounded-md p-1 text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground disabled:text-fg-4 disabled:hover:bg-transparent"
              limitState={commentLimitState}
            >
              <div className="flex items-center gap-2">
                <ShortcutKeys
                  keys={["Enter"]}
                  keyClassName={WORK_ITEM_COMMENT_SHORTCUT_KEY_CLASS}
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
            </WorkItemCommentComposerActions>
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

type DetailSelectOption = PropertySelectOption
type DetailPropertyChangeHandlers = {
  onStatusChange: (value: string) => void
  onPriorityChange: (value: string) => void
  onAssigneeChange: (value: string) => void
  onStartDateChange: (value: string | null) => void
  onStartTimeChange: (value: string | null) => void
  onEndDateChange: (value: string | null) => void
  onEndTimeChange: (value: string | null) => void
  onScheduleTimeZoneChange: (value: string) => void
  onProjectChange: (value: string) => void
  onParentChange: (value: string) => void
}

function renderSidebarAssigneeOption(
  value: string,
  optionLabel: string,
  teamMembers: UserProfile[],
  compact: boolean
) {
  if (value === "unassigned") {
    return (
      <span className={compact ? "truncate" : undefined}>{optionLabel}</span>
    )
  }

  const selectedUser = teamMembers.find((user) => user.id === value) ?? null

  return selectedUser ? (
    <div className={cn("flex items-center gap-2", compact && "min-w-0")}>
      <WorkItemAssigneeAvatar
        user={selectedUser}
        className="data-[size=sm]:size-4"
      />
      <span className={compact ? "truncate" : undefined}>
        {selectedUser.name}
      </span>
    </div>
  ) : (
    <span className={compact ? "truncate" : undefined}>{optionLabel}</span>
  )
}

function WorkItemSidebarAssigneeRow({
  currentItem,
  disabled,
  teamMembers,
  onAssigneeChange,
}: {
  currentItem: WorkItem
  disabled: boolean
  teamMembers: UserProfile[]
  onAssigneeChange: (value: string) => void
}) {
  if ((currentItem.visibility ?? "team") === "private") {
    return null
  }

  return (
    <DetailSidebarSelectRow
      label="Assignee"
      icon={<Plus className="size-[13px]" />}
      value={currentItem.assigneeId ?? "unassigned"}
      disabled={disabled}
      options={[
        { value: "unassigned", label: "Assign" },
        ...teamMembers.map((user) => ({
          value: user.id,
          label: user.name,
        })),
      ]}
      renderValue={(value, optionLabel) =>
        renderSidebarAssigneeOption(value, optionLabel, teamMembers, true)
      }
      renderOption={(value, optionLabel) =>
        renderSidebarAssigneeOption(value, optionLabel, teamMembers, false)
      }
      onValueChange={onAssigneeChange}
    />
  )
}

function WorkItemSidebarScheduleRows({
  currentItem,
  data,
  displayedEndDate,
  disabled,
  onEndDateChange,
  onEndTimeChange,
  onScheduleTimeZoneChange,
  onStartDateChange,
  onStartTimeChange,
}: {
  currentItem: WorkItem
  data: AppData
  displayedEndDate: string | null
  disabled: boolean
  onEndDateChange: (value: string | null) => void
  onEndTimeChange: (value: string | null) => void
  onScheduleTimeZoneChange: (value: string) => void
  onStartDateChange: (value: string | null) => void
  onStartTimeChange: (value: string | null) => void
}) {
  const scheduleTimeZone = getResolvedWorkItemScheduleTimeZone(
    data,
    currentItem
  )
  const timeZoneOptions = getSupportedTimeZones().map((timeZone) => ({
    value: timeZone,
    label: formatTimeZoneLabel(timeZone),
  }))

  return (
    <>
      <DetailSidebarDateRow
        label="Start"
        icon={<Clock className="size-[13px]" />}
        value={currentItem.startDate}
        timeValue={currentItem.startTime ?? null}
        timeZoneValue={scheduleTimeZone}
        timeZoneOptions={timeZoneOptions}
        disabled={disabled}
        onValueChange={onStartDateChange}
        onTimeValueChange={onStartTimeChange}
        onTimeZoneValueChange={onScheduleTimeZoneChange}
      />
      <DetailSidebarDateRow
        label="Due"
        icon={<CalendarBlank className="size-[13px]" />}
        value={displayedEndDate}
        timeValue={currentItem.endTime ?? null}
        timeZoneValue={scheduleTimeZone}
        timeZoneOptions={timeZoneOptions}
        disabled={disabled}
        onValueChange={onEndDateChange}
        onTimeValueChange={onEndTimeChange}
        onTimeZoneValueChange={onScheduleTimeZoneChange}
      />
    </>
  )
}

function WorkItemSidebarProjectRow({
  currentItem,
  disabled,
  teamProjects,
  onProjectChange,
}: {
  currentItem: WorkItem
  disabled: boolean
  teamProjects: Project[]
  onProjectChange: (value: string) => void
}) {
  if ((currentItem.visibility ?? "team") === "private") {
    return null
  }

  return (
    <DetailSidebarSelectRow
      label="Project"
      icon={<FolderSimple className="size-[13px]" />}
      value={currentItem.primaryProjectId ?? "none"}
      disabled={disabled}
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
  )
}

function WorkItemSidebarMilestoneRow({
  selectedMilestone,
}: {
  selectedMilestone: Milestone | null
}) {
  if (!selectedMilestone) {
    return null
  }

  return (
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
  )
}

function WorkItemSidebarParentRow({
  currentItem,
  disabled,
  parentOptions,
  onParentChange,
}: {
  currentItem: WorkItem
  disabled: boolean
  parentOptions: DetailSelectOption[]
  onParentChange: (value: string) => void
}) {
  if (!currentItem.parentId && parentOptions.length <= 1) {
    return null
  }

  return (
    <DetailSidebarSelectRow
      label="Parent"
      icon={<FolderSimple className="size-[13px]" />}
      value={currentItem.parentId ?? "none"}
      disabled={disabled}
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
  )
}

function getWorkItemSidebarCustomPropertyDefinitions(
  data: AppData,
  currentItem: WorkItem
) {
  return data.customPropertyDefinitions
    .filter((definition) =>
      isCustomPropertyDefinitionForWorkItem(
        definition,
        currentItem,
        data.currentUserId
      )
    )
    .sort((left, right) => left.name.localeCompare(right.name))
}

function WorkItemSidebarCustomPropertyRows({
  currentItem,
  customPropertyDefinitions,
  data,
  editable,
}: {
  currentItem: WorkItem
  customPropertyDefinitions: AppData["customPropertyDefinitions"]
  data: AppData
  editable: boolean
}) {
  return customPropertyDefinitions.map((definition) => (
    <div key={definition.id} className="contents">
      {renderDetailSidebarTerm(
        definition.name,
        <PhosphorIconGlyph icon={definition.icon} className="size-[13px]" />
      )}
      <dd className="flex min-w-0 items-center">
        <CustomPropertyValueControl
          data={data}
          definition={definition}
          item={currentItem}
          value={
            data.customPropertyValues.find(
              (entry) =>
                entry.workItemId === currentItem.id &&
                entry.propertyId === definition.id
            ) ?? null
          }
          editable={editable}
        />
      </dd>
    </div>
  ))
}

function WorkItemSidebarAddPropertyRow({
  disabled,
  team,
  onOpen,
}: {
  disabled: boolean
  team: Team | null
  onOpen: () => void
}) {
  if (!team) {
    return null
  }

  return (
    <div className="contents">
      {renderDetailSidebarTerm("Properties", <Plus className="size-[13px]" />)}
      <dd>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed border-line px-2 text-[12px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground disabled:opacity-60"
          onClick={onOpen}
        >
          <Plus className="size-3.5" />
          Add property
        </button>
      </dd>
    </div>
  )
}

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
type DetailRouter = AppRouter
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
  if ((currentItem.visibility ?? "team") === "private") {
    return null
  }

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
  if ((currentItem.visibility ?? "team") === "private") {
    return []
  }

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
  sidebarTitle,
  team,
}: {
  currentItem: WorkItem
  data: AppData
  editable: boolean
  mainSection?: ReturnType<typeof useWorkItemMainSectionController>
  sidebarTitle?: string
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
    sidebarTitle: mainSection
      ? getWorkItemSidebarTitle({ currentItem, mainSection })
      : (sidebarTitle ?? currentItem.title),
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

function getResolvedWorkItemScheduleTimeZone(
  data: AppData,
  currentItem: WorkItem
) {
  const currentUser = getUser(data, data.currentUserId)

  return normalizeTimeZone(
    currentItem.scheduleTimeZone,
    currentUser?.preferences.timeZone
  )
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

function getWorkItemDetailPropertyHandlers({
  currentItem,
  displayedEndDate,
  requestConfirmedWorkItemUpdate,
  scheduleTimeZone,
}: {
  currentItem: WorkItem
  displayedEndDate: string | null
  requestConfirmedWorkItemUpdate: DetailRequestWorkItemUpdate
  scheduleTimeZone: string
}): DetailPropertyChangeHandlers {
  return {
    onStatusChange: (value) =>
      useAppStore.getState().updateWorkItem(currentItem.id, {
        status: value as WorkItem["status"],
      }),
    onPriorityChange: (value) =>
      useAppStore.getState().updateWorkItem(currentItem.id, {
        priority: value as Priority,
      }),
    onAssigneeChange: (value) =>
      useAppStore.getState().updateWorkItem(currentItem.id, {
        assigneeId: value === "unassigned" ? null : value,
      }),
    onStartDateChange: (nextStartDate) =>
      updateWorkItemStartDate({
        currentItem,
        displayedEndDate,
        nextStartDate,
      }),
    onStartTimeChange: (nextStartTime) =>
      useAppStore.getState().updateWorkItem(currentItem.id, {
        startTime: nextStartTime,
        ...(nextStartTime && currentItem.scheduleTimeZone !== scheduleTimeZone
          ? { scheduleTimeZone }
          : {}),
      }),
    onEndDateChange: (nextEndDate) =>
      updateWorkItemEndDate({ currentItem, nextEndDate }),
    onEndTimeChange: (nextEndTime) =>
      useAppStore.getState().updateWorkItem(currentItem.id, {
        endTime: nextEndTime,
        ...(nextEndTime && currentItem.scheduleTimeZone !== scheduleTimeZone
          ? { scheduleTimeZone }
          : {}),
      }),
    onScheduleTimeZoneChange: (nextTimeZone) =>
      useAppStore.getState().updateWorkItem(currentItem.id, {
        scheduleTimeZone: nextTimeZone,
      }),
    onProjectChange: (value) =>
      requestWorkItemProjectChange({
        currentItem,
        requestConfirmedWorkItemUpdate,
        value,
      }),
    onParentChange: (value) =>
      requestWorkItemParentChange({
        currentItem,
        requestConfirmedWorkItemUpdate,
        value,
      }),
  }
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

function getCurrentRoutePath() {
  if (window.location.protocol === "file:" && window.location.hash) {
    const hashPath = window.location.hash.slice(1)
    return hashPath.startsWith("/") ? hashPath : `/${hashPath}`
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function getCopyableCurrentItemLink() {
  if (window.electronApp?.isElectron) {
    return new URL(getCurrentRoutePath(), getAppOrigin()).toString()
  }

  return window.location.href
}

async function writeClipboardText(value: string) {
  if (window.electronApp?.writeClipboardText) {
    const didWrite = await window.electronApp.writeClipboardText(value)

    if (!didWrite) {
      throw new Error("Failed to copy item link")
    }

    return
  }

  await navigator.clipboard.writeText(value)
}

async function copyCurrentItemLink() {
  try {
    await writeClipboardText(getCopyableCurrentItemLink())
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
  const [legacyActiveBlockId, setLegacyActiveBlockId] = useState<string | null>(
    null
  )
  const legacyActiveBlockIdRef = useRef<string | null>(null)
  const hasLiveDescriptionPresence = collaborationLifecycle === "attached"
  const { presenceViewers: workItemPresenceViewers, sendLegacyPresenceRef } =
    useLegacyPresenceHeartbeat({
      activeId: activeItemId,
      activeBlockIdRef: legacyActiveBlockIdRef,
      clearErrorMessage: "Failed to clear work item presence",
      clearPresence: syncClearWorkItemPresence,
      collaborationLifecycle,
      currentUserId,
      heartbeatErrorMessage: "Failed to sync work item presence",
      heartbeatIntervalMs: WORK_ITEM_PRESENCE_HEARTBEAT_INTERVAL_MS,
      heartbeatPresence: syncHeartbeatWorkItemPresence,
      getSessionId: getWorkItemPresenceSessionId,
    })

  useEffect(() => {
    if (!activeItemId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- route changes must clear the previous legacy presence target.
      setLegacyActiveBlockId(null)
      legacyActiveBlockIdRef.current = null
    }
  }, [activeItemId])

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
    sendLegacyPresenceRef,
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
  parentItem,
  team,
}: {
  currentItem: WorkItem
  parentItem: WorkItem | null
  team: Team | null
}) {
  return (
    <nav
      aria-label="Work item breadcrumb"
      className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] text-fg-2"
    >
      <SidebarTrigger className="size-5 shrink-0" />
      <span className="mr-2 font-mono text-[12px] text-fg-3">
        {currentItem.key}
      </span>
      <AppLink
        href={`/team/${team?.slug}/work`}
        className="shrink-0 text-fg-3 hover:text-foreground"
      >
        {team?.name}
      </AppLink>
      <CaretRight className="size-3 shrink-0 text-fg-4" />
      {parentItem ? (
        <>
          <AppLink
            href={`/items/${parentItem.id}`}
            title={parentItem.title}
            className="max-w-[18rem] min-w-0 truncate text-fg-2 hover:text-foreground"
          >
            {parentItem.title}
          </AppLink>
          <CaretRight className="size-3 shrink-0 text-fg-4" />
        </>
      ) : null}
      <span aria-current="page" className="min-w-0 truncate">
        {currentItem.title}
      </span>
    </nav>
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
  parentItem,
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
  parentItem: WorkItem | null
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
      <WorkItemDetailBreadcrumb
        currentItem={currentItem}
        parentItem={parentItem}
        team={team}
      />
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
      <AppLink
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
      </AppLink>
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
  data,
  currentItem,
  childItems,
  childProgress,
  childCopy,
  canCreateChildItem,
  open,
  mainChildComposerOpen,
  onToggleOpen,
  onToggleComposer,
}: {
  data: AppData
  currentItem: WorkItem
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
      <div className="ml-auto flex items-center gap-1.5">
        <WorkItemSubitemFilterButton
          data={data}
          currentItem={currentItem}
          childItems={childItems}
        />
        <WorkItemSubitemGroupButton data={data} currentItem={currentItem} />
        <WorkItemSubitemPropertiesButton
          data={data}
          currentItem={currentItem}
        />
        {canCreateChildItem ? (
          <Button
            size="icon-sm"
            variant={mainChildComposerOpen ? "outline" : "ghost"}
            aria-label={childCopy.addChildLabel}
            onClick={onToggleComposer}
          >
            <Plus className="size-3.5" />
          </Button>
        ) : null}
      </div>
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
  displayProps,
  view,
}: {
  data: AppData
  childItems: WorkItem[]
  displayProps: ViewDefinition["displayProps"]
  view: ViewDefinition
}) {
  if (childItems.length === 0) {
    return null
  }
  const visibleChildItems = childItems.filter((child) =>
    workItemMatchesView(data, child, view)
  )

  if (visibleChildItems.length === 0) {
    return (
      <div className="px-4 py-3 text-[12.5px] text-fg-3">
        No child items match these filters.
      </div>
    )
  }
  const groups = buildItemGroups(data, visibleChildItems, view)

  return (
    <ul className="flex flex-col">
      {[...groups.entries()].map(([groupName, subgroups]) => {
        const groupItems = Array.from(subgroups.values()).flat()

        return (
          <li
            key={groupName}
            className="border-b border-line-soft last:border-b-0"
          >
            <div className="flex items-center gap-2 border-b border-line-soft bg-surface-2/40 px-4 py-1.5 text-[11px] font-medium text-fg-3">
              <span>{getGroupValueLabel(view.grouping, groupName)}</span>
              <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10px] tabular-nums">
                {groupItems.length}
              </span>
            </div>
            <ul className="flex flex-col divide-y divide-line-soft">
              {groupItems.map((child) => (
                <li key={child.id}>
                  <DetailChildWorkItemRow
                    data={data}
                    item={child}
                    displayProps={displayProps}
                    variant="main"
                  />
                </li>
              ))}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}

function isWorkDetailSubitemGroupField(field: ViewDefinition["grouping"]) {
  return WORK_DETAIL_SUBITEM_GROUP_OPTIONS.some((option) => option === field)
}

function patchWorkDetailSubitemViewConfig(patch: ViewConfigPatch) {
  const nextPatch: ViewConfigPatch = {
    ...patch,
    subGrouping: null,
  }

  if (
    nextPatch.grouping &&
    !isWorkDetailSubitemGroupField(nextPatch.grouping)
  ) {
    delete nextPatch.grouping
  }

  useAppStore
    .getState()
    .patchViewerViewConfig(
      WORK_DETAIL_SUBITEM_SURFACE_KEY,
      WORK_DETAIL_SUBITEM_VIEW_ID,
      nextPatch
    )
}

function WorkItemSubitemFilterButton({
  data,
  currentItem,
  childItems,
}: {
  data: AppData
  currentItem: WorkItem
  childItems: WorkItem[]
}) {
  const view = getWorkDetailSubitemView(data, currentItem)

  return (
    <FilterPopover
      view={view}
      items={childItems}
      hiddenFilters={WORK_DETAIL_SUBITEM_HIDDEN_FILTERS}
      onToggleFilterValue={(key, value) =>
        useAppStore
          .getState()
          .toggleViewerViewFilterValue(
            WORK_DETAIL_SUBITEM_SURFACE_KEY,
            WORK_DETAIL_SUBITEM_VIEW_ID,
            key,
            value
          )
      }
      onClearFilters={() =>
        useAppStore
          .getState()
          .clearViewerViewFilters(
            WORK_DETAIL_SUBITEM_SURFACE_KEY,
            WORK_DETAIL_SUBITEM_VIEW_ID
          )
      }
      variant="chip"
      chipTone="default"
    />
  )
}

function WorkItemSubitemGroupButton({
  data,
  currentItem,
}: {
  data: AppData
  currentItem: WorkItem
}) {
  const view = getWorkDetailSubitemView(data, currentItem)

  return (
    <GroupChipPopover
      view={view}
      groupOptions={WORK_DETAIL_SUBITEM_GROUP_OPTIONS}
      onUpdateView={patchWorkDetailSubitemViewConfig}
      showSubGrouping={false}
    />
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
    <div
      className={cn(
        "flex px-3 py-1.5",
        childItems.length > 0 && "border-t border-line-soft"
      )}
    >
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={childCopy.addChildLabel}
        onClick={onOpenComposer}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
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
  const subitemView = getWorkDetailSubitemView(data, currentItem)

  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-line bg-surface">
      <WorkItemChildItemsHeader
        data={data}
        currentItem={currentItem}
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
          <WorkItemChildRows
            data={data}
            childItems={childItems}
            displayProps={subitemView.displayProps}
            view={subitemView}
          />
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
    <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto">
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
  data,
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
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  onScheduleTimeZoneChange,
  onProjectChange,
  onParentChange,
}: {
  data: AppData
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
} & DetailPropertyChangeHandlers) {
  const [customPropertyDialogOpen, setCustomPropertyDialogOpen] =
    useState(false)
  const customPropertyDefinitions = getWorkItemSidebarCustomPropertyDefinitions(
    data,
    currentItem
  )

  return (
    <>
      <dl className="mt-5 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12.5px]">
        <DetailSidebarSelectRow
          label="Status"
          icon={<CircleDashed className="size-[13px]" />}
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
        <WorkItemSidebarAssigneeRow
          currentItem={currentItem}
          disabled={!sidebarEditable}
          teamMembers={teamMembers}
          onAssigneeChange={onAssigneeChange}
        />
        <WorkItemSidebarScheduleRows
          currentItem={currentItem}
          data={data}
          displayedEndDate={displayedEndDate}
          disabled={!sidebarEditable}
          onEndDateChange={onEndDateChange}
          onEndTimeChange={onEndTimeChange}
          onScheduleTimeZoneChange={onScheduleTimeZoneChange}
          onStartDateChange={onStartDateChange}
          onStartTimeChange={onStartTimeChange}
        />
        <DetailSidebarLabelsRow
          item={currentItem}
          workspaceId={team?.workspaceId}
          labels={availableLabels}
          editable={sidebarEditable}
        />
        <WorkItemSidebarProjectRow
          currentItem={currentItem}
          disabled={!sidebarEditable}
          teamProjects={teamProjects}
          onProjectChange={onProjectChange}
        />
        <WorkItemSidebarMilestoneRow selectedMilestone={selectedMilestone} />
        <WorkItemSidebarParentRow
          currentItem={currentItem}
          disabled={!sidebarEditable}
          parentOptions={parentOptions}
          onParentChange={onParentChange}
        />
        <WorkItemSidebarCustomPropertyRows
          currentItem={currentItem}
          customPropertyDefinitions={customPropertyDefinitions}
          data={data}
          editable={sidebarEditable}
        />
        <WorkItemSidebarAddPropertyRow
          disabled={!sidebarEditable}
          team={team}
          onOpen={() => setCustomPropertyDialogOpen(true)}
        />
      </dl>
      {team ? (
        <CustomPropertyDefinitionDialog
          open={customPropertyDialogOpen}
          scopeType={
            (currentItem.visibility ?? "team") === "private"
              ? "private"
              : "team"
          }
          teamId={team.id}
          onOpenChange={setCustomPropertyDialogOpen}
        />
      ) : null}
    </>
  )
}

const WORK_DETAIL_SUBITEM_SURFACE_KEY = "work-detail:subitems"
const WORK_DETAIL_SUBITEM_VIEW_ID = "work-detail-subitems"
const WORK_DETAIL_SUBITEM_DEFAULT_PROPS: ViewDefinition["displayProps"] = [
  "status",
  "priority",
  "assignee",
  "project",
  "dueDate",
]
const WORK_DETAIL_SUBITEM_GROUP_OPTIONS = [
  "status",
  "assignee",
  "priority",
  "label",
] satisfies ViewDefinition["grouping"][]
const WORK_DETAIL_SUBITEM_HIDDEN_FILTERS = [
  "itemTypes",
  "visibility",
  "teamIds",
  "projectIds",
  "parentIds",
] satisfies ViewFilterKey[]

function getWorkDetailSubitemScope(data: AppData, currentItem: WorkItem) {
  if (currentItem.visibility === "private") {
    return {
      scopeId: data.currentUserId,
      scopeType: "personal" as const,
    }
  }

  return {
    scopeId: currentItem.teamId,
    scopeType: "team" as const,
  }
}

function getWorkDetailSubitemView(
  data: AppData,
  currentItem: WorkItem
): ViewDefinition {
  const key = getViewerScopedViewKey(
    data.currentUserId,
    WORK_DETAIL_SUBITEM_SURFACE_KEY,
    WORK_DETAIL_SUBITEM_VIEW_ID
  )
  const override = data.ui.viewerViewConfigByRoute[key]
  const scope = getWorkDetailSubitemScope(data, currentItem)
  const baseView: ViewDefinition = {
    id: WORK_DETAIL_SUBITEM_VIEW_ID,
    name: "Sub-items",
    description: "",
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
    entityKind: "items",
    route: WORK_DETAIL_SUBITEM_SURFACE_KEY,
    layout: "list",
    grouping: "status",
    subGrouping: null,
    ordering: "priority",
    itemLevel: null,
    showChildItems: false,
    filters: createEmptyViewFilters(),
    displayProps: WORK_DETAIL_SUBITEM_DEFAULT_PROPS,
    hiddenState: { groups: [], subgroups: [] },
    isShared: false,
    createdAt: "",
    updatedAt: "",
  }
  const configuredView = applyViewerViewConfig(baseView, override)

  return {
    ...configuredView,
    grouping: isWorkDetailSubitemGroupField(configuredView.grouping)
      ? configuredView.grouping
      : "status",
    subGrouping: null,
  }
}

function WorkItemSubitemPropertiesButton({
  data,
  currentItem,
}: {
  data: AppData
  currentItem: WorkItem
}) {
  const view = getWorkDetailSubitemView(data, currentItem)

  return (
    <PropertiesChipPopover
      view={view}
      onToggleDisplayProperty={(property) =>
        useAppStore
          .getState()
          .toggleViewerViewDisplayProperty(
            WORK_DETAIL_SUBITEM_SURFACE_KEY,
            WORK_DETAIL_SUBITEM_VIEW_ID,
            property
          )
      }
      onReorderDisplayProperties={(displayProps) =>
        useAppStore
          .getState()
          .reorderViewerViewDisplayProperties(
            WORK_DETAIL_SUBITEM_SURFACE_KEY,
            WORK_DETAIL_SUBITEM_VIEW_ID,
            displayProps
          )
      }
      onClearDisplayProperties={() =>
        useAppStore
          .getState()
          .clearViewerViewDisplayProperties(
            WORK_DETAIL_SUBITEM_SURFACE_KEY,
            WORK_DETAIL_SUBITEM_VIEW_ID
          )
      }
    />
  )
}

function WorkItemSidebarSubtasks({
  data,
  currentItem,
  childItems,
  childProgress,
  editable,
  sidebarChildComposerOpen,
  onCloseComposer,
}: {
  data: AppData
  currentItem: WorkItem
  childItems: WorkItem[]
  childProgress: DetailChildProgress
  editable: boolean
  sidebarChildComposerOpen: boolean
  onCloseComposer: () => void
}) {
  const subitemView = getWorkDetailSubitemView(data, currentItem)

  return (
    <DetailSidebarSection
      title="Subtasks"
      count={`${childProgress.completedChildren} of ${childItems.length || 0}`}
      collapsible
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
            displayProps={subitemView.displayProps}
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
          <AppLink
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
          </AppLink>
        ) : null}
        {linkedProjects.map((project) => (
          <AppLink
            key={project.id}
            href={getProjectHref(data, project) ?? `/projects/${project.id}`}
            className={cn(detailChipClassName, "w-fit hover:bg-surface-3")}
          >
            <FolderSimple className="size-3" />
            <span>Linked project</span>
            <b className="font-medium text-foreground">{project.name}</b>
          </AppLink>
        ))}
        {linkedDocuments.map((document) => (
          <AppLink
            key={document.id}
            href={`/docs/${document.id}`}
            className={cn(detailChipClassName, "w-fit hover:bg-surface-3")}
          >
            <LinkSimple className="size-3" />
            <span>Linked doc</span>
            <b className="font-medium text-foreground">{document.title}</b>
          </AppLink>
        ))}
      </div>
    </DetailSidebarSection>
  )
}

type WorkItemDetailSidebarVariant = "docked" | "floating" | "inline"

function useDeferredDetailSidebarSections({
  enabled,
  itemId,
}: {
  enabled: boolean
  itemId: string
}) {
  const [state, setState] = useState(() => ({
    itemId,
    ready: false,
  }))

  useEffect(() => {
    if (!enabled) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setState({ itemId, ready: true })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [enabled, itemId])

  return enabled && state.itemId === itemId && state.ready
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
  editable,
  sidebarChildComposerOpen,
  linkedProjects,
  linkedDocuments,
  currentUserId,
  variant = "docked",
  headerClassName,
  floatingMaxHeight,
  onCopyItemLink,
  onClose,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  onScheduleTimeZoneChange,
  onProjectChange,
  onParentChange,
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
  editable: boolean
  sidebarChildComposerOpen: boolean
  linkedProjects: Project[]
  linkedDocuments: AppDocument[]
  currentUserId: string
  variant?: WorkItemDetailSidebarVariant
  headerClassName?: string
  floatingMaxHeight?: number
  onCopyItemLink: () => void
  onClose?: () => void
  onCloseChildComposer: () => void
} & DetailPropertyChangeHandlers) {
  const displayedEndDate = currentItem.targetDate ?? currentItem.dueDate
  const showExtendedSections = variant !== "floating"
  const showDeferredExtendedSections = useDeferredDetailSidebarSections({
    enabled: open && showExtendedSections,
    itemId: currentItem.id,
  })

  const content = (
    <>
      <div
        className={cn(
          "flex items-center gap-1 border-b border-line-soft px-3",
          headerClassName ?? "h-9"
        )}
      >
        <span className="mr-2 font-mono text-[12px] text-fg-3">
          {currentItem.key}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-fg-2">
          <StatusIcon status={currentItem.status} />
          <span className="truncate">
            {statusMeta[currentItem.status].label}
          </span>
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
          {onClose ? (
            <button
              type="button"
              className={detailIconButtonClassName}
              aria-label="Close item details"
              onClick={onClose}
            >
              <X className="size-[14px]" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-6 py-[22px]">
        <h2 className="mb-2.5 text-[22px] leading-[1.25] font-semibold tracking-[-0.012em]">
          {sidebarTitle}
        </h2>

        <WorkItemSidebarProperties
          data={data}
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
          onStartTimeChange={onStartTimeChange}
          onEndDateChange={onEndDateChange}
          onEndTimeChange={onEndTimeChange}
          onScheduleTimeZoneChange={onScheduleTimeZoneChange}
          onProjectChange={onProjectChange}
          onParentChange={onParentChange}
        />

        <WorkItemSidebarSubtasks
          data={data}
          currentItem={currentItem}
          childItems={childItems}
          childProgress={childProgress}
          editable={editable}
          sidebarChildComposerOpen={sidebarChildComposerOpen}
          onCloseComposer={onCloseChildComposer}
        />

        {showDeferredExtendedSections ? (
          <>
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
          </>
        ) : null}
      </div>
    </>
  )

  if (variant === "floating") {
    return (
      <aside
        className="flex max-h-[min(680px,calc(100vh-24px))] min-h-0 w-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xl [contain:layout_paint_style]"
        style={floatingMaxHeight ? { maxHeight: floatingMaxHeight } : undefined}
      >
        {content}
      </aside>
    )
  }

  if (variant === "inline") {
    return (
      <aside className="flex h-full min-h-0 w-[26.25rem] shrink-0 flex-col overflow-hidden border-l border-line bg-surface [contain:layout_paint_style]">
        {content}
      </aside>
    )
  }

  return (
    <CollapsibleRightSidebar
      open={open}
      width="26.25rem"
      className="border-l border-line bg-surface"
    >
      {content}
    </CollapsibleRightSidebar>
  )
}

export function WorkItemDetailSidebarSurface({
  data,
  currentItem,
  editable,
  headerClassName,
  open = true,
  variant = "docked",
  floatingMaxHeight,
  onClose,
  onCopyItemLink,
}: {
  data: AppData
  currentItem: WorkItem
  editable: boolean
  headerClassName?: string
  open?: boolean
  variant?: WorkItemDetailSidebarVariant
  floatingMaxHeight?: number
  onClose?: () => void
  onCopyItemLink?: () => void
}) {
  const [sidebarChildComposerOpen, setSidebarChildComposerOpen] =
    useState(false)
  const { requestUpdate: requestConfirmedWorkItemUpdate, confirmationDialog } =
    useWorkItemProjectCascadeConfirmation()
  const team = getTeam(data, currentItem.teamId)
  const detailModel = useMemo(
    () =>
      getWorkItemDetailModel({
        currentItem,
        data,
        editable,
        sidebarTitle: currentItem.title,
        team,
      }),
    [currentItem, data, editable, team]
  )
  const scheduleTimeZone = getResolvedWorkItemScheduleTimeZone(
    data,
    currentItem
  )
  const propertyHandlers = getWorkItemDetailPropertyHandlers({
    currentItem,
    displayedEndDate: detailModel.displayedEndDate,
    requestConfirmedWorkItemUpdate,
    scheduleTimeZone,
  })

  function handleCopyItemLink() {
    if (onCopyItemLink) {
      onCopyItemLink()
      return
    }

    void copyCurrentItemLink()
  }

  return (
    <>
      <WorkItemDetailSidebar
        open={open}
        data={data}
        currentItem={currentItem}
        team={team}
        sidebarTitle={detailModel.sidebarTitle}
        sidebarEditable={detailModel.sidebarEditable}
        statusOptions={detailModel.statusOptions}
        teamMembers={detailModel.teamMembers}
        teamProjects={detailModel.teamProjects}
        selectedProject={detailModel.selectedProject}
        selectedMilestone={detailModel.selectedMilestone}
        availableLabels={detailModel.availableLabels}
        parentOptions={detailModel.parentOptions}
        childItems={detailModel.childItems}
        childProgress={detailModel.childProgress}
        editable={editable}
        sidebarChildComposerOpen={sidebarChildComposerOpen}
        linkedProjects={detailModel.linkedProjects}
        linkedDocuments={detailModel.linkedDocuments}
        currentUserId={data.currentUserId}
        variant={variant}
        headerClassName={headerClassName}
        floatingMaxHeight={floatingMaxHeight}
        onClose={onClose}
        onCopyItemLink={handleCopyItemLink}
        {...propertyHandlers}
        onCloseChildComposer={() => setSidebarChildComposerOpen(false)}
      />
      {confirmationDialog}
    </>
  )
}

export function WorkItemDetailScreen({ itemId }: { itemId: string }) {
  const router = useAppRouter()
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
  const propertyHandlers = getWorkItemDetailPropertyHandlers({
    currentItem,
    displayedEndDate,
    requestConfirmedWorkItemUpdate,
    scheduleTimeZone: getResolvedWorkItemScheduleTimeZone(data, currentItem),
  })

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

  const mainArticleProps = {
    currentItem,
    data,
    team,
    workCopy,
    parentItem,
    editable,
    isMainEditing,
    currentUserId,
    mainDraftTitle,
    isCollaborationAttached,
    mainTitleLimitState,
    editorCollaboration,
    mainDraftStale,
    collaboration,
    descriptionContent,
    isCollaborationBootstrapping,
    showDescriptionBootPreview,
    otherDescriptionViewers,
    bootstrapContent,
    mentionCandidates,
    collaborationDescriptionContent,
    childItems,
    childProgress,
    childCopy,
    canCreateChildItem,
    subIssuesOpen,
    mainChildComposerOpen,
    onMainDraftTitleChange: setMainDraftTitle,
    onReloadMainDraft: handleReloadMainDraft,
    onLegacyActiveBlockChange: handleLegacyActiveBlockChange,
    onDescriptionChange: handleDescriptionChange,
    onUploadAttachment: (file) =>
      useAppStore.getState().uploadAttachment("workItem", currentItem.id, file),
    onStartMainEdit: handleStartMainEdit,
    onToggleSubIssues: () => setSubIssuesOpen((current) => !current),
    onToggleMainChildComposer: () => {
      setSubIssuesOpen(true)
      setMainChildComposerOpen((current) => {
        const next = !current
        if (next) {
          setSidebarChildComposerOpen(false)
        }
        return next
      })
    },
    onOpenMainChildComposer: () => {
      setSidebarChildComposerOpen(false)
      setMainChildComposerOpen(true)
    },
    onCloseMainChildComposer: () => setMainChildComposerOpen(false),
  } satisfies Parameters<typeof WorkItemMainArticle>[0]

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <WorkItemDetailTopBar
          currentItem={currentItem}
          parentItem={parentItem}
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
          <WorkItemMainArticle {...mainArticleProps} />

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
            editable={editable}
            sidebarChildComposerOpen={sidebarChildComposerOpen}
            linkedProjects={linkedProjects}
            linkedDocuments={linkedDocuments}
            currentUserId={currentUserId}
            onCopyItemLink={() => {
              void handleCopyItemLink()
            }}
            {...propertyHandlers}
            onCloseChildComposer={() => setSidebarChildComposerOpen(false)}
          />
        </div>
      </div>
      {confirmationDialog}
      <CollaborationSyncDialog
        descriptionSubject="description"
        open={showDescriptionSyncDialog}
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

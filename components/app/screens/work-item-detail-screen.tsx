"use client"

import type { Editor } from "@tiptap/react"
import { format, formatDistanceToNow } from "date-fns"
import {
  AppLink,
  type AppRouter,
  useAppRouter,
} from "@/lib/browser/app-navigation"
import {
  getCurrentHashTargetId,
  getHashTargetElement,
  scheduleScrollElementIntoCenteredView,
} from "@/lib/browser/url-hash-target"
import { getAppOrigin } from "@/lib/auth-routing"
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
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
  BellSimpleRinging,
  BellSimpleSlash,
  CaretDown,
  CaretRight,
  Check,
  CircleDashed,
  Clock,
  DotsThree,
  Flag,
  FolderSimple,
  LinkSimple,
  MagnifyingGlass,
  PaperPlaneTilt,
  Plus,
  SidebarSimple,
  Trash,
  TreeStructure,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  createDocumentMentionQueueState,
  reduceDocumentMentionQueue,
} from "@/lib/content/document-mention-queue"
import {
  extractRichTextMentionCounts,
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
  getRichTextReferenceCandidates,
  getStatusOrderForTeam,
  getTeam,
  getTeamMembers,
  getUser,
  getWorkItemChildProgress,
  getWorkItem,
  getWorkItemDescendantIds,
  hasWorkspaceAccess,
  sortItems,
  workItemMatchesView,
} from "@/lib/domain/selectors"
import {
  flattenCommentReplies,
  getRootComments,
  groupCommentsByParentId,
} from "@/lib/domain/comment-threads"
import {
  isCustomPropertyDefinitionForWorkItem,
  isLabelAssignableToWorkItem,
} from "@/lib/domain/labels"
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
import {
  getAddedWorkItemAssigneeIds,
  getWorkItemAssigneeIds,
  toggleWorkItemAssigneeId,
} from "@/lib/domain/work-item-assignees"
import { RichTextContent } from "@/components/app/rich-text-content"
import { MessageHoverActionBar } from "@/components/app/message-hover-action-bar"
import {
  useWorkItemSurfacePortalContainer,
  WorkItemSurfacePortalContainerContext,
} from "@/components/app/screens/work-item-surface-portal-context"
import { useAppStore } from "@/lib/store/app-store"
import {
  formatTimeZoneLabel,
  getSupportedTimeZones,
  normalizeTimeZone,
} from "@/lib/time-zone"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { DetailSidebarLabelsRow } from "@/components/app/screens/detail-sidebar-labels-row"
import {
  DetailRelationLink,
  DetailSidebarAddPropertyRow,
  DetailSidebarCustomPropertyRow,
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
import {
  completePendingMentionExit,
  type PendingMentionExitTarget,
  updatePendingMentionExitDialogOpen,
  usePendingMentionBeforeUnload,
  usePendingMentionHistoryNavigationGuard,
  usePendingMentionLinkNavigationGuard,
  usePendingMentionRouteRefs,
} from "./pending-mention-navigation"
import {
  formatMentionCountLabel,
  formatRecipientCountLabel,
  PendingMentionExitDialog,
  PendingMentionNotificationBanner,
  usePendingMentionSummary,
} from "./pending-mention-notifications"
import { InlineWorkItemPropertyControl } from "./work-item-inline-property-control"
import { IssueContextMenu } from "./work-item-menus"
import {
  getWorkItemSelectionContextItems,
  useWorkItemSelection,
  WorkItemSelectionCheckbox,
  type WorkItemSelectionController,
} from "./work-item-selection"
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
  LabelColorDot,
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
  WorkItemTypeBadge,
} from "./work-item-ui"
import {
  flushPendingCommentContentAttachments,
  getCommentContentLimitState,
  useCommentComposer,
} from "./use-comment-composer"
import { useWorkItemProjectCascadeConfirmation } from "./use-work-item-project-cascade-confirmation"
import {
  formatWorkItemDetailDate,
  formatWorkSurfaceTimestamp,
} from "./date-presentation"
import {
  FilterPopover,
  GroupChipPopover,
  PropertiesChipPopover,
  type ViewConfigPatch,
} from "./work-surface-controls"
import { getGroupValueLabel } from "./work-surface-view/shared"
import { WorkItemHoverCard } from "./work-item-hover-card"
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
const mainActivityReactionButtonClassName =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors"
const mainActivityReactionActiveClassName =
  "border-transparent bg-accent-bg text-accent-fg"
const mainActivityReactionInactiveClassName =
  "border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-foreground"

function formatDetailDate(value: string | null) {
  if (!value) {
    return "—"
  }

  return formatWorkItemDetailDate(value)
}

function formatRelativeTimestamp(value: string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true })
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
  const portalContainer = useWorkItemSurfacePortalContainer()
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
            portalContainer={portalContainer}
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
  const portalContainer = useWorkItemSurfacePortalContainer()

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
            portalContainer={portalContainer}
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

function getDetailChildLabels(data: AppData, item: WorkItem) {
  const labelIds = new Set(item.labelIds)

  if (labelIds.size === 0) {
    return []
  }

  return data.labels.filter((label) => labelIds.has(label.id))
}

function DetailChildProgressChip({
  data,
  item,
}: {
  data: AppData
  item: WorkItem
}) {
  const progress = getWorkItemChildProgress(data, item.id)

  if (progress.totalChildren === 0) {
    return null
  }

  return <span className={detailChipClassName}>{progress.percent}%</span>
}

function DetailChildParentChip({
  data,
  item,
}: {
  data: AppData
  item: WorkItem
}) {
  if (!item.parentId) {
    return null
  }

  const parent = getWorkItem(data, item.parentId)

  if (!parent) {
    return null
  }

  return (
    <span className={cn(detailChipClassName, "max-w-[180px]")}>
      <TreeStructure className="size-3 shrink-0" />
      <span className="truncate">
        {parent.key} · {parent.title}
      </span>
    </span>
  )
}

function DetailChildMilestoneChip({
  data,
  item,
}: {
  data: AppData
  item: WorkItem
}) {
  if (!item.milestoneId) {
    return null
  }

  const milestone = data.milestones.find(
    (entry) => entry.id === item.milestoneId
  )

  if (!milestone) {
    return null
  }

  return <span className={detailChipClassName}>{milestone.name}</span>
}

function DetailChildTimestampChip({
  label,
  value,
}: {
  label: "Created" | "Updated"
  value: string
}) {
  const formatted = formatWorkSurfaceTimestamp(value, label)

  return formatted ? (
    <span className={detailChipClassName}>{formatted}</span>
  ) : null
}

type DetailChildDisplayProperty = ViewDefinition["displayProps"][number]

function renderDetailChildSelectedChip(
  selectedDisplayProps: ReadonlySet<DetailChildDisplayProperty>,
  property: DetailChildDisplayProperty,
  node: ReactNode,
  visible = true
) {
  return visible && selectedDisplayProps.has(property) ? node : null
}

function DetailChildDueDateChip({ item }: { item: WorkItem }) {
  return item.dueDate ? (
    <span className={detailChipClassName}>
      <CalendarBlank className="size-3" />
      {format(new Date(item.dueDate), "MMM d")}
    </span>
  ) : null
}

function DetailChildLabelChips({
  labels,
}: {
  labels: ReturnType<typeof getDetailChildLabels>
}) {
  return labels.map((label) => (
    <span key={label.id} className={detailChipClassName}>
      <LabelColorDot color={label.color} className="size-1.5" />
      <span>{label.name}</span>
    </span>
  ))
}

function DetailChildCustomPropertyChips({
  data,
  item,
  propertyEntries,
}: {
  data: AppData
  item: WorkItem
  propertyEntries: ReturnType<typeof getDetailChildCustomPropertyEntries>
}) {
  return propertyEntries.map(({ definition, value }) => (
    <CustomPropertyValueControl
      key={definition.id}
      data={data}
      definition={definition}
      item={item}
      value={value}
      editable={false}
      variant="chip"
    />
  ))
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
  const selectedPropertySet = new Set(selectedDisplayProps)
  const labels = getDetailChildLabels(data, item)
  const showMainAssignee =
    (item.visibility ?? "team") !== "private" &&
    getWorkItemAssigneeIds(item).length > 0
  const showMainPriority = item.priority !== "none"
  const showMainProject =
    (item.visibility ?? "team") !== "private" && item.primaryProjectId !== null

  if (selectedDisplayProps.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {renderDetailChildSelectedChip(
        selectedPropertySet,
        "type",
        <WorkItemTypeBadge
          data={data}
          item={item}
          className="h-6 rounded-full px-2 text-[11px] text-fg-2"
        />
      )}
      {renderDetailChildSelectedChip(
        selectedPropertySet,
        "status",
        <InlineWorkItemPropertyControl
          data={data}
          item={item}
          property="status"
          variant="child"
        />
      )}
      {renderDetailChildSelectedChip(
        selectedPropertySet,
        "priority",
        <InlineWorkItemPropertyControl
          data={data}
          item={item}
          property="priority"
          variant="child"
        />,
        showMainPriority
      )}
      {renderDetailChildSelectedChip(
        selectedPropertySet,
        "assignee",
        <InlineWorkItemPropertyControl
          data={data}
          item={item}
          property="assignee"
          variant="child"
        />,
        showMainAssignee
      )}
      {renderDetailChildSelectedChip(
        selectedPropertySet,
        "progress",
        <DetailChildProgressChip data={data} item={item} />
      )}
      {renderDetailChildSelectedChip(
        selectedPropertySet,
        "project",
        <InlineWorkItemPropertyControl
          data={data}
          item={item}
          property="project"
          variant="child"
        />,
        showMainProject
      )}
      {renderDetailChildSelectedChip(
        selectedPropertySet,
        "parent",
        <DetailChildParentChip data={data} item={item} />
      )}
      {renderDetailChildSelectedChip(
        selectedPropertySet,
        "dueDate",
        <DetailChildDueDateChip item={item} />
      )}
      {renderDetailChildSelectedChip(
        selectedPropertySet,
        "milestone",
        <DetailChildMilestoneChip data={data} item={item} />
      )}
      {renderDetailChildSelectedChip(
        selectedPropertySet,
        "labels",
        <DetailChildLabelChips labels={labels} />
      )}
      {renderDetailChildSelectedChip(
        selectedPropertySet,
        "created",
        <DetailChildTimestampChip label="Created" value={item.createdAt} />
      )}
      {renderDetailChildSelectedChip(
        selectedPropertySet,
        "updated",
        <DetailChildTimestampChip label="Updated" value={item.updatedAt} />
      )}
      <DetailChildCustomPropertyChips
        data={data}
        item={item}
        propertyEntries={customPropertyEntries}
      />
    </div>
  )
}

function DetailChildWorkItemRow({
  data,
  displayProps,
  item,
  selection,
  variant = "main",
}: {
  data: AppData
  displayProps?: ViewDefinition["displayProps"]
  item: WorkItem
  selection?: WorkItemSelectionController
  variant?: "main" | "sidebar"
}) {
  const childDone = item.status === "done"
  const selectedDisplayProps = getDetailChildDisplayProps(displayProps, variant)
  const selected = selection?.isSelected(item.id) ?? false
  const targetItems = getWorkItemSelectionContextItems({
    data,
    item,
    selection,
  })

  const row = (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md py-1.5 transition-colors hover:bg-surface-2",
        variant === "sidebar" ? "gap-y-1.5 px-2" : "gap-y-2 px-4",
        selected && "bg-accent-bg/45"
      )}
      onClickCapture={(event) => selection?.handleModifiedClick(item.id, event)}
      onContextMenu={() => selection?.handleContextMenu(item.id)}
    >
      {selection ? (
        <WorkItemSelectionCheckbox
          checked={selected}
          label={`Select ${item.key}`}
          onChange={(event) => selection.handleCheckboxChange(item.id, event)}
        />
      ) : null}
      <WorkItemHoverCard
        data={data}
        item={item}
        side={variant === "sidebar" ? "left" : "right"}
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
      </WorkItemHoverCard>
      <DetailChildPropertyChips
        data={data}
        item={item}
        selectedDisplayProps={selectedDisplayProps}
      />
    </div>
  )

  return (
    <IssueContextMenu
      data={data}
      displayProps={selectedDisplayProps}
      item={item}
      targetItems={targetItems}
    >
      {row}
    </IssueContextMenu>
  )
}

function DetailSidebarComment({
  data,
  comment,
  repliesByParentId,
  currentUserId,
  editable,
  mentionCandidates,
  onUploadAttachment,
  referenceCandidates,
  usersById,
  depth = 0,
}: {
  data: AppData
  comment: AppData["comments"][number]
  repliesByParentId: Record<string, AppData["comments"]>
  currentUserId: string
  editable: boolean
  mentionCandidates: AppData["users"]
  onUploadAttachment: DetailUploadAttachmentHandler
  referenceCandidates: DetailReferenceCandidates
  usersById: ReadonlyMap<string, AppData["users"][number]>
  depth?: number
}) {
  const author = getUser(data, comment.createdBy)
  const replies =
    depth === 0
      ? flattenCommentReplies(
          repliesByParentId[comment.id] ?? [],
          repliesByParentId
        )
      : []
  const [repliesOpen, setRepliesOpen] = useState(false)
  const editState = useWorkItemCommentEditState({
    comment,
    currentUserId,
    editable,
  })
  const portalContainer = useWorkItemSurfacePortalContainer()

  return (
    <div className={cn(depth > 0 && "mt-3 ml-6 border-l border-line pl-4")}>
      <div className="group/sidebar-comment relative flex gap-2.5 rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5">
        <MessageHoverActionBar
          canDelete={editState.canMutateComment}
          canEdit={editState.canMutateComment}
          canReact={editable}
          className="top-0 right-3 -translate-y-1/2 group-hover/sidebar-comment:flex focus-within:flex"
          deleteLabel="Delete comment"
          editLabel="Edit comment"
          onDelete={() => editState.setDeleteOpen(true)}
          onEdit={editState.openEditComposer}
          onReact={(emoji) => {
            useAppStore.getState().toggleCommentReaction(comment.id, emoji)
          }}
          portalContainer={portalContainer}
        />
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
            {comment.editedAt ? (
              <span className="text-[11.5px] text-fg-4">edited</span>
            ) : null}
          </div>
          <div className="mt-1 text-[13px] leading-[1.55] whitespace-pre-wrap text-fg-2">
            {editState.editOpen ? (
              <MainActivityCommentEditComposer
                editable={editable}
                editContent={editState.editContent}
                editEditorRef={editState.editEditorRef}
                editLimitState={editState.editLimitState}
                mentionCandidates={mentionCandidates}
                onUploadAttachment={onUploadAttachment}
                referenceCandidates={referenceCandidates}
                onCancel={editState.cancelEditComposer}
                onEditContentChange={editState.setEditContent}
                onSave={editState.handleEditComment}
              />
            ) : (
              <RichTextContent
                attachmentDisplay="inline"
                content={comment.content}
                referenceCandidates={referenceCandidates}
                className="[&_p]:my-0 [&_p+p]:mt-1"
              />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <CommentReactionButtons
              activeClassName="border-transparent bg-accent-bg text-accent-fg"
              buttonClassName="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors"
              comment={comment}
              currentUserId={currentUserId}
              disabled={!editable}
              inactiveClassName="border-line bg-surface-2 text-fg-2 hover:bg-surface-3"
              usersById={usersById}
            />
          </div>
          {replies.length > 0 ? (
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-fg-3 transition-colors hover:text-foreground"
              onClick={() => setRepliesOpen((current) => !current)}
            >
              {repliesOpen ? (
                <CaretDown className="size-3" />
              ) : (
                <CaretRight className="size-3" />
              )}
              <span>
                {repliesOpen ? "Hide" : "Show"} {replies.length}{" "}
                {replies.length === 1 ? "reply" : "replies"}
              </span>
            </button>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={editState.deleteOpen}
        onOpenChange={editState.setDeleteOpen}
        title="Delete comment"
        description="This comment and its replies will be permanently removed. This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={editState.handleDeleteComment}
      />

      {repliesOpen
        ? replies.map((reply) => (
            <DetailSidebarComment
              key={reply.id}
              data={data}
              comment={reply}
              repliesByParentId={repliesByParentId}
              currentUserId={currentUserId}
              editable={editable}
              mentionCandidates={mentionCandidates}
              onUploadAttachment={onUploadAttachment}
              referenceCandidates={referenceCandidates}
              usersById={usersById}
              depth={depth + 1}
            />
          ))
        : null}
    </div>
  )
}

function getWorkItemActivityContext(input: {
  currentUserId: string
  data: AppData
  item: WorkItem
}) {
  const comments = isPrivateWorkItem(input.item)
    ? []
    : getCommentsForTarget(input.data, "workItem", input.item.id)
  const rootComments = getRootComments(comments)
  const repliesByParentId = groupCommentsByParentId(comments)
  const statusEvents = getWorkItemStatusChangeActivityEvents(
    input.data,
    input.item
  )
  const assigneeEvents = getWorkItemAssigneeChangeActivityEvents(
    input.data,
    input.item
  )

  return {
    assigneeEvents,
    creator: getUser(input.data, input.item.creatorId),
    mentionCandidates: isPrivateWorkItem(input.item)
      ? []
      : getTeamMembers(input.data, input.item.teamId).filter(
          (candidate) => candidate.id !== input.currentUserId
        ),
    referenceCandidates: getRichTextReferenceCandidates(input.data, {
      type: "workItemComment",
      itemId: input.item.id,
    }),
    repliesByParentId,
    rootComments,
    statusEvents,
    usersById: new Map(input.data.users.map((user) => [user.id, user])),
  }
}

function getWorkItemAssigneeChangeActivityEvents(
  data: AppData,
  item: WorkItem
) {
  const currentAssigneeIds = new Set(getWorkItemAssigneeIds(item))
  const latestByAssigneeId = new Map<
    string,
    Extract<AppData["workItemActivities"][number], { type: "assignee-change" }>
  >()

  const activities = data.workItemActivities
    .filter(
      (
        activity
      ): activity is Extract<
        AppData["workItemActivities"][number],
        { type: "assignee-change" }
      > => activity.itemId === item.id && activity.type === "assignee-change"
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))

  for (const activity of activities) {
    for (const assigneeId of getAddedWorkItemAssigneeIds(activity)) {
      if (currentAssigneeIds.has(assigneeId)) {
        latestByAssigneeId.set(assigneeId, activity)
      }
    }
  }

  return [...latestByAssigneeId.entries()].flatMap(([assigneeId, activity]) => {
    const user = getUser(data, assigneeId)

    if (!user) {
      return []
    }

    return [
      {
        id: `${item.id}-assignee-${assigneeId}-${activity.id}`,
        user,
        when: activity.createdAt,
      },
    ]
  })
}

function getWorkItemStatusChangeActivityEvents(data: AppData, item: WorkItem) {
  const seen = new Set<string>()

  return data.workItemActivities
    .filter(
      (
        activity
      ): activity is Extract<
        AppData["workItemActivities"][number],
        { type: "status-change" }
      > => activity.itemId === item.id && activity.type === "status-change"
    )
    .flatMap((activity) => {
      const actor = getUser(data, activity.actorId)
      const key = `${activity.actorId}:${activity.createdAt}:${activity.fromStatus}:${activity.toStatus}`

      if (!actor || seen.has(key)) {
        return []
      }

      seen.add(key)
      return [
        {
          id: `${item.id}-status-${key}`,
          user: actor,
          body: `moved this item from ${statusMeta[activity.fromStatus].label} to ${statusMeta[activity.toStatus].label}`,
          when: activity.createdAt,
        },
      ]
    })
}

function useWorkItemCommentComposer(itemId: string) {
  return useCommentComposer("workItem", itemId)
}

function useMainActivityReplyState(
  comment: AppData["comments"][number],
  onReplyCreated?: () => void
) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyContent, setReplyContent] = useState("")
  const replyEditorRef = useRef<Editor | null>(null)
  const replyLimitState = getCommentContentLimitState(replyContent)

  async function handleReply() {
    if (!replyLimitState.canSubmit) {
      return
    }

    const outgoingContent = await flushPendingCommentContentAttachments({
      content: replyContent,
      targetId: comment.targetId,
      targetType: comment.targetType,
    })

    if (outgoingContent === null) {
      return
    }

    useAppStore.getState().addComment({
      targetType: comment.targetType,
      targetId: comment.targetId,
      parentCommentId: comment.id,
      content: outgoingContent,
    })
    setReplyContent("")
    setReplyOpen(false)
    onReplyCreated?.()
  }

  function openReply() {
    setReplyOpen(true)
  }

  return {
    handleReply,
    openReply,
    replyContent,
    replyEditorRef,
    replyLimitState,
    replyOpen,
    setReplyContent,
    setReplyOpen,
  }
}

function useWorkItemCommentEditState({
  comment,
  currentUserId,
  editable,
}: {
  comment: AppData["comments"][number]
  currentUserId: string
  editable: boolean
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const editEditorRef = useRef<Editor | null>(null)
  const editLimitState = getCommentContentLimitState(editContent)
  const canMutateComment = editable && comment.createdBy === currentUserId

  function openEditComposer() {
    setEditContent(comment.content)
    setEditOpen(true)
  }

  function cancelEditComposer() {
    setEditContent(comment.content)
    setEditOpen(false)
  }

  async function handleEditComment() {
    if (!editLimitState.canSubmit) {
      return
    }

    const outgoingContent = await flushPendingCommentContentAttachments({
      content: editContent,
      targetId: comment.targetId,
      targetType: comment.targetType,
    })

    if (outgoingContent === null) {
      return
    }

    useAppStore.getState().updateComment(comment.id, {
      content: outgoingContent,
    })
    setEditOpen(false)
  }

  function handleDeleteComment() {
    useAppStore.getState().deleteComment(comment.id)
    setDeleteOpen(false)
  }

  return {
    cancelEditComposer,
    canMutateComment,
    deleteOpen,
    editContent,
    editEditorRef,
    editLimitState,
    editOpen,
    handleDeleteComment,
    handleEditComment,
    openEditComposer,
    setDeleteOpen,
    setEditContent,
  }
}

function DetailSidebarActivity({
  data,
  currentUserId,
  item,
}: {
  data: AppData
  currentUserId: string
  item: WorkItem
}) {
  const {
    assigneeEvents,
    creator,
    mentionCandidates,
    referenceCandidates,
    repliesByParentId,
    rootComments,
    statusEvents,
    usersById,
  } = getWorkItemActivityContext({ currentUserId, data, item })
  const handleUploadAttachment: DetailUploadAttachmentHandler = (file) =>
    useAppStore.getState().uploadAttachment("workItem", item.id, file)

  const activityEvents = [
    {
      id: `${item.id}-created`,
      user: creator,
      body: "created this item",
      when: item.createdAt,
    },
    ...assigneeEvents
      .filter((event) => event.user.id !== creator?.id)
      .map((event) => ({
        ...event,
        body: "is assigned to this item",
      })),
    ...statusEvents,
  ].sort((left, right) => left.when.localeCompare(right.when))

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
          editable={false}
          mentionCandidates={mentionCandidates}
          onUploadAttachment={handleUploadAttachment}
          referenceCandidates={referenceCandidates}
          usersById={usersById}
        />
      ))}
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

function MainActivityCommentReactionControls({
  className,
  comment,
  currentUserId,
  editable,
  usersById,
}: {
  className?: string
  comment: AppData["comments"][number]
  currentUserId: string
  editable: boolean
  usersById: ReadonlyMap<string, AppData["users"][number]>
}) {
  if (comment.reactions.length === 0) {
    return null
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <CommentReactionButtons
        activeClassName={mainActivityReactionActiveClassName}
        buttonClassName={mainActivityReactionButtonClassName}
        comment={comment}
        currentUserId={currentUserId}
        disabled={!editable}
        inactiveClassName={mainActivityReactionInactiveClassName}
        usersById={usersById}
      />
    </div>
  )
}

function MainActivityCommentCard({
  data,
  comment,
  repliesByParentId,
  currentUserId,
  editable,
  mentionCandidates,
  onUploadAttachment,
  referenceCandidates,
  usersById,
}: {
  data: AppData
  comment: AppData["comments"][number]
  repliesByParentId: Record<string, AppData["comments"]>
  currentUserId: string
  editable: boolean
  mentionCandidates: AppData["users"]
  onUploadAttachment: DetailUploadAttachmentHandler
  referenceCandidates: DetailReferenceCandidates
  usersById: ReadonlyMap<string, AppData["users"][number]>
}) {
  const author = getUser(data, comment.createdBy)
  const replies = repliesByParentId[comment.id] ?? []
  const [repliesOpen, setRepliesOpen] = useState(true)
  const replyState = useMainActivityReplyState(comment, () =>
    setRepliesOpen(true)
  )
  const editState = useWorkItemCommentEditState({
    comment,
    currentUserId,
    editable,
  })
  const portalContainer = useWorkItemSurfacePortalContainer()

  return (
    <article
      id={comment.id}
      className="relative scroll-mt-6 rounded-xl border border-line bg-surface shadow-[0_1px_0_0_var(--line-soft)] transition-colors target:ring-2 target:ring-ring/45"
    >
      <div className="group/comment relative">
        <MessageHoverActionBar
          canDelete={editState.canMutateComment}
          canEdit={editState.canMutateComment}
          canQuote={editable}
          canReact={editable}
          className="top-0 right-3 -translate-y-1/2 group-hover/comment:flex focus-within:flex"
          deleteLabel="Delete comment"
          editLabel="Edit comment"
          onDelete={() => editState.setDeleteOpen(true)}
          onEdit={editState.openEditComposer}
          onQuote={replyState.openReply}
          portalContainer={portalContainer}
          quoteAction="reply"
          quoteLabel="Reply"
          onReact={(emoji) => {
            useAppStore.getState().toggleCommentReaction(comment.id, emoji)
          }}
        />
        <MainActivityCommentHeader author={author} comment={comment} />
        <div className="px-3.5 pt-1 pb-3">
          {editState.editOpen ? (
            <MainActivityCommentEditComposer
              editable={editable}
              editContent={editState.editContent}
              editEditorRef={editState.editEditorRef}
              editLimitState={editState.editLimitState}
              mentionCandidates={mentionCandidates}
              onUploadAttachment={onUploadAttachment}
              referenceCandidates={referenceCandidates}
              onCancel={editState.cancelEditComposer}
              onEditContentChange={editState.setEditContent}
              onSave={editState.handleEditComment}
            />
          ) : (
            <RichTextContent
              content={comment.content}
              referenceCandidates={referenceCandidates}
              className="text-[13px] leading-[1.6] text-fg-2 [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:my-1 [&_ul]:ml-4 [&_ul]:list-disc"
            />
          )}
        </div>
        <MainActivityCommentFooter
          comment={comment}
          currentUserId={currentUserId}
          editable={editable}
          usersById={usersById}
        />
      </div>
      <MainActivityCommentReplies
        data={data}
        replies={replies}
        repliesByParentId={repliesByParentId}
        currentUserId={currentUserId}
        editable={editable}
        mentionCandidates={mentionCandidates}
        onUploadAttachment={onUploadAttachment}
        referenceCandidates={referenceCandidates}
        usersById={usersById}
        open={repliesOpen}
        onToggle={() => setRepliesOpen((current) => !current)}
        onReplyToThread={replyState.openReply}
      />

      {replyState.replyOpen ? (
        <MainActivityReplyComposer
          editable={editable}
          mentionCandidates={mentionCandidates}
          onUploadAttachment={onUploadAttachment}
          referenceCandidates={referenceCandidates}
          replyContent={replyState.replyContent}
          replyEditorRef={replyState.replyEditorRef}
          replyLimitState={replyState.replyLimitState}
          onCancel={() => {
            replyState.setReplyContent("")
            replyState.setReplyOpen(false)
          }}
          onReply={replyState.handleReply}
          onReplyContentChange={replyState.setReplyContent}
        />
      ) : null}
      <ConfirmDialog
        open={editState.deleteOpen}
        onOpenChange={editState.setDeleteOpen}
        title="Delete comment"
        description="This comment and its replies will be permanently removed. This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={editState.handleDeleteComment}
      />
    </article>
  )
}

function MainActivityCommentHeader({
  author,
  comment,
}: {
  author: AppData["users"][number] | null | undefined
  comment: AppData["comments"][number]
}) {
  return (
    <header className="flex items-center gap-2 px-3.5 pt-2.5">
      <span className="text-[12.5px] font-semibold text-foreground">
        {author?.name ?? "Unknown"}
      </span>
      <span className="text-[11px] text-fg-4">
        commented {formatRelativeTimestamp(comment.createdAt)}
      </span>
      {comment.editedAt ? (
        <span className="text-[11px] text-fg-4">edited</span>
      ) : null}
      <span className="ml-auto hidden text-[11px] text-fg-4 group-hover/comment:inline">
        {format(new Date(comment.createdAt), "MMM d, h:mm a")}
      </span>
    </header>
  )
}

function MainActivityCommentEditComposer({
  editable,
  editContent,
  editEditorRef,
  editLimitState,
  mentionCandidates,
  onUploadAttachment,
  referenceCandidates,
  onCancel,
  onEditContentChange,
  onSave,
}: {
  editable: boolean
  editContent: string
  editEditorRef: MutableRefObject<Editor | null>
  editLimitState: ReturnType<typeof getTextInputLimitState>
  mentionCandidates: AppData["users"]
  onUploadAttachment: DetailUploadAttachmentHandler
  referenceCandidates: DetailReferenceCandidates
  onCancel: () => void
  onEditContentChange: (content: string) => void
  onSave: () => void
}) {
  return (
    <div className="rounded-lg border border-line bg-surface transition-colors focus-within:border-fg-3">
      <div className="px-3 py-2">
        <RichTextEditor
          content={editContent}
          onChange={onEditContentChange}
          editable={editable}
          compact
          autoFocus
          allowSlashCommands={false}
          showToolbar={false}
          showStats={false}
          placeholder="Edit comment..."
          editorInstanceRef={editEditorRef}
          mentionCandidates={mentionCandidates}
          referenceCandidates={referenceCandidates}
          minPlainTextCharacters={commentContentConstraints.min}
          maxPlainTextCharacters={commentContentConstraints.max}
          enforcePlainTextLimit
          onSubmitShortcut={onSave}
          onUploadAttachment={onUploadAttachment}
          deferAttachmentUpload
          submitOnEnter
          className="[&_.ProseMirror]:min-h-[2.5rem] [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-[1.55]"
        />
      </div>
      <div className="border-t border-dashed border-line px-3 py-1.5">
        <WorkItemCommentComposerActions
          editable={editable}
          editorRef={editEditorRef}
          emojiButtonClassName="rounded-md p-1 text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground disabled:text-fg-4 disabled:hover:bg-transparent"
          emojiIconClassName="size-3.5"
          limitState={editLimitState}
          onUploadAttachment={onUploadAttachment}
        >
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!editLimitState.canSubmit}
              onClick={onSave}
            >
              Save
            </Button>
          </div>
        </WorkItemCommentComposerActions>
      </div>
    </div>
  )
}

function MainActivityCommentFooter({
  comment,
  currentUserId,
  editable,
  usersById,
}: {
  comment: AppData["comments"][number]
  currentUserId: string
  editable: boolean
  usersById: ReadonlyMap<string, AppData["users"][number]>
}) {
  if (comment.reactions.length === 0) {
    return null
  }

  return (
    <footer className="flex items-center gap-2 border-t border-line-soft bg-surface-2/40 px-3.5 py-1.5">
      <MainActivityCommentReactionControls
        comment={comment}
        currentUserId={currentUserId}
        editable={editable}
        usersById={usersById}
      />
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
  onUploadAttachment,
  referenceCandidates,
  usersById,
  open,
  onToggle,
  onReplyToThread,
}: {
  data: AppData
  replies: AppData["comments"]
  repliesByParentId: Record<string, AppData["comments"]>
  currentUserId: string
  editable: boolean
  mentionCandidates: AppData["users"]
  onUploadAttachment: DetailUploadAttachmentHandler
  referenceCandidates: DetailReferenceCandidates
  usersById: ReadonlyMap<string, AppData["users"][number]>
  open: boolean
  onToggle: () => void
  onReplyToThread: () => void
}) {
  if (replies.length === 0) {
    return null
  }

  const flatReplies = flattenCommentReplies(replies, repliesByParentId)

  return (
    <div className="border-t border-line-soft">
      <MainActivityCommentRepliesToggle
        open={open}
        replyCount={flatReplies.length}
        onToggle={onToggle}
      />
      {open ? (
        <MainActivityCommentRepliesList
          data={data}
          replies={flatReplies}
          currentUserId={currentUserId}
          editable={editable}
          mentionCandidates={mentionCandidates}
          onUploadAttachment={onUploadAttachment}
          referenceCandidates={referenceCandidates}
          usersById={usersById}
          onReplyToThread={onReplyToThread}
        />
      ) : null}
    </div>
  )
}

function MainActivityCommentRepliesToggle({
  open,
  replyCount,
  onToggle,
}: {
  open: boolean
  replyCount: number
  onToggle: () => void
}) {
  const replyNoun = replyCount === 1 ? "reply" : "replies"

  return (
    <button
      type="button"
      className="flex w-full items-center gap-1.5 px-3.5 py-1.5 text-[11.5px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
      aria-expanded={open}
      onClick={onToggle}
    >
      {open ? (
        <CaretDown className="size-3" />
      ) : (
        <CaretRight className="size-3" />
      )}
      <span>
        {open ? "Hide" : "Show"} {replyCount} {replyNoun}
      </span>
    </button>
  )
}

function MainActivityCommentRepliesList({
  data,
  replies,
  currentUserId,
  editable,
  mentionCandidates,
  onUploadAttachment,
  referenceCandidates,
  usersById,
  onReplyToThread,
}: {
  data: AppData
  replies: AppData["comments"]
  currentUserId: string
  editable: boolean
  mentionCandidates: AppData["users"]
  onUploadAttachment: DetailUploadAttachmentHandler
  referenceCandidates: DetailReferenceCandidates
  usersById: ReadonlyMap<string, AppData["users"][number]>
  onReplyToThread: () => void
}) {
  return (
    <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft px-3.5">
      {replies.map((reply) => (
        <li key={reply.id} className="py-2.5 first:pt-3 last:pb-3">
          <MainActivityCommentReplyRow
            data={data}
            comment={reply}
            currentUserId={currentUserId}
            editable={editable}
            mentionCandidates={mentionCandidates}
            onUploadAttachment={onUploadAttachment}
            referenceCandidates={referenceCandidates}
            usersById={usersById}
            onReplyToThread={onReplyToThread}
          />
        </li>
      ))}
    </ul>
  )
}

function MainActivityCommentReplyRow({
  data,
  comment,
  currentUserId,
  editable,
  mentionCandidates,
  onUploadAttachment,
  referenceCandidates,
  usersById,
  onReplyToThread,
}: {
  data: AppData
  comment: AppData["comments"][number]
  currentUserId: string
  editable: boolean
  mentionCandidates: AppData["users"]
  onUploadAttachment: DetailUploadAttachmentHandler
  referenceCandidates: DetailReferenceCandidates
  usersById: ReadonlyMap<string, AppData["users"][number]>
  onReplyToThread: () => void
}) {
  const author = getUser(data, comment.createdBy)
  const editState = useWorkItemCommentEditState({
    comment,
    currentUserId,
    editable,
  })
  const portalContainer = useWorkItemSurfacePortalContainer()

  return (
    <div
      id={comment.id}
      className="group/reply relative flex scroll-mt-6 gap-2.5 rounded-md target:ring-2 target:ring-ring/45"
    >
      <MessageHoverActionBar
        canDelete={editState.canMutateComment}
        canEdit={editState.canMutateComment}
        canQuote={editable}
        canReact={editable}
        className="top-0 right-0 -translate-y-1/2 group-hover/reply:flex focus-within:flex"
        deleteLabel="Delete comment"
        editLabel="Edit comment"
        onDelete={() => editState.setDeleteOpen(true)}
        onEdit={editState.openEditComposer}
        onQuote={onReplyToThread}
        portalContainer={portalContainer}
        quoteAction="reply"
        quoteLabel="Reply"
        onReact={(emoji) => {
          useAppStore.getState().toggleCommentReaction(comment.id, emoji)
        }}
      />
      <div className="pt-0.5">
        <UserAvatar
          name={author?.name ?? "Unknown"}
          avatarImageUrl={author?.avatarImageUrl}
          avatarUrl={author?.avatarUrl}
          status={author?.status}
          size="sm"
          showStatus={false}
          className="size-5"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12.5px] font-semibold text-foreground">
            {author?.name ?? "Unknown"}
          </span>
          <span className="text-[11px] text-fg-4">
            replied {formatRelativeTimestamp(comment.createdAt)}
          </span>
          {comment.editedAt ? (
            <span className="text-[11px] text-fg-4">edited</span>
          ) : null}
          <span className="ml-auto hidden text-[11px] text-fg-4 group-hover/reply:inline">
            {format(new Date(comment.createdAt), "MMM d, h:mm a")}
          </span>
        </div>
        {editState.editOpen ? (
          <div className="mt-2">
            <MainActivityCommentEditComposer
              editable={editable}
              editContent={editState.editContent}
              editEditorRef={editState.editEditorRef}
              editLimitState={editState.editLimitState}
              mentionCandidates={mentionCandidates}
              onUploadAttachment={onUploadAttachment}
              referenceCandidates={referenceCandidates}
              onCancel={editState.cancelEditComposer}
              onEditContentChange={editState.setEditContent}
              onSave={editState.handleEditComment}
            />
          </div>
        ) : (
          <RichTextContent
            content={comment.content}
            referenceCandidates={referenceCandidates}
            className="mt-0.5 text-[13px] leading-[1.6] text-fg-2 [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:my-1 [&_ul]:ml-4 [&_ul]:list-disc"
          />
        )}
        {comment.reactions.length > 0 ? (
          <div className="mt-1.5 flex items-center gap-2">
            <MainActivityCommentReactionControls
              comment={comment}
              currentUserId={currentUserId}
              editable={editable}
              usersById={usersById}
            />
          </div>
        ) : null}
        <ConfirmDialog
          open={editState.deleteOpen}
          onOpenChange={editState.setDeleteOpen}
          title="Delete comment"
          description="This comment and its replies will be permanently removed. This can't be undone."
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={editState.handleDeleteComment}
        />
      </div>
    </div>
  )
}

function MainActivityReplyComposer({
  editable,
  framed = true,
  mentionCandidates,
  onUploadAttachment,
  referenceCandidates,
  replyContent,
  replyEditorRef,
  replyLimitState,
  onCancel,
  onReply,
  onReplyContentChange,
}: {
  editable: boolean
  framed?: boolean
  mentionCandidates: AppData["users"]
  onUploadAttachment: DetailUploadAttachmentHandler
  referenceCandidates: DetailReferenceCandidates
  replyContent: string
  replyEditorRef: MutableRefObject<Editor | null>
  replyLimitState: ReturnType<typeof getTextInputLimitState>
  onCancel: () => void
  onReply: () => void
  onReplyContentChange: (content: string) => void
}) {
  const composer = (
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
          referenceCandidates={referenceCandidates}
          minPlainTextCharacters={commentContentConstraints.min}
          maxPlainTextCharacters={commentContentConstraints.max}
          enforcePlainTextLimit
          onSubmitShortcut={onReply}
          onUploadAttachment={onUploadAttachment}
          deferAttachmentUpload
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
          onUploadAttachment={onUploadAttachment}
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
  )

  if (!framed) {
    return composer
  }

  return (
    <div className="border-t border-line-soft bg-background px-3.5 py-3">
      {composer}
    </div>
  )
}

type MainActivityTimelineEntry =
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

function getMainActivityCreatorEntry(
  item: WorkItem,
  creator: AppData["users"][number] | null
): MainActivityTimelineEntry[] {
  return creator
    ? [
        {
          kind: "event",
          id: `${item.id}-created`,
          user: creator,
          body: "created this item",
          when: item.createdAt,
        },
      ]
    : []
}

function getMainActivityAssigneeEntries(
  assigneeEvents: ReturnType<typeof getWorkItemAssigneeChangeActivityEvents>,
  creator: AppData["users"][number] | null
): MainActivityTimelineEntry[] {
  return assigneeEvents
    .filter((event) => event.user.id !== creator?.id)
    .map((event) => ({
      kind: "event" as const,
      id: event.id,
      user: event.user,
      body: "was assigned to this item",
      when: event.when,
    }))
}

function getMainActivityStatusEntries(
  statusEvents: Array<
    Omit<Extract<MainActivityTimelineEntry, { kind: "event" }>, "kind">
  >
): MainActivityTimelineEntry[] {
  return statusEvents.map((event) => ({
    kind: "event",
    ...event,
  }))
}

function getMainActivityCommentEntries(
  rootComments: AppData["comments"]
): MainActivityTimelineEntry[] {
  return rootComments.map((rootComment) => ({
    kind: "comment" as const,
    id: rootComment.id,
    comment: rootComment,
    when: rootComment.createdAt,
  }))
}

function getMainActivityTimelineEntries(input: {
  assigneeEvents: ReturnType<typeof getWorkItemAssigneeChangeActivityEvents>
  creator: AppData["users"][number] | null
  item: WorkItem
  rootComments: AppData["comments"]
  statusEvents: Array<
    Omit<Extract<MainActivityTimelineEntry, { kind: "event" }>, "kind">
  >
}) {
  return [
    ...getMainActivityCreatorEntry(input.item, input.creator),
    ...getMainActivityAssigneeEntries(input.assigneeEvents, input.creator),
    ...getMainActivityStatusEntries(input.statusEvents),
    ...getMainActivityCommentEntries(input.rootComments),
  ].sort((left, right) => left.when.localeCompare(right.when))
}

function MainActivityEventEntry({
  entry,
}: {
  entry: Extract<MainActivityTimelineEntry, { kind: "event" }>
}) {
  return (
    <MainActivityThreadItem
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
        <span className="font-medium text-foreground">{entry.user.name}</span>
        <span className="text-fg-3">{entry.body}</span>
        <span className="text-[11px] text-fg-4">
          · {formatRelativeTimestamp(entry.when)}
        </span>
      </div>
    </MainActivityThreadItem>
  )
}

function getTimelineCommentAuthorAvatarProps(
  author: AppData["users"][number] | null
) {
  if (!author) {
    return {
      name: "Unknown",
      avatarImageUrl: undefined,
      avatarUrl: undefined,
      status: undefined,
    }
  }

  return {
    name: author.name,
    avatarImageUrl: author.avatarImageUrl,
    avatarUrl: author.avatarUrl,
    status: author.status,
  }
}

function MainActivityCommentEntry({
  data,
  entry,
  currentUserId,
  editable,
  mentionCandidates,
  onUploadAttachment,
  referenceCandidates,
  repliesByParentId,
  usersById,
}: {
  data: AppData
  entry: Extract<MainActivityTimelineEntry, { kind: "comment" }>
  currentUserId: string
  editable: boolean
  mentionCandidates: AppData["users"]
  onUploadAttachment: DetailUploadAttachmentHandler
  referenceCandidates: DetailReferenceCandidates
  repliesByParentId: Record<string, AppData["comments"]>
  usersById: ReadonlyMap<string, AppData["users"][number]>
}) {
  const author = getTimelineCommentAuthorAvatarProps(
    getUser(data, entry.comment.createdBy)
  )

  return (
    <MainActivityThreadItem
      variant="comment"
      avatar={
        <UserAvatar
          name={author.name}
          avatarImageUrl={author.avatarImageUrl}
          avatarUrl={author.avatarUrl}
          status={author.status}
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
        onUploadAttachment={onUploadAttachment}
        referenceCandidates={referenceCandidates}
        usersById={usersById}
      />
    </MainActivityThreadItem>
  )
}

function MainActivityTimelineEntryItem({
  data,
  entry,
  currentUserId,
  editable,
  mentionCandidates,
  onUploadAttachment,
  referenceCandidates,
  repliesByParentId,
  usersById,
}: {
  data: AppData
  entry: MainActivityTimelineEntry
  currentUserId: string
  editable: boolean
  mentionCandidates: AppData["users"]
  onUploadAttachment: DetailUploadAttachmentHandler
  referenceCandidates: DetailReferenceCandidates
  repliesByParentId: Record<string, AppData["comments"]>
  usersById: ReadonlyMap<string, AppData["users"][number]>
}) {
  if (entry.kind === "event") {
    return <MainActivityEventEntry entry={entry} />
  }

  return (
    <MainActivityCommentEntry
      data={data}
      entry={entry}
      currentUserId={currentUserId}
      editable={editable}
      mentionCandidates={mentionCandidates}
      onUploadAttachment={onUploadAttachment}
      referenceCandidates={referenceCandidates}
      repliesByParentId={repliesByParentId}
      usersById={usersById}
    />
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
    assigneeEvents,
    creator,
    mentionCandidates,
    referenceCandidates,
    repliesByParentId,
    rootComments,
    statusEvents,
    usersById,
  } = getWorkItemActivityContext({ currentUserId, data, item })
  const currentUser = getUser(data, currentUserId)
  const {
    commentEditorRef,
    commentLimitState,
    content,
    handleComment,
    setContent,
  } = useWorkItemCommentComposer(item.id)
  const handleUploadAttachment: DetailUploadAttachmentHandler = (file) =>
    useAppStore.getState().uploadAttachment("workItem", item.id, file)
  const canComment = !isPrivateWorkItem(item)
  const entries = getMainActivityTimelineEntries({
    assigneeEvents,
    creator,
    item,
    rootComments,
    statusEvents,
  })

  return (
    <ol className="flex flex-col">
      {entries.map((entry) => (
        <MainActivityTimelineEntryItem
          key={entry.id}
          data={data}
          entry={entry}
          currentUserId={currentUserId}
          editable={editable}
          mentionCandidates={mentionCandidates}
          onUploadAttachment={handleUploadAttachment}
          referenceCandidates={referenceCandidates}
          repliesByParentId={repliesByParentId}
          usersById={usersById}
        />
      ))}

      {canComment ? (
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
                referenceCandidates={referenceCandidates}
                minPlainTextCharacters={commentContentConstraints.min}
                maxPlainTextCharacters={commentContentConstraints.max}
                enforcePlainTextLimit
                onSubmitShortcut={handleComment}
                onUploadAttachment={handleUploadAttachment}
                deferAttachmentUpload
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
                onUploadAttachment={handleUploadAttachment}
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
      ) : null}
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

function getWorkItemSidebarAssigneeValueLabel(
  selectedAssignees: UserProfile[]
) {
  if (selectedAssignees.length === 0) {
    return "Assign"
  }

  if (selectedAssignees.length === 1) {
    return selectedAssignees[0]?.name
  }

  return `${selectedAssignees.length} assignees`
}

function WorkItemSidebarAssigneeValue({
  selectedAssignees,
  valueLabel,
}: {
  selectedAssignees: UserProfile[]
  valueLabel: string | undefined
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2",
        selectedAssignees.length === 0 && "text-fg-4"
      )}
    >
      {selectedAssignees.length > 0 ? (
        <span className="flex -space-x-1">
          {selectedAssignees.slice(0, 3).map((user) => (
            <WorkItemAssigneeAvatar
              key={user.id}
              user={user}
              className="border border-surface data-[size=sm]:size-4"
            />
          ))}
        </span>
      ) : null}
      <span className="truncate">{valueLabel}</span>
    </span>
  )
}

function WorkItemSidebarAssigneeOptionRow({
  selected,
  user,
  teamMembers,
  onSelect,
}: {
  selected: boolean
  user: UserProfile
  teamMembers: UserProfile[]
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-8 w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[12px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground",
        selected && "bg-primary/10 text-foreground"
      )}
      onClick={onSelect}
    >
      <span className="min-w-0 flex-1">
        {renderSidebarAssigneeOption(user.id, user.name, teamMembers, false)}
      </span>
      {selected ? <Check className="size-[14px]" /> : null}
    </button>
  )
}

function WorkItemSidebarAssigneePopoverContent({
  assigneeIdSet,
  filteredMembers,
  query,
  selectedAssignees,
  teamMembers,
  onAssigneeChange,
  onClose,
  onQueryChange,
}: {
  assigneeIdSet: ReadonlySet<string>
  filteredMembers: UserProfile[]
  query: string
  selectedAssignees: UserProfile[]
  teamMembers: UserProfile[]
  onAssigneeChange: (value: string) => void
  onClose: () => void
  onQueryChange: (value: string) => void
}) {
  const portalContainer = useWorkItemSurfacePortalContainer()

  return (
    <PopoverContent
      align="end"
      portalContainer={portalContainer}
      className="w-[300px] overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-lg"
    >
      <div className="flex items-center gap-2 border-b border-line-soft px-2 py-1.5">
        <MagnifyingGlass className="size-[14px] text-fg-4" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Assign to..."
          className="h-7 border-none bg-transparent px-0 text-[12.5px] shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="no-scrollbar flex max-h-[320px] flex-col gap-0.5 overflow-y-auto py-1">
        <button
          type="button"
          className={cn(
            "flex min-h-8 w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[12px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground",
            selectedAssignees.length === 0 && "bg-primary/10 text-foreground"
          )}
          onClick={() => {
            onAssigneeChange("unassigned")
            onClose()
          }}
        >
          <span className="min-w-0 flex-1">Unassigned</span>
          {selectedAssignees.length === 0 ? (
            <Check className="size-[14px]" />
          ) : null}
        </button>
        {filteredMembers.map((user) => (
          <WorkItemSidebarAssigneeOptionRow
            key={user.id}
            selected={assigneeIdSet.has(user.id)}
            user={user}
            teamMembers={teamMembers}
            onSelect={() => onAssigneeChange(user.id)}
          />
        ))}
      </div>
    </PopoverContent>
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
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  if ((currentItem.visibility ?? "team") === "private") {
    return null
  }

  const assigneeIds = getWorkItemAssigneeIds(currentItem)
  const assigneeIdSet = new Set(assigneeIds)
  const selectedAssignees = teamMembers.filter((user) =>
    assigneeIdSet.has(user.id)
  )
  const filteredMembers = teamMembers.filter((user) =>
    user.name.toLowerCase().includes(query.trim().toLowerCase())
  )
  const valueLabel = getWorkItemSidebarAssigneeValueLabel(selectedAssignees)

  return (
    <>
      {renderDetailSidebarTerm("Assignee", <Plus className="size-[13px]" />)}
      <dd className="m-0">
        <Popover open={disabled ? false : open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {renderDetailSidebarValueButton({
              disabled,
              label: "Assignee",
              children: (
                <WorkItemSidebarAssigneeValue
                  selectedAssignees={selectedAssignees}
                  valueLabel={valueLabel}
                />
              ),
            })}
          </PopoverTrigger>
          <WorkItemSidebarAssigneePopoverContent
            assigneeIdSet={assigneeIdSet}
            filteredMembers={filteredMembers}
            query={query}
            selectedAssignees={selectedAssignees}
            teamMembers={teamMembers}
            onAssigneeChange={onAssigneeChange}
            onClose={() => setOpen(false)}
            onQueryChange={setQuery}
          />
        </Popover>
      </dd>
    </>
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
  onEditProperty,
}: {
  currentItem: WorkItem
  customPropertyDefinitions: AppData["customPropertyDefinitions"]
  data: AppData
  editable: boolean
  onEditProperty: (
    definition: AppData["customPropertyDefinitions"][number]
  ) => void
}) {
  const archiveCustomPropertyDefinition = useAppStore(
    (state) => state.archiveCustomPropertyDefinition
  )

  return customPropertyDefinitions.map((definition) => (
    <DetailSidebarCustomPropertyRow
      key={definition.id}
      definition={definition}
      editable={editable}
      onEditProperty={() => onEditProperty(definition)}
      onRemoveProperty={() =>
        void archiveCustomPropertyDefinition(definition.id)
      }
    >
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
    </DetailSidebarCustomPropertyRow>
  ))
}

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
type DetailReferenceCandidates = ComponentProps<
  typeof RichTextEditor
>["referenceCandidates"]
type DetailMentionCountsChangeHandler = NonNullable<
  ComponentProps<typeof RichTextEditor>["onMentionCountsChange"]
>
type DetailFlushCollaboration = DetailCollaborationState["flush"]
type DetailRouter = AppRouter
type DetailRequestWorkItemUpdate = ReturnType<
  typeof useWorkItemProjectCascadeConfirmation
>["requestUpdate"]
type DescriptionMentionQueueAction = Parameters<
  typeof reduceDocumentMentionQueue
>[1]
type DescriptionMentionQueueDispatch = (
  action: DescriptionMentionQueueAction
) => void

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

function isPrivateWorkItem(item: WorkItem) {
  return (item.visibility ?? "team") === "private"
}

function getWorkItemDetailWorkspaceId(
  data: AppData,
  currentItem: WorkItem,
  team: Team | null
) {
  if (isPrivateWorkItem(currentItem)) {
    return currentItem.workspaceId ?? null
  }

  return (
    currentItem.workspaceId ??
    team?.workspaceId ??
    getTeam(data, currentItem.teamId)?.workspaceId ??
    null
  )
}

function canEditWorkItemDetail(
  data: AppData,
  currentItem: WorkItem,
  team: Team | null
) {
  if (!isPrivateWorkItem(currentItem)) {
    return canEditTeam(data, team?.id)
  }

  const workspaceId = getWorkItemDetailWorkspaceId(data, currentItem, team)

  return (
    currentItem.creatorId === data.currentUserId &&
    Boolean(
      workspaceId && hasWorkspaceAccess(data, workspaceId, data.currentUserId)
    )
  )
}

function getAvailableWorkItemLabels(
  data: AppData,
  currentItem: WorkItem,
  team: Team | null
) {
  const workspaceId = getWorkItemDetailWorkspaceId(data, currentItem, team)

  if (!workspaceId) {
    return []
  }

  return data.labels
    .filter((label) =>
      isLabelAssignableToWorkItem(
        label,
        currentItem,
        workspaceId,
        data.currentUserId
      )
    )
    .sort((left, right) => left.name.localeCompare(right.name))
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

function getLinkedWorkItemDocuments(data: AppData, currentItem: WorkItem) {
  const linkedDocumentIds = new Set([
    ...currentItem.linkedDocumentIds,
    ...data.documents
      .filter((document) => document.linkedWorkItemIds.includes(currentItem.id))
      .map((document) => document.id),
  ])

  return [...linkedDocumentIds]
    .map((documentId) => getDocument(data, documentId))
    .filter(
      (document): document is NonNullable<typeof document> =>
        document !== null &&
        document.kind !== "private-document" &&
        document.kind !== "item-description"
    )
}

function getLinkedWorkItems(data: AppData, currentItem: WorkItem) {
  if ((currentItem.visibility ?? "team") === "private") {
    return []
  }

  const linkedItemIds = new Set([
    ...(currentItem.linkedWorkItemIds ?? []),
    ...data.workItems
      .filter((item) => item.linkedWorkItemIds?.includes(currentItem.id))
      .map((item) => item.id),
  ])

  linkedItemIds.delete(currentItem.id)

  return [...linkedItemIds]
    .map((itemId) => getWorkItem(data, itemId))
    .filter(
      (item): item is NonNullable<typeof item> =>
        item !== null && (item.visibility ?? "team") !== "private"
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
  const privateTask = isPrivateWorkItem(currentItem)
  const teamExperience = privateTask
    ? "project-management"
    : team?.settings.experience
  const teamMembers = privateTask
    ? []
    : team
      ? getTeamMembers(data, team.id)
      : []
  const allowedChildTypes = getAllowedChildWorkItemTypesForItem(currentItem)

  return {
    availableLabels: getAvailableWorkItemLabels(data, currentItem, team),
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
    linkedItems: getLinkedWorkItems(data, currentItem),
    mentionCandidates: privateTask ? [] : team ? teamMembers : data.users,
    referenceCandidates: getRichTextReferenceCandidates(data, {
      type: "workItemDescription",
      itemId: currentItem.id,
    }),
    parentItem: currentItem.parentId
      ? getWorkItem(data, currentItem.parentId)
      : null,
    parentOptions: getWorkItemParentOptions(data, currentItem),
    selectedMilestone: getSelectedWorkItemMilestone(data, currentItem),
    sidebarEditable: editable,
    sidebarTitle: mainSection
      ? getWorkItemSidebarTitle({ currentItem, mainSection })
      : (sidebarTitle ?? currentItem.title),
    statusOptions: buildPropertyStatusOptions(getStatusOrderForTeam(team)),
    teamMembers,
    teamProjects: privateTask
      ? []
      : getTeamProjectOptions(data, team?.id, currentItem.primaryProjectId),
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
    onAssigneeChange: (value) => {
      const assigneeIds =
        value === "unassigned"
          ? []
          : toggleWorkItemAssigneeId(getWorkItemAssigneeIds(currentItem), value)

      useAppStore.getState().updateWorkItem(currentItem.id, {
        assigneeId: assigneeIds[0] ?? null,
        assigneeIds,
      })
    },
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

async function persistWorkItemTitle({
  currentItem,
  normalizedMainDraftTitle,
}: {
  currentItem: WorkItem
  normalizedMainDraftTitle: string
}) {
  if (
    normalizedMainDraftTitle.length === 0 ||
    normalizedMainDraftTitle === currentItem.title
  ) {
    return true
  }

  const result = useAppStore
    .getState()
    .updateWorkItem(currentItem.id, { title: normalizedMainDraftTitle })

  return result.status === "updated"
}

function clearDescriptionMentionQueue(
  dispatchMentionQueue: DescriptionMentionQueueDispatch
) {
  dispatchMentionQueue({
    type: "clear-all",
  })
}

async function sendPendingItemDescriptionMentionNotifications({
  activePendingMentionEntries,
  dispatchMentionQueue,
  flushCollaboration,
  isCollaborationAttached,
  itemId,
  setSendingMentionNotifications,
}: {
  activePendingMentionEntries: PendingDocumentMention[]
  dispatchMentionQueue: DescriptionMentionQueueDispatch
  flushCollaboration: DetailFlushCollaboration
  isCollaborationAttached: boolean
  itemId: string
  setSendingMentionNotifications: (sending: boolean) => void
}) {
  const pendingMentionEntries = activePendingMentionEntries

  if (pendingMentionEntries.length === 0) {
    clearDescriptionMentionQueue(dispatchMentionQueue)
    return true
  }

  setSendingMentionNotifications(true)

  try {
    if (isCollaborationAttached) {
      await flushCollaboration()
    } else {
      await useAppStore.getState().flushItemDescriptionSync(itemId)
    }

    const result = await syncSendItemDescriptionMentionNotifications(
      itemId,
      pendingMentionEntries
    )

    dispatchMentionQueue({
      type: "mark-sent",
      entries: pendingMentionEntries,
    })
    toast.success(
      `Sent notifications for ${formatMentionCountLabel(
        result.mentionCount
      )} across ${formatRecipientCountLabel(result.recipientCount)}.`
    )
    return true
  } catch (error) {
    if (isAlreadyDeliveredMentionConflict(error)) {
      dispatchMentionQueue({
        type: "mark-sent",
        entries: pendingMentionEntries,
      })
      toast.success("Mention notifications were already sent.")
      return true
    }

    toast.error(
      error instanceof Error
        ? error.message
        : "Failed to send mention notifications"
    )
    return false
  } finally {
    setSendingMentionNotifications(false)
  }
}

function getIsMainSectionEditing({
  currentItem,
  editable,
}: {
  currentItem: WorkItem | undefined
  editable: boolean
}) {
  return currentItem !== undefined && editable
}

function getMainSectionDraftState({
  baseTitle,
  currentItem,
  isMainEditing,
  mainDraftTitleDirty,
}: {
  baseTitle: string
  currentItem: WorkItem | undefined
  isMainEditing: boolean
  mainDraftTitleDirty: boolean
}) {
  const titleDirty = Boolean(
    currentItem && isMainEditing && mainDraftTitleDirty
  )
  const stale = Boolean(
    currentItem &&
    isMainEditing &&
    titleDirty &&
    baseTitle !== currentItem.title
  )

  return {
    stale,
    titleDirty,
  }
}

function useWorkItemMainSectionController({
  currentItem,
  descriptionContent,
  editable,
  isCollaborationAttached,
  isCollaborationBootstrapping,
}: {
  currentItem: WorkItem | undefined
  descriptionContent: string
  editable: boolean
  isCollaborationAttached: boolean
  isCollaborationBootstrapping: boolean
}) {
  const [mainDraftItemId, setMainDraftItemId] = useState<string | null>(null)
  const [mainDraftTitle, setMainDraftTitle] = useState("")
  const [mainDraftBaseTitle, setMainDraftBaseTitle] = useState("")
  const [mainDraftTitleDirty, setMainDraftTitleDirty] = useState(false)
  const mainDraftTitleRef = useRef("")
  const mainDraftTitleDirtyRef = useRef(false)
  const mainTitleCanSubmitRef = useRef(true)
  const mainDraftDescriptionRef = useRef("")
  const titlePersistingRef = useRef(false)

  const isMainEditing = getIsMainSectionEditing({
    currentItem,
    editable,
  })
  const draftState = getMainSectionDraftState({
    baseTitle: mainDraftBaseTitle,
    currentItem,
    isMainEditing,
    mainDraftTitleDirty,
  })

  const resetMainTitleDraft = useCallback((title: string) => {
    const limitState = getTextInputLimitState(title, workItemTitleConstraints)

    mainDraftTitleRef.current = title
    mainDraftTitleDirtyRef.current = false
    mainTitleCanSubmitRef.current = limitState.canSubmit
    setMainDraftBaseTitle(title)
    setMainDraftTitle(title)
    setMainDraftTitleDirty(false)
  }, [])

  const commitTitleDraft = useCallback(async () => {
    if (
      !currentItem ||
      !editable ||
      titlePersistingRef.current ||
      !mainDraftTitleDirtyRef.current
    ) {
      return
    }

    const normalizedMainDraftTitle = mainDraftTitleRef.current.trim()

    if (normalizedMainDraftTitle.length === 0) {
      resetMainTitleDraft(currentItem.title)
      return
    }

    if (!mainTitleCanSubmitRef.current) {
      return
    }

    if (mainDraftBaseTitle !== currentItem.title) {
      return
    }

    if (normalizedMainDraftTitle === currentItem.title) {
      mainDraftTitleDirtyRef.current = false
      setMainDraftTitleDirty(false)
      setMainDraftTitle(normalizedMainDraftTitle)
      return
    }

    titlePersistingRef.current = true
    const saved = await persistWorkItemTitle({
      currentItem,
      normalizedMainDraftTitle,
    })

    titlePersistingRef.current = false

    if (!saved) {
      return
    }

    mainDraftTitleDirtyRef.current = false
    setMainDraftBaseTitle(normalizedMainDraftTitle)
    setMainDraftTitleDirty(false)
    setMainDraftTitle(normalizedMainDraftTitle)
  }, [currentItem, editable, mainDraftBaseTitle, resetMainTitleDraft])

  useEffect(() => {
    if (!currentItem) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- route changes reset the title draft to the resolved item state.
      setMainDraftItemId(null)
      resetMainTitleDraft("")
      mainDraftDescriptionRef.current = ""
      return
    }

    if (mainDraftItemId !== currentItem.id) {
      setMainDraftItemId(currentItem.id)
      resetMainTitleDraft(currentItem.title)
      mainDraftDescriptionRef.current = descriptionContent
      return
    }

    if (
      !mainDraftTitleDirtyRef.current &&
      mainDraftTitleRef.current !== currentItem.title
    ) {
      resetMainTitleDraft(currentItem.title)
    }

    if (mainDraftDescriptionRef.current !== descriptionContent) {
      mainDraftDescriptionRef.current = descriptionContent
    }
  }, [currentItem, descriptionContent, mainDraftItemId, resetMainTitleDraft])

  const handleTitleDraftChange = useCallback(
    (title: string) => {
      mainDraftTitleRef.current = title
      const nextDirty = Boolean(
        currentItem && isMainEditing && title.trim() !== mainDraftBaseTitle
      )
      const nextCanSubmit = getTextInputLimitState(
        title,
        workItemTitleConstraints
      ).canSubmit

      setMainDraftTitle(title)

      if (nextDirty !== mainDraftTitleDirtyRef.current) {
        mainDraftTitleDirtyRef.current = nextDirty
        setMainDraftTitleDirty(nextDirty)
      }

      if (nextCanSubmit !== mainTitleCanSubmitRef.current) {
        mainTitleCanSubmitRef.current = nextCanSubmit
      }
    },
    [currentItem, isMainEditing, mainDraftBaseTitle]
  )

  function handleReloadMainDraft() {
    if (!currentItem) {
      return
    }

    resetMainTitleDraft(currentItem.title)
    mainDraftDescriptionRef.current = descriptionContent
  }

  function handleDescriptionChange(content: string) {
    mainDraftDescriptionRef.current = content

    if (
      currentItem &&
      !isCollaborationAttached &&
      !isCollaborationBootstrapping
    ) {
      useAppStore.getState().updateItemDescription(currentItem.id, content)
    }
  }

  return {
    handleDescriptionChange,
    handleTitleCommit: commitTitleDraft,
    handleReloadMainDraft,
    isMainEditing,
    mainDraftStale: draftState.stale,
    mainDraftTitle,
    setMainDraftTitle: handleTitleDraftChange,
  }
}

function WorkItemDetailBreadcrumb({
  currentItem,
  isPrivateTask,
  parentItem,
  team,
}: {
  currentItem: WorkItem
  isPrivateTask: boolean
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
      {isPrivateTask ? (
        <AppLink
          href="/assigned?view=view_assigned_private_tasks"
          className="shrink-0 text-fg-3 hover:text-foreground"
        >
          Private tasks
        </AppLink>
      ) : team ? (
        <AppLink
          href={`/team/${team.slug}/work`}
          className="shrink-0 text-fg-3 hover:text-foreground"
        >
          {team.name}
        </AppLink>
      ) : (
        <span className="shrink-0 text-fg-3">Team</span>
      )}
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

function WorkItemTopBarDeleteMenu({
  deletingItem,
  itemTypeLabel,
  onOpenDeleteDialog,
}: {
  deletingItem: boolean
  itemTypeLabel: string
  onOpenDeleteDialog: () => void
}) {
  const portalContainer = useWorkItemSurfacePortalContainer()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" disabled={deletingItem}>
          <DotsThree className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        portalContainer={portalContainer}
        className="w-44 min-w-44"
      >
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
  deletingItem,
  itemTypeLabel,
  propertiesOpen,
  onOpenDeleteDialog,
  onToggleProperties,
}: {
  editable: boolean
  otherDescriptionViewers: DocumentPresenceViewer[]
  deletingItem: boolean
  itemTypeLabel: string
  propertiesOpen: boolean
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
  deletingItem,
  propertiesOpen,
  onOpenDeleteDialog,
  onToggleProperties,
}: {
  currentItem: WorkItem
  parentItem: WorkItem | null
  team: Team | null
  editable: boolean
  otherDescriptionViewers: DocumentPresenceViewer[]
  deletingItem: boolean
  propertiesOpen: boolean
  onOpenDeleteDialog: () => void
  onToggleProperties: () => void
}) {
  const isPrivateTask = isPrivateWorkItem(currentItem)
  const itemTypeLabel = getDisplayLabelForWorkItemType(
    currentItem.type,
    isPrivateTask ? "project-management" : team?.settings.experience
  )

  return (
    <div className="flex min-h-10 shrink-0 items-center justify-between gap-1 border-b border-line-soft bg-surface px-3 py-2">
      <WorkItemDetailBreadcrumb
        currentItem={currentItem}
        isPrivateTask={isPrivateTask}
        parentItem={parentItem}
        team={team}
      />
      <WorkItemTopBarActions
        editable={editable}
        otherDescriptionViewers={otherDescriptionViewers}
        deletingItem={deletingItem}
        itemTypeLabel={itemTypeLabel}
        propertiesOpen={propertiesOpen}
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

function WorkItemMainTitleInput({
  editable,
  initialTitle,
  itemTypeLabel,
  onTitleCommit,
  onTitleChange,
}: {
  editable: boolean
  initialTitle: string
  itemTypeLabel: string
  onTitleCommit: () => void
  onTitleChange: (title: string) => void
}) {
  const [draftTitle, setDraftTitle] = useState(initialTitle)
  const titleLimitState = getTextInputLimitState(
    draftTitle,
    workItemTitleConstraints
  )

  useEffect(() => {
    setDraftTitle(initialTitle)
  }, [initialTitle])

  return (
    <div>
      <Input
        value={draftTitle}
        disabled={!editable}
        onChange={(event) => {
          const nextTitle = event.target.value

          setDraftTitle(nextTitle)
          onTitleChange(nextTitle)
        }}
        onBlur={onTitleCommit}
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return
          }

          event.preventDefault()
          onTitleCommit()
          event.currentTarget.blur()
        }}
        placeholder={`${itemTypeLabel} title`}
        maxLength={workItemTitleConstraints.max}
        className="h-auto min-h-[2.2rem] rounded-none border-none bg-transparent px-0 py-0 text-[28px] leading-[1.18] font-semibold tracking-[-0.018em] text-foreground shadow-none focus-visible:ring-0 disabled:opacity-100 dark:bg-transparent"
      />
      <FieldCharacterLimit
        state={titleLimitState}
        limit={workItemTitleConstraints.max}
        className="mt-1"
      />
    </div>
  )
}

function WorkItemMainHeader({
  currentItem,
  team,
  editable,
  isMainEditing,
  mainDraftTitle,
  onMainDraftTitleCommit,
  onMainDraftTitleChange,
}: {
  currentItem: WorkItem
  team: Team | null
  editable: boolean
  isMainEditing: boolean
  mainDraftTitle: string
  onMainDraftTitleCommit: () => void
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
        <WorkItemMainTitleInput
          editable={editable}
          initialTitle={mainDraftTitle}
          itemTypeLabel={itemTypeLabel}
          onTitleCommit={onMainDraftTitleCommit}
          onTitleChange={onMainDraftTitleChange}
        />
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
          Reload the latest title before continuing with your local edit.
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onReload}>
        Reload latest
      </Button>
    </div>
  )
}

function WorkItemDescriptionBootPreview({
  bootstrapContent,
  collaborationDescriptionContent,
  referenceCandidates,
}: {
  bootstrapContent: DetailBootstrapContent
  collaborationDescriptionContent: string
  referenceCandidates: DetailReferenceCandidates
}) {
  return (
    <RichTextContent
      content={
        typeof bootstrapContent === "string"
          ? bootstrapContent
          : collaborationDescriptionContent
      }
      referenceCandidates={referenceCandidates}
      className="text-fg-1 min-h-24 text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-fg-2 [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:leading-tight [&_h1]:font-semibold [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:leading-tight [&_h2]:font-semibold [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:leading-tight [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mt-0 [&_p]:leading-7 [&_p+p]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
    />
  )
}

function getAttachedDescriptionCollaboration(input: {
  collaboration: DetailCollaborationBinding
  editorCollaboration: DetailEditorCollaboration
  isCollaborationAttached: boolean
}) {
  if (!input.isCollaborationAttached) {
    return undefined
  }

  return input.editorCollaboration ?? input.collaboration ?? undefined
}

type WorkItemDescriptionRichTextEditorProps = {
  collaborationDescriptionContent: string
  isCollaborationAttached: boolean
  editorCollaboration: DetailEditorCollaboration
  collaboration: DetailCollaborationBinding
  currentUserId: string
  editable: boolean
  isCollaborationBootstrapping: boolean
  otherDescriptionViewers: DocumentPresenceViewer[]
  mentionCandidates: UserProfile[]
  referenceCandidates: DetailReferenceCandidates
  onLegacyActiveBlockChange: (activeBlockId: string | null) => void
  onDescriptionChange: (content: string) => void
  onMentionCountsChange: DetailMentionCountsChangeHandler
  onUploadAttachment: DetailUploadAttachmentHandler
}

type WorkItemDescriptionEditorProps = WorkItemDescriptionRichTextEditorProps & {
  showDescriptionBootPreview: boolean
  bootstrapContent: DetailBootstrapContent
}

function WorkItemDescriptionRichTextEditor({
  collaborationDescriptionContent,
  isCollaborationAttached,
  editorCollaboration,
  collaboration,
  currentUserId,
  editable,
  isCollaborationBootstrapping,
  otherDescriptionViewers,
  mentionCandidates,
  referenceCandidates,
  onLegacyActiveBlockChange,
  onDescriptionChange,
  onMentionCountsChange,
  onUploadAttachment,
}: WorkItemDescriptionRichTextEditorProps) {
  return (
    <RichTextEditor
      content={collaborationDescriptionContent}
      collaboration={getAttachedDescriptionCollaboration({
        collaboration,
        editorCollaboration,
        isCollaborationAttached,
      })}
      currentPresenceUserId={currentUserId}
      editable={editable && !isCollaborationBootstrapping}
      showStats={false}
      placeholder="Add a description…"
      presenceViewers={otherDescriptionViewers}
      onActiveBlockChange={onLegacyActiveBlockChange}
      mentionCandidates={mentionCandidates}
      referenceCandidates={referenceCandidates}
      onChange={onDescriptionChange}
      onMentionCountsChange={onMentionCountsChange}
      onUploadAttachment={onUploadAttachment}
    />
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
  referenceCandidates,
  onLegacyActiveBlockChange,
  onDescriptionChange,
  onMentionCountsChange,
  onUploadAttachment,
}: WorkItemDescriptionEditorProps) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 transition-colors focus-within:border-fg-3">
      {showDescriptionBootPreview ? (
        <WorkItemDescriptionBootPreview
          bootstrapContent={bootstrapContent}
          collaborationDescriptionContent={collaborationDescriptionContent}
          referenceCandidates={referenceCandidates}
        />
      ) : (
        <WorkItemDescriptionRichTextEditor
          collaborationDescriptionContent={collaborationDescriptionContent}
          isCollaborationAttached={isCollaborationAttached}
          editorCollaboration={editorCollaboration}
          collaboration={collaboration}
          currentUserId={currentUserId}
          editable={editable}
          isCollaborationBootstrapping={isCollaborationBootstrapping}
          otherDescriptionViewers={otherDescriptionViewers}
          mentionCandidates={mentionCandidates}
          referenceCandidates={referenceCandidates}
          onLegacyActiveBlockChange={onLegacyActiveBlockChange}
          onDescriptionChange={onDescriptionChange}
          onMentionCountsChange={onMentionCountsChange}
          onUploadAttachment={onUploadAttachment}
        />
      )}
    </div>
  )
}

function WorkItemDescriptionSection({
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
  referenceCandidates,
  descriptionContent,
  onLegacyActiveBlockChange,
  onDescriptionChange,
  onMentionCountsChange,
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
  referenceCandidates: DetailReferenceCandidates
  descriptionContent: string
  onLegacyActiveBlockChange: (activeBlockId: string | null) => void
  onDescriptionChange: (content: string) => void
  onMentionCountsChange: DetailMentionCountsChangeHandler
  onUploadAttachment: DetailUploadAttachmentHandler
}) {
  return (
    <section className="mt-7">
      {editable ? (
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
          referenceCandidates={referenceCandidates}
          onLegacyActiveBlockChange={onLegacyActiveBlockChange}
          onDescriptionChange={onDescriptionChange}
          onMentionCountsChange={onMentionCountsChange}
          onUploadAttachment={onUploadAttachment}
        />
      ) : (
        <RichTextContent
          content={descriptionContent}
          referenceCandidates={referenceCandidates}
          className="text-fg-1 text-[14px] leading-[1.65] [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-fg-2 [&_h1]:mt-5 [&_h1]:mb-2 [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:mt-4 [&_h3]:mb-1.5 [&_li]:mb-1 [&_ol]:my-2 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:my-2 [&_ul]:ml-5 [&_ul]:list-disc"
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
  editable,
  view,
}: {
  data: AppData
  childItems: WorkItem[]
  displayProps: ViewDefinition["displayProps"]
  editable: boolean
  view: ViewDefinition
}) {
  const visibleChildItems = childItems.filter((child) =>
    workItemMatchesView(data, child, view)
  )
  const selection = useWorkItemSelection(
    visibleChildItems.map((child) => child.id)
  )

  if (childItems.length === 0) {
    return null
  }

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
                    selection={editable ? selection : undefined}
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
      onUpdateView={patchWorkDetailSubitemViewConfig}
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
            editable={editable}
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
  referenceCandidates,
  childItems,
  childProgress,
  childCopy,
  canCreateChildItem,
  subIssuesOpen,
  mainChildComposerOpen,
  onMainDraftTitleChange,
  onMainDraftTitleCommit,
  onReloadMainDraft,
  onLegacyActiveBlockChange,
  onDescriptionChange,
  onMentionCountsChange,
  onUploadAttachment,
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
  referenceCandidates: DetailReferenceCandidates
  childItems: WorkItem[]
  childProgress: DetailChildProgress
  childCopy: DetailChildCopy
  canCreateChildItem: boolean
  subIssuesOpen: boolean
  mainChildComposerOpen: boolean
  onMainDraftTitleChange: (title: string) => void
  onMainDraftTitleCommit: () => void
  onReloadMainDraft: () => void
  onLegacyActiveBlockChange: (activeBlockId: string | null) => void
  onDescriptionChange: (content: string) => void
  onMentionCountsChange: DetailMentionCountsChangeHandler
  onUploadAttachment: DetailUploadAttachmentHandler
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
          editable={editable}
          isMainEditing={isMainEditing}
          mainDraftTitle={mainDraftTitle}
          onMainDraftTitleCommit={onMainDraftTitleCommit}
          onMainDraftTitleChange={onMainDraftTitleChange}
        />

        <WorkItemStaleDraftNotice
          stale={mainDraftStale}
          onReload={onReloadMainDraft}
        />

        <WorkItemDescriptionSection
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
          referenceCandidates={referenceCandidates}
          descriptionContent={descriptionContent}
          onLegacyActiveBlockChange={onLegacyActiveBlockChange}
          onDescriptionChange={onDescriptionChange}
          onMentionCountsChange={onMentionCountsChange}
          onUploadAttachment={onUploadAttachment}
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
  const [editingCustomProperty, setEditingCustomProperty] = useState<
    AppData["customPropertyDefinitions"][number] | null
  >(null)
  const customPropertyDefinitions = getWorkItemSidebarCustomPropertyDefinitions(
    data,
    currentItem
  )
  const workspaceId = getWorkItemDetailWorkspaceId(data, currentItem, team)

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
          workspaceId={workspaceId}
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
          onEditProperty={(definition) => {
            setEditingCustomProperty(definition)
            setCustomPropertyDialogOpen(true)
          }}
        />
        <DetailSidebarAddPropertyRow
          canCreate={Boolean(
            team ||
            ((currentItem.visibility ?? "team") === "private" && workspaceId)
          )}
          disabled={!sidebarEditable}
          onOpen={() => {
            setEditingCustomProperty(null)
            setCustomPropertyDialogOpen(true)
          }}
        />
      </dl>
      {team ||
      ((currentItem.visibility ?? "team") === "private" && workspaceId) ? (
        <CustomPropertyDefinitionDialog
          open={customPropertyDialogOpen}
          definition={editingCustomProperty}
          scopeType={
            (currentItem.visibility ?? "team") === "private"
              ? "private"
              : "team"
          }
          teamId={team?.id ?? null}
          workspaceId={workspaceId}
          onOpenChange={(open) => {
            setCustomPropertyDialogOpen(open)
            if (!open) {
              setEditingCustomProperty(null)
            }
          }}
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
    scopeId: currentItem.teamId ?? "",
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
  canCreateChildItem,
  childItems,
  childCopy,
  childProgress,
  editable,
  sidebarChildComposerOpen,
  onCloseComposer,
}: {
  data: AppData
  currentItem: WorkItem
  canCreateChildItem: boolean
  childItems: WorkItem[]
  childCopy: DetailChildCopy
  childProgress: DetailChildProgress
  editable: boolean
  sidebarChildComposerOpen: boolean
  onCloseComposer: () => void
}) {
  const subitemView = getWorkDetailSubitemView(data, currentItem)
  const selection = useWorkItemSelection(childItems.map((child) => child.id))

  if (childItems.length === 0 && !canCreateChildItem) {
    return null
  }

  return (
    <DetailSidebarSection
      title={childCopy.childPluralLabel}
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
            selection={editable ? selection : undefined}
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
  linkedDocuments,
  linkedItems,
}: {
  linkedDocuments: AppDocument[]
  linkedItems: WorkItem[]
}) {
  if (linkedDocuments.length === 0 && linkedItems.length === 0) {
    return null
  }

  return (
    <DetailSidebarSection title="Relations">
      <div className="flex flex-col gap-1.5">
        {linkedDocuments.map((document) => (
          <DetailRelationLink
            key={document.id}
            href={`/docs/${document.id}`}
            icon={<LinkSimple className="size-3" />}
            label="Linked doc"
            title={document.title}
          />
        ))}
        {linkedItems.map((item) => (
          <DetailRelationLink
            key={item.id}
            href={`/items/${item.id}`}
            icon={<TreeStructure className="size-3" />}
            label="Linked item"
            title={item.title}
          />
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

function WorkItemDetailSidebarHeader({
  currentItem,
  headerClassName,
  isPrivateTask,
  isSubscribed,
  onCopyItemLink,
  onSetSubscription,
  onClose,
}: {
  currentItem: WorkItem
  headerClassName?: string
  isPrivateTask: boolean
  isSubscribed: boolean
  onCopyItemLink: () => void
  onSetSubscription: (subscribed: boolean) => void
  onClose?: () => void
}) {
  return (
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
        <span className="truncate">{statusMeta[currentItem.status].label}</span>
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
        {!isPrivateTask ? (
          <button
            type="button"
            className={detailIconButtonClassName}
            aria-label={
              isSubscribed
                ? "Unsubscribe from work item"
                : "Subscribe to work item"
            }
            title={isSubscribed ? "Unsubscribe" : "Subscribe"}
            onClick={() => onSetSubscription(!isSubscribed)}
          >
            {isSubscribed ? (
              <BellSimpleSlash className="size-[14px]" />
            ) : (
              <BellSimpleRinging className="size-[14px]" />
            )}
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            className={detailIconButtonClassName}
            aria-label="Close item details"
            onClick={onClose}
          >
            <SidebarSimple className="size-[14px]" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function WorkItemDetailSidebarFrame({
  children,
  floatingMaxHeight,
  open,
  variant,
}: {
  children: ReactNode
  floatingMaxHeight?: number
  open: boolean
  variant: WorkItemDetailSidebarVariant
}) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  )

  if (variant === "floating") {
    return (
      <WorkItemSurfacePortalContainerContext.Provider value={portalContainer}>
        <aside
          ref={setPortalContainer}
          data-work-item-surface="true"
          className="flex max-h-[min(680px,calc(100vh-24px))] min-h-0 w-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xl [contain:layout_paint_style]"
          style={
            floatingMaxHeight ? { maxHeight: floatingMaxHeight } : undefined
          }
        >
          {children}
        </aside>
      </WorkItemSurfacePortalContainerContext.Provider>
    )
  }

  if (variant === "inline") {
    return (
      <WorkItemSurfacePortalContainerContext.Provider value={portalContainer}>
        <aside
          ref={setPortalContainer}
          data-work-item-surface="true"
          className="flex h-full min-h-0 w-[26.25rem] shrink-0 flex-col overflow-hidden border-l border-line bg-surface [contain:layout_paint_style]"
        >
          {children}
        </aside>
      </WorkItemSurfacePortalContainerContext.Provider>
    )
  }

  return (
    <WorkItemSurfacePortalContainerContext.Provider value={portalContainer}>
      <CollapsibleRightSidebar
        ref={setPortalContainer}
        open={open}
        width="26.25rem"
        className="border-l border-line bg-surface"
        data-work-item-surface="true"
      >
        {children}
      </CollapsibleRightSidebar>
    </WorkItemSurfacePortalContainerContext.Provider>
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
  selectedMilestone,
  availableLabels,
  canCreateChildItem,
  parentOptions,
  childItems,
  childCopy,
  childProgress,
  editable,
  sidebarChildComposerOpen,
  linkedDocuments,
  linkedItems,
  currentUserId,
  variant = "docked",
  headerClassName,
  floatingMaxHeight,
  onCopyItemLink,
  onSetSubscription,
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
  selectedMilestone: Milestone | null
  availableLabels: AppData["labels"]
  canCreateChildItem: boolean
  parentOptions: DetailSelectOption[]
  childItems: WorkItem[]
  childCopy: DetailChildCopy
  childProgress: DetailChildProgress
  editable: boolean
  sidebarChildComposerOpen: boolean
  linkedDocuments: AppDocument[]
  linkedItems: WorkItem[]
  currentUserId: string
  variant?: WorkItemDetailSidebarVariant
  headerClassName?: string
  floatingMaxHeight?: number
  onCopyItemLink: () => void
  onSetSubscription: (subscribed: boolean) => void
  onClose?: () => void
  onCloseChildComposer: () => void
} & DetailPropertyChangeHandlers) {
  const displayedEndDate = currentItem.targetDate ?? currentItem.dueDate
  const showExtendedSections = variant !== "floating"
  const isPrivateTask = (currentItem.visibility ?? "team") === "private"
  const isSubscribed = currentItem.subscriberIds.includes(currentUserId)
  const showDeferredExtendedSections = useDeferredDetailSidebarSections({
    enabled: open && showExtendedSections,
    itemId: currentItem.id,
  })

  const content = (
    <>
      <WorkItemDetailSidebarHeader
        currentItem={currentItem}
        headerClassName={headerClassName}
        isPrivateTask={isPrivateTask}
        isSubscribed={isSubscribed}
        onCopyItemLink={onCopyItemLink}
        onSetSubscription={onSetSubscription}
        onClose={onClose}
      />

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
          canCreateChildItem={canCreateChildItem}
          childItems={childItems}
          childCopy={childCopy}
          childProgress={childProgress}
          editable={editable}
          sidebarChildComposerOpen={sidebarChildComposerOpen}
          onCloseComposer={onCloseChildComposer}
        />

        {showDeferredExtendedSections ? (
          <>
            <WorkItemRelationsSection
              linkedDocuments={linkedDocuments}
              linkedItems={linkedItems}
            />

            <DetailSidebarSection title="Activity">
              <DetailSidebarActivity
                data={data}
                currentUserId={currentUserId}
                item={currentItem}
              />
            </DetailSidebarSection>
          </>
        ) : null}
      </div>
    </>
  )

  return (
    <WorkItemDetailSidebarFrame
      open={open}
      variant={variant}
      floatingMaxHeight={floatingMaxHeight}
    >
      {content}
    </WorkItemDetailSidebarFrame>
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
        selectedMilestone={detailModel.selectedMilestone}
        availableLabels={detailModel.availableLabels}
        parentOptions={detailModel.parentOptions}
        canCreateChildItem={detailModel.canCreateChildItem}
        childItems={detailModel.childItems}
        childCopy={detailModel.childCopy}
        childProgress={detailModel.childProgress}
        editable={editable}
        sidebarChildComposerOpen={sidebarChildComposerOpen}
        linkedDocuments={detailModel.linkedDocuments}
        linkedItems={detailModel.linkedItems}
        currentUserId={data.currentUserId}
        variant={variant}
        headerClassName={headerClassName}
        floatingMaxHeight={floatingMaxHeight}
        onClose={onClose}
        onCopyItemLink={handleCopyItemLink}
        onSetSubscription={(subscribed) =>
          useAppStore
            .getState()
            .setWorkItemSubscription(currentItem.id, subscribed)
        }
        {...propertyHandlers}
        onCloseChildComposer={() => setSidebarChildComposerOpen(false)}
      />
      {confirmationDialog}
    </>
  )
}

function useProtectedWorkItemDescriptionBody({
  documentId,
  lifecycle,
}: {
  documentId: string | null
  lifecycle: WorkItemCollaborationLifecycle
}) {
  const protectedDocumentId = documentId
  const protectingBody = Boolean(
    protectedDocumentId &&
    (lifecycle === "bootstrapping" || lifecycle === "attached")
  )

  useEffect(() => {
    if (!protectedDocumentId) {
      return
    }

    useAppStore
      .getState()
      .setDocumentBodyProtection(protectedDocumentId, protectingBody)

    return () => {
      useAppStore
        .getState()
        .setDocumentBodyProtection(protectedDocumentId, false)
    }
  }, [protectedDocumentId, protectingBody])
}

function useCancelActiveDescriptionSync(
  activeItemId: string | null,
  lifecycle: WorkItemCollaborationLifecycle
) {
  useEffect(() => {
    if (!activeItemId || lifecycle === "legacy" || lifecycle === "degraded") {
      return
    }

    useAppStore.getState().cancelItemDescriptionSync(activeItemId)
  }, [activeItemId, lifecycle])
}

function useResetWorkItemChildComposers(
  itemId: string,
  setMainChildComposerOpen: (open: boolean) => void,
  setSidebarChildComposerOpen: (open: boolean) => void
) {
  useEffect(() => {
    setMainChildComposerOpen(false)
    setSidebarChildComposerOpen(false)
  }, [itemId, setMainChildComposerOpen, setSidebarChildComposerOpen])
}

function useScrollCurrentWorkItemHashTarget(
  itemId: string,
  commentCount: number
) {
  useEffect(() => {
    const hashTargetId = getCurrentHashTargetId()

    if (!hashTargetId) {
      return
    }

    const target = getHashTargetElement(hashTargetId)

    if (!target) {
      return
    }

    return scheduleScrollElementIntoCenteredView(target)
  }, [itemId, commentCount])
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
  const [mentionQueue, dispatchMentionQueue] = useReducer(
    reduceDocumentMentionQueue,
    createDocumentMentionQueueState({})
  )
  const [sendingMentionNotifications, setSendingMentionNotifications] =
    useState(false)
  const [pendingMentionExitTarget, setPendingMentionExitTarget] =
    useState<PendingMentionExitTarget>(null)
  const [pendingMentionExitDialogOpen, setPendingMentionExitDialogOpen] =
    useState(false)
  const allowPendingMentionHistoryExitRef = useRef(false)
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
  const { currentRouteHrefRef, currentRouteStateRef } =
    usePendingMentionRouteRefs(activePresenceItemId)
  const collaborationCurrentUser = useStableCollaborationUser(
    currentUser,
    currentUserId
  )
  const {
    bootstrapContent,
    editorCollaboration,
    collaboration,
    flush: flushCollaboration,
    lifecycle: collaborationLifecycle,
    viewers: collaborationViewers,
  } = useDocumentCollaboration({
    documentId: stableDescriptionDocumentId,
    currentUser: collaborationCurrentUser,
    enabled: Boolean(stableDescriptionDocumentId),
  })
  const { hasLoadedOnce: hasLoadedWorkItemReadModel } =
    useScopedReadModelRefresh({
      enabled: Boolean(itemId),
      scopeKeys: [createWorkItemDetailScopeKey(itemId)],
      fetchLatest: () => fetchWorkItemDetailReadModel(itemId),
      diagnostics: {
        retainedData: Boolean(item),
        surface: "work-item/detail",
      },
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
  const editable = item ? canEditWorkItemDetail(data, item, team) : false
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
    isCollaborationAttached,
    isCollaborationBootstrapping,
  })
  const latestDescriptionContentRef = useRef(descriptionContent)
  const mentionNotificationsEnabled = Boolean(item && !isPrivateWorkItem(item))
  const isEditingCurrentItem = Boolean(item && editable)
  const showDescriptionSyncDialog =
    isEditingCurrentItem && showDescriptionBootPreview
  const collaborationDescriptionContent = descriptionContent
  const protectedDescriptionDocumentId =
    activeDescriptionDocumentId ?? stableDescriptionDocumentId
  useProtectedWorkItemDescriptionBody({
    documentId: protectedDescriptionDocumentId,
    lifecycle: collaborationLifecycle,
  })
  useCancelActiveDescriptionSync(activePresenceItemId, collaborationLifecycle)
  useEffect(() => {
    latestDescriptionContentRef.current = descriptionContent
  }, [descriptionContent])
  useEffect(() => {
    dispatchMentionQueue({
      type: "reset-document",
      counts: extractRichTextMentionCounts(latestDescriptionContentRef.current),
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route changes clear pending mention exit UI for the newly resolved item.
    setPendingMentionExitTarget(null)
    setPendingMentionExitDialogOpen(false)
    allowPendingMentionHistoryExitRef.current = false
  }, [activePresenceItemId])

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

  useResetWorkItemChildComposers(
    itemId,
    setMainChildComposerOpen,
    setSidebarChildComposerOpen
  )
  useScrollCurrentWorkItemHashTarget(itemId, data.comments.length)
  const {
    activePendingMentionEntries,
    hasPendingMentionNotifications,
    pendingMentionSummary,
  } = usePendingMentionSummary({
    enabled: mentionNotificationsEnabled,
    mentionQueue,
  })
  const handleDescriptionMentionCountsChange =
    useCallback<DetailMentionCountsChangeHandler>(
      (counts, source) => {
        dispatchMentionQueue({
          type: "sync-counts",
          counts,
          rebaseCounts: source !== "local",
          trackCountIncreases:
            source === "local" && mentionNotificationsEnabled,
          ignoredUserIds: [currentUserId],
        })
      },
      [currentUserId, dispatchMentionQueue, mentionNotificationsEnabled]
    )

  usePendingMentionBeforeUnload(hasPendingMentionNotifications)
  usePendingMentionLinkNavigationGuard({
    hasPendingMentionNotifications,
    setExitDialogOpen: setPendingMentionExitDialogOpen,
    setPendingExitTarget: setPendingMentionExitTarget,
  })
  usePendingMentionHistoryNavigationGuard({
    allowHistoryExitRef: allowPendingMentionHistoryExitRef,
    currentRouteHrefRef,
    currentRouteStateRef,
    hasPendingMentionNotifications,
    setExitDialogOpen: setPendingMentionExitDialogOpen,
    setPendingExitTarget: setPendingMentionExitTarget,
  })

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
  const detailSidebarTitle = item
    ? getWorkItemSidebarTitle({ currentItem: item, mainSection })
    : ""
  const detailModel = useMemo(
    () =>
      item
        ? getWorkItemDetailModel({
            currentItem: item,
            data,
            editable,
            sidebarTitle: detailSidebarTitle,
            team,
          })
        : null,
    [data, detailSidebarTitle, editable, item, team]
  )

  if (!item) {
    return getMissingWorkItemDetailContent({
      deletingItem,
      hasLoadedWorkItemReadModel,
    })
  }

  const currentItem = item
  if (!detailModel) {
    return null
  }
  const {
    handleDescriptionChange,
    handleTitleCommit,
    handleReloadMainDraft,
    isMainEditing,
    mainDraftStale,
    mainDraftTitle,
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
    linkedItems,
    mentionCandidates,
    parentItem,
    parentOptions,
    referenceCandidates,
    selectedMilestone,
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

  function clearPendingMentionBatch() {
    clearDescriptionMentionQueue(dispatchMentionQueue)
  }

  function closePendingMentionExitDialog() {
    setPendingMentionExitDialogOpen(false)
    setPendingMentionExitTarget(null)
  }

  function completePendingMentionExitForItem() {
    completePendingMentionExit({
      allowHistoryExitRef: allowPendingMentionHistoryExitRef,
      closeExitDialog: closePendingMentionExitDialog,
      pendingExitTarget: pendingMentionExitTarget,
      router,
    })
  }

  async function sendPendingMentionNotifications() {
    return sendPendingItemDescriptionMentionNotifications({
      activePendingMentionEntries,
      dispatchMentionQueue,
      flushCollaboration,
      isCollaborationAttached,
      itemId: currentItem.id,
      setSendingMentionNotifications,
    })
  }

  async function handleSendMentionsAndExit() {
    const sent = await sendPendingMentionNotifications()

    if (!sent) {
      return
    }

    completePendingMentionExitForItem()
  }

  function handleSkipMentionsAndExit() {
    clearPendingMentionBatch()
    completePendingMentionExitForItem()
  }

  async function handleDeleteItem() {
    clearPendingMentionBatch()
    closePendingMentionExitDialog()
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
    editorCollaboration,
    mainDraftStale,
    collaboration,
    descriptionContent,
    isCollaborationBootstrapping,
    showDescriptionBootPreview,
    otherDescriptionViewers,
    bootstrapContent,
    mentionCandidates,
    referenceCandidates,
    collaborationDescriptionContent,
    childItems,
    childProgress,
    childCopy,
    canCreateChildItem,
    subIssuesOpen,
    mainChildComposerOpen,
    onMainDraftTitleChange: setMainDraftTitle,
    onMainDraftTitleCommit: handleTitleCommit,
    onReloadMainDraft: handleReloadMainDraft,
    onLegacyActiveBlockChange: handleLegacyActiveBlockChange,
    onDescriptionChange: handleDescriptionChange,
    onMentionCountsChange: handleDescriptionMentionCountsChange,
    onUploadAttachment: (file) =>
      useAppStore.getState().uploadAttachment("workItem", currentItem.id, file),
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
          deletingItem={deletingItem}
          propertiesOpen={propertiesOpen}
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
            selectedMilestone={selectedMilestone}
            availableLabels={availableLabels}
            parentOptions={parentOptions}
            canCreateChildItem={canCreateChildItem}
            childItems={childItems}
            childCopy={childCopy}
            childProgress={childProgress}
            editable={editable}
            sidebarChildComposerOpen={sidebarChildComposerOpen}
            linkedDocuments={linkedDocuments}
            linkedItems={linkedItems}
            currentUserId={currentUserId}
            onCopyItemLink={() => {
              void handleCopyItemLink()
            }}
            onSetSubscription={(subscribed) =>
              useAppStore
                .getState()
                .setWorkItemSubscription(currentItem.id, subscribed)
            }
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
      <PendingMentionNotificationBanner
        hasPendingMentionNotifications={hasPendingMentionNotifications}
        icon={<BellSimpleRinging weight="fill" className="size-[15px]" />}
        pendingMentionSummary={pendingMentionSummary}
        sendingMentionNotifications={sendingMentionNotifications}
        subject="work item"
        onSend={() => void sendPendingMentionNotifications()}
      />
      <PendingMentionExitDialog
        entityLabel="work item"
        exitDialogOpen={pendingMentionExitDialogOpen}
        pendingMentionSummary={pendingMentionSummary}
        sendingMentionNotifications={sendingMentionNotifications}
        onOpenChange={(open) =>
          updatePendingMentionExitDialogOpen({
            open,
            sendingMentionNotifications,
            setExitDialogOpen: setPendingMentionExitDialogOpen,
            setPendingExitTarget: setPendingMentionExitTarget,
          })
        }
        onSendAndExit={() => void handleSendMentionsAndExit()}
        onSkipAndExit={handleSkipMentionsAndExit}
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

"use client"

import type { Editor } from "@tiptap/react"
import {
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react"
import { useShallow } from "zustand/react/shallow"
import { format } from "date-fns"
import {
  CaretDown,
  Circle,
  FolderSimple,
  Smiley,
} from "@phosphor-icons/react"

import {
  getStatusOrderForTeam,
  getTeam,
  getUser,
} from "@/lib/domain/selectors"
import {
  getRootComments,
  groupCommentsByParentId,
} from "@/lib/domain/comment-threads"
import { getUsersForTeamMemberships } from "@/lib/domain/team-members"
import {
  commentContentConstraints,
  getTextInputLimitState,
  workItemTitleConstraints,
} from "@/lib/domain/input-constraints"
import {
  getChildWorkItemCopy,
  getDisplayLabelForWorkItemType,
  getPreferredWorkItemTypeForTeamExperience,
  type AppData,
  type Priority,
  type WorkItem,
  type WorkItemType,
  type WorkStatus,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { UserAvatar } from "@/components/app/user-presence"
import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { RichTextContent } from "@/components/app/rich-text-content"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { ShortcutKeys } from "@/components/app/shortcut-keys"
import {
  createInlineChildWorkItem,
  getInlineChildIssueComposerModel,
  getInlineChildTeamProjects,
} from "@/components/app/screens/inline-child-composer-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import {
  PropertyAssigneePicker,
  WorkItemPriorityPropertyPicker,
  WorkItemStatusPropertyPicker,
  WorkItemTypePropertyPicker,
  propertyChipTriggerClass as chipTriggerClass,
  propertyChipTriggerDashedClass as chipTriggerDashedClass,
} from "./property-chips"
import { useCommentComposer } from "./use-comment-composer"
import { useWorkItemCorePickerState } from "./work-item-picker-state"
import { cn } from "@/lib/utils"

export const WORK_ITEM_COMMENT_SHORTCUT_KEY_CLASS =
  "h-[18px] min-w-0 rounded-[4px] border-line bg-surface-2 px-1 text-[10.5px] text-fg-3 shadow-none"

type WorkItemCommentLimitState = ReturnType<typeof getTextInputLimitState>

export function WorkItemCommentComposerActions({
  children,
  editable = true,
  editorRef,
  emojiButtonClassName = "rounded-md p-1 text-foreground transition-colors hover:bg-accent disabled:text-muted-foreground/50 disabled:hover:bg-transparent",
  emojiIconClassName = "size-4",
  limitState,
}: {
  children: ReactNode
  editable?: boolean
  editorRef: MutableRefObject<Editor | null>
  emojiButtonClassName?: string
  emojiIconClassName?: string
  limitState: WorkItemCommentLimitState
}) {
  return (
    <>
      <FieldCharacterLimit
        state={limitState}
        limit={commentContentConstraints.max}
        className="mt-0 mb-1.5"
      />
      <div className="flex items-center justify-between gap-2">
        <EmojiPickerPopover
          align="start"
          side="top"
          onEmojiSelect={(emoji) =>
            editorRef.current?.chain().focus().insertContent(emoji).run()
          }
          trigger={
            <button
              type="button"
              disabled={!editable}
              className={emojiButtonClassName}
            >
              <Smiley className={emojiIconClassName} />
            </button>
          }
        />
        {children}
      </div>
    </>
  )
}

export function WorkItemTypeBadge({
  data,
  item,
  className,
}: {
  data: AppData
  item: WorkItem
  className?: string
}) {
  const team = getTeam(data, item.teamId)

  return (
    <Badge
      variant="outline"
      className={cn("h-4 px-1.5 py-0 text-[10px]", className)}
    >
      {getDisplayLabelForWorkItemType(item.type, team?.settings.experience)}
    </Badge>
  )
}

export function WorkItemAssigneeAvatar({
  user,
  className,
  size = "sm",
}: {
  user: AppData["users"][number] | null | undefined
  className?: string
  size?: "xs" | "sm" | "default" | "lg"
}) {
  if (!user) {
    return null
  }

  const avatarSize = size === "xs" ? "sm" : size
  const sizeClassName =
    size === "xs"
      ? "data-[size=sm]:size-5"
      : size === "sm"
        ? "data-[size=sm]:size-5"
        : size === "lg"
          ? "data-[size=lg]:size-10"
          : undefined

  return (
    <UserAvatar
      name={user.name}
      avatarImageUrl={user.avatarImageUrl}
      avatarUrl={user.avatarUrl}
      status={user.status}
      showStatus={false}
      size={avatarSize}
      className={cn(sizeClassName, className)}
    />
  )
}

export function CommentReactionButtons({
  activeClassName,
  buttonClassName,
  comment,
  currentUserId,
  disabled = false,
  inactiveClassName,
}: {
  activeClassName: string
  buttonClassName: string
  comment: AppData["comments"][number]
  currentUserId: string
  disabled?: boolean
  inactiveClassName: string
}) {
  return (
    <>
      {comment.reactions.map((reaction) => {
        const active = reaction.userIds.includes(currentUserId)

        return (
          <button
            key={`${comment.id}-${reaction.emoji}`}
            type="button"
            disabled={disabled}
            className={cn(
              buttonClassName,
              active ? activeClassName : inactiveClassName
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
    </>
  )
}

function CommentThreadHeader({
  authorName,
  createdAt,
}: {
  authorName: string | undefined
  createdAt: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{authorName}</span>
      <span className="text-xs text-muted-foreground">
        {format(new Date(createdAt), "MMM d, h:mm a")}
      </span>
    </div>
  )
}

function CommentThreadActions({
  comment,
  currentUserId,
  editable,
  onReplyToggle,
}: {
  comment: AppData["comments"][number]
  currentUserId: string
  editable: boolean
  onReplyToggle: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CommentReactionButtons
        activeClassName="border-primary/40 bg-primary/10 text-foreground"
        buttonClassName="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors"
        comment={comment}
        currentUserId={currentUserId}
        inactiveClassName="hover:bg-accent"
      />
      {editable ? (
        <EmojiPickerPopover
          align="start"
          side="top"
          onEmojiSelect={(emoji) => {
            useAppStore.getState().toggleCommentReaction(comment.id, emoji)
          }}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Smiley className="size-3.5" />
              <span>React</span>
            </button>
          }
        />
      ) : null}
      {editable ? (
        <button
          type="button"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={onReplyToggle}
        >
          Reply
        </button>
      ) : null}
    </div>
  )
}

function CommentReplyComposer({
  editable,
  mentionCandidates,
  replyContent,
  replyEditorRef,
  replyLimitState,
  setReplyContent,
  onCancel,
  onReply,
}: {
  editable: boolean
  mentionCandidates: AppData["users"]
  replyContent: string
  replyEditorRef: MutableRefObject<Editor | null>
  replyLimitState: ReturnType<typeof getTextInputLimitState>
  setReplyContent: (content: string) => void
  onCancel: () => void
  onReply: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background/70 p-3">
      <div className="rounded-md border border-line bg-surface px-3 py-2 transition-colors focus-within:border-fg-3">
        <RichTextEditor
          content={replyContent}
          onChange={setReplyContent}
          editable={editable}
          compact
          autoFocus
          allowSlashCommands={false}
          showToolbar={false}
          showStats={false}
          placeholder="Reply to this thread..."
          editorInstanceRef={replyEditorRef}
          mentionCandidates={mentionCandidates}
          minPlainTextCharacters={commentContentConstraints.min}
          maxPlainTextCharacters={commentContentConstraints.max}
          enforcePlainTextLimit
          onSubmitShortcut={onReply}
          submitOnEnter
          className="[&_.ProseMirror]:min-h-[3rem] [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-[1.55]"
        />
      </div>
      <div>
        <WorkItemCommentComposerActions
          editorRef={replyEditorRef}
          limitState={replyLimitState}
        >
          <ShortcutKeys
            keys={["Enter"]}
            className="ml-auto"
            keyClassName={WORK_ITEM_COMMENT_SHORTCUT_KEY_CLASS}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onCancel}>
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
}

function CommentReplies({
  editable,
  mentionCandidates,
  replies,
  repliesByParentId,
  targetId,
  targetType,
}: {
  editable: boolean
  mentionCandidates: AppData["users"]
  replies: AppData["comments"]
  repliesByParentId: Record<string, AppData["comments"]>
  targetId: string
  targetType: "workItem" | "document"
}) {
  if (replies.length === 0) {
    return null
  }

  return (
    <div className="ml-4 flex flex-col gap-3 border-l pl-4">
      {replies.map((reply) => (
        <CommentThreadItem
          key={reply.id}
          comment={reply}
          repliesByParentId={repliesByParentId}
          editable={editable}
          targetType={targetType}
          targetId={targetId}
          mentionCandidates={mentionCandidates}
        />
      ))}
    </div>
  )
}

function CommentThreadItem({
  comment,
  repliesByParentId,
  editable,
  targetType,
  targetId,
  mentionCandidates,
}: {
  comment: AppData["comments"][number]
  repliesByParentId: Record<string, AppData["comments"]>
  editable: boolean
  targetType: "workItem" | "document"
  targetId: string
  mentionCandidates: AppData["users"]
}) {
  const { author, currentUserId } = useAppStore(
    useShallow((state) => ({
      author: getUser(state, comment.createdBy),
      currentUserId: state.currentUserId,
    }))
  )
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyContent, setReplyContent] = useState("")
  const replyEditorRef = useRef<Editor | null>(null)
  const replies = repliesByParentId[comment.id] ?? []
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
      targetType,
      targetId,
      parentCommentId: comment.id,
      content: replyContent,
    })
    setReplyContent("")
    setReplyOpen(false)
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4">
      <CommentThreadHeader authorName={author?.name} createdAt={comment.createdAt} />

      <RichTextContent
        content={comment.content}
        className="text-sm leading-7 text-muted-foreground [&_p]:my-0 [&_p+p]:mt-2"
      />

      <CommentThreadActions
        comment={comment}
        currentUserId={currentUserId}
        editable={editable}
        onReplyToggle={() => setReplyOpen((current) => !current)}
      />

      {replyOpen ? (
        <CommentReplyComposer
          editable={editable}
          mentionCandidates={mentionCandidates}
          replyContent={replyContent}
          replyEditorRef={replyEditorRef}
          replyLimitState={replyLimitState}
          setReplyContent={setReplyContent}
          onCancel={() => {
            setReplyContent("")
            setReplyOpen(false)
          }}
          onReply={handleReply}
        />
      ) : null}

      <CommentReplies
        editable={editable}
        mentionCandidates={mentionCandidates}
        replies={replies}
        repliesByParentId={repliesByParentId}
        targetId={targetId}
        targetType={targetType}
      />
    </div>
  )
}

export function CommentsInline({
  targetType,
  targetId,
  editable,
}: {
  targetType: "workItem" | "document"
  targetId: string
  editable: boolean
}) {
  const {
    allComments,
    currentUserId,
    documents,
    teamMemberships,
    users,
    workItems,
  } = useAppStore(
    useShallow((state) => {
      return {
        allComments: state.comments,
        currentUserId: state.currentUserId,
        documents: state.documents,
        teamMemberships: state.teamMemberships,
        users: state.users,
        workItems: state.workItems,
      }
    })
  )
  const targetTeamId = useMemo(
    () =>
      targetType === "workItem"
        ? (workItems.find((item) => item.id === targetId)?.teamId ?? null)
        : (documents.find((document) => document.id === targetId)?.teamId ??
          null),
    [documents, targetId, targetType, workItems]
  )
  const comments = useMemo(
    () =>
      allComments
        .filter(
          (comment) =>
            comment.targetType === targetType && comment.targetId === targetId
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [allComments, targetId, targetType]
  )
  const mentionCandidates = useMemo(() => {
    const candidateUsers = users.filter(
      (candidate) => candidate.id !== currentUserId
    )

    if (!targetTeamId) {
      return candidateUsers
    }

    const memberIds = new Set(
      teamMemberships
        .filter((membership) => membership.teamId === targetTeamId)
        .map((membership) => membership.userId)
    )

    return candidateUsers.filter((candidate) => memberIds.has(candidate.id))
  }, [currentUserId, targetTeamId, teamMemberships, users])
  const rootComments = useMemo(
    () => getRootComments(comments),
    [comments]
  )
  const repliesByParentId = useMemo(
    () => groupCommentsByParentId(comments),
    [comments]
  )
  const {
    commentEditorRef,
    commentLimitState,
    content,
    handleComment,
    setContent,
  } = useCommentComposer(targetType, targetId)

  return (
    <div className="flex flex-col gap-4">
      {rootComments.map((comment) => (
        <CommentThreadItem
          key={comment.id}
          comment={comment}
          repliesByParentId={repliesByParentId}
          editable={editable}
          targetType={targetType}
          targetId={targetId}
          mentionCandidates={mentionCandidates}
        />
      ))}
      <div className="flex flex-col gap-2">
        <div className="rounded-md border border-line bg-surface px-3 py-2 transition-colors focus-within:border-fg-3">
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
        </div>
        <div>
          <WorkItemCommentComposerActions
            editable={editable}
            editorRef={commentEditorRef}
            limitState={commentLimitState}
          >
            <ShortcutKeys
              keys={["Enter"]}
              keyClassName={WORK_ITEM_COMMENT_SHORTCUT_KEY_CLASS}
            />
            <Button
              size="sm"
              disabled={!editable || !commentLimitState.canSubmit}
              onClick={handleComment}
            >
              Comment
            </Button>
          </WorkItemCommentComposerActions>
        </div>
      </div>
    </div>
  )
}

type TeamRecord = AppData["teams"][number]
type ProjectRecord = AppData["projects"][number]
type UserRecord = AppData["users"][number]

function InlineChildIssueFields({
  childTitlePlaceholder,
  description,
  title,
  titleLimitState,
  onDescriptionChange,
  onTitleChange,
}: {
  childTitlePlaceholder: string
  description: string
  title: string
  titleLimitState: ReturnType<typeof getTextInputLimitState>
  onDescriptionChange: (value: string) => void
  onTitleChange: (value: string) => void
}) {
  return (
    <div className="flex gap-3 px-3 py-3">
      <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <Input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={childTitlePlaceholder}
          maxLength={workItemTitleConstraints.max}
          className="h-auto border-none bg-transparent px-0 py-0 text-sm shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0 dark:bg-transparent"
          autoFocus
        />
        <FieldCharacterLimit
          state={titleLimitState}
          limit={workItemTitleConstraints.max}
          className="mt-1"
        />
        <Textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Add description..."
          rows={1}
          className="mt-1 min-h-0 resize-none border-none bg-transparent px-0 py-0 text-xs text-muted-foreground shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
    </div>
  )
}

function InlineChildAssigneePicker({
  assigneeId,
  assigneeQuery,
  open,
  selectedAssignee,
  team,
  teamMembers,
  onOpenChange,
  onQueryChange,
  onSelect,
}: {
  assigneeId: string
  assigneeQuery: string
  open: boolean
  selectedAssignee: UserRecord | null
  team: TeamRecord | null
  teamMembers: UserRecord[]
  onOpenChange: (open: boolean) => void
  onQueryChange: (value: string) => void
  onSelect: (value: string) => void
}) {
  return (
    <PropertyAssigneePicker
      open={open}
      onOpenChange={onOpenChange}
      query={assigneeQuery}
      onQueryChange={onQueryChange}
      members={teamMembers}
      selectedAssignee={selectedAssignee}
      selectedAssigneeId={assigneeId}
      disabled={!team}
      onSelect={onSelect}
    />
  )
}

function InlineChildProjectChip({
  selectedProject,
}: {
  selectedProject: ProjectRecord | null
}) {
  return (
    <button
      type="button"
      className={cn(
        chipTriggerClass,
        !selectedProject && chipTriggerDashedClass
      )}
      disabled
    >
      <FolderSimple className="size-[13px]" />
      <span
        className={cn(
          "truncate",
          selectedProject && "font-medium text-foreground"
        )}
      >
        {selectedProject ? selectedProject.name : "No project"}
      </span>
      <CaretDown className="size-3 shrink-0 opacity-60" />
    </button>
  )
}

function InlineChildComposerActions({
  canCreate,
  selectedTypeLabel,
  onCancel,
  onCreate,
}: {
  canCreate: boolean
  selectedTypeLabel: string
  onCancel: () => void
  onCreate: () => void
}) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" disabled={!canCreate} onClick={onCreate}>
        Create {selectedTypeLabel.toLowerCase()}
      </Button>
    </div>
  )
}

function useInlineChildComposerData({
  parentItem,
  teamId,
}: {
  parentItem: WorkItem
  teamId: string
}) {
  const { projects, teamMemberships, teams, users } = useAppStore(
    useShallow((state) => ({
      projects: state.projects,
      teamMemberships: state.teamMemberships,
      teams: state.teams,
      users: state.users,
    }))
  )
  const team = useMemo(
    () => teams.find((entry) => entry.id === teamId) ?? null,
    [teamId, teams]
  )
  const teamMembers = useMemo(() => {
    return getUsersForTeamMemberships({
      teamId,
      teamMemberships,
      users,
    })
  }, [teamId, teamMemberships, users])
  const teamProjects = useMemo(() => {
    return getInlineChildTeamProjects({ parentItem, projects, teamId })
  }, [parentItem, projects, teamId])

  return {
    team,
    teamMembers,
    teamProjects,
  }
}

function getInitialInlineChildStatus(teamStatuses: WorkStatus[]) {
  return teamStatuses.includes("todo") ? "todo" : (teamStatuses[0] ?? "backlog")
}

function useInlineChildIssueDraft({
  teamExperience,
  teamStatuses,
}: {
  teamExperience: Parameters<typeof getPreferredWorkItemTypeForTeamExperience>[0]
  teamStatuses: WorkStatus[]
}) {
  const [type, setType] = useState<WorkItemType>(
    getPreferredWorkItemTypeForTeamExperience(teamExperience, {
      parent: true,
    })
  )
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const pickerState = useWorkItemCorePickerState()
  const [status, setStatus] = useState<WorkStatus>(
    getInitialInlineChildStatus(teamStatuses)
  )
  const [priority, setPriority] = useState<Priority>("none")
  const [assigneeId, setAssigneeId] = useState<string>("none")

  return {
    assigneeId,
    description,
    pickerState,
    priority,
    setAssigneeId,
    setDescription,
    setPriority,
    setStatus,
    setTitle,
    setType,
    status,
    title,
    type,
  }
}

function InlineChildIssueToolbar({
  assigneeId,
  assigneePickerOpen,
  assigneeQuery,
  availableItemTypes,
  canCreate,
  priority,
  priorityPickerOpen,
  selectedAssignee,
  selectedProject,
  selectedType,
  selectedTypeLabel,
  setAssigneeId,
  setAssigneePickerOpen,
  setAssigneeQuery,
  setPriority,
  setPriorityPickerOpen,
  setStatus,
  setStatusPickerOpen,
  setStatusQuery,
  setType,
  setTypePickerOpen,
  status,
  statusPickerOpen,
  statusQuery,
  team,
  teamMembers,
  teamStatuses,
  typePickerOpen,
  onCancel,
  onCreate,
}: {
  assigneeId: string
  assigneePickerOpen: boolean
  assigneeQuery: string
  availableItemTypes: WorkItemType[]
  canCreate: boolean
  priority: Priority
  priorityPickerOpen: boolean
  selectedAssignee: ReturnType<
    typeof getInlineChildIssueComposerModel
  >["selectedAssignee"]
  selectedProject: ReturnType<
    typeof getInlineChildIssueComposerModel
  >["selectedProject"]
  selectedType: WorkItemType
  selectedTypeLabel: string
  setAssigneeId: (value: string) => void
  setAssigneePickerOpen: (open: boolean) => void
  setAssigneeQuery: (query: string) => void
  setPriority: (value: Priority) => void
  setPriorityPickerOpen: (open: boolean) => void
  setStatus: (value: WorkStatus) => void
  setStatusPickerOpen: (open: boolean) => void
  setStatusQuery: (query: string) => void
  setType: (value: WorkItemType) => void
  setTypePickerOpen: (open: boolean) => void
  status: WorkStatus
  statusPickerOpen: boolean
  statusQuery: string
  team: ReturnType<typeof useInlineChildComposerData>["team"]
  teamMembers: ReturnType<typeof useInlineChildComposerData>["teamMembers"]
  teamStatuses: WorkStatus[]
  typePickerOpen: boolean
  onCancel: () => void
  onCreate: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-line-soft bg-background px-3 py-2">
      <WorkItemTypePropertyPicker
        availableItemTypes={availableItemTypes}
        collapseSingleOption
        hideWhenEmpty
        open={typePickerOpen}
        selectedType={selectedType}
        selectedTypeLabel={selectedTypeLabel}
        team={team}
        onOpenChange={setTypePickerOpen}
        onSelect={(value) => {
          setType(value)
          setTypePickerOpen(false)
        }}
      />
      <WorkItemStatusPropertyPicker
        open={statusPickerOpen}
        status={status}
        query={statusQuery}
        team={team}
        teamStatuses={teamStatuses}
        onOpenChange={setStatusPickerOpen}
        onQueryChange={setStatusQuery}
        onSelect={(value: WorkStatus) => {
          setStatus(value)
          setStatusPickerOpen(false)
        }}
      />
      <WorkItemPriorityPropertyPicker
        open={priorityPickerOpen}
        priority={priority}
        team={team}
        onOpenChange={setPriorityPickerOpen}
        onSelect={(value: Priority) => {
          setPriority(value)
          setPriorityPickerOpen(false)
        }}
      />
      <InlineChildAssigneePicker
        assigneeId={assigneeId}
        assigneeQuery={assigneeQuery}
        open={assigneePickerOpen}
        selectedAssignee={selectedAssignee}
        team={team}
        teamMembers={teamMembers}
        onOpenChange={setAssigneePickerOpen}
        onQueryChange={setAssigneeQuery}
        onSelect={(value) => {
          setAssigneeId(value)
          setAssigneePickerOpen(false)
        }}
      />
      <InlineChildProjectChip selectedProject={selectedProject} />
      <InlineChildComposerActions
        canCreate={canCreate}
        selectedTypeLabel={selectedTypeLabel}
        onCancel={onCancel}
        onCreate={onCreate}
      />
    </div>
  )
}

export function InlineChildIssueComposer({
  teamId,
  parentItem,
  disabled,
  onCancel,
  onCreated,
}: {
  teamId: string
  parentItem: WorkItem
  disabled: boolean
  onCancel: () => void
  onCreated: () => void
}) {
  const { team, teamMembers, teamProjects } = useInlineChildComposerData({
    parentItem,
    teamId,
  })
  const childCopy = getChildWorkItemCopy(
    parentItem.type,
    team?.settings.experience
  )
  const teamStatuses = getStatusOrderForTeam(team)
  const draft = useInlineChildIssueDraft({
    teamExperience: team?.settings.experience,
    teamStatuses,
  })
  const model = getInlineChildIssueComposerModel({
    assigneeId: draft.assigneeId,
    disabled,
    parentItem,
    projectId: parentItem.primaryProjectId ?? "none",
    team,
    teamMembers,
    teamProjects,
    title: draft.title,
    type: draft.type,
  })
  const pickerState = draft.pickerState
  const projectId = parentItem.primaryProjectId ?? "none"

  const {
    assigneePickerOpen,
    assigneeQuery,
    priorityPickerOpen,
    setAssigneePickerOpen,
    setAssigneeQuery,
    setPriorityPickerOpen,
    setStatusPickerOpen,
    setStatusQuery,
    setTypePickerOpen,
    statusPickerOpen,
    statusQuery,
    typePickerOpen,
  } = pickerState

  function handleCreate() {
    if (!model.titleLimitState.canSubmit) {
      return
    }

    const createdItemId = createInlineChildWorkItem({
      assigneeId: draft.assigneeId,
      description: draft.description,
      normalizedTitle: model.normalizedTitle,
      parentItem,
      priority: draft.priority,
      projectId,
      selectedType: model.selectedType,
      status: draft.status,
      teamId,
    })

    if (!createdItemId) {
      return
    }

    onCreated()
  }

  return (
    <div className="rounded-b-lg bg-background">
      <InlineChildIssueFields
        childTitlePlaceholder={childCopy.titlePlaceholder}
        description={draft.description}
        title={draft.title}
        titleLimitState={model.titleLimitState}
        onDescriptionChange={draft.setDescription}
        onTitleChange={draft.setTitle}
      />

      <InlineChildIssueToolbar
        assigneeId={draft.assigneeId}
        assigneePickerOpen={assigneePickerOpen}
        assigneeQuery={assigneeQuery}
        availableItemTypes={model.availableItemTypes}
        canCreate={model.canCreate}
        priority={draft.priority}
        priorityPickerOpen={priorityPickerOpen}
        selectedAssignee={model.selectedAssignee}
        selectedProject={model.selectedProject}
        selectedType={model.selectedType}
        selectedTypeLabel={model.selectedTypeLabel}
        setAssigneeId={draft.setAssigneeId}
        setAssigneePickerOpen={setAssigneePickerOpen}
        setAssigneeQuery={setAssigneeQuery}
        setPriority={draft.setPriority}
        setPriorityPickerOpen={setPriorityPickerOpen}
        setStatus={draft.setStatus}
        setStatusPickerOpen={setStatusPickerOpen}
        setStatusQuery={setStatusQuery}
        setType={draft.setType}
        setTypePickerOpen={setTypePickerOpen}
        status={draft.status}
        statusPickerOpen={statusPickerOpen}
        statusQuery={statusQuery}
        team={team}
        teamMembers={teamMembers}
        teamStatuses={teamStatuses}
        typePickerOpen={typePickerOpen}
        onCancel={onCancel}
        onCreate={handleCreate}
      />
    </div>
  )
}

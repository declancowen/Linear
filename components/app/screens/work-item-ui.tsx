"use client"

import type { Editor } from "@tiptap/react"
import { useMemo, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { format } from "date-fns"
import {
  CaretDown,
  Check,
  Circle,
  FolderSimple,
  MagnifyingGlass,
  Smiley,
  X,
} from "@phosphor-icons/react"

import { getStatusOrderForTeam, getTeam, getUser } from "@/lib/domain/selectors"
import {
  getAllowedChildWorkItemTypesForItem,
  getAllowedWorkItemTypesForTemplate,
  getChildWorkItemCopy,
  getDefaultWorkItemTypesForTeamExperience,
  getDisplayLabelForWorkItemType,
  getPreferredWorkItemTypeForTeamExperience,
  priorityMeta,
  statusMeta,
  type AppData,
  type Priority,
  type WorkItem,
  type WorkItemType,
  type WorkStatus,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { UserAvatar } from "@/components/app/user-presence"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
import { RichTextContent } from "@/components/app/rich-text-content"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { ShortcutKeys } from "@/components/app/shortcut-keys"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverFoot,
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
  PropertyPopoverSearch,
} from "@/components/ui/template-primitives"
import { Textarea } from "@/components/ui/textarea"

import { formatInlineDescriptionContent } from "./helpers"
import { PriorityDot, PriorityIcon, StatusIcon } from "./shared"
import { cn, getPlainTextContent, resolveImageAssetSource } from "@/lib/utils"

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

  const sizeClassName =
    size === "xs"
      ? "data-[size=xs]:size-3.5"
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
      size={size}
      className={cn(sizeClassName, className)}
    />
  )
}

function getUserInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
}

function AssigneeOption({
  name,
  avatarUrl,
  avatarImageUrl,
}: {
  name: string
  avatarUrl?: string | null
  avatarImageUrl?: string | null
}) {
  const imageSrc = resolveImageAssetSource(avatarImageUrl, avatarUrl)

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar size="sm" className="size-4 data-[size=sm]:size-4">
        {imageSrc ? <AvatarImage src={imageSrc} alt={name} /> : null}
        <AvatarFallback>{getUserInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate">{name}</span>
    </span>
  )
}

const OPEN_STATUSES: WorkStatus[] = ["backlog", "todo", "in-progress"]
const CLOSED_STATUSES: WorkStatus[] = ["done", "cancelled", "duplicate"]
const PRIORITY_ORDER: Priority[] = ["none", "urgent", "high", "medium", "low"]

function matchesQuery(value: string, query: string) {
  if (!query) {
    return true
  }
  return value.toLowerCase().includes(query.toLowerCase())
}

const chipTriggerClass =
  "inline-flex h-7 w-fit max-w-full items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

const chipTriggerDashedClass =
  "border-dashed bg-transparent text-fg-3 hover:bg-surface-3"

const crumbTriggerClass =
  "inline-flex h-7 w-fit items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

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
  const replyText = getPlainTextContent(replyContent)

  function handleReply() {
    if (!replyText) {
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
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{author?.name}</span>
        <span className="text-xs text-muted-foreground">
          {format(new Date(comment.createdAt), "MMM d, h:mm a")}
        </span>
      </div>

      <RichTextContent
        content={comment.content}
        className="text-sm leading-7 text-muted-foreground [&_p]:my-0 [&_p+p]:mt-2"
      />

      <div className="flex flex-wrap items-center gap-2">
        {comment.reactions.map((reaction) => {
          const active = reaction.userIds.includes(currentUserId)

          return (
            <button
              key={`${comment.id}-${reaction.emoji}`}
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors",
                active
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "hover:bg-accent"
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
            onClick={() => setReplyOpen((current) => !current)}
          >
            Reply
          </button>
        ) : null}
      </div>

      {replyOpen ? (
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
              onSubmitShortcut={handleReply}
              submitOnEnter
              className="[&_.ProseMirror]:min-h-[3rem] [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-[1.55]"
            />
          </div>
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
                  className="rounded-md p-1 text-foreground transition-colors hover:bg-accent"
                >
                  <Smiley className="size-4" />
                </button>
              }
            />
            <ShortcutKeys
              keys={["Enter"]}
              className="ml-auto"
              keyClassName="h-[18px] min-w-0 rounded-[4px] border-line bg-surface-2 px-1 text-[10.5px] text-fg-3 shadow-none"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
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
      ) : null}

      {replies.length > 0 ? (
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
      ) : null}
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
    () => comments.filter((comment) => comment.parentCommentId === null),
    [comments]
  )
  const repliesByParentId = useMemo(
    () =>
      comments.reduce<Record<string, AppData["comments"]>>(
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
      ),
    [comments]
  )
  const [content, setContent] = useState("")
  const commentEditorRef = useRef<Editor | null>(null)
  const contentText = getPlainTextContent(content)

  function handleComment() {
    if (!contentText) {
      return
    }

    useAppStore.getState().addComment({
      targetType,
      targetId,
      content,
    })
    setContent("")
  }

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
            onSubmitShortcut={handleComment}
            submitOnEnter
            className="[&_.ProseMirror]:min-h-[3rem] [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-[1.55]"
          />
        </div>
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
                className="rounded-md p-1 text-foreground transition-colors hover:bg-accent disabled:text-muted-foreground/50 disabled:hover:bg-transparent"
              >
                <Smiley className="size-4" />
              </button>
            }
          />
          <ShortcutKeys
            keys={["Enter"]}
            keyClassName="h-[18px] min-w-0 rounded-[4px] border-line bg-surface-2 px-1 text-[10.5px] text-fg-3 shadow-none"
          />
          <Button
            size="sm"
            disabled={!editable || !contentText}
            onClick={handleComment}
          >
            Comment
          </Button>
        </div>
      </div>
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
  const teams = useAppStore((state) => state.teams)
  const teamMemberships = useAppStore((state) => state.teamMemberships)
  const users = useAppStore((state) => state.users)
  const projects = useAppStore((state) => state.projects)
  const team = useMemo(
    () => teams.find((entry) => entry.id === teamId) ?? null,
    [teamId, teams]
  )
  const teamMembers = useMemo(() => {
    const memberIds = new Set(
      teamMemberships
        .filter((membership) => membership.teamId === teamId)
        .map((membership) => membership.userId)
    )

    return users.filter((user) => memberIds.has(user.id))
  }, [teamId, teamMemberships, users])
  const teamProjects = useMemo(() => {
    const scopedProjects = projects.filter(
      (project) => project.scopeType === "team" && project.scopeId === teamId
    )

    if (!parentItem.primaryProjectId) {
      return scopedProjects
    }

    const selectedProject =
      projects.find((project) => project.id === parentItem.primaryProjectId) ??
      null

    if (
      !selectedProject ||
      scopedProjects.some((project) => project.id === selectedProject.id)
    ) {
      return scopedProjects
    }

    return [selectedProject, ...scopedProjects]
  }, [parentItem.primaryProjectId, projects, teamId])
  const childCopy = getChildWorkItemCopy(
    parentItem.type,
    team?.settings.experience
  )
  const teamStatuses = getStatusOrderForTeam(team)
  const [type, setType] = useState<WorkItemType>(
    getPreferredWorkItemTypeForTeamExperience(team?.settings.experience, {
      parent: true,
    })
  )
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const [statusPickerOpen, setStatusPickerOpen] = useState(false)
  const [statusQuery, setStatusQuery] = useState("")
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false)
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false)
  const [assigneeQuery, setAssigneeQuery] = useState("")
  const [status, setStatus] = useState<WorkStatus>(
    teamStatuses.includes("todo") ? "todo" : (teamStatuses[0] ?? "backlog")
  )
  const [priority, setPriority] = useState<Priority>("medium")
  const [assigneeId, setAssigneeId] = useState<string>("none")
  const projectId = parentItem.primaryProjectId ?? "none"
  const fallbackType = getPreferredWorkItemTypeForTeamExperience(
    team?.settings.experience,
    {
      parent: true,
    }
  )
  const selectedProject =
    projectId === "none"
      ? null
      : (teamProjects.find((project) => project.id === projectId) ?? null)
  const baseItemTypes = selectedProject
    ? getAllowedWorkItemTypesForTemplate(selectedProject.templateType)
    : getDefaultWorkItemTypesForTeamExperience(team?.settings.experience)
  const availableItemTypes = baseItemTypes.filter((value) =>
    getAllowedChildWorkItemTypesForItem(parentItem).includes(value)
  )
  const selectedType = availableItemTypes.includes(type)
    ? type
    : (availableItemTypes[0] ?? fallbackType)
  const selectedTypeLabel = getDisplayLabelForWorkItemType(
    selectedType,
    team?.settings.experience
  )
  const selectedAssignee =
    assigneeId === "none"
      ? null
      : (teamMembers.find((user) => user.id === assigneeId) ?? null)
  const normalizedTitle = title.trim()
  const canCreate =
    !disabled && normalizedTitle.length >= 2 && availableItemTypes.length > 0

  function handleCreate() {
    const createdItemId = useAppStore.getState().createWorkItem({
      teamId,
      type: selectedType,
      title: normalizedTitle,
      priority,
      status,
      parentId: parentItem.id,
      assigneeId: assigneeId === "none" ? null : assigneeId,
      primaryProjectId: projectId === "none" ? null : projectId,
    })

    if (!createdItemId) {
      return
    }

    if (description.trim()) {
      useAppStore
        .getState()
        .updateItemDescription(
          createdItemId,
          formatInlineDescriptionContent(description)
        )
    }

    onCreated()
  }

  return (
    <div className="rounded-b-lg bg-background">
      <div className="flex gap-3 px-3 py-3">
        <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={childCopy.titlePlaceholder}
            className="h-auto border-none bg-transparent px-0 py-0 text-sm shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0 dark:bg-transparent"
            autoFocus
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add description..."
            rows={1}
            className="mt-1 min-h-0 resize-none border-none bg-transparent px-0 py-0 text-xs text-muted-foreground shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-line-soft bg-background px-3 py-2">
        {availableItemTypes.length > 1 ? (
          <Popover open={typePickerOpen} onOpenChange={setTypePickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={crumbTriggerClass}
                disabled={availableItemTypes.length === 0 || !team}
              >
                <span className="font-medium text-foreground">
                  {selectedTypeLabel}
                </span>
                <CaretDown className="size-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className={cn(PROPERTY_POPOVER_CLASS, "w-[220px]")}
            >
              <PropertyPopoverList>
                <PropertyPopoverGroup>Work item type</PropertyPopoverGroup>
                {availableItemTypes.map((value) => (
                  <PropertyPopoverItem
                    key={value}
                    selected={value === selectedType}
                    onClick={() => {
                      setType(value)
                      setTypePickerOpen(false)
                    }}
                    trailing={
                      value === selectedType ? (
                        <Check className="size-[14px] text-foreground" />
                      ) : null
                    }
                  >
                    <span className="truncate">
                      {getDisplayLabelForWorkItemType(
                        value,
                        team?.settings.experience
                      )}
                    </span>
                  </PropertyPopoverItem>
                ))}
              </PropertyPopoverList>
            </PopoverContent>
          </Popover>
        ) : availableItemTypes.length === 1 ? (
          <div
            className={cn(
              crumbTriggerClass,
              "cursor-default hover:bg-transparent"
            )}
          >
            <span className="font-medium text-foreground">
              {selectedTypeLabel}
            </span>
          </div>
        ) : null}

        <Popover
          open={statusPickerOpen}
          onOpenChange={(next) => {
            setStatusPickerOpen(next)
            if (!next) setStatusQuery("")
          }}
        >
          <PopoverTrigger asChild>
            <button type="button" className={chipTriggerClass} disabled={!team}>
              <StatusIcon status={status} />
              <span className="font-medium text-foreground">
                {statusMeta[status].label}
              </span>
              <CaretDown className="size-3 shrink-0 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className={PROPERTY_POPOVER_CLASS}>
            <PropertyPopoverSearch
              icon={<MagnifyingGlass className="size-[14px]" />}
              placeholder="Change status…"
              value={statusQuery}
              onChange={setStatusQuery}
            />
            <PropertyPopoverList>
              {(() => {
                const activeMatches = teamStatuses.filter(
                  (value) =>
                    OPEN_STATUSES.includes(value) &&
                    matchesQuery(statusMeta[value].label, statusQuery)
                )
                const closedMatches = teamStatuses.filter(
                  (value) =>
                    CLOSED_STATUSES.includes(value) &&
                    matchesQuery(statusMeta[value].label, statusQuery)
                )

                return (
                  <>
                    {activeMatches.length > 0 ? (
                      <>
                        <PropertyPopoverGroup>Active</PropertyPopoverGroup>
                        {activeMatches.map((value) => (
                          <PropertyPopoverItem
                            key={value}
                            selected={value === status}
                            onClick={() => {
                              setStatus(value)
                              setStatusPickerOpen(false)
                            }}
                            trailing={
                              value === status ? (
                                <Check className="size-[14px] text-foreground" />
                              ) : null
                            }
                          >
                            <StatusIcon status={value} />
                            <span>{statusMeta[value].label}</span>
                          </PropertyPopoverItem>
                        ))}
                      </>
                    ) : null}
                    {closedMatches.length > 0 ? (
                      <>
                        <PropertyPopoverGroup>Closed</PropertyPopoverGroup>
                        {closedMatches.map((value) => (
                          <PropertyPopoverItem
                            key={value}
                            selected={value === status}
                            onClick={() => {
                              setStatus(value)
                              setStatusPickerOpen(false)
                            }}
                            trailing={
                              value === status ? (
                                <Check className="size-[14px] text-foreground" />
                              ) : null
                            }
                          >
                            <StatusIcon status={value} />
                            <span>{statusMeta[value].label}</span>
                          </PropertyPopoverItem>
                        ))}
                      </>
                    ) : null}
                    {activeMatches.length === 0 &&
                    closedMatches.length === 0 ? (
                      <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
                        No statuses match
                      </div>
                    ) : null}
                  </>
                )
              })()}
            </PropertyPopoverList>
            <PropertyPopoverFoot>
              <span>↑↓ to navigate · ↵ to select</span>
            </PropertyPopoverFoot>
          </PopoverContent>
        </Popover>

        <Popover open={priorityPickerOpen} onOpenChange={setPriorityPickerOpen}>
          <PopoverTrigger asChild>
            <button type="button" className={chipTriggerClass} disabled={!team}>
              <PriorityDot priority={priority} />
              <span className="font-medium text-foreground">
                {priorityMeta[priority].label}
              </span>
              <CaretDown className="size-3 shrink-0 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className={cn(PROPERTY_POPOVER_CLASS, "w-[220px]")}
          >
            <PropertyPopoverList>
              {PRIORITY_ORDER.map((value) => (
                <PropertyPopoverItem
                  key={value}
                  selected={value === priority}
                  onClick={() => {
                    setPriority(value)
                    setPriorityPickerOpen(false)
                  }}
                  trailing={
                    value === priority ? (
                      <Check className="size-[14px] text-foreground" />
                    ) : null
                  }
                >
                  <PriorityIcon priority={value} />
                  <span>
                    {value === "none"
                      ? "No priority"
                      : priorityMeta[value].label}
                  </span>
                </PropertyPopoverItem>
              ))}
            </PropertyPopoverList>
          </PopoverContent>
        </Popover>

        <Popover
          open={assigneePickerOpen}
          onOpenChange={(next) => {
            setAssigneePickerOpen(next)
            if (!next) setAssigneeQuery("")
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                chipTriggerClass,
                !selectedAssignee && chipTriggerDashedClass
              )}
              disabled={!team}
            >
              {selectedAssignee ? (
                <AssigneeOption
                  name={selectedAssignee.name}
                  avatarImageUrl={selectedAssignee.avatarImageUrl}
                  avatarUrl={selectedAssignee.avatarUrl}
                />
              ) : (
                <span className="flex items-center gap-1.5 text-fg-3">
                  <span className="inline-grid size-[18px] place-items-center rounded-full border border-dashed border-line text-[9px] text-fg-3">
                    ?
                  </span>
                  Unassigned
                </span>
              )}
              <CaretDown className="size-3 shrink-0 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className={cn(PROPERTY_POPOVER_CLASS, "w-[300px]")}
          >
            <PropertyPopoverSearch
              icon={<MagnifyingGlass className="size-[14px]" />}
              placeholder="Assign someone…"
              value={assigneeQuery}
              onChange={setAssigneeQuery}
            />
            <PropertyPopoverList>
              {(() => {
                const matches = teamMembers.filter((user) =>
                  matchesQuery(user.name, assigneeQuery)
                )

                return (
                  <>
                    {matches.length > 0 ? (
                      <>
                        <PropertyPopoverGroup>Members</PropertyPopoverGroup>
                        {matches.map((user) => (
                          <PropertyPopoverItem
                            key={user.id}
                            selected={user.id === assigneeId}
                            onClick={() => {
                              setAssigneeId(user.id)
                              setAssigneePickerOpen(false)
                            }}
                            trailing={
                              user.id === assigneeId ? (
                                <Check className="size-[14px] text-foreground" />
                              ) : null
                            }
                          >
                            <AssigneeOption
                              name={user.name}
                              avatarImageUrl={user.avatarImageUrl}
                              avatarUrl={user.avatarUrl}
                            />
                          </PropertyPopoverItem>
                        ))}
                      </>
                    ) : (
                      <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
                        No members match
                      </div>
                    )}
                    <PropertyPopoverItem
                      muted
                      selected={assigneeId === "none"}
                      onClick={() => {
                        setAssigneeId("none")
                        setAssigneePickerOpen(false)
                      }}
                      trailing={
                        assigneeId === "none" ? (
                          <Check className="size-[14px] text-foreground" />
                        ) : null
                      }
                    >
                      <X className="size-[14px] shrink-0" />
                      <span>Unassign</span>
                    </PropertyPopoverItem>
                  </>
                )
              })()}
            </PropertyPopoverList>
          </PopoverContent>
        </Popover>

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

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canCreate} onClick={handleCreate}>
            Create {selectedTypeLabel.toLowerCase()}
          </Button>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useMemo, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { format } from "date-fns"
import { Circle, Smiley } from "@phosphor-icons/react"

import { getCommentsForTarget, getTeam, getUser } from "@/lib/domain/selectors"
import {
  getAllowedChildWorkItemTypesForItem,
  getAllowedWorkItemTypesForTemplate,
  getChildWorkItemCopy,
  getDefaultWorkItemTypesForTeamExperience,
  getDisplayLabelForWorkItemType,
  getPreferredWorkItemTypeForTeamExperience,
  priorityMeta,
  type AppData,
  type Priority,
  type WorkItem,
  type WorkItemType,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import {
  EmojiPickerPopover,
  insertEmojiIntoTextarea,
} from "@/components/app/emoji-picker-popover"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { formatInlineDescriptionContent } from "./helpers"
import { cn } from "@/lib/utils"

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

function CommentThreadItem({
  comment,
  repliesByParentId,
  editable,
  targetType,
  targetId,
}: {
  comment: AppData["comments"][number]
  repliesByParentId: Record<string, AppData["comments"]>
  editable: boolean
  targetType: "workItem" | "document"
  targetId: string
}) {
  const { author, currentUserId } = useAppStore(
    useShallow((state) => ({
      author: getUser(state, comment.createdBy),
      currentUserId: state.currentUserId,
    }))
  )
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyContent, setReplyContent] = useState("")
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const replies = repliesByParentId[comment.id] ?? []

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{author?.name}</span>
        <span className="text-xs text-muted-foreground">
          {format(new Date(comment.createdAt), "MMM d, h:mm a")}
        </span>
      </div>

      <p className="text-sm leading-7 text-muted-foreground">
        {comment.content}
      </p>

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
          <Textarea
            ref={replyTextareaRef}
            autoFocus
            className="min-h-[4rem] resize-none"
            placeholder="Reply to this thread..."
            value={replyContent}
            onChange={(event) => setReplyContent(event.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            <EmojiPickerPopover
              align="start"
              side="top"
              onEmojiSelect={(emoji) =>
                insertEmojiIntoTextarea({
                  emoji,
                  textarea: replyTextareaRef.current,
                  value: replyContent,
                  onChange: setReplyContent,
                })
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
              <Button
                size="sm"
                disabled={!replyContent.trim()}
                onClick={() => {
                  useAppStore.getState().addComment({
                    targetType,
                    targetId,
                    parentCommentId: comment.id,
                    content: replyContent,
                  })
                  setReplyContent("")
                  setReplyOpen(false)
                }}
              >
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
  const comments = useAppStore(
    useShallow((state) => getCommentsForTarget(state, targetType, targetId))
  )
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
  const [content, setContent] = useState("")
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null)

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
        />
      ))}
      <div className="flex flex-col gap-2">
        <Textarea
          ref={commentTextareaRef}
          disabled={!editable}
          placeholder="Leave a comment or mention a teammate with @handle..."
          className="min-h-[4rem] resize-none"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <div className="flex items-center justify-between gap-2">
          <EmojiPickerPopover
            align="start"
            side="top"
            onEmojiSelect={(emoji) =>
              insertEmojiIntoTextarea({
                emoji,
                textarea: commentTextareaRef.current,
                value: content,
                onChange: setContent,
              })
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
          <Button
            size="sm"
            disabled={!editable || !content.trim()}
            onClick={() => {
              useAppStore
                .getState()
                .addComment({ targetType, targetId, content })
              setContent("")
            }}
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
  const [type, setType] = useState<WorkItemType>(
    getPreferredWorkItemTypeForTeamExperience(team?.settings.experience, {
      parent: true,
    })
  )
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
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
  const normalizedTitle = title.trim()
  const canCreate =
    !disabled && normalizedTitle.length >= 2 && availableItemTypes.length > 0

  function handleCreate() {
    const createdItemId = useAppStore.getState().createWorkItem({
      teamId,
      type: selectedType,
      title: normalizedTitle,
      priority,
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
    <div className="bg-background">
      <div className="flex gap-3 px-3 py-3">
        <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={childCopy.titlePlaceholder}
            className="h-auto border-none px-0 py-0 text-sm shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
            autoFocus
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add description..."
            rows={1}
            className="mt-1 min-h-0 resize-none border-none px-0 py-0 text-xs text-muted-foreground shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2">
        <Select
          value={selectedType}
          onValueChange={(value) => setType(value as WorkItemType)}
        >
          <SelectTrigger className="h-7 rounded-full border-border/50 bg-muted/30 px-2.5 text-[11px] shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {availableItemTypes.map((value) => (
                <SelectItem key={value} value={value}>
                  {getDisplayLabelForWorkItemType(
                    value,
                    team?.settings.experience
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={priority}
          onValueChange={(value) => setPriority(value as Priority)}
        >
          <SelectTrigger className="h-7 rounded-full border-border/50 bg-muted/30 px-2.5 text-[11px] shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.entries(priorityMeta).map(([value, meta]) => (
                <SelectItem key={value} value={value}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger className="h-7 rounded-full border-border/50 bg-muted/30 px-2.5 text-[11px] shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="none">Unassigned</SelectItem>
              {teamMembers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={projectId} disabled>
          <SelectTrigger className="h-7 rounded-full border-border/50 bg-muted/30 px-2.5 text-[11px] shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="none">No project</SelectItem>
              {teamProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canCreate} onClick={handleCreate}>
            Create{" "}
            {getDisplayLabelForWorkItemType(
              selectedType,
              team?.settings.experience
            ).toLowerCase()}
          </Button>
        </div>
      </div>
    </div>
  )
}

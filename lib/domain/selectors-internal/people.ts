import type {
  AppData,
  ChannelPost,
  Comment,
  Conversation,
  Document,
  Project,
  Team,
  WorkItem,
  WorkItemActivity,
} from "../types"
import { getWorkItemAssigneeIds } from "../work-item-assignees"
import { getWorkspaceUsers, hasWorkspaceAccess } from "./core"
import { getPlainTextContent } from "@/lib/utils"

export type PersonActivity =
  | {
      type: "workItemCreated"
      itemId: string
      title: string
      createdAt: string
    }
  | {
      type: "workItemCommented"
      itemId: string
      commentId: string
      title: string
      createdAt: string
    }
  | {
      type: "workItemStatusChanged"
      activityId: string
      itemId: string
      title: string
      createdAt: string
    }
  | {
      type: "workItemLabelsChanged"
      activityId: string
      itemId: string
      title: string
      createdAt: string
    }
  | {
      type: "workItemAssigneesChanged"
      activityId: string
      itemId: string
      title: string
      createdAt: string
    }
  | {
      type: "documentCommented"
      documentId: string
      commentId: string
      title: string
      createdAt: string
    }
  | {
      type: "channelPostCreated"
      postId: string
      channelId: string
      title: string
      createdAt: string
    }
  | {
      type: "channelPostCommented"
      postId: string
      commentId: string
      title: string
      createdAt: string
    }
  | {
      type: "projectUpdatePosted"
      projectId: string
      updateId: string
      title: string
      createdAt: string
    }

type WorkspaceScoped = {
  workspaceId?: string | null
  teamId?: string | null
}

function getDisplayName(name: string | null | undefined, fallback: string) {
  const trimmedName = name?.trim()
  return trimmedName && trimmedName.length > 0 ? trimmedName : fallback
}

function getTeamWorkspaceId(teams: Team[], teamId: string | null | undefined) {
  if (!teamId) {
    return null
  }
  return teams.find((team) => team.id === teamId)?.workspaceId ?? null
}

function projectBelongsToWorkspace(
  data: AppData,
  project: Project,
  workspaceId: string
) {
  if (project.scopeType === "workspace") {
    return (
      project.scopeId === workspaceId &&
      hasWorkspaceAccess(data, workspaceId, data.currentUserId)
    )
  }
  return (
    getTeamWorkspaceId(data.teams, project.scopeId) === workspaceId &&
    data.teamMemberships.some(
      (membership) =>
        membership.teamId === project.scopeId &&
        membership.userId === data.currentUserId
    )
  )
}

function getWorkItemWorkspaceId(data: AppData, item: WorkItem) {
  const scopedItem = item as WorkItem & WorkspaceScoped
  if ((scopedItem.visibility ?? "team") === "private") {
    return scopedItem.workspaceId ?? null
  }

  return (
    scopedItem.workspaceId ?? getTeamWorkspaceId(data.teams, scopedItem.teamId)
  )
}

function isWorkItemVisibleInPersonActivity(data: AppData, item: WorkItem) {
  return (
    (item.visibility ?? "team") !== "private" ||
    item.creatorId === data.currentUserId
  )
}

function getWorkItemInWorkspace(
  data: AppData,
  itemId: string,
  workspaceId: string
) {
  return (
    data.workItems.find(
      (item) =>
        item.id === itemId &&
        getWorkItemWorkspaceId(data, item) === workspaceId &&
        isWorkItemVisibleInPersonActivity(data, item)
    ) ?? null
  )
}

function isDocumentVisibleInPersonActivity(data: AppData, document: Document) {
  return (
    document.kind !== "private-document" ||
    document.createdBy === data.currentUserId
  )
}

function getDocumentInWorkspace(
  data: AppData,
  documentId: string,
  workspaceId: string
) {
  return (
    data.documents.find(
      (document) =>
        document.id === documentId &&
        document.workspaceId === workspaceId &&
        isDocumentVisibleInPersonActivity(data, document)
    ) ?? null
  )
}

function canAccessChannelConversation(
  data: AppData,
  conversation: Conversation
) {
  if (conversation.kind !== "channel") {
    return false
  }

  if (conversation.scopeType === "workspace") {
    return hasWorkspaceAccess(data, conversation.scopeId, data.currentUserId)
  }

  return data.teamMemberships.some(
    (membership) =>
      membership.teamId === conversation.scopeId &&
      membership.userId === data.currentUserId
  )
}

function getChannelPostWorkspaceId(data: AppData, postId: string) {
  const post = data.channelPosts.find((candidate) => candidate.id === postId)
  if (!post) {
    return null
  }
  const conversation = data.conversations.find(
    (candidate) => candidate.id === post.conversationId
  )
  if (!conversation || !canAccessChannelConversation(data, conversation)) {
    return null
  }
  if (conversation.scopeType === "workspace") {
    return conversation.scopeId
  }
  return getTeamWorkspaceId(data.teams, conversation.scopeId)
}

function getChannelPostInWorkspace(
  data: AppData,
  postId: string,
  workspaceId: string
) {
  const post = data.channelPosts.find((candidate) => candidate.id === postId)
  if (!post || getChannelPostWorkspaceId(data, post.id) !== workspaceId) {
    return null
  }
  return post
}

function getChannelPostTitle(post: ChannelPost) {
  const compactContent = getPlainTextContent(post.title || post.content || "")
    .replace(/\s+/g, " ")
    .trim()
  if (!compactContent) {
    return "Channel post"
  }
  return compactContent.length > 72
    ? `${compactContent.slice(0, 69)}...`
    : compactContent
}

function getCommentCreatedAt(comment: Comment) {
  return comment.createdAt
}

function getDocumentTitle(document: Document) {
  return getDisplayName(document.title, "Untitled document")
}

export function getWorkspacePeople(data: AppData, workspaceId: string) {
  return [...getWorkspaceUsers(data, workspaceId)]
    .filter((user) => !user.accountDeletedAt)
    .sort((left, right) => {
      const leftName = getDisplayName(left.name, left.email ?? left.id)
      const rightName = getDisplayName(right.name, right.email ?? right.id)
      return leftName.localeCompare(rightName, undefined, {
        sensitivity: "base",
      })
    })
}

export function getWorkspacePerson(
  data: AppData,
  workspaceId: string,
  userId: string
) {
  return (
    getWorkspacePeople(data, workspaceId).find((user) => user.id === userId) ??
    null
  )
}

function getSharedWorkspaceTeamIds(
  data: AppData,
  workspaceId: string,
  userId: string
) {
  const workspaceTeamIds = new Set(
    data.teams
      .filter((team) => team.workspaceId === workspaceId)
      .map((team) => team.id)
  )
  const currentUserTeamIds = new Set(
    data.teamMemberships
      .filter(
        (membership) =>
          membership.userId === data.currentUserId &&
          workspaceTeamIds.has(membership.teamId)
      )
      .map((membership) => membership.teamId)
  )

  return new Set(
    data.teamMemberships
      .filter(
        (membership) =>
          membership.userId === userId &&
          currentUserTeamIds.has(membership.teamId)
      )
      .map((membership) => membership.teamId)
  )
}

export function getWorkspacePersonAssignedWork(
  data: AppData,
  workspaceId: string,
  userId: string
) {
  const sharedTeamIds = getSharedWorkspaceTeamIds(data, workspaceId, userId)

  return data.workItems
    .filter(
      (item) =>
        (item.visibility ?? "team") === "team" &&
        Boolean(item.teamId) &&
        sharedTeamIds.has(item.teamId ?? "") &&
        getWorkItemAssigneeIds(item).includes(userId)
    )
    .sort((left, right) => {
      const updatedCompare = right.updatedAt.localeCompare(left.updatedAt)

      if (updatedCompare !== 0) {
        return updatedCompare
      }

      const createdCompare = right.createdAt.localeCompare(left.createdAt)

      if (createdCompare !== 0) {
        return createdCompare
      }

      return left.title.localeCompare(right.title, undefined, {
        sensitivity: "base",
      })
    })
}

function getWorkItemCreatedActivities(
  data: AppData,
  workspaceId: string,
  userId: string
): PersonActivity[] {
  return data.workItems
    .filter(
      (item) =>
        item.creatorId === userId &&
        getWorkItemWorkspaceId(data, item) === workspaceId &&
        isWorkItemVisibleInPersonActivity(data, item)
    )
    .map((item) => ({
      type: "workItemCreated" as const,
      itemId: item.id,
      title: getDisplayName(item.title, "Untitled work item"),
      createdAt: item.createdAt,
    }))
}

function getCommentActivity(
  data: AppData,
  workspaceId: string,
  comment: Comment
): PersonActivity | null {
  if (comment.targetType === "workItem") {
    const item = getWorkItemInWorkspace(data, comment.targetId, workspaceId)

    return item
      ? {
          type: "workItemCommented",
          itemId: item.id,
          commentId: comment.id,
          title: getDisplayName(item.title, "Untitled work item"),
          createdAt: getCommentCreatedAt(comment),
        }
      : null
  }

  if (comment.targetType === "document") {
    const document = getDocumentInWorkspace(data, comment.targetId, workspaceId)

    return document
      ? {
          type: "documentCommented",
          documentId: document.id,
          commentId: comment.id,
          title: getDocumentTitle(document),
          createdAt: getCommentCreatedAt(comment),
        }
      : null
  }

  return null
}

function getCommentActivities(
  data: AppData,
  workspaceId: string,
  userId: string
) {
  return data.comments
    .filter((comment) => comment.createdBy === userId)
    .map((comment) => getCommentActivity(data, workspaceId, comment))
    .filter((activity): activity is PersonActivity => Boolean(activity))
}

function getWorkItemChangeActivityType(activity: WorkItemActivity) {
  switch (activity.type) {
    case "status-change":
      return "workItemStatusChanged" as const
    case "label-change":
      return "workItemLabelsChanged" as const
    case "assignee-change":
      return "workItemAssigneesChanged" as const
  }
}

function getWorkItemChangeActivities(
  data: AppData,
  workspaceId: string,
  userId: string
): PersonActivity[] {
  return data.workItemActivities
    .filter((activity) => activity.actorId === userId)
    .map((activity): PersonActivity | null => {
      const item = getWorkItemInWorkspace(data, activity.itemId, workspaceId)

      return item
        ? {
            type: getWorkItemChangeActivityType(activity),
            activityId: activity.id,
            itemId: item.id,
            title: getDisplayName(item.title, "Untitled work item"),
            createdAt: activity.createdAt,
          }
        : null
    })
    .filter((activity): activity is PersonActivity => Boolean(activity))
}

function getChannelPostCreatedActivities(
  data: AppData,
  workspaceId: string,
  userId: string
): PersonActivity[] {
  return data.channelPosts
    .filter(
      (post) =>
        post.createdBy === userId &&
        getChannelPostWorkspaceId(data, post.id) === workspaceId
    )
    .map((post) => ({
      type: "channelPostCreated" as const,
      postId: post.id,
      channelId: post.conversationId,
      title: getChannelPostTitle(post),
      createdAt: post.createdAt,
    }))
}

function getChannelPostCommentActivities(
  data: AppData,
  workspaceId: string,
  userId: string
): PersonActivity[] {
  return data.channelPostComments
    .filter((comment) => comment.createdBy === userId)
    .map((comment): PersonActivity | null => {
      const post = getChannelPostInWorkspace(data, comment.postId, workspaceId)

      return post
        ? {
            type: "channelPostCommented" as const,
            postId: post.id,
            commentId: comment.id,
            title: getChannelPostTitle(post),
            createdAt: comment.createdAt,
          }
        : null
    })
    .filter((activity): activity is PersonActivity => Boolean(activity))
}

function getProjectUpdatePostedActivities(
  data: AppData,
  workspaceId: string,
  userId: string
): PersonActivity[] {
  return data.projectUpdates
    .filter((update) => update.createdBy === userId)
    .map((update): PersonActivity | null => {
      const project = data.projects.find(
        (candidate) =>
          candidate.id === update.projectId &&
          projectBelongsToWorkspace(data, candidate, workspaceId)
      )

      return project
        ? {
            type: "projectUpdatePosted" as const,
            projectId: project.id,
            updateId: update.id,
            title: getDisplayName(project.name, "Untitled project"),
            createdAt: update.createdAt,
          }
        : null
    })
    .filter((activity): activity is PersonActivity => Boolean(activity))
}

export function getWorkspacePersonActivity(
  data: AppData,
  workspaceId: string,
  userId: string
): PersonActivity[] {
  return [
    ...getWorkItemCreatedActivities(data, workspaceId, userId),
    ...getCommentActivities(data, workspaceId, userId),
    ...getWorkItemChangeActivities(data, workspaceId, userId),
    ...getChannelPostCreatedActivities(data, workspaceId, userId),
    ...getChannelPostCommentActivities(data, workspaceId, userId),
    ...getProjectUpdatePostedActivities(data, workspaceId, userId),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export type TeamActivityEntry = {
  /** The team member who performed the activity. */
  userId: string
  activity: PersonActivity
}

function getPersonActivityTeamId(
  data: AppData,
  activity: PersonActivity
): string | null {
  switch (activity.type) {
    case "workItemCreated":
    case "workItemCommented":
    case "workItemStatusChanged":
    case "workItemLabelsChanged":
    case "workItemAssigneesChanged":
      return (
        data.workItems.find((item) => item.id === activity.itemId)?.teamId ??
        null
      )
    case "documentCommented":
      return (
        data.documents.find(
          (document) => document.id === activity.documentId
        )?.teamId ?? null
      )
    case "channelPostCreated": {
      const conversation = data.conversations.find(
        (candidate) => candidate.id === activity.channelId
      )
      return conversation?.scopeType === "team" ? conversation.scopeId : null
    }
    case "channelPostCommented": {
      const post = data.channelPosts.find(
        (candidate) => candidate.id === activity.postId
      )
      const conversation = post
        ? data.conversations.find(
            (candidate) => candidate.id === post.conversationId
          )
        : null
      return conversation?.scopeType === "team" ? conversation.scopeId : null
    }
    case "projectUpdatePosted": {
      const project = data.projects.find(
        (candidate) => candidate.id === activity.projectId
      )
      return project?.scopeType === "team" ? project.scopeId : null
    }
  }
}

function getPersonActivityKey(activity: PersonActivity): string {
  switch (activity.type) {
    case "workItemCreated":
      return `${activity.type}:${activity.itemId}`
    case "workItemCommented":
    case "documentCommented":
    case "channelPostCommented":
      return `${activity.type}:${activity.commentId}`
    case "workItemStatusChanged":
    case "workItemLabelsChanged":
    case "workItemAssigneesChanged":
      return `${activity.type}:${activity.activityId}`
    case "channelPostCreated":
      return `${activity.type}:${activity.postId}`
    case "projectUpdatePosted":
      return `${activity.type}:${activity.updateId}`
  }
}

/**
 * Recent activity for an entire team space, mirroring the profile activity model
 * but scoped to every member of the team. Reuses the per-person workspace
 * activity selector and keeps only events that belong to this team, enriched
 * with the acting member so the feed can attribute each event.
 */
export function getTeamSpaceActivity(
  data: AppData,
  teamId: string,
  limit = 30
): TeamActivityEntry[] {
  const team = data.teams.find((candidate) => candidate.id === teamId)

  if (!team) {
    return []
  }

  const memberIds = data.teamMemberships
    .filter((membership) => membership.teamId === teamId)
    .map((membership) => membership.userId)

  const seen = new Set<string>()
  const entries: TeamActivityEntry[] = []

  for (const userId of memberIds) {
    for (const activity of getWorkspacePersonActivity(
      data,
      team.workspaceId,
      userId
    )) {
      if (getPersonActivityTeamId(data, activity) !== teamId) {
        continue
      }

      const key = getPersonActivityKey(activity)

      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      entries.push({ userId, activity })
    }
  }

  return entries
    .sort((left, right) =>
      right.activity.createdAt.localeCompare(left.activity.createdAt)
    )
    .slice(0, limit)
}

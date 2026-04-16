import type { MutationCtx } from "../_generated/server"

import { getNow } from "./core"
import {
  findPrimaryWorkspaceChannelConversation,
  getWorkspaceUserIds,
  syncConversationParticipants,
} from "./conversations"
import {
  getTeamDoc,
  getUserDoc,
  resolvePreferredWorkspaceId,
} from "./data"

function filterRemovedIds(ids: string[], removedIds: Set<string>) {
  return ids.filter((id) => !removedIds.has(id))
}

export async function deleteDocs(
  ctx: MutationCtx,
  docs: Array<{ _id: Parameters<MutationCtx["db"]["delete"]>[0] }>
) {
  for (const doc of docs) {
    await ctx.db.delete(doc._id)
  }
}

export async function deleteStorageObjects(
  ctx: MutationCtx,
  storageIds: Iterable<string>
) {
  for (const storageId of new Set(storageIds)) {
    await ctx.storage.delete(storageId as never)
  }
}

export async function cleanupViewFiltersForDeletedEntities(
  ctx: MutationCtx,
  input: {
    deletedTeamIds?: Set<string>
    deletedProjectIds?: Set<string>
    deletedMilestoneIds?: Set<string>
  }
) {
  const deletedTeamIds = input.deletedTeamIds ?? new Set<string>()
  const deletedProjectIds = input.deletedProjectIds ?? new Set<string>()
  const deletedMilestoneIds = input.deletedMilestoneIds ?? new Set<string>()
  const views = await ctx.db.query("views").collect()

  for (const view of views) {
    const nextFilters = {
      ...view.filters,
      teamIds: filterRemovedIds(view.filters.teamIds, deletedTeamIds),
      projectIds: filterRemovedIds(view.filters.projectIds, deletedProjectIds),
      milestoneIds: filterRemovedIds(
        view.filters.milestoneIds,
        deletedMilestoneIds
      ),
    }

    if (
      nextFilters.teamIds.length === view.filters.teamIds.length &&
      nextFilters.projectIds.length === view.filters.projectIds.length &&
      nextFilters.milestoneIds.length === view.filters.milestoneIds.length
    ) {
      continue
    }

    await ctx.db.patch(view._id, {
      filters: nextFilters,
      updatedAt: getNow(),
    })
  }
}

export async function cleanupRemainingLinksAfterDelete(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    deletedDocumentIds?: Set<string>
    deletedWorkItemIds?: Set<string>
    deletedProjectIds?: Set<string>
    deletedMilestoneIds?: Set<string>
  }
) {
  const deletedDocumentIds = input.deletedDocumentIds ?? new Set<string>()
  const deletedWorkItemIds = input.deletedWorkItemIds ?? new Set<string>()
  const deletedProjectIds = input.deletedProjectIds ?? new Set<string>()
  const deletedMilestoneIds = input.deletedMilestoneIds ?? new Set<string>()
  const documents = await ctx.db.query("documents").collect()
  const workItems = await ctx.db.query("workItems").collect()

  for (const document of documents) {
    if (deletedDocumentIds.has(document.id)) {
      continue
    }

    const nextLinkedProjectIds = filterRemovedIds(
      document.linkedProjectIds,
      deletedProjectIds
    )
    const nextLinkedWorkItemIds = filterRemovedIds(
      document.linkedWorkItemIds,
      deletedWorkItemIds
    )

    if (
      nextLinkedProjectIds.length === document.linkedProjectIds.length &&
      nextLinkedWorkItemIds.length === document.linkedWorkItemIds.length
    ) {
      continue
    }

    await ctx.db.patch(document._id, {
      linkedProjectIds: nextLinkedProjectIds,
      linkedWorkItemIds: nextLinkedWorkItemIds,
      updatedAt: getNow(),
      updatedBy: input.currentUserId,
    })
  }

  for (const workItem of workItems) {
    if (deletedWorkItemIds.has(workItem.id)) {
      continue
    }

    const nextLinkedDocumentIds = filterRemovedIds(
      workItem.linkedDocumentIds,
      deletedDocumentIds
    )
    const nextLinkedProjectIds = filterRemovedIds(
      workItem.linkedProjectIds,
      deletedProjectIds
    )
    const nextPrimaryProjectId =
      workItem.primaryProjectId &&
      deletedProjectIds.has(workItem.primaryProjectId)
        ? null
        : workItem.primaryProjectId
    const nextMilestoneId =
      workItem.milestoneId && deletedMilestoneIds.has(workItem.milestoneId)
        ? null
        : workItem.milestoneId

    if (
      nextLinkedDocumentIds.length === workItem.linkedDocumentIds.length &&
      nextLinkedProjectIds.length === workItem.linkedProjectIds.length &&
      nextPrimaryProjectId === workItem.primaryProjectId &&
      nextMilestoneId === workItem.milestoneId
    ) {
      continue
    }

    await ctx.db.patch(workItem._id, {
      linkedDocumentIds: nextLinkedDocumentIds,
      linkedProjectIds: nextLinkedProjectIds,
      primaryProjectId: nextPrimaryProjectId,
      milestoneId: nextMilestoneId,
      updatedAt: getNow(),
    })
  }
}

export async function cleanupUnusedLabels(ctx: MutationCtx) {
  const labels = await ctx.db.query("labels").collect()
  const workItems = await ctx.db.query("workItems").collect()
  const usedLabelIds = new Set(
    workItems.flatMap((workItem) => workItem.labelIds)
  )
  const views = await ctx.db.query("views").collect()
  const deletedLabelIds: string[] = []

  for (const label of labels) {
    if (usedLabelIds.has(label.id)) {
      continue
    }

    deletedLabelIds.push(label.id)
  }

  if (deletedLabelIds.length === 0) {
    return deletedLabelIds
  }

  const deletedLabelIdSet = new Set(deletedLabelIds)

  for (const view of views) {
    const nextLabelIds = filterRemovedIds(
      view.filters.labelIds,
      deletedLabelIdSet
    )

    if (nextLabelIds.length === view.filters.labelIds.length) {
      continue
    }

    await ctx.db.patch(view._id, {
      filters: {
        ...view.filters,
        labelIds: nextLabelIds,
      },
      updatedAt: getNow(),
    })
  }

  for (const label of labels) {
    if (!deletedLabelIdSet.has(label.id)) {
      continue
    }

    await ctx.db.delete(label._id)
  }

  return deletedLabelIds
}

export async function cleanupUserAppStatesForDeletedWorkspace(
  ctx: MutationCtx,
  deletedWorkspaceId: string
) {
  const userAppStates = await ctx.db.query("userAppStates").collect()
  const teams = await ctx.db.query("teams").collect()
  const workspaces = await ctx.db.query("workspaces").collect()

  for (const userAppState of userAppStates) {
    if (userAppState.currentWorkspaceId !== deletedWorkspaceId) {
      continue
    }

    const memberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", userAppState.userId))
      .collect()
    const accessibleWorkspaceIds = new Set<string>([
      ...teams
        .filter((team) =>
          memberships.some((membership) => membership.teamId === team.id)
        )
        .map((team) => team.workspaceId),
      ...workspaces
        .filter((workspace) => workspace.createdBy === userAppState.userId)
        .map((workspace) => workspace.id),
    ])

    const nextWorkspaceId = resolvePreferredWorkspaceId({
      selectedWorkspaceId: null,
      accessibleWorkspaceIds,
      fallbackWorkspaceIds: [...accessibleWorkspaceIds],
    })

    if (nextWorkspaceId) {
      await ctx.db.patch(userAppState._id, {
        currentWorkspaceId: nextWorkspaceId,
      })
      continue
    }

    await ctx.db.delete(userAppState._id)
  }
}

export async function cleanupUnreferencedUsers(
  ctx: MutationCtx,
  candidateUserIds: Iterable<string>
) {
  const userIds = [...new Set(candidateUserIds)]

  if (userIds.length === 0) {
    return []
  }

  const workspaces = await ctx.db.query("workspaces").collect()
  const teamMemberships = await ctx.db.query("teamMemberships").collect()
  const userAppStates = await ctx.db.query("userAppStates").collect()
  const projects = await ctx.db.query("projects").collect()
  const workItems = await ctx.db.query("workItems").collect()
  const documents = await ctx.db.query("documents").collect()
  const views = await ctx.db.query("views").collect()
  const comments = await ctx.db.query("comments").collect()
  const attachments = await ctx.db.query("attachments").collect()
  const notifications = await ctx.db.query("notifications").collect()
  const invites = await ctx.db.query("invites").collect()
  const projectUpdates = await ctx.db.query("projectUpdates").collect()
  const conversations = await ctx.db.query("conversations").collect()
  const calls = await ctx.db.query("calls").collect()
  const chatMessages = await ctx.db.query("chatMessages").collect()
  const channelPosts = await ctx.db.query("channelPosts").collect()
  const channelPostComments = await ctx.db
    .query("channelPostComments")
    .collect()
  const deletedUserIds: string[] = []

  for (const userId of userIds) {
    const user = await getUserDoc(ctx, userId)

    if (!user) {
      continue
    }

    const hasReference =
      workspaces.some((workspace) => workspace.createdBy === userId) ||
      teamMemberships.some((membership) => membership.userId === userId) ||
      projects.some(
        (project) =>
          project.leadId === userId || project.memberIds.includes(userId)
      ) ||
      workItems.some(
        (workItem) =>
          workItem.assigneeId === userId ||
          workItem.creatorId === userId ||
          workItem.subscriberIds.includes(userId)
      ) ||
      documents.some(
        (document) =>
          document.createdBy === userId || document.updatedBy === userId
      ) ||
      views.some(
        (view) =>
          (view.scopeType === "personal" && view.scopeId === userId) ||
          view.filters.assigneeIds.includes(userId) ||
          view.filters.creatorIds.includes(userId) ||
          view.filters.leadIds.includes(userId)
      ) ||
      comments.some(
        (comment) =>
          comment.createdBy === userId ||
          (comment.mentionUserIds ?? []).includes(userId)
      ) ||
      attachments.some((attachment) => attachment.uploadedBy === userId) ||
      notifications.some(
        (notification) =>
          notification.userId === userId || notification.actorId === userId
      ) ||
      invites.some((invite) => invite.invitedBy === userId) ||
      projectUpdates.some((update) => update.createdBy === userId) ||
      conversations.some(
        (conversation) =>
          conversation.createdBy === userId ||
          conversation.participantIds.includes(userId)
      ) ||
      calls.some(
        (call) =>
          call.startedBy === userId ||
          (call.participantUserIds ?? []).includes(userId) ||
          call.lastJoinedBy === userId
      ) ||
      chatMessages.some(
        (message) =>
          message.createdBy === userId ||
          (message.mentionUserIds ?? []).includes(userId)
      ) ||
      channelPosts.some(
        (post) =>
          post.createdBy === userId ||
          (post.reactions ?? []).some((reaction) =>
            reaction.userIds.includes(userId)
          )
      ) ||
      channelPostComments.some(
        (comment) =>
          comment.createdBy === userId ||
          (comment.mentionUserIds ?? []).includes(userId)
      )

    if (hasReference) {
      continue
    }

    const userAppState =
      userAppStates.find((entry) => entry.userId === userId) ?? null

    if (userAppState) {
      await ctx.db.delete(userAppState._id)
    }

    if (user.avatarImageStorageId) {
      await ctx.storage.delete(user.avatarImageStorageId as never)
    }

    await ctx.db.delete(user._id)
    deletedUserIds.push(userId)
  }

  return deletedUserIds
}

export async function cascadeDeleteTeamData(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    teamId: string
    syncWorkspaceChannel?: boolean
    cleanupGlobalState?: boolean
  }
) {
  const team = await getTeamDoc(ctx, input.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  const teamMemberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team", (q) => q.eq("teamId", team.id))
    .collect()
  const membershipUserIds = teamMemberships.map(
    (membership) => membership.userId
  )
  const projects = (await ctx.db.query("projects").collect()).filter(
    (project) => project.scopeType === "team" && project.scopeId === team.id
  )
  const deletedProjectIds = new Set(projects.map((project) => project.id))
  const milestones = (await ctx.db.query("milestones").collect()).filter(
    (milestone) => deletedProjectIds.has(milestone.projectId)
  )
  const deletedMilestoneIds = new Set(
    milestones.map((milestone) => milestone.id)
  )
  const projectUpdates = (
    await ctx.db.query("projectUpdates").collect()
  ).filter((update) => deletedProjectIds.has(update.projectId))
  const workItems = await ctx.db
    .query("workItems")
    .withIndex("by_team_id", (q) => q.eq("teamId", team.id))
    .collect()
  const deletedWorkItemIds = new Set(workItems.map((workItem) => workItem.id))
  const deletedDescriptionDocIds = new Set(
    workItems.map((workItem) => workItem.descriptionDocId)
  )
  const documents = (await ctx.db.query("documents").collect()).filter(
    (document) =>
      document.teamId === team.id || deletedDescriptionDocIds.has(document.id)
  )
  const deletedDocumentIds = new Set(documents.map((document) => document.id))
  const views = (await ctx.db.query("views").collect()).filter(
    (view) => view.scopeType === "team" && view.scopeId === team.id
  )
  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_scope", (q) =>
      q.eq("scopeType", "team").eq("scopeId", team.id)
    )
    .collect()
  const deletedConversationIds = new Set(
    conversations.map((conversation) => conversation.id)
  )
  const calls = (await ctx.db.query("calls").collect()).filter((call) =>
    deletedConversationIds.has(call.conversationId)
  )
  const chatMessages = (await ctx.db.query("chatMessages").collect()).filter(
    (message) => deletedConversationIds.has(message.conversationId)
  )
  const deletedChatMessageIds = new Set(
    chatMessages.map((message) => message.id)
  )
  const channelPosts = (await ctx.db.query("channelPosts").collect()).filter(
    (post) => deletedConversationIds.has(post.conversationId)
  )
  const deletedChannelPostIds = new Set(channelPosts.map((post) => post.id))
  const channelPostComments = (
    await ctx.db.query("channelPostComments").collect()
  ).filter((comment) => deletedChannelPostIds.has(comment.postId))
  const attachments = (await ctx.db.query("attachments").collect()).filter(
    (attachment) =>
      (attachment.targetType === "workItem" &&
        deletedWorkItemIds.has(attachment.targetId)) ||
      (attachment.targetType === "document" &&
        deletedDocumentIds.has(attachment.targetId))
  )
  const comments = (await ctx.db.query("comments").collect()).filter(
    (comment) =>
      (comment.targetType === "workItem" &&
        deletedWorkItemIds.has(comment.targetId)) ||
      (comment.targetType === "document" &&
        deletedDocumentIds.has(comment.targetId))
  )
  const invites = (await ctx.db.query("invites").collect()).filter(
    (invite) => invite.teamId === team.id
  )
  const deletedInviteIds = new Set(invites.map((invite) => invite.id))
  const notifications = (await ctx.db.query("notifications").collect()).filter(
    (notification) => {
      switch (notification.entityType) {
        case "workItem":
          return deletedWorkItemIds.has(notification.entityId)
        case "document":
          return deletedDocumentIds.has(notification.entityId)
        case "project":
          return deletedProjectIds.has(notification.entityId)
        case "invite":
          return deletedInviteIds.has(notification.entityId)
        case "chat":
          return deletedChatMessageIds.has(notification.entityId)
        case "channelPost":
          return deletedChannelPostIds.has(notification.entityId)
        default:
          return false
      }
    }
  )

  await cleanupRemainingLinksAfterDelete(ctx, {
    currentUserId: input.currentUserId,
    deletedDocumentIds,
    deletedWorkItemIds,
    deletedProjectIds,
    deletedMilestoneIds,
  })
  await cleanupViewFiltersForDeletedEntities(ctx, {
    deletedTeamIds: new Set([team.id]),
    deletedProjectIds,
    deletedMilestoneIds,
  })
  await deleteStorageObjects(
    ctx,
    attachments.map((attachment) => attachment.storageId as string)
  )
  await deleteDocs(ctx, channelPostComments)
  await deleteDocs(ctx, channelPosts)
  await deleteDocs(ctx, chatMessages)
  await deleteDocs(ctx, calls)
  await deleteDocs(ctx, comments)
  await deleteDocs(ctx, attachments)
  await deleteDocs(ctx, notifications)
  await deleteDocs(ctx, projectUpdates)
  await deleteDocs(ctx, invites)
  await deleteDocs(ctx, views)
  await deleteDocs(ctx, documents)
  await deleteDocs(ctx, workItems)
  await deleteDocs(ctx, milestones)
  await deleteDocs(ctx, projects)
  await deleteDocs(ctx, conversations)
  await deleteDocs(ctx, teamMemberships)
  await ctx.db.delete(team._id)

  if (input.syncWorkspaceChannel !== false) {
    const workspaceChannel = await findPrimaryWorkspaceChannelConversation(
      ctx,
      team.workspaceId
    )
    const workspaceParticipantIds = await getWorkspaceUserIds(
      ctx,
      team.workspaceId
    )

    await syncConversationParticipants(
      ctx,
      workspaceChannel,
      workspaceParticipantIds
    )
  }

  const deletedLabelIds =
    input.cleanupGlobalState === false ? [] : await cleanupUnusedLabels(ctx)
  const deletedUserIds =
    input.cleanupGlobalState === false
      ? []
      : await cleanupUnreferencedUsers(ctx, membershipUserIds)

  return {
    teamId: team.id,
    workspaceId: team.workspaceId,
    membershipUserIds,
    deletedLabelIds,
    deletedUserIds,
  }
}

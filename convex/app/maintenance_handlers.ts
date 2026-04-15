import type { MutationCtx } from "../_generated/server"

import { assertServerToken } from "./core"
import {
  deleteDocs,
  deleteStorageObjects,
} from "./cleanup"

type ServerAccessArgs = {
  serverToken: string
}

export async function wipeAllAppDataHandler(
  ctx: MutationCtx,
  args: ServerAccessArgs
) {
  assertServerToken(args.serverToken)

  const appConfigs = await ctx.db.query("appConfig").collect()
  const userAppStates = await ctx.db.query("userAppStates").collect()
  const workspaces = await ctx.db.query("workspaces").collect()
  const teams = await ctx.db.query("teams").collect()
  const teamMemberships = await ctx.db.query("teamMemberships").collect()
  const users = await ctx.db.query("users").collect()
  const labels = await ctx.db.query("labels").collect()
  const projects = await ctx.db.query("projects").collect()
  const milestones = await ctx.db.query("milestones").collect()
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

  const deleted = {
    appConfig: appConfigs.length,
    userAppStates: userAppStates.length,
    workspaces: workspaces.length,
    teams: teams.length,
    teamMemberships: teamMemberships.length,
    users: users.length,
    labels: labels.length,
    projects: projects.length,
    milestones: milestones.length,
    workItems: workItems.length,
    documents: documents.length,
    views: views.length,
    comments: comments.length,
    attachments: attachments.length,
    notifications: notifications.length,
    invites: invites.length,
    projectUpdates: projectUpdates.length,
    conversations: conversations.length,
    calls: calls.length,
    chatMessages: chatMessages.length,
    channelPosts: channelPosts.length,
    channelPostComments: channelPostComments.length,
  }

  const storageIds = new Set<string>()

  for (const workspace of workspaces) {
    if (workspace.logoImageStorageId) {
      storageIds.add(workspace.logoImageStorageId as string)
    }
  }

  for (const user of users) {
    if (user.avatarImageStorageId) {
      storageIds.add(user.avatarImageStorageId as string)
    }
  }

  for (const attachment of attachments) {
    storageIds.add(attachment.storageId as string)
  }

  await deleteStorageObjects(ctx, storageIds)

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
  await deleteDocs(ctx, teams)
  await deleteDocs(ctx, workspaces)
  await deleteDocs(ctx, userAppStates)
  await deleteDocs(ctx, users)
  await deleteDocs(ctx, labels)
  await deleteDocs(ctx, appConfigs)

  await ctx.db.insert("appConfig", {
    key: "singleton",
    snapshotVersion: 0,
  })

  return {
    deleted,
    storageObjectsDeleted: storageIds.size,
    resetAppConfig: true,
    totalRecordsDeleted: Object.values(deleted).reduce(
      (total, count) => total + count,
      0
    ),
  }
}

export async function normalizeAppConfigHandler(
  ctx: MutationCtx,
  args: ServerAccessArgs
) {
  assertServerToken(args.serverToken)

  const appConfigs = await ctx.db.query("appConfig").collect()
  const nextSnapshotVersion = appConfigs.reduce(
    (maxVersion, config) => Math.max(maxVersion, config.snapshotVersion ?? 0),
    0
  )

  for (const config of appConfigs) {
    await ctx.db.delete(config._id)
  }

  await ctx.db.insert("appConfig", {
    key: "singleton",
    snapshotVersion: nextSnapshotVersion,
  })

  return {
    deletedRecords: appConfigs.length,
    snapshotVersion: nextSnapshotVersion,
  }
}

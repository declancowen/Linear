import type { MutationCtx } from "../_generated/server"

import { listTeamDocuments } from "./data"
import { normalizeTeamFeatures } from "./normalization"

type TeamFeatureSet = {
  issues: boolean
  projects: boolean
  views: boolean
  docs: boolean
  chat: boolean
  channels: boolean
}

async function getDocsDisableMessage(
  ctx: MutationCtx,
  team: {
    id: string
  }
) {
  const documents = await listTeamDocuments(ctx, team.id)
  const hasTeamDocuments = documents.some(
    (document) =>
      document.kind === "team-document" && document.teamId === team.id
  )

  return hasTeamDocuments
    ? "Docs cannot be turned off while this team still has documents."
    : null
}

async function getChatDisableMessage(
  ctx: MutationCtx,
  team: {
    id: string
  }
) {
  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_kind_scope", (q) =>
      q.eq("kind", "chat").eq("scopeType", "team").eq("scopeId", team.id)
    )
    .collect()
  const teamChat = conversations.find(
    (conversation) => conversation.variant === "team"
  )

  if (!teamChat) {
    return null
  }

  const messages = await ctx.db
    .query("chatMessages")
    .withIndex("by_conversation", (q) => q.eq("conversationId", teamChat.id))
    .take(1)

  return messages.length > 0
    ? "Chat cannot be turned off while the team chat has messages."
    : null
}

async function getChannelsDisableMessage(
  ctx: MutationCtx,
  team: {
    id: string
  }
) {
  const channels = await ctx.db
    .query("conversations")
    .withIndex("by_kind_scope", (q) =>
      q.eq("kind", "channel").eq("scopeType", "team").eq("scopeId", team.id)
    )
    .collect()

  for (const channel of channels) {
    const posts = await ctx.db
      .query("channelPosts")
      .withIndex("by_conversation", (q) => q.eq("conversationId", channel.id))
      .take(1)

    if (posts.length > 0) {
      return "Channel cannot be turned off while posts exist."
    }
  }

  return null
}

export async function getTeamSurfaceDisableMessage(
  ctx: MutationCtx,
  team: {
    id: string
    settings: {
      experience?:
        | "software-development"
        | "issue-analysis"
        | "community"
        | "project-management"
      features?: TeamFeatureSet
    }
  },
  nextFeatures: TeamFeatureSet
) {
  const currentFeatures = normalizeTeamFeatures(
    team.settings.experience,
    team.settings.features
  )

  if (currentFeatures.docs && !nextFeatures.docs) {
    const message = await getDocsDisableMessage(ctx, team)

    if (message) {
      return message
    }
  }

  if (currentFeatures.chat && !nextFeatures.chat) {
    const message = await getChatDisableMessage(ctx, team)

    if (message) {
      return message
    }
  }

  if (currentFeatures.channels && !nextFeatures.channels) {
    const message = await getChannelsDisableMessage(ctx, team)

    if (message) {
      return message
    }
  }

  return null
}

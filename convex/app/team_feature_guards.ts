import type { MutationCtx } from "../_generated/server"

import { normalizeTeamFeatures } from "./normalization"

type TeamFeatureSet = {
  issues: boolean
  projects: boolean
  views: boolean
  docs: boolean
  chat: boolean
  channels: boolean
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
    const documents = await ctx.db.query("documents").collect()
    const hasTeamDocuments = documents.some(
      (document) =>
        document.kind === "team-document" && document.teamId === team.id
    )

    if (hasTeamDocuments) {
      return "Docs cannot be turned off while this team still has documents."
    }
  }

  if (currentFeatures.chat && !nextFeatures.chat) {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_kind_scope", (q) =>
        q.eq("kind", "chat").eq("scopeType", "team").eq("scopeId", team.id)
      )
      .collect()
    const teamChat = conversations.find(
      (conversation) => conversation.variant === "team"
    )

    if (teamChat) {
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", teamChat.id)
        )
        .take(1)

      if (messages.length > 0) {
        return "Chat cannot be turned off while the team chat has messages."
      }
    }
  }

  if (currentFeatures.channels && !nextFeatures.channels) {
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
  }

  return null
}

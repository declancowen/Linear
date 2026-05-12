import type { UserStatus } from "@/lib/domain/types"

type ChatWelcomeParticipant = {
  name: string
}

type ChatWelcomePresenceView = {
  avatarImageUrl?: string | null
  avatarUrl?: string | null
  isFormerMember?: boolean
  name?: string | null
  status?: UserStatus | null
} | null

function getFallbackChatWelcomeIntroDisplay(
  title: string,
  welcomeParticipant: ChatWelcomeParticipant
) {
  return {
    avatarImageUrl: undefined,
    avatarName: welcomeParticipant.name,
    avatarUrl: undefined,
    name: welcomeParticipant.name ?? title,
    showStatus: true,
    status: undefined,
  }
}

export function getChatWelcomeIntroDisplay(input: {
  title: string
  welcomeParticipant: ChatWelcomeParticipant
  welcomeParticipantView: ChatWelcomePresenceView
}) {
  const { title, welcomeParticipant } = input
  const view = input.welcomeParticipantView

  if (!view) {
    return getFallbackChatWelcomeIntroDisplay(title, welcomeParticipant)
  }

  return {
    avatarImageUrl: view.avatarImageUrl,
    avatarName: view.name ?? welcomeParticipant.name,
    avatarUrl: view.avatarUrl,
    name: view.name ?? welcomeParticipant.name ?? title,
    showStatus: !view.isFormerMember,
    status: view.status ?? undefined,
  }
}

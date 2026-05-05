import type { UserProfile } from "@/lib/domain/types"
import { resolveImageAssetSource } from "@/lib/utils"

type UserProfileDraftSource = {
  id: string | null
  name: string
  title: string
  avatarUrl: string
  avatarImageSrc: string | null
  avatarPreviewUrl: string | null
  email: string
  emailMentions: boolean
  emailAssignments: boolean
  emailDigest: boolean
}

export function getUserProfileDraftSource(
  currentUser: UserProfile | null
): UserProfileDraftSource {
  if (!currentUser) {
    return {
      id: null,
      name: "",
      title: "",
      avatarUrl: "",
      avatarImageSrc: null,
      avatarPreviewUrl: null,
      email: "",
      emailMentions: false,
      emailAssignments: false,
      emailDigest: false,
    }
  }

  const avatarImageSrc =
    resolveImageAssetSource(
      currentUser.avatarImageUrl,
      currentUser.avatarUrl
    ) ?? null

  return {
    id: currentUser.id,
    name: currentUser.name,
    title: currentUser.title ?? "",
    avatarUrl: currentUser.avatarUrl ?? "",
    avatarImageSrc,
    avatarPreviewUrl: avatarImageSrc,
    email: currentUser.email,
    emailMentions: currentUser.preferences.emailMentions,
    emailAssignments: currentUser.preferences.emailAssignments,
    emailDigest: currentUser.preferences.emailDigest,
  }
}

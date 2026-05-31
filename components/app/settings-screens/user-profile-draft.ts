import type { UserProfile } from "@/lib/domain/types"
import { getBrowserTimeZone, normalizeTimeZone } from "@/lib/time-zone"
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
  emailComments: boolean
  emailDigest: boolean
  timeZone: string
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
      emailComments: false,
      emailDigest: false,
      timeZone: getBrowserTimeZone(),
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
    emailComments: currentUser.preferences.emailComments ?? true,
    emailDigest: currentUser.preferences.emailDigest,
    timeZone: normalizeTimeZone(
      currentUser.preferences.timeZone,
      getBrowserTimeZone()
    ),
  }
}

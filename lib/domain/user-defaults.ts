import type { ThemePreference, UserStatus } from "@/lib/domain/types"

export const defaultUserPreferences: {
  emailMentions: boolean
  emailAssignments: boolean
  emailDigest: boolean
  theme: ThemePreference
} = {
  emailMentions: true,
  emailAssignments: true,
  emailDigest: true,
  theme: "light",
}

export const defaultUserStatus: UserStatus = "offline"
export const defaultUserStatusMessage = ""

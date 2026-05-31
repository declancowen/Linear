import type { ThemePreference, UserStatus } from "@/lib/domain/types"

export const defaultUserPreferences: {
  emailMentions: boolean
  emailAssignments: boolean
  emailComments: boolean
  emailDigest: boolean
  theme: ThemePreference
  timeZone: string
} = {
  emailMentions: true,
  emailAssignments: true,
  emailComments: true,
  emailDigest: true,
  theme: "light",
  timeZone: "UTC",
}

export const defaultUserStatus: UserStatus = "offline"
export const defaultUserStatusMessage = ""

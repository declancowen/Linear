import { getPlainTextContent } from "@/lib/utils"

export type TextInputConstraint = {
  min?: number
  max: number
  trim?: boolean
  allowEmpty?: boolean
}

export type TextInputLimitState = {
  displayCount: number
  remaining: number
  tooShort: boolean
  tooLong: boolean
  isAtLimit: boolean
  canSubmit: boolean
  error: string | null
}

export const labelNameConstraints = {
  min: 1,
  max: 32,
  trim: true,
} satisfies TextInputConstraint

export const workspaceSetupNameConstraints = {
  min: 2,
  max: 64,
  trim: true,
} satisfies TextInputConstraint

export const workspaceDescriptionConstraints = {
  min: 8,
  max: 220,
  trim: true,
} satisfies TextInputConstraint

export const optionalWorkspaceDescriptionConstraints = {
  ...workspaceDescriptionConstraints,
  allowEmpty: true,
} satisfies TextInputConstraint

export const workspaceBrandingNameConstraints = {
  min: 2,
  max: 48,
  trim: true,
} satisfies TextInputConstraint

export const workspaceFallbackBadgeConstraints = {
  min: 1,
  max: 24,
  trim: true,
} satisfies TextInputConstraint

export const workspaceAccentConstraints = {
  min: 2,
  max: 24,
  trim: true,
} satisfies TextInputConstraint

export const teamNameConstraints = {
  min: 2,
  max: 48,
  trim: true,
} satisfies TextInputConstraint

export const teamSummaryConstraints = {
  min: 8,
  max: 180,
  trim: true,
} satisfies TextInputConstraint

export const teamJoinCodeConstraints = {
  min: 4,
  max: 24,
  trim: true,
  allowEmpty: true,
} satisfies TextInputConstraint

export const requiredTeamJoinCodeConstraints = {
  min: 4,
  max: 24,
  trim: true,
} satisfies TextInputConstraint

export const profileNameConstraints = {
  min: 2,
  max: 48,
  trim: true,
} satisfies TextInputConstraint

export const profileTitleConstraints = {
  min: 2,
  max: 72,
  trim: true,
  allowEmpty: true,
} satisfies TextInputConstraint

export const profileAvatarFallbackConstraints = {
  min: 1,
  max: 24,
  trim: true,
} satisfies TextInputConstraint

export const profileStatusMessageConstraints = {
  max: 80,
  trim: true,
} satisfies TextInputConstraint

export const projectNameConstraints = {
  min: 2,
  max: 64,
  trim: true,
} satisfies TextInputConstraint

export const projectSummaryConstraints = {
  min: 2,
  max: 140,
  trim: true,
  allowEmpty: true,
} satisfies TextInputConstraint

export const viewNameConstraints = {
  min: 2,
  max: 64,
  trim: true,
} satisfies TextInputConstraint

export const viewDescriptionConstraints = {
  max: 160,
  trim: true,
} satisfies TextInputConstraint

export const workItemTitleConstraints = {
  min: 2,
  max: 96,
  trim: true,
} satisfies TextInputConstraint

export const documentTitleConstraints = {
  min: 2,
  max: 80,
  trim: true,
} satisfies TextInputConstraint

export const commentContentConstraints = {
  min: 2,
  max: 4000,
  trim: true,
} satisfies TextInputConstraint

export const conversationTitleConstraints = {
  max: 80,
  trim: true,
} satisfies TextInputConstraint

export const conversationDescriptionConstraints = {
  max: 180,
  trim: true,
} satisfies TextInputConstraint

export const chatMessageContentConstraints = {
  min: 1,
  max: 4000,
  trim: true,
} satisfies TextInputConstraint

export const channelPostTitleConstraints = {
  max: 120,
  trim: true,
} satisfies TextInputConstraint

export const channelPostContentConstraints = {
  min: 2,
  max: 8000,
  trim: true,
} satisfies TextInputConstraint

export const channelPostCommentContentConstraints = {
  min: 1,
  max: 4000,
  trim: true,
} satisfies TextInputConstraint

export const inputConstraints = {
  labelName: labelNameConstraints,
  workspaceSetupName: workspaceSetupNameConstraints,
  workspaceDescription: workspaceDescriptionConstraints,
  workspaceBrandingName: workspaceBrandingNameConstraints,
  workspaceFallbackBadge: workspaceFallbackBadgeConstraints,
  workspaceAccent: workspaceAccentConstraints,
  teamName: teamNameConstraints,
  teamSummary: teamSummaryConstraints,
  teamJoinCode: teamJoinCodeConstraints,
  requiredTeamJoinCode: requiredTeamJoinCodeConstraints,
  profileName: profileNameConstraints,
  profileTitle: profileTitleConstraints,
  profileAvatarFallback: profileAvatarFallbackConstraints,
  profileStatusMessage: profileStatusMessageConstraints,
  projectName: projectNameConstraints,
  projectSummary: projectSummaryConstraints,
  viewName: viewNameConstraints,
  viewDescription: viewDescriptionConstraints,
  workItemTitle: workItemTitleConstraints,
  documentTitle: documentTitleConstraints,
  commentContent: commentContentConstraints,
  conversationTitle: conversationTitleConstraints,
  conversationDescription: conversationDescriptionConstraints,
  chatMessageContent: chatMessageContentConstraints,
  channelPostTitle: channelPostTitleConstraints,
  channelPostContent: channelPostContentConstraints,
  channelPostCommentContent: channelPostCommentContentConstraints,
} as const

function resolveCountSource(value: string, trim = true) {
  return trim ? value.trim() : value
}

export function getTextLength(
  value: string,
  constraint: Pick<TextInputConstraint, "trim"> = {}
) {
  return resolveCountSource(value, constraint.trim ?? true).length
}

export function getPlainTextLength(
  value: string,
  constraint: Pick<TextInputConstraint, "trim"> = {}
) {
  return resolveCountSource(
    getPlainTextContent(value),
    constraint.trim ?? true
  ).length
}

export function getRichTextMarkupSafetyCap(maxPlainTextCharacters: number) {
  return Math.max(maxPlainTextCharacters * 12, 4000)
}

export function getTextInputLimitState(
  value: string,
  constraint: TextInputConstraint,
  options?: {
    plainText?: boolean
  }
): TextInputLimitState {
  const displayCount = options?.plainText
    ? getPlainTextLength(value, constraint)
    : getTextLength(value, constraint)
  const minimum = constraint.min ?? 0
  const tooShort =
    !(constraint.allowEmpty && displayCount === 0) && displayCount < minimum
  const tooLong = displayCount > constraint.max
  const remaining = constraint.max - displayCount
  const isAtLimit = displayCount >= constraint.max
  const canSubmit = !tooShort && !tooLong

  let error: string | null = null

  if (tooLong) {
    error = `Limit is ${constraint.max} characters`
  } else if (tooShort) {
    error =
      minimum === 1
        ? "Enter at least 1 character"
        : `Enter at least ${minimum} characters`
  }

  return {
    displayCount,
    remaining,
    tooShort,
    tooLong,
    isAtLimit,
    canSubmit,
    error,
  }
}

export function getMentionDisplayLabel(
  name: string | null | undefined,
  fallback?: string | null | undefined
) {
  const normalizedName = name?.trim()

  if (normalizedName) {
    const firstToken = normalizedName.split(/\s+/).find(Boolean)

    if (firstToken) {
      return firstToken
    }

    return normalizedName
  }

  return fallback?.trim() || ""
}

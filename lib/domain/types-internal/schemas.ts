import { z } from "zod"

import { isValidCalendarDateString } from "@/lib/calendar-date"
import {
  channelPostCommentContentConstraints,
  channelPostContentConstraints,
  channelPostTitleConstraints,
  chatMessageContentConstraints,
  commentContentConstraints,
  conversationDescriptionConstraints,
  conversationTitleConstraints,
  documentTitleConstraints,
  getPlainTextLength,
  getRichTextMarkupSafetyCap,
  isLegacyImageSourceValue,
  labelNameConstraints,
  optionalTeamSummaryConstraints,
  optionalWorkspaceDescriptionConstraints,
  profileAvatarFallbackConstraints,
  profileNameConstraints,
  profileStatusMessageConstraints,
  profileTitleConstraints,
  projectSummaryConstraints,
  requiredTeamJoinCodeConstraints,
  teamJoinCodeConstraints,
  teamNameConstraints,
  teamSummaryConstraints,
  viewDescriptionConstraints,
  workItemTitleConstraints,
  workspaceAccentConstraints,
  workspaceFallbackBadgeConstraints,
  workspaceBrandingNameConstraints,
  workspaceSetupNameConstraints,
} from "../input-constraints"

import {
  attachmentTargetTypes,
  commentTargetTypes,
  displayProperties,
  entityKinds,
  viewContainerTypes,
  groupFields,
  orderingFields,
  priorities,
  projectNameMaxLength,
  projectNameMinLength,
  projectHealths,
  projectStatuses,
  roles,
  scopeTypes,
  teamExperienceTypes,
  teamIconTokens,
  themePreferences,
  userStatuses,
  viewLayouts,
  viewFilterStatuses,
  viewNameMaxLength,
  viewNameMinLength,
  workItemTypes,
  workStatuses,
} from "./primitives"
import { getTeamFeatureValidationMessage } from "./work"

function boundedTrimmedStringSchema(constraint: {
  min?: number
  max: number
  allowEmpty?: boolean
  allowLegacyImageSource?: boolean
  trim?: boolean
}) {
  let schema = z
    .string()
    .trim()
    .refine(
      (value) =>
        isLegacyImageSourceValue(value, constraint) ||
        value.length <= constraint.max,
      {
        message: `Enter ${constraint.max} characters or fewer`,
      }
    )

  if (constraint.min !== undefined) {
    schema = schema.refine(
      (value) =>
        isLegacyImageSourceValue(value, constraint) ||
        (constraint.allowEmpty && value.length === 0) ||
        value.length >= constraint.min!,
      {
        message:
          constraint.min === 1
            ? "Enter at least 1 character"
            : `Enter at least ${constraint.min} characters`,
      }
    )
  }

  return schema
}

function boundedRichTextPlainTextSchema(constraint: {
  min?: number
  max: number
}) {
  return z
    .string()
    .trim()
    .max(getRichTextMarkupSafetyCap(constraint.max))
    .refine(
      (value) => {
        const plainTextLength = getPlainTextLength(value)
        return constraint.min === undefined
          ? true
          : plainTextLength >= constraint.min
      },
      {
        message:
          constraint.min === 1
            ? "Content must include at least 1 character"
            : `Content must include at least ${constraint.min} characters`,
      }
    )
    .refine((value) => getPlainTextLength(value) <= constraint.max, {
      message: `Content must be ${constraint.max} characters or fewer`,
    })
}

export const nullableCalendarDateSchema = z
  .string()
  .trim()
  .refine(isValidCalendarDateString, {
    message: "Must be a valid calendar date",
  })
  .nullable()

export const labelCreateSchema = z.object({
  workspaceId: z.string().trim().min(1).optional(),
  name: boundedTrimmedStringSchema(labelNameConstraints),
  color: z.string().trim().min(1).max(24).optional(),
})

export const inviteSchema = z.object({
  teamIds: z.array(z.string().min(1)).min(1).max(12),
  email: z.email(),
  role: z.enum(roles),
})

export const joinCodeSchema = z.object({
  code: boundedTrimmedStringSchema(requiredTeamJoinCodeConstraints),
})

export const workspaceBrandingSchema = z.object({
  name: boundedTrimmedStringSchema(workspaceBrandingNameConstraints),
  logoUrl: boundedTrimmedStringSchema(workspaceFallbackBadgeConstraints),
  logoImageStorageId: z.string().trim().min(1).optional(),
  clearLogoImage: z.boolean().optional(),
  accent: boundedTrimmedStringSchema(workspaceAccentConstraints),
  description: boundedTrimmedStringSchema(
    optionalWorkspaceDescriptionConstraints
  ),
})

export const workspaceSetupSchema = z.object({
  name: boundedTrimmedStringSchema(workspaceSetupNameConstraints),
  description: boundedTrimmedStringSchema(
    optionalWorkspaceDescriptionConstraints
  ).optional(),
})

export const teamDetailsSchema = z
  .object({
    name: boundedTrimmedStringSchema(teamNameConstraints),
    icon: z.enum(teamIconTokens),
    summary: boundedTrimmedStringSchema(teamSummaryConstraints),
    joinCode: boundedTrimmedStringSchema(teamJoinCodeConstraints).optional(),
    experience: z.enum(teamExperienceTypes),
    features: z.object({
      issues: z.boolean(),
      projects: z.boolean(),
      views: z.boolean(),
      docs: z.boolean(),
      chat: z.boolean(),
      channels: z.boolean(),
    }),
  })
  .superRefine((value, ctx) => {
    const validationMessage = getTeamFeatureValidationMessage(
      value.experience,
      value.features
    )

    if (validationMessage) {
      ctx.addIssue({
        code: "custom",
        message: validationMessage,
        path: ["features"],
      })
    }
  })

export const teamDetailsUpdateSchema = z
  .object({
    name: boundedTrimmedStringSchema(teamNameConstraints),
    icon: z.enum(teamIconTokens),
    summary: boundedTrimmedStringSchema(optionalTeamSummaryConstraints),
    joinCode: boundedTrimmedStringSchema(teamJoinCodeConstraints).optional(),
    experience: z.enum(teamExperienceTypes),
    features: z.object({
      issues: z.boolean(),
      projects: z.boolean(),
      views: z.boolean(),
      docs: z.boolean(),
      chat: z.boolean(),
      channels: z.boolean(),
    }),
  })
  .superRefine((value, ctx) => {
    const validationMessage = getTeamFeatureValidationMessage(
      value.experience,
      value.features
    )

    if (validationMessage) {
      ctx.addIssue({
        code: "custom",
        message: validationMessage,
        path: ["features"],
      })
    }
  })

export const teamMembershipRoleSchema = z.object({
  role: z.enum(roles),
})

export const profileSchema = z.object({
  name: boundedTrimmedStringSchema(profileNameConstraints),
  title: boundedTrimmedStringSchema(profileTitleConstraints),
  avatarUrl: boundedTrimmedStringSchema(profileAvatarFallbackConstraints),
  avatarImageStorageId: z.string().trim().min(1).optional(),
  clearAvatarImage: z.boolean().optional(),
  clearStatus: z.boolean().optional(),
  status: z.enum(userStatuses).optional(),
  statusMessage: boundedTrimmedStringSchema(
    profileStatusMessageConstraints
  ).optional(),
  preferences: z.object({
    emailMentions: z.boolean(),
    emailAssignments: z.boolean(),
    emailDigest: z.boolean(),
    theme: z.enum(themePreferences).default("light"),
  }),
})

export const projectSchema = z.object({
  scopeType: z.enum(scopeTypes),
  scopeId: z.string().min(1),
  templateType: z.enum([
    "software-delivery",
    "bug-tracking",
    "project-management",
  ]),
  name: z.string().trim().min(projectNameMinLength).max(projectNameMaxLength),
  summary: boundedTrimmedStringSchema(projectSummaryConstraints),
  status: z.enum(projectStatuses).optional(),
  priority: z.enum(priorities),
  leadId: z.string().nullable().optional(),
  memberIds: z.array(z.string()).optional(),
  blockingProjectIds: z.array(z.string()).optional(),
  blockedByProjectIds: z.array(z.string()).optional(),
  startDate: nullableCalendarDateSchema.optional(),
  targetDate: nullableCalendarDateSchema.optional(),
  labelIds: z.array(z.string()).optional(),
  settingsTeamId: z.string().nullable().optional(),
  presentation: z
    .object({
      itemLevel: z.enum(workItemTypes).nullable().optional(),
      showChildItems: z.boolean().optional(),
      layout: z.enum(viewLayouts),
      grouping: z.enum(groupFields),
      ordering: z.enum(orderingFields),
      displayProps: z.array(z.enum(displayProperties)),
      filters: z.object({
        status: z.array(z.enum(viewFilterStatuses)),
        priority: z.array(z.enum(priorities)),
        assigneeIds: z.array(z.string()),
        creatorIds: z.array(z.string()),
        leadIds: z.array(z.string()),
        health: z.array(z.enum(projectHealths)),
        milestoneIds: z.array(z.string()),
        relationTypes: z.array(z.string()),
        projectIds: z.array(z.string()),
        parentIds: z.array(z.string()).default([]),
        itemTypes: z.array(z.enum(workItemTypes)),
        labelIds: z.array(z.string()),
        teamIds: z.array(z.string()),
        showCompleted: z.boolean(),
      }),
    })
    .optional(),
})

const viewFiltersSchema = z.object({
  status: z.array(z.enum(viewFilterStatuses)),
  priority: z.array(z.enum(priorities)),
  assigneeIds: z.array(z.string()),
  creatorIds: z.array(z.string()),
  leadIds: z.array(z.string()),
  health: z.array(z.enum(projectHealths)),
  milestoneIds: z.array(z.string()),
  relationTypes: z.array(z.string()),
  projectIds: z.array(z.string()),
  parentIds: z.array(z.string()).default([]),
  itemTypes: z.array(z.enum(workItemTypes)),
  labelIds: z.array(z.string()),
  teamIds: z.array(z.string()),
  showCompleted: z.boolean(),
})

export const viewConfigPatchSchema = z.object({
  layout: z.enum(viewLayouts).optional(),
  grouping: z.enum(groupFields).optional(),
  subGrouping: z.enum(groupFields).nullable().optional(),
  ordering: z.enum(orderingFields).optional(),
  itemLevel: z.enum(workItemTypes).nullable().optional(),
  showChildItems: z.boolean().optional(),
  showCompleted: z.boolean().optional(),
})

export const viewSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    scopeType: z.enum(["team", "workspace"]),
    scopeId: z.string().min(1),
    entityKind: z.enum(entityKinds),
    containerType: z.enum(viewContainerTypes).nullable().optional(),
    containerId: z.string().trim().min(1).nullable().optional(),
    route: z.string().trim().min(1),
    name: z.string().trim().min(viewNameMinLength).max(viewNameMaxLength),
    description: boundedTrimmedStringSchema(viewDescriptionConstraints).default(
      ""
    ),
    layout: viewConfigPatchSchema.shape.layout,
    grouping: viewConfigPatchSchema.shape.grouping,
    subGrouping: viewConfigPatchSchema.shape.subGrouping,
    ordering: viewConfigPatchSchema.shape.ordering,
    itemLevel: viewConfigPatchSchema.shape.itemLevel,
    showChildItems: viewConfigPatchSchema.shape.showChildItems,
    showCompleted: viewConfigPatchSchema.shape.showCompleted,
    filters: viewFiltersSchema.optional(),
    displayProps: z.array(z.enum(displayProperties)).optional(),
    hiddenState: z
      .object({
        groups: z.array(z.string()),
        subgroups: z.array(z.string()),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    const hasContainerType =
      value.containerType !== undefined && value.containerType !== null
    const hasContainerId =
      value.containerId !== undefined && value.containerId !== null

    if (hasContainerType !== hasContainerId) {
      ctx.addIssue({
        code: "custom",
        message: "containerType and containerId must be provided together",
        path: hasContainerType ? ["containerId"] : ["containerType"],
      })
    }
  })

export const workItemSchema = z.object({
  id: z.string().trim().min(1).optional(),
  descriptionDocId: z.string().trim().min(1).optional(),
  teamId: z.string().min(1),
  type: z.enum(workItemTypes),
  title: boundedTrimmedStringSchema(workItemTitleConstraints),
  parentId: z.string().nullable().optional(),
  primaryProjectId: z.string().nullable(),
  assigneeId: z.string().nullable(),
  status: z.enum(workStatuses).optional(),
  priority: z.enum(priorities),
  labelIds: z.array(z.string()).optional(),
  startDate: nullableCalendarDateSchema.optional(),
  dueDate: nullableCalendarDateSchema.optional(),
  targetDate: nullableCalendarDateSchema.optional(),
})

const createDocumentBaseSchema = {
  id: z.string().trim().min(1).optional(),
  title: boundedTrimmedStringSchema(documentTitleConstraints),
}

export const documentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("team-document"),
    teamId: z.string().min(1),
    ...createDocumentBaseSchema,
  }),
  z.object({
    kind: z.literal("workspace-document"),
    workspaceId: z.string().min(1),
    ...createDocumentBaseSchema,
  }),
  z.object({
    kind: z.literal("private-document"),
    workspaceId: z.string().min(1),
    ...createDocumentBaseSchema,
  }),
])

export const commentSchema = z.object({
  targetType: z.enum(commentTargetTypes),
  targetId: z.string().min(1),
  parentCommentId: z.string().min(1).nullable().optional(),
  content: boundedRichTextPlainTextSchema(commentContentConstraints),
})

export const workspaceChatSchema = z.object({
  workspaceId: z.string().min(1),
  participantIds: z.array(z.string().min(1)).min(1).max(24),
  title: boundedTrimmedStringSchema(conversationTitleConstraints).default(""),
  description: boundedTrimmedStringSchema(
    conversationDescriptionConstraints
  ).default(""),
})

export const teamChatSchema = z.object({
  teamId: z.string().min(1),
  title: boundedTrimmedStringSchema(conversationTitleConstraints).default(""),
  description: boundedTrimmedStringSchema(
    conversationDescriptionConstraints
  ).default(""),
})

export const channelSchema = z
  .object({
    teamId: z.string().min(1).optional(),
    workspaceId: z.string().min(1).optional(),
    title: boundedTrimmedStringSchema(conversationTitleConstraints).default(""),
    description: boundedTrimmedStringSchema(
      conversationDescriptionConstraints
    ).default(""),
  })
  .superRefine((value, ctx) => {
    const targets =
      Number(Boolean(value.teamId)) + Number(Boolean(value.workspaceId))

    if (targets !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Channel must target exactly one team or workspace",
      })
    }
  })

export const chatMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: boundedRichTextPlainTextSchema(chatMessageContentConstraints),
})

export const channelPostSchema = z.object({
  conversationId: z.string().min(1),
  title: boundedTrimmedStringSchema(channelPostTitleConstraints).default(""),
  content: boundedRichTextPlainTextSchema(channelPostContentConstraints),
})

export const channelPostCommentSchema = z.object({
  postId: z.string().min(1),
  content: boundedRichTextPlainTextSchema(channelPostCommentContentConstraints),
})

export const attachmentUploadUrlSchema = z.object({
  targetType: z.enum(attachmentTargetTypes),
  targetId: z.string().min(1),
})

const settingsImageUploadKinds = [
  "user-avatar",
  "workspace-logo",
] as const

export const settingsImageUploadSchema = z.object({
  kind: z.enum(settingsImageUploadKinds),
})

export const attachmentSchema = z.object({
  targetType: z.enum(attachmentTargetTypes),
  targetId: z.string().min(1),
  storageId: z.string().min(1),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
  size: z
    .number()
    .int()
    .min(1)
    .max(25 * 1024 * 1024),
})

const teamTemplateConfigSchema = z.object({
  defaultPriority: z.enum(priorities),
  targetWindowDays: z.number().int().min(3).max(180),
  defaultViewLayout: z.enum(viewLayouts),
  recommendedItemTypes: z.array(z.enum(workItemTypes)).min(1),
  summaryHint: z.string().trim().min(8).max(180),
})

export const teamWorkflowSettingsSchema = z.object({
  statusOrder: z
    .array(z.enum(workStatuses))
    .length(workStatuses.length)
    .refine(
      (values) => new Set(values).size === workStatuses.length,
      "Status order must include each status exactly once"
    ),
  templateDefaults: z.object({
    "software-delivery": teamTemplateConfigSchema,
    "bug-tracking": teamTemplateConfigSchema,
    "project-management": teamTemplateConfigSchema,
  }),
})

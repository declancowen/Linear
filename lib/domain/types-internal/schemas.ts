import { z } from "zod"

import { isValidCalendarDateString } from "@/lib/calendar-date"
import { isValidTimeValue, isValidTimeZone } from "@/lib/time-zone"
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
  customPropertyScopeTypes,
  customPropertyTargetTypes,
  customPropertyTypes,
  displayProperties,
  entityKinds,
  viewContainerTypes,
  groupFields,
  labelScopeTypes,
  orderingFields,
  priorities,
  projectNameMaxLength,
  projectNameMinLength,
  projectHealths,
  projectPresentationLayouts,
  projectStatuses,
  roles,
  scopeTypes,
  teamExperienceTypes,
  themePreferences,
  userStatuses,
  viewLayouts,
  viewFilterStatuses,
  viewNameMaxLength,
  viewNameMinLength,
  workItemTypes,
  workItemVisibilities,
  workStatuses,
  type DisplayProperty,
} from "./primitives"
import {
  getTeamFeatureValidationMessage,
  isValidTeamIconInputValue,
} from "./work"

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

const teamIconSchema = z
  .string()
  .trim()
  .min(1, "Select an icon")
  .max(80, "Select an icon")
  .refine(isValidTeamIconInputValue, {
    message: "Select a supported icon",
  })

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

export const nullableTimeSchema = z
  .string()
  .trim()
  .refine(isValidTimeValue, {
    message: "Must be a valid time",
  })
  .nullable()

export const nullableTimeZoneSchema = z
  .string()
  .trim()
  .refine(isValidTimeZone, {
    message: "Must be a valid time zone",
  })
  .nullable()

export const labelCreateSchema = z.object({
  workspaceId: z.string().trim().min(1).optional(),
  scopeType: z.enum(labelScopeTypes).optional(),
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
    icon: teamIconSchema,
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
    icon: teamIconSchema,
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
    timeZone: z
      .string()
      .trim()
      .refine(isValidTimeZone, {
        message: "Must be a valid time zone",
      })
      .default("UTC"),
  }),
})

const viewFiltersSchema = z.object({
  status: z.array(z.enum(viewFilterStatuses)),
  priority: z.array(z.enum(priorities)),
  assigneeIds: z.array(z.string()),
  creatorIds: z.array(z.string()),
  updatedByIds: z.array(z.string()).default([]),
  documentKinds: z
    .array(
      z.enum([
        "team-document",
        "workspace-document",
        "private-document",
        "item-description",
      ])
    )
    .default([]),
  linkedWorkItemIds: z.array(z.string()).default([]),
  leadIds: z.array(z.string()),
  health: z.array(z.enum(projectHealths)),
  milestoneIds: z.array(z.string()),
  relationTypes: z.array(z.string()),
  projectIds: z.array(z.string()),
  parentIds: z.array(z.string()).default([]),
  itemTypes: z.array(z.enum(workItemTypes)),
  labelIds: z.array(z.string()),
  teamIds: z.array(z.string()),
  visibility: z.array(z.enum(workItemVisibilities)).default([]),
  showCompleted: z.boolean(),
})

export const displayPropertySchema = z.custom<DisplayProperty>(
  (value) =>
    typeof value === "string" &&
    (displayProperties.includes(value as (typeof displayProperties)[number]) ||
      /^custom:[A-Za-z0-9_-]+$/.test(value)),
  {
    message: "Display property is not valid",
  }
)

export const projectSchema = z.object({
  scopeType: z.enum(scopeTypes),
  scopeId: z.string().min(1),
  templateType: z.enum([
    "software-delivery",
    "bug-tracking",
    "project-management",
  ]),
  name: z.string().trim().min(projectNameMinLength).max(projectNameMaxLength),
  icon: z.string().trim().min(1).max(80).optional(),
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
      layout: z.enum(projectPresentationLayouts),
      grouping: z.enum(groupFields),
      ordering: z.enum(orderingFields),
      displayProps: z.array(displayPropertySchema),
      filters: viewFiltersSchema,
    })
    .optional(),
})

const viewConfigPatchBaseSchema = z.object({
  layout: z.enum(viewLayouts).optional(),
  grouping: z.enum(groupFields).optional(),
  subGrouping: z.enum(groupFields).nullable().optional(),
  ordering: z.enum(orderingFields).optional(),
  itemLevel: z.enum(workItemTypes).nullable().optional(),
  showChildItems: z.boolean().optional(),
  showCompleted: z.boolean().optional(),
  description: boundedTrimmedStringSchema(
    viewDescriptionConstraints
  ).optional(),
  containerType: z.enum(viewContainerTypes).nullable().optional(),
  containerId: z.string().trim().min(1).nullable().optional(),
  route: z.string().trim().min(1).optional(),
})

export const viewConfigPatchSchema = viewConfigPatchBaseSchema
  .superRefine((value, ctx) => {
    const hasContainerTypeKey = "containerType" in value
    const hasContainerIdKey = "containerId" in value
    const hasContainerType =
      value.containerType !== undefined && value.containerType !== null
    const hasContainerId =
      value.containerId !== undefined && value.containerId !== null

    if (hasContainerTypeKey !== hasContainerIdKey) {
      ctx.addIssue({
        code: "custom",
        message: "containerType and containerId must be provided together",
        path: hasContainerTypeKey ? ["containerId"] : ["containerType"],
      })
      return
    }

    if (hasContainerType !== hasContainerId) {
      ctx.addIssue({
        code: "custom",
        message: "containerType and containerId must be provided together",
        path: hasContainerType ? ["containerId"] : ["containerType"],
      })
    }
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
    layout: viewConfigPatchBaseSchema.shape.layout,
    grouping: viewConfigPatchBaseSchema.shape.grouping,
    subGrouping: viewConfigPatchBaseSchema.shape.subGrouping,
    ordering: viewConfigPatchBaseSchema.shape.ordering,
    itemLevel: viewConfigPatchBaseSchema.shape.itemLevel,
    showChildItems: viewConfigPatchBaseSchema.shape.showChildItems,
    showCompleted: viewConfigPatchBaseSchema.shape.showCompleted,
    filters: viewFiltersSchema.optional(),
    displayProps: z.array(displayPropertySchema).optional(),
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
  visibility: z.enum(workItemVisibilities).optional(),
  startDate: nullableCalendarDateSchema.optional(),
  dueDate: nullableCalendarDateSchema.optional(),
  targetDate: nullableCalendarDateSchema.optional(),
  startTime: nullableTimeSchema.optional(),
  endTime: nullableTimeSchema.optional(),
  scheduleTimeZone: nullableTimeZoneSchema.optional(),
})

const customPropertyOptionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  color: z.string().trim().min(1).max(32),
})

const customPropertyDefinitionBaseSchema = z.object({
  teamId: z.string().trim().min(1),
  scopeType: z.enum(customPropertyScopeTypes).optional(),
  targetType: z.enum(customPropertyTargetTypes).default("workItem"),
  name: z.string().trim().min(1).max(64),
  icon: z.string().trim().min(1).max(80),
  type: z.enum(customPropertyTypes),
  options: z.array(customPropertyOptionSchema).default([]),
})

function addCustomPropertyOptionValidationIssues(
  value: {
    options?: Array<z.infer<typeof customPropertyOptionSchema>>
    type?: (typeof customPropertyTypes)[number]
  },
  ctx: z.RefinementCtx
) {
  const options = value.options ?? []
  const isChoiceType = value.type === "select" || value.type === "multiSelect"

  if (value.type && !isChoiceType && options.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["options"],
      message: "Only select properties can define options",
    })
  }

  if (isChoiceType && options.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["options"],
      message: "Add at least one option",
    })
  }

  const normalizedIds = options.map((option) => option.id.trim())
  if (new Set(normalizedIds).size !== normalizedIds.length) {
    ctx.addIssue({
      code: "custom",
      path: ["options"],
      message: "Option ids must be unique",
    })
  }

  const normalizedLabels = options.map((option) =>
    option.label.trim().toLowerCase()
  )
  if (new Set(normalizedLabels).size !== normalizedLabels.length) {
    ctx.addIssue({
      code: "custom",
      path: ["options"],
      message: "Option labels must be unique",
    })
  }
}

const customPropertyDefinitionPatchBaseSchema = z.object({
  name: z.string().trim().min(1).max(64),
  icon: z.string().trim().min(1).max(80),
  type: z.enum(customPropertyTypes),
  options: z.array(customPropertyOptionSchema),
})

export const customPropertyDefinitionSchema =
  customPropertyDefinitionBaseSchema.superRefine((value, ctx) => {
    addCustomPropertyOptionValidationIssues(value, ctx)
  })

export const customPropertyDefinitionPatchSchema =
  customPropertyDefinitionPatchBaseSchema
    .partial()
    .superRefine((value, ctx) => {
      addCustomPropertyOptionValidationIssues(value, ctx)
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one property field is required",
    })

export const customPropertyValueSchema = z.object({
  value: z.union([
    z.string(),
    z.number().int(),
    z.boolean(),
    z.array(z.string()),
    z.null(),
  ]),
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

const settingsImageUploadKinds = ["user-avatar", "workspace-logo"] as const

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

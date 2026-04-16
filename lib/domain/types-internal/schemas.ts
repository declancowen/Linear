import { z } from "zod"

import { getPlainTextContent } from "@/lib/utils"

import {
  attachmentTargetTypes,
  commentTargetTypes,
  displayProperties,
  groupFields,
  orderingFields,
  priorities,
  projectHealths,
  roles,
  scopeTypes,
  teamExperienceTypes,
  teamIconTokens,
  themePreferences,
  userStatusMessageMaxLength,
  userStatuses,
  viewLayouts,
  workItemTypes,
  workStatuses,
} from "./primitives"
import { getTeamFeatureValidationMessage } from "./work"

export const labelCreateSchema = z.object({
  name: z.string().trim().min(1).max(32),
  color: z.string().trim().min(1).max(24).optional(),
})

export const inviteSchema = z.object({
  teamIds: z.array(z.string().min(1)).min(1).max(12),
  email: z.email(),
  role: z.enum(roles),
})

export const joinCodeSchema = z.object({
  code: z.string().trim().min(4),
})

export const workspaceBrandingSchema = z.object({
  name: z.string().trim().min(2).max(48),
  logoUrl: z.string().trim().min(1),
  logoImageStorageId: z.string().trim().min(1).optional(),
  clearLogoImage: z.boolean().optional(),
  accent: z.string().trim().min(2).max(24),
  description: z.string().trim().min(8).max(220),
})

export const workspaceSetupSchema = z.object({
  name: z.string().trim().min(2).max(64),
  description: z.string().trim().min(8).max(220).optional(),
})

export const teamDetailsSchema = z
  .object({
    name: z.string().trim().min(2).max(48),
    icon: z.enum(teamIconTokens),
    summary: z.string().trim().min(8).max(180),
    joinCode: z.string().trim().min(4).max(24).optional(),
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

export const appWorkspaceBootstrapSchema = z.object({
  workspaceSlug: z.string().trim().min(2).max(64),
  workspaceName: z.string().trim().min(2).max(64),
  workspaceLogoUrl: z.string().trim().min(1).max(24),
  workspaceAccent: z.string().trim().min(2).max(24),
  workspaceDescription: z.string().trim().min(8).max(220),
  teamSlug: z.string().trim().min(2).max(64),
  teamName: z.string().trim().min(2).max(64),
  teamIcon: z.enum(teamIconTokens),
  teamSummary: z.string().trim().min(8).max(180),
  teamJoinCode: z
    .string()
    .trim()
    .min(4)
    .max(24)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Join code can only contain letters, numbers, dashes, and underscores"
    ),
  email: z.email(),
  userName: z.string().trim().min(2).max(80),
  avatarUrl: z.string().trim().min(1).max(24),
  workosUserId: z.string().trim().min(1),
  teamExperience: z.enum(teamExperienceTypes).default("software-development"),
  role: z.enum(roles).default("admin"),
})

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(48),
  title: z.string().trim().min(2).max(72),
  avatarUrl: z.string().trim().min(1),
  avatarImageStorageId: z.string().trim().min(1).optional(),
  clearAvatarImage: z.boolean().optional(),
  clearStatus: z.boolean().optional(),
  status: z.enum(userStatuses).optional(),
  statusMessage: z.string().trim().max(userStatusMessageMaxLength).optional(),
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
  name: z.string().trim().min(2).max(64),
  summary: z.string().trim().min(2).max(140),
  priority: z.enum(priorities),
  settingsTeamId: z.string().nullable().optional(),
  presentation: z
    .object({
      layout: z.enum(viewLayouts),
      grouping: z.enum(groupFields),
      ordering: z.enum(orderingFields),
      displayProps: z.array(z.enum(displayProperties)),
      filters: z.object({
        status: z.array(z.enum(workStatuses)),
        priority: z.array(z.enum(priorities)),
        assigneeIds: z.array(z.string()),
        creatorIds: z.array(z.string()),
        leadIds: z.array(z.string()),
        health: z.array(z.enum(projectHealths)),
        milestoneIds: z.array(z.string()),
        relationTypes: z.array(z.string()),
        projectIds: z.array(z.string()),
        itemTypes: z.array(z.enum(workItemTypes)),
        labelIds: z.array(z.string()),
        teamIds: z.array(z.string()),
        showCompleted: z.boolean(),
      }),
    })
    .optional(),
})

export const workItemSchema = z.object({
  teamId: z.string().min(1),
  type: z.enum(workItemTypes),
  title: z.string().trim().min(2).max(96),
  parentId: z.string().nullable().optional(),
  primaryProjectId: z.string().nullable(),
  assigneeId: z.string().nullable(),
  status: z.enum(workStatuses).optional(),
  priority: z.enum(priorities),
  labelIds: z.array(z.string()).optional(),
})

const createDocumentBaseSchema = {
  title: z.string().trim().min(2).max(80),
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
  content: z.string().trim().min(2).max(4000),
})

export const workspaceChatSchema = z.object({
  workspaceId: z.string().min(1),
  participantIds: z.array(z.string().min(1)).min(1).max(24),
  title: z.string().trim().max(80).default(""),
  description: z.string().trim().max(180).default(""),
})

export const teamChatSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().trim().max(80).default(""),
  description: z.string().trim().max(180).default(""),
})

export const channelSchema = z
  .object({
    teamId: z.string().min(1).optional(),
    workspaceId: z.string().min(1).optional(),
    title: z.string().trim().max(80).default(""),
    description: z.string().trim().max(180).default(""),
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
  content: z
    .string()
    .trim()
    .max(4000)
    .refine((value) => getPlainTextContent(value).length >= 1, {
      message: "Message content must include at least 1 character",
    }),
})

export const channelPostSchema = z.object({
  conversationId: z.string().min(1),
  title: z.string().trim().max(120).default(""),
  content: z
    .string()
    .trim()
    .max(8000)
    .refine((value) => getPlainTextContent(value).length >= 2, {
      message: "Post content must include at least 2 characters",
    }),
})

export const channelPostCommentSchema = z.object({
  postId: z.string().min(1),
  content: z
    .string()
    .trim()
    .max(4000)
    .refine((value) => getPlainTextContent(value).length >= 1, {
      message: "Comment content must include at least 1 character",
    }),
})

export const attachmentUploadUrlSchema = z.object({
  targetType: z.enum(attachmentTargetTypes),
  targetId: z.string().min(1),
})

export const settingsImageUploadKinds = [
  "user-avatar",
  "workspace-logo",
] as const
export type SettingsImageUploadKind = (typeof settingsImageUploadKinds)[number]

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

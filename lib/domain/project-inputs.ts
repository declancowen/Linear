import type {
  Priority,
  ProjectPresentationConfig,
  ProjectStatus,
  ScopeType,
  TemplateType,
} from "@/lib/domain/types"

export type CreateProjectInput = {
  scopeType: ScopeType
  scopeId: string
  templateType: TemplateType
  name: string
  summary: string
  status?: ProjectStatus
  priority: Priority
  leadId?: string | null
  memberIds?: string[]
  startDate?: string | null
  targetDate?: string | null
  labelIds?: string[]
  settingsTeamId?: string | null
  presentation?: ProjectPresentationConfig
}

export type AuthenticatedCreateProjectInput = CreateProjectInput & {
  currentUserId: string
}

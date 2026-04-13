import type { ComponentType } from "react"
import {
  Briefcase,
  CheckCircle,
  CodesandboxLogo,
  Kanban,
  Robot,
  UsersThree,
  type IconProps,
} from "@phosphor-icons/react"

import {
  isTeamIconToken,
  templateMeta,
  type TeamIconToken,
  type TemplateType,
} from "@/lib/domain/types"
import { cn } from "@/lib/utils"

const teamIconComponents: Record<TeamIconToken, ComponentType<IconProps>> = {
  robot: Robot,
  code: CodesandboxLogo,
  qa: CheckCircle,
  kanban: Kanban,
  briefcase: Briefcase,
  users: UsersThree,
}

function resolveTeamIcon(icon: string | TeamIconToken): TeamIconToken {
  return isTeamIconToken(icon) ? icon : "code"
}

export function TeamIconGlyph({
  icon,
  className,
}: {
  icon: string | TeamIconToken
  className?: string
}) {
  const Icon = teamIconComponents[resolveTeamIcon(icon)]
  return <Icon className={cn("size-4", className)} />
}

export function ProjectTemplateGlyph({
  templateType,
  className,
}: {
  templateType: TemplateType
  className?: string
}) {
  return (
    <TeamIconGlyph
      icon={templateMeta[templateType].icon}
      className={className}
    />
  )
}

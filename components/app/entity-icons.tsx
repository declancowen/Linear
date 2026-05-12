import { createElement, type ComponentType } from "react"
import * as PhosphorIcons from "@phosphor-icons/react"
import type { IconProps } from "@phosphor-icons/react"

import {
  isTeamIconToken,
  templateMeta,
  type Project,
  type TeamIconToken,
  type TemplateType,
} from "@/lib/domain/types"
import { cn } from "@/lib/utils"
import { PhosphorIconGlyph } from "./phosphor-icon-picker"

type IconComponent = ComponentType<IconProps>

const MissingIcon: IconComponent = ({ className }) => (
  <span aria-hidden className={className} />
)

const teamIconNames: Record<TeamIconToken, string> = {
  robot: "Robot",
  code: "CodesandboxLogo",
  qa: "BugBeetle",
  kanban: "Kanban",
  briefcase: "Briefcase",
  users: "UsersThree",
}

function getPhosphorIcon(name: string): IconComponent {
  return (
    (PhosphorIcons as unknown as Record<string, IconComponent>)[name] ??
    MissingIcon
  )
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
  const Icon = getPhosphorIcon(teamIconNames[resolveTeamIcon(icon)])
  return createElement(Icon, { className: cn("size-4", className) })
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

export function ProjectIconGlyph({
  project,
  className,
}: {
  project: Pick<Project, "icon" | "templateType">
  className?: string
}) {
  if (project.icon) {
    return <PhosphorIconGlyph icon={project.icon} className={className} />
  }

  return (
    <ProjectTemplateGlyph
      templateType={project.templateType}
      className={className}
    />
  )
}

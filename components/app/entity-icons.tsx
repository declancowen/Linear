import {
  getLegacyTeamIconName,
  templateMeta,
  type Project,
  type TeamIconToken,
  type TemplateType,
} from "@/lib/domain/types"
import { cn } from "@/lib/utils"
import { PhosphorIconGlyph } from "./phosphor-icon-picker"

export function TeamIconGlyph({
  icon,
  className,
}: {
  icon: string | TeamIconToken
  className?: string
}) {
  return (
    <PhosphorIconGlyph
      icon={getLegacyTeamIconName(icon) ?? icon}
      fallback="RocketLaunch"
      className={cn("size-4", className)}
    />
  )
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

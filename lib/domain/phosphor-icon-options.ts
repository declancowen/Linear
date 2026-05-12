export const phosphorIconOptions = [
  "Archive",
  "Article",
  "Bell",
  "BookOpen",
  "BookmarkSimple",
  "Briefcase",
  "CalendarBlank",
  "Cards",
  "ChartBar",
  "ChatCircle",
  "CheckCircle",
  "ClipboardText",
  "Clock",
  "Code",
  "Database",
  "File",
  "FileText",
  "Flag",
  "FolderSimple",
  "Gauge",
  "Globe",
  "Hash",
  "House",
  "IdentificationCard",
  "Kanban",
  "Lightbulb",
  "LinkSimple",
  "ListBullets",
  "LockSimple",
  "MapPin",
  "Note",
  "NumberCircleOne",
  "Paperclip",
  "PencilSimple",
  "Pulse",
  "RocketLaunch",
  "SealCheck",
  "ShieldCheck",
  "Sparkle",
  "SquaresFour",
  "Tag",
  "Target",
  "TextAa",
  "Timer",
  "User",
  "UsersThree",
] as const

export type PhosphorIconName = (typeof phosphorIconOptions)[number]

export function isAllowedPhosphorIconName(
  icon: string
): icon is PhosphorIconName {
  return phosphorIconOptions.includes(icon as PhosphorIconName)
}

export function resolvePhosphorIconName(
  icon: string | null | undefined,
  fallback: PhosphorIconName = "FolderSimple"
): PhosphorIconName {
  return icon && isAllowedPhosphorIconName(icon) ? icon : fallback
}

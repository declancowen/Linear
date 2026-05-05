import type { UserStatus } from "@/lib/domain/types"

type SurfaceSidebarHeroMember = {
  name: string
}

type SurfaceSidebarHeroView = {
  avatarImageUrl?: string | null
  avatarUrl?: string | null
  isFormerMember?: boolean
  name?: string | null
  status?: UserStatus | null
} | null

export function getSurfaceSidebarHeroDisplay({
  heroMember,
  heroView,
  title,
}: {
  heroMember: SurfaceSidebarHeroMember
  heroView: SurfaceSidebarHeroView
  title: string
}) {
  if (!heroView) {
    return {
      avatarImageUrl: undefined,
      avatarUrl: undefined,
      name: heroMember.name,
      showStatus: true,
      status: undefined,
      title: heroMember.name ?? title,
    }
  }

  const name = heroView.name ?? heroMember.name

  return {
    avatarImageUrl: heroView.avatarImageUrl,
    avatarUrl: heroView.avatarUrl,
    name,
    showStatus: !heroView.isFormerMember,
    status: heroView.status ?? undefined,
    title: name ?? title,
  }
}

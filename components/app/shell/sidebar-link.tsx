"use client"

import Link from "next/link"

import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function SidebarLink({
  href,
  icon,
  label,
  active,
  badge,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active: boolean
  badge?: string
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}>
        <Link href={href}>
          {icon}
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
      {badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null}
    </SidebarMenuItem>
  )
}

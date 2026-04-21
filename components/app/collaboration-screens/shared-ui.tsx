"use client"

import { type ReactNode } from "react"
import { Hash, UsersThree } from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import {
  getConversationParticipants,
  hasWorkspaceAccessInCollections,
} from "@/lib/domain/selectors"
import { buildWorkspaceUserPresenceView } from "@/lib/domain/workspace-user-presence"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
import { UserAvatar, UserHoverCard } from "@/components/app/user-presence"
import { Button } from "@/components/ui/button"
import { CollapsibleRightSidebar } from "@/components/ui/collapsible-right-sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center",
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        {icon ?? <Hash className="size-5 text-muted-foreground" />}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      {action ?? null}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="size-5 shrink-0" />
        <h1 className="truncate text-sm font-medium">{title}</h1>
        {subtitle ? (
          <span className="hidden truncate text-xs text-muted-foreground xl:inline">
            — {subtitle}
          </span>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      ) : null}
    </div>
  )
}

export function SurfaceSidebarContent({
  label,
  title,
  description,
  members,
  heroMember,
}: {
  label?: string
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
  heroMember?: ReturnType<typeof getConversationParticipants>[number] | null
}) {
  const {
    currentUserId,
    currentWorkspaceId,
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
  } = useAppStore(
    useShallow((state) => ({
      currentUserId: state.currentUserId,
      currentWorkspaceId: state.currentWorkspaceId,
      workspaces: state.workspaces,
      workspaceMemberships: state.workspaceMemberships,
      teams: state.teams,
      teamMemberships: state.teamMemberships,
    }))
  )

  const heroView = heroMember
    ? buildWorkspaceUserPresenceView(
        heroMember,
        !currentWorkspaceId
          ? "unknown"
          : hasWorkspaceAccessInCollections(
                workspaces,
                workspaceMemberships,
                teams,
                teamMemberships,
                currentWorkspaceId,
                heroMember.id
              )
            ? "active"
            : "former"
      )
    : null

  return (
    <div className="flex flex-col">
      <div className="border-b border-line-soft px-4 py-3.5">
        <h3 className="text-[11px] font-semibold tracking-[0.06em] text-fg-3 uppercase">
          {label ?? (heroMember ? "Details" : "About")}
        </h3>
      </div>

      {heroMember ? (
        <div className="flex flex-col items-center gap-2 border-b border-line-soft px-4 py-5 text-center">
          <UserAvatar
            name={heroView?.name ?? heroMember.name}
            avatarImageUrl={heroView?.avatarImageUrl}
            avatarUrl={heroView?.avatarUrl}
            status={heroView?.status ?? undefined}
            showStatus={!heroView?.isFormerMember}
            size="lg"
            className="size-14 text-[18px]"
          />
          <div>
            <div className="text-[15px] font-semibold text-foreground">
              {heroView?.name ?? heroMember.name ?? title}
            </div>
            {description ? (
              <div className="mt-0.5 text-[12px] text-fg-3">
                {description}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="border-b border-line-soft px-4 py-3.5">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          {description ? (
            <p className="mt-1 text-[12px] leading-relaxed text-fg-3">
              {description}
            </p>
          ) : null}
        </div>
      )}

      <div className="px-4 py-3.5">
        <h4 className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-fg-3 uppercase">
          Members · {members.length}
        </h4>
        <div className="flex flex-col gap-0.5">
          {members.map((member) => {
            const displayMember = buildWorkspaceUserPresenceView(
              member,
              !currentWorkspaceId
                ? "unknown"
                : hasWorkspaceAccessInCollections(
                      workspaces,
                      workspaceMemberships,
                      teams,
                      teamMemberships,
                      currentWorkspaceId,
                      member.id
                    )
                  ? "active"
                  : "former"
            )
            const isSelf = member.id === currentUserId

            return (
              <UserHoverCard
                key={member.id}
                user={member}
                side="left"
                userId={member.id}
                currentUserId={currentUserId}
                workspaceId={currentWorkspaceId}
              >
                <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1 text-[12.5px] transition-colors hover:bg-surface-2">
                  <div className="shrink-0">
                    <UserAvatar
                      name={displayMember?.name ?? member.name}
                      avatarImageUrl={displayMember?.avatarImageUrl}
                      avatarUrl={displayMember?.avatarUrl}
                      status={displayMember?.status ?? undefined}
                      showStatus={!displayMember?.isFormerMember}
                      size="sm"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] text-foreground">
                      {displayMember?.name ?? member.name}
                    </div>
                    {displayMember?.secondaryText ? (
                      <div className="truncate text-[11px] text-fg-3">
                        {displayMember.secondaryText}
                      </div>
                    ) : null}
                  </div>
                  {isSelf ? (
                    <span className="shrink-0 text-[11px] text-fg-3">You</span>
                  ) : null}
                </div>
              </UserHoverCard>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function MembersSidebar({
  open,
  title,
  description,
  members,
  heroMember,
}: {
  open: boolean
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
  heroMember?: ReturnType<typeof getConversationParticipants>[number] | null
}) {
  return (
    <CollapsibleRightSidebar
      open={open}
      width="17.5rem"
      containerClassName="hidden xl:block"
      className="border-sidebar-border bg-sidebar"
    >
      <ScrollArea className="min-h-0 flex-1">
        <SurfaceSidebarContent
          title={title}
          description={description}
          members={members}
          heroMember={heroMember}
        />
      </ScrollArea>
    </CollapsibleRightSidebar>
  )
}

export function TeamSurfaceSidebar({
  open,
  label,
  title,
  description,
  members,
}: {
  open: boolean
  label: string
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
}) {
  return (
    <CollapsibleRightSidebar
      open={open}
      width="18rem"
      containerClassName="hidden xl:block"
      className="border-sidebar-border bg-sidebar"
    >
      <ScrollArea className="min-h-0 flex-1">
        <SurfaceSidebarContent
          label={label}
          title={title}
          description={description}
          members={members}
        />
      </ScrollArea>
    </CollapsibleRightSidebar>
  )
}

export function DetailsSidebarToggle({
  sidebarOpen,
  onDesktopToggle,
  onMobileOpen,
}: {
  sidebarOpen: boolean
  onDesktopToggle: () => void
  onMobileOpen: () => void
}) {
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1.5 text-xs xl:hidden"
        onClick={onMobileOpen}
      >
        <UsersThree className="size-3.5" />
        Details
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="hidden h-7 gap-1.5 text-xs xl:inline-flex"
        onClick={onDesktopToggle}
      >
        <UsersThree className="size-3.5" />
        {sidebarOpen ? "Hide details" : "Show details"}
      </Button>
    </>
  )
}

export function ChatHeaderActions({
  videoAction,
  detailsAction,
}: {
  videoAction?: ReactNode
  detailsAction?: ReactNode
}) {
  return (
    <>
      {videoAction ?? null}
      {detailsAction ?? null}
    </>
  )
}

"use client"

import { type ReactNode } from "react"
import { Hash, UsersThree } from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import { getConversationParticipants } from "@/lib/domain/selectors"
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
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-4">
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
}: {
  label?: string
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
}) {
  const { currentUserId, currentWorkspaceId } = useAppStore(
    useShallow((state) => ({
      currentUserId: state.currentUserId,
      currentWorkspaceId: state.currentWorkspaceId,
    }))
  )

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className={cn(!label && "border-b pb-4")}>
        {label ? (
          <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {label}
          </h3>
        ) : null}
        <p className={cn("text-sm font-medium", label && "mt-2")}>{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <div className={cn(!label && "pt-0.5")}>
        <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Members · {members.length}
        </h3>
        <div className="mt-3 flex flex-col gap-0.5">
          {members.map((member) => (
            <UserHoverCard
              key={member.id}
              user={member}
              side="left"
              userId={member.id}
              currentUserId={currentUserId}
              workspaceId={currentWorkspaceId}
            >
              <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/50">
                <div className="shrink-0">
                  <UserAvatar
                    name={member.name}
                    avatarImageUrl={member.avatarImageUrl}
                    avatarUrl={member.avatarUrl}
                    status={member.status}
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm">{member.name}</div>
                  {member.title ? (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {member.title}
                    </div>
                  ) : null}
                </div>
              </div>
            </UserHoverCard>
          ))}
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
}: {
  open: boolean
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
}) {
  return (
    <CollapsibleRightSidebar
      open={open}
      width="16rem"
      containerClassName="hidden xl:block"
    >
      <ScrollArea className="min-h-0 flex-1">
        <SurfaceSidebarContent
          title={title}
          description={description}
          members={members}
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
      width="19rem"
      containerClassName="hidden xl:block"
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

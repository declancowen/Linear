"use client"

import {
  useEffect,
  useState,
} from "react"
import {
  Hash,
  PaperPlaneTilt,
} from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import {
  canEditTeam,
  getChannelPosts,
  getConversationParticipants,
  getCurrentWorkspace,
  getPrimaryTeamChannel,
  getPrimaryWorkspaceChannel,
  getTeamBySlug,
  getTeamChannels,
  getTeamChatConversation,
  getWorkspaceChannels,
  teamHasFeature,
} from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import {
  ForumPostCard,
  NewPostComposer,
} from "@/components/app/collaboration-screens/channel-ui"
import { CallInviteLauncher } from "@/components/app/collaboration-screens/call-invite-launcher"
import { ChatThread } from "@/components/app/collaboration-screens/chat-thread"
import {
  ChatHeaderActions,
  DetailsSidebarToggle,
  EmptyState,
  PageHeader,
  SurfaceSidebarContent,
  TeamSurfaceSidebar,
} from "@/components/app/collaboration-screens/shared-ui"
export { WorkspaceChatsScreen } from "@/components/app/collaboration-screens/workspace-chats-screen"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
/* ------------------------------------------------------------------ */
/*  Screen: Workspace channel                                          */
/* ------------------------------------------------------------------ */

export function WorkspaceChannelsScreen() {
  const workspace = useAppStore((state) => getCurrentWorkspace(state))
  const channels = useAppStore(
    useShallow((state) =>
      workspace ? getWorkspaceChannels(state, workspace.id) : []
    )
  )
  const activeChannel = useAppStore((state) =>
    workspace ? getPrimaryWorkspaceChannel(state, workspace.id) : null
  )
  const posts = useAppStore(
    useShallow((state) =>
      channels
        .flatMap((channel) => getChannelPosts(state, channel.id))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    )
  )
  const members = useAppStore(
    useShallow((state) =>
      activeChannel ? getConversationParticipants(state, activeChannel) : []
    )
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const workspaceDescription =
    workspace?.settings.description ||
    "Forum-style updates, questions, and threaded decisions for the entire workspace."

  useEffect(() => {
    if (!workspace || activeChannel) {
      return
    }

    useAppStore.getState().createChannel({
      workspaceId: workspace.id,
      silent: true,
      title: "",
      description: "",
    })
  }, [activeChannel, workspace])

  if (!workspace) {
    return (
      <EmptyState
        title="Workspace not found"
        description="Select a workspace first."
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <PageHeader
        title="Channel"
        subtitle="Workspace-wide updates"
        actions={
          <DetailsSidebarToggle
            sidebarOpen={sidebarOpen}
            onDesktopToggle={() => setSidebarOpen((current) => !current)}
            onMobileOpen={() => setMobileSidebarOpen(true)}
          />
        }
      />
      {!activeChannel ? (
        <EmptyState
          title="Setting up workspace channel"
          description="The shared workspace channel is being created automatically."
        />
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="relative z-30 shrink-0 border-b bg-background/95 backdrop-blur">
              <div className="mx-auto max-w-3xl overflow-visible px-5 py-4">
                <NewPostComposer channelId={activeChannel.id} />
              </div>
            </div>
            <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="mx-auto max-w-3xl px-5 py-5">
                {posts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                      <Hash className="size-5 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-sm font-medium">No posts yet</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      Start a workspace discussion by creating the first post.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <ForumPostCard key={post.id} postId={post.id} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <TeamSurfaceSidebar
            open={sidebarOpen}
            label="Workspace channel"
            title={workspace.name}
            description={workspaceDescription}
            members={members}
          />
        </div>
      )}

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="right" className="w-full max-w-sm p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{workspace.name}</SheetTitle>
            <SheetDescription>Channel details</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <SurfaceSidebarContent
              label="Workspace channel"
              title={workspace.name}
              description={workspaceDescription}
              members={members}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Screen: Team chat                                                  */
/* ------------------------------------------------------------------ */

export function TeamChatScreen({ teamSlug }: { teamSlug: string }) {
  const team = useAppStore((state) => getTeamBySlug(state, teamSlug))
  const editable = useAppStore((state) =>
    team ? canEditTeam(state, team.id) : false
  )
  const conversation = useAppStore((state) =>
    team ? getTeamChatConversation(state, team.id) : null
  )
  const members = useAppStore(
    useShallow((state) =>
      team ? getConversationParticipants(state, conversation) : []
    )
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const teamDescription =
    team?.settings.summary ||
    `One live conversation for everyone working in ${team?.name ?? "this team"}.`

  useEffect(() => {
    if (!team || !teamHasFeature(team, "chat") || !editable || conversation) {
      return
    }

    useAppStore.getState().ensureTeamChat({
      teamId: team.id,
      title: "",
      description: "",
    })
  }, [conversation, editable, team])

  if (!team) {
    return (
      <EmptyState
        title="Team not found"
        description="The requested team does not exist."
        icon={<PaperPlaneTilt className="size-5 text-muted-foreground" />}
      />
    )
  }

  if (!teamHasFeature(team, "chat")) {
    return (
      <EmptyState
        title="Chat is disabled"
        description={`${team.name} is currently configured without team chat.`}
        icon={<PaperPlaneTilt className="size-5 text-muted-foreground" />}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <PageHeader
        title={team.name}
        subtitle="Chat"
        actions={
          <ChatHeaderActions
            detailsAction={
              <DetailsSidebarToggle
                sidebarOpen={sidebarOpen}
                onDesktopToggle={() => setSidebarOpen((current) => !current)}
                onMobileOpen={() => setMobileSidebarOpen(true)}
              />
            }
          />
        }
      />
      {!conversation ? (
        <EmptyState
          title={editable ? "Setting up team chat" : "Team chat unavailable"}
          description={
            editable
              ? "The shared team chat is created automatically for this team space."
              : "An admin needs to finish setting up the shared team chat."
          }
          icon={<PaperPlaneTilt className="size-5 text-muted-foreground" />}
        />
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ChatThread
              conversationId={conversation.id}
              title="Team chat"
              description=""
              members={members}
              showHeader={false}
              videoAction={
                editable ? (
                  <CallInviteLauncher conversationId={conversation.id} />
                ) : null
              }
            />
          </div>
          <TeamSurfaceSidebar
            open={sidebarOpen}
            label="Team chat"
            title={team.name}
            description={teamDescription}
            members={members}
          />
        </div>
      )}

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="right" className="w-full max-w-sm p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{team.name}</SheetTitle>
            <SheetDescription>Team chat details</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <SurfaceSidebarContent
              label="Team chat"
              title={team.name}
              description={teamDescription}
              members={members}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Screen: Team channels (forum layout)                               */
/* ------------------------------------------------------------------ */

export function TeamChannelsScreen({ teamSlug }: { teamSlug: string }) {
  const team = useAppStore((state) => getTeamBySlug(state, teamSlug))
  const channels = useAppStore(
    useShallow((state) => (team ? getTeamChannels(state, team.id) : []))
  )
  const editable = useAppStore((state) =>
    team ? canEditTeam(state, team.id) : false
  )
  const activeChannel = useAppStore((state) =>
    team ? getPrimaryTeamChannel(state, team.id) : null
  )
  const members = useAppStore(
    useShallow((state) =>
      activeChannel ? getConversationParticipants(state, activeChannel) : []
    )
  )
  const posts = useAppStore(
    useShallow((state) =>
      channels
        .flatMap((channel) => getChannelPosts(state, channel.id))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    )
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const teamDescription =
    team?.settings.summary ||
    `Forum-style updates, questions, and threaded decisions for ${team?.name ?? "this team"}.`

  useEffect(() => {
    if (
      !team ||
      !teamHasFeature(team, "channels") ||
      !editable ||
      activeChannel
    )
      return
    useAppStore.getState().createChannel({
      teamId: team.id,
      silent: true,
      title: "",
      description: "",
    })
  }, [activeChannel, editable, team])

  if (!team) {
    return (
      <EmptyState
        title="Team not found"
        description="The requested team does not exist."
      />
    )
  }

  if (!teamHasFeature(team, "channels")) {
    return (
      <EmptyState
        title="Channel is disabled"
        description={`${team.name} is currently configured without a forum-style channel.`}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <PageHeader
        title={team.name}
        subtitle="Channel"
        actions={
          <DetailsSidebarToggle
            sidebarOpen={sidebarOpen}
            onDesktopToggle={() => setSidebarOpen((current) => !current)}
            onMobileOpen={() => setMobileSidebarOpen(true)}
          />
        }
      />
      {!activeChannel ? (
        <EmptyState
          title={editable ? "Setting up channel" : "Channel unavailable"}
          description={
            editable
              ? "The team channel is being created automatically."
              : "An admin needs to set up the team channel."
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {editable ? (
              <div className="relative z-30 shrink-0 border-b bg-background/95 backdrop-blur">
                <div className="mx-auto max-w-3xl overflow-visible px-5 py-4">
                  <NewPostComposer channelId={activeChannel.id} />
                </div>
              </div>
            ) : null}
            <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="mx-auto max-w-3xl px-5 py-5">
                {posts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                      <Hash className="size-5 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-sm font-medium">No posts yet</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      Start a discussion by creating the first post.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <ForumPostCard key={post.id} postId={post.id} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <TeamSurfaceSidebar
            open={sidebarOpen}
            label="Team channel"
            title={team.name}
            description={teamDescription}
            members={members}
          />
        </div>
      )}

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="right" className="w-full max-w-sm p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{team.name}</SheetTitle>
            <SheetDescription>Channel details</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <SurfaceSidebarContent
              label="Team channel"
              title={team.name}
              description={teamDescription}
              members={members}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}

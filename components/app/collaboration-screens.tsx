"use client"

import { useEffect, useState } from "react"
import { Hash, PaperPlaneTilt } from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import {
  canEditTeam,
  getChannelPosts,
  getConversationParticipants,
  getCurrentWorkspace,
  getPrimaryTeamChannel,
  getPrimaryWorkspaceChannel,
  getTeamChannels,
  getTeamChatConversation,
  getWorkspaceChannels,
  teamHasFeature,
} from "@/lib/domain/selectors"
import {
  fetchChannelFeedReadModel,
  fetchConversationListReadModel,
  fetchConversationThreadReadModel,
} from "@/lib/convex/client"
import { useRetainedTeamBySlug } from "@/hooks/use-retained-team-by-slug"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import {
  getChannelFeedScopeKeys,
  getConversationListScopeKeys,
  getConversationThreadScopeKeys,
} from "@/lib/scoped-sync/read-models"
import type { AppData } from "@/lib/domain/types"
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

function CollaborationDetailsSheet({
  description,
  label,
  members,
  open,
  sheetDescription,
  title,
  onOpenChange,
}: {
  description: string
  label: string
  members: AppData["users"]
  open: boolean
  sheetDescription: string
  title: string
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm p-0">
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{sheetDescription}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <SurfaceSidebarContent
            label={label}
            title={title}
            description={description}
            members={members}
          />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function WorkspaceChannelPosts({
  hasLoadedChannelFeed,
  posts,
}: {
  hasLoadedChannelFeed: boolean
  posts: AppData["channelPosts"]
}) {
  if (!hasLoadedChannelFeed && posts.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Loading posts...
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Hash className="size-5 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm font-medium">No posts yet</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Start a workspace discussion by creating the first post.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <ForumPostCard key={post.id} postId={post.id} />
      ))}
    </div>
  )
}

function WorkspaceChannelBody({
  activeChannel,
  hasLoadedChannelFeed,
  hasLoadedConversationList,
  members,
  posts,
  sidebarOpen,
  workspace,
  workspaceDescription,
}: {
  activeChannel: AppData["conversations"][number] | null
  hasLoadedChannelFeed: boolean
  hasLoadedConversationList: boolean
  members: AppData["users"]
  posts: AppData["channelPosts"]
  sidebarOpen: boolean
  workspace: AppData["workspaces"][number]
  workspaceDescription: string
}) {
  if (!hasLoadedConversationList && !activeChannel) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-20 text-sm text-muted-foreground">
        Loading channel...
      </div>
    )
  }

  if (!activeChannel) {
    return (
      <EmptyState
        title="Setting up workspace channel"
        description="The shared workspace channel is being created automatically."
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative z-30 shrink-0 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto max-w-3xl overflow-visible px-5 py-4">
            <NewPostComposer channelId={activeChannel.id} />
          </div>
        </div>
        <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-3xl px-5 py-5">
            <WorkspaceChannelPosts
              hasLoadedChannelFeed={hasLoadedChannelFeed}
              posts={posts}
            />
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
  )
}

export function WorkspaceChannelsScreen() {
  const currentUserId = useAppStore((state) => state.currentUserId)
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
  const { hasLoadedOnce: hasLoadedConversationList } =
    useScopedReadModelRefresh({
      enabled: Boolean(currentUserId),
      scopeKeys: currentUserId
        ? getConversationListScopeKeys(currentUserId)
        : [],
      fetchLatest: () => fetchConversationListReadModel(currentUserId ?? ""),
    })
  const { hasLoadedOnce: hasLoadedChannelFeed } = useScopedReadModelRefresh({
    enabled: Boolean(activeChannel?.id),
    scopeKeys: activeChannel ? getChannelFeedScopeKeys(activeChannel.id) : [],
    fetchLatest: () => fetchChannelFeedReadModel(activeChannel?.id ?? ""),
  })
  const workspaceDescription =
    workspace?.settings.description ||
    "Forum-style updates, questions, and threaded decisions for the entire workspace."

  useEffect(() => {
    if (!workspace || activeChannel || !hasLoadedConversationList) {
      return
    }

    useAppStore.getState().createChannel({
      workspaceId: workspace.id,
      silent: true,
      title: "",
      description: "",
    })
  }, [activeChannel, hasLoadedConversationList, workspace])

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
      <WorkspaceChannelBody
        activeChannel={activeChannel}
        hasLoadedChannelFeed={hasLoadedChannelFeed}
        hasLoadedConversationList={hasLoadedConversationList}
        members={members}
        posts={posts}
        sidebarOpen={sidebarOpen}
        workspace={workspace}
        workspaceDescription={workspaceDescription}
      />

      <CollaborationDetailsSheet
        open={mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
        label="Workspace channel"
        title={workspace.name}
        description={workspaceDescription}
        sheetDescription="Channel details"
        members={members}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Screen: Team chat                                                  */
/* ------------------------------------------------------------------ */

function TeamChatBody({
  conversation,
  editable,
  hasLoadedConversationList,
  hasLoadedConversationThread,
  members,
  sidebarOpen,
  team,
  teamDescription,
}: {
  conversation: AppData["conversations"][number] | null
  editable: boolean
  hasLoadedConversationList: boolean
  hasLoadedConversationThread: boolean
  members: AppData["users"]
  sidebarOpen: boolean
  team: AppData["teams"][number]
  teamDescription: string
}) {
  if (!hasLoadedConversationList && !conversation) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-20 text-sm text-muted-foreground">
        Loading team chat...
      </div>
    )
  }

  if (!conversation) {
    return (
      <EmptyState
        title={editable ? "Setting up team chat" : "Team chat unavailable"}
        description={
          editable
            ? "The shared team chat is created automatically for this team space."
            : "An admin needs to finish setting up the shared team chat."
        }
        icon={<PaperPlaneTilt className="size-5 text-muted-foreground" />}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ChatThread
          conversationId={conversation.id}
          title="Team chat"
          description=""
          members={members}
          loaded={hasLoadedConversationThread}
          showHeader={false}
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
  )
}

export function TeamChatScreen({ teamSlug }: { teamSlug: string }) {
  const currentUserId = useAppStore((state) => state.currentUserId)
  const { liveTeam, team } = useRetainedTeamBySlug(teamSlug)
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
  const { hasLoadedOnce: hasLoadedConversationList } =
    useScopedReadModelRefresh({
      enabled: Boolean(currentUserId),
      scopeKeys: currentUserId
        ? getConversationListScopeKeys(currentUserId)
        : [],
      fetchLatest: () => fetchConversationListReadModel(currentUserId ?? ""),
    })
  const { hasLoadedOnce: hasLoadedConversationThread } =
    useScopedReadModelRefresh({
      enabled: Boolean(conversation?.id),
      scopeKeys: conversation
        ? getConversationThreadScopeKeys(conversation.id)
        : [],
      fetchLatest: () =>
        fetchConversationThreadReadModel(conversation?.id ?? ""),
    })
  const teamDescription =
    team?.settings.summary ||
    `One live conversation for everyone working in ${team?.name ?? "this team"}.`

  useEffect(() => {
    if (
      !liveTeam ||
      !teamHasFeature(liveTeam, "chat") ||
      !editable ||
      conversation ||
      !hasLoadedConversationList
    ) {
      return
    }

    useAppStore.getState().ensureTeamChat({
      teamId: liveTeam.id,
      title: "",
      description: "",
    })
  }, [conversation, editable, hasLoadedConversationList, liveTeam])

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
            videoAction={
              editable && conversation ? (
                <CallInviteLauncher conversationId={conversation.id} />
              ) : null
            }
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
      <TeamChatBody
        conversation={conversation}
        editable={editable}
        hasLoadedConversationList={hasLoadedConversationList}
        hasLoadedConversationThread={hasLoadedConversationThread}
        members={members}
        sidebarOpen={sidebarOpen}
        team={team}
        teamDescription={teamDescription}
      />

      <CollaborationDetailsSheet
        open={mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
        label="Team chat"
        title={team.name}
        description={teamDescription}
        sheetDescription="Team chat details"
        members={members}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Screen: Team channels (forum layout)                               */
/* ------------------------------------------------------------------ */

type ChannelConversation = AppData["conversations"][number]
type ChannelPost = AppData["channelPosts"][number]
type TeamMember = AppData["users"][number]
type TeamRecord = AppData["teams"][number]

function ChannelPostsState({
  emptyDescription,
  hasLoadedChannelFeed,
  posts,
}: {
  emptyDescription: string
  hasLoadedChannelFeed: boolean
  posts: ChannelPost[]
}) {
  if (!hasLoadedChannelFeed && posts.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Loading posts...
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Hash className="size-5 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm font-medium">No posts yet</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          {emptyDescription}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <ForumPostCard key={post.id} postId={post.id} />
      ))}
    </div>
  )
}

function TeamChannelPostSurface({
  activeChannel,
  editable,
  hasLoadedChannelFeed,
  posts,
}: {
  activeChannel: ChannelConversation
  editable: boolean
  hasLoadedChannelFeed: boolean
  posts: ChannelPost[]
}) {
  return (
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
          <ChannelPostsState
            emptyDescription="Start a discussion by creating the first post."
            hasLoadedChannelFeed={hasLoadedChannelFeed}
            posts={posts}
          />
        </div>
      </div>
    </div>
  )
}

function TeamChannelBody({
  activeChannel,
  editable,
  hasLoadedChannelFeed,
  hasLoadedConversationList,
  members,
  posts,
  sidebarOpen,
  team,
  teamDescription,
}: {
  activeChannel: ChannelConversation | null
  editable: boolean
  hasLoadedChannelFeed: boolean
  hasLoadedConversationList: boolean
  members: TeamMember[]
  posts: ChannelPost[]
  sidebarOpen: boolean
  team: TeamRecord
  teamDescription: string
}) {
  if (!hasLoadedConversationList && !activeChannel) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-20 text-sm text-muted-foreground">
        Loading channel...
      </div>
    )
  }

  if (!activeChannel) {
    return (
      <EmptyState
        title={editable ? "Setting up channel" : "Channel unavailable"}
        description={
          editable
            ? "The team channel is being created automatically."
            : "An admin needs to set up the team channel."
        }
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <TeamChannelPostSurface
        activeChannel={activeChannel}
        editable={editable}
        hasLoadedChannelFeed={hasLoadedChannelFeed}
        posts={posts}
      />
      <TeamSurfaceSidebar
        open={sidebarOpen}
        label="Team channel"
        title={team.name}
        description={teamDescription}
        members={members}
      />
    </div>
  )
}

function TeamChannelDetailsSheet({
  members,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  team,
  teamDescription,
}: {
  members: TeamMember[]
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  team: TeamRecord
  teamDescription: string
}) {
  return (
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
  )
}

export function TeamChannelsScreen({ teamSlug }: { teamSlug: string }) {
  const currentUserId = useAppStore((state) => state.currentUserId)
  const { liveTeam, team } = useRetainedTeamBySlug(teamSlug)
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
  const { hasLoadedOnce: hasLoadedConversationList } =
    useScopedReadModelRefresh({
      enabled: Boolean(currentUserId),
      scopeKeys: currentUserId
        ? getConversationListScopeKeys(currentUserId)
        : [],
      fetchLatest: () => fetchConversationListReadModel(currentUserId ?? ""),
    })
  const { hasLoadedOnce: hasLoadedChannelFeed } = useScopedReadModelRefresh({
    enabled: Boolean(activeChannel?.id),
    scopeKeys: activeChannel ? getChannelFeedScopeKeys(activeChannel.id) : [],
    fetchLatest: () => fetchChannelFeedReadModel(activeChannel?.id ?? ""),
  })
  const teamDescription =
    team?.settings.summary ||
    `Forum-style updates, questions, and threaded decisions for ${team?.name ?? "this team"}.`

  useEffect(() => {
    if (
      !liveTeam ||
      !teamHasFeature(liveTeam, "channels") ||
      !editable ||
      activeChannel ||
      !hasLoadedConversationList
    )
      return
    useAppStore.getState().createChannel({
      teamId: liveTeam.id,
      silent: true,
      title: "",
      description: "",
    })
  }, [activeChannel, editable, hasLoadedConversationList, liveTeam])

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
      <TeamChannelBody
        activeChannel={activeChannel}
        editable={editable}
        hasLoadedChannelFeed={hasLoadedChannelFeed}
        hasLoadedConversationList={hasLoadedConversationList}
        members={members}
        posts={posts}
        sidebarOpen={sidebarOpen}
        team={team}
        teamDescription={teamDescription}
      />
      <TeamChannelDetailsSheet
        members={members}
        mobileSidebarOpen={mobileSidebarOpen}
        setMobileSidebarOpen={setMobileSidebarOpen}
        team={team}
        teamDescription={teamDescription}
      />
    </div>
  )
}

import type { AppData } from "@/lib/domain/types"

export function createEmptyState(): AppData {
  return {
    currentUserId: "",
    currentWorkspaceId: "",
    workspaces: [],
    teams: [],
    teamMemberships: [],
    users: [],
    labels: [],
    projects: [],
    milestones: [],
    workItems: [],
    documents: [],
    views: [],
    comments: [],
    attachments: [],
    notifications: [],
    invites: [],
    projectUpdates: [],
    conversations: [],
    calls: [],
    chatMessages: [],
    channelPosts: [],
    channelPostComments: [],
    ui: {
      activeTeamId: "",
      activeInboxNotificationId: null,
      selectedViewByRoute: {},
    },
  }
}

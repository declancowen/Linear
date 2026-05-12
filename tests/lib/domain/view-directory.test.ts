import { describe, expect, it } from "vitest"

import {
  getChannelPostHref,
  getConversationHref,
  getTeamSurfaceDisableReason,
  getViewContextLabel,
  getWorkspaceDirectoryViews,
} from "@/lib/domain/selectors"
import {
  createTestDocument,
  createTestWorkspaceDirectoryAppData,
  createTestWorkspaceDirectoryView,
  createTestWorkspaceDirectoryViews,
} from "@/tests/lib/fixtures/app-data"
import type { AppData } from "@/lib/domain/types"

const TEST_TIMESTAMP = "2026-04-18T10:00:00.000Z"

type TestConversation = AppData["conversations"][number]
type TestChannelPost = AppData["channelPosts"][number]

function createWorkspaceState() {
  return createTestWorkspaceDirectoryAppData({
    views: [],
  })
}

function createTestConversation(
  overrides: Partial<TestConversation> = {}
): TestConversation {
  return {
    id: "conversation_1",
    kind: "chat",
    scopeType: "team",
    scopeId: "team_1",
    variant: "team",
    title: "Conversation",
    description: "",
    participantIds: ["user_1"],
    roomId: null,
    roomName: null,
    createdBy: "user_1",
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    lastActivityAt: TEST_TIMESTAMP,
    ...overrides,
  }
}

function createTestChannelPost(
  overrides: Partial<TestChannelPost> = {}
): TestChannelPost {
  return {
    id: "post_1",
    conversationId: "conversation_channel",
    title: "Update",
    content: "Status update",
    mentionUserIds: [],
    reactions: [],
    createdBy: "user_1",
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    ...overrides,
  }
}

describe("workspace view directory", () => {
  it("aggregates workspace and accessible team views without treating them as separate inventories", () => {
    const state = createWorkspaceState()

    state.views = createTestWorkspaceDirectoryViews()

    expect(
      getWorkspaceDirectoryViews(state, "workspace_1", "projects")
        .map((view) => view.id)
        .sort()
    ).toEqual(["legacy-view", "team-view", "workspace-view"])
  })

  it("labels aggregated views by their real scope", () => {
    const state = createWorkspaceState()
    const workspaceView = createTestWorkspaceDirectoryView({
      id: "workspace-view",
      scopeType: "workspace",
      scopeId: "workspace_1",
      route: "/workspace/projects",
    })
    const teamView = createTestWorkspaceDirectoryView({
      id: "team-view",
      scopeType: "team",
      scopeId: "team_1",
      route: "/team/platform/work",
    })
    const legacyView = createTestWorkspaceDirectoryView({
      id: "legacy-view",
      scopeType: "personal",
      scopeId: "user_1",
      isShared: false,
      route: "/workspace/docs",
    })

    expect(getViewContextLabel(state, workspaceView)).toBe("Acme")
    expect(getViewContextLabel(state, teamView)).toBe("Platform")
    expect(getViewContextLabel(state, legacyView)).toBe("Acme")
  })

  it("falls back to personal and generic context labels when scope records are unavailable", () => {
    const state = createWorkspaceState()
    const personalView = createTestWorkspaceDirectoryView({
      id: "personal-view",
      scopeType: "personal",
      scopeId: "user_1",
      route: "/assigned",
    })
    const missingTeamView = createTestWorkspaceDirectoryView({
      id: "missing-team-view",
      scopeType: "team",
      scopeId: "missing_team",
    })
    const missingWorkspaceView = createTestWorkspaceDirectoryView({
      id: "missing-workspace-view",
      scopeType: "workspace",
      scopeId: "missing_workspace",
    })

    expect(getViewContextLabel(state, personalView)).toBe("Personal")
    expect(getViewContextLabel(state, missingTeamView)).toBe("Team")
    expect(getViewContextLabel(state, missingWorkspaceView)).toBe("Workspace")
  })

  it("explains why enabled team surfaces cannot be disabled", () => {
    const state = createWorkspaceState()

    state.documents = [createTestDocument()]
    state.conversations = [
      createTestConversation({
        id: "conversation_chat",
        kind: "chat",
        title: "Team chat",
      }),
      createTestConversation({
        id: "conversation_channel",
        kind: "channel",
        title: "Team channel",
      }),
    ]
    state.chatMessages = [
      {
        id: "message_1",
        conversationId: "conversation_chat",
        kind: "text",
        content: "Hello",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_1",
        createdAt: TEST_TIMESTAMP,
      },
    ]
    state.channelPosts = [createTestChannelPost()]

    expect(getTeamSurfaceDisableReason(state, "team_1", "docs")).toBe(
      "Docs cannot be turned off while this team still has documents."
    )
    expect(getTeamSurfaceDisableReason(state, "team_1", "chat")).toBe(
      "Chat cannot be turned off while the team chat has messages."
    )
    expect(getTeamSurfaceDisableReason(state, "team_1", "channels")).toBe(
      "Channel cannot be turned off while posts exist."
    )
  })

  it("builds workspace and team-scoped conversation notification hrefs", () => {
    const state = createWorkspaceState()

    state.conversations = [
      createTestConversation({
        id: "workspace_chat",
        scopeType: "workspace",
        scopeId: "workspace_1",
        variant: "group",
        title: "Workspace chat",
      }),
      createTestConversation({
        id: "team_chat",
        title: "Team chat",
      }),
      createTestConversation({
        id: "team_channel",
        kind: "channel",
        title: "Team channel",
      }),
    ]
    state.channelPosts = [
      createTestChannelPost({
        conversationId: "team_channel",
      }),
    ]

    expect(getConversationHref(state, "workspace_chat")).toBe(
      "/chats?chatId=workspace_chat"
    )
    expect(getConversationHref(state, "team_chat")).toBe("/team/platform/chat")
    expect(getChannelPostHref(state, "post_1")).toBe(
      "/team/platform/channel#post_1"
    )
    expect(getConversationHref(state, "team_channel")).toBeNull()
    expect(getChannelPostHref(state, "missing_post")).toBeNull()
  })
})

"use client"

import {
  hasWorkspaceAccessInCollections,
} from "@/lib/domain/selectors"
import { buildWorkspaceUserPresenceView } from "@/lib/domain/workspace-user-presence"
import type { AppData, UserProfile, Workspace } from "@/lib/domain/types"
import { UserAvatar } from "@/components/app/user-presence"

export type WorkspaceChatAccessCollections = Pick<
  AppData,
  "workspaces" | "workspaceMemberships" | "teams" | "teamMemberships"
>

export function getWorkspaceChatParticipantView({
  accessCollections,
  participant,
  workspace,
}: {
  accessCollections: WorkspaceChatAccessCollections
  participant: UserProfile | undefined
  workspace: Workspace
}) {
  return buildWorkspaceUserPresenceView(
    participant,
    !participant
      ? "unknown"
      : hasWorkspaceAccessInCollections(
            accessCollections.workspaces,
            accessCollections.workspaceMemberships,
            accessCollections.teams,
            accessCollections.teamMemberships,
            workspace.id,
            participant.id
          )
        ? "active"
        : "former"
  )
}

export function WorkspaceChatParticipantAvatar({
  accessCollections,
  participant,
  workspace,
}: {
  accessCollections: WorkspaceChatAccessCollections
  participant: UserProfile
  workspace: Workspace
}) {
  const participantView = getWorkspaceChatParticipantView({
    accessCollections,
    participant,
    workspace,
  })

  return (
    <UserAvatar
      name={participantView?.name ?? participant.name}
      avatarImageUrl={participantView?.avatarImageUrl}
      avatarUrl={participantView?.avatarUrl}
      showStatus={false}
      size="sm"
    />
  )
}

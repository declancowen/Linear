"use client"

import { toast } from "sonner"

import {
  syncCreateTeam,
  syncDeleteCurrentWorkspace,
  syncDeleteTeam,
  syncJoinTeamByCode,
  syncLeaveWorkspace,
  syncLeaveTeam,
  syncRegenerateTeamJoinCode,
  syncRemoveTeamMember,
  syncRemoveWorkspaceUser,
  syncUpdateCurrentUserProfile,
  syncUpdateTeamDetails,
  syncUpdateTeamMemberRole,
  syncUpdateTeamWorkflowSettings,
  syncUpdateWorkspaceBranding,
} from "@/lib/convex/client"
import {
  joinCodeSchema,
  normalizeTeamFeatureSettings,
  normalizeTeamIconToken,
  profileSchema,
  teamMembershipRoleSchema,
  teamDetailsSchema,
  teamDetailsUpdateSchema,
  workspaceBrandingSchema,
} from "@/lib/domain/types"

import {
  buildLocalTeamCreateState,
  getNextStateAfterTeamRemoval,
  getNextStateAfterWorkspaceRemoval,
} from "../domain-updates"
import { createStoreRuntime } from "../runtime"
import { getTeamDetailsDisableMessage } from "../validation"
import type { AppStore, AppStoreGet, AppStoreSet } from "../types"

type WorkspaceSlice = Pick<
  AppStore,
  | "updateWorkspaceBranding"
  | "deleteCurrentWorkspace"
  | "leaveWorkspace"
  | "removeWorkspaceUser"
  | "createTeam"
  | "deleteTeam"
  | "leaveTeam"
  | "updateTeamDetails"
  | "updateTeamMemberRole"
  | "removeTeamMember"
  | "regenerateTeamJoinCode"
  | "updateCurrentUserProfile"
  | "updateCurrentUserStatus"
  | "clearCurrentUserStatus"
  | "joinTeamByCode"
  | "updateTeamWorkflowSettings"
>

export function createWorkspaceSlice(
  set: AppStoreSet,
  get: AppStoreGet,
  runtime: ReturnType<typeof createStoreRuntime>
): WorkspaceSlice {
  return {
    updateWorkspaceBranding(input) {
      const parsed = workspaceBrandingSchema.safeParse(input)
      if (!parsed.success) {
        toast.error("Workspace branding is invalid")
        return
      }

      set((state) => ({
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === state.currentWorkspaceId
            ? {
                ...workspace,
                name: parsed.data.name,
                logoUrl: parsed.data.logoUrl,
                logoImageUrl: parsed.data.clearLogoImage
                  ? null
                  : workspace.logoImageUrl,
                settings: {
                  ...workspace.settings,
                  accent: parsed.data.accent,
                  description: parsed.data.description,
                },
              }
            : workspace
        ),
      }))

      runtime.syncInBackground(
        syncUpdateWorkspaceBranding(
          get().currentWorkspaceId,
          parsed.data.name,
          parsed.data.logoUrl,
          parsed.data.accent,
          parsed.data.description,
          {
            logoImageStorageId: parsed.data.logoImageStorageId,
            clearLogoImage: parsed.data.clearLogoImage,
          }
        ),
        "Failed to update workspace"
      )

      toast.success("Workspace updated")
    },
    async deleteCurrentWorkspace() {
      const workspace = get().workspaces.find(
        (entry) => entry.id === get().currentWorkspaceId
      )

      if (!workspace) {
        toast.error("Workspace not found")
        return false
      }

      try {
        const result = await syncDeleteCurrentWorkspace()
        set((state) => ({
          ...getNextStateAfterWorkspaceRemoval(
            state,
            result.workspaceId ?? workspace.id
          ),
        }))
        toast.success("Workspace deleted")
        return true
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to delete workspace"
        )
        return false
      }
    },
    async leaveWorkspace() {
      const workspace = get().workspaces.find(
        (entry) => entry.id === get().currentWorkspaceId
      )

      if (!workspace) {
        toast.error("Workspace not found")
        return false
      }

      try {
        const result = await syncLeaveWorkspace()
        set((state) => ({
          ...getNextStateAfterWorkspaceRemoval(
            state,
            result.workspaceId ?? workspace.id
          ),
        }))
        toast.success("Left workspace")
        return true
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to leave workspace"
        )
        return false
      }
    },
    async removeWorkspaceUser(userId) {
      const currentWorkspaceId = get().currentWorkspaceId
      const previousWorkspaceMemberships = get().workspaceMemberships
      const previousMemberships = get().teamMemberships

      set((state) => {
        const workspaceTeamIds = new Set(
          state.teams
            .filter((team) => team.workspaceId === currentWorkspaceId)
            .map((team) => team.id)
        )

        return {
          workspaceMemberships: state.workspaceMemberships.filter(
            (membership) =>
              !(
                membership.workspaceId === currentWorkspaceId &&
                membership.userId === userId
              )
          ),
          teamMemberships: state.teamMemberships.filter(
            (membership) =>
              membership.userId !== userId ||
              !workspaceTeamIds.has(membership.teamId)
          ),
        }
      })

      try {
        await syncRemoveWorkspaceUser(userId)
        toast.success("Workspace user removed")
        return true
      } catch (error) {
        console.error(error)
        set({
          workspaceMemberships: previousWorkspaceMemberships,
          teamMemberships: previousMemberships,
        })
        void runtime.refreshFromServer().catch((refreshError) => {
          console.error(
            "Failed to reconcile workspace memberships after remove-user failure",
            refreshError
          )
        })

        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to remove workspace user"
        )
        return false
      }
    },
    async createTeam(input) {
      const parsed = teamDetailsSchema.safeParse({
        ...input,
        icon: normalizeTeamIconToken(input.icon, input.experience),
      })
      if (!parsed.success) {
        toast.error("Team details are invalid")
        return null
      }

      try {
        const result = await syncCreateTeam(parsed.data)

        if (!result?.teamId || !result.teamSlug) {
          throw new Error("Failed to create team")
        }

        set((state) => {
          const localTeam = buildLocalTeamCreateState({
            currentUserId: state.currentUserId,
            workspaceId: state.currentWorkspaceId,
            teamId: result.teamId,
            teamSlug: result.teamSlug,
            joinCode: result.joinCode,
            name: parsed.data.name,
            icon: parsed.data.icon,
            summary: parsed.data.summary,
            experience: parsed.data.experience,
            features: result.features,
          })
          const teams = state.teams.some((team) => team.id === result.teamId)
            ? state.teams
            : [localTeam.team, ...state.teams]
          const teamMemberships = state.teamMemberships.some(
            (membership) =>
              membership.teamId === localTeam.membership.teamId &&
              membership.userId === localTeam.membership.userId
          )
            ? state.teamMemberships
            : [localTeam.membership, ...state.teamMemberships]

          return {
            teams,
            teamMemberships,
            ui: {
              ...state.ui,
              activeTeamId: result.teamId,
            },
          }
        })
        toast.success("Team created")

        return {
          teamId: result.teamId,
          teamSlug: result.teamSlug,
          features: result.features,
        }
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to create team"
        )
        return null
      }
    },
    async deleteTeam(teamId) {
      const team = get().teams.find((entry) => entry.id === teamId)

      if (!team) {
        toast.error("Team not found")
        return false
      }

      try {
        const result = await syncDeleteTeam(teamId)
        set((state) => ({
          ...getNextStateAfterTeamRemoval(state, result.teamId ?? teamId),
        }))
        toast.success("Team deleted")
        return true
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to delete team"
        )
        return false
      }
    },
    async leaveTeam(teamId) {
      const team = get().teams.find((entry) => entry.id === teamId)

      if (!team) {
        toast.error("Team not found")
        return false
      }

      try {
        const result = await syncLeaveTeam(teamId)
        set((state) => ({
          ...(result.workspaceAccessRemoved && result.workspaceId
            ? getNextStateAfterWorkspaceRemoval(
                state,
                result.workspaceId
              )
            : getNextStateAfterTeamRemoval(state, result.teamId ?? teamId)),
        }))
        toast.success("Left team")
        return true
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to leave team"
        )
        return false
      }
    },
    async updateTeamMemberRole(teamId, userId, input) {
      const parsed = teamMembershipRoleSchema.safeParse(input)

      if (!parsed.success) {
        toast.error("Team role is invalid")
        return false
      }

      const membership = get().teamMemberships.find(
        (entry) => entry.teamId === teamId && entry.userId === userId
      )

      if (!membership) {
        toast.error("Team member not found")
        return false
      }

      if (membership.role === parsed.data.role) {
        return true
      }

      const previousMemberships = get().teamMemberships

      set((state) => ({
        teamMemberships: state.teamMemberships.map((entry) =>
          entry.teamId === teamId && entry.userId === userId
            ? {
                ...entry,
                role: parsed.data.role,
              }
            : entry
        ),
      }))

      try {
        await syncUpdateTeamMemberRole(teamId, userId, parsed.data.role)
        toast.success("Team member updated")
        return true
      } catch (error) {
        console.error(error)
        set({
          teamMemberships: previousMemberships,
        })
        void runtime.refreshFromServer().catch((refreshError) => {
          console.error(
            "Failed to reconcile team memberships after role update failure",
            refreshError
          )
        })

        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update team member"
        )
        return false
      }
    },
    async removeTeamMember(teamId, userId) {
      const membership = get().teamMemberships.find(
        (entry) => entry.teamId === teamId && entry.userId === userId
      )

      if (!membership) {
        toast.error("Team member not found")
        return false
      }

      const previousMemberships = get().teamMemberships

      set((state) => ({
        teamMemberships: state.teamMemberships.filter(
          (entry) => !(entry.teamId === teamId && entry.userId === userId)
        ),
      }))

      try {
        await syncRemoveTeamMember(teamId, userId)
        toast.success("Team member removed")
        return true
      } catch (error) {
        console.error(error)
        set({
          teamMemberships: previousMemberships,
        })
        void runtime.refreshFromServer().catch((refreshError) => {
          console.error(
            "Failed to reconcile team memberships after remove-member failure",
            refreshError
          )
        })

        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to remove team member"
        )
        return false
      }
    },
    async updateTeamDetails(teamId, input) {
      const parsed = teamDetailsUpdateSchema.safeParse({
        ...input,
        icon: normalizeTeamIconToken(input.icon, input.experience),
      })
      if (!parsed.success) {
        toast.error("Team details are invalid")
        return false
      }

      const stateBeforeUpdate = get()
      const team = stateBeforeUpdate.teams.find((entry) => entry.id === teamId)

      if (!team) {
        toast.error("Team not found")
        return false
      }

      const nextFeatures = normalizeTeamFeatureSettings(
        parsed.data.experience,
        parsed.data.features
      )
      const shouldRefreshForNewRealtimeSurfaces =
        (!team.settings.features.chat && nextFeatures.chat) ||
        (!team.settings.features.channels && nextFeatures.channels)
      const disableMessage = getTeamDetailsDisableMessage(
        stateBeforeUpdate,
        teamId,
        nextFeatures
      )

      if (disableMessage) {
        toast.error(disableMessage)
        return false
      }

      set((state) => ({
        teams: state.teams.map((teamEntry) =>
          teamEntry.id === teamId
            ? {
                ...teamEntry,
                name: parsed.data.name,
                icon: parsed.data.icon,
                settings: {
                  ...teamEntry.settings,
                  summary: parsed.data.summary,
                  experience: parsed.data.experience,
                  features: nextFeatures,
                },
              }
            : teamEntry
        ),
      }))

      try {
        await syncUpdateTeamDetails(teamId, parsed.data)

        if (shouldRefreshForNewRealtimeSurfaces) {
          try {
            await runtime.refreshFromServer()
          } catch (refreshError) {
            console.error(
              "Failed to reconcile team conversations after enabling chat or channels",
              refreshError
            )
          }
        }

        toast.success("Team updated")
        return true
      } catch (error) {
        console.error(error)
        set((state) => ({
          teams: state.teams.map((entry) => (entry.id === teamId ? team : entry)),
        }))
        void runtime.refreshFromServer().catch((refreshError) => {
          console.error(
            "Failed to reconcile team details after update failure",
            refreshError
          )
        })

        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update team details"
        )
        return false
      }
    },
    async regenerateTeamJoinCode(teamId) {
      const team = get().teams.find((entry) => entry.id === teamId)

      if (!team) {
        toast.error("Team not found")
        return false
      }

      try {
        const result = await syncRegenerateTeamJoinCode(teamId)

        if (!result) {
          throw new Error("Failed to regenerate join code")
        }

        set((state) => ({
          teams: state.teams.map((entry) =>
            entry.id === teamId
              ? {
                  ...entry,
                  settings: {
                    ...entry.settings,
                    joinCode: result.joinCode,
                  },
                }
              : entry
          ),
        }))

        toast.success("Join code regenerated")
        return true
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to regenerate join code"
        )
        return false
      }
    },
    updateCurrentUserProfile(input) {
      const parsed = profileSchema.safeParse(input)
      if (!parsed.success) {
        toast.error("Profile details are invalid")
        return
      }

      set((state) => ({
        users: state.users.map((user) =>
          user.id === state.currentUserId
            ? {
                ...user,
                ...parsed.data,
                hasExplicitStatus: parsed.data.clearStatus
                  ? false
                  : parsed.data.status === undefined
                    ? user.hasExplicitStatus
                    : true,
                avatarImageUrl: parsed.data.clearAvatarImage
                  ? null
                  : user.avatarImageUrl,
              }
            : user
        ),
      }))

      runtime.syncInBackground(
        syncUpdateCurrentUserProfile(
          get().currentUserId,
          parsed.data.name,
          parsed.data.title,
          parsed.data.avatarUrl,
          parsed.data.preferences,
          {
            avatarImageStorageId: parsed.data.avatarImageStorageId,
            clearAvatarImage: parsed.data.clearAvatarImage,
            clearStatus: parsed.data.clearStatus,
            status: parsed.data.status,
            statusMessage: parsed.data.statusMessage,
          }
        ),
        "Failed to update profile"
      )

      toast.success("Profile updated")
    },
    updateCurrentUserStatus(input) {
      const currentUserId = get().currentUserId
      const currentUser = get().users.find((user) => user.id === currentUserId)

      if (!currentUser) {
        toast.error("Profile not found")
        return
      }

      const statusMessage = input.statusMessage.trim()

      if (
        currentUser.status === input.status &&
        currentUser.statusMessage === statusMessage
      ) {
        return
      }

      set((state) => ({
        users: state.users.map((user) =>
          user.id === currentUserId
            ? {
                ...user,
                hasExplicitStatus: true,
                status: input.status,
                statusMessage,
              }
            : user
        ),
      }))

      runtime.syncInBackground(
        syncUpdateCurrentUserProfile(
          currentUser.id,
          currentUser.name,
          currentUser.title,
          currentUser.avatarUrl,
          currentUser.preferences,
          {
            status: input.status,
            statusMessage,
          }
        ),
        "Failed to update status"
      )

      toast.success("Status updated")
    },
    clearCurrentUserStatus() {
      const currentUserId = get().currentUserId
      const currentUser = get().users.find((user) => user.id === currentUserId)

      if (!currentUser) {
        toast.error("Profile not found")
        return
      }

      if (!currentUser.hasExplicitStatus && !currentUser.statusMessage) {
        return
      }

      set((state) => ({
        users: state.users.map((user) =>
          user.id === currentUserId
            ? {
                ...user,
                hasExplicitStatus: false,
                status: "offline" as const,
                statusMessage: "",
              }
            : user
        ),
      }))

      runtime.syncInBackground(
        syncUpdateCurrentUserProfile(
          currentUser.id,
          currentUser.name,
          currentUser.title,
          currentUser.avatarUrl,
          currentUser.preferences,
          {
            clearStatus: true,
            statusMessage: "",
          }
        ),
        "Failed to clear status"
      )

      toast.success("Status cleared")
    },
    async joinTeamByCode(code) {
      const parsed = joinCodeSchema.safeParse({ code })
      if (!parsed.success) {
        toast.error("Join code is invalid")
        return false
      }

      try {
        await syncJoinTeamByCode(get().currentUserId, parsed.data.code)
        await runtime.refreshFromServer()
        toast.success("Joined team")
        return true
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to join team"
        )
        return false
      }
    },
    updateTeamWorkflowSettings(teamId, workflow) {
      set((state) => ({
        teams: state.teams.map((team) =>
          team.id === teamId
            ? {
                ...team,
                settings: {
                  ...team.settings,
                  workflow,
                },
              }
            : team
        ),
      }))

      runtime.syncInBackground(
        syncUpdateTeamWorkflowSettings(teamId, workflow),
        "Failed to update team workflow settings"
      )

      toast.success("Team workflow updated")
    },
  }
}

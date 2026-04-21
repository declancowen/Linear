"use client"

import { addDays } from "date-fns"
import { toast } from "sonner"

import { syncCancelInvite, syncCreateInvite } from "@/lib/convex/client"
import { inviteSchema } from "@/lib/domain/types"

import { createId } from "../helpers"
import { effectiveRole } from "../validation"
import type {
  CollaborationSlice,
  CollaborationSliceFactoryArgs,
} from "./collaboration-shared"

export function createCollaborationInviteActions({
  get,
  runtime,
  set,
}: CollaborationSliceFactoryArgs): Pick<
  CollaborationSlice,
  "createInvite" | "cancelInvite"
> {
  return {
    createInvite(input) {
      const parsed = inviteSchema.safeParse(input)
      if (!parsed.success) {
        toast.error("Invite is invalid")
        return
      }

      set((state) => {
        const teams = state.teams.filter((entry) =>
          parsed.data.teamIds.includes(entry.id)
        )
        if (teams.length === 0) {
          return state
        }

        const canInviteAll = teams.every((team) => {
          const role = effectiveRole(state, team.id)
          return role === "admin" || role === "member"
        })

        if (!canInviteAll) {
          toast.error("Only admins and members can invite")
          return state
        }

        const batchId = createId("invite_batch")
        const invites = teams.map((team) => ({
          id: createId("invite"),
          batchId,
          workspaceId: team.workspaceId,
          teamId: team.id,
          email: parsed.data.email,
          role: parsed.data.role,
          token: createId("token"),
          joinCode: team.settings.joinCode,
          invitedBy: state.currentUserId,
          expiresAt: addDays(new Date(), 7).toISOString(),
          acceptedAt: null,
          declinedAt: null,
        }))

        return {
          ...state,
          invites: [...invites, ...state.invites],
        }
      })

      runtime.syncInBackground(
        syncCreateInvite(
          get().currentUserId,
          parsed.data.teamIds,
          parsed.data.email,
          parsed.data.role
        ),
        "Failed to create invite"
      )

      toast.success(
        parsed.data.teamIds.length === 1
          ? "Invite created"
          : `Invites created for ${parsed.data.teamIds.length} teams`
      )
    },
    async cancelInvite(inviteId) {
      const state = get()
      const invite = state.invites.find((entry) => entry.id === inviteId)

      if (!invite) {
        toast.error("Invite not found")
        return false
      }

      const isWorkspaceOwner = state.workspaces.some(
        (workspace) =>
          workspace.id === invite.workspaceId &&
          workspace.createdBy === state.currentUserId
      )
      const workspaceRole = state.workspaceMemberships.find(
        (membership) =>
          membership.workspaceId === invite.workspaceId &&
          membership.userId === state.currentUserId
      )?.role
      const teamRole = effectiveRole(state, invite.teamId)

      if (
        !isWorkspaceOwner &&
        workspaceRole !== "admin" &&
        teamRole !== "admin"
      ) {
        toast.error("Only admins can cancel invites")
        return false
      }

      try {
        await syncCancelInvite(inviteId)

        set((current) => ({
          invites: current.invites.filter((entry) =>
            invite.batchId
              ? entry.batchId !== invite.batchId
              : entry.id !== inviteId
          ),
        }))

        toast.success("Invite cancelled")
        return true
      } catch (error) {
        await runtime.handleSyncFailure(error, "Failed to cancel invite")
        return false
      }
    },
  }
}

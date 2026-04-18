"use client"

import { createEmptyState } from "@/lib/domain/empty-state"
import type { AppData } from "@/lib/domain/types"

import {
  normalizeChannelPostComments,
  normalizeChannelPosts,
  normalizeChatMessages,
  normalizeComments,
  normalizeNotifications,
  normalizeUsers,
} from "../helpers"
import type { AppStore, AppStoreSlice } from "../types"

type UiSlice = Pick<
  AppStore,
  | "replaceDomainData"
  | "setActiveTeam"
  | "openCreateDialog"
  | "closeCreateDialog"
  | "setSelectedView"
  | "setActiveInboxNotification"
>

export function createUiSlice(
  set: Parameters<AppStoreSlice<UiSlice>>[0]
): UiSlice & AppData {
  return {
    ...createEmptyState(),
    replaceDomainData(data) {
      set((state) => ({
        ...state,
        ...data,
        users: normalizeUsers(data.users ?? state.users),
        notifications: normalizeNotifications(
          data.notifications ?? state.notifications
        ),
        comments: normalizeComments(data.comments ?? state.comments),
        chatMessages: normalizeChatMessages(
          data.chatMessages ?? state.chatMessages
        ),
        channelPosts: normalizeChannelPosts(
          data.channelPosts ?? state.channelPosts
        ),
        channelPostComments: normalizeChannelPostComments(
          data.channelPostComments ?? state.channelPostComments
        ),
        ui: {
          ...state.ui,
          activeTeamId: data.teams.some(
            (team) => team.id === state.ui.activeTeamId
          )
            ? state.ui.activeTeamId
            : (data.teams[0]?.id ?? ""),
        },
      }))
    },
    setActiveTeam(teamId) {
      set((state) => ({
        ui: {
          ...state.ui,
          activeTeamId: teamId,
        },
      }))
    },
    openCreateDialog(dialog) {
      set((state) => ({
        ui: {
          ...state.ui,
          activeCreateDialog: dialog,
        },
      }))
    },
    closeCreateDialog() {
      set((state) => ({
        ui: {
          ...state.ui,
          activeCreateDialog: null,
        },
      }))
    },
    setSelectedView(route, viewId) {
      set((state) => ({
        ui: {
          ...state.ui,
          selectedViewByRoute: {
            ...state.ui.selectedViewByRoute,
            [route]: viewId,
          },
        },
      }))
    },
    setActiveInboxNotification(notificationId) {
      set((state) => ({
        ui: {
          ...state.ui,
          activeInboxNotificationId: notificationId,
        },
      }))
    },
  }
}

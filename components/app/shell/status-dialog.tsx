"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { Smiley } from "@phosphor-icons/react"

import {
  getTextInputLimitState,
  profileStatusMessageConstraints,
} from "@/lib/domain/input-constraints"
import { getCurrentUser } from "@/lib/domain/selectors"
import {
  resolveUserStatus,
  type UserStatus,
  userStatusMessageMaxLength,
  userStatusMeta,
  userStatuses,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import {
  EmojiPickerPopover,
  insertEmojiIntoTextarea,
} from "@/components/app/emoji-picker-popover"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { UserStatusDot } from "@/components/app/user-presence"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type StatusDialogCurrentUser = NonNullable<ReturnType<typeof getCurrentUser>>

export function StatusDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const draft = useStatusDialogDraft(open)

  if (!draft?.currentUser) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <StatusDialogHeader />
        <div className="space-y-5 px-5 py-4">
          <FieldGroup>
            <StatusSelectField
              status={draft.status}
              onStatusChange={draft.setStatus}
            />
            <StatusMessageField
              statusMessage={draft.statusMessage}
              statusMessageLimitState={draft.statusMessageLimitState}
              statusTextareaRef={draft.statusTextareaRef}
              onStatusMessageChange={draft.setStatusMessage}
            />
          </FieldGroup>
        </div>
        <StatusDialogActions
          currentUser={draft.currentUser}
          hasChanges={draft.hasChanges}
          normalizedStatusMessage={draft.normalizedStatusMessage}
          status={draft.status}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  )
}

function useStatusDialogDraft(open: boolean) {
  const currentUser = useAppStore(getCurrentUser)
  const [status, setStatus] = useState<UserStatus>(
    resolveUserStatus(currentUser?.status)
  )
  const [statusMessage, setStatusMessage] = useState(
    currentUser?.statusMessage ?? ""
  )
  const statusMessageLimitState = getTextInputLimitState(
    statusMessage,
    profileStatusMessageConstraints
  )
  const statusTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const hasCurrentUser = currentUser != null
  const currentUserResolvedStatus = resolveUserStatus(currentUser?.status)
  const currentUserStatusMessage = currentUser?.statusMessage ?? ""

  useEffect(() => {
    if (!open || !hasCurrentUser) {
      return
    }

    queueMicrotask(() => {
      setStatus(currentUserResolvedStatus)
      setStatusMessage(currentUserStatusMessage)
    })
  }, [currentUserResolvedStatus, currentUserStatusMessage, hasCurrentUser, open])

  if (!currentUser) {
    return null
  }

  const normalizedStatusMessage = statusMessage.trim()
  const currentUserStatus = resolveUserStatus(currentUser.status)
  const hasChanges =
    status !== currentUserStatus ||
    normalizedStatusMessage !== currentUser.statusMessage

  return {
    currentUser,
    hasChanges,
    normalizedStatusMessage,
    setStatus,
    setStatusMessage,
    status,
    statusMessage,
    statusMessageLimitState,
    statusTextareaRef,
  }
}

function StatusDialogHeader() {
  return (
    <div className="px-5 pt-5 pb-2">
      <DialogHeader className="items-start gap-1.5 p-0">
        <div className="space-y-1.5">
          <DialogTitle className="text-base">Set your status</DialogTitle>
          <DialogDescription className="text-sm">
            Set how you appear to your team.
          </DialogDescription>
        </div>
      </DialogHeader>
    </div>
  )
}

function StatusSelectField({
  status,
  onStatusChange,
}: {
  status: UserStatus
  onStatusChange: (status: UserStatus) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor="user-status">Status</FieldLabel>
      <FieldContent>
        <Select
          value={status}
          onValueChange={(value) => onStatusChange(value as UserStatus)}
        >
          <SelectTrigger id="user-status" className="w-full">
            <div className="flex min-w-0 items-center gap-2">
              <UserStatusDot status={status} />
              <span className="truncate">{userStatusMeta[status].label}</span>
            </div>
          </SelectTrigger>
          <SelectContent position="popper" className="z-[60]">
            <SelectGroup>
              {userStatuses.map((value) => (
                <SelectItem
                  key={value}
                  value={value}
                  className="items-start py-2"
                >
                  <div className="flex items-start gap-2">
                    <UserStatusDot status={value} className="mt-1" />
                    <div className="flex flex-col gap-0.5">
                      <span>{userStatusMeta[value].label}</span>
                      <span className="text-xs text-muted-foreground">
                        {userStatusMeta[value].description}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </FieldContent>
    </Field>
  )
}

function StatusMessageField({
  statusMessage,
  statusMessageLimitState,
  statusTextareaRef,
  onStatusMessageChange,
}: {
  statusMessage: string
  statusMessageLimitState: ReturnType<typeof getTextInputLimitState>
  statusTextareaRef: RefObject<HTMLTextAreaElement | null>
  onStatusMessageChange: (message: string) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor="status-message">Status message</FieldLabel>
      <FieldContent>
        <Textarea
          ref={statusTextareaRef}
          id="status-message"
          value={statusMessage}
          onChange={(event) => onStatusMessageChange(event.target.value)}
          placeholder="Heads down on planning, back this afternoon"
          maxLength={userStatusMessageMaxLength}
        />
        <FieldCharacterLimit
          state={statusMessageLimitState}
          limit={userStatusMessageMaxLength}
        />
        <div className="mt-2 flex items-center">
          <EmojiPickerPopover
            align="start"
            side="top"
            onEmojiSelect={(emoji) =>
              insertEmojiIntoTextarea({
                emoji,
                textarea: statusTextareaRef.current,
                value: statusMessage,
                onChange: onStatusMessageChange,
              })
            }
            trigger={
              <button
                type="button"
                className="rounded-md p-1 text-foreground transition-colors hover:bg-accent"
              >
                <Smiley className="size-4" />
              </button>
            }
          />
        </div>
      </FieldContent>
    </Field>
  )
}

function StatusDialogActions({
  currentUser,
  hasChanges,
  normalizedStatusMessage,
  status,
  onOpenChange,
}: {
  currentUser: StatusDialogCurrentUser
  hasChanges: boolean
  normalizedStatusMessage: string
  status: UserStatus
  onOpenChange: (open: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
      <div>
        {currentUser.hasExplicitStatus || currentUser.statusMessage ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              useAppStore.getState().clearCurrentUserStatus()
              onOpenChange(false)
            }}
          >
            Clear status
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!hasChanges}
          onClick={() => {
            useAppStore.getState().updateCurrentUserStatus({
              status,
              statusMessage: normalizedStatusMessage,
            })
            onOpenChange(false)
          }}
        >
          Save status
        </Button>
      </div>
    </div>
  )
}

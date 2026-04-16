"use client"

import { useEffect, useState } from "react"

import { toast } from "sonner"

import { submitLogoutForm } from "@/lib/browser/logout"
import {
  syncRequestAccountEmailChange,
  syncRequestCurrentAccountPasswordReset,
} from "@/lib/convex/client"
import { getCurrentUser } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const currentUser = useAppStore(getCurrentUser)
  const [name, setName] = useState(currentUser?.name ?? "")
  const [title, setTitle] = useState(currentUser?.title ?? "")
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl ?? "")
  const [email, setEmail] = useState(currentUser?.email ?? "")
  const [emailMentions, setEmailMentions] = useState(
    currentUser?.preferences.emailMentions ?? false
  )
  const [emailAssignments, setEmailAssignments] = useState(
    currentUser?.preferences.emailAssignments ?? false
  )
  const [emailDigest, setEmailDigest] = useState(
    currentUser?.preferences.emailDigest ?? false
  )
  const [changingEmail, setChangingEmail] = useState(false)
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false)
  const hasCurrentUser = currentUser != null
  const currentUserName = currentUser?.name ?? ""
  const currentUserTitle = currentUser?.title ?? ""
  const currentUserAvatarUrl = currentUser?.avatarUrl ?? ""
  const currentUserEmail = currentUser?.email ?? ""
  const currentUserEmailMentions =
    currentUser?.preferences.emailMentions ?? false
  const currentUserEmailAssignments =
    currentUser?.preferences.emailAssignments ?? false
  const currentUserEmailDigest = currentUser?.preferences.emailDigest ?? false

  useEffect(() => {
    if (!hasCurrentUser) {
      return
    }

    setName(currentUserName)
    setTitle(currentUserTitle)
    setAvatarUrl(currentUserAvatarUrl)
    setEmail(currentUserEmail)
    setEmailMentions(currentUserEmailMentions)
    setEmailAssignments(currentUserEmailAssignments)
    setEmailDigest(currentUserEmailDigest)
  }, [
    currentUserAvatarUrl,
    currentUserEmail,
    currentUserEmailAssignments,
    currentUserEmailDigest,
    currentUserEmailMentions,
    currentUserName,
    currentUserTitle,
    hasCurrentUser,
  ])

  async function handleEmailChange() {
    if (!currentUser) {
      return
    }

    if (email.trim().toLowerCase() === currentUser.email.toLowerCase()) {
      toast.error("Enter a different email address")
      return
    }

    try {
      setChangingEmail(true)
      const payload = await syncRequestAccountEmailChange(email)

      const notice =
        payload?.notice ??
        "Email updated. Verify the new address and then sign back in."

      onOpenChange(false)
      toast.success(notice)

      if (payload?.logoutRequired) {
        submitLogoutForm(`/login?notice=${encodeURIComponent(notice)}`)
      }
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : "Failed to update your email"
      )
    } finally {
      setChangingEmail(false)
    }
  }

  async function handlePasswordReset() {
    try {
      setSendingPasswordReset(true)
      await syncRequestCurrentAccountPasswordReset()

      toast.success("Password reset email sent")
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start password reset"
      )
    } finally {
      setSendingPasswordReset(false)
    }
  }

  if (!currentUser) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={`${currentUser.id}-${open}`}
        className="max-w-lg gap-0 overflow-hidden p-0"
      >
        <div className="px-5 pt-5 pb-1">
          <DialogHeader className="mb-1 p-0">
            <DialogTitle className="text-base">Profile</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {currentUser.name} · {currentUser.email}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-col border-t px-5 py-2">
          <div className="py-1.5">
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Identity
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Name</span>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-7 w-48 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Title</span>
            <Input
              id="profile-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-7 w-48 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">
              Avatar initials
            </span>
            <Input
              id="profile-avatar"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              className="h-7 w-48 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex flex-col border-t px-5 py-2">
          <div className="py-1.5">
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Notifications
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="min-w-0">
              <div className="text-xs">Email mentions</div>
              <div className="text-[11px] text-muted-foreground">
                Notified when someone mentions you.
              </div>
            </div>
            <Switch
              checked={emailMentions}
              onCheckedChange={setEmailMentions}
              className="scale-90"
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="min-w-0">
              <div className="text-xs">Email assignments</div>
              <div className="text-[11px] text-muted-foreground">
                Notified when work is assigned to you.
              </div>
            </div>
            <Switch
              checked={emailAssignments}
              onCheckedChange={setEmailAssignments}
              className="scale-90"
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="min-w-0">
              <div className="text-xs">Email digest</div>
              <div className="text-[11px] text-muted-foreground">
                Unread notifications in a daily digest.
              </div>
            </div>
            <Switch
              checked={emailDigest}
              onCheckedChange={setEmailDigest}
              className="scale-90"
            />
          </div>
        </div>

        <div className="flex flex-col border-t px-5 py-2">
          <div className="py-1.5">
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Account
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Email</span>
            <Input
              id="profile-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="h-7 w-56 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex flex-wrap gap-2 py-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={changingEmail}
              onClick={() => {
                void handleEmailChange()
              }}
            >
              {changingEmail ? "Updating..." : "Change email"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sendingPasswordReset}
              onClick={() => {
                void handlePasswordReset()
              }}
            >
              {sendingPasswordReset ? "Sending..." : "Password reset"}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              useAppStore.getState().updateCurrentUserProfile({
                name,
                title,
                avatarUrl,
                preferences: {
                  emailMentions,
                  emailAssignments,
                  emailDigest,
                  theme: currentUser.preferences.theme,
                },
              })
              onOpenChange(false)
            }}
          >
            Save profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

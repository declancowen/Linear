"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { getCurrentUser } from "@/lib/domain/selectors"
import { type ThemePreference } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { resolveImageAssetSource } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

import { ImageUploadControl, SettingsScaffold, SummaryCard } from "./shared"
import { getUserInitials, uploadSettingsImage } from "./utils"

const themePreferenceOptions: Array<{
  value: ThemePreference
  label: string
  description: string
}> = [
  {
    value: "light",
    label: "Light",
    description: "Always use the light interface.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark interface.",
  },
  {
    value: "system",
    label: "System",
    description: "Follow your device appearance setting.",
  },
]

export function UserSettingsScreen() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const data = useAppStore()
  const currentUser = getCurrentUser(data)
  const avatarImageSrc = resolveImageAssetSource(
    currentUser.avatarImageUrl,
    currentUser.avatarUrl
  )
  const [name, setName] = useState(currentUser.name)
  const [title, setTitle] = useState(currentUser.title)
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(
    avatarImageSrc ?? null
  )
  const [avatarImageStorageId, setAvatarImageStorageId] = useState<
    string | undefined
  >(undefined)
  const [clearAvatarImage, setClearAvatarImage] = useState(false)
  const [email, setEmail] = useState(currentUser.email)
  const [emailMentions, setEmailMentions] = useState(
    currentUser.preferences.emailMentions
  )
  const [emailAssignments, setEmailAssignments] = useState(
    currentUser.preferences.emailAssignments
  )
  const [emailDigest, setEmailDigest] = useState(
    currentUser.preferences.emailDigest
  )
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    currentUser.preferences.theme
  )
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [changingEmail, setChangingEmail] = useState(false)
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false)

  useEffect(() => {
    if (!avatarPreviewUrl?.startsWith("blob:")) {
      return
    }

    return () => {
      URL.revokeObjectURL(avatarPreviewUrl)
    }
  }, [avatarPreviewUrl])

  useEffect(() => {
    setName(currentUser.name)
    setTitle(currentUser.title)
    setAvatarUrl(currentUser.avatarUrl)
    setAvatarPreviewUrl(
      resolveImageAssetSource(
        currentUser.avatarImageUrl,
        currentUser.avatarUrl
      ) ?? null
    )
    setAvatarImageStorageId(undefined)
    setClearAvatarImage(false)
    setEmail(currentUser.email)
    setEmailMentions(currentUser.preferences.emailMentions)
    setEmailAssignments(currentUser.preferences.emailAssignments)
    setEmailDigest(currentUser.preferences.emailDigest)
    setThemePreference(currentUser.preferences.theme)
  }, [currentUser.id])

  async function handleAvatarUpload(file: File) {
    try {
      setUploadingAvatar(true)
      const uploaded = await uploadSettingsImage("user-avatar", file)
      setAvatarPreviewUrl(uploaded.previewUrl)
      setAvatarImageStorageId(uploaded.storageId)
      setClearAvatarImage(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload avatar"
      )
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleEmailChange() {
    if (email.trim().toLowerCase() === currentUser.email.toLowerCase()) {
      toast.error("Enter a different email address")
      return
    }

    try {
      setChangingEmail(true)
      const response = await fetch("/api/account/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
        notice?: string
        logoutRequired?: boolean
      } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update your email address")
      }

      const notice =
        payload?.notice ??
        "Email updated. Verify the new address and then sign back in."

      toast.success(notice)

      if (payload?.logoutRequired && typeof document !== "undefined") {
        const form = document.createElement("form")
        form.method = "POST"
        form.action = `/auth/logout?returnTo=${encodeURIComponent(
          `/login?notice=${encodeURIComponent(notice)}`
        )}`
        document.body.appendChild(form)
        form.submit()
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
      const response = await fetch("/api/account/password-reset", {
        method: "POST",
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to start password reset")
      }

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

  async function handleSave() {
    try {
      setSaving(true)
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          title,
          avatarUrl,
          ...(avatarImageStorageId ? { avatarImageStorageId } : {}),
          ...(clearAvatarImage ? { clearAvatarImage: true } : {}),
          preferences: {
            emailMentions,
            emailAssignments,
            emailDigest,
            theme: themePreference,
          },
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update profile")
      }

      toast.success("Profile updated")
      setTheme(themePreference)
      useAppStore.setState((state) => ({
        users: state.users.map((user) =>
          user.id === currentUser.id
            ? {
                ...user,
                name,
                title,
                avatarUrl,
                avatarImageUrl: clearAvatarImage ? null : user.avatarImageUrl,
                preferences: {
                  emailMentions,
                  emailAssignments,
                  emailDigest,
                  theme: themePreference,
                },
              }
            : user
        ),
      }))
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsScaffold
      title="User settings"
      subtitle="Personal profile, notifications, and account access"
      footer={
        <Button disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Saving..." : "Save profile"}
        </Button>
      }
    >
      <ImageUploadControl
        description="This image appears anywhere your profile is shown in the workspace."
        imageSrc={avatarPreviewUrl}
        onClear={() => {
          setAvatarPreviewUrl(null)
          setAvatarImageStorageId(undefined)
          setClearAvatarImage(true)
        }}
        onSelect={handleAvatarUpload}
        preview={
          <span className="text-base font-semibold text-muted-foreground">
            {getUserInitials(name)}
          </span>
        }
        shape="circle"
        title="Profile photo"
        uploading={uploadingAvatar}
      />

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>
            Update how your name and role appear across the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="profile-name">Name</FieldLabel>
              <FieldContent>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-title">Title</FieldLabel>
              <FieldContent>
                <Input
                  id="profile-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-avatar">Fallback badge</FieldLabel>
              <FieldContent>
                <Input
                  id="profile-avatar"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                />
              </FieldContent>
              <FieldDescription>
                Used when no profile image is available.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Control which email events reach you outside the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div>
              <div className="text-sm font-medium">Email mentions</div>
              <div className="text-xs text-muted-foreground">
                Send an email when someone mentions you.
              </div>
            </div>
            <Switch
              checked={emailMentions}
              onCheckedChange={setEmailMentions}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div>
              <div className="text-sm font-medium">Email assignments</div>
              <div className="text-xs text-muted-foreground">
                Send an email when work is assigned to you.
              </div>
            </div>
            <Switch
              checked={emailAssignments}
              onCheckedChange={setEmailAssignments}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div>
              <div className="text-sm font-medium">Email digest</div>
              <div className="text-xs text-muted-foreground">
                Include unread notifications in a digest email.
              </div>
            </div>
            <Switch checked={emailDigest} onCheckedChange={setEmailDigest} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose how the interface theme should behave.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="profile-theme">Theme</FieldLabel>
              <FieldContent>
                <Select
                  value={themePreference}
                  onValueChange={(value) =>
                    setThemePreference(value as ThemePreference)
                  }
                >
                  <SelectTrigger id="profile-theme">
                    <SelectValue placeholder="Select a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {themePreferenceOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FieldContent>
              <FieldDescription>
                {
                  themePreferenceOptions.find(
                    (option) => option.value === themePreference
                  )?.description
                }
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Account email</CardTitle>
          <CardDescription>
            Changing your email starts a WorkOS verification flow and signs
            you out when it completes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="profile-email">Email</FieldLabel>
              <FieldContent>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </FieldContent>
            </Field>
          </FieldGroup>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={changingEmail}
              onClick={() => void handleEmailChange()}
            >
              {changingEmail ? "Updating..." : "Change email"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={sendingPasswordReset}
              onClick={() => void handlePasswordReset()}
            >
              {sendingPasswordReset ? "Sending..." : "Send password reset"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </SettingsScaffold>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { getCurrentUser } from "@/lib/domain/selectors"
import { type ThemePreference } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { resolveImageAssetSource } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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

import {
  ImageUploadControl,
  SettingsScaffold,
  SettingsSection,
  SettingsToggleRow,
} from "./shared"
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
    currentUser?.avatarImageUrl,
    currentUser?.avatarUrl
  )
  const [name, setName] = useState(currentUser?.name ?? "")
  const [title, setTitle] = useState(currentUser?.title ?? "")
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl ?? "")
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(
    avatarImageSrc ?? null
  )
  const [avatarImageStorageId, setAvatarImageStorageId] = useState<
    string | undefined
  >(undefined)
  const [clearAvatarImage, setClearAvatarImage] = useState(false)
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
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    currentUser?.preferences.theme ?? "system"
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
    if (!currentUser) {
      return
    }

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
  }, [currentUser?.id])

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
    if (!currentUser) {
      return
    }

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
    if (!currentUser) {
      return
    }

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

  if (!currentUser) {
    return (
      <SettingsScaffold
        title="User settings"
        subtitle="Personal profile, notifications, and account access"
      >
        <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
          Loading profile...
        </div>
      </SettingsScaffold>
    )
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
      <div className="max-w-2xl space-y-10">
        <SettingsSection
          title="Profile photo"
          description="Shown wherever your profile appears in the workspace."
        >
          <ImageUploadControl
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
        </SettingsSection>

        <SettingsSection
          title="Identity"
          description="Update how your name and role appear across the app."
        >
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
        </SettingsSection>

        <SettingsSection
          title="Notifications"
          description="Control which email events reach you outside the app."
        >
          <div className="space-y-4">
            <SettingsToggleRow
              checked={emailMentions}
              description="Send an email when someone mentions you."
              title="Email mentions"
              onCheckedChange={setEmailMentions}
            />
            <SettingsToggleRow
              checked={emailAssignments}
              description="Send an email when work is assigned to you."
              title="Email assignments"
              onCheckedChange={setEmailAssignments}
            />
            <SettingsToggleRow
              checked={emailDigest}
              description="Include unread notifications in a digest email."
              title="Email digest"
              onCheckedChange={setEmailDigest}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Appearance"
          description="Choose how the interface theme should behave."
        >
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
        </SettingsSection>

        <SettingsSection
          title="Account email"
          description="Changing your email starts a WorkOS verification flow and signs you out when it completes."
        >
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
          <div className="flex flex-wrap gap-2 pt-1">
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
        </SettingsSection>
      </div>
    </SettingsScaffold>
  )
}

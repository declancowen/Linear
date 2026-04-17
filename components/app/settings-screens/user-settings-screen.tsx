"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { submitLogoutForm } from "@/lib/browser/logout"
import {
  clearPendingThemePreference,
  setPendingThemePreference,
} from "@/lib/browser/theme-preference-sync"
import {
  syncDeleteCurrentAccount,
  syncRequestAccountEmailChange,
  syncRequestCurrentAccountPasswordReset,
  syncUpdateCurrentUserProfile,
} from "@/lib/convex/client"
import { getCurrentUser } from "@/lib/domain/selectors"
import { type ThemePreference } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn, resolveImageAssetSource } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"

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

type ThemePreviewTone = "light" | "dark"

type PersistedProfileSnapshot = {
  id: string
  name: string
  title: string
  avatarUrl: string
  preferences: {
    emailMentions: boolean
    emailAssignments: boolean
    emailDigest: boolean
    theme: ThemePreference
  }
}

const themePreviewToneStyles: Record<
  ThemePreviewTone,
  {
    surface: string
    surfaceBorder: string
    sidebar: string
    sidebarDot: string
    sidebarLine: string
    content: string
    contentBorder: string
    header: string
    lineStrong: string
    line: string
    card: string
    cardLine: string
    divider: string
  }
> = {
  light: {
    surface: "bg-[#f5f5f2]",
    surfaceBorder: "border-black/8",
    sidebar: "bg-[#ecece8]",
    sidebarDot: "bg-black/20",
    sidebarLine: "bg-black/16",
    content: "bg-white/88",
    contentBorder: "border-black/8",
    header: "bg-black/10",
    lineStrong: "bg-black/18",
    line: "bg-black/12",
    card: "bg-black/[0.035]",
    cardLine: "bg-black/14",
    divider: "bg-black/8",
  },
  dark: {
    surface: "bg-[#202126]",
    surfaceBorder: "border-white/10",
    sidebar: "bg-[#2a2b31]",
    sidebarDot: "bg-white/18",
    sidebarLine: "bg-white/14",
    content: "bg-[#27282f]",
    contentBorder: "border-white/8",
    header: "bg-white/10",
    lineStrong: "bg-white/18",
    line: "bg-white/12",
    card: "bg-white/[0.045]",
    cardLine: "bg-white/16",
    divider: "bg-white/10",
  },
}

function ThemePreviewLayout({
  tone,
  className,
}: {
  tone: ThemePreviewTone
  className?: string
}) {
  const toneClassName = themePreviewToneStyles[tone]

  return (
    <div className={cn("flex h-full min-w-0 gap-1.5", className)}>
      <div
        className={cn(
          "flex w-4 shrink-0 flex-col rounded-[0.45rem] p-1",
          toneClassName.sidebar
        )}
      >
        <span className={cn("size-1 rounded-full", toneClassName.sidebarDot)} />
        <div className="mt-1 space-y-1">
          {["w-2.5", "w-2", "w-2.5", "w-1.5"].map((widthClassName, index) => (
            <div
              key={`${widthClassName}-${index}`}
              className={cn(
                "h-px rounded-full",
                widthClassName,
                toneClassName.sidebarLine
              )}
            />
          ))}
        </div>
        <div className="mt-auto space-y-0.5">
          {["w-2", "w-1.5"].map((widthClassName, index) => (
            <div
              key={`${widthClassName}-${index}`}
              className={cn(
                "h-px rounded-full",
                widthClassName,
                toneClassName.sidebarLine
              )}
            />
          ))}
        </div>
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col rounded-[0.55rem] border p-1.5",
          toneClassName.content,
          toneClassName.contentBorder
        )}
      >
        <div className={cn("h-1.5 w-full rounded-sm", toneClassName.header)} />
        <div className="mt-1.5 space-y-1">
          {["w-full", "w-4/5", "w-3/5"].map((widthClassName) => (
            <div
              key={widthClassName}
              className={cn(
                "h-1 rounded-full",
                widthClassName,
                toneClassName.line
              )}
            />
          ))}
        </div>
        <div
          className={cn(
            "mt-1.5 flex flex-1 items-end rounded-[0.45rem] px-1.5 py-1",
            toneClassName.card
          )}
        >
          <div className="w-full space-y-1">
            <div
              className={cn("h-1 w-3/4 rounded-full", toneClassName.cardLine)}
            />
            <div
              className={cn("h-1 w-1/2 rounded-full", toneClassName.lineStrong)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ThemePreviewPane({
  tone,
  className,
}: {
  tone: ThemePreviewTone
  className?: string
}) {
  const toneClassName = themePreviewToneStyles[tone]

  return (
    <div
      className={cn(
        "h-full rounded-[0.7rem] border p-1.5",
        toneClassName.surface,
        toneClassName.surfaceBorder,
        className
      )}
    >
      <ThemePreviewLayout tone={tone} />
    </div>
  )
}

function ThemeSystemPreview() {
  return (
    <div className="grid h-full grid-cols-[1fr_auto_1fr] overflow-hidden rounded-[0.7rem] border border-border">
      <div className={cn("p-1.5", themePreviewToneStyles.light.surface)}>
        <ThemePreviewLayout tone="light" />
      </div>
      <div className="w-px bg-border" />
      <div className={cn("p-1.5", themePreviewToneStyles.dark.surface)}>
        <ThemePreviewLayout tone="dark" />
      </div>
    </div>
  )
}

function ThemePreferencePreview({ value }: { value: ThemePreference }) {
  if (value === "system") {
    return <ThemeSystemPreview />
  }

  return <ThemePreviewPane tone={value} />
}

export function UserSettingsScreen() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const currentUser = useAppStore(getCurrentUser)
  const profileSaveQueueRef = useRef(Promise.resolve())
  const latestThemeRequestIdRef = useRef(0)
  const currentUserId = currentUser?.id ?? null
  const currentUserName = currentUser?.name ?? ""
  const currentUserTitle = currentUser?.title ?? ""
  const currentUserAvatarUrl = currentUser?.avatarUrl ?? ""
  const currentUserAvatarPreviewUrl =
    resolveImageAssetSource(
      currentUser?.avatarImageUrl,
      currentUser?.avatarUrl
    ) ?? null
  const currentUserEmail = currentUser?.email ?? ""
  const currentUserEmailMentions =
    currentUser?.preferences.emailMentions ?? false
  const currentUserEmailAssignments =
    currentUser?.preferences.emailAssignments ?? false
  const currentUserEmailDigest = currentUser?.preferences.emailDigest ?? false
  const currentUserThemePreference = currentUser?.preferences.theme ?? "system"
  const committedThemePreferenceRef = useRef<ThemePreference>(
    currentUserThemePreference
  )
  const committedProfileRef = useRef<PersistedProfileSnapshot | null>(
    currentUserId
      ? {
          id: currentUserId,
          name: currentUserName,
          title: currentUserTitle,
          avatarUrl: currentUserAvatarUrl,
          preferences: {
            emailMentions: currentUserEmailMentions,
            emailAssignments: currentUserEmailAssignments,
            emailDigest: currentUserEmailDigest,
            theme: currentUserThemePreference,
          },
        }
      : null
  )
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const deleteAccountBlockReason = useAppStore((state) => {
    if (
      state.workspaces.some(
        (workspace) => workspace.createdBy === state.currentUserId
      )
    ) {
      return "Transfer or delete your owned workspace before deleting your account."
    }

    if (
      state.teamMemberships.some(
        (membership) =>
          membership.userId === state.currentUserId &&
          membership.role === "admin"
      )
    ) {
      return "Leave or transfer your team admin access before deleting your account."
    }

    return null
  })

  useEffect(() => {
    if (!avatarPreviewUrl?.startsWith("blob:")) {
      return
    }

    return () => {
      URL.revokeObjectURL(avatarPreviewUrl)
    }
  }, [avatarPreviewUrl])

  useEffect(() => {
    committedProfileRef.current = currentUserId
      ? {
          id: currentUserId,
          name: currentUserName,
          title: currentUserTitle,
          avatarUrl: currentUserAvatarUrl,
          preferences: {
            emailMentions: currentUserEmailMentions,
            emailAssignments: currentUserEmailAssignments,
            emailDigest: currentUserEmailDigest,
            theme: currentUserThemePreference,
          },
        }
      : null
  }, [
    currentUserAvatarUrl,
    currentUserEmailAssignments,
    currentUserEmailDigest,
    currentUserEmailMentions,
    currentUserId,
    currentUserName,
    currentUserThemePreference,
    currentUserTitle,
  ])

  useEffect(() => {
    if (!currentUserId) {
      return
    }

    setName(currentUserName)
    setTitle(currentUserTitle)
    setAvatarUrl(currentUserAvatarUrl)
    setAvatarPreviewUrl(currentUserAvatarPreviewUrl)
    setAvatarImageStorageId(undefined)
    setClearAvatarImage(false)
    setEmail(currentUserEmail)
    setEmailMentions(currentUserEmailMentions)
    setEmailAssignments(currentUserEmailAssignments)
    setEmailDigest(currentUserEmailDigest)
  }, [
    currentUserAvatarPreviewUrl,
    currentUserAvatarUrl,
    currentUserEmail,
    currentUserEmailAssignments,
    currentUserEmailDigest,
    currentUserEmailMentions,
    currentUserId,
    currentUserName,
    currentUserTitle,
  ])

  useEffect(() => {
    if (!currentUserId) {
      return
    }

    const storedThemePreference =
      useAppStore.getState().users.find((user) => user.id === currentUserId)
        ?.preferences.theme ?? "system"

    committedThemePreferenceRef.current = storedThemePreference
    setThemePreference(storedThemePreference)
  }, [currentUserId])

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
      const payload = await syncRequestAccountEmailChange(email)

      const notice =
        payload?.notice ??
        "Email updated. Verify the new address and then sign back in."

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

  function updateStoredThemePreference(nextTheme: ThemePreference) {
    useAppStore.setState((state) => ({
      users: state.users.map((user) =>
        user.id === currentUserId
          ? {
              ...user,
              preferences: {
                ...user.preferences,
                theme: nextTheme,
              },
            }
          : user
      ),
    }))
  }

  function queueProfileSave<T>(task: () => Promise<T>) {
    const nextSave = profileSaveQueueRef.current
      .catch(() => undefined)
      .then(task)
    profileSaveQueueRef.current = nextSave.then(
      () => undefined,
      () => undefined
    )
    return nextSave
  }

  function handleThemePreferenceChange(nextTheme: ThemePreference) {
    if (!currentUser || nextTheme === themePreference) {
      return
    }

    const requestId = latestThemeRequestIdRef.current + 1
    latestThemeRequestIdRef.current = requestId

    setThemePreference(nextTheme)
    setPendingThemePreference(nextTheme)
    setTheme(nextTheme)

    void queueProfileSave(async () => {
      const rollbackTheme = committedThemePreferenceRef.current
      const persistedProfile = committedProfileRef.current

      if (!persistedProfile) {
        return
      }

      try {
        await syncUpdateCurrentUserProfile(
          persistedProfile.id,
          persistedProfile.name,
          persistedProfile.title,
          persistedProfile.avatarUrl,
          {
            ...persistedProfile.preferences,
            theme: nextTheme,
          }
        )
        committedThemePreferenceRef.current = nextTheme
        committedProfileRef.current = {
          ...persistedProfile,
          preferences: {
            ...persistedProfile.preferences,
            theme: nextTheme,
          },
        }
        updateStoredThemePreference(nextTheme)
      } catch (error) {
        console.error(error)

        if (latestThemeRequestIdRef.current === requestId) {
          clearPendingThemePreference(nextTheme)
          setThemePreference(rollbackTheme)
          setTheme(rollbackTheme)
        }

        toast.error(
          error instanceof Error ? error.message : "Failed to update theme"
        )
      }
    })
  }

  async function handleSave() {
    if (!currentUser) {
      return
    }

    try {
      setSaving(true)
      const savedProfile: PersistedProfileSnapshot = {
        id: currentUser.id,
        name,
        title,
        avatarUrl,
        preferences: {
          emailMentions,
          emailAssignments,
          emailDigest,
          theme: themePreference,
        },
      }

      await queueProfileSave(async () => {
        await syncUpdateCurrentUserProfile(
          currentUser.id,
          name,
          title,
          avatarUrl,
          {
            emailMentions,
            emailAssignments,
            emailDigest,
            theme: themePreference,
          },
          {
            ...(avatarImageStorageId ? { avatarImageStorageId } : {}),
            ...(clearAvatarImage ? { clearAvatarImage: true } : {}),
          }
        )

        committedProfileRef.current = savedProfile
        committedThemePreferenceRef.current = themePreference
      })

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

  async function handleDeleteAccount() {
    try {
      setDeletingAccount(true)
      const payload = await syncDeleteCurrentAccount()
      const notice = payload.notice || "Your account has been deleted."

      toast.success(notice)

      if (payload.logoutRequired) {
        submitLogoutForm(`/login?notice=${encodeURIComponent(notice)}`)
        return
      }

      router.replace("/")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : "Failed to delete account"
      )
    } finally {
      setDeletingAccount(false)
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

        <SettingsSection title="Appearance">
          <FieldGroup>
            <Field>
              <FieldLabel id="profile-theme-label">Theme</FieldLabel>
              <FieldContent>
                <div
                  role="radiogroup"
                  aria-labelledby="profile-theme-label"
                  className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3"
                >
                  {themePreferenceOptions.map((option) => {
                    const checked = option.value === themePreference

                    return (
                      <label
                        key={option.value}
                        className="group cursor-pointer select-none"
                      >
                        <input
                          checked={checked}
                          className="peer sr-only"
                          name="profile-theme"
                          type="radio"
                          value={option.value}
                          onChange={(event) =>
                            handleThemePreferenceChange(
                              event.target.value as ThemePreference
                            )
                          }
                        />
                        <div className="space-y-2.5">
                          <div
                            className={cn(
                              "aspect-[1.58/1] overflow-hidden rounded-[1rem] border transition-all duration-150 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40",
                              checked
                                ? "border-primary shadow-sm ring-2 ring-primary/15"
                                : "border-border hover:border-muted-foreground/30"
                            )}
                          >
                            <ThemePreferencePreview value={option.value} />
                          </div>
                          <div
                            className={cn(
                              "px-1 text-center transition-colors",
                              checked
                                ? "text-foreground"
                                : "text-muted-foreground group-hover:text-foreground"
                            )}
                          >
                            <div
                              className={cn(
                                "text-sm",
                                checked ? "font-medium" : "font-normal"
                              )}
                            >
                              {option.label}
                            </div>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </FieldContent>
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

        <section className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4">
          <div className="space-y-1">
            <h2 className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Danger zone
            </h2>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium">Delete account</div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Permanently disconnect your sign-in and remove you from active
                workspace memberships. Existing chats, posts, and documents stay
                visible for history.
                {deleteAccountBlockReason ? ` ${deleteAccountBlockReason}` : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingAccount || deleteAccountBlockReason != null}
              onClick={() => setDeleteDialogOpen(true)}
            >
              {deletingAccount ? "Deleting..." : "Delete account"}
            </Button>
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete account"
        description="This will remove your active access, disconnect your sign-in, and sign you out. Your existing chats, posts, and documents will stay visible for history."
        confirmLabel="Delete account"
        variant="destructive"
        loading={deletingAccount}
        onConfirm={() => void handleDeleteAccount()}
      />
    </SettingsScaffold>
  )
}

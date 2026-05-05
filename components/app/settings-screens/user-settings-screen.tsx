"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { submitLogoutForm } from "@/lib/browser/logout"
import {
  getTextInputLimitState,
  profileAvatarFallbackConstraints,
  profileNameConstraints,
  profileTitleConstraints,
} from "@/lib/domain/input-constraints"
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
import { type ThemePreference, type UserProfile } from "@/lib/domain/types"
import { useAppStore, type AppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
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
  SettingsDangerRow,
  SettingsGroupLabel,
  SettingsHero,
  SettingsScaffold,
  SettingsSection,
  SettingsToggleRow,
} from "./shared"
import { getUserProfileDraftSource } from "./user-profile-draft"
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

type TextLimitState = ReturnType<typeof getTextInputLimitState>

function UserSettingsHero({
  currentUser,
  avatarImageSrc,
  themePreference,
}: {
  currentUser: UserProfile
  avatarImageSrc?: string | null
  themePreference: ThemePreference
}) {
  const themeLabel = `${themePreference.charAt(0).toUpperCase()}${themePreference.slice(1)} theme`

  return (
    <SettingsHero
      leading={
        <div className="flex size-14 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-2">
          {avatarImageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={currentUser.name}
              className="size-full object-cover"
              src={avatarImageSrc}
            />
          ) : (
            <span className="text-[15px] font-semibold text-fg-2">
              {getUserInitials(currentUser.name)}
            </span>
          )}
        </div>
      }
      title={currentUser.name}
      description={
        currentUser.title?.trim() ? currentUser.title : currentUser.email
      }
      meta={
        currentUser.title?.trim()
          ? [
              { key: "email", label: currentUser.email },
              { key: "theme", label: themeLabel },
            ]
          : [{ key: "theme", label: themeLabel }]
      }
    />
  )
}

function ProfileSettingsSection({
  name,
  title,
  avatarUrl,
  avatarPreviewUrl,
  uploadingAvatar,
  nameLimitState,
  titleLimitState,
  avatarLimitState,
  onAvatarClear,
  onAvatarUpload,
  onNameChange,
  onTitleChange,
  onAvatarUrlChange,
}: {
  name: string
  title: string
  avatarUrl: string
  avatarPreviewUrl: string | null
  uploadingAvatar: boolean
  nameLimitState: TextLimitState
  titleLimitState: TextLimitState
  avatarLimitState: TextLimitState
  onAvatarClear: () => void
  onAvatarUpload: (file: File) => void | Promise<void>
  onNameChange: (value: string) => void
  onTitleChange: (value: string) => void
  onAvatarUrlChange: (value: string) => void
}) {
  return (
    <SettingsSection
      title="Profile"
      description="Your photo, name, and role as they appear across the app."
    >
      <div className="space-y-6">
        <ImageUploadControl
          imageSrc={avatarPreviewUrl}
          onClear={onAvatarClear}
          onSelect={onAvatarUpload}
          preview={
            <span className="text-base font-semibold text-fg-2">
              {getUserInitials(name)}
            </span>
          }
          shape="circle"
          title="Profile photo"
          uploading={uploadingAvatar}
        />

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="profile-name">Name</FieldLabel>
            <FieldContent>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                maxLength={profileNameConstraints.max}
              />
              <FieldCharacterLimit
                state={nameLimitState}
                limit={profileNameConstraints.max}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-title">Title</FieldLabel>
            <FieldContent>
              <Input
                id="profile-title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                maxLength={profileTitleConstraints.max}
              />
              <FieldCharacterLimit
                state={titleLimitState}
                limit={profileTitleConstraints.max}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-avatar">Fallback badge</FieldLabel>
            <FieldContent>
              <Input
                id="profile-avatar"
                value={avatarUrl}
                onChange={(event) => onAvatarUrlChange(event.target.value)}
                maxLength={profileAvatarFallbackConstraints.max}
              />
              <FieldCharacterLimit
                state={avatarLimitState}
                limit={profileAvatarFallbackConstraints.max}
              />
            </FieldContent>
            <FieldDescription>
              Used when no profile image is available.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </div>
    </SettingsSection>
  )
}

function AppearanceSettingsSection({
  themePreference,
  onThemePreferenceChange,
}: {
  themePreference: ThemePreference
  onThemePreferenceChange: (value: ThemePreference) => void
}) {
  return (
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
                        onThemePreferenceChange(
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
  )
}

function NotificationsSettingsSection({
  emailMentions,
  emailAssignments,
  emailDigest,
  onEmailMentionsChange,
  onEmailAssignmentsChange,
  onEmailDigestChange,
}: {
  emailMentions: boolean
  emailAssignments: boolean
  emailDigest: boolean
  onEmailMentionsChange: (value: boolean) => void
  onEmailAssignmentsChange: (value: boolean) => void
  onEmailDigestChange: (value: boolean) => void
}) {
  return (
    <SettingsSection
      title="Notifications"
      description="Control which email events reach you outside the app."
    >
      <div className="space-y-4">
        <SettingsToggleRow
          checked={emailMentions}
          description="Send an email when someone mentions you."
          title="Email mentions"
          onCheckedChange={onEmailMentionsChange}
        />
        <SettingsToggleRow
          checked={emailAssignments}
          description="Send an email when work is assigned to you."
          title="Email assignments"
          onCheckedChange={onEmailAssignmentsChange}
        />
        <SettingsToggleRow
          checked={emailDigest}
          description="Include unread notifications in a digest email."
          title="Email digest"
          onCheckedChange={onEmailDigestChange}
        />
      </div>
    </SettingsSection>
  )
}

function AccountEmailSettingsSection({
  email,
  changingEmail,
  sendingPasswordReset,
  onEmailChange,
  onChangeEmail,
  onPasswordReset,
}: {
  email: string
  changingEmail: boolean
  sendingPasswordReset: boolean
  onEmailChange: (value: string) => void
  onChangeEmail: () => void
  onPasswordReset: () => void
}) {
  return (
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
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </FieldContent>
        </Field>
      </FieldGroup>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          disabled={changingEmail}
          onClick={onChangeEmail}
        >
          {changingEmail ? "Updating..." : "Change email"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={sendingPasswordReset}
          onClick={onPasswordReset}
        >
          {sendingPasswordReset ? "Sending..." : "Send password reset"}
        </Button>
      </div>
    </SettingsSection>
  )
}

function DeleteAccountSettingsSection({
  deleteAccountBlockReason,
  deleteDialogOpen,
  deletingAccount,
  onConfirmDelete,
  onDeleteDialogOpenChange,
  onRequestDelete,
}: {
  deleteAccountBlockReason: string | null
  deleteDialogOpen: boolean
  deletingAccount: boolean
  onConfirmDelete: () => void
  onDeleteDialogOpenChange: (open: boolean) => void
  onRequestDelete: () => void
}) {
  return (
    <>
      <SettingsGroupLabel label="Danger zone" />
      <SettingsDangerRow
        title="Delete account"
        description={
          <>
            Permanently disconnect your sign-in and remove you from active
            workspace memberships. Existing chats, posts, and documents stay
            visible for history.
            {deleteAccountBlockReason ? ` ${deleteAccountBlockReason}` : ""}
          </>
        }
        action={
          <Button
            type="button"
            variant="destructive"
            disabled={deletingAccount || deleteAccountBlockReason != null}
            onClick={onRequestDelete}
          >
            {deletingAccount ? "Deleting..." : "Delete account"}
          </Button>
        }
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={onDeleteDialogOpenChange}
        title="Delete account"
        description="This will remove your active access, disconnect your sign-in, and sign you out. Your existing chats, posts, and documents will stay visible for history."
        confirmLabel="Delete account"
        variant="destructive"
        loading={deletingAccount}
        onConfirm={onConfirmDelete}
      />
    </>
  )
}

function createPersistedProfileSnapshot(
  currentUser: UserProfile | null
): PersistedProfileSnapshot | null {
  if (!currentUser) {
    return null
  }

  return {
    id: currentUser.id,
    name: currentUser.name,
    title: currentUser.title ?? "",
    avatarUrl: currentUser.avatarUrl ?? "",
    preferences: {
      emailMentions: currentUser.preferences.emailMentions,
      emailAssignments: currentUser.preferences.emailAssignments,
      emailDigest: currentUser.preferences.emailDigest,
      theme: currentUser.preferences.theme,
    },
  }
}

function selectDeleteAccountBlockReason(state: AppStore) {
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
        membership.userId === state.currentUserId && membership.role === "admin"
    )
  ) {
    return "Leave or transfer your team admin access before deleting your account."
  }

  return null
}

function updateStoredThemePreference(
  currentUserId: string | null,
  nextTheme: ThemePreference
) {
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

function updateStoredUserProfile({
  avatarUrl,
  clearAvatarImage,
  emailAssignments,
  emailDigest,
  emailMentions,
  name,
  themePreference,
  title,
  userId,
}: {
  avatarUrl: string
  clearAvatarImage: boolean
  emailAssignments: boolean
  emailDigest: boolean
  emailMentions: boolean
  name: string
  themePreference: ThemePreference
  title: string
  userId: string
}) {
  useAppStore.setState((state) => ({
    users: state.users.map((user) =>
      user.id === userId
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
}

function useUserAccountActions({
  currentUser,
  email,
  router,
}: {
  currentUser: UserProfile | null
  email: string
  router: ReturnType<typeof useRouter>
}) {
  const [changingEmail, setChangingEmail] = useState(false)
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  function getEmailChangeValidationMessage() {
    if (!currentUser) {
      return "Current user unavailable"
    }

    return email.trim().toLowerCase() === currentUser.email.toLowerCase()
      ? "Enter a different email address"
      : null
  }

  function handleEmailChangeSuccess(payload: Awaited<ReturnType<typeof syncRequestAccountEmailChange>>) {
    const notice =
      payload?.notice ??
      "Email updated. Verify the new address and then sign back in."

    toast.success(notice)

    if (payload?.logoutRequired) {
      submitLogoutForm(`/login?notice=${encodeURIComponent(notice)}`)
    }
  }

  async function handleEmailChange() {
    if (!currentUser) {
      return
    }

    const validationMessage = getEmailChangeValidationMessage()
    if (validationMessage) {
      toast.error(validationMessage)
      return
    }

    try {
      setChangingEmail(true)
      const payload = await syncRequestAccountEmailChange(email)
      handleEmailChangeSuccess(payload)
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

  return {
    changingEmail,
    deleteDialogOpen,
    deletingAccount,
    handleDeleteAccount,
    handleEmailChange,
    handlePasswordReset,
    sendingPasswordReset,
    setDeleteDialogOpen,
  }
}

function useUserProfileDraft(currentUser: UserProfile | null) {
  const source = getUserProfileDraftSource(currentUser)
  const [name, setName] = useState(source.name)
  const [title, setTitle] = useState(source.title)
  const [avatarUrl, setAvatarUrl] = useState(source.avatarUrl)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(
    source.avatarPreviewUrl
  )
  const [avatarImageStorageId, setAvatarImageStorageId] = useState<
    string | undefined
  >(undefined)
  const [clearAvatarImage, setClearAvatarImage] = useState(false)
  const [email, setEmail] = useState(source.email)
  const [emailMentions, setEmailMentions] = useState(source.emailMentions)
  const [emailAssignments, setEmailAssignments] = useState(
    source.emailAssignments
  )
  const [emailDigest, setEmailDigest] = useState(source.emailDigest)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const nameLimitState = getTextInputLimitState(name, profileNameConstraints)
  const titleLimitState = getTextInputLimitState(title, profileTitleConstraints)
  const avatarLimitState = getTextInputLimitState(
    avatarUrl,
    profileAvatarFallbackConstraints
  )
  const canSaveProfile =
    nameLimitState.canSubmit &&
    titleLimitState.canSubmit &&
    avatarLimitState.canSubmit

  useEffect(() => {
    if (!avatarPreviewUrl?.startsWith("blob:")) {
      return
    }

    return () => {
      URL.revokeObjectURL(avatarPreviewUrl)
    }
  }, [avatarPreviewUrl])

  useEffect(() => {
    if (!source.id) {
      return
    }

    setName(source.name)
    setTitle(source.title)
    setAvatarUrl(source.avatarUrl)
    setAvatarPreviewUrl(source.avatarPreviewUrl)
    setAvatarImageStorageId(undefined)
    setClearAvatarImage(false)
    setEmail(source.email)
    setEmailMentions(source.emailMentions)
    setEmailAssignments(source.emailAssignments)
    setEmailDigest(source.emailDigest)
  }, [
    source.avatarPreviewUrl,
    source.avatarUrl,
    source.email,
    source.emailAssignments,
    source.emailDigest,
    source.emailMentions,
    source.id,
    source.name,
    source.title,
  ])

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

  function handleAvatarClear() {
    setAvatarPreviewUrl(null)
    setAvatarImageStorageId(undefined)
    setClearAvatarImage(true)
  }

  return {
    avatarImageSrc: source.avatarImageSrc,
    avatarImageStorageId,
    avatarLimitState,
    avatarPreviewUrl,
    avatarUrl,
    canSaveProfile,
    clearAvatarImage,
    email,
    emailAssignments,
    emailDigest,
    emailMentions,
    handleAvatarClear,
    handleAvatarUpload,
    name,
    nameLimitState,
    setAvatarUrl,
    setEmail,
    setEmailAssignments,
    setEmailDigest,
    setEmailMentions,
    setName,
    setTitle,
    title,
    titleLimitState,
    uploadingAvatar,
  }
}

type UserProfileDraft = ReturnType<typeof useUserProfileDraft>

function useUserProfilePersistence({
  currentUser,
  draft,
  router,
  setTheme,
}: {
  currentUser: UserProfile | null
  draft: UserProfileDraft
  router: ReturnType<typeof useRouter>
  setTheme: ReturnType<typeof useTheme>["setTheme"]
}) {
  const profileSaveQueueRef = useRef(Promise.resolve())
  const latestThemeRequestIdRef = useRef(0)
  const currentUserId = currentUser?.id ?? null
  const currentUserThemePreference = currentUser?.preferences.theme ?? "system"
  const committedThemePreferenceRef = useRef<ThemePreference>(
    currentUserThemePreference
  )
  const committedProfileRef = useRef<PersistedProfileSnapshot | null>(
    createPersistedProfileSnapshot(currentUser)
  )
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    currentUser?.preferences.theme ?? "system"
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    committedProfileRef.current = createPersistedProfileSnapshot(currentUser)
  }, [currentUser])

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
        updateStoredThemePreference(currentUserId, nextTheme)
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
        name: draft.name,
        title: draft.title,
        avatarUrl: draft.avatarUrl,
        preferences: {
          emailMentions: draft.emailMentions,
          emailAssignments: draft.emailAssignments,
          emailDigest: draft.emailDigest,
          theme: themePreference,
        },
      }

      await queueProfileSave(async () => {
        await syncUpdateCurrentUserProfile(
          currentUser.id,
          draft.name,
          draft.title,
          draft.avatarUrl,
          {
            emailMentions: draft.emailMentions,
            emailAssignments: draft.emailAssignments,
            emailDigest: draft.emailDigest,
            theme: themePreference,
          },
          {
            ...(draft.avatarImageStorageId
              ? { avatarImageStorageId: draft.avatarImageStorageId }
              : {}),
            ...(draft.clearAvatarImage ? { clearAvatarImage: true } : {}),
          }
        )

        committedProfileRef.current = savedProfile
        committedThemePreferenceRef.current = themePreference
      })

      toast.success("Profile updated")
      setTheme(themePreference)
      updateStoredUserProfile({
        avatarUrl: draft.avatarUrl,
        clearAvatarImage: draft.clearAvatarImage,
        emailAssignments: draft.emailAssignments,
        emailDigest: draft.emailDigest,
        emailMentions: draft.emailMentions,
        name: draft.name,
        themePreference,
        title: draft.title,
        userId: currentUser.id,
      })
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

  return {
    handleSave,
    handleThemePreferenceChange,
    saving,
    themePreference,
  }
}

export function UserSettingsScreen() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const currentUser = useAppStore(getCurrentUser)
  const draft = useUserProfileDraft(currentUser)
  const persistence = useUserProfilePersistence({
    currentUser,
    draft,
    router,
    setTheme,
  })
  const accountActions = useUserAccountActions({
    currentUser,
    email: draft.email,
    router,
  })
  const deleteAccountBlockReason = useAppStore(selectDeleteAccountBlockReason)

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
      hero={
        <UserSettingsHero
          currentUser={currentUser}
          avatarImageSrc={draft.avatarImageSrc}
          themePreference={persistence.themePreference}
        />
      }
      footer={
        <Button
          disabled={persistence.saving || !draft.canSaveProfile}
          onClick={() => void persistence.handleSave()}
        >
          {persistence.saving ? "Saving..." : "Save profile"}
        </Button>
      }
    >
      <ProfileSettingsSection
        name={draft.name}
        title={draft.title}
        avatarUrl={draft.avatarUrl}
        avatarPreviewUrl={draft.avatarPreviewUrl}
        uploadingAvatar={draft.uploadingAvatar}
        nameLimitState={draft.nameLimitState}
        titleLimitState={draft.titleLimitState}
        avatarLimitState={draft.avatarLimitState}
        onAvatarClear={draft.handleAvatarClear}
        onAvatarUpload={draft.handleAvatarUpload}
        onNameChange={draft.setName}
        onTitleChange={draft.setTitle}
        onAvatarUrlChange={draft.setAvatarUrl}
      />

      <AppearanceSettingsSection
        themePreference={persistence.themePreference}
        onThemePreferenceChange={persistence.handleThemePreferenceChange}
      />

      <NotificationsSettingsSection
        emailMentions={draft.emailMentions}
        emailAssignments={draft.emailAssignments}
        emailDigest={draft.emailDigest}
        onEmailMentionsChange={draft.setEmailMentions}
        onEmailAssignmentsChange={draft.setEmailAssignments}
        onEmailDigestChange={draft.setEmailDigest}
      />

      <AccountEmailSettingsSection
        email={draft.email}
        changingEmail={accountActions.changingEmail}
        sendingPasswordReset={accountActions.sendingPasswordReset}
        onEmailChange={draft.setEmail}
        onChangeEmail={() => void accountActions.handleEmailChange()}
        onPasswordReset={() => void accountActions.handlePasswordReset()}
      />

      <DeleteAccountSettingsSection
        deleteAccountBlockReason={deleteAccountBlockReason}
        deleteDialogOpen={accountActions.deleteDialogOpen}
        deletingAccount={accountActions.deletingAccount}
        onConfirmDelete={() => void accountActions.handleDeleteAccount()}
        onDeleteDialogOpenChange={accountActions.setDeleteDialogOpen}
        onRequestDelete={() => accountActions.setDeleteDialogOpen(true)}
      />
    </SettingsScaffold>
  )
}

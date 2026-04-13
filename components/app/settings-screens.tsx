"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  ArrowsClockwise,
  Buildings,
  Camera,
  Check,
  CopySimple,
  SpinnerGap,
  Trash,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  canAdminTeam,
  getAccessibleTeams,
  getCurrentUser,
  getCurrentWorkspace,
  getTeamBySlug,
  getTeamFeatureSettings,
  getTeamSurfaceDisableReasons,
} from "@/lib/domain/selectors"
import {
  createDefaultTeamFeatureSettings,
  getDefaultTeamIconForExperience,
  normalizeTeamIconToken,
  teamExperienceMeta,
  teamExperienceTypes,
  teamIconMeta,
  teamIconTokens,
  type TeamFeatureSettings,
  type TeamExperienceType,
  type ThemePreference,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn, resolveImageAssetSource } from "@/lib/utils"
import { TeamIconGlyph } from "@/components/app/entity-icons"
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
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

const IMAGE_UPLOAD_MAX_SIZE = 10 * 1024 * 1024
const workspaceAccentOptions = [
  "emerald",
  "blue",
  "amber",
  "rose",
  "slate",
] as const
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

type TeamSurfaceDisableReasons = {
  docs: string | null
  chat: string | null
  channels: string | null
}

const defaultTeamSurfaceDisableReasons: TeamSurfaceDisableReasons = {
  docs: null,
  chat: null,
  channels: null,
}

function getUserInitials(name: string | null | undefined) {
  const parts = (name ?? "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
}

function getTeamLandingHref(teamSlug: string, features: TeamFeatureSettings) {
  if (features.issues) {
    return `/team/${teamSlug}/work`
  }

  if (features.chat) {
    return `/team/${teamSlug}/chat`
  }

  if (features.channels) {
    return `/team/${teamSlug}/channel`
  }

  if (features.docs) {
    return `/team/${teamSlug}/docs`
  }

  return `/team/${teamSlug}/work`
}

async function uploadSettingsImage(
  kind: "user-avatar" | "workspace-logo",
  file: File
) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file")
  }

  if (file.size > IMAGE_UPLOAD_MAX_SIZE) {
    throw new Error("Images must be 10 MB or smaller")
  }

  const uploadUrlResponse = await fetch("/api/settings-images/upload-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ kind }),
  })
  const uploadUrlPayload = (await uploadUrlResponse
    .json()
    .catch(() => null)) as {
    error?: string
    uploadUrl?: string
  } | null

  if (!uploadUrlResponse.ok || !uploadUrlPayload?.uploadUrl) {
    throw new Error(
      uploadUrlPayload?.error ?? "Failed to prepare the image upload"
    )
  }

  const storageResponse = await fetch(uploadUrlPayload.uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  })
  const storagePayload = (await storageResponse.json().catch(() => null)) as {
    storageId?: string
  } | null

  if (!storageResponse.ok || !storagePayload?.storageId) {
    throw new Error("Image upload failed")
  }

  return {
    storageId: storagePayload.storageId,
    previewUrl: URL.createObjectURL(file),
  }
}

function CollectionPaneHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle: string
  actions?: ReactNode
}) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="size-5 shrink-0" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}

function SettingsScaffold({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CollectionPaneHeader title={title} subtitle={subtitle} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-0 px-6 py-6">
          {children}
        </div>
      </div>
      {footer ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="border-b py-6 last:border-b-0">
      <h3 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 text-xs text-muted-foreground/70">{description}</p>
      ) : null}
      <div className="mt-3 flex flex-col">{children}</div>
    </section>
  )
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <span className="text-sm">{label}</span>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SummaryCard({
  eyebrow,
  title,
  description,
  preview,
  notes,
}: {
  eyebrow: string
  title: string
  description: string
  preview: ReactNode
  notes: string[]
}) {
  return (
    <div className="rounded-lg border border-border/70 p-4">
      <div className="text-[10px] font-medium tracking-wider text-muted-foreground/60 uppercase">
        {eyebrow}
      </div>
      <div className="mt-3 flex items-center gap-3">
        {preview}
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {description}
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground/70">
        {notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </div>
  )
}

function ImageUploadControl({
  title,
  description,
  imageSrc,
  preview,
  shape,
  disabled,
  uploading,
  onSelect,
  onClear,
}: {
  title: string
  description: string
  imageSrc: string | null
  preview: ReactNode
  shape: "circle" | "square"
  disabled?: boolean
  uploading?: boolean
  onSelect: (file: File) => Promise<void> | void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="flex items-center gap-4 py-2">
      <div
        className={cn(
          "flex size-12 shrink-0 items-center justify-center overflow-hidden border bg-muted/40",
          shape === "circle" ? "rounded-full" : "rounded-xl"
        )}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={title} className="size-full object-cover" src={imageSrc} />
        ) : (
          preview
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <SpinnerGap className="size-3.5 animate-spin" />
          ) : (
            <Camera className="size-3.5" />
          )}
          {uploading ? "Uploading..." : "Upload"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || (!imageSrc && !uploading)}
          onClick={onClear}
        >
          <Trash className="size-3.5" />
        </Button>
      </div>
      <input
        ref={inputRef}
        accept="image/*"
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""

          if (!file) {
            return
          }

          void onSelect(file)
        }}
      />
    </div>
  )
}

function TeamEditorFields({
  name,
  icon,
  summary,
  joinCode,
  experience,
  features,
  setName,
  setIcon,
  setSummary,
  setFeatures,
  savedFeatures,
  surfaceDisableReasons,
  canChangeExperience = false,
  disabled = false,
  onExperienceChange,
  onRegenerateJoinCode,
  joinCodeReadonlyLabel = "Generated automatically after the team is created.",
}: {
  name: string
  icon: string
  summary: string
  joinCode: string
  experience: TeamExperienceType
  features: TeamFeatureSettings
  setName: (value: string) => void
  setIcon: (value: string) => void
  setSummary: (value: string) => void
  setFeatures: (
    value:
      | TeamFeatureSettings
      | ((current: TeamFeatureSettings) => TeamFeatureSettings)
  ) => void
  savedFeatures: TeamFeatureSettings
  surfaceDisableReasons: TeamSurfaceDisableReasons
  canChangeExperience?: boolean
  disabled?: boolean
  onExperienceChange?: (experience: TeamExperienceType) => void
  onRegenerateJoinCode?: (() => Promise<void>) | null
  joinCodeReadonlyLabel?: string
}) {
  const selectedIcon = normalizeTeamIconToken(icon, experience)
  const copyResetTimeoutRef = useRef<number | null>(null)
  const [copiedJoinCode, setCopiedJoinCode] = useState<string | null>(null)
  const optionalFeatures = [
    {
      key: "docs" as const,
      label: "Docs",
      description: "Long-form team documents and collaborative writing.",
    },
    {
      key: "chat" as const,
      label: "Chat",
      description: "Real-time team conversation and quick coordination.",
    },
    {
      key: "channels" as const,
      label: "Channel",
      description: "Shared forum-style posts with replies for the full team.",
    },
  ]

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  async function handleCopyJoinCode() {
    if (!joinCode) {
      return
    }

    try {
      await navigator.clipboard.writeText(joinCode)
      setCopiedJoinCode(joinCode)

      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }

      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopiedJoinCode(null)
      }, 1500)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to copy join code"
      )
    }
  }

  return (
    <>
      <SettingsSection title="Identity">
        <SettingsRow label="Name">
          <Input
            id="team-name"
            className="h-8 w-56 text-xs"
            disabled={disabled}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </SettingsRow>
        <SettingsRow label="Icon">
          <Select
            disabled={disabled}
            value={selectedIcon}
            onValueChange={setIcon}
          >
            <SelectTrigger id="team-icon" className="h-8 w-56 text-xs">
              <div className="flex items-center gap-2">
                <TeamIconGlyph icon={selectedIcon} className="size-3.5" />
                <span>{teamIconMeta[selectedIcon].label}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {teamIconTokens.map((token) => (
                  <SelectItem key={token} value={token}>
                    <div className="flex items-center gap-2">
                      <TeamIconGlyph icon={token} className="size-4" />
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm">
                          {teamIconMeta[token].label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {teamIconMeta[token].description}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="Summary">
          <Textarea
            id="team-summary"
            className="h-20 w-56 resize-none text-xs"
            disabled={disabled}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </SettingsRow>
        <SettingsRow label="Join code">
          <div className="flex items-center gap-1.5">
            <code className="rounded bg-muted/50 px-2 py-1 font-mono text-xs">
              {joinCode || "Generated on create"}
            </code>
            {joinCode ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => void handleCopyJoinCode()}
              >
                {copiedJoinCode === joinCode ? (
                  <Check className="size-3.5" />
                ) : (
                  <CopySimple className="size-3.5" />
                )}
              </Button>
            ) : null}
            {onRegenerateJoinCode ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={disabled}
                onClick={() => void onRegenerateJoinCode()}
              >
                <ArrowsClockwise className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Team type" description={canChangeExperience ? "Locked after creation." : undefined}>
        {canChangeExperience ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {teamExperienceTypes.map((type) => {
              const selected = type === experience

              return (
                <button
                  key={type}
                  type="button"
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left transition-colors",
                    selected
                      ? "border-primary/40 bg-primary/5"
                      : "hover:bg-accent/40"
                  )}
                  disabled={disabled}
                  onClick={() => onExperienceChange?.(type)}
                >
                  <div className="text-sm font-medium">
                    {teamExperienceMeta[type].label}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {teamExperienceMeta[type].description}
                  </p>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg bg-muted/30 px-3 py-2.5">
            <div className="text-sm font-medium">
              {teamExperienceMeta[experience].label}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {teamExperienceMeta[experience].description}
            </p>
            <span className="mt-2 inline-block text-[10px] tracking-wider text-muted-foreground/70 uppercase">
              Locked after creation
            </span>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Surfaces" description={experience === "community" ? "Community spaces use one mode at a time." : "Software teams always keep issues, projects, and views."}>
        {experience === "community" ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  features.chat
                    ? "border-primary/40 bg-primary/5"
                    : "hover:bg-accent/40"
                )}
                disabled={
                  disabled ||
                  (savedFeatures.channels &&
                    Boolean(surfaceDisableReasons.channels))
                }
                onClick={() =>
                  setFeatures({
                    issues: false,
                    projects: false,
                    views: false,
                    docs: false,
                    chat: true,
                    channels: false,
                  })
                }
              >
                <div className="text-sm font-medium">Chat only</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Real-time conversation.
                </div>
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  features.channels
                    ? "border-primary/40 bg-primary/5"
                    : "hover:bg-accent/40"
                )}
                disabled={
                  disabled ||
                  (savedFeatures.chat &&
                    Boolean(surfaceDisableReasons.chat))
                }
                onClick={() =>
                  setFeatures({
                    issues: false,
                    projects: false,
                    views: false,
                    docs: false,
                    chat: false,
                    channels: true,
                  })
                }
              >
                <div className="text-sm font-medium">Channel only</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Forum posts with threaded replies.
                </div>
              </button>
            </div>
            {savedFeatures.chat && surfaceDisableReasons.chat ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {surfaceDisableReasons.chat}
              </p>
            ) : null}
            {savedFeatures.channels && surfaceDisableReasons.channels ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {surfaceDisableReasons.channels}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {["issues", "projects", "views"].map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs capitalize"
                >
                  {feature}
                  <Switch checked disabled className="scale-[0.6]" />
                </div>
              ))}
            </div>
            <div className="divide-y">
              {optionalFeatures.map((feature) => (
                <div
                  key={feature.key}
                  className="flex items-center justify-between gap-4 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm">{feature.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {feature.description}
                    </div>
                    {savedFeatures[feature.key] &&
                    surfaceDisableReasons[feature.key] ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {surfaceDisableReasons[feature.key]}
                      </div>
                    ) : null}
                  </div>
                  <Switch
                    checked={features[feature.key]}
                    disabled={
                      disabled ||
                      (savedFeatures[feature.key] &&
                        Boolean(surfaceDisableReasons[feature.key]))
                    }
                    onCheckedChange={(checked) =>
                      setFeatures((current) => ({
                        ...current,
                        issues: true,
                        projects: true,
                        views: true,
                        [feature.key]: checked,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </SettingsSection>
    </>
  )
}

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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_24rem]">
        <div className="space-y-6">
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
                  <FieldLabel htmlFor="profile-avatar">
                    Fallback badge
                  </FieldLabel>
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
                <Switch
                  checked={emailDigest}
                  onCheckedChange={setEmailDigest}
                />
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
        </div>

        <div className="space-y-6">
          <SummaryCard
            description="Settings now live in the same collection pane as your work, so profile updates are part of the normal app flow."
            eyebrow="Overview"
            notes={[
              "Profile images replace the old initials badge anywhere your avatar is shown.",
              "Fallback text still appears if the image is removed or cannot load.",
              "Email changes are handled separately because they pass through WorkOS verification.",
            ]}
            preview={
              <Avatar className="size-16" size="lg">
                {avatarPreviewUrl ? (
                  <AvatarImage alt={name} src={avatarPreviewUrl} />
                ) : null}
                <AvatarFallback>{getUserInitials(name)}</AvatarFallback>
              </Avatar>
            }
            title={name}
          />
        </div>
      </div>
    </SettingsScaffold>
  )
}

export function WorkspaceSettingsScreen() {
  const router = useRouter()
  const data = useAppStore()
  const workspace = getCurrentWorkspace(data)
  const teams = getAccessibleTeams(data)
  const canManageWorkspace = workspace
    ? teams.some(
        (team) =>
          team.workspaceId === workspace.id && canAdminTeam(data, team.id)
      )
    : false
  const currentLogoImageSrc = resolveImageAssetSource(
    workspace?.logoImageUrl,
    workspace?.logoUrl
  )
  const [name, setName] = useState(workspace?.name ?? "")
  const [logoUrl, setLogoUrl] = useState(workspace?.logoUrl ?? "")
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    currentLogoImageSrc ?? null
  )
  const [logoImageStorageId, setLogoImageStorageId] = useState<
    string | undefined
  >(undefined)
  const [clearLogoImage, setClearLogoImage] = useState(false)
  const [accent, setAccent] = useState(workspace?.settings.accent ?? "emerald")
  const [description, setDescription] = useState(
    workspace?.settings.description ?? ""
  )
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    if (!logoPreviewUrl?.startsWith("blob:")) {
      return
    }

    return () => {
      URL.revokeObjectURL(logoPreviewUrl)
    }
  }, [logoPreviewUrl])

  useEffect(() => {
    setName(workspace?.name ?? "")
    setLogoUrl(workspace?.logoUrl ?? "")
    setLogoPreviewUrl(
      resolveImageAssetSource(workspace?.logoImageUrl, workspace?.logoUrl) ??
        null
    )
    setLogoImageStorageId(undefined)
    setClearLogoImage(false)
    setAccent(workspace?.settings.accent ?? "emerald")
    setDescription(workspace?.settings.description ?? "")
  }, [workspace?.id])

  if (!workspace) {
    return (
      <SettingsScaffold
        title="Workspace settings"
        subtitle="Current workspace not found"
      >
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Workspace unavailable</CardTitle>
            <CardDescription>
              Select a workspace before opening workspace settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </SettingsScaffold>
    )
  }

  async function handleLogoUpload(file: File) {
    try {
      setUploadingLogo(true)
      const uploaded = await uploadSettingsImage("workspace-logo", file)
      setLogoPreviewUrl(uploaded.previewUrl)
      setLogoImageStorageId(uploaded.storageId)
      setClearLogoImage(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload logo"
      )
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      const response = await fetch("/api/workspace/current", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          logoUrl,
          ...(logoImageStorageId ? { logoImageStorageId } : {}),
          ...(clearLogoImage ? { clearLogoImage: true } : {}),
          accent,
          description,
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update workspace")
      }

      toast.success("Workspace updated")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : "Failed to update workspace"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsScaffold
      title="Workspace settings"
      subtitle={`${workspace.name} identity, branding, and defaults`}
      footer={
        <Button
          disabled={!canManageWorkspace || saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving..." : "Save workspace"}
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_24rem]">
        <div className="space-y-6">
          {!canManageWorkspace ? (
            <Card className="border-dashed shadow-none">
              <CardHeader>
                <CardTitle>Read-only access</CardTitle>
                <CardDescription>
                  You need workspace admin access to change branding or create
                  teams here.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <ImageUploadControl
            description="Replace the fallback badge anywhere the workspace mark appears."
            disabled={!canManageWorkspace}
            imageSrc={logoPreviewUrl}
            onClear={() => {
              setLogoPreviewUrl(null)
              setLogoImageStorageId(undefined)
              setClearLogoImage(true)
            }}
            onSelect={handleLogoUpload}
            preview={
              <span className="text-base font-semibold text-muted-foreground">
                {logoUrl}
              </span>
            }
            shape="square"
            title="Workspace logo"
            uploading={uploadingLogo}
          />

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Identity</CardTitle>
              <CardDescription>
                Control the name, fallback badge, and tone of the workspace
                shell.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="workspace-name">Name</FieldLabel>
                  <FieldContent>
                    <Input
                      id="workspace-name"
                      disabled={!canManageWorkspace}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="workspace-logo">
                    Fallback badge
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="workspace-logo"
                      disabled={!canManageWorkspace}
                      value={logoUrl}
                      onChange={(event) => setLogoUrl(event.target.value)}
                    />
                  </FieldContent>
                  <FieldDescription>
                    Used when no logo image is available.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Accent</FieldLabel>
                  <FieldContent>
                    <Select
                      disabled={!canManageWorkspace}
                      value={accent}
                      onValueChange={setAccent}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {workspaceAccentOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="workspace-description">
                    Description
                  </FieldLabel>
                  <FieldContent>
                    <Textarea
                      id="workspace-description"
                      className="min-h-24 resize-none"
                      disabled={!canManageWorkspace}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </FieldContent>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <SummaryCard
            description="Workspace settings now open in the main collection pane instead of covering the rest of the app."
            eyebrow="Workspace"
            notes={[
              "Logo uploads replace the initials block in the sidebar and workspace menus.",
              "Fallback badge text is still stored so the workspace always has a readable mark.",
              "The create-team flow now uses this same content area instead of a modal.",
            ]}
            preview={
              <div className="flex size-16 items-center justify-center overflow-hidden rounded-2xl border bg-muted/40">
                {logoPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={workspace.name}
                    className="size-full object-cover"
                    src={logoPreviewUrl}
                  />
                ) : (
                  <span className="text-base font-semibold text-muted-foreground">
                    {logoUrl}
                  </span>
                )}
              </div>
            }
            title={name}
          />
        </div>
      </div>
    </SettingsScaffold>
  )
}

export function TeamSettingsScreen({ teamSlug }: { teamSlug: string }) {
  const data = useAppStore()
  const team = getTeamBySlug(data, teamSlug)
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const experience: TeamExperienceType =
    team?.settings.experience ?? "software-development"
  const [name, setName] = useState(team?.name ?? "")
  const [icon, setIcon] = useState(() =>
    normalizeTeamIconToken(team?.icon, experience)
  )
  const [summary, setSummary] = useState(team?.settings.summary ?? "")
  const [features, setFeatures] = useState<TeamFeatureSettings>(
    team?.settings.features ?? getTeamFeatureSettings(team)
  )

  if (!team) {
    return (
      <SettingsScaffold
        title="Team settings"
        subtitle="Requested team not found"
      >
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Team unavailable</CardTitle>
            <CardDescription>
              The requested team does not exist in the current workspace.
            </CardDescription>
          </CardHeader>
        </Card>
      </SettingsScaffold>
    )
  }

  const canManageTeam = canAdminTeam(data, team.id)
  const savedFeatures = getTeamFeatureSettings(team)
  const surfaceDisableReasons = getTeamSurfaceDisableReasons(data, team.id)

  return (
    <SettingsScaffold
      title="Team settings"
      subtitle={`${team.name} configuration and surface access`}
      footer={
        <Button
          disabled={!canManageTeam || saving}
          onClick={async () => {
            setSaving(true)
            const updated = await useAppStore
              .getState()
              .updateTeamDetails(team.id, {
                name,
                icon,
                summary,
                experience,
                features,
              })
            setSaving(false)

            if (updated) {
              router.refresh()
            }
          }}
        >
          {saving ? "Saving..." : "Save team"}
        </Button>
      }
    >
      {!canManageTeam ? (
        <Card className="border-dashed shadow-none">
          <CardHeader>
            <CardTitle>Read-only access</CardTitle>
            <CardDescription>
              Only team admins can change these settings.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card className="shadow-none">
        <CardHeader className="gap-2 border-b">
          <CardTitle>{team.name}</CardTitle>
          <CardDescription>
            {teamExperienceMeta[experience].label}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <TeamEditorFields
            canChangeExperience={false}
            disabled={!canManageTeam}
            experience={experience}
            features={features}
            icon={icon}
            joinCode={team.settings.joinCode}
            joinCodeReadonlyLabel="This 12-character code is stored on the team and can be regenerated at any time."
            name={name}
            onRegenerateJoinCode={async () => {
              await useAppStore.getState().regenerateTeamJoinCode(team.id)
            }}
            savedFeatures={savedFeatures}
            setFeatures={setFeatures}
            setIcon={(value) =>
              setIcon(normalizeTeamIconToken(value, experience))
            }
            setName={setName}
            setSummary={setSummary}
            summary={summary}
            surfaceDisableReasons={surfaceDisableReasons}
          />
        </CardContent>
      </Card>
    </SettingsScaffold>
  )
}

export function CreateTeamScreen() {
  const router = useRouter()
  const data = useAppStore()
  const workspace = getCurrentWorkspace(data)
  const teams = getAccessibleTeams(data)
  const canCreateTeam = workspace
    ? teams.some(
        (team) =>
          team.workspaceId === workspace.id && canAdminTeam(data, team.id)
      )
    : false
  const [name, setName] = useState("")
  const [icon, setIcon] = useState(() =>
    getDefaultTeamIconForExperience("software-development")
  )
  const [summary, setSummary] = useState("")
  const [experience, setExperience] = useState<TeamExperienceType>(
    "software-development"
  )
  const [features, setFeatures] = useState<TeamFeatureSettings>(
    createDefaultTeamFeatureSettings("software-development")
  )
  const [saving, setSaving] = useState(false)

  if (!workspace) {
    return (
      <SettingsScaffold
        title="Create team"
        subtitle="Current workspace not found"
      >
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Workspace unavailable</CardTitle>
            <CardDescription>
              Select a workspace before creating a team.
            </CardDescription>
          </CardHeader>
        </Card>
      </SettingsScaffold>
    )
  }

  return (
    <SettingsScaffold
      title="Create team"
      subtitle={`Add a new team inside ${workspace.name}`}
      footer={
        <Button
          disabled={!canCreateTeam || saving}
          onClick={async () => {
            setSaving(true)
            const created = await useAppStore.getState().createTeam({
              name,
              icon,
              summary,
              experience,
              features,
            })
            setSaving(false)

            if (created) {
              router.push(
                getTeamLandingHref(created.teamSlug, created.features)
              )
            }
          }}
        >
          {saving ? "Creating..." : "Create team"}
        </Button>
      }
    >
      {!canCreateTeam ? (
        <Card className="border-dashed shadow-none">
          <CardHeader>
            <CardTitle>Read-only access</CardTitle>
            <CardDescription>
              You need workspace admin access to create a new team.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="shadow-none">
          <CardContent className="pt-6">
            <TeamEditorFields
              canChangeExperience
              disabled={!canCreateTeam}
              experience={experience}
              features={features}
              icon={icon}
              joinCode=""
              joinCodeReadonlyLabel="A 12-character join code is generated automatically when the team is created."
              name={name}
              savedFeatures={features}
              setFeatures={setFeatures}
              setIcon={(value) =>
                setIcon(normalizeTeamIconToken(value, experience))
              }
              setName={setName}
              setSummary={setSummary}
              summary={summary}
              surfaceDisableReasons={defaultTeamSurfaceDisableReasons}
              onExperienceChange={(nextExperience) => {
                setExperience(nextExperience)
                setIcon(getDefaultTeamIconForExperience(nextExperience))
                setFeatures(createDefaultTeamFeatureSettings(nextExperience))
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <SummaryCard
            description="Team creation now uses the same container as projects, docs, and channels so setup never hides the rest of the workspace."
            eyebrow="Workspace"
            notes={[
              "Team type still controls which collaboration surfaces are available.",
              "The join code is created automatically after the team is saved.",
              "You land directly in the new team after creation.",
            ]}
            preview={
              <div className="flex size-16 items-center justify-center rounded-2xl border bg-muted/40">
                <TeamIconGlyph
                  icon={icon}
                  className="size-7 text-muted-foreground"
                />
              </div>
            }
            title={name || "New team"}
          />
        </div>
      </div>
    </SettingsScaffold>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowsClockwise,
  Check,
  CopySimple,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  getDefaultWorkItemTypesForTeamExperience,
  getDisplayLabelForWorkItemType,
  getWorkSurfaceCopy,
  normalizeTeamIconToken,
  teamExperienceMeta,
  teamExperienceTypes,
  teamIconMeta,
  type TeamFeatureSettings,
  type TeamExperienceType,
} from "@/lib/domain/types"
import { cn } from "@/lib/utils"
import { TeamIconGlyph } from "@/components/app/entity-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

import { SettingsRow, SettingsSection } from "./shared"

export type TeamSurfaceDisableReasons = {
  docs: string | null
  chat: string | null
  channels: string | null
}

export const defaultTeamSurfaceDisableReasons: TeamSurfaceDisableReasons = {
  docs: null,
  chat: null,
  channels: null,
}

type TeamEditorFieldsProps = {
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
}

export function TeamEditorFields({
  name,
  icon,
  summary,
  joinCode,
  experience,
  features,
  setName,
  setIcon: _setIcon,
  setSummary,
  setFeatures,
  savedFeatures,
  surfaceDisableReasons,
  canChangeExperience = false,
  disabled = false,
  onExperienceChange,
  onRegenerateJoinCode,
  joinCodeReadonlyLabel:
    _joinCodeReadonlyLabel = "Generated automatically after the team is created.",
}: TeamEditorFieldsProps) {
  const selectedIcon = normalizeTeamIconToken(icon, experience)
  const workCopy = getWorkSurfaceCopy(experience)
  const coreSurfaceItems = [
    { key: "issues", label: workCopy.surfaceLabel },
    { key: "projects", label: "Projects" },
    { key: "views", label: "Views" },
  ]
  const coreWorkModel = getDefaultWorkItemTypesForTeamExperience(experience)
    .map((itemType) => getDisplayLabelForWorkItemType(itemType, experience))
    .join(" · ")
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
        <div className="flex items-center gap-3 py-2">
          <div className="w-24 shrink-0">
            <span className="text-sm">Name</span>
          </div>
          <div className="min-w-0 flex-[7]">
            <Input
              id="team-name"
              className="h-8 w-full text-xs"
              disabled={disabled}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">Icon</span>
          <div className="min-w-0 flex-[3]">
            <div className="flex h-8 w-full items-center rounded-md border border-input bg-background px-3 text-xs">
              <div className="flex items-center gap-2">
                <TeamIconGlyph icon={selectedIcon} className="size-3.5" />
                <span>{teamIconMeta[selectedIcon].label}</span>
              </div>
            </div>
          </div>
        </div>
        <SettingsRow label="Summary">
          <Textarea
            id="team-summary"
            className="h-20 w-full resize-none text-xs"
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

      <SettingsSection
        title="Team type"
        description={canChangeExperience ? "Locked after creation." : undefined}
      >
        {canChangeExperience ? (
          <div className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {teamExperienceTypes.map((type) => {
              const selected = type === experience

              return (
                <button
                  key={type}
                  type="button"
                  className={cn(
                    "flex h-full flex-col items-start justify-start rounded-lg border px-2.5 py-2 text-left align-top transition-colors",
                    selected
                      ? "border-primary/40 bg-primary/5"
                      : "hover:bg-accent/40"
                  )}
                  disabled={disabled}
                  onClick={() => onExperienceChange?.(type)}
                >
                  <div className="text-[13px] font-medium">
                    {teamExperienceMeta[type].label}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
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

      <SettingsSection
        title="Surfaces"
        description={
          experience === "community"
            ? "Community spaces can enable chat, channel, or both."
            : `${workCopy.surfaceLabel}, projects, and views are always enabled for this team type.`
        }
      >
        {experience === "community" ? (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              {/*
                Community surface cards are mutually exclusive visually:
                only the exact active configuration should appear selected.
              */}
              <button
                type="button"
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  features.chat && !features.channels
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
                  !features.chat && features.channels
                    ? "border-primary/40 bg-primary/5"
                    : "hover:bg-accent/40"
                )}
                disabled={
                  disabled ||
                  (savedFeatures.chat && Boolean(surfaceDisableReasons.chat))
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
              <button
                type="button"
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  features.chat && features.channels
                    ? "border-primary/40 bg-primary/5"
                    : "hover:bg-accent/40"
                )}
                disabled={disabled}
                onClick={() =>
                  setFeatures({
                    issues: false,
                    projects: false,
                    views: false,
                    docs: false,
                    chat: true,
                    channels: true,
                  })
                }
              >
                <div className="text-sm font-medium">Chat + channel</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Enable both conversation modes.
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
              {coreSurfaceItems.map((feature) => (
                <div
                  key={feature.key}
                  className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs capitalize"
                >
                  {feature.label}
                  <Switch checked disabled className="scale-[0.6]" />
                </div>
              ))}
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Core model: {coreWorkModel}
            </p>
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

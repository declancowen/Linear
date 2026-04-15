"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowsClockwise,
  Check,
  CheckCircle,
  CopySimple,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  getDefaultTeamIconForExperience,
  getDefaultWorkItemTypesForTeamExperience,
  getDisplayLabelForWorkItemType,
  getWorkSurfaceCopy,
  normalizeTeamIconToken,
  teamExperienceMeta,
  teamExperienceTypes,
  teamFeatureMeta,
  teamIconMeta,
  teamIconTokens,
  type TeamExperienceType,
  type TeamFeatureSettings,
} from "@/lib/domain/types"
import { cn } from "@/lib/utils"
import { TeamIconGlyph } from "@/components/app/entity-icons"
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
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { SettingsSection, SettingsToggleRow } from "./shared"

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
  showJoinCode?: boolean
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
  setIcon,
  setSummary,
  setFeatures,
  savedFeatures,
  surfaceDisableReasons,
  canChangeExperience = false,
  disabled = false,
  showJoinCode = true,
  onExperienceChange,
  onRegenerateJoinCode,
  joinCodeReadonlyLabel = "Generated automatically after creation.",
}: TeamEditorFieldsProps) {
  const selectedIcon = normalizeTeamIconToken(icon, experience)
  const workCopy = getWorkSurfaceCopy(experience)
  const coreSurfaceItems: Array<{
    key: "issues" | "projects" | "views"
    label: string
    description: string
  }> = [
    {
      key: "issues",
      label: workCopy.surfaceLabel,
      description: teamFeatureMeta.issues.description,
    },
    {
      key: "projects",
      label: "Projects",
      description: teamFeatureMeta.projects.description,
    },
    {
      key: "views",
      label: "Views",
      description: teamFeatureMeta.views.description,
    },
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
      description: teamFeatureMeta.docs.description,
    },
    {
      key: "chat" as const,
      label: "Chat",
      description: teamFeatureMeta.chat.description,
    },
    {
      key: "channels" as const,
      label: "Channel",
      description: teamFeatureMeta.channels.description,
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
      <SettingsSection
        title="Identity"
        description="Name, icon, and summary for this team."
      >
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="team-name">Name</FieldLabel>
            <FieldContent>
              <Input
                id="team-name"
                disabled={disabled}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="team-icon">Icon</FieldLabel>
            <FieldContent>
              <Select
                disabled={disabled}
                value={selectedIcon}
                onValueChange={setIcon}
              >
                <SelectTrigger id="team-icon" className="w-full justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <TeamIconGlyph icon={selectedIcon} className="size-4" />
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
            </FieldContent>
            <FieldDescription>
              Defaults to{" "}
              {teamIconMeta[getDefaultTeamIconForExperience(experience)].label}{" "}
              for {teamExperienceMeta[experience].label.toLowerCase()} teams.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="team-summary">Summary</FieldLabel>
            <FieldContent>
              <Textarea
                id="team-summary"
                className="min-h-24 resize-none"
                disabled={disabled}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </FieldContent>
            <FieldDescription>
              A short description of what this team works on.
            </FieldDescription>
          </Field>
          {showJoinCode ? (
            <Field>
              <FieldLabel>Join code</FieldLabel>
              <FieldContent>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="inline-flex min-h-10 items-center rounded-lg border bg-muted/50 px-3 font-mono text-sm">
                    {joinCode || "Generated on create"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {joinCode ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleCopyJoinCode()}
                      >
                        {copiedJoinCode === joinCode ? (
                          <Check className="size-3.5" />
                        ) : (
                          <CopySimple className="size-3.5" />
                        )}
                        {copiedJoinCode === joinCode ? "Copied" : "Copy"}
                      </Button>
                    ) : null}
                    {onRegenerateJoinCode ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        onClick={() => void onRegenerateJoinCode()}
                      >
                        <ArrowsClockwise className="size-3.5" />
                        Regenerate
                      </Button>
                    ) : null}
                  </div>
                </div>
              </FieldContent>
              <FieldDescription>{joinCodeReadonlyLabel}</FieldDescription>
            </Field>
          ) : null}
        </FieldGroup>
      </SettingsSection>

      <SettingsSection
        title="Team type"
        description={
          canChangeExperience
            ? "Choose the work model for this team. It locks after creation."
            : "This team's work model determines the default language and surfaces."
        }
      >
        {canChangeExperience ? (
          <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {teamExperienceTypes.map((type) => {
              const selected = type === experience

              return (
                <button
                  key={type}
                  type="button"
                  className={cn(
                    "flex h-full flex-col items-start justify-start rounded-xl border p-4 text-left align-top transition-colors",
                    selected
                      ? "border-primary/40 bg-primary/5 shadow-sm"
                      : "hover:bg-accent/40"
                  )}
                  disabled={disabled}
                  onClick={() => onExperienceChange?.(type)}
                >
                  <div className="text-sm font-medium">
                    {teamExperienceMeta[type].label}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {teamExperienceMeta[type].description}
                  </p>
                </button>
              )
            })}
          </div>
        ) : (
          <div>
            <div className="text-sm font-medium">
              {teamExperienceMeta[experience].label}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {teamExperienceMeta[experience].description}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Locked after creation
            </p>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Surfaces"
        description={
          experience === "community"
            ? "Community spaces can enable docs, chat, channel, or any combination."
            : `${workCopy.surfaceLabel}, projects, and views are always enabled for this team type.`
        }
      >
        {experience === "community" ? (
          <div className="divide-y">
            {optionalFeatures.map((feature) => (
              <div key={feature.key} className="py-3 first:pt-0 last:pb-0">
                <SettingsToggleRow
                  checked={features[feature.key]}
                  description={feature.description}
                  disabled={
                    disabled ||
                    (savedFeatures[feature.key] &&
                      Boolean(surfaceDisableReasons[feature.key]))
                  }
                  note={
                    savedFeatures[feature.key]
                      ? surfaceDisableReasons[feature.key]
                      : null
                  }
                  title={feature.label}
                  onCheckedChange={(checked) =>
                    setFeatures((current) => ({
                      ...current,
                      issues: false,
                      projects: false,
                      views: false,
                      [feature.key]: checked,
                    }))
                  }
                />
              </div>
            ))}
            {!(features.docs || features.chat || features.channels) ? (
              <div className="pt-3 text-sm leading-relaxed text-muted-foreground">
                Enable at least one surface for community teams.
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            <div className="space-y-3">
              {coreSurfaceItems.map((feature) => (
                <div key={feature.key} className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CheckCircle className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{feature.label}</div>
                    <div className="text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Core model: {coreWorkModel}
            </p>

            <div className="mt-6 divide-y">
              {optionalFeatures.map((feature) => (
                <div key={feature.key} className="py-3 first:pt-0 last:pb-0">
                  <SettingsToggleRow
                    checked={features[feature.key]}
                    description={feature.description}
                    disabled={
                      disabled ||
                      (savedFeatures[feature.key] &&
                        Boolean(surfaceDisableReasons[feature.key]))
                    }
                    note={
                      savedFeatures[feature.key]
                        ? surfaceDisableReasons[feature.key]
                        : null
                    }
                    title={feature.label}
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
          </div>
        )}
      </SettingsSection>
    </>
  )
}

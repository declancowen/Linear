"use client"

import { useState } from "react"

import { ArrowsClockwise, Check, CopySimple } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  getTextInputLimitState,
  teamNameConstraints,
  teamSummaryConstraints,
} from "@/lib/domain/input-constraints"
import {
  getDefaultTeamIconForExperience,
  getDefaultWorkItemTypesForTeamExperience,
  getDisplayLabelForWorkItemType,
  getWorkSurfaceCopy,
  normalizeTeamIconToken,
  type TeamExperienceType,
  type TeamFeatureSettings,
  teamExperienceMeta,
  teamExperienceTypes,
  teamIconMeta,
  teamIconTokens,
} from "@/lib/domain/types"
import { cn } from "@/lib/utils"
import { TeamIconGlyph } from "@/components/app/entity-icons"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

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

export function getTeamLandingHref(
  teamSlug: string,
  features: TeamFeatureSettings
) {
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
  disabled = false,
  canChangeExperience = false,
  showJoinCode = true,
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
  disabled?: boolean
  canChangeExperience?: boolean
  showJoinCode?: boolean
  onExperienceChange?: (experience: TeamExperienceType) => void
  onRegenerateJoinCode?: (() => Promise<void>) | null
  joinCodeReadonlyLabel?: string
}) {
  const selectedIcon = normalizeTeamIconToken(icon, experience)
  const nameLimitState = getTextInputLimitState(name, teamNameConstraints)
  const summaryLimitState = getTextInputLimitState(
    summary,
    teamSummaryConstraints
  )
  const workCopy = getWorkSurfaceCopy(experience)
  const coreSurfaceItems = [
    { key: "issues", label: workCopy.surfaceLabel },
    { key: "projects", label: "Projects" },
    { key: "views", label: "Views" },
  ]
  const coreWorkModel = getDefaultWorkItemTypesForTeamExperience(experience)
    .map((itemType) => getDisplayLabelForWorkItemType(itemType, experience))
    .join(" · ")
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

  async function handleCopyJoinCode() {
    if (!joinCode) {
      return
    }

    try {
      await navigator.clipboard.writeText(joinCode)
      setCopiedJoinCode(joinCode)
      window.setTimeout(() => {
        setCopiedJoinCode(null)
      }, 1500)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to copy join code"
      )
    }
  }

  return (
    <div className="grid gap-8 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
      <div className="flex flex-col gap-8">
        <section>
          <h3 className="mb-4 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Identity
          </h3>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="team-name">Name</FieldLabel>
                <FieldContent>
                  <Input
                    id="team-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={teamNameConstraints.max}
                  />
                  <FieldCharacterLimit
                    state={nameLimitState}
                    limit={teamNameConstraints.max}
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="team-icon">Icon</FieldLabel>
                <FieldContent>
                  <Select value={selectedIcon} onValueChange={setIcon}>
                    <SelectTrigger id="team-icon" className="justify-between">
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
                  {
                    teamIconMeta[getDefaultTeamIconForExperience(experience)]
                      .label
                  }{" "}
                  for {teamExperienceMeta[experience].label.toLowerCase()} teams.
                </FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="team-summary">Summary</FieldLabel>
              <FieldContent>
                <Textarea
                  id="team-summary"
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  maxLength={teamSummaryConstraints.max}
                  className="min-h-24 resize-none"
                />
                <FieldCharacterLimit
                  state={summaryLimitState}
                  limit={teamSummaryConstraints.max}
                />
              </FieldContent>
              <FieldDescription>
                Used in team discovery and sidebars.
              </FieldDescription>
            </Field>
            {showJoinCode ? (
              <Field>
                <FieldLabel htmlFor="team-join-code">Join code</FieldLabel>
                <FieldContent>
                  <div className="flex gap-2">
                    <Input
                      id="team-join-code"
                      value={joinCode || "Generated on create"}
                      readOnly
                    />
                    {joinCode ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleCopyJoinCode()}
                      >
                        {copiedJoinCode === joinCode ? (
                          <Check />
                        ) : (
                          <CopySimple />
                        )}
                        {copiedJoinCode === joinCode ? "Copied" : "Copy"}
                      </Button>
                    ) : null}
                    {onRegenerateJoinCode ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void onRegenerateJoinCode()}
                      >
                        <ArrowsClockwise />
                        Regenerate
                      </Button>
                    ) : null}
                  </div>
                </FieldContent>
                <FieldDescription>{joinCodeReadonlyLabel}</FieldDescription>
              </Field>
            ) : null}
          </FieldGroup>
        </section>

        <section>
          <h3 className="mb-4 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Surfaces
          </h3>
          {experience === "community" ? (
            <div className="divide-y">
              {optionalFeatures.map((feature) => (
                <div
                  key={feature.key}
                  className="flex items-center justify-between gap-4 py-3"
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
                <div className="pt-3 text-xs text-muted-foreground">
                  Enable at least one surface for community teams.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {coreSurfaceItems.map((feature) => (
                  <div
                    key={feature.key}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5"
                  >
                    <span className="text-sm">{feature.label}</span>
                    <Switch checked disabled className="scale-75" />
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Core model: {coreWorkModel}
              </p>

              <div className="divide-y">
                {optionalFeatures.map((feature) => (
                  <div
                    key={feature.key}
                    className="flex items-center justify-between gap-4 py-3"
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
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-8">
        <section>
          <h3 className="mb-4 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Team type
          </h3>
          {canChangeExperience ? (
            <div className="space-y-3">
              {teamExperienceTypes.map((type) => {
                const selected = type === experience

                return (
                  <button
                    key={type}
                    type="button"
                    className={cn(
                      "w-full rounded-lg border px-4 py-3 text-left transition-colors",
                      selected
                        ? "border-primary/40 bg-primary/5"
                        : "hover:bg-accent/40"
                    )}
                    onClick={() => onExperienceChange?.(type)}
                  >
                    <div className="text-sm font-medium">
                      {teamExperienceMeta[type].label}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {teamExperienceMeta[type].description}
                    </p>
                  </button>
                )
              })}
              <span className="inline-block text-[10px] tracking-wider text-muted-foreground/70 uppercase">
                Locked after creation
              </span>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/30 px-4 py-3">
              <div className="text-sm font-medium">
                {teamExperienceMeta[experience].label}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {teamExperienceMeta[experience].description}
              </p>
              <span className="mt-3 inline-block text-[10px] tracking-wider text-muted-foreground/70 uppercase">
                Locked after creation
              </span>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-4 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Notes
          </h3>
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>
              {workCopy.surfaceLabel}, projects, and views stay on for this team
              type.
            </p>
            <p>
              Community spaces can enable docs, chat, channel, or any
              combination.
            </p>
            <p>Docs remain optional for non-community teams.</p>
          </div>
        </section>
      </div>
    </div>
  )
}

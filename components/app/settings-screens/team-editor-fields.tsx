"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowsClockwise,
  BugBeetle,
  Check,
  CodesandboxLogo,
  CopySimple,
  Kanban,
  UsersThree,
  type IconProps,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  getTextInputLimitState,
  teamSummaryConstraints,
  type TextInputConstraint,
} from "@/lib/domain/input-constraints"
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
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import {
  SettingsRow,
  SettingsRowGroup,
  SettingsSection,
  SettingsToggleRow,
} from "./shared"

import type { ComponentType } from "react"

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

const experienceIconComponents: Record<
  TeamExperienceType,
  ComponentType<IconProps>
> = {
  "software-development": CodesandboxLogo,
  "issue-analysis": BugBeetle,
  "project-management": Kanban,
  community: UsersThree,
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
  summaryConstraints?: TextInputConstraint
  surfaceDisableReasons: TeamSurfaceDisableReasons
  canChangeExperience?: boolean
  disabled?: boolean
  showJoinCode?: boolean
  onExperienceChange?: (experience: TeamExperienceType) => void
  onRegenerateJoinCode?: (() => Promise<void>) | null
  joinCodeReadonlyLabel?: string
}

function TeamJoinCodeControl({
  copiedJoinCode,
  disabled,
  joinCode,
  onCopyJoinCode,
  onRegenerateJoinCode,
}: {
  copiedJoinCode: string | null
  disabled: boolean
  joinCode: string
  onCopyJoinCode: () => void
  onRegenerateJoinCode?: (() => Promise<void>) | null
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="inline-flex h-9 min-w-44 items-center rounded-lg border border-line-soft bg-surface-2 px-3 font-mono text-[12.5px] tracking-wider text-foreground">
        {joinCode || "Generated on create"}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {joinCode ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopyJoinCode}
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
            size="sm"
            disabled={disabled}
            onClick={() => void onRegenerateJoinCode()}
          >
            <ArrowsClockwise className="size-3.5" />
            Regenerate
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function TeamIdentitySection({
  copiedJoinCode,
  disabled,
  experience,
  joinCode,
  joinCodeReadonlyLabel,
  name,
  selectedIcon,
  showJoinCode,
  summary,
  summaryConstraints,
  summaryLimitState,
  onCopyJoinCode,
  onRegenerateJoinCode,
  setIcon,
  setName,
  setSummary,
}: Pick<
  TeamEditorFieldsProps,
  | "disabled"
  | "experience"
  | "joinCode"
  | "joinCodeReadonlyLabel"
  | "name"
  | "onRegenerateJoinCode"
  | "setIcon"
  | "setName"
  | "setSummary"
  | "showJoinCode"
  | "summary"
  | "summaryConstraints"
> & {
  copiedJoinCode: string | null
  selectedIcon: ReturnType<typeof normalizeTeamIconToken>
  summaryLimitState: ReturnType<typeof getTextInputLimitState>
  onCopyJoinCode: () => void
}) {
  return (
    <SettingsSection
      title="Identity"
      description="Name, icon, and summary for this team."
      variant="plain"
    >
      <SettingsRowGroup>
        <SettingsRow
          label="Name"
          description="Visible everywhere the team appears."
          alignment="center"
          control={
            <Input
              id="team-name"
              disabled={disabled}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          }
        />
        <SettingsRow
          label="Icon"
          description={`Defaults to ${
            teamIconMeta[getDefaultTeamIconForExperience(experience)].label
          } for ${teamExperienceMeta[experience].label.toLowerCase()} teams.`}
          alignment="center"
          control={
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
          }
        />
        <SettingsRow
          label="Summary"
          description="A short description of what this team works on."
          control={
            <div>
              <Textarea
                id="team-summary"
                className="min-h-24 resize-none"
                disabled={disabled}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                maxLength={summaryConstraints?.max}
              />
              <FieldCharacterLimit
                state={summaryLimitState}
                limit={summaryConstraints?.max ?? teamSummaryConstraints.max}
              />
            </div>
          }
        />
        {showJoinCode ? (
          <SettingsRow
            label="Join code"
            description={joinCodeReadonlyLabel}
            control={
              <TeamJoinCodeControl
                copiedJoinCode={copiedJoinCode}
                disabled={Boolean(disabled)}
                joinCode={joinCode}
                onCopyJoinCode={onCopyJoinCode}
                onRegenerateJoinCode={onRegenerateJoinCode}
              />
            }
          />
        ) : null}
      </SettingsRowGroup>
    </SettingsSection>
  )
}

function TeamExperienceSection({
  canChangeExperience,
  disabled,
  experience,
  onExperienceChange,
}: Pick<
  TeamEditorFieldsProps,
  "canChangeExperience" | "disabled" | "experience" | "onExperienceChange"
>) {
  return (
    <SettingsSection
      title="Team type"
      description={
        canChangeExperience
          ? "Choose the work model for this team. It locks after creation."
          : "Locked after creation. Determines default surfaces and work item language."
      }
      variant="plain"
    >
      {canChangeExperience ? (
        <div className="grid items-stretch gap-2 sm:grid-cols-2">
          {teamExperienceTypes.map((type) => {
            const selected = type === experience
            const Icon = experienceIconComponents[type]

            return (
              <button
                key={type}
                type="button"
                className={cn(
                  "group relative flex h-full flex-col items-start gap-3 rounded-xl border bg-surface p-4 text-left transition-all",
                  selected
                    ? "border-primary/40 bg-primary/[0.04] shadow-[0_0_0_1px_var(--primary)]/[0.18]"
                    : "border-line hover:border-line hover:bg-surface-2"
                )}
                disabled={disabled}
                onClick={() => onExperienceChange?.(type)}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                      selected
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-line-soft bg-surface-2 text-fg-2 group-hover:bg-surface-3"
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  {selected ? (
                    <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-2.5" weight="bold" />
                    </span>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <div className="text-[13.5px] font-semibold tracking-tight">
                    {teamExperienceMeta[type].label}
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                    {teamExperienceMeta[type].description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <SettingsRowGroup>
          <SettingsRow
            label={teamExperienceMeta[experience].label}
            description={teamExperienceMeta[experience].description}
            alignment="center"
            control={
              <div className="flex justify-end">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-fg-2">
                  Locked after creation
                </span>
              </div>
            }
          />
        </SettingsRowGroup>
      )}
    </SettingsSection>
  )
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
  summaryConstraints = teamSummaryConstraints,
  surfaceDisableReasons,
  canChangeExperience = false,
  disabled = false,
  showJoinCode = true,
  onExperienceChange,
  onRegenerateJoinCode,
  joinCodeReadonlyLabel = "Generated automatically after creation.",
}: TeamEditorFieldsProps) {
  const selectedIcon = normalizeTeamIconToken(icon, experience)
  const summaryLimitState = getTextInputLimitState(summary, summaryConstraints)
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
      <TeamIdentitySection
        copiedJoinCode={copiedJoinCode}
        disabled={disabled}
        experience={experience}
        joinCode={joinCode}
        joinCodeReadonlyLabel={joinCodeReadonlyLabel}
        name={name}
        selectedIcon={selectedIcon}
        showJoinCode={showJoinCode}
        summary={summary}
        summaryConstraints={summaryConstraints}
        summaryLimitState={summaryLimitState}
        onCopyJoinCode={() => void handleCopyJoinCode()}
        onRegenerateJoinCode={onRegenerateJoinCode}
        setIcon={setIcon}
        setName={setName}
        setSummary={setSummary}
      />

      <TeamExperienceSection
        canChangeExperience={canChangeExperience}
        disabled={disabled}
        experience={experience}
        onExperienceChange={onExperienceChange}
      />

      <SettingsSection
        title="Surfaces"
        description={
          experience === "community"
            ? "Community spaces can enable docs, chat, channel, or any combination."
            : `${workCopy.surfaceLabel}, projects, and views are always enabled. Toggle the optional surfaces below.`
        }
        variant="plain"
      >
        {experience === "community" ? null : (
          <SettingsRowGroup>
            {coreSurfaceItems.map((feature) => (
              <SettingsRow
                key={feature.key}
                label={
                  <div className="flex items-center gap-2">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-2.5" weight="bold" />
                    </span>
                    <span>{feature.label}</span>
                  </div>
                }
                description={feature.description}
                alignment="center"
                control={
                  <div className="flex justify-end">
                    <span className="inline-flex items-center rounded-full border border-line-soft bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-fg-2">
                      Always on
                    </span>
                  </div>
                }
              />
            ))}
          </SettingsRowGroup>
        )}

        {experience !== "community" ? (
          <p className="pt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-fg-2">Core model:</span>{" "}
            {coreWorkModel}
          </p>
        ) : null}

        <SettingsRowGroup>
          {optionalFeatures.map((feature) => {
            const featureChecked = features[feature.key]
            const noteForFeature = savedFeatures[feature.key]
              ? surfaceDisableReasons[feature.key]
              : null
            const featureDisabled =
              disabled ||
              (savedFeatures[feature.key] &&
                Boolean(surfaceDisableReasons[feature.key]))

            return (
              <SettingsToggleRow
                key={feature.key}
                checked={featureChecked}
                description={feature.description}
                disabled={featureDisabled}
                note={noteForFeature}
                title={feature.label}
                onCheckedChange={(checked) =>
                  setFeatures((current) => ({
                    ...current,
                    issues: experience === "community" ? false : true,
                    projects: experience === "community" ? false : true,
                    views: experience === "community" ? false : true,
                    [feature.key]: checked,
                  }))
                }
              />
            )
          })}
        </SettingsRowGroup>

        {experience === "community" &&
        !(features.docs || features.chat || features.channels) ? (
          <p className="text-[12.5px] leading-relaxed text-[color:var(--priority-high)]">
            Enable at least one surface for community teams.
          </p>
        ) : null}
      </SettingsSection>
    </>
  )
}

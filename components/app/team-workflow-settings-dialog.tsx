"use client"

import { useState } from "react"
import {
  CalendarDots,
  CaretDown,
  CaretUp,
  DotsSixVertical,
  Kanban,
  Rows,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  createDefaultTeamWorkflowSettings,
  getDisplayLabelForWorkItemType,
  getAllowedTemplateTypesForTeamExperience,
  getDefaultTemplateTypeForTeamExperience,
  normalizeStoredWorkflowItemTypes,
  priorityMeta,
  statusMeta,
  templateMeta,
  type TeamWorkflowSettings,
  type ViewLayout,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

function cloneWorkflowSettings(
  source: TeamWorkflowSettings | undefined,
  experience: "software-development" | "issue-analysis" | "project-management" | "community"
): TeamWorkflowSettings {
  const defaults = createDefaultTeamWorkflowSettings(experience)
  const workflow = source ?? defaults
  const sanitizeRecommendedItemTypes = (
    templateType: keyof TeamWorkflowSettings["templateDefaults"]
  ) => {
    const recommendedItemTypes = normalizeStoredWorkflowItemTypes(
      workflow.templateDefaults[templateType].recommendedItemTypes,
      experience,
      templateType
    )

    return recommendedItemTypes.length > 0
      ? recommendedItemTypes
      : [...defaults.templateDefaults[templateType].recommendedItemTypes]
  }

  return {
    statusOrder: [...workflow.statusOrder],
    templateDefaults: {
      "software-delivery": {
        ...workflow.templateDefaults["software-delivery"],
        recommendedItemTypes: sanitizeRecommendedItemTypes("software-delivery"),
      },
      "bug-tracking": {
        ...workflow.templateDefaults["bug-tracking"],
        recommendedItemTypes: sanitizeRecommendedItemTypes("bug-tracking"),
      },
      "project-management": {
        ...workflow.templateDefaults["project-management"],
        recommendedItemTypes: sanitizeRecommendedItemTypes("project-management"),
      },
    },
  }
}

function moveStatus(
  values: TeamWorkflowSettings["statusOrder"],
  index: number,
  direction: -1 | 1
) {
  const nextIndex = index + direction

  if (nextIndex < 0 || nextIndex >= values.length) {
    return values
  }

  const next = [...values]
  const current = next[index]

  next[index] = next[nextIndex]
  next[nextIndex] = current

  return next
}

/* ------------------------------------------------------------------ */
/*  Inline setting row                                                 */
/* ------------------------------------------------------------------ */

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
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

export function TeamWorkflowSettingsDialog({
  open,
  onOpenChange,
  teamId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
}) {
  const team = useAppStore((state) => state.teams.find((entry) => entry.id === teamId) ?? null)
  const teamExperience = team?.settings.experience ?? "software-development"
  const availableTemplateTypes = [
    ...getAllowedTemplateTypesForTeamExperience(teamExperience),
  ]
  const [activeTemplate, setActiveTemplate] = useState<
    keyof TeamWorkflowSettings["templateDefaults"]
  >(
    () =>
      availableTemplateTypes[0] ??
      getDefaultTemplateTypeForTeamExperience(teamExperience)
  )
  const [workflow, setWorkflow] = useState<TeamWorkflowSettings>(() =>
    cloneWorkflowSettings(team?.settings.workflow, teamExperience)
  )

  if (!team) {
    return null
  }

  const templateDefaults = workflow.templateDefaults[activeTemplate]

  function updateTemplateDefaults(
    patch: Partial<TeamWorkflowSettings["templateDefaults"][typeof activeTemplate]>
  ) {
    setWorkflow((current) => ({
      ...current,
      templateDefaults: {
        ...current.templateDefaults,
        [activeTemplate]: {
          ...current.templateDefaults[activeTemplate],
          ...patch,
        },
      },
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Workflow settings</DialogTitle>
          <DialogDescription>
            Configure lane ordering and template defaults for {team.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left column — Status order */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Status order
            </h3>
            <div className="flex flex-col gap-1">
              {workflow.statusOrder.map((status, index) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <DotsSixVertical className="size-3.5 text-muted-foreground/40 cursor-grab" />
                    <span className="text-xs text-muted-foreground/60 tabular-nums w-4">
                      {index + 1}
                    </span>
                    <span className="text-sm">{statusMeta[status].label}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() =>
                        setWorkflow((current) => ({
                          ...current,
                          statusOrder: moveStatus(current.statusOrder, index, -1),
                        }))
                      }
                    >
                      <CaretUp className="size-3.5" />
                    </button>
                    <button
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={index === workflow.statusOrder.length - 1}
                      onClick={() =>
                        setWorkflow((current) => ({
                          ...current,
                          statusOrder: moveStatus(current.statusOrder, index, 1),
                        }))
                      }
                    >
                      <CaretDown className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Used when grouping work by status in list and board views.
            </p>
          </div>

          {/* Right column — Template defaults */}
          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Template defaults
            </h3>

            <div className="flex flex-col">
              <SettingRow label="Template">
                <Select
                  value={activeTemplate}
                  onValueChange={(value) =>
                    setActiveTemplate(
                      value as keyof TeamWorkflowSettings["templateDefaults"]
                    )
                  }
                >
                  <SelectTrigger className="h-7 w-auto min-w-32 border-none bg-transparent text-sm shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {availableTemplateTypes.map((value) => (
                        <SelectItem key={value} value={value}>
                          {templateMeta[value].label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </SettingRow>

              <Separator />

              <SettingRow label="Default priority">
                <Select
                  value={templateDefaults.defaultPriority}
                  onValueChange={(value) =>
                    updateTemplateDefaults({
                      defaultPriority: value as TeamWorkflowSettings["templateDefaults"][typeof activeTemplate]["defaultPriority"],
                    })
                  }
                >
                  <SelectTrigger className="h-7 w-auto min-w-28 border-none bg-transparent text-sm shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.entries(priorityMeta).map(([value, meta]) => (
                        <SelectItem key={value} value={value}>
                          {meta.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow label="Delivery window" description="Days by default">
                <Input
                  type="number"
                  min={3}
                  max={180}
                  value={String(templateDefaults.targetWindowDays)}
                  onChange={(event) =>
                    updateTemplateDefaults({
                      targetWindowDays: Number(event.target.value) || 3,
                    })
                  }
                  className="h-7 w-20 text-sm"
                />
              </SettingRow>

              <SettingRow label="Default view">
                <Select
                  value={templateDefaults.defaultViewLayout}
                  onValueChange={(value) =>
                    updateTemplateDefaults({
                      defaultViewLayout: value as ViewLayout,
                    })
                  }
                >
                  <SelectTrigger className="h-7 w-auto min-w-28 border-none bg-transparent text-sm shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="board">
                        <div className="flex items-center gap-2">
                          <Kanban className="size-3.5" />
                          Board
                        </div>
                      </SelectItem>
                      <SelectItem value="list">
                        <div className="flex items-center gap-2">
                          <Rows className="size-3.5" />
                          List
                        </div>
                      </SelectItem>
                      <SelectItem value="timeline">
                        <div className="flex items-center gap-2">
                          <CalendarDots className="size-3.5" />
                          Timeline
                        </div>
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </SettingRow>

              <Separator />

              <div className="py-2">
                <span className="text-sm">Summary hint</span>
                <Textarea
                  rows={3}
                  value={templateDefaults.summaryHint}
                  onChange={(event) =>
                    updateTemplateDefaults({
                      summaryHint: event.target.value,
                    })
                  }
                  className="mt-1.5 min-h-16 text-sm"
                />
              </div>

              <Separator />

              <div className="py-2">
                <span className="text-sm">Recommended item types</span>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {templateDefaults.recommendedItemTypes.map((itemType) => (
                    <Badge
                      key={itemType}
                      variant="secondary"
                      className="text-xs font-normal"
                    >
                      {getDisplayLabelForWorkItemType(itemType, teamExperience)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              useAppStore
                .getState()
                .updateTeamWorkflowSettings(teamId, workflow)
              onOpenChange(false)
            }}
          >
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

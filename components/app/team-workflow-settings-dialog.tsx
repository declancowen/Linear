"use client"

import { useState } from "react"
import {
  CalendarDots,
  CaretDown,
  CaretUp,
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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  createDefaultTeamWorkflowSettings,
  priorityMeta,
  statusMeta,
  templateMeta,
  type TeamWorkflowSettings,
  type ViewLayout,
  workItemTypeMeta,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

function cloneWorkflowSettings(source: TeamWorkflowSettings | undefined): TeamWorkflowSettings {
  const workflow = source ?? createDefaultTeamWorkflowSettings()

  return {
    statusOrder: [...workflow.statusOrder],
    templateDefaults: {
      "software-delivery": {
        ...workflow.templateDefaults["software-delivery"],
        recommendedItemTypes: [
          ...workflow.templateDefaults["software-delivery"].recommendedItemTypes,
        ],
      },
      "bug-tracking": {
        ...workflow.templateDefaults["bug-tracking"],
        recommendedItemTypes: [
          ...workflow.templateDefaults["bug-tracking"].recommendedItemTypes,
        ],
      },
      "project-management": {
        ...workflow.templateDefaults["project-management"],
        recommendedItemTypes: [
          ...workflow.templateDefaults["project-management"].recommendedItemTypes,
        ],
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
  const [activeTemplate, setActiveTemplate] =
    useState<keyof TeamWorkflowSettings["templateDefaults"]>("software-delivery")
  const [workflow, setWorkflow] = useState<TeamWorkflowSettings>(() =>
    cloneWorkflowSettings(team?.settings.workflow)
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
          <DialogTitle>Team workflow settings</DialogTitle>
          <DialogDescription>
            Control lane ordering and template defaults for {team.name}. These
            settings drive project creation, board grouping, and status menus.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="mb-3 text-sm font-medium">Status lane order</div>
              <div className="flex flex-col gap-2">
                {workflow.statusOrder.map((status, index) => (
                  <div
                    key={status}
                    className="flex items-center justify-between rounded-xl border bg-background px-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                      <Badge variant="secondary">{statusMeta[status].label}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() =>
                          setWorkflow((current) => ({
                            ...current,
                            statusOrder: moveStatus(current.statusOrder, index, -1),
                          }))
                        }
                      >
                        <CaretUp />
                        <span className="sr-only">Move up</span>
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={index === workflow.statusOrder.length - 1}
                        onClick={() =>
                          setWorkflow((current) => ({
                            ...current,
                            statusOrder: moveStatus(current.statusOrder, index, 1),
                          }))
                        }
                      >
                        <CaretDown />
                        <span className="sr-only">Move down</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                This order is used when work is grouped by status inside team-level
                list and board views.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Template</FieldLabel>
                <FieldContent>
                  <Select
                    value={activeTemplate}
                    onValueChange={(value) =>
                      setActiveTemplate(
                        value as keyof TeamWorkflowSettings["templateDefaults"]
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {Object.entries(templateMeta).map(([value, meta]) => (
                          <SelectItem key={value} value={value}>
                            {meta.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {templateMeta[activeTemplate].description}
                  </FieldDescription>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Default priority</FieldLabel>
                <FieldContent>
                  <Select
                    value={templateDefaults.defaultPriority}
                    onValueChange={(value) =>
                      updateTemplateDefaults({
                        defaultPriority: value as TeamWorkflowSettings["templateDefaults"][typeof activeTemplate]["defaultPriority"],
                      })
                    }
                  >
                    <SelectTrigger>
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
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Default delivery window</FieldLabel>
                <FieldContent>
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
                  />
                  <FieldDescription>
                    New projects created from this template target this many days by
                    default.
                  </FieldDescription>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Suggested default view</FieldLabel>
                <FieldContent>
                  <Select
                    value={templateDefaults.defaultViewLayout}
                    onValueChange={(value) =>
                      updateTemplateDefaults({
                        defaultViewLayout: value as ViewLayout,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="board">
                          <div className="flex items-center gap-2">
                            <Kanban />
                            Board
                          </div>
                        </SelectItem>
                        <SelectItem value="list">
                          <div className="flex items-center gap-2">
                            <Rows />
                            List
                          </div>
                        </SelectItem>
                        <SelectItem value="timeline">
                          <div className="flex items-center gap-2">
                            <CalendarDots />
                            Timeline
                          </div>
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Summary hint</FieldLabel>
                <FieldContent>
                  <Textarea
                    rows={4}
                    value={templateDefaults.summaryHint}
                    onChange={(event) =>
                      updateTemplateDefaults({
                        summaryHint: event.target.value,
                      })
                    }
                  />
                  <FieldDescription>
                    Used to seed the project summary field when someone launches a new
                    project from this template.
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="mb-3 text-sm font-medium">Recommended item types</div>
              <div className="flex flex-wrap gap-2">
                {templateDefaults.recommendedItemTypes.map((itemType) => (
                  <Badge key={itemType} variant="outline">
                    {workItemTypeMeta[itemType].label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
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

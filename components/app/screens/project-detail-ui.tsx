"use client"

import Link from "next/link"
import { format } from "date-fns"
import { FileText } from "@phosphor-icons/react"

import { formatCalendarDateLabel } from "@/lib/date-input"
import {
  getDocumentContextLabel,
  getUser,
} from "@/lib/domain/selectors"
import {
  priorityMeta,
  projectStatusMeta,
  statusMeta,
  type AppData,
  type Document,
  type Milestone,
  type Priority,
  type Project,
  type ProjectUpdate,
  type Team,
  type UserProfile,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Badge } from "@/components/ui/badge"
import { CollapsibleRightSidebar } from "@/components/ui/collapsible-right-sidebar"
import { Separator } from "@/components/ui/separator"

import {
  CollapsibleSection,
  PriorityDot,
  PropertyRow,
  PropertySelect,
} from "./shared"

interface ProjectOverviewTabProps {
  data: AppData
  project: Project
  documents: Document[]
  milestones: Milestone[]
}

export function ProjectOverviewTab({
  data,
  project,
  documents,
  milestones,
}: ProjectOverviewTabProps) {
  return (
    <div className="flex flex-col gap-5">
      {project.description ? (
        <div className="text-sm leading-7 text-muted-foreground">
          {project.description}
        </div>
      ) : null}
      {documents.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Related docs</h3>
          <div className="overflow-hidden rounded-lg border">
            {documents.map((document, index) => (
              <Link
                key={document.id}
                href={`/docs/${document.id}`}
                className={[
                  "flex items-center justify-between px-3 py-2 transition-colors hover:bg-accent/40",
                  index !== documents.length - 1 ? "border-b" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="size-3.5 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">
                      {document.title}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {getDocumentContextLabel(data, document)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(document.updatedAt), "MMM d")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Milestones</h3>
        {milestones.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            {milestones.map((milestone, index) => (
              <div
                key={milestone.id}
                className={[
                  "flex items-center justify-between px-3 py-2",
                  index !== milestones.length - 1 ? "border-b" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{milestone.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {milestone.targetDate
                      ? formatCalendarDateLabel(milestone.targetDate, "No date")
                      : "No date"}
                  </span>
                </div>
                <Badge variant="secondary">
                  {statusMeta[milestone.status].label}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground">
            No milestones yet.
          </div>
        )}
      </div>
    </div>
  )
}

interface ProjectActivityTabProps {
  data: AppData
  updates: ProjectUpdate[]
}

export function ProjectActivityTab({
  data,
  updates,
}: ProjectActivityTabProps) {
  if (updates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground">
        No project updates yet.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {updates.map((update, index) => (
        <div
          key={update.id}
          className={[
            "flex flex-col gap-1 px-3 py-3",
            index !== updates.length - 1 ? "border-b" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="text-sm font-medium">
            {getUser(data, update.createdBy)?.name}
          </span>
          <p className="text-sm text-muted-foreground">{update.content}</p>
        </div>
      ))}
    </div>
  )
}

interface ProjectPropertiesSidebarProps {
  data: AppData
  open: boolean
  editable: boolean
  project: Project
  team: Team | null
  progress: {
    scope: number
    completed: number
  }
  members: UserProfile[]
}

export function ProjectPropertiesSidebar({
  data,
  open,
  editable,
  project,
  team,
  progress,
  members,
}: ProjectPropertiesSidebarProps) {
  const projectStatusOptions = Object.entries(projectStatusMeta).map(
    ([value, meta]) => ({
      value,
      label: meta.label,
    })
  )
  const priorityOptions = Object.entries(priorityMeta).map(([value, meta]) => ({
    value,
    label: meta.label,
  }))

  return (
    <CollapsibleRightSidebar open={open} width="20rem">
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col p-4">
          <CollapsibleSection title="Properties" defaultOpen layout="grid">
            <PropertyRow label="Team" value={team?.name ?? "Workspace"} />
            <PropertySelect
              label="Status"
              value={project.status}
              disabled={!editable}
              options={projectStatusOptions}
              onValueChange={(value) =>
                useAppStore.getState().updateProject(project.id, {
                  status: value as Project["status"],
                })
              }
            />
            <PropertySelect
              label="Priority"
              value={project.priority}
              disabled={!editable}
              options={priorityOptions}
              renderValue={(value, label) => (
                <div className="flex min-w-0 items-center gap-2">
                  <PriorityDot priority={value} />
                  <span className="truncate">{label}</span>
                </div>
              )}
              renderOption={(value, label) => (
                <div className="flex items-center gap-2">
                  <PriorityDot priority={value} />
                  <span>{label}</span>
                </div>
              )}
              onValueChange={(value) =>
                useAppStore.getState().updateProject(project.id, {
                  priority: value as Priority,
                })
              }
            />
            <PropertyRow
              label="Lead"
              value={getUser(data, project.leadId)?.name ?? "—"}
            />
            <PropertyRow
              label="Target"
              value={
                project.targetDate
                  ? formatCalendarDateLabel(project.targetDate, "—", "dd-MM-yyyy")
                  : "—"
              }
            />
          </CollapsibleSection>

          <Separator className="my-3" />

          <CollapsibleSection title="Progress" defaultOpen>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Scope</span>
                <div className="font-semibold">{progress.scope}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Completed</span>
                <div className="font-semibold">{progress.completed}</div>
              </div>
            </div>
          </CollapsibleSection>

          {members.length > 0 ? (
            <>
              <Separator className="my-3" />
              <CollapsibleSection title="Members" defaultOpen>
                <div className="flex flex-col gap-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="text-sm text-muted-foreground"
                    >
                      {member.name}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            </>
          ) : null}
        </div>
      </div>
    </CollapsibleRightSidebar>
  )
}

"use client"

import {
  getProject,
  getTeam,
  getUser,
  getWorkItem,
} from "@/lib/domain/selectors"
import type {
  AppData,
  DisplayProperty,
  Document,
  DocumentKind,
  GroupField,
  OrderingField,
  ViewDefinition,
} from "@/lib/domain/types"

export const DOCS_DISPLAY_PROPERTY_OPTIONS: DisplayProperty[] = [
  "kind",
  "team",
  "createdBy",
  "updatedBy",
  "created",
  "updated",
  "linkedProjects",
  "linkedItems",
]

export const DOCS_GROUP_OPTIONS: GroupField[] = [
  "kind",
  "team",
  "createdBy",
  "updatedBy",
]

export const DOCS_ORDERING_OPTIONS: OrderingField[] = [
  "title",
  "createdAt",
  "updatedAt",
]

export const DOC_KIND_LABEL: Record<DocumentKind, string> = {
  "private-document": "Private",
  "workspace-document": "Workspace docs",
  "team-document": "Team docs",
  "item-description": "Work item description",
}

export const DOCS_ORDERING_LABEL: Record<OrderingField, string> = {
  priority: "Priority",
  updatedAt: "Updated",
  createdAt: "Created",
  dueDate: "Due date",
  targetDate: "Target date",
  title: "Title",
}

export const DOCS_DISPLAY_PROPERTY_LABEL: Partial<
  Record<DisplayProperty, string>
> = {
  kind: "Kind",
  team: "Team",
  createdBy: "Created by",
  updatedBy: "Updated by",
  created: "Created",
  updated: "Updated",
  linkedProjects: "Linked projects",
  linkedItems: "Linked work items",
}

export type DocsFilterKey =
  | "documentKinds"
  | "teamIds"
  | "creatorIds"
  | "updatedByIds"
  | "projectIds"
  | "linkedWorkItemIds"

export type DocsFilterOption = {
  key: DocsFilterKey
  value: string
  label: string
  group: string
}

const DOCS_FILTER_GROUP_ORDER = [
  "Kind",
  "Team space",
  "Created by",
  "Updated by",
  "Linked projects",
  "Linked work items",
] as const

function getUniqueDocsFilterOptions(
  options: DocsFilterOption[]
): DocsFilterOption[] {
  const seen = new Set<string>()

  return options.filter((option) => {
    const key = `${option.key}:${option.value}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export function buildDocsFilterOptions(
  data: AppData,
  documents: Document[]
): DocsFilterOption[] {
  return getUniqueDocsFilterOptions([
    ...documents.map((document) => ({
      key: "documentKinds" as const,
      value: document.kind,
      label: DOC_KIND_LABEL[document.kind],
      group: "Kind",
    })),
    ...documents.flatMap((document) =>
      document.teamId
        ? [
            {
              key: "teamIds" as const,
              value: document.teamId,
              label: getTeam(data, document.teamId)?.name ?? "Team",
              group: "Team space",
            },
          ]
        : []
    ),
    ...documents.map((document) => ({
      key: "creatorIds" as const,
      value: document.createdBy,
      label: getUser(data, document.createdBy)?.name ?? "Unknown",
      group: "Created by",
    })),
    ...documents.map((document) => ({
      key: "updatedByIds" as const,
      value: document.updatedBy,
      label: getUser(data, document.updatedBy)?.name ?? "Unknown",
      group: "Updated by",
    })),
    ...documents.flatMap((document) =>
      document.linkedProjectIds.map((projectId) => ({
        key: "projectIds" as const,
        value: projectId,
        label: getProject(data, projectId)?.name ?? "Project",
        group: "Linked projects",
      }))
    ),
    ...documents.flatMap((document) =>
      document.linkedWorkItemIds.map((itemId) => ({
        key: "linkedWorkItemIds" as const,
        value: itemId,
        label: getWorkItem(data, itemId)?.title ?? "Work item",
        group: "Linked work items",
      }))
    ),
  ])
}

export function groupDocsFilterOptions(options: DocsFilterOption[]) {
  return DOCS_FILTER_GROUP_ORDER.map((group) => ({
    group,
    options: options.filter((option) => option.group === group),
  })).filter((section) => section.options.length > 0)
}

export function getDocsFilterValues(
  view: ViewDefinition,
  key: DocsFilterKey
) {
  return (view.filters[key] ?? []) as string[]
}

export function getDocsFilterCount(view: ViewDefinition) {
  const filters = view.filters

  return [
    filters.documentKinds?.length ?? 0,
    filters.teamIds.length,
    filters.creatorIds.length,
    filters.updatedByIds?.length ?? 0,
    filters.projectIds.length,
    filters.linkedWorkItemIds?.length ?? 0,
  ].reduce((total, count) => total + count, 0)
}

"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import {
  CaretDown,
  Check,
  FolderSimple,
  FunnelSimple,
  MagnifyingGlass,
  SortAscending,
  TreeStructure,
  X,
} from "@phosphor-icons/react"

import {
  canEditWorkspace,
  getEditableTeamsForFeature,
  getCurrentWorkspace,
  getPrivateDocuments,
  getProject,
  getProjectHref,
  getProjectTeam,
  getProjectsForScope,
  getTeamDocuments,
  getVisibleWorkItems,
  getWorkspaceDocuments,
  teamHasFeature,
} from "@/lib/domain/selectors"
import {
  getTextInputLimitState,
  viewDescriptionConstraints,
  viewNameConstraints,
} from "@/lib/domain/input-constraints"
import {
  createViewDefinition,
  getDefaultRouteForViewContext,
  isRouteAllowedForViewContext,
} from "@/lib/domain/default-views"
import {
  getDefaultViewItemLevelForProjectTemplate,
  getDefaultTemplateTypeForTeamExperience,
  getDefaultViewItemLevelForTeamExperience,
  type AppData,
  type CreateDialogState,
  type Document,
  type DisplayProperty,
  type TeamExperienceType,
  type ViewDefinition,
  type WorkItem,
  type Project,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import {
  applyViewConfigPatch,
  createEmptyViewFilters,
  type ViewFilterKey,
  selectAppDataSnapshot,
} from "@/components/app/screens/helpers"
import {
  FilterPopover,
  getAvailableGroupOptions,
  getGroupFieldOptionLabel,
  GroupChipPopover,
  LayoutChipPopover,
  LevelChipPopover,
  PropertiesChipPopover,
  ProjectFilterPopover,
  ProjectLayoutChipPopover,
  ProjectSortChipPopover,
  SortChipPopover,
  type ViewConfigPatch,
} from "@/components/app/screens/work-surface-controls"
import { TeamSpaceCrumbPicker } from "@/components/app/screens/team-space-crumb-picker"
import {
  ShortcutKeys,
  useCommandEnterSubmit,
  useShortcutModifierLabel,
} from "@/components/app/shortcut-keys"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
  PropertyPopoverSearch,
} from "@/components/ui/template-primitives"
import { toggleCreateViewDisplayProperty } from "@/components/app/screens/create-view-dialog-state"
import { DocsFilterOptionsList } from "@/components/app/screens/docs-filter-options-list"
import {
  buildDocsFilterOptions,
  DOCS_DISPLAY_PROPERTY_LABEL,
  DOCS_DISPLAY_PROPERTY_OPTIONS,
  DOCS_GROUP_OPTIONS,
  DOCS_ORDERING_LABEL,
  DOCS_ORDERING_OPTIONS,
  getDocsFilterCount,
  groupDocsFilterOptions,
} from "@/components/app/screens/docs-view-config"
import { cn } from "@/lib/utils"

type CreateViewDialogState = Extract<CreateDialogState, { kind: "view" }>
type DraftViewConfig = NonNullable<CreateViewDialogState["initialConfig"]>
type SelectableEntityKind = "items" | "projects" | "docs"

const crumbTriggerClass =
  "inline-flex h-7 w-fit items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

const chipSelectTriggerClass =
  "inline-flex h-7 min-w-0 max-w-[220px] items-center justify-between gap-1.5 rounded-md border border-line bg-surface px-2 text-[12px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"

const chipTriggerDashedClass =
  "border-dashed bg-transparent text-fg-3 hover:bg-surface-3 hover:text-foreground"

type ScopeOption = {
  key: string
  scopeType: "team" | "workspace"
  scopeId: string
  label: string
  section: "workspace" | "team"
}

const ENTITY_KIND_LABEL: Record<SelectableEntityKind, string> = {
  items: "Items",
  projects: "Projects",
  docs: "Docs",
}

function getScopeKey(scopeType: "team" | "workspace", scopeId: string) {
  return `${scopeType}:${scopeId}`
}

function getInitialScopeKey(input: {
  dialog: CreateViewDialogState
  scopeOptions: ScopeOption[]
}) {
  const defaultScopeKey =
    input.dialog.defaultScopeType && input.dialog.defaultScopeId
      ? getScopeKey(input.dialog.defaultScopeType, input.dialog.defaultScopeId)
      : null

  if (
    defaultScopeKey &&
    input.scopeOptions.some((option) => option.key === defaultScopeKey)
  ) {
    return defaultScopeKey
  }

  return input.scopeOptions[0]?.key ?? ""
}

function createFreshDraftConfig(
  entityKind: CreateViewDialogState["defaultEntityKind"] = "items"
): DraftViewConfig {
  if (entityKind === "docs") {
    return {
      layout: "list",
      filters: createEmptyViewFilters(),
      grouping: "kind",
      subGrouping: null,
      ordering: "updatedAt",
      displayProps: ["kind", "updatedBy", "updated"],
    }
  }

  return {
    layout: "list",
    filters: createEmptyViewFilters(),
    grouping: "status",
    subGrouping: null,
    ordering: "createdAt",
    displayProps: [],
    ...(entityKind === "items" ? { showChildItems: false } : {}),
  }
}

function cloneDraftConfig(config: DraftViewConfig): DraftViewConfig {
  return {
    ...config,
    filters: config.filters ? { ...config.filters } : createEmptyViewFilters(),
    displayProps: [...(config.displayProps ?? [])],
    hiddenState: config.hiddenState
      ? {
          groups: [...config.hiddenState.groups],
          subgroups: [...config.hiddenState.subgroups],
        }
      : { groups: [], subgroups: [] },
  }
}

function getInitialDraftConfig(
  dialog: CreateViewDialogState,
  entityKind: CreateViewDialogState["defaultEntityKind"] = "items",
  editingView?: ViewDefinition | null
) {
  if (editingView) {
    return cloneDraftConfig({
      layout: editingView.layout,
      filters: editingView.filters,
      grouping: editingView.grouping,
      subGrouping: editingView.subGrouping,
      ordering: editingView.ordering,
      itemLevel: editingView.itemLevel ?? null,
      showChildItems: Boolean(editingView.showChildItems),
      displayProps: editingView.displayProps,
      hiddenState: editingView.hiddenState,
    })
  }

  const initialConfig =
    dialog.seedInitialConfig && entityKind === dialog.defaultEntityKind
      ? dialog.initialConfig
      : undefined

  return cloneDraftConfig(initialConfig ?? createFreshDraftConfig(entityKind))
}

function teamSupportsCreateViewKind(
  team: AppData["teams"][number],
  entityKind: SelectableEntityKind
) {
  if (!teamHasFeature(team, "views")) {
    return false
  }

  if (entityKind === "items") {
    return teamHasFeature(team, "issues")
  }

  if (entityKind === "projects") {
    return teamHasFeature(team, "projects")
  }

  return teamHasFeature(team, "docs")
}

function getAvailableCreateViewEntityKinds({
  currentWorkspace,
  data,
  editableTeams,
}: {
  currentWorkspace: AppData["workspaces"][number] | null | undefined
  data: AppData
  editableTeams: AppData["teams"]
}): SelectableEntityKind[] {
  const canUseWorkspace = currentWorkspace
    ? canEditWorkspace(data, currentWorkspace.id)
    : false

  return (["items", "projects", "docs"] as const).filter((entityKind) =>
    canUseWorkspace
      ? true
      : editableTeams.some((team) =>
          teamSupportsCreateViewKind(team, entityKind)
        )
  )
}

function getCreateViewScopeOptions({
  currentWorkspace,
  data,
  editableTeams,
  selectedEntityKind,
}: {
  currentWorkspace: AppData["workspaces"][number] | null | undefined
  data: AppData
  editableTeams: AppData["teams"]
  selectedEntityKind: SelectableEntityKind
}) {
  const workspaceOptions: ScopeOption[] =
    currentWorkspace && canEditWorkspace(data, currentWorkspace.id)
      ? [
          {
            key: getScopeKey("workspace", currentWorkspace.id),
            scopeType: "workspace",
            scopeId: currentWorkspace.id,
            label: currentWorkspace.name,
            section: "workspace",
          },
        ]
      : []
  const teamOptions: ScopeOption[] = editableTeams
    .filter((team) => teamSupportsCreateViewKind(team, selectedEntityKind))
    .map((team) => ({
      key: getScopeKey("team", team.id),
      scopeType: "team",
      scopeId: team.id,
      label: team.name,
      section: "team",
    }))

  return [...workspaceOptions, ...teamOptions]
}

function getEditingViewScopeOverride(editingView?: ViewDefinition | null) {
  if (
    !editingView ||
    (editingView.scopeType !== "team" && editingView.scopeType !== "workspace")
  ) {
    return null
  }

  return {
    scopeType: editingView.scopeType,
    scopeId: editingView.scopeId,
  }
}

function getInitialCreateViewEntityKind({
  availableEntityKinds,
  dialog,
  editingView,
}: {
  availableEntityKinds: SelectableEntityKind[]
  dialog: CreateViewDialogState
  editingView: ViewDefinition | null
}): SelectableEntityKind {
  return (
    editingView?.entityKind ??
    dialog.defaultEntityKind ??
    availableEntityKinds[0] ??
    "items"
  )
}

function getInitialCreateViewScopeDialog(
  dialog: CreateViewDialogState,
  editableScopeOverride: ReturnType<typeof getEditingViewScopeOverride>
) {
  return editableScopeOverride
    ? {
        ...dialog,
        defaultScopeType: editableScopeOverride.scopeType,
        defaultScopeId: editableScopeOverride.scopeId,
      }
    : dialog
}

function getInitialSelectedProjectId(
  dialog: CreateViewDialogState,
  editingView?: ViewDefinition | null
) {
  if (dialog.lockProject) {
    return dialog.defaultProjectId ?? ""
  }

  return editingView?.containerType === "project-items"
    ? (editingView.containerId ?? "")
    : ""
}

function getSelectedCreateViewTeam({
  editableTeams,
  selectedScope,
}: {
  editableTeams: AppData["teams"]
  selectedScope: ScopeOption | null
}) {
  return selectedScope?.scopeType === "team"
    ? (editableTeams.find((team) => team.id === selectedScope.scopeId) ?? null)
    : null
}

function getViewFilterSelectionKeys(filters: ViewDefinition["filters"]) {
  return Object.entries(filters)
    .filter(([, value]) => Array.isArray(value))
    .map(([key]) => key as ViewFilterKey)
}

function getCreateViewProjectOptions({
  data,
  dialog,
  editableTeams,
  selectedEntityKind,
  selectedScope,
  selectedTeam,
}: {
  data: AppData
  dialog: CreateViewDialogState
  editableTeams: AppData["teams"]
  selectedEntityKind: SelectableEntityKind
  selectedScope: ScopeOption | null
  selectedTeam: AppData["teams"][number] | null
}) {
  if (selectedEntityKind !== "items") {
    return []
  }

  if (dialog.lockProject && dialog.defaultProjectId) {
    const lockedProject = getProject(data, dialog.defaultProjectId)
    return lockedProject ? [lockedProject] : []
  }

  if (dialog.lockScope && selectedScope) {
    return data.projects
      .filter(
        (project) =>
          project.scopeType === selectedScope.scopeType &&
          project.scopeId === selectedScope.scopeId
      )
      .sort((left, right) => left.name.localeCompare(right.name))
  }

  if (!selectedTeam) {
    return getWorkspaceProjectOptions({
      data,
      editableTeams,
      selectedScope,
    })
  }

  return data.projects
    .filter(
      (project) =>
        (project.scopeType === "team" && project.scopeId === selectedTeam.id) ||
        (project.scopeType === "workspace" &&
          project.scopeId === selectedTeam.workspaceId)
    )
    .sort((left, right) => left.name.localeCompare(right.name))
}

function getWorkspaceProjectOptions({
  data,
  editableTeams,
  selectedScope,
}: {
  data: AppData
  editableTeams: AppData["teams"]
  selectedScope: ScopeOption | null
}) {
  if (selectedScope?.scopeType !== "workspace") {
    return []
  }

  const editableTeamIds = new Set(editableTeams.map((team) => team.id))

  return data.projects
    .filter((project) => {
      if (project.scopeType === "workspace") {
        return project.scopeId === selectedScope.scopeId
      }

      const team = getProjectTeam(data, project)
      return Boolean(
        team &&
        team.workspaceId === selectedScope.scopeId &&
        editableTeamIds.has(team.id)
      )
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

function getSelectedCreateViewProject({
  data,
  dialog,
  projectOptions,
  selectedProjectId,
}: {
  data: AppData
  dialog: CreateViewDialogState
  projectOptions: Project[]
  selectedProjectId: string
}) {
  if (!selectedProjectId) {
    return null
  }

  return (
    projectOptions.find((project) => project.id === selectedProjectId) ??
    (dialog.lockProject ? getProject(data, selectedProjectId) : null) ??
    null
  )
}

function getEffectiveCreateViewScope({
  dialog,
  selectedEntityKind,
  selectedProject,
  selectedScope,
}: {
  dialog: CreateViewDialogState
  selectedEntityKind: SelectableEntityKind
  selectedProject: Project | null
  selectedScope: ScopeOption | null
}) {
  if (!dialog.lockScope && selectedEntityKind === "items" && selectedProject) {
    return {
      scopeType: selectedProject.scopeType,
      scopeId: selectedProject.scopeId,
    }
  }

  return selectedScope
    ? {
        scopeType: selectedScope.scopeType,
        scopeId: selectedScope.scopeId,
      }
    : null
}

function syncPersistedViewFilters(
  viewId: string,
  currentFilters: ViewDefinition["filters"],
  nextFilters: ViewDefinition["filters"]
) {
  const currentSerialized = JSON.stringify(currentFilters)
  const nextSerialized = JSON.stringify(nextFilters)

  if (currentSerialized === nextSerialized) {
    return
  }

  const store = useAppStore.getState()
  store.clearViewFilters(viewId)

  getViewFilterSelectionKeys(nextFilters).forEach((key) => {
    const values = (nextFilters[key] ?? []) as string[]
    values.forEach((value) => {
      store.toggleViewFilterValue(viewId, key as never, value)
    })
  })
}

function getResolvedCreateViewRoute({
  data,
  dialog,
  selectedEntityKind,
  selectedProject,
  selectedScope,
  selectedTeam,
}: {
  data: AppData
  dialog: CreateViewDialogState
  selectedEntityKind: SelectableEntityKind
  selectedProject: Project | null
  selectedScope: ScopeOption | null
  selectedTeam: AppData["teams"][number] | null
}) {
  if (selectedEntityKind === "items" && selectedProject) {
    return getProjectHref(data, selectedProject)
  }

  if (!selectedScope) {
    return null
  }

  if (
    dialog.defaultRoute &&
    isRouteAllowedForViewContext({
      scopeType: selectedScope.scopeType,
      entityKind: selectedEntityKind,
      route: dialog.defaultRoute,
      teamSlug: selectedTeam?.slug,
    })
  ) {
    return dialog.defaultRoute
  }

  return getDefaultRouteForViewContext({
    scopeType: selectedScope.scopeType,
    entityKind: selectedEntityKind,
    teamSlug: selectedTeam?.slug,
  })
}

function getScopedCreateViewItems({
  data,
  selectedEntityKind,
  selectedProject,
  selectedScope,
}: {
  data: AppData
  selectedEntityKind: SelectableEntityKind
  selectedProject: Project | null
  selectedScope: ScopeOption | null
}) {
  if (selectedEntityKind !== "items") {
    return []
  }

  if (selectedProject) {
    return data.workItems.filter(
      (item) =>
        item.primaryProjectId === selectedProject.id ||
        item.linkedProjectIds.includes(selectedProject.id)
    )
  }

  if (!selectedScope) {
    return []
  }

  return getVisibleWorkItems(
    data,
    selectedScope.scopeType === "team"
      ? { teamId: selectedScope.scopeId }
      : { workspaceId: selectedScope.scopeId }
  )
}

function getScopedCreateViewDocuments({
  data,
  effectiveScope,
  selectedEntityKind,
}: {
  data: AppData
  effectiveScope: ReturnType<typeof getEffectiveCreateViewScope>
  selectedEntityKind: SelectableEntityKind
}) {
  if (selectedEntityKind !== "docs" || !effectiveScope) {
    return []
  }

  if (effectiveScope.scopeType === "team") {
    return getTeamDocuments(data, effectiveScope.scopeId)
  }

  return [
    ...getPrivateDocuments(data, effectiveScope.scopeId),
    ...getWorkspaceDocuments(data, effectiveScope.scopeId),
  ]
}

function getCreateViewDefaultItemLevel({
  effectiveTeam,
  selectedEntityKind,
  selectedProject,
  selectedProjectTeam,
}: {
  effectiveTeam: AppData["teams"][number] | null
  selectedEntityKind: SelectableEntityKind
  selectedProject: Project | null
  selectedProjectTeam: AppData["teams"][number] | null
}) {
  if (selectedEntityKind !== "items") {
    return undefined
  }

  if (selectedProject) {
    return selectedProjectTeam
      ? getDefaultViewItemLevelForTeamExperience(
          selectedProjectTeam.settings.experience
        )
      : getDefaultViewItemLevelForProjectTemplate(selectedProject.templateType)
  }

  return effectiveTeam
    ? getDefaultViewItemLevelForTeamExperience(
        effectiveTeam.settings.experience
      )
    : undefined
}

function getCreateViewGroupOptions({
  effectiveTeam,
  selectedProject,
}: {
  effectiveTeam: AppData["teams"][number] | null
  selectedProject: Project | null
}) {
  const templateType = selectedProject
    ? selectedProject.templateType
    : effectiveTeam
      ? getDefaultTemplateTypeForTeamExperience(
          effectiveTeam.settings.experience
        )
      : null

  return getAvailableGroupOptions(templateType)
}

function getProjectViewContainer({
  selectedEntityKind,
  selectedProject,
}: {
  selectedEntityKind: SelectableEntityKind
  selectedProject: Project | null
}):
  | { containerType: "project-items"; containerId: string }
  | Record<string, never> {
  return selectedEntityKind === "items" && selectedProject
    ? {
        containerType: "project-items" as const,
        containerId: selectedProject.id,
      }
    : ({} as Record<string, never>)
}

function canSubmitCreateView({
  descriptionLimitState,
  effectiveScope,
  nameLimitState,
  resolvedRoute,
}: {
  descriptionLimitState: ReturnType<typeof getTextInputLimitState>
  effectiveScope: ReturnType<typeof getEffectiveCreateViewScope>
  nameLimitState: ReturnType<typeof getTextInputLimitState>
  resolvedRoute: string | null
}) {
  return (
    nameLimitState.canSubmit &&
    descriptionLimitState.canSubmit &&
    Boolean(effectiveScope) &&
    Boolean(resolvedRoute)
  )
}

function shouldShowCreateViewProjectPicker({
  isProjectSpecificItemView,
  projectOptions,
  selectedProject,
}: {
  isProjectSpecificItemView: boolean
  projectOptions: Project[]
  selectedProject: Project | null
}) {
  return (
    !isProjectSpecificItemView &&
    (Boolean(selectedProject) || projectOptions.length > 0)
  )
}

function isCreateViewProjectSpecificItemView({
  dialog,
  selectedEntityKind,
  selectedProject,
}: {
  dialog: CreateViewDialogState
  selectedEntityKind: SelectableEntityKind
  selectedProject: Project | null
}) {
  return (
    selectedEntityKind === "items" &&
    Boolean(selectedProject) &&
    Boolean(dialog.lockProject)
  )
}

function createDraftViewDefinition({
  defaultItemLevel,
  description,
  draftConfig,
  effectiveScope,
  effectiveTeam,
  name,
  resolvedRoute,
  selectedEntityKind,
}: {
  defaultItemLevel: WorkItem["type"] | null | undefined
  description: string
  draftConfig: DraftViewConfig
  effectiveScope: ReturnType<typeof getEffectiveCreateViewScope>
  effectiveTeam: AppData["teams"][number] | null
  name: string
  resolvedRoute: string | null
  selectedEntityKind: SelectableEntityKind
}) {
  if (!effectiveScope || !resolvedRoute) {
    return null
  }

  return createViewDefinition({
    id: "__draft_view__",
    name: name.trim() || "Untitled view",
    description: description.trim(),
    scopeType: effectiveScope.scopeType,
    scopeId: effectiveScope.scopeId,
    entityKind: selectedEntityKind,
    route: resolvedRoute,
    teamSlug: effectiveTeam?.slug,
    createdAt: "__draft__",
    overrides: {
      ...draftConfig,
      ...(draftConfig.itemLevel === undefined && defaultItemLevel !== undefined
        ? { itemLevel: defaultItemLevel }
        : {}),
    },
  })
}

function pruneDraftFiltersForScope({
  data,
  effectiveScope,
  scopedProjects,
  view,
}: {
  data: AppData
  effectiveScope: ReturnType<typeof getEffectiveCreateViewScope>
  scopedProjects: Project[]
  view: DraftViewConfig
}) {
  if (!effectiveScope || !view.filters) {
    return view
  }

  const projectIds = new Set(scopedProjects.map((project) => project.id))
  const teamIds = new Set(
    effectiveScope.scopeType === "team"
      ? [effectiveScope.scopeId]
      : data.teams
          .filter((team) => team.workspaceId === effectiveScope.scopeId)
          .map((team) => team.id)
  )
  const nextProjectIds = view.filters.projectIds.filter((id) =>
    projectIds.has(id)
  )
  const nextTeamIds = view.filters.teamIds.filter((id) => teamIds.has(id))

  if (
    nextProjectIds.length === view.filters.projectIds.length &&
    nextTeamIds.length === view.filters.teamIds.length
  ) {
    return view
  }

  return {
    ...view,
    filters: {
      ...view.filters,
      projectIds: nextProjectIds,
      teamIds: nextTeamIds,
    },
  }
}

function getCreateViewConfig({
  dialog,
  draftView,
  selectedEntityKind,
}: {
  dialog: CreateViewDialogState
  draftView: ViewDefinition | null
  selectedEntityKind: SelectableEntityKind
}) {
  if (draftView) {
    return {
      layout: draftView.layout,
      grouping: draftView.grouping,
      subGrouping: draftView.subGrouping,
      ordering: draftView.ordering,
      itemLevel: draftView.itemLevel ?? null,
      showChildItems: Boolean(draftView.showChildItems),
      filters: draftView.filters,
      displayProps: [...draftView.displayProps],
      hiddenState: {
        groups: [...draftView.hiddenState.groups],
        subgroups: [...draftView.hiddenState.subgroups],
      },
    }
  }

  return selectedEntityKind === dialog.defaultEntityKind
    ? createFreshDraftConfig(selectedEntityKind)
    : {}
}

async function updateExistingViewFromDraft({
  description,
  draftView,
  editingView,
  name,
  projectViewContainer,
  resolvedRoute,
}: {
  description: string
  draftView: ViewDefinition
  editingView: ViewDefinition
  name: string
  projectViewContainer:
    | { containerType: "project-items"; containerId: string }
    | Record<string, never>
  resolvedRoute: string
}) {
  const store = useAppStore.getState()
  const trimmedName = name.trim()
  const nextContainerType =
    "containerType" in projectViewContainer
      ? projectViewContainer.containerType
      : null
  const nextContainerId =
    "containerId" in projectViewContainer
      ? projectViewContainer.containerId
      : null

  if (trimmedName !== editingView.name) {
    await store.renameView(editingView.id, trimmedName)
  }

  store.updateViewConfig(editingView.id, {
    description: description.trim(),
    containerType: nextContainerType,
    containerId: nextContainerId,
    route: resolvedRoute,
    layout: draftView.layout,
    grouping: draftView.grouping,
    subGrouping: draftView.subGrouping,
    ordering: draftView.ordering,
    itemLevel: draftView.itemLevel ?? null,
    showChildItems: Boolean(draftView.showChildItems),
    showCompleted: draftView.filters.showCompleted,
  })
  syncPersistedViewFilters(
    editingView.id,
    editingView.filters,
    draftView.filters
  )

  if (
    JSON.stringify(editingView.displayProps) !==
    JSON.stringify(draftView.displayProps)
  ) {
    store.reorderViewDisplayProperties(editingView.id, draftView.displayProps)
  }
}

async function submitCreateViewDialog({
  description,
  dialog,
  draftView,
  effectiveScope,
  editingView,
  name,
  projectViewContainer,
  resolvedRoute,
  selectedEntityKind,
}: {
  description: string
  dialog: CreateViewDialogState
  draftView: ViewDefinition | null
  effectiveScope: ReturnType<typeof getEffectiveCreateViewScope>
  editingView: ViewDefinition | null
  name: string
  projectViewContainer:
    | { containerType: "project-items"; containerId: string }
    | Record<string, never>
  resolvedRoute: string | null
  selectedEntityKind: SelectableEntityKind
}) {
  if (!effectiveScope || !resolvedRoute) {
    return false
  }

  if (editingView && draftView) {
    await updateExistingViewFromDraft({
      description,
      draftView,
      editingView,
      name,
      projectViewContainer,
      resolvedRoute,
    })
    return true
  }

  const viewId = useAppStore.getState().createView({
    scopeType: effectiveScope.scopeType,
    scopeId: effectiveScope.scopeId,
    entityKind: selectedEntityKind,
    ...projectViewContainer,
    route: resolvedRoute,
    name: name.trim(),
    description: description.trim(),
    ...getCreateViewConfig({ dialog, draftView, selectedEntityKind }),
  })

  return Boolean(viewId)
}

function useCreateViewDialogOpenReset({
  dialog,
  editingView,
  initialEntityKind,
  initialScopeKey,
  open,
  setCreating,
  setDescription,
  setDraftConfig,
  setName,
  setProjectPickerOpen,
  setProjectQuery,
  setSelectedEntityKind,
  setSelectedProjectId,
  setSelectedScopeKey,
}: {
  dialog: CreateViewDialogState
  editingView: ViewDefinition | null
  initialEntityKind: SelectableEntityKind
  initialScopeKey: string
  open: boolean
  setCreating: (creating: boolean) => void
  setDescription: (description: string) => void
  setDraftConfig: (config: DraftViewConfig) => void
  setName: (name: string) => void
  setProjectPickerOpen: (open: boolean) => void
  setProjectQuery: (query: string) => void
  setSelectedEntityKind: (entityKind: SelectableEntityKind) => void
  setSelectedProjectId: (projectId: string) => void
  setSelectedScopeKey: (scopeKey: string) => void
}) {
  useEffect(() => {
    if (!open) {
      return
    }

    setSelectedEntityKind(initialEntityKind)
    setName(editingView?.name ?? "")
    setDescription(editingView?.description ?? "")
    setCreating(false)
    setSelectedScopeKey(initialScopeKey)
    setProjectPickerOpen(false)
    setProjectQuery("")
    setSelectedProjectId(getInitialSelectedProjectId(dialog, editingView))
    setDraftConfig(
      getInitialDraftConfig(dialog, initialEntityKind, editingView)
    )
  }, [
    dialog,
    editingView,
    initialEntityKind,
    initialScopeKey,
    open,
    setCreating,
    setDescription,
    setDraftConfig,
    setName,
    setProjectPickerOpen,
    setProjectQuery,
    setSelectedEntityKind,
    setSelectedProjectId,
    setSelectedScopeKey,
  ])
}

function useCreateViewSelectionGuards({
  availableEntityKinds,
  dialog,
  editingView,
  initialEntityKind,
  initialScopeKey,
  open,
  projectOptions,
  scopeOptions,
  selectedEntityKind,
  selectedProject,
  selectedProjectId,
  selectedScope,
  selectedScopeKey,
  setDraftConfig,
  setSelectedEntityKind,
  setSelectedProjectId,
  setSelectedScopeKey,
}: {
  availableEntityKinds: SelectableEntityKind[]
  dialog: CreateViewDialogState
  editingView: ViewDefinition | null
  initialEntityKind: SelectableEntityKind
  initialScopeKey: string
  open: boolean
  projectOptions: Project[]
  scopeOptions: ScopeOption[]
  selectedEntityKind: SelectableEntityKind
  selectedProject: Project | null
  selectedProjectId: string
  selectedScope: ScopeOption | null
  selectedScopeKey: string
  setDraftConfig: (config: DraftViewConfig) => void
  setSelectedEntityKind: (entityKind: SelectableEntityKind) => void
  setSelectedProjectId: (projectId: string) => void
  setSelectedScopeKey: (scopeKey: string) => void
}) {
  useEffect(() => {
    if (open && !availableEntityKinds.includes(selectedEntityKind)) {
      setSelectedEntityKind(initialEntityKind)
    }
  }, [
    availableEntityKinds,
    initialEntityKind,
    open,
    selectedEntityKind,
    setSelectedEntityKind,
  ])

  useEffect(() => {
    if (selectedEntityKind !== "items" && selectedProjectId) {
      setSelectedProjectId("")
    }
  }, [selectedEntityKind, selectedProjectId, setSelectedProjectId])

  useEffect(() => {
    if (open) {
      setDraftConfig(
        getInitialDraftConfig(dialog, selectedEntityKind, editingView)
      )
    }
  }, [dialog, editingView, open, selectedEntityKind, setDraftConfig])

  useEffect(() => {
    if (
      open &&
      !scopeOptions.some((option) => option.key === selectedScopeKey)
    ) {
      setSelectedScopeKey(initialScopeKey)
    }
  }, [
    initialScopeKey,
    open,
    scopeOptions,
    selectedScopeKey,
    setSelectedScopeKey,
  ])

  useEffect(() => {
    const projectExists = projectOptions.some(
      (project) => project.id === selectedProjectId
    )

    if (selectedProjectId && !projectExists && !dialog.lockProject) {
      setSelectedProjectId("")
    }
  }, [
    dialog.lockProject,
    projectOptions,
    selectedProjectId,
    setSelectedProjectId,
  ])

  useEffect(() => {
    if (dialog.lockScope || !selectedProject) {
      return
    }

    const nextScopeKey = getScopeKey(
      selectedProject.scopeType,
      selectedProject.scopeId
    )

    if (
      selectedScopeKey !== nextScopeKey &&
      scopeOptions.some((option) => option.key === nextScopeKey)
    ) {
      setSelectedScopeKey(nextScopeKey)
    }
  }, [
    dialog.lockScope,
    scopeOptions,
    selectedProject,
    selectedScopeKey,
    setSelectedScopeKey,
  ])

  useEffect(() => {
    if (
      selectedProject &&
      dialog.lockScope &&
      selectedScope &&
      (selectedProject.scopeType !== selectedScope.scopeType ||
        selectedProject.scopeId !== selectedScope.scopeId)
    ) {
      setSelectedProjectId("")
    }
  }, [dialog.lockScope, selectedProject, selectedScope, setSelectedProjectId])
}

function useCreateViewDraftPruning({
  data,
  effectiveScope,
  scopedProjects,
  setDraftConfig,
}: {
  data: AppData
  effectiveScope: ReturnType<typeof getEffectiveCreateViewScope>
  scopedProjects: Project[]
  setDraftConfig: (
    update: (current: DraftViewConfig) => DraftViewConfig
  ) => void
}) {
  useEffect(() => {
    if (!effectiveScope) {
      return
    }

    setDraftConfig((current) =>
      pruneDraftFiltersForScope({
        data,
        effectiveScope,
        scopedProjects,
        view: current,
      })
    )
  }, [data, effectiveScope, scopedProjects, setDraftConfig])
}

function useCreateViewDraftActions({
  draftView,
  setDraftConfig,
}: {
  draftView: ViewDefinition | null
  setDraftConfig: (
    update: (current: DraftViewConfig) => DraftViewConfig
  ) => void
}) {
  return {
    clearDisplayProperties: () =>
      setDraftConfig((current) => ({
        ...current,
        displayProps: [],
      })),
    clearFilters: () =>
      setDraftConfig((current) => ({
        ...current,
        filters: createEmptyViewFilters(),
      })),
    reorderDisplayProperties: (displayProps: DisplayProperty[]) =>
      setDraftConfig((current) => ({
        ...current,
        displayProps,
      })),
    toggleDisplayProperty: (property: DisplayProperty) =>
      setDraftConfig((current) => {
        const displayProps =
          current.displayProps ?? draftView?.displayProps ?? []

        return {
          ...current,
          displayProps: toggleCreateViewDisplayProperty(displayProps, property),
        }
      }),
    toggleFilterValue: (key: ViewFilterKey, value: string) =>
      setDraftConfig((current) => {
        const filters = current.filters ?? createEmptyViewFilters()
        const currentValues = filters[key] as string[]
        const nextValues = currentValues.includes(value)
          ? currentValues.filter((entry) => entry !== value)
          : [...currentValues, value]

        return {
          ...current,
          filters: {
            ...filters,
            [key]: nextValues,
          },
        }
      }),
    updateView: (patch: ViewConfigPatch) =>
      setDraftConfig((current) => applyViewConfigPatch(current, patch)),
  }
}

function CreateViewDialogFrame({
  availableEntityKinds,
  canCreate,
  creating,
  data,
  description,
  descriptionLimitState,
  dialog,
  draftActions,
  draftView,
  effectiveScope,
  editingView,
  groupOptions,
  groupingExperience,
  isProjectSpecificItemView,
  name,
  nameLimitState,
  onCreate,
  onDescriptionChange,
  onNameChange,
  onOpenChange,
  onSelectEntityKind,
  onSelectScope,
  open,
  projectPicker,
  resolvedRoute,
  scopedDocuments,
  scopedItems,
  scopedProjects,
  scopeOptions,
  selectedEntityKind,
  selectedProject,
  selectedScope,
  selectedScopeKey,
  shortcutModifierLabel,
}: {
  availableEntityKinds: SelectableEntityKind[]
  canCreate: boolean
  creating: boolean
  data: AppData
  description: string
  descriptionLimitState: ReturnType<typeof getTextInputLimitState>
  dialog: CreateViewDialogState
  draftActions: ReturnType<typeof useCreateViewDraftActions>
  draftView: ViewDefinition | null
  effectiveScope: ReturnType<typeof getEffectiveCreateViewScope>
  editingView: ViewDefinition | null
  groupOptions: ReturnType<typeof getAvailableGroupOptions>
  groupingExperience?: TeamExperienceType | null
  isProjectSpecificItemView: boolean
  name: string
  nameLimitState: ReturnType<typeof getTextInputLimitState>
  onCreate: () => void
  onDescriptionChange: (description: string) => void
  onNameChange: (name: string) => void
  onOpenChange: (open: boolean) => void
  onSelectEntityKind: (entityKind: SelectableEntityKind) => void
  onSelectScope: (scopeKey: string) => void
  open: boolean
  projectPicker: ReactNode
  resolvedRoute: string | null
  scopedDocuments: Document[]
  scopedItems: WorkItem[]
  scopedProjects: Project[]
  scopeOptions: ScopeOption[]
  selectedEntityKind: SelectableEntityKind
  selectedProject: Project | null
  selectedScope: ScopeOption | null
  selectedScopeKey: string
  shortcutModifierLabel: string
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!creating) {
          onOpenChange(nextOpen)
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] max-h-[calc(100vh-3rem)] translate-y-0 gap-0 overflow-hidden rounded-xl border border-line bg-surface p-0 shadow-lg sm:top-[14vh] sm:max-w-[760px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{editingView ? "Edit view" : "New view"}</DialogTitle>
          <DialogDescription>
            {editingView
              ? "Update this saved workspace or team view."
              : "Create a saved view for a workspace or team surface."}
          </DialogDescription>
        </DialogHeader>

        <CreateViewDialogTopBar
          dialog={dialog}
          selectedEntityKind={selectedEntityKind}
          availableEntityKinds={availableEntityKinds}
          onSelectEntityKind={onSelectEntityKind}
          scopeOptions={scopeOptions}
          selectedScopeKey={selectedScopeKey}
          onSelectScope={onSelectScope}
          isProjectSpecificItemView={isProjectSpecificItemView}
          selectedProject={selectedProject}
        />

        <CreateViewDialogFields
          name={name}
          onNameChange={onNameChange}
          description={description}
          onDescriptionChange={onDescriptionChange}
          nameLimitState={nameLimitState}
          descriptionLimitState={descriptionLimitState}
          isProjectSpecificItemView={isProjectSpecificItemView}
          selectedEntityKind={selectedEntityKind}
        />

        <CreateViewControls
          data={data}
          selectedEntityKind={selectedEntityKind}
          draftView={draftView}
          scopedDocuments={scopedDocuments}
          scopedItems={scopedItems}
          scopedProjects={scopedProjects}
          groupOptions={groupOptions}
          groupingExperience={groupingExperience}
          projectPicker={projectPicker}
          onUpdateDraftView={draftActions.updateView}
          onToggleFilterValue={draftActions.toggleFilterValue}
          onClearFilters={draftActions.clearFilters}
          onToggleDisplayProperty={draftActions.toggleDisplayProperty}
          onReorderDisplayProperties={draftActions.reorderDisplayProperties}
          onClearDisplayProperties={draftActions.clearDisplayProperties}
        />

        <CreateViewRouteWarning resolvedRoute={resolvedRoute} />

        <CreateViewDialogFooter
          effectiveScope={effectiveScope}
          selectedProject={selectedProject}
          selectedScope={selectedScope}
          canCreate={canCreate}
          creating={creating}
          isEditing={Boolean(editingView)}
          shortcutModifierLabel={shortcutModifierLabel}
          onCancel={() => onOpenChange(false)}
          onCreate={onCreate}
        />
      </DialogContent>
    </Dialog>
  )
}

function CreateViewProjectPicker({
  showProjectPicker,
  locked,
  open,
  onOpenChange,
  query,
  onQueryChange,
  selectedProject,
  selectedProjectId,
  projectOptions,
  onSelectProject,
}: {
  showProjectPicker: boolean
  locked: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  selectedProject: Project | null
  selectedProjectId: string
  projectOptions: Project[]
  onSelectProject: (projectId: string) => void
}) {
  if (!showProjectPicker) {
    return null
  }

  if (locked) {
    return (
      <div className={cn(chipSelectTriggerClass, "pointer-events-none")}>
        <span className="truncate">{selectedProject?.name ?? "Project"}</span>
      </div>
    )
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filteredProjects = projectOptions.filter((project) =>
    project.name.toLowerCase().includes(normalizedQuery)
  )

  function closePicker() {
    onOpenChange(false)
    onQueryChange("")
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          onQueryChange("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Project"
          className={cn(
            chipSelectTriggerClass,
            !selectedProject && chipTriggerDashedClass
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <FolderSimple className="size-[13px] shrink-0" />
            <span
              className={cn(
                "truncate",
                selectedProject && "font-medium text-foreground"
              )}
            >
              {selectedProject?.name ?? "Project"}
            </span>
          </span>
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[280px]")}
      >
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-[14px]" />}
          placeholder="Find project..."
          value={query}
          onChange={onQueryChange}
        />
        <PropertyPopoverList>
          {filteredProjects.length > 0 ? (
            <>
              <PropertyPopoverGroup>Projects</PropertyPopoverGroup>
              {filteredProjects.map((project) => {
                const selected = project.id === selectedProjectId
                return (
                  <PropertyPopoverItem
                    key={project.id}
                    selected={selected}
                    onClick={() => {
                      onSelectProject(project.id)
                      closePicker()
                    }}
                    trailing={
                      selected ? (
                        <Check className="size-[14px] text-foreground" />
                      ) : null
                    }
                  >
                    <FolderSimple className="size-[13px] shrink-0 text-fg-3" />
                    <span className="truncate">{project.name}</span>
                  </PropertyPopoverItem>
                )
              })}
            </>
          ) : null}
          <PropertyPopoverItem
            selected={!selectedProject}
            onClick={() => {
              onSelectProject("")
              closePicker()
            }}
            trailing={
              !selectedProject ? (
                <Check className="size-[14px] text-foreground" />
              ) : null
            }
          >
            <FolderSimple className="size-[13px] shrink-0 text-fg-3" />
            <span>Project</span>
          </PropertyPopoverItem>
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

function CreateDocsFilterPopover({
  data,
  documents,
  draftView,
  onClearFilters,
  onToggleFilterValue,
}: {
  data: AppData
  documents: Document[]
  draftView: ViewDefinition
  onClearFilters: () => void
  onToggleFilterValue: (key: ViewFilterKey, value: string) => void
}) {
  const optionGroups = groupDocsFilterOptions(
    buildDocsFilterOptions(data, documents)
  )
  const count = getDocsFilterCount(draftView)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            chipSelectTriggerClass,
            count === 0 && chipTriggerDashedClass
          )}
        >
          <FunnelSimple className="size-[13px] shrink-0" />
          <span>Filter</span>
          {count > 0 ? (
            <span className="rounded-full bg-background/60 px-1 text-[10px]">
              {count}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[280px]")}
      >
        <DocsFilterOptionsList
          checkClassName="size-[14px] text-foreground"
          optionGroups={optionGroups}
          view={draftView}
          onToggleFilter={onToggleFilterValue}
        />
        <div className="flex items-center justify-between border-t border-line-soft px-3 py-2 text-[11px] text-fg-3">
          <span>{count} active</span>
          {count > 0 ? (
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={onClearFilters}
            >
              Clear all
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function CreateDocsGroupPopover({
  draftView,
  onUpdateDraftView,
}: {
  draftView: ViewDefinition
  onUpdateDraftView: (patch: ViewConfigPatch) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={chipSelectTriggerClass}>
          <TreeStructure className="size-[13px] shrink-0" />
          <span>Group</span>
          <span className="font-medium text-foreground">
            · {getGroupFieldOptionLabel(draftView.grouping)}
          </span>
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[220px]")}
      >
        <PropertyPopoverList>
          <PropertyPopoverGroup>Group by</PropertyPopoverGroup>
          {DOCS_GROUP_OPTIONS.map((option) => {
            const selected = draftView.grouping === option

            return (
              <PropertyPopoverItem
                key={option}
                selected={selected}
                onClick={() => onUpdateDraftView({ grouping: option })}
                trailing={
                  selected ? (
                    <Check className="size-[14px] text-foreground" />
                  ) : null
                }
              >
                {getGroupFieldOptionLabel(option)}
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

function CreateDocsSortPopover({
  draftView,
  onUpdateDraftView,
}: {
  draftView: ViewDefinition
  onUpdateDraftView: (patch: ViewConfigPatch) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={chipSelectTriggerClass}>
          <SortAscending className="size-[13px] shrink-0" />
          <span>{DOCS_ORDERING_LABEL[draftView.ordering]}</span>
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[200px]")}
      >
        <PropertyPopoverList>
          <PropertyPopoverGroup>Order by</PropertyPopoverGroup>
          {DOCS_ORDERING_OPTIONS.map((option) => {
            const selected = draftView.ordering === option

            return (
              <PropertyPopoverItem
                key={option}
                selected={selected}
                onClick={() => onUpdateDraftView({ ordering: option })}
                trailing={
                  selected ? (
                    <Check className="size-[14px] text-foreground" />
                  ) : null
                }
              >
                {DOCS_ORDERING_LABEL[option]}
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

function CreateViewDialogTopBar({
  dialog,
  selectedEntityKind,
  availableEntityKinds,
  onSelectEntityKind,
  scopeOptions,
  selectedScopeKey,
  onSelectScope,
  isProjectSpecificItemView,
  selectedProject,
}: {
  dialog: CreateViewDialogState
  selectedEntityKind: SelectableEntityKind
  availableEntityKinds: SelectableEntityKind[]
  onSelectEntityKind: (entityKind: SelectableEntityKind) => void
  scopeOptions: ScopeOption[]
  selectedScopeKey: string
  onSelectScope: (scopeKey: string) => void
  isProjectSpecificItemView: boolean
  selectedProject: Project | null
}) {
  return (
    <div className="flex items-center gap-1 border-b border-line-soft px-3.5 py-2 text-[12.5px] text-fg-3">
      {!dialog.lockEntityKind ? (
        <Select
          value={selectedEntityKind}
          onValueChange={(value) =>
            onSelectEntityKind(value as SelectableEntityKind)
          }
        >
          <SelectTrigger
            aria-label="Entity kind"
            className="h-7 w-[112px] border border-transparent bg-transparent px-2 text-[12.5px] text-fg-2 shadow-none hover:bg-surface-3 focus:ring-2 focus:ring-ring/40"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableEntityKinds.map((entityKind) => (
              <SelectItem key={entityKind} value={entityKind}>
                {ENTITY_KIND_LABEL[entityKind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {!isProjectSpecificItemView ? (
        <TeamSpaceCrumbPicker
          options={scopeOptions.map((option) => ({
            id: option.key,
            label: option.label,
            teamId: option.scopeId,
            section: option.section,
          }))}
          selectedId={selectedScopeKey}
          onSelect={onSelectScope}
          triggerClassName={crumbTriggerClass}
        />
      ) : (
        <span className={crumbTriggerClass}>
          <span className="font-medium text-foreground">
            {selectedProject?.name ?? "Project"}
          </span>
        </span>
      )}
      <div className="ml-auto flex items-center gap-0.5">
        <DialogClose asChild>
          <button
            type="button"
            className="inline-grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-[14px]" />
          </button>
        </DialogClose>
      </div>
    </div>
  )
}

function CreateViewDialogFields({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  nameLimitState,
  descriptionLimitState,
  isProjectSpecificItemView,
  selectedEntityKind,
}: {
  name: string
  onNameChange: (name: string) => void
  description: string
  onDescriptionChange: (description: string) => void
  nameLimitState: ReturnType<typeof getTextInputLimitState>
  descriptionLimitState: ReturnType<typeof getTextInputLimitState>
  isProjectSpecificItemView: boolean
  selectedEntityKind: SelectableEntityKind
}) {
  const setupCopy = isProjectSpecificItemView
    ? "Set the layout, filters, grouping, sorting, and properties for this project view."
    : selectedEntityKind === "docs"
      ? "Start with a clean document view, then choose its space, filters, grouping, sorting, and properties."
      : selectedEntityKind === "projects"
        ? "Start with a clean project view, then choose its space, filters, and sorting."
        : "Start with a clean item view, then choose its space, optional project filter, filters, grouping, sorting, and properties."

  return (
    <div className="px-[18px] pt-3 pb-0.5">
      <Input
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="View name"
        maxLength={viewNameConstraints.max}
        className="h-auto border-none bg-transparent px-0 py-1 text-[20px] font-semibold tracking-[-0.01em] shadow-none placeholder:font-medium placeholder:text-fg-4 focus-visible:ring-0 dark:bg-transparent"
        autoFocus
      />
      <FieldCharacterLimit
        state={nameLimitState}
        limit={viewNameConstraints.max}
        className="mt-1"
      />
      <Textarea
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="What this view is for"
        maxLength={viewDescriptionConstraints.max}
        rows={3}
        className="mt-0.5 min-h-[84px] resize-none border-none bg-transparent px-0 py-1 text-[13.5px] leading-[1.6] text-fg-2 shadow-none placeholder:text-fg-4 focus-visible:ring-0 dark:bg-transparent"
      />
      <FieldCharacterLimit
        state={descriptionLimitState}
        limit={viewDescriptionConstraints.max}
        className="mt-1"
      />
      <div className="pt-1 pb-2 text-[11.5px] text-fg-4">{setupCopy}</div>
    </div>
  )
}

function CreateViewControls({
  data,
  selectedEntityKind,
  draftView,
  scopedDocuments,
  scopedItems,
  scopedProjects,
  groupOptions,
  groupingExperience,
  projectPicker,
  onUpdateDraftView,
  onToggleFilterValue,
  onClearFilters,
  onToggleDisplayProperty,
  onReorderDisplayProperties,
  onClearDisplayProperties,
}: {
  data: AppData
  selectedEntityKind: SelectableEntityKind
  draftView: ViewDefinition | null
  scopedDocuments: Document[]
  scopedItems: WorkItem[]
  scopedProjects: Project[]
  groupOptions: ReturnType<typeof getAvailableGroupOptions>
  groupingExperience?: TeamExperienceType | null
  projectPicker: ReactNode
  onUpdateDraftView: (patch: ViewConfigPatch) => void
  onToggleFilterValue: (key: ViewFilterKey, value: string) => void
  onClearFilters: () => void
  onToggleDisplayProperty: (property: DisplayProperty) => void
  onReorderDisplayProperties: (displayProps: DisplayProperty[]) => void
  onClearDisplayProperties: () => void
}) {
  if (selectedEntityKind === "items") {
    return (
      <div className="border-t border-line-soft bg-background px-3.5 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {draftView ? (
            <>
              <LayoutChipPopover
                view={draftView}
                onUpdateView={onUpdateDraftView}
              />
              <FilterPopover
                view={draftView}
                items={scopedItems}
                onToggleFilterValue={onToggleFilterValue}
                onClearFilters={onClearFilters}
                groupingExperience={groupingExperience}
                variant="chip"
                chipTone="default"
                dashedWhenEmpty
              />
              {projectPicker}
              <LevelChipPopover
                view={draftView}
                onUpdateView={onUpdateDraftView}
              />
              <GroupChipPopover
                view={draftView}
                groupOptions={groupOptions}
                groupingExperience={groupingExperience}
                onUpdateView={onUpdateDraftView}
                tone="default"
                showValue={false}
              />
              <SortChipPopover
                view={draftView}
                onUpdateView={onUpdateDraftView}
                label="Sort"
                showValue={false}
              />
              <PropertiesChipPopover
                view={draftView}
                onToggleDisplayProperty={onToggleDisplayProperty}
                onReorderDisplayProperties={onReorderDisplayProperties}
                onClearDisplayProperties={onClearDisplayProperties}
                tone="default"
                dashedWhenEmpty
              />
            </>
          ) : (
            projectPicker
          )}
        </div>
      </div>
    )
  }

  if (selectedEntityKind === "projects" && draftView) {
    return (
      <div className="border-t border-line-soft bg-background px-3.5 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ProjectLayoutChipPopover
            view={draftView}
            onUpdateView={onUpdateDraftView}
          />
          <ProjectFilterPopover
            view={draftView}
            projects={scopedProjects}
            onToggleFilterValue={onToggleFilterValue}
            onClearFilters={onClearFilters}
            variant="chip"
            chipTone="default"
            dashedWhenEmpty
          />
          <ProjectSortChipPopover
            view={draftView}
            onUpdateView={onUpdateDraftView}
            label="Sort"
            showValue={false}
          />
        </div>
      </div>
    )
  }

  if (selectedEntityKind === "docs" && draftView) {
    return (
      <div className="border-t border-line-soft bg-background px-3.5 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ProjectLayoutChipPopover
            view={draftView}
            onUpdateView={onUpdateDraftView}
          />
          <CreateDocsFilterPopover
            data={data}
            documents={scopedDocuments}
            draftView={draftView}
            onToggleFilterValue={onToggleFilterValue}
            onClearFilters={onClearFilters}
          />
          <CreateDocsGroupPopover
            draftView={draftView}
            onUpdateDraftView={onUpdateDraftView}
          />
          <CreateDocsSortPopover
            draftView={draftView}
            onUpdateDraftView={onUpdateDraftView}
          />
          <PropertiesChipPopover
            view={draftView}
            propertyOptions={DOCS_DISPLAY_PROPERTY_OPTIONS}
            getPropertyLabel={(property) =>
              DOCS_DISPLAY_PROPERTY_LABEL[property] ?? "Property"
            }
            onToggleDisplayProperty={onToggleDisplayProperty}
            onReorderDisplayProperties={onReorderDisplayProperties}
            onClearDisplayProperties={onClearDisplayProperties}
            tone="default"
            dashedWhenEmpty
          />
        </div>
      </div>
    )
  }

  return null
}

function CreateViewRouteWarning({
  resolvedRoute,
}: {
  resolvedRoute: string | null
}) {
  if (resolvedRoute) {
    return null
  }

  return (
    <p className="px-[18px] pt-2 text-xs text-destructive">
      Select a space to create this view.
    </p>
  )
}

function CreateViewDialogFooter({
  effectiveScope,
  selectedProject,
  selectedScope,
  canCreate,
  creating,
  isEditing,
  shortcutModifierLabel,
  onCancel,
  onCreate,
}: {
  effectiveScope: Pick<ScopeOption, "scopeType" | "scopeId"> | null
  selectedProject: Project | null
  selectedScope: ScopeOption | null
  canCreate: boolean
  creating: boolean
  isEditing: boolean
  shortcutModifierLabel: string
  onCancel: () => void
  onCreate: () => void | Promise<void>
}) {
  return (
    <div className="flex items-center gap-2.5 border-t border-line-soft bg-background px-3.5 py-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-fg-3">
        <FolderSimple className="size-[13px] shrink-0" />
        <span className="truncate">
          {effectiveScope ? (
            <>
              Saving in{" "}
              <b className="font-medium text-foreground">
                {selectedProject
                  ? selectedProject.name
                  : (selectedScope?.label ?? "Scope")}
              </b>
            </>
          ) : (
            "Select a space"
          )}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
          <ShortcutKeys
            keys={["Esc"]}
            className="ml-1"
            keyClassName="h-[18px] min-w-0 rounded-[4px] border-line bg-surface-2 px-1 text-[10.5px] text-fg-3 shadow-none"
          />
        </Button>
        <Button
          size="sm"
          disabled={!canCreate || creating}
          onClick={onCreate}
          className="gap-1"
        >
          {isEditing ? "Save view" : "Create view"}
          <ShortcutKeys
            keys={[shortcutModifierLabel, "Enter"]}
            variant="inline"
            className="ml-0.5 gap-0.5 text-background/65"
          />
        </Button>
      </div>
    </div>
  )
}

export function CreateViewDialog({
  open,
  onOpenChange,
  dialog,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dialog: CreateViewDialogState
}) {
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const currentWorkspace = useMemo(() => getCurrentWorkspace(data), [data])
  const editingView = useMemo(
    () =>
      dialog.editViewId
        ? (data.views.find((view) => view.id === dialog.editViewId) ?? null)
        : null,
    [data.views, dialog.editViewId]
  )
  const editableTeams = useMemo(
    () => getEditableTeamsForFeature(data, "views"),
    [data]
  )
  const availableEntityKinds = useMemo(
    () =>
      getAvailableCreateViewEntityKinds({
        currentWorkspace,
        data,
        editableTeams,
      }),
    [currentWorkspace, data, editableTeams]
  )
  const initialEntityKind = getInitialCreateViewEntityKind({
    availableEntityKinds,
    dialog,
    editingView,
  })
  const [selectedEntityKind, setSelectedEntityKind] =
    useState<SelectableEntityKind>(initialEntityKind)
  const scopeOptions = useMemo(
    () =>
      getCreateViewScopeOptions({
        currentWorkspace,
        data,
        editableTeams,
        selectedEntityKind,
      }),
    [currentWorkspace, data, editableTeams, selectedEntityKind]
  )
  const editableScopeOverride = getEditingViewScopeOverride(editingView)
  const initialScopeKey = getInitialScopeKey({
    dialog: getInitialCreateViewScopeDialog(dialog, editableScopeOverride),
    scopeOptions,
  })
  const [name, setName] = useState(editingView?.name ?? "")
  const [description, setDescription] = useState(editingView?.description ?? "")
  const [selectedScopeKey, setSelectedScopeKey] = useState(initialScopeKey)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [projectQuery, setProjectQuery] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState(
    getInitialSelectedProjectId(dialog, editingView)
  )
  const [draftConfig, setDraftConfig] = useState<DraftViewConfig>(() =>
    getInitialDraftConfig(dialog, selectedEntityKind, editingView)
  )
  const [creating, setCreating] = useState(false)
  const shortcutModifierLabel = useShortcutModifierLabel()
  const nameLimitState = getTextInputLimitState(name, viewNameConstraints)
  const descriptionLimitState = getTextInputLimitState(
    description,
    viewDescriptionConstraints
  )

  useCreateViewDialogOpenReset({
    dialog,
    editingView,
    initialEntityKind,
    initialScopeKey,
    open,
    setCreating,
    setDescription,
    setDraftConfig,
    setName,
    setProjectPickerOpen,
    setProjectQuery,
    setSelectedEntityKind,
    setSelectedProjectId,
    setSelectedScopeKey,
  })

  const selectedScope =
    scopeOptions.find((option) => option.key === selectedScopeKey) ?? null
  const selectedTeam = useMemo(
    () =>
      getSelectedCreateViewTeam({
        editableTeams,
        selectedScope,
      }),
    [editableTeams, selectedScope]
  )
  const projectOptions = useMemo(() => {
    return getCreateViewProjectOptions({
      data,
      dialog,
      editableTeams,
      selectedEntityKind,
      selectedScope,
      selectedTeam,
    })
  }, [
    data,
    dialog,
    editableTeams,
    selectedEntityKind,
    selectedScope,
    selectedTeam,
  ])
  const selectedProject = useMemo(
    () =>
      getSelectedCreateViewProject({
        data,
        dialog,
        projectOptions,
        selectedProjectId,
      }),
    [data, dialog, projectOptions, selectedProjectId]
  )
  const selectedProjectTeam = useMemo(
    () => (selectedProject ? getProjectTeam(data, selectedProject) : null),
    [data, selectedProject]
  )
  const effectiveScope = useMemo(
    () =>
      getEffectiveCreateViewScope({
        dialog,
        selectedEntityKind,
        selectedProject,
        selectedScope,
      }),
    [dialog, selectedEntityKind, selectedProject, selectedScope]
  )
  const effectiveTeam = selectedProjectTeam ?? selectedTeam
  const resolvedRoute = useMemo(() => {
    return getResolvedCreateViewRoute({
      data,
      dialog,
      selectedEntityKind,
      selectedProject,
      selectedScope,
      selectedTeam,
    })
  }, [
    data,
    dialog,
    selectedEntityKind,
    selectedProject,
    selectedScope,
    selectedTeam,
  ])
  const scopedProjects = useMemo(
    () =>
      effectiveScope
        ? getProjectsForScope(
            data,
            effectiveScope.scopeType,
            effectiveScope.scopeId
          )
        : [],
    [data, effectiveScope]
  )
  const scopedItems = useMemo(() => {
    return getScopedCreateViewItems({
      data,
      selectedEntityKind,
      selectedProject,
      selectedScope,
    })
  }, [data, selectedEntityKind, selectedProject, selectedScope])
  const scopedDocuments = useMemo(() => {
    return getScopedCreateViewDocuments({
      data,
      effectiveScope,
      selectedEntityKind,
    })
  }, [data, effectiveScope, selectedEntityKind])
  const groupOptions = useMemo(
    () => getCreateViewGroupOptions({ effectiveTeam, selectedProject }),
    [effectiveTeam, selectedProject]
  )
  const groupingExperience =
    selectedProjectTeam?.settings.experience ??
    effectiveTeam?.settings.experience ??
    null
  const defaultItemLevel = useMemo(() => {
    return getCreateViewDefaultItemLevel({
      effectiveTeam,
      selectedEntityKind,
      selectedProject,
      selectedProjectTeam,
    })
  }, [effectiveTeam, selectedEntityKind, selectedProject, selectedProjectTeam])
  const draftView = useMemo(() => {
    return createDraftViewDefinition({
      defaultItemLevel,
      description,
      draftConfig,
      effectiveScope,
      effectiveTeam,
      name,
      resolvedRoute,
      selectedEntityKind,
    })
  }, [
    defaultItemLevel,
    description,
    draftConfig,
    effectiveScope,
    effectiveTeam,
    name,
    resolvedRoute,
    selectedEntityKind,
  ])
  const isProjectSpecificItemView = isCreateViewProjectSpecificItemView({
    dialog,
    selectedEntityKind,
    selectedProject,
  })
  const projectViewContainer = getProjectViewContainer({
    selectedEntityKind,
    selectedProject,
  })
  const canCreate = canSubmitCreateView({
    descriptionLimitState,
    effectiveScope,
    nameLimitState,
    resolvedRoute,
  })
  const showProjectPicker = shouldShowCreateViewProjectPicker({
    isProjectSpecificItemView,
    projectOptions,
    selectedProject,
  })

  useCreateViewSelectionGuards({
    availableEntityKinds,
    dialog,
    editingView,
    initialEntityKind,
    initialScopeKey,
    open,
    projectOptions,
    scopeOptions,
    selectedEntityKind,
    selectedProject,
    selectedProjectId,
    selectedScope,
    selectedScopeKey,
    setDraftConfig,
    setSelectedEntityKind,
    setSelectedProjectId,
    setSelectedScopeKey,
  })
  useCreateViewDraftPruning({
    data,
    effectiveScope,
    scopedProjects,
    setDraftConfig,
  })
  const draftActions = useCreateViewDraftActions({
    draftView,
    setDraftConfig,
  })

  async function handleCreate() {
    if (creating || !effectiveScope || !resolvedRoute) {
      return
    }

    setCreating(true)

    try {
      const saved = await submitCreateViewDialog({
        description,
        dialog,
        draftView,
        effectiveScope,
        editingView,
        name,
        projectViewContainer,
        resolvedRoute,
        selectedEntityKind,
      })

      if (saved) {
        onOpenChange(false)
      }
    } finally {
      setCreating(false)
    }
  }

  useCommandEnterSubmit(open && canCreate && !creating, () => {
    void handleCreate()
  })

  const projectPicker = (
    <CreateViewProjectPicker
      showProjectPicker={Boolean(showProjectPicker)}
      locked={Boolean(dialog.lockProject)}
      open={projectPickerOpen}
      onOpenChange={setProjectPickerOpen}
      query={projectQuery}
      onQueryChange={setProjectQuery}
      selectedProject={selectedProject}
      selectedProjectId={selectedProjectId}
      projectOptions={projectOptions}
      onSelectProject={setSelectedProjectId}
    />
  )

  function handleSelectEntityKind(entityKind: SelectableEntityKind) {
    setSelectedEntityKind(entityKind)
    setDraftConfig(getInitialDraftConfig(dialog, entityKind, editingView))

    if (entityKind !== "items") {
      setProjectPickerOpen(false)
      setProjectQuery("")
      setSelectedProjectId("")
    }
  }

  return (
    <CreateViewDialogFrame
      availableEntityKinds={availableEntityKinds}
      canCreate={canCreate}
      creating={creating}
      data={data}
      description={description}
      descriptionLimitState={descriptionLimitState}
      dialog={dialog}
      draftActions={draftActions}
      draftView={draftView}
      effectiveScope={effectiveScope}
      editingView={editingView}
      groupOptions={groupOptions}
      groupingExperience={groupingExperience}
      isProjectSpecificItemView={isProjectSpecificItemView}
      name={name}
      nameLimitState={nameLimitState}
      open={open}
      projectPicker={projectPicker}
      resolvedRoute={resolvedRoute}
      scopedDocuments={scopedDocuments}
      scopedItems={scopedItems}
      scopedProjects={scopedProjects}
      scopeOptions={scopeOptions}
      selectedEntityKind={selectedEntityKind}
      selectedProject={selectedProject}
      selectedScope={selectedScope}
      selectedScopeKey={selectedScopeKey}
      shortcutModifierLabel={shortcutModifierLabel}
      onCreate={handleCreate}
      onDescriptionChange={setDescription}
      onNameChange={setName}
      onOpenChange={onOpenChange}
      onSelectEntityKind={handleSelectEntityKind}
      onSelectScope={setSelectedScopeKey}
    />
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import {
  CaretDown,
  Check,
  FolderSimple,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react"

import {
  getEditableTeamsForFeature,
  getProject,
  getProjectHref,
  getProjectTeam,
  getProjectsForScope,
  getVisibleWorkItems,
  teamHasFeature,
} from "@/lib/domain/selectors"
import {
  createViewDefinition,
  getDefaultRouteForViewContext,
  isRouteAllowedForViewContext,
} from "@/lib/domain/default-views"
import {
  createDefaultViewFilters,
  getDefaultViewItemLevelForProjectTemplate,
  getDefaultTemplateTypeForTeamExperience,
  getDefaultViewItemLevelForTeamExperience,
  type CreateDialogState,
  type DisplayProperty,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import {
  createEmptyViewFilters,
  type ViewFilterKey,
  selectAppDataSnapshot,
} from "@/components/app/screens/helpers"
import {
  FilterPopover,
  getAvailableGroupOptions,
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
import { Textarea } from "@/components/ui/textarea"
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
  PropertyPopoverSearch,
} from "@/components/ui/template-primitives"
import { cn } from "@/lib/utils"

type CreateViewDialogState = Extract<CreateDialogState, { kind: "view" }>
type DraftViewConfig = NonNullable<CreateViewDialogState["initialConfig"]>

const crumbTriggerClass =
  "inline-flex h-7 w-fit items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

const chipSelectTriggerClass =
  "inline-flex h-7 min-w-0 max-w-[220px] items-center justify-between gap-1.5 rounded-md border border-line bg-surface px-2 text-[12px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"

const chipTriggerDashedClass =
  "border-dashed bg-transparent text-fg-3 hover:bg-surface-3 hover:text-foreground"

function getScopeKey(scopeType: "team" | "workspace", scopeId: string) {
  return `${scopeType}:${scopeId}`
}

function getInitialScopeKey(input: {
  dialog: CreateViewDialogState
  scopeOptions: Array<{
    key: string
    scopeType: "team"
    scopeId: string
    label: string
  }>
}) {
  const defaultScopeKey =
    input.dialog.defaultScopeType === "team" && input.dialog.defaultScopeId
      ? getScopeKey("team", input.dialog.defaultScopeId)
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
  const selectedEntityKind: "items" | "projects" | "docs" =
    dialog.defaultEntityKind ?? "items"
  const editableTeams = useMemo(
    () => getEditableTeamsForFeature(data, "views"),
    [data]
  )
  const scopeOptions = useMemo(() => {
    const nextOptions: Array<{
      key: string
      scopeType: "team"
      scopeId: string
      label: string
    }> = []

    editableTeams
      .filter((team) => {
        if (!teamHasFeature(team, "views")) {
          return false
        }

        if (selectedEntityKind === "items") {
          return teamHasFeature(team, "issues")
        }

        if (selectedEntityKind === "projects") {
          return teamHasFeature(team, "projects")
        }

        return teamHasFeature(team, "docs")
      })
      .forEach((team) => {
        nextOptions.push({
          key: getScopeKey("team", team.id),
          scopeType: "team",
          scopeId: team.id,
          label: team.name,
        })
      })

    return nextOptions
  }, [editableTeams, selectedEntityKind])
  const initialScopeKey = getInitialScopeKey({
    dialog,
    scopeOptions,
  })
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedScopeKey, setSelectedScopeKey] = useState(initialScopeKey)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [projectQuery, setProjectQuery] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState(
    dialog.lockProject ? (dialog.defaultProjectId ?? "") : ""
  )
  const [draftConfig, setDraftConfig] = useState<DraftViewConfig>(() =>
    createFreshDraftConfig(selectedEntityKind)
  )
  const [creating, setCreating] = useState(false)
  const shortcutModifierLabel = useShortcutModifierLabel()

  useEffect(() => {
    if (!open) {
      return
    }

    setName("")
    setDescription("")
    setCreating(false)
    setSelectedScopeKey(initialScopeKey)
    setProjectPickerOpen(false)
    setProjectQuery("")
    setSelectedProjectId(dialog.lockProject ? (dialog.defaultProjectId ?? "") : "")
    setDraftConfig(createFreshDraftConfig(selectedEntityKind))
  }, [
    dialog.defaultEntityKind,
    dialog.defaultProjectId,
    dialog.lockProject,
    initialScopeKey,
    open,
    selectedEntityKind,
  ])

  const selectedScope = scopeOptions.find((option) => option.key === selectedScopeKey) ?? null
  const selectedTeam = useMemo(
    () =>
      selectedScope
        ? (editableTeams.find((team) => team.id === selectedScope.scopeId) ?? null)
        : null,
    [editableTeams, selectedScope]
  )
  const projectOptions = useMemo(() => {
    if (selectedEntityKind !== "items") {
      return []
    }

    if (dialog.lockProject && dialog.defaultProjectId) {
      const lockedProject = getProject(data, dialog.defaultProjectId)
      return lockedProject ? [lockedProject] : []
    }

    if (!selectedTeam) {
      return []
    }

    return data.projects
      .filter((project) =>
        (project.scopeType === "team" && project.scopeId === selectedTeam.id) ||
        (project.scopeType === "workspace" &&
          project.scopeId === selectedTeam.workspaceId)
      )
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [
    data,
    dialog.defaultProjectId,
    dialog.lockProject,
    selectedEntityKind,
    selectedTeam,
  ])
  const selectedProject = useMemo(
    () =>
      selectedProjectId
        ? (projectOptions.find((project) => project.id === selectedProjectId) ??
          getProject(data, selectedProjectId) ??
          null)
        : null,
    [data, projectOptions, selectedProjectId]
  )
  const selectedProjectTeam = useMemo(
    () => (selectedProject ? getProjectTeam(data, selectedProject) : null),
    [data, selectedProject]
  )
  const effectiveScope = useMemo(
    () =>
      selectedProject
        ? {
            scopeType: selectedProject.scopeType,
            scopeId: selectedProject.scopeId,
          }
        : selectedScope
          ? {
              scopeType: selectedScope.scopeType,
              scopeId: selectedScope.scopeId,
            }
          : null,
    [selectedProject, selectedScope]
  )
  const effectiveTeam = selectedProjectTeam ?? selectedTeam
  const resolvedRoute = useMemo(() => {
    if (selectedProject) {
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
  }, [
    data,
    dialog.defaultRoute,
    selectedEntityKind,
    selectedProject,
    selectedScope,
    selectedTeam?.slug,
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
  }, [data, selectedEntityKind, selectedProject, selectedScope])
  const groupOptions = useMemo(
    () =>
      getAvailableGroupOptions(
        selectedProject
          ? selectedProject.templateType
          : effectiveTeam
            ? getDefaultTemplateTypeForTeamExperience(
                effectiveTeam.settings.experience
              )
            : null
      ),
    [effectiveTeam, selectedProject]
  )
  const defaultItemLevel = useMemo(() => {
    if (selectedEntityKind !== "items") {
      return undefined
    }

    if (selectedProject) {
      return selectedProjectTeam
        ? getDefaultViewItemLevelForTeamExperience(
            selectedProjectTeam.settings.experience
          )
        : getDefaultViewItemLevelForProjectTemplate(
            selectedProject.templateType
          )
    }

    if (effectiveTeam) {
      return getDefaultViewItemLevelForTeamExperience(
        effectiveTeam.settings.experience
      )
    }

    return undefined
  }, [effectiveTeam, selectedEntityKind, selectedProject, selectedProjectTeam])
  const draftView = useMemo(() => {
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
      experience: effectiveTeam?.settings.experience,
      createdAt: "__draft__",
      overrides: {
        ...draftConfig,
        ...(draftConfig.itemLevel === undefined && defaultItemLevel !== undefined
          ? { itemLevel: defaultItemLevel }
          : {}),
      },
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
  const isProjectSpecificItemView =
    selectedEntityKind === "items" &&
    Boolean(selectedProject) &&
    dialog.lockProject
  const projectViewContainer =
    selectedEntityKind === "items" && selectedProject
      ? {
          containerType: "project-items" as const,
          containerId: selectedProject.id,
        }
      : {}
  const canCreate =
    name.trim().length >= 2 &&
    Boolean(effectiveScope) &&
    Boolean(resolvedRoute)

  useEffect(() => {
    if (selectedEntityKind === "items") {
      return
    }

    if (selectedProjectId) {
      setSelectedProjectId("")
    }
  }, [selectedEntityKind, selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId) {
      return
    }

    const nextProjectId = projectOptions.some(
      (project) => project.id === selectedProjectId
    )
      ? selectedProjectId
      : ""

    if (nextProjectId !== selectedProjectId && !dialog.lockProject) {
      setSelectedProjectId(nextProjectId)
    }
  }, [dialog.lockProject, projectOptions, selectedProjectId])

  useEffect(() => {
    if (!selectedProject) {
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
  }, [scopeOptions, selectedProject, selectedScopeKey])

  useEffect(() => {
    if (!effectiveScope) {
      return
    }

    setDraftConfig((current) => {
      if (!current.filters) {
        return current
      }

      const projectIds = new Set(scopedProjects.map((project) => project.id))
      const teamIds = new Set(
        effectiveScope.scopeType === "team"
          ? [effectiveScope.scopeId]
          : data.teams
              .filter((team) => team.workspaceId === effectiveScope.scopeId)
              .map((team) => team.id)
      )
      const nextProjectIds = current.filters.projectIds.filter((id) =>
        projectIds.has(id)
      )
      const nextTeamIds = current.filters.teamIds.filter((id) => teamIds.has(id))

      if (
        nextProjectIds.length === current.filters.projectIds.length &&
        nextTeamIds.length === current.filters.teamIds.length
      ) {
        return current
      }

      return {
        ...current,
        filters: {
          ...current.filters,
          projectIds: nextProjectIds,
          teamIds: nextTeamIds,
        },
      }
    })
  }, [data.teams, effectiveScope, scopedProjects])

  function updateDraftView(patch: ViewConfigPatch) {
    setDraftConfig((current) => ({
      ...current,
      ...(patch.layout !== undefined ? { layout: patch.layout } : {}),
      ...(patch.grouping !== undefined ? { grouping: patch.grouping } : {}),
      ...(patch.subGrouping !== undefined
        ? { subGrouping: patch.subGrouping }
        : {}),
      ...(patch.ordering !== undefined ? { ordering: patch.ordering } : {}),
      ...(patch.itemLevel !== undefined ? { itemLevel: patch.itemLevel } : {}),
      ...(patch.showChildItems !== undefined
        ? { showChildItems: patch.showChildItems }
        : {}),
      ...(patch.showCompleted !== undefined
        ? {
            filters: {
              ...(current.filters ?? createDefaultViewFilters()),
              showCompleted: patch.showCompleted,
            },
          }
        : {}),
    }))
  }

  function toggleDraftFilterValue(key: ViewFilterKey, value: string) {
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
    })
  }

  function clearDraftFilters() {
    setDraftConfig((current) => ({
      ...current,
      filters: createEmptyViewFilters(),
    }))
  }

  function toggleDraftDisplayProperty(property: DisplayProperty) {
    setDraftConfig((current) => {
      const displayProps = current.displayProps ?? draftView?.displayProps ?? []
      const nextDisplayProps = displayProps.includes(property)
        ? displayProps.filter((value) => value !== property)
        : [...displayProps, property]

      return {
        ...current,
        displayProps: nextDisplayProps,
      }
    })
  }

  function reorderDraftDisplayProperties(displayProps: DisplayProperty[]) {
    setDraftConfig((current) => ({
      ...current,
      displayProps,
    }))
  }

  function clearDraftDisplayProperties() {
    setDraftConfig((current) => ({
      ...current,
      displayProps: [],
    }))
  }

  async function handleCreate() {
    if (creating || !effectiveScope || !resolvedRoute) {
      return
    }

    setCreating(true)

    try {
      const createConfig =
        draftView
          ? {
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
          : selectedEntityKind === dialog.defaultEntityKind
            ? createFreshDraftConfig(selectedEntityKind)
            : {}
      const viewId = useAppStore.getState().createView({
        scopeType: effectiveScope.scopeType,
        scopeId: effectiveScope.scopeId,
        entityKind: selectedEntityKind,
        ...projectViewContainer,
        route: resolvedRoute,
        name: name.trim(),
        description: description.trim(),
        ...createConfig,
      })

      if (viewId) {
        onOpenChange(false)
      }
    } finally {
      setCreating(false)
    }
  }

  useCommandEnterSubmit(open && canCreate && !creating, () => {
    void handleCreate()
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (creating) {
          return
        }

        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-6 max-h-[calc(100vh-3rem)] translate-y-0 gap-0 overflow-hidden rounded-xl border border-line bg-surface p-0 shadow-lg sm:top-10 sm:max-w-[760px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>New view</DialogTitle>
          <DialogDescription>
            Create a saved view for a workspace or team surface.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 border-b border-line-soft px-3.5 py-2 text-[12.5px] text-fg-3">
          {!isProjectSpecificItemView ? (
            <TeamSpaceCrumbPicker
              options={scopeOptions.map((option) => ({
                id: option.key,
                label: option.label,
                teamId: option.scopeId,
              }))}
              selectedId={selectedScopeKey}
              onSelect={setSelectedScopeKey}
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

        <div className="px-[18px] pt-3 pb-0.5">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="View name"
            className="h-auto border-none bg-transparent px-0 py-1 text-[20px] font-semibold tracking-[-0.01em] shadow-none placeholder:font-medium placeholder:text-fg-4 focus-visible:ring-0 dark:bg-transparent"
            autoFocus
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this view is for"
            rows={3}
            className="mt-0.5 min-h-[84px] resize-none border-none bg-transparent px-0 py-1 text-[13.5px] leading-[1.6] text-fg-2 shadow-none placeholder:text-fg-4 focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="pt-1 pb-2 text-[11.5px] text-fg-4">
            {isProjectSpecificItemView
              ? "Set the layout, filters, grouping, sorting, and properties for this project view."
              : "Start with a clean view, then choose its team, optional project scope, filters, grouping, sorting, and properties."}
          </div>
        </div>

        {selectedEntityKind === "items" ? (
          <div className="border-t border-line-soft bg-background px-3.5 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {draftView ? (
                <>
                  <LayoutChipPopover
                    view={draftView}
                    onUpdateView={updateDraftView}
                  />
                  <FilterPopover
                    view={draftView}
                    items={scopedItems}
                    onToggleFilterValue={toggleDraftFilterValue}
                    onClearFilters={clearDraftFilters}
                    variant="chip"
                    chipTone="default"
                    dashedWhenEmpty
                  />
                  {!isProjectSpecificItemView &&
                  (selectedProject || projectOptions.length > 0) ? (
                    !dialog.lockProject ? (
                      <Popover
                        open={projectPickerOpen}
                        onOpenChange={(nextOpen) => {
                          setProjectPickerOpen(nextOpen)
                          if (!nextOpen) {
                            setProjectQuery("")
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
                            placeholder="Find project…"
                            value={projectQuery}
                            onChange={setProjectQuery}
                          />
                          <PropertyPopoverList>
                            {projectOptions.filter((project) =>
                              project.name
                                .toLowerCase()
                                .includes(projectQuery.trim().toLowerCase())
                            ).length > 0 ? (
                              <>
                                <PropertyPopoverGroup>Projects</PropertyPopoverGroup>
                                {projectOptions
                                  .filter((project) =>
                                    project.name
                                      .toLowerCase()
                                      .includes(projectQuery.trim().toLowerCase())
                                  )
                                  .map((project) => {
                                    const selected =
                                      project.id === selectedProjectId
                                    return (
                                      <PropertyPopoverItem
                                        key={project.id}
                                        selected={selected}
                                        onClick={() => {
                                          setSelectedProjectId(project.id)
                                          setProjectPickerOpen(false)
                                          setProjectQuery("")
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
                                setSelectedProjectId("")
                                setProjectPickerOpen(false)
                                setProjectQuery("")
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
                    ) : (
                      <div className={cn(chipSelectTriggerClass, "pointer-events-none")}>
                        <span className="truncate">
                          {selectedProject?.name ?? "Project"}
                        </span>
                      </div>
                    )
                  ) : null}
                  <LevelChipPopover
                    view={draftView}
                    onUpdateView={updateDraftView}
                  />
                  <GroupChipPopover
                    view={draftView}
                    groupOptions={groupOptions}
                    onUpdateView={updateDraftView}
                    tone="default"
                    showValue={false}
                  />
                  <SortChipPopover
                    view={draftView}
                    onUpdateView={updateDraftView}
                    label="Sort"
                    showValue={false}
                  />
                  <PropertiesChipPopover
                    view={draftView}
                    onToggleDisplayProperty={toggleDraftDisplayProperty}
                    onReorderDisplayProperties={reorderDraftDisplayProperties}
                    onClearDisplayProperties={clearDraftDisplayProperties}
                    tone="default"
                    dashedWhenEmpty
                  />
                </>
              ) : !isProjectSpecificItemView &&
                (selectedProject || projectOptions.length > 0) ? (
                !dialog.lockProject ? null : (
                  <div className={chipSelectTriggerClass}>
                    <span className="truncate">
                      {selectedProject?.name ?? "Project"}
                    </span>
                  </div>
                )
              ) : null}
            </div>
          </div>
        ) : selectedEntityKind === "projects" && draftView ? (
          <div className="border-t border-line-soft bg-background px-3.5 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <ProjectLayoutChipPopover
                view={draftView}
                onUpdateView={updateDraftView}
              />
              <ProjectFilterPopover
                view={draftView}
                projects={scopedProjects}
                onToggleFilterValue={toggleDraftFilterValue}
                onClearFilters={clearDraftFilters}
                variant="chip"
                chipTone="default"
                dashedWhenEmpty
              />
              <ProjectSortChipPopover
                view={draftView}
                onUpdateView={updateDraftView}
                label="Sort"
                showValue={false}
              />
            </div>
          </div>
        ) : null}

        {!resolvedRoute ? (
          <p className="px-[18px] pt-2 text-xs text-destructive">
            Select a team space to create this view.
          </p>
        ) : null}

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
                "Select a team space"
              )}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
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
              onClick={handleCreate}
              className="gap-1"
            >
              Create view
              <ShortcutKeys
                keys={[shortcutModifierLabel, "Enter"]}
                variant="inline"
                className="ml-0.5 gap-0.5 text-background/65"
              />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

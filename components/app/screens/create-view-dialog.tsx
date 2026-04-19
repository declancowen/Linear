"use client"

import { useEffect, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { FolderSimple, X } from "@phosphor-icons/react"

import {
  canEditWorkspace,
  getEditableTeamsForFeature,
  teamHasFeature,
} from "@/lib/domain/selectors"
import {
  getDefaultRouteForViewContext,
  isRouteAllowedForViewContext,
} from "@/lib/domain/default-views"
import type { CreateDialogState } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { formatEntityKind } from "@/components/app/screens/shared"
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type CreateViewDialogState = Extract<CreateDialogState, { kind: "view" }>

const chipTriggerClass =
  "inline-flex h-7 w-fit max-w-full items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

const chipTriggerDashedClass =
  "border-dashed text-fg-3 bg-transparent hover:bg-surface-3"

const crumbTriggerClass =
  "inline-flex h-7 w-fit items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

function KbdHint({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <kbd
      className={cn(
        "ml-1 inline-flex h-[18px] items-center rounded-[4px] border border-line bg-surface-2 px-1 font-sans text-[10.5px] font-medium text-fg-3",
        className
      )}
    >
      {children}
    </kbd>
  )
}

function getScopeKey(scopeType: "team" | "workspace", scopeId: string) {
  return `${scopeType}:${scopeId}`
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
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId)
  const workspace = useAppStore((state) =>
    state.workspaces.find((entry) => entry.id === currentWorkspaceId) ?? null
  )
  const canEditCurrentWorkspace = useAppStore((state) =>
    currentWorkspaceId ? canEditWorkspace(state, currentWorkspaceId) : false
  )
  const editableTeams = useAppStore(
    useShallow((state) => getEditableTeamsForFeature(state, "views"))
  )
  const scopeOptions = useMemo(() => {
    const nextOptions: Array<{
      key: string
      scopeType: "team" | "workspace"
      scopeId: string
      label: string
    }> = []

    if (workspace && canEditCurrentWorkspace) {
      nextOptions.push({
        key: getScopeKey("workspace", workspace.id),
        scopeType: "workspace",
        scopeId: workspace.id,
        label: workspace.name,
      })
    }

    editableTeams.forEach((team) => {
      nextOptions.push({
        key: getScopeKey("team", team.id),
        scopeType: "team",
        scopeId: team.id,
        label: team.name,
      })
    })

    if (dialog.lockScope && dialog.defaultScopeType && dialog.defaultScopeId) {
      return nextOptions.filter(
        (option) =>
          option.scopeType === dialog.defaultScopeType &&
          option.scopeId === dialog.defaultScopeId
      )
    }

    return nextOptions
  }, [
    dialog.defaultScopeId,
    dialog.defaultScopeType,
    dialog.lockScope,
    editableTeams,
    canEditCurrentWorkspace,
    workspace,
  ])
  const defaultScopeKey =
    dialog.defaultScopeType && dialog.defaultScopeId
      ? getScopeKey(dialog.defaultScopeType, dialog.defaultScopeId)
      : null
  const initialScopeKey =
    defaultScopeKey && scopeOptions.some((option) => option.key === defaultScopeKey)
      ? defaultScopeKey
      : (scopeOptions[0]?.key ?? "")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedScopeKey, setSelectedScopeKey] = useState(initialScopeKey)
  const [selectedEntityKind, setSelectedEntityKind] = useState<
    "items" | "projects" | "docs"
  >(dialog.defaultEntityKind ?? "items")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setName("")
    setDescription("")
    setCreating(false)
    setSelectedScopeKey(initialScopeKey)
    setSelectedEntityKind(dialog.defaultEntityKind ?? "items")
  }, [dialog.defaultEntityKind, initialScopeKey, open])

  const selectedScope = scopeOptions.find((option) => option.key === selectedScopeKey) ?? null
  const selectedTeam = useMemo(
    () =>
      selectedScope?.scopeType === "team"
        ? (editableTeams.find((team) => team.id === selectedScope.scopeId) ?? null)
        : null,
    [editableTeams, selectedScope]
  )
  const entityOptions = useMemo(() => {
    if (!selectedScope) {
      return []
    }

    return (["items", "projects", "docs"] as const).filter((entityKind) => {
      if (
        dialog.lockEntityKind &&
        dialog.defaultEntityKind &&
        entityKind !== dialog.defaultEntityKind
      ) {
        return false
      }

      if (selectedScope.scopeType === "team") {
        if (!selectedTeam || !teamHasFeature(selectedTeam, "views")) {
          return false
        }

        if (entityKind === "items") {
          if (!teamHasFeature(selectedTeam, "issues")) {
            return false
          }
        } else if (entityKind === "projects") {
          if (!teamHasFeature(selectedTeam, "projects")) {
            return false
          }
        } else if (!teamHasFeature(selectedTeam, "docs")) {
          return false
        }
      } else if (
        entityKind === "items" &&
        !dialog.defaultRoute
      ) {
        return false
      }

      return dialog.defaultRoute
        ? isRouteAllowedForViewContext({
            scopeType: selectedScope.scopeType,
            entityKind,
            route: dialog.defaultRoute,
            teamSlug: selectedTeam?.slug,
          })
        : Boolean(
            getDefaultRouteForViewContext({
              scopeType: selectedScope.scopeType,
              entityKind,
              teamSlug: selectedTeam?.slug,
            })
          )
    })
  }, [
    dialog.defaultEntityKind,
    dialog.defaultRoute,
    dialog.lockEntityKind,
    selectedScope,
    selectedTeam,
  ])

  useEffect(() => {
    if (entityOptions.includes(selectedEntityKind)) {
      return
    }

    setSelectedEntityKind(entityOptions[0] ?? "items")
  }, [entityOptions, selectedEntityKind])

  const resolvedRoute =
    dialog.defaultRoute ??
    (selectedScope
      ? getDefaultRouteForViewContext({
          scopeType: selectedScope.scopeType,
          entityKind: selectedEntityKind,
          teamSlug: selectedTeam?.slug,
        })
      : null)
  const canCreate =
    name.trim().length >= 2 && Boolean(selectedScope) && Boolean(resolvedRoute)

  async function handleCreate() {
    if (creating || !selectedScope || !resolvedRoute) {
      return
    }

    setCreating(true)

    try {
      const viewId = useAppStore.getState().createView({
        scopeType: selectedScope.scopeType,
        scopeId: selectedScope.scopeId,
        entityKind: selectedEntityKind,
        route: resolvedRoute,
        name: name.trim(),
        description: description.trim(),
        ...dialog.initialConfig,
      })

      if (viewId) {
        onOpenChange(false)
      }
    } finally {
      setCreating(false)
    }
  }

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
        className="top-[42%] max-h-[calc(100vh-2rem)] gap-0 overflow-hidden rounded-xl border border-line bg-surface p-0 shadow-lg sm:top-[40%] sm:max-w-[640px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>New view</DialogTitle>
          <DialogDescription>
            Create a saved view for a workspace or team surface.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 border-b border-line-soft px-3.5 py-2 text-[12.5px] text-fg-3">
          {!dialog.lockScope ? (
            <Select
              value={selectedScopeKey || "__none__"}
              onValueChange={setSelectedScopeKey}
              disabled={scopeOptions.length === 0}
            >
              <SelectTrigger
                size="sm"
                className={cn(crumbTriggerClass, "min-w-0")}
              >
                <SelectValue placeholder="Scope">
                  <span className="font-medium text-foreground">
                    {selectedScope?.label ?? "Scope"}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {scopeOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <span className={crumbTriggerClass}>
              <span className="font-medium text-foreground">
                {selectedScope?.label ?? "Scope"}
              </span>
            </span>
          )}
          {!dialog.lockEntityKind ? (
            <Select
              value={selectedEntityKind}
              onValueChange={(value) =>
                setSelectedEntityKind(value as "items" | "projects" | "docs")
              }
              disabled={entityOptions.length === 0}
            >
              <SelectTrigger size="sm" className={crumbTriggerClass}>
                <SelectValue placeholder="Surface">
                  <span className="font-medium text-foreground">
                    {formatEntityKind(selectedEntityKind)}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {entityOptions.map((entityKind) => (
                    <SelectItem key={entityKind} value={entityKind}>
                      {formatEntityKind(entityKind)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <span className={crumbTriggerClass}>
              <span className="font-medium text-foreground">
                {formatEntityKind(selectedEntityKind)}
              </span>
            </span>
          )}
          <span className="ml-0.5 text-fg-4">→ Saved view</span>
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
            Create the saved view first, then refine filters, grouping, and
            levels from the surface.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-line-soft bg-background px-[18px] py-2.5">
          <button
            type="button"
            disabled
            className={cn(
              chipTriggerClass,
              !resolvedRoute && chipTriggerDashedClass
            )}
          >
            <FolderSimple className="size-[13px]" />
            <span
              className={cn(
                "truncate",
                resolvedRoute && "font-medium text-foreground"
              )}
            >
              {resolvedRoute ?? "Choose a valid route"}
            </span>
          </button>
        </div>

        {!resolvedRoute ? (
          <p className="px-[18px] pt-2 text-xs text-destructive">
            Select a valid scope and surface to create this view.
          </p>
        ) : null}

        <div className="flex items-center gap-2.5 border-t border-line-soft bg-background px-3.5 py-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-fg-3">
            <FolderSimple className="size-[13px] shrink-0" />
            <span className="truncate">
              {selectedScope ? (
                <>
                  Saving in{" "}
                  <b className="font-medium text-foreground">
                    {selectedScope.label}
                  </b>
                </>
              ) : (
                "Select a scope"
              )}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel <KbdHint>Esc</KbdHint>
            </Button>
            <Button
              size="sm"
              disabled={!canCreate || creating}
              onClick={handleCreate}
            >
              Create view <KbdHint className="bg-[oklch(0.32_0_0)] text-background border-[oklch(0.38_0_0)]">⌘⏎</KbdHint>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

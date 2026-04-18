"use client"

import { useEffect, useMemo, useState } from "react"

import {
  canEditTeam,
  canEditWorkspace,
  getTeam,
  teamHasFeature,
} from "@/lib/domain/selectors"
import {
  getDefaultRouteForViewContext,
  isRouteAllowedForViewContext,
} from "@/lib/domain/default-views"
import type { CreateDialogState } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { formatEntityKind } from "@/components/app/screens/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
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

type CreateViewDialogState = Extract<CreateDialogState, { kind: "view" }>

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
  const workspace = useAppStore((state) =>
    state.workspaces.find((entry) => entry.id === state.currentWorkspaceId) ?? null
  )
  const teams = useAppStore((state) => state.teams)
  const scopeOptions = useMemo(() => {
    const editableTeams = teams.filter(
      (team) => canEditTeam(useAppStore.getState(), team.id) && teamHasFeature(team, "views")
    )
    const nextOptions: Array<{
      key: string
      scopeType: "team" | "workspace"
      scopeId: string
      label: string
    }> = []

    if (workspace && canEditWorkspace(useAppStore.getState(), workspace.id)) {
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
    teams,
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
  const selectedTeam =
    selectedScope?.scopeType === "team" ? getTeam(useAppStore.getState(), selectedScope.scopeId) : null
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
      <DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>New view</DialogTitle>
          <DialogDescription>
            Create a saved view for a workspace or team surface.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border/60 bg-muted/[0.35] px-6 pt-6 pb-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            <Badge
              variant="outline"
              className="h-7 rounded-full border-border/60 bg-background px-3 text-[11px] font-medium tracking-normal normal-case"
            >
              {selectedScope?.label ?? "Scope"}
            </Badge>
            <span className="text-muted-foreground/50">/</span>
            <Badge
              variant="outline"
              className="h-7 rounded-full border-border/60 bg-background px-3 text-[11px] font-medium tracking-normal normal-case"
            >
              {formatEntityKind(selectedEntityKind)}
            </Badge>
            <span className="text-muted-foreground/50">/</span>
            <span className="tracking-normal normal-case">New view</span>
          </div>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="View name"
            className="mt-5 h-auto border-none bg-transparent px-0 py-0 text-3xl font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/45 focus-visible:ring-0 md:text-[2rem] dark:bg-transparent"
            autoFocus
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this view is for"
            rows={3}
            className="mt-3 min-h-[96px] resize-none border-none bg-transparent px-0 py-0 text-sm leading-6 text-muted-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 dark:bg-transparent"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Create the saved view first, then refine filters, grouping, and
            levels from the surface.
          </p>
        </div>

        <div className="flex flex-col gap-4 px-6 py-4">
          {!dialog.lockScope ? (
            <Select value={selectedScopeKey || "__none__"} onValueChange={setSelectedScopeKey}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a scope" />
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
          ) : null}

          {!dialog.lockEntityKind ? (
            <Select
              value={selectedEntityKind}
              onValueChange={(value) =>
                setSelectedEntityKind(value as "items" | "projects" | "docs")
              }
              disabled={entityOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a surface" />
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
          ) : null}

          {resolvedRoute ? (
            <p className="text-xs text-muted-foreground">
              This view will open on <span className="font-mono">{resolvedRoute}</span>.
            </p>
          ) : (
            <p className="text-xs text-destructive">
              Select a valid scope and surface to create this view.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canCreate || creating} onClick={handleCreate}>
            Create view
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

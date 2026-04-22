"use client"

import Link from "next/link"
import { useDeferredValue, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import {
  FileText,
  Folders,
  MagnifyingGlass,
  Target,
  UsersThree,
  X,
} from "@phosphor-icons/react"

import {
  getWorkspaceSearchIndex,
  queryWorkspaceSearchIndex,
  type GlobalSearchResult,
} from "@/lib/domain/selectors"
import { fetchSearchSeedReadModel } from "@/lib/convex/client"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import { getSearchSeedScopeKeys } from "@/lib/scoped-sync/read-models"
import { statusMeta, type WorkStatus, workStatuses } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
import { selectAppDataSnapshot } from "@/components/app/screens/helpers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SidebarTrigger } from "@/components/ui/sidebar"

type SearchKindFilter = GlobalSearchResult["kind"] | "all"

const kindTabs: Array<{
  label: string
  value: SearchKindFilter
}> = [
  { label: "All", value: "all" },
  { label: "Work", value: "item" },
  { label: "Projects", value: "project" },
  { label: "Docs", value: "document" },
  { label: "Teams", value: "team" },
  { label: "Navigation", value: "navigation" },
]

function searchResultIcon(kind: GlobalSearchResult["kind"]) {
  if (kind === "navigation") {
    return <MagnifyingGlass className="size-4" />
  }

  if (kind === "team") {
    return <UsersThree className="size-4" />
  }

  if (kind === "project") {
    return <Folders className="size-4" />
  }

  if (kind === "document") {
    return <FileText className="size-4" />
  }

  return <Target className="size-4" />
}

function searchResultLabel(kind: GlobalSearchResult["kind"]) {
  if (kind === "navigation") {
    return "Navigation"
  }

  if (kind === "team") {
    return "Team"
  }

  if (kind === "project") {
    return "Project"
  }

  if (kind === "document") {
    return "Document"
  }

  return "Work item"
}

export function WorkspaceSearchScreen({
  initialQuery = "",
}: {
  initialQuery?: string
}) {
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId)
  useScopedReadModelRefresh({
    enabled: Boolean(currentWorkspaceId),
    scopeKeys: currentWorkspaceId
      ? getSearchSeedScopeKeys(currentWorkspaceId)
      : [],
    fetchLatest: () => fetchSearchSeedReadModel(currentWorkspaceId),
  })
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const [query, setQuery] = useState(initialQuery)
  const [kind, setKind] = useState<SearchKindFilter>("all")
  const [teamId, setTeamId] = useState("all")
  const [status, setStatus] = useState<WorkStatus | "all">("all")
  const searchQuery = useDeferredValue(query)
  const searchIndex = useMemo(() => getWorkspaceSearchIndex(data), [data])
  const teams = searchIndex.teams

  const trimmedQuery = searchQuery.trim()
  const teamsById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams]
  )
  const filteredResults = useMemo(
    () =>
      queryWorkspaceSearchIndex(searchIndex, searchQuery, {
        kind,
        status,
        teamId,
      }),
    [kind, searchIndex, searchQuery, status, teamId]
  )

  const hasActiveFilters =
    kind !== "all" || teamId !== "all" || status !== "all"

  function clearFilters() {
    setKind("all")
    setTeamId("all")
    setStatus("all")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-10 shrink-0 items-center gap-2 border-b bg-background px-4 py-2">
        <SidebarTrigger className="size-5 shrink-0" />
        <h1 className="truncate text-sm font-medium">Search</h1>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-3 border-b border-border/60 pb-4">
            <div className="relative">
              <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pr-9 pl-9 placeholder:text-muted-foreground/60"
                placeholder="Search everything…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query.length > 0 ? (
                <button
                  aria-label="Clear search query"
                  className="absolute top-1/2 right-3 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setQuery("")}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter by team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All teams</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as WorkStatus | "all")
                }
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All statuses</SelectItem>
                    {workStatuses.map((entry) => (
                      <SelectItem key={entry} value={entry}>
                        {statusMeta[entry].label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              {hasActiveFilters ? (
                <Button onClick={clearFilters} size="sm" variant="outline">
                  Clear
                </Button>
              ) : null}
            </div>

            <div className="flex items-center gap-1">
              {kindTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={cn(
                    "h-6 rounded-sm px-2 text-xs transition-colors",
                    kind === tab.value
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setKind(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {filteredResults.length} result
            {filteredResults.length === 1 ? "" : "s"}
            {trimmedQuery.length > 0 ? ` for "${trimmedQuery}"` : ""}
          </div>

          {filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MagnifyingGlass className="size-8 text-muted-foreground/30" />
              <div className="mt-3 text-sm font-medium">No results found.</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Try a different search term or adjust your filters.
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredResults.map((result) => {
                const team = result.teamId
                  ? (teamsById.get(result.teamId) ?? null)
                  : null
                const subtitle = result.subtitle?.trim()
                const metadata = [
                  searchResultLabel(result.kind),
                  team?.name ?? null,
                  result.status ? statusMeta[result.status].label : null,
                ]
                  .filter(Boolean)
                  .join(" · ")

                return (
                  <Link
                    key={result.id}
                    className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/50"
                    href={result.href}
                  >
                    <div className="shrink-0 text-muted-foreground">
                      {searchResultIcon(result.kind)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {result.title}
                      </div>
                      {subtitle ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {subtitle}
                        </div>
                      ) : null}
                    </div>
                    {metadata ? (
                      <div className="max-w-[30%] shrink-0 truncate text-right text-xs text-muted-foreground">
                        {metadata}
                      </div>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

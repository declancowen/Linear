"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useShallow } from "zustand/react/shallow"
import {
  FileText,
  Kanban,
  MagnifyingGlass,
  Target,
  UsersThree,
} from "@phosphor-icons/react"

import {
  getWorkspaceSearchIndex,
  getTeam,
  type GlobalSearchResult,
  queryWorkspaceSearchIndex,
} from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { TeamIconGlyph } from "@/components/app/entity-icons"
import { selectAppDataSnapshot } from "@/components/app/screens/helpers"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"

function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      {keys.map((key) => (
        <kbd
          key={key}
          className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border/60 bg-muted/70 px-2 font-medium text-foreground/80 shadow-sm"
        >
          {key}
        </kbd>
      ))}
    </span>
  )
}

function ShortcutHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <ShortcutKeys keys={keys} />
      <span>{label}</span>
    </div>
  )
}

function resultIcon(
  result: GlobalSearchResult,
  teamIcon: string | null | undefined
) {
  if (result.kind === "navigation") {
    return <MagnifyingGlass />
  }

  if (result.kind === "team") {
    return teamIcon ? <TeamIconGlyph icon={teamIcon} /> : <UsersThree />
  }

  if (result.kind === "project") {
    return <Kanban />
  }

  if (result.kind === "document") {
    return <FileText />
  }

  return <Target />
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
  onQueryChange,
  onOpenFullSearch,
  fullSearchShortcutKeys,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onQueryChange: (query: string) => void
  onOpenFullSearch: (query: string) => void
  fullSearchShortcutKeys: string[]
}) {
  const router = useRouter()
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const [query, setQuery] = useState("")
  const searchQuery = useDeferredValue(query)
  const searchIndex = useMemo(() => getWorkspaceSearchIndex(data), [data])
  const teamsById = useMemo(
    () => new Map(searchIndex.teams.map((team) => [team.id, team])),
    [searchIndex]
  )
  const trimmedSearchQuery = searchQuery.trim()
  const hasQuery = trimmedSearchQuery.length > 0
  const results = useMemo(
    () =>
      queryWorkspaceSearchIndex(searchIndex, searchQuery, {
        kind: hasQuery ? "all" : "navigation",
        limit: 20,
      }),
    [hasQuery, searchIndex, searchQuery]
  )
  const groupedResults = useMemo(
    () => ({
      navigation: results.filter((result) => result.kind === "navigation"),
      teams: results.filter((result) => result.kind === "team"),
      projects: results.filter((result) => result.kind === "project"),
      work: results.filter((result) => result.kind === "item"),
      docs: results.filter((result) => result.kind === "document"),
    }),
    [results]
  )
  const resultGroups = [
    {
      key: "navigation",
      heading: "Navigation",
      items: groupedResults.navigation,
    },
    { key: "teams", heading: "Teams", items: groupedResults.teams },
    { key: "projects", heading: "Projects", items: groupedResults.projects },
    { key: "work", heading: "Work Items", items: groupedResults.work },
    { key: "docs", heading: "Documents", items: groupedResults.docs },
  ] as const

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery)
    onQueryChange(nextQuery)
  }

  function handleSelect(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Global Search"
      description="Search work items, projects, docs, teams, and navigation."
      className="!top-[12vh] !w-[min(52rem,calc(100%-2rem))] !max-w-none overflow-hidden p-0 sm:!top-[14vh]"
    >
      <Command shouldFilter={false} className="!h-[min(32rem,72vh)] p-0">
        <CommandInput
          placeholder="Search…"
          value={query}
          onValueChange={handleQueryChange}
        />
        <CommandList className="max-h-none min-h-0 flex-1">
          <CommandEmpty className="text-muted-foreground">
            No results found.
          </CommandEmpty>
          {!hasQuery ? (
            <CommandGroup heading="Jump to">
              {groupedResults.navigation.map((result) => {
                const team = result.teamId
                  ? (teamsById.get(result.teamId) ??
                    getTeam(data, result.teamId))
                  : null
                const subtitle = result.subtitle?.trim()

                return (
                  <CommandItem
                    key={result.id}
                    value={result.id}
                    onSelect={() => handleSelect(result.href)}
                  >
                    {resultIcon(result, team?.icon)}
                    <div className="flex flex-col gap-0.5">
                      <span>{result.title}</span>
                      {subtitle ? (
                        <span className="text-xs text-muted-foreground">
                          {subtitle}
                        </span>
                      ) : null}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ) : (
            resultGroups.map((group) =>
              group.items.length > 0 ? (
                <CommandGroup key={group.key} heading={group.heading}>
                  {group.items.map((result) => {
                    const team = result.teamId
                      ? (teamsById.get(result.teamId) ??
                        getTeam(data, result.teamId))
                      : null
                    const subtitle = result.subtitle?.trim()

                    return (
                      <CommandItem
                        key={result.id}
                        value={result.id}
                        onSelect={() => handleSelect(result.href)}
                      >
                        {resultIcon(result, team?.icon)}
                        <div className="flex flex-col gap-0.5">
                          <span>{result.title}</span>
                          {subtitle ? (
                            <span className="text-xs text-muted-foreground">
                              {subtitle}
                            </span>
                          ) : null}
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ) : null
            )
          )}
        </CommandList>
        <div className="flex flex-col gap-2 border-t px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ShortcutHint keys={["↑", "↓"]} label="Navigate" />
            <ShortcutHint keys={["Enter"]} label="Open" />
            <ShortcutHint keys={["Esc"]} label="Close" />
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenFullSearch(query)}
            className="justify-between gap-3 border-0 bg-transparent px-0 hover:bg-transparent sm:min-w-40"
          >
            <span className="inline-flex items-center rounded-md border border-border/60 px-2.5 py-1.5 text-foreground transition-colors hover:bg-accent/70">
              Open full search
            </span>
            <ShortcutKeys keys={fullSearchShortcutKeys} />
          </Button>
        </div>
      </Command>
    </CommandDialog>
  )
}

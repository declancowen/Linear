"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  FileText,
  Kanban,
  MagnifyingGlass,
  Target,
  UsersThree,
} from "@phosphor-icons/react"

import {
  getTeam,
  type GlobalSearchResult,
  searchWorkspace,
} from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { TeamIconGlyph } from "@/components/app/entity-icons"
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const data = useAppStore()
  const [query, setQuery] = useState("")
  const trimmedQuery = query.trim()
  const hasQuery = trimmedQuery.length > 0

  const results = searchWorkspace(data, query).slice(0, 20)
  const groupedResults = {
    navigation: results.filter((result) => result.kind === "navigation"),
    teams: results.filter((result) => result.kind === "team"),
    projects: results.filter((result) => result.kind === "project"),
    work: results.filter((result) => result.kind === "item"),
    docs: results.filter((result) => result.kind === "document"),
  }
  const resultGroups = [
    { key: "navigation", heading: "Navigation", items: groupedResults.navigation },
    { key: "teams", heading: "Teams", items: groupedResults.teams },
    { key: "projects", heading: "Projects", items: groupedResults.projects },
    { key: "work", heading: "Work Items", items: groupedResults.work },
    { key: "docs", heading: "Documents", items: groupedResults.docs },
  ] as const

  function handleSelect(href: string) {
    onOpenChange(false)
    setQuery("")
    router.push(href)
  }

  function handleOpenFullSearch() {
    const href = hasQuery
      ? `/workspace/search?q=${encodeURIComponent(trimmedQuery)}`
      : "/workspace/search"

    handleSelect(href)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Global Search"
      description="Search work items, projects, docs, teams, and navigation."
      className="!top-[12vh] sm:!top-[14vh] !w-[min(52rem,calc(100%-2rem))] !max-w-none overflow-hidden p-0"
    >
      <Command shouldFilter={false} className="!h-[min(32rem,72vh)] p-0">
        <CommandInput
          placeholder="Search…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="min-h-0 flex-1 max-h-none">
          <CommandEmpty className="text-muted-foreground">
            No results found.
          </CommandEmpty>
          {!hasQuery ? (
            <CommandGroup heading="Jump to">
              {groupedResults.navigation.map((result) => {
                const team = result.teamId ? getTeam(data, result.teamId) : null
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
                    const team = result.teamId ? getTeam(data, result.teamId) : null
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
        <div className="flex flex-col gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="leading-4">↑↓ to navigate, ↵ to open, esc to close</div>
          <Button size="sm" variant="outline" onClick={handleOpenFullSearch}>
            Open full search
          </Button>
        </div>
      </Command>
    </CommandDialog>
  )
}

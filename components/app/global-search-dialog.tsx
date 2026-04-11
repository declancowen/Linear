"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  ClockCounterClockwise,
  FileText,
  Kanban,
  MagnifyingGlass,
  Target,
  UsersThree,
} from "@phosphor-icons/react"

import {
  type GlobalSearchResult,
  searchWorkspace,
} from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"

function resultIcon(kind: GlobalSearchResult["kind"]) {
  if (kind === "navigation") {
    return <Bell />
  }

  if (kind === "team") {
    return <UsersThree />
  }

  if (kind === "project") {
    return <Kanban />
  }

  if (kind === "document") {
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

  const results = searchWorkspace(data, query).slice(0, 20)
  const groupedResults = {
    navigation: results.filter((result) => result.kind === "navigation"),
    teams: results.filter((result) => result.kind === "team"),
    projects: results.filter((result) => result.kind === "project"),
    work: results.filter((result) => result.kind === "item"),
    docs: results.filter((result) => result.kind === "document"),
  }

  function handleSelect(href: string) {
    onOpenChange(false)
    setQuery("")
    router.push(href)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Global Search"
      description="Search work items, projects, docs, teams, and navigation."
      className="max-w-3xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search everything… try kind:item status:in-progress team:development"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col gap-2 px-4 py-4 text-left">
              <div className="text-sm font-medium">No matches</div>
              <div className="text-xs text-muted-foreground">
                Try operators like <code>kind:item</code>, <code>status:done</code>,
                or <code>team:recipe-room</code>.
              </div>
            </div>
          </CommandEmpty>
          {query.length === 0 ? (
            <>
              <CommandGroup heading="Jump to">
                {groupedResults.navigation.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={result.id}
                    onSelect={() => handleSelect(result.href)}
                  >
                    {resultIcon(result.kind)}
                    <div className="flex flex-col gap-0.5">
                      <span>{result.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Search operators">
                {[
                  {
                    value: "kind:item",
                    label: "Only work items",
                  },
                  {
                    value: "kind:project",
                    label: "Only projects",
                  },
                  {
                    value: "status:in-progress",
                    label: "Filter work by status",
                  },
                  {
                    value: "team:development",
                    label: "Restrict by team",
                  },
                ].map((entry) => (
                  <CommandItem
                    key={entry.value}
                    value={entry.value}
                    onSelect={() => setQuery(entry.value)}
                  >
                    <MagnifyingGlass />
                    <div className="flex flex-col gap-0.5">
                      <span>{entry.value}</span>
                      <span className="text-xs text-muted-foreground">
                        {entry.label}
                      </span>
                    </div>
                    <CommandShortcut>Fill</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : (
            <>
              {groupedResults.navigation.length > 0 ? (
                <CommandGroup heading="Navigation">
                  {groupedResults.navigation.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={result.id}
                      onSelect={() => handleSelect(result.href)}
                    >
                      {resultIcon(result.kind)}
                      <div className="flex flex-col gap-0.5">
                        <span>{result.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {groupedResults.teams.length > 0 ? (
                <CommandGroup heading="Teams">
                  {groupedResults.teams.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={result.id}
                      onSelect={() => handleSelect(result.href)}
                    >
                      {resultIcon(result.kind)}
                      <div className="flex flex-col gap-0.5">
                        <span>{result.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {groupedResults.projects.length > 0 ? (
                <CommandGroup heading="Projects">
                  {groupedResults.projects.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={result.id}
                      onSelect={() => handleSelect(result.href)}
                    >
                      {resultIcon(result.kind)}
                      <div className="flex flex-col gap-0.5">
                        <span>{result.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {groupedResults.work.length > 0 ? (
                <CommandGroup heading="Work Items">
                  {groupedResults.work.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={result.id}
                      onSelect={() => handleSelect(result.href)}
                    >
                      {resultIcon(result.kind)}
                      <div className="flex flex-col gap-0.5">
                        <span>{result.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {groupedResults.docs.length > 0 ? (
                <CommandGroup heading="Documents">
                  {groupedResults.docs.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={result.id}
                      onSelect={() => handleSelect(result.href)}
                    >
                      {resultIcon(result.kind)}
                      <div className="flex flex-col gap-0.5">
                        <span>{result.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </>
          )}
        </CommandList>
      </Command>
      <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ClockCounterClockwise />
          Search operators work locally against the current workspace graph.
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSelect(`/workspace/search?q=${encodeURIComponent(query)}`)}
          >
            Open full search
          </Button>
          <div>Press Esc to close</div>
        </div>
      </div>
    </CommandDialog>
  )
}

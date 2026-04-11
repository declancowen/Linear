"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  Compass,
  FileText,
  Folders,
  MagnifyingGlass,
  Target,
  UsersThree,
} from "@phosphor-icons/react"

import {
  getAccessibleTeams,
  getTeam,
  searchWorkspace,
  type GlobalSearchResult,
} from "@/lib/domain/selectors"
import {
  priorityMeta,
  statusMeta,
  type WorkStatus,
  workStatuses,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type SearchKindFilter = GlobalSearchResult["kind"] | "all"

function searchResultIcon(kind: GlobalSearchResult["kind"]) {
  if (kind === "navigation") {
    return <Compass />
  }

  if (kind === "team") {
    return <UsersThree />
  }

  if (kind === "project") {
    return <Folders />
  }

  if (kind === "document") {
    return <FileText />
  }

  return <Target />
}

export function WorkspaceSearchScreen({
  initialQuery = "",
}: {
  initialQuery?: string
}) {
  const data = useAppStore()
  const teams = getAccessibleTeams(data)
  const [query, setQuery] = useState(initialQuery)
  const [kind, setKind] = useState<SearchKindFilter>("all")
  const [teamId, setTeamId] = useState("all")
  const [status, setStatus] = useState<WorkStatus | "all">("all")

  const queriedResults = useMemo(
    () => searchWorkspace(data, query),
    [data, query]
  )

  const counts = useMemo(
    () => ({
      total: queriedResults.length,
      items: queriedResults.filter((result) => result.kind === "item").length,
      projects: queriedResults.filter((result) => result.kind === "project").length,
      docs: queriedResults.filter((result) => result.kind === "document").length,
      teams: queriedResults.filter((result) => result.kind === "team").length,
    }),
    [queriedResults]
  )

  const filteredResults = useMemo(
    () =>
      queriedResults.filter((result) => {
        if (kind !== "all" && result.kind !== kind) {
          return false
        }

        if (teamId !== "all" && result.teamId !== teamId) {
          return false
        }

        if (status !== "all" && result.kind === "item" && result.status !== status) {
          return false
        }

        if (status !== "all" && result.kind !== "item") {
          return false
        }

        return true
      }),
    [kind, queriedResults, status, teamId]
  )

  return (
    <div className="flex flex-col gap-4">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Workspace Search</CardTitle>
          <CardDescription>
            Expanded search across navigation, teams, projects, docs, and work items.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Search everything… try kind:item status:in-progress team:development"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {["kind:item", "kind:project", "status:in-progress", "team:development"].map(
                  (operator) => (
                    <Button
                      key={operator}
                      size="sm"
                      variant="outline"
                      onClick={() => setQuery(operator)}
                    >
                      <MagnifyingGlass />
                      {operator}
                    </Button>
                  )
                )}
              </div>
            </div>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger>
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
            <Select value={status} onValueChange={(value) => setStatus(value as WorkStatus | "all")}>
              <SelectTrigger>
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
          </div>
          <Tabs
            value={kind}
            onValueChange={(value) => setKind(value as SearchKindFilter)}
          >
            <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
              {[
                ["all", `All ${counts.total}`],
                ["item", `Work ${counts.items}`],
                ["project", `Projects ${counts.projects}`],
                ["document", `Docs ${counts.docs}`],
                ["team", `Teams ${counts.teams}`],
                ["navigation", "Navigation"],
              ].map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="rounded-full">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              {filteredResults.length} result{filteredResults.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {filteredResults.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
                No results match the current search and filters.
              </div>
            ) : (
              filteredResults.map((result) => {
                const team = result.teamId ? getTeam(data, result.teamId) : null

                return (
                  <Link
                    key={result.id}
                    className="rounded-xl border px-4 py-4 transition-colors hover:bg-muted"
                    href={result.href}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-muted">
                          {searchResultIcon(result.kind)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {result.title}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {result.subtitle}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="secondary">{result.kind}</Badge>
                            {team ? <Badge variant="outline">{team.name}</Badge> : null}
                            {result.status ? (
                              <Badge variant="outline">
                                {statusMeta[result.status].label}
                              </Badge>
                            ) : null}
                            {result.priority ? (
                              <Badge variant="outline">
                                {priorityMeta[result.priority].label}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Search tips</CardTitle>
            <CardDescription>
              Combine structured tokens with free text to narrow large workspaces quickly.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <div className="rounded-xl border px-3 py-3">
              <div className="font-medium text-foreground">Kinds</div>
              <div>
                Use <code>kind:item</code>, <code>kind:project</code>, or{" "}
                <code>kind:document</code>.
              </div>
            </div>
            <div className="rounded-xl border px-3 py-3">
              <div className="font-medium text-foreground">Team scoping</div>
              <div>
                Use <code>team:recipe-room</code> or <code>team:development</code>.
              </div>
            </div>
            <div className="rounded-xl border px-3 py-3">
              <div className="font-medium text-foreground">Work filters</div>
              <div>
                Use <code>status:in-progress</code> to jump straight to active work.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

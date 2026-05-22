"use client"

import { lazy, Suspense, useMemo } from "react"

import {
  AssignedScreen,
  DocsScreen,
  DocumentDetailScreen,
  InboxScreen,
  ProjectDetailScreen,
  ProjectsScreen,
  TeamWorkScreen,
  UserCalendarScreen,
  ViewsScreen,
  WorkItemDetailScreen,
  WorkspaceItemsScreen,
} from "@/components/app/screens"
import { useAppPathname, useAppSearchParams } from "@/lib/browser/app-navigation"
import {
  getCurrentWorkspace,
  getProjectHref,
  getTeamBySlug,
  teamHasFeature,
} from "@/lib/domain/selectors"
import type { Team } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

const WorkspaceChannelsScreen = lazy(() =>
  import("@/components/app/collaboration-screens").then((module) => ({
    default: module.WorkspaceChannelsScreen,
  }))
)
const TeamChannelsScreen = lazy(() =>
  import("@/components/app/collaboration-screens").then((module) => ({
    default: module.TeamChannelsScreen,
  }))
)
const TeamChatScreen = lazy(() =>
  import("@/components/app/collaboration-screens").then((module) => ({
    default: module.TeamChatScreen,
  }))
)
const WorkspaceChatsScreen = lazy(() =>
  import("@/components/app/collaboration-screens").then((module) => ({
    default: module.WorkspaceChatsScreen,
  }))
)
const WorkspaceSearchScreen = lazy(() =>
  import("@/components/app/workspace-search-screen").then((module) => ({
    default: module.WorkspaceSearchScreen,
  }))
)
const CreateTeamScreen = lazy(() =>
  import("@/components/app/settings-screens/create-team-screen").then(
    (module) => ({
      default: module.CreateTeamScreen,
    })
  )
)
const TeamSettingsScreen = lazy(() =>
  import("@/components/app/settings-screens/team-settings-screen").then(
    (module) => ({
      default: module.TeamSettingsScreen,
    })
  )
)
const UserSettingsScreen = lazy(() =>
  import("@/components/app/settings-screens/user-settings-screen").then(
    (module) => ({
      default: module.UserSettingsScreen,
    })
  )
)
const WorkspaceSettingsScreen = lazy(() =>
  import("@/components/app/settings-screens/workspace-settings-screen").then(
    (module) => ({
      default: module.WorkspaceSettingsScreen,
    })
  )
)

type RouteMatch =
  | {
      kind: "static"
      path: string
    }
  | {
      kind: "team"
      rest: string
      teamSlug: string
    }
  | {
      id: string
      kind: "detail"
      type: "document" | "item" | "project"
    }

function splitPath(pathname: string) {
  return pathname.split("/").filter(Boolean)
}

function matchRoute(pathname: string): RouteMatch {
  const parts = splitPath(pathname)

  if (parts[0] === "team" && parts[1]) {
    return {
      kind: "team",
      teamSlug: parts[1],
      rest: parts.slice(2).join("/") || "work",
    }
  }

  if ((parts[0] === "docs" || parts[0] === "items") && parts[1]) {
    return {
      kind: "detail",
      type: parts[0] === "docs" ? "document" : "item",
      id: parts[1],
    }
  }

  if (
    (parts[0] === "projects" ||
      (parts[0] === "workspace" && parts[1] === "projects")) &&
    parts.at(-1) &&
    parts.length > 1
  ) {
    return {
      kind: "detail",
      type: "project",
      id: parts.at(-1) ?? "",
    }
  }

  return {
    kind: "static",
    path: pathname,
  }
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function MissingScreen({ label }: { label: string }) {
  return (
    <div className="p-6 text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function WorkspaceProjectsRoute() {
  const workspace = useAppStore(getCurrentWorkspace)

  if (!workspace) {
    return <LoadingScreen label="Loading workspace projects..." />
  }

  return (
    <ProjectsScreen
      scopeId={workspace.id}
      scopeType="workspace"
      title="Workspace projects"
      description="Projects across the teams you belong to, aggregated into a single workspace view."
    />
  )
}

function WorkspaceViewsRoute() {
  const workspace = useAppStore(getCurrentWorkspace)

  if (!workspace) {
    return <LoadingScreen label="Loading workspace views..." />
  }

  return (
    <ViewsScreen
      scopeId={workspace.id}
      scopeType="workspace"
      title="Workspace views"
      description="Saved workspace and team views across the teams you belong to."
    />
  )
}

function WorkspaceDocsRoute() {
  const workspace = useAppStore(getCurrentWorkspace)

  if (!workspace) {
    return <LoadingScreen label="Loading docs..." />
  }

  return (
    <DocsScreen
      scopeId={workspace.id}
      scopeType="workspace"
      title="Docs"
      description="Aggregate team-owned documents visible from the workspace."
    />
  )
}

function TeamProjectsRoute({ team }: { team: Team }) {
  return (
    <ProjectsScreen
      scopeId={team.id}
      scopeType="team"
      team={team}
      title={`${team.name} projects`}
      description="Projects owned by the current team, with linked work and child work rolled up together."
    />
  )
}

function TeamViewsRoute({ team }: { team: Team }) {
  if (!teamHasFeature(team, "views")) {
    return <MissingScreen label="Views are disabled for this team." />
  }

  return (
    <ViewsScreen
      scopeId={team.id}
      scopeType="team"
      title={`${team.name} views`}
      description="Saved work views with list, board, and timeline layouts."
    />
  )
}

function TeamDocsRoute({ team }: { team: Team }) {
  return (
    <DocsScreen
      scopeId={team.id}
      scopeType="team"
      team={team}
      title="Docs"
      description="Free-standing team documents with workspace aggregation."
    />
  )
}

function TeamRoute({ rest, teamSlug }: { rest: string; teamSlug: string }) {
  const team = useAppStore((state) => getTeamBySlug(state, teamSlug))

  if (!team) {
    return <LoadingScreen label="Loading team..." />
  }

  if (rest === "settings") {
    return <TeamSettingsScreen teamSlug={teamSlug} />
  }

  if (rest === "projects") {
    return <TeamProjectsRoute team={team} />
  }

  if (rest === "views") {
    return <TeamViewsRoute team={team} />
  }

  if (rest === "docs") {
    return <TeamDocsRoute team={team} />
  }

  if (rest === "chat") {
    return <TeamChatScreen teamSlug={teamSlug} />
  }

  if (rest === "channel" || rest === "channels") {
    return <TeamChannelsScreen teamSlug={teamSlug} />
  }

  return <TeamWorkScreen teamSlug={teamSlug} />
}

function ProjectDetailRoute({ projectId }: { projectId: string }) {
  const canonicalHref = useAppStore((state) => getProjectHref(state, projectId))

  if (canonicalHref && canonicalHref !== `/projects/${projectId}`) {
    return <ProjectDetailScreen projectId={projectId} />
  }

  return <ProjectDetailScreen projectId={projectId} />
}

function StaticRoute({ path }: { path: string }) {
  const searchParams = useAppSearchParams()
  const initialSearchQuery = useMemo(
    () => searchParams.get("q") ?? "",
    [searchParams]
  )

  if (path === "/" || path === "/workspace/projects") {
    return <WorkspaceProjectsRoute />
  }

  if (path === "/workspace/items") {
    return <WorkspaceItemsScreen />
  }

  if (path === "/workspace/views") {
    return <WorkspaceViewsRoute />
  }

  if (path === "/workspace/docs") {
    return <WorkspaceDocsRoute />
  }

  if (path === "/workspace/channel" || path === "/workspace/channels") {
    return <WorkspaceChannelsScreen />
  }

  if (path === "/chats") {
    return <WorkspaceChatsScreen />
  }

  if (path === "/assigned") {
    return <AssignedScreen />
  }

  if (path === "/calendar") {
    return <UserCalendarScreen />
  }

  if (path === "/inbox") {
    return <InboxScreen />
  }

  if (path === "/workspace/search") {
    return <WorkspaceSearchScreen initialQuery={initialSearchQuery} />
  }

  if (path === "/workspace/settings") {
    return <WorkspaceSettingsScreen />
  }

  if (path === "/workspace/create-team") {
    return <CreateTeamScreen />
  }

  if (path === "/settings/profile") {
    return <UserSettingsScreen />
  }

  return <WorkspaceProjectsRoute />
}

export function DesktopRoute() {
  const pathname = useAppPathname()
  const route = matchRoute(pathname)

  return (
    <Suspense fallback={<LoadingScreen label="Loading view..." />}>
      {route.kind === "team" ? (
        <TeamRoute rest={route.rest} teamSlug={route.teamSlug} />
      ) : route.kind === "detail" ? (
        route.type === "document" ? (
          <DocumentDetailScreen documentId={route.id} />
        ) : route.type === "item" ? (
          <WorkItemDetailScreen itemId={route.id} />
        ) : (
          <ProjectDetailRoute projectId={route.id} />
        )
      ) : (
        <StaticRoute path={route.path} />
      )}
    </Suspense>
  )
}

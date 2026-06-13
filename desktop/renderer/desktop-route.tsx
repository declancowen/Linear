"use client"

import { lazy, Suspense, useMemo, type ReactNode } from "react"

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
import { TeamDashboardScreen } from "@/components/app/screens/team-dashboard-screen"
import {
  useAppPathname,
  useAppSearchParams,
} from "@/lib/browser/app-navigation"
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
const PeopleScreen = lazy(() =>
  import("@/components/app/people-screen").then((module) => ({
    default: module.PeopleScreen,
  }))
)
const PeopleProfileScreen = lazy(() =>
  import("@/components/app/people-screen").then((module) => ({
    default: module.PeopleProfileScreen,
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
      type: "document" | "item" | "person" | "project"
    }

type StaticRouteContext = {
  initialSearchQuery: string
}

type StaticRouteDefinition = {
  paths: readonly string[]
  render: (context: StaticRouteContext) => ReactNode
}

function splitPath(pathname: string) {
  return pathname.split("/").filter(Boolean)
}

function matchTeamProjectDetailRoute(parts: string[]): RouteMatch | null {
  return parts[0] === "team" && parts[1] && parts[2] === "projects" && parts[3]
    ? {
        kind: "detail",
        type: "project",
        id: parts[3],
      }
    : null
}

function matchTeamRoute(parts: string[]): RouteMatch | null {
  return parts[0] === "team" && parts[1]
    ? {
        kind: "team",
        teamSlug: parts[1],
        rest: parts.slice(2).join("/") || "work",
      }
    : null
}

function matchDocumentOrItemRoute(parts: string[]): RouteMatch | null {
  if (!parts[1] || (parts[0] !== "docs" && parts[0] !== "items")) {
    return null
  }

  return {
    kind: "detail",
    type: parts[0] === "docs" ? "document" : "item",
    id: parts[1],
  }
}

function matchPersonRoute(parts: string[]): RouteMatch | null {
  return parts[0] === "workspace" && parts[1] === "people" && parts[2]
    ? {
        kind: "detail",
        type: "person",
        id: parts[2],
      }
    : null
}

function matchProjectRoute(parts: string[]): RouteMatch | null {
  const projectId = parts.at(-1)

  if (!projectId || parts.length <= 1) {
    return null
  }

  if (parts[0] === "projects") {
    return {
      kind: "detail",
      type: "project",
      id: projectId,
    }
  }

  return parts[0] === "workspace" && parts[1] === "projects" && parts.length > 2
    ? {
        kind: "detail",
        type: "project",
        id: projectId,
      }
    : null
}

function matchRoute(pathname: string): RouteMatch {
  const parts = splitPath(pathname)
  const route =
    matchTeamProjectDetailRoute(parts) ??
    matchTeamRoute(parts) ??
    matchDocumentOrItemRoute(parts) ??
    matchPersonRoute(parts) ??
    matchProjectRoute(parts)

  if (route) {
    return route
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
  return <div className="p-6 text-sm text-muted-foreground">{label}</div>
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

  if (rest === "dashboard") {
    return <TeamDashboardScreen teamSlug={teamSlug} />
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

const STATIC_ROUTE_DEFINITIONS: readonly StaticRouteDefinition[] = [
  {
    paths: ["/", "/workspace/projects"],
    render: () => <WorkspaceProjectsRoute />,
  },
  {
    paths: ["/workspace/items"],
    render: () => <WorkspaceItemsScreen />,
  },
  {
    paths: ["/workspace/views"],
    render: () => <WorkspaceViewsRoute />,
  },
  {
    paths: ["/workspace/docs"],
    render: () => <WorkspaceDocsRoute />,
  },
  {
    paths: ["/workspace/people"],
    render: () => <PeopleScreen />,
  },
  {
    paths: ["/workspace/channel", "/workspace/channels"],
    render: () => <WorkspaceChannelsScreen />,
  },
  {
    paths: ["/chats"],
    render: () => <WorkspaceChatsScreen />,
  },
  {
    paths: ["/assigned"],
    render: () => <AssignedScreen />,
  },
  {
    paths: ["/calendar"],
    render: () => <UserCalendarScreen />,
  },
  {
    paths: ["/inbox"],
    render: () => <InboxScreen />,
  },
  {
    paths: ["/workspace/search"],
    render: ({ initialSearchQuery }) => (
      <WorkspaceSearchScreen initialQuery={initialSearchQuery} />
    ),
  },
  {
    paths: ["/workspace/settings"],
    render: () => <WorkspaceSettingsScreen />,
  },
  {
    paths: ["/workspace/create-team"],
    render: () => <CreateTeamScreen />,
  },
  {
    paths: ["/settings/profile"],
    render: () => <UserSettingsScreen />,
  },
]

function getStaticRouteDefinition(path: string) {
  return STATIC_ROUTE_DEFINITIONS.find((route) => route.paths.includes(path))
}

function StaticRoute({ path }: { path: string }) {
  const searchParams = useAppSearchParams()
  const initialSearchQuery = useMemo(
    () => searchParams.get("q") ?? "",
    [searchParams]
  )
  const route = getStaticRouteDefinition(path)

  return route?.render({ initialSearchQuery }) ?? <WorkspaceProjectsRoute />
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
        ) : route.type === "person" ? (
          <PeopleProfileScreen userId={route.id} />
        ) : (
          <ProjectDetailRoute projectId={route.id} />
        )
      ) : (
        <StaticRoute path={route.path} />
      )}
    </Suspense>
  )
}

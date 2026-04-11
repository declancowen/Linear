import { WorkspaceSearchScreen } from "@/components/app/workspace-search-screen"

export default async function WorkspaceSearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
  }>
}) {
  const params = await searchParams

  return <WorkspaceSearchScreen initialQuery={params.q ?? ""} />
}

import type { ComponentProps } from "react"

import { CreateDocumentDialog } from "@/components/app/screens/create-document-dialog"
import type { Team } from "@/lib/domain/types"

export type DocsTab = "workspace" | "private"

type CreateDocumentDialogInput = ComponentProps<
  typeof CreateDocumentDialog
>["input"]

export function getDocsDialogInput({
  activeTab,
  activeTeamId,
  isWorkspaceDocs,
  scopeId,
  team,
}: {
  activeTab: DocsTab
  activeTeamId: string
  isWorkspaceDocs: boolean
  scopeId: string
  team?: Team | null
}): CreateDocumentDialogInput {
  if (isWorkspaceDocs) {
    return activeTab === "workspace"
      ? { kind: "workspace-document", workspaceId: scopeId }
      : { kind: "private-document", workspaceId: scopeId }
  }

  return {
    kind: "team-document",
    teamId: team?.id ?? activeTeamId,
  }
}

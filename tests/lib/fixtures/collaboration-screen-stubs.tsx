import type { ReactNode } from "react"

export function createCollaborationSharedUiStubModule() {
  return {
    ChatHeaderActions: ({
      detailsAction,
    }: {
      detailsAction?: ReactNode
    }) => <div>{detailsAction}</div>,
    DetailsSidebarToggle: () => null,
    EmptyState: ({
      action,
      description,
      title,
    }: {
      action?: ReactNode
      description: string
      title: string
    }) => (
      <div>
        <div>{title}</div>
        <div>{description}</div>
        {action}
      </div>
    ),
    MembersSidebar: () => null,
    PageHeader: ({
      actions,
      title,
    }: {
      actions?: ReactNode
      title: string
    }) => (
      <div>
        <div>{title}</div>
        {actions}
      </div>
    ),
    SurfaceSidebarContent: () => null,
    TeamSurfaceSidebar: () => null,
  }
}

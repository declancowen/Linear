import type { ReactNode } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { WorkItemLabelsEditor } from "@/components/app/screens/shared"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/button", async () => {
  const stubs = await import("@/tests/lib/fixtures/component-stubs")
  return stubs.createButtonStubModule()
})

vi.mock("@/components/ui/input", async () => {
  const stubs = await import("@/tests/lib/fixtures/component-stubs")
  return stubs.createInputStubModule()
})

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

describe("WorkItemLabelsEditor", () => {
  const createdLabel = {
    id: "label_new",
    workspaceId: "workspace_1",
    name: "Urgent",
    color: "red",
  }

  let resolveCreateLabel:
    | ((label: typeof createdLabel | null) => void)
    | null = null

  beforeEach(() => {
    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "platform",
          name: "Platform",
          icon: "robot",
          settings: {
            joinCode: "JOIN1234",
            summary: "Platform team",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "software-development",
            features: createDefaultTeamFeatureSettings("software-development"),
            workflow: createDefaultTeamWorkflowSettings("software-development"),
          },
        },
      ],
      labels: [
        {
          id: "label_existing",
          workspaceId: "workspace_1",
          name: "Existing",
          color: "blue",
        },
      ],
      workItems: [
        {
          id: "item_1",
          key: "PLA-1",
          teamId: "team_1",
          type: "task",
          title: "Plan launch",
          descriptionDocId: "document_1",
          status: "todo",
          priority: "medium",
          assigneeId: null,
          creatorId: "user_1",
          parentId: null,
          primaryProjectId: null,
          linkedProjectIds: [],
          linkedDocumentIds: [],
          labelIds: ["label_existing"],
          milestoneId: null,
          startDate: null,
          dueDate: null,
          targetDate: null,
          subscriberIds: [],
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
      ],
      createLabel: vi.fn(
        () =>
          new Promise<typeof createdLabel | null>((resolve) => {
            resolveCreateLabel = (label) => {
              if (label) {
                useAppStore.setState((state) => ({
                  labels: [...state.labels, label],
                }))
              }

              resolve(label)
            }
          })
      ),
      updateWorkItem: vi.fn(
        (id: string, patch: Partial<{ labelIds: string[] }>) => {
          useAppStore.setState((state) => ({
            workItems: state.workItems.map((item) =>
              item.id === id ? { ...item, ...patch } : item
            ),
          }))

          return {
            status: "updated" as const,
          }
        }
      ),
    })
  })

  afterEach(() => {
    resolveCreateLabel = null
    useAppStore.setState(createEmptyState())
  })

  it("uses the latest label ids after async label creation resolves", async () => {
    const item = useAppStore.getState().workItems[0]

    if (!item) {
      throw new Error("Expected seeded work item")
    }

    render(<WorkItemLabelsEditor item={item} editable />)

    fireEvent.change(screen.getByPlaceholderText("Add label"), {
      target: { value: "Urgent" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    fireEvent.click(screen.getByRole("button", { name: "Existing" }))

    await act(async () => {
      resolveCreateLabel?.(createdLabel)
    })

    await waitFor(() => {
      expect(useAppStore.getState().workItems[0]?.labelIds).toEqual([
        "label_new",
      ])
    })
  })

  it("shows label color dots on selected pills and dropdown options", () => {
    const item = useAppStore.getState().workItems[0]

    if (!item) {
      throw new Error("Expected seeded work item")
    }

    const { container } = render(<WorkItemLabelsEditor item={item} editable />)

    expect(
      container.querySelectorAll('[data-label-color="blue"]')
    ).toHaveLength(2)
  })
})

import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import "@/tests/lib/fixtures/rich-text-composer-mocks"
import { CommentsInline } from "@/components/app/screens/work-item-ui"
import {
  createInlineChildWorkItem,
  getInlineChildIssueComposerModel,
  getInlineChildTeamProjects,
} from "@/components/app/screens/inline-child-composer-state"
import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestProject,
  createTestTeam,
  createTestUser,
  createTestWorkItem,
} from "@/tests/lib/fixtures/app-data"

describe("CommentsInline", () => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined)

  beforeEach(() => {
    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      users: [
        createTestUser({
          id: "user_1",
          name: "Alex",
          handle: "alex",
          email: "alex@example.com",
          title: "Founder",
          hasExplicitStatus: false,
        }),
        createTestUser({
          id: "user_2",
          name: "Taylor",
          handle: "taylor",
          email: "taylor@example.com",
          title: "Engineer",
          hasExplicitStatus: false,
        }),
      ],
      teamMemberships: [
        {
          teamId: "team_1",
          userId: "user_1",
          role: "admin",
        },
        {
          teamId: "team_1",
          userId: "user_2",
          role: "member",
        },
      ],
      workItems: [
        {
          id: "item_1",
          key: "TES-1",
          teamId: "team_1",
          type: "task",
          title: "Test item",
          descriptionDocId: "document_1",
          status: "todo",
          priority: "medium",
          assigneeId: null,
          creatorId: "user_1",
          parentId: null,
          primaryProjectId: null,
          linkedProjectIds: [],
          linkedDocumentIds: [],
          labelIds: [],
          milestoneId: null,
          startDate: null,
          dueDate: null,
          targetDate: null,
          subscriberIds: [],
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
      ],
      documents: [
        {
          id: "document_1",
          kind: "item-description",
          workspaceId: "workspace_1",
          teamId: "team_1",
          title: "Test item",
          content: "<p>Test</p>",
          linkedProjectIds: [],
          linkedWorkItemIds: ["item_1"],
          createdBy: "user_1",
          updatedBy: "user_1",
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
      ],
    })
    consoleErrorSpy.mockClear()
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  afterAll(() => {
    consoleErrorSpy.mockRestore()
  })

  it("derives inline child project and composer state in the work-item owner", () => {
    const parentItem = createTestWorkItem("parent_1", {
      primaryProjectId: "project_external",
      type: "task",
    })
    const teamProject = createTestProject({
      id: "project_team",
      templateType: "project-management",
    })
    const externalProject = createTestProject({
      id: "project_external",
      scopeId: "team_other",
      templateType: "project-management",
    })
    const teamProjects = getInlineChildTeamProjects({
      parentItem,
      projects: [teamProject, externalProject],
      teamId: "team_1",
    })
    const model = getInlineChildIssueComposerModel({
      assigneeId: "user_2",
      disabled: false,
      parentItem,
      projectId: "project_external",
      team: createTestTeam({
        settings: {
          experience: "project-management",
        },
      }),
      teamMembers: [
        createTestUser({ id: "user_2", name: "Taylor" }),
      ],
      teamProjects,
      title: " Child task ",
      type: "sub-task",
    })

    expect(teamProjects.map((project) => project.id)).toEqual([
      "project_external",
      "project_team",
    ])
    expect(model.canCreate).toBe(true)
    expect(model.normalizedTitle).toBe("Child task")
    expect(model.selectedAssignee?.id).toBe("user_2")
    expect(model.selectedProject?.id).toBe("project_external")
  })

  it("creates inline child items with normalized optional fields and descriptions", () => {
    const createWorkItem = vi.fn().mockReturnValue("item_child")
    const updateItemDescription = vi.fn()
    useAppStore.setState({
      ...createEmptyState(),
      createWorkItem: createWorkItem as never,
      updateItemDescription: updateItemDescription as never,
    })

    expect(
      createInlineChildWorkItem({
        assigneeId: "none",
        description: "Follow up",
        normalizedTitle: "Child item",
        parentItem: createTestWorkItem("parent_1"),
        priority: "medium",
        projectId: "none",
        selectedType: "task",
        status: "todo",
        teamId: "team_1",
      })
    ).toBe("item_child")

    expect(createWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({
        assigneeId: null,
        parentId: "parent_1",
        primaryProjectId: null,
        title: "Child item",
      })
    )
    expect(updateItemDescription).toHaveBeenCalledWith(
      "item_child",
      "<p>Follow up</p>"
    )
  })

  it("renders without snapshot loop warnings for work item comments", () => {
    const { rerender } = render(
      <CommentsInline targetType="workItem" targetId="item_1" editable />
    )

    expect(
      screen.getByLabelText(
        "Leave a comment or mention a teammate with @handle..."
      )
    ).toBeInTheDocument()

    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        ui: {
          ...state.ui,
          selectedViewByRoute: {
            ...state.ui.selectedViewByRoute,
            "/items/item_1": "details",
          },
        },
      }))
    })

    rerender(<CommentsInline targetType="workItem" targetId="item_1" editable />)

    const errorMessages = consoleErrorSpy.mock.calls
      .flat()
      .map((value) => String(value))
      .join("\n")

    expect(errorMessages).not.toContain(
      "The result of getSnapshot should be cached"
    )
    expect(errorMessages).not.toContain("Maximum update depth exceeded")
  })

  it("disables comment submit until the shared minimum plain-text length is met", () => {
    render(<CommentsInline targetType="workItem" targetId="item_1" editable />)

    const editor = screen.getByLabelText(
      "Leave a comment or mention a teammate with @handle..."
    )
    const button = screen.getByRole("button", { name: "Comment" })

    fireEvent.change(editor, {
      target: {
        value: "a",
      },
    })

    expect(button).toBeDisabled()
    expect(screen.getByText("Enter at least 2 characters")).toBeInTheDocument()

    fireEvent.change(editor, {
      target: {
        value: "ab",
      },
    })

    expect(button).toBeEnabled()
  })
})

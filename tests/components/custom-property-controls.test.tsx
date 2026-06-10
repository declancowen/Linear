import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  CustomPropertyDefinitionDialog,
  CustomPropertyValueControl,
} from "@/components/app/screens/custom-property-controls"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestAppData,
  createTestTeamMembership,
  createTestUser,
  createTestWorkspaceMembership,
  createTestWorkItem,
} from "@/tests/lib/fixtures/app-data"

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    disabled,
    onValueChange,
    value,
  }: {
    children: ReactNode
    disabled?: boolean
    onValueChange?: (value: string) => void
    value?: string
  }) => (
    <select
      aria-label="Custom property person"
      disabled={disabled}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}))

describe("CustomPropertyValueControl", () => {
  beforeEach(() => {
    useAppStore.setState({
      setCustomPropertyValue: vi.fn(),
    } as Partial<ReturnType<typeof useAppStore.getState>>)
  })

  it("uses workspace-visible users for private person properties", () => {
    const setCustomPropertyValueMock = vi.fn()
    const item = createTestWorkItem("private_item", {
      teamId: null,
      workspaceId: "workspace_1",
      visibility: "private",
      creatorId: "user_1",
    })
    const data = createTestAppData({
      users: [
        createTestUser({ id: "user_1", name: "Owner" }),
        createTestUser({
          id: "user_2",
          name: "Workspace user",
          email: "workspace@example.com",
          handle: "workspace",
        }),
        createTestUser({
          id: "user_3",
          name: "Team-only user",
          email: "team@example.com",
          handle: "team",
        }),
      ],
      workspaceMemberships: [
        createTestWorkspaceMembership({ userId: "user_1" }),
        createTestWorkspaceMembership({ userId: "user_2" }),
      ],
      teamMemberships: [
        createTestTeamMembership({ userId: "user_1" }),
        createTestTeamMembership({ userId: "user_3" }),
      ],
      workItems: [item],
    })

    useAppStore.setState({
      ...data,
      setCustomPropertyValue: setCustomPropertyValueMock,
    } as Partial<ReturnType<typeof useAppStore.getState>>)

    render(
      <CustomPropertyValueControl
        data={data}
        definition={{
          id: "property_private_person",
          workspaceId: "workspace_1",
          teamId: null,
          scopeType: "private",
          ownerId: "user_1",
          targetType: "workItem",
          name: "Reviewer",
          icon: "User",
          type: "person",
          options: [],
          isArchived: false,
          createdBy: "user_1",
          createdAt: "2026-05-12T10:00:00.000Z",
          updatedAt: "2026-05-12T10:00:00.000Z",
        }}
        item={item}
        value={null}
        editable
      />
    )

    expect(screen.getByText("Workspace user")).toBeInTheDocument()
    expect(screen.queryByText("Team-only user")).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Custom property person"), {
      target: {
        value: "user_2",
      },
    })

    expect(setCustomPropertyValueMock).toHaveBeenCalledWith(
      "workItem",
      "private_item",
      "property_private_person",
      "user_2"
    )
  })
})

describe("CustomPropertyDefinitionDialog", () => {
  function renderSelectEditor() {
    const data = createTestAppData({})

    useAppStore.setState({
      ...data,
      createCustomPropertyDefinition: vi.fn(),
      updateCustomPropertyDefinition: vi.fn(),
    } as Partial<ReturnType<typeof useAppStore.getState>>)

    render(
      <CustomPropertyDefinitionDialog
        open
        scopeType="team"
        teamId="team_1"
        definition={{
          id: "property_select",
          workspaceId: "workspace_1",
          teamId: "team_1",
          scopeType: "team",
          ownerId: null,
          targetType: "workItem",
          name: "Stage",
          icon: "ListBullets",
          type: "select",
          options: [
            { id: "opt_a", label: "Alpha", color: "var(--status-backlog)" },
            { id: "opt_b", label: "Beta", color: "var(--status-todo)" },
          ],
          isArchived: false,
          createdBy: "user_1",
          createdAt: "2026-05-12T10:00:00.000Z",
          updatedAt: "2026-05-12T10:00:00.000Z",
        }}
        onOpenChange={() => {}}
      />
    )
  }

  function optionLabels() {
    return screen
      .getAllByPlaceholderText("Option label")
      .map((input) => (input as HTMLInputElement).value)
  }

  it("reorders select options with the move controls", () => {
    renderSelectEditor()

    expect(optionLabels()).toEqual(["Alpha", "Beta"])

    fireEvent.click(screen.getAllByLabelText("Move option down")[0])

    expect(optionLabels()).toEqual(["Beta", "Alpha"])

    fireEvent.click(screen.getAllByLabelText("Move option up")[1])

    expect(optionLabels()).toEqual(["Alpha", "Beta"])
  })

  it("exposes a color palette for each option", () => {
    renderSelectEditor()

    fireEvent.click(screen.getAllByLabelText("Option color")[0])

    expect(screen.getAllByLabelText(/^Use color/).length).toBeGreaterThan(1)
  })
})

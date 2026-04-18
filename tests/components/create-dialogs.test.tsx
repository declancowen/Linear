import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

vi.mock("@/components/ui/select", async () => {
  const React = await import("react")

  type SelectItemDefinition = {
    value: string
    label: string
  }

  function getTextContent(node: React.ReactNode): string {
    if (typeof node === "string" || typeof node === "number") {
      return String(node)
    }

    if (Array.isArray(node)) {
      return node.map((entry) => getTextContent(entry)).join("")
    }

    if (React.isValidElement(node)) {
      return getTextContent(node.props.children)
    }

    return ""
  }

  function collectItems(node: React.ReactNode): SelectItemDefinition[] {
    const items: SelectItemDefinition[] = []

    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) {
        return
      }

      if ((child.type as { displayName?: string }).displayName === "MockSelectItem") {
        items.push({
          value: child.props.value,
          label: getTextContent(child.props.children),
        })
      }

      if (child.props.children) {
        items.push(...collectItems(child.props.children))
      }
    })

    return items
  }

  const SelectContext = React.createContext<{
    value: string
    onValueChange: (value: string) => void
    items: SelectItemDefinition[]
  } | null>(null)

  function Select({
    value,
    defaultValue,
    onValueChange,
    children,
  }: {
    value?: string
    defaultValue?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) {
    const items = React.useMemo(() => collectItems(children), [children])
    const [internalValue, setInternalValue] = React.useState(
      defaultValue ?? items[0]?.value ?? ""
    )
    const controlled = value !== undefined
    const currentValue = controlled ? value : internalValue

    return (
      <SelectContext.Provider
        value={{
          value: currentValue,
          onValueChange(nextValue) {
            if (!controlled) {
              setInternalValue(nextValue)
            }

            onValueChange?.(nextValue)
          },
          items,
        }}
      >
        {children}
      </SelectContext.Provider>
    )
  }

  function SelectTrigger(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
    const context = React.useContext(SelectContext)

    return (
      <select
        role="combobox"
        value={context?.value ?? ""}
        onChange={(event) => context?.onValueChange(event.target.value)}
        {...props}
      >
        {context?.items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    )
  }

  function SelectValue({ placeholder }: { placeholder?: string }) {
    return <span>{placeholder ?? null}</span>
  }

  function SelectContent({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }

  function SelectGroup({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }

  function SelectItem() {
    return null
  }

  SelectItem.displayName = "MockSelectItem"

  return {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
  }
})

import { CreateProjectDialog } from "@/components/app/screens/project-creation"
import { CreateWorkItemDialog } from "@/components/app/screens/create-work-item-dialog"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

describe("create dialogs", () => {
  beforeEach(() => {
    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      labels: [
        {
          id: "label_1",
          workspaceId: "workspace_1",
          name: "Platform",
          color: "blue",
        },
      ],
      users: [
        {
          id: "user_1",
          name: "Alex",
          handle: "alex",
          email: "alex@example.com",
          avatarUrl: "",
          avatarImageUrl: null,
          workosUserId: null,
          title: "Founder",
          status: "active",
          statusMessage: "",
          hasExplicitStatus: false,
          preferences: {
            emailMentions: true,
            emailAssignments: true,
            emailDigest: true,
            theme: "system",
          },
        },
      ],
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "platform",
          name: "Platform",
          icon: "code",
          settings: {
            joinCode: "JOIN1234",
            summary: "",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "software-development",
            features: createDefaultTeamFeatureSettings("software-development"),
            workflow: createDefaultTeamWorkflowSettings("software-development"),
          },
        },
        {
          id: "team_2",
          workspaceId: "workspace_1",
          slug: "ops",
          name: "Ops",
          icon: "box",
          settings: {
            joinCode: "JOIN5678",
            summary: "",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "software-development",
            features: createDefaultTeamFeatureSettings("software-development"),
            workflow: createDefaultTeamWorkflowSettings("software-development"),
          },
        },
      ],
      teamMemberships: [
        {
          teamId: "team_1",
          userId: "user_1",
          role: "admin",
        },
        {
          teamId: "team_2",
          userId: "user_1",
          role: "admin",
        },
      ],
      projects: [],
    })
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  it("renders the work-item create dialog without recursive store updates", () => {
    render(
      <CreateWorkItemDialog
        open
        onOpenChange={vi.fn()}
        defaultTeamId="team_1"
        initialType="epic"
      />
    )

    expect(screen.getAllByText("Platform").length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText("Epic title")).toBeInTheDocument()
  })

  it("lets you switch team spaces without throwing when an initial type is provided", () => {
    render(
      <CreateWorkItemDialog
        open
        onOpenChange={vi.fn()}
        defaultTeamId="team_1"
        initialType="epic"
      />
    )

    fireEvent.change(screen.getAllByRole("combobox")[0]!, {
      target: { value: "team_2" },
    })

    expect(screen.getAllByDisplayValue("Ops").length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText("Epic title")).toBeInTheDocument()
  })

  it("renders the project create dialog without recursive store updates", () => {
    render(
      <CreateProjectDialog
        open
        onOpenChange={vi.fn()}
        defaultTeamId="team_1"
      />
    )

    expect(screen.getAllByText("Platform").length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText("Project name")).toBeInTheDocument()
  })
})

import type { ReactNode } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import "@/tests/lib/fixtures/detail-screen-mocks"
import { DetailSidebarLabelsRow } from "@/components/app/screens/detail-sidebar-labels-row"
import { WorkItemDetailScreen } from "@/components/app/screens/work-item-detail-screen"
import { createEmptyState } from "@/lib/domain/empty-state"
import { RouteMutationError } from "@/lib/convex/client/shared"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestAppData,
  createTestDocument,
  createTestTeamMembership,
  createTestUser,
  createTestWorkItem,
} from "@/tests/lib/fixtures/app-data"

const {
  fetchWorkItemDetailReadModelMock,
  richTextContentRenderMock,
  richTextEditorRenderMock,
  routerReplaceMock,
  syncAddCommentMock,
  syncClearWorkItemPresenceMock,
  syncHeartbeatWorkItemPresenceMock,
  syncSendItemDescriptionMentionNotificationsMock,
  syncToggleCommentReactionMock,
  syncUpdateWorkItemMock,
  useDocumentCollaborationMock,
} = vi.hoisted(() => ({
  fetchWorkItemDetailReadModelMock: vi.fn(),
  richTextContentRenderMock: vi.fn(),
  richTextEditorRenderMock: vi.fn(),
  routerReplaceMock: vi.fn(),
  syncAddCommentMock: vi.fn(),
  syncClearWorkItemPresenceMock: vi.fn(),
  syncHeartbeatWorkItemPresenceMock: vi.fn(),
  syncSendItemDescriptionMentionNotificationsMock: vi.fn(),
  syncToggleCommentReactionMock: vi.fn(),
  syncUpdateWorkItemMock: vi.fn(),
  useDocumentCollaborationMock: vi.fn(),
}))

vi.mock("next/link", async () =>
  (await import("@/tests/lib/fixtures/component-stubs")).createNextLinkStubModule()
)

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
  }),
}))

vi.mock("@/lib/convex/client", () => ({
  fetchWorkItemDetailReadModel: fetchWorkItemDetailReadModelMock,
  syncAddComment: syncAddCommentMock,
  syncClearWorkItemPresence: syncClearWorkItemPresenceMock,
  syncHeartbeatWorkItemPresence: syncHeartbeatWorkItemPresenceMock,
  syncSendItemDescriptionMentionNotifications:
    syncSendItemDescriptionMentionNotificationsMock,
  syncToggleCommentReaction: syncToggleCommentReactionMock,
  syncUpdateWorkItem: syncUpdateWorkItemMock,
}))

vi.mock("@/hooks/use-document-collaboration", () => ({
  useDocumentCollaboration: useDocumentCollaborationMock,
}))

vi.mock("@/components/app/rich-text-editor", () => ({
  RichTextEditor: ({
    content,
    collaboration,
    editable,
    onChange,
    placeholder,
    onSubmitShortcut,
    submitOnEnter,
  }: {
    content: string | Record<string, unknown>
    collaboration?: unknown
    editable?: boolean
    onChange: (value: string) => void
    placeholder?: string
    onSubmitShortcut?: () => void
    submitOnEnter?: boolean
  }) => {
    richTextEditorRenderMock({
      collaboration,
      content,
      editable,
      placeholder,
    })

    return (
      <textarea
        aria-label={
          placeholder === "Add a description…"
            ? "Description editor"
            : (placeholder ?? "Rich text editor")
        }
        data-testid="rich-text-editor"
        data-collaboration={String(Boolean(collaboration))}
        data-editable={String(Boolean(editable))}
        value={typeof content === "string" ? content : JSON.stringify(content)}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (submitOnEnter && event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            onSubmitShortcut?.()
          }
        }}
      />
    )
  },
}))

vi.mock("@/components/app/rich-text-content", async () => {
  const { createRichTextContentStub } = await import(
    "@/tests/lib/fixtures/component-stubs"
  )

  return {
    RichTextContent: createRichTextContentStub(richTextContentRenderMock),
  }
})

vi.mock("@/components/app/screens/document-ui", async () => {
  const { DocumentPresenceAvatarGroupStub } = await import(
    "@/tests/lib/fixtures/component-stubs"
  )

  return {
    DocumentPresenceAvatarGroup: DocumentPresenceAvatarGroupStub,
  }
})

vi.mock("@/components/app/screens/shared", () => ({
  buildPropertyStatusOptions: (statuses: string[]) =>
    statuses.map((status) => ({
      value: status,
      label: status,
    })),
  CollapsibleSection: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  MissingState: ({ title }: { title: string }) => <div>{title}</div>,
  PROPERTY_SELECT_SEPARATOR_VALUE: "__separator__",
  getSelectedPropertySelectOption: (
    options: Array<{ value: string; label: string }>,
    value: string
  ) =>
    options.find((option) => option.value === value) ??
    options.find((option) => option.value !== "__separator__") ??
    null,
  PriorityIcon: () => null,
  PriorityDot: () => null,
  PropertyDateField: ({
    label,
    value,
    disabled,
    onValueChange,
  }: {
    label: string
    value: string | null
    disabled?: boolean
    onValueChange: (value: string | null) => void
  }) => (
    <input
      aria-label={label}
      disabled={disabled}
      value={value ?? ""}
      onChange={(event) => onValueChange(event.target.value || null)}
    />
  ),
  PropertyRow: ({ label, value }: { label: string; value: string }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
  PropertySelect: ({
    accessibleLabel,
    label,
    value,
    options,
    disabled,
    onValueChange,
  }: {
    accessibleLabel?: string
    label: string
    value: string
    options: Array<{ value: string; label: string }>
    disabled?: boolean
    onValueChange: (value: string) => void
  }) => (
    <button
      type="button"
      aria-label={accessibleLabel ?? (label || "Project")}
      disabled={disabled}
      onClick={() => {
        const nextOption = options.find(
          (option) => option.value !== "__separator__" && option.value !== value
        )

        if (nextOption) {
          onValueChange(nextOption.value)
        }
      }}
    >
      {label || "Project"}:{value}
    </button>
  ),
  LabelColorDot: () => <span data-testid="label-color-dot" />,
  StatusIcon: () => null,
  useWorkItemLabelEditorState: ({
    item,
    labels,
  }: {
    item: { labelIds: string[] }
    labels: Array<{ id: string }>
  }) => ({
    handleCreateLabel: vi.fn(),
    labelNameLimitState: { canSubmit: false },
    newLabelName: "",
    selectedLabels: labels.filter((label) => item.labelIds.includes(label.id)),
    setNewLabelName: vi.fn(),
    toggleLabel: vi.fn(),
  }),
  WorkItemLabelsEditor: ({ editable }: { editable: boolean }) => (
    <button type="button" aria-label="Manage labels" disabled={!editable}>
      Manage labels
    </button>
  ),
}))

vi.mock("@/components/app/screens/work-item-ui", () => ({
  CommentReactionButtons: () => null,
  CommentsInline: () => null,
  InlineChildIssueComposer: () => (
    <div data-testid="inline-child-composer">Inline child composer</div>
  ),
  WORK_ITEM_COMMENT_SHORTCUT_KEY_CLASS: "",
  WorkItemAssigneeAvatar: () => null,
  WorkItemCommentComposerActions: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  WorkItemTypeBadge: () => <div>Task</div>,
}))

vi.mock("@/components/ui/button", async () =>
  (await import("@/tests/lib/fixtures/component-stubs")).createButtonStubModule()
)

vi.mock("@/components/ui/input", async () =>
  (await import("@/tests/lib/fixtures/component-stubs")).createInputStubModule()
)

vi.mock("@/components/ui/sidebar", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createSidebarTriggerStubModule()
)

vi.mock("@/components/ui/collapsible-right-sidebar", () => ({
  CollapsibleRightSidebar: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/components/ui/confirm-dialog", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createConfirmDialogStubModule()
)

vi.mock("@/components/ui/dropdown-menu", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createDropdownMenuStubModule({ triggerAsDiv: true })
)

vi.mock("@/components/ui/separator", () => ({
  Separator: () => null,
}))

vi.mock("@phosphor-icons/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phosphor-icons/react")>()

  return {
    ...actual,
    CalendarBlank: () => null,
    CaretDown: () => null,
    CaretRight: () => null,
    Clock: () => null,
    DotsThree: () => null,
    Flag: () => null,
    FolderSimple: () => null,
    LinkSimple: () => null,
    NotePencil: () => null,
    PaperPlaneTilt: () => null,
    Plus: () => null,
    SidebarSimple: () => null,
    Smiley: () => null,
    Tag: () => null,
    Trash: () => null,
    X: () => null,
  }
})

function seedState() {
  useAppStore.setState(
    createTestAppData({
      users: [
        createTestUser({
          title: "Founder",
          hasExplicitStatus: false,
        }),
        createTestUser({
          id: "user_2",
          name: "Taylor",
          handle: "taylor",
          email: "taylor@example.com",
          hasExplicitStatus: false,
        }),
      ],
      teamMemberships: [createTestTeamMembership()],
      documents: [
        createTestDocument({
          id: "document_1",
          kind: "item-description",
          title: "Plan launch",
          content: "<p>Initial description</p>",
          linkedWorkItemIds: ["item_1"],
        }),
        createTestDocument({
          id: "document_2",
          kind: "item-description",
          title: "Follow up",
          content: "<p>Second description</p>",
          linkedWorkItemIds: ["item_2"],
        }),
      ],
      workItems: [
        createTestWorkItem("item_1", {
          key: "PLA-1",
          title: "Plan launch",
          descriptionDocId: "document_1",
          subscriberIds: [],
        }),
        createTestWorkItem("item_2", {
          key: "PLA-2",
          title: "Follow up",
          descriptionDocId: "document_2",
          subscriberIds: [],
        }),
      ],
    })
  )
}

function addChildWorkItems(
  children: Array<{
    id: string
    key: string
    title: string
    assigneeId?: string | null
    dueDate?: string | null
    status?: "todo" | "done"
  }>
) {
  act(() => {
    useAppStore.setState((state) => ({
      ...state,
      documents: [
        ...state.documents,
        ...children.map((child) =>
          createTestDocument({
            id: child.id.replace("item", "document"),
            kind: "item-description",
            title: child.title,
            content: `<p>${child.title}</p>`,
            linkedWorkItemIds: [child.id],
          })
        ),
      ],
      workItems: [
        ...state.workItems,
        ...children.map((child) =>
          createTestWorkItem(child.id, {
            key: child.key,
            type: "sub-task",
            title: child.title,
            descriptionDocId: child.id.replace("item", "document"),
            status: child.status ?? "todo",
            assigneeId: child.assigneeId ?? null,
            parentId: "item_1",
            dueDate: child.dueDate ?? null,
            subscriberIds: [],
          })
        ),
      ],
    }))
  })
}

const TAYLOR_MENTION_DESCRIPTION =
  '<p>Initial description</p><span data-type="mention" data-id="user_2">@Taylor</span>'

function renderWorkItemDetail(itemId = "item_1") {
  return render(<WorkItemDetailScreen itemId={itemId} />)
}

function openWorkItemEditor() {
  fireEvent.click(screen.getByRole("button", { name: "Edit" }))
}

function updateDescriptionEditor(value: string) {
  fireEvent.change(screen.getByLabelText("Description editor"), {
    target: {
      value,
    },
  })
}

function clickSaveButton() {
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
}

async function expectWorkItemEditorClosed() {
  expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument()
}

function setSaveWorkItemMainSectionMock(saveMock: ReturnType<typeof vi.fn>) {
  useAppStore.setState({
    saveWorkItemMainSection: saveMock,
  } as Partial<ReturnType<typeof useAppStore.getState>>)
}

function createStateUpdatingSaveMock(input?: {
  getDocumentId?: (itemId: string) => string
}) {
  let saveCount = 0

  return vi.fn().mockImplementation(
    async ({
      itemId = "item_1",
      description,
      title,
    }: {
      itemId?: string
      description: string
      title: string
    }) => {
      saveCount += 1
      const documentId = input?.getDocumentId?.(itemId) ?? "document_1"
      const updatedAt = `2026-04-18T10:00:${saveCount
        .toString()
        .padStart(2, "0")}.000Z`

      useAppStore.setState((state) => ({
        workItems: state.workItems.map((item) =>
          item.id === itemId
            ? {
                ...item,
                title,
                updatedAt,
              }
            : item
        ),
        documents: state.documents.map((document) =>
          document.id === documentId
            ? {
                ...document,
                content: description,
                updatedAt,
              }
            : document
        ),
      }))

      return true
    }
  )
}

function mockRetryingMentionDelivery() {
  syncSendItemDescriptionMentionNotificationsMock
    .mockRejectedValueOnce(
      new Error("Saved changes but failed to notify mentions")
    )
    .mockResolvedValueOnce({
      recipientCount: 1,
      mentionCount: 1,
    })
}

async function expectTaylorMentionDeliveryRetry() {
  await waitFor(() =>
    expect(syncSendItemDescriptionMentionNotificationsMock).toHaveBeenNthCalledWith(
      2,
      "item_1",
      [
        {
          userId: "user_2",
          count: 1,
        },
      ]
    )
  )
}

describe("DetailSidebarLabelsRow", () => {
  it("renders selected and empty label states with editability", () => {
    const labels = [
      { id: "label_1", name: "Customer", color: "#ff0000" },
    ] as never
    const item = createTestWorkItem("item_1", {
      labelIds: ["label_1"],
    })

    const { rerender } = render(
      <DetailSidebarLabelsRow
        editable
        item={item}
        labels={labels}
        workspaceId="workspace_1"
      />
    )

    expect(screen.getByText("Customer")).toBeInTheDocument()
    expect(screen.getByTestId("label-color-dot")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Manage labels" })).toBeEnabled()

    rerender(
      <DetailSidebarLabelsRow
        editable={false}
        item={createTestWorkItem("item_2", { labelIds: [] })}
        labels={[]}
        workspaceId={null}
      />
    )

    expect(screen.getByText("No labels")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Manage labels" })).toBeDisabled()
  })
})

describe("work item detail screen", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    fetchWorkItemDetailReadModelMock.mockReset()
    richTextContentRenderMock.mockReset()
    richTextEditorRenderMock.mockReset()
    fetchWorkItemDetailReadModelMock.mockResolvedValue({})
    syncClearWorkItemPresenceMock.mockReset()
    syncHeartbeatWorkItemPresenceMock.mockReset()
    syncSendItemDescriptionMentionNotificationsMock.mockReset()
    syncUpdateWorkItemMock.mockReset()
    syncHeartbeatWorkItemPresenceMock.mockResolvedValue([])
    syncClearWorkItemPresenceMock.mockResolvedValue({ ok: true })
    syncUpdateWorkItemMock.mockResolvedValue({ ok: true })
    useDocumentCollaborationMock.mockReset()
    useDocumentCollaborationMock.mockReturnValue({
      bootstrapContent: null,
      editorCollaboration: null,
      collaboration: null,
      flush: vi.fn(),
      isAwaitingCollaboration: false,
      lifecycle: "legacy",
      viewers: [],
    })
    seedState()
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  it("shows a stale draft notice and reloads the latest main-section content", async () => {
    render(<WorkItemDetailScreen itemId="item_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Edit" }))
    fireEvent.change(screen.getByDisplayValue("Plan launch"), {
      target: {
        value: "Plan launch draft",
      },
    })

    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled()

    act(() => {
      useAppStore.setState((state) => ({
        workItems: state.workItems.map((item) =>
          item.id === "item_1"
            ? {
                ...item,
                title: "Plan launch remote",
                updatedAt: "2026-04-18T11:00:00.000Z",
              }
            : item
        ),
        documents: state.documents.map((document) =>
          document.id === "document_1"
            ? {
                ...document,
                content: "<p>Remote description</p>",
                updatedAt: "2026-04-18T11:00:00.000Z",
              }
            : document
        ),
      }))
    })

    expect(
      screen.getByText("This item changed while you were editing")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Reload latest" }))

    expect(
      screen.queryByText("This item changed while you were editing")
    ).toBeNull()
    expect(screen.getByDisplayValue("Plan launch remote")).toBeInTheDocument()
  })

  it("shows a stable description preview while collaboration bootstraps", async () => {
    const flushMock = vi.fn().mockResolvedValue(undefined)
    const bootstrapContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Boot description",
            },
          ],
        },
      ],
    }
    let collaborationState: ReturnType<typeof useDocumentCollaborationMock> = {
      bootstrapContent: null,
      editorCollaboration: null,
      collaboration: null,
      flush: flushMock,
      isAwaitingCollaboration: false,
      lifecycle: "legacy" as const,
      viewers: [],
    }

    useDocumentCollaborationMock.mockImplementation(() => collaborationState)

    const { rerender } = render(<WorkItemDetailScreen itemId="item_1" />)

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit" }))
    })

    await waitFor(() => {
      expect(richTextEditorRenderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          collaboration: undefined,
          content: "<p>Initial description</p>",
          editable: true,
          placeholder: "Add a description…",
        })
      )
    })

    collaborationState = {
      bootstrapContent,
      editorCollaboration: {
        binding: {
          doc: {},
          provider: {},
        },
        localUser: {
          userId: "user_1",
          sessionId: "session_1",
          name: "Alex",
          avatarUrl: null,
          color: "#000000",
          typing: false,
          activeBlockId: null,
          cursor: null,
          selection: null,
          cursorSide: null,
        },
      },
      collaboration: null,
      flush: flushMock,
      isAwaitingCollaboration: true,
      lifecycle: "bootstrapping",
      viewers: [],
    }

    rerender(<WorkItemDetailScreen itemId="item_1" />)

    await waitFor(() => {
      expect(richTextContentRenderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "<p>Initial description</p>",
        })
      )
    })
    expect(richTextContentRenderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "<p>Initial description</p>",
      })
    )
  })

  it("surfaces when other people are editing the same item", async () => {
    syncHeartbeatWorkItemPresenceMock.mockResolvedValue([
      {
        userId: "user_1",
        name: "Alex",
        avatarUrl: "",
        avatarImageUrl: null,
        lastSeenAt: "2026-04-18T10:01:00.000Z",
      },
      {
        userId: "user_2",
        name: "Taylor",
        avatarUrl: "",
        avatarImageUrl: null,
        lastSeenAt: "2026-04-18T10:01:00.000Z",
      },
    ])

    render(<WorkItemDetailScreen itemId="item_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Edit" }))

    expect(await screen.findByText("Taylor")).toBeInTheDocument()
    expect(screen.queryByText("Taylor is also editing this item")).toBeNull()
  })

  it("closes edit mode even when mention delivery fails after save", async () => {
    const saveWorkItemMainSectionMock = vi.fn().mockResolvedValue(true)
    syncSendItemDescriptionMentionNotificationsMock.mockRejectedValue(
      new Error("Saved changes but failed to notify mentions")
    )
    setSaveWorkItemMainSectionMock(saveWorkItemMainSectionMock)

    renderWorkItemDetail()
    openWorkItemEditor()
    updateDescriptionEditor(TAYLOR_MENTION_DESCRIPTION)
    clickSaveButton()

    expect(saveWorkItemMainSectionMock).toHaveBeenCalled()
    await expectWorkItemEditorClosed()
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull()
  })

  it("retries failed mention delivery on the next save without reintroducing the mention", async () => {
    setSaveWorkItemMainSectionMock(createStateUpdatingSaveMock())
    mockRetryingMentionDelivery()

    renderWorkItemDetail()

    openWorkItemEditor()
    updateDescriptionEditor(TAYLOR_MENTION_DESCRIPTION)

    clickSaveButton()

    await expectWorkItemEditorClosed()

    openWorkItemEditor()

    const saveButton = screen.getByRole("button", { name: "Save" })
    expect(saveButton).not.toBeDisabled()

    fireEvent.click(saveButton)

    await expectTaylorMentionDeliveryRetry()

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }))
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("preserves mention retries for one item when saving a different item without mentions", async () => {
    setSaveWorkItemMainSectionMock(
      createStateUpdatingSaveMock({
        getDocumentId: (itemId) =>
          itemId === "item_1" ? "document_1" : "document_2",
      })
    )
    mockRetryingMentionDelivery()

    const { rerender } = renderWorkItemDetail()

    openWorkItemEditor()
    updateDescriptionEditor(TAYLOR_MENTION_DESCRIPTION)
    clickSaveButton()

    await expectWorkItemEditorClosed()

    rerender(<WorkItemDetailScreen itemId="item_2" />)

    openWorkItemEditor()
    fireEvent.change(screen.getByDisplayValue("Follow up"), {
      target: { value: "Follow up updated" },
    })
    clickSaveButton()

    await expectWorkItemEditorClosed()

    rerender(<WorkItemDetailScreen itemId="item_1" />)

    openWorkItemEditor()

    const saveButton = screen.getByRole("button", { name: "Save" })
    expect(saveButton).not.toBeDisabled()

    fireEvent.click(saveButton)

    await expectTaylorMentionDeliveryRetry()
  })

  it("sends self-mentions after saving the main section", async () => {
    const saveWorkItemMainSectionMock = vi.fn().mockResolvedValue(true)
    syncSendItemDescriptionMentionNotificationsMock.mockResolvedValue({
      recipientCount: 1,
      mentionCount: 1,
    })
    setSaveWorkItemMainSectionMock(saveWorkItemMainSectionMock)

    renderWorkItemDetail()

    openWorkItemEditor()
    updateDescriptionEditor(
      '<p>Initial description</p><span data-type="mention" data-id="user_1">@Alex</span>'
    )

    clickSaveButton()

    expect(saveWorkItemMainSectionMock).toHaveBeenCalled()
    await waitFor(() =>
      expect(
        syncSendItemDescriptionMentionNotificationsMock
      ).toHaveBeenCalledWith("item_1", [
        {
          userId: "user_1",
          count: 1,
        },
      ])
    )
  })

  it("clears mention retries when the server reports they were already delivered", async () => {
    const saveWorkItemMainSectionMock = vi.fn().mockResolvedValue(true)
    syncSendItemDescriptionMentionNotificationsMock.mockRejectedValue(
      new RouteMutationError(
        "One or more mentioned users were already notified for this work item",
        409,
        {
          code: "ITEM_DESCRIPTION_MENTION_ALREADY_SENT",
        }
      )
    )
    setSaveWorkItemMainSectionMock(saveWorkItemMainSectionMock)

    renderWorkItemDetail()

    openWorkItemEditor()
    updateDescriptionEditor(TAYLOR_MENTION_DESCRIPTION)

    clickSaveButton()

    await expectWorkItemEditorClosed()

    openWorkItemEditor()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("shows editable sidebar property controls and simplified child rows", () => {
    addChildWorkItems([
      {
        id: "item_3",
        key: "PLA-3",
        title: "Child item",
        assigneeId: "user_1",
        dueDate: "2030-12-19T09:00:00.000Z",
      },
    ])

    render(<WorkItemDetailScreen itemId="item_1" />)

    expect(screen.getAllByText("PLA-1").length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Copy item link" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "More actions" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Close sidebar" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Priority" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Assignee" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Due" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Manage labels" })
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: "Project" }).length
    ).toBeGreaterThan(0)
    expect(screen.getAllByText("PLA-3").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Child item").length).toBeGreaterThan(0)
    expect(screen.queryByText("19 December 2030")).not.toBeInTheDocument()
  })

  it("hides empty child-row assignee and project controls", () => {
    addChildWorkItems([
      {
        id: "item_3",
        key: "PLA-3",
        title: "Unassigned child",
      },
    ])

    render(<WorkItemDetailScreen itemId="item_1" />)

    expect(screen.getAllByRole("button", { name: "Assignee" }).length).toBe(1)
    expect(screen.getAllByRole("button", { name: "Project" }).length).toBe(1)
  })

  it("shows sidebar subtask progress above the child list", () => {
    addChildWorkItems([
      {
        id: "item_3",
        key: "PLA-3",
        title: "Child done",
        status: "done",
      },
      {
        id: "item_4",
        key: "PLA-4",
        title: "Child todo",
      },
    ])

    render(<WorkItemDetailScreen itemId="item_1" />)

    expect(screen.getByText("1/2 active")).toBeInTheDocument()
    expect(screen.getAllByText("50%")).toHaveLength(2)
  })

  it("opens the child composer only in the surface that was triggered", () => {
    render(<WorkItemDetailScreen itemId="item_1" />)

    const addButtons = screen.getAllByRole("button", { name: "Add sub-task" })
    expect(addButtons).toHaveLength(2)

    fireEvent.click(addButtons[0]!)
    expect(screen.getAllByTestId("inline-child-composer")).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "Add sub-task" }))
    expect(screen.getAllByTestId("inline-child-composer")).toHaveLength(1)
  })

  it("keeps activity comment submit disabled until the shared minimum plain-text length is met", () => {
    render(<WorkItemDetailScreen itemId="item_1" />)

    const commentEditors = screen.getAllByLabelText(
      "Leave a comment or mention a teammate with @handle..."
    )
    const commentButtons = screen.getAllByRole("button", { name: "Comment" })
    const commentEditor = commentEditors.at(-1)
    const commentButton = commentButtons.at(-1)

    expect(commentEditor).toBeDefined()
    expect(commentButton).toBeDefined()

    act(() => {
      fireEvent.change(commentEditor!, {
        target: {
          value: "a",
        },
      })
    })

    expect(commentButton!).toBeDisabled()
    expect(
      screen.getAllByText("Enter at least 2 characters").length
    ).toBeGreaterThan(0)

    act(() => {
      fireEvent.change(commentEditor!, {
        target: {
          value: "ab",
        },
      })
    })

    expect(commentButton!).toBeEnabled()
  })

  it("posts activity comments on Enter and preserves mentions", () => {
    act(() => {
      useAppStore.setState((state) => ({
        teamMemberships: [
          ...state.teamMemberships,
          {
            teamId: "team_1",
            userId: "user_2",
            role: "member",
          },
        ],
      }))
    })

    render(<WorkItemDetailScreen itemId="item_1" />)

    const commentEditor = screen.getByLabelText(
      "Leave a comment or mention a teammate with @handle..."
    )
    fireEvent.change(commentEditor, {
      target: {
        value:
          '<p>Heads up <span data-type="mention" data-id="user_2">@Taylor</span></p>',
      },
    })
    fireEvent.keyDown(commentEditor, {
      key: "Enter",
    })

    const [comment] = useAppStore.getState().comments
    expect(comment).toMatchObject({
      targetType: "workItem",
      targetId: "item_1",
      mentionUserIds: ["user_2"],
    })
    expect(comment.content).toContain('data-id="user_2"')
  })
})

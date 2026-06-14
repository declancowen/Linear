import type { ComponentProps, ReactNode } from "react"
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import "@/tests/lib/fixtures/detail-screen-mocks"
import { DetailSidebarLabelsRow } from "@/components/app/screens/detail-sidebar-labels-row"
import {
  WorkItemDetailScreen,
  WorkItemDetailSidebarSurface,
} from "@/components/app/screens/work-item-detail-screen"
import { createEmptyState } from "@/lib/domain/empty-state"
import type { AppData } from "@/lib/domain/types"
import { RouteMutationError } from "@/lib/convex/client/shared"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestAppData,
  createTestDocument,
  createTestProject,
  createTestTeam,
  createTestTeamMembership,
  createTestViewDefinition,
  createTestUser,
  createTestWorkItem,
} from "@/tests/lib/fixtures/app-data"

const {
  fetchWorkItemDetailReadModelMock,
  richTextContentRenderMock,
  richTextEditorRenderMock,
  routerReplaceMock,
  searchParamsState,
  syncAddCommentMock,
  syncClearWorkItemPresenceMock,
  syncHeartbeatWorkItemPresenceMock,
  syncSendItemDescriptionMentionNotificationsMock,
  syncToggleCommentReactionMock,
  syncUpdateWorkItemMock,
  useScopedReadModelRefreshMock,
} = vi.hoisted(() => ({
  fetchWorkItemDetailReadModelMock: vi.fn(),
  richTextContentRenderMock: vi.fn(),
  richTextEditorRenderMock: vi.fn(),
  routerReplaceMock: vi.fn(),
  searchParamsState: { value: "" },
  syncAddCommentMock: vi.fn(),
  syncClearWorkItemPresenceMock: vi.fn(),
  syncHeartbeatWorkItemPresenceMock: vi.fn(),
  syncSendItemDescriptionMentionNotificationsMock: vi.fn(),
  syncToggleCommentReactionMock: vi.fn(),
  syncUpdateWorkItemMock: vi.fn(),
  useScopedReadModelRefreshMock: vi.fn(),
}))

vi.mock("next/link", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createNextLinkStubModule()
)

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
  }),
  useSearchParams: () => new URLSearchParams(searchParamsState.value),
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

vi.mock("@/hooks/use-scoped-read-model-refresh", () => ({
  useScopedReadModelRefresh: useScopedReadModelRefreshMock,
}))

vi.mock("@/components/app/rich-text-editor", () => ({
  RichTextEditor: ({
    content,
    collaboration,
    editable,
    onChange,
    placeholder,
    onSubmitShortcut,
    referenceCandidates,
    submitOnEnter,
  }: {
    content: string | Record<string, unknown>
    collaboration?: unknown
    editable?: boolean
    onChange: (value: string) => void
    placeholder?: string
    onSubmitShortcut?: () => void
    referenceCandidates?: unknown[]
    submitOnEnter?: boolean
  }) => {
    richTextEditorRenderMock({
      collaboration,
      content,
      editable,
      placeholder,
      referenceCandidates,
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
  const { createRichTextContentStub } =
    await import("@/tests/lib/fixtures/component-stubs")

  return {
    RichTextContent: createRichTextContentStub(richTextContentRenderMock),
  }
})

vi.mock("@/components/app/screens/document-ui", async () => {
  const { DocumentPresenceAvatarGroupStub } =
    await import("@/tests/lib/fixtures/component-stubs")

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
  getDocumentPreview: () => "",
  StatusIcon: () => null,
  WorkItemTypeIcon: () => <span data-testid="work-item-type-icon" />,
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
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createButtonStubModule()
)

vi.mock("@/components/ui/input", async () =>
  (await import("@/tests/lib/fixtures/component-stubs")).createInputStubModule()
)

vi.mock("@/components/ui/sidebar", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createSidebarTriggerStubModule()
)

vi.mock("@/components/ui/collapsible-right-sidebar", async () => {
  const React = await import("react")

  return {
    CollapsibleRightSidebar: React.forwardRef<
      HTMLElement,
      ComponentProps<"aside"> & {
        containerClassName?: string
        open?: boolean
        width?: string
      }
    >(function CollapsibleRightSidebarMock(
      {
        children,
        containerClassName: _containerClassName,
        open: _open,
        width: _width,
        ...props
      },
      ref
    ) {
      void _containerClassName
      void _open
      void _width

      return (
        <aside ref={ref} {...props}>
          {children}
        </aside>
      )
    }),
  }
})

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

function createWorkItemDetailTestData(overrides: Partial<AppData> = {}) {
  return createTestAppData({
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
    ...overrides,
  })
}

function seedState() {
  useAppStore.setState(createWorkItemDetailTestData())
}

function getSeededWorkItemDetailSidebarFixture() {
  const data = useAppStore.getState()
  const item = data.workItems.find((candidate) => candidate.id === "item_1")

  if (!item) {
    throw new Error("Expected seeded work item")
  }

  return { data, item }
}

function addChildWorkItems(
  children: Array<{
    id: string
    key: string
    title: string
    assigneeId?: string | null
    dueDate?: string | null
    labelIds?: string[]
    milestoneId?: string | null
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
            labelIds: child.labelIds ?? [],
            milestoneId: child.milestoneId ?? null,
            subscriberIds: [],
          })
        ),
      ],
    }))
  })
}

const TAYLOR_MENTION_DESCRIPTION =
  '<p>Initial description</p><span data-type="mention" data-id="user_2">@Taylor</span>'
const MENTION_DELIVERY_TEST_TIMEOUT_MS = 60_000
const WORK_ITEM_EDITOR_CLOSE_TIMEOUT_MS = 15_000

function renderWorkItemDetail(itemId = "item_1") {
  return render(<WorkItemDetailScreen itemId={itemId} />)
}

function renderWorkItemBreadcrumbAfterStatePatch(
  itemId: string,
  patchState: (
    state: ReturnType<typeof useAppStore.getState>
  ) => Partial<AppData>
) {
  act(() => {
    useAppStore.setState((state) => ({
      ...state,
      ...patchState(state),
    }))
  })

  renderWorkItemDetail(itemId)

  return screen.getByLabelText("Work item breadcrumb")
}

function getSubtaskSurfaceQueries() {
  const surface = screen.getAllByText("Sub-tasks")[0]?.closest("section")

  expect(surface).not.toBeNull()

  return within(surface!)
}

async function openWorkItemEditor() {
  fireEvent.click(screen.getByRole("button", { name: "Edit" }))
  await screen.findByLabelText("Description editor")
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
  expect(
    await screen.findByRole(
      "button",
      { name: "Edit" },
      { timeout: WORK_ITEM_EDITOR_CLOSE_TIMEOUT_MS }
    )
  ).toBeInTheDocument()
}

function renderSidebarSurfaceForTestData(data: AppData) {
  const item = data.workItems.find((candidate) => candidate.id === "item_1")

  if (!item) {
    throw new Error("Expected seeded work item")
  }

  render(
    <WorkItemDetailSidebarSurface data={data} currentItem={item} editable />
  )

  return item
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

  return vi
    .fn()
    .mockImplementation(
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
    expect(
      syncSendItemDescriptionMentionNotificationsMock
    ).toHaveBeenNthCalledWith(2, "item_1", [
      {
        userId: "user_2",
        count: 1,
      },
    ])
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
    routerReplaceMock.mockReset()
    searchParamsState.value = ""
    fetchWorkItemDetailReadModelMock.mockResolvedValue({})
    syncClearWorkItemPresenceMock.mockReset()
    syncHeartbeatWorkItemPresenceMock.mockReset()
    syncSendItemDescriptionMentionNotificationsMock.mockReset()
    syncUpdateWorkItemMock.mockReset()
    syncHeartbeatWorkItemPresenceMock.mockResolvedValue([])
    syncClearWorkItemPresenceMock.mockResolvedValue({ ok: true })
    syncUpdateWorkItemMock.mockResolvedValue({ ok: true })
    useScopedReadModelRefreshMock.mockReset()
    useScopedReadModelRefreshMock.mockReturnValue({
      error: null,
      hasLoadedOnce: true,
      refreshing: false,
    })
    seedState()
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  async function flushDeferredSidebarSections() {
    await act(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0)
      })
    })
  }

  it("keeps the work item detail read model subscribed", () => {
    render(<WorkItemDetailScreen itemId="item_1" />)

    expect(useScopedReadModelRefreshMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        scopeKeys: ["work-item-detail:item_1"],
      })
    )
  })

  it("shows the parent item in the top breadcrumb for child items", () => {
    const breadcrumb = renderWorkItemBreadcrumbAfterStatePatch(
      "item_2",
      (state) => ({
        workItems: state.workItems.map((item) =>
          item.id === "item_2" ? { ...item, parentId: "item_1" } : item
        ),
      })
    )

    expect(within(breadcrumb).getByText("PLA-2")).toBeInTheDocument()
    expect(
      within(breadcrumb).getByRole("link", { name: "Plan launch" })
    ).toHaveAttribute("href", "/items/item_1")
    expect(within(breadcrumb).getByText("Follow up")).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("links private task breadcrumbs back to the private tasks view", () => {
    const breadcrumb = renderWorkItemBreadcrumbAfterStatePatch(
      "item_1",
      (state) => ({
        workItems: state.workItems.map((item) =>
          item.id === "item_1"
            ? {
                ...item,
                visibility: "private",
                creatorId: state.currentUserId,
              }
            : item
        ),
      })
    )

    expect(
      within(breadcrumb).getByRole("link", { name: "Private tasks" })
    ).toHaveAttribute("href", "/assigned?view=view_assigned_private_tasks")
  })

  it("shows a stale draft notice and reloads the latest main-section content", async () => {
    render(<WorkItemDetailScreen itemId="item_1" />)

    await openWorkItemEditor()
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

  it("edits the description without a PartyKit collaboration binding", async () => {
    render(<WorkItemDetailScreen itemId="item_1" />)
    await openWorkItemEditor()

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
  })

  it("consumes an explicit edit intent and enters edit state after claiming the lease", async () => {
    searchParamsState.value = "edit=1"

    render(<WorkItemDetailScreen itemId="item_1" />)

    await waitFor(() => {
      expect(screen.getByLabelText("Description editor")).toBeInTheDocument()
    })
    expect(routerReplaceMock).toHaveBeenCalledWith("/items/item_1")
    expect(syncHeartbeatWorkItemPresenceMock).toHaveBeenCalledWith(
      "item_1",
      expect.any(String),
      null,
      true
    )
  })

  it("does not rerender the description editor on every local description keystroke", async () => {
    renderWorkItemDetail()
    await openWorkItemEditor()
    richTextEditorRenderMock.mockClear()

    updateDescriptionEditor("<p>Draft one</p>")

    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled()

    const renderCountAfterDirtyTransition =
      richTextEditorRenderMock.mock.calls.length

    updateDescriptionEditor("<p>Draft two</p>")
    updateDescriptionEditor("<p>Draft three</p>")

    expect(richTextEditorRenderMock.mock.calls.length).toBe(
      renderCountAfterDirtyTransition
    )
  })

  it("does not rerender the description editor on every local title keystroke", async () => {
    renderWorkItemDetail()
    await openWorkItemEditor()
    richTextEditorRenderMock.mockClear()

    fireEvent.change(screen.getByDisplayValue("Plan launch"), {
      target: {
        value: "Plan launch draft one",
      },
    })

    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled()

    const renderCountAfterDirtyTransition =
      richTextEditorRenderMock.mock.calls.length

    fireEvent.change(screen.getByDisplayValue("Plan launch draft one"), {
      target: {
        value: "Plan launch draft two",
      },
    })
    fireEvent.change(screen.getByDisplayValue("Plan launch draft two"), {
      target: {
        value: "Plan launch draft three",
      },
    })

    expect(richTextEditorRenderMock.mock.calls.length).toBe(
      renderCountAfterDirtyTransition
    )
  })

  it("saves the latest description draft after suppressing repeated editor rerenders", async () => {
    const saveWorkItemMainSectionMock = vi.fn().mockResolvedValue(true)
    setSaveWorkItemMainSectionMock(saveWorkItemMainSectionMock)

    renderWorkItemDetail()
    await openWorkItemEditor()

    updateDescriptionEditor("<p>Draft one</p>")
    updateDescriptionEditor("<p>Draft two</p>")
    clickSaveButton()

    expect(saveWorkItemMainSectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "<p>Draft two</p>",
      })
    )
  })

  it("saves attachment ids seen and then removed during the edit session", async () => {
    const saveWorkItemMainSectionMock = vi.fn().mockResolvedValue(true)
    setSaveWorkItemMainSectionMock(saveWorkItemMainSectionMock)

    renderWorkItemDetail()
    await openWorkItemEditor()

    updateDescriptionEditor(
      '<p><img src="https://example.com/image.png" data-attachment-id="attachment_12345678"></p>'
    )
    updateDescriptionEditor("<p>Add a description…</p>")
    clickSaveButton()

    expect(saveWorkItemMainSectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        removedAttachmentIds: ["attachment_12345678"],
      })
    )
  })

  it("saves the latest title draft after suppressing repeated editor rerenders", async () => {
    const saveWorkItemMainSectionMock = vi.fn().mockResolvedValue(true)
    setSaveWorkItemMainSectionMock(saveWorkItemMainSectionMock)

    renderWorkItemDetail()
    await openWorkItemEditor()

    fireEvent.change(screen.getByDisplayValue("Plan launch"), {
      target: {
        value: "Plan launch draft one",
      },
    })
    fireEvent.change(screen.getByDisplayValue("Plan launch draft one"), {
      target: {
        value: "Plan launch draft two",
      },
    })
    clickSaveButton()

    expect(saveWorkItemMainSectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Plan launch draft two",
      })
    )
  })

  it("passes access-filtered reference candidates to description and comment editors", async () => {
    useAppStore.setState((state) => ({
      ...state,
      teams: [
        ...state.teams,
        createTestTeam({
          id: "team_2",
          slug: "design",
          name: "Design",
        }),
      ],
      documents: [
        ...state.documents,
        createTestDocument({
          id: "document_reference",
          kind: "team-document",
          teamId: "team_1",
          title: "Reference doc",
        }),
        createTestDocument({
          id: "document_private",
          kind: "private-document",
          teamId: null,
          title: "Private doc",
        }),
        createTestDocument({
          id: "document_hidden",
          kind: "team-document",
          teamId: "team_2",
          title: "Hidden doc",
        }),
      ],
      workItems: [
        ...state.workItems,
        createTestWorkItem("item_3", {
          key: "PLA-3",
          title: "Visible task",
        }),
        createTestWorkItem("item_hidden", {
          key: "DES-1",
          teamId: "team_2",
          title: "Hidden task",
        }),
        createTestWorkItem("item_private", {
          key: "PRI-1",
          teamId: null,
          workspaceId: "workspace_1",
          visibility: "private",
          title: "Private task",
        }),
      ],
      projects: [
        createTestProject({
          id: "project_reference",
          scopeType: "team",
          scopeId: "team_1",
          name: "Reference project",
        }),
        createTestProject({
          id: "project_hidden",
          scopeType: "team",
          scopeId: "team_2",
          name: "Hidden project",
        }),
      ],
      views: [
        createTestViewDefinition({
          id: "view_reference",
          scopeType: "team",
          scopeId: "team_1",
          name: "Reference view",
        }),
        createTestViewDefinition({
          id: "view_hidden",
          scopeType: "team",
          scopeId: "team_2",
          name: "Hidden view",
        }),
      ],
    }))

    renderWorkItemDetail()

    await waitFor(() => {
      expect(richTextEditorRenderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          placeholder: "Leave a comment or mention a teammate with @handle…",
        })
      )
    })

    const commentCall = richTextEditorRenderMock.mock.calls.find(
      ([props]) =>
        props.placeholder ===
        "Leave a comment or mention a teammate with @handle…"
    )?.[0]

    expect(
      commentCall?.referenceCandidates.map(
        (candidate: { type: string; id: string }) =>
          `${candidate.type}:${candidate.id}`
      )
    ).toEqual([
      "document:document_reference",
      "project:project_reference",
      "view:view_reference",
      "workItem:item_2",
      "workItem:item_1",
      "workItem:item_3",
    ])

    await openWorkItemEditor()

    await waitFor(() => {
      expect(richTextEditorRenderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          placeholder: "Add a description…",
        })
      )
    })

    const descriptionCall = richTextEditorRenderMock.mock.calls.find(
      ([props]) => props.placeholder === "Add a description…"
    )?.[0]

    expect(
      descriptionCall?.referenceCandidates.map(
        (candidate: { type: string; id: string }) =>
          `${candidate.type}:${candidate.id}`
      )
    ).toEqual([
      "document:document_reference",
      "project:project_reference",
      "view:view_reference",
      "workItem:item_2",
      "workItem:item_3",
    ])
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
        editing: true,
        lastSeenAt: "2026-04-18T10:01:00.000Z",
      },
    ])

    render(<WorkItemDetailScreen itemId="item_1" />)

    expect(await screen.findByText("Taylor")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Editing..." })).toBeDisabled()
  })

  it(
    "closes edit mode even when mention delivery fails after save",
    async () => {
      const saveWorkItemMainSectionMock = vi.fn().mockResolvedValue(true)
      syncSendItemDescriptionMentionNotificationsMock.mockRejectedValue(
        new Error("Saved changes but failed to notify mentions")
      )
      setSaveWorkItemMainSectionMock(saveWorkItemMainSectionMock)

      renderWorkItemDetail()
      await openWorkItemEditor()
      updateDescriptionEditor(TAYLOR_MENTION_DESCRIPTION)
      clickSaveButton()

      expect(saveWorkItemMainSectionMock).toHaveBeenCalled()
      await expectWorkItemEditorClosed()
      expect(screen.queryByRole("button", { name: "Save" })).toBeNull()
    },
    MENTION_DELIVERY_TEST_TIMEOUT_MS
  )

  it(
    "retries failed mention delivery on the next save without reintroducing the mention",
    async () => {
      setSaveWorkItemMainSectionMock(createStateUpdatingSaveMock())
      mockRetryingMentionDelivery()

      renderWorkItemDetail()

      await openWorkItemEditor()
      updateDescriptionEditor(TAYLOR_MENTION_DESCRIPTION)

      clickSaveButton()

      await expectWorkItemEditorClosed()

      await openWorkItemEditor()

      const saveButton = screen.getByRole("button", { name: "Save" })
      expect(saveButton).not.toBeDisabled()

      fireEvent.click(saveButton)

      await expectTaylorMentionDeliveryRetry()

      await openWorkItemEditor()
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    },
    MENTION_DELIVERY_TEST_TIMEOUT_MS
  )

  it(
    "preserves mention retries for one item when saving a different item without mentions",
    async () => {
      setSaveWorkItemMainSectionMock(
        createStateUpdatingSaveMock({
          getDocumentId: (itemId) =>
            itemId === "item_1" ? "document_1" : "document_2",
        })
      )
      mockRetryingMentionDelivery()

      const { rerender } = renderWorkItemDetail()

      await openWorkItemEditor()
      updateDescriptionEditor(TAYLOR_MENTION_DESCRIPTION)
      clickSaveButton()

      await expectWorkItemEditorClosed()

      rerender(<WorkItemDetailScreen itemId="item_2" />)

      await openWorkItemEditor()
      fireEvent.change(screen.getByDisplayValue("Follow up"), {
        target: { value: "Follow up updated" },
      })
      clickSaveButton()

      await expectWorkItemEditorClosed()

      rerender(<WorkItemDetailScreen itemId="item_1" />)

      await openWorkItemEditor()

      const saveButton = screen.getByRole("button", { name: "Save" })
      expect(saveButton).not.toBeDisabled()

      fireEvent.click(saveButton)

      await expectTaylorMentionDeliveryRetry()
    },
    MENTION_DELIVERY_TEST_TIMEOUT_MS
  )

  it(
    "sends self-mentions after saving the main section",
    async () => {
      const saveWorkItemMainSectionMock = vi.fn().mockResolvedValue(true)
      syncSendItemDescriptionMentionNotificationsMock.mockResolvedValue({
        recipientCount: 1,
        mentionCount: 1,
      })
      setSaveWorkItemMainSectionMock(saveWorkItemMainSectionMock)

      renderWorkItemDetail()

      await openWorkItemEditor()
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
    },
    MENTION_DELIVERY_TEST_TIMEOUT_MS
  )

  it(
    "clears mention retries when the server reports they were already delivered",
    async () => {
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

      await openWorkItemEditor()
      updateDescriptionEditor(TAYLOR_MENTION_DESCRIPTION)

      clickSaveButton()

      await expectWorkItemEditorClosed()

      await openWorkItemEditor()
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    },
    MENTION_DELIVERY_TEST_TIMEOUT_MS
  )

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

  it("copies hosted item links through the desktop clipboard bridge", async () => {
    const originalElectronApp = window.electronApp
    const writeClipboardText = vi.fn().mockResolvedValue(true)
    const { data, item } = getSeededWorkItemDetailSidebarFixture()

    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: {
        isElectron: true,
        platform: "darwin",
        writeClipboardText,
      },
    })
    window.history.pushState({}, "", "/items/item_1")

    try {
      render(
        <WorkItemDetailSidebarSurface data={data} currentItem={item} editable />
      )

      fireEvent.click(screen.getByRole("button", { name: "Copy item link" }))

      await waitFor(() =>
        expect(writeClipboardText).toHaveBeenCalledWith(
          "https://teams.reciperoom.io/items/item_1"
        )
      )
    } finally {
      Object.defineProperty(window, "electronApp", {
        configurable: true,
        value: originalElectronApp,
      })
      window.history.pushState({}, "", "/")
    }
  })

  it("paints sidebar properties before deferred activity sections", async () => {
    const { data, item } = getSeededWorkItemDetailSidebarFixture()

    render(
      <WorkItemDetailSidebarSurface data={data} currentItem={item} editable />
    )

    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument()
    expect(screen.queryByText("Activity")).not.toBeInTheDocument()

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    await waitFor(() =>
      expect(screen.getByText("Activity")).toBeInTheDocument()
    )
  })

  it("keeps sidebar activity comments read-only", async () => {
    const commentedAt = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    const data = createWorkItemDetailTestData({
      comments: [
        {
          id: "comment_1",
          targetType: "workItem",
          targetId: "item_1",
          parentCommentId: null,
          content: "<p>Following up</p>",
          mentionUserIds: [],
          reactions: [],
          createdBy: "user_1",
          createdAt: commentedAt,
          editedAt: null,
        },
      ],
    })
    renderSidebarSurfaceForTestData(data)
    await flushDeferredSidebarSections()

    expect(richTextContentRenderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentDisplay: "inline",
        content: "<p>Following up</p>",
      })
    )
    expect(screen.queryByLabelText(/Leave a comment/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Comment" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Reply" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Edit comment" })
    ).not.toBeInTheDocument()
  })

  it("renders persisted work item status changes in activity", async () => {
    const data = createWorkItemDetailTestData({
      workItemActivities: [
        {
          id: "activity_1",
          itemId: "item_1",
          actorId: "user_1",
          type: "status-change",
          fromStatus: "todo",
          toStatus: "done",
          createdAt: "2026-04-20T22:20:00.000Z",
        },
      ],
    })
    renderSidebarSurfaceForTestData(data)

    await waitFor(() =>
      expect(
        screen.getByText("moved this item from To-Do to Done")
      ).toBeInTheDocument()
    )
  })

  it("uses persisted assignee activity time instead of the mutable item update time", async () => {
    const now = Date.now()
    const assignedAt = new Date(now - 8 * 60 * 60 * 1000).toISOString()
    const commentedAt = new Date(now - 3 * 60 * 1000).toISOString()
    const itemUpdatedAt = new Date(now - 2 * 60 * 1000).toISOString()
    const data = createWorkItemDetailTestData({
      comments: [
        {
          id: "comment_1",
          targetType: "workItem",
          targetId: "item_1",
          parentCommentId: null,
          content: "<p>Following up</p>",
          mentionUserIds: [],
          reactions: [],
          createdBy: "user_1",
          createdAt: commentedAt,
          editedAt: null,
        },
      ],
      workItems: [
        createTestWorkItem("item_1", {
          key: "PLA-1",
          title: "Plan launch",
          descriptionDocId: "document_1",
          assigneeId: "user_2",
          assigneeIds: ["user_2"],
          subscriberIds: [],
          updatedAt: itemUpdatedAt,
        }),
      ],
      workItemActivities: [
        {
          id: "activity_assignee",
          itemId: "item_1",
          actorId: "user_1",
          type: "assignee-change",
          fromAssigneeIds: [],
          toAssigneeIds: ["user_2"],
          createdAt: assignedAt,
        },
      ],
    })

    useAppStore.setState(data)
    renderWorkItemDetail("item_1")

    const assigneeBody = await screen.findByText("was assigned to this item")
    const assigneeEvent = assigneeBody.closest("div")

    expect(assigneeEvent).toHaveTextContent(/8 hours ago/)
    expect(assigneeEvent).not.toHaveTextContent(/2 minutes ago/)
  })

  it.each([
    ["Start", "startTime"],
    ["Due", "endTime"],
  ] as const)(
    "persists the account timezone when editing the %s time",
    (buttonName, timeField) => {
      act(() => {
        useAppStore.setState((state) => ({
          ...state,
          users: state.users.map((user) =>
            user.id === "user_1"
              ? {
                  ...user,
                  preferences: {
                    ...user.preferences,
                    timeZone: "Europe/London",
                  },
                }
              : user
          ),
          workItems: state.workItems.map((item) =>
            item.id === "item_1"
              ? {
                  ...item,
                  scheduleTimeZone: null,
                  startTime: null,
                  endTime: null,
                }
              : item
          ),
        }))
      })

      const data = useAppStore.getState()
      const item = data.workItems.find((entry) => entry.id === "item_1")

      if (!item) {
        throw new Error("Expected seeded work item")
      }

      render(
        <WorkItemDetailSidebarSurface data={data} currentItem={item} editable />
      )

      fireEvent.click(screen.getByRole("button", { name: buttonName }))

      const timeInput =
        document.querySelector<HTMLInputElement>('input[type="time"]')

      expect(timeInput).toBeTruthy()

      fireEvent.change(timeInput!, {
        target: {
          value: "15:00",
        },
      })

      const updatedItem = useAppStore
        .getState()
        .workItems.find((entry) => entry.id === "item_1")

      expect(updatedItem?.[timeField]).toBe("15:00")
      expect(updatedItem?.scheduleTimeZone).toBe("Europe/London")
      expect(syncUpdateWorkItemMock).toHaveBeenCalledWith(
        "user_1",
        "item_1",
        expect.objectContaining({
          [timeField]: "15:00",
          scheduleTimeZone: "Europe/London",
        })
      )
    }
  )

  it("hides assignee and project configuration for private tasks", () => {
    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        workItems: state.workItems.map((item) =>
          item.id === "item_1"
            ? {
                ...item,
                visibility: "private",
                creatorId: state.currentUserId,
                assigneeId: "user_1",
                primaryProjectId: "project_1",
              }
            : item
        ),
      }))
    })

    render(<WorkItemDetailScreen itemId="item_1" />)

    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Assignee" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Project" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Manage labels" })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Activity").length).toBeGreaterThan(0)
    expect(screen.queryByLabelText(/Leave a comment/i)).not.toBeInTheDocument()
  })

  it("omits relations and activity from floating item detail popovers", () => {
    const { data, item } = getSeededWorkItemDetailSidebarFixture()

    render(
      <WorkItemDetailSidebarSurface
        data={data}
        currentItem={item}
        editable
        variant="floating"
      />
    )

    expect(screen.getByText("Plan launch")).toBeInTheDocument()
    expect(screen.queryByText("Relations")).not.toBeInTheDocument()
    expect(screen.queryByText("Activity")).not.toBeInTheDocument()
  })

  it("keeps projects in properties and out of relations", async () => {
    const baseData = createWorkItemDetailTestData()
    const primaryProject = createTestProject({
      id: "project_primary",
      name: "Primary roadmap",
    })
    const referenceProject = createTestProject({
      id: "project_reference",
      name: "Reference project",
    })
    const referenceDocument = createTestDocument({
      id: "document_reference",
      kind: "team-document",
      title: "Reference doc",
      linkedWorkItemIds: ["item_1"],
    })
    const referenceItem = createTestWorkItem("item_reference", {
      key: "PLA-99",
      title: "Reference item",
    })
    const currentItem = {
      ...baseData.workItems[0]!,
      primaryProjectId: primaryProject.id,
      linkedProjectIds: [primaryProject.id, referenceProject.id],
      linkedDocumentIds: [referenceDocument.id],
      linkedWorkItemIds: [referenceItem.id],
    }
    const data = {
      ...baseData,
      projects: [primaryProject, referenceProject],
      documents: [...baseData.documents, referenceDocument],
      workItems: [
        ...baseData.workItems.map((item) =>
          item.id === currentItem.id ? currentItem : item
        ),
        referenceItem,
      ],
    }

    render(
      <WorkItemDetailSidebarSurface
        data={data}
        currentItem={currentItem}
        editable
      />
    )
    await flushDeferredSidebarSections()

    expect(screen.getByRole("button", { name: "Project" })).toBeInTheDocument()
    expect(screen.getByText("Primary roadmap")).toBeInTheDocument()

    const relationsTitle = await screen.findByText("Relations")
    const relations = relationsTitle.closest("section")

    expect(relations).not.toBeNull()

    const relationQueries = within(relations!)

    expect(
      relationQueries.queryByText("Primary roadmap")
    ).not.toBeInTheDocument()
    expect(
      relationQueries.queryByText("Reference project")
    ).not.toBeInTheDocument()
    expect(
      relationQueries.queryByText("Linked project")
    ).not.toBeInTheDocument()
    expect(relationQueries.getByText("Reference doc")).toBeInTheDocument()
    expect(relationQueries.getByText("Reference item")).toBeInTheDocument()
  })

  it("does not render relations when the only project is the primary property", async () => {
    const baseData = createWorkItemDetailTestData()
    const primaryProject = createTestProject({
      id: "project_primary",
      name: "Primary roadmap",
    })
    const currentItem = {
      ...baseData.workItems[0]!,
      primaryProjectId: primaryProject.id,
      linkedProjectIds: [primaryProject.id],
    }
    const data = {
      ...baseData,
      projects: [primaryProject],
      workItems: baseData.workItems.map((item) =>
        item.id === currentItem.id ? currentItem : item
      ),
    }

    render(
      <WorkItemDetailSidebarSurface
        data={data}
        currentItem={currentItem}
        editable
      />
    )

    expect(screen.getByRole("button", { name: "Project" })).toBeInTheDocument()
    expect(screen.getByText("Primary roadmap")).toBeInTheDocument()

    await waitFor(() =>
      expect(screen.getByText("Activity")).toBeInTheDocument()
    )

    expect(screen.queryByText("Relations")).not.toBeInTheDocument()
  })

  it("contains sidebar property popovers inside the work item surface", async () => {
    const { data, item } = getSeededWorkItemDetailSidebarFixture()
    const { container } = render(
      <WorkItemDetailSidebarSurface data={data} currentItem={item} editable />
    )
    const surface = container.querySelector("[data-work-item-surface='true']")

    expect(surface).toBeInstanceOf(HTMLElement)

    fireEvent.click(
      within(surface as HTMLElement).getByRole("button", {
        name: "Status",
      })
    )

    await waitFor(() => {
      const popover = (surface as HTMLElement).querySelector(
        "[data-slot='popover-content']"
      )

      expect(popover).toBeInstanceOf(HTMLElement)
      expect(surface).toContainElement(popover as HTMLElement)
    })
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

  it("collapses the sidebar subtask list", () => {
    addChildWorkItems([
      {
        id: "item_3",
        key: "PLA-3",
        title: "Child item",
      },
    ])
    const { data, item } = getSeededWorkItemDetailSidebarFixture()

    render(
      <WorkItemDetailSidebarSurface data={data} currentItem={item} editable />
    )

    const subtasksToggle = screen.getByRole("button", { name: /Sub-tasks/ })

    expect(subtasksToggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Child item")).toBeInTheDocument()

    fireEvent.click(subtasksToggle)

    expect(subtasksToggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Child item")).not.toBeInTheDocument()
  })

  it("shows subtask grouping and filtering only on the detail surface", () => {
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

    const surfaceQueries = getSubtaskSurfaceQueries()

    expect(
      surfaceQueries.getByRole("button", { name: "Filter" })
    ).toBeInTheDocument()
    expect(
      surfaceQueries.getByRole("button", { name: /^Group$/ })
    ).toBeInTheDocument()

    fireEvent.click(surfaceQueries.getByRole("button", { name: /^Group$/ }))

    expect(screen.getByText("Group by")).toBeInTheDocument()
    expect(screen.queryByText("Sub-group")).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: "Status" }).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole("button", { name: "Assignee" }).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole("button", { name: "Priority" }).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole("button", { name: "Label" }).length
    ).toBeGreaterThan(0)

    fireEvent.click(surfaceQueries.getByRole("button", { name: "Filter" }))
    const doneFilterOption = screen
      .getAllByRole("button", { name: "Done" })
      .at(-1)
    expect(doneFilterOption).toBeDefined()
    fireEvent.click(doneFilterOption!)

    expect(surfaceQueries.getByText("Child done")).toBeInTheDocument()
    expect(surfaceQueries.queryByText("Child todo")).not.toBeInTheDocument()
  })

  it("renders selected label properties on detail sub-items", () => {
    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        labels: [
          ...state.labels,
          {
            id: "label_customer",
            workspaceId: "workspace_1",
            name: "Customer",
            color: "#ff0000",
            scopeType: "workspace",
            ownerId: null,
          },
        ],
        ui: {
          ...state.ui,
          viewerViewConfigByRoute: {
            ...state.ui.viewerViewConfigByRoute,
            "user_1::work-detail%3Asubitems::work-detail-subitems": {
              displayProps: ["labels"],
            },
          },
        },
      }))
    })
    addChildWorkItems([
      {
        id: "item_3",
        key: "PLA-3",
        title: "Child labelled",
        labelIds: ["label_customer"],
      },
    ])

    render(<WorkItemDetailScreen itemId="item_1" />)

    const surfaceQueries = getSubtaskSurfaceQueries()
    expect(surfaceQueries.getByText("Customer")).toBeInTheDocument()
    expect(surfaceQueries.getByTestId("label-color-dot")).toBeInTheDocument()
  })

  it("renders every built-in item property selected for detail sub-items", () => {
    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        milestones: [
          ...state.milestones,
          {
            id: "milestone_1",
            projectId: "project_1",
            name: "Sprint 1",
            targetDate: null,
            status: "todo",
          },
        ],
        ui: {
          ...state.ui,
          viewerViewConfigByRoute: {
            ...state.ui.viewerViewConfigByRoute,
            "user_1::work-detail%3Asubitems::work-detail-subitems": {
              displayProps: [
                "type",
                "status",
                "priority",
                "progress",
                "parent",
                "dueDate",
                "milestone",
                "created",
                "updated",
              ],
            },
          },
        },
      }))
    })
    addChildWorkItems([
      {
        id: "item_3",
        key: "PLA-3",
        title: "Child with metadata",
        dueDate: "2026-04-22",
        milestoneId: "milestone_1",
      },
    ])
    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        workItems: [
          ...state.workItems,
          createTestWorkItem("item_4", {
            key: "PLA-4",
            type: "sub-task",
            title: "Nested done",
            parentId: "item_3",
            status: "done",
            subscriberIds: [],
          }),
        ],
      }))
    })

    render(<WorkItemDetailScreen itemId="item_1" />)

    const surfaceQueries = getSubtaskSurfaceQueries()

    expect(surfaceQueries.getByText("Task")).toBeInTheDocument()
    expect(surfaceQueries.getByText("Medium")).toBeInTheDocument()
    expect(surfaceQueries.getByText("100%")).toBeInTheDocument()
    expect(surfaceQueries.getByText("PLA-1 · Plan launch")).toBeInTheDocument()
    expect(surfaceQueries.getByText("Apr 22")).toBeInTheDocument()
    expect(surfaceQueries.getByText("Sprint 1")).toBeInTheDocument()
    expect(surfaceQueries.getByText(/^Created /)).toBeInTheDocument()
    expect(surfaceQueries.getByText(/^Updated /)).toBeInTheDocument()
  })

  it("hides subtask view actions in the sidebar", () => {
    const { data, item } = getSeededWorkItemDetailSidebarFixture()

    render(
      <WorkItemDetailSidebarSurface data={data} currentItem={item} editable />
    )

    expect(
      screen.queryByRole("button", { name: "Filter" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Group$/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Add sub-task" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Properties/ })
    ).not.toBeInTheDocument()
  })

  it("creates private custom properties from the private task sidebar", async () => {
    const createCustomPropertyDefinitionMock = vi.fn().mockResolvedValue({
      id: "property_private",
    })
    const data = createTestAppData({
      workItems: [
        createTestWorkItem("private_item", {
          key: "PRIVATE-1",
          teamId: null,
          workspaceId: "workspace_1",
          visibility: "private",
          creatorId: "user_1",
        }),
      ],
    })
    const item = data.workItems[0]

    useAppStore.setState({
      ...data,
      createCustomPropertyDefinition: createCustomPropertyDefinitionMock,
    } as Partial<ReturnType<typeof useAppStore.getState>>)

    render(
      <WorkItemDetailSidebarSurface data={data} currentItem={item} editable />
    )

    fireEvent.click(screen.getByRole("button", { name: "Add property" }))
    fireEvent.change(screen.getByPlaceholderText("Property name"), {
      target: {
        value: "Focus",
      },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create property" }))

    await waitFor(() => {
      expect(createCustomPropertyDefinitionMock).toHaveBeenCalledWith({
        scopeType: "private",
        workspaceId: "workspace_1",
        targetType: "workItem",
        name: "Focus",
        icon: "TextAa",
        type: "text",
        options: [],
      })
    })
  })

  it("uses the child type label for the sidebar child section", () => {
    const data = createTestAppData({
      teams: [
        createTestTeam({
          settings: {
            experience: "software-development",
          },
        }),
      ],
      workItems: [
        createTestWorkItem("item_1", {
          key: "PLA-1",
          type: "issue",
          title: "Parent issue",
        }),
        createTestWorkItem("item_2", {
          key: "PLA-2",
          type: "sub-issue",
          title: "Child issue",
          parentId: "item_1",
        }),
      ],
    })
    const item = data.workItems.find((entry) => entry.id === "item_1")

    render(
      <WorkItemDetailSidebarSurface data={data} currentItem={item!} editable />
    )

    expect(
      screen.getByRole("button", { name: /Sub-issues/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Sub-tasks/ })
    ).not.toBeInTheDocument()
  })

  it("toggles the child composer from the detail surface", () => {
    render(<WorkItemDetailScreen itemId="item_1" />)

    const addButtons = screen.getAllByRole("button", { name: "Add sub-task" })
    expect(addButtons).toHaveLength(2)
    expect(screen.queryByText("Add sub-task")).not.toBeInTheDocument()

    fireEvent.click(addButtons[0]!)
    expect(screen.getAllByTestId("inline-child-composer")).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "Add sub-task" }))
    expect(
      screen.queryByTestId("inline-child-composer")
    ).not.toBeInTheDocument()
  })

  it("keeps activity comment submit disabled until the shared minimum plain-text length is met", async () => {
    render(<WorkItemDetailScreen itemId="item_1" />)

    const commentEditors = await screen.findAllByLabelText(
      /Leave a comment or mention a teammate with @handle/
    )
    const commentButtons = screen.getAllByRole("button", { name: "Comment" })
    const commentEditor = commentEditors[0]
    const commentButton = commentButtons[0]

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

    act(() => {
      fireEvent.change(commentEditor!, {
        target: {
          value: "ab",
        },
      })
    })

    expect(commentButton!).toBeEnabled()
  })

  it("posts activity comments on Enter and preserves mentions", async () => {
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

    const commentEditor = await screen.findByLabelText(
      /Leave a comment or mention a teammate with @handle/
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

    await waitFor(() => {
      expect(useAppStore.getState().comments[0]).toMatchObject({
        targetType: "workItem",
        targetId: "item_1",
        mentionUserIds: ["user_2"],
      })
    })
    const [comment] = useAppStore.getState().comments

    expect(comment.content).toContain('data-id="user_2"')
  })
})

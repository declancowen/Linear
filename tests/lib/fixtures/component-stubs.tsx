import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react"
import { createContext, useContext, useState } from "react"
import { vi } from "vitest"

export function LinkStub({
  children,
  href,
  ...props
}: {
  children: ReactNode
  href: string
}) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  )
}

export function ButtonStub({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props}>
      {children}
    </button>
  )
}

export function InputStub(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />
}

export function ChildrenDivStub({ children }: { children?: ReactNode }) {
  return <div>{children}</div>
}

export function ChildrenFragmentStub({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export function SidebarTriggerStub(
  props: ButtonHTMLAttributes<HTMLButtonElement>
) {
  return (
    <button type="button" {...props}>
      Sidebar
    </button>
  )
}

export function MissingStateStub({ title }: { title: string }) {
  return <div>{title}</div>
}

export function DocumentPresenceAvatarGroupStub({
  viewers,
}: {
  viewers: Array<{ name: string }>
}) {
  return <div>{viewers.map((viewer) => viewer.name).join(",")}</div>
}

export function createRichTextContentStub(
  renderMock: (props: { content: string | Record<string, unknown> }) => void
) {
  return function RichTextContentStub(props: {
    content: string | Record<string, unknown>
  }) {
    renderMock(props)
    return <div data-testid="rich-text-content" />
  }
}

export function RichTextEditorTextareaStub({
  content,
  onChange,
  placeholder,
}: {
  content: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <textarea
      aria-label={placeholder ?? "Rich text editor"}
      value={content}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function createNextLinkStubModule() {
  return {
    default: LinkStub,
  }
}

export function createNextNavigationPushStubModule() {
  return {
    useRouter: () => ({
      push: vi.fn(),
    }),
  }
}

export function createToastStubModule() {
  return {
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
  }
}

export function createRichTextEditorTextareaStubModule() {
  return {
    RichTextEditor: RichTextEditorTextareaStub,
  }
}

export function createEmojiPickerPopoverStubModule() {
  return {
    EmojiPickerPopover: ({ trigger }: { trigger: ReactNode }) => trigger,
  }
}

export function createShortcutKeysStubModule() {
  return {
    ShortcutKeys: () => null,
    useShortcutModifierLabel: () => "Cmd",
  }
}

export function createButtonStubModule() {
  return {
    Button: ButtonStub,
  }
}

export function createConfirmDialogStubModule() {
  return {
    ConfirmDialog: () => null,
  }
}

export function createDropdownMenuStubModule({
  triggerAsDiv = false,
}: {
  triggerAsDiv?: boolean
} = {}) {
  return {
    DropdownMenu: ChildrenDivStub,
    DropdownMenuContent: ChildrenDivStub,
    DropdownMenuItem: ButtonStub,
    DropdownMenuTrigger: triggerAsDiv ? ChildrenDivStub : ChildrenFragmentStub,
  }
}

export function createSelectableMenuStubModule(prefix: "ContextMenu" | "DropdownMenu") {
  const MenuContext = createContext<{
    close: () => void
    open: boolean
  } | null>(null)

  function MenuRoot({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(true)

    return (
      <MenuContext.Provider
        value={{
          close: () => setOpen(false),
          open,
        }}
      >
        {children}
      </MenuContext.Provider>
    )
  }

  function MenuContent({ children }: { children: ReactNode }) {
    const context = useContext(MenuContext)
    return context?.open ? <div>{children}</div> : null
  }

  function MenuItem({
    children,
    onSelect,
  }: {
    children: ReactNode
    onSelect?: (event: Event) => void
  }) {
    const context = useContext(MenuContext)

    return (
      <button
        type="button"
        onClick={() => {
          let defaultPrevented = false
          onSelect?.({
            preventDefault() {
              defaultPrevented = true
            },
            stopPropagation() {},
          } as Event)
          if (!defaultPrevented) {
            context?.close()
          }
        }}
      >
        {children}
      </button>
    )
  }

  return {
    [prefix]: MenuRoot,
    [`${prefix}Content`]: MenuContent,
    [`${prefix}Item`]: MenuItem,
    [`${prefix}Label`]: ChildrenDivStub,
    [`${prefix}Separator`]: () => null,
    [`${prefix}Sub`]: ChildrenDivStub,
    [`${prefix}SubContent`]: ChildrenDivStub,
    [`${prefix}SubTrigger`]: ChildrenDivStub,
    [`${prefix}Trigger`]: ChildrenFragmentStub,
  }
}

export function createInputStubModule() {
  return {
    Input: InputStub,
  }
}

export function createSidebarTriggerStubModule() {
  return {
    SidebarTrigger: SidebarTriggerStub,
  }
}

export function createTemplatePrimitivesStubModule() {
  return {
    IconButton: ButtonStub,
    Topbar: ChildrenDivStub,
    Viewbar: ChildrenDivStub,
  }
}

export function createScrollAreaStubModule() {
  return {
    ScrollArea: ChildrenDivStub,
    ScrollBar: () => null,
  }
}

export function createSheetStubModule() {
  return {
    Sheet: ChildrenDivStub,
    SheetContent: ChildrenDivStub,
    SheetDescription: ChildrenDivStub,
    SheetHeader: ChildrenDivStub,
    SheetTitle: ChildrenDivStub,
  }
}

export function createSearchParamsPushNavigationStubModule() {
  return {
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({
      push: vi.fn(),
    }),
  }
}

export function createOpenManagedDialogStubModule() {
  return {
    openManagedCreateDialog: vi.fn(),
  }
}

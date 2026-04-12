"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  EditorContent,
  type Editor,
  type JSONContent,
  useEditor,
} from "@tiptap/react"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import Underline from "@tiptap/extension-underline"
import StarterKit from "@tiptap/starter-kit"
import {
  LinkSimple,
  ListBullets,
  ListChecks,
  Paperclip,
  Quotes,
  TextB,
  TextHOne,
  TextItalic,
  TextUnderline,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

type UploadedAttachment = {
  fileName: string
  fileUrl: string | null
}

type RichTextEditorProps = {
  content: string | JSONContent
  onChange: (content: string) => void
  editable?: boolean
  placeholder?: string
  className?: string
  compact?: boolean
  /** Full-page canvas mode — no borders, large content area */
  fullPage?: boolean
  onUploadAttachment?: (file: File) => Promise<UploadedAttachment | null>
}

type SlashState = {
  from: number
  to: number
  query: string
  top: number
  left: number
}

type SlashCommand = {
  id: string
  label: string
  description: string
  keywords: string[]
  run: (editor: Editor) => void
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function buildSlashState(
  editor: Editor,
  container: HTMLDivElement | null
): SlashState | null {
  const { state, view } = editor

  if (!state.selection.empty) {
    return null
  }

  const { $from, from } = state.selection

  if (!$from.parent.isTextblock) {
    return null
  }

  const textBefore = state.doc.textBetween($from.start(), from, "\n", "\0")
  const match = textBefore.match(/^\/([\w\s-]*)$/)

  if (!match) {
    return null
  }

  const coords = view.coordsAtPos(from)
  const containerRect = container?.getBoundingClientRect()

  return {
    from: from - textBefore.length,
    to: from,
    query: match[1]?.trim().toLowerCase() ?? "",
    top: containerRect ? coords.bottom - containerRect.top + 8 : 12,
    left: containerRect ? coords.left - containerRect.left : 12,
  }
}

function filterSlashCommands(
  query: string,
  promptAttachmentUpload: () => void
) {
  return getSlashCommands(promptAttachmentUpload).filter((command) => {
    const haystack = [command.label, command.description, ...command.keywords]
      .join(" ")
      .toLowerCase()

    return haystack.includes(query)
  })
}

export function RichTextEditor({
  content,
  onChange,
  editable = true,
  placeholder = "Add a description…",
  className,
  compact = false,
  fullPage = false,
  onUploadAttachment,
}: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hiddenFileInputRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const pendingFileInsertRef = useRef(false)
  const previousSlashQueryRef = useRef<string | null>(null)

  const [slashState, setSlashState] = useState<SlashState | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [attachmentPickerRequest, setAttachmentPickerRequest] = useState(0)

  function requestAttachmentPicker() {
    setAttachmentPickerRequest((current) => current + 1)
  }

  function syncSlashState(nextSlashState: SlashState | null) {
    const nextQuery = nextSlashState?.query ?? null

    setSlashState(nextSlashState)

    if (previousSlashQueryRef.current !== nextQuery) {
      previousSlashQueryRef.current = nextQuery
      setSlashIndex(0)
    }
  }

  // Build editor class based on mode
  const editorClass = fullPage
    ? "min-h-[calc(100svh-12rem)] max-w-3xl mx-auto w-full px-6 py-4 text-base outline-none [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:leading-7 [&_p+p]:mt-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
    : "min-h-24 text-sm outline-none [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:leading-7 [&_p+p]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: editorClass,
      },
      handleKeyDown(view, event) {
        const currentEditor = editorRef.current
        const currentSlashState = slashState

        if (!currentEditor || !currentSlashState) {
          return false
        }

        if (event.key === "Escape") {
          setSlashState(null)
          return true
        }

        if (event.key === "ArrowDown") {
          event.preventDefault()
          setSlashIndex((current) => current + 1)
          return true
        }

        if (event.key === "ArrowUp") {
          event.preventDefault()
          setSlashIndex((current) => Math.max(0, current - 1))
          return true
        }

        if (event.key === "Enter") {
          const nextCommands = filterSlashCommands(
            currentSlashState.query,
            requestAttachmentPicker
          )

          const selected =
            nextCommands[Math.min(slashIndex, nextCommands.length - 1)] ??
            nextCommands[0]

          if (!selected) {
            return false
          }

          event.preventDefault()
          currentEditor
            .chain()
            .focus()
            .deleteRange({
              from: currentSlashState.from,
              to: currentSlashState.to,
            })
            .run()
          selected.run(currentEditor)
          setSlashState(null)
          setSlashIndex(0)
          return true
        }

        const nextSlashState = buildSlashState(currentEditor, containerRef.current)
        if (!nextSlashState) {
          setSlashState(null)
          setSlashIndex(0)
          previousSlashQueryRef.current = null
        }

        return false
      },
      handlePaste(_view, event) {
        const file = event.clipboardData?.files?.[0]

        if (!file || !onUploadAttachment) {
          return false
        }

        event.preventDefault()
        pendingFileInsertRef.current = true
        void handleAttachment(file)
        return true
      },
      handleDrop(_view, event) {
        const file = event.dataTransfer?.files?.[0]

        if (!file || !onUploadAttachment) {
          return false
        }

        event.preventDefault()
        pendingFileInsertRef.current = true
        void handleAttachment(file)
        return true
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(currentEditor.getHTML())
      syncSlashState(buildSlashState(currentEditor, containerRef.current))
    },
    onSelectionUpdate({ editor: currentEditor }) {
      syncSlashState(buildSlashState(currentEditor, containerRef.current))
    },
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    if (!editor) {
      return
    }

    const currentContent = editor.getHTML()

    if (typeof content !== "string") {
      return
    }

    if (currentContent === content) {
      return
    }

    // Ignore external content churn while the user is actively typing.
    // This prevents stale snapshot echoes from resetting the document.
    if (editor.isFocused) {
      return
    }

    if (currentContent !== content) {
      editor.commands.setContent(content, {
        emitUpdate: false,
      })
    }
  }, [content, editor])

  useEffect(() => {
    if (!editor) {
      return
    }

    editor.setEditable(editable)
  }, [editable, editor])

  useEffect(() => {
    if (attachmentPickerRequest === 0) {
      return
    }

    pendingFileInsertRef.current = true
    hiddenFileInputRef.current?.click()
  }, [attachmentPickerRequest])

  const filteredSlashCommands = useMemo(() => {
    if (!slashState || !editor) {
      return []
    }

    return filterSlashCommands(slashState.query, requestAttachmentPicker)
  }, [editor, slashState])

  async function handleAttachment(file: File | null) {
    if (!file || !onUploadAttachment) {
      return
    }

    setUploadingAttachment(true)
    const uploaded = await onUploadAttachment(file)
    setUploadingAttachment(false)

    if (
      uploaded?.fileUrl &&
      editorRef.current &&
      pendingFileInsertRef.current
    ) {
      editorRef.current
        .chain()
        .focus()
        .insertContent(
          `<p><a href="${escapeHtml(uploaded.fileUrl)}" target="_blank" rel="noreferrer">${escapeHtml(uploaded.fileName)}</a></p>`
        )
        .run()
    }

    pendingFileInsertRef.current = false

    if (hiddenFileInputRef.current) {
      hiddenFileInputRef.current.value = ""
    }
  }

  if (!editor) {
    return null
  }

  const currentEditor = editor
  const activeSlashIndex =
    filteredSlashCommands.length === 0
      ? 0
      : Math.min(slashIndex, filteredSlashCommands.length - 1)
  const slashMenuLeft = slashState
    ? Math.min(
        Math.max(12, slashState.left),
        Math.max(
          12,
          (containerRef.current?.clientWidth ?? 336) - 336
        )
      )
    : 12

  function setLink() {
    const existing = currentEditor.getAttributes("link").href as string | undefined
    const nextHref = window.prompt("Link URL", existing ?? "https://")

    if (!nextHref) {
      currentEditor.chain().focus().unsetLink().run()
      return
    }

    currentEditor.chain().focus().setLink({ href: nextHref }).run()
  }

  // Toolbar
  const toolbar = editable ? (
    <div className={cn(
      "flex items-center gap-0.5 shrink-0",
      fullPage ? "max-w-3xl mx-auto w-full px-6 py-2" : "pb-1"
    )}>
      <ToolbarButton
        active={currentEditor.isActive("bold")}
        onClick={() => currentEditor.chain().focus().toggleBold().run()}
        label="Bold"
      >
        <TextB className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={currentEditor.isActive("italic")}
        onClick={() => currentEditor.chain().focus().toggleItalic().run()}
        label="Italic"
      >
        <TextItalic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={currentEditor.isActive("underline")}
        onClick={() => currentEditor.chain().focus().toggleUnderline().run()}
        label="Underline"
      >
        <TextUnderline className="size-3.5" />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        active={currentEditor.isActive("heading", { level: 2 })}
        onClick={() => currentEditor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="Heading"
      >
        <TextHOne className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={currentEditor.isActive("bulletList")}
        onClick={() => currentEditor.chain().focus().toggleBulletList().run()}
        label="Bulleted list"
      >
        <ListBullets className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={currentEditor.isActive("taskList")}
        onClick={() => currentEditor.chain().focus().toggleTaskList().run()}
        label="Task list"
      >
        <ListChecks className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={currentEditor.isActive("blockquote")}
        onClick={() => currentEditor.chain().focus().toggleBlockquote().run()}
        label="Quote"
      >
        <Quotes className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={currentEditor.isActive("link")}
        onClick={setLink}
        label="Link"
      >
        <LinkSimple className="size-3.5" />
      </ToolbarButton>
      {onUploadAttachment ? (
        <>
          <input
            ref={hiddenFileInputRef}
            className="hidden"
            type="file"
            onChange={(event) => void handleAttachment(event.target.files?.[0] ?? null)}
          />
          <ToolbarButton
            active={false}
            onClick={() => {
              pendingFileInsertRef.current = true
              hiddenFileInputRef.current?.click()
            }}
            label="Attach file"
          >
            <Paperclip className="size-3.5" />
          </ToolbarButton>
        </>
      ) : null}
      {uploadingAttachment ? (
        <span className="ml-2 text-xs text-muted-foreground">Uploading…</span>
      ) : null}
    </div>
  ) : null

  const slashMenu = slashState ? (
    <div
      className="absolute z-10 w-80 max-w-[calc(100%-1.5rem)]"
      style={{
        left: slashMenuLeft,
        top: slashState.top,
      }}
    >
      <Command
        className="overflow-hidden rounded-2xl border border-border/70 bg-popover/95 p-0 shadow-[0_20px_65px_-30px_rgba(15,23,42,0.75)] backdrop-blur-xl"
        shouldFilter={false}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-muted/35 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Insert block
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {slashState.query
                ? `Matching “${slashState.query}”`
                : "Start with a heading, list, checklist, code block, or file."}
            </p>
          </div>
          <span className="rounded-full border border-border/70 bg-background/90 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {filteredSlashCommands.length}
          </span>
        </div>
        <CommandList>
          <CommandEmpty>
            <div className="px-4 py-6 text-sm text-muted-foreground">
              No slash commands match that search.
            </div>
          </CommandEmpty>
          <CommandGroup heading="Insert">
            {filteredSlashCommands.map((command, index) => (
              <CommandItem
                key={command.id}
                className={cn(
                  "items-start gap-3 rounded-none border-b border-border/50 px-3 py-3 last:border-b-0 data-[selected=true]:bg-accent/70 data-[selected=true]:text-accent-foreground",
                  index === activeSlashIndex &&
                    "bg-accent/70 text-accent-foreground"
                )}
                value={command.id}
                onSelect={() => {
                  currentEditor
                    .chain()
                    .focus()
                    .deleteRange({
                      from: slashState.from,
                      to: slashState.to,
                    })
                    .run()
                  command.run(currentEditor)
                  setSlashState(null)
                  setSlashIndex(0)
                  previousSlashQueryRef.current = null
                }}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{command.label}</span>
                    <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {command.keywords[0]}
                    </span>
                  </div>
                  <span className="text-xs leading-5 text-muted-foreground transition-colors group-data-selected/command-item:text-foreground/75">
                    {command.description}
                  </span>
                </div>
                <span className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground transition-colors group-data-selected/command-item:text-foreground/55">
                  Enter
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
          <span>Arrow keys to move</span>
          <span>Esc to close</span>
        </div>
      </Command>
    </div>
  ) : null

  // Full-page mode — used for standalone documents
  if (fullPage) {
    return (
      <div className={cn("flex flex-col flex-1 overflow-hidden", className)}>
        {toolbar}
        <div className="relative flex-1 overflow-y-auto" ref={containerRef}>
          <EditorContent editor={currentEditor} />
          {slashMenu}
        </div>
      </div>
    )
  }

  // Inline mode — used for issue descriptions (no card, no border, seamless)
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative" ref={containerRef}>
        <EditorContent editor={currentEditor} />
        {slashMenu}
      </div>
      {toolbar}
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex size-7 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={onClick}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

function getSlashCommands(promptAttachmentUpload: () => void): SlashCommand[] {
  return [
    {
      id: "heading-1",
      label: "Heading",
      description: "Convert the current block into a section heading.",
      keywords: ["title", "header", "section"],
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleHeading({ level: 1 }).run()
      },
    },
    {
      id: "bullet-list",
      label: "Bullet list",
      description: "Create a bulleted list for requirements or notes.",
      keywords: ["list", "bullets", "requirements"],
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleBulletList().run()
      },
    },
    {
      id: "task-list",
      label: "Checklist",
      description: "Insert a checklist for execution or success criteria.",
      keywords: ["tasks", "todo", "criteria"],
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleTaskList().run()
      },
    },
    {
      id: "quote",
      label: "Callout quote",
      description: "Drop in a quote block for decisions or constraints.",
      keywords: ["callout", "note", "constraint"],
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleBlockquote().run()
      },
    },
    {
      id: "code",
      label: "Code block",
      description: "Add a code block for implementation notes.",
      keywords: ["code", "snippet", "technical"],
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleCodeBlock().run()
      },
    },
    {
      id: "divider",
      label: "Divider",
      description: "Separate sections with a horizontal rule.",
      keywords: ["separator", "rule", "divider"],
      run: (currentEditor) => {
        currentEditor.chain().focus().setHorizontalRule().run()
      },
    },
    {
      id: "decision",
      label: "Decision block",
      description: "Insert a short decision template.",
      keywords: ["decision", "adr", "context"],
      run: (currentEditor) => {
        currentEditor
          .chain()
          .focus()
          .insertContent(
            "<h3>Decision</h3><p>Summarize the decision and the reason for it.</p><h3>Impact</h3><ul><li>What changes now?</li><li>Who is affected?</li></ul>"
          )
          .run()
      },
    },
    {
      id: "success-criteria",
      label: "Success criteria",
      description: "Insert a checklist template for acceptance criteria.",
      keywords: ["acceptance", "criteria", "done"],
      run: (currentEditor) => {
        currentEditor
          .chain()
          .focus()
          .insertContent(
            `<h3>Success criteria</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>Outcome one</p></div></li><li data-type="taskItem" data-checked="false"><div><p>Outcome two</p></div></li></ul>`
          )
          .run()
      },
    },
    {
      id: "attachment",
      label: "Upload attachment",
      description: "Store a file and insert a download link.",
      keywords: ["file", "upload", "attachment"],
      run: () => {
        promptAttachmentUpload()
      },
    },
  ]
}

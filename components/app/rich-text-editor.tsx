"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  EditorContent,
  type Editor,
  type JSONContent,
  useEditor,
} from "@tiptap/react"
import CharacterCount from "@tiptap/extension-character-count"
import FileHandler from "@tiptap/extension-file-handler"
import Highlight from "@tiptap/extension-highlight"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Mention from "@tiptap/extension-mention"
import Placeholder from "@tiptap/extension-placeholder"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import TextAlign from "@tiptap/extension-text-align"
import { TableKit } from "@tiptap/extension-table"
import Typography from "@tiptap/extension-typography"
import Underline from "@tiptap/extension-underline"
import StarterKit from "@tiptap/starter-kit"
import {
  CheckSquare,
  ColumnsPlusRight,
  Code,
  FileArrowUp,
  Highlighter,
  ImageSquare,
  Lightning,
  LinkSimple,
  ListBullets,
  ListChecks,
  Minus,
  Paragraph,
  Paperclip,
  Quotes,
  RowsPlusBottom,
  Table as TableIcon,
  TextHThree,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  TextB,
  TextHOne,
  TextHTwo,
  TextItalic,
  TextUnderline,
  Trash,
} from "@phosphor-icons/react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { UserProfile } from "@/lib/domain/types"
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
  showToolbar?: boolean
  autoFocus?: boolean
  onUploadAttachment?: (file: File) => Promise<UploadedAttachment | null>
  onSubmitShortcut?: () => void
  mentionCandidates?: Array<
    Pick<UserProfile, "id" | "name" | "handle" | "avatarUrl">
  >
}

type MenuState = {
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
  icon: React.ReactNode
  run: (editor: Editor) => void
}

type MentionCandidate = Pick<
  UserProfile,
  "id" | "name" | "handle" | "avatarUrl"
>

const DEFAULT_TABLE_OPTIONS = {
  rows: 3,
  cols: 3,
  withHeaderRow: true,
} as const

const EMPTY_MENTION_CANDIDATES: MentionCandidate[] = []

function insertDefaultTable(editor: Editor) {
  editor.chain().focus().insertTable(DEFAULT_TABLE_OPTIONS).run()
}

function insertMention(
  editor: Editor,
  range: { from: number; to: number },
  candidate: MentionCandidate
) {
  editor
    .chain()
    .focus()
    .insertContentAt(range, [
      {
        type: "mention",
        attrs: {
          id: candidate.id,
          label: candidate.handle,
          mentionSuggestionChar: "@",
        },
      },
      {
        type: "text",
        text: " ",
      },
    ])
    .run()
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
): MenuState | null {
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

  const slashStart = from - textBefore.length
  const menuAnchor = Math.max(slashStart + 1, 1)
  const coords = view.coordsAtPos(menuAnchor)
  const containerRect = container?.getBoundingClientRect()

  return {
    from: slashStart,
    to: from,
    query: match[1]?.trim().toLowerCase() ?? "",
    top: containerRect ? coords.bottom - containerRect.top + 8 : 12,
    left: containerRect ? coords.left - containerRect.left + 8 : 12,
  }
}

function buildMentionState(
  editor: Editor,
  container: HTMLDivElement | null
): MenuState | null {
  const { state, view } = editor

  if (!state.selection.empty) {
    return null
  }

  const { $from, from } = state.selection

  if (!$from.parent.isTextblock) {
    return null
  }

  const textBefore = state.doc.textBetween($from.start(), from, "\n", "\0")
  const match = textBefore.match(/(^|\s)@([a-z0-9_-]*)$/i)

  if (!match) {
    return null
  }

  const query = match[2] ?? ""
  const mentionText = `@${query}`
  const mentionStart = from - mentionText.length
  const menuAnchor = Math.max(mentionStart + 1, 1)
  const coords = view.coordsAtPos(menuAnchor)
  const containerRect = container?.getBoundingClientRect()

  return {
    from: mentionStart,
    to: from,
    query: query.trim().toLowerCase(),
    top: containerRect ? coords.bottom - containerRect.top + 8 : 12,
    left: containerRect ? coords.left - containerRect.left + 8 : 12,
  }
}

function filterSlashCommands(
  query: string,
  options: {
    enableUploads: boolean
    promptAttachmentUpload: (editor: Editor) => void
    promptImageUpload: (editor: Editor) => void
  }
) {
  return getSlashCommands(options).filter((command) => {
    const haystack = [command.label, command.description, ...command.keywords]
      .join(" ")
      .toLowerCase()

    return haystack.includes(query)
  })
}

function filterMentionCandidates(
  query: string,
  candidates: MentionCandidate[]
) {
  const normalizedQuery = query.trim().toLowerCase()

  return [...candidates]
    .filter((candidate) => {
      if (!normalizedQuery) {
        return true
      }

      return (
        candidate.handle.toLowerCase().includes(normalizedQuery) ||
        candidate.name.toLowerCase().includes(normalizedQuery)
      )
    })
    .sort((left, right) => {
      const leftHandleStarts = left.handle
        .toLowerCase()
        .startsWith(normalizedQuery)
      const rightHandleStarts = right.handle
        .toLowerCase()
        .startsWith(normalizedQuery)

      if (leftHandleStarts !== rightHandleStarts) {
        return leftHandleStarts ? -1 : 1
      }

      return left.name.localeCompare(right.name)
    })
    .slice(0, 8)
}

export function RichTextEditor({
  content,
  onChange,
  editable = true,
  placeholder = "Add a description…",
  className,
  compact = false,
  fullPage = false,
  showToolbar = true,
  autoFocus = false,
  onUploadAttachment,
  onSubmitShortcut,
  mentionCandidates = EMPTY_MENTION_CANDIDATES,
}: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hiddenAttachmentInputRef = useRef<HTMLInputElement | null>(null)
  const hiddenImageInputRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const previousSlashQueryRef = useRef<string | null>(null)
  const previousMentionQueryRef = useRef<string | null>(null)

  const [slashState, setSlashState] = useState<MenuState | null>(null)
  const [mentionState, setMentionState] = useState<MenuState | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [attachmentPickerRequest, setAttachmentPickerRequest] = useState(0)
  const [imagePickerRequest, setImagePickerRequest] = useState(0)
  const [pickerInsertPosition, setPickerInsertPosition] = useState<
    number | null
  >(null)
  const [containerWidth, setContainerWidth] = useState(256)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const updateWidth = () => {
      setContainerWidth(container.clientWidth || 256)
    }

    updateWidth()

    if (typeof ResizeObserver === "undefined") {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      updateWidth()
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [fullPage])

  function requestAttachmentPicker(currentEditor: Editor) {
    setPickerInsertPosition(currentEditor.state.selection.from)
    setAttachmentPickerRequest((current) => current + 1)
  }

  function requestImagePicker(currentEditor: Editor) {
    setPickerInsertPosition(currentEditor.state.selection.from)
    setImagePickerRequest((current) => current + 1)
  }

  function syncSlashState(nextSlashState: MenuState | null) {
    const nextQuery = nextSlashState?.query ?? null

    setSlashState(nextSlashState)

    if (previousSlashQueryRef.current !== nextQuery) {
      previousSlashQueryRef.current = nextQuery
      setSlashIndex(0)
    }
  }

  function syncMentionState(nextMentionState: MenuState | null) {
    const nextQuery = nextMentionState?.query ?? null

    setMentionState(nextMentionState)

    if (previousMentionQueryRef.current !== nextQuery) {
      previousMentionQueryRef.current = nextQuery
      setMentionIndex(0)
    }
  }

  function syncCommandMenus(currentEditor: Editor) {
    syncSlashState(buildSlashState(currentEditor, containerRef.current))
    syncMentionState(buildMentionState(currentEditor, containerRef.current))
  }

  // Build editor class based on mode
  const editorClass = fullPage
    ? "min-h-[calc(100svh-12rem)] max-w-3xl mx-auto w-full px-6 py-4 text-base outline-none [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:leading-7 [&_p+p]:mt-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
    : compact
      ? "min-h-16 text-sm outline-none [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:leading-6 [&_p+p]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
      : "min-h-24 text-sm outline-none [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:leading-7 [&_p+p]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TableKit.configure({
        table: {
          resizable: true,
          HTMLAttributes: {
            class: "editor-table",
          },
        },
      }),
      CharacterCount,
      FileHandler.configure({
        onPaste(currentEditor, files) {
          void handleFiles(files, currentEditor.state.selection.from)
        },
        onDrop(currentEditor, files, position) {
          void handleFiles(files, position)
        },
      }),
      Highlight.configure({
        HTMLAttributes: {
          class: "editor-highlight",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "editor-image",
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "editor-mention",
        },
        deleteTriggerWithBackspace: true,
        renderText({ node, suggestion }) {
          const label = node.attrs.label ?? node.attrs.id ?? ""
          return `${suggestion?.char ?? "@"}${label}`
        },
        renderHTML({ options, node, suggestion }) {
          const label = node.attrs.label ?? node.attrs.id ?? ""

          return [
            "span",
            options.HTMLAttributes,
            `${suggestion?.char ?? "@"}${label}`,
          ]
        },
        suggestion: {
          allow: () => false,
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Typography,
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
      handleKeyDown(_view, event) {
        const currentEditor = editorRef.current
        const currentSlashState = slashState
        const currentMentionState = mentionState
        const slashOptions = {
          enableUploads: Boolean(onUploadAttachment),
          promptAttachmentUpload: requestAttachmentPicker,
          promptImageUpload: requestImagePicker,
        }

        if (!currentEditor) {
          return false
        }

        if (currentSlashState) {
          if (event.key === "Escape") {
            setSlashState(null)
            previousSlashQueryRef.current = null
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
              slashOptions
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

          const nextSlashState = buildSlashState(
            currentEditor,
            containerRef.current
          )
          if (!nextSlashState) {
            setSlashState(null)
            setSlashIndex(0)
            previousSlashQueryRef.current = null
          }

          return false
        }

        if (currentMentionState) {
          if (event.key === "Escape") {
            setMentionState(null)
            previousMentionQueryRef.current = null
            return true
          }

          if (event.key === "ArrowDown") {
            event.preventDefault()
            setMentionIndex((current) => current + 1)
            return true
          }

          if (event.key === "ArrowUp") {
            event.preventDefault()
            setMentionIndex((current) => Math.max(0, current - 1))
            return true
          }

          if (event.key === "Enter") {
            const nextCandidates = filterMentionCandidates(
              currentMentionState.query,
              mentionCandidates
            )
            const selected =
              nextCandidates[
                Math.min(mentionIndex, nextCandidates.length - 1)
              ] ?? nextCandidates[0]

            if (!selected) {
              return false
            }

            event.preventDefault()
            insertMention(currentEditor, currentMentionState, selected)
            setMentionState(null)
            setMentionIndex(0)
            return true
          }

          const nextMentionState = buildMentionState(
            currentEditor,
            containerRef.current
          )
          if (!nextMentionState) {
            setMentionState(null)
            setMentionIndex(0)
            previousMentionQueryRef.current = null
          }
        }

        if (
          onSubmitShortcut &&
          event.key === "Enter" &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault()
          onSubmitShortcut()
          return true
        }

        return false
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(currentEditor.getHTML())
      syncCommandMenus(currentEditor)
    },
    onSelectionUpdate({ editor: currentEditor }) {
      syncCommandMenus(currentEditor)
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
    if (!editor || !autoFocus) {
      return
    }

    editor.commands.focus("end")
  }, [autoFocus, editor])

  useEffect(() => {
    if (attachmentPickerRequest === 0) {
      return
    }

    hiddenAttachmentInputRef.current?.click()
  }, [attachmentPickerRequest])

  useEffect(() => {
    if (imagePickerRequest === 0) {
      return
    }

    hiddenImageInputRef.current?.click()
  }, [imagePickerRequest])

  const filteredSlashCommands = useMemo(() => {
    if (!slashState || !editor) {
      return []
    }

    return filterSlashCommands(slashState.query, {
      enableUploads: Boolean(onUploadAttachment),
      promptAttachmentUpload: requestAttachmentPicker,
      promptImageUpload: requestImagePicker,
    })
  }, [editor, onUploadAttachment, slashState])

  const filteredMentionCandidates = useMemo(() => {
    if (!mentionState || !editor) {
      return []
    }

    return filterMentionCandidates(mentionState.query, mentionCandidates)
  }, [editor, mentionCandidates, mentionState])

  async function handleFiles(files: File[], position?: number | null) {
    if (!onUploadAttachment || files.length === 0) {
      return
    }

    let nextPosition = position ?? null

    for (const file of files) {
      await handleAttachment(file, nextPosition)
      nextPosition = null
    }
  }

  async function handleAttachment(file: File | null, position?: number | null) {
    if (!file || !onUploadAttachment) {
      return
    }

    setUploadingAttachment(true)
    const uploaded = await onUploadAttachment(file)
    setUploadingAttachment(false)

    if (uploaded?.fileUrl && editorRef.current) {
      const currentEditor = editorRef.current
      const chain = currentEditor.chain().focus()
      const safePosition =
        position == null
          ? null
          : Math.min(
              Math.max(position, 1),
              currentEditor.state.doc.content.size
            )

      if (safePosition != null) {
        chain.setTextSelection(safePosition)
      }

      if (file.type.startsWith("image/")) {
        chain
          .insertContent([
            {
              type: "image",
              attrs: {
                src: uploaded.fileUrl,
                alt: uploaded.fileName,
                title: uploaded.fileName,
              },
            },
            {
              type: "paragraph",
            },
          ])
          .run()
      } else {
        chain
          .insertContent(
            `<p><a href="${escapeHtml(uploaded.fileUrl)}" target="_blank" rel="noreferrer">${escapeHtml(uploaded.fileName)}</a></p>`
          )
          .run()
      }
    }

    if (hiddenAttachmentInputRef.current) {
      hiddenAttachmentInputRef.current.value = ""
    }

    if (hiddenImageInputRef.current) {
      hiddenImageInputRef.current.value = ""
    }
  }

  if (!editor) {
    return null
  }

  const currentEditor = editor
  const statsWords = currentEditor.storage.characterCount.words()
  const statsCharacters = currentEditor.storage.characterCount.characters()
  const tableActive = currentEditor.isActive("table")
  const highlightActive = currentEditor.isActive("highlight")
  const paragraphActive = currentEditor.isActive("paragraph")
  const h1Active = currentEditor.isActive("heading", { level: 1 })
  const h2Active = currentEditor.isActive("heading", { level: 2 })
  const h3Active = currentEditor.isActive("heading", { level: 3 })
  const alignCenterActive = currentEditor.isActive({ textAlign: "center" })
  const alignRightActive = currentEditor.isActive({ textAlign: "right" })
  const alignLeftActive = !alignCenterActive && !alignRightActive
  const canInsertTable = currentEditor
    .can()
    .chain()
    .focus()
    .insertTable(DEFAULT_TABLE_OPTIONS)
    .run()
  const canAddTableRow = currentEditor.can().chain().focus().addRowAfter().run()
  const canAddTableColumn = currentEditor
    .can()
    .chain()
    .focus()
    .addColumnAfter()
    .run()
  const canDeleteTableRow = currentEditor
    .can()
    .chain()
    .focus()
    .deleteRow()
    .run()
  const canDeleteTableColumn = currentEditor
    .can()
    .chain()
    .focus()
    .deleteColumn()
    .run()
  const canDeleteTable = currentEditor.can().chain().focus().deleteTable().run()
  const activeSlashIndex =
    filteredSlashCommands.length === 0
      ? 0
      : Math.min(slashIndex, filteredSlashCommands.length - 1)
  const activeMentionIndex =
    filteredMentionCandidates.length === 0
      ? 0
      : Math.min(mentionIndex, filteredMentionCandidates.length - 1)

  function getMenuLeft(state: MenuState | null) {
    if (!state) {
      return 12
    }

    return Math.min(
      Math.max(12, state.left),
      Math.max(12, containerWidth - 268)
    )
  }

  function setLink() {
    const existing = currentEditor.getAttributes("link").href as
      | string
      | undefined
    const nextHref = window.prompt("Link URL", existing ?? "https://")

    if (!nextHref) {
      currentEditor.chain().focus().unsetLink().run()
      return
    }

    currentEditor.chain().focus().setLink({ href: nextHref }).run()
  }

  // Toolbar
  const toolbar =
    editable && showToolbar ? (
      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 overflow-x-auto",
          fullPage ? "mx-auto w-full max-w-3xl px-6 py-2" : "pb-1"
        )}
      >
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
        <ToolbarButton
          active={highlightActive}
          onClick={() => currentEditor.chain().focus().toggleHighlight().run()}
          label="Highlight"
        >
          <Highlighter className="size-3.5" />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          active={paragraphActive}
          onClick={() => currentEditor.chain().focus().setParagraph().run()}
          label="Paragraph"
        >
          <Paragraph className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={h1Active}
          onClick={() =>
            currentEditor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          label="Heading 1"
        >
          <TextHOne className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={h2Active}
          onClick={() =>
            currentEditor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          label="Heading 2"
        >
          <TextHTwo className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={h3Active}
          onClick={() =>
            currentEditor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          label="Heading 3"
        >
          <TextHThree className="size-3.5" />
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
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          active={alignLeftActive}
          onClick={() =>
            currentEditor.chain().focus().setTextAlign("left").run()
          }
          label="Align left"
        >
          <TextAlignLeft className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={alignCenterActive}
          onClick={() =>
            currentEditor.chain().focus().setTextAlign("center").run()
          }
          label="Align center"
        >
          <TextAlignCenter className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={alignRightActive}
          onClick={() =>
            currentEditor.chain().focus().setTextAlign("right").run()
          }
          label="Align right"
        >
          <TextAlignRight className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={tableActive}
          disabled={!canInsertTable}
          onClick={() => insertDefaultTable(currentEditor)}
          label="Insert table"
        >
          <TableIcon className="size-3.5" />
        </ToolbarButton>
        {onUploadAttachment ? (
          <ToolbarButton
            active={false}
            onClick={() => requestImagePicker(currentEditor)}
            label="Insert image"
          >
            <ImageSquare className="size-3.5" />
          </ToolbarButton>
        ) : null}
        {tableActive ? (
          <>
            <div className="mx-1 h-4 w-px bg-border" />
            <ToolbarButton
              active={false}
              disabled={!canAddTableRow}
              onClick={() => currentEditor.chain().focus().addRowAfter().run()}
              label="Add row"
            >
              <RowsPlusBottom className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              active={false}
              disabled={!canAddTableColumn}
              onClick={() =>
                currentEditor.chain().focus().addColumnAfter().run()
              }
              label="Add column"
            >
              <ColumnsPlusRight className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              active={false}
              disabled={!canDeleteTableRow}
              onClick={() => currentEditor.chain().focus().deleteRow().run()}
              label="Delete row"
            >
              <Trash className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              active={false}
              disabled={!canDeleteTableColumn}
              onClick={() => currentEditor.chain().focus().deleteColumn().run()}
              label="Delete column"
            >
              <Trash className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              active={false}
              disabled={!canDeleteTable}
              onClick={() => currentEditor.chain().focus().deleteTable().run()}
              label="Delete table"
            >
              <Trash className="size-3.5" />
            </ToolbarButton>
          </>
        ) : null}
        {onUploadAttachment ? (
          <>
            <input
              ref={hiddenAttachmentInputRef}
              className="hidden"
              type="file"
              multiple
              onChange={(event) =>
                void handleFiles(
                  Array.from(event.target.files ?? []),
                  pickerInsertPosition
                )
              }
            />
            <input
              ref={hiddenImageInputRef}
              className="hidden"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) =>
                void handleFiles(
                  Array.from(event.target.files ?? []),
                  pickerInsertPosition
                )
              }
            />
            <ToolbarButton
              active={false}
              onClick={() => {
                setPickerInsertPosition(currentEditor.state.selection.from)
                hiddenAttachmentInputRef.current?.click()
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
        <span className="ml-auto pl-3 text-xs whitespace-nowrap text-muted-foreground">
          {statsWords} words · {statsCharacters} characters
        </span>
      </div>
    ) : null

  const slashMenu = slashState ? (
    <div
      className="absolute z-10 w-64 max-w-[calc(100%-1rem)]"
      style={{
        left: getMenuLeft(slashState),
        top: slashState.top,
      }}
    >
      <Command
        className="overflow-hidden rounded-lg border bg-popover shadow-md"
        shouldFilter={false}
      >
        <CommandList className="max-h-[min(20rem,50vh)]">
          <CommandEmpty>
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No matching blocks
            </div>
          </CommandEmpty>
          <CommandGroup>
            {filteredSlashCommands.map((command, index) => (
              <CommandItem
                key={command.id}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-1.5",
                  index === activeSlashIndex && "bg-accent"
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
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                  {command.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{command.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {command.description}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ) : null

  const mentionMenu = mentionState ? (
    <div
      className="absolute z-10 w-64 max-w-[calc(100%-1rem)]"
      style={{
        left: getMenuLeft(mentionState),
        top: mentionState.top,
      }}
    >
      <Command
        className="overflow-hidden rounded-lg border bg-popover shadow-md"
        shouldFilter={false}
      >
        <CommandList className="max-h-[min(20rem,50vh)]">
          <CommandEmpty>
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No matching people
            </div>
          </CommandEmpty>
          <CommandGroup>
            {filteredMentionCandidates.map((candidate, index) => (
              <CommandItem
                key={candidate.id}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-1.5",
                  index === activeMentionIndex && "bg-accent"
                )}
                value={candidate.id}
                onSelect={() => {
                  insertMention(currentEditor, mentionState, candidate)
                  setMentionState(null)
                  setMentionIndex(0)
                  previousMentionQueryRef.current = null
                }}
              >
                <Avatar size="default" className="size-8">
                  {candidate.avatarUrl ? (
                    <AvatarImage
                      src={candidate.avatarUrl}
                      alt={candidate.name}
                    />
                  ) : null}
                  <AvatarFallback>
                    {candidate.name
                      .split(" ")
                      .map((part) => part[0] ?? "")
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{candidate.name}</div>
                  <div className="text-xs text-muted-foreground">
                    @{candidate.handle}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ) : null

  // Full-page mode — used for standalone documents
  if (fullPage) {
    return (
      <div className={cn("flex flex-1 flex-col overflow-hidden", className)}>
        {toolbar}
        <div className="relative flex-1 overflow-y-auto" ref={containerRef}>
          <EditorContent editor={currentEditor} />
          {slashMenu}
          {mentionMenu}
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
        {mentionMenu}
      </div>
      {toolbar}
    </div>
  )
}

function ToolbarButton({
  active,
  disabled = false,
  onClick,
  label,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        disabled &&
          "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground"
      )}
      onClick={onClick}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

function getSlashCommands({
  enableUploads,
  promptAttachmentUpload,
  promptImageUpload,
}: {
  enableUploads: boolean
  promptAttachmentUpload: (editor: Editor) => void
  promptImageUpload: (editor: Editor) => void
}): SlashCommand[] {
  const commands: SlashCommand[] = [
    {
      id: "paragraph",
      label: "Paragraph",
      description: "Plain body text",
      keywords: ["text", "body", "paragraph", "normal"],
      icon: <Paragraph className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().setParagraph().run()
      },
    },
    {
      id: "heading-1",
      label: "Heading 1",
      description: "Large section heading",
      keywords: ["title", "header", "section", "h1"],
      icon: <TextHOne className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleHeading({ level: 1 }).run()
      },
    },
    {
      id: "heading-2",
      label: "Heading 2",
      description: "Medium section heading",
      keywords: ["subtitle", "subheading", "section", "h2"],
      icon: <TextHTwo className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleHeading({ level: 2 }).run()
      },
    },
    {
      id: "heading-3",
      label: "Heading 3",
      description: "Small section heading",
      keywords: ["subtitle", "subheading", "section", "h3"],
      icon: <TextHThree className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleHeading({ level: 3 }).run()
      },
    },
    {
      id: "bullet-list",
      label: "Bullet list",
      description: "Unordered list",
      keywords: ["list", "bullets", "requirements"],
      icon: <ListBullets className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleBulletList().run()
      },
    },
    {
      id: "task-list",
      label: "Checklist",
      description: "Task list with checkboxes",
      keywords: ["tasks", "todo", "criteria"],
      icon: <ListChecks className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleTaskList().run()
      },
    },
    {
      id: "image",
      label: "Image",
      description: "Upload and embed an image",
      keywords: ["image", "photo", "screenshot", "media"],
      icon: <ImageSquare className="size-4" />,
      run: (currentEditor) => {
        promptImageUpload(currentEditor)
      },
    },
    {
      id: "table",
      label: "Table",
      description: "3 × 3 table with a header row",
      keywords: ["table", "grid", "rows", "columns"],
      icon: <TableIcon className="size-4" />,
      run: (currentEditor) => {
        insertDefaultTable(currentEditor)
      },
    },
    {
      id: "quote",
      label: "Quote",
      description: "Blockquote callout",
      keywords: ["callout", "note", "constraint"],
      icon: <Quotes className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleBlockquote().run()
      },
    },
    {
      id: "code",
      label: "Code block",
      description: "Fenced code snippet",
      keywords: ["code", "snippet", "technical"],
      icon: <Code className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleCodeBlock().run()
      },
    },
    {
      id: "divider",
      label: "Divider",
      description: "Horizontal separator",
      keywords: ["separator", "rule", "divider"],
      icon: <Minus className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().setHorizontalRule().run()
      },
    },
    {
      id: "decision",
      label: "Decision",
      description: "Decision template",
      keywords: ["decision", "adr", "context"],
      icon: <Lightning className="size-4" />,
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
      description: "Acceptance checklist",
      keywords: ["acceptance", "criteria", "done"],
      icon: <CheckSquare className="size-4" />,
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
      label: "Attachment",
      description: "Upload a file",
      keywords: ["file", "upload", "attachment"],
      icon: <FileArrowUp className="size-4" />,
      run: (currentEditor) => {
        promptAttachmentUpload(currentEditor)
      },
    },
  ]

  if (!enableUploads) {
    return commands.filter(
      (command) => command.id !== "image" && command.id !== "attachment"
    )
  }

  return commands
}

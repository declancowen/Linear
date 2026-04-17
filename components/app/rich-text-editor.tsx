"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react"
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
import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
import type { RichTextMentionCounts } from "@/lib/content/rich-text-mentions"
import { sanitizeRichTextContent } from "@/lib/content/rich-text-security"
import type { UserProfile } from "@/lib/domain/types"
import { cn } from "@/lib/utils"
import {
  filterMentionCandidates,
  filterSlashCommands,
  buildMentionState,
  buildSlashState,
  insertMention,
  MentionMenu,
  SlashCommandMenu,
  type MentionCandidate,
  type MenuState,
} from "./rich-text-editor/menus"
import {
  FULL_PAGE_CANVAS_WIDTH_CLASSNAME,
  RichTextToolbar,
  type FullPageCanvasWidth,
} from "./rich-text-editor/toolbar"

type UploadedAttachment = {
  fileName: string
  fileUrl: string | null
}

type EmojiPickerAnchor = {
  left: number
  top: number
}

export type RichTextEditorStats = {
  words: number
  characters: number
}

export type RichTextMentionCountsChangeSource = "initial" | "local" | "external"

type RichTextEditorProps = {
  content: string | JSONContent
  onChange: (content: string) => void
  editable?: boolean
  allowSlashCommands?: boolean
  placeholder?: string
  className?: string
  compact?: boolean
  /** Full-page canvas mode — no borders, large content area */
  fullPage?: boolean
  showToolbar?: boolean
  showStats?: boolean
  autoFocus?: boolean
  onUploadAttachment?: (file: File) => Promise<UploadedAttachment | null>
  onSubmitShortcut?: () => void
  submitOnEnter?: boolean
  onStatsChange?: (stats: RichTextEditorStats) => void
  onMentionCountsChange?: (
    counts: RichTextMentionCounts,
    source: RichTextMentionCountsChangeSource
  ) => void
  mentionMenuPlacement?: "above" | "below"
  editorInstanceRef?: MutableRefObject<Editor | null>
  onMentionInserted?: (candidate: MentionCandidate) => void
  mentionCandidates?: Array<
    Pick<
      UserProfile,
      "id" | "name" | "handle" | "avatarImageUrl" | "avatarUrl" | "title"
    >
  >
}

const EMPTY_MENTION_CANDIDATES: MentionCandidate[] = []
const FULL_PAGE_CANVAS_WIDTH_STORAGE_KEY = "linear.document-canvas-width"

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function getEditorMentionCounts(currentEditor: Editor): RichTextMentionCounts {
  const mentionCounts: RichTextMentionCounts = {}

  currentEditor.state.doc.descendants((node) => {
    if (node.type.name !== "mention") {
      return
    }

    const mentionId = node.attrs.id

    if (typeof mentionId !== "string" || mentionId.length === 0) {
      return
    }

    mentionCounts[mentionId] = (mentionCounts[mentionId] ?? 0) + 1
  })

  return mentionCounts
}

export function RichTextEditor({
  content,
  onChange,
  editable = true,
  allowSlashCommands = true,
  placeholder = "Add a description…",
  className,
  compact = false,
  fullPage = false,
  showToolbar = true,
  showStats = true,
  autoFocus = false,
  onUploadAttachment,
  onSubmitShortcut,
  submitOnEnter = false,
  onStatsChange,
  onMentionCountsChange,
  mentionMenuPlacement = "below",
  editorInstanceRef,
  onMentionInserted,
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
  const [emojiPickerAnchor, setEmojiPickerAnchor] =
    useState<EmojiPickerAnchor | null>(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [containerWidth, setContainerWidth] = useState(256)
  const [fullPageCanvasWidth, setFullPageCanvasWidth] =
    useState<FullPageCanvasWidth>("narrow")
  const [fullPageCanvasWidthReady, setFullPageCanvasWidthReady] =
    useState(false)

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

  useEffect(() => {
    if (!fullPage) {
      return
    }

    const storedWidth = window.localStorage.getItem(
      FULL_PAGE_CANVAS_WIDTH_STORAGE_KEY
    )
    const frameId = window.requestAnimationFrame(() => {
      if (
        storedWidth === "narrow" ||
        storedWidth === "medium" ||
        storedWidth === "wide"
      ) {
        setFullPageCanvasWidth(storedWidth)
      }

      setFullPageCanvasWidthReady(true)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [fullPage])

  useEffect(() => {
    if (!fullPage || !fullPageCanvasWidthReady) {
      return
    }

    window.localStorage.setItem(
      FULL_PAGE_CANVAS_WIDTH_STORAGE_KEY,
      fullPageCanvasWidth
    )
  }, [fullPage, fullPageCanvasWidth, fullPageCanvasWidthReady])

  function requestAttachmentPicker(currentEditor: Editor) {
    setPickerInsertPosition(currentEditor.state.selection.from)
    setAttachmentPickerRequest((current) => current + 1)
  }

  function requestImagePicker(currentEditor: Editor) {
    setPickerInsertPosition(currentEditor.state.selection.from)
    setImagePickerRequest((current) => current + 1)
  }

  function requestEmojiPicker(
    currentEditor: Editor,
    anchor?: EmojiPickerAnchor | null
  ) {
    setPickerInsertPosition(currentEditor.state.selection.from)
    setEmojiPickerAnchor(
      anchor ?? {
        left: 12,
        top: 12,
      }
    )
    setEmojiPickerOpen(true)
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
    syncSlashState(
      allowSlashCommands
        ? buildSlashState(currentEditor, containerRef.current)
        : null
    )
    syncMentionState(buildMentionState(currentEditor, containerRef.current))
  }

  function syncMentionCounts(currentEditor: Editor) {
    onMentionCountsChange?.(getEditorMentionCounts(currentEditor), "local")
  }

  // Build editor class based on mode
  const editorClass = fullPage
    ? "min-h-[calc(100svh-12rem)] text-base outline-none [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:leading-7 [&_p+p]:mt-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
    : compact
      ? "min-h-16 text-sm outline-none [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:leading-6 [&_p+p]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
      : "min-h-24 text-sm outline-none [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:leading-7 [&_p+p]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"

  const sanitizedStringContent = useMemo(
    () =>
      typeof content === "string" ? sanitizeRichTextContent(content) : null,
    [content]
  )

  const resolvedEditorContent = sanitizedStringContent ?? content

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
    content: resolvedEditorContent,
    editable,
    editorProps: {
      attributes: {
        class: editorClass,
      },
      handleKeyDown(_view, event) {
        const currentEditor = editorRef.current
        const currentSlashState = allowSlashCommands ? slashState : null
        const currentMentionState = mentionState
        const slashOptions = {
          enableUploads: Boolean(onUploadAttachment),
          promptEmojiPicker: (nextEditor: Editor) =>
            requestEmojiPicker(nextEditor, currentSlashState),
          promptAttachmentUpload: requestAttachmentPicker,
          promptImageUpload: requestImagePicker,
        }

        if (!currentEditor) {
          return false
        }

        if (currentSlashState) {
          const nextCommands = filterSlashCommands(
            currentSlashState.query,
            slashOptions
          )
          const maxSlashIndex = Math.max(nextCommands.length - 1, 0)

          if (event.key === "Escape") {
            setSlashState(null)
            previousSlashQueryRef.current = null
            return true
          }

          if (event.key === "ArrowDown") {
            event.preventDefault()
            setSlashIndex((current) =>
              Math.min(Math.min(current, maxSlashIndex) + 1, maxSlashIndex)
            )
            return true
          }

          if (event.key === "ArrowUp") {
            event.preventDefault()
            setSlashIndex((current) =>
              Math.max(0, Math.min(current, maxSlashIndex) - 1)
            )
            return true
          }

          if (event.key === "Enter") {
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
          const nextCandidates = filterMentionCandidates(
            currentMentionState.query,
            mentionCandidates
          )
          const maxMentionIndex = Math.max(nextCandidates.length - 1, 0)

          if (event.key === "Escape") {
            setMentionState(null)
            previousMentionQueryRef.current = null
            return true
          }

          if (event.key === "ArrowDown") {
            event.preventDefault()
            setMentionIndex((current) =>
              Math.min(Math.min(current, maxMentionIndex) + 1, maxMentionIndex)
            )
            return true
          }

          if (event.key === "ArrowUp") {
            event.preventDefault()
            setMentionIndex((current) =>
              Math.max(0, Math.min(current, maxMentionIndex) - 1)
            )
            return true
          }

          if (event.key === "Enter") {
            const selected =
              nextCandidates[
                Math.min(mentionIndex, nextCandidates.length - 1)
              ] ?? nextCandidates[0]

            if (!selected) {
              return false
            }

            event.preventDefault()
            insertMention(currentEditor, currentMentionState, selected)
            onMentionInserted?.(selected)
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
          submitOnEnter &&
          event.key === "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault()
          onSubmitShortcut()
          return true
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
    onCreate({ editor: currentEditor }) {
      onMentionCountsChange?.(getEditorMentionCounts(currentEditor), "initial")
      syncCommandMenus(currentEditor)
    },
    onUpdate({ editor: currentEditor }) {
      onChange(sanitizeRichTextContent(currentEditor.getHTML()))
      syncMentionCounts(currentEditor)
      syncCommandMenus(currentEditor)
    },
    onSelectionUpdate({ editor: currentEditor }) {
      syncCommandMenus(currentEditor)
    },
  })

  useEffect(() => {
    editorRef.current = editor
    if (editorInstanceRef) {
      editorInstanceRef.current = editor
    }

    return () => {
      if (editorInstanceRef) {
        editorInstanceRef.current = null
      }
    }
  }, [editor, editorInstanceRef])

  useEffect(() => {
    if (!editor) {
      return
    }

    const currentContent = editor.getHTML()

    if (sanitizedStringContent === null) {
      return
    }

    if (currentContent === sanitizedStringContent) {
      return
    }

    // Ignore external content churn while the user is actively typing.
    // This prevents stale snapshot echoes from resetting the document.
    if (editor.isFocused) {
      return
    }

    if (currentContent !== sanitizedStringContent) {
      editor.commands.setContent(sanitizedStringContent, {
        emitUpdate: false,
      })
      onMentionCountsChange?.(getEditorMentionCounts(editor), "external")
    }
  }, [editor, onMentionCountsChange, sanitizedStringContent])

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
    if (!allowSlashCommands || !slashState || !editor) {
      return []
    }

    return filterSlashCommands(slashState.query, {
      enableUploads: Boolean(onUploadAttachment),
      promptEmojiPicker: (nextEditor) =>
        requestEmojiPicker(nextEditor, slashState),
      promptAttachmentUpload: requestAttachmentPicker,
      promptImageUpload: requestImagePicker,
    })
  }, [allowSlashCommands, editor, onUploadAttachment, slashState])

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

  const statsWords = editor?.storage.characterCount.words() ?? 0
  const statsCharacters = editor?.storage.characterCount.characters() ?? 0

  useEffect(() => {
    onStatsChange?.({
      words: statsWords,
      characters: statsCharacters,
    })
  }, [onStatsChange, statsCharacters, statsWords])

  if (!editor) {
    return null
  }

  const currentEditor = editor
  const activeSlashIndex =
    filteredSlashCommands.length === 0
      ? 0
      : Math.min(slashIndex, filteredSlashCommands.length - 1)
  const activeMentionIndex =
    filteredMentionCandidates.length === 0
      ? 0
      : Math.min(mentionIndex, filteredMentionCandidates.length - 1)

  const toolbar =
    editable && showToolbar ? (
      <RichTextToolbar
        editable={editable}
        editor={currentEditor}
        fullPage={fullPage}
        fullPageCanvasWidth={fullPageCanvasWidth}
        handleFiles={handleFiles}
        hiddenAttachmentInputRef={hiddenAttachmentInputRef}
        hiddenImageInputRef={hiddenImageInputRef}
        pickerInsertPosition={pickerInsertPosition}
        requestAttachmentPicker={requestAttachmentPicker}
        requestImagePicker={requestImagePicker}
        setFullPageCanvasWidth={setFullPageCanvasWidth}
        showStats={showStats}
        statsCharacters={statsCharacters}
        statsWords={statsWords}
        toolbarWidthClassName={
          FULL_PAGE_CANVAS_WIDTH_CLASSNAME[fullPageCanvasWidth]
        }
        uploadsEnabled={Boolean(onUploadAttachment)}
        uploadingAttachment={uploadingAttachment}
      />
    ) : null

  const inlineEmojiPicker =
    editable && emojiPickerAnchor ? (
      <div
        className="absolute z-20"
        style={{
          left: Math.min(
            Math.max(12, emojiPickerAnchor.left),
            Math.max(12, containerWidth - 24)
          ),
          top: emojiPickerAnchor.top,
        }}
      >
        <EmojiPickerPopover
          align="start"
          side="bottom"
          open={emojiPickerOpen}
          onOpenChange={(open) => {
            setEmojiPickerOpen(open)
            if (!open) {
              setEmojiPickerAnchor(null)
            }
          }}
          onEmojiSelect={(emoji) => {
            currentEditor.chain().focus().insertContent(emoji).run()
          }}
          trigger={
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              className="pointer-events-none size-px opacity-0"
            />
          }
        />
      </div>
    ) : null

  const slashMenu =
    allowSlashCommands && slashState ? (
      <SlashCommandMenu
        activeIndex={activeSlashIndex}
        commands={filteredSlashCommands}
        containerWidth={containerWidth}
        editor={currentEditor}
        state={slashState}
        onComplete={() => {
          setSlashState(null)
          setSlashIndex(0)
          previousSlashQueryRef.current = null
        }}
      />
    ) : null

  const mentionMenu = mentionState ? (
    <MentionMenu
      activeIndex={activeMentionIndex}
      candidates={filteredMentionCandidates}
      containerWidth={containerWidth}
      editor={currentEditor}
      placement={mentionMenuPlacement}
      state={mentionState}
      onSelectCandidate={onMentionInserted}
      onComplete={() => {
        setMentionState(null)
        setMentionIndex(0)
        previousMentionQueryRef.current = null
      }}
    />
  ) : null

  // Full-page mode — used for standalone documents
  if (fullPage) {
    return (
      <div
        className={cn(
          "relative flex flex-1 flex-col overflow-hidden",
          className
        )}
      >
        {toolbar}
        <div className="flex-1 overflow-y-auto">
          <div
            className={cn(
              "relative mx-auto w-full px-6 py-4",
              FULL_PAGE_CANVAS_WIDTH_CLASSNAME[fullPageCanvasWidth]
            )}
            ref={containerRef}
          >
            <EditorContent editor={currentEditor} />
            {slashMenu}
            {mentionMenu}
            {inlineEmojiPicker}
          </div>
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
        {inlineEmojiPicker}
      </div>
      {toolbar}
    </div>
  )
}

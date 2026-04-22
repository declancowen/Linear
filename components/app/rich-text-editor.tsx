"use client"

import {
  useCallback,
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
import {
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from "@tiptap/y-tiptap"
import Collaboration, {
  isChangeOrigin,
} from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import FileHandler from "@tiptap/extension-file-handler"
import type { Node as ProsemirrorNode } from "@tiptap/pm/model"
import * as Y from "yjs"
import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
import {
  createCollaborationAwarenessState,
  type CollaborationAwarenessState,
} from "@/lib/collaboration/awareness"
import { COLLABORATION_XML_FRAGMENT } from "@/lib/collaboration/constants"
import { getCollaborationUserColor } from "@/lib/collaboration/colors"
import type { PartyKitDocumentCollaborationBinding } from "@/lib/collaboration/adapters/partykit"
import type { RichTextMentionCounts } from "@/lib/content/rich-text-mentions"
import { sanitizeRichTextContent } from "@/lib/content/rich-text-security"
import type { DocumentPresenceViewer, UserProfile } from "@/lib/domain/types"
import { createRichTextBaseExtensions } from "@/lib/rich-text/extensions"
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
  collaboration?: {
    binding: PartyKitDocumentCollaborationBinding
    localUser: CollaborationAwarenessState
  }
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
  presenceViewers?: DocumentPresenceViewer[]
  currentPresenceUserId?: string | null
  onActiveBlockChange?: (activeBlockId: string | null) => void
  mentionCandidates?: Array<
    Pick<
      UserProfile,
      "id" | "name" | "handle" | "avatarImageUrl" | "avatarUrl" | "title"
    >
  >
}

type BlockPresenceMarker = {
  blockId: string
  top: number
  viewers: DocumentPresenceViewer[]
}

type CollaborationCursorMarker = {
  key: string
  name: string
  color: string
  left: number
  top: number
  height: number
}

const EMPTY_MENTION_CANDIDATES: MentionCandidate[] = []
const FULL_PAGE_CANVAS_WIDTH_STORAGE_KEY = "linear.document-canvas-width"
const TYPING_IDLE_TIMEOUT_MS = 1500
const MAX_VISIBLE_BLOCK_PRESENCE_VIEWERS = 2

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
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

function areBlockPresenceMarkersEqual(
  left: BlockPresenceMarker[],
  right: BlockPresenceMarker[]
) {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftMarker = left[index]
    const rightMarker = right[index]

    if (!leftMarker || !rightMarker) {
      return false
    }

    if (
      leftMarker.blockId !== rightMarker.blockId ||
      leftMarker.top !== rightMarker.top ||
      leftMarker.viewers.length !== rightMarker.viewers.length
    ) {
      return false
    }

    for (let viewerIndex = 0; viewerIndex < leftMarker.viewers.length; viewerIndex += 1) {
      const leftViewer = leftMarker.viewers[viewerIndex]
      const rightViewer = rightMarker.viewers[viewerIndex]

      if (
        !leftViewer ||
        !rightViewer ||
        leftViewer.userId !== rightViewer.userId ||
        leftViewer.activeBlockId !== rightViewer.activeBlockId
      ) {
        return false
      }
    }
  }

  return true
}

function getActiveBlockId(currentEditor: Editor) {
  const { $from } = currentEditor.state.selection
  const parentOffset = $from.depth > 0 ? $from.before() : 0

  return `${$from.parent.type.name}:${parentOffset}`
}

function getSelectionRange(currentEditor: Editor) {
  const { anchor, head } = currentEditor.state.selection

  return { anchor, head }
}

function getCollaborationUserColorValue(user: Record<string, unknown>) {
  return typeof user.color === "string" && user.color.trim().length > 0
    ? user.color
    : "#0f172a"
}

function renderCollaborationCaret(user: Record<string, unknown>) {
  const caret = document.createElement("span")
  caret.classList.add("collaboration-carets__anchor")
  caret.setAttribute("aria-hidden", "true")
  if (typeof user.userId === "string" && user.userId.trim().length > 0) {
    caret.dataset.collaborationUserId = user.userId.trim()
  }
  if (
    typeof user.sessionId === "string" &&
    user.sessionId.trim().length > 0
  ) {
    caret.dataset.collaborationSessionId = user.sessionId.trim()
  }

  return caret
}

function renderCollaborationSelection(user: Record<string, unknown>) {
  const color = getCollaborationUserColorValue(user)

  return {
    nodeName: "span",
    class: "collaboration-carets__selection",
    style: `background-color: ${color}22`,
  }
}

function updateEditorCollaborationUser(
  currentEditor: Editor,
  collaboration: RichTextEditorProps["collaboration"],
  patch?: Partial<CollaborationAwarenessState>
) {
  if (!collaboration) {
    return
  }

  const localAwarenessState =
    collaboration.binding.provider.awareness.getLocalState()
  const localAwarenessUser = isRecord(localAwarenessState)
    ? localAwarenessState.user
    : null
  const mergedUser = createCollaborationAwarenessState({
    ...collaboration.localUser,
    ...(isRecord(localAwarenessUser) ? localAwarenessUser : {}),
    ...patch,
  })

  const updateUserCommand = (
    currentEditor.commands as {
      updateUser?: (attributes: CollaborationAwarenessState) => boolean
    }
  ).updateUser

  if (typeof updateUserCommand === "function") {
    updateUserCommand(mergedUser)
    return
  }

  collaboration.binding.provider.awareness.setLocalStateField("user", mergedUser)
}

function insertUploadedAttachment(input: {
  currentEditor: Editor
  file: File
  uploaded: UploadedAttachment
  position?: number | null
}) {
  if (!input.uploaded.fileUrl) {
    return
  }

  const chain = input.currentEditor.chain().focus()
  const safePosition =
    input.position == null
      ? null
      : Math.min(
          Math.max(input.position, 1),
          input.currentEditor.state.doc.content.size
        )

  if (safePosition != null) {
    chain.setTextSelection(safePosition)
  }

  if (input.file.type.startsWith("image/")) {
    chain
      .insertContent([
        {
          type: "image",
          attrs: {
            src: input.uploaded.fileUrl,
            alt: input.uploaded.fileName,
            title: input.uploaded.fileName,
          },
        },
        {
          type: "paragraph",
        },
      ])
      .run()

    return
  }

  chain
    .insertContent(
      `<p><a href="${escapeHtml(input.uploaded.fileUrl)}" target="_blank" rel="noreferrer">${escapeHtml(input.uploaded.fileName)}</a></p>`
    )
    .run()
}

function collectBlockPresenceMarkers(input: {
  currentEditor: Editor
  container: HTMLDivElement | null
  viewers: DocumentPresenceViewer[]
}) {
  const container = input.container

  if (!container) {
    return [] as BlockPresenceMarker[]
  }

  const viewersByBlockId = new Map<string, DocumentPresenceViewer[]>()

  for (const viewer of input.viewers) {
    const activeBlockId = viewer.activeBlockId?.trim()

    if (!activeBlockId) {
      continue
    }

    const blockViewers = viewersByBlockId.get(activeBlockId) ?? []
    blockViewers.push(viewer)
    viewersByBlockId.set(activeBlockId, blockViewers)
  }

  if (viewersByBlockId.size === 0) {
    return [] as BlockPresenceMarker[]
  }

  const containerRect = container.getBoundingClientRect()
  const markers: BlockPresenceMarker[] = []

  input.currentEditor.state.doc.descendants((node, position) => {
    if (!node.isBlock) {
      return
    }

    const blockId = `${node.type.name}:${position}`
    const blockViewers = viewersByBlockId.get(blockId)

    if (!blockViewers || blockViewers.length === 0) {
      return
    }

    let blockNode: Node | null = null

    try {
      blockNode = input.currentEditor.view.nodeDOM(position)
    } catch {
      return
    }

    if (!(blockNode instanceof HTMLElement)) {
      return
    }

    const blockRect = blockNode.getBoundingClientRect()
    markers.push({
      blockId,
      top:
        blockRect.top -
        containerRect.top +
        container.scrollTop +
        Math.max(0, (blockRect.height - 18) / 2),
      viewers: blockViewers,
    })
  })

  return markers
}

function areCollaborationCursorMarkersEqual(
  left: CollaborationCursorMarker[],
  right: CollaborationCursorMarker[]
) {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftMarker = left[index]
    const rightMarker = right[index]

    if (!leftMarker || !rightMarker) {
      return false
    }

    if (
      leftMarker.key !== rightMarker.key ||
      leftMarker.name !== rightMarker.name ||
      leftMarker.color !== rightMarker.color ||
      leftMarker.left !== rightMarker.left ||
      leftMarker.top !== rightMarker.top ||
      leftMarker.height !== rightMarker.height
    ) {
      return false
    }
  }

  return true
}

type CollaborationAwarenessUser = {
  userId: string
  sessionId: string
  name: string
  color: string
}

function getCollaborationAwarenessUser(
  value: unknown
): CollaborationAwarenessUser | null {
  if (!isRecord(value)) {
    return null
  }

  const userValue = isRecord(value.user) ? value.user : value
  const userId =
    typeof userValue.userId === "string" ? userValue.userId.trim() : ""
  const sessionId =
    typeof userValue.sessionId === "string" ? userValue.sessionId.trim() : ""
  const name = typeof userValue.name === "string" ? userValue.name.trim() : ""

  if (!userId || !sessionId || !name) {
    return null
  }

  return {
    userId,
    sessionId,
    name,
    color:
      typeof userValue.color === "string" && userValue.color.trim().length > 0
        ? userValue.color
        : getCollaborationUserColor(userId),
  }
}

function getCollaborationAwarenessCursorHead(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  const userValue = isRecord(value.user) ? value.user : value
  const cursorValue = isRecord(userValue.cursor) ? userValue.cursor : null
  const head = cursorValue?.head

  if (typeof head !== "number" || !Number.isInteger(head) || head < 0) {
    return null
  }

  return head
}

type YSyncEditorState = {
  doc: Y.Doc | null
  type: Y.XmlFragment | null
  binding: {
    mapping: Map<Y.AbstractType<any>, ProsemirrorNode | ProsemirrorNode[]>
  } | null
  snapshot?: unknown
  prevSnapshot?: unknown
}

function escapeAttributeValue(value: string) {
  if (typeof globalThis.CSS?.escape === "function") {
    return globalThis.CSS.escape(value)
  }

  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function findCollaborationCaretAnchor(
  container: HTMLDivElement,
  user: CollaborationAwarenessUser
) {
  const sessionSelector = `[data-collaboration-session-id="${escapeAttributeValue(user.sessionId)}"]`
  const userSelector = `[data-collaboration-user-id="${escapeAttributeValue(user.userId)}"]`

  return container.querySelector<HTMLElement>(
    `.collaboration-carets__anchor${sessionSelector}${userSelector}`
  )
}

function resolveCollaborationCaretCoordinates(
  currentEditor: Editor,
  position: number
) {
  const after = currentEditor.view.coordsAtPos(position, 1)

  if (position <= 0) {
    return {
      left: after.left,
      top: after.top,
      bottom: after.bottom,
    }
  }

  try {
    const before = currentEditor.view.coordsAtPos(position, -1)
    const wrappedToNextVisualLine =
      after.top > before.top || after.left < before.left

    if (wrappedToNextVisualLine) {
      return {
        left: Math.max(before.left, before.right),
        top: before.top,
        bottom: before.bottom,
      }
    }
  } catch {
    // Ignore unsupported side lookups and fall back to the default caret rect.
  }

  return {
    left: after.left,
    top: after.top,
    bottom: after.bottom,
  }
}

function collectCollaborationCursorMarkers(input: {
  currentEditor: Editor
  container: HTMLDivElement | null
  collaboration: NonNullable<RichTextEditorProps["collaboration"]>
  currentPresenceUserId: string | null
}) {
  const container = input.container

  if (!container) {
    return [] as CollaborationCursorMarker[]
  }

  const yState = ySyncPluginKey.getState(
    input.currentEditor.state
  ) as YSyncEditorState | undefined

  if (
    !yState?.doc ||
    !yState.type ||
    !yState.binding ||
    yState.snapshot != null ||
    yState.prevSnapshot != null ||
    yState.binding.mapping.size === 0
  ) {
    return [] as CollaborationCursorMarker[]
  }

  const { doc, type, binding } = yState

  const localSessionId =
    getCollaborationAwarenessUser(
      input.collaboration.binding.provider.awareness.getLocalState()
    )?.sessionId ?? input.collaboration.localUser.sessionId
  const containerRect = container.getBoundingClientRect()
  const markers: CollaborationCursorMarker[] = []

  input.collaboration.binding.provider.awareness
    .getStates()
    .forEach((value, clientId) => {
      const user = getCollaborationAwarenessUser(value)

      if (!user) {
        return
      }

      if (
        user.sessionId === localSessionId ||
        (input.currentPresenceUserId &&
          user.userId === input.currentPresenceUserId)
      ) {
        return
      }

      const cursorValue =
        isRecord(value) && isRecord(value.cursor) ? value.cursor : null
      const headJson = cursorValue?.head

      let head: number | null = getCollaborationAwarenessCursorHead(value)

      if (head === null && headJson) {
        const relativeHeadPosition = Y.createRelativePositionFromJSON(headJson)

        if (relativeHeadPosition) {
          const absoluteHead = relativePositionToAbsolutePosition(
            doc,
            type,
            relativeHeadPosition,
            binding.mapping
          )

          head = typeof absoluteHead === "number" ? absoluteHead : null
        }
      }

      if (typeof head !== "number") {
        return
      }

      const maxDocumentPosition = Math.max(
        input.currentEditor.state.doc.content.size - 1,
        0
      )
      head = Math.min(head, maxDocumentPosition)

      try {
        const fallbackCoordinates = resolveCollaborationCaretCoordinates(
          input.currentEditor,
          head
        )
        const anchor = findCollaborationCaretAnchor(container, user)
        const anchorRect = anchor?.getBoundingClientRect() ?? null
        const coordinates =
          anchorRect &&
          Number.isFinite(anchorRect.left) &&
          Number.isFinite(anchorRect.top)
            ? {
                left: anchorRect.left,
                top: anchorRect.top,
                bottom:
                  anchorRect.bottom > anchorRect.top
                    ? anchorRect.bottom
                    : fallbackCoordinates.bottom,
              }
            : fallbackCoordinates

        markers.push({
          key: `${clientId}:${user.sessionId}`,
          name: user.name,
          color: user.color,
          left: Math.round(
            coordinates.left - containerRect.left + container.scrollLeft
          ),
          top: Math.round(
            coordinates.top - containerRect.top + container.scrollTop
          ),
          height: Math.max(
            18,
            Math.round(coordinates.bottom - coordinates.top)
          ),
        })
      } catch {
        return
      }
    })

  return markers.sort(
    (left, right) =>
      left.top - right.top ||
      left.left - right.left ||
      left.key.localeCompare(right.key)
  )
}

export function RichTextEditor({
  content,
  onChange,
  collaboration,
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
  presenceViewers = [],
  currentPresenceUserId = null,
  onActiveBlockChange,
  mentionCandidates = EMPTY_MENTION_CANDIDATES,
}: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hiddenAttachmentInputRef = useRef<HTMLInputElement | null>(null)
  const hiddenImageInputRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const previousSlashQueryRef = useRef<string | null>(null)
  const previousMentionQueryRef = useRef<string | null>(null)
  const onChangeRef = useRef(onChange)
  const onUploadAttachmentRef = useRef(onUploadAttachment)
  const onMentionCountsChangeRef = useRef(onMentionCountsChange)
  const onMentionInsertedRef = useRef(onMentionInserted)
  const typingTimeoutRef = useRef<number | null>(null)
  const lastReportedActiveBlockIdRef = useRef<string | null>(null)

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
  const [blockPresenceMarkers, setBlockPresenceMarkers] = useState<
    BlockPresenceMarker[]
  >([])
  const [collaborationCursorMarkers, setCollaborationCursorMarkers] = useState<
    CollaborationCursorMarker[]
  >([])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onUploadAttachmentRef.current = onUploadAttachment
  }, [onUploadAttachment])

  useEffect(() => {
    onMentionCountsChangeRef.current = onMentionCountsChange
  }, [onMentionCountsChange])

  useEffect(() => {
    onMentionInsertedRef.current = onMentionInserted
  }, [onMentionInserted])

  const reportActiveBlockId = useCallback(
    (activeBlockId: string | null) => {
      if (lastReportedActiveBlockIdRef.current === activeBlockId) {
        return
      }

      lastReportedActiveBlockIdRef.current = activeBlockId
      onActiveBlockChange?.(activeBlockId)
    },
    [onActiveBlockChange]
  )
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
  const visiblePresenceViewers = useMemo(
    () =>
      currentPresenceUserId
        ? presenceViewers.filter(
            (viewer) => viewer.userId !== currentPresenceUserId
          )
        : presenceViewers,
    [currentPresenceUserId, presenceViewers]
  )
  const baseExtensions = useMemo(
    () =>
      createRichTextBaseExtensions({
        placeholder,
        collaboration: Boolean(collaboration),
      }),
    [collaboration, placeholder]
  )
  const collaborationExtensions = useMemo(
    () =>
      collaboration
        ? [
            Collaboration.configure({
              document: collaboration.binding.doc,
              field: COLLABORATION_XML_FRAGMENT,
              provider: collaboration.binding.provider,
            }),
            CollaborationCaret.configure({
              provider: collaboration.binding.provider,
              user: collaboration.localUser,
              render: renderCollaborationCaret,
              selectionRender: renderCollaborationSelection,
            }),
          ]
        : [],
    [
      collaboration?.binding.doc,
      collaboration?.binding.provider,
      collaboration?.localUser,
    ]
  )

  function clearTypingTimeout() {
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
  }

  function scheduleTypingIdleReset(currentEditor: Editor) {
    if (!collaboration) {
      return
    }

    clearTypingTimeout()
    typingTimeoutRef.current = window.setTimeout(() => {
      updateEditorCollaborationUser(currentEditor, collaboration, {
        typing: false,
      })
    }, TYPING_IDLE_TIMEOUT_MS)
  }

  const handleEditorAttachment = useCallback(
    async (
      currentEditor: Editor,
      file: File | null,
      position?: number | null
    ) => {
      const uploadAttachment = onUploadAttachmentRef.current

      if (!file || !uploadAttachment) {
        return
      }

      setUploadingAttachment(true)
      const uploaded = await uploadAttachment(file)
      setUploadingAttachment(false)

      if (uploaded?.fileUrl) {
        insertUploadedAttachment({
          currentEditor,
          file,
          uploaded,
          position,
        })
      }
    },
    []
  )

  const handleEditorFiles = useCallback(
    async (
      currentEditor: Editor,
      files: File[],
      position?: number | null
    ) => {
      if (!onUploadAttachmentRef.current || files.length === 0) {
        return
      }

      let nextPosition = position ?? null

      for (const file of files) {
        await handleEditorAttachment(currentEditor, file, nextPosition)
        nextPosition = null
      }
    },
    [handleEditorAttachment]
  )

  const handleToolbarFiles = useCallback(
    async (files: File[], position?: number | null) => {
      const currentEditor = editorRef.current

      if (!currentEditor) {
        return
      }

      await handleEditorFiles(currentEditor, files, position)

      if (hiddenAttachmentInputRef.current) {
        hiddenAttachmentInputRef.current.value = ""
      }

      if (hiddenImageInputRef.current) {
        hiddenImageInputRef.current.value = ""
      }
    },
    [handleEditorFiles]
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...baseExtensions,
      ...collaborationExtensions,
      FileHandler.configure({
        onPaste(currentEditor, files) {
          void handleEditorFiles(
            currentEditor,
            files,
            currentEditor.state.selection.from
          )
        },
        onDrop(currentEditor, files, position) {
          void handleEditorFiles(currentEditor, files, position)
        },
      }),
    ],
    content: collaboration ? undefined : resolvedEditorContent,
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
            onMentionInsertedRef.current?.(selected)
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
      const activeBlockId = getActiveBlockId(currentEditor)
      const selection = getSelectionRange(currentEditor)

      if (collaboration) {
        updateEditorCollaborationUser(currentEditor, collaboration, {
          typing: false,
          activeBlockId,
          cursor: selection,
          selection,
        })
      }
      reportActiveBlockId(activeBlockId)

      onMentionCountsChangeRef.current?.(
        getEditorMentionCounts(currentEditor),
        "initial"
      )
      syncCommandMenus(currentEditor)
    },
    onUpdate({ editor: currentEditor, transaction }) {
      const isExternalCollaborationChange =
        collaboration && isChangeOrigin(transaction)

      onChangeRef.current(sanitizeRichTextContent(currentEditor.getHTML()))

      onMentionCountsChangeRef.current?.(
        getEditorMentionCounts(currentEditor),
        isExternalCollaborationChange ? "external" : "local"
      )
      syncCommandMenus(currentEditor)

      if (collaboration && !isExternalCollaborationChange) {
        const activeBlockId = getActiveBlockId(currentEditor)
        const selection = getSelectionRange(currentEditor)
        updateEditorCollaborationUser(currentEditor, collaboration, {
          typing: true,
          activeBlockId,
          cursor: selection,
          selection,
        })
        reportActiveBlockId(activeBlockId)
        scheduleTypingIdleReset(currentEditor)
      } else if (!isExternalCollaborationChange) {
        reportActiveBlockId(getActiveBlockId(currentEditor))
      }
    },
    onSelectionUpdate({ editor: currentEditor }) {
      syncCommandMenus(currentEditor)
      const activeBlockId = getActiveBlockId(currentEditor)
      const selection = getSelectionRange(currentEditor)

      if (collaboration) {
        updateEditorCollaborationUser(currentEditor, collaboration, {
          activeBlockId,
          cursor: selection,
          selection,
        })
      }
      reportActiveBlockId(activeBlockId)
    },
    onFocus({ editor: currentEditor }) {
      const activeBlockId = getActiveBlockId(currentEditor)
      const selection = getSelectionRange(currentEditor)
      if (collaboration) {
        updateEditorCollaborationUser(currentEditor, collaboration, {
          activeBlockId,
          cursor: selection,
          selection,
        })
      }
      reportActiveBlockId(activeBlockId)
    },
    onBlur({ editor: currentEditor }) {
      clearTypingTimeout()
      const activeBlockId = getActiveBlockId(currentEditor)
      const selection = getSelectionRange(currentEditor)

      if (collaboration) {
        updateEditorCollaborationUser(currentEditor, collaboration, {
          typing: false,
          activeBlockId,
          cursor: selection,
          selection,
        })
      }
      reportActiveBlockId(activeBlockId)
    },
  }, [
    collaboration?.binding.doc,
    collaboration?.binding.provider,
    collaboration?.localUser.sessionId,
    handleEditorFiles,
    reportActiveBlockId,
    placeholder,
  ])

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

    if (collaboration) {
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
      onMentionCountsChangeRef.current?.(
        getEditorMentionCounts(editor),
        "external"
      )
    }
  }, [collaboration, editor, sanitizedStringContent])

  useEffect(() => {
    if (!editor || !collaboration) {
      return
    }

    const activeBlockId = getActiveBlockId(editor)
    const selection = getSelectionRange(editor)
    updateEditorCollaborationUser(editor, collaboration, {
      typing: false,
      activeBlockId,
      cursor: selection,
      selection,
    })
    reportActiveBlockId(activeBlockId)
  }, [collaboration, editor, reportActiveBlockId])

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
    return () => {
      clearTypingTimeout()
    }
  }, [])

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

  const statsWords = editor?.storage.characterCount.words() ?? 0
  const statsCharacters = editor?.storage.characterCount.characters() ?? 0

  const updateBlockPresenceMarkers = useCallback(() => {
    if (!editor || visiblePresenceViewers.length === 0) {
      setBlockPresenceMarkers((current) =>
        current.length === 0 ? current : []
      )
      return
    }

    const nextMarkers = collectBlockPresenceMarkers({
        currentEditor: editor,
        container: containerRef.current,
        viewers: visiblePresenceViewers,
      })

    setBlockPresenceMarkers((current) =>
      areBlockPresenceMarkersEqual(current, nextMarkers)
        ? current
        : nextMarkers
    )
  }, [editor, visiblePresenceViewers])

  const updateCollaborationCursorMarkers = useCallback(() => {
    if (!editor || !collaboration) {
      setCollaborationCursorMarkers((current) =>
        current.length === 0 ? current : []
      )
      return
    }

    const nextMarkers = collectCollaborationCursorMarkers({
      currentEditor: editor,
      container: containerRef.current,
      collaboration,
      currentPresenceUserId,
    })

    setCollaborationCursorMarkers((current) =>
      areCollaborationCursorMarkersEqual(current, nextMarkers)
        ? current
        : nextMarkers
    )
  }, [collaboration, currentPresenceUserId, editor])

  useEffect(() => {
    onStatsChange?.({
      words: statsWords,
      characters: statsCharacters,
    })
  }, [onStatsChange, statsCharacters, statsWords])

  useEffect(() => {
    updateBlockPresenceMarkers()
  }, [containerWidth, fullPageCanvasWidth, updateBlockPresenceMarkers])

  useEffect(() => {
    updateCollaborationCursorMarkers()
  }, [
    containerWidth,
    fullPageCanvasWidth,
    updateCollaborationCursorMarkers,
  ])

  useEffect(() => {
    if (!editor) {
      return
    }

    let frameId: number | null = null
    const queueUpdate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null
        updateBlockPresenceMarkers()
      })
    }

    const container = containerRef.current
    queueUpdate()
    editor.on("update", queueUpdate)
    editor.on("selectionUpdate", queueUpdate)
    container?.addEventListener("scroll", queueUpdate, { passive: true })
    window.addEventListener("resize", queueUpdate)

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }

      editor.off("update", queueUpdate)
      editor.off("selectionUpdate", queueUpdate)
      container?.removeEventListener("scroll", queueUpdate)
      window.removeEventListener("resize", queueUpdate)
    }
  }, [editor, updateBlockPresenceMarkers])

  useEffect(() => {
    if (!editor || !collaboration) {
      return
    }

    let frameId: number | null = null
    const provider = collaboration.binding.provider
    const queueUpdate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null
        updateCollaborationCursorMarkers()
      })
    }

    const container = containerRef.current
    queueUpdate()
    editor.on("update", queueUpdate)
    editor.on("selectionUpdate", queueUpdate)
    provider.awareness.on("change", queueUpdate)
    provider.awareness.on("update", queueUpdate)
    container?.addEventListener("scroll", queueUpdate, { passive: true })
    window.addEventListener("resize", queueUpdate)

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }

      editor.off("update", queueUpdate)
      editor.off("selectionUpdate", queueUpdate)
      provider.awareness.off("change", queueUpdate)
      provider.awareness.off("update", queueUpdate)
      container?.removeEventListener("scroll", queueUpdate)
      window.removeEventListener("resize", queueUpdate)
    }
  }, [collaboration, editor, updateCollaborationCursorMarkers])

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
    showToolbar ? (
      <RichTextToolbar
        editable={editable}
        editor={currentEditor}
        fullPage={fullPage}
        fullPageCanvasWidth={fullPageCanvasWidth}
        handleFiles={handleToolbarFiles}
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

  const blockPresence =
    !collaboration && blockPresenceMarkers.length > 0 ? (
      <div className="pointer-events-none absolute inset-0 z-10">
        {blockPresenceMarkers.map((marker) => {
          const viewerNames = marker.viewers.map((viewer) => viewer.name).join(", ")

          return (
            <div
              key={marker.blockId}
              className="absolute left-3"
              style={{ top: marker.top }}
              aria-label={`Active here: ${viewerNames}`}
              title={`Active here: ${viewerNames}`}
            >
              <div className="flex items-start gap-1.5">
                {marker.viewers
                  .slice(0, MAX_VISIBLE_BLOCK_PRESENCE_VIEWERS)
                  .map((viewer) => {
                    const color = getCollaborationUserColor(viewer.userId)

                    return (
                      <div
                        key={viewer.userId}
                        className="flex flex-col items-start"
                      >
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
                          style={{ backgroundColor: color }}
                        >
                          {viewer.name}
                        </span>
                        <span
                          className="ml-2 h-4 w-0.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      </div>
                    )
                  })}
                {marker.viewers.length > MAX_VISIBLE_BLOCK_PRESENCE_VIEWERS ? (
                  <span className="rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-border">
                    +{marker.viewers.length - MAX_VISIBLE_BLOCK_PRESENCE_VIEWERS}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    ) : null

  const collaborationCursorPresence =
    collaboration && collaborationCursorMarkers.length > 0 ? (
      <div className="pointer-events-none absolute inset-0 z-10">
        {collaborationCursorMarkers.map((marker) => (
          <div
            key={marker.key}
            className="absolute"
            style={{
              left: marker.left,
              top: marker.top,
            }}
            aria-label={`${marker.name} is editing here`}
            title={`${marker.name} is editing here`}
          >
            <span
              className="absolute left-0 top-0 w-0.5 rounded-full"
              style={{
                height: marker.height,
                backgroundColor: marker.color,
              }}
            />
            <span
              className="absolute left-0 top-0 -translate-x-1/2 -translate-y-[calc(100%+4px)] rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white shadow-sm"
              style={{
                backgroundColor: marker.color,
              }}
            >
              {marker.name}
            </span>
          </div>
        ))}
      </div>
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
            {collaborationCursorPresence}
            {blockPresence}
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
        {collaborationCursorPresence}
        {blockPresence}
        {slashMenu}
        {mentionMenu}
        {inlineEmojiPicker}
      </div>
      {toolbar}
    </div>
  )
}

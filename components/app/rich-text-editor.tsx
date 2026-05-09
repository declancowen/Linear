"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react"
import {
  EditorContent,
  type Editor,
  type JSONContent,
  useEditor,
} from "@tiptap/react"
import { relativePositionToAbsolutePosition } from "@tiptap/y-tiptap"
import Collaboration, { isChangeOrigin } from "@tiptap/extension-collaboration"
import FileHandler from "@tiptap/extension-file-handler"
import type { Node as ProsemirrorNode } from "@tiptap/pm/model"
import * as Y from "yjs"
import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
import {
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
import {
  FullPageRichTextShell,
  useFullPageCanvasWidthPreference,
} from "./rich-text-editor/full-page-shell"
import { getEditorMentionCounts } from "./rich-text-editor/mention-counts"
import {
  areBlockPresenceMarkersEqual,
  areCollaborationCursorMarkersEqual,
  areCollaborationSelectionMarkersEqual,
  sortCollaborationMarkers,
  type BlockPresenceMarker,
  type CollaborationCursorMarker,
  type CollaborationSelectionMarker,
} from "./rich-text-editor/marker-comparison"
import { handleRichTextMenuNavigationKeyDown } from "./rich-text-editor/menu-navigation"
import { uploadRichTextEditorFiles } from "./rich-text-editor/attachment-uploads"
import { type UploadedAttachment } from "./rich-text-editor/attachment-insertion"
import { resolveCollaborationCaretCoordinates } from "./rich-text-editor/caret-position"
import { getClientRectsForDocumentRange } from "./rich-text-editor/collapsed-range"
import {
  createMergedCollaborationAwarenessUser,
  forEachRemoteCollaborationAwarenessUser,
  type CollaborationAwarenessPatch,
} from "./rich-text-editor/collaboration-awareness-users"
import {
  getCollaborationAwarenessPayload,
  type CollaborationAwarenessUser,
} from "./rich-text-editor/collaboration-awareness-user"
import { createSerializedRelativePosition } from "./rich-text-editor/collaboration-relative-position"
import {
  normalizeCollaborationRelativePosition,
  normalizeCollaborationRelativeRange,
  isRecord,
  type CollaborationRelativePositionJson,
  type CollaborationRelativeRange,
} from "./rich-text-editor/collaboration-relative-range"
import {
  getUsableYSyncEditorState,
  getYSyncEditorState,
  hasLiveYSyncMarkerState,
  type UsableYSyncEditorState,
  type YSyncEditorState,
} from "./rich-text-editor/collaboration-y-sync-state"

type EmojiPickerAnchor = {
  left: number
  top: number
}

type RichTextEditorStats = {
  words: number
  characters: number
}

type RichTextEditorValidity = {
  characters: number
  minimum: number
  maximum: number | null
  remaining: number | null
  tooShort: boolean
  tooLong: boolean
  canSubmit: boolean
}

type RichTextMentionCountsChangeSource = "initial" | "local" | "external"

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
  minPlainTextCharacters?: number
  maxPlainTextCharacters?: number
  enforcePlainTextLimit?: boolean
  onValidityChange?: (validity: RichTextEditorValidity) => void
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

type RichTextEditorCollaboration = NonNullable<
  RichTextEditorProps["collaboration"]
>
type CollaborationAwareness =
  RichTextEditorCollaboration["binding"]["provider"]["awareness"]

type CollaborationAbsoluteRange = {
  anchor: number
  head: number
}

type CollaborationMarkerCollectionInput = {
  currentEditor: Editor
  container: HTMLDivElement | null
  collaboration: RichTextEditorCollaboration
  currentPresenceUserId: string | null
}

type CollaborationMarkerMergeInput<TMarker> = {
  collaboration: RichTextEditorCollaboration
  current: TMarker[]
  currentPresenceUserId: string | null
  nextMarkers: TMarker[]
}

const EMPTY_MENTION_CANDIDATES: MentionCandidate[] = []
const TYPING_IDLE_TIMEOUT_MS = 1500
const MAX_VISIBLE_BLOCK_PRESENCE_VIEWERS = 2
const COLLABORATION_CURSOR_LABEL_TOP_THRESHOLD_PX = 28

function getActiveBlockId(currentEditor: Editor) {
  const { $from } = currentEditor.state.selection
  const parentOffset = $from.depth > 0 ? $from.before() : 0

  return `${$from.parent.type.name}:${parentOffset}`
}

function getSelectionRange(currentEditor: Editor) {
  const { anchor, head } = currentEditor.state.selection

  return { anchor, head }
}

function getRelativeSelectionRange(
  currentEditor: Editor
): CollaborationRelativeRange | null {
  const { anchor, head } = currentEditor.state.selection
  const relativeAnchor = createSerializedRelativePosition(currentEditor, anchor)
  const relativeHead = createSerializedRelativePosition(currentEditor, head)

  if (!relativeAnchor || !relativeHead) {
    return null
  }

  return {
    anchor: relativeAnchor,
    head: relativeHead,
  }
}

function updateEditorCollaborationUser(
  currentEditor: Editor,
  collaboration: RichTextEditorProps["collaboration"],
  patch?: CollaborationAwarenessPatch
) {
  if (!collaboration) {
    return
  }

  const localAwarenessUser = getLocalCollaborationAwarenessUser(collaboration)
  const mergedUser = createMergedCollaborationAwarenessUser(
    collaboration,
    localAwarenessUser,
    patch
  )
  const updateUserCommand = getUpdateCollaborationUserCommand(currentEditor)

  if (typeof updateUserCommand === "function") {
    updateUserCommand(mergedUser)
    return
  }

  collaboration.binding.provider.awareness.setLocalStateField(
    "user",
    mergedUser
  )
}

function getLocalCollaborationAwarenessUser(
  collaboration: RichTextEditorCollaboration
) {
  const localAwarenessState =
    collaboration.binding.provider.awareness.getLocalState()

  if (!isRecord(localAwarenessState) || !isRecord(localAwarenessState.user)) {
    return null
  }

  return localAwarenessState.user
}

function getUpdateCollaborationUserCommand<
  TAttributes extends CollaborationAwarenessState,
>(currentEditor: Editor) {
  return (
    currentEditor.commands as {
      updateUser?: (attributes: TAttributes) => boolean
    }
  ).updateUser
}

function updateCurrentEditorCollaborationPresence({
  collaboration,
  currentEditor,
  typing,
}: {
  collaboration: RichTextEditorProps["collaboration"]
  currentEditor: Editor
  typing?: boolean
}) {
  const activeBlockId = getActiveBlockId(currentEditor)
  const selection = getSelectionRange(currentEditor)
  const relativeSelection = getRelativeSelectionRange(currentEditor)

  if (collaboration) {
    updateEditorCollaborationUser(currentEditor, collaboration, {
      ...(typing === undefined ? {} : { typing }),
      activeBlockId,
      cursor: selection,
      selection,
      relativeCursor: relativeSelection,
      relativeSelection,
    })
  }

  return activeBlockId
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

  const viewersByBlockId = getDocumentPresenceViewersByBlockId(input.viewers)

  if (viewersByBlockId.size === 0) {
    return [] as BlockPresenceMarker[]
  }

  const containerRect = container.getBoundingClientRect()
  const markers: BlockPresenceMarker[] = []

  input.currentEditor.state.doc.descendants((node, position) => {
    const marker = getBlockPresenceMarkerAtPosition({
      container,
      containerRect,
      currentEditor: input.currentEditor,
      node,
      position,
      viewersByBlockId,
    })

    if (marker) {
      markers.push(marker)
    }
  })

  return markers
}

function getDocumentPresenceViewersByBlockId(
  viewers: DocumentPresenceViewer[]
) {
  const viewersByBlockId = new Map<
    string,
    Map<string, DocumentPresenceViewer>
  >()

  for (const viewer of viewers) {
    const activeBlockId = viewer.activeBlockId?.trim()

    if (!activeBlockId) {
      continue
    }

    const blockViewerMap =
      viewersByBlockId.get(activeBlockId) ??
      new Map<string, DocumentPresenceViewer>()
    blockViewerMap.set(viewer.userId, viewer)
    viewersByBlockId.set(activeBlockId, blockViewerMap)
  }

  return viewersByBlockId
}

function getBlockPresenceMarkerAtPosition(input: {
  container: HTMLDivElement
  containerRect: DOMRect
  currentEditor: Editor
  node: ProsemirrorNode
  position: number
  viewersByBlockId: Map<string, Map<string, DocumentPresenceViewer>>
}): BlockPresenceMarker | null {
  if (!input.node.isBlock) {
    return null
  }

  const blockId = `${input.node.type.name}:${input.position}`
  const blockViewers = getBlockPresenceViewers(
    input.viewersByBlockId.get(blockId)
  )

  if (blockViewers.length === 0) {
    return null
  }

  const blockNode = getBlockPresenceDomNode(input.currentEditor, input.position)

  if (!blockNode) {
    return null
  }

  const blockRect = blockNode.getBoundingClientRect()

  return {
    blockId,
    top:
      blockRect.top -
      input.containerRect.top +
      input.container.scrollTop +
      Math.max(0, (blockRect.height - 18) / 2),
    viewers: blockViewers,
  }
}

function getBlockPresenceViewers(
  blockViewerMap: Map<string, DocumentPresenceViewer> | undefined
) {
  return blockViewerMap ? Array.from(blockViewerMap.values()) : []
}

function getBlockPresenceDomNode(currentEditor: Editor, position: number) {
  try {
    const blockNode = currentEditor.view.nodeDOM(position)

    return blockNode instanceof HTMLElement ? blockNode : null
  } catch {
    return null
  }
}

function resolveCollaborationRelativePosition(
  currentEditor: Editor,
  value: unknown
) {
  const json = normalizeCollaborationRelativePosition(value)
  const yState = getUsableYSyncEditorState(currentEditor)

  if (!json || !yState) {
    return null
  }

  return resolveYRelativePositionToAbsolute(yState, json)
}

function resolveYRelativePositionToAbsolute(
  yState: UsableYSyncEditorState,
  json: unknown
) {
  try {
    const relativePosition = Y.createRelativePositionFromJSON(json)

    if (!relativePosition) {
      return null
    }

    const absolutePosition = relativePositionToAbsolutePosition(
      yState.doc,
      yState.type,
      relativePosition,
      yState.binding.mapping
    )

    return typeof absolutePosition === "number" ? absolutePosition : null
  } catch {
    return null
  }
}

function getCollaborationAwarenessCursorHead(
  currentEditor: Editor,
  value: unknown
) {
  const userValue = getCollaborationAwarenessPayload(value)

  if (!userValue) {
    return null
  }

  const relativeCursor = normalizeCollaborationRelativeRange(
    userValue.relativeCursor
  )
  const relativeHead = resolveCollaborationAwarenessPosition(
    currentEditor,
    relativeCursor?.head,
    isResolvedAwarenessCursorPosition
  )

  if (relativeHead !== null) {
    return relativeHead
  }

  return getCollaborationAwarenessCursorPosition(userValue.cursor)
}

function getCollaborationAwarenessCursorPosition(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  const { head } = value

  return isValidAwarenessPosition(head) ? head : null
}

function isValidAwarenessPosition(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

function isResolvedAwarenessCursorPosition(value: unknown): value is number {
  return typeof value === "number"
}

function resolveCollaborationAwarenessPosition(
  currentEditor: Editor,
  relativePosition: CollaborationRelativePositionJson | null | undefined,
  isValidPosition: (
    value: unknown
  ) => value is number = isValidAwarenessPosition
) {
  if (!relativePosition) {
    return null
  }

  const resolvedPosition = resolveCollaborationRelativePosition(
    currentEditor,
    relativePosition
  )

  return isValidPosition(resolvedPosition) ? resolvedPosition : null
}

function resolveCollaborationAwarenessRange(
  currentEditor: Editor,
  relativeRange: CollaborationRelativeRange | null
): CollaborationAbsoluteRange | null {
  if (!relativeRange) {
    return null
  }

  const anchor = resolveCollaborationAwarenessPosition(
    currentEditor,
    relativeRange.anchor
  )
  const head = resolveCollaborationAwarenessPosition(
    currentEditor,
    relativeRange.head
  )

  if (anchor === null || head === null) {
    return null
  }

  return { anchor, head }
}

function getAbsoluteCollaborationAwarenessRange(
  value: unknown
): CollaborationAbsoluteRange | null {
  if (!isRecord(value)) {
    return null
  }

  const { anchor, head } = value

  if (!isValidAwarenessPosition(anchor) || !isValidAwarenessPosition(head)) {
    return null
  }

  return { anchor, head }
}

function getCollaborationAwarenessSelectionRange(
  currentEditor: Editor,
  value: unknown
) {
  const userValue = getCollaborationAwarenessPayload(value)

  if (!userValue) {
    return null
  }

  return (
    resolveCollaborationAwarenessRange(
      currentEditor,
      normalizeCollaborationRelativeRange(userValue.relativeSelection)
    ) ?? getAbsoluteCollaborationAwarenessRange(userValue.selection)
  )
}

function collectActiveCollaborationMarkerKeys(input: {
  collaboration: NonNullable<RichTextEditorProps["collaboration"]>
  currentPresenceUserId: string | null
}) {
  const activeKeys = new Set<string>()
  forEachRemoteCollaborationAwarenessUser(input, (_value, clientId, user) => {
    activeKeys.add(`${clientId}:${user.sessionId}`)
  })

  return activeKeys
}

function collectCollaborationCursorMarkers(
  input: CollaborationMarkerCollectionInput
) {
  const container = input.container
  const yState = getYSyncEditorState(input.currentEditor)

  if (!container || !canCollectCollaborationMarkers(yState)) {
    return [] as CollaborationCursorMarker[]
  }

  const containerRect = container.getBoundingClientRect()
  const markers: CollaborationCursorMarker[] = []
  const maxDocumentPosition = getMaxDocumentPosition(input.currentEditor)

  forEachRemoteCollaborationAwarenessUser(input, (value, clientId, user) => {
    const marker = createCollaborationCursorMarker({
      clientId,
      container,
      containerRect,
      currentEditor: input.currentEditor,
      maxDocumentPosition,
      user,
      value,
    })

    if (marker) {
      markers.push(marker)
    }
  })

  return sortCollaborationMarkers(markers)
}

function canCollectCollaborationMarkers(yState: YSyncEditorState | undefined) {
  return (
    hasLiveYSyncMarkerState(yState) && hasCollaborationPositionMapping(yState)
  )
}

function hasCollaborationPositionMapping(yState: YSyncEditorState | undefined) {
  return Boolean(yState?.binding && yState.binding.mapping.size > 0)
}

function getMaxDocumentPosition(currentEditor: Editor) {
  return Math.max(currentEditor.state.doc.content.size, 0)
}

function createCollaborationCursorMarker(input: {
  clientId: number
  container: HTMLElement
  containerRect: DOMRect
  currentEditor: Editor
  maxDocumentPosition: number
  user: CollaborationAwarenessUser
  value: unknown
}): CollaborationCursorMarker | null {
  const head = getCollaborationAwarenessCursorHeadInBounds(input)

  if (head === null) {
    return null
  }

  const coordinates = safelyResolveCollaborationCaretCoordinates(
    input.currentEditor,
    head
  )

  return coordinates ? buildCollaborationCursorMarker(input, coordinates) : null
}

function getCollaborationAwarenessCursorHeadInBounds(input: {
  currentEditor: Editor
  maxDocumentPosition: number
  value: unknown
}) {
  const head = getCollaborationAwarenessCursorHead(
    input.currentEditor,
    input.value
  )

  if (typeof head !== "number") {
    return null
  }

  return head <= input.maxDocumentPosition ? head : null
}

function safelyResolveCollaborationCaretCoordinates(
  currentEditor: Editor,
  head: number
) {
  try {
    return resolveCollaborationCaretCoordinates(currentEditor, head)
  } catch {
    return null
  }
}

function buildCollaborationCursorMarker(
  input: {
    clientId: number
    container: HTMLElement
    containerRect: DOMRect
    user: CollaborationAwarenessUser
  },
  coordinates: Pick<DOMRect, "bottom" | "left" | "top">
): CollaborationCursorMarker {
  return {
    key: `${input.clientId}:${input.user.sessionId}`,
    name: input.user.name,
    color: input.user.color,
    left: Math.round(
      coordinates.left - input.containerRect.left + input.container.scrollLeft
    ),
    top: Math.round(
      coordinates.top - input.containerRect.top + input.container.scrollTop
    ),
    height: Math.max(18, Math.round(coordinates.bottom - coordinates.top)),
  }
}

function collectCollaborationSelectionMarkers(
  input: CollaborationMarkerCollectionInput
) {
  const container = input.container

  if (!container) {
    return [] as CollaborationSelectionMarker[]
  }

  const containerRect = container.getBoundingClientRect()
  const markers: CollaborationSelectionMarker[] = []
  const maxDocumentPosition = Math.max(
    input.currentEditor.state.doc.content.size,
    0
  )

  forEachRemoteCollaborationAwarenessUser(input, (value, clientId, user) => {
    const selection = getCollaborationAwarenessSelectionRange(
      input.currentEditor,
      value
    )

    if (!selection || selection.anchor === selection.head) {
      return
    }

    const start = Math.min(selection.anchor, selection.head)
    const end = Math.min(
      Math.max(selection.anchor, selection.head),
      maxDocumentPosition
    )

    if (start === end) {
      return
    }

    const clientRects = getClientRectsForDocumentRange(
      input.currentEditor,
      start,
      end
    )

    clientRects.forEach((rect, index) => {
      markers.push({
        key: `${clientId}:${user.sessionId}:${index}`,
        color: user.color,
        left: Math.round(rect.left - containerRect.left + container.scrollLeft),
        top: Math.round(rect.top - containerRect.top + container.scrollTop),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      })
    })
  })

  return sortCollaborationMarkers(markers)
}

type RichTextSlashCommandOptions = Parameters<typeof filterSlashCommands>[1]

type RichTextKeyboardMenuState = {
  container: HTMLDivElement | null
  currentEditor: Editor
  event: KeyboardEvent
}

function handleSlashMenuKeyDown({
  container,
  currentEditor,
  currentSlashState,
  event,
  previousSlashQueryRef,
  setSlashIndex,
  setSlashState,
  slashIndex,
  slashOptions,
}: RichTextKeyboardMenuState & {
  currentSlashState: MenuState | null
  previousSlashQueryRef: MutableRefObject<string | null>
  setSlashIndex: Dispatch<SetStateAction<number>>
  setSlashState: (state: MenuState | null) => void
  slashIndex: number
  slashOptions: RichTextSlashCommandOptions
}) {
  if (!currentSlashState) {
    return null
  }

  const nextCommands = filterSlashCommands(
    currentSlashState.query,
    slashOptions
  )
  const maxSlashIndex = Math.max(nextCommands.length - 1, 0)

  const navigationResult = handleRichTextMenuNavigationKeyDown({
    event,
    maxIndex: maxSlashIndex,
    onEscape: () => {
      setSlashState(null)
      previousSlashQueryRef.current = null
    },
    onEnter: () =>
      selectSlashMenuCommand({
        currentEditor,
        currentSlashState,
        event,
        nextCommands,
        setSlashIndex,
        setSlashState,
        slashIndex,
      }),
    setIndex: setSlashIndex,
  })

  if (navigationResult !== null) {
    return navigationResult
  }

  const nextSlashState = buildSlashState(currentEditor, container)
  if (!nextSlashState) {
    setSlashState(null)
    setSlashIndex(0)
    previousSlashQueryRef.current = null
  }

  return false
}

function selectSlashMenuCommand(input: {
  currentEditor: Editor
  currentSlashState: MenuState
  event: KeyboardEvent
  nextCommands: ReturnType<typeof filterSlashCommands>
  setSlashIndex: Dispatch<SetStateAction<number>>
  setSlashState: (state: MenuState | null) => void
  slashIndex: number
}) {
  const selected =
    input.nextCommands[
      Math.min(input.slashIndex, input.nextCommands.length - 1)
    ] ?? input.nextCommands[0]

  if (!selected) {
    return false
  }

  input.event.preventDefault()
  input.currentEditor
    .chain()
    .focus()
    .deleteRange({
      from: input.currentSlashState.from,
      to: input.currentSlashState.to,
    })
    .run()
  selected.run(input.currentEditor)
  input.setSlashState(null)
  input.setSlashIndex(0)

  return true
}

function handleMentionMenuKeyDown({
  container,
  currentEditor,
  currentMentionState,
  event,
  mentionCandidates,
  mentionIndex,
  onMentionInsertedRef,
  previousMentionQueryRef,
  setMentionIndex,
  setMentionState,
}: RichTextKeyboardMenuState & {
  currentMentionState: MenuState | null
  mentionCandidates: MentionCandidate[]
  mentionIndex: number
  onMentionInsertedRef: MutableRefObject<
    RichTextEditorProps["onMentionInserted"]
  >
  previousMentionQueryRef: MutableRefObject<string | null>
  setMentionIndex: Dispatch<SetStateAction<number>>
  setMentionState: (state: MenuState | null) => void
}) {
  if (!currentMentionState) {
    return null
  }

  const nextCandidates = filterMentionCandidates(
    currentMentionState.query,
    mentionCandidates
  )
  const maxMentionIndex = Math.max(nextCandidates.length - 1, 0)

  const navigationResult = handleRichTextMenuNavigationKeyDown({
    event,
    maxIndex: maxMentionIndex,
    onEscape: () => {
      setMentionState(null)
      previousMentionQueryRef.current = null
    },
    onEnter: () =>
      selectMentionMenuCandidate({
        currentEditor,
        currentMentionState,
        event,
        mentionIndex,
        nextCandidates,
        onMentionInsertedRef,
        setMentionIndex,
        setMentionState,
      }),
    setIndex: setMentionIndex,
  })

  if (navigationResult !== null) {
    return navigationResult
  }

  const nextMentionState = buildMentionState(currentEditor, container)
  if (!nextMentionState) {
    setMentionState(null)
    setMentionIndex(0)
    previousMentionQueryRef.current = null
  }

  return false
}

function selectMentionMenuCandidate(input: {
  currentEditor: Editor
  currentMentionState: MenuState
  event: KeyboardEvent
  mentionIndex: number
  nextCandidates: MentionCandidate[]
  onMentionInsertedRef: MutableRefObject<
    RichTextEditorProps["onMentionInserted"]
  >
  setMentionIndex: Dispatch<SetStateAction<number>>
  setMentionState: (state: MenuState | null) => void
}) {
  const selected =
    input.nextCandidates[
      Math.min(input.mentionIndex, input.nextCandidates.length - 1)
    ] ?? input.nextCandidates[0]

  if (!selected) {
    return false
  }

  input.event.preventDefault()
  insertMention(input.currentEditor, input.currentMentionState, selected)
  input.onMentionInsertedRef.current?.(selected)
  input.setMentionState(null)
  input.setMentionIndex(0)

  return true
}

function handleSubmitShortcutKeyDown({
  event,
  onSubmitShortcut,
  submitOnEnter,
}: {
  event: KeyboardEvent
  onSubmitShortcut?: () => void
  submitOnEnter: boolean
}) {
  if (!onSubmitShortcut) {
    return false
  }

  if (isPlainEnterSubmitShortcut({ event, submitOnEnter })) {
    event.preventDefault()
    onSubmitShortcut()
    return true
  }

  if (isModifiedEnterSubmitShortcut(event)) {
    event.preventDefault()
    onSubmitShortcut()
    return true
  }

  return false
}

function isPlainEnterSubmitShortcut(input: {
  event: KeyboardEvent
  submitOnEnter: boolean
}) {
  return (
    input.submitOnEnter && input.event.key === "Enter" && !input.event.shiftKey
  )
}

function isModifiedEnterSubmitShortcut(event: KeyboardEvent) {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey)
}

function handleRichTextEditorKeyDown({
  allowSlashCommands,
  container,
  currentEditor,
  event,
  mentionCandidates,
  mentionIndex,
  mentionState,
  onMentionInsertedRef,
  onSubmitShortcut,
  onUploadAttachment,
  previousMentionQueryRef,
  previousSlashQueryRef,
  requestAttachmentPicker,
  requestEmojiPicker,
  requestImagePicker,
  setMentionIndex,
  setMentionState,
  setSlashIndex,
  setSlashState,
  slashIndex,
  slashState,
  submitOnEnter,
}: RichTextKeyboardMenuState & {
  allowSlashCommands: boolean
  mentionCandidates: MentionCandidate[]
  mentionIndex: number
  mentionState: MenuState | null
  onMentionInsertedRef: MutableRefObject<
    RichTextEditorProps["onMentionInserted"]
  >
  onSubmitShortcut?: () => void
  onUploadAttachment: RichTextEditorProps["onUploadAttachment"]
  previousMentionQueryRef: MutableRefObject<string | null>
  previousSlashQueryRef: MutableRefObject<string | null>
  requestAttachmentPicker: (currentEditor: Editor) => void
  requestEmojiPicker: (
    currentEditor: Editor,
    anchor?: EmojiPickerAnchor | null
  ) => void
  requestImagePicker: (currentEditor: Editor) => void
  setMentionIndex: Dispatch<SetStateAction<number>>
  setMentionState: (state: MenuState | null) => void
  setSlashIndex: Dispatch<SetStateAction<number>>
  setSlashState: (state: MenuState | null) => void
  slashIndex: number
  slashState: MenuState | null
  submitOnEnter: boolean
}) {
  const currentSlashState = allowSlashCommands ? slashState : null
  const slashResult = handleSlashMenuKeyDown({
    container,
    currentEditor,
    currentSlashState,
    event,
    previousSlashQueryRef,
    setSlashIndex,
    setSlashState,
    slashIndex,
    slashOptions: {
      enableUploads: Boolean(onUploadAttachment),
      promptEmojiPicker: (nextEditor) =>
        requestEmojiPicker(nextEditor, currentSlashState),
      promptAttachmentUpload: requestAttachmentPicker,
      promptImageUpload: requestImagePicker,
    },
  })

  if (slashResult !== null) {
    return slashResult
  }

  const mentionResult = handleMentionMenuKeyDown({
    container,
    currentEditor,
    currentMentionState: mentionState,
    event,
    mentionCandidates,
    mentionIndex,
    onMentionInsertedRef,
    previousMentionQueryRef,
    setMentionIndex,
    setMentionState,
  })

  if (mentionResult !== null) {
    return mentionResult
  }

  return handleSubmitShortcutKeyDown({
    event,
    onSubmitShortcut,
    submitOnEnter,
  })
}

function getRichTextEditorClassName({
  compact,
  fullPage,
}: {
  compact: boolean
  fullPage: boolean
}) {
  if (fullPage) {
    return "min-h-[calc(100svh-12rem)] text-base outline-none [&_h1]:mt-0 [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:leading-tight [&_h1]:font-bold [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:leading-tight [&_h2]:font-semibold [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:leading-tight [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mt-0 [&_p]:leading-7 [&_p+p]:mt-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
  }

  if (compact) {
    return "min-h-16 text-sm outline-none [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:leading-tight [&_h1]:font-semibold [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:leading-tight [&_h2]:font-semibold [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:leading-tight [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mt-0 [&_p]:leading-6 [&_p+p]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
  }

  return "min-h-24 text-sm outline-none [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:leading-tight [&_h1]:font-semibold [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:leading-tight [&_h2]:font-semibold [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:leading-tight [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mt-0 [&_p]:leading-7 [&_p+p]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
}

function getVisiblePresenceViewers({
  currentPresenceUserId,
  presenceViewers,
}: {
  currentPresenceUserId: string | null
  presenceViewers: DocumentPresenceViewer[]
}) {
  return currentPresenceUserId
    ? presenceViewers.filter(
        (viewer) => viewer.userId !== currentPresenceUserId
      )
    : presenceViewers
}

function InlineEmojiPickerOverlay({
  anchor,
  containerWidth,
  currentEditor,
  editable,
  open,
  onOpenChange,
}: {
  anchor: EmojiPickerAnchor | null
  containerWidth: number
  currentEditor: Editor
  editable: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!editable || !anchor) {
    return null
  }

  return (
    <div
      className="absolute z-20"
      style={{
        left: Math.min(
          Math.max(12, anchor.left),
          Math.max(12, containerWidth - 24)
        ),
        top: anchor.top,
      }}
    >
      <EmojiPickerPopover
        align="start"
        side="bottom"
        open={open}
        onOpenChange={onOpenChange}
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
  )
}

function BlockPresenceOverlay({
  collaboration,
  markers,
}: {
  collaboration: RichTextEditorProps["collaboration"]
  markers: BlockPresenceMarker[]
}) {
  if (collaboration || markers.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {markers.map((marker) => {
        const viewerNames = marker.viewers
          .map((viewer) => viewer.name)
          .join(", ")

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
                  {`+${marker.viewers.length - MAX_VISIBLE_BLOCK_PRESENCE_VIEWERS}`}
                </span>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CollaborationCursorPresenceOverlay({
  collaboration,
  markers,
}: {
  collaboration: RichTextEditorProps["collaboration"]
  markers: CollaborationCursorMarker[]
}) {
  if (!collaboration || markers.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {markers.map((marker) => {
        const showLabelBelow =
          marker.top < COLLABORATION_CURSOR_LABEL_TOP_THRESHOLD_PX

        return (
          <div
            key={marker.key}
            className="absolute"
            style={{ left: marker.left, top: marker.top }}
            aria-label={`${marker.name} is editing here`}
            title={`${marker.name} is editing here`}
          >
            <span
              className="absolute top-0 left-0 w-0.5 rounded-full"
              style={{
                height: marker.height,
                backgroundColor: marker.color,
              }}
            />
            <span
              className={cn(
                "absolute left-0 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white shadow-sm",
                showLabelBelow
                  ? "-translate-x-1/2"
                  : "-translate-x-1/2 -translate-y-[calc(100%+4px)]"
              )}
              style={{
                top: showLabelBelow ? marker.height + 4 : 0,
                backgroundColor: marker.color,
              }}
            >
              {marker.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function CollaborationSelectionPresenceOverlay({
  collaboration,
  markers,
}: {
  collaboration: RichTextEditorProps["collaboration"]
  markers: CollaborationSelectionMarker[]
}) {
  if (!collaboration || markers.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {markers.map((marker) => (
        <div
          key={marker.key}
          className="absolute rounded-[3px]"
          style={{
            left: marker.left,
            top: marker.top,
            width: marker.width,
            height: marker.height,
            backgroundColor: `${marker.color}22`,
          }}
        />
      ))}
    </div>
  )
}

function RichTextEditorSurface({
  blockPresence,
  className,
  collaborationCursorPresence,
  collaborationSelectionPresence,
  containerRef,
  currentEditor,
  fullPage,
  fullPageCanvasWidth,
  inlineEmojiPicker,
  mentionMenu,
  onInlineMouseDownCapture,
  slashMenu,
  toolbar,
}: {
  blockPresence: ReactNode
  className?: string
  collaborationCursorPresence: ReactNode
  collaborationSelectionPresence: ReactNode
  containerRef: MutableRefObject<HTMLDivElement | null>
  currentEditor: Editor
  fullPage: boolean
  fullPageCanvasWidth: FullPageCanvasWidth
  inlineEmojiPicker: ReactNode
  mentionMenu: ReactNode
  onInlineMouseDownCapture: (event: MouseEvent<HTMLDivElement>) => void
  slashMenu: ReactNode
  toolbar: ReactNode
}) {
  if (fullPage) {
    return (
      <FullPageRichTextShell
        canvasWidth={fullPageCanvasWidth}
        className={className}
        containerRef={containerRef}
        toolbar={toolbar}
      >
        <EditorContent editor={currentEditor} />
        {collaborationSelectionPresence}
        {collaborationCursorPresence}
        {blockPresence}
        {slashMenu}
        {mentionMenu}
        {inlineEmojiPicker}
      </FullPageRichTextShell>
    )
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className="relative"
        onMouseDownCapture={onInlineMouseDownCapture}
        ref={containerRef}
      >
        <EditorContent editor={currentEditor} />
        {collaborationSelectionPresence}
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

type RichTextEditorBodyProps = {
  allowSlashCommands: boolean
  blockPresenceMarkers: BlockPresenceMarker[]
  className?: string
  collaboration: RichTextEditorCollaboration | undefined
  collaborationCursorMarkers: CollaborationCursorMarker[]
  collaborationSelectionMarkers: CollaborationSelectionMarker[]
  containerRef: MutableRefObject<HTMLDivElement | null>
  containerWidth: number
  currentEditor: Editor | null
  editable: boolean
  emojiPickerAnchor: EmojiPickerAnchor | null
  emojiPickerOpen: boolean
  filteredMentionCandidates: MentionCandidate[]
  filteredSlashCommands: ReturnType<typeof filterSlashCommands>
  fullPage: boolean
  fullPageCanvasWidth: FullPageCanvasWidth
  handleToolbarFiles: (files: File[], position?: number | null) => Promise<void>
  hiddenAttachmentInputRef: MutableRefObject<HTMLInputElement | null>
  hiddenImageInputRef: MutableRefObject<HTMLInputElement | null>
  mentionIndex: number
  mentionMenuPlacement: "above" | "below"
  mentionState: MenuState | null
  onMentionInserted: RichTextEditorProps["onMentionInserted"]
  pickerInsertPosition: number | null
  previousMentionQueryRef: MutableRefObject<string | null>
  previousSlashQueryRef: MutableRefObject<string | null>
  requestAttachmentPicker: (currentEditor: Editor) => void
  requestImagePicker: (currentEditor: Editor) => void
  setEmojiPickerAnchor: Dispatch<SetStateAction<EmojiPickerAnchor | null>>
  setEmojiPickerOpen: Dispatch<SetStateAction<boolean>>
  setFullPageCanvasWidth: Dispatch<SetStateAction<FullPageCanvasWidth>>
  setMentionIndex: Dispatch<SetStateAction<number>>
  setMentionState: Dispatch<SetStateAction<MenuState | null>>
  setSlashIndex: Dispatch<SetStateAction<number>>
  setSlashState: Dispatch<SetStateAction<MenuState | null>>
  showStats: boolean
  showToolbar: boolean
  slashIndex: number
  slashState: MenuState | null
  statsCharacters: number
  statsWords: number
  uploadingAttachment: boolean
  uploadsEnabled: boolean
}

function getActiveMenuIndex(itemCount: number, requestedIndex: number) {
  return itemCount === 0 ? 0 : Math.min(requestedIndex, itemCount - 1)
}

function shouldFocusEmptyEditorFromInlineMouseDown(
  event: MouseEvent<HTMLDivElement>,
  activeEditor: Editor
) {
  if (event.button !== 0 || !activeEditor.isEmpty) {
    return false
  }

  const target = event.target instanceof HTMLElement ? event.target : null

  return !target?.closest('button, a, input, textarea, label, [role="button"]')
}

function createInlineEditorMouseDownCapture(activeEditor: Editor) {
  return (event: MouseEvent<HTMLDivElement>) => {
    if (!shouldFocusEmptyEditorFromInlineMouseDown(event, activeEditor)) {
      return
    }

    window.requestAnimationFrame(() => {
      activeEditor.commands.focus("end")
    })
  }
}

function getRichTextToolbarNode(
  input: Pick<
    RichTextEditorBodyProps,
    | "editable"
    | "fullPage"
    | "fullPageCanvasWidth"
    | "handleToolbarFiles"
    | "hiddenAttachmentInputRef"
    | "hiddenImageInputRef"
    | "pickerInsertPosition"
    | "requestAttachmentPicker"
    | "requestImagePicker"
    | "setFullPageCanvasWidth"
    | "showStats"
    | "showToolbar"
    | "statsCharacters"
    | "statsWords"
    | "uploadsEnabled"
    | "uploadingAttachment"
  > & {
    activeEditor: Editor
  }
) {
  if (!input.showToolbar) {
    return null
  }

  return (
    <RichTextToolbar
      editable={input.editable}
      editor={input.activeEditor}
      fullPage={input.fullPage}
      fullPageCanvasWidth={input.fullPageCanvasWidth}
      handleFiles={input.handleToolbarFiles}
      hiddenAttachmentInputRef={input.hiddenAttachmentInputRef}
      hiddenImageInputRef={input.hiddenImageInputRef}
      pickerInsertPosition={input.pickerInsertPosition}
      requestAttachmentPicker={input.requestAttachmentPicker}
      requestImagePicker={input.requestImagePicker}
      setFullPageCanvasWidth={input.setFullPageCanvasWidth}
      showStats={input.showStats}
      statsCharacters={input.statsCharacters}
      statsWords={input.statsWords}
      toolbarWidthClassName={
        FULL_PAGE_CANVAS_WIDTH_CLASSNAME[input.fullPageCanvasWidth]
      }
      uploadsEnabled={input.uploadsEnabled}
      uploadingAttachment={input.uploadingAttachment}
    />
  )
}

function getInlineEmojiPickerNode(
  input: Pick<
    RichTextEditorBodyProps,
    | "containerWidth"
    | "editable"
    | "emojiPickerAnchor"
    | "emojiPickerOpen"
    | "setEmojiPickerAnchor"
    | "setEmojiPickerOpen"
  > & {
    activeEditor: Editor
  }
) {
  return (
    <InlineEmojiPickerOverlay
      anchor={input.emojiPickerAnchor}
      containerWidth={input.containerWidth}
      currentEditor={input.activeEditor}
      editable={input.editable}
      open={input.emojiPickerOpen}
      onOpenChange={(open) => {
        input.setEmojiPickerOpen(open)
        if (!open) {
          input.setEmojiPickerAnchor(null)
        }
      }}
    />
  )
}

function getSlashCommandMenuNode(
  input: Pick<
    RichTextEditorBodyProps,
    | "allowSlashCommands"
    | "containerWidth"
    | "filteredSlashCommands"
    | "previousSlashQueryRef"
    | "setSlashIndex"
    | "setSlashState"
    | "slashIndex"
    | "slashState"
  > & {
    activeEditor: Editor
  }
) {
  if (!input.allowSlashCommands || !input.slashState) {
    return null
  }

  return (
    <SlashCommandMenu
      activeIndex={getActiveMenuIndex(
        input.filteredSlashCommands.length,
        input.slashIndex
      )}
      commands={input.filteredSlashCommands}
      containerWidth={input.containerWidth}
      editor={input.activeEditor}
      state={input.slashState}
      onComplete={() => {
        input.setSlashState(null)
        input.setSlashIndex(0)
        input.previousSlashQueryRef.current = null
      }}
    />
  )
}

function getMentionMenuNode(
  input: Pick<
    RichTextEditorBodyProps,
    | "containerWidth"
    | "filteredMentionCandidates"
    | "mentionIndex"
    | "mentionMenuPlacement"
    | "mentionState"
    | "onMentionInserted"
    | "previousMentionQueryRef"
    | "setMentionIndex"
    | "setMentionState"
  > & {
    activeEditor: Editor
  }
) {
  if (!input.mentionState) {
    return null
  }

  return (
    <MentionMenu
      activeIndex={getActiveMenuIndex(
        input.filteredMentionCandidates.length,
        input.mentionIndex
      )}
      candidates={input.filteredMentionCandidates}
      containerWidth={input.containerWidth}
      editor={input.activeEditor}
      placement={input.mentionMenuPlacement}
      state={input.mentionState}
      onSelectCandidate={input.onMentionInserted}
      onComplete={() => {
        input.setMentionState(null)
        input.setMentionIndex(0)
        input.previousMentionQueryRef.current = null
      }}
    />
  )
}

function RichTextEditorBody({
  allowSlashCommands,
  blockPresenceMarkers,
  className,
  collaboration,
  collaborationCursorMarkers,
  collaborationSelectionMarkers,
  containerRef,
  containerWidth,
  currentEditor,
  editable,
  emojiPickerAnchor,
  emojiPickerOpen,
  filteredMentionCandidates,
  filteredSlashCommands,
  fullPage,
  fullPageCanvasWidth,
  handleToolbarFiles,
  hiddenAttachmentInputRef,
  hiddenImageInputRef,
  mentionIndex,
  mentionMenuPlacement,
  mentionState,
  onMentionInserted,
  pickerInsertPosition,
  previousMentionQueryRef,
  previousSlashQueryRef,
  requestAttachmentPicker,
  requestImagePicker,
  setEmojiPickerAnchor,
  setEmojiPickerOpen,
  setFullPageCanvasWidth,
  setMentionIndex,
  setMentionState,
  setSlashIndex,
  setSlashState,
  showStats,
  showToolbar,
  slashIndex,
  slashState,
  statsCharacters,
  statsWords,
  uploadingAttachment,
  uploadsEnabled,
}: RichTextEditorBodyProps) {
  if (!currentEditor) {
    return null
  }

  const activeEditor = currentEditor
  const toolbar = getRichTextToolbarNode({
    activeEditor,
    editable,
    fullPage,
    fullPageCanvasWidth,
    handleToolbarFiles,
    hiddenAttachmentInputRef,
    hiddenImageInputRef,
    pickerInsertPosition,
    requestAttachmentPicker,
    requestImagePicker,
    setFullPageCanvasWidth,
    showStats,
    showToolbar,
    statsCharacters,
    statsWords,
    uploadsEnabled,
    uploadingAttachment,
  })
  const inlineEmojiPicker = getInlineEmojiPickerNode({
    activeEditor,
    containerWidth,
    editable,
    emojiPickerAnchor,
    emojiPickerOpen,
    setEmojiPickerAnchor,
    setEmojiPickerOpen,
  })
  const slashMenu = getSlashCommandMenuNode({
    activeEditor,
    allowSlashCommands,
    containerWidth,
    filteredSlashCommands,
    previousSlashQueryRef,
    setSlashIndex,
    setSlashState,
    slashIndex,
    slashState,
  })
  const mentionMenu = getMentionMenuNode({
    activeEditor,
    containerWidth,
    filteredMentionCandidates,
    mentionIndex,
    mentionMenuPlacement,
    mentionState,
    onMentionInserted,
    previousMentionQueryRef,
    setMentionIndex,
    setMentionState,
  })

  const blockPresence = (
    <BlockPresenceOverlay
      collaboration={collaboration}
      markers={blockPresenceMarkers}
    />
  )
  const collaborationCursorPresence = (
    <CollaborationCursorPresenceOverlay
      collaboration={collaboration}
      markers={collaborationCursorMarkers}
    />
  )
  const collaborationSelectionPresence = (
    <CollaborationSelectionPresenceOverlay
      collaboration={collaboration}
      markers={collaborationSelectionMarkers}
    />
  )

  return (
    <RichTextEditorSurface
      blockPresence={blockPresence}
      className={className}
      collaborationCursorPresence={collaborationCursorPresence}
      collaborationSelectionPresence={collaborationSelectionPresence}
      containerRef={containerRef}
      currentEditor={activeEditor}
      fullPage={fullPage}
      fullPageCanvasWidth={fullPageCanvasWidth}
      inlineEmojiPicker={inlineEmojiPicker}
      mentionMenu={mentionMenu}
      onInlineMouseDownCapture={createInlineEditorMouseDownCapture(
        activeEditor
      )}
      slashMenu={slashMenu}
      toolbar={toolbar}
    />
  )
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref
}

function useRichTextContainerWidth({
  containerRef,
  fullPage,
}: {
  containerRef: MutableRefObject<HTMLDivElement | null>
  fullPage: boolean
}) {
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
  }, [containerRef, fullPage])

  return containerWidth
}

function useForwardedEditorInstance({
  editor,
  editorRef,
  editorInstanceRef,
}: {
  editor: Editor | null
  editorRef: MutableRefObject<Editor | null>
  editorInstanceRef: MutableRefObject<Editor | null> | undefined
}) {
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
  }, [editor, editorInstanceRef, editorRef])
}

function useExternalRichTextContentSync({
  collaboration,
  editor,
  onMentionCountsChangeRef,
  sanitizedStringContent,
}: {
  collaboration: RichTextEditorCollaboration | undefined
  editor: Editor | null
  onMentionCountsChangeRef: MutableRefObject<
    RichTextEditorProps["onMentionCountsChange"]
  >
  sanitizedStringContent: string | null
}) {
  useEffect(() => {
    syncExternalRichTextContent({
      collaboration,
      editor,
      onMentionCountsChangeRef,
      sanitizedStringContent,
    })
  }, [collaboration, editor, onMentionCountsChangeRef, sanitizedStringContent])
}

function syncExternalRichTextContent({
  collaboration,
  editor,
  onMentionCountsChangeRef,
  sanitizedStringContent,
}: {
  collaboration: RichTextEditorCollaboration | undefined
  editor: Editor | null
  onMentionCountsChangeRef: MutableRefObject<
    RichTextEditorProps["onMentionCountsChange"]
  >
  sanitizedStringContent: string | null
}) {
  if (!canSyncExternalRichTextContent(collaboration, editor)) {
    return
  }

  const nextContent = getExternalRichTextContentUpdate(
    editor,
    sanitizedStringContent
  )

  if (nextContent === null) {
    return
  }

  applyExternalRichTextContent(editor, nextContent)
  onMentionCountsChangeRef.current?.(getEditorMentionCounts(editor), "external")
}

function canSyncExternalRichTextContent(
  collaboration: RichTextEditorCollaboration | undefined,
  editor: Editor | null
): editor is Editor {
  return Boolean(editor && !collaboration)
}

function getExternalRichTextContentUpdate(
  editor: Editor,
  sanitizedStringContent: string | null
) {
  const contentIsCurrent =
    sanitizedStringContent === null ||
    editor.getHTML() === sanitizedStringContent ||
    editor.isFocused

  return contentIsCurrent ? null : sanitizedStringContent
}

function applyExternalRichTextContent(
  editor: Editor,
  sanitizedStringContent: string
) {
  editor.commands.setContent(sanitizedStringContent, {
    emitUpdate: false,
  })
}

function useInitialCollaborationPresenceSync({
  collaboration,
  editor,
  reportActiveBlockId,
}: {
  collaboration: RichTextEditorCollaboration | undefined
  editor: Editor | null
  reportActiveBlockId: (activeBlockId: string | null) => void
}) {
  useEffect(() => {
    if (!editor || !collaboration) {
      return
    }

    const activeBlockId = getActiveBlockId(editor)
    const selection = getSelectionRange(editor)
    const relativeSelection = getRelativeSelectionRange(editor)
    updateEditorCollaborationUser(editor, collaboration, {
      typing: false,
      activeBlockId,
      cursor: selection,
      selection,
      relativeCursor: relativeSelection,
      relativeSelection,
    })
    reportActiveBlockId(activeBlockId)
  }, [collaboration, editor, reportActiveBlockId])
}

function useRichTextEditorLifecycleEffects({
  attachmentPickerRequest,
  autoFocus,
  clearTypingTimeout,
  editable,
  editor,
  hiddenAttachmentInputRef,
  hiddenImageInputRef,
  imagePickerRequest,
}: {
  attachmentPickerRequest: number
  autoFocus: boolean
  clearTypingTimeout: () => void
  editable: boolean
  editor: Editor | null
  hiddenAttachmentInputRef: MutableRefObject<HTMLInputElement | null>
  hiddenImageInputRef: MutableRefObject<HTMLInputElement | null>
  imagePickerRequest: number
}) {
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

    const frameId = window.requestAnimationFrame(() => {
      editor.commands.focus("end")
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [autoFocus, editor])

  useEffect(() => {
    return () => {
      clearTypingTimeout()
    }
  }, [clearTypingTimeout])

  useEffect(() => {
    if (attachmentPickerRequest === 0) {
      return
    }

    hiddenAttachmentInputRef.current?.click()
  }, [attachmentPickerRequest, hiddenAttachmentInputRef])

  useEffect(() => {
    if (imagePickerRequest === 0) {
      return
    }

    hiddenImageInputRef.current?.click()
  }, [hiddenImageInputRef, imagePickerRequest])
}

function useBlockPresenceMarkers({
  containerRef,
  containerWidth,
  editor,
  fullPageCanvasWidth,
  visiblePresenceViewers,
}: {
  containerRef: MutableRefObject<HTMLDivElement | null>
  containerWidth: number
  editor: Editor | null
  fullPageCanvasWidth: FullPageCanvasWidth
  visiblePresenceViewers: DocumentPresenceViewer[]
}) {
  const [markers, setMarkers] = useState<BlockPresenceMarker[]>([])

  const updateMarkers = useCallback(() => {
    if (!editor || visiblePresenceViewers.length === 0) {
      setMarkers((current) => (current.length === 0 ? current : []))
      return
    }

    const nextMarkers = collectBlockPresenceMarkers({
      currentEditor: editor,
      container: containerRef.current,
      viewers: visiblePresenceViewers,
    })

    setMarkers((current) =>
      areBlockPresenceMarkersEqual(current, nextMarkers) ? current : nextMarkers
    )
  }, [containerRef, editor, visiblePresenceViewers])

  useMarkerLayoutRefresh({
    containerWidth,
    fullPageCanvasWidth,
    updateMarkers,
  })
  useMarkerUpdateSubscriptions({
    containerRef,
    editor,
    updateMarkers,
  })

  return markers
}

function useMarkerLayoutRefresh({
  containerWidth,
  fullPageCanvasWidth,
  updateMarkers,
}: {
  containerWidth: number
  fullPageCanvasWidth: FullPageCanvasWidth
  updateMarkers: () => void
}) {
  useEffect(() => {
    const frameId = window.requestAnimationFrame(updateMarkers)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [containerWidth, fullPageCanvasWidth, updateMarkers])
}

function useMarkerUpdateSubscriptions({
  awareness,
  containerRef,
  editor,
  requireAwareness = false,
  settleBeforeUpdate = false,
  updateMarkers,
}: {
  awareness?: CollaborationAwareness
  containerRef: MutableRefObject<HTMLDivElement | null>
  editor: Editor | null
  requireAwareness?: boolean
  settleBeforeUpdate?: boolean
  updateMarkers: () => void
}) {
  useEffect(() => {
    if (!editor || (requireAwareness && !awareness)) {
      return
    }

    let frameId: number | null = null
    let settleFrameId: number | null = null
    const queueUpdate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
      if (settleFrameId !== null) {
        window.cancelAnimationFrame(settleFrameId)
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null
        if (settleBeforeUpdate) {
          settleFrameId = window.requestAnimationFrame(() => {
            settleFrameId = null
            updateMarkers()
          })
        } else {
          updateMarkers()
        }
      })
    }

    const container = containerRef.current
    queueUpdate()
    editor.on("update", queueUpdate)
    editor.on("selectionUpdate", queueUpdate)
    awareness?.on("change", queueUpdate)
    awareness?.on("update", queueUpdate)
    container?.addEventListener("scroll", queueUpdate, { passive: true })
    window.addEventListener("resize", queueUpdate)

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
      if (settleFrameId !== null) {
        window.cancelAnimationFrame(settleFrameId)
      }

      editor.off("update", queueUpdate)
      editor.off("selectionUpdate", queueUpdate)
      awareness?.off("change", queueUpdate)
      awareness?.off("update", queueUpdate)
      container?.removeEventListener("scroll", queueUpdate)
      window.removeEventListener("resize", queueUpdate)
    }
  }, [
    awareness,
    containerRef,
    editor,
    requireAwareness,
    settleBeforeUpdate,
    updateMarkers,
  ])
}

function useCollaborationMarkerSubscriptions({
  collaboration,
  containerRef,
  editor,
  updateMarkers,
}: {
  collaboration: RichTextEditorCollaboration | undefined
  containerRef: MutableRefObject<HTMLDivElement | null>
  editor: Editor | null
  updateMarkers: () => void
}) {
  useMarkerUpdateSubscriptions({
    awareness: collaboration?.binding.provider.awareness,
    containerRef,
    editor,
    requireAwareness: true,
    settleBeforeUpdate: true,
    updateMarkers,
  })
}

function useCollaborationMarkers<TMarker>({
  areMarkersEqual,
  collaboration,
  collectMarkers,
  containerRef,
  containerWidth,
  currentPresenceUserId,
  editor,
  fullPageCanvasWidth,
  mergeMarkers,
}: {
  areMarkersEqual: (left: TMarker[], right: TMarker[]) => boolean
  collaboration: RichTextEditorCollaboration | undefined
  collectMarkers: (input: CollaborationMarkerCollectionInput) => TMarker[]
  containerRef: MutableRefObject<HTMLDivElement | null>
  containerWidth: number
  currentPresenceUserId: string | null
  editor: Editor | null
  fullPageCanvasWidth: FullPageCanvasWidth
  mergeMarkers?: (input: CollaborationMarkerMergeInput<TMarker>) => TMarker[]
}) {
  const [markers, setMarkers] = useState<TMarker[]>([])

  const updateMarkers = useCallback(() => {
    if (!editor || !collaboration) {
      setMarkers((current) => (current.length === 0 ? current : []))
      return
    }

    const nextMarkers = collectMarkers({
      currentEditor: editor,
      container: containerRef.current,
      collaboration,
      currentPresenceUserId,
    })

    setMarkers((current) => {
      const committedMarkers = mergeMarkers
        ? mergeMarkers({
            collaboration,
            current,
            currentPresenceUserId,
            nextMarkers,
          })
        : nextMarkers

      return areMarkersEqual(current, committedMarkers)
        ? current
        : committedMarkers
    })
  }, [
    areMarkersEqual,
    collaboration,
    collectMarkers,
    containerRef,
    currentPresenceUserId,
    editor,
    mergeMarkers,
  ])

  useMarkerLayoutRefresh({
    containerWidth,
    fullPageCanvasWidth,
    updateMarkers,
  })
  useCollaborationMarkerSubscriptions({
    collaboration,
    containerRef,
    editor,
    updateMarkers,
  })

  return markers
}

function mergeCollaborationCursorMarkers({
  collaboration,
  current,
  currentPresenceUserId,
  nextMarkers,
}: CollaborationMarkerMergeInput<CollaborationCursorMarker>) {
  const activeKeys = collectActiveCollaborationMarkerKeys({
    collaboration,
    currentPresenceUserId,
  })
  const nextMarkerKeys = new Set(nextMarkers.map((marker) => marker.key))
  const preservedMarkers = current.filter(
    (marker) => activeKeys.has(marker.key) && !nextMarkerKeys.has(marker.key)
  )

  return sortCollaborationMarkers([...nextMarkers, ...preservedMarkers])
}

function useCollaborationCursorMarkers({
  collaboration,
  containerRef,
  containerWidth,
  currentPresenceUserId,
  editor,
  fullPageCanvasWidth,
}: {
  collaboration: RichTextEditorCollaboration | undefined
  containerRef: MutableRefObject<HTMLDivElement | null>
  containerWidth: number
  currentPresenceUserId: string | null
  editor: Editor | null
  fullPageCanvasWidth: FullPageCanvasWidth
}) {
  return useCollaborationMarkers({
    areMarkersEqual: areCollaborationCursorMarkersEqual,
    collaboration,
    collectMarkers: collectCollaborationCursorMarkers,
    containerRef,
    containerWidth,
    currentPresenceUserId,
    editor,
    fullPageCanvasWidth,
    mergeMarkers: mergeCollaborationCursorMarkers,
  })
}

function useCollaborationSelectionMarkers({
  collaboration,
  containerRef,
  containerWidth,
  currentPresenceUserId,
  editor,
  fullPageCanvasWidth,
}: {
  collaboration: RichTextEditorCollaboration | undefined
  containerRef: MutableRefObject<HTMLDivElement | null>
  containerWidth: number
  currentPresenceUserId: string | null
  editor: Editor | null
  fullPageCanvasWidth: FullPageCanvasWidth
}) {
  return useCollaborationMarkers({
    areMarkersEqual: areCollaborationSelectionMarkersEqual,
    collaboration,
    collectMarkers: collectCollaborationSelectionMarkers,
    containerRef,
    containerWidth,
    currentPresenceUserId,
    editor,
    fullPageCanvasWidth,
  })
}

function useRichTextPickerState() {
  const hiddenAttachmentInputRef = useRef<HTMLInputElement | null>(null)
  const hiddenImageInputRef = useRef<HTMLInputElement | null>(null)
  const [attachmentPickerRequest, setAttachmentPickerRequest] = useState(0)
  const [imagePickerRequest, setImagePickerRequest] = useState(0)
  const [pickerInsertPosition, setPickerInsertPosition] = useState<
    number | null
  >(null)
  const [emojiPickerAnchor, setEmojiPickerAnchor] =
    useState<EmojiPickerAnchor | null>(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)

  const requestAttachmentPicker = useCallback((currentEditor: Editor) => {
    setPickerInsertPosition(currentEditor.state.selection.from)
    setAttachmentPickerRequest((current) => current + 1)
  }, [])

  const requestImagePicker = useCallback((currentEditor: Editor) => {
    setPickerInsertPosition(currentEditor.state.selection.from)
    setImagePickerRequest((current) => current + 1)
  }, [])

  const requestEmojiPicker = useCallback(
    (currentEditor: Editor, anchor?: EmojiPickerAnchor | null) => {
      setPickerInsertPosition(currentEditor.state.selection.from)
      setEmojiPickerAnchor(
        anchor ?? {
          left: 12,
          top: 12,
        }
      )
      setEmojiPickerOpen(true)
    },
    []
  )

  return {
    attachmentPickerRequest,
    emojiPickerAnchor,
    emojiPickerOpen,
    hiddenAttachmentInputRef,
    hiddenImageInputRef,
    imagePickerRequest,
    pickerInsertPosition,
    requestAttachmentPicker,
    requestEmojiPicker,
    requestImagePicker,
    setEmojiPickerAnchor,
    setEmojiPickerOpen,
  }
}

function useRichTextMenuState({
  allowSlashCommands,
  containerRef,
}: {
  allowSlashCommands: boolean
  containerRef: MutableRefObject<HTMLDivElement | null>
}) {
  const previousSlashQueryRef = useRef<string | null>(null)
  const previousMentionQueryRef = useRef<string | null>(null)
  const [slashState, setSlashState] = useState<MenuState | null>(null)
  const [mentionState, setMentionState] = useState<MenuState | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const [mentionIndex, setMentionIndex] = useState(0)

  const syncSlashState = useCallback((nextSlashState: MenuState | null) => {
    const nextQuery = nextSlashState?.query ?? null

    setSlashState(nextSlashState)

    if (previousSlashQueryRef.current !== nextQuery) {
      previousSlashQueryRef.current = nextQuery
      setSlashIndex(0)
    }
  }, [])

  const syncMentionState = useCallback((nextMentionState: MenuState | null) => {
    const nextQuery = nextMentionState?.query ?? null

    setMentionState(nextMentionState)

    if (previousMentionQueryRef.current !== nextQuery) {
      previousMentionQueryRef.current = nextQuery
      setMentionIndex(0)
    }
  }, [])

  const syncCommandMenus = useCallback(
    (currentEditor: Editor) => {
      syncSlashState(
        allowSlashCommands
          ? buildSlashState(currentEditor, containerRef.current)
          : null
      )
      syncMentionState(buildMentionState(currentEditor, containerRef.current))
    },
    [allowSlashCommands, containerRef, syncMentionState, syncSlashState]
  )

  return {
    mentionIndex,
    mentionState,
    previousMentionQueryRef,
    previousSlashQueryRef,
    setMentionIndex,
    setMentionState,
    setSlashIndex,
    setSlashState,
    slashIndex,
    slashState,
    syncCommandMenus,
  }
}

function useRichTextActiveBlockReporter({
  onActiveBlockChange,
}: {
  onActiveBlockChange?: (blockId: string | null) => void
}) {
  const lastReportedActiveBlockIdRef = useRef<string | null>(null)

  return useCallback(
    (activeBlockId: string | null) => {
      if (lastReportedActiveBlockIdRef.current === activeBlockId) {
        return
      }

      lastReportedActiveBlockIdRef.current = activeBlockId
      onActiveBlockChange?.(activeBlockId)
    },
    [onActiveBlockChange]
  )
}

function useRichTextUploads({
  editorRef,
  hiddenAttachmentInputRef,
  hiddenImageInputRef,
  onUploadAttachmentRef,
}: {
  editorRef: MutableRefObject<Editor | null>
  hiddenAttachmentInputRef: MutableRefObject<HTMLInputElement | null>
  hiddenImageInputRef: MutableRefObject<HTMLInputElement | null>
  onUploadAttachmentRef: MutableRefObject<
    RichTextEditorProps["onUploadAttachment"]
  >
}) {
  const [uploadingAttachment, setUploadingAttachment] = useState(false)

  const handleEditorFiles = useCallback(
    async (currentEditor: Editor, files: File[], position?: number | null) => {
      await uploadRichTextEditorFiles({
        currentEditor,
        files,
        position,
        setUploadingAttachment,
        uploadAttachment: onUploadAttachmentRef.current,
      })
    },
    [onUploadAttachmentRef]
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
    [
      editorRef,
      handleEditorFiles,
      hiddenAttachmentInputRef,
      hiddenImageInputRef,
    ]
  )

  return {
    handleEditorFiles,
    handleToolbarFiles,
    uploadingAttachment,
  }
}

function useRichTextResolvedContent(content: RichTextEditorProps["content"]) {
  const sanitizedStringContent = useMemo(
    () =>
      typeof content === "string" ? sanitizeRichTextContent(content) : null,
    [content]
  )

  return {
    resolvedEditorContent: sanitizedStringContent ?? content,
    sanitizedStringContent,
  }
}

function getRichTextCharacterLimit(input: {
  enforcePlainTextLimit: boolean
  maxPlainTextCharacters: number | undefined
}) {
  if (!input.enforcePlainTextLimit && !input.maxPlainTextCharacters) {
    return undefined
  }

  return input.maxPlainTextCharacters ? input.maxPlainTextCharacters : undefined
}

function createRichTextCollaborationExtensions(input: {
  collaborationDocument: RichTextEditorCollaboration["binding"]["doc"] | null
  collaborationProvider:
    | RichTextEditorCollaboration["binding"]["provider"]
    | null
}) {
  if (!input.collaborationDocument || !input.collaborationProvider) {
    return []
  }

  return [
    Collaboration.configure({
      document: input.collaborationDocument,
      field: COLLABORATION_XML_FRAGMENT,
      provider: input.collaborationProvider,
    }),
  ]
}

function useRichTextExtensionSets({
  collaboration,
  enforcePlainTextLimit,
  maxPlainTextCharacters,
  placeholder,
}: {
  collaboration: RichTextEditorCollaboration | undefined
  enforcePlainTextLimit: boolean
  maxPlainTextCharacters: number | undefined
  placeholder: string
}) {
  const hasCollaboration = Boolean(collaboration)
  const collaborationDocument = collaboration?.binding.doc ?? null
  const collaborationProvider = collaboration?.binding.provider ?? null
  const characterLimit = getRichTextCharacterLimit({
    enforcePlainTextLimit,
    maxPlainTextCharacters,
  })
  const baseExtensions = useMemo(
    () =>
      createRichTextBaseExtensions({
        placeholder,
        collaboration: hasCollaboration,
        characterLimit,
      }),
    [characterLimit, hasCollaboration, placeholder]
  )
  const collaborationExtensions = useMemo(
    () =>
      createRichTextCollaborationExtensions({
        collaborationDocument,
        collaborationProvider,
      }),
    [collaborationDocument, collaborationProvider]
  )

  return {
    baseExtensions,
    collaborationExtensions,
  }
}

function useRichTextTypingIdle(
  collaboration: RichTextEditorCollaboration | undefined
) {
  const typingTimeoutRef = useRef<number | null>(null)
  const clearTypingTimeout = useCallback(() => {
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
  }, [])

  const scheduleTypingIdleReset = useCallback(
    (currentEditor: Editor) => {
      if (!collaboration) {
        return
      }

      clearTypingTimeout()
      typingTimeoutRef.current = window.setTimeout(() => {
        updateEditorCollaborationUser(currentEditor, collaboration, {
          typing: false,
        })
      }, TYPING_IDLE_TIMEOUT_MS)
    },
    [clearTypingTimeout, collaboration]
  )

  return {
    clearTypingTimeout,
    scheduleTypingIdleReset,
  }
}

function handleRichTextEditorCreate(input: {
  collaboration: RichTextEditorCollaboration | undefined
  currentEditor: Editor
  onMentionCountsChangeRef: MutableRefObject<
    RichTextEditorProps["onMentionCountsChange"]
  >
  reportActiveBlockId: (activeBlockId: string | null) => void
  syncCommandMenus: (currentEditor: Editor) => void
}) {
  const activeBlockId = updateCurrentEditorCollaborationPresence({
    collaboration: input.collaboration,
    currentEditor: input.currentEditor,
    typing: false,
  })
  input.reportActiveBlockId(activeBlockId)

  input.onMentionCountsChangeRef.current?.(
    getEditorMentionCounts(input.currentEditor),
    "initial"
  )
  input.syncCommandMenus(input.currentEditor)
}

function isExternalRichTextCollaborationChange(input: {
  collaboration: RichTextEditorCollaboration | undefined
  transaction: Parameters<typeof isChangeOrigin>[0]
}) {
  return Boolean(input.collaboration && isChangeOrigin(input.transaction))
}

function reportRichTextEditorContentChange(input: {
  currentEditor: Editor
  isExternalCollaborationChange: boolean
  onChangeRef: MutableRefObject<(content: string) => void>
  onMentionCountsChangeRef: MutableRefObject<
    RichTextEditorProps["onMentionCountsChange"]
  >
}) {
  input.onChangeRef.current(
    sanitizeRichTextContent(input.currentEditor.getHTML())
  )
  input.onMentionCountsChangeRef.current?.(
    getEditorMentionCounts(input.currentEditor),
    input.isExternalCollaborationChange ? "external" : "local"
  )
}

function syncRichTextEditorLocalCollaborationUpdate(input: {
  collaboration: RichTextEditorCollaboration | undefined
  currentEditor: Editor
  isExternalCollaborationChange: boolean
  reportActiveBlockId: (activeBlockId: string | null) => void
  scheduleTypingIdleReset: (currentEditor: Editor) => void
}) {
  if (!input.collaboration || input.isExternalCollaborationChange) {
    return false
  }

  const activeBlockId = updateCurrentEditorCollaborationPresence({
    collaboration: input.collaboration,
    currentEditor: input.currentEditor,
    typing: true,
  })
  input.reportActiveBlockId(activeBlockId)
  input.scheduleTypingIdleReset(input.currentEditor)

  return true
}

function reportRichTextEditorLocalActiveBlock(input: {
  currentEditor: Editor
  isExternalCollaborationChange: boolean
  reportActiveBlockId: (activeBlockId: string | null) => void
}) {
  if (input.isExternalCollaborationChange) {
    return
  }

  input.reportActiveBlockId(getActiveBlockId(input.currentEditor))
}

function handleRichTextEditorUpdate(input: {
  collaboration: RichTextEditorCollaboration | undefined
  currentEditor: Editor
  onChangeRef: MutableRefObject<(content: string) => void>
  onMentionCountsChangeRef: MutableRefObject<
    RichTextEditorProps["onMentionCountsChange"]
  >
  reportActiveBlockId: (activeBlockId: string | null) => void
  scheduleTypingIdleReset: (currentEditor: Editor) => void
  syncCommandMenus: (currentEditor: Editor) => void
  transaction: Parameters<typeof isChangeOrigin>[0]
}) {
  const isExternalCollaborationChange =
    isExternalRichTextCollaborationChange(input)

  reportRichTextEditorContentChange({
    currentEditor: input.currentEditor,
    isExternalCollaborationChange,
    onChangeRef: input.onChangeRef,
    onMentionCountsChangeRef: input.onMentionCountsChangeRef,
  })
  input.syncCommandMenus(input.currentEditor)

  const handledCollaborationUpdate = syncRichTextEditorLocalCollaborationUpdate(
    {
      collaboration: input.collaboration,
      currentEditor: input.currentEditor,
      isExternalCollaborationChange,
      reportActiveBlockId: input.reportActiveBlockId,
      scheduleTypingIdleReset: input.scheduleTypingIdleReset,
    }
  )

  if (handledCollaborationUpdate) {
    return
  }

  reportRichTextEditorLocalActiveBlock({
    currentEditor: input.currentEditor,
    isExternalCollaborationChange,
    reportActiveBlockId: input.reportActiveBlockId,
  })
}

function handleRichTextEditorSelectionUpdate(input: {
  collaboration: RichTextEditorCollaboration | undefined
  currentEditor: Editor
  reportActiveBlockId: (activeBlockId: string | null) => void
  syncCommandMenus: (currentEditor: Editor) => void
}) {
  input.syncCommandMenus(input.currentEditor)
  const activeBlockId = updateCurrentEditorCollaborationPresence({
    collaboration: input.collaboration,
    currentEditor: input.currentEditor,
  })
  input.reportActiveBlockId(activeBlockId)
}

function handleRichTextEditorBlur(input: {
  clearTypingTimeout: () => void
  collaboration: RichTextEditorCollaboration | undefined
  currentEditor: Editor
  reportActiveBlockId: (activeBlockId: string | null) => void
}) {
  input.clearTypingTimeout()
  const activeBlockId = updateCurrentEditorCollaborationPresence({
    collaboration: input.collaboration,
    currentEditor: input.currentEditor,
    typing: false,
  })
  input.reportActiveBlockId(activeBlockId)
}

function useFilteredRichTextSlashCommands(input: {
  allowSlashCommands: boolean
  editor: Editor | null
  onUploadAttachment: RichTextEditorProps["onUploadAttachment"]
  requestAttachmentPicker: (currentEditor: Editor) => void
  requestEmojiPicker: (
    currentEditor: Editor,
    anchor?: EmojiPickerAnchor | null
  ) => void
  requestImagePicker: (currentEditor: Editor) => void
  slashState: MenuState | null
}) {
  const {
    allowSlashCommands,
    editor,
    onUploadAttachment,
    requestAttachmentPicker,
    requestEmojiPicker,
    requestImagePicker,
    slashState,
  } = input

  return useMemo(() => {
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
  }, [
    allowSlashCommands,
    editor,
    onUploadAttachment,
    requestAttachmentPicker,
    requestEmojiPicker,
    requestImagePicker,
    slashState,
  ])
}

function useFilteredRichTextMentionCandidates(input: {
  editor: Editor | null
  mentionCandidates: MentionCandidate[]
  mentionState: MenuState | null
}) {
  return useMemo(() => {
    if (!input.mentionState || !input.editor) {
      return []
    }

    return filterMentionCandidates(
      input.mentionState.query,
      input.mentionCandidates
    )
  }, [input.editor, input.mentionCandidates, input.mentionState])
}

function getRichTextStatsWords(editor: Editor | null) {
  return editor?.storage.characterCount.words() ?? 0
}

function getRichTextStatsCharacters(editor: Editor | null) {
  return editor?.storage.characterCount.characters() ?? 0
}

function isRichTextTooShort(characters: number, minimum: number) {
  return minimum > 0 && characters < minimum
}

function isRichTextTooLong(characters: number, maximum: number | undefined) {
  return maximum !== undefined && characters > maximum
}

function getRemainingRichTextCharacters(
  characters: number,
  maximum: number | undefined
) {
  return maximum !== undefined ? maximum - characters : null
}

function useRichTextStatsState(input: {
  editor: Editor | null
  maxPlainTextCharacters: number | undefined
  minPlainTextCharacters: number
}) {
  const statsWords = getRichTextStatsWords(input.editor)
  const statsCharacters = getRichTextStatsCharacters(input.editor)
  const tooShort = isRichTextTooShort(
    statsCharacters,
    input.minPlainTextCharacters
  )
  const tooLong = isRichTextTooLong(
    statsCharacters,
    input.maxPlainTextCharacters
  )
  const canSubmit = !tooShort && !tooLong
  const remainingCharacters = getRemainingRichTextCharacters(
    statsCharacters,
    input.maxPlainTextCharacters
  )

  return {
    canSubmit,
    remainingCharacters,
    statsCharacters,
    statsWords,
    tooLong,
    tooShort,
  }
}

function useRichTextStatsEffects(input: {
  canSubmit: boolean
  maxPlainTextCharacters: number | undefined
  minPlainTextCharacters: number
  onStatsChange: RichTextEditorProps["onStatsChange"]
  onValidityChange: RichTextEditorProps["onValidityChange"]
  remainingCharacters: number | null
  statsCharacters: number
  statsWords: number
  tooLong: boolean
  tooShort: boolean
}) {
  const {
    canSubmit,
    maxPlainTextCharacters,
    minPlainTextCharacters,
    onStatsChange,
    onValidityChange,
    remainingCharacters,
    statsCharacters,
    statsWords,
    tooLong,
    tooShort,
  } = input

  useEffect(() => {
    onStatsChange?.({
      words: statsWords,
      characters: statsCharacters,
    })
  }, [onStatsChange, statsCharacters, statsWords])

  useEffect(() => {
    onValidityChange?.({
      characters: statsCharacters,
      minimum: minPlainTextCharacters,
      maximum: maxPlainTextCharacters ?? null,
      remaining: remainingCharacters,
      tooShort,
      tooLong,
      canSubmit,
    })
  }, [
    canSubmit,
    maxPlainTextCharacters,
    minPlainTextCharacters,
    onValidityChange,
    remainingCharacters,
    statsCharacters,
    tooLong,
    tooShort,
  ])
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
  minPlainTextCharacters = 0,
  maxPlainTextCharacters,
  enforcePlainTextLimit = false,
  onValidityChange,
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
  const editorRef = useRef<Editor | null>(null)
  const onChangeRef = useLatestRef(onChange)
  const onUploadAttachmentRef = useLatestRef(onUploadAttachment)
  const onMentionCountsChangeRef = useLatestRef(onMentionCountsChange)
  const onMentionInsertedRef = useLatestRef(onMentionInserted)
  const reportActiveBlockId = useRichTextActiveBlockReporter({
    onActiveBlockChange,
  })
  const { fullPageCanvasWidth, setFullPageCanvasWidth } =
    useFullPageCanvasWidthPreference(fullPage)
  const containerWidth = useRichTextContainerWidth({ containerRef, fullPage })
  const {
    attachmentPickerRequest,
    emojiPickerAnchor,
    emojiPickerOpen,
    hiddenAttachmentInputRef,
    hiddenImageInputRef,
    imagePickerRequest,
    pickerInsertPosition,
    requestAttachmentPicker,
    requestEmojiPicker,
    requestImagePicker,
    setEmojiPickerAnchor,
    setEmojiPickerOpen,
  } = useRichTextPickerState()
  const {
    mentionIndex,
    mentionState,
    previousMentionQueryRef,
    previousSlashQueryRef,
    setMentionIndex,
    setMentionState,
    setSlashIndex,
    setSlashState,
    slashIndex,
    slashState,
    syncCommandMenus,
  } = useRichTextMenuState({ allowSlashCommands, containerRef })

  const editorClass = getRichTextEditorClassName({ compact, fullPage })
  const { resolvedEditorContent, sanitizedStringContent } =
    useRichTextResolvedContent(content)
  const visiblePresenceViewers = useMemo(
    () => getVisiblePresenceViewers({ currentPresenceUserId, presenceViewers }),
    [currentPresenceUserId, presenceViewers]
  )
  const { baseExtensions, collaborationExtensions } = useRichTextExtensionSets({
    collaboration,
    enforcePlainTextLimit,
    maxPlainTextCharacters,
    placeholder,
  })
  const { clearTypingTimeout, scheduleTypingIdleReset } =
    useRichTextTypingIdle(collaboration)

  const { handleEditorFiles, handleToolbarFiles, uploadingAttachment } =
    useRichTextUploads({
      editorRef,
      hiddenAttachmentInputRef,
      hiddenImageInputRef,
      onUploadAttachmentRef,
    })

  const editor = useEditor(
    {
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

          if (!currentEditor) {
            return false
          }

          return handleRichTextEditorKeyDown({
            allowSlashCommands,
            container: containerRef.current,
            currentEditor,
            event,
            mentionCandidates,
            mentionIndex,
            mentionState,
            onMentionInsertedRef,
            onSubmitShortcut,
            onUploadAttachment,
            previousMentionQueryRef,
            previousSlashQueryRef,
            requestAttachmentPicker,
            requestEmojiPicker,
            requestImagePicker,
            setMentionIndex,
            setMentionState,
            setSlashIndex,
            setSlashState,
            slashIndex,
            slashState,
            submitOnEnter,
          })
        },
      },
      onCreate({ editor: currentEditor }) {
        handleRichTextEditorCreate({
          collaboration,
          currentEditor,
          onMentionCountsChangeRef,
          reportActiveBlockId,
          syncCommandMenus,
        })
      },
      onUpdate({ editor: currentEditor, transaction }) {
        handleRichTextEditorUpdate({
          collaboration,
          currentEditor,
          onChangeRef,
          onMentionCountsChangeRef,
          reportActiveBlockId,
          scheduleTypingIdleReset,
          syncCommandMenus,
          transaction,
        })
      },
      onSelectionUpdate({ editor: currentEditor }) {
        handleRichTextEditorSelectionUpdate({
          collaboration,
          currentEditor,
          reportActiveBlockId,
          syncCommandMenus,
        })
      },
      onFocus({ editor: currentEditor }) {
        handleRichTextEditorSelectionUpdate({
          collaboration,
          currentEditor,
          reportActiveBlockId,
          syncCommandMenus,
        })
      },
      onBlur({ editor: currentEditor }) {
        handleRichTextEditorBlur({
          clearTypingTimeout,
          collaboration,
          currentEditor,
          reportActiveBlockId,
        })
      },
    },
    [
      collaboration?.binding.doc,
      collaboration?.binding.provider,
      collaboration?.localUser.sessionId,
      clearTypingTimeout,
      handleEditorFiles,
      onChangeRef,
      onMentionCountsChangeRef,
      reportActiveBlockId,
      placeholder,
      scheduleTypingIdleReset,
      syncCommandMenus,
    ]
  )

  useForwardedEditorInstance({ editor, editorInstanceRef, editorRef })
  useExternalRichTextContentSync({
    collaboration,
    editor,
    onMentionCountsChangeRef,
    sanitizedStringContent,
  })
  useInitialCollaborationPresenceSync({
    collaboration,
    editor,
    reportActiveBlockId,
  })
  useRichTextEditorLifecycleEffects({
    attachmentPickerRequest,
    autoFocus,
    clearTypingTimeout,
    editable,
    editor,
    hiddenAttachmentInputRef,
    hiddenImageInputRef,
    imagePickerRequest,
  })

  const filteredSlashCommands = useFilteredRichTextSlashCommands({
    allowSlashCommands,
    editor,
    onUploadAttachment,
    requestAttachmentPicker,
    requestEmojiPicker,
    requestImagePicker,
    slashState,
  })
  const filteredMentionCandidates = useFilteredRichTextMentionCandidates({
    editor,
    mentionCandidates,
    mentionState,
  })
  const {
    canSubmit,
    remainingCharacters,
    statsCharacters,
    statsWords,
    tooLong,
    tooShort,
  } = useRichTextStatsState({
    editor,
    maxPlainTextCharacters,
    minPlainTextCharacters,
  })

  const blockPresenceMarkers = useBlockPresenceMarkers({
    containerRef,
    containerWidth,
    editor,
    fullPageCanvasWidth,
    visiblePresenceViewers,
  })
  const collaborationCursorMarkers = useCollaborationCursorMarkers({
    collaboration,
    containerRef,
    containerWidth,
    currentPresenceUserId,
    editor,
    fullPageCanvasWidth,
  })
  const collaborationSelectionMarkers = useCollaborationSelectionMarkers({
    collaboration,
    containerRef,
    containerWidth,
    currentPresenceUserId,
    editor,
    fullPageCanvasWidth,
  })

  useRichTextStatsEffects({
    canSubmit,
    maxPlainTextCharacters,
    minPlainTextCharacters,
    onValidityChange,
    onStatsChange,
    remainingCharacters,
    statsCharacters,
    statsWords,
    tooLong,
    tooShort,
  })

  const richTextEditorBodyProps = {
    currentEditor: editor,
    uploadsEnabled: Boolean(onUploadAttachment),
    allowSlashCommands,
    editable,
    blockPresenceMarkers,
    emojiPickerOpen,
    className,
    emojiPickerAnchor,
    collaboration,
    filteredMentionCandidates,
    collaborationCursorMarkers,
    filteredSlashCommands,
    collaborationSelectionMarkers,
    fullPage,
    containerRef,
    fullPageCanvasWidth,
    containerWidth,
    handleToolbarFiles,
    setEmojiPickerAnchor,
    hiddenAttachmentInputRef,
    setEmojiPickerOpen,
    hiddenImageInputRef,
    setFullPageCanvasWidth,
    mentionIndex,
    setMentionIndex,
    mentionMenuPlacement,
    setMentionState,
    mentionState,
    setSlashIndex,
    onMentionInserted,
    setSlashState,
    pickerInsertPosition,
    showStats,
    previousMentionQueryRef,
    showToolbar,
    previousSlashQueryRef,
    slashIndex,
    requestAttachmentPicker,
    slashState,
    requestImagePicker,
    statsCharacters,
    statsWords,
    uploadingAttachment,
  } satisfies RichTextEditorBodyProps

  return <RichTextEditorBody {...richTextEditorBodyProps} />
}

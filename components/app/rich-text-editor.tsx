"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type MutableRefObject,
} from "react"
import {
  EditorContent,
  type Editor,
  type JSONContent,
  useEditor,
} from "@tiptap/react"
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from "@tiptap/y-tiptap"
import Collaboration, { isChangeOrigin } from "@tiptap/extension-collaboration"
import FileHandler from "@tiptap/extension-file-handler"
import type { Node as ProsemirrorNode } from "@tiptap/pm/model"
import * as Y from "yjs"
import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
import {
  createCollaborationAwarenessState,
  type CollaborationCaretSide,
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
} from "./rich-text-editor/toolbar"
import {
  FullPageRichTextShell,
  useFullPageCanvasWidthPreference,
} from "./rich-text-editor/full-page-shell"

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

export type RichTextEditorValidity = {
  characters: number
  minimum: number
  maximum: number | null
  remaining: number | null
  tooShort: boolean
  tooLong: boolean
  canSubmit: boolean
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

type BlockPresenceMarker = {
  blockId: string
  top: number
  viewers: DocumentPresenceViewer[]
}

type CollaborationRelativePositionJson = Record<string, unknown>

type CollaborationRelativeRange = {
  anchor: CollaborationRelativePositionJson | null
  head: CollaborationRelativePositionJson | null
}

type CollaborationCursorMarker = {
  key: string
  name: string
  color: string
  left: number
  top: number
  height: number
}

type CollaborationSelectionMarker = {
  key: string
  color: string
  left: number
  top: number
  width: number
  height: number
}

const EMPTY_MENTION_CANDIDATES: MentionCandidate[] = []
const TYPING_IDLE_TIMEOUT_MS = 1500
const MAX_VISIBLE_BLOCK_PRESENCE_VIEWERS = 2
const COLLABORATION_CURSOR_LABEL_TOP_THRESHOLD_PX = 28

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

function areCollaborationSelectionMarkersEqual(
  left: CollaborationSelectionMarker[],
  right: CollaborationSelectionMarker[]
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
      leftMarker.color !== rightMarker.color ||
      leftMarker.left !== rightMarker.left ||
      leftMarker.top !== rightMarker.top ||
      leftMarker.width !== rightMarker.width ||
      leftMarker.height !== rightMarker.height
    ) {
      return false
    }
  }

  return true
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

    for (
      let viewerIndex = 0;
      viewerIndex < leftMarker.viewers.length;
      viewerIndex += 1
    ) {
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

function normalizeCollaborationRelativePosition(
  value: unknown
): CollaborationRelativePositionJson | null {
  return isRecord(value) ? value : null
}

function normalizeCollaborationRelativeRange(
  value: unknown
): CollaborationRelativeRange | null {
  if (!isRecord(value)) {
    return null
  }

  const anchor = normalizeCollaborationRelativePosition(value.anchor)
  const head = normalizeCollaborationRelativePosition(value.head)

  if (!anchor || !head) {
    return null
  }

  return { anchor, head }
}

function getYSyncEditorState(currentEditor: Editor) {
  return ySyncPluginKey.getState(currentEditor.state) as
    | YSyncEditorState
    | undefined
}

function createSerializedRelativePosition(
  currentEditor: Editor,
  position: number
): CollaborationRelativePositionJson | null {
  const yState = getYSyncEditorState(currentEditor)

  if (!yState?.type || !yState.binding) {
    return null
  }

  try {
    const safePosition = Math.min(
      Math.max(position, 0),
      currentEditor.state.doc.content.size
    )
    const relativePosition = absolutePositionToRelativePosition(
      safePosition,
      yState.type,
      yState.binding.mapping
    )

    return normalizeCollaborationRelativePosition(relativePosition)
  } catch {
    return null
  }
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
  patch?: Partial<CollaborationAwarenessState> & {
    relativeCursor?: CollaborationRelativeRange | null
    relativeSelection?: CollaborationRelativeRange | null
  }
) {
  if (!collaboration) {
    return
  }

  const localAwarenessState =
    collaboration.binding.provider.awareness.getLocalState()
  const localAwarenessUser = isRecord(localAwarenessState)
    ? localAwarenessState.user
    : null
  const relativeCursor =
    patch?.relativeCursor ??
    normalizeCollaborationRelativeRange(
      isRecord(localAwarenessUser) ? localAwarenessUser.relativeCursor : null
    )
  const relativeSelection =
    patch?.relativeSelection ??
    normalizeCollaborationRelativeRange(
      isRecord(localAwarenessUser) ? localAwarenessUser.relativeSelection : null
    )
  const mergedUserBase = createCollaborationAwarenessState({
    ...collaboration.localUser,
    ...(isRecord(localAwarenessUser) ? localAwarenessUser : {}),
    ...patch,
  })
  const mergedUser = {
    ...mergedUserBase,
    relativeCursor,
    relativeSelection,
  }

  const updateUserCommand = (
    currentEditor.commands as {
      updateUser?: (attributes: typeof mergedUser) => boolean
    }
  ).updateUser

  if (typeof updateUserCommand === "function") {
    updateUserCommand(mergedUser)
    return
  }

  collaboration.binding.provider.awareness.setLocalStateField(
    "user",
    mergedUser
  )
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

  const viewersByBlockId = new Map<
    string,
    Map<string, DocumentPresenceViewer>
  >()

  for (const viewer of input.viewers) {
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
    const blockViewerMap = viewersByBlockId.get(blockId)
    const blockViewers = blockViewerMap
      ? Array.from(blockViewerMap.values())
      : null

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

function resolveCollaborationRelativePosition(
  currentEditor: Editor,
  value: unknown
) {
  const json = normalizeCollaborationRelativePosition(value)

  if (!json) {
    return null
  }

  const yState = getYSyncEditorState(currentEditor)

  if (!yState?.doc || !yState.type || !yState.binding) {
    return null
  }

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
  if (!isRecord(value)) {
    return null
  }

  const userValue = isRecord(value.user) ? value.user : value
  const relativeCursor = normalizeCollaborationRelativeRange(
    userValue.relativeCursor
  )

  if (relativeCursor?.head) {
    const resolvedHead = resolveCollaborationRelativePosition(
      currentEditor,
      relativeCursor.head
    )

    if (typeof resolvedHead === "number") {
      return resolvedHead
    }
  }

  const cursorValue = isRecord(userValue.cursor) ? userValue.cursor : null
  const head = cursorValue?.head

  if (typeof head !== "number" || !Number.isInteger(head) || head < 0) {
    return null
  }

  return head
}

function getCollaborationAwarenessSelectionRange(
  currentEditor: Editor,
  value: unknown
) {
  if (!isRecord(value)) {
    return null
  }

  const userValue = isRecord(value.user) ? value.user : value
  const relativeSelection = normalizeCollaborationRelativeRange(
    userValue.relativeSelection
  )

  if (relativeSelection?.anchor && relativeSelection?.head) {
    const anchor = resolveCollaborationRelativePosition(
      currentEditor,
      relativeSelection.anchor
    )
    const head = resolveCollaborationRelativePosition(
      currentEditor,
      relativeSelection.head
    )

    if (
      typeof anchor === "number" &&
      Number.isInteger(anchor) &&
      anchor >= 0 &&
      typeof head === "number" &&
      Number.isInteger(head) &&
      head >= 0
    ) {
      return { anchor, head }
    }
  }

  const selectionValue = isRecord(userValue.selection)
    ? userValue.selection
    : null
  const anchor = selectionValue?.anchor
  const head = selectionValue?.head

  if (
    typeof anchor !== "number" ||
    !Number.isInteger(anchor) ||
    anchor < 0 ||
    typeof head !== "number" ||
    !Number.isInteger(head) ||
    head < 0
  ) {
    return null
  }

  return { anchor, head }
}

type YSyncEditorState = {
  doc: Y.Doc | null
  type: Y.XmlFragment | null
  binding: {
    mapping: Map<Y.AbstractType<unknown>, ProsemirrorNode | ProsemirrorNode[]>
  } | null
  snapshot?: unknown
  prevSnapshot?: unknown
}

function getFirstTextNode(node: Node | null): Text | null {
  if (!node) {
    return null
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node as Text
  }

  const documentRoot = node.ownerDocument

  if (!documentRoot) {
    return null
  }

  const walker = documentRoot.createTreeWalker(node, NodeFilter.SHOW_TEXT)

  return walker.nextNode() as Text | null
}

function getLastTextNode(node: Node | null): Text | null {
  if (!node) {
    return null
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node as Text
  }

  const documentRoot = node.ownerDocument

  if (!documentRoot) {
    return null
  }

  const walker = documentRoot.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  let lastTextNode: Text | null = null
  let currentNode = walker.nextNode()

  while (currentNode) {
    lastTextNode = currentNode as Text
    currentNode = walker.nextNode()
  }

  return lastTextNode
}

function getCaretCoordinatesFromTextNode(input: {
  textNode: Text
  offset: number
}) {
  const textLength = input.textNode.data.length
  const safeOffset = Math.min(Math.max(input.offset, 0), textLength)
  const documentRoot = input.textNode.ownerDocument

  if (!documentRoot) {
    return null
  }

  const range = documentRoot.createRange()

  if (safeOffset > 0) {
    range.setStart(input.textNode, safeOffset - 1)
    range.setEnd(input.textNode, safeOffset)

    const rect = Array.from(range.getClientRects()).at(-1)

    if (rect) {
      return {
        left: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      }
    }
  }

  if (safeOffset < textLength) {
    range.setStart(input.textNode, safeOffset)
    range.setEnd(input.textNode, safeOffset + 1)

    const rect = range.getClientRects()[0]

    if (rect) {
      return {
        left: rect.left,
        top: rect.top,
        bottom: rect.bottom,
      }
    }
  }

  return null
}

function getCollapsedRangeCaretCoordinates(
  currentEditor: Editor,
  position: number
) {
  try {
    const domPosition = currentEditor.view.domAtPos(position)
    const baseNode = domPosition.node
    const ownerDocument = baseNode.ownerDocument

    if (!ownerDocument) {
      return null
    }

    const range = ownerDocument.createRange()

    if (baseNode.nodeType === Node.TEXT_NODE) {
      const textNode = baseNode as Text
      const safeOffset = Math.min(
        Math.max(domPosition.offset, 0),
        textNode.data.length
      )
      range.setStart(textNode, safeOffset)
      range.setEnd(textNode, safeOffset)
    } else {
      const safeOffset = Math.min(
        Math.max(domPosition.offset, 0),
        baseNode.childNodes.length
      )
      range.setStart(baseNode, safeOffset)
      range.setEnd(baseNode, safeOffset)
    }

    const rect =
      range.getClientRects()[0] ?? range.getBoundingClientRect() ?? null

    if (!rect) {
      return null
    }

    return {
      left: rect.left,
      top: rect.top,
      bottom: rect.bottom,
    }
  } catch {
    return null
  }
}

function getClientRectsForDocumentRange(
  currentEditor: Editor,
  startPosition: number,
  endPosition: number
) {
  try {
    const ownerDocument = currentEditor.view.dom.ownerDocument

    if (!ownerDocument) {
      return [] as DOMRect[]
    }

    const startDomPosition = currentEditor.view.domAtPos(startPosition)
    const endDomPosition = currentEditor.view.domAtPos(endPosition)
    const range = ownerDocument.createRange()

    if (startDomPosition.node.nodeType === Node.TEXT_NODE) {
      const textNode = startDomPosition.node as Text
      range.setStart(
        textNode,
        Math.min(Math.max(startDomPosition.offset, 0), textNode.data.length)
      )
    } else {
      range.setStart(
        startDomPosition.node,
        Math.min(
          Math.max(startDomPosition.offset, 0),
          startDomPosition.node.childNodes.length
        )
      )
    }

    if (endDomPosition.node.nodeType === Node.TEXT_NODE) {
      const textNode = endDomPosition.node as Text
      range.setEnd(
        textNode,
        Math.min(Math.max(endDomPosition.offset, 0), textNode.data.length)
      )
    } else {
      range.setEnd(
        endDomPosition.node,
        Math.min(
          Math.max(endDomPosition.offset, 0),
          endDomPosition.node.childNodes.length
        )
      )
    }

    return Array.from(range.getClientRects()).filter(
      (rect) => rect.width > 0 && rect.height > 0
    )
  } catch {
    return [] as DOMRect[]
  }
}

function getCaretCoordinatesBeforePosition(
  currentEditor: Editor,
  position: number
) {
  try {
    const domPosition = currentEditor.view.domAtPos(position)
    const baseNode = domPosition.node

    if (baseNode.nodeType === Node.TEXT_NODE) {
      const textNode = baseNode as Text

      if (domPosition.offset > 0) {
        const textCoordinates = getCaretCoordinatesFromTextNode({
          textNode,
          offset: domPosition.offset,
        })

        if (textCoordinates) {
          return textCoordinates
        }
      }
    }

    if (baseNode instanceof HTMLElement) {
      const beforeTextNode =
        domPosition.offset > 0
          ? getLastTextNode(baseNode.childNodes[domPosition.offset - 1] ?? null)
          : null

      if (beforeTextNode) {
        const textCoordinates = getCaretCoordinatesFromTextNode({
          textNode: beforeTextNode,
          offset: beforeTextNode.data.length,
        })

        if (textCoordinates) {
          return textCoordinates
        }
      }
    }
  } catch {
    // Fall through to ProseMirror coordinates.
  }

  const before = currentEditor.view.coordsAtPos(position, -1)

  return {
    left: Math.max(before.left, before.right),
    top: before.top,
    bottom: before.bottom,
  }
}

function getCaretCoordinatesAfterPosition(
  currentEditor: Editor,
  position: number
) {
  try {
    const domPosition = currentEditor.view.domAtPos(position)
    const baseNode = domPosition.node

    if (baseNode.nodeType === Node.TEXT_NODE) {
      const textNode = baseNode as Text

      if (domPosition.offset < textNode.data.length) {
        const textCoordinates = getCaretCoordinatesFromTextNode({
          textNode,
          offset: domPosition.offset,
        })

        if (textCoordinates) {
          return textCoordinates
        }
      }
    }

    if (baseNode instanceof HTMLElement) {
      const afterTextNode = getFirstTextNode(
        baseNode.childNodes[domPosition.offset] ?? null
      )

      if (afterTextNode) {
        const textCoordinates = getCaretCoordinatesFromTextNode({
          textNode: afterTextNode,
          offset: 0,
        })

        if (textCoordinates) {
          return textCoordinates
        }
      }
    }
  } catch {
    // Fall through to ProseMirror coordinates.
  }

  const after = currentEditor.view.coordsAtPos(position, 1)

  return {
    left: after.left,
    top: after.top,
    bottom: after.bottom,
  }
}

function getLocalTextblockBoundarySide(
  currentEditor: Editor,
  position: number
): CollaborationCaretSide | null {
  try {
    const safePosition = Math.min(
      Math.max(position, 0),
      currentEditor.state.doc.content.size
    )
    const resolvedPosition = currentEditor.state.doc.resolve(safePosition)

    if (!resolvedPosition.parent.isTextblock) {
      return null
    }

    if (resolvedPosition.parentOffset === 0) {
      return "after"
    }

    if (
      resolvedPosition.parentOffset === resolvedPosition.parent.content.size
    ) {
      return "before"
    }
  } catch {
    return null
  }

  return null
}

function resolveCollaborationCaretCoordinates(
  currentEditor: Editor,
  position: number
) {
  const localBoundarySide = getLocalTextblockBoundarySide(
    currentEditor,
    position
  )

  if (localBoundarySide === "before" && position > 0) {
    return getCaretCoordinatesBeforePosition(currentEditor, position)
  }

  if (localBoundarySide === "after") {
    return getCaretCoordinatesAfterPosition(currentEditor, position)
  }

  const collapsedRangeCoordinates = getCollapsedRangeCaretCoordinates(
    currentEditor,
    position
  )

  if (collapsedRangeCoordinates) {
    return collapsedRangeCoordinates
  }

  return getCaretCoordinatesAfterPosition(currentEditor, position)
}

function collectActiveCollaborationMarkerKeys(input: {
  collaboration: NonNullable<RichTextEditorProps["collaboration"]>
  currentPresenceUserId: string | null
}) {
  const activeKeys = new Set<string>()
  const localSessionId =
    getCollaborationAwarenessUser(
      input.collaboration.binding.provider.awareness.getLocalState()
    )?.sessionId ?? input.collaboration.localUser.sessionId

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

      activeKeys.add(`${clientId}:${user.sessionId}`)
    })

  return activeKeys
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

  const yState = ySyncPluginKey.getState(input.currentEditor.state) as
    | YSyncEditorState
    | undefined

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

      const head = getCollaborationAwarenessCursorHead(
        input.currentEditor,
        value
      )

      if (typeof head !== "number") {
        return
      }

      const maxDocumentPosition = Math.max(
        input.currentEditor.state.doc.content.size,
        0
      )

      if (head > maxDocumentPosition) {
        return
      }

      try {
        const coordinates = resolveCollaborationCaretCoordinates(
          input.currentEditor,
          head
        )
        const height = Math.max(
          18,
          Math.round(coordinates.bottom - coordinates.top)
        )

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
          height,
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

function collectCollaborationSelectionMarkers(input: {
  currentEditor: Editor
  container: HTMLDivElement | null
  collaboration: NonNullable<RichTextEditorProps["collaboration"]>
  currentPresenceUserId: string | null
}) {
  const container = input.container

  if (!container) {
    return [] as CollaborationSelectionMarker[]
  }

  const localSessionId =
    getCollaborationAwarenessUser(
      input.collaboration.binding.provider.awareness.getLocalState()
    )?.sessionId ?? input.collaboration.localUser.sessionId
  const containerRect = container.getBoundingClientRect()
  const markers: CollaborationSelectionMarker[] = []
  const maxDocumentPosition = Math.max(
    input.currentEditor.state.doc.content.size,
    0
  )

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
          left: Math.round(
            rect.left - containerRect.left + container.scrollLeft
          ),
          top: Math.round(rect.top - containerRect.top + container.scrollTop),
          width: Math.max(1, Math.round(rect.width)),
          height: Math.max(1, Math.round(rect.height)),
        })
      })
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
  const [collaborationSelectionMarkers, setCollaborationSelectionMarkers] =
    useState<CollaborationSelectionMarker[]>([])
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
  const { fullPageCanvasWidth, setFullPageCanvasWidth } =
    useFullPageCanvasWidthPreference(fullPage)

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
    ? "min-h-[calc(100svh-12rem)] text-base outline-none [&_h1]:mt-0 [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:leading-tight [&_h1]:font-bold [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:leading-tight [&_h2]:font-semibold [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:leading-tight [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mt-0 [&_p]:leading-7 [&_p+p]:mt-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
    : compact
      ? "min-h-16 text-sm outline-none [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:leading-tight [&_h1]:font-semibold [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:leading-tight [&_h2]:font-semibold [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:leading-tight [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mt-0 [&_p]:leading-6 [&_p+p]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
      : "min-h-24 text-sm outline-none [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:leading-tight [&_h1]:font-semibold [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:leading-tight [&_h2]:font-semibold [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:leading-tight [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mt-0 [&_p]:leading-7 [&_p+p]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"

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
        characterLimit:
          (enforcePlainTextLimit || Boolean(maxPlainTextCharacters)) &&
          maxPlainTextCharacters
            ? maxPlainTextCharacters
            : undefined,
      }),
    [collaboration, enforcePlainTextLimit, maxPlainTextCharacters, placeholder]
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
          ]
        : [],
    [collaboration]
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
    async (currentEditor: Editor, files: File[], position?: number | null) => {
      if (files.length === 0) {
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

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        ...baseExtensions,
        ...collaborationExtensions,
        // eslint-disable-next-line react-hooks/refs -- FileHandler stores these callbacks and invokes them later for paste/drop events.
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
                Math.min(
                  Math.min(current, maxMentionIndex) + 1,
                  maxMentionIndex
                )
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
        const relativeSelection = getRelativeSelectionRange(currentEditor)

        if (collaboration) {
          updateEditorCollaborationUser(currentEditor, collaboration, {
            typing: false,
            activeBlockId,
            cursor: selection,
            selection,
            relativeCursor: relativeSelection,
            relativeSelection,
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
          const relativeSelection = getRelativeSelectionRange(currentEditor)
          updateEditorCollaborationUser(currentEditor, collaboration, {
            typing: true,
            activeBlockId,
            cursor: selection,
            selection,
            relativeCursor: relativeSelection,
            relativeSelection,
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
        const relativeSelection = getRelativeSelectionRange(currentEditor)

        if (collaboration) {
          updateEditorCollaborationUser(currentEditor, collaboration, {
            activeBlockId,
            cursor: selection,
            selection,
            relativeCursor: relativeSelection,
            relativeSelection,
          })
        }
        reportActiveBlockId(activeBlockId)
      },
      onFocus({ editor: currentEditor }) {
        const activeBlockId = getActiveBlockId(currentEditor)
        const selection = getSelectionRange(currentEditor)
        const relativeSelection = getRelativeSelectionRange(currentEditor)
        if (collaboration) {
          updateEditorCollaborationUser(currentEditor, collaboration, {
            activeBlockId,
            cursor: selection,
            selection,
            relativeCursor: relativeSelection,
            relativeSelection,
          })
        }
        reportActiveBlockId(activeBlockId)
      },
      onBlur({ editor: currentEditor }) {
        clearTypingTimeout()
        const activeBlockId = getActiveBlockId(currentEditor)
        const selection = getSelectionRange(currentEditor)
        const relativeSelection = getRelativeSelectionRange(currentEditor)

        if (collaboration) {
          updateEditorCollaborationUser(currentEditor, collaboration, {
            typing: false,
            activeBlockId,
            cursor: selection,
            selection,
            relativeCursor: relativeSelection,
            relativeSelection,
          })
        }
        reportActiveBlockId(activeBlockId)
      },
    },
    [
      collaboration?.binding.doc,
      collaboration?.binding.provider,
      collaboration?.localUser.sessionId,
      handleEditorFiles,
      reportActiveBlockId,
      placeholder,
    ]
  )

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
  const tooShort =
    minPlainTextCharacters > 0 && statsCharacters < minPlainTextCharacters
  const tooLong =
    maxPlainTextCharacters !== undefined &&
    statsCharacters > maxPlainTextCharacters
  const canSubmit = !tooShort && !tooLong
  const remainingCharacters =
    maxPlainTextCharacters !== undefined
      ? maxPlainTextCharacters - statsCharacters
      : null

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
      areBlockPresenceMarkersEqual(current, nextMarkers) ? current : nextMarkers
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
    const activeKeys = collectActiveCollaborationMarkerKeys({
      collaboration,
      currentPresenceUserId,
    })

    setCollaborationCursorMarkers((current) => {
      const nextMarkerKeys = new Set(nextMarkers.map((marker) => marker.key))
      const preservedMarkers = current.filter(
        (marker) =>
          activeKeys.has(marker.key) && !nextMarkerKeys.has(marker.key)
      )
      const mergedMarkers = [...nextMarkers, ...preservedMarkers].sort(
        (left, right) =>
          left.top - right.top ||
          left.left - right.left ||
          left.key.localeCompare(right.key)
      )

      return areCollaborationCursorMarkersEqual(current, mergedMarkers)
        ? current
        : mergedMarkers
    })
  }, [collaboration, currentPresenceUserId, editor])

  const updateCollaborationSelectionMarkers = useCallback(() => {
    if (!editor || !collaboration) {
      setCollaborationSelectionMarkers((current) =>
        current.length === 0 ? current : []
      )
      return
    }

    const nextMarkers = collectCollaborationSelectionMarkers({
      currentEditor: editor,
      container: containerRef.current,
      collaboration,
      currentPresenceUserId,
    })

    setCollaborationSelectionMarkers((current) =>
      areCollaborationSelectionMarkersEqual(current, nextMarkers)
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

  useEffect(() => {
    updateBlockPresenceMarkers()
  }, [containerWidth, fullPageCanvasWidth, updateBlockPresenceMarkers])

  useEffect(() => {
    updateCollaborationCursorMarkers()
  }, [containerWidth, fullPageCanvasWidth, updateCollaborationCursorMarkers])

  useEffect(() => {
    updateCollaborationSelectionMarkers()
  }, [containerWidth, fullPageCanvasWidth, updateCollaborationSelectionMarkers])

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
    let settleFrameId: number | null = null
    const provider = collaboration.binding.provider
    const queueUpdate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
      if (settleFrameId !== null) {
        window.cancelAnimationFrame(settleFrameId)
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null
        settleFrameId = window.requestAnimationFrame(() => {
          settleFrameId = null
          updateCollaborationCursorMarkers()
        })
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
      if (settleFrameId !== null) {
        window.cancelAnimationFrame(settleFrameId)
      }

      editor.off("update", queueUpdate)
      editor.off("selectionUpdate", queueUpdate)
      provider.awareness.off("change", queueUpdate)
      provider.awareness.off("update", queueUpdate)
      container?.removeEventListener("scroll", queueUpdate)
      window.removeEventListener("resize", queueUpdate)
    }
  }, [collaboration, editor, updateCollaborationCursorMarkers])

  useEffect(() => {
    if (!editor || !collaboration) {
      return
    }

    let frameId: number | null = null
    let settleFrameId: number | null = null
    const provider = collaboration.binding.provider
    const queueUpdate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
      if (settleFrameId !== null) {
        window.cancelAnimationFrame(settleFrameId)
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null
        settleFrameId = window.requestAnimationFrame(() => {
          settleFrameId = null
          updateCollaborationSelectionMarkers()
        })
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
      if (settleFrameId !== null) {
        window.cancelAnimationFrame(settleFrameId)
      }

      editor.off("update", queueUpdate)
      editor.off("selectionUpdate", queueUpdate)
      provider.awareness.off("change", queueUpdate)
      provider.awareness.off("update", queueUpdate)
      container?.removeEventListener("scroll", queueUpdate)
      window.removeEventListener("resize", queueUpdate)
    }
  }, [collaboration, editor, updateCollaborationSelectionMarkers])

  if (!editor) {
    return null
  }

  const currentEditor = editor

  function handleInlineMouseDownCapture(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || !currentEditor.isEmpty) {
      return
    }

    const target = event.target instanceof HTMLElement ? event.target : null

    if (target?.closest('button, a, input, textarea, label, [role="button"]')) {
      return
    }

    window.requestAnimationFrame(() => {
      currentEditor.commands.focus("end")
    })
  }

  const activeSlashIndex =
    filteredSlashCommands.length === 0
      ? 0
      : Math.min(slashIndex, filteredSlashCommands.length - 1)
  const activeMentionIndex =
    filteredMentionCandidates.length === 0
      ? 0
      : Math.min(mentionIndex, filteredMentionCandidates.length - 1)

  const toolbar = showToolbar ? (
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
                    +
                    {marker.viewers.length - MAX_VISIBLE_BLOCK_PRESENCE_VIEWERS}
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
        {collaborationCursorMarkers.map((marker) => {
          const showLabelBelow =
            marker.top < COLLABORATION_CURSOR_LABEL_TOP_THRESHOLD_PX

          return (
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
    ) : null

  const collaborationSelectionPresence =
    collaboration && collaborationSelectionMarkers.length > 0 ? (
      <div className="pointer-events-none absolute inset-0 z-[5]">
        {collaborationSelectionMarkers.map((marker) => (
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
    ) : null

  // Full-page mode — used for standalone documents
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

  // Inline mode — used for issue descriptions (no card, no border, seamless)
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className="relative"
        onMouseDownCapture={handleInlineMouseDownCapture}
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

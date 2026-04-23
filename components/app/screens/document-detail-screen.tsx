"use client"

import type { Editor } from "@tiptap/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"
import { useShallow } from "zustand/react/shallow"
import { Trash } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  fetchDocumentDetailReadModel,
  syncClearDocumentPresence,
  syncHeartbeatDocumentPresence,
  syncSendDocumentMentionNotifications,
} from "@/lib/convex/client"
import { createMissingScopedReadModelResult } from "@/lib/convex/client/read-models"
import {
  createDocumentMentionQueueState,
  getPendingDocumentMentionEntries,
  reduceDocumentMentionQueue,
} from "@/lib/content/document-mention-queue"
import {
  extractRichTextMentionCounts,
  summarizePendingDocumentMentions,
} from "@/lib/content/rich-text-mentions"
import {
  getTeam,
  getTeamMembers,
  getWorkspaceUsers,
} from "@/lib/domain/selectors"
import type { DocumentPresenceViewer } from "@/lib/domain/types"
import { useDocumentCollaboration } from "@/hooks/use-document-collaboration"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import { createDocumentDetailScopeKey } from "@/lib/scoped-sync/scope-keys"
import { useAppStore } from "@/lib/store/app-store"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"

import { DocumentPresenceAvatarGroup } from "./document-ui"
import { canEditDocumentInUi, getDocumentPresenceSessionId } from "./helpers"
import { MissingState } from "./shared"

const DOCUMENT_PRESENCE_HEARTBEAT_INTERVAL_MS = 15 * 1000
const DOCUMENT_PRESENCE_BLOCK_CHANGE_DELAY_MS = 250

type DocumentMentionNotificationsResponse = {
  ok: boolean
  recipientCount: number
  mentionCount: number
}

type PendingExitTarget =
  | {
      kind: "href"
      href: string
    }
  | {
      kind: "history"
    }
  | null

function formatMentionCountLabel(count: number) {
  return `${count} ${count === 1 ? "mention" : "mentions"}`
}

function formatRecipientCountLabel(count: number) {
  return `${count} ${count === 1 ? "person" : "people"}`
}

function updateCollaborativeDocumentTitle(editor: Editor, title: string) {
  return editor
    .chain()
    .command(({ dispatch, state, tr }) => {
      let handled = false

      state.doc.descendants((node, pos) => {
        if (handled) {
          return false
        }

        if (node.type.name !== "heading") {
          return true
        }

        handled = true
        tr.insertText(title, pos + 1, pos + node.content.size + 1)
        return false
      })

      if (!handled) {
        return false
      }

      dispatch?.(tr)
      return true
    })
    .run()
}

export function DocumentDetailScreen({ documentId }: { documentId: string }) {
  const router = useRouter()
  const {
    currentWorkspaceId,
    currentUser,
    currentUserId,
    document,
    team,
  } = useAppStore(
    useShallow((state) => {
      const document =
        state.documents.find((entry) => entry.id === documentId) ?? null

      return {
        currentWorkspaceId: state.currentWorkspaceId,
        currentUser:
          state.users.find((entry) => entry.id === state.currentUserId) ?? null,
        currentUserId: state.currentUserId,
        document,
        team: document?.teamId ? getTeam(state, document.teamId) : null,
      }
    })
  )
  const editable = useAppStore((state) =>
    document ? canEditDocumentInUi(state, document) : false
  )
  const mentionCandidates = useAppStore(
    useShallow((state) => {
      if (!document || document.kind === "item-description") {
        return []
      }

      return team
        ? getTeamMembers(state, team.id)
        : getWorkspaceUsers(state, currentWorkspaceId)
    })
  )
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState("")
  const [documentStats, setDocumentStats] = useState({
    words: 0,
    characters: 0,
  })
  const [editorContent, setEditorContent] = useState(() => document?.content ?? "")
  const [documentPresenceViewers, setDocumentPresenceViewers] = useState<
    DocumentPresenceViewer[]
  >([])
  const [legacyActiveBlockId, setLegacyActiveBlockId] = useState<string | null>(
    null
  )
  const [mentionQueue, dispatchMentionQueue] = useReducer(
    reduceDocumentMentionQueue,
    createDocumentMentionQueueState({})
  )
  const [sendingMentionNotifications, setSendingMentionNotifications] =
    useState(false)
  const [pendingExitTarget, setPendingExitTarget] =
    useState<PendingExitTarget>(null)
  const [exitDialogOpen, setExitDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingDocument, setDeletingDocument] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const editorInstanceRef = useRef<Editor | null>(null)
  const legacyActiveBlockIdRef = useRef<string | null>(null)
  const sendLegacyPresenceRef = useRef<(() => void) | null>(null)
  const allowHistoryExitRef = useRef(false)
  const currentRouteHrefRef = useRef<string | null>(null)
  const currentRouteStateRef = useRef<unknown>(null)
  const previousDocumentIdRef = useRef<string | null>(null)
  const currentDocumentContentRef = useRef("")
  const currentDocumentId = document?.id ?? null
  const resolvedDocumentKind = document?.kind ?? null
  const documentTitle = document?.title ?? ""
  const {
    collaboration,
    flush: flushCollaboration,
    lifecycle: collaborationLifecycle,
    viewers: collaborationViewers,
  } = useDocumentCollaboration({
    documentId: currentDocumentId,
    currentUser,
    enabled:
      resolvedDocumentKind !== "item-description" &&
      resolvedDocumentKind !== "private-document",
  })
  const {
    hasLoadedOnce: hasLoadedDocumentReadModel,
  } = useScopedReadModelRefresh({
    enabled:
      Boolean(documentId) &&
      (!document ||
        collaborationLifecycle === "legacy" ||
        collaborationLifecycle === "degraded"),
    scopeKeys: documentId ? [createDocumentDetailScopeKey(documentId)] : [],
    fetchLatest: () => fetchDocumentDetailReadModel(documentId),
    notFoundResult: documentId
      ? createMissingScopedReadModelResult([
          {
            kind: "document-detail",
            documentId,
          },
        ])
      : undefined,
  })
  const isProtectingDocumentBody = Boolean(
    currentDocumentId &&
      (collaborationLifecycle === "bootstrapping" ||
        collaborationLifecycle === "attached")
  )
  const isCollaborationAttached = collaborationLifecycle === "attached"
  const isCollaborationBootstrapping =
    collaborationLifecycle === "bootstrapping"

  currentDocumentContentRef.current = editorContent

  useEffect(() => {
    setEditorContent(document?.content ?? "")
  }, [currentDocumentId])

  useEffect(() => {
    if (!currentDocumentId || isProtectingDocumentBody) {
      return
    }

    setEditorContent(document?.content ?? "")
  }, [currentDocumentId, document?.content, isProtectingDocumentBody])

  useEffect(() => {
    if (!currentDocumentId) {
      return
    }

    useAppStore
      .getState()
      .setDocumentBodyProtection(currentDocumentId, isProtectingDocumentBody)

    return () => {
      useAppStore.getState().setDocumentBodyProtection(currentDocumentId, false)
    }
  }, [currentDocumentId, isProtectingDocumentBody])

  useEffect(() => {
    if (previousDocumentIdRef.current === currentDocumentId) {
      return
    }

    previousDocumentIdRef.current = currentDocumentId
    setLegacyActiveBlockId(null)
    legacyActiveBlockIdRef.current = null
    setIsEditingTitle(false)
    dispatchMentionQueue({
      type: "reset-document",
      counts: extractRichTextMentionCounts(currentDocumentContentRef.current),
    })
    setPendingExitTarget(null)
    setExitDialogOpen(false)
    allowHistoryExitRef.current = false
  }, [currentDocumentId])

  useEffect(() => {
    currentRouteHrefRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`
    currentRouteStateRef.current = window.history.state
  }, [currentDocumentId])

  useEffect(() => {
    if (
      !currentDocumentId ||
      resolvedDocumentKind === "item-description" ||
      isEditingTitle
    ) {
      return
    }

    setDraftTitle(documentTitle)
  }, [currentDocumentId, resolvedDocumentKind, documentTitle, isEditingTitle])

  useEffect(() => {
    if (!isEditingTitle) {
      return
    }

    titleInputRef.current?.focus()
    titleInputRef.current?.select()
  }, [isEditingTitle])

  useEffect(() => {
    if (!currentDocumentId) {
      return
    }

    if (
      collaborationLifecycle === "legacy" ||
      collaborationLifecycle === "degraded"
    ) {
      return
    }

    useAppStore.getState().cancelDocumentSync(currentDocumentId)
  }, [collaborationLifecycle, currentDocumentId])

  useEffect(() => {
    if (!currentDocumentId || resolvedDocumentKind === "item-description") {
      sendLegacyPresenceRef.current = null
      setDocumentPresenceViewers([])
      return
    }

    if (
      collaborationLifecycle === "attached"
    ) {
      sendLegacyPresenceRef.current = null
      setDocumentPresenceViewers([])
      return
    }

    let cancelled = false
    let presenceActive = window.document.visibilityState === "visible"
    let heartbeatTimeoutId: number | null = null
    const activeDocumentId = currentDocumentId
    const sessionId = getDocumentPresenceSessionId(currentUserId)

    function clearHeartbeatTimeout() {
      if (heartbeatTimeoutId !== null) {
        window.clearTimeout(heartbeatTimeoutId)
        heartbeatTimeoutId = null
      }
    }

    function scheduleHeartbeat(delayMs: number) {
      clearHeartbeatTimeout()

      if (
        cancelled ||
        !presenceActive ||
        window.document.visibilityState !== "visible"
      ) {
        return
      }

      heartbeatTimeoutId = window.setTimeout(() => {
        void sendHeartbeat()
      }, delayMs)
    }

    async function sendHeartbeat() {
      if (
        cancelled ||
        !presenceActive ||
        window.document.visibilityState !== "visible"
      ) {
        return
      }

      try {
        const viewers = await syncHeartbeatDocumentPresence(
          activeDocumentId,
          sessionId,
          legacyActiveBlockIdRef.current
        )

        if (
          !cancelled &&
          presenceActive &&
          window.document.visibilityState === "visible"
        ) {
          setDocumentPresenceViewers(viewers)
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to sync document presence", error)
        }
      } finally {
        scheduleHeartbeat(DOCUMENT_PRESENCE_HEARTBEAT_INTERVAL_MS)
      }
    }

    sendLegacyPresenceRef.current = () => {
      void sendHeartbeat()
    }

    function resumePresence() {
      if (cancelled || window.document.visibilityState !== "visible") {
        return
      }

      presenceActive = true
      void sendHeartbeat()
    }

    function leaveDocument(options?: { keepalive?: boolean }) {
      presenceActive = false
      clearHeartbeatTimeout()

      if (!cancelled) {
        setDocumentPresenceViewers([])
      }

      void syncClearDocumentPresence(activeDocumentId, sessionId, {
        keepalive: options?.keepalive,
      }).catch((error) => {
        if (!cancelled && window.document.visibilityState === "visible") {
          console.error("Failed to clear document presence", error)
        }
      })
    }

    const handleVisibilityChange = () => {
      if (window.document.visibilityState === "visible") {
        resumePresence()
        return
      }

      leaveDocument({ keepalive: true })
    }
    const handleWindowFocus = () => {
      resumePresence()
    }
    const handleWindowOnline = () => {
      resumePresence()
    }
    const handlePageShow = () => {
      resumePresence()
    }
    const handlePageHide = () => {
      leaveDocument({ keepalive: true })
    }

    resumePresence()

    window.addEventListener("focus", handleWindowFocus)
    window.addEventListener("online", handleWindowOnline)
    window.addEventListener("pageshow", handlePageShow)
    window.document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      cancelled = true
      clearHeartbeatTimeout()
      window.removeEventListener("focus", handleWindowFocus)
      window.removeEventListener("online", handleWindowOnline)
      window.removeEventListener("pageshow", handlePageShow)
      window.document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      )
      window.removeEventListener("pagehide", handlePageHide)
      sendLegacyPresenceRef.current = null
      void syncClearDocumentPresence(activeDocumentId, sessionId, {
        keepalive: true,
      }).catch(() => {})
    }
  }, [
    collaborationLifecycle,
    currentDocumentId,
    currentUserId,
    resolvedDocumentKind,
  ])
  const hasLiveCollaborationPresence =
    collaborationLifecycle === "attached"
  const activeDocumentViewers =
    hasLiveCollaborationPresence
      ? collaborationViewers
      : currentUser
        ? [
            {
              userId: currentUser.id,
              name: currentUser.name,
              avatarUrl: currentUser.avatarUrl,
              avatarImageUrl: currentUser.avatarImageUrl ?? null,
              activeBlockId: legacyActiveBlockId,
              lastSeenAt: new Date().toISOString(),
            },
            ...documentPresenceViewers,
          ]
        : documentPresenceViewers
  const otherDocumentViewers = activeDocumentViewers.filter(
    (viewer) => viewer.userId !== currentUserId
  )
  const handleLegacyActiveBlockChange = useCallback(
    (activeBlockId: string | null) => {
      legacyActiveBlockIdRef.current = activeBlockId
      setLegacyActiveBlockId(activeBlockId)
    },
    []
  )

  useEffect(() => {
    if (
      hasLiveCollaborationPresence ||
      !currentDocumentId ||
      resolvedDocumentKind === "item-description"
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      sendLegacyPresenceRef.current?.()
    }, DOCUMENT_PRESENCE_BLOCK_CHANGE_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    hasLiveCollaborationPresence,
    currentDocumentId,
    legacyActiveBlockId,
    resolvedDocumentKind,
  ])
  const activePendingMentionEntries = useMemo(
    () => getPendingDocumentMentionEntries(mentionQueue),
    [mentionQueue]
  )
  const pendingMentionSummary = useMemo(
    () => summarizePendingDocumentMentions(activePendingMentionEntries),
    [activePendingMentionEntries]
  )
  const hasPendingMentionNotifications =
    pendingMentionSummary.recipientCount > 0 &&
    document?.kind !== "private-document"
  const handleMentionCountsChange = useCallback(
    (
      counts: Record<string, number>,
      source: "initial" | "local" | "external"
    ) => {
      dispatchMentionQueue({
        type: "sync-counts",
        counts,
        trackCountIncreases:
          source === "local" && document?.kind !== "private-document",
        ignoredUserIds: [currentUserId],
      })
    },
    [currentUserId, document?.kind]
  )

  useEffect(() => {
    if (!hasPendingMentionNotifications) {
      return
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [hasPendingMentionNotifications])

  useEffect(() => {
    if (!hasPendingMentionNotifications) {
      return
    }

    function handleClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      const anchor = target.closest("a[href]")

      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute("download")
      ) {
        return
      }

      if (anchor.target && anchor.target !== "_self") {
        return
      }

      const href = anchor.getAttribute("href")

      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return
      }

      const nextUrl = new URL(anchor.href, window.location.href)

      if (nextUrl.origin !== window.location.origin) {
        return
      }

      const nextHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`

      if (nextHref === currentHref) {
        return
      }

      event.preventDefault()
      setPendingExitTarget({
        kind: "href",
        href: nextHref,
      })
      setExitDialogOpen(true)
    }

    window.document.addEventListener("click", handleClick, true)

    return () => {
      window.document.removeEventListener("click", handleClick, true)
    }
  }, [hasPendingMentionNotifications])

  useEffect(() => {
    if (!hasPendingMentionNotifications) {
      return
    }

    function handlePopState() {
      if (allowHistoryExitRef.current) {
        allowHistoryExitRef.current = false
        return
      }

      const currentHref = currentRouteHrefRef.current

      if (!currentHref) {
        return
      }

      const nextHref = `${window.location.pathname}${window.location.search}${window.location.hash}`

      if (nextHref === currentHref) {
        return
      }

      window.history.pushState(currentRouteStateRef.current, "", currentHref)
      setPendingExitTarget({
        kind: "history",
      })
      setExitDialogOpen(true)
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [hasPendingMentionNotifications])

  const loadedDocument = document
  const backHref = team ? `/team/${team.slug}/docs` : "/workspace/docs"
  const loadedDocumentId = loadedDocument?.id ?? documentId

  function clearPendingMentionBatch() {
    dispatchMentionQueue({
      type: "clear-all",
    })
  }

  function closeExitDialog() {
    setExitDialogOpen(false)
    setPendingExitTarget(null)
  }

  function completePendingExit() {
    const nextTarget = pendingExitTarget
    closeExitDialog()

    if (!nextTarget) {
      return
    }

    if (nextTarget.kind === "href") {
      router.push(nextTarget.href)
      return
    }

    allowHistoryExitRef.current = true
    window.history.back()
  }

  async function sendPendingMentionNotifications() {
    if (activePendingMentionEntries.length === 0) {
      clearPendingMentionBatch()
      return true
    }

    const submittedMentionEntries = activePendingMentionEntries

    setSendingMentionNotifications(true)

    try {
      if (isCollaborationAttached) {
        await flushCollaboration()
      } else {
        await useAppStore.getState().flushDocumentSync(loadedDocumentId)
      }

      const result = (await syncSendDocumentMentionNotifications(
        loadedDocumentId,
        submittedMentionEntries
      )) as DocumentMentionNotificationsResponse

      dispatchMentionQueue({
        type: "mark-sent",
        entries: submittedMentionEntries,
      })
      toast.success(
        `Sent notifications for ${formatMentionCountLabel(
          result.mentionCount
        )} across ${formatRecipientCountLabel(result.recipientCount)}.`
      )
      return true
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to send mention notifications"
      )
      return false
    } finally {
      setSendingMentionNotifications(false)
    }
  }

  function saveTitle() {
    const normalizedTitle = draftTitle.trim() || "Untitled document"
    setIsEditingTitle(false)
    setDraftTitle(normalizedTitle)

    if (normalizedTitle === (loadedDocument?.title ?? "")) {
      return
    }

    if (isCollaborationAttached && editorInstanceRef.current) {
      const updatedTitleInEditor = updateCollaborativeDocumentTitle(
        editorInstanceRef.current,
        normalizedTitle
      )

      if (updatedTitleInEditor) {
        return
      }
    }

    if (isCollaborationBootstrapping) {
      return
    }

    useAppStore.getState().renameDocument(loadedDocumentId, normalizedTitle)
  }

  async function handleDeleteDocument() {
    setDeletingDocument(true)
    clearPendingMentionBatch()
    closeExitDialog()

    try {
      await useAppStore.getState().deleteDocument(loadedDocumentId)
      setDeleteDialogOpen(false)
      router.push(backHref)
    } finally {
      setDeletingDocument(false)
    }
  }

  async function handleSendAndExit() {
    const sent = await sendPendingMentionNotifications()

    if (!sent) {
      return
    }

    completePendingExit()
  }

  function handleSkipAndExit() {
    clearPendingMentionBatch()
    completePendingExit()
  }

  const handleDocumentContentChange = useCallback(
    (content: string) => {
      currentDocumentContentRef.current = content
      setEditorContent(content)

      if (isCollaborationAttached) {
        useAppStore
          .getState()
          .applyDocumentCollaborationContent(loadedDocumentId, content)
        return
      }

      if (isCollaborationBootstrapping) {
        return
      }

      useAppStore.getState().updateDocumentContent(loadedDocumentId, content)
    },
    [isCollaborationAttached, isCollaborationBootstrapping, loadedDocumentId]
  )

  const handleDocumentAttachmentUpload = useCallback(
    (file: File) =>
      useAppStore.getState().uploadAttachment("document", loadedDocumentId, file),
    [loadedDocumentId]
  )

  if (!loadedDocument || loadedDocument.kind === "item-description") {
    if (deletingDocument) {
      return null
    }

    if (!hasLoadedDocumentReadModel) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading document...
        </div>
      )
    }

    return <MissingState title="Document not found" />
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <div className="flex min-h-10 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 py-2">
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            <SidebarTrigger className="size-5 shrink-0" />
            <Link
              href={backHref}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              Docs
            </Link>
            <span className="text-muted-foreground/50">/</span>
            {editable && !isCollaborationBootstrapping ? (
              isEditingTitle ? (
                <Input
                  ref={titleInputRef}
                  value={draftTitle}
                  onBlur={saveTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      event.currentTarget.blur()
                    }
                  }}
                  className="h-7 w-full max-w-sm border-none bg-transparent px-1 py-0 text-sm font-medium shadow-none focus-visible:bg-background focus-visible:ring-1"
                  placeholder="Untitled document"
                />
              ) : (
                <button
                  type="button"
                  className="max-w-full min-w-0 truncate rounded-sm px-1 py-0.5 font-medium transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => {
                    setDraftTitle(document.title)
                    setIsEditingTitle(true)
                  }}
                >
                  {document.title}
                </button>
              )
            ) : (
              <span className="truncate font-medium">{document.title}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {documentStats.words} words · {documentStats.characters}{" "}
              characters
            </span>
            <DocumentPresenceAvatarGroup
              viewers={otherDocumentViewers}
              compact
              className="ml-1.5"
            />
            {editable ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash className="size-3.5" />
                Delete
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <RichTextEditor
            content={editorContent}
            collaboration={collaboration ?? undefined}
            currentPresenceUserId={currentUserId}
            editable={editable && !isCollaborationBootstrapping}
            editorInstanceRef={editorInstanceRef}
            fullPage
            showStats={false}
            placeholder="Start writing..."
            mentionCandidates={mentionCandidates}
            onMentionCountsChange={handleMentionCountsChange}
            onStatsChange={setDocumentStats}
            onChange={handleDocumentContentChange}
            presenceViewers={otherDocumentViewers}
            onActiveBlockChange={handleLegacyActiveBlockChange}
            onUploadAttachment={
              document.kind === "team-document"
                ? handleDocumentAttachmentUpload
                : undefined
            }
          />
        </div>
      </div>

      {hasPendingMentionNotifications ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex w-full max-w-xl items-center justify-between gap-4 rounded-2xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
            <div className="min-w-0">
              <div className="text-sm font-medium">
                Send mention notifications
              </div>
              <div className="text-xs text-muted-foreground">
                {formatMentionCountLabel(pendingMentionSummary.mentionCount)}{" "}
                across{" "}
                {formatRecipientCountLabel(
                  pendingMentionSummary.recipientCount
                )}{" "}
                are ready to send for this document.
              </div>
            </div>
            <Button
              size="sm"
              disabled={sendingMentionNotifications}
              onClick={() => {
                void sendPendingMentionNotifications()
              }}
            >
              {sendingMentionNotifications
                ? "Sending..."
                : "Send notifications"}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={exitDialogOpen}
        onOpenChange={(open) => {
          if (sendingMentionNotifications) {
            return
          }

          setExitDialogOpen(open)

          if (!open) {
            setPendingExitTarget(null)
          }
        }}
      >
        <DialogContent className="max-w-sm gap-0 p-0" showCloseButton={false}>
          <div className="px-5 pt-5 pb-3">
            <DialogHeader className="p-0">
              <DialogTitle className="text-base font-semibold">
                Exit before sending notifications?
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                This document has{" "}
                {formatMentionCountLabel(pendingMentionSummary.mentionCount)}{" "}
                queued for{" "}
                {formatRecipientCountLabel(
                  pendingMentionSummary.recipientCount
                )}
                . Skip them or send them before leaving.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={sendingMentionNotifications}
              onClick={handleSkipAndExit}
            >
              Skip notifications
            </Button>
            <Button
              size="sm"
              disabled={sendingMentionNotifications}
              onClick={() => {
                void handleSendAndExit()
              }}
            >
              {sendingMentionNotifications
                ? "Sending..."
                : "Send notifications"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete document"
        description="This document will be permanently removed. This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deletingDocument}
        onConfirm={() => void handleDeleteDocument()}
      />
    </>
  )
}

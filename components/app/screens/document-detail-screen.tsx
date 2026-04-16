"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { Trash } from "@phosphor-icons/react"

import {
  syncClearDocumentPresence,
  syncHeartbeatDocumentPresence,
} from "@/lib/convex/client"
import type { DocumentPresenceViewer } from "@/lib/domain/types"
import { getTeam, getTeamMembers, getWorkspaceUsers } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"

import { DocumentPresenceAvatarGroup } from "./document-ui"
import { canEditDocumentInUi, getDocumentPresenceSessionId } from "./helpers"
import { MissingState } from "./shared"

const DOCUMENT_PRESENCE_HEARTBEAT_INTERVAL_MS = 15 * 1000

export function DocumentDetailScreen({ documentId }: { documentId: string }) {
  const router = useRouter()
  const { currentWorkspaceId, document, team } = useAppStore(
    useShallow((state) => {
      const document =
        state.documents.find((entry) => entry.id === documentId) ?? null

      return {
        currentWorkspaceId: state.currentWorkspaceId,
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
  const [documentPresenceViewers, setDocumentPresenceViewers] = useState<
    DocumentPresenceViewer[]
  >([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingDocument, setDeletingDocument] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const currentDocumentId = document?.id ?? null
  const resolvedDocumentKind = document?.kind ?? null
  const documentTitle = document?.title ?? ""

  useEffect(() => {
    setIsEditingTitle(false)
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
    if (!currentDocumentId || resolvedDocumentKind === "item-description") {
      setDocumentPresenceViewers([])
      return
    }

    let cancelled = false
    let heartbeatTimeoutId: number | null = null
    const activeDocumentId = currentDocumentId
    const sessionId = getDocumentPresenceSessionId()

    function clearHeartbeatTimeout() {
      if (heartbeatTimeoutId !== null) {
        window.clearTimeout(heartbeatTimeoutId)
        heartbeatTimeoutId = null
      }
    }

    function scheduleHeartbeat(delayMs: number) {
      clearHeartbeatTimeout()

      if (cancelled) {
        return
      }

      heartbeatTimeoutId = window.setTimeout(() => {
        void sendHeartbeat()
      }, delayMs)
    }

    async function sendHeartbeat() {
      if (cancelled) {
        return
      }

      try {
        const viewers = await syncHeartbeatDocumentPresence(
          activeDocumentId,
          sessionId
        )

        if (!cancelled) {
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

    function leaveDocument(options?: { keepalive?: boolean }) {
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
        void sendHeartbeat()
      }
    }
    const handlePageHide = () => {
      leaveDocument({ keepalive: true })
    }

    void sendHeartbeat()

    window.document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      cancelled = true
      clearHeartbeatTimeout()
      window.document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      )
      window.removeEventListener("pagehide", handlePageHide)
      void syncClearDocumentPresence(activeDocumentId, sessionId, {
        keepalive: true,
      }).catch(() => {})
    }
  }, [currentDocumentId, resolvedDocumentKind])

  if (!document || document.kind === "item-description") {
    if (deletingDocument) {
      return null
    }

    return <MissingState title="Document not found" />
  }

  const loadedDocument = document
  const backHref = team ? `/team/${team.slug}/docs` : "/workspace/docs"
  const loadedDocumentId = loadedDocument.id

  function saveTitle() {
    const normalizedTitle = draftTitle.trim() || "Untitled document"
    setIsEditingTitle(false)
    setDraftTitle(normalizedTitle)

    if (normalizedTitle !== loadedDocument.title) {
      useAppStore.getState().renameDocument(loadedDocumentId, normalizedTitle)
    }
  }

  async function handleDeleteDocument() {
    setDeletingDocument(true)

    try {
      await useAppStore.getState().deleteDocument(loadedDocumentId)
      setDeleteDialogOpen(false)
      router.push(backHref)
    } finally {
      setDeletingDocument(false)
    }
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
            {editable ? (
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
              {documentStats.words} words · {documentStats.characters} characters
            </span>
            <DocumentPresenceAvatarGroup viewers={documentPresenceViewers} />
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
            content={document.content}
            editable={editable}
            fullPage
            showStats={false}
            placeholder="Start writing…"
            mentionCandidates={mentionCandidates}
            onStatsChange={setDocumentStats}
            onChange={(content) =>
              useAppStore.getState().updateDocumentContent(document.id, content)
            }
            onUploadAttachment={
              document.kind === "team-document"
                ? (file) =>
                    useAppStore
                      .getState()
                      .uploadAttachment("document", document.id, file)
                : undefined
            }
          />
        </div>
      </div>
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

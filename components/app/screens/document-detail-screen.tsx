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
  type ComponentProps,
  type MutableRefObject,
  type RefObject,
} from "react"
import { useShallow } from "zustand/react/shallow"
import { Trash } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  documentTitleConstraints,
  getTextInputLimitState,
} from "@/lib/domain/input-constraints"
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
import { useInitialCollaborationSyncPreview } from "@/hooks/use-initial-collaboration-sync-preview"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { createDocumentDetailScopeKey } from "@/lib/scoped-sync/scope-keys"
import { useAppStore } from "@/lib/store/app-store"
import { RichTextContent } from "@/components/app/rich-text-content"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import {
  FullPageRichTextShell,
  useFullPageCanvasWidthPreference,
} from "@/components/app/rich-text-editor/full-page-shell"
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
const DOCUMENT_SYNC_MODAL_SEEN_STORAGE_PREFIX =
  "linear:collaboration:document-sync-modal-seen:"

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

type AppState = ReturnType<typeof useAppStore.getState>
type DocumentMentionQueueAction = Parameters<
  typeof reduceDocumentMentionQueue
>[1]
type DocumentMentionQueueDispatch = (action: DocumentMentionQueueAction) => void
type AppRouter = ReturnType<typeof useRouter>

function formatMentionCountLabel(count: number) {
  return `${count} ${count === 1 ? "mention" : "mentions"}`
}

function formatRecipientCountLabel(count: number) {
  return `${count} ${count === 1 ? "person" : "people"}`
}

function useDocumentEditable(document: AppState["documents"][number] | null) {
  return useAppStore((state) =>
    document ? canEditDocumentInUi(state, document) : false
  )
}

function isDocumentCollaborationSyncPreviewEligible(
  document: AppState["documents"][number] | null
) {
  return Boolean(
    document &&
    document.kind !== "item-description" &&
    document.kind !== "private-document"
  )
}

function getDocumentCollaborationPreviewContent({
  bootstrapContent,
  editorContent,
  loadedDocument,
}: {
  bootstrapContent: unknown
  editorContent: string
  loadedDocument: AppState["documents"][number] | null
}) {
  return typeof bootstrapContent === "string"
    ? bootstrapContent
    : (loadedDocument?.content ?? editorContent)
}

function getDocumentDetailBackHref(team: ReturnType<typeof getTeam>) {
  return team ? `/team/${team.slug}/docs` : "/workspace/docs"
}

function clearPendingDocumentMentionBatch(
  dispatchMentionQueue: DocumentMentionQueueDispatch
) {
  dispatchMentionQueue({
    type: "clear-all",
  })
}

async function sendPendingDocumentMentionNotifications({
  activePendingMentionEntries,
  dispatchMentionQueue,
  flushCollaboration,
  isCollaborationAttached,
  loadedDocumentId,
  setSendingMentionNotifications,
}: {
  activePendingMentionEntries: ReturnType<
    typeof getPendingDocumentMentionEntries
  >
  dispatchMentionQueue: DocumentMentionQueueDispatch
  flushCollaboration: ReturnType<typeof useDocumentCollaboration>["flush"]
  isCollaborationAttached: boolean
  loadedDocumentId: string
  setSendingMentionNotifications: (sending: boolean) => void
}) {
  if (activePendingMentionEntries.length === 0) {
    clearPendingDocumentMentionBatch(dispatchMentionQueue)
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

function saveDocumentTitle({
  draftTitle,
  draftTitleLimitState,
  flushCollaboration,
  isCollaborationAttached,
  isCollaborationBootstrapping,
  loadedDocument,
  loadedDocumentId,
  setDraftTitle,
  setIsEditingTitle,
  titleInputRef,
}: {
  draftTitle: string
  draftTitleLimitState: ReturnType<typeof getTextInputLimitState>
  flushCollaboration: ReturnType<typeof useDocumentCollaboration>["flush"]
  isCollaborationAttached: boolean
  isCollaborationBootstrapping: boolean
  loadedDocument: AppState["documents"][number] | null
  loadedDocumentId: string
  setDraftTitle: (title: string) => void
  setIsEditingTitle: (editing: boolean) => void
  titleInputRef: RefObject<HTMLInputElement | null>
}) {
  if (!draftTitleLimitState.canSubmit) {
    titleInputRef.current?.focus()
    return
  }

  const normalizedTitle = draftTitle.trim() || "Untitled document"
  setIsEditingTitle(false)
  setDraftTitle(normalizedTitle)

  if (normalizedTitle === (loadedDocument?.title ?? "")) {
    return
  }

  if (isCollaborationAttached) {
    useAppStore
      .getState()
      .applyDocumentCollaborationTitle(loadedDocumentId, normalizedTitle)
    void flushCollaboration({
      kind: "document-title",
      documentTitle: normalizedTitle,
    }).catch((error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update document"
      )
    })
    return
  }

  if (isCollaborationBootstrapping) {
    return
  }

  useAppStore.getState().renameDocument(loadedDocumentId, normalizedTitle)
}

function applyDocumentContentChange({
  content,
  currentDocumentContentRef,
  isCollaborationAttached,
  isCollaborationBootstrapping,
  loadedDocumentId,
  setEditorContent,
}: {
  content: string
  currentDocumentContentRef: MutableRefObject<string>
  isCollaborationAttached: boolean
  isCollaborationBootstrapping: boolean
  loadedDocumentId: string
  setEditorContent: (content: string) => void
}) {
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
}

function completePendingDocumentExit({
  allowHistoryExitRef,
  closeExitDialog,
  pendingExitTarget,
  router,
}: {
  allowHistoryExitRef: MutableRefObject<boolean>
  closeExitDialog: () => void
  pendingExitTarget: PendingExitTarget
  router: AppRouter
}) {
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

function updateDocumentPendingExitDialogOpen({
  open,
  sendingMentionNotifications,
  setExitDialogOpen,
  setPendingExitTarget,
}: {
  open: boolean
  sendingMentionNotifications: boolean
  setExitDialogOpen: (open: boolean) => void
  setPendingExitTarget: (target: PendingExitTarget) => void
}) {
  if (sendingMentionNotifications) {
    return
  }

  setExitDialogOpen(open)

  if (!open) {
    setPendingExitTarget(null)
  }
}

function DocumentDetailHeader({
  backHref,
  documentTitle,
  editable,
  isEditingTitle,
  isCollaborationBootstrapping,
  draftTitle,
  draftTitleLimitState,
  titleInputRef,
  documentStats,
  otherDocumentViewers,
  onDraftTitleChange,
  onSaveTitle,
  onStartEditingTitle,
  onDelete,
}: {
  backHref: string
  documentTitle: string
  editable: boolean
  isEditingTitle: boolean
  isCollaborationBootstrapping: boolean
  draftTitle: string
  draftTitleLimitState: ReturnType<typeof getTextInputLimitState>
  titleInputRef: RefObject<HTMLInputElement | null>
  documentStats: {
    words: number
    characters: number
  }
  otherDocumentViewers: DocumentPresenceViewer[]
  onDraftTitleChange: (title: string) => void
  onSaveTitle: () => void
  onStartEditingTitle: () => void
  onDelete: () => void
}) {
  return (
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
            <div className="w-full max-w-sm">
              <Input
                ref={titleInputRef}
                value={draftTitle}
                onBlur={onSaveTitle}
                onChange={(event) => onDraftTitleChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    event.currentTarget.blur()
                  }
                }}
                maxLength={documentTitleConstraints.max}
                className="h-7 w-full border-none bg-transparent px-1 py-0 text-sm font-medium shadow-none focus-visible:bg-background focus-visible:ring-1"
                placeholder="Untitled document"
              />
              <FieldCharacterLimit
                state={draftTitleLimitState}
                limit={documentTitleConstraints.max}
                className="mt-1 px-1"
              />
            </div>
          ) : (
            <button
              type="button"
              className="max-w-full min-w-0 truncate rounded-sm px-1 py-0.5 font-medium transition-colors hover:bg-accent hover:text-foreground"
              onClick={onStartEditingTitle}
            >
              {documentTitle}
            </button>
          )
        ) : (
          <span className="truncate font-medium">{documentTitle}</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {documentStats.words} words · {documentStats.characters} characters
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
            onClick={onDelete}
          >
            <Trash className="size-3.5" />
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function DocumentEditorPane({
  showCollaborationBootPreview,
  fullPageCanvasWidth,
  collaborationPreviewContent,
  collaborationEditorContent,
  isCollaborationAttached,
  isCollaborationBootstrapping,
  editorCollaboration,
  collaboration,
  currentUserId,
  editable,
  editorInstanceRef,
  mentionCandidates,
  otherDocumentViewers,
  documentKind,
  onMentionCountsChange,
  onStatsChange,
  onChange,
  onActiveBlockChange,
  onUploadAttachment,
}: {
  showCollaborationBootPreview: boolean
  fullPageCanvasWidth: ReturnType<
    typeof useFullPageCanvasWidthPreference
  >["fullPageCanvasWidth"]
  collaborationPreviewContent: string
  collaborationEditorContent: string
  isCollaborationAttached: boolean
  isCollaborationBootstrapping: boolean
  editorCollaboration: unknown
  collaboration: unknown
  currentUserId: string
  editable: boolean
  editorInstanceRef: MutableRefObject<Editor | null>
  mentionCandidates: ReturnType<typeof getWorkspaceUsers>
  otherDocumentViewers: DocumentPresenceViewer[]
  documentKind: string
  onMentionCountsChange: (
    counts: Record<string, number>,
    source: "initial" | "local" | "external"
  ) => void
  onStatsChange: (stats: { words: number; characters: number }) => void
  onChange: (content: string) => void
  onActiveBlockChange: (activeBlockId: string | null) => void
  onUploadAttachment: ComponentProps<
    typeof RichTextEditor
  >["onUploadAttachment"]
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {showCollaborationBootPreview ? (
        <FullPageRichTextShell
          canvasWidth={fullPageCanvasWidth}
          reserveToolbarSpace
        >
          <RichTextContent
            content={collaborationPreviewContent}
            className="text-fg-1 text-base [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-fg-2 [&_h1]:mt-0 [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:leading-tight [&_h1]:font-bold [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:leading-tight [&_h2]:font-semibold [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:leading-tight [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mt-0 [&_p]:leading-7 [&_p+p]:mt-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
          />
        </FullPageRichTextShell>
      ) : (
        <RichTextEditor
          content={collaborationEditorContent}
          collaboration={
            isCollaborationAttached
              ? ((editorCollaboration ?? collaboration ?? undefined) as never)
              : undefined
          }
          currentPresenceUserId={currentUserId}
          editable={editable && !isCollaborationBootstrapping}
          editorInstanceRef={editorInstanceRef}
          fullPage
          showStats={false}
          placeholder="Start writing..."
          mentionCandidates={mentionCandidates}
          onMentionCountsChange={onMentionCountsChange}
          onStatsChange={onStatsChange}
          onChange={onChange}
          presenceViewers={otherDocumentViewers}
          onActiveBlockChange={onActiveBlockChange}
          onUploadAttachment={
            documentKind === "team-document" ? onUploadAttachment : undefined
          }
        />
      )}
    </div>
  )
}

function DocumentUnavailableState({
  deletingDocument,
  hasLoadedDocumentReadModel,
}: {
  deletingDocument: boolean
  hasLoadedDocumentReadModel: boolean
}) {
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

function DocumentMentionNotificationBanner({
  hasPendingMentionNotifications,
  pendingMentionSummary,
  sendingMentionNotifications,
  onSend,
}: {
  hasPendingMentionNotifications: boolean
  pendingMentionSummary: ReturnType<typeof summarizePendingDocumentMentions>
  sendingMentionNotifications: boolean
  onSend: () => void
}) {
  if (!hasPendingMentionNotifications) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-xl items-center justify-between gap-4 rounded-2xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="min-w-0">
          <div className="text-sm font-medium">Send mention notifications</div>
          <div className="text-xs text-muted-foreground">
            {formatMentionCountLabel(pendingMentionSummary.mentionCount)} across{" "}
            {formatRecipientCountLabel(pendingMentionSummary.recipientCount)}{" "}
            are ready to send for this document.
          </div>
        </div>
        <Button
          size="sm"
          disabled={sendingMentionNotifications}
          onClick={onSend}
        >
          {sendingMentionNotifications ? "Sending..." : "Send notifications"}
        </Button>
      </div>
    </div>
  )
}

function DocumentPendingExitDialog({
  exitDialogOpen,
  pendingMentionSummary,
  sendingMentionNotifications,
  onOpenChange,
  onSendAndExit,
  onSkipAndExit,
}: {
  exitDialogOpen: boolean
  pendingMentionSummary: ReturnType<typeof summarizePendingDocumentMentions>
  sendingMentionNotifications: boolean
  onOpenChange: (open: boolean) => void
  onSendAndExit: () => void
  onSkipAndExit: () => void
}) {
  return (
    <Dialog open={exitDialogOpen} onOpenChange={onOpenChange}>
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
              {formatRecipientCountLabel(pendingMentionSummary.recipientCount)}.
              Skip them or send them before leaving.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={sendingMentionNotifications}
            onClick={onSkipAndExit}
          >
            Skip notifications
          </Button>
          <Button
            size="sm"
            disabled={sendingMentionNotifications}
            onClick={onSendAndExit}
          >
            {sendingMentionNotifications ? "Sending..." : "Send notifications"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DocumentCollaborationSyncDialog({
  showCollaborationBootPreview,
}: {
  showCollaborationBootPreview: boolean
}) {
  return (
    <Dialog open={showCollaborationBootPreview}>
      <DialogContent className="max-w-sm gap-0 p-0" showCloseButton={false}>
        <div className="px-5 py-5">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base font-semibold">
              Syncing latest changes
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Loading the latest document state. Editing will unlock
              automatically in a moment.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2 animate-pulse rounded-full bg-primary"
            />
            <span>Syncing latest changes…</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DocumentDeleteConfirmDialog({
  deleteDialogOpen,
  deletingDocument,
  onConfirm,
  onOpenChange,
}: {
  deleteDialogOpen: boolean
  deletingDocument: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ConfirmDialog
      open={deleteDialogOpen}
      onOpenChange={onOpenChange}
      title="Delete document"
      description="This document will be permanently removed. This can't be undone."
      confirmLabel="Delete"
      variant="destructive"
      loading={deletingDocument}
      onConfirm={onConfirm}
    />
  )
}

function DocumentDetailLoadedView({
  backHref,
  collaboration,
  collaborationEditorContent,
  collaborationPreviewContent,
  currentUserId,
  deleteDialogOpen,
  deletingDocument,
  document,
  documentStats,
  draftTitle,
  draftTitleLimitState,
  editable,
  editorCollaboration,
  editorInstanceRef,
  exitDialogOpen,
  fullPageCanvasWidth,
  hasPendingMentionNotifications,
  isCollaborationAttached,
  isCollaborationBootstrapping,
  isEditingTitle,
  mentionCandidates,
  otherDocumentViewers,
  pendingMentionSummary,
  sendingMentionNotifications,
  showCollaborationBootPreview,
  titleInputRef,
  onActiveBlockChange,
  onChange,
  onDelete,
  onDeleteDialogOpenChange,
  onDraftTitleChange,
  onExitDialogOpenChange,
  onMentionCountsChange,
  onSaveTitle,
  onSendAndExit,
  onSendMentions,
  onSkipAndExit,
  onStartEditingTitle,
  onStatsChange,
  onUploadAttachment,
}: {
  backHref: string
  collaboration: unknown
  collaborationEditorContent: string
  collaborationPreviewContent: string
  currentUserId: string
  deleteDialogOpen: boolean
  deletingDocument: boolean
  document: AppState["documents"][number]
  documentStats: { words: number; characters: number }
  draftTitle: string
  draftTitleLimitState: ReturnType<typeof getTextInputLimitState>
  editable: boolean
  editorCollaboration: unknown
  editorInstanceRef: MutableRefObject<Editor | null>
  exitDialogOpen: boolean
  fullPageCanvasWidth: ReturnType<
    typeof useFullPageCanvasWidthPreference
  >["fullPageCanvasWidth"]
  hasPendingMentionNotifications: boolean
  isCollaborationAttached: boolean
  isCollaborationBootstrapping: boolean
  isEditingTitle: boolean
  mentionCandidates: ReturnType<typeof getWorkspaceUsers>
  otherDocumentViewers: DocumentPresenceViewer[]
  pendingMentionSummary: ReturnType<typeof summarizePendingDocumentMentions>
  sendingMentionNotifications: boolean
  showCollaborationBootPreview: boolean
  titleInputRef: RefObject<HTMLInputElement | null>
  onActiveBlockChange: (activeBlockId: string | null) => void
  onChange: (content: string) => void
  onDelete: () => void
  onDeleteDialogOpenChange: (open: boolean) => void
  onDraftTitleChange: (title: string) => void
  onExitDialogOpenChange: (open: boolean) => void
  onMentionCountsChange: (
    counts: Record<string, number>,
    source: "initial" | "local" | "external"
  ) => void
  onSaveTitle: () => void
  onSendAndExit: () => void
  onSendMentions: () => void
  onSkipAndExit: () => void
  onStartEditingTitle: () => void
  onStatsChange: (stats: { words: number; characters: number }) => void
  onUploadAttachment: ComponentProps<
    typeof RichTextEditor
  >["onUploadAttachment"]
}) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <DocumentDetailHeader
          backHref={backHref}
          documentTitle={document.title}
          editable={editable}
          isEditingTitle={isEditingTitle}
          isCollaborationBootstrapping={isCollaborationBootstrapping}
          draftTitle={draftTitle}
          draftTitleLimitState={draftTitleLimitState}
          titleInputRef={titleInputRef}
          documentStats={documentStats}
          otherDocumentViewers={otherDocumentViewers}
          onDraftTitleChange={onDraftTitleChange}
          onSaveTitle={onSaveTitle}
          onStartEditingTitle={onStartEditingTitle}
          onDelete={onDelete}
        />

        <DocumentEditorPane
          showCollaborationBootPreview={showCollaborationBootPreview}
          fullPageCanvasWidth={fullPageCanvasWidth}
          collaborationPreviewContent={collaborationPreviewContent}
          collaborationEditorContent={collaborationEditorContent}
          isCollaborationAttached={isCollaborationAttached}
          isCollaborationBootstrapping={isCollaborationBootstrapping}
          editorCollaboration={editorCollaboration}
          collaboration={collaboration}
          currentUserId={currentUserId}
          editable={editable}
          editorInstanceRef={editorInstanceRef}
          mentionCandidates={mentionCandidates}
          otherDocumentViewers={otherDocumentViewers}
          documentKind={document.kind}
          onMentionCountsChange={onMentionCountsChange}
          onStatsChange={onStatsChange}
          onChange={onChange}
          onActiveBlockChange={onActiveBlockChange}
          onUploadAttachment={onUploadAttachment}
        />
      </div>

      <DocumentMentionNotificationBanner
        hasPendingMentionNotifications={hasPendingMentionNotifications}
        pendingMentionSummary={pendingMentionSummary}
        sendingMentionNotifications={sendingMentionNotifications}
        onSend={onSendMentions}
      />
      <DocumentPendingExitDialog
        exitDialogOpen={exitDialogOpen}
        pendingMentionSummary={pendingMentionSummary}
        sendingMentionNotifications={sendingMentionNotifications}
        onOpenChange={onExitDialogOpenChange}
        onSendAndExit={onSendAndExit}
        onSkipAndExit={onSkipAndExit}
      />
      <DocumentCollaborationSyncDialog
        showCollaborationBootPreview={showCollaborationBootPreview}
      />
      <DocumentDeleteConfirmDialog
        deleteDialogOpen={deleteDialogOpen}
        deletingDocument={deletingDocument}
        onOpenChange={onDeleteDialogOpenChange}
        onConfirm={onDelete}
      />
    </>
  )
}

type DocumentCollaborationLifecycle =
  | "legacy"
  | "bootstrapping"
  | "attached"
  | "degraded"

function useLegacyActiveBlockState() {
  const [legacyActiveBlockId, setLegacyActiveBlockId] = useState<string | null>(
    null
  )
  const legacyActiveBlockIdRef = useRef<string | null>(null)
  const handleLegacyActiveBlockChange = useCallback(
    (activeBlockId: string | null) => {
      legacyActiveBlockIdRef.current = activeBlockId
      setLegacyActiveBlockId(activeBlockId)
    },
    []
  )
  const resetLegacyActiveBlock = useCallback(() => {
    legacyActiveBlockIdRef.current = null
    setLegacyActiveBlockId(null)
  }, [])

  return {
    legacyActiveBlockId,
    legacyActiveBlockIdRef,
    resetLegacyActiveBlock,
    handleLegacyActiveBlockChange,
  }
}

function useLegacyDocumentPresenceHeartbeat({
  collaborationLifecycle,
  currentDocumentId,
  currentUserId,
  legacyActiveBlockIdRef,
  resolvedDocumentKind,
}: {
  collaborationLifecycle: DocumentCollaborationLifecycle
  currentDocumentId: string | null
  currentUserId: string
  legacyActiveBlockIdRef: MutableRefObject<string | null>
  resolvedDocumentKind: string | null
}) {
  const [documentPresenceViewers, setDocumentPresenceViewers] = useState<
    DocumentPresenceViewer[]
  >([])
  const sendLegacyPresenceRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!currentDocumentId || resolvedDocumentKind === "item-description") {
      sendLegacyPresenceRef.current = null
      setDocumentPresenceViewers([])
      return
    }

    if (
      collaborationLifecycle === "bootstrapping" ||
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
    legacyActiveBlockIdRef,
    resolvedDocumentKind,
  ])

  return {
    documentPresenceViewers,
    sendLegacyPresenceRef,
  }
}

function useLegacyActiveBlockPresenceSync({
  currentDocumentId,
  hasLiveCollaborationPresence,
  legacyActiveBlockId,
  resolvedDocumentKind,
  sendLegacyPresenceRef,
}: {
  currentDocumentId: string | null
  hasLiveCollaborationPresence: boolean
  legacyActiveBlockId: string | null
  resolvedDocumentKind: string | null
  sendLegacyPresenceRef: MutableRefObject<(() => void) | null>
}) {
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
    sendLegacyPresenceRef,
  ])
}

function getActiveDocumentPresenceViewers({
  collaborationLifecycle,
  collaborationViewers,
  currentUser,
  documentPresenceViewers,
  legacyActiveBlockId,
}: {
  collaborationLifecycle: DocumentCollaborationLifecycle
  collaborationViewers: DocumentPresenceViewer[]
  currentUser: {
    id: string
    name: string
    avatarUrl?: string | null
    avatarImageUrl?: string | null
  } | null
  documentPresenceViewers: DocumentPresenceViewer[]
  legacyActiveBlockId: string | null
}) {
  if (collaborationLifecycle === "attached") {
    return collaborationViewers
  }

  if (!currentUser) {
    return documentPresenceViewers
  }

  return [
    {
      userId: currentUser.id,
      name: currentUser.name,
      avatarUrl: currentUser.avatarUrl ?? "",
      avatarImageUrl: currentUser.avatarImageUrl ?? null,
      activeBlockId: legacyActiveBlockId,
      lastSeenAt: new Date().toISOString(),
    },
    ...documentPresenceViewers,
  ]
}

function useDocumentPresenceViewers({
  collaborationLifecycle,
  collaborationViewers,
  currentDocumentId,
  currentUser,
  currentUserId,
  resolvedDocumentKind,
}: {
  collaborationLifecycle: DocumentCollaborationLifecycle
  collaborationViewers: DocumentPresenceViewer[]
  currentDocumentId: string | null
  currentUser: {
    id: string
    name: string
    avatarUrl?: string | null
    avatarImageUrl?: string | null
  } | null
  currentUserId: string
  resolvedDocumentKind: string | null
}) {
  const {
    legacyActiveBlockId,
    legacyActiveBlockIdRef,
    resetLegacyActiveBlock,
    handleLegacyActiveBlockChange,
  } = useLegacyActiveBlockState()
  const { documentPresenceViewers, sendLegacyPresenceRef } =
    useLegacyDocumentPresenceHeartbeat({
      collaborationLifecycle,
      currentDocumentId,
      currentUserId,
      legacyActiveBlockIdRef,
      resolvedDocumentKind,
    })
  const hasLiveCollaborationPresence = collaborationLifecycle === "attached"
  const activeDocumentViewers = getActiveDocumentPresenceViewers({
    collaborationLifecycle,
    collaborationViewers,
    currentUser,
    documentPresenceViewers,
    legacyActiveBlockId,
  })
  const otherDocumentViewers = activeDocumentViewers.filter(
    (viewer) => viewer.userId !== currentUserId
  )

  useLegacyActiveBlockPresenceSync({
    currentDocumentId,
    hasLiveCollaborationPresence,
    legacyActiveBlockId,
    resolvedDocumentKind,
    sendLegacyPresenceRef,
  })

  return {
    handleLegacyActiveBlockChange,
    otherDocumentViewers,
    resetLegacyActiveBlock,
  }
}

function useDocumentDetailStoreSelection(documentId: string) {
  return useAppStore(
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
}

function useDocumentMentionCandidates({
  currentWorkspaceId,
  document,
  team,
}: {
  currentWorkspaceId: string
  document: AppState["documents"][number] | null
  team: ReturnType<typeof getTeam>
}) {
  return useAppStore(
    useShallow((state) => {
      if (!document || document.kind === "item-description") {
        return []
      }

      return team
        ? getTeamMembers(state, team.id)
        : getWorkspaceUsers(state, currentWorkspaceId)
    })
  )
}

function useDocumentBodyProtection({
  collaborationLifecycle,
  currentDocumentId,
  stableCollaborativeDocumentId,
}: {
  collaborationLifecycle: DocumentCollaborationLifecycle
  currentDocumentId: string | null
  stableCollaborativeDocumentId: string | null
}) {
  const protectedDocumentId = currentDocumentId ?? stableCollaborativeDocumentId
  const isProtectingDocumentBody = Boolean(
    protectedDocumentId &&
    (collaborationLifecycle === "bootstrapping" ||
      collaborationLifecycle === "attached")
  )

  useEffect(() => {
    if (!protectedDocumentId) {
      return
    }

    const state = useAppStore.getState()

    if (isProtectingDocumentBody) {
      state.cancelDocumentSync(protectedDocumentId)
    }

    state.setDocumentBodyProtection(
      protectedDocumentId,
      isProtectingDocumentBody
    )

    return () => {
      useAppStore
        .getState()
        .setDocumentBodyProtection(protectedDocumentId, false)
    }
  }, [protectedDocumentId, isProtectingDocumentBody])

  return {
    isProtectingDocumentBody,
    protectedDocumentId,
  }
}

function getPendingMentionNavigationHref(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return null
  }

  const target = event.target

  if (!(target instanceof Element)) {
    return null
  }

  const anchor = target.closest("a[href]")

  if (
    !(anchor instanceof HTMLAnchorElement) ||
    anchor.hasAttribute("download")
  ) {
    return null
  }

  if (anchor.target && anchor.target !== "_self") {
    return null
  }

  const href = anchor.getAttribute("href")

  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return null
  }

  const nextUrl = new URL(anchor.href, window.location.href)

  if (nextUrl.origin !== window.location.origin) {
    return null
  }

  const nextHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
  const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`

  return nextHref === currentHref ? null : nextHref
}

function usePendingMentionBeforeUnload(
  hasPendingMentionNotifications: boolean
) {
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
}

function usePendingMentionLinkNavigationGuard({
  hasPendingMentionNotifications,
  setExitDialogOpen,
  setPendingExitTarget,
}: {
  hasPendingMentionNotifications: boolean
  setExitDialogOpen: (open: boolean) => void
  setPendingExitTarget: (target: PendingExitTarget) => void
}) {
  useEffect(() => {
    if (!hasPendingMentionNotifications) {
      return
    }

    function handleClick(event: MouseEvent) {
      const nextHref = getPendingMentionNavigationHref(event)

      if (!nextHref) {
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
  }, [hasPendingMentionNotifications, setExitDialogOpen, setPendingExitTarget])
}

function usePendingMentionHistoryNavigationGuard({
  allowHistoryExitRef,
  currentRouteHrefRef,
  currentRouteStateRef,
  hasPendingMentionNotifications,
  setExitDialogOpen,
  setPendingExitTarget,
}: {
  allowHistoryExitRef: MutableRefObject<boolean>
  currentRouteHrefRef: MutableRefObject<string | null>
  currentRouteStateRef: MutableRefObject<unknown>
  hasPendingMentionNotifications: boolean
  setExitDialogOpen: (open: boolean) => void
  setPendingExitTarget: (target: PendingExitTarget) => void
}) {
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
  }, [
    allowHistoryExitRef,
    currentRouteHrefRef,
    currentRouteStateRef,
    hasPendingMentionNotifications,
    setExitDialogOpen,
    setPendingExitTarget,
  ])
}

function useDocumentTitleDraft({
  currentDocumentId,
  documentTitle,
  resolvedDocumentKind,
}: {
  currentDocumentId: string | null
  documentTitle: string
  resolvedDocumentKind: string | null
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState("")
  const titleInputRef = useRef<HTMLInputElement>(null)
  const draftTitleLimitState = getTextInputLimitState(draftTitle, {
    ...documentTitleConstraints,
    allowEmpty: true,
  })

  useEffect(() => {
    if (
      !currentDocumentId ||
      resolvedDocumentKind === "item-description" ||
      isEditingTitle
    ) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- loaded document changes reset the local title draft.
    setDraftTitle(documentTitle)
  }, [currentDocumentId, resolvedDocumentKind, documentTitle, isEditingTitle])

  useEffect(() => {
    if (!isEditingTitle) {
      return
    }

    titleInputRef.current?.focus()
    titleInputRef.current?.select()
  }, [isEditingTitle])

  return {
    draftTitle,
    draftTitleLimitState,
    isEditingTitle,
    setDraftTitle,
    setIsEditingTitle,
    titleInputRef,
  }
}

function useDocumentCollaborationIdentity({
  currentUser,
  currentUserId,
  document,
  documentId,
}: {
  currentUser: AppState["users"][number] | null
  currentUserId: string
  document: AppState["documents"][number] | null
  documentId: string
}) {
  const previousRouteDocumentIdRef = useRef(documentId)
  const [stableCollaborationUser, setStableCollaborationUser] = useState<{
    id: string
    name: string
    avatarUrl?: string | null
    avatarImageUrl?: string | null
  } | null>(null)
  const [stableCollaborativeDocumentId, setStableCollaborativeDocumentId] =
    useState<string | null>(null)

  useEffect(() => {
    if (!currentUser) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- preserve the last known user while document collaboration reconnects.
    setStableCollaborationUser({
      id: currentUserId,
      name: currentUser.name,
      avatarUrl: currentUser.avatarUrl,
      avatarImageUrl: currentUser.avatarImageUrl ?? null,
    })
  }, [currentUser, currentUserId])

  useEffect(() => {
    if (previousRouteDocumentIdRef.current === documentId) {
      return
    }

    previousRouteDocumentIdRef.current = documentId
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route changes clear the collaboration target before the next document resolves.
    setStableCollaborativeDocumentId(null)
  }, [documentId])

  useEffect(() => {
    if (!document) {
      return
    }

    if (
      document.kind === "private-document" ||
      document.kind === "item-description"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- these document kinds deliberately opt out of collaboration.
      setStableCollaborativeDocumentId(null)
      return
    }

    setStableCollaborativeDocumentId(document.id)
  }, [document])

  return {
    collaborationCurrentUser: currentUser ?? stableCollaborationUser ?? null,
    stableCollaborativeDocumentId,
  }
}

function useDocumentRouteRefs(currentDocumentId: string | null) {
  const currentRouteHrefRef = useRef<string | null>(null)
  const currentRouteStateRef = useRef<unknown>(null)

  useEffect(() => {
    currentRouteHrefRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`
    currentRouteStateRef.current = window.history.state
  }, [currentDocumentId])

  return {
    currentRouteHrefRef,
    currentRouteStateRef,
  }
}

function useDocumentEditorContentLifecycle({
  allowHistoryExitRef,
  currentDocumentId,
  documentContent,
  dispatchMentionQueue,
  isProtectingDocumentBody,
  resetLegacyActiveBlock,
  setExitDialogOpen,
  setIsEditingTitle,
  setPendingExitTarget,
}: {
  allowHistoryExitRef: MutableRefObject<boolean>
  currentDocumentId: string | null
  documentContent: string
  dispatchMentionQueue: DocumentMentionQueueDispatch
  isProtectingDocumentBody: boolean
  resetLegacyActiveBlock: () => void
  setExitDialogOpen: (open: boolean) => void
  setIsEditingTitle: (editing: boolean) => void
  setPendingExitTarget: (target: PendingExitTarget) => void
}) {
  const [documentStats, setDocumentStats] = useState({
    words: 0,
    characters: 0,
  })
  const [editorContent, setEditorContent] = useState(documentContent)
  const latestDocumentContentRef = useRef(documentContent)
  const currentDocumentContentRef = useRef("")
  const previousDocumentIdRef = useRef<string | null>(null)

  useEffect(() => {
    latestDocumentContentRef.current = documentContent
  }, [documentContent])

  useEffect(() => {
    currentDocumentContentRef.current = editorContent
  }, [editorContent])

  useEffect(() => {
    setEditorContent(latestDocumentContentRef.current)
  }, [currentDocumentId])

  useEffect(() => {
    if (!currentDocumentId || isProtectingDocumentBody) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- external document content refreshes the local editor draft when unprotected.
    setEditorContent(documentContent)
  }, [currentDocumentId, documentContent, isProtectingDocumentBody])

  useEffect(() => {
    if (previousDocumentIdRef.current === currentDocumentId) {
      return
    }

    previousDocumentIdRef.current = currentDocumentId
    resetLegacyActiveBlock()
    setIsEditingTitle(false)
    dispatchMentionQueue({
      type: "reset-document",
      counts: extractRichTextMentionCounts(currentDocumentContentRef.current),
    })
    setPendingExitTarget(null)
    setExitDialogOpen(false)
    allowHistoryExitRef.current = false
  }, [
    allowHistoryExitRef,
    currentDocumentId,
    dispatchMentionQueue,
    resetLegacyActiveBlock,
    setExitDialogOpen,
    setIsEditingTitle,
    setPendingExitTarget,
  ])

  return {
    currentDocumentContentRef,
    documentStats,
    editorContent,
    setDocumentStats,
    setEditorContent,
  }
}

export function DocumentDetailScreen({ documentId }: { documentId: string }) {
  const router = useRouter()
  const { currentWorkspaceId, currentUser, currentUserId, document, team } =
    useDocumentDetailStoreSelection(documentId)
  const editable = useDocumentEditable(document)
  const mentionCandidates = useDocumentMentionCandidates({
    currentWorkspaceId,
    document,
    team,
  })
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
  const editorInstanceRef = useRef<Editor | null>(null)
  const allowHistoryExitRef = useRef(false)
  const currentDocumentId = document?.id ?? null
  const resolvedDocumentKind = document?.kind ?? null
  const documentTitle = document?.title ?? ""
  const {
    draftTitle,
    draftTitleLimitState,
    isEditingTitle,
    setDraftTitle,
    setIsEditingTitle,
    titleInputRef,
  } = useDocumentTitleDraft({
    currentDocumentId,
    documentTitle,
    resolvedDocumentKind,
  })
  const { collaborationCurrentUser, stableCollaborativeDocumentId } =
    useDocumentCollaborationIdentity({
      currentUser,
      currentUserId,
      document,
      documentId,
    })
  const { currentRouteHrefRef, currentRouteStateRef } =
    useDocumentRouteRefs(currentDocumentId)
  const { fullPageCanvasWidth } = useFullPageCanvasWidthPreference(true)
  const {
    bootstrapContent,
    editorCollaboration,
    collaboration,
    flush: flushCollaboration,
    lifecycle: collaborationLifecycle,
    viewers: collaborationViewers,
  } = useDocumentCollaboration({
    documentId: stableCollaborativeDocumentId,
    currentUser: collaborationCurrentUser,
    enabled: Boolean(stableCollaborativeDocumentId),
  })
  const { hasLoadedOnce: hasLoadedDocumentReadModel } =
    useScopedReadModelRefresh({
      enabled: Boolean(documentId),
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
  const { isProtectingDocumentBody } = useDocumentBodyProtection({
    collaborationLifecycle,
    currentDocumentId,
    stableCollaborativeDocumentId,
  })
  const isCollaborationAttached = collaborationLifecycle === "attached"
  const isCollaborationBootstrapping =
    collaborationLifecycle === "bootstrapping"
  const {
    handleLegacyActiveBlockChange,
    otherDocumentViewers,
    resetLegacyActiveBlock,
  } = useDocumentPresenceViewers({
    collaborationLifecycle,
    collaborationViewers,
    currentDocumentId,
    currentUser,
    currentUserId,
    resolvedDocumentKind,
  })
  const {
    currentDocumentContentRef,
    documentStats,
    editorContent,
    setDocumentStats,
    setEditorContent,
  } = useDocumentEditorContentLifecycle({
    allowHistoryExitRef,
    currentDocumentId,
    documentContent: document?.content ?? "",
    dispatchMentionQueue,
    isProtectingDocumentBody,
    resetLegacyActiveBlock,
    setExitDialogOpen,
    setIsEditingTitle,
    setPendingExitTarget,
  })
  const collaborationEditorContent = editorContent

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
        rebaseCounts: source !== "local",
        trackCountIncreases:
          source === "local" && document?.kind !== "private-document",
        ignoredUserIds: [currentUserId],
      })
    },
    [currentUserId, document?.kind]
  )

  usePendingMentionBeforeUnload(hasPendingMentionNotifications)
  usePendingMentionLinkNavigationGuard({
    hasPendingMentionNotifications,
    setExitDialogOpen,
    setPendingExitTarget,
  })
  usePendingMentionHistoryNavigationGuard({
    allowHistoryExitRef,
    currentRouteHrefRef,
    currentRouteStateRef,
    hasPendingMentionNotifications,
    setExitDialogOpen,
    setPendingExitTarget,
  })

  const loadedDocument = document
  const showCollaborationBootPreview = useInitialCollaborationSyncPreview({
    id: loadedDocument?.id ?? null,
    storagePrefix: DOCUMENT_SYNC_MODAL_SEEN_STORAGE_PREFIX,
    eligible: isDocumentCollaborationSyncPreviewEligible(loadedDocument),
    bootstrapping: isCollaborationBootstrapping,
    attached: isCollaborationAttached,
  })
  const collaborationPreviewContent = getDocumentCollaborationPreviewContent({
    bootstrapContent,
    editorContent,
    loadedDocument,
  })

  const backHref = getDocumentDetailBackHref(team)
  const loadedDocumentId = loadedDocument?.id ?? documentId

  function clearPendingMentionBatch() {
    clearPendingDocumentMentionBatch(dispatchMentionQueue)
  }

  function closeExitDialog() {
    setExitDialogOpen(false)
    setPendingExitTarget(null)
  }

  function completePendingExit() {
    completePendingDocumentExit({
      allowHistoryExitRef,
      closeExitDialog,
      pendingExitTarget,
      router,
    })
  }

  async function sendPendingMentionNotifications() {
    return sendPendingDocumentMentionNotifications({
      activePendingMentionEntries,
      dispatchMentionQueue,
      flushCollaboration,
      isCollaborationAttached,
      loadedDocumentId,
      setSendingMentionNotifications,
    })
  }

  function saveTitle() {
    saveDocumentTitle({
      draftTitle,
      draftTitleLimitState,
      flushCollaboration,
      isCollaborationAttached,
      isCollaborationBootstrapping,
      loadedDocument,
      loadedDocumentId,
      setDraftTitle,
      setIsEditingTitle,
      titleInputRef,
    })
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
      applyDocumentContentChange({
        content,
        currentDocumentContentRef,
        isCollaborationAttached,
        isCollaborationBootstrapping,
        loadedDocumentId,
        setEditorContent,
      })
    },
    [
      currentDocumentContentRef,
      isCollaborationAttached,
      isCollaborationBootstrapping,
      loadedDocumentId,
      setEditorContent,
    ]
  )

  const handleDocumentAttachmentUpload = useCallback(
    (file: File) =>
      useAppStore
        .getState()
        .uploadAttachment("document", loadedDocumentId, file),
    [loadedDocumentId]
  )

  if (!loadedDocument || loadedDocument.kind === "item-description") {
    return (
      <DocumentUnavailableState
        deletingDocument={deletingDocument}
        hasLoadedDocumentReadModel={hasLoadedDocumentReadModel}
      />
    )
  }

  return (
    <DocumentDetailLoadedView
      backHref={backHref}
      collaboration={collaboration}
      collaborationEditorContent={collaborationEditorContent}
      collaborationPreviewContent={collaborationPreviewContent}
      currentUserId={currentUserId}
      deleteDialogOpen={deleteDialogOpen}
      deletingDocument={deletingDocument}
      document={loadedDocument}
      documentStats={documentStats}
      draftTitle={draftTitle}
      draftTitleLimitState={draftTitleLimitState}
      editable={editable}
      editorCollaboration={editorCollaboration}
      editorInstanceRef={editorInstanceRef}
      exitDialogOpen={exitDialogOpen}
      fullPageCanvasWidth={fullPageCanvasWidth}
      hasPendingMentionNotifications={hasPendingMentionNotifications}
      isCollaborationAttached={isCollaborationAttached}
      isCollaborationBootstrapping={isCollaborationBootstrapping}
      isEditingTitle={isEditingTitle}
      mentionCandidates={mentionCandidates}
      otherDocumentViewers={otherDocumentViewers}
      pendingMentionSummary={pendingMentionSummary}
      sendingMentionNotifications={sendingMentionNotifications}
      showCollaborationBootPreview={showCollaborationBootPreview}
      titleInputRef={titleInputRef}
      onActiveBlockChange={handleLegacyActiveBlockChange}
      onChange={handleDocumentContentChange}
      onDelete={() => void handleDeleteDocument()}
      onDeleteDialogOpenChange={setDeleteDialogOpen}
      onDraftTitleChange={setDraftTitle}
      onExitDialogOpenChange={(open) =>
        updateDocumentPendingExitDialogOpen({
          open,
          sendingMentionNotifications,
          setExitDialogOpen,
          setPendingExitTarget,
        })
      }
      onMentionCountsChange={handleMentionCountsChange}
      onSaveTitle={saveTitle}
      onSendAndExit={() => void handleSendAndExit()}
      onSendMentions={() => void sendPendingMentionNotifications()}
      onSkipAndExit={handleSkipAndExit}
      onStartEditingTitle={() => {
        setDraftTitle(loadedDocument.title)
        setIsEditingTitle(true)
      }}
      onStatsChange={setDocumentStats}
      onUploadAttachment={handleDocumentAttachmentUpload}
    />
  )
}

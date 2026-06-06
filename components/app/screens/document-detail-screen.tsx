"use client"
import type { Editor } from "@tiptap/react"
import { AppLink, useAppRouter } from "@/lib/browser/app-navigation"
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
import { Bell, SidebarSimple, Trash } from "@phosphor-icons/react"
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
  reduceDocumentMentionQueue,
} from "@/lib/content/document-mention-queue"
import {
  extractRichTextMentionCounts,
  type PendingDocumentMention,
} from "@/lib/content/rich-text-mentions"
import {
  getTeam,
  getTeamMembers,
  getRichTextReferenceCandidates,
  getWorkspaceUsers,
} from "@/lib/domain/selectors"
import type { AppData, DocumentPresenceViewer } from "@/lib/domain/types"
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
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import { CollaborationSyncDialog } from "./collaboration-sync-dialog"
import { DocumentDetailSidebarSurface } from "./document-detail-sidebar"
import { DocumentPresenceAvatarGroup } from "./document-ui"
import { useLegacyPresenceHeartbeat } from "./legacy-presence-heartbeat"
import {
  completePendingMentionExit,
  type PendingMentionExitTarget,
  updatePendingMentionExitDialogOpen,
  usePendingMentionBeforeUnload,
  usePendingMentionHistoryNavigationGuard,
  usePendingMentionLinkNavigationGuard,
  usePendingMentionRouteRefs,
} from "./pending-mention-navigation"
import {
  formatMentionCountLabel,
  formatRecipientCountLabel,
  PendingMentionExitDialog,
  PendingMentionNotificationBanner,
  type PendingMentionSummary,
  usePendingMentionSummary,
} from "./pending-mention-notifications"
import {
  canEditDocumentInUi,
  getDocumentPresenceSessionId,
  selectAppDataSnapshot,
} from "./helpers"
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

type AppState = ReturnType<typeof useAppStore.getState>
type DocumentMentionQueueAction = Parameters<
  typeof reduceDocumentMentionQueue
>[1]
type DocumentMentionQueueDispatch = (action: DocumentMentionQueueAction) => void

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
  activePendingMentionEntries: PendingDocumentMention[]
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
  persistDocumentTitleChange({
    flushCollaboration,
    isCollaborationAttached,
    isCollaborationBootstrapping,
    loadedDocument,
    loadedDocumentId,
    normalizedTitle,
  })
}

function persistDocumentTitleChange({
  flushCollaboration,
  isCollaborationAttached,
  isCollaborationBootstrapping,
  loadedDocument,
  loadedDocumentId,
  normalizedTitle,
}: {
  flushCollaboration: ReturnType<typeof useDocumentCollaboration>["flush"]
  isCollaborationAttached: boolean
  isCollaborationBootstrapping: boolean
  loadedDocument: AppState["documents"][number] | null
  loadedDocumentId: string
  normalizedTitle: string
}) {
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
  propertiesOpen,
  onDraftTitleChange,
  onSaveTitle,
  onStartEditingTitle,
  onDelete,
  onToggleProperties,
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
  propertiesOpen: boolean
  onDraftTitleChange: (title: string) => void
  onSaveTitle: () => void
  onStartEditingTitle: () => void
  onDelete: () => void
  onToggleProperties: () => void
}) {
  return (
    <div className="flex min-h-10 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 py-2">
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <SidebarTrigger className="size-5 shrink-0" />
        <AppLink
          href={backHref}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          Docs
        </AppLink>
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
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={propertiesOpen ? "Hide properties" : "Open properties"}
          className={cn(!propertiesOpen && "text-muted-foreground")}
          onClick={onToggleProperties}
        >
          <SidebarSimple className="size-4" />
        </Button>
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
  referenceCandidates,
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
  referenceCandidates: ComponentProps<
    typeof RichTextEditor
  >["referenceCandidates"]
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
            referenceCandidates={referenceCandidates}
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
          referenceCandidates={referenceCandidates}
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

function DocumentCollaborationSyncDialog({
  showCollaborationBootPreview,
}: {
  showCollaborationBootPreview: boolean
}) {
  return (
    <CollaborationSyncDialog
      descriptionSubject="document"
      open={showCollaborationBootPreview}
    />
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
  data,
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
  referenceCandidates,
  otherDocumentViewers,
  pendingMentionSummary,
  propertiesOpen,
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
  onToggleProperties,
  onRenameTitle,
  onUploadAttachment,
}: {
  backHref: string
  collaboration: unknown
  collaborationEditorContent: string
  collaborationPreviewContent: string
  currentUserId: string
  data: AppData
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
  referenceCandidates: ComponentProps<
    typeof RichTextEditor
  >["referenceCandidates"]
  otherDocumentViewers: DocumentPresenceViewer[]
  pendingMentionSummary: PendingMentionSummary
  propertiesOpen: boolean
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
  onToggleProperties: () => void
  onRenameTitle: (title: string) => void
  onUploadAttachment: ComponentProps<
    typeof RichTextEditor
  >["onUploadAttachment"]
}) {
  return (
    <>
      <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
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
            propertiesOpen={propertiesOpen}
            onDraftTitleChange={onDraftTitleChange}
            onSaveTitle={onSaveTitle}
            onStartEditingTitle={onStartEditingTitle}
            onDelete={onDelete}
            onToggleProperties={onToggleProperties}
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
            referenceCandidates={referenceCandidates}
            otherDocumentViewers={otherDocumentViewers}
            documentKind={document.kind}
            onMentionCountsChange={onMentionCountsChange}
            onStatsChange={onStatsChange}
            onChange={onChange}
            onActiveBlockChange={onActiveBlockChange}
            onUploadAttachment={onUploadAttachment}
          />
        </div>

        <DocumentDetailSidebarSurface
          data={data}
          document={document}
          editable={editable}
          open={propertiesOpen}
          onClose={onToggleProperties}
          onRenameTitle={onRenameTitle}
        />
      </div>

      <PendingMentionNotificationBanner
        hasPendingMentionNotifications={hasPendingMentionNotifications}
        icon={<Bell weight="fill" className="size-[15px]" />}
        pendingMentionSummary={pendingMentionSummary}
        sendingMentionNotifications={sendingMentionNotifications}
        subject="document"
        onSend={onSendMentions}
      />
      <PendingMentionExitDialog
        entityLabel="document"
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
  const { presenceViewers: documentPresenceViewers, sendLegacyPresenceRef } =
    useLegacyPresenceHeartbeat({
      activeId: currentDocumentId,
      activeBlockIdRef: legacyActiveBlockIdRef,
      clearErrorMessage: "Failed to clear document presence",
      clearPresence: syncClearDocumentPresence,
      collaborationLifecycle,
      currentUserId,
      disabled: resolvedDocumentKind === "item-description",
      heartbeatErrorMessage: "Failed to sync document presence",
      heartbeatIntervalMs: DOCUMENT_PRESENCE_HEARTBEAT_INTERVAL_MS,
      heartbeatPresence: syncHeartbeatDocumentPresence,
      getSessionId: getDocumentPresenceSessionId,
    })

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

function useDocumentReferenceCandidates(
  document: AppState["documents"][number] | null
) {
  const referenceData = useAppStore(
    useShallow((state) => ({
      currentUserId: state.currentUserId,
      currentWorkspaceId: state.currentWorkspaceId,
      documents: state.documents,
      projects: state.projects,
      teamMemberships: state.teamMemberships,
      teams: state.teams,
      views: state.views,
      workItems: state.workItems,
      workspaces: state.workspaces,
    }))
  )

  return useMemo(
    () =>
      document
        ? getRichTextReferenceCandidates(referenceData as AppState, {
            type: "document",
            documentId: document.id,
          })
        : [],
    [document, referenceData]
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
  setPendingExitTarget: (target: PendingMentionExitTarget) => void
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
  const router = useAppRouter()
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const { currentWorkspaceId, currentUser, currentUserId, document, team } =
    useDocumentDetailStoreSelection(documentId)
  const editable = useDocumentEditable(document)
  const mentionCandidates = useDocumentMentionCandidates({
    currentWorkspaceId,
    document,
    team,
  })
  const referenceCandidates = useDocumentReferenceCandidates(document)
  const [mentionQueue, dispatchMentionQueue] = useReducer(
    reduceDocumentMentionQueue,
    createDocumentMentionQueueState({})
  )
  const [sendingMentionNotifications, setSendingMentionNotifications] =
    useState(false)
  const [pendingExitTarget, setPendingExitTarget] =
    useState<PendingMentionExitTarget>(null)
  const [exitDialogOpen, setExitDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingDocument, setDeletingDocument] = useState(false)
  const [propertiesOpen, setPropertiesOpen] = useState(true)
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
    usePendingMentionRouteRefs(currentDocumentId)
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
      diagnostics: {
        retainedData: Boolean(document),
        surface: "document/detail",
      },
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

  const {
    activePendingMentionEntries,
    hasPendingMentionNotifications,
    pendingMentionSummary,
  } = usePendingMentionSummary({
    enabled: document?.kind !== "private-document",
    mentionQueue,
  })
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
    completePendingMentionExit({
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

  function renameTitle(title: string) {
    const normalizedTitle = title.trim() || "Untitled document"

    setDraftTitle(normalizedTitle)
    persistDocumentTitleChange({
      flushCollaboration,
      isCollaborationAttached,
      isCollaborationBootstrapping,
      loadedDocument,
      loadedDocumentId,
      normalizedTitle,
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
      data={data}
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
      referenceCandidates={referenceCandidates}
      otherDocumentViewers={otherDocumentViewers}
      pendingMentionSummary={pendingMentionSummary}
      propertiesOpen={propertiesOpen}
      sendingMentionNotifications={sendingMentionNotifications}
      showCollaborationBootPreview={showCollaborationBootPreview}
      titleInputRef={titleInputRef}
      onActiveBlockChange={handleLegacyActiveBlockChange}
      onChange={handleDocumentContentChange}
      onDelete={() => void handleDeleteDocument()}
      onDeleteDialogOpenChange={setDeleteDialogOpen}
      onDraftTitleChange={setDraftTitle}
      onExitDialogOpenChange={(open) =>
        updatePendingMentionExitDialogOpen({
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
      onToggleProperties={() => setPropertiesOpen((current) => !current)}
      onRenameTitle={renameTitle}
      onUploadAttachment={handleDocumentAttachmentUpload}
    />
  )
}

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import {
  CaretDown,
  CaretRight,
  DotsThree,
  Plus,
  SidebarSimple,
  Trash,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  filterPendingDocumentMentionsByContent,
  getPendingRichTextMentionEntries,
  mergePendingDocumentMentions,
  type PendingDocumentMention,
} from "@/lib/content/rich-text-mentions"
import {
  syncClearWorkItemPresence,
  syncHeartbeatWorkItemPresence,
  syncSendItemDescriptionMentionNotifications,
} from "@/lib/convex/client"
import {
  canEditTeam,
  getDirectChildWorkItems,
  getDocument,
  getStatusOrderForTeam,
  getTeam,
  getTeamMembers,
  getUser,
  getWorkItemChildProgress,
  getWorkItem,
  getWorkItemDescendantIds,
  getWorkItemHierarchyIds,
  sortItems,
} from "@/lib/domain/selectors"
import {
  getAllowedChildWorkItemTypesForItem,
  getChildWorkItemCopy,
  getDisplayLabelForWorkItemType,
  getWorkSurfaceCopy,
  priorityMeta,
  type DocumentPresenceViewer,
  type Priority,
  type WorkItem,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CollapsibleRightSidebar } from "@/components/ui/collapsible-right-sidebar"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

import { DocumentPresenceAvatarGroup } from "./document-ui"
import {
  getEligibleParentWorkItems,
  getTeamProjectOptions,
  getWorkItemPresenceSessionId,
  selectAppDataSnapshot,
} from "./helpers"
import {
  CollapsibleSection,
  MissingState,
  PriorityDot,
  PropertyDateField,
  PropertyRow,
  PropertySelect,
  StatusIcon,
  WorkItemLabelsEditor,
  buildPropertyStatusOptions,
} from "./shared"
import {
  CommentsInline,
  WorkItemAssigneeAvatar,
  InlineChildIssueComposer,
  WorkItemTypeBadge,
} from "./work-item-ui"
import { cn } from "@/lib/utils"

const WORK_ITEM_PRESENCE_HEARTBEAT_INTERVAL_MS = 15 * 1000

function formatConcurrentEditorLabel(viewers: DocumentPresenceViewer[]) {
  const names = viewers
    .map((viewer) => viewer.name.trim())
    .filter((name) => name.length > 0)

  if (names.length === 0) {
    return null
  }

  if (names.length === 1) {
    return `${names[0]} is also editing this item`
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are also editing this item`
  }

  return `${names[0]} and ${names.length - 1} others are also editing this item`
}

export function WorkItemDetailScreen({ itemId }: { itemId: string }) {
  const router = useRouter()
  const data = useAppStore(useShallow(selectAppDataSnapshot))
  const item = data.workItems.find((entry) => entry.id === itemId)
  const [deletingItem, setDeletingItem] = useState(false)
  const [projectConfirmOpen, setProjectConfirmOpen] = useState(false)
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [childComposerOpen, setChildComposerOpen] = useState(false)
  const [subIssuesOpen, setSubIssuesOpen] = useState(true)
  const [propertiesOpen, setPropertiesOpen] = useState(true)
  const [mainEditing, setMainEditing] = useState(false)
  const [mainDraftItemId, setMainDraftItemId] = useState<string | null>(null)
  const [mainDraftUpdatedAt, setMainDraftUpdatedAt] = useState<string | null>(
    null
  )
  const [mainDraftTitle, setMainDraftTitle] = useState("")
  const [mainDraftDescription, setMainDraftDescription] = useState("")
  const [mainPendingMentionRetryItemId, setMainPendingMentionRetryItemId] = useState<
    string | null
  >(null)
  const [mainPendingMentionRetryEntries, setMainPendingMentionRetryEntries] =
    useState<PendingDocumentMention[]>([])
  const [savingMainSection, setSavingMainSection] = useState(false)
  const [workItemPresenceViewers, setWorkItemPresenceViewers] = useState<
    DocumentPresenceViewer[]
  >([])
  const description = item ? getDocument(data, item.descriptionDocId) : null
  const descriptionContent = description?.content ?? "<p>Add a description…</p>"
  const activePresenceItemId = item?.id ?? null
  const isEditingCurrentItem =
    item !== undefined && mainEditing && mainDraftItemId === item.id

  useEffect(() => {
    if (!activePresenceItemId || !isEditingCurrentItem) {
      setWorkItemPresenceViewers([])
      return
    }

    let cancelled = false
    let presenceActive = window.document.visibilityState === "visible"
    let heartbeatTimeoutId: number | null = null
    const activeItemId = activePresenceItemId
    const sessionId = getWorkItemPresenceSessionId(data.currentUserId)

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
        const viewers = await syncHeartbeatWorkItemPresence(
          activeItemId,
          sessionId
        )

        if (
          !cancelled &&
          presenceActive &&
          window.document.visibilityState === "visible"
        ) {
          setWorkItemPresenceViewers(viewers)
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to sync work item presence", error)
        }
      } finally {
        scheduleHeartbeat(WORK_ITEM_PRESENCE_HEARTBEAT_INTERVAL_MS)
      }
    }

    function resumePresence() {
      if (cancelled || window.document.visibilityState !== "visible") {
        return
      }

      presenceActive = true
      void sendHeartbeat()
    }

    function leaveWorkItem(options?: { keepalive?: boolean }) {
      presenceActive = false
      clearHeartbeatTimeout()

      if (!cancelled) {
        setWorkItemPresenceViewers([])
      }

      void syncClearWorkItemPresence(activeItemId, sessionId, {
        keepalive: options?.keepalive,
      }).catch((error) => {
        if (!cancelled && window.document.visibilityState === "visible") {
          console.error("Failed to clear work item presence", error)
        }
      })
    }

    const handleVisibilityChange = () => {
      if (window.document.visibilityState === "visible") {
        resumePresence()
        return
      }

      leaveWorkItem({ keepalive: true })
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
      leaveWorkItem({ keepalive: true })
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
      void syncClearWorkItemPresence(activeItemId, sessionId, {
        keepalive: true,
      }).catch(() => {})
    }
  }, [activePresenceItemId, data.currentUserId, isEditingCurrentItem])

  if (!item) {
    if (deletingItem) {
      return null
    }

    return <MissingState title="Work item not found" />
  }

  const currentItem = item
  const team = getTeam(data, currentItem.teamId)
  const workCopy = getWorkSurfaceCopy(team?.settings.experience)
  const editable = team ? canEditTeam(data, team.id) : false
  const statusOptions = buildPropertyStatusOptions(getStatusOrderForTeam(team))
  const teamMembers = team ? getTeamMembers(data, team.id) : []
  const teamProjects = getTeamProjectOptions(
    data,
    team?.id,
    currentItem.primaryProjectId
  )
  const parentItem = currentItem.parentId
    ? getWorkItem(data, currentItem.parentId)
    : null
  const childItems = sortItems(
    getDirectChildWorkItems(data, currentItem.id),
    "priority"
  )
  const childProgress = getWorkItemChildProgress(data, currentItem.id)
  const parentOptions = [
    { value: "none", label: "No parent" },
    ...getEligibleParentWorkItems(data, currentItem).map((candidate) => ({
      value: candidate.id,
      label: `${candidate.key} · ${candidate.title}`,
    })),
  ]
  const allowedChildTypes = getAllowedChildWorkItemTypesForItem(currentItem)
  const childCopy = getChildWorkItemCopy(
    currentItem.type,
    team?.settings.experience
  )
  const canCreateChildItem = editable && allowedChildTypes.length > 0
  const descendantCount = getWorkItemDescendantIds(data, currentItem.id).size
  const hierarchySize = getWorkItemHierarchyIds(data, currentItem.id).size
  const itemLabel = getDisplayLabelForWorkItemType(
    currentItem.type,
    team?.settings.experience
  ).toLowerCase()
  const cascadeMessage =
    descendantCount > 0
      ? `Delete this ${itemLabel} and ${descendantCount} nested item${
          descendantCount === 1 ? "" : "s"
        }?`
      : `Delete this ${itemLabel}?`
  const showSubIssuesSection =
    childItems.length > 0 || allowedChildTypes.length > 0
  const displayedEndDate = currentItem.targetDate ?? currentItem.dueDate
  const isMainEditing = mainEditing && mainDraftItemId === currentItem.id
  const activeMainPendingMentionRetryEntries =
    mainPendingMentionRetryItemId === currentItem.id
      ? filterPendingDocumentMentionsByContent(
          mainPendingMentionRetryEntries,
          mainDraftDescription
        )
      : []
  const otherWorkItemEditors = workItemPresenceViewers.filter(
    (viewer) => viewer.userId !== data.currentUserId
  )
  const concurrentEditorLabel = formatConcurrentEditorLabel(otherWorkItemEditors)
  const pendingMainMentionEntries = isMainEditing
    ? mergePendingDocumentMentions(
        activeMainPendingMentionRetryEntries,
        getPendingRichTextMentionEntries(descriptionContent, mainDraftDescription)
      )
    : []
  const normalizedMainDraftTitle = mainDraftTitle.trim()
  const mainTitleDirty =
    isMainEditing && normalizedMainDraftTitle !== currentItem.title
  const mainDescriptionDirty =
    isMainEditing && mainDraftDescription !== descriptionContent
  const mainDirty = mainTitleDirty || mainDescriptionDirty
  const mainDraftStale =
    isMainEditing &&
    Boolean(mainDraftUpdatedAt) &&
    mainDraftUpdatedAt !== currentItem.updatedAt
  const canSaveMainSection =
    isMainEditing &&
    normalizedMainDraftTitle.length >= 2 &&
    (mainDirty || pendingMainMentionEntries.length > 0) &&
    !savingMainSection &&
    !mainDraftStale

  function buildEndDatePatch(nextEndDate: string | null) {
    return {
      dueDate: currentItem.dueDate ? nextEndDate : undefined,
      targetDate:
        currentItem.targetDate || !currentItem.dueDate
          ? nextEndDate
          : undefined,
    }
  }

  function handleStartDateChange(nextStartDate: string | null) {
    const patch: {
      startDate?: string | null
      dueDate?: string | null
      targetDate?: string | null
    } = {
      startDate: nextStartDate,
    }

    if (
      nextStartDate &&
      displayedEndDate &&
      new Date(nextStartDate).getTime() > new Date(displayedEndDate).getTime()
    ) {
      Object.assign(patch, buildEndDatePatch(nextStartDate))
    }

    useAppStore.getState().updateWorkItem(currentItem.id, patch)
  }

  function handleProjectChange(value: string) {
    const nextProjectId = value === "none" ? null : value

    if (nextProjectId === currentItem.primaryProjectId) {
      return
    }

    if (hierarchySize > 1) {
      setPendingProjectId(nextProjectId)
      setProjectConfirmOpen(true)
      return
    }

    useAppStore.getState().updateWorkItem(currentItem.id, {
      primaryProjectId: nextProjectId,
    })
  }

  function handleEndDateChange(nextEndDate: string | null) {
    const patch: {
      startDate?: string | null
      dueDate?: string | null
      targetDate?: string | null
    } = buildEndDatePatch(nextEndDate)

    if (
      nextEndDate &&
      currentItem.startDate &&
      new Date(nextEndDate).getTime() <
        new Date(currentItem.startDate).getTime()
    ) {
      patch.startDate = nextEndDate
    }

    useAppStore.getState().updateWorkItem(currentItem.id, patch)
  }

  function handleStartMainEdit() {
    if (!editable) {
      return
    }

    setMainDraftItemId(currentItem.id)
    setMainDraftUpdatedAt(currentItem.updatedAt)
    setMainDraftTitle(currentItem.title)
    setMainDraftDescription(descriptionContent)
    setMainEditing(true)
  }

  function handleCancelMainEdit() {
    setMainDraftItemId(null)
    setMainDraftUpdatedAt(null)
    setMainDraftTitle(currentItem.title)
    setMainDraftDescription(descriptionContent)
    setMainEditing(false)
  }

  function handleReloadMainDraft() {
    setMainDraftUpdatedAt(currentItem.updatedAt)
    setMainDraftTitle(currentItem.title)
    setMainDraftDescription(descriptionContent)
  }

  async function handleSaveMainEdit() {
    if (!canSaveMainSection) {
      return
    }

    setSavingMainSection(true)
    const savedItemId = currentItem.id
    const savedDescription = mainDraftDescription
    const pendingMentionEntries = [...pendingMainMentionEntries]

    const saved = await useAppStore.getState().saveWorkItemMainSection({
      itemId: savedItemId,
      title: normalizedMainDraftTitle,
      description: savedDescription,
      expectedUpdatedAt: mainDraftUpdatedAt ?? currentItem.updatedAt,
    })

    if (!saved) {
      setSavingMainSection(false)
      return
    }

    setMainDraftItemId(null)
    setMainDraftUpdatedAt(null)
    setMainEditing(false)

    if (pendingMentionEntries.length > 0) {
      try {
        const result = await syncSendItemDescriptionMentionNotifications(
          savedItemId,
          pendingMentionEntries
        )

        setMainPendingMentionRetryItemId(savedItemId)
        setMainPendingMentionRetryEntries([])

        toast.success(
          `Saved changes and notified ${result.recipientCount} ${result.recipientCount === 1 ? "person" : "people"}.`
        )
      } catch (error) {
        setMainPendingMentionRetryItemId(savedItemId)
        setMainPendingMentionRetryEntries(pendingMentionEntries)
        toast.error(
          error instanceof Error
            ? error.message
            : "Saved changes but failed to notify mentions"
        )
      }
    } else {
      setMainPendingMentionRetryItemId(savedItemId)
      setMainPendingMentionRetryEntries([])
    }

    setSavingMainSection(false)
  }

  async function handleDeleteItem() {
    setDeletingItem(true)

    const deleted = await useAppStore.getState().deleteWorkItem(currentItem.id)

    if (!deleted) {
      setDeletingItem(false)
      return
    }

    setDeleteDialogOpen(false)
    router.replace(team?.slug ? `/team/${team.slug}/work` : "/inbox")
  }

  function handleProjectConfirmOpenChange(open: boolean) {
    setProjectConfirmOpen(open)

    if (!open) {
      setPendingProjectId(null)
    }
  }

  function handleConfirmProjectChange() {
    useAppStore.getState().updateWorkItem(currentItem.id, {
      primaryProjectId: pendingProjectId,
    })
    setProjectConfirmOpen(false)
    setPendingProjectId(null)
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <div className="flex min-h-10 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <SidebarTrigger className="size-5 shrink-0" />
            <Link
              href={`/team/${team?.slug}/work`}
              className="text-muted-foreground hover:text-foreground"
            >
              {team?.name}
            </Link>
            <CaretRight className="size-3 text-muted-foreground" />
            <span>
              {currentItem.key} {currentItem.title}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {editable ? (
              <>
                {isMainEditing ? (
                  <DocumentPresenceAvatarGroup viewers={workItemPresenceViewers} />
                ) : null}
                {isMainEditing ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={savingMainSection}
                      onClick={handleCancelMainEdit}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!canSaveMainSection}
                      onClick={() => void handleSaveMainEdit()}
                    >
                      {savingMainSection ? "Saving..." : "Save"}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleStartMainEdit}>
                    Edit
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={deletingItem}
                    >
                      <DotsThree className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 min-w-44">
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={deletingItem}
                      onSelect={(event) => {
                        event.preventDefault()
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash className="size-4" />
                      Delete{" "}
                      {getDisplayLabelForWorkItemType(
                        currentItem.type,
                        team?.settings.experience
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : null}
            <Button
              size="icon-sm"
              variant="ghost"
              className={cn(!propertiesOpen && "text-muted-foreground")}
              onClick={() => setPropertiesOpen((current) => !current)}
            >
              <SidebarSimple className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-8 py-8">
              {parentItem ? (
                <Link
                  href={`/items/${parentItem.id}`}
                  className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span>{workCopy.parentLabel}</span>
                  <Badge variant="outline">{parentItem.key}</Badge>
                  <span className="truncate">{parentItem.title}</span>
                </Link>
              ) : null}
              {isMainEditing ? (
                <Input
                  value={mainDraftTitle}
                  onChange={(event) => setMainDraftTitle(event.target.value)}
                  placeholder={`${getDisplayLabelForWorkItemType(
                    currentItem.type,
                    team?.settings.experience
                  )} title`}
                  className="mb-1 h-auto border-none bg-transparent px-0 py-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0 md:text-2xl dark:bg-transparent"
                  autoFocus
                />
              ) : (
                <h1 className="mb-1 text-2xl font-semibold">
                  {currentItem.title}
                </h1>
              )}
              <div className="mb-4">
                <WorkItemTypeBadge data={data} item={currentItem} />
              </div>

              {mainDraftStale ? (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      This item changed while you were editing
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Reload the latest title and description before saving your
                      draft.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReloadMainDraft}
                  >
                    Reload latest
                  </Button>
                </div>
              ) : null}
              {isMainEditing && concurrentEditorLabel ? (
                <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2.5">
                  <div className="text-sm font-medium">
                    {concurrentEditorLabel}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    You can keep editing, but you may need to reload before
                    saving if they update the item first.
                  </div>
                </div>
              ) : null}

              <div className="mt-4">
                <RichTextEditor
                  content={isMainEditing ? mainDraftDescription : descriptionContent}
                  editable={editable && isMainEditing}
                  placeholder="Add a description…"
                  mentionCandidates={
                    team ? getTeamMembers(data, team.id) : data.users
                  }
                  onChange={setMainDraftDescription}
                  onUploadAttachment={(file) =>
                    useAppStore
                      .getState()
                      .uploadAttachment("workItem", currentItem.id, file)
                  }
                />
              </div>

              {showSubIssuesSection ? (
                <div className="mt-8">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setSubIssuesOpen((current) => !current)}
                    >
                      {subIssuesOpen ? (
                        <CaretDown className="size-3" />
                      ) : (
                        <CaretRight className="size-3" />
                      )}
                      <span>{childCopy.childPluralLabel}</span>
                      <span className="text-xs font-normal tabular-nums">
                        {childItems.length > 0
                          ? `${childProgress.percent}%`
                          : "0%"}
                      </span>
                    </button>
                    {canCreateChildItem ? (
                      <Button
                        size="icon-sm"
                        variant={childComposerOpen ? "outline" : "ghost"}
                        disabled={!canCreateChildItem}
                        onClick={() => {
                          setSubIssuesOpen(true)
                          setChildComposerOpen((current) => !current)
                        }}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>

                  {childItems.length > 0 ? (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{
                          width: `${childProgress.percent}%`,
                        }}
                      />
                    </div>
                  ) : null}

                  {childItems.length > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {childProgress.includedChildren > 0
                        ? `${childProgress.completedChildren} of ${childProgress.includedChildren} active ${childCopy.childPluralLabel.toLowerCase()} done`
                        : `No active ${childCopy.childPluralLabel.toLowerCase()} in progress tracking`}
                    </p>
                  ) : null}

                  {subIssuesOpen ? (
                    <div className="mt-3 flex flex-col overflow-hidden rounded-lg border">
                      {childItems.map((child, index) => (
                        <Link
                          key={child.id}
                          href={`/items/${child.id}`}
                          className={cn(
                            "group/sub flex items-center gap-3 px-3 py-2 transition-colors hover:bg-accent/40",
                            index !== childItems.length - 1 && "border-b"
                          )}
                        >
                          <StatusIcon status={child.status} />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {child.title}
                          </span>
                          <WorkItemTypeBadge data={data} item={child} />
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {child.key}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {priorityMeta[child.priority].label}
                          </span>
                          {child.assigneeId ? (
                            <WorkItemAssigneeAvatar
                              user={getUser(data, child.assigneeId)}
                              className="shrink-0"
                            />
                          ) : null}
                        </Link>
                      ))}

                      {childComposerOpen ? (
                        <div className="border-t">
                          <InlineChildIssueComposer
                            teamId={currentItem.teamId}
                            parentItem={currentItem}
                            disabled={!editable}
                            onCancel={() => setChildComposerOpen(false)}
                            onCreated={() => setChildComposerOpen(false)}
                          />
                        </div>
                      ) : canCreateChildItem ? (
                        <button
                          type="button"
                          className={cn(
                            "inline-flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground",
                            childItems.length > 0 && "border-t"
                          )}
                          onClick={() => setChildComposerOpen(true)}
                        >
                          <Plus className="size-3" />
                          <span>{childCopy.addChildLabel}</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Separator className="my-6" />

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Activity</h3>
                </div>
                <CommentsInline
                  targetType="workItem"
                  targetId={currentItem.id}
                  editable={editable}
                />
              </div>
            </div>
          </div>

          <CollapsibleRightSidebar open={propertiesOpen} width="18rem">
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col p-4">
                <CollapsibleSection title="Properties" defaultOpen>
                  <PropertyRow
                    label="Type"
                    value={getDisplayLabelForWorkItemType(
                      currentItem.type,
                      team?.settings.experience
                    )}
                  />
                  <PropertySelect
                    label="Status"
                    value={currentItem.status}
                    disabled={!editable}
                    options={statusOptions}
                    renderValue={(value, label) => (
                      <div className="flex min-w-0 items-center gap-2">
                        <StatusIcon status={value} />
                        <span className="truncate">{label}</span>
                      </div>
                    )}
                    renderOption={(value, label) => (
                      <div className="flex items-center gap-2">
                        <StatusIcon status={value} />
                        <span>{label}</span>
                      </div>
                    )}
                    onValueChange={(value) =>
                      useAppStore.getState().updateWorkItem(currentItem.id, {
                        status: value as WorkItem["status"],
                      })
                    }
                  />
                  <PropertySelect
                    label="Priority"
                    value={currentItem.priority}
                    disabled={!editable}
                    options={Object.entries(priorityMeta).map(
                      ([value, meta]) => ({
                        value,
                        label: meta.label,
                      })
                    )}
                    renderValue={(value, label) => (
                      <div className="flex min-w-0 items-center gap-2">
                        <PriorityDot priority={value} />
                        <span className="truncate">{label}</span>
                      </div>
                    )}
                    renderOption={(value, label) => (
                      <div className="flex items-center gap-2">
                        <PriorityDot priority={value} />
                        <span>{label}</span>
                      </div>
                    )}
                    onValueChange={(value) =>
                      useAppStore.getState().updateWorkItem(currentItem.id, {
                        priority: value as Priority,
                      })
                    }
                  />
                  <PropertySelect
                    label="Assignee"
                    value={currentItem.assigneeId ?? "unassigned"}
                    disabled={!editable}
                    options={[
                      { value: "unassigned", label: "Assign" },
                      ...teamMembers.map((user) => ({
                        value: user.id,
                        label: user.name,
                      })),
                    ]}
                    renderValue={(value, label) => {
                      if (value === "unassigned") {
                        return <span className="text-sm">{label}</span>
                      }

                      const selectedUser =
                        teamMembers.find((user) => user.id === value) ?? null

                      return selectedUser ? (
                        <div className="flex min-w-0 items-center gap-2">
                          <WorkItemAssigneeAvatar user={selectedUser} />
                          <span className="truncate">{selectedUser.name}</span>
                        </div>
                      ) : (
                        <span className="text-sm">{label}</span>
                      )
                    }}
                    renderOption={(value, label) => {
                      if (value === "unassigned") {
                        return <span>{label}</span>
                      }

                      const optionUser =
                        teamMembers.find((user) => user.id === value) ?? null

                      return optionUser ? (
                        <div className="flex items-center gap-2">
                          <WorkItemAssigneeAvatar user={optionUser} />
                          <span>{optionUser.name}</span>
                        </div>
                      ) : (
                        <span>{label}</span>
                      )
                    }}
                    onValueChange={(value) =>
                      useAppStore.getState().updateWorkItem(currentItem.id, {
                        assigneeId: value === "unassigned" ? null : value,
                      })
                    }
                  />
                  {currentItem.parentId || parentOptions.length > 1 ? (
                    <PropertySelect
                      label="Parent"
                      value={currentItem.parentId ?? "none"}
                      disabled={!editable}
                      options={parentOptions}
                      onValueChange={(value) =>
                        useAppStore.getState().updateWorkItem(currentItem.id, {
                          parentId: value === "none" ? null : value,
                        })
                      }
                    />
                  ) : null}
                </CollapsibleSection>

                <Separator className="my-3" />

                <CollapsibleSection title="Schedule" defaultOpen>
                  <PropertyDateField
                    label="Start date"
                    value={currentItem.startDate}
                    disabled={!editable}
                    onValueChange={handleStartDateChange}
                  />
                  <PropertyDateField
                    label="End date"
                    value={displayedEndDate}
                    disabled={!editable}
                    onValueChange={handleEndDateChange}
                  />
                </CollapsibleSection>

                <Separator className="my-3" />

                <CollapsibleSection title="Labels" defaultOpen>
                  <WorkItemLabelsEditor
                    item={currentItem}
                    editable={editable}
                  />
                </CollapsibleSection>

                <Separator className="my-3" />

                <CollapsibleSection title="Project" defaultOpen>
                  <PropertySelect
                    label=""
                    value={currentItem.primaryProjectId ?? "none"}
                    disabled={!editable}
                    options={[
                      { value: "none", label: "No project" },
                      ...teamProjects.map((project) => ({
                        value: project.id,
                        label: project.name,
                      })),
                    ]}
                    onValueChange={handleProjectChange}
                  />
                </CollapsibleSection>
              </div>
            </div>
          </CollapsibleRightSidebar>
        </div>
      </div>
      <ConfirmDialog
        open={projectConfirmOpen}
        onOpenChange={handleProjectConfirmOpenChange}
        title="Update project for hierarchy"
        description="Changing the project for this item will also update all parent and child items in this hierarchy."
        confirmLabel="Update"
        variant="default"
        onConfirm={handleConfirmProjectChange}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete item"
        description={`${cascadeMessage} This can't be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deletingItem}
        onConfirm={() => void handleDeleteItem()}
      />
    </>
  )
}

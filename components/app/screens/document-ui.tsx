"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowSquareOut, Trash } from "@phosphor-icons/react"

import type { AppData, Document, DocumentPresenceViewer } from "@/lib/domain/types"
import { getCollaborationUserColor } from "@/lib/collaboration/colors"
import { useAppStore } from "@/lib/store/app-store"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { cn, resolveImageAssetSource } from "@/lib/utils"

import { canEditDocumentInUi, getUserInitials } from "./helpers"

const MAX_VISIBLE_DOCUMENT_VIEWERS = 3
const COMPACT_DOCUMENT_PRESENCE_COUNT_CLASS_NAME = "size-[18px] text-[8px]"

function DocumentActionMenuContent({
  document,
  canDeleteDocument,
  onRequestDelete,
}: {
  document: Document
  canDeleteDocument: boolean
  onRequestDelete: () => void
}) {
  const router = useRouter()

  return (
    <>
      <ContextMenuLabel className="truncate">{document.title}</ContextMenuLabel>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => router.push(`/docs/${document.id}`)}>
        <ArrowSquareOut className="size-4" />
        Open document
      </ContextMenuItem>
      {canDeleteDocument ? (
        <ContextMenuItem
          variant="destructive"
          onSelect={() => {
            onRequestDelete()
          }}
        >
          <Trash className="size-4" />
          Delete document
        </ContextMenuItem>
      ) : null}
    </>
  )
}

export function DocumentContextMenu({
  data,
  document,
  children,
}: {
  data: AppData
  document: Document
  children: React.ReactNode
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingDocument, setDeletingDocument] = useState(false)
  const canDeleteDocument = canEditDocumentInUi(data, document)

  async function handleDelete() {
    setDeletingDocument(true)

    try {
      await useAppStore.getState().deleteDocument(document.id)
      setDeleteDialogOpen(false)
    } finally {
      setDeletingDocument(false)
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <DocumentActionMenuContent
            document={document}
            canDeleteDocument={canDeleteDocument}
            onRequestDelete={() => {
              setDeleteDialogOpen(true)
            }}
          />
        </ContextMenuContent>
      </ContextMenu>
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete document"
        description="This document will be permanently removed. This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deletingDocument}
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}

export function DocumentAuthorAvatar({
  avatarImageUrl,
  avatarUrl,
  name,
  className,
  size = "sm",
  title,
  ringColor,
}: {
  avatarImageUrl?: string | null
  avatarUrl?: string | null
  name: string
  className?: string
  size?: "xs" | "compact" | "sm"
  title?: string
  ringColor?: string | null
}) {
  const imageSrc = resolveImageAssetSource(avatarImageUrl, avatarUrl)
  const compactStyle =
    size === "compact"
      ? {
          width: "18px",
          height: "18px",
          minWidth: "18px",
          minHeight: "18px",
          maxWidth: "18px",
          maxHeight: "18px",
          flexBasis: "18px",
        }
      : undefined
  const ringStyle = ringColor
    ? {
        boxShadow: `0 0 0 1.5px ${ringColor}`,
      }
    : undefined

  return (
    <Avatar
      size={size === "compact" ? "default" : size}
      style={{
        ...compactStyle,
        ...ringStyle,
      }}
      className={cn(
        size === "sm"
          ? "size-5"
          : size === "compact"
            ? "size-[18px]"
            : undefined,
        ringColor ? "ring-0" : undefined,
        ringColor ? "after:border-transparent" : undefined,
        className
      )}
      title={title}
    >
      {imageSrc ? <AvatarImage src={imageSrc} alt={name} /> : null}
      <AvatarFallback className={size === "compact" ? "text-[8px]" : undefined}>
        {getUserInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

export function DocumentPresenceAvatarGroup({
  viewers,
  compact = false,
  className,
}: {
  viewers: DocumentPresenceViewer[]
  compact?: boolean
  className?: string
}) {
  if (viewers.length === 0) {
    return null
  }

  const visibleViewers = viewers.slice(0, MAX_VISIBLE_DOCUMENT_VIEWERS)
  const hiddenViewerCount = viewers.length - visibleViewers.length
  const viewerNames = viewers.map((viewer) => viewer.name).join(", ")

  return (
    <div
      className={cn("flex items-center", className)}
      aria-label={`Also viewing: ${viewerNames}`}
      title={`Also viewing: ${viewerNames}`}
    >
      <AvatarGroup className="*:data-[slot=avatar]:ring-0">
        {visibleViewers.map((viewer) => (
          <DocumentAuthorAvatar
            key={viewer.userId}
            avatarImageUrl={viewer.avatarImageUrl}
            avatarUrl={viewer.avatarUrl}
            name={viewer.name}
            size={compact ? "compact" : "sm"}
            title={viewer.name}
            ringColor={getCollaborationUserColor(viewer.userId)}
          />
        ))}
        {hiddenViewerCount > 0 ? (
          <AvatarGroupCount
            className={
              compact
                ? COMPACT_DOCUMENT_PRESENCE_COUNT_CLASS_NAME
                : "size-5 text-[9px]"
            }
          >
            +{hiddenViewerCount}
          </AvatarGroupCount>
        ) : null}
      </AvatarGroup>
    </div>
  )
}

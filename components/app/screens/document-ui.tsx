"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowSquareOut, Trash } from "@phosphor-icons/react"

import type { AppData, Document, DocumentPresenceViewer } from "@/lib/domain/types"
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
  title,
}: {
  avatarImageUrl?: string | null
  avatarUrl?: string | null
  name: string
  className?: string
  title?: string
}) {
  const imageSrc = resolveImageAssetSource(avatarImageUrl, avatarUrl)

  return (
    <Avatar size="sm" className={cn("size-5", className)} title={title}>
      {imageSrc ? <AvatarImage src={imageSrc} alt={name} /> : null}
      <AvatarFallback className="text-[9px]">
        {getUserInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

export function DocumentPresenceAvatarGroup({
  viewers,
}: {
  viewers: DocumentPresenceViewer[]
}) {
  if (viewers.length === 0) {
    return null
  }

  const visibleViewers = viewers.slice(0, MAX_VISIBLE_DOCUMENT_VIEWERS)
  const hiddenViewerCount = viewers.length - visibleViewers.length
  const viewerNames = viewers.map((viewer) => viewer.name).join(", ")

  return (
    <div
      className="flex items-center"
      aria-label={`Also viewing: ${viewerNames}`}
      title={`Also viewing: ${viewerNames}`}
    >
      <AvatarGroup className="*:data-[slot=avatar]:ring-1 *:data-[slot=avatar]:ring-background">
        {visibleViewers.map((viewer) => (
          <DocumentAuthorAvatar
            key={viewer.userId}
            avatarImageUrl={viewer.avatarImageUrl}
            avatarUrl={viewer.avatarUrl}
            name={viewer.name}
            title={viewer.name}
          />
        ))}
        {hiddenViewerCount > 0 ? (
          <AvatarGroupCount className="size-5 text-[9px]">
            +{hiddenViewerCount}
          </AvatarGroupCount>
        ) : null}
      </AvatarGroup>
    </div>
  )
}

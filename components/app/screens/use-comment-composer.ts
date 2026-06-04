"use client"

import type { Editor } from "@tiptap/react"
import { useRef, useState } from "react"

import {
  commentContentConstraints,
  getTextInputLimitState,
} from "@/lib/domain/input-constraints"
import { useAppStore } from "@/lib/store/app-store"
import { flushPendingAttachmentUploads, hasPendingAttachments } from "@/components/app/rich-text-editor/pending-attachments"

type CommentComposerTargetType = "workItem" | "document"

export function getCommentContentLimitState(content: string) {
  return getTextInputLimitState(content, commentContentConstraints, {
    plainText: true,
  })
}

export async function flushPendingCommentContentAttachments({
  content,
  targetId,
  targetType,
}: {
  content: string
  targetId: string
  targetType: CommentComposerTargetType
}) {
  if (!hasPendingAttachments(content)) {
    return content
  }

  return flushPendingAttachmentUploads(content, (file) =>
    useAppStore.getState().uploadAttachment(targetType, targetId, file)
  )
}

export function useCommentComposer(
  targetType: CommentComposerTargetType,
  targetId: string
) {
  const [content, setContent] = useState("")
  const commentEditorRef = useRef<Editor | null>(null)
  const commentLimitState = getCommentContentLimitState(content)

  async function handleComment() {
    if (!commentLimitState.canSubmit) {
      return
    }

    const outgoingContent = await flushPendingCommentContentAttachments({
      content,
      targetId,
      targetType,
    })

    if (outgoingContent === null) {
      return
    }

    useAppStore.getState().addComment({
      targetType,
      targetId,
      content: outgoingContent,
    })
    setContent("")
  }

  return {
    commentEditorRef,
    commentLimitState,
    content,
    handleComment,
    setContent,
  }
}

"use client"

import type { Editor } from "@tiptap/react"
import { useRef, useState } from "react"

import {
  commentContentConstraints,
  getTextInputLimitState,
} from "@/lib/domain/input-constraints"
import { useAppStore } from "@/lib/store/app-store"

type CommentComposerTargetType = "workItem" | "document"

export function useCommentComposer(
  targetType: CommentComposerTargetType,
  targetId: string
) {
  const [content, setContent] = useState("")
  const commentEditorRef = useRef<Editor | null>(null)
  const commentLimitState = getTextInputLimitState(
    content,
    commentContentConstraints,
    {
      plainText: true,
    }
  )

  function handleComment() {
    if (!commentLimitState.canSubmit) {
      return
    }

    useAppStore.getState().addComment({
      targetType,
      targetId,
      content,
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

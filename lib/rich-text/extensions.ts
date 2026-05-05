import CharacterCount from "@tiptap/extension-character-count"
import Highlight from "@tiptap/extension-highlight"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Mention from "@tiptap/extension-mention"
import Placeholder from "@tiptap/extension-placeholder"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import TextAlign from "@tiptap/extension-text-align"
import { TableKit } from "@tiptap/extension-table"
import Typography from "@tiptap/extension-typography"
import Underline from "@tiptap/extension-underline"
import type { Extensions } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"

import {
  renderMentionHTML,
  renderMentionText,
} from "@/lib/rich-text/mention-rendering"

export function createRichTextBaseExtensions(options?: {
  placeholder?: string
  collaboration?: boolean
  includeCharacterCount?: boolean
  characterLimit?: number
}) {
  const extensions: Extensions = [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      link: false,
      underline: false,
      undoRedo: options?.collaboration ? false : undefined,
    }),
    TableKit.configure({
      table: {
        resizable: true,
        HTMLAttributes: {
          class: "editor-table",
        },
      },
    }),
    Highlight.configure({
      HTMLAttributes: {
        class: "editor-highlight",
      },
    }),
    Image.configure({
      HTMLAttributes: {
        class: "editor-image",
      },
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
    }),
    Mention.configure({
      HTMLAttributes: {
        class: "editor-mention",
      },
      deleteTriggerWithBackspace: true,
      renderText: renderMentionText,
      renderHTML: renderMentionHTML,
      suggestion: {
        allow: () => false,
      },
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Typography,
  ]

  if (options?.includeCharacterCount ?? true) {
    extensions.push(
      CharacterCount.configure({
        limit: options?.characterLimit,
      })
    )
  }

  if (options?.placeholder) {
    extensions.push(
      Placeholder.configure({
        placeholder: options.placeholder,
      })
    )
  }

  return extensions
}

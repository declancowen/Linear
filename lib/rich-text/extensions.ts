import { Extension, Node, mergeAttributes } from "@tiptap/core"
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
  CHAT_QUOTE_SOURCE_MESSAGE_ID_ATTRIBUTE,
  normalizeChatQuoteSourceMessageId,
} from "@/lib/content/chat-message-quote-metadata"
import { isRichTextEntityReferenceType } from "@/lib/content/rich-text-references"
import {
  renderMentionHTML,
  renderMentionText,
} from "@/lib/rich-text/mention-rendering"

const EntityReference = Node.create({
  name: "entityReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      referenceType: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-reference-type"),
      },
      referenceId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-reference-id"),
      },
      label: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-label") ?? element.textContent,
      },
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute("href"),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-type="entity-reference"][data-reference-type][data-reference-id]',
      },
      {
        tag: "a.editor-reference[data-reference-type][data-reference-id]",
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const referenceType = isRichTextEntityReferenceType(
      node.attrs.referenceType
    )
      ? node.attrs.referenceType
      : "workItem"
    const referenceId =
      typeof node.attrs.referenceId === "string" ? node.attrs.referenceId : ""
    const label =
      typeof node.attrs.label === "string" && node.attrs.label.length > 0
        ? node.attrs.label
        : referenceId
    const href =
      typeof node.attrs.href === "string" && node.attrs.href.length > 0
        ? node.attrs.href
        : "#"

    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        class: `editor-reference editor-reference-${referenceType}`,
        "data-type": "entity-reference",
        "data-reference-type": referenceType,
        "data-reference-id": referenceId,
        "data-label": label,
        href,
      }),
      label,
    ]
  },

  renderText({ node }) {
    return typeof node.attrs.label === "string"
      ? node.attrs.label
      : String(node.attrs.referenceId ?? "")
  },
})

const NonInclusiveLink = Link.extend({
  inclusive() {
    return false
  },
})

const ChatQuoteSourceMetadata = Extension.create({
  name: "chatQuoteSourceMetadata",

  addGlobalAttributes() {
    return [
      {
        types: ["blockquote"],
        attributes: {
          chatSourceMessageId: {
            default: null,
            parseHTML: (element) =>
              normalizeChatQuoteSourceMessageId(
                element.getAttribute(CHAT_QUOTE_SOURCE_MESSAGE_ID_ATTRIBUTE)
              ),
            renderHTML: (attributes) => {
              const sourceMessageId = normalizeChatQuoteSourceMessageId(
                typeof attributes.chatSourceMessageId === "string"
                  ? attributes.chatSourceMessageId
                  : null
              )

              return sourceMessageId
                ? {
                    [CHAT_QUOTE_SOURCE_MESSAGE_ID_ATTRIBUTE]: sourceMessageId,
                  }
                : {}
            },
          },
        },
      },
    ]
  },
})

const AttachmentReference = Node.create({
  name: "attachmentReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute("href"),
      },
      fileName: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-file-name") ?? element.textContent,
      },
      attachmentKind: {
        default: "file",
        parseHTML: (element) =>
          element.getAttribute("data-attachment-kind") ?? "file",
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-type="attachment"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    const fileName =
      typeof node.attrs.fileName === "string" && node.attrs.fileName.length > 0
        ? node.attrs.fileName
        : "Attachment"
    const href =
      typeof node.attrs.href === "string" && node.attrs.href.length > 0
        ? node.attrs.href
        : "#"
    const attachmentKind =
      typeof node.attrs.attachmentKind === "string"
        ? node.attrs.attachmentKind
        : "file"

    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        class: "editor-attachment",
        "data-type": "attachment",
        "data-attachment-kind": attachmentKind,
        "data-file-name": fileName,
        href,
        target: "_blank",
        rel: "noreferrer",
      }),
      fileName,
    ]
  },

  renderText({ node }) {
    return typeof node.attrs.fileName === "string" ? node.attrs.fileName : ""
  },
})

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
    ChatQuoteSourceMetadata,
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
    NonInclusiveLink.configure({
      openOnClick: false,
      autolink: true,
    }),
    EntityReference,
    AttachmentReference,
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

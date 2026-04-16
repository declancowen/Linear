"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import {
  CheckSquare,
  Code,
  FileArrowUp,
  ImageSquare,
  Lightning,
  ListBullets,
  ListChecks,
  Minus,
  Paragraph,
  Quotes,
  Smiley,
  Table as TableIcon,
  TextHOne,
  TextHTwo,
  TextHThree,
} from "@phosphor-icons/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import type { UserProfile } from "@/lib/domain/types"
import { cn, resolveImageAssetSource } from "@/lib/utils"

export type MenuState = {
  from: number
  to: number
  query: string
  top: number
  bottom: number
  left: number
}

export type MentionCandidate = Pick<
  UserProfile,
  "id" | "name" | "handle" | "avatarImageUrl" | "avatarUrl" | "title"
>

type SlashCommand = {
  id: string
  label: string
  description: string
  keywords: string[]
  icon: React.ReactNode
  run: (editor: Editor) => void
}

const DEFAULT_TABLE_OPTIONS = {
  rows: 3,
  cols: 3,
  withHeaderRow: true,
} as const

function insertDefaultTable(editor: Editor) {
  editor.chain().focus().insertTable(DEFAULT_TABLE_OPTIONS).run()
}

export function insertMention(
  editor: Editor,
  range: { from: number; to: number },
  candidate: MentionCandidate
) {
  editor
    .chain()
    .focus()
    .insertContentAt(range, [
      {
        type: "mention",
        attrs: {
          id: candidate.id,
          label: candidate.handle,
          mentionSuggestionChar: "@",
        },
      },
      {
        type: "text",
        text: " ",
      },
    ])
    .run()
}

export function buildSlashState(
  editor: Editor,
  container: HTMLDivElement | null
): MenuState | null {
  const { state, view } = editor

  if (!state.selection.empty) {
    return null
  }

  const { $from, from } = state.selection

  if (!$from.parent.isTextblock) {
    return null
  }

  const textBefore = state.doc.textBetween($from.start(), from, "\n", "\0")
  const match = textBefore.match(/^\/([\w\s-]*)$/)

  if (!match) {
    return null
  }

  const slashStart = from - textBefore.length
  const menuAnchor = Math.max(slashStart + 1, 1)
  const coords = view.coordsAtPos(menuAnchor)
  const containerRect = container?.getBoundingClientRect()

  return {
    from: slashStart,
    to: from,
    query: match[1]?.trim().toLowerCase() ?? "",
    top: containerRect ? coords.bottom - containerRect.top + 8 : 12,
    bottom: containerRect ? containerRect.bottom - coords.top + 8 : 12,
    left: containerRect ? coords.left - containerRect.left + 8 : 12,
  }
}

export function buildMentionState(
  editor: Editor,
  container: HTMLDivElement | null
): MenuState | null {
  const { state, view } = editor

  if (!state.selection.empty) {
    return null
  }

  const { $from, from } = state.selection

  if (!$from.parent.isTextblock) {
    return null
  }

  const textBefore = state.doc.textBetween($from.start(), from, "\n", "\0")
  const match = textBefore.match(/(^|\s)@([a-z0-9_-]*)$/i)

  if (!match) {
    return null
  }

  const query = match[2] ?? ""
  const mentionText = `@${query}`
  const mentionStart = from - mentionText.length
  const menuAnchor = Math.max(mentionStart + 1, 1)
  const coords = view.coordsAtPos(menuAnchor)
  const containerRect = container?.getBoundingClientRect()

  return {
    from: mentionStart,
    to: from,
    query: query.trim().toLowerCase(),
    top: containerRect ? coords.bottom - containerRect.top + 8 : 12,
    bottom: containerRect ? containerRect.bottom - coords.top + 8 : 12,
    left: containerRect ? coords.left - containerRect.left + 8 : 12,
  }
}

function getSlashCommands({
  enableUploads,
  promptEmojiPicker,
  promptAttachmentUpload,
  promptImageUpload,
}: {
  enableUploads: boolean
  promptEmojiPicker: (editor: Editor) => void
  promptAttachmentUpload: (editor: Editor) => void
  promptImageUpload: (editor: Editor) => void
}): SlashCommand[] {
  const commands: SlashCommand[] = [
    {
      id: "paragraph",
      label: "Paragraph",
      description: "Plain body text",
      keywords: ["text", "body", "paragraph", "normal"],
      icon: <Paragraph className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().setParagraph().run()
      },
    },
    {
      id: "heading-1",
      label: "Heading 1",
      description: "Large section heading",
      keywords: ["title", "header", "section", "h1"],
      icon: <TextHOne className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleHeading({ level: 1 }).run()
      },
    },
    {
      id: "heading-2",
      label: "Heading 2",
      description: "Medium section heading",
      keywords: ["subtitle", "subheading", "section", "h2"],
      icon: <TextHTwo className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleHeading({ level: 2 }).run()
      },
    },
    {
      id: "heading-3",
      label: "Heading 3",
      description: "Small section heading",
      keywords: ["subtitle", "subheading", "section", "h3"],
      icon: <TextHThree className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleHeading({ level: 3 }).run()
      },
    },
    {
      id: "bullet-list",
      label: "Bullet list",
      description: "Unordered list",
      keywords: ["list", "bullets", "requirements"],
      icon: <ListBullets className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleBulletList().run()
      },
    },
    {
      id: "task-list",
      label: "Checklist",
      description: "Task list with checkboxes",
      keywords: ["tasks", "todo", "criteria"],
      icon: <ListChecks className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleTaskList().run()
      },
    },
    {
      id: "emoji",
      label: "Emoji",
      description: "Open the emoji picker",
      keywords: ["emoji", "reaction", "smile", "icon"],
      icon: <Smiley className="size-4" />,
      run: (currentEditor) => {
        promptEmojiPicker(currentEditor)
      },
    },
    {
      id: "image",
      label: "Image",
      description: "Upload and embed an image",
      keywords: ["image", "photo", "screenshot", "media"],
      icon: <ImageSquare className="size-4" />,
      run: (currentEditor) => {
        promptImageUpload(currentEditor)
      },
    },
    {
      id: "table",
      label: "Table",
      description: "3 × 3 table with a header row",
      keywords: ["table", "grid", "rows", "columns"],
      icon: <TableIcon className="size-4" />,
      run: (currentEditor) => {
        insertDefaultTable(currentEditor)
      },
    },
    {
      id: "quote",
      label: "Quote",
      description: "Blockquote callout",
      keywords: ["callout", "note", "constraint"],
      icon: <Quotes className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleBlockquote().run()
      },
    },
    {
      id: "code",
      label: "Code block",
      description: "Fenced code snippet",
      keywords: ["code", "snippet", "technical"],
      icon: <Code className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().toggleCodeBlock().run()
      },
    },
    {
      id: "divider",
      label: "Divider",
      description: "Horizontal separator",
      keywords: ["separator", "rule", "divider"],
      icon: <Minus className="size-4" />,
      run: (currentEditor) => {
        currentEditor.chain().focus().setHorizontalRule().run()
      },
    },
    {
      id: "decision",
      label: "Decision",
      description: "Decision template",
      keywords: ["decision", "adr", "context"],
      icon: <Lightning className="size-4" />,
      run: (currentEditor) => {
        currentEditor
          .chain()
          .focus()
          .insertContent(
            "<h3>Decision</h3><p>Summarize the decision and the reason for it.</p><h3>Impact</h3><ul><li>What changes now?</li><li>Who is affected?</li></ul>"
          )
          .run()
      },
    },
    {
      id: "success-criteria",
      label: "Success criteria",
      description: "Acceptance checklist",
      keywords: ["acceptance", "criteria", "done"],
      icon: <CheckSquare className="size-4" />,
      run: (currentEditor) => {
        currentEditor
          .chain()
          .focus()
          .insertContent(
            `<h3>Success criteria</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>Outcome one</p></div></li><li data-type="taskItem" data-checked="false"><div><p>Outcome two</p></div></li></ul>`
          )
          .run()
      },
    },
    {
      id: "attachment",
      label: "Attachment",
      description: "Upload a file",
      keywords: ["file", "upload", "attachment"],
      icon: <FileArrowUp className="size-4" />,
      run: (currentEditor) => {
        promptAttachmentUpload(currentEditor)
      },
    },
  ]

  if (!enableUploads) {
    return commands.filter(
      (command) => command.id !== "image" && command.id !== "attachment"
    )
  }

  return commands
}

export function filterSlashCommands(
  query: string,
  options: {
    enableUploads: boolean
    promptEmojiPicker: (editor: Editor) => void
    promptAttachmentUpload: (editor: Editor) => void
    promptImageUpload: (editor: Editor) => void
  }
) {
  return getSlashCommands(options).filter((command) => {
    const haystack = [command.label, command.description, ...command.keywords]
      .join(" ")
      .toLowerCase()

    return haystack.includes(query)
  })
}

export function filterMentionCandidates(
  query: string,
  candidates: MentionCandidate[]
) {
  const normalizedQuery = query.trim().toLowerCase()

  return [...candidates]
    .filter((candidate) => {
      if (!normalizedQuery) {
        return true
      }

      return (
        candidate.handle.toLowerCase().includes(normalizedQuery) ||
        candidate.name.toLowerCase().includes(normalizedQuery)
      )
    })
    .sort((left, right) => {
      const leftHandleStarts = left.handle
        .toLowerCase()
        .startsWith(normalizedQuery)
      const rightHandleStarts = right.handle
        .toLowerCase()
        .startsWith(normalizedQuery)

      if (leftHandleStarts !== rightHandleStarts) {
        return leftHandleStarts ? -1 : 1
      }

      return left.name.localeCompare(right.name)
    })
    .slice(0, 8)
}

const SLASH_MENU_WIDTH = 288
const MENTION_MENU_WIDTH = 256

function getMenuLeft(
  state: MenuState,
  containerWidth: number,
  menuWidth: number
) {
  return Math.min(
    Math.max(12, state.left),
    Math.max(12, containerWidth - (menuWidth + 12))
  )
}

function useActiveItemScroll(activeIndex: number, itemCount: number) {
  const itemRefs = React.useRef<Array<HTMLDivElement | null>>([])

  React.useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({
      block: "nearest",
    })
  }, [activeIndex, itemCount])

  return itemRefs
}

export function SlashCommandMenu({
  activeIndex,
  commands,
  containerWidth,
  editor,
  state,
  onComplete,
}: {
  activeIndex: number
  commands: ReturnType<typeof filterSlashCommands>
  containerWidth: number
  editor: Editor
  state: MenuState
  onComplete: () => void
}) {
  const itemRefs = useActiveItemScroll(activeIndex, commands.length)

  return (
    <div
      className="absolute z-10 w-72 max-w-[calc(100%-1rem)]"
      style={{
        left: getMenuLeft(state, containerWidth, SLASH_MENU_WIDTH),
        top: state.top,
      }}
    >
      <Command
        className="overflow-hidden rounded-lg border bg-popover shadow-md"
        shouldFilter={false}
        value={commands[activeIndex]?.id}
      >
        <CommandList className="max-h-[min(20rem,50vh)]">
          <CommandEmpty>
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No matching blocks
            </div>
          </CommandEmpty>
          <CommandGroup>
            {commands.map((command, index) => (
              <CommandItem
                key={command.id}
                ref={(node) => {
                  itemRefs.current[index] = node
                }}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-1.5",
                  index === activeIndex && "bg-accent"
                )}
                value={command.id}
                onSelect={() => {
                  editor
                    .chain()
                    .focus()
                    .deleteRange({
                      from: state.from,
                      to: state.to,
                    })
                    .run()
                  command.run(editor)
                  onComplete()
                }}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                  {command.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{command.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {command.description}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}

export function MentionMenu({
  activeIndex,
  candidates,
  containerWidth,
  editor,
  placement = "below",
  state,
  onComplete,
}: {
  activeIndex: number
  candidates: MentionCandidate[]
  containerWidth: number
  editor: Editor
  placement?: "above" | "below"
  state: MenuState
  onComplete: () => void
}) {
  const itemRefs = useActiveItemScroll(activeIndex, candidates.length)

  return (
    <div
      className="absolute z-10 w-64 max-w-[calc(100%-1rem)]"
      style={{
        bottom: placement === "above" ? state.bottom : undefined,
        left: getMenuLeft(state, containerWidth, MENTION_MENU_WIDTH),
        top: placement === "below" ? state.top : undefined,
      }}
    >
      <Command
        className="overflow-hidden rounded-lg border bg-popover shadow-md"
        shouldFilter={false}
        value={candidates[activeIndex]?.id}
      >
        <CommandList className="max-h-[min(20rem,50vh)]">
          <CommandEmpty>
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No matching people
            </div>
          </CommandEmpty>
          <CommandGroup>
            {candidates.map((candidate, index) => (
              <CommandItem
                key={candidate.id}
                ref={(node) => {
                  itemRefs.current[index] = node
                }}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-1.5",
                  index === activeIndex && "bg-accent"
                )}
                value={candidate.id}
                onSelect={() => {
                  insertMention(editor, state, candidate)
                  onComplete()
                }}
              >
                <Avatar size="default" className="size-8">
                  {resolveImageAssetSource(
                    candidate.avatarImageUrl,
                    candidate.avatarUrl
                  ) ? (
                    <AvatarImage
                      src={
                        resolveImageAssetSource(
                          candidate.avatarImageUrl,
                          candidate.avatarUrl
                        ) ?? undefined
                      }
                      alt={candidate.name}
                    />
                  ) : null}
                  <AvatarFallback>
                    {candidate.name
                      .split(" ")
                      .map((part) => part[0] ?? "")
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{candidate.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {candidate.title || "No title"}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}

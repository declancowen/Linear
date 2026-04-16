"use client"

import type { RefObject } from "react"
import type { Editor } from "@tiptap/react"
import {
  ColumnsPlusRight,
  FrameCorners,
  Highlighter,
  ImageSquare,
  LinkSimple,
  ListBullets,
  ListChecks,
  Paperclip,
  Paragraph,
  RowsPlusBottom,
  Table as TableIcon,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  TextB,
  TextHOne,
  TextHTwo,
  TextHThree,
  TextItalic,
  TextUnderline,
  Trash,
  Quotes,
} from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type FullPageCanvasWidth = "narrow" | "medium" | "wide"

export const FULL_PAGE_CANVAS_WIDTH_CLASSNAME: Record<
  FullPageCanvasWidth,
  string
> = {
  narrow: "max-w-none md:w-[55%]",
  medium: "max-w-none md:w-[75%]",
  wide: "max-w-none md:w-[95%]",
}

const DEFAULT_TABLE_OPTIONS = {
  rows: 3,
  cols: 3,
  withHeaderRow: true,
} as const

function insertDefaultTable(editor: Editor) {
  editor.chain().focus().insertTable(DEFAULT_TABLE_OPTIONS).run()
}

export function RichTextToolbar({
  editable,
  editor,
  fullPage,
  fullPageCanvasWidth,
  handleFiles,
  hiddenAttachmentInputRef,
  hiddenImageInputRef,
  pickerInsertPosition,
  requestAttachmentPicker,
  requestImagePicker,
  setFullPageCanvasWidth,
  showStats,
  statsCharacters,
  statsWords,
  toolbarWidthClassName,
  uploadsEnabled,
  uploadingAttachment,
}: {
  editable: boolean
  editor: Editor
  fullPage: boolean
  fullPageCanvasWidth: FullPageCanvasWidth
  handleFiles: (files: File[], position?: number | null) => Promise<void>
  hiddenAttachmentInputRef: RefObject<HTMLInputElement | null>
  hiddenImageInputRef: RefObject<HTMLInputElement | null>
  pickerInsertPosition: number | null
  requestAttachmentPicker: (editor: Editor) => void
  requestImagePicker: (editor: Editor) => void
  setFullPageCanvasWidth: (value: FullPageCanvasWidth) => void
  showStats: boolean
  statsCharacters: number
  statsWords: number
  toolbarWidthClassName: string
  uploadsEnabled: boolean
  uploadingAttachment: boolean
}) {
  const tableActive = editor.isActive("table")
  const highlightActive = editor.isActive("highlight")
  const paragraphActive = editor.isActive("paragraph")
  const h1Active = editor.isActive("heading", { level: 1 })
  const h2Active = editor.isActive("heading", { level: 2 })
  const h3Active = editor.isActive("heading", { level: 3 })
  const alignCenterActive = editor.isActive({ textAlign: "center" })
  const alignRightActive = editor.isActive({ textAlign: "right" })
  const alignLeftActive = !alignCenterActive && !alignRightActive
  const canInsertTable = editor
    .can()
    .chain()
    .focus()
    .insertTable(DEFAULT_TABLE_OPTIONS)
    .run()
  const canAddTableRow = editor.can().chain().focus().addRowAfter().run()
  const canAddTableColumn = editor
    .can()
    .chain()
    .focus()
    .addColumnAfter()
    .run()
  const canDeleteTableRow = editor.can().chain().focus().deleteRow().run()
  const canDeleteTableColumn = editor
    .can()
    .chain()
    .focus()
    .deleteColumn()
    .run()
  const canDeleteTable = editor.can().chain().focus().deleteTable().run()

  function setLink() {
    const existing = editor.getAttributes("link").href as string | undefined
    const nextHref = window.prompt("Link URL", existing ?? "https://")

    if (!nextHref) {
      editor.chain().focus().unsetLink().run()
      return
    }

    editor.chain().focus().setLink({ href: nextHref }).run()
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 overflow-x-auto",
        fullPage ? "mx-auto w-full px-6 py-2" : "pb-1",
        fullPage && toolbarWidthClassName
      )}
    >
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Bold"
      >
        <TextB className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Italic"
      >
        <TextItalic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label="Underline"
      >
        <TextUnderline className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={highlightActive}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        label="Highlight"
      >
        <Highlighter className="size-3.5" />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        active={paragraphActive}
        onClick={() => editor.chain().focus().setParagraph().run()}
        label="Paragraph"
      >
        <Paragraph className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={h1Active}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        label="Heading 1"
      >
        <TextHOne className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={h2Active}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="Heading 2"
      >
        <TextHTwo className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={h3Active}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        label="Heading 3"
      >
        <TextHThree className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Bulleted list"
      >
        <ListBullets className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        label="Task list"
      >
        <ListChecks className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="Quote"
      >
        <Quotes className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("link")} onClick={setLink} label="Link">
        <LinkSimple className="size-3.5" />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        active={alignLeftActive}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        label="Align left"
      >
        <TextAlignLeft className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={alignCenterActive}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        label="Align center"
      >
        <TextAlignCenter className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={alignRightActive}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        label="Align right"
      >
        <TextAlignRight className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={tableActive}
        disabled={!canInsertTable}
        onClick={() => insertDefaultTable(editor)}
        label="Insert table"
      >
        <TableIcon className="size-3.5" />
      </ToolbarButton>
      {fullPage ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={!editable}
              className={cn(
                "flex size-7 items-center justify-center text-muted-foreground transition-colors",
                editable ? "hover:text-foreground" : "cursor-default opacity-60"
              )}
              aria-label="Canvas width"
              title="Canvas width"
            >
              <FrameCorners className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40 min-w-40">
            <DropdownMenuRadioGroup
              value={fullPageCanvasWidth}
              onValueChange={(value) =>
                setFullPageCanvasWidth(value as FullPageCanvasWidth)
              }
            >
              <DropdownMenuRadioItem value="narrow">Narrow</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="medium">Normal</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="wide">Wide</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {uploadsEnabled ? (
        <ToolbarButton
          active={false}
          onClick={() => requestImagePicker(editor)}
          label="Insert image"
        >
          <ImageSquare className="size-3.5" />
        </ToolbarButton>
      ) : null}
      {tableActive ? (
        <>
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton
            active={false}
            disabled={!canAddTableRow}
            onClick={() => editor.chain().focus().addRowAfter().run()}
            label="Add row"
          >
            <RowsPlusBottom className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={false}
            disabled={!canAddTableColumn}
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            label="Add column"
          >
            <ColumnsPlusRight className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={false}
            disabled={!canDeleteTableRow}
            onClick={() => editor.chain().focus().deleteRow().run()}
            label="Delete row"
          >
            <Trash className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={false}
            disabled={!canDeleteTableColumn}
            onClick={() => editor.chain().focus().deleteColumn().run()}
            label="Delete column"
          >
            <Trash className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={false}
            disabled={!canDeleteTable}
            onClick={() => editor.chain().focus().deleteTable().run()}
            label="Delete table"
          >
            <Trash className="size-3.5" />
          </ToolbarButton>
        </>
      ) : null}
      {uploadsEnabled ? (
        <>
          <input
            ref={hiddenAttachmentInputRef}
            className="hidden"
            type="file"
            multiple
            onChange={(event) =>
              void handleFiles(
                Array.from(event.target.files ?? []),
                pickerInsertPosition
              )
            }
          />
          <input
            ref={hiddenImageInputRef}
            className="hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) =>
              void handleFiles(
                Array.from(event.target.files ?? []),
                pickerInsertPosition
              )
            }
          />
          <ToolbarButton
            active={false}
            onClick={() => {
              requestAttachmentPicker(editor)
              hiddenAttachmentInputRef.current?.click()
            }}
            label="Attach file"
          >
            <Paperclip className="size-3.5" />
          </ToolbarButton>
        </>
      ) : null}
      {uploadingAttachment ? (
        <span className="ml-2 text-xs text-muted-foreground">Uploading…</span>
      ) : null}
      <div className="ml-auto flex items-center">
        {showStats ? (
          <span className="pl-3 text-xs whitespace-nowrap text-muted-foreground">
            {statsWords} words · {statsCharacters} characters
          </span>
        ) : null}
      </div>
    </div>
  )
}

function ToolbarButton({
  active,
  disabled = false,
  onClick,
  label,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        disabled &&
          "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground"
      )}
      onClick={onClick}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

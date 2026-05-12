"use client"

import { forwardRef, type RefObject } from "react"
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
  Smiley,
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

import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
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

type RichTextToolbarProps = {
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
}: RichTextToolbarProps) {
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
      <TextMarkToolbarGroup editor={editor} />
      <ToolbarSeparator />
      <BlockToolbarGroup editor={editor} setLink={setLink} />
      <ToolbarSeparator />
      <AlignmentToolbarGroup editor={editor} />
      <TableInsertToolbarButton editor={editor} />
      <EmojiToolbarButton editor={editor} fullPage={fullPage} />
      <ImageToolbarButton
        editor={editor}
        requestImagePicker={requestImagePicker}
        uploadsEnabled={uploadsEnabled}
      />
      <TableEditToolbarGroup editor={editor} />
      <UploadToolbarGroup
        editor={editor}
        handleFiles={handleFiles}
        hiddenAttachmentInputRef={hiddenAttachmentInputRef}
        hiddenImageInputRef={hiddenImageInputRef}
        pickerInsertPosition={pickerInsertPosition}
        requestAttachmentPicker={requestAttachmentPicker}
        uploadsEnabled={uploadsEnabled}
      />
      <UploadStatus uploadingAttachment={uploadingAttachment} />
      <FullPageToolbarControls
        editable={editable}
        fullPage={fullPage}
        fullPageCanvasWidth={fullPageCanvasWidth}
        setFullPageCanvasWidth={setFullPageCanvasWidth}
      />
      <ToolbarStats
        showStats={showStats}
        statsCharacters={statsCharacters}
        statsWords={statsWords}
      />
    </div>
  )
}

function TextMarkToolbarGroup({ editor }: { editor: Editor }) {
  return (
    <>
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
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        label="Highlight"
      >
        <Highlighter className="size-3.5" />
      </ToolbarButton>
    </>
  )
}

function BlockToolbarGroup({
  editor,
  setLink,
}: {
  editor: Editor
  setLink: () => void
}) {
  return (
    <>
      <ToolbarButton
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
        label="Paragraph"
      >
        <Paragraph className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        label="Heading 1"
      >
        <TextHOne className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="Heading 2"
      >
        <TextHTwo className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
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
      <ToolbarButton
        active={editor.isActive("link")}
        onClick={setLink}
        label="Link"
      >
        <LinkSimple className="size-3.5" />
      </ToolbarButton>
    </>
  )
}

function AlignmentToolbarGroup({ editor }: { editor: Editor }) {
  const alignCenterActive = editor.isActive({ textAlign: "center" })
  const alignRightActive = editor.isActive({ textAlign: "right" })
  const alignLeftActive = !alignCenterActive && !alignRightActive

  return (
    <>
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
    </>
  )
}

function TableInsertToolbarButton({ editor }: { editor: Editor }) {
  const canInsertTable = editor
    .can()
    .chain()
    .focus()
    .insertTable(DEFAULT_TABLE_OPTIONS)
    .run()

  return (
    <ToolbarButton
      active={editor.isActive("table")}
      disabled={!canInsertTable}
      onClick={() => insertDefaultTable(editor)}
      label="Insert table"
    >
      <TableIcon className="size-3.5" />
    </ToolbarButton>
  )
}

function EmojiToolbarButton({
  editor,
  fullPage,
}: {
  editor: Editor
  fullPage: boolean
}) {
  return (
    <EmojiPickerPopover
      align="start"
      side={fullPage ? "bottom" : "top"}
      onEmojiSelect={(emoji) => {
        editor.chain().focus().insertContent(emoji).run()
      }}
      trigger={
        <ToolbarButton
          active={false}
          onClick={() => {
            editor.chain().focus().run()
          }}
          label="Insert emoji"
        >
          <Smiley className="size-3.5" />
        </ToolbarButton>
      }
    />
  )
}

function ImageToolbarButton({
  editor,
  requestImagePicker,
  uploadsEnabled,
}: {
  editor: Editor
  requestImagePicker: (editor: Editor) => void
  uploadsEnabled: boolean
}) {
  if (!uploadsEnabled) {
    return null
  }

  return (
    <ToolbarButton
      active={false}
      onClick={() => requestImagePicker(editor)}
      label="Insert image"
    >
      <ImageSquare className="size-3.5" />
    </ToolbarButton>
  )
}

function TableEditToolbarGroup({ editor }: { editor: Editor }) {
  if (!editor.isActive("table")) {
    return null
  }

  return (
    <>
      <ToolbarSeparator />
      <ToolbarButton
        active={false}
        disabled={!editor.can().chain().focus().addRowAfter().run()}
        onClick={() => editor.chain().focus().addRowAfter().run()}
        label="Add row"
      >
        <RowsPlusBottom className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={false}
        disabled={!editor.can().chain().focus().addColumnAfter().run()}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        label="Add column"
      >
        <ColumnsPlusRight className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={false}
        disabled={!editor.can().chain().focus().deleteRow().run()}
        onClick={() => editor.chain().focus().deleteRow().run()}
        label="Delete row"
      >
        <Trash className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={false}
        disabled={!editor.can().chain().focus().deleteColumn().run()}
        onClick={() => editor.chain().focus().deleteColumn().run()}
        label="Delete column"
      >
        <Trash className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={false}
        disabled={!editor.can().chain().focus().deleteTable().run()}
        onClick={() => editor.chain().focus().deleteTable().run()}
        label="Delete table"
      >
        <Trash className="size-3.5" />
      </ToolbarButton>
    </>
  )
}

function UploadToolbarGroup({
  editor,
  handleFiles,
  hiddenAttachmentInputRef,
  hiddenImageInputRef,
  pickerInsertPosition,
  requestAttachmentPicker,
  uploadsEnabled,
}: Pick<
  RichTextToolbarProps,
  | "editor"
  | "handleFiles"
  | "hiddenAttachmentInputRef"
  | "hiddenImageInputRef"
  | "pickerInsertPosition"
  | "requestAttachmentPicker"
  | "uploadsEnabled"
>) {
  if (!uploadsEnabled) {
    return null
  }

  return (
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
  )
}

function UploadStatus({
  uploadingAttachment,
}: {
  uploadingAttachment: boolean
}) {
  if (!uploadingAttachment) {
    return null
  }

  return <span className="text-xs text-muted-foreground">Uploading…</span>
}

function FullPageToolbarControls({
  editable,
  fullPage,
  fullPageCanvasWidth,
  setFullPageCanvasWidth,
}: Pick<
  RichTextToolbarProps,
  | "editable"
  | "fullPage"
  | "fullPageCanvasWidth"
  | "setFullPageCanvasWidth"
>) {
  if (!fullPage) {
    return null
  }

  return (
    <>
      <ToolbarSeparator />
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
        <DropdownMenuContent align="end" className="w-40 min-w-40">
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
    </>
  )
}

function ToolbarStats({
  showStats,
  statsCharacters,
  statsWords,
}: Pick<RichTextToolbarProps, "showStats" | "statsCharacters" | "statsWords">) {
  return (
    <div className="ml-auto flex items-center gap-2">
      {showStats ? (
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {statsWords} words · {statsCharacters} characters
        </span>
      ) : null}
    </div>
  )
}

function ToolbarSeparator() {
  return <div className="mx-1 h-4 w-px bg-border" />
}

const ToolbarButton = forwardRef<
  HTMLButtonElement,
  {
    active: boolean
    disabled?: boolean
    onClick: () => void
    label: string
    children: React.ReactNode
  }
>(function ToolbarButton(
  { active, disabled = false, onClick, label, children },
  ref
) {
  return (
    <button
      ref={ref}
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
})

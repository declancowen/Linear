"use client"

import { useState, type ReactElement } from "react"
import EmojiPicker, {
  EmojiStyle,
  Theme,
  type EmojiClickData,
} from "emoji-picker-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const BASE_PICKER_DIMENSIONS = {
  compact: { height: 420, width: 352 },
  composer: { height: 420, width: 352 },
} as const
const PICKER_SCALE = 0.8

type EmojiPickerPopoverProps = {
  trigger: ReactElement
  onEmojiSelect: (emoji: string) => void
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  size?: keyof typeof BASE_PICKER_DIMENSIONS
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function insertEmojiIntoTextarea({
  emoji,
  textarea,
  value,
  onChange,
}: {
  emoji: string
  textarea: HTMLTextAreaElement | null
  value: string
  onChange: (value: string) => void
}) {
  if (!textarea) {
    onChange(`${value}${emoji}`)
    return
  }

  const selectionStart = textarea.selectionStart ?? value.length
  const selectionEnd = textarea.selectionEnd ?? value.length
  const nextValue =
    value.slice(0, selectionStart) + emoji + value.slice(selectionEnd)
  const nextCursor = selectionStart + emoji.length

  onChange(nextValue)

  window.requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(nextCursor, nextCursor)
  })
}

export function EmojiPickerPopover({
  trigger,
  onEmojiSelect,
  side = "top",
  align = "end",
  size = "composer",
  open,
  onOpenChange,
}: EmojiPickerPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = open !== undefined
  const pickerOpen = open ?? internalOpen
  const baseDimensions = BASE_PICKER_DIMENSIONS[size]
  const scaledDimensions = {
    width: Math.round(baseDimensions.width * PICKER_SCALE),
    height: Math.round(baseDimensions.height * PICKER_SCALE),
  }

  const handleEmojiSelect = (emoji: EmojiClickData) => {
    onEmojiSelect(emoji.emoji)
    if (!isControlled) {
      setInternalOpen(false)
    }
    onOpenChange?.(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  return (
    <Popover open={pickerOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        collisionPadding={12}
        side={side}
        sideOffset={8}
        className="w-auto border-0 bg-transparent p-0 shadow-none ring-0"
      >
        <div
          style={{
            width: scaledDimensions.width,
            height: scaledDimensions.height,
          }}
        >
          <div
            style={{
              transform: `scale(${PICKER_SCALE})`,
              transformOrigin: "top left",
            }}
          >
            <EmojiPicker
              autoFocusSearch={false}
              className="app-emoji-picker"
              emojiStyle={EmojiStyle.NATIVE}
              height={baseDimensions.height}
              lazyLoadEmojis
              previewConfig={{ showPreview: false }}
              searchPlaceholder="Search emoji"
              theme={Theme.LIGHT}
              width={baseDimensions.width}
              onEmojiClick={handleEmojiSelect}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

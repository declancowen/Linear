"use client"

import {
  ArrowBendUpLeft,
  NotePencil,
  Quotes,
  Smiley,
  Trash,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"

export const DEFAULT_REACTION_EMOJIS = ["👍", "✅", "❤️", "😂", "🎉"] as const

const baseButtonClassName =
  "inline-grid size-7 place-items-center rounded text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground"

export function MessageHoverActionBar({
  canDelete = false,
  canEdit = false,
  canQuote = false,
  canReact = true,
  className,
  deleteLabel = "Delete",
  editLabel = "Edit",
  moreReactionsLabel = "More reactions",
  onDelete,
  onEdit,
  onQuote,
  onReact,
  portalContainer,
  quoteLabel = "Quote reply",
  quoteAction = "quote",
}: {
  canDelete?: boolean
  canEdit?: boolean
  canQuote?: boolean
  canReact?: boolean
  className?: string
  deleteLabel?: string
  editLabel?: string
  moreReactionsLabel?: string
  onDelete?: () => void
  onEdit?: () => void
  onQuote?: () => void
  onReact: (emoji: string) => void
  portalContainer?: HTMLElement | null
  quoteLabel?: string
  quoteAction?: "quote" | "reply"
}) {
  const showMessageActions = canQuote || canEdit || canDelete
  const QuoteActionIcon = quoteAction === "reply" ? ArrowBendUpLeft : Quotes

  if (!canReact && !showMessageActions) {
    return null
  }

  return (
    <div
      className={cn(
        "absolute z-20 hidden items-center gap-0.5 rounded-md border border-line bg-surface p-0.5 shadow-sm",
        className
      )}
    >
      {canReact ? (
        <>
          {DEFAULT_REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React with ${emoji}`}
              title={`React with ${emoji}`}
              className={cn(baseButtonClassName, "text-[15px]")}
              onClick={() => onReact(emoji)}
            >
              {emoji}
            </button>
          ))}
          <EmojiPickerPopover
            align="end"
            portalContainer={portalContainer}
            side="top"
            onEmojiSelect={onReact}
            trigger={
              <button
                type="button"
                aria-label={moreReactionsLabel}
                title={moreReactionsLabel}
                className={baseButtonClassName}
              >
                <Smiley className="size-[14px]" />
              </button>
            }
          />
        </>
      ) : null}

      {canReact && showMessageActions ? (
        <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />
      ) : null}

      {canQuote ? (
        <button
          type="button"
          aria-label={quoteLabel}
          title={quoteLabel}
          className={baseButtonClassName}
          onClick={onQuote}
        >
          <QuoteActionIcon className="size-[14px]" />
        </button>
      ) : null}
      {canEdit ? (
        <button
          type="button"
          aria-label={editLabel}
          title={editLabel}
          className={baseButtonClassName}
          onClick={onEdit}
        >
          <NotePencil className="size-[14px]" />
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          aria-label={deleteLabel}
          title={deleteLabel}
          className={cn(
            baseButtonClassName,
            "hover:bg-destructive/10 hover:text-destructive"
          )}
          onClick={onDelete}
        >
          <Trash className="size-[14px]" />
        </button>
      ) : null}
    </div>
  )
}

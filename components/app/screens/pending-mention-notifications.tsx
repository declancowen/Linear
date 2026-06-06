import { useMemo, type ReactNode } from "react"

import {
  getPendingDocumentMentionEntries,
  type DocumentMentionQueueState,
} from "@/lib/content/document-mention-queue"
import { summarizePendingDocumentMentions } from "@/lib/content/rich-text-mentions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type PendingMentionSummary = ReturnType<
  typeof summarizePendingDocumentMentions
>

export function formatMentionCountLabel(count: number) {
  return `${count} ${count === 1 ? "mention" : "mentions"}`
}

export function formatRecipientCountLabel(count: number) {
  return `${count} ${count === 1 ? "person" : "people"}`
}

export function usePendingMentionSummary({
  enabled,
  mentionQueue,
}: {
  enabled: boolean
  mentionQueue: DocumentMentionQueueState
}) {
  const activePendingMentionEntries = useMemo(
    () => getPendingDocumentMentionEntries(mentionQueue),
    [mentionQueue]
  )
  const pendingMentionSummary = useMemo(
    () => summarizePendingDocumentMentions(activePendingMentionEntries),
    [activePendingMentionEntries]
  )

  return {
    activePendingMentionEntries,
    hasPendingMentionNotifications:
      pendingMentionSummary.recipientCount > 0 && enabled,
    pendingMentionSummary,
  }
}

export function PendingMentionNotificationBanner({
  hasPendingMentionNotifications,
  icon,
  pendingMentionSummary,
  sendingMentionNotifications,
  subject,
  onSend,
}: {
  hasPendingMentionNotifications: boolean
  icon: ReactNode
  pendingMentionSummary: PendingMentionSummary
  sendingMentionNotifications: boolean
  subject: string
  onSend: () => void
}) {
  if (!hasPendingMentionNotifications) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="cn-toast group pointer-events-auto flex w-full max-w-xl items-center gap-2.5 rounded-lg border border-line/60 bg-background/95 px-3.5 py-2.5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] backdrop-blur-xl [--toast-accent:var(--brand)]">
        <span className="flex size-4 shrink-0 items-center justify-center text-[color:var(--toast-accent)]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] leading-5 font-medium text-foreground">
            Send mention notifications
          </div>
          <div className="text-[12px] leading-4 text-fg-3">
            {formatMentionCountLabel(pendingMentionSummary.mentionCount)} across{" "}
            {formatRecipientCountLabel(pendingMentionSummary.recipientCount)}{" "}
            are ready to send for this {subject}.
          </div>
        </div>
        <Button
          size="sm"
          disabled={sendingMentionNotifications}
          onClick={onSend}
          className="shrink-0"
        >
          {sendingMentionNotifications ? "Sending..." : "Send notifications"}
        </Button>
      </div>
    </div>
  )
}

export function PendingMentionExitDialog({
  entityLabel,
  exitDialogOpen,
  pendingMentionSummary,
  sendingMentionNotifications,
  onOpenChange,
  onSendAndExit,
  onSkipAndExit,
}: {
  entityLabel: string
  exitDialogOpen: boolean
  pendingMentionSummary: PendingMentionSummary
  sendingMentionNotifications: boolean
  onOpenChange: (open: boolean) => void
  onSendAndExit: () => void
  onSkipAndExit: () => void
}) {
  return (
    <Dialog open={exitDialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0" showCloseButton={false}>
        <div className="px-5 pt-5 pb-3">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base font-semibold">
              Exit before sending notifications?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This {entityLabel} has{" "}
              {formatMentionCountLabel(pendingMentionSummary.mentionCount)}{" "}
              queued for{" "}
              {formatRecipientCountLabel(pendingMentionSummary.recipientCount)}.
              Skip them or send them before leaving.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={sendingMentionNotifications}
            onClick={onSkipAndExit}
          >
            Skip notifications
          </Button>
          <Button
            size="sm"
            disabled={sendingMentionNotifications}
            onClick={onSendAndExit}
          >
            {sendingMentionNotifications ? "Sending..." : "Send notifications"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

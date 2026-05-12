"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function CollaborationSyncDialog({
  descriptionSubject,
  open,
}: {
  descriptionSubject: string
  open: boolean
}) {
  return (
    <Dialog open={open}>
      <DialogContent className="max-w-sm gap-0 p-0" showCloseButton={false}>
        <div className="px-5 py-5">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base font-semibold">
              Syncing latest changes
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {`Loading the latest ${descriptionSubject} state. Editing will unlock automatically in a moment.`}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2 animate-pulse rounded-full bg-primary"
            />
            <span>Syncing latest changes...</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

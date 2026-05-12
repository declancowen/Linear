"use client"

import { getTextInputLimitState } from "@/lib/domain/input-constraints"
import { ShortcutKeys } from "@/components/app/shortcut-keys"
import { Button } from "@/components/ui/button"

export function shouldRemoveLastWorkspaceChatRecipient(
  key: string,
  search: string,
  participantIds: string[]
) {
  return key === "Backspace" && !search && participantIds.length > 0
}

export function WorkspaceChatCreateFooter({
  groupNameLimitState,
  isGroup,
  participantCount,
  shortcutModifierLabel,
  onCreate,
}: {
  groupNameLimitState: ReturnType<typeof getTextInputLimitState>
  isGroup: boolean
  participantCount: number
  shortcutModifierLabel: string
  onCreate: () => void
}) {
  if (participantCount === 0) {
    return null
  }

  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <span className="text-xs text-muted-foreground">
        {participantCount === 1
          ? "Direct message"
          : `Group · ${participantCount} people`}
      </span>
      <Button
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={onCreate}
        disabled={!groupNameLimitState.canSubmit || participantCount === 0}
      >
        {isGroup ? "Create group" : "Start chat"}
        <ShortcutKeys
          keys={[shortcutModifierLabel, "Enter"]}
          variant="inline"
          className="ml-0.5 gap-0.5 text-background/65"
        />
      </Button>
    </div>
  )
}

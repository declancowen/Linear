"use client"

import { useState } from "react"

import { getCurrentWorkspace } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const workspaceAccentOptions = [
  "emerald",
  "blue",
  "amber",
  "rose",
  "slate",
] as const

export function WorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const workspace = useAppStore(getCurrentWorkspace)
  const [name, setName] = useState(workspace?.name ?? "")
  const [logoUrl, setLogoUrl] = useState(workspace?.logoUrl ?? "")
  const [accent, setAccent] = useState(workspace?.settings.accent ?? "emerald")
  const [description, setDescription] = useState(
    workspace?.settings.description ?? ""
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={`${workspace?.id ?? "workspace"}-${open}`}
        className="max-w-lg gap-0 overflow-hidden p-0"
      >
        <div className="px-5 pt-5 pb-1">
          <DialogHeader className="mb-1 p-0">
            <DialogTitle className="text-base">Workspace</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Identity and branding for {workspace?.name ?? "workspace"}.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-col border-t px-5 py-2">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Name</span>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-7 w-48 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">
              Logo / initials
            </span>
            <Input
              id="workspace-logo"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              className="h-7 w-48 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Accent</span>
            <Select value={accent} onValueChange={setAccent}>
              <SelectTrigger className="h-7 w-auto min-w-28 border-none bg-transparent text-xs capitalize shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {workspaceAccentOptions.map((option) => (
                    <SelectItem key={option} value={option} className="capitalize">
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Description</span>
            <Input
              id="workspace-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="h-7 w-48 border-none bg-transparent text-right text-xs shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              useAppStore.getState().updateWorkspaceBranding({
                name,
                logoUrl,
                accent,
                description,
              })
              onOpenChange(false)
            }}
          >
            Save workspace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

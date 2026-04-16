"use client"

import { useState } from "react"
import { VideoCamera } from "@phosphor-icons/react"
import { toast } from "sonner"

import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"

export function CallInviteLauncher({
  conversationId,
}: {
  conversationId: string
}) {
  const [loading, setLoading] = useState(false)

  async function handleLaunch() {
    setLoading(true)

    try {
      const joinHref = await useAppStore
        .getState()
        .startConversationCall(conversationId)

      if (!joinHref) {
        return
      }

      toast.success("Call link added to the thread")
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : "Failed to start the call"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      size="icon-xs"
      variant="ghost"
      className="size-7"
      onClick={handleLaunch}
      disabled={loading}
      aria-label="Start call"
    >
      <VideoCamera className="size-3.5" />
    </Button>
  )
}

"use client"

import * as React from "react"
import { HoverCard as HoverCardPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function HoverCard({
  openDelay = 120,
  closeDelay = 80,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return (
    <HoverCardPrimitive.Root
      data-slot="hover-card"
      openDelay={openDelay}
      closeDelay={closeDelay}
      {...props}
    />
  )
}

function HoverCardTrigger({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return (
    <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  )
}

type HoverCardContentProps = React.ComponentProps<
  typeof HoverCardPrimitive.Content
> & {
  portalled?: boolean
}

function HoverCardContent({
  className,
  align = "center",
  collisionPadding = 16,
  portalled = true,
  sideOffset = 10,
  ...props
}: HoverCardContentProps) {
  const content = (
    <HoverCardPrimitive.Content
      data-slot="hover-card-content"
      align={align}
      collisionPadding={collisionPadding}
      sideOffset={sideOffset}
      className={cn(
        "z-50 flex w-72 max-w-[calc(100vw-2rem)] origin-(--radix-hover-card-content-transform-origin) flex-col gap-2.5 rounded-xl bg-popover p-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className
      )}
      {...props}
    />
  )

  return portalled ? (
    <HoverCardPrimitive.Portal>{content}</HoverCardPrimitive.Portal>
  ) : (
    content
  )
}

export { HoverCard, HoverCardContent, HoverCardTrigger }

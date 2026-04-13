"use client"

import { cn } from "@/lib/utils"

export function RichTextContent({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "tiptap break-words [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline [&_li]:ml-4 [&_ol]:list-decimal [&_p+p]:mt-2 [&_ul]:list-disc",
        className
      )}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

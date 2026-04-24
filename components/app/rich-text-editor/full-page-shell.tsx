"use client"

import {
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react"

import { cn } from "@/lib/utils"

import {
  FULL_PAGE_CANVAS_WIDTH_CLASSNAME,
  type FullPageCanvasWidth,
} from "./toolbar"

export const DEFAULT_FULL_PAGE_CANVAS_WIDTH: FullPageCanvasWidth = "narrow"
export const FULL_PAGE_CANVAS_WIDTH_STORAGE_KEY = "linear.document-canvas-width"
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect

export function normalizeFullPageCanvasWidth(
  value: string | null | undefined
): FullPageCanvasWidth {
  return value === "medium" || value === "wide" ? value : "narrow"
}

export function readStoredFullPageCanvasWidth(): FullPageCanvasWidth {
  if (typeof window === "undefined") {
    return DEFAULT_FULL_PAGE_CANVAS_WIDTH
  }

  return normalizeFullPageCanvasWidth(
    window.localStorage.getItem(FULL_PAGE_CANVAS_WIDTH_STORAGE_KEY)
  )
}

export function useFullPageCanvasWidthPreference(enabled: boolean) {
  const [fullPageCanvasWidth, setFullPageCanvasWidth] =
    useState<FullPageCanvasWidth>(DEFAULT_FULL_PAGE_CANVAS_WIDTH)

  useIsomorphicLayoutEffect(() => {
    if (!enabled) {
      return
    }

    const storedWidth = readStoredFullPageCanvasWidth()
    setFullPageCanvasWidth((current) =>
      current === storedWidth ? current : storedWidth
    )
  }, [enabled])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(
      FULL_PAGE_CANVAS_WIDTH_STORAGE_KEY,
      fullPageCanvasWidth
    )
  }, [enabled, fullPageCanvasWidth])

  return {
    fullPageCanvasWidth,
    setFullPageCanvasWidth,
  }
}

type FullPageRichTextShellProps = {
  canvasWidth: FullPageCanvasWidth
  children: ReactNode
  className?: string
  containerRef?: RefObject<HTMLDivElement | null>
  reserveToolbarSpace?: boolean
  toolbar?: ReactNode
}

export function FullPageRichTextShell({
  canvasWidth,
  children,
  className,
  containerRef,
  reserveToolbarSpace = false,
  toolbar,
}: FullPageRichTextShellProps) {
  const widthClassName = FULL_PAGE_CANVAS_WIDTH_CLASSNAME[canvasWidth]

  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col overflow-hidden",
        className
      )}
    >
      {toolbar ? (
        toolbar
      ) : reserveToolbarSpace ? (
        <div
          aria-hidden="true"
          className={cn(
            "mx-auto h-11 w-full shrink-0 px-6 py-2",
            widthClassName
          )}
        />
      ) : null}
      <div className="flex-1 overflow-y-auto">
        <div
          className={cn("relative mx-auto w-full px-6 pt-12 pb-4", widthClassName)}
          ref={containerRef}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

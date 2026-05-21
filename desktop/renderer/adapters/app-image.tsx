"use client"

/* eslint-disable @next/next/no-img-element */
import type { ImgHTMLAttributes } from "react"

type AppImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  fill?: boolean
  height?: number | string
  priority?: boolean
  src: string
  unoptimized?: boolean
  width?: number | string
}

export function AppImage({
  alt = "",
  fill,
  priority,
  unoptimized,
  style,
  ...props
}: AppImageProps) {
  void priority
  void unoptimized

  return (
    <img
      {...props}
      alt={alt}
      style={{
        ...(fill ? { height: "100%", width: "100%" } : null),
        ...style,
      }}
    />
  )
}

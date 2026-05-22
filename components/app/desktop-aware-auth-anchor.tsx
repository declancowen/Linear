"use client"

import {
  forwardRef,
  type AnchorHTMLAttributes,
  useSyncExternalStore,
} from "react"

import { buildAppDestination } from "@/lib/auth-routing"

type DesktopAwareAuthAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  desktopHref: string
  webHref: string
}

function subscribeToStaticElectronState() {
  return () => {}
}

function getElectronSnapshot() {
  return typeof window !== "undefined" && window.electronApp?.isElectron === true
}

function getServerElectronSnapshot() {
  return false
}

export const DesktopAwareAuthAnchor = forwardRef<
  HTMLAnchorElement,
  DesktopAwareAuthAnchorProps
>(function DesktopAwareAuthAnchor(
  { desktopHref, webHref, ...props },
  ref
) {
  const isElectron = useSyncExternalStore(
    subscribeToStaticElectronState,
    getElectronSnapshot,
    getServerElectronSnapshot
  )
  const href = isElectron ? buildAppDestination(desktopHref) : webHref

  return <a ref={ref} href={href} {...props} />
})

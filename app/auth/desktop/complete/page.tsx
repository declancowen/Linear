"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { completeDesktopAuthFromSearchParams } from "@/lib/browser/desktop-auth-complete"

export default function DesktopAuthCompletePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState("Completing sign-in...")

  useEffect(() => {
    let isMounted = true

    async function completeDesktopAuth() {
      const result = await completeDesktopAuthFromSearchParams(searchParams, {
        setDesktopAuthToken: (token) =>
          window.electronApp?.setDesktopAuthToken?.(token),
      })

      if (!isMounted) {
        return
      }

      if (result.kind === "authenticated") {
        router.replace(result.nextPath)
      } else {
        setMessage("Sign-in failed. Redirecting...")
        router.replace(result.href)
      }
    }

    void completeDesktopAuth()

    return () => {
      isMounted = false
    }
  }, [router, searchParams])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground">
      {message}
    </main>
  )
}

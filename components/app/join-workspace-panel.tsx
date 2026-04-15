"use client"

import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react"
import { SpinnerGap } from "@phosphor-icons/react"

import { OnboardingJoinCard } from "@/components/app/onboarding-join-card"
import { Input } from "@/components/ui/input"

const FULL_JOIN_CODE_LENGTH = 12

type JoinWorkspaceLookupResult = {
  team: {
    id: string
    joinCode: string
    name: string
    summary: string
  }
  workspace: {
    logoUrl: string
    name: string
  }
}

function normalizeJoinCodeInput(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, FULL_JOIN_CODE_LENGTH)
}

export function JoinWorkspacePanel({
  authenticated,
  initialCode = "",
  joinedTeamIds = [],
  loginHref = "/login",
  signupHref = "/signup",
}: {
  authenticated: boolean
  initialCode?: string
  joinedTeamIds?: string[]
  loginHref?: string
  signupHref?: string
}) {
  const [code, setCode] = useState(() => normalizeJoinCodeInput(initialCode))
  const deferredCode = useDeferredValue(code)
  const [lookupResult, setLookupResult] =
    useState<JoinWorkspaceLookupResult | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef(0)

  const handleLookup = useEffectEvent(async (nextCode: string) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setLookupError(null)

    try {
      const response = await fetch(
        `/api/teams/lookup?code=${encodeURIComponent(nextCode)}`
      )
      const payload = (await response.json().catch(() => null)) as
        | (JoinWorkspaceLookupResult & { error?: string })
        | null

      if (!response.ok || !payload?.team || !payload.workspace) {
        throw new Error(payload?.error ?? `No team matched ${nextCode}.`)
      }

      if (requestIdRef.current !== requestId) {
        return
      }

      setLookupResult(payload)
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return
      }

      setLookupResult(null)
      setLookupError(
        error instanceof Error ? error.message : "Unable to find that team"
      )
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  })

  useEffect(() => {
    const normalizedCode = normalizeJoinCodeInput(deferredCode)

    if (normalizedCode.length !== FULL_JOIN_CODE_LENGTH) {
      requestIdRef.current += 1
      setLoading(false)
      setLookupResult(null)
      setLookupError(null)
      return
    }

    if (lookupResult?.team.joinCode === normalizedCode) {
      return
    }

    const timeout = window.setTimeout(() => {
      void handleLookup(normalizedCode)
    }, 150)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [deferredCode, lookupResult?.team.joinCode])

  const matchedLookupResult =
    lookupResult?.team.joinCode === code ? lookupResult : null
  const remainingCharacters = FULL_JOIN_CODE_LENGTH - code.length
  const statusLabel =
    code.length === 0
      ? "Paste or type a 12-character team code."
      : code.length < FULL_JOIN_CODE_LENGTH
        ? `${remainingCharacters} more character${
            remainingCharacters === 1 ? "" : "s"
          }.`
        : lookupError
          ? null
          : matchedLookupResult
            ? "Team found."
            : "Looking up team…"
  const showSpinner =
    loading &&
    code.length === FULL_JOIN_CODE_LENGTH &&
    !lookupError &&
    matchedLookupResult === null
  const alreadyJoined =
    matchedLookupResult !== null &&
    joinedTeamIds.includes(matchedLookupResult.team.id)

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Input
          id="code"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          inputMode="text"
          maxLength={FULL_JOIN_CODE_LENGTH}
          placeholder="ENTER CODE"
          spellCheck={false}
          value={code}
          className="h-11 text-center text-sm tracking-[0.28em] uppercase"
          onChange={(event) => {
            const nextCode = normalizeJoinCodeInput(event.target.value)

            setCode(nextCode)
            setLookupError(null)

            if (lookupResult?.team.joinCode !== nextCode) {
              setLookupResult(null)
            }
          }}
        />
        <div className="flex min-h-5 items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            {showSpinner ? (
              <SpinnerGap className="size-3.5 animate-spin" />
            ) : null}
            {statusLabel ? <span>{statusLabel}</span> : null}
          </div>
          <span className="shrink-0">{code.length}/12</span>
        </div>
      </div>

      {lookupError ? (
        <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {lookupError}
        </div>
      ) : null}

      {matchedLookupResult ? (
        <OnboardingJoinCard
          authenticated={authenticated}
          alreadyJoined={alreadyJoined}
          joinCode={matchedLookupResult.team.joinCode}
          loginHref={loginHref}
          signupHref={signupHref}
          teamName={matchedLookupResult.team.name}
          teamSummary={matchedLookupResult.team.summary}
          workspaceLogo={matchedLookupResult.workspace.logoUrl}
          workspaceName={matchedLookupResult.workspace.name}
        />
      ) : null}
    </div>
  )
}

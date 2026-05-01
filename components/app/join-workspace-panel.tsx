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

function getJoinWorkspaceStatusLabel(input: {
  code: string
  lookupError: string | null
  matchedLookupResult: JoinWorkspaceLookupResult | null
}) {
  if (input.code.length === 0) {
    return "Paste or type a 12-character team code."
  }

  if (input.code.length < FULL_JOIN_CODE_LENGTH) {
    const remainingCharacters = FULL_JOIN_CODE_LENGTH - input.code.length

    return `${remainingCharacters} more character${
      remainingCharacters === 1 ? "" : "s"
    }.`
  }

  if (input.lookupError) {
    return null
  }

  return input.matchedLookupResult ? "Team found." : "Looking up team…"
}

function JoinCodeInput({
  code,
  lookupResult,
  onCodeChange,
  onLookupErrorChange,
  onLookupResultChange,
}: {
  code: string
  lookupResult: JoinWorkspaceLookupResult | null
  onCodeChange: (code: string) => void
  onLookupErrorChange: (error: string | null) => void
  onLookupResultChange: (result: JoinWorkspaceLookupResult | null) => void
}) {
  return (
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

        onCodeChange(nextCode)
        onLookupErrorChange(null)

        if (lookupResult?.team.joinCode !== nextCode) {
          onLookupResultChange(null)
        }
      }}
    />
  )
}

function JoinLookupStatus({
  code,
  showSpinner,
  statusLabel,
}: {
  code: string
  showSpinner: boolean
  statusLabel: string | null
}) {
  return (
    <div className="flex min-h-5 items-center justify-between gap-3 text-xs text-muted-foreground">
      <div className="flex min-w-0 items-center gap-2">
        {showSpinner ? <SpinnerGap className="size-3.5 animate-spin" /> : null}
        {statusLabel ? <span>{statusLabel}</span> : null}
      </div>
      <span className="shrink-0">{code.length}/12</span>
    </div>
  )
}

function JoinLookupError({ lookupError }: { lookupError: string | null }) {
  if (!lookupError) {
    return null
  }

  return (
    <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
      {lookupError}
    </div>
  )
}

function JoinLookupResultCard({
  alreadyJoined,
  authenticated,
  loginHref,
  matchedLookupResult,
  signupHref,
}: {
  alreadyJoined: boolean
  authenticated: boolean
  loginHref: string
  matchedLookupResult: JoinWorkspaceLookupResult | null
  signupHref: string
}) {
  if (!matchedLookupResult) {
    return null
  }

  return (
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
  )
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
  const statusLabel = getJoinWorkspaceStatusLabel({
    code,
    lookupError,
    matchedLookupResult,
  })
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
        <JoinCodeInput
          code={code}
          lookupResult={lookupResult}
          onCodeChange={setCode}
          onLookupErrorChange={setLookupError}
          onLookupResultChange={setLookupResult}
        />
        <JoinLookupStatus
          code={code}
          showSpinner={showSpinner}
          statusLabel={statusLabel}
        />
      </div>

      <JoinLookupError lookupError={lookupError} />
      <JoinLookupResultCard
        alreadyJoined={alreadyJoined}
        authenticated={authenticated}
        loginHref={loginHref}
        matchedLookupResult={matchedLookupResult}
        signupHref={signupHref}
      />
    </div>
  )
}

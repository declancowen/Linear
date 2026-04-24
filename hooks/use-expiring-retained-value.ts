"use client"

import { useEffect, useRef, useState } from "react"

type UseExpiringRetainedValueOptions<T> = {
  value: T | null
  retentionKey: string | null
  gracePeriodMs: number
}

export function useExpiringRetainedValue<T>({
  value,
  retentionKey,
  gracePeriodMs,
}: UseExpiringRetainedValueOptions<T>) {
  const [, forceRerender] = useState(0)
  const retainedValueRef = useRef<{
    retentionKey: string | null
    value: T | null
  }>({
    retentionKey: null,
    value: null,
  })
  const timeoutIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (timeoutIdRef.current !== null) {
      window.clearTimeout(timeoutIdRef.current)
      timeoutIdRef.current = null
    }

    if (value !== null) {
      retainedValueRef.current = {
        retentionKey,
        value,
      }
      return
    }

    if (retainedValueRef.current.retentionKey !== retentionKey) {
      retainedValueRef.current = {
        retentionKey,
        value: null,
      }
      return
    }

    if (retainedValueRef.current.value === null) {
      return
    }

    timeoutIdRef.current = window.setTimeout(() => {
      retainedValueRef.current = {
        retentionKey,
        value: null,
      }
      forceRerender((current) => current + 1)
      timeoutIdRef.current = null
    }, gracePeriodMs)

    return () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
    }
  }, [gracePeriodMs, retentionKey, value])

  return value ??
    (retainedValueRef.current.retentionKey === retentionKey
      ? retainedValueRef.current.value
      : null)
}

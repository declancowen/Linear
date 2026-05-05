import { vi } from "vitest"

export function createToastMockModule({
  error,
  success,
}: {
  error?: ReturnType<typeof vi.fn>
  success?: ReturnType<typeof vi.fn>
}) {
  return {
    toast: {
      ...(success ? { success } : {}),
      ...(error ? { error } : {}),
    },
  }
}

export function createMutableSetState<TState extends object>(state: TState) {
  return vi.fn((update: unknown) => {
    const patch = typeof update === "function" ? update(state as never) : update

    Object.assign(state, patch)
  })
}

export async function withLosAngelesFakeSystemTime<T>(
  callback: () => Promise<T>
) {
  const previousTimeZone = process.env.TZ
  process.env.TZ = "America/Los_Angeles"
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 3, 20, 23, 30))
  vi.resetModules()

  try {
    return await callback()
  } finally {
    if (previousTimeZone === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = previousTimeZone
    }
    vi.useRealTimers()
    vi.resetModules()
  }
}

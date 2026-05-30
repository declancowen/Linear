export function createSliceHarness<TState extends object, TSlice>(
  state: TState,
  createSlice: (args: {
    get: () => TState
    runtime: {
      syncInBackground(task: Promise<unknown> | null): void
    }
    set: (update: unknown) => void
  }) => TSlice
) {
  const backgroundTasks: Array<Promise<unknown> | null> = []
  const setState = (update: unknown) => {
    const patch = typeof update === "function" ? update(state as never) : update

    Object.assign(state, patch)
  }
  const slice = createSlice({
    get: () => state,
    runtime: {
      syncInBackground(task: Promise<unknown> | null) {
        backgroundTasks.push(task)
      },
    },
    set: setState,
  } as never)

  return { backgroundTasks, slice, state }
}

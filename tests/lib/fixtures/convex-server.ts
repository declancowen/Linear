export function createConvexServerCoreMock(
  mutation: (...args: unknown[]) => unknown
) {
  return {
    getConvexServerClient: () => ({
      mutation,
    }),
    withServerToken: <T extends Record<string, unknown>>(input: T) => input,
    runConvexRequestWithRetry: async (
      _label: string,
      request: () => Promise<unknown>
    ) => request(),
  }
}

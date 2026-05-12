import { expect, vi, type Mock } from "vitest"

export function createRouteAuthMockModule(
  requireSessionMock: Mock,
  requireAppContextMock: Mock
) {
  return {
    requireSession: requireSessionMock,
    requireAppContext: requireAppContextMock,
    requireConvexUser: vi.fn(),
  }
}

export function mockCollaborationRouteAuthContext({
  extraMocks = [],
  requireAppContextMock,
  requireSessionMock,
  logProviderErrorMock,
}: {
  extraMocks?: Mock[]
  requireAppContextMock: Mock
  requireSessionMock: Mock
  logProviderErrorMock: Mock
}) {
  requireSessionMock.mockReset()
  requireAppContextMock.mockReset()
  logProviderErrorMock.mockReset()

  for (const mock of extraMocks) {
    mock.mockReset()
  }

  process.env.COLLABORATION_TOKEN_SECRET = "test-collaboration-token-secret"
  process.env.NEXT_PUBLIC_PARTYKIT_URL = "https://partykit.example.com"

  requireSessionMock.mockResolvedValue({
    user: {
      id: "workos_1",
      email: "alex@example.com",
    },
    organizationId: "org_1",
  })
  requireAppContextMock.mockResolvedValue({
    ensuredUser: {
      userId: "user_1",
    },
  })
}

export function createJsonRouteRequest(
  url: string,
  method: string,
  body: unknown
) {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }) as never
}

export function createFormRouteRequest(
  url: string,
  entries: Record<string, string>
) {
  const formData = new FormData()

  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value)
  }

  return new Request(url, {
    method: "POST",
    body: formData,
  })
}

export function createRouteParams<TParams extends Record<string, string>>(
  params: TParams
) {
  return {
    params: Promise.resolve(params),
  }
}

export function createRouteHandlerInput<TParams extends Record<string, string>>(
  url: string,
  params: TParams,
  init?: RequestInit
) {
  return [new Request(url, init) as never, createRouteParams(params)] as const
}

export function createProviderErrorsMockModule(logProviderErrorMock: Mock) {
  return {
    getConvexErrorMessage: (error: unknown, fallback: string) =>
      error instanceof Error ? error.message : fallback,
    getWorkOSErrorMessage: (error: unknown, fallback: string) =>
      error instanceof Error ? error.message : fallback,
    logProviderError: logProviderErrorMock,
  }
}

export async function expectTypedJsonError(
  response: Response,
  status: number,
  message: string,
  code: string,
  logProviderErrorMock?: Mock
) {
  expect(response.status).toBe(status)
  await expect(response.json()).resolves.toEqual({
    error: message,
    message,
    code,
  })
  if (logProviderErrorMock) {
    expect(logProviderErrorMock).not.toHaveBeenCalled()
  }
}

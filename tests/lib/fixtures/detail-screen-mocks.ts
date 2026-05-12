import { vi } from "vitest"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/lib/realtime/feature-flags", () => ({
  isCollaborationEnabled: () => false,
  isScopedSyncEnabled: () => true,
}))

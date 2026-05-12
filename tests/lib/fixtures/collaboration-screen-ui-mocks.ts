import { vi } from "vitest"

vi.mock("@/components/app/collaboration-screens/shared-ui", async () =>
  (
    await import("@/tests/lib/fixtures/collaboration-screen-stubs")
  ).createCollaborationSharedUiStubModule()
)

vi.mock("@/components/ui/button", async () =>
  (await import("@/tests/lib/fixtures/component-stubs")).createButtonStubModule()
)

vi.mock("@/components/ui/scroll-area", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createScrollAreaStubModule()
)

vi.mock("@/components/ui/sheet", async () =>
  (await import("@/tests/lib/fixtures/component-stubs")).createSheetStubModule()
)

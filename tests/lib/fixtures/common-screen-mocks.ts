import { vi } from "vitest"

vi.mock("next/link", async () =>
  (await import("@/tests/lib/fixtures/component-stubs")).createNextLinkStubModule()
)

vi.mock("next/navigation", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createSearchParamsPushNavigationStubModule()
)

vi.mock("@/lib/browser/dialog-transitions", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createOpenManagedDialogStubModule()
)

vi.mock("@/components/ui/button", async () =>
  (await import("@/tests/lib/fixtures/component-stubs")).createButtonStubModule()
)

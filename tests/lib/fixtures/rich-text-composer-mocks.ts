import { vi } from "vitest"

vi.mock("@/components/app/rich-text-editor", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createRichTextEditorTextareaStubModule()
)

vi.mock("@/components/app/emoji-picker-popover", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createEmojiPickerPopoverStubModule()
)

vi.mock("@/components/app/shortcut-keys", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createShortcutKeysStubModule()
)

vi.mock("@/components/ui/button", async () =>
  (await import("@/tests/lib/fixtures/component-stubs")).createButtonStubModule()
)

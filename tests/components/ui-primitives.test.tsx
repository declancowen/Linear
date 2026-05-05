import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { SidebarMenuButton, SidebarProvider } from "@/components/ui/sidebar"
import { Chip } from "@/components/ui/template-primitives"
import { TooltipProvider } from "@/components/ui/tooltip"

beforeAll(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe("Chip", () => {
  it("renders all supported visual variants without changing button semantics", () => {
    const variants = [
      ["Default", undefined],
      ["Ghost", "ghost"],
      ["Accent", "accent"],
      ["Dashed", "dashed"],
    ] as const

    render(
      <>
        {variants.map(([label, variant]) => (
          <Chip key={label} variant={variant} muted={variant === "dashed"}>
            {label}
          </Chip>
        ))}
      </>
    )

    for (const [label] of variants) {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute(
        "type",
        "button"
      )
    }

    expect(screen.getByRole("button", { name: "Accent" })).toHaveClass(
      "bg-accent-bg"
    )
    expect(screen.getByRole("button", { name: "Dashed" })).toHaveClass(
      "border-dashed",
      "text-fg-3"
    )
  })
})

describe("ConfirmDialog", () => {
  it("confirms on Enter from dialog content and ignores guarded key targets", () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete document"
        description="This cannot be undone."
        onConfirm={onConfirm}
      />
    )

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    fireEvent.keyDown(screen.getByRole("button", { name: "Cancel" }), {
      key: "Enter",
    })
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("does not confirm from Enter while loading", () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        loading
        onOpenChange={vi.fn()}
        title="Archive workspace"
        description="Archiving is still running."
        confirmLabel="Archiving"
        onConfirm={onConfirm}
      />
    )

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" })

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Archiving" })).toBeDisabled()
  })
})

describe("SidebarMenuButton", () => {
  function renderSidebarButton(
    children: ReactNode,
    options: { open?: boolean } = {}
  ) {
    return render(
      <TooltipProvider>
        <SidebarProvider defaultOpen={options.open ?? true}>
          {children}
        </SidebarProvider>
      </TooltipProvider>
    )
  }

  it("renders a plain menu button with active, size, and variant state", () => {
    renderSidebarButton(
      <SidebarMenuButton isActive size="lg" variant="outline">
        Roadmap
      </SidebarMenuButton>
    )

    const button = screen.getByRole("button", { name: "Roadmap" })
    expect(button).toHaveAttribute("data-active", "true")
    expect(button).toHaveAttribute("data-size", "lg")
    expect(button).toHaveClass("bg-background")
  })

  it("renders slotted links and tooltip-backed buttons in the sidebar owner", () => {
    renderSidebarButton(
      <>
        <SidebarMenuButton asChild>
          <a href="#docs">Docs</a>
        </SidebarMenuButton>
        <SidebarMenuButton
          size="sm"
          tooltip={{ children: "Open inbox", className: "test-tooltip" }}
        >
          Inbox
        </SidebarMenuButton>
      </>,
      { open: false }
    )

    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "data-sidebar",
      "menu-button"
    )
    expect(screen.getByRole("button", { name: "Inbox" })).toHaveAttribute(
      "data-size",
      "sm"
    )
  })
})

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DocumentPresenceAvatarGroup } from "@/components/app/screens/document-ui"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe("DocumentPresenceAvatarGroup", () => {
  it("uses the smaller compact sizing in header contexts", () => {
    render(
      <DocumentPresenceAvatarGroup
        compact
        viewers={[
          {
            userId: "user_1",
            name: "Declan Cowen",
            avatarUrl: "",
            avatarImageUrl: "https://example.com/avatar.png",
            lastSeenAt: "2026-04-22T11:00:00.000Z",
          },
          {
            userId: "user_2",
            name: "Taylor Moss",
            avatarUrl: "",
            avatarImageUrl: undefined,
            lastSeenAt: "2026-04-22T11:01:00.000Z",
          },
          {
            userId: "user_3",
            name: "Sam Green",
            avatarUrl: "",
            avatarImageUrl: undefined,
            lastSeenAt: "2026-04-22T11:02:00.000Z",
          },
          {
            userId: "user_4",
            name: "Alex Reed",
            avatarUrl: "",
            avatarImageUrl: undefined,
            lastSeenAt: "2026-04-22T11:03:00.000Z",
          },
        ]}
      />
    )

    const avatars = document.querySelectorAll('[data-slot="avatar"]')
    expect(avatars).toHaveLength(3)

    for (const avatar of avatars) {
      expect(avatar.getAttribute("data-size")).toBe("default")
      expect(avatar.className).toContain("size-[18px]")
      expect(avatar.getAttribute("style")).toContain("width: 18px")
      expect(avatar.getAttribute("style")).toContain("height: 18px")
      expect(avatar.className).toContain("overflow-hidden")
    }

    const overflowCount = document.querySelector('[data-slot="avatar-group-count"]')
    expect(overflowCount?.className).toContain("size-[18px]")
    expect(overflowCount?.className).toContain("text-[8px]")
    expect(screen.getByLabelText(/also viewing:/i)).toBeInTheDocument()
  })

  it("deduplicates repeated viewers for the same user", () => {
    render(
      <DocumentPresenceAvatarGroup
        viewers={[
          {
            userId: "user_1",
            name: "Declan Cowen",
            avatarUrl: "",
            avatarImageUrl: "https://example.com/avatar.png",
            lastSeenAt: "2026-04-22T11:00:00.000Z",
          },
          {
            userId: "user_1",
            name: "Declan Cowen",
            avatarUrl: "",
            avatarImageUrl: "https://example.com/avatar.png",
            lastSeenAt: "2026-04-22T11:01:00.000Z",
          },
          {
            userId: "user_2",
            name: "Taylor Moss",
            avatarUrl: "",
            avatarImageUrl: undefined,
            lastSeenAt: "2026-04-22T11:02:00.000Z",
          },
        ]}
      />
    )

    const avatars = document.querySelectorAll('[data-slot="avatar"]')
    expect(avatars).toHaveLength(2)
  })
})

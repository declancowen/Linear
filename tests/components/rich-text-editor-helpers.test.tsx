import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { insertUploadedAttachment } from "@/components/app/rich-text-editor/attachment-insertion"
import { uploadRichTextEditorAttachment } from "@/components/app/rich-text-editor/attachment-upload-one"
import { uploadRichTextEditorFiles } from "@/components/app/rich-text-editor/attachment-uploads"
import { getCaretCoordinatesFromTextNode } from "@/components/app/rich-text-editor/caret-text-node"
import { resolveCollaborationCaretCoordinates } from "@/components/app/rich-text-editor/caret-position"
import { getCollapsedRangeCaretCoordinates } from "@/components/app/rich-text-editor/collapsed-range"
import {
  createMergedCollaborationAwarenessUser,
  forEachRemoteCollaborationAwarenessUser,
} from "@/components/app/rich-text-editor/collaboration-awareness-users"
import { getCollaborationAwarenessUser } from "@/components/app/rich-text-editor/collaboration-awareness-user"
import { createSerializedRelativePosition } from "@/components/app/rich-text-editor/collaboration-relative-position"
import {
  getUsableYSyncEditorState,
  hasLiveYSyncMarkerState,
} from "@/components/app/rich-text-editor/collaboration-y-sync-state"
import { handleRichTextMenuNavigationKeyDown } from "@/components/app/rich-text-editor/menu-navigation"
import { getTextNode } from "@/components/app/rich-text-editor/text-node"
import { getLocalTextblockBoundarySide } from "@/components/app/rich-text-editor/textblock-boundary"
import { getEditorMentionCounts } from "@/components/app/rich-text-editor/mention-counts"
import {
  areBlockPresenceMarkersEqual,
  areCollaborationCursorMarkersEqual,
  areCollaborationSelectionMarkersEqual,
  sortCollaborationMarkers,
} from "@/components/app/rich-text-editor/marker-comparison"
import { areArraysEqual } from "@/components/app/rich-text-editor/array-equality"
import {
  MentionMenu,
} from "@/components/app/rich-text-editor/menus"
import { assignMenuItemRef } from "@/components/app/rich-text-editor/menu-refs"

afterEach(() => {
  vi.restoreAllMocks()
})

function mockDocumentRange(rects: Array<Partial<DOMRect>>) {
  const range = {
    setStart: vi.fn(),
    setEnd: vi.fn(),
    setStartBefore: vi.fn(),
    setStartAfter: vi.fn(),
    setEndBefore: vi.fn(),
    setEndAfter: vi.fn(),
    collapse: vi.fn(),
    getClientRects: vi.fn(
      () =>
        rects.map((rect) => ({
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          width: 0,
          height: 0,
          ...rect,
        })) as never
    ),
    getBoundingClientRect: vi.fn(() => rects[0] ?? null),
  }

  vi.spyOn(document, "createRange").mockReturnValue(range as never)

  return range
}

function createEditorChain() {
  const chain = {
    focus: vi.fn(() => chain),
    insertContent: vi.fn(() => chain),
    run: vi.fn(() => true),
    setTextSelection: vi.fn(() => chain),
  }

  return chain
}

describe("rich text editor helpers", () => {
  it("compares marker arrays by shape and order", () => {
    expect(areArraysEqual([1, 2], [1, 2], Object.is)).toBe(true)
    expect(areArraysEqual([1], [1, 2], Object.is)).toBe(false)
    expect(
      areBlockPresenceMarkersEqual(
        [
          {
            blockId: "paragraph:0",
            top: 12,
            viewers: [
              { userId: "user_1", activeBlockId: "paragraph:0" } as never,
            ],
          },
        ],
        [
          {
            blockId: "paragraph:0",
            top: 12,
            viewers: [
              { userId: "user_1", activeBlockId: "paragraph:0" } as never,
            ],
          },
        ]
      )
    ).toBe(true)
    expect(
      areBlockPresenceMarkersEqual(
        [
          {
            blockId: "paragraph:0",
            top: 12,
            viewers: [
              { userId: "user_1", activeBlockId: "paragraph:0" } as never,
            ],
          },
        ],
        [
          {
            blockId: "paragraph:1",
            top: 12,
            viewers: [
              { userId: "user_1", activeBlockId: "paragraph:1" } as never,
            ],
          },
        ]
      )
    ).toBe(false)
    expect(
      areCollaborationSelectionMarkersEqual(
        [
          {
            key: "selection_1",
            color: "#123456",
            left: 1,
            top: 2,
            width: 3,
            height: 4,
          },
        ],
        [
          {
            key: "selection_1",
            color: "#123456",
            left: 1,
            top: 2,
            width: 3,
            height: 4,
          },
        ]
      )
    ).toBe(true)
    expect(
      areCollaborationCursorMarkersEqual(
        [
          {
            key: "cursor_1",
            name: "Alex",
            color: "#123456",
            left: 1,
            top: 2,
            height: 3,
          },
        ],
        [
          {
            key: "cursor_2",
            name: "Alex",
            color: "#123456",
            left: 1,
            top: 2,
            height: 3,
          },
        ]
      )
    ).toBe(false)
  })

  it("counts valid mention nodes by mention id", () => {
    const nodes = [
      { type: { name: "paragraph" }, attrs: {} },
      { type: { name: "mention" }, attrs: { id: "user_1" } },
      { type: { name: "mention" }, attrs: { id: "" } },
      { type: { name: "mention" }, attrs: { id: "user_1" } },
      { type: { name: "mention" }, attrs: { id: "user_2" } },
    ]
    const editor = {
      state: {
        doc: {
          descendants: vi.fn((visit: (node: (typeof nodes)[number]) => void) => {
            nodes.forEach(visit)
          }),
        },
      },
    }

    expect(getEditorMentionCounts(editor as never)).toEqual({
      user_1: 2,
      user_2: 1,
    })
  })

  it("normalizes collaboration awareness users and merged state", () => {
    expect(
      getCollaborationAwarenessUser({
        user: {
          userId: " user_1 ",
          sessionId: " session_1 ",
          name: " Alex ",
          color: "#123456",
        },
      })
    ).toEqual({
      userId: "user_1",
      sessionId: "session_1",
      name: "Alex",
      color: "#123456",
    })
    expect(getCollaborationAwarenessUser({ userId: "", sessionId: "s" })).toBeNull()

    const awareness = {
      getLocalState: vi.fn(),
      setLocalStateField: vi.fn(),
    }
    const collaboration = {
      binding: {
        provider: {
          awareness,
        },
      },
      localUser: {
        userId: "user_1",
        sessionId: "session_1",
        name: "Alex",
        color: "#abcdef",
      },
    }
    const merged = createMergedCollaborationAwarenessUser(
      collaboration as never,
      {
        color: "#111111",
        relativeCursor: {
          anchor: { type: "cursor" },
          head: { type: "cursor" },
        },
      },
      {
        name: "Alex Updated",
      }
    )

    expect(merged).toMatchObject({
      userId: "user_1",
      sessionId: "session_1",
      name: "Alex Updated",
      color: "#111111",
      relativeCursor: {
        anchor: { type: "cursor" },
        head: { type: "cursor" },
      },
    })
  })

  it("visits only remote collaboration awareness users", () => {
    const visits: Array<{ clientId: number; userId: string }> = []
    const awareness = {
      getLocalState: vi.fn(() => ({
        user: {
          userId: "user_1",
          sessionId: "session_local",
          name: "Alex",
          color: "#111111",
        },
      })),
      getStates: vi.fn(
        () =>
          new Map<number, unknown>([
            [
              1,
              {
                user: {
                  userId: "user_1",
                  sessionId: "session_local",
                  name: "Alex",
                  color: "#111111",
                },
              },
            ],
            [
              2,
              {
                user: {
                  userId: "user_2",
                  sessionId: "session_remote",
                  name: "Sam",
                  color: "#222222",
                },
              },
            ],
            [
              3,
              {
                user: {
                  userId: "user_3",
                  sessionId: "session_presence",
                  name: "Jamie",
                  color: "#333333",
                },
              },
            ],
            [4, {}],
          ])
      ),
    }

    forEachRemoteCollaborationAwarenessUser(
      {
        collaboration: {
          binding: {
            provider: {
              awareness,
            },
          },
          localUser: {
            sessionId: "fallback_session",
          },
        } as never,
        currentPresenceUserId: "user_3",
      },
      (_value, clientId, user) => {
        visits.push({
          clientId,
          userId: user.userId,
        })
      }
    )

    expect(visits).toEqual([
      {
        clientId: 2,
        userId: "user_2",
      },
    ])
  })

  it("handles Yjs and marker state fallbacks", () => {
    const editor = {
      state: {
        doc: {
          content: {
            size: 10,
          },
        },
      },
    }

    expect(createSerializedRelativePosition(editor as never, 4)).toBeNull()
    expect(getUsableYSyncEditorState(editor as never)).toBeNull()
    expect(hasLiveYSyncMarkerState(undefined)).toBe(false)
    expect(
      hasLiveYSyncMarkerState({
        doc: {},
        type: {},
        binding: {
          mapping: new Map(),
        },
      } as never)
    ).toBe(true)
    expect(
      hasLiveYSyncMarkerState({
        doc: {},
        type: {},
        binding: {
          mapping: new Map(),
        },
        snapshot: {},
      } as never)
    ).toBe(false)
  })

  it("inserts uploaded attachments as images or links", () => {
    const imageChain = createEditorChain()
    const imageEditor = {
      chain: () => imageChain,
      state: {
        doc: {
          content: {
            size: 5,
          },
        },
      },
    }

    insertUploadedAttachment({
      currentEditor: imageEditor as never,
      file: new File(["image"], "image.png", { type: "image/png" }),
      uploaded: {
        fileName: "image.png",
        fileUrl: "https://example.com/image.png",
      } as never,
      position: 99,
    })

    expect(imageChain.setTextSelection).toHaveBeenCalledWith(5)
    expect(imageChain.insertContent).toHaveBeenCalledWith([
      {
        type: "image",
        attrs: {
          src: "https://example.com/image.png",
          alt: "image.png",
          title: "image.png",
        },
      },
      {
        type: "paragraph",
      },
    ])

    const linkChain = createEditorChain()
    const linkEditor = {
      chain: () => linkChain,
      state: {
        doc: {
          content: {
            size: 5,
          },
        },
      },
    }

    insertUploadedAttachment({
      currentEditor: linkEditor as never,
      file: new File(["file"], "spec.pdf", { type: "application/pdf" }),
      uploaded: {
        fileName: "spec <one>.pdf",
        fileUrl: "https://example.com/spec?x=<bad>",
      } as never,
    })

    expect(linkChain.insertContent).toHaveBeenCalledWith(
      '<p><a href="https://example.com/spec?x=&lt;bad&gt;" target="_blank" rel="noreferrer">spec &lt;one&gt;.pdf</a></p>'
    )

    const emptyChain = createEditorChain()
    insertUploadedAttachment({
      currentEditor: {
        chain: () => emptyChain,
        state: {
          doc: {
            content: {
              size: 5,
            },
          },
        },
      } as never,
      file: new File(["file"], "spec.pdf", { type: "application/pdf" }),
      uploaded: {
        fileName: "spec.pdf",
        fileUrl: "",
      } as never,
    })
    expect(emptyChain.insertContent).not.toHaveBeenCalled()
  })

  it("resolves text nodes and caret coordinates from DOM ranges", () => {
    const container = document.createElement("div")
    container.innerHTML = "<span>Hello</span><span>world</span>"
    const firstText = container.querySelector("span")?.firstChild as Text

    expect(getTextNode(container, "first")?.data).toBe("Hello")
    expect(getTextNode(container, "last")?.data).toBe("world")
    expect(getTextNode(firstText, "first")).toBe(firstText)
    expect(getTextNode(null, "first")).toBeNull()

    mockDocumentRange([
      {
        left: 4,
        right: 8,
        top: 10,
        bottom: 20,
      },
    ])

    expect(
      getCaretCoordinatesFromTextNode({
        textNode: firstText,
        offset: 2,
      })
    ).toEqual({
      left: 8,
      top: 10,
      bottom: 20,
    })
  })

  it("resolves collapsed range and local boundary caret positions", () => {
    const textNode = document.createTextNode("Hello")
    document.body.append(textNode)
    mockDocumentRange([
      {
        left: 3,
        top: 4,
        bottom: 9,
      },
    ])

    const baseEditor = {
      view: {
        coordsAtPos: vi.fn(() => ({
          left: 1,
          top: 2,
          bottom: 3,
        })),
        domAtPos: vi.fn(() => ({
          node: textNode,
          offset: 1,
        })),
      },
      state: {
        doc: {
          content: {
            size: 10,
          },
          resolve: vi.fn((position: number) => ({
            parent: {
              isTextblock: true,
              content: {
                size: 10,
              },
            },
            parentOffset: position,
          })),
        },
      },
    }

    expect(getCollapsedRangeCaretCoordinates(baseEditor as never, 1)).toEqual({
      left: 3,
      top: 4,
      bottom: 9,
    })
    expect(getLocalTextblockBoundarySide(baseEditor as never, 0)).toBe("after")
    expect(getLocalTextblockBoundarySide(baseEditor as never, 10)).toBe("before")
    expect(getLocalTextblockBoundarySide(baseEditor as never, 5)).toBeNull()
    expect(resolveCollaborationCaretCoordinates(baseEditor as never, 0)).toEqual({
      left: 0,
      top: 4,
      bottom: 9,
    })
    expect(resolveCollaborationCaretCoordinates(baseEditor as never, 5)).toEqual({
      left: 3,
      top: 4,
      bottom: 9,
    })
  })

  it("uploads editor attachments one file at a time", async () => {
    const firstChain = createEditorChain()
    const secondChain = createEditorChain()
    const setUploadingAttachment = vi.fn()
    const uploadAttachment = vi
      .fn()
      .mockResolvedValueOnce({
        fileName: "image.png",
        fileUrl: "https://example.com/image.png",
      })
      .mockResolvedValueOnce(null)

    await uploadRichTextEditorAttachment({
      currentEditor: {
        chain: () => firstChain,
        state: {
          doc: {
            content: {
              size: 5,
            },
          },
        },
      } as never,
      file: new File(["image"], "image.png", { type: "image/png" }),
      position: 2,
      setUploadingAttachment,
      uploadAttachment,
    })
    await uploadRichTextEditorAttachment({
      currentEditor: {
        chain: () => secondChain,
        state: {
          doc: {
            content: {
              size: 5,
            },
          },
        },
      } as never,
      file: null,
      setUploadingAttachment,
      uploadAttachment,
    })

    expect(setUploadingAttachment).toHaveBeenNthCalledWith(1, true)
    expect(setUploadingAttachment).toHaveBeenNthCalledWith(2, false)
    expect(firstChain.insertContent).toHaveBeenCalled()
    expect(secondChain.insertContent).not.toHaveBeenCalled()

    await uploadRichTextEditorFiles({
      currentEditor: {
        chain: () => createEditorChain(),
        state: {
          doc: {
            content: {
              size: 5,
            },
          },
        },
      } as never,
      files: [
        new File(["one"], "one.txt", { type: "text/plain" }),
        new File(["two"], "two.txt", { type: "text/plain" }),
      ],
      position: 4,
      setUploadingAttachment,
      uploadAttachment,
    })

    expect(uploadAttachment).toHaveBeenCalledTimes(3)
  })

  it("sorts collaboration markers and handles menu navigation keys", () => {
    expect(
      sortCollaborationMarkers([
        { key: "b", left: 5, top: 2 },
        { key: "a", left: 1, top: 2 },
        { key: "c", left: 1, top: 1 },
      ] as never)
    ).toEqual([
      { key: "c", left: 1, top: 1 },
      { key: "a", left: 1, top: 2 },
      { key: "b", left: 5, top: 2 },
    ])

    const setIndex = vi.fn((update: (current: number) => number) => update(1))
    const preventDefault = vi.fn()
    const onEscape = vi.fn()
    const onEnter = vi.fn(() => true)

    expect(
      handleRichTextMenuNavigationKeyDown({
        event: { key: "ArrowDown", preventDefault } as never,
        maxIndex: 2,
        onEnter,
        onEscape,
        setIndex: setIndex as never,
      })
    ).toBe(true)
    expect(preventDefault).toHaveBeenCalled()
    expect(setIndex).toHaveReturnedWith(2)

    expect(
      handleRichTextMenuNavigationKeyDown({
        event: { key: "Escape", preventDefault } as never,
        maxIndex: 2,
        onEnter,
        onEscape,
        setIndex: setIndex as never,
      })
    ).toBe(true)
    expect(onEscape).toHaveBeenCalled()

    expect(
      handleRichTextMenuNavigationKeyDown({
        event: { key: "Enter", preventDefault } as never,
        maxIndex: 2,
        onEnter,
        onEscape,
        setIndex: setIndex as never,
      })
    ).toBe(true)
    expect(onEnter).toHaveBeenCalled()

    expect(
      handleRichTextMenuNavigationKeyDown({
        event: { key: "Tab", preventDefault } as never,
        maxIndex: 2,
        onEnter,
        onEscape,
        setIndex: setIndex as never,
      })
    ).toBeNull()
  })

  it("assigns active menu item refs by index", () => {
    const itemRefs = {
      current: [] as Array<HTMLDivElement | null>,
    }
    const node = document.createElement("div")

    assignMenuItemRef(itemRefs, 2, node)
    expect(itemRefs.current[2]).toBe(node)

    assignMenuItemRef(itemRefs, 2, null)
    expect(itemRefs.current[2]).toBeNull()
  })

  it("renders mention candidates with active item styling", () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    })

    try {
      render(
        <MentionMenu
          activeIndex={1}
          candidates={[
            {
              id: "user_1",
              name: "Alex",
              handle: "alex",
              avatarImageUrl: null,
              avatarUrl: "",
              title: "Founder",
            },
            {
              id: "user_2",
              name: "Maya",
              handle: "maya",
              avatarImageUrl: "https://example.com/maya.png",
              avatarUrl: "",
              title: "Engineer",
            },
          ]}
          containerWidth={360}
          editor={{} as never}
          state={{
            bottom: 40,
            from: 1,
            left: 12,
            query: "ma",
            to: 3,
            top: 80,
          }}
          onComplete={vi.fn()}
        />
      )

      expect(screen.getByText("Alex")).toBeInTheDocument()
      expect(screen.getByText("Maya")).toBeInTheDocument()
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      })
    }
  })
})

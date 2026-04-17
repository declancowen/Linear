# Review: Document Mention Navigation And Parsing

## Project context (captured on Turn 1 — not re-detected on subsequent turns)

| Field | Value |
|-------|-------|
| **Repository** | `Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `codex/local-changes-2026-04-17` |
| **Repo type** | `single repo` |
| **Stack** | `Next.js App Router / Convex / TypeScript` |
| **Packages affected** | `n/a` |
| **OS** | `Darwin 25.4.0` |
| **Package manager** | `pnpm 10.32.0` |
| **Node** | `v25.8.0` |
| **Python** | `n/a` |

## Scope (cumulative — updated each turn as new files are touched)

Files and areas reviewed across all turns:
- `components/app/screens/document-detail-screen.tsx` — pending mention exit protection, navigation interception, pending mention batching
- `lib/content/rich-text-mentions.ts` — mention extraction and fallback parsing

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-17 19:10:46 BST` |
| **Last reviewed** | `2026-04-17 19:26:52 BST` |
| **Total turns** | `2` |
| **Open findings** | `0` |
| **Resolved findings** | `1` |
| **Accepted findings** | `0` |

---

## Turn 2 — 2026-04-17 19:26:52 BST

| Field | Value |
|-------|-------|
| **Commit** | `db08913` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Closed `F1-01`. Pending mention exit protection now intercepts history navigation as well as anchor clicks and unloads, and the document mention batching logic now uses content deltas against the document’s baseline state so delete/reinsert cycles do not overcount mentions. The regex fallback was also hardened for multiline and unquoted attributes.

| Status | Count |
|--------|-------|
| New findings | 0 |
| Resolved during Turn 2 | 1 |
| Carried from Turn 1 | 0 |
| Accepted | 0 |

### Resolved during Turn 2

#### F1-01 ~~[BUG] Medium~~ → RESOLVED — Pending mention exit protection did not cover browser Back/Forward navigation
**How it was fixed:** [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:284) now keeps the current route state and restores it when a history transition is attempted while pending mention notifications exist, routing the exit through the same confirmation dialog used for guarded link navigation. The dialog’s completion path now supports both href-based exits and history exits.
**Verified:** Added coverage in [document-detail-screen.test.tsx](../tests/components/document-detail-screen.test.tsx:1), then ran:
- `pnpm test -- tests/convex/workspace-team-handlers.test.ts tests/lib/content/rich-text-mentions.test.ts tests/components/document-detail-screen.test.tsx`
- `pnpm exec eslint convex/app/workspace_team_handlers.ts components/app/screens/document-detail-screen.tsx lib/content/rich-text-mentions.ts tests/convex/workspace-team-handlers.test.ts tests/lib/content/rich-text-mentions.test.ts tests/components/document-detail-screen.test.tsx --max-warnings 0`
- `git diff --check`

### Remaining notes classified

- The broad anchor-click interception in [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:296) remains intentional while pending mention notifications exist.
- The repeated rich-text mention parsing on every content change is still a performance watchpoint rather than a demonstrated bug. The current implementation now derives pending mention counts from the live content delta, so debouncing that parse would risk stale notification state.
- The former insertion-based pending-mention count inaccuracy is now fixed in [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:249) by comparing current mention counts against a per-document baseline.
- The `attributeName` regex fragility and the quoted-attribute-only fallback limitation were both tightened in [rich-text-mentions.ts](../lib/content/rich-text-mentions.ts:9), with extra coverage in [rich-text-mentions.test.ts](../tests/lib/content/rich-text-mentions.test.ts:1).

## Turn 1 — 2026-04-17 19:10:46 BST

| Field | Value |
|-------|-------|
| **Commit** | `db08913` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Review of the latest provider notes found one real client-side issue in the pending-mention guard: it intercepts anchor clicks and full-page unloads, but it still allows SPA history navigation to bypass the confirmation dialog and silently discard the queued mention batch. The remaining notes in this area are either intentional behavior, low-priority performance watchpoints, or acceptable parser tradeoffs rather than active correctness bugs.

| Status | Count |
|--------|-------|
| New findings | 1 |
| Resolved during Turn 1 | 0 |
| Carried from previous turns | 0 |
| Accepted | 0 |

### Findings

#### F1-01 [BUG] Medium — Pending mention exit protection does not cover browser Back/Forward navigation
**Where:** [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:260)

**What’s wrong:** The current guard only uses `beforeunload` plus a capture-phase document click interceptor. That covers full-page unloads and same-origin anchor clicks, but it does not intercept SPA history transitions such as browser Back/Forward gestures or other programmatic route changes that do not originate from an `<a>` click.

**Why it matters:** In those paths the document screen can unmount while `pendingMentionCounts` still holds unsent mention notifications, and the batch is lost without any confirmation dialog.

**Root cause:** The guard is attached at the DOM click layer instead of the navigation layer, so it only sees one class of in-app navigation.

**What to change:** Add a navigation-layer guard for history transitions and programmatic route changes while `hasPendingMentionNotifications` is true. In App Router terms that likely means intercepting Back/Forward separately and routing all guarded exits through the same `pendingExitHref` / confirmation-dialog path.

### Remaining notes classified

- The broad anchor-click interception in [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:277) is intentional. It is aggressive, but it is the mechanism currently used to guard in-app link navigation while pending mentions exist.
- The repeated HTML parsing in `activePendingMentionEntries` is a performance watchpoint, not a correctness bug in the current code.
- The pending-mention count being insertion-event based rather than fully document-state based is a minor UX inaccuracy on mention delete/reinsert cycles, not a blocking bug.
- The unescaped `attributeName` in [rich-text-mentions.ts](../lib/content/rich-text-mentions.ts:9) is not an active issue because all current callers use hardcoded safe attribute names.
- The regex fallback limitations in [rich-text-mentions.ts](../lib/content/rich-text-mentions.ts:17) are acceptable tradeoffs for the current server-side fallback path.

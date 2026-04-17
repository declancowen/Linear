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
- `app/api/documents/[documentId]/mentions/route.ts` — document mention notification route contract
- `components/app/screens/document-detail-screen.tsx` — pending mention exit protection, navigation interception, pending mention batching
- `components/app/rich-text-editor.tsx` — editor-driven mention count synchronization
- `convex/app/document_handlers.ts` — server-side document mention notification validation
- `lib/content/document-mention-queue.ts` — reducer-backed pending mention queue semantics
- `lib/content/rich-text-mentions.ts` — mention extraction and fallback parsing
- `lib/server/convex/documents.ts` — server wrapper for document mention notification mutation

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-17 19:10:46 BST` |
| **Last reviewed** | `2026-04-17 20:44:55 BST` |
| **Total turns** | `7` |
| **Open findings** | `0` |
| **Resolved findings** | `5` |
| **Accepted findings** | `0` |

---

## Turn 7 — 2026-04-17 20:44:55 BST

| Field | Value |
|-------|-------|
| **Commit** | `7c146f2` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Closed the follow-up contract gap in the server wrapper. When persisted mention validation rejects stale queued mention counts, the documents server wrapper now maps that domain error to a typed client-correctable response instead of falling through to an unmapped 500.

| Status | Count |
|--------|-------|
| New findings | 0 |
| Resolved during Turn 7 | 1 |
| Carried from Turn 6 | 0 |
| Accepted | 0 |

### Resolved during Turn 7

#### F7-01 ~~[BUG] Medium~~ → RESOLVED — Stale mention-count validation was not mapped to a typed client error
**How it was fixed:** [DOCUMENT_MENTION_NOTIFICATION_ERROR_MAPPINGS](../lib/server/convex/documents.ts:49) now maps `"One or more mentioned users are not present in the document"` to `409 DOCUMENT_MENTION_STATE_STALE`, so [sendDocumentMentionNotificationsServer](../lib/server/convex/documents.ts:313) returns a typed application error for a client-correctable mention-state mismatch.

**Verified:** Added regression coverage in [convex-documents.test.ts](../tests/lib/server/convex-documents.test.ts:1), then ran:
- `pnpm test -- tests/convex/workspace-team-handlers.test.ts tests/lib/server/convex-documents.test.ts`
- `pnpm exec eslint convex/app/workspace_team_handlers.ts lib/server/convex/documents.ts tests/convex/workspace-team-handlers.test.ts tests/lib/server/convex-documents.test.ts --max-warnings 0`

### Remaining notes classified

- The server-side mention validation does currently rely on the regex fallback path in [rich-text-mentions.ts](../lib/content/rich-text-mentions.ts:58) under the Convex runtime; that is acceptable as long as mention markup changes keep both the DOM and regex extractors in sync.
- Skipping self-mention validation remains intentional because self-mentions are discarded during delivery.
- The broad same-origin anchor interception in [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:294) still reads as intentional while pending mention notifications exist.
- Mention counting on editor `onUpdate` remains a performance watchpoint for very large documents, not an active correctness bug from this review pass.

## Turn 6 — 2026-04-17 20:34:22 BST

| Field | Value |
|-------|-------|
| **Commit** | `301e0fe` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Closed `F5-01`. Document mention notifications now validate requested recipients and counts against persisted document mentions on the server, and the document screen flushes queued rich-text persistence before sending so valid pending mentions are saved before the server performs that check.

| Status | Count |
|--------|-------|
| New findings | 0 |
| Resolved during Turn 6 | 1 |
| Carried from Turn 5 | 1 |
| Accepted | 0 |

### Resolved during Turn 6

#### F5-01 ~~[BUG] High~~ → RESOLVED — Document mention notifications still trust client-supplied recipients and counts
**How it was fixed:** [sendDocumentMentionNotificationsHandler](../convex/app/document_handlers.ts:205) now parses the persisted document content with [extractRichTextMentionCounts](../lib/content/rich-text-mentions.ts:58) and rejects any requested mention recipient/count that is not backed by the saved document. On the client side, [DocumentDetailScreen](../components/app/screens/document-detail-screen.tsx:468) now flushes queued document sync through the store runtime before calling the mention-notification mutation, so the server validates against up-to-date persisted content rather than a stale debounced save.

**Verified:** Added regression coverage in [document-handlers.test.ts](../tests/convex/document-handlers.test.ts:1) and [document-detail-screen.test.tsx](../tests/components/document-detail-screen.test.tsx:1), then ran:
- `pnpm test -- tests/convex/document-handlers.test.ts tests/convex/workspace-team-handlers.test.ts tests/components/document-detail-screen.test.tsx`
- `pnpm exec eslint convex/app/document_handlers.ts convex/app/conversations.ts convex/app/workspace_team_handlers.ts lib/store/app-store-internal/runtime.ts lib/store/app-store-internal/types.ts lib/store/app-store-internal/slices/work-shared.ts lib/store/app-store-internal/slices/work-document-actions.ts components/app/screens/document-detail-screen.tsx tests/convex/document-handlers.test.ts tests/convex/workspace-team-handlers.test.ts tests/components/document-detail-screen.test.tsx --max-warnings 0`

### Remaining notes classified

- The old pending-mention queue double-count note is stale on this branch.
- The old HTML-parse-on-every-keystroke note is stale.
- The broad same-origin anchor interception in [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:294) still reads as intentional while pending mention notifications exist.
- Mention counting on editor `onUpdate` remains a performance watchpoint for very large documents, not an active correctness bug from this review pass.

## Turn 5 — 2026-04-17 20:24:45 BST

| Field | Value |
|-------|-------|
| **Commit** | `301e0fe` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Re-review of the latest provider notes found one new live server-side integrity bug in the current branch. The pending-mention queue on the client is now much more stable, but the server mutation still trusts client-supplied mention recipients and counts instead of validating them against document content before creating notifications and emails.

| Status | Count |
|--------|-------|
| New findings | 1 |
| Resolved during Turn 5 | 0 |
| Carried from Turn 4 | 0 |
| Accepted | 0 |

### Findings

#### F5-01 [BUG] High — Document mention notifications still trust client-supplied recipients and counts
**Where:** [document_handlers.ts](../convex/app/document_handlers.ts:205), [route.ts](../app/api/documents/%5BdocumentId%5D/mentions/route.ts:56), [documents.ts](../lib/server/convex/documents.ts:310)

**What’s wrong:** `sendDocumentMentionNotificationsHandler()` normalizes `args.mentions`, rejects users outside the document audience, and then inserts notifications/emails directly from that client-supplied list. It never derives or validates the recipients against the stored document content. Any user with edit access can therefore submit arbitrary audience user ids and counts and cause false “mentioned you” notifications and emails.

**Why it matters:** This is effectively notification spoofing/spam from an otherwise authorized editor. The recent client-side queue fixes improve correctness for normal UI use, but they do not provide a server-side security boundary. The route can still be called with crafted payloads.

**Root cause:** Mention delivery is modeled as “the client tells the server who was mentioned,” while the server only verifies that each target is a valid document audience member. There is no final source-of-truth check against document content before the side effect is persisted.

**What to change:** Validate or derive mention recipients from document content on the server before inserting notifications. The strongest version is to derive mention counts from the stored/sanitized document content and ignore `args.mentions` as authority. Because document saves are queued with a debounce in the client runtime, that fix should likely be paired with an explicit content flush before sending mention notifications, or with passing the current sanitized content through the same server mutation and validating against that sanitized content there.

### Remaining notes classified

- The old pending-mention queue double-count note is stale on this branch. [document-mention-queue.ts](../lib/content/document-mention-queue.ts:1) no longer increments counts separately from the editor sync.
- The old HTML-parse-on-every-keystroke note is stale. The queue is now synchronized from editor mention counts rather than reparsing document HTML on each render.
- The broad same-origin anchor interception in [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:292) still reads as intentional while pending mention notifications exist.
- The current mention-count extraction on editor `onUpdate` is still a performance watchpoint for very large documents, but it is not a correctness bug from this review pass.

## Turn 4 — 2026-04-17 20:08:07 BST

| Field | Value |
|-------|-------|
| **Commit** | `85a3836` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Closed the follow-up queue bug. Mention counts are authoritative from editor count sync now, so insertions are no longer double-counted and local paste/undo/import-style count increases are still captured for notification sending without relying on mention-selection callbacks.

| Status | Count |
|--------|-------|
| New findings | 1 |
| Resolved during Turn 4 | 1 |
| Carried from Turn 3 | 0 |
| Accepted | 0 |

### Findings

#### F4-01 ~~[BUG] Medium~~ → RESOLVED — Pending mention queue could double-count inserts and miss local count-only mention changes
**Where:** [document-mention-queue.ts](../lib/content/document-mention-queue.ts:1), [rich-text-editor.tsx](../components/app/rich-text-editor.tsx:79), [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:292)

**What was wrong:** The previous reducer updated `currentCounts` in both `sync-counts` and `track-user`, so a normal mention insert could be inflated by `+1` before the next content sync. At the same time, the queue only considered explicitly tracked users, so local mention-count changes that did not go through `onMentionInserted` could be skipped entirely.

**How it was fixed:** `sync-counts` is now the only source of truth for mention counts. It can selectively auto-track local count increases while ignoring configured user ids such as the current user. [rich-text-editor.tsx](../components/app/rich-text-editor.tsx:79) now labels mention-count syncs as `initial`, `local`, or `external`, and [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:292) only auto-tracks local increases for notification-eligible mentions. The old `track-user` increment path is gone.

**Verified:** Updated [document-mention-queue.test.ts](../tests/lib/content/document-mention-queue.test.ts:1) and [document-detail-screen.test.tsx](../tests/components/document-detail-screen.test.tsx:1), then ran:
- `pnpm test -- tests/convex/workspace-team-handlers.test.ts tests/components/document-detail-screen.test.tsx tests/lib/content/document-mention-queue.test.ts`
- `pnpm exec eslint convex/app/workspace_team_handlers.ts components/app/screens/document-detail-screen.tsx components/app/rich-text-editor.tsx lib/content/document-mention-queue.ts tests/convex/workspace-team-handlers.test.ts tests/components/document-detail-screen.test.tsx tests/lib/content/document-mention-queue.test.ts --max-warnings 0`

### Remaining notes classified

- The old test-mock ordering note is stale. [document-detail-screen.test.tsx](../tests/components/document-detail-screen.test.tsx:49) now models the real editor behavior through `onMentionCountsChange` rather than relying on `onMentionInserted`.
- The old `activePendingMentionEntries` HTML-parsing note is stale. The pending queue no longer reparses document HTML on every keystroke.
- The inline `onMentionCountsChange` callback note is also stale on the current branch. [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:292) now passes a stable callback.

## Turn 3 — 2026-04-17 19:53:09 BST

| Field | Value |
|-------|-------|
| **Commit** | `beca264` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Closed the remaining live document-mention issue. The pending mention bar is now driven by editor mention counts plus a reducer-backed queue, which removes the repeated HTML parsing from the hot path, makes delete/self-mention behavior deterministic, and preserves mentions added while an earlier notification batch is still sending.

| Status | Count |
|--------|-------|
| New findings | 1 |
| Resolved during Turn 3 | 1 |
| Carried from Turn 2 | 0 |
| Accepted | 0 |

### Findings

#### F3-01 ~~[BUG] High~~ → RESOLVED — Newly added mentions could be dropped when a previous notification batch finished sending
**Where:** [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:468), [rich-text-editor.tsx](../components/app/rich-text-editor.tsx:79)

**What was wrong:** The old queue logic captured `activePendingMentionEntries` and `currentMentionCounts` from the render that initiated the send. When the request resolved, it cleared the whole pending batch using that stale snapshot. Any mention inserted while the request was in flight could therefore disappear from the queue without ever being sent. The same path also reparsed full HTML content on every keystroke, which made the pending-notification bar laggy and flickery under mention insert/delete churn.

**How it was fixed:** [document-mention-queue.ts](../lib/content/document-mention-queue.ts:1) now owns the pending mention state as a pure reducer with explicit actions for document reset, count sync, tracking inserted users, clearing, and marking only the submitted batch as sent. [rich-text-editor.tsx](../components/app/rich-text-editor.tsx:79) now emits mention counts directly from the editor document, so [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:97) no longer reparses the whole HTML document on every content update. Self-mentions are still ignored at the tracking boundary, deletions immediately prune queued users, and later mentions survive an earlier send.

**Verified:** Added regression coverage in [document-detail-screen.test.tsx](../tests/components/document-detail-screen.test.tsx:1) and [document-mention-queue.test.ts](../tests/lib/content/document-mention-queue.test.ts:1), then ran:
- `pnpm test -- tests/components/document-detail-screen.test.tsx tests/lib/content/document-mention-queue.test.ts tests/lib/content/rich-text-mentions.test.ts tests/components/chat-thread.test.tsx`
- `pnpm exec eslint components/app/screens/document-detail-screen.tsx components/app/rich-text-editor.tsx components/app/collaboration-screens/chat-thread.tsx lib/content/document-mention-queue.ts lib/content/rich-text-mentions.ts lib/domain/selectors-internal/core.ts tests/components/document-detail-screen.test.tsx tests/components/chat-thread.test.tsx tests/lib/content/document-mention-queue.test.ts tests/lib/content/rich-text-mentions.test.ts --max-warnings 0`
- `git diff --check`

### Remaining notes classified

- The old `activePendingMentionEntries` parse-on-every-keystroke note is stale. Pending mention counts are now synchronized from editor state rather than recomputed by reparsing HTML on each render.
- The baseline reset effect no longer needs to track `document?.content` on every keystroke; the queue is reset on document changes and then kept in sync by editor callbacks.
- The former “mention delta can include other users’ concurrent edits” tradeoff is reduced materially because the pending queue now follows the local editor document state, not a reparsed snapshot echo from the store on every render.
- The broad same-origin anchor interception in [document-detail-screen.tsx](../components/app/screens/document-detail-screen.tsx:292) remains intentional while pending mention notifications exist.

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

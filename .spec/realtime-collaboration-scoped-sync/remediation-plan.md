# Realtime Collaboration Remediation Plan

Status: implementation complete, verification in progress
Scope: fix all open findings in `audit-ledger.md` before the next full collaboration audit

## Objective

Address all `25` collaboration findings through a bounded set of root-cause workstreams, then rerun verification against the full collaboration boundary before declaring the remediation tranche closed.

This plan is intentionally organized by dependency and ownership, not by “one ticket per finding.” Several findings are symptoms of the same broken seam.

## Progress

- Workstream 1 is complete.
- Workstream 2 is complete.
- Workstream 3 is complete.
- Workstream 4 is complete.
- Workstream 5 is complete.
- Workstream 6 is in progress.
- Closed so far:
  - `1`
  - `2`
  - `3`
  - `4`
  - `5`
  - `6`
  - `7`
  - `8`
  - `9`
  - `10`
  - `11`
  - `12`
  - `13`
  - `14`
  - `15`
  - `16`
  - `17`
  - `18`
  - `19`
  - `20`
  - `21`
  - `22`
  - `23`
  - `24`
  - `25`
- No open ledger findings remain after the implementation tranche.
- Automated verification now passes:
  - `18/18` collaboration/scoped-sync suites
  - `109/109` tests
  - `pnpm typecheck`

## Execution Rule

- Do not treat this as `25` disconnected fixes.
- Do not rerun the full audit after each small patch.
- Complete each workstream with its validation gates, update the ledger, and only then run the next repo-wide audit pass.

## Workstreams

### 1. Ring-fence document body ownership

Goal:
- ensure there is exactly one live writer for a document/work-item description body during collaboration
- prevent non-editor freshness paths from overwriting active editor state

Actions:
- remove full body content from non-editor read models and replace with summary/preview fields only
- isolate active editor body state from global merged `documents[]`
- hard-disable legacy document/item-description PATCH writes as soon as collaboration enters `bootstrapping`
- remove full-document HTML rewrite flows from collaborative title changes
- stop active-editor sync failure from using global snapshot replacement as recovery

Primary files:
- `lib/scoped-sync/read-models.ts`
- `lib/store/app-store-internal/slices/ui.ts`
- `lib/store/app-store-internal/runtime.ts`
- `lib/store/app-store-internal/slices/work-document-actions.ts`
- `components/app/screens/document-detail-screen.tsx`
- `components/app/screens/work-item-detail-screen.tsx`

Closes findings:
- `1`, `2`, `3`, `14`, `15`, `22`

Validation:
- active editor body cannot be changed by docs/work/project/search read-model refreshes
- no legacy body PATCH request is emitted once collaboration is bootstrapping or attached
- title edits no longer call full `setContent(...)` rewrites in collaboration mode

### 2. Rebuild room lifecycle around room-owned durability

Goal:
- make PartyKit room state room-owned instead of first-user-owned
- make Convex durability authoritative between sessions

Actions:
- remove per-user closure capture from room `load` and `callback.handler`
- derive room persistence identity from room/document id, not first opener
- eliminate stale `roomBootstrapCache` reuse on idle reopen unless it is proven fresh
- add explicit idle-room teardown or reinitialization on zero connections
- add guaranteed last-user-leave flush
- surface callback persistence failures to clients and diagnostics, not just server logs
- add token renewal for reconnect and manual flush
- make flush a real durability fence: local updates acknowledged into room before server persist
- add source-version/CAS enforcement for room-to-Convex persist

Primary files:
- `services/partykit/server.ts`
- `lib/collaboration/adapters/partykit.ts`
- `hooks/use-document-collaboration.ts`
- `app/api/internal/collaboration/documents/[documentId]/persist/route.ts`
- `app/api/collaboration/documents/[documentId]/session/route.ts`

Closes findings:
- `6`, `7`, `8`, `9`, `10`, `11`, `12`, `21`, `24`

Validation:
- zero-connection room reopen uses fresh canonical state
- stale first-opener callback semantics are gone
- manual flush cannot succeed with un-applied local updates
- expired token reconnect path succeeds through renewal
- last-user-leave persists the latest room state durably

### 3. Enforce collaboration lifecycle, role, and presence boundaries

Goal:
- make collaboration ownership explicit and stable
- prevent transport-state flapping from breaking presence or editability

Actions:
- introduce explicit lifecycle states: `legacy`, `bootstrapping`, `attached`, `degraded`
- separate “sync late” from “transport errored”
- enforce `viewer` vs `editor` at the room/persist boundary, not only in UI
- make presence source exclusive by lifecycle:
  - `attached` => PartyKit awareness
  - `legacy` / `degraded` => heartbeat only
- keep toolbar mounted and controls disabled appropriately instead of tying UI visibility to transport transitions

Primary files:
- `lib/collaboration/adapters/partykit.ts`
- `hooks/use-document-collaboration.ts`
- `components/app/rich-text-editor.tsx`
- `components/app/screens/document-detail-screen.tsx`
- `components/app/screens/work-item-detail-screen.tsx`
- `services/partykit/server.ts`

Closes findings:
- `4`, `5`, `16`, `23`

Validation:
- presence does not disappear on slow initial sync
- viewers cannot mutate room state
- header/editor presence source does not oscillate between heartbeat and websocket during one active session

### 4. Bring work-item description collaboration to parity with documents

Goal:
- make work-item description collaboration use the same correctness model as standalone documents

Actions:
- keep work-item viewers in the room even when not actively editing
- make work-item title/description save atomic or explicitly ordered under one conflict model
- flush or safely persist before closing the work-item collaborative editor
- show work-item header presence independently of local edit mode

Primary files:
- `components/app/screens/work-item-detail-screen.tsx`
- `lib/store/app-store-internal/slices/work-item-actions.ts`
- `lib/store/app-store-internal/slices/work-document-actions.ts`

Closes findings:
- `17`, `18`, `19`, `20`

Validation:
- two passive viewers of a work item stay live on the same room state
- close/cancel cannot drop unpersisted description edits
- work-item header presence remains visible outside local edit mode

### 5. Stop collaboration churn from feeding legacy snapshot behavior

Goal:
- keep collaboration persistence from reactivating the old global sync model

Actions:
- prevent collaboration persistence mutations from bumping the global snapshot version
- narrow collaboration invalidation scopes so typing does not fan out to unrelated surfaces
- keep fallback logic bounded to collaboration-specific recovery rather than global app snapshot replacement

Primary files:
- `convex/app.ts`
- `app/api/internal/collaboration/documents/[documentId]/persist/route.ts`
- `lib/scoped-sync/document-scope-keys.ts`
- `lib/store/app-store-internal/runtime.ts`

Closes findings:
- `13`, `25`

Validation:
- room-backed typing does not trigger global snapshot churn
- collaboration persists only invalidate required detail/index scopes

### 6. Verification and audit-closure pass

Goal:
- prove all findings are closed before the next audit

Actions:
- add missing tests for:
  - token expiry and renewal
  - idle-room reopen semantics
  - last-user-leave persistence
  - CAS rejection on stale room persist
  - late scoped-read-model response suppression
  - viewer/editor enforcement
  - work-item passive-viewer room participation
- run two-browser manual verification for:
  - docs
  - work-item descriptions
  - presence in header and in-editor
  - reconnect, close, refresh, and last-user-leave durability
- update `audit-ledger.md` item by item as findings close
- run the full audit again only after all workstreams are complete

Current status:
- local repeated audit loops have stabilized with no new findings
- automated verification is complete and green
- manual/browser rollback validation remains the final release gate

## Traceability Matrix

- `1` -> Workstream 1
- `2` -> Workstream 1
- `3` -> Workstream 1, Workstream 5
- `4` -> Workstream 3
- `5` -> Workstream 3
- `6` -> Workstream 2
- `7` -> Workstream 2
- `8` -> Workstream 2
- `9` -> Workstream 2
- `10` -> Workstream 2
- `11` -> Workstream 2
- `12` -> Workstream 2
- `13` -> Workstream 5
- `14` -> Workstream 1
- `15` -> Workstream 1
- `16` -> Workstream 3
- `17` -> Workstream 4
- `18` -> Workstream 4
- `19` -> Workstream 4
- `20` -> Workstream 4
- `21` -> Workstream 2
- `22` -> Workstream 1
- `23` -> Workstream 3
- `24` -> Workstream 2
- `25` -> Workstream 5

## Recommended Order

1. Workstream 1
2. Workstream 2
3. Workstream 3
4. Workstream 4
5. Workstream 5
6. Workstream 6

Rationale:
- Workstream 1 removes the body-overwrite and dual-write defects that make every later fix unstable.
- Workstream 2 fixes the room durability contract itself.
- Workstream 3 stabilizes lifecycle and permission semantics on top of that corrected room model.
- Workstream 4 brings the weaker work-item flow up to parity.
- Workstream 5 removes legacy snapshot churn that would otherwise keep masking regressions.
- Workstream 6 is the closure gate.

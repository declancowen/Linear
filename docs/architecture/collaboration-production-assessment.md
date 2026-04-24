# Collaboration Production Assessment: Convex + PartyKit + Yjs

## Summary

This document tracks the current production-state assessment for collaborative documents and work-item descriptions.

The short version:

- the latest PartyKit flush regression has been fixed
- production collaboration is still not where it needs to be
- the biggest remaining problem is now the boot/open path, not the save protocol
- the system currently behaves acceptably in some cases, but it still does too much serial work and still swaps rendering modes during collaboration attach

This document is the tracking artifact for:

1. the last fix that was implemented
2. the next fix to implement
3. the follow-on architecture findings that should be addressed after that

## Current Status

Current assessment:

- documents and work-item descriptions use Convex as canonical persisted state
- PartyKit on Cloudflare is the realtime room/runtime layer
- Yjs carries the collaborative editor state
- the explicit teardown flush fix is now in place
- the next production-critical fix is the collaboration boot/open path

Current production readiness:

- improved, but still not fully production-stable

## Current Boot Sequence

The current document collaboration open path is **serial**, not parallel.

It currently works like this:

1. the app loads the document/read model first
2. the collaboration hook starts only after the document id is available
3. the client requests a collaboration session bootstrap from the Next route
4. the client opens the PartyKit session using that bootstrap
5. PartyKit fetches canonical content from Convex again to seed the room
6. the screen swaps from preview rendering to the live collaborative editor

So the answer to the architecture question is:

- document + PartyKit are **not** opening in parallel
- PartyKit opens **after** the document path has already started and after a session bootstrap request completes

## What We Just Fixed

### Fix: explicit teardown flush intent

Status: `Implemented`

Problem that was fixed:

- active saves and closing-tab/unmount flushes were using the same PartyKit flush path
- the server tried to infer whether an incoming flush was stale by checking:
  - whether other editors were connected
  - whether the payload matched the current room document
- that broke legitimate saves whenever another editor was connected and the room had not caught up yet

What changed:

- active saves remain authoritative
- teardown/close flushes now use explicit intent:
  - `kind: "teardown-content"`
- the “ignore if other editors remain” logic now applies only to teardown flushes
- normal `content` and `work-item-main` flushes always apply the incoming payload before persisting

Primary files:

- [lib/collaboration/transport.ts](../../lib/collaboration/transport.ts)
- [lib/collaboration/adapters/partykit.ts](../../lib/collaboration/adapters/partykit.ts)
- [hooks/use-document-collaboration.ts](../../hooks/use-document-collaboration.ts)
- [services/partykit/server.ts](../../services/partykit/server.ts)
- [tests/services/partykit-server.test.ts](../../tests/services/partykit-server.test.ts)
- [tests/hooks/use-document-collaboration.test.tsx](../../tests/hooks/use-document-collaboration.test.tsx)

Why this matters:

- active saves are no longer misclassified as stale closing-session flushes
- closing/refreshing one tab no longer risks overwriting the work of editors still in the room

## Next Fix To Implement

### Fix: boot/open-path stabilization

Status: `Planned`

This is now the main production-critical follow-up.

### Problem

Collaborative document open still does too much serial work and still transitions between rendering modes during attach.

That causes symptoms like:

- open-time blanking
- content/toolbar/width shifts
- flicker or “spotty” initial render
- worse production behavior than local despite the same feature apparently “working”

### Root causes

#### 1. Serial boot chain

The system currently does:

1. load document/read model
2. request collaboration session bootstrap
3. open PartyKit
4. PartyKit seeds room from Convex
5. swap to live editor

That is too much serialized work on the critical render path.

#### 2. Duplicate reads

The same content is effectively fetched multiple times during open:

- document/read model path
- session bootstrap route
- PartyKit room seed from Convex

#### 3. Preview/live renderer swap

Even though the outer shell is improved, the document screen still renders:

- `RichTextContent` while collaboration is bootstrapping
- then `RichTextEditor` once collaboration is attached

That means the shell is more stable, but the editor content renderer still changes underneath the user.

#### 4. Bootstrap content is returned but not fully used

The session route already returns `contentHtml`, but the client does not currently use that payload to eliminate the preview-to-live transition.

### Target shape

The next implementation should aim for:

- one stable collaborative editor shell
- one collaboration-oriented mount path
- no preview-to-live content renderer swap
- reduced duplicate fetching during open

### Intended design

#### Shared shell

Preview and live collaboration should share the same layout contract:

- same outer shell
- same reserved toolbar area
- same headroom
- same canvas width handling

#### Boot content

The collaboration bootstrap payload should be used to seed the initial collaborative rendering path instead of being ignored.

Recommended direction:

- either use `contentHtml` directly for the initial collaboration mount
- or upgrade the session payload to `contentJson` if that becomes the cleaner long-term contract

#### Mount model

For collaborative documents/work-item descriptions:

- mount a collaboration-oriented editor path from the start
- avoid showing one renderer and then swapping to another after PartyKit attach

## Follow-On Findings

These are the remaining architecture findings after the flush fix and after the boot-path fix is addressed.

### Finding A: duplicate data reads on hot paths

Status: `Open`

The collaboration stack still performs more Convex reads than necessary during:

- open/bootstrap
- some manual persist flows

This is now a performance and operability issue more than a correctness issue.

### Finding B: production observability is still too weak

Status: `Open`

We still need explicit runtime correlation across:

- client build id
- PartyKit worker build id
- collaboration protocol version
- Convex deployment/environment

Without that, local-vs-prod drift is too hard to diagnose quickly.

### Finding C: save-path optimization still needs a second pass

Status: `Open`

The save semantics are better now, but the server still does extra work around:

- room seeding
- editable-document lookups
- manual persist orchestration

This should be optimized after the boot/render path is stable.

### Finding D: broader collaboration cleanup remains deferred

Status: `Deferred`

This includes:

- deeper transport cleanup
- awareness/perf optimization
- additional protocol simplification

These should happen only after the production-critical boot and observability work is complete.

## Tracking Board

| Item | Status | Priority | Notes |
|---|---|---:|---|
| Explicit teardown flush split | Done | P0 | Fixes the regression introduced by the last PartyKit save-path change |
| Boot/open-path stabilization | Done | P0 | Collaborative docs and descriptions now mount one editor path during boot/attach |
| Use bootstrap payload to avoid preview/live swap | Done | P0 | `contentJson` now feeds the boot renderer without changing Yjs room seeding |
| Add client/worker/protocol/deployment diagnostics | Planned | P1 | Required for reliable prod debugging |
| Reduce duplicate Convex reads on open/save | Planned | P1 | Optimization after boot stabilization |
| Broader collaboration cleanup | Deferred | P2 | Do after production-critical paths are stable |

## Turn Plans

This section breaks the remediation program into concrete implementation turns so the scope stays controlled.

### Turn 1: Fix the PartyKit flush regression

Status: `Done`

#### Scope

In scope:

- PartyKit manual flush semantics for collaborative documents
- work-item main-section manual flush semantics
- unmount and `pagehide` teardown behavior
- regression tests for multi-editor save vs teardown

Out of scope:

- cursor rendering
- editor flicker
- boot/open-path behavior
- diagnostics

#### Implementation shape

- split flush intent explicitly:
  - `content`
  - `document-title`
  - `work-item-main`
  - `teardown-content`
- treat active saves as authoritative
- treat teardown as safe-to-ignore when other editors remain
- update the client teardown path to use explicit teardown intent
- update PartyKit tests to cover:
  - divergent active save with another editor connected
  - teardown ignored when other editors remain
  - teardown persisted when no other editors remain

#### Success criteria

- active saves no longer get ignored just because another editor is connected
- closing or refreshing one tab does not overwrite the work of remaining editors
- no Convex deploy is required

### Turn 2: Stabilize collaborative boot/open path

Status: `Done`

#### Scope

In scope:

- document collaboration boot path
- work-item description collaboration boot path
- preview/live rendering contract
- bootstrap payload usage
- open-time width/toolbar/content flicker

Out of scope:

- deeper save-path optimization
- awareness/perf tuning
- broad protocol redesign

#### Implementation shape

- add `contentJson` to the collaboration session bootstrap payload
- expose boot-time collaboration state through:
  - `editorCollaboration`
  - `bootstrapContent`
- start standalone document collaboration only after the loaded document kind is known and confirmed collaborative
- treat collaborative document bodies as protected from the start of bootstrapping, not only after attach
- keep legacy presence and legacy body sync disabled while collaboration bootstraps
- render a stable read-only preview shell during bootstrapping for:
  - standalone collaborative documents
  - collaborative work-item descriptions
- mount `RichTextEditor` only after the collaboration session is attached, so the editor never upgrades from a normal editor into a collaborative editor mid-flight
- keep the PartyKit/Yjs save protocol unchanged from Turn 1

#### Important implementation note

- we intentionally did **not** pre-seed the client-side Y.Doc from `contentJson`
- independently seeding the client doc and the PartyKit room doc from plain content causes Yjs to merge two different CRDT histories and duplicate the document on sync
- instead, `contentJson` is available for boot-time rendering and future optimization while the room-owned Y.Doc continues to attach from PartyKit as the authoritative collaborative state
- the original “mount the live editor during bootstrapping” approach was rolled back because it still created a hidden editor reconfiguration and allowed a temporary legacy-editable window on first open

#### Success criteria

- collaborative documents do not enter a legacy-editable state before collaboration takes ownership
- no legacy body autosave or legacy presence runs while collaboration is bootstrapping
- the boot shell remains visually stable on open, with reserved editor/toolbar space
- standalone documents start collaboration only after the loaded document kind is known
- work-item descriptions show a stable preview instead of mounting a normal editor and then upgrading it
- no Convex deploy or PartyKit deploy is required for this turn

### Turn 3: Add production diagnostics and version correlation

Status: `Planned`

#### Scope

In scope:

- client-side collaboration diagnostics
- PartyKit worker diagnostics
- protocol/build/deployment identifiers
- log correlation for production incidents

Out of scope:

- major transport redesign
- rendering changes
- performance tuning

#### Implementation shape

- add explicit identifiers for:
  - client build id
  - PartyKit worker build id
  - collaboration protocol version
  - Convex environment/deployment id
- include those values in:
  - collaboration session open logs
  - PartyKit connect/bootstrap logs
  - flush failure logs
  - reconnect/hard-refresh incident logs

#### Success criteria

- when prod diverges from local, logs can prove whether the issue is:
  - stale client
  - stale PartyKit worker
  - protocol mismatch
  - environment/deployment skew

### Turn 4: Optimize duplicate reads and hot-path persistence work

Status: `Planned`

#### Scope

In scope:

- duplicate Convex reads on document open
- duplicate Convex reads on save/persist hot paths
- room seed/persist read reduction where safe

Out of scope:

- feature redesign
- broad collaboration UX work

#### Implementation shape

- reduce repeated reads across:
  - read model boot
  - session bootstrap
  - PartyKit room seed
- reduce repeated editable-document lookups on hot save paths where safe
- preserve correctness and access validation first, then optimize

#### Success criteria

- fewer duplicate server round-trips during collaborative open
- lower save-path overhead without changing semantics

### Turn 5: Broader collaboration cleanup

Status: `Deferred`

#### Scope

In scope:

- follow-on cleanup after production-critical stabilization
- awareness/perf optimization
- transport simplification
- additional UX polishing that is not blocking stability

#### Success criteria

- collaboration code is cleaner and cheaper to operate
- no production-critical instability remains before this turn begins

## Recommended Order

The recommended implementation order is:

1. keep the flush regression fix
2. stabilize collaborative boot/open path
3. add production diagnostics
4. optimize duplicate reads and hot-path persistence work
5. do broader collaboration cleanup only after those are stable

## What We Should Not Do

To keep risk controlled, do **not** try to:

- redesign the whole collaboration system in one patch
- combine boot-path stabilization, diagnostics, protocol cleanup, and performance tuning into one undifferentiated change
- chase every rendering imperfection before the boot model is stable

The correct approach is:

- fix the highest-risk boundary
- verify it
- then move to the next one

## Validation Checklist

After the next boot-path fix lands, validate:

1. open a collaborative document in production and confirm:
   - no preview/live swap flicker
   - no width jump
   - no toolbar insertion jump
2. open the same document in two browsers and confirm:
   - attach remains stable
   - no save regression returns
3. hard refresh one client while the other remains in-room and confirm:
   - rejoin is coherent
   - no room drift
4. verify diagnostics/logs can identify:
   - client build
   - worker build
   - protocol version
   - Convex environment

## Notes

- This document intentionally focuses on collaborative documents and work-item descriptions.
- Private documents remain Convex-only and non-collaborative.
- The current flush fix is complete enough to keep, but the collaboration system should still be treated as a production-hardening effort in progress.

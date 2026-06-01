# Review: Work Item Reference Activity UI

## Project context

| Field | Value |
|-------|-------|
| **Repository** | `/Users/declancowen/Documents/GitHub/Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `codex/work-item-reference-activity-ui` |
| **Stack** | Next.js 16, React 19, Convex, TipTap, Zustand, Vitest |

## Scope

- Work surface child filtering and board/list display semantics — added Turn 1
- Work item detail breadcrumbs, create modal inherited project context, sidebar relations, property popovers, and compact row UI — added Turn 1
- People profile activity, privacy filtering, and notification/read-state changes — added Turn 1
- Rich text entity references across documents, work item descriptions, comments, persistence, backlinks, and access-aware navigation — added Turn 1
- Chat message edit/delete/read-state, comments assignment/timestamps/reactions, and channel/comment notification routing — added Turn 1
- Spec-driven package, feedback-loop skill rules, and final spec audit artifacts — added Turn 1
- Next.js build config compatibility for Turbopack and LinkeDOM canvas fallback — added Turn 1

## Hotspots

- Cross-surface privacy and authorization leakage through references, profiles, inbox, and notifications — added Turn 1
- Duplicate state/source-of-truth drift between spec, filters, relationships, read models, and UI affordances — added Turn 1
- Broad UI portal containment and keyboard/click interaction variants — added Turn 1
- Rich text HTML parsing/sanitization and access-aware navigation — added Turn 1
- Chat/message optimistic mutation, deletion visibility, read-state reconciliation, and notification replacement — added Turn 1
- Devex/build config drift under Next 16 Turbopack defaults — added Turn 1

## Review status

| Field | Value |
|-------|-------|
| **Review started** | 2026-06-01 19:30:39 BST |
| **Last reviewed** | 2026-06-01 19:43:44 BST |
| **Total turns** | 2 |
| **Open findings** | 0 |
| **Resolved findings** | 5 |
| **Accepted findings** | 0 |

## Turn 2 — 2026-06-01 19:43:44 BST

| Field | Value |
|-------|-------|
| **Commit** | `b2bc26256b83a4e2568be729290c8aa738771d5f` with uncommitted working tree |
| **IDE / Agent** | Codex |

**Summary:** Completed the local branch-total diff review loop with architecture standards. One additional live issue was found and fixed after Turn 1: read-only chat users could still trigger message mutation affordances and optimistic state. The spec package final audit task is now closed and regenerated summaries show `12/12` tasks completed.

**Outcome:** local pre-PR all clear; PR is still pending creation and the post-PR GitHub/Codex feedback watcher loop remains required before final merge readiness.

**Risk score:** high — broad branch across privacy, rich text, Convex access checks, optimistic state, notifications, UI containment, and build/devex.

**Change archetypes:** shared UI, auth/privacy, rich-text security, persistence/read-model contracts, optimistic state, notifications, build/devex, broad spec-guided implementation.

**Intended change:** re-audit all local changes against the original plan, user clarifications, live repo evidence, and architecture standards; fix any missed plan requirement or review finding before committing.

**Intent vs actual:** current diff matches the intended product scope and later clarifications. The child filter design has no second tick or separate child filter state; child rows inherit active view filters. Profile activity includes visible relevant work item changes while private activity remains hidden from other viewers. Reference insertion/persistence remains access-aware. Work item popups are contained through an optional surface portal. Chat read/notification and mutation changes are included and now enforce write access consistently.

**Confidence:** high for local pre-PR readiness — full lint, typecheck, full Vitest, production build, desktop smoke, spec lint, and strict traceability all passed. Confidence remains medium for hosted PR readiness until GitHub/Codex feedback has been polled and triaged.

**Coverage note:** reviewed branch-total changed files through diff-review preflight, targeted high-risk source reads, architecture preflight, drift searches, and final validation gates. Browser/manual visual smoke was not run; component tests cover the affected layout and containment behavior.

**Finding triage:** WIR-001 through WIR-005 are resolved in the current tree with regression coverage where appropriate. No open Critical/High finding remains locally.

**Static/analyzer evidence:** architecture preflight identified existing Fallow advisory inventories and CI's advisory Fallow mode. This branch did not claim Fallow cleanliness; local readiness is based on configured lint/typecheck/test/build/desktop smoke plus spec validation.

**Architecture impact:** the final fixes reinforced owner boundaries: read-only chat mutation is now blocked in UI presentation, optimistic store policy, and Convex write-access authority. The branch continues to keep domain visibility rules in selectors, persistence validation in Convex handlers, and portal containment as optional primitive support rather than a global behavior change.

**Deep-review evidence:** dual pass completed. Correctness/safety found and fixed child filter cascade, unsafe entity-reference href preservation, Next/Turbopack build drift, lint hygiene, and read-only chat mutation drift. Maintainability/structure found no remaining blocker: broad changes stay in existing owners, no child-filter state was introduced, no normalized reference graph was added prematurely, and the LinkeDOM canvas shim is repo-owned rather than package-internal.

**Bug classes / invariants checked:** filter inheritance under direct and assigned-descendant child rows; private profile/reference visibility; entity-reference internal navigation only; source-owned relationships/backlinks; work item surface portal containment; chat read-state notification replacement; read-only chat mutation authority; Next 16 build compatibility.

**Branch totality:** current working tree was reviewed as the target, including chat/comment/read-state changes completed in parallel threads and the spec package generated earlier.

**Sibling closure:** chat mutation fix was applied at UI, optimistic store, and Convex handler layers; child filtering was checked against drift terms; reference access was checked at candidate, sanitizer, click-blocking, store, and Convex revalidation layers.

**Remediation impact surface:** latest fix touched `ChatThread`, `collaboration-conversation-actions`, `toggleChatMessageReactionHandler`, and matching tests only; it did not alter unrelated channel reaction behavior except by aligning chat reactions with the existing channel write-access pattern.

**Residual risk / unknowns:** no browser visual smoke was run. Existing Fallow advisory inventories are not branch-specific and were not used as merge blockers. Hosted PR feedback still needs to be polled and resolved before final readiness.

### Validation

- `git diff --check` — passed
- `pnpm lint` — passed
- `pnpm typecheck` — passed
- `pnpm test` — passed, 215 files / 1,371 tests
- `pnpm build` — passed
- `pnpm desktop:smoke` — passed
- `pnpm vitest run tests/components/chat-thread.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/convex/chat-message-notifications.test.ts` — passed after WIR-005 fix
- `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/work-item-reference-activity-ui` — passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/work-item-reference-activity-ui --strict` — passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/spec_summary.py --spec-dir .spec/work-item-reference-activity-ui --write` — passed, execution counts `todo=0`, `completed=12`
- `python3 ~/.codex/skills/spec-driven-development/scripts/spec_summary.py --spec-dir .spec/work-item-reference-activity-ui --format pr-comment --write` — passed
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; no new branch-specific architecture blocker identified

### Branch-totality proof

- **Non-delta files/systems re-read:** review gates, all-clear antipatterns, architecture review checklist, spec task artifacts, work item selector/filter code, rich-text reference/security code, people activity selectors, chat thread/store/Convex handlers, popup primitive wrappers, Next config and LinkeDOM canvas fallback.
- **Prior open findings rechecked:** WIR-001 to WIR-004 stayed resolved after final validation; WIR-005 was newly found and fixed.
- **Prior resolved/adjacent areas revalidated:** child filter inheritance, private profile visibility, reference sanitizer/click-blocking, work item relations excluding projects, popup containment, chat read/notification paths, read-only mutation paths, Next build path.
- **Hotspots or sibling paths revisited:** direct/assigned-descendant children, workspace/team/private reference candidates, document/work item/comment references, inbox/shell notification count replacement, chat reaction/edit/delete UI/store/server paths.
- **Dependency/adjacent surfaces revalidated:** Convex generated API imports, route handlers, read-model bumps, shared Radix primitive wrappers, Next Turbopack config, local tool ignored state.
- **Why this is enough:** local validation covers both focused invariants and broad regression gates; remaining required work is external PR review polling, not more uncommitted local review.

### Challenger pass

- `done` — attacked the weakest likely bug class, stale client/UI authority drift, and found WIR-005. After fixing it, the same class was swept across UI/store/server for chat edit/delete/reaction.

### Resolved / Carried / New findings

#### WIR-005 [P1] Read-only chat users could still trigger message mutations optimistically

- **Status:** resolved
- **Bug class:** authorization/UI authority drift / optimistic state bypass
- **Invariant:** users without write access must not see or trigger chat message edit/delete/reaction mutation paths, and optimistic local state must not mutate before the same write-access rule the server enforces.
- **Fix:** message action affordances now receive `canCurrentUserWrite`; reaction buttons disable in read-only state; edit/save guards respect `canCurrentUserSend`; store update/delete/reaction actions use shared optimistic write checks; Convex chat reaction handling now calls `requireConversationAccess(..., "write")`.
- **Verification:** component, store, and Convex tests cover read-only UI affordances, blocked optimistic update/delete/reaction, and server write-access enforcement.

### Recommendations

1. **Fix first:** create the PR, then wait for GitHub/Codex feedback before committing any follow-up changes.
2. **Then address:** if feedback arrives, import it into this review file as a new automation/PR turn and rerun the deep diff loop before pushing.
3. **Patterns noticed:** the highest-risk class in this branch was authority drift between UI affordance, optimistic state, and server validation.
4. **Suggested approach:** keep future reference/backlink expansion source-owned until query pressure justifies a normalized reference graph.
5. **Architecture transition:** Fallow advisory inventories remain separate from this branch and should be handled by owner-local refactor/test campaigns, not mixed into this product PR.
6. **Defer on purpose:** browser visual smoke was not run because component coverage, full tests, build, and desktop smoke passed; PR feedback can still request manual UI verification if needed.

## Turn 1 — 2026-06-01 19:31:19 BST

| Field | Value |
|-------|-------|
| **Commit** | `b2bc26256b83a4e2568be729290c8aa738771d5f` with uncommitted working tree |
| **IDE / Agent** | Codex |

**Summary:** Started the branch-total deep diff review against the original user plan, the repo spec, and architecture standards. The review is documented now because the working tree spans multiple implementation threads and must not rely on chat history alone.

**Outcome:** partial review pending final validation, final deep sanity pass, PR creation, and GitHub/Codex feedback watcher loop.

**Risk score:** high — broad branch crossing UI, rich text content, privacy, access rules, Convex handlers, read models, notifications, editor behavior, and build config.

**Change archetypes:** shared UI, auth/privacy, rich-text security, persistence/read-model contracts, optimistic state, notifications, build/devex, broad spec-guided implementation.

**Intended change:** deliver the original multi-part plan: child rows inherit parent board/list filters without a separate child filter state; all breadcrumbs provide back navigation; inherited child project context is visible but disabled; profile activity includes relevant visible work item changes while hiding private activity; search icon alignment and people grid are corrected; work item relations omit projects; rich text references can link accessible docs/work items/projects/views where allowed and show backlinks; work item surface popups are contained; typing lag is reduced; chat/comment/read-state changes from parallel work are included; implementation remains driven by original request plus architecture standards, not stale spec artifacts.

**Intent vs actual:** current diff mostly matches the intended scope. Live drift caught during review was fixed: child display filtering now cascades to assigned-descendant child rows, entity-reference anchors no longer keep unsafe external hrefs, and the Next 16 build config now has a Turbopack-compatible canvas shim.

**Confidence:** medium pending final gates — focused tests, lint, typecheck, diff check, spec validation, and build have passed in the current loop, but full-suite validation, final review file update, PR feedback triage, and post-feedback reruns are still pending.

**Coverage note:** reviewed the current working tree via `review-preflight.sh`, spec artifacts, high-risk selectors, rich-text security/reference paths, work item surface UI, notification/chat paths, and build config. This is not yet the final all-clear.

**Finding triage:** no open Critical/High finding remains in the current tree. Resolved findings are recorded below and will be revalidated in the final turn.

**Static/analyzer evidence:** Fallow exists and CI has an advisory Fallow run. This branch has not used Fallow as an all-clear signal; lint/typecheck/tests/build are the active validation gates so far. Fallow inventories remain separate from branch readiness.

**Architecture impact:** implementation keeps rules in owner layers: child filtering in domain selectors, profile visibility in domain selectors, access validation in Convex/store/read-model boundaries, content parsing/sanitization in content/rich-text modules, and popup containment as optional primitive support plus work-surface context. The Next build fix keeps the optional LinkeDOM canvas fallback in a server-owned shim instead of a package-internal alias.

**Deep-review evidence:** dual-pass review is in progress. Correctness/safety pass already found and fixed filter, href, lint, and build failures. Maintainability/structure pass is tracking broad-file growth, owner boundaries, optional portal APIs, relationship source ownership, and spec drift.

**Bug classes / invariants checked:** filter inheritance across parent/child display rows; private activity/reference visibility; unsafe rich-text link preservation; source-owned relationship arrays; work-item surface portal containment; chat deletion/read-state visibility; build command compatibility under Next 16.

**Branch totality:** review target is the whole working tree, not just the latest patch. Chat read/notification changes are now included because the user marked them complete.

**Sibling closure:** child filtering was checked beyond the primary grouped path; rich-text href hardening was checked at sanitizer level; build config was checked with `pnpm build`; UI portal containment remains under final review for all changed work item surface popups.

**Remediation impact surface:** fixes touched only the owning selector/security/build boundaries and corresponding tests, without adding child filter schema/state or broad reference graph infrastructure.

**Residual risk / unknowns:** full `pnpm test` and final PR feedback loop are not complete yet. Browser/manual visual smoke has not been run; current confidence relies on component tests and static gates.

### Validation

- `pnpm vitest run tests/lib/domain/view-item-level.test.ts tests/components/work-surface-view.test.tsx tests/components/rich-text-editor-helpers.test.tsx tests/lib/content/rich-text-security.test.ts tests/lib/content/rich-text-references.test.ts tests/lib/domain/rich-text-references.test.ts` — passed
- `pnpm vitest run tests/components/work-item-detail-screen.test.tsx tests/components/work-item-ui-comments-inline.test.tsx tests/components/document-detail-screen.test.tsx tests/components/create-dialogs.test.tsx tests/components/people-screen.test.tsx` — passed
- `pnpm vitest run tests/components/chat-thread.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/convex/chat-message-notifications.test.ts tests/components/notification-routing.test.ts tests/components/inbox-ui.test.tsx tests/components/workspace-chats-screen.test.tsx tests/components/channel-ui.test.tsx tests/lib/store/collaboration-channel-actions.test.ts tests/convex/comment-handlers.test.ts` — passed
- `pnpm vitest run tests/lib/store/work-document-actions.test.ts tests/lib/store/work-item-actions.test.ts tests/convex/document-handlers.test.ts tests/convex/work-item-handlers.test.ts tests/app/api/document-workspace-route-contracts.test.ts tests/lib/domain/work-item-assignees.test.ts tests/lib/domain/people-activity.test.ts tests/lib/scoped-read-models.test.ts tests/convex/auth-bootstrap-health.test.ts` — passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/work-item-reference-activity-ui` — passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/work-item-reference-activity-ui --strict` — passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/spec_summary.py --spec-dir .spec/work-item-reference-activity-ui --write` — passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/spec_summary.py --spec-dir .spec/work-item-reference-activity-ui --format pr-comment --write` — passed
- `git diff --check` — passed
- `pnpm typecheck` — passed
- `pnpm lint` — passed after resolving an unused import
- `pnpm build` — passed after adding Turbopack canvas alias support

### Branch-totality proof

- **Non-delta files/systems re-read:** diff-review skill, review gates, deep-review dual-pass instructions, architecture implementation checklist, spec skill rules, Next Turbopack config types/docs, LinkeDOM canvas fallback.
- **Prior open findings rechecked:** no open `.reviews/` findings carried into this branch; existing hotspot files were read as context.
- **Prior resolved/adjacent areas revalidated:** child filter spec drift, private activity visibility, rich-text sanitizer behavior, work item relation project duplication, popup containment, chat read/notification replacement.
- **Hotspots or sibling paths revisited:** direct and assigned-descendant child rows, document/work item/comment reference insertion, Convex revalidation, profile activity selectors, inbox/shell notification counts, channel/comment/chat message surfaces.
- **Dependency/adjacent surfaces revalidated:** Next build config, LinkeDOM optional `canvas`, generated Convex API types, store/read-model consumers.
- **Why this is enough:** not enough for final all-clear yet; it is enough to document the current partial review state and fixed finding lineage before final gates and PR feedback.

### Challenger pass

- `in progress` — assume one serious issue remains in broad privacy/reference/chat UI paths; continue reviewing before final all-clear.

### Resolved / Carried / New findings

#### WIR-001 [P1] Child rows under assigned-descendant parent anchors bypassed active filters

- **Status:** resolved
- **Bug class:** filter inheritance / stale spec drift
- **Invariant:** child rows shown under parent/group anchors must mirror active board/list filters and must not add a second child/subtask filter state.
- **Fix:** `getDirectChildWorkItemsForDisplay` now passes the active view filter predicate into the assigned-descendant parent-anchor branch, preserving only the intended item-level exception.
- **Verification:** domain selector tests now cover hidden non-matching children under subscribed/assigned descendant parent anchors.

#### WIR-002 [P1] Entity-reference anchors could preserve unsafe external hrefs

- **Status:** resolved
- **Bug class:** rich-text security / access-aware navigation bypass
- **Invariant:** entity references are app-owned internal links; unsafe external hrefs must not survive as clickable entity-reference destinations.
- **Fix:** sanitizer drops `href` on `data-type="entity-reference"` anchors unless the href is internal (`/` or `#`), while preserving safe metadata.
- **Verification:** rich-text security tests assert external reference href removal and metadata preservation.

#### WIR-003 [P2] Next 16 production build failed because `canvas` fallback was webpack-only

- **Status:** resolved
- **Bug class:** devex/build config drift
- **Invariant:** `pnpm build` must work under Next 16's default Turbopack build path and explicit webpack fallback.
- **Fix:** added `turbopack.resolveAlias` for `canvas` and a repo-owned `lib/server/linkedom-canvas-shim.cjs`; kept webpack alias pointing to the same shim.
- **Verification:** `pnpm build` passed.

#### WIR-004 [P3] Unused work item detail import failed lint

- **Status:** resolved
- **Bug class:** lint/static hygiene
- **Invariant:** broad branch must pass the configured `--max-warnings 0` lint gate.
- **Fix:** removed the unused `getProjectHref` import from the work item detail screen.
- **Verification:** `pnpm lint` passed.

### Recommendations

1. **Fix first:** continue final branch-total review and full validation before committing.
2. **Then address:** update spec task 6.2 and generated spec summaries after final audit, not before.
3. **Patterns noticed:** the main risk class is spec drift from the original request; keep original request, live code, and architecture standards as the loop authority.
4. **Suggested approach:** commit only after the final local review is clean, then create the PR and wait for GitHub/Codex feedback before committing follow-up fixes.
5. **Architecture transition:** do not introduce a normalized reference graph until source-owned linked arrays become insufficient under measured query/read-model pressure.
6. **Defer on purpose:** browser/manual visual smoke remains pending until final validation unless full component/static validation exposes no presentation uncertainty.

# Review: Work Item Detail Sidebar Comments

## Project context

| Field | Value |
|-------|-------|
| **Repository** | `/Users/declancowen/Documents/GitHub/Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `main` |
| **Stack** | Next.js / React / Convex / Zustand / TipTap |

## Scope

- `components/app/screens/work-item-detail-screen.tsx` — sidebar activity comment controls and main activity attachment propagation reviewed in Turn 1
- `tests/components/work-item-detail-screen.test.tsx` — sidebar activity read-only regression coverage reviewed in Turn 1

## Hotspots

- Sidebar activity reusing the same persisted work-item comment thread as the main detail timeline — added Turn 1
- Mutation affordance ownership between work-item detail sidebar surfaces and the main activity timeline — added Turn 1

## Review status

| Field | Value |
|-------|-------|
| **Review started** | 2026-06-04 09:14:07 BST |
| **Last reviewed** | 2026-06-04 09:14:07 BST |
| **Total turns** | 1 |
| **Open findings** | 0 |
| **Resolved findings** | 0 |
| **Accepted findings** | 0 |

## Turn 1 — 2026-06-04 09:14:07 BST

| Field | Value |
|-------|-------|
| **Commit** | `aa48536f7ebb13ec2053aa8b9e0478e6986a0041` with uncommitted working tree |
| **IDE / Agent** | Codex |

**Summary:** Deep reviewed the scoped work-item detail sidebar comment-control delta. The sidebar activity no longer renders its own comment composer and existing sidebar comment rows are passed `editable={false}`, so reply/edit/delete/reaction mutation action-bar controls do not mount in that surface. The main work-item activity timeline remains the writable comment/reply owner.

**Outcome:** scoped all clear with low-risk unknowns. No Critical, High, Medium, or Low findings were found in the reviewed delta.

**Risk score:** medium-low — the code touches a shared comment thread shown in two work-item detail containers, but the patch is UI-local and has direct component coverage.

**Change archetypes:** shared UI surface, mutation-affordance ownership, regression-test hardening.

**Intended change:** disable commenting, replying, and editing from work-item detail sidebar/surface activity so those interactions only happen in the main work-item activity container.

**Intent vs actual:** matches intent. `DetailSidebarActivity` no longer consumes `editable`, no longer mounts `useWorkItemCommentComposer`, and no longer renders the sidebar comment composer. Sidebar comments still render existing persisted content and reply counts, but the mutation affordances are off.

**Confidence:** high for the scoped UI delta. Confidence is not whole-worktree high because the repository has many unrelated dirty files, preflight reported a missing Git base object for normal broad diff commands, and full typecheck currently fails in unrelated dirty files.

**Coverage note:** Pass A checked writable-vs-read-only behavior, root and nested sidebar comments, existing comment display, main timeline comment composer retention, and sibling sidebar-surface callers. Pass B checked the structure for avoidable wrong-layer mutation policy and misleading shared-state ownership.

**Finding triage:** no findings.

**Static/analyzer evidence:** lint passed for the two changed files. Fallow was not used as evidence for this scoped review.

**Architecture impact:** the change tightens ownership: sidebar activity is now presentation-only for comments, while main activity remains the mutation owner. No server/store authority changed.

**Deep-review evidence:** dual pass completed. Correctness/safety found no remaining mutation affordance in the sidebar path. Maintainability/structure found no blocking complexity regression for this scoped change.

**Bug classes / invariants checked:** same-record multi-surface mutation drift; read-only sidebar comments; editable main timeline comments; nested reply display without nested write controls; existing persisted comments still visible.

**Branch totality:** scoped to the two files listed above. Broader attachment upload, chat model, Convex, store, and rich-text dirty-tree changes were intentionally not reviewed in this turn.

**Sibling closure:** checked `WorkItemDetailSidebarSurface` callers from calendar/timeline/work-surface views, full detail right sidebar, `DetailSidebarComment` recursion, and the main `MainActivityTimeline` composer/reply path.

**Remediation impact surface:** no remediation required.

**Residual risk / unknowns:** no browser visual smoke was run for hover action-bar absence. Full `tsc --noEmit` fails outside this scoped delta in `components/app/rich-text-editor.tsx` and `lib/store/app-store-internal/slices/work-comment-actions.ts`.

### Validation

- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; broad diff caveated by dirty tree/missing base object
- `pnpm exec eslint components/app/screens/work-item-detail-screen.tsx tests/components/work-item-detail-screen.test.tsx --max-warnings 0` — passed
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx` — passed, 43 tests
- `git diff --check -- components/app/screens/work-item-detail-screen.tsx tests/components/work-item-detail-screen.test.tsx` — passed
- `pnpm exec tsc --noEmit --pretty false` — failed in unrelated dirty files, not this scoped delta

### Branch-totality proof

- **Non-delta files/systems re-read:** `MessageHoverActionBar`, `WorkItemDetailSidebarSurface` call sites, previous work-item activity and attachment review ledgers.
- **Prior open findings rechecked:** no open findings in the relevant local review ledgers.
- **Prior resolved/adjacent areas revalidated:** previous attachment review already covered upload handling in work-item comments; this turn rechecked that read-only sidebar comments do not expose that edit/upload path.
- **Hotspots or sibling paths revisited:** sidebar recursive comments, main timeline root comments, main timeline nested replies, docked/inline/floating sidebar variants.
- **Dependency/adjacent surfaces revalidated:** store/server comment mutation behavior was intentionally left unchanged; UI affordance ownership is the boundary for this bug.
- **Why this is enough:** the user-reported bug was a UI affordance in the wrong work-item detail container. The current delta removes that affordance from the sidebar path and adds direct regression coverage.

### Challenger pass

- `not needed` — scoped medium-low review, not High/Critical. A skeptical pass still attacked the likely remaining bug: a nested sidebar reply/edit path retaining a mutation control. No live path was found.

### Resolved / Carried / New findings

No findings.

### Recommendations

1. **Fix first:** nothing in this scoped delta.
2. **Then address:** repair or isolate the unrelated dirty-tree typecheck failures before claiming whole-branch readiness.
3. **Patterns noticed:** keep comment mutation affordances in a single visible owner when multiple containers render the same comment target.

# PR 8 Diff Review

Reviewed against `main` for PR `#8` (`Harden lifecycle flows and membership management`) on `2026-04-17`.

## Findings

No open blocking findings remain from this review pass.

## Resolved during review

### R1 [BUG] High - Comment writes were missing the new server-side rich-text sanitization

This was a valid PR comment. [addCommentServer](/Users/declancowen/Documents/GitHub/Linear/lib/server/convex/documents.ts:395) had been left as the only rich-text write path still sending raw `content` through to Convex after the refactor. It now runs `prepareRichTextForStorage` at the same server write boundary used by chat messages, channel posts, channel post comments, documents, and item descriptions. The regression is covered in [convex-documents.test.ts](/Users/declancowen/Documents/GitHub/Linear/tests/lib/server/convex-documents.test.ts).

### R2 [BUG] High - Workspace-scoped label validation now covers project creation and view filter writes

The remaining label-integrity gap is closed. [createProjectHandler](/Users/declancowen/Documents/GitHub/Linear/convex/app/project_handlers.ts:49) now validates `presentation.filters.labelIds` against the project workspace before insert, and [toggleViewFilterValueHandler](/Users/declancowen/Documents/GitHub/Linear/convex/app/view_handlers.ts:161) now validates the full next `labelIds` set against the resolved workspace before persisting it. The shared helper lives in [work_helpers.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/work_helpers.ts), and the corresponding route-wrapper mappings are covered in [convex-teams-projects.test.ts](/Users/declancowen/Documents/GitHub/Linear/tests/lib/server/convex-teams-projects.test.ts) and [convex-work.test.ts](/Users/declancowen/Documents/GitHub/Linear/tests/lib/server/convex-work.test.ts).

### R3 [BUG] Medium - Label cleanup now includes personal workspace views

[cleanupUnusedLabels](/Users/declancowen/Documents/GitHub/Linear/convex/app/cleanup.ts:257) now pulls personal views for workspace users through [listPersonalViewsByUsers](/Users/declancowen/Documents/GitHub/Linear/convex/app/data.ts:694) and includes them both when computing live label usage and when removing deleted label ids from saved filters. That closes the dangling-reference hole for labels that were only kept alive by personal workspace views.

## External PR comments triage

- `member-management 2.tsx` duplicate file: valid, and already resolved in the repo cleanup.
- CSP `unsafe-inline` note in [next.config.mjs](/Users/declancowen/Documents/GitHub/Linear/next.config.mjs:11): valid hardening note, but not a new bug in this PR.
- editor-side sanitization on each keystroke in [rich-text-editor.tsx](/Users/declancowen/Documents/GitHub/Linear/components/app/rich-text-editor.tsx:521): valid performance watchpoint, but not enough evidence yet to classify as a regression without profiling data.
- legacy `collect()` fallback in [data.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/data.ts:48): intentional migration compatibility path; still worth removing after all deployments are backfilled.
- backward-compatible top-level plus nested error details in [route-response.ts](/Users/declancowen/Documents/GitHub/Linear/lib/server/route-response.ts:41): intentional and tested.
- account deletion ordering in [account route](/Users/declancowen/Documents/GitHub/Linear/app/api/account/route.ts:76): intentional and correct for the new compensation-based lifecycle model.
- `WeakMap` search-index cache in [search.ts](/Users/declancowen/Documents/GitHub/Linear/lib/domain/selectors-internal/search.ts:31): acceptable design tradeoff, not an active bug.
- workspace invite cleanup now relying on team cascade in [workspace_team_handlers.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:549): functionally correct, but more implicit than before.

## Duplicate file cleanup completed

Exact duplicate backup files were removed from the tree:

- [member-management 2.tsx](</Users/declancowen/Documents/GitHub/Linear/components/app/settings-screens/member-management 2.tsx>)
- [settings 2.json](</Users/declancowen/Documents/GitHub/Linear/.vscode/settings 2.json>)
- [settings 3.json](</Users/declancowen/Documents/GitHub/Linear/.vscode/settings 3.json>)
- [full-codebase-audit 2.md](</Users/declancowen/Documents/GitHub/Linear/.audits/full-codebase-audit 2.md>)
- [full-codebase-audit 3.md](</Users/declancowen/Documents/GitHub/Linear/.audits/full-codebase-audit 3.md>)

The newer review copy [access-lifecycle-and-membership-management 2.md](</Users/declancowen/Documents/GitHub/Linear/.reviews/access-lifecycle-and-membership-management 2.md>) was not discarded blindly. Its Turn 11 content was merged into the canonical [access-lifecycle-and-membership-management.md](/Users/declancowen/Documents/GitHub/Linear/.reviews/access-lifecycle-and-membership-management.md), and the suffixed duplicate was then removed.

The local env setup was also consolidated back to a single [`.env.local`](/Users/declancowen/Documents/GitHub/Linear/.env.local). The suffixed dev-only copy was removed after folding its Convex dev reference back into the canonical file.

## Verification

- `git rev-list --left-right --count HEAD...@{u}` -> `0 0`
- `pnpm typecheck`
- `pnpm test -- tests/lib/server/convex-work.test.ts tests/lib/server/convex-teams-projects.test.ts tests/lib/server/convex-documents.test.ts`
- `pnpm exec eslint convex/app/project_handlers.ts convex/app/view_handlers.ts convex/app/work_helpers.ts convex/app/cleanup.ts convex/app/data.ts lib/server/convex/work.ts lib/server/convex/teams-projects.ts lib/server/convex/documents.ts tests/lib/server/convex-work.test.ts tests/lib/server/convex-teams-projects.test.ts tests/lib/server/convex-documents.test.ts --max-warnings 0`
- duplicate-file scan after cleanup found no remaining accidental suffixed backup files

# Review: Rich Text Attachment Uploads

## Project context

| Field | Value |
|-------|-------|
| **Repository** | `/Users/declancowen/Documents/GitHub/Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `main` |
| **Stack** | `Next.js / React / Convex / Zustand / TipTap` |

## Scope

- `lib/domain/file-uploads.ts` — added Turn 1
- `components/app/rich-text-editor/upload-button.tsx` — added Turn 1
- `components/app/rich-text-editor/*` upload insertion, toolbar accept, and stats behavior — added Turn 1
- `components/app/collaboration-screens/{channel-ui,channel-post-primitives,chat-thread}.tsx` — added Turn 1
- `components/app/collaboration-screens/conversation-files-panel.tsx` and chat/channel Files tabs — added Turn 3
- `components/app/screens/{work-item-ui,work-item-detail-screen}.tsx` — added Turn 1
- `components/app/rich-text-content.tsx`, `lib/content/rich-text-security.ts`, `lib/rich-text/extensions.ts` inline/preview attachment rendering and storage prep — added Turn 3
- `lib/domain/comment-threads.ts`, work-item/document comment reply flattening, and delete cleanup — added Turn 3
- `components/app/screens/inbox-row.tsx` notification row preview removal — added Turn 3
- `app/api/attachments/*`, `lib/server/convex/documents.ts`, `lib/server/scoped-read-models.ts` — added Turn 1
- `convex/app/{assets,data,document_handlers,cleanup,workspace_team_handlers}.ts`, `convex/validators.ts` — added Turn 1
- `lib/store/app-store-internal/{domain-updates,slices/work-document-actions}.ts` — added Turn 1
- focused upload tests in `tests/components`, `tests/lib/domain`, and `tests/lib/store` — added Turn 1

## Hotspots

- Attachment target auth and tenancy for conversation uploads — added Turn 1
- File type validation and SVG rejection for rich-text inserted files — added Turn 1
- Git working-tree review limitation from missing base blob for `components/app/rich-text-editor/toolbar.tsx` — added Turn 1
- Deferred attachment partial-failure/retry behavior — added Turn 3
- Blob URL admission while editing vs storage-time rejection — added Turn 3
- Work-item detail deferred-upload parity for comments/replies/edits — added Turn 3
- Inline image reference to image preview conversion — added Turn 3

## Review status

| Field | Value |
|-------|-------|
| **Review started** | `2026-06-04 08:08:10 BST` |
| **Last reviewed** | `2026-06-04 12:32:11 BST` |
| **Total turns** | `3` |
| **Open findings** | `0` |
| **Resolved findings** | `5` |
| **Accepted findings** | `0` |

## Turn 3 — 2026-06-04 12:32:11 BST

| Field | Value |
|-------|-------|
| **Commit** | `aa48536f7ebb13ec2053aa8b9e0478e6986a0041` |
| **IDE / Agent** | `Codex` |

**Summary:** Reviewed the current thread's attachment/rich-text/chat-files/comment diff only, using architecture standards first and a scoped deep diff review second. Fixed issues found during the review: type-safe selected-node handling, transactional deferred-upload flushing, retry reuse for already uploaded pending files, storage-time blob stripping, missing inline-image-reference-to-preview conversion, and work-item detail deferred-upload flush parity.

**Outcome:** scoped all clear with low-risk visual unknowns. No open Critical, High, or Medium findings remain for this thread's diff.

**Risk score:** medium — broad shared rich-text UI, serializer/sanitizer contracts, optimistic store paths, Convex cleanup, and visible chat/channel/work-item surfaces changed.

**Change archetypes:** shared rich-text contract, deferred async upload, optimistic state, backend cleanup, presentation tabs/list UI, comment threading.

**Intended change:** support device image/file attachments in chats, channel posts/comments/replies, and work-item comments/replies; support preview vs inline rendering; keep sidebar attachments inline; add chat/channel Files views; remove nested replies; fix parent hover action leakage; remove notification list content previews.

**Intent vs actual:** aligned for the scoped thread. Storage bucket/model changes were intentionally not introduced. The implementation uses existing Convex storage attachment rows and rich-text content references as the render/source path.

**Confidence:** medium-high — typecheck, scoped ESLint, and focused unit/component/store/Convex tests passed. Confidence is scoped because the broader dirty tree was not reviewed and an authenticated browser visual smoke was not possible from the available tooling.

**Coverage note:** Pass A checked pending upload failure/retry, blob URL persistence, chat/channel/work-item submit and edit paths, inline vs preview image behavior, files-list derivation, reply flattening, and delete cleanup. Pass B checked ownership boundaries: editor middleware owns pending blobs and node conversion, sanitizer/storage prep owns persistence safety, read components own display mode, stores/Convex own optimistic and backend lifecycle rules.

**Finding triage:** all live findings found in Turn 3 were fixed in-tree. Prior RTA-001 remains resolved.

**Static/analyzer evidence:** Fallow/static inventories were not used. Scoped ESLint on the thread files passed with `--max-warnings 0`; CSS was excluded because this repo's ESLint config does not lint CSS files.

**Architecture impact:** improved for this scope. The final shape keeps upload policy centralized, avoids per-surface upload implementations, keeps blob-local state out of persisted content, enforces reply flattening in both frontend store and Convex handler, and routes work-item detail comments/replies through the same deferred-upload boundary as sibling surfaces.

**Deep-review evidence:** dual pass completed. Correctness/safety found and fixed four live issues. Maintainability/structure found no remaining blocker; residual content-parsed Files views are accepted for this no-storage-model-change scope.

**Bug classes / invariants checked:** partial async failure, retry idempotency/cost, local blob persistence, selected-node type narrowing, image preview/inline conversion, work-item detail submit bypass, reply-depth authority, parent/child hover grouping, sidebar inline rendering, attachment chip icon kind, content-derived files list, delete cascade URL matching.

**Branch totality:** reviewed only the upload/comment/chat/files diff from this thread, not the whole dirty tree. Mixed staged/unstaged state was handled by reviewing working-tree files and scoped `HEAD` diffs where available.

**Sibling closure:** checked chat send/edit, channel new/edit/reply/comment edit, work-item UI comments/replies/edits, work-item detail main/sidebar comments/replies/edits, shared rich-text editor insertion/toolbar/button/slash paths, rich-text render/sanitizer, store mutations, Convex comment/channel/chat delete handlers, and notification row rendering.

**Remediation impact surface:** fixes touched shared middleware and the one drifted work-item detail surface, with tests added at the middleware/security helper layer. No route/schema/storage model changes were added in this turn.

**Residual risk / unknowns:** visual smoke of authenticated chat/channel/work-item screens was not run because Playwright is not installed in this session and the running local app redirects to `/login`. Conversation Files views still derive from rich-text content rather than a per-message attachment read model by design for this scope.

### Validation

- `pnpm typecheck` — passed
- `pnpm vitest run tests/components/rich-text-editor-helpers.test.tsx tests/components/rich-text-content.test.tsx tests/lib/content/rich-text-security.test.ts tests/lib/domain/input-constraints.test.ts` — passed; 4 files, 40 tests
- `pnpm vitest run tests/components/chat-thread.test.tsx tests/components/channel-ui.test.tsx tests/components/workspace-chats-screen.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/inbox-ui.test.tsx tests/lib/store/work-comment-actions.test.ts tests/lib/store/collaboration-channel-actions.test.ts tests/convex/comment-handlers.test.ts` — passed; 8 files, 119 tests
- `pnpm vitest run tests/lib/domain/file-uploads.test.ts tests/lib/domain/comment-threads.test.ts tests/lib/store/work-document-actions.test.ts tests/convex/document-handlers.test.ts tests/convex/cleanup.test.ts tests/components/collaboration-loading.test.tsx` — passed
- `pnpm vitest run tests/components/work-item-detail-screen.test.tsx tests/lib/store/work-comment-actions.test.ts tests/convex/comment-handlers.test.ts` — passed; 3 files, 60 tests
- `pnpm exec eslint <scoped thread files> --max-warnings 0` — passed
- `curl -I --max-time 10 http://localhost:3000` — passed; local Next server reachable and returned `307` to `/login`
- Playwright browser smoke — not run; `playwright` module not installed

### Branch-totality proof

- **Non-delta files/systems re-read:** shared file policy, Tiptap extension schema, pending upload middleware, upload insertion/button, sanitizer/storage prep, read-side rich-text rendering, chat/channel/work-item composers, store comment/channel/document upload actions, Convex comment/channel/chat cleanup handlers, and review history.
- **Prior open findings rechecked:** none open in this review file.
- **Prior resolved/adjacent areas revalidated:** RTA-001 SVG admission remains covered by shared file policy tests; upload target auth and Convex metadata validation stayed in existing handlers.
- **Hotspots or sibling paths revisited:** pending upload failure and retry, raw blob storage, chat edit path, channel edit/reply/comment edit paths, work-item UI and detail comment/reply/edit paths, parent/child hover groups, and sidebar inline attachment rendering.
- **Dependency/adjacent surfaces revalidated:** `RichTextContent` image preview dialog, `attachmentReference` serialization, message link normalization exemption, comment descendant delete collection, and content-referenced attachment cleanup.
- **Why this is enough:** the riskiest bug family was cross-surface drift around a shared rich-text/upload invariant. The review attacked that family at the middleware, storage-prep, UI submit, optimistic store, and Convex authority boundaries, with focused regression coverage for the newly fixed failure modes.

### Challenger pass

- `done` — assumed one serious issue remained and attacked partial upload failure/retry, blob persistence, work-item detail bypass, and inline/preview reverse conversion. The pass found live issues that were fixed before this all-clear.

### Resolved / Carried / New findings

#### RTA-002 — Resolved — Deferred upload partial failure could lose retry state

- **Severity:** medium
- **Bug class:** async partial failure / optimistic content persistence
- **Evidence:** `flushPendingAttachmentUploads` deleted and revoked each blob URL immediately after its individual upload succeeded. If a later file failed, retry could no longer resolve the earlier blob still present in editor HTML.
- **Fix:** deferred deletion/revocation until all replacements are ready and kept pending mappings on failure.
- **Prevention:** regression test in `tests/components/rich-text-editor-helpers.test.tsx`.

#### RTA-003 — Resolved — Deferred upload retry could duplicate already uploaded files

- **Severity:** medium
- **Bug class:** retry idempotency / storage cost
- **Evidence:** after RTA-002's safe retry fix, a successful first upload followed by a failed second upload would re-upload the first file on retry.
- **Fix:** cached successful pending blob-to-file URL replacements until the whole flush succeeds; retry only uploads missing files.
- **Prevention:** regression assertion that retry uploads only the second file.

#### RTA-004 — Resolved — Local blob URLs could reach storage preparation

- **Severity:** medium
- **Bug class:** storage contract / local URL leakage
- **Evidence:** the sanitizer must allow `blob:` for live editor previews, but storage prep reused the same sanitizer and could preserve local-only blob URLs if a submit path failed to flush.
- **Fix:** added storage-prep stripping for local blob image/link URLs while leaving live editor sanitization unchanged.
- **Prevention:** security regression test proving edit-time blob preservation and storage-time blob removal.

#### RTA-005 — Resolved — Work-item detail reply/edit composers bypassed deferred flush

- **Severity:** medium
- **Bug class:** sibling surface drift / submit bypass
- **Evidence:** work-item detail reply/edit rich-text editors had upload support but did not use the deferred-upload prop and their handlers did not flush pending uploads.
- **Fix:** enabled deferred uploads for work-item detail comment/reply/edit composers and flushed pending attachments before store mutation.
- **Prevention:** sibling sweep across chat, channel, work-item UI, and work-item detail upload call sites; existing work-item detail/comment tests rerun.

#### RTA-006 — Resolved — Inline image references could not switch back to previews

- **Severity:** medium
- **Bug class:** missing interaction variant
- **Evidence:** selected image previews had an overlay to become inline references, but selected inline image references had no reverse conversion path.
- **Fix:** added selected attachment-reference-to-image-preview conversion and overlay for image inline references only.
- **Prevention:** editor helper regression test for `convertSelectedEditorAttachmentReferenceToPreview`.

### Recommendations

1. **Fix first:** no remaining blocker in this scoped thread diff.
2. **Then address:** run an authenticated browser smoke manually or with a browser tool that has project auth to visually check chat header tabs, files list rows, image preview sizing, and editor conversion overlays.
3. **Patterns noticed:** keep future attachment lifecycle changes behind the pending-upload middleware and storage-prep boundary; do not solve individual composer bugs locally.
4. **Suggested approach:** if the Files view later needs management, filtering, or deletion, add a real conversation attachment read model instead of continuing to expand content parsing.
5. **Architecture transition:** no storage bucket/model transition was performed in this turn, matching the user's clarified scope.
6. **Defer on purpose:** full dirty-tree review and unrelated `.reviews` areas remain out of scope.

## Turn 2 — 2026-06-04 08:18:49 BST

| Field | Value |
|-------|-------|
| **Commit** | `aa48536f7ebb13ec2053aa8b9e0478e6986a0041` |
| **IDE / Agent** | `Codex` |

**Summary:** Ran a final deep diff-review loop for this thread's upload work only. Rechecked the shared file policy, rich-text upload helper/button, chat/channel/work-item composer wiring, client store validation, attachment API/schema contracts, Convex target auth, invalidation, and cleanup paths.

**Outcome:** scoped all clear for the upload-thread diff. No new Critical, High, or Medium findings were found in the final loop.

**Risk score:** medium — the reviewed scope still touches shared rich-text UI, route/schema contracts, storage metadata validation, auth, and cleanup.

**Change archetypes:** shared contract, backend auth/storage, rich-text UI, optimistic state, cleanup cascade.

**Intended change:** final review pass for uploaded images/files in posts, chats, comments, replies, and work item detail surfaces.

**Intent vs actual:** implementation remains aligned with the requested capability. It uses the existing Convex attachment/storage architecture and adds `conversation` as an attachment target for chat/channel rich-text content.

**Confidence:** high for the scoped upload diff — final focused tests, typecheck, and lint all passed. Confidence remains scoped because the broader dirty tree contains unrelated changes and full Git diff commands are still blocked by the missing toolbar base blob.

**Coverage note:** Pass A rechecked unsafe file admission, backend authorization, route/schema target compatibility, upload failure state, read-only/client validation variants, conversation invalidation, and cleanup. Pass B rechecked structure and ownership: shared domain policy, reusable upload button, existing rich-text upload helper reuse, store command orchestration, thin API transport, and Convex authority.

**Finding triage:** no new findings. Prior RTA-001 remains resolved and covered by regression tests.

**Static/analyzer evidence:** `pnpm lint` passed. Fallow advisory inventories were not used as a release gate for this scoped feature.

**Architecture impact:** clean for this scope. The final pass confirms ownership stayed in the intended layers: policy in domain, acquisition in UI, optimistic orchestration in store, public validation in route schemas, and authoritative access/storage validation in Convex.

**Deep-review evidence:** dual pass completed again. Correctness/safety found no new blocker. Maintainability/structure found no wrong-layer policy scattering or unnecessary new abstraction.

**Bug classes / invariants checked:** SVG/file admission, HEIC empty MIME image insertion, oversized/empty file rejection, image-only rich-text validation, upload rejection loading reset, conversation target optimistic insertion, chat/channel/work-item composer coverage, read-only target blocking, Convex metadata revalidation, target cleanup.

**Branch totality:** scoped to this thread's upload diff only. Unrelated chat/read-model and spec changes in the dirty tree are intentionally out of scope for this review turn.

**Sibling closure:** rechecked toolbar/slash upload support, compact composer upload button, chat composer, channel new/edit/reply/comment paths, work item inline/detail/sidebar comments and replies, store upload route, server wrappers, Convex handlers, and cleanup filters.

**Remediation impact surface:** no new remediation was required in Turn 2.

**Residual risk / unknowns:** no browser visual smoke was run. Full `git diff` commands still fail until Git object `ae4cdd1ccd232cce0524a9b3790ffb1ccaa56dd2` is restored or the index/base is repaired.

### Validation

- `pnpm vitest run tests/lib/domain/file-uploads.test.ts tests/lib/domain/input-constraints.test.ts tests/components/rich-text-editor-helpers.test.tsx tests/lib/store/work-document-actions.test.ts tests/components/channel-ui.test.tsx tests/components/chat-thread.test.tsx tests/components/workspace-chats-screen.test.tsx tests/components/work-item-ui-comments-inline.test.tsx tests/components/work-item-detail-screen.test.tsx tests/lib/server/convex-documents.test.ts tests/convex/comment-handlers.test.ts tests/convex/document-handlers.test.ts && pnpm typecheck && pnpm lint` — passed; 12 test files, 175 tests passed, then typecheck and lint passed

### Branch-totality proof

- **Non-delta files/systems re-read:** file upload domain policy, rich-text upload insertion/loading/button/toolbar, upload target schemas, store upload validation/orchestration, Convex attachment access/metadata creation, cleanup and read-model invalidation.
- **Prior open findings rechecked:** none open.
- **Prior resolved/adjacent areas revalidated:** RTA-001 SVG admission remains fixed by explicit image MIME/extension policy and regression tests.
- **Hotspots or sibling paths revisited:** all upload acquisition paths in this thread: chat, channel post, channel comment/reply, work item inline comments, work item detail/sidebar comments, toolbar, and shared rich-text attachment helpers.
- **Dependency/adjacent surfaces revalidated:** server wrapper target types, API schemas, Convex validators, store cleanup filters, and conversation target read-model invalidation.
- **Why this is enough:** the riskiest bug class is bad target/file admission. The final loop attacked that class at the domain policy, client validation, route contract, and Convex authority layers, then ran focused tests for the key variants.

### Challenger pass

- `not needed` — medium risk, not high/critical. A skeptical final pass was still applied to the weakest variants: SVG admission, HEIC empty MIME, conversation target upload, and upload failure cleanup.

### Resolved / Carried / New findings

No new findings.

### Recommendations

1. **Fix first:** no upload-scope fix required.
2. **Then address:** browser smoke can still be useful for icon placement in representative composers, but automated coverage and type/lint checks are clean.
3. **Patterns noticed:** keep future supported-file expansion in the shared domain policy and mirror it with tests.
4. **Suggested approach:** continue routing new upload surfaces through `RichTextUploadButton` and `uploadAttachment` rather than per-screen upload implementations.
5. **Architecture transition:** no new storage bucket is needed for this feature.
6. **Defer on purpose:** broad dirty-tree review and Git object repair are separate from this thread's upload diff.

## Turn 1 — 2026-06-04 08:14:55 BST

| Field | Value |
|-------|-------|
| **Commit** | `aa48536f7ebb13ec2053aa8b9e0478e6986a0041` |
| **IDE / Agent** | `Codex` |

**Summary:** Implemented rich-text file/image uploads for work item comments/replies/details, chats, channel posts, channel comments, and channel replies using the existing Convex storage attachment flow. Added conversation attachment targets, shared file policy, focused tests, and reviewed the upload scope with architecture standards.

**Outcome:** scoped all clear with low-risk unknowns. The upload-feature scope was reviewed after one issue was fixed. The broader dirty worktree contains unrelated chat/read-model changes and was not reviewed here. Full `git diff` is also limited by a missing Git base object for `components/app/rich-text-editor/toolbar.tsx`; that file was inspected from the working copy instead.

**Risk score:** medium — shared UI, route/schema, storage, auth, and read-model invalidation contracts changed.

**Change archetypes:** shared contract, backend auth/storage, rich-text UI, optimistic state, cleanup cascade.

**Intended change:** allow users to upload device images and common files into rich-text posts/chats/comments/replies while preserving existing storage architecture and permission boundaries.

**Intent vs actual:** matches the request. No new bucket was introduced; the existing Convex storage attachment model now accepts `conversation` as a target for chats/channels while retaining work item/document targets.

**Confidence:** medium-high — focused tests, typecheck, and lint passed; confidence is reduced only by the repository missing-object issue preventing a single full `git diff` view.

**Coverage note:** reviewed shared upload policy, rich-text insertion/loading state, client validation, API schemas, Convex create/delete access, conversation read-model invalidation, cleanup cascades, and UI call sites for chat/channel/work item composers.

**Finding triage:** one live issue found and fixed during review: broad `image/*` validation would have accepted SVG. The policy now accepts explicit device/raster image MIME types/extensions and rejects declared SVG.

**Static/analyzer evidence:** Fallow advisory inventories exist in the repo but were not used as a cleanliness gate for this feature. `pnpm lint` passed.

**Architecture impact:** improves ownership by centralizing upload policy in `lib/domain/file-uploads.ts`, keeping storage/auth enforcement in Convex handlers, using the Next routes as thin transport, and keeping UI components as acquisition affordances only.

**Deep-review evidence:** dual pass completed. Correctness/safety found and fixed the SVG file-policy issue; auth, tenancy, backend validation, and cleanup variants were checked. Maintainability/structure found no remaining blocker; the new upload button reuses existing rich-text upload helpers instead of creating per-screen upload logic.

**Bug classes / invariants checked:** file type admission, file size admission, conversation write access, chat participant access, read-only role blocking, target team scoping, storage metadata validation, attachment target invalidation, deletion cascade cleanup, image-only rich-text validation.

**Branch totality:** scoped to upload-related changes. Existing unrelated changed files and `.spec/chat-message-model-stability` artifacts were not reviewed as part of this turn.

**Sibling closure:** checked chat composer, channel new/edit/reply/comment paths, work item inline/detail/sidebar comment and reply paths, toolbar/slash upload paths, API route schemas, client store validation, Convex handlers, and cleanup paths.

**Remediation impact surface:** SVG policy fix touched shared file policy and tests only. It did not change route shape or storage records.

**Residual risk / unknowns:** no browser visual smoke was run. `git diff --stat` and `git diff --name-only` fail until the missing Git object `ae4cdd1ccd232cce0524a9b3790ffb1ccaa56dd2` is restored or the index/base is repaired.

### Validation

- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — passed with Git missing-object caveat
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — passed as context collection
- `pnpm vitest run tests/lib/domain/file-uploads.test.ts tests/lib/domain/input-constraints.test.ts tests/components/rich-text-editor-helpers.test.tsx` — passed
- `pnpm vitest run tests/components/channel-ui.test.tsx tests/components/chat-thread.test.tsx tests/components/workspace-chats-screen.test.tsx` — passed
- `pnpm vitest run tests/components/work-item-ui-comments-inline.test.tsx tests/components/work-item-detail-screen.test.tsx tests/lib/store/work-document-actions.test.ts tests/convex/document-handlers.test.ts` — passed
- `pnpm vitest run tests/lib/server/convex-documents.test.ts tests/convex/comment-handlers.test.ts tests/convex/document-handlers.test.ts` — passed
- `pnpm vitest run tests/lib/store/work-document-actions.test.ts tests/lib/domain/file-uploads.test.ts tests/components/rich-text-editor-helpers.test.tsx` — passed
- `pnpm typecheck` — passed after final edit
- `pnpm lint` — passed before final readability-only type formatting; the subsequent `pnpm typecheck` also passed

### Branch-totality proof

- **Non-delta files/systems re-read:** diff-review gates, architecture standards, rich-text upload helpers, shared file policy, API attachment routes, Convex attachment handlers, client store upload action, scoped read-model invalidation, and cleanup cascades.
- **Prior open findings rechecked:** no upload-specific open review findings existed in `.reviews`.
- **Prior resolved/adjacent areas revalidated:** existing work item/document attachment upload behavior remains routed through the same store and Convex create/delete handlers.
- **Hotspots or sibling paths revisited:** channel post edit/reply/comment, chat composer, work item inline/detail/sidebar composers, toolbar upload, slash attachment command, server route schemas, and Convex target access.
- **Dependency/adjacent surfaces revalidated:** shared `attachmentTargetTypes`, Convex validator union, server wrapper target union, and store domain cleanup filters.
- **Why this is enough:** the feature adds a new target type and new UI affordances but keeps persistence in the existing attachment flow. The reviewed paths cover each new acquisition surface and the authoritative backend create/delete path.

### Challenger pass

- `not needed` — risk is medium, not high/critical. A focused skeptical pass was still applied to file admission and conversation auth; it found the SVG issue that was fixed.

### Resolved / Carried / New findings

#### RTA-001 — Resolved — SVG accepted as an image attachment

- **Severity:** medium
- **Bug class:** unsafe file admission / rendered rich-text attachment
- **Evidence:** the initial shared policy accepted every `image/*`, which includes `image/svg+xml`.
- **Impact:** uploaded SVGs could be inserted directly as rich-text images or served as attachment content, broadening the requested device-image/file support beyond the intended safe formats.
- **Fix:** changed `lib/domain/file-uploads.ts` to accept explicit image MIME types/extensions and reject declared SVG; added regression coverage in `tests/lib/domain/file-uploads.test.ts`.
- **Verification:** focused upload tests, typecheck, and lint passed.

### Recommendations

1. **Fix first:** repair the missing Git object or refresh the index/base so full local diff commands work again before committing.
2. **Then address:** run browser smoke on representative chat/channel/work-item composer screens if visual confidence is needed before release.
3. **Patterns noticed:** file policy belongs in the domain layer and backend must re-check it after storage upload.
4. **Suggested approach:** keep future attachment target additions going through `attachmentTargetTypes`, store validation, Convex target resolution/access, and cleanup together.
5. **Architecture transition:** no separate storage bucket is needed while Convex storage remains the attachment authority.
6. **Defer on purpose:** conversation attachment rows are not hydrated into conversation read models because rendering uses the rich-text URL and cleanup is target cascade-owned; add read-model hydration only if a separate conversation attachment management UI is introduced.

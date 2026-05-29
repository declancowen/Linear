# Work Surface And Desktop Release Review

## Review Status

| Field         | Value                |
| ------------- | -------------------- |
| Last reviewed | 2026-05-29 16:29 BST |
| Total turns   | 2                    |
| Open findings | 0                    |

## Scope

- parent grouping in group-by and subgroup flows across team/workspace/personal work surfaces
- create-view filter dropdown parity and scroll behavior
- work item detail sub-item filtering, grouping, properties, and sidebar cleanup
- parent-group lanes promoting the parent item into the group header with editable properties and an Open affordance
- platform-aware desktop download links for macOS and Windows
- macOS arm64/x64 and Windows arm64/ia32/x64 release packaging and GitHub release publishing

## Turn 2 - 2026-05-29 16:16 BST

**Outcome:** No open branch-specific findings after the rerun. The parent-group follow-up is clean in the current tree.

**Risk:** High. This turn touched the grouped work-surface rendering path, which controls hierarchy display, drag/drop grouping, inline property editing, and board/list parity.

**Review focus:**

- Create-view filter popovers now use an explicit bounded viewport so the inner filter list can scroll inside the dropdown instead of being clipped by the modal/footer area.
- Parent group-by/subgroup now removes the parent item from normal cards/rows and promotes it into the existing group lane/header container.
- The promoted parent header uses the same group lane shell as other groupings, keeps top/bottom padding inside the group bar, shows the parent ID/title/count, exposes an explicit `Open` link, and renders the same editable display properties as the item row/card.
- Parent grouping remains a direct-parent hierarchy operation: dragging between parent lanes changes `parentId`; dragging between non-parent lanes preserves the existing parent relationship.
- Editable empty-group generation no longer recreates a stray `No parent` lane when the only parentless visible item is the promoted parent.
- The `showChildItems` visibility path now uses the promoted-parent display item set so child rows/cards are not hidden by a parent that is no longer rendered as a row/card.

**Architecture review:**

- The hierarchy grouping invariant remains split at the correct boundaries: domain selectors own group key derivation and available group keys; work-surface presentation owns whether a parent item is rendered as a group header.
- The parent header reuses existing inline property controls, create/drag default helpers, and group container/drop targets instead of introducing a parallel parent-lane component model.
- The contextual naming rule remains presentation-owned through the grouping-label helper, while persisted view schema/type support for `parent` remains in the Convex/domain boundary.

**Verification:**

- `pnpm exec vitest run tests/components/group-chip-popover.test.tsx tests/components/create-dialogs.test.tsx` — 2 files, 39 tests passed.
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx tests/lib/domain/view-item-level.test.ts` — 2 files, 95 tests passed.
- `pnpm exec vitest run tests/components/group-chip-popover.test.tsx tests/components/work-surface-view.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/property-select.test.tsx tests/lib/domain/view-item-level.test.ts tests/components/desktop-update-controller.test.tsx tests/lib/browser/desktop-download-eligibility.test.ts tests/lib/desktop-update-policy.test.ts tests/scripts/publish-electron-github-release.test.ts tests/scripts/shared-helpers.test.ts` — 10 files, 162 tests passed.
- `pnpm exec vitest run tests/components/group-chip-popover.test.tsx tests/components/create-dialogs.test.tsx tests/components/work-surface-view.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/property-select.test.tsx tests/lib/domain/view-item-level.test.ts tests/components/desktop-update-controller.test.tsx tests/lib/browser/desktop-download-eligibility.test.ts tests/lib/desktop-update-policy.test.ts tests/scripts/publish-electron-github-release.test.ts tests/scripts/shared-helpers.test.ts` — 11 files, 194 tests passed after the create-view dropdown viewport fix.
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `git diff --check -- . ':!.reviews/'`
- `node --check scripts/package-electron-windows.mjs`
- `node --check scripts/package-electron-mac.mjs`
- `node --check scripts/publish-electron-github-release.mjs`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh`

**Branch-totality proof:**

- Re-read the current work-surface parent grouping path, direct-parent selector logic, group/drop rendering paths, previous drag fix, and review-gate/all-clear requirements.
- Rechecked the desktop download/release script surfaces through the broader focused suite and syntax checks; no new release-contract finding appeared from this turn.
- Preflight Fallow/static evidence still reports baseline advisory inventories, including a changed-file-audit tool/config error from the collector, but not a branch-specific blocker from this diff.
- Browser smoke remains intentionally skipped because the user said they will inspect the UI manually.

**Challenger pass:** Done. The likely remaining bug class was parent-promotion hiding children or leaving a duplicate parent/empty lane. The current tests now cover board/list parent header promotion, editable properties in the header, absence of the duplicate parent card/link, absence of an accidental `No parent` lane, and the `showChildItems` variant.

**Diff-review result:** No open Critical/High findings remain for the local changes reviewed in this turn.

## Turn 1 - 2026-05-29 15:55 BST

**Outcome:** No open branch-specific findings remain after the local diff review with architecture standards.

**Risk:** High. The diff spans shared work-surface behavior, hierarchy updates, desktop distribution contracts, and release automation.

**Resolved during review:**

| Finding | Status | Bug class | Missed invariant / variant | Action |
| --- | --- | --- | --- | --- |
| Dragging an item between non-parent group lanes could clear `parentId` | Resolved | hierarchy mutation / contract encoding | Only parent/epic/feature lanes should mutate parent relationships; status, priority, assignee, label, etc. must not clear hierarchy | Group target drag now applies only the field patch it derives. Regression tests cover preserving parent links on status lanes and changing/clearing parent links on parent lanes. |
| Desktop release flow needed to match the new multi-platform asset contract | Resolved | release artifact contract | Publisher/preflight cannot require Windows assets unless CI also builds and downloads them before publish | Release workflow now has macOS and Windows build jobs, downloads both artifact sets, restores the macOS app bundle for preflight, and publishes all required assets. |

**Architecture review:**

- Parent grouping is encoded at the domain/view contract boundary: `GroupField` validators/types include `parent`, `getGroupValue` derives direct parent labels, and create/drag defaults resolve parent IDs through shared screen helpers.
- Contextual parent labels live in a small presentation helper, so issue boards can say `Issue`/`No issue` while task/private surfaces say `Task`/`No task` without baking copy into selectors.
- Work item detail sub-item filter/group/property controls reuse the viewer view-config boundary and intentionally hide subgrouping and sidebar action controls.
- Desktop download targeting is centralized in `lib/desktop/update-policy.ts` and `lib/browser/desktop-download-eligibility.ts`; shell/controller code consumes the shared map instead of hardcoding one artifact URL.
- Release artifact checks are enforced in packaging, preflight, publisher, and GitHub Actions so web download URLs, updater manifests, and GitHub release assets agree.

**Verification:**

- `pnpm exec vitest run tests/components/group-chip-popover.test.tsx tests/components/work-surface-view.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/property-select.test.tsx tests/lib/domain/view-item-level.test.ts tests/components/desktop-update-controller.test.tsx tests/lib/browser/desktop-download-eligibility.test.ts tests/lib/desktop-update-policy.test.ts tests/scripts/publish-electron-github-release.test.ts tests/scripts/shared-helpers.test.ts` — 10 files, 159 tests passed.
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx` — 76 tests passed after the drag regression coverage was added.
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `git diff --check -- . ':!.reviews/'`
- `node --check scripts/package-electron-windows.mjs`
- `node --check scripts/package-electron-mac.mjs`
- `node --check scripts/publish-electron-github-release.mjs`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh`

**Verification caveat:**

- `pnpm build` was attempted but failed because the sandbox could not fetch Google Fonts (`Geist Mono` and `Noto Sans`). A rerun with network access was requested and declined, so the production build remains the only unverified gate in this pass.
- Browser smoke was skipped because the user will inspect the UI manually.

**Diff-review result:** No open Critical/High findings remain for the local changes reviewed in this turn. Existing Fallow/full-repo advisory inventories surfaced by the preflights are baseline signals, not branch-specific blockers from this diff.

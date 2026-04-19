# Review: UI Template Surfaces And Collaboration

## Project context (captured on Turn 1 — not re-detected on subsequent turns)

| Field | Value |
|-------|-------|
| **Repository** | `Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `ui-templates` |
| **Repo type** | `single repo` |
| **Stack** | `Next.js App Router / Convex / TypeScript / Electron` |
| **Packages affected** | `n/a` |
| **OS** | `Darwin 25.4.0` |
| **Package manager** | `pnpm 10.32.0` |
| **Node** | `v25.8.0` |
| **Python** | `n/a` |

## Scope (cumulative — updated each turn as new files are touched)

Files and areas reviewed across all turns:
- `components/app/screens/create-work-item-dialog.tsx` — create-work modal surface and property chips
- `components/app/collaboration-screens/channel-ui.tsx` — channel post cards and new-post composer affordances
- `components/app/collaboration-screens/chat-thread.tsx` — chat composer affordances
- `templates/*.html`, `templates/*.js`, `templates/*.css` — imported HTML/CSS reference assets, including duplicate `* 2.*` copies

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-19 18:41:21 BST` |
| **Last reviewed** | `2026-04-19 19:02:00 BST` |
| **Total turns** | `3` |
| **Open findings** | `0` |
| **Resolved findings** | `5` |
| **Accepted findings** | `0` |

---

## Turn 1 — 2026-04-19 18:41:21 BST

| Field | Value |
|-------|-------|
| **Commit** | `db6459f` |
| **IDE / Agent** | `unknown` |

**Summary:** The branch successfully ports a large amount of template styling, but it still introduces several dead affordances that the product does not support. The remaining issues are concentrated in the primary create-work flow, collaboration composers, and the reference-assets folder, where accidental duplicate files were committed.

| Status | Count |
|--------|-------|
| Findings | `4` |

### Findings

#### B1-01 [BUG] High — `components/app/screens/create-work-item-dialog.tsx:1324` — Create-work modal still ships unsupported property chips

**What's happening:**
The create-work modal still renders `Due date`, `Milestone`, and `Estimate` chips as disabled controls even though those flows do not exist in the current product contract. This is exactly the UI drift the branch was supposed to remove.

**Root cause:**
The modal was ported from the HTML template by preserving placeholder chips instead of mapping only the properties that the real create flow can submit today.

**Codebase implication:**
This keeps the most important authoring surface out of sync with the actual backend-supported create payload. Users get a form that advertises scheduling and estimation controls the app cannot honor, and future cleanup gets harder because downstream work has to distinguish real inputs from decorative placeholders.

**Solution options:**
1. **Quick fix:** Remove the three disabled chips from the modal footer row.
2. **Proper fix:** Define the create-modal chip row from an explicit list of supported create-time fields so template-only placeholders cannot leak back in.

**Investigate:**
Confirm whether any near-term API work is planned for due date, milestone, or estimate on item creation. If not, these chips should be deleted rather than hidden behind `disabled`.

> Disabled placeholder chips remain at `create-work-item-dialog.tsx:1324-1352`.

#### B1-02 [BUG] High — `components/app/collaboration-screens/channel-ui.tsx:166` — Channel UI still contains multiple non-functional action controls

**What's happening:**
The channel surface adds several controls that do not work: a disabled `Copy link` action on post cards, disabled formatting/link/attach controls in the new-post composer, and a disabled `Preview` button.

**Root cause:**
The template composition was ported directly into the live channel UI, but placeholder actions from the reference HTML were left in place instead of being mapped to current product capabilities.

**Codebase implication:**
The forum-style channel surface now communicates functionality that does not exist, and it does so in the primary post-authoring path. That undermines confidence in the feature and creates more places where future contributors must reverse-engineer whether a control is real or decorative.

**Solution options:**
1. **Quick fix:** Remove the disabled `Copy link`, formatting/link/attach toolbar buttons, and `Preview` button.
2. **Proper fix:** Build the channel composer action row from the same capability gates used by the rich-text editor and collaboration APIs so only implemented actions render.

**Investigate:**
Check whether there is an existing channel-post permalink flow or preview route elsewhere in the product. If not, these controls should be deleted instead of visually retained.

> Non-functional controls remain at `channel-ui.tsx:166-173`, `channel-ui.tsx:557-605`, and `channel-ui.tsx:632-639`.

#### B1-03 [BUG] Medium — `components/app/collaboration-screens/chat-thread.tsx:104` — Chat composer now advertises unsupported message actions

**What's happening:**
The chat composer renders disabled `Attach`, `Mention`, and `Link item` buttons in the primary message-entry row even though those actions are not implemented.

**Root cause:**
The chat composer was restyled toward the template shell, but the extra action buttons were introduced as static UI rather than being driven by real chat capabilities.

**Codebase implication:**
This creates the same product-parity problem as the create-work and channel surfaces, but in a high-frequency flow. Because chat is used repeatedly, users will hit dead controls constantly and assume the feature is partially broken.

**Solution options:**
1. **Quick fix:** Remove the disabled attach/mention/link buttons from the composer row.
2. **Proper fix:** Source chat composer actions from a shared collaboration capability model so unsupported actions never render in chat or channels.

**Investigate:**
Confirm whether chat should support rich mentions beyond the existing editor mention flow. If mentions are already handled inline by typing `@`, the disabled explicit mention button should be removed rather than later wired up separately.

> Dead composer actions remain at `chat-thread.tsx:104-143`.

#### O1-04 [OBSERVATION] Medium — `templates/* 2.*` — Duplicate template reference files were committed alongside the canonical copies

**What's happening:**
The branch includes duplicate template artifacts like `templates/board 2.html`, `templates/chat 2.html`, `templates/_icons 2.js`, and similar `* 2.*` copies next to the canonical reference files.

**Root cause:**
The template import added filesystem duplicates instead of curating a single source-of-truth set of reference assets.

**Codebase implication:**
This does not break runtime behavior, but it makes the `templates/` directory ambiguous for future UI work. Anyone using the folder as the design source now has to guess which copy is authoritative, and automated tooling or future reviewers may inspect the wrong file.

**Solution options:**
1. **Quick fix:** Delete all `* 2.*` duplicates and keep one canonical copy per template asset.
2. **Proper fix:** Add a small `templates/README.md` documenting the intended reference set and naming conventions so accidental duplicates are easier to catch in future diffs.

**Investigate:**
Compare one or two duplicate pairs to confirm they are byte-for-byte duplicates before deleting them. If any differ, decide which version is the intended source of truth and rename it accordingly.

> Duplicate assets include `templates/board 2.html`, `templates/chat 2.html`, `templates/channel 2.html`, `templates/create-modal 2.html`, `templates/item-sidebar 2.html`, `templates/projects 2.html`, `templates/property-dropdown 2.html`, `templates/table 2.html`, `templates/views 2.html`, plus matching duplicated JS/CSS helpers.

### Recommendations

1. **Fix first:** Remove the dead controls in the create-work modal and the collaboration composers. Those are the most user-visible product mismatches and they directly violate the “no unsupported UI” constraint for this branch.
2. **Then address:** Delete the duplicated `templates/* 2.*` files so the design-reference folder has a single authoritative copy of each asset.
3. **Patterns noticed:** The branch repeatedly ports template chrome faster than it reconciles actual product capability. The recurring issue is not styling quality — it is capability drift.
4. **Suggested approach:** Do one tight cleanup pass per surface: create-work modal, chat composer, channel composer/post card, then template folder hygiene. After that, re-run a focused diff review to confirm no other dead affordances remain.

---

## Turn 2 — 2026-04-19 18:56:22 BST

| Field | Value |
|-------|-------|
| **Commit** | `db6459f` |
| **IDE / Agent** | `unknown` |

**Summary:** The prior cleanup pass resolved the four Turn 1 findings in the working tree: the dead create-work chips are gone, the dead chat/channel controls are gone, and the duplicate template copies are deleted. One remaining mismatch is still present in the create-view modal, where an informational route chip is rendered as a disabled button even though there is no direct route-picker interaction there.

| Status | Count |
|--------|-------|
| Findings | `1` |
| Resolved | `4` |

### Status updates

- `B1-01` Resolved — the unsupported `Due date`, `Milestone`, and `Estimate` chips were removed from `create-work-item-dialog.tsx`.
- `B1-02` Resolved — the disabled `Copy link`, formatting/link/attach toolbar buttons, and `Preview` button were removed from `channel-ui.tsx`.
- `B1-03` Resolved — the disabled `Attach`, `Mention`, and `Link item` buttons were removed from `chat-thread.tsx`.
- `O1-04` Resolved — the duplicate `templates/* 2.*` files were deleted from the working tree.

### Findings

#### B2-01 [BUG] Medium — `components/app/screens/create-view-dialog.tsx:402` — Create-view modal still renders an informational route chip as a disabled button

**What's happening:**
The create-view modal still renders the resolved route chip using a disabled `<button>`. There is no click behavior on that control; the route is derived from the selected scope and entity and cannot actually be chosen from this chip.

**Root cause:**
The create modal shell reused the same chip-button styling pattern as interactive create-work controls, but this specific route display is read-only state, not an actionable control.

**Codebase implication:**
This leaves one more template-style false affordance in a core create surface. The modal visually suggests a route picker that does not exist, which is the same product-parity problem the recent cleanup was intended to remove.

**Solution options:**
1. **Quick fix:** Replace the disabled `<button>` with a non-interactive `<div>` or `<span>` using the same visual styling.
2. **Proper fix:** Split “interactive chip” and “read-only chip” primitives so create surfaces cannot accidentally render read-only state as disabled buttons.

**Investigate:**
Confirm whether route selection is intentionally derived-only for saved views. If direct route picking is not planned, this control should remain purely presentational.

> The disabled route chip remains at `create-view-dialog.tsx:402-410`.

### Recommendations

1. **Fix next:** Replace the disabled route chip in the create-view modal with a read-only presentation element.
2. **After that:** Re-run one final diff review; the branch is otherwise clear of the dead template affordances flagged in Turn 1.

---

## Turn 3 — 2026-04-19 19:02:00 BST

| Field | Value |
|-------|-------|
| **Commit** | `db6459f` |
| **IDE / Agent** | `unknown` |

**Summary:** The create-view route chip has been removed from the working tree, and a focused re-review of the create/chat/channel/sidebar surfaces did not reveal any additional dead affordances of the same kind. The prior open finding is now resolved.

| Status | Count |
|--------|-------|
| Findings | `0` |
| Resolved | `1` |

### Status updates

- `B2-01` Resolved — the read-only route chip was removed from `create-view-dialog.tsx`.

### Findings

No new findings in this turn.

### Recommendations

1. No further issues found in this review slice after the route-chip cleanup.

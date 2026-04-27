# Post-Merge Work Surface Follow-ups

## Scope

- legacy workspace/team edit gating for existing short or blank values
- row/card inline property rendering for empty assignee/project values
- grouped `Add item` defaults for parent-based lanes

## Review Loop

### Turn 1

Reviewed the local diff with an architecture-first pass over the affected families.

Resolved:

- workspace branding updates now allow empty descriptions on edit paths while create remains strict
- team detail updates now allow empty summaries on edit paths while create remains strict
- empty inline assignee/project pills are hidden on editable surfaces
- parent-grouped lane create flows now derive `parentId` from the lane identity instead of the first child row

Open findings from this turn:

- nested parent grouping/subgrouping still preferred the broader parent for `initialType`

### Turn 2

Re-reviewed the lane-default family after the first fix.

Resolved:

- subgroup parent lanes now override broader group parents for `initialType`
- explicit project defaults from grouped lanes are preserved in the create dialog even when a parent is preselected
- parent options now preserve the preselected parent even when the explicit lane project differs from the parent project
- non-project lane flows still inherit the parent project when no explicit lane project default is present

### Turn 3

Re-reviewed the branch after the next diff-review / architecture pass.

Resolved:

- team settings now passes relaxed edit-time summary constraints through the settings-screen `TeamEditorFields`, so the field-level validation UI matches the save guard
- parent-lane default resolution is now scoped to the active team, preventing duplicate `key · title` parents from another team from hijacking create defaults

Verification rerun:

- `pnpm exec tsc --noEmit --pretty false`
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx tests/components/create-dialogs.test.tsx tests/app/api/workspace-profile-route-contracts.test.ts tests/app/api/team-collaboration-route-contracts.test.ts tests/lib/store/workspace-slice.test.ts`

### Turn 4

Re-reviewed the inline property control family after the child-row regression report.

Resolved:

- empty assignee/project controls remain hidden on list and board surface rows
- editable child rows now keep the dashed empty assignee/project controls so users can set those properties inline from the work item detail surface

Verification rerun:

- `pnpm exec tsc --noEmit --pretty false`
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx tests/components/work-surface-view.test.tsx tests/components/create-dialogs.test.tsx tests/app/api/workspace-profile-route-contracts.test.ts tests/app/api/team-collaboration-route-contracts.test.ts tests/lib/store/workspace-slice.test.ts`

## Verification

- `pnpm exec tsc --noEmit --pretty false`
- `pnpm exec vitest run tests/components/create-dialogs.test.tsx tests/components/work-surface-view.test.tsx tests/app/api/workspace-profile-route-contracts.test.ts tests/app/api/team-collaboration-route-contracts.test.ts tests/lib/store/workspace-slice.test.ts`

## Outcome

No open findings remain from the final local diff review.

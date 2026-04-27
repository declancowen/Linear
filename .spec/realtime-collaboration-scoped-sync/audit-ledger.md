# Realtime Collaboration Audit Ledger

Status: code remediation complete, verification in progress
Risk: high
Scope: document collaboration, work-item description collaboration, Yjs/PartyKit handshake, Convex durability, scoped read-model interaction

This ledger consolidates the repeated review-loop findings discovered during the local audit. It is not a remediation plan. It is a current-state defect ledger for the collaboration integration.

## Current progress

- All currently known findings have code-side remediations landed.
- No open findings remain from the repeated local audit loops.
- Automated verification is green:
  - `pnpm vitest run` across `18` collaboration/scoped-sync suites: `109/109` passing
  - `pnpm typecheck` passing
- The remaining gate is manual/browser rollback validation, not additional code discovery.
- Closed in this pass:
  - `2` Full document bodies flowed through general read models and merged back into the shared `documents[]` store domain.
  - `3` Rich-text sync failure shared the global snapshot recovery path.
  - `6` Room bootstrap reused stale cached canonical payloads instead of refetching current Convex state.
  - `7` Collaboration persistence had no version/CAS guard.
  - `12` Collaboration tokens expired after five minutes with no renewal path for reconnect or manual flush.
  - `13` Collaboration persists fanned out collection invalidations on every periodic typing flush.
  - `14` Document title edits in collaboration mode still rewrite the whole editor document from local HTML.
  - `15` `useScopedReadModelRefresh` does not abort or ignore late in-flight responses.
  - `16` Sync timeout and transport failure were conflated in the adapter state model.
  - `17` Work-item description collaboration only existed while the local user was actively editing.
  - `19` Closing the collaborative work-item editor disconnected the room because room ownership was tied to edit mode.
  - `20` Work-item header presence only rendered while the local user was in edit mode.
  - `21` `flushCollaboration()` was not a true durability fence.
  - `22` Legacy document and item-description mutations were unconditional last-write-wins.
  - `23` Collaboration role was minted but not enforced by the room transport.
  - `24` Cached room reuse weakened authorization freshness after reconnect or access changes.
  - `25` Collaboration persists still bumped the global Convex snapshot version.
- No partial findings remain in this pass.

## Open findings

- None currently open in local code review.

## Closed findings

14. Document title edits in collaboration mode no longer rewrite the whole editor document from local HTML.
    - fixed in `components/app/screens/document-detail-screen.tsx`

15. `useScopedReadModelRefresh` now ignores stale in-flight responses after disable/scope transition.
    - fixed in `hooks/use-scoped-read-model-refresh.ts`

2. General read models no longer ship full document bodies except for the active detail/document-description payloads that still need them.
   - fixed in:
     - `lib/scoped-sync/read-models.ts`
     - `lib/store/app-store-internal/slices/ui.ts`
     - `lib/domain/types-internal/models.ts`
     - `lib/domain/selectors-internal/search.ts`
     - `components/app/screens/shared.tsx`

3. Active rich-text sync no longer falls back through global snapshot replacement for collaboration-owned document bodies.
   - fixed in:
     - `lib/store/app-store-internal/runtime.ts`
     - `tests/lib/store/runtime.test.ts`

1. Document bodies now have a single active writer while collaboration owns the editor session.
   - fixed in:
     - `lib/store/app-store-internal/slices/work-document-actions.ts`
     - `components/app/screens/document-detail-screen.tsx`
     - `components/app/screens/work-item-detail-screen.tsx`

4. Collaboration ownership is now expressed through an explicit lifecycle state machine instead of ad hoc mode/connection booleans.
   - fixed in:
     - `hooks/use-document-collaboration.ts`
     - `components/app/screens/document-detail-screen.tsx`
     - `components/app/screens/work-item-detail-screen.tsx`

6. Room bootstrap now refetches canonical document state on every connect instead of trusting warm cached bootstrap payloads.
   - fixed in:
     - `services/partykit/server.ts`

7. Collaboration persistence now enforces a canonical `expectedUpdatedAt` guard when persisting room-backed document state back to Convex.
   - fixed in:
     - `app/api/internal/collaboration/documents/[documentId]/persist/route.ts`
     - `tests/app/api/document-collaboration-route-contracts.test.ts`

8. Last-user-leave durability now goes through fenced flushes on the client and a storage-backed persist path on the server.
   - fixed in:
     - `lib/collaboration/adapters/partykit.ts`
     - `hooks/use-document-collaboration.ts`
     - `services/partykit/server.ts`

12. Collaboration sessions now renew expiring tokens for reconnect and manual flush instead of reusing the original five-minute token indefinitely.
   - fixed in:
     - `lib/collaboration/transport.ts`
     - `lib/collaboration/client-session.ts`
     - `lib/collaboration/adapters/partykit.ts`
     - `tests/lib/collaboration-client-session.test.ts`
     - `tests/lib/collaboration-partykit-adapter.test.ts`

13. Periodic collaboration persists no longer fan out collection-scope invalidations while users are typing.
   - fixed in:
     - `lib/scoped-sync/document-scope-keys.ts`
     - `app/api/internal/collaboration/documents/[documentId]/persist/route.ts`
     - `tests/app/api/document-collaboration-route-contracts.test.ts`

16. Sync timeout no longer reports as a hard transport error in the adapter state model.
   - fixed in:
     - `lib/collaboration/adapters/partykit.ts`
     - `tests/lib/collaboration-partykit-adapter.test.ts`

17. Work-item description collaboration now stays attached for passive viewers instead of only while the local user is editing.
   - fixed in:
     - `components/app/screens/work-item-detail-screen.tsx`

18. Work-item collaborative main-section saves now persist title and description together instead of splitting them into two writes.
   - fixed in:
     - `lib/collaboration/transport.ts`
     - `lib/collaboration/adapters/partykit.ts`
     - `hooks/use-document-collaboration.ts`
     - `components/app/screens/work-item-detail-screen.tsx`
     - `convex/app/collaboration_documents.ts`
     - `app/api/internal/collaboration/documents/[documentId]/persist/route.ts`
     - `tests/lib/collaboration-partykit-adapter.test.ts`
     - `tests/app/api/document-collaboration-route-contracts.test.ts`

19. Closing the collaborative work-item editor no longer disconnects the room solely because local edit mode ended.
   - fixed in:
     - `components/app/screens/work-item-detail-screen.tsx`

20. Work-item header presence now renders independently of local edit mode.
   - fixed in:
     - `components/app/screens/work-item-detail-screen.tsx`

5. Presence ownership is now exclusive by collaboration lifecycle instead of blending websocket awareness and heartbeat.
   - fixed in:
     - `hooks/use-document-collaboration.ts`
     - `components/app/screens/document-detail-screen.tsx`
     - `components/app/screens/work-item-detail-screen.tsx`

21. `flushCollaboration()` is now a true durability fence for manual flushes.
   - fixed in:
     - `lib/collaboration/state-vectors.ts`
     - `lib/collaboration/adapters/partykit.ts`
     - `services/partykit/server.ts`
     - `tests/lib/collaboration-state-vectors.test.ts`
     - `tests/lib/collaboration-partykit-adapter.test.ts`

9. `y-partykit` room options are no longer effectively pinned across idle room reopen.
   - fixed in:
     - `services/partykit/server.ts`
   - note:
     - room session claims had already been moved to room-owned state
     - this pass made idle rooms actually tear down between sessions

10. Idle rooms are now evicted between sessions instead of persisting indefinitely in worker memory.
    - fixed in:
      - `services/partykit/server.ts`

11. Persistence callback failures no longer stay server-local and invisible to active clients.
    - fixed in:
      - `services/partykit/server.ts`

22. Legacy document and item-description PATCH writes now enforce version/CAS guards instead of unconditional last-write-wins.
    - fixed in:
      - `app/api/documents/[documentId]/route.ts`
      - `app/api/items/[itemId]/description/route.ts`
      - `convex/app.ts`
      - `convex/app/document_handlers.ts`
      - `lib/server/convex/documents.ts`
      - `lib/convex/client/work.ts`
      - `lib/store/app-store-internal/slices/work-document-actions.ts`

23. Collaboration role is now enforced at the room transport boundary through read-only websocket sessions for viewers.
   - fixed in:
     - `services/partykit/server.ts`

24. Authorization freshness is now revalidated on every room connect through a fresh canonical bootstrap fetch.
   - fixed in:
     - `services/partykit/server.ts`

25. Collaboration persists no longer flow through the Convex mutation wrapper that bumps the legacy global snapshot version.
   - fixed in:
     - `convex/app.ts`
     - `lib/server/convex/documents.ts`
     - `app/api/internal/collaboration/documents/[documentId]/persist/route.ts`
     - `tests/app/api/document-collaboration-route-contracts.test.ts`

## Audit note

The repeated local review loop has stabilized with no new findings in the latest passes. This ledger is therefore closed for the current remediation tranche, subject to verification and any new issues discovered during runtime/manual validation.

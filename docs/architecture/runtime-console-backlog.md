# Runtime Console Backlog

## Scope

The current console output mixes three categories:

- primary app bugs in the document creation and editor flows
- cross-cutting infrastructure gaps that turn domain failures into generic 500s
- likely environment noise from browser extensions or injected scripts

The fix order should follow dependency direction: infrastructure first, then application identity/state, then presentation/accessibility, then any remaining reproduction-only issues.

## Backlog

1. `P0` Canonical document identity is inconsistent between client and server.
   Impact: newly created documents can exist locally under one id and on the server under another, which drives follow-on update and presence failures.
   Layer: presentation/application/API boundary.
   Fix: use one shared document id across optimistic state and persisted writes, and roll back optimistic state on failure.
   Status: done.

2. `P0` Provider error coercion loses domain semantics when upstream errors are wrapped.
   Impact: domain failures surface as generic `500 Server Error` instead of typed `404/409/403` responses, which obscures root causes across documents and other features.
   Layer: infrastructure/error translation.
   Fix: inspect nested causes and normalized provider messages before mapping to `ApplicationError`.
   Status: done.

3. `P1` Rich text editor registers duplicate Tiptap extensions.
   Impact: repeated `Duplicate extension names found: ['link', 'underline']` warnings and risk of inconsistent editor behavior.
   Layer: presentation/editor composition.
   Fix: configure `StarterKit` to disable extensions that are already registered explicitly.
   Status: done.

4. `P1` Several dialogs violate the accessibility contract expected by Radix.
   Impact: `Missing Description for DialogContent` warnings and poorer screen-reader behavior.
   Layer: presentation/accessibility.
   Fix: ensure each dialog has a `DialogTitle` and `DialogDescription`, including visually hidden descriptions where needed.
   Status: done.

5. `P1` Focus management during create/close flows is brittle.
   Impact: `aria-hidden` focus warnings when a focused input remains active while its surrounding surface is hidden.
   Layer: presentation/focus orchestration.
   Fix: avoid closing create dialogs before writes settle, blur focused elements before modal activation, and route all first-party top-level create-dialog opens through a shared browser transition boundary.
   Status: done for first-party create and dialog flows.

6. `P2` React error `#185` indicates a maximum update depth loop.
   Impact: unstable rendering in at least one modal or create flow.
   Layer: presentation/state synchronization.
   Fix: re-test after the identity, focus, and dialog fixes; if it persists, reproduce in a dev build and isolate the offending state loop.
   Status: pending reproduction after current fixes land.

7. `P3` CSP inline script violation appears likely to be environment-driven.
   Impact: noisy console error, but no local code path currently points to first-party inline script injection.
   Layer: environment/CSP verification.
   Fix: reproduce in a clean browser profile before changing CSP or app script loading.
   Status: pending verification.

8. `P3` `tabs:outgoing.message.ready` listener failures appear external to this codebase.
   Impact: noisy console error with no matching local code path.
   Layer: environment/extension verification.
   Fix: confirm with extensions disabled before allocating engineering time.
   Status: pending verification.

## Current Strategy

- Treat top-level modal activation as shared browser infrastructure rather than per-screen UI behavior.
- Keep domain failures typed at the API boundary so client retries and toasts reflect the real failure.
- Re-check the remaining console noise in a clean browser profile before changing CSP or extension-adjacent code.

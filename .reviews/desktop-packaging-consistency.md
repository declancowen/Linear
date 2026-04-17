# Review: Desktop Packaging Consistency

## Project context (captured on Turn 1 — not re-detected on subsequent turns)

| Field | Value |
|-------|-------|
| **Repository** | `Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `codex/local-changes-2026-04-17` |
| **Repo type** | `single repo` |
| **Stack** | `Electron / Node.js` |
| **Packages affected** | `n/a` |
| **OS** | `Darwin 25.4.0` |
| **Package manager** | `pnpm 10.32.0` |
| **Node** | `v25.8.0` |
| **Python** | `n/a` |

## Scope (cumulative — updated each turn as new files are touched)

Files and areas reviewed across all turns:
- `electron/main.cjs` — Electron desktop entrypoint source
- `dist/electron-stage/electron/main.cjs` — committed staging copy used as the checked-in desktop packaging snapshot

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-17 21:23:04 BST` |
| **Last reviewed** | `2026-04-17 21:23:04 BST` |
| **Total turns** | `1` |
| **Open findings** | `0` |
| **Resolved findings** | `1` |
| **Accepted findings** | `0` |

---

## Turn 1 — 2026-04-17 21:23:04 BST

| Field | Value |
|-------|-------|
| **Commit** | `4ceb62f` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** The committed Electron staging copy had drifted from the actual source entrypoint. That was repo-hygiene rather than runtime behavior, but it was still worth fixing because the stale staging file made the checked-in desktop packaging state misleading.

| Status | Count |
|--------|-------|
| New findings | 1 |
| Resolved during Turn 1 | 1 |
| Carried from previous turns | 0 |
| Accepted | 0 |

### Findings

#### D1-01 ~~[CONSISTENCY] Low~~ → RESOLVED — Committed Electron staging main file had drifted from the source entrypoint
**Where:** [electron/main.cjs](../electron/main.cjs:1), [dist/electron-stage/electron/main.cjs](../dist/electron-stage/electron/main.cjs:1)

**What was wrong:** The committed staging copy still used the older single-path icon lookup, unconditional window icon assignment, and stale `whenReady()` block layout. Because the packaging script stages from `electron/` into a temporary build directory at build time, this mismatch would not change packaged runtime behavior, but it did leave the repository with a misleading checked-in staging snapshot.

**How it was fixed:** [dist/electron-stage/electron/main.cjs](../dist/electron-stage/electron/main.cjs:1) now matches the source logic in [electron/main.cjs](../electron/main.cjs:1) for icon resolution, window icon assignment, and the `whenReady()` block.

**Verified:** Ran:
- `pnpm exec eslint dist/electron-stage/electron/main.cjs --max-warnings 0`
- `git diff --check`

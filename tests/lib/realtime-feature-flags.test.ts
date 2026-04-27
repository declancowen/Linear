import { describe, expect, it } from "vitest"

import {
  isCollaborationEnabled,
  isLegacySnapshotStreamEnabled,
  isScopedSyncEnabled,
  shouldUseLegacySnapshotSync,
} from "@/lib/realtime/feature-flags"

describe("realtime feature flags", () => {
  it("defaults to scoped sync and collaboration", () => {
    expect(isScopedSyncEnabled({})).toBe(true)
    expect(isLegacySnapshotStreamEnabled({})).toBe(false)
    expect(shouldUseLegacySnapshotSync({})).toBe(false)
    expect(isCollaborationEnabled({})).toBe(true)
  })

  it("switches back to legacy snapshot sync when scoped sync is disabled", () => {
    const env = {
      NEXT_PUBLIC_ENABLE_SCOPED_SYNC: "false",
    }

    expect(isScopedSyncEnabled(env)).toBe(false)
    expect(shouldUseLegacySnapshotSync(env)).toBe(true)
  })

  it("forces the legacy snapshot stream when explicitly enabled", () => {
    const env = {
      NEXT_PUBLIC_ENABLE_LEGACY_SNAPSHOT_STREAM: "true",
    }

    expect(isLegacySnapshotStreamEnabled(env)).toBe(true)
    expect(shouldUseLegacySnapshotSync(env)).toBe(true)
  })

  it("disables collaboration when the rollback flag is off", () => {
    expect(
      isCollaborationEnabled({
        NEXT_PUBLIC_ENABLE_COLLABORATION: "0",
      })
    ).toBe(false)
  })
})

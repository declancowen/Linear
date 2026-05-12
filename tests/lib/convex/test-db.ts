import { vi } from "vitest"

export type ConvexTestRecord = {
  _id: string
  [key: string]: unknown
}

type ConvexTestTables = Record<string, ConvexTestRecord[]>

export function createConvexTestQuery(records: ConvexTestRecord[]) {
  return {
    withIndex: (
      _indexName: string,
      build?: (query: {
        eq: (field: string, value: unknown) => unknown
      }) => unknown
    ) => {
      const filters: Array<{ field: string; value: unknown }> = []
      const queryApi = {
        eq(field: string, value: unknown) {
          filters.push({ field, value })
          return queryApi
        },
      }

      build?.(queryApi)

      const applyFilters = () =>
        records.filter((record) =>
          filters.every(({ field, value }) => record[field] === value)
        )

      return {
        collect: async () => applyFilters(),
        take: async (count: number) => applyFilters().slice(0, count),
        unique: async () => applyFilters()[0] ?? null,
        async *[Symbol.asyncIterator]() {
          for (const record of applyFilters()) {
            yield record
          }
        },
      }
    },
  }
}

export function createMutableConvexTestCtx<TTables extends ConvexTestTables>(
  initialTables: TTables
) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, records]) => [table, [...records]])
  ) as TTables

  return {
    tables,
    db: {
      insert: vi.fn(
        async (table: keyof TTables, value: Record<string, unknown>) => {
          const records = tables[table]
          const nextId =
            typeof value.id === "string"
              ? `${value.id}_doc`
              : `${String(table)}_${records.length + 1}_doc`

          records.push({
            ...value,
            _id: nextId,
          })
        }
      ),
      patch: vi.fn(async (docId: string, patch: Record<string, unknown>) => {
        for (const table of Object.values(tables)) {
          const record = table.find((entry) => entry._id === docId)

          if (record) {
            Object.assign(record, patch)
            return
          }
        }
      }),
      delete: vi.fn(async (docId: string) => {
        for (const table of Object.values(tables)) {
          const index = table.findIndex((entry) => entry._id === docId)

          if (index >= 0) {
            table.splice(index, 1)
            return
          }
        }
      }),
      query: (table: keyof TTables) => createConvexTestQuery(tables[table]),
    },
  }
}

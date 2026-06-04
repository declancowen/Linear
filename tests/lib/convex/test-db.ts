import { vi } from "vitest"

export type ConvexTestRecord = {
  _id: string
  [key: string]: unknown
}

type ConvexTestTables = Record<string, ConvexTestRecord[]>
type ConvexTestQueryOperator = "eq" | "lt" | "lte" | "gt" | "gte"
type ConvexTestQueryFilter = {
  field: string
  operator: ConvexTestQueryOperator
  value: unknown
}
type ConvexTestQueryOperation = {
  count?: number
  filters: ConvexTestQueryFilter[]
  indexName?: string
  operation: "collect" | "take" | "unique"
  table?: string
}

type ConvexTestQueryOptions = {
  filters?: ConvexTestQueryFilter[]
  indexName?: string
  queries?: ConvexTestQueryOperation[]
  table?: string
}

function matchesConvexTestFilter(
  record: ConvexTestRecord,
  filter: ConvexTestQueryFilter
) {
  const actual = record[filter.field]

  if (filter.operator === "eq") {
    return actual === filter.value
  }

  if (
    (typeof actual !== "number" && typeof actual !== "string") ||
    (typeof filter.value !== "number" && typeof filter.value !== "string")
  ) {
    return false
  }

  if (filter.operator === "lt") {
    return actual < filter.value
  }

  if (filter.operator === "lte") {
    return actual <= filter.value
  }

  if (filter.operator === "gt") {
    return actual > filter.value
  }

  return actual >= filter.value
}

function recordConvexTestQueryOperation(
  options: ConvexTestQueryOptions,
  operation: ConvexTestQueryOperation["operation"],
  count?: number
) {
  options.queries?.push({
    count,
    filters: [...(options.filters ?? [])],
    indexName: options.indexName,
    operation,
    table: options.table,
  })
}

function applyConvexTestQueryFilters(
  records: ConvexTestRecord[],
  filters: ConvexTestQueryFilter[]
) {
  return records.filter((record) =>
    filters.every((filter) => matchesConvexTestFilter(record, filter))
  )
}

export function createConvexTestQuery(
  records: ConvexTestRecord[],
  options: ConvexTestQueryOptions = {}
) {
  const applyFilters = () =>
    applyConvexTestQueryFilters(records, options.filters ?? [])

  return {
    collect: async () => {
      recordConvexTestQueryOperation(options, "collect")
      return applyFilters()
    },
    take: async (count: number) => {
      recordConvexTestQueryOperation(options, "take", count)
      return applyFilters().slice(0, count)
    },
    unique: async () => {
      recordConvexTestQueryOperation(options, "unique")
      return applyFilters()[0] ?? null
    },
    async *[Symbol.asyncIterator]() {
      for (const record of applyFilters()) {
        yield record
      }
    },
    withIndex: (
      _indexName: string,
      build?: (query: {
        eq: (field: string, value: unknown) => unknown
        gt: (field: string, value: unknown) => unknown
        gte: (field: string, value: unknown) => unknown
        lt: (field: string, value: unknown) => unknown
        lte: (field: string, value: unknown) => unknown
      }) => unknown
    ) => {
      const filters: ConvexTestQueryFilter[] = []
      const queryApi = {
        eq(field: string, value: unknown) {
          filters.push({ field, operator: "eq", value })
          return queryApi
        },
        gt(field: string, value: unknown) {
          filters.push({ field, operator: "gt", value })
          return queryApi
        },
        gte(field: string, value: unknown) {
          filters.push({ field, operator: "gte", value })
          return queryApi
        },
        lt(field: string, value: unknown) {
          filters.push({ field, operator: "lt", value })
          return queryApi
        },
        lte(field: string, value: unknown) {
          filters.push({ field, operator: "lte", value })
          return queryApi
        },
      }

      build?.(queryApi)

      const indexedOptions = {
        ...options,
        filters,
        indexName: _indexName,
      }
      const applyIndexedFilters = () =>
        applyConvexTestQueryFilters(records, indexedOptions.filters ?? [])

      return {
        collect: async () => {
          recordConvexTestQueryOperation(indexedOptions, "collect")
          return applyIndexedFilters()
        },
        take: async (count: number) => {
          recordConvexTestQueryOperation(indexedOptions, "take", count)
          return applyIndexedFilters().slice(0, count)
        },
        unique: async () => {
          recordConvexTestQueryOperation(indexedOptions, "unique")
          return applyIndexedFilters()[0] ?? null
        },
        async *[Symbol.asyncIterator]() {
          for (const record of applyIndexedFilters()) {
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
  const queries: ConvexTestQueryOperation[] = []

  return {
    queries,
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
      query: (table: keyof TTables) =>
        createConvexTestQuery(tables[table], {
          queries,
          table: String(table),
        }),
    },
  }
}

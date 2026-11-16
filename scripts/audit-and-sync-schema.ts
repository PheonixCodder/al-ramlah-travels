import { getTableColumns, getTableName, is } from "drizzle-orm"
import { PgColumn, PgTable } from "drizzle-orm/pg-core"
import * as schema from "../db/schema/index.js"
import {
  maskConnectionUrl,
  resolveGuardedScriptDatabaseUrl,
  withScriptPgClient,
} from "./_guard"

interface DbColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

function resolveSqlTypeAndDefault(column: PgColumn): string {
  const sqlType = column.getSQLType()
  let sqlClause = sqlType

  if (sqlType === "jsonb") {
    if (column.default !== undefined) {
      const defVal = JSON.stringify(column.default)
      sqlClause += ` DEFAULT '${defVal}'::jsonb`
    } else {
      sqlClause += ` DEFAULT '{}'::jsonb`
    }
  } else if (sqlType === "boolean") {
    if (column.default !== undefined) {
      sqlClause += ` DEFAULT ${String(column.default)}`
    }
  } else if (
    sqlType === "integer" ||
    sqlType === "smallint" ||
    sqlType === "bigint" ||
    sqlType.startsWith("numeric")
  ) {
    if (column.default !== undefined) {
      sqlClause += ` DEFAULT ${String(column.default)}`
    }
  } else if (
    sqlType === "timestamp with time zone" ||
    sqlType === "timestamp"
  ) {
    if (column.default !== undefined || column.hasDefault) {
      sqlClause += ` DEFAULT now()`
    }
  } else if (column.default !== undefined && typeof column.default === "string") {
    sqlClause += ` DEFAULT '${column.default.replace(/'/g, "''")}'`
  }

  return sqlClause
}

async function runSchemaAuditAndSync(): Promise<void> {
  const connectionString = resolveGuardedScriptDatabaseUrl()

  console.log("=== POSTGRESQL FULL SCHEMA AUDIT & SYNC ===")
  console.log(`Connecting to: ${maskConnectionUrl(connectionString)}\n`)

  await withScriptPgClient(connectionString, async (client) => {
    const tables: PgTable[] = []
    const tableNames = new Set<string>()

    for (const value of Object.values(schema)) {
      if (value && is(value, PgTable)) {
        const name = getTableName(value)
        if (!tableNames.has(name)) {
          tableNames.add(name)
          tables.push(value)
        }
      }
    }

    console.log(
      `Discovered ${tables.length} Drizzle tables across db/schema/*.ts:`
    )
    console.log(Array.from(tableNames).sort().join(", "))
    console.log()

    const existingTablesResult = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `)

    const existingTableSet = new Set(
      existingTablesResult.rows.map((t) => t.table_name)
    )

    const existingColsResult = await client.query<
      DbColumnInfo & { table_name: string }
    >(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public';
    `)

    const existingColsMap = new Map<string, Map<string, DbColumnInfo>>()
    for (const col of existingColsResult.rows) {
      const tblMap = existingColsMap.get(col.table_name) ?? new Map<string, DbColumnInfo>()
      tblMap.set(col.column_name, col)
      existingColsMap.set(col.table_name, tblMap)
    }

    const auditResults: Array<{
      tableName: string
      definedCount: number
      dbCount: number
      missingColumns: string[]
      status: "OK" | "MISSING_TABLE" | "MISSING_COLUMNS"
    }> = []

    const missingColumnsToMigrate: Array<{
      tableName: string
      columnName: string
      sqlType: string
      query: string
    }> = []

    for (const table of tables) {
      const tableName = getTableName(table)
      const columns = getTableColumns(table)
      const definedColNames = Object.values(columns).map((c) => c.name)

      if (!existingTableSet.has(tableName)) {
        auditResults.push({
          tableName,
          definedCount: definedColNames.length,
          dbCount: 0,
          missingColumns: definedColNames,
          status: "MISSING_TABLE",
        })
        continue
      }

      const dbCols = existingColsMap.get(tableName) ?? new Map<string, DbColumnInfo>()
      const missing: string[] = []

      for (const col of Object.values(columns)) {
        if (!dbCols.has(col.name)) {
          missing.push(col.name)
          const typeAndDefault = resolveSqlTypeAndDefault(col)
          missingColumnsToMigrate.push({
            tableName,
            columnName: col.name,
            sqlType: typeAndDefault,
            query: `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${col.name}" ${typeAndDefault};`,
          })
        }
      }

      auditResults.push({
        tableName,
        definedCount: definedColNames.length,
        dbCount: dbCols.size,
        missingColumns: missing,
        status: missing.length > 0 ? "MISSING_COLUMNS" : "OK",
      })
    }

    console.log("=== SCHEMA AUDIT REPORT ===")
    console.table(
      auditResults.map((r) => ({
        Table: r.tableName,
        Status: r.status,
        Defined: r.definedCount,
        InDb: r.dbCount,
        Missing:
          r.missingColumns.length > 0 ? r.missingColumns.join(", ") : "none",
      }))
    )

    if (missingColumnsToMigrate.length === 0) {
      console.log(
        "✓ No missing columns found! Database is 100% in sync with Drizzle schema."
      )
      return
    }

    console.log(
      `\nFound ${missingColumnsToMigrate.length} missing columns to migrate. Executing ALTER TABLE statements...`
    )

    for (const item of missingColumnsToMigrate) {
      console.log(`Executing: ${item.query}`)
      await client.query(item.query)
      console.log(`✓ Added column "${item.columnName}" to "${item.tableName}"`)
    }
  })
}

runSchemaAuditAndSync().catch((err: unknown) => {
  console.error("Audit and sync failed:", err)
  process.exit(1)
})

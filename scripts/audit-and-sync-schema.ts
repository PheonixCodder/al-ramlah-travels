import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, "../.env") })

import { neon } from "@neondatabase/serverless"
import { getTableName, getTableColumns, is } from "drizzle-orm"
import { PgTable } from "drizzle-orm/pg-core"
import * as schema from "../db/schema/index.js"

const connectionString =
  process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL

if (!connectionString) {
  console.error("Missing database connection string in web/.env")
  process.exit(1)
}

const activeConnectionString: string = connectionString

const sql = neon(connectionString)

interface DbColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

function resolveSqlTypeAndDefault(column: any): string {
  const sqlType = column.getSQLType()
  let sqlClause = sqlType

  // Handle defaults
  if (sqlType === "jsonb") {
    if (column.default !== undefined) {
      const defVal = JSON.stringify(column.default)
      sqlClause += ` DEFAULT '${defVal}'::jsonb`
    } else {
      sqlClause += ` DEFAULT '{}'::jsonb`
    }
  } else if (sqlType === "boolean") {
    if (column.default !== undefined) {
      sqlClause += ` DEFAULT ${column.default}`
    }
  } else if (
    sqlType === "integer" ||
    sqlType === "smallint" ||
    sqlType === "bigint" ||
    sqlType.startsWith("numeric")
  ) {
    if (column.default !== undefined) {
      sqlClause += ` DEFAULT ${column.default}`
    }
  } else if (
    sqlType === "timestamp with time zone" ||
    sqlType === "timestamp"
  ) {
    if (column.default !== undefined || column.hasDefault) {
      sqlClause += ` DEFAULT now()`
    }
  } else if (column.default !== undefined && typeof column.default === "string") {
    sqlClause += ` DEFAULT '${column.default}'`
  }

  return sqlClause
}

async function runSchemaAuditAndSync() {
  console.log("=== NEON POSTGRESQL FULL SCHEMA AUDIT & SYNC ===")
  console.log(`Connecting to: ${activeConnectionString.replace(/:[^:@]+@/, ":***@")}\n`)

  // 1. Gather all tables from Drizzle schema
  const tables: PgTable[] = []
  const tableNames = new Set<string>()

  for (const [key, value] of Object.entries(schema)) {
    if (value && is(value, PgTable)) {
      const name = getTableName(value)
      if (!tableNames.has(name)) {
        tableNames.add(name)
        tables.push(value as PgTable)
      }
    }
  }

  console.log(`Discovered ${tables.length} Drizzle tables across db/schema/*.ts:`)
  console.log(Array.from(tableNames).sort().join(", "))
  console.log()

  // 2. Fetch all existing tables and columns from information_schema
  const existingTablesResult = (await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `) as { table_name: string }[]

  const existingTableSet = new Set(existingTablesResult.map((t) => t.table_name))

  const existingColsResult = (await sql`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public';
  `) as (DbColumnInfo & { table_name: string })[]

  const existingColsMap = new Map<string, Map<string, DbColumnInfo>>()
  for (const col of existingColsResult) {
    if (!existingColsMap.has(col.table_name)) {
      existingColsMap.set(col.table_name, new Map())
    }
    existingColsMap.get(col.table_name)!.set(col.column_name, col)
  }

  // 3. Compare each table and column
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

    const dbCols = existingColsMap.get(tableName) || new Map()
    const missing: string[] = []

    for (const [propName, col] of Object.entries(columns)) {
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

  // 4. Print Audit Summary Table
  console.log("=== SCHEMA AUDIT REPORT ===")
  console.table(
    auditResults.map((r) => ({
      Table: r.tableName,
      Status: r.status,
      Defined: r.definedCount,
      InDb: r.dbCount,
      Missing: r.missingColumns.length > 0 ? r.missingColumns.join(", ") : "none",
    }))
  )

  // 5. Apply Migrations for Missing Columns
  if (missingColumnsToMigrate.length === 0) {
    console.log("✓ No missing columns found! Database is 100% in sync with Drizzle schema.")
  } else {
    console.log(
      `\nFound ${missingColumnsToMigrate.length} missing columns to migrate. Executing ALTER TABLE statements...`
    )

    for (const item of missingColumnsToMigrate) {
      console.log(`Executing: ${item.query}`)
      try {
        await sql.query(item.query)
        console.log(`✓ Added column "${item.columnName}" to "${item.tableName}"`)
      } catch (err) {
        console.error(`✗ Error adding "${item.columnName}" to "${item.tableName}":`, err)
        throw err
      }
    }

    // 6. Verification query
    console.log("\n=== POST-MIGRATION VERIFICATION ===")
    const recheckResult = (await sql`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public';
    `) as (DbColumnInfo & { table_name: string })[]

    const recheckMap = new Map<string, Set<string>>()
    for (const col of recheckResult) {
      if (!recheckMap.has(col.table_name)) {
        recheckMap.set(col.table_name, new Set())
      }
      recheckMap.get(col.table_name)!.add(col.column_name)
    }

    let remainingMissing = 0
    for (const table of tables) {
      const tableName = getTableName(table)
      if (!existingTableSet.has(tableName)) continue
      const cols = getTableColumns(table)
      for (const col of Object.values(cols)) {
        if (!recheckMap.get(tableName)?.has(col.name)) {
          console.error(`STILL MISSING: ${tableName}.${col.name}`)
          remainingMissing++
        }
      }
    }

    if (remainingMissing > 0) {
      console.error(`✗ Failed: ${remainingMissing} columns are still missing!`)
      process.exit(1)
    } else {
      console.log(`✓ All ${missingColumnsToMigrate.length} columns successfully added and verified in Neon PostgreSQL!`)
    }
  }
}

runSchemaAuditAndSync().catch((err) => {
  console.error("Audit and sync failed:", err)
  process.exit(1)
})

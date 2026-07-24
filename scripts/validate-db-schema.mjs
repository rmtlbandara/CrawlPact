#!/usr/bin/env node
/**
 * db:validate — catches drift between the hand-authored SQL migrations
 * (the schema source of truth, ADR-0002) and the Drizzle schema.ts files
 * (typed query builder mirror). This is a lightweight static check, not a
 * SQL parser: it extracts table names via `CREATE TABLE <name>` and column
 * names via leading-line identifiers, then confirms every table Drizzle
 * declares exists in the applied migrations with every column Drizzle
 * expects. It is intentionally conservative — a false negative (missing a
 * real drift) is worse than a false positive here, so it fails loudly on
 * anything it cannot confidently match.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const migrationsDir = path.join(rootDir, "packages/database/migrations");
const schemaDir = path.join(rootDir, "packages/database/src/schema");

function extractSqlTables() {
  const tables = new Map(); // tableName -> Set<columnName>
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");

    const createTableRegex = /CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g;
    let match;
    while ((match = createTableRegex.exec(sql))) {
      const [, tableName, body] = match;
      const columns = new Set();
      for (const rawLine of body.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("--")) continue;
        if (/^(UNIQUE|CHECK|PRIMARY KEY|FOREIGN KEY)\b/i.test(line)) continue;
        const columnMatch = /^"?(\w+)"?\s+/.exec(line);
        if (columnMatch) columns.add(columnMatch[1]);
      }
      tables.set(tableName, columns);
    }

    // Later migrations may extend an existing table with ALTER TABLE ...
    // ADD COLUMN (e.g. 0009/0010) rather than a fresh CREATE TABLE.
    const alterTableRegex = /ALTER TABLE (\w+) ADD COLUMN (\w+)/g;
    while ((match = alterTableRegex.exec(sql))) {
      const [, tableName, columnName] = match;
      if (!tables.has(tableName)) {
        tables.set(tableName, new Set());
      }
      tables.get(tableName).add(columnName);
    }

    // SQLite's documented "12-step" table-rebuild procedure (used to change
    // a column's FK behavior, since SQLite can't ALTER that directly) always
    // ends with `ALTER TABLE x_new RENAME TO x`. Fold the "_new" table's
    // columns into the real name so the rebuild is invisible to this check.
    const renameTableRegex = /ALTER TABLE (\w+) RENAME TO (\w+)/g;
    while ((match = renameTableRegex.exec(sql))) {
      const [, oldName, newName] = match;
      if (!tables.has(oldName)) continue;
      const oldColumns = tables.get(oldName);
      tables.delete(oldName);
      if (!tables.has(newName)) {
        tables.set(newName, oldColumns);
      } else {
        for (const column of oldColumns) tables.get(newName).add(column);
      }
    }
  }
  return tables;
}

function extractDrizzleTables() {
  const tables = new Map(); // tableName -> Set<columnName>
  const files = readdirSync(schemaDir).filter((f) => f.endsWith(".ts") && f !== "index.ts");
  for (const file of files) {
    const source = readFileSync(path.join(schemaDir, file), "utf8");
    const tableRegex = /sqliteTable\(\s*"(\w+)"\s*,\s*\{([\s\S]*?)\n {0,2}\}(?:,|\))/g;
    let match;
    while ((match = tableRegex.exec(source))) {
      const [, tableName, body] = match;
      const columns = new Set();
      const columnRegex = /(?:text|integer)\(\s*"(\w+)"/g;
      let colMatch;
      while ((colMatch = columnRegex.exec(body))) {
        columns.add(colMatch[1]);
      }
      tables.set(tableName, columns);
    }
  }
  return tables;
}

const sqlTables = extractSqlTables();
const drizzleTables = extractDrizzleTables();

const problems = [];

for (const [tableName, drizzleColumns] of drizzleTables) {
  if (!sqlTables.has(tableName)) {
    problems.push(
      `Table "${tableName}" is defined in Drizzle schema but has no matching migration.`,
    );
    continue;
  }
  const sqlColumns = sqlTables.get(tableName);
  for (const column of drizzleColumns) {
    if (!sqlColumns.has(column)) {
      problems.push(
        `Column "${column}" on table "${tableName}" is defined in Drizzle schema but not in any migration.`,
      );
    }
  }
}

for (const tableName of sqlTables.keys()) {
  if (!drizzleTables.has(tableName)) {
    problems.push(
      `Table "${tableName}" exists in migrations but has no Drizzle schema definition.`,
    );
  }
}

if (problems.length > 0) {
  console.error(`db:validate found ${problems.length} schema/migration mismatch(es):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `db:validate: ${sqlTables.size} tables verified consistent between migrations and Drizzle schema.`,
);

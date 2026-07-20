import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedInitialTaxonomy } from "./initial-taxonomy.js";

const SCHEMA = `
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    branch TEXT NOT NULL CHECK (branch IN ('subjects', 'ideologies')),
    parent_id INTEGER REFERENCES nodes(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('unassessed', 'unknown', 'known')),
    understanding TEXT,
    description_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(description_json) AND json_type(description_json) = 'array'),
    terms_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(terms_json) AND json_type(terms_json) = 'array'),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (
      (status = 'known' AND understanding IS NOT NULL AND length(trim(understanding)) > 0)
      OR
      (status != 'known' AND understanding IS NULL)
    )
  );

  CREATE UNIQUE INDEX IF NOT EXISTS nodes_unique_sibling_name
    ON nodes(branch, ifnull(parent_id, -1), lower(name));
  CREATE INDEX IF NOT EXISTS nodes_parent_id ON nodes(parent_id);

  CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    CHECK (source_id < target_id),
    UNIQUE (source_id, target_id)
  );

  CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

export function openDatabase(databasePath, { seed = true } = {}) {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec(SCHEMA);
  const nodeColumns = database.prepare("PRAGMA table_info(nodes)").all();
  if (!nodeColumns.some((column) => column.name === "revision")) {
    database.exec("ALTER TABLE nodes ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1)");
  }
  if (!nodeColumns.some((column) => column.name === "description_json")) {
    database.exec("ALTER TABLE nodes ADD COLUMN description_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!nodeColumns.some((column) => column.name === "terms_json")) {
    database.exec("ALTER TABLE nodes ADD COLUMN terms_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (seed) seedInitialTaxonomy(database);
  return database;
}

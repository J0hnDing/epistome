import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedInitialTaxonomy } from "./initial-taxonomy.js";

const CREATE_NODES = `
  CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    branch TEXT NOT NULL CHECK (branch IN ('subjects', 'ideologies')),
    parent_id INTEGER REFERENCES nodes(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('unassessed', 'unknown', 'known')),
    understanding TEXT,
    terms_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(terms_json) AND json_type(terms_json) = 'array'),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (
      (status = 'known' AND understanding IS NOT NULL AND length(trim(understanding)) > 0)
      OR
      (status != 'known' AND understanding IS NULL)
    ),
    CHECK (status = 'known' OR terms_json = '[]')
  )`;

const CREATE_CONNECTIONS = `
  CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    CHECK (source_id < target_id),
    UNIQUE (source_id, target_id)
  )`;

const SCHEMA = `
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  ${CREATE_NODES};

  CREATE UNIQUE INDEX IF NOT EXISTS nodes_unique_sibling_name
    ON nodes(branch, ifnull(parent_id, -1), lower(name));
  CREATE INDEX IF NOT EXISTS nodes_parent_id ON nodes(parent_id);

  ${CREATE_CONNECTIONS};

  CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

function migrateNodeContentModel(database) {
  database.exec("PRAGMA foreign_keys = OFF");
  try {
    database.exec(`
      BEGIN IMMEDIATE;
      ALTER TABLE connections RENAME TO connections_legacy_content;
      ALTER TABLE nodes RENAME TO nodes_legacy_content;

      ${CREATE_NODES};
      INSERT INTO nodes (
        id, name, branch, parent_id, status, understanding, terms_json,
        revision, created_at, updated_at
      )
      SELECT
        id, name, branch, parent_id, status, understanding,
        CASE WHEN status = 'known' THEN terms_json ELSE '[]' END,
        revision, created_at, updated_at
      FROM nodes_legacy_content;

      ${CREATE_CONNECTIONS};
      INSERT INTO connections (id, source_id, target_id, created_at)
      SELECT id, source_id, target_id, created_at FROM connections_legacy_content;

      DROP TABLE connections_legacy_content;
      DROP TABLE nodes_legacy_content;
      CREATE UNIQUE INDEX nodes_unique_sibling_name
        ON nodes(branch, ifnull(parent_id, -1), lower(name));
      CREATE INDEX nodes_parent_id ON nodes(parent_id);
      COMMIT;
    `);
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch {}
    throw error;
  } finally {
    database.exec("PRAGMA foreign_keys = ON");
  }

  const violations = database.prepare("PRAGMA foreign_key_check").all();
  if (violations.length) throw new Error("Node content migration created invalid foreign keys.");
}

export function openDatabase(databasePath, { seed = true } = {}) {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec(SCHEMA);
  let nodeColumns = database.prepare("PRAGMA table_info(nodes)").all();
  if (!nodeColumns.some((column) => column.name === "revision")) {
    database.exec("ALTER TABLE nodes ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1)");
  }
  if (!nodeColumns.some((column) => column.name === "terms_json")) {
    database.exec("ALTER TABLE nodes ADD COLUMN terms_json TEXT NOT NULL DEFAULT '[]'");
  }
  nodeColumns = database.prepare("PRAGMA table_info(nodes)").all();
  const nodeTableSql = database.prepare(`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'nodes'
  `).get().sql;
  if (nodeColumns.some((column) => column.name === "description_json")
      || !nodeTableSql.includes("status = 'known' OR terms_json = '[]'")) {
    migrateNodeContentModel(database);
  }
  if (seed) seedInitialTaxonomy(database);
  return database;
}

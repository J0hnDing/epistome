import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openDatabase } from "../src/database.js";

test("adds revision 1 to databases created before agent revision support", () => {
  const directory = mkdtempSync(join(tmpdir(), "modeled-kb-migration-"));
  const path = join(directory, "legacy.sqlite");
  let database;
  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(`
      CREATE TABLE nodes (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        branch TEXT NOT NULL,
        parent_id INTEGER REFERENCES nodes(id) ON DELETE RESTRICT,
        status TEXT NOT NULL,
        understanding TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO nodes (
        name, branch, parent_id, status, understanding, created_at, updated_at
      ) VALUES ('Existing node', 'subjects', NULL, 'unassessed', NULL, '2026-01-01', '2026-01-01');
    `);
    legacy.close();

    database = openDatabase(path, { seed: false });
    const columns = database.prepare("PRAGMA table_info(nodes)").all();
    assert.ok(columns.some((column) => column.name === "revision"));
    assert.ok(columns.some((column) => column.name === "description_json"));
    assert.ok(columns.some((column) => column.name === "terms_json"));
    assert.equal(database.prepare("SELECT revision FROM nodes WHERE id = 1").get().revision, 1);
    const migrated = database.prepare("SELECT description_json, terms_json FROM nodes WHERE id = 1").get();
    assert.equal(migrated.description_json, "[]");
    assert.equal(migrated.terms_json, "[]");
  } finally {
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

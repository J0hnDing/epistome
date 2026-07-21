import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openDatabase } from "../src/database.js";

test("migrates legacy node content to one explanation with known-only terms", () => {
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
        description_json TEXT NOT NULL DEFAULT '[]',
        terms_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO nodes (
        name, branch, parent_id, status, understanding, description_json, terms_json, created_at, updated_at
      ) VALUES
        ('Known node', 'subjects', NULL, 'known', 'A direct explanation.', '[{"type":"text","text":"Removed context."}]', '[{"id":"term","label":"Term","definition":"Definition."}]', '2026-01-01', '2026-01-01'),
        ('Unknown node', 'subjects', NULL, 'unknown', NULL, '[{"type":"text","text":"Removed context."}]', '[{"id":"term","label":"Term","definition":"Definition."}]', '2026-01-01', '2026-01-01');
    `);
    legacy.close();

    database = openDatabase(path, { seed: false });
    const columns = database.prepare("PRAGMA table_info(nodes)").all();
    assert.ok(columns.some((column) => column.name === "revision"));
    assert.equal(columns.some((column) => column.name === "description_json"), false);
    assert.ok(columns.some((column) => column.name === "terms_json"));
    assert.ok(database.prepare("SELECT revision FROM nodes").all().every((row) => row.revision === 1));
    assert.match(database.prepare("SELECT terms_json FROM nodes WHERE status = 'known'").get().terms_json, /Definition/);
    assert.equal(database.prepare("SELECT terms_json FROM nodes WHERE status = 'unknown'").get().terms_json, "[]");
  } finally {
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

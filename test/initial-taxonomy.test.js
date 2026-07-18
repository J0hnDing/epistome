import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { openDatabase } from "../src/database.js";
import { INITIAL_TAXONOMY, seedInitialTaxonomy } from "../src/initial-taxonomy.js";

describe("initial taxonomy", () => {
  test("seeds broad unassessed Subject and Ideology nodes without a Philosophy container", () => {
    const database = openDatabase(":memory:");
    try {
      const rows = database.prepare(`
        SELECT name, branch, parent_id, status, understanding, revision
        FROM nodes ORDER BY branch, name
      `).all();
      const expectedCount = INITIAL_TAXONOMY.subjects.length + INITIAL_TAXONOMY.ideologies.length;
      assert.equal(rows.length, expectedCount);
      assert.ok(INITIAL_TAXONOMY.subjects.includes("Mathematics"));
      assert.ok(INITIAL_TAXONOMY.subjects.includes("Physics"));
      assert.ok(INITIAL_TAXONOMY.subjects.includes("Computer Science"));
      assert.ok(INITIAL_TAXONOMY.ideologies.includes("Politics"));
      assert.ok(INITIAL_TAXONOMY.ideologies.includes("Ethics"));
      assert.ok(INITIAL_TAXONOMY.ideologies.includes("Metaphysics"));
      assert.equal(rows.some((row) => /Philosophy/i.test(row.name)), false);
      assert.ok(rows.every((row) => row.parent_id === null));
      assert.ok(rows.every((row) => row.status === "unassessed"));
      assert.ok(rows.every((row) => row.understanding === null));
      assert.ok(rows.every((row) => row.revision === 1));
    } finally {
      database.close();
    }
  });

  test("runs once and does not recreate a taxonomy node deleted by the user", () => {
    const database = openDatabase(":memory:");
    try {
      const physics = database.prepare("SELECT id FROM nodes WHERE name = 'Physics'").get();
      database.prepare("DELETE FROM nodes WHERE id = ?").run(physics.id);

      assert.equal(seedInitialTaxonomy(database), false);
      assert.equal(database.prepare("SELECT 1 FROM nodes WHERE name = 'Physics'").get(), undefined);
    } finally {
      database.close();
    }
  });

  test("preserves a matching node that already exists before the first seed", () => {
    const database = openDatabase(":memory:", { seed: false });
    try {
      const timestamp = new Date().toISOString();
      database.prepare(`
        INSERT INTO nodes (
          name, branch, parent_id, status, understanding, revision, created_at, updated_at
        ) VALUES ('Mathematics', 'subjects', NULL, 'known', 'Mathematics studies patterns and formal relationships.', 1, ?, ?)
      `).run(timestamp, timestamp);

      assert.equal(seedInitialTaxonomy(database), true);
      const mathematics = database.prepare("SELECT status, understanding FROM nodes WHERE name = 'Mathematics'").get();
      assert.equal(mathematics.status, "known");
      assert.match(mathematics.understanding, /formal relationships/);
      assert.equal(database.prepare("SELECT count(*) AS count FROM nodes WHERE name = 'Mathematics'").get().count, 1);
    } finally {
      database.close();
    }
  });
});

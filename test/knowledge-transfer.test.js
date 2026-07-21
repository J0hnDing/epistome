import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { openDatabase } from "../src/database.js";
import { AppError } from "../src/errors.js";
import {
  KNOWLEDGE_EXPORT_FORMAT,
  KNOWLEDGE_EXPORT_VERSION,
  KnowledgeBase
} from "../src/knowledge-base.js";

let knowledgeBase;

afterEach(() => {
  knowledgeBase?.close();
  knowledgeBase = undefined;
});

function createKnowledgeBase() {
  knowledgeBase = new KnowledgeBase(openDatabase(":memory:", { seed: false }));
  return knowledgeBase;
}

function known(kb, name, branch = "subjects", parentId = null) {
  return kb.createNode({
    name,
    branch,
    parentId,
    status: "known",
    understanding: `${name} is understood conceptually.`
  });
}

describe("versioned knowledge transfer", () => {
  test("exports and atomically restores the complete persisted knowledge base", () => {
    const kb = createKnowledgeBase();
    const child = kb.createNode({
      name: "Child created first",
      branch: "subjects",
      status: "known",
      understanding: "Child created first is understood conceptually.",
      terms: [{ id: "local-term", label: "Local term", definition: "A contextual definition." }]
    });
    const parent = known(kb, "Parent created second");
    kb.updateNode(child.id, { parentId: parent.id });
    const ideology = known(kb, "Ethics", "ideologies");
    kb.createConnection({ sourceId: child.id, targetId: ideology.id });
    kb.database.prepare("INSERT INTO app_metadata (key, value) VALUES (?, ?)")
      .run("test_marker", "preserved");

    const exported = kb.exportKnowledgeBase();
    assert.equal(exported.format, KNOWLEDGE_EXPORT_FORMAT);
    assert.equal(exported.format_version, KNOWLEDGE_EXPORT_VERSION);
    assert.equal(exported.data.nodes.length, 3);
    assert.equal(exported.data.nodes.some((node) => "description" in node), false);
    assert.equal(exported.data.connections.length, 1);
    assert.deepEqual(exported.data.metadata, [{ key: "test_marker", value: "preserved" }]);

    kb.createNode({ name: "Temporary", branch: "subjects", status: "unassessed" });
    kb.database.prepare("UPDATE app_metadata SET value = ? WHERE key = ?")
      .run("changed", "test_marker");

    const result = kb.importKnowledgeBase(exported);
    assert.deepEqual(result, {
      format_version: KNOWLEDGE_EXPORT_VERSION,
      nodes_imported: 3,
      connections_imported: 1
    });
    assert.deepEqual(kb.exportKnowledgeBase().data, exported.data);
    assert.equal(kb.getNode(child.id).parentId, parent.id);
  });

  test("rejects unsupported versions without changing current data", () => {
    const kb = createKnowledgeBase();
    known(kb, "Mathematics");
    const before = kb.exportKnowledgeBase();
    const unsupported = structuredClone(before);
    unsupported.format_version = 99;

    assert.throws(() => kb.importKnowledgeBase(unsupported), (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "unsupported_export_version");
      return true;
    });
    assert.deepEqual(kb.exportKnowledgeBase().data, before.data);
  });

  test("rejects older formats and versions", () => {
    const kb = createKnowledgeBase();
    known(kb, "Mathematics");
    const legacy = kb.exportKnowledgeBase();
    legacy.format = "the-modeled-knowledge-base";
    legacy.format_version = 1;

    assert.throws(() => kb.importKnowledgeBase(legacy), (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "invalid_export_format");
      return true;
    });
    assert.deepEqual(kb.listNodes().map((node) => node.name), ["Mathematics"]);
  });

  test("rejects an invalid tree before replacing the current data", () => {
    const kb = createKnowledgeBase();
    const parent = known(kb, "Computer Science");
    kb.createNode({
      name: "Algorithms",
      branch: "subjects",
      parentId: parent.id,
      status: "unassessed"
    });
    const before = kb.exportKnowledgeBase();
    const invalid = structuredClone(before);
    invalid.data.nodes.find((node) => node.id === parent.id).status = "unknown";
    invalid.data.nodes.find((node) => node.id === parent.id).understanding = null;

    assert.throws(() => kb.importKnowledgeBase(invalid), (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "invalid_export");
      return true;
    });
    assert.deepEqual(kb.exportKnowledgeBase().data, before.data);
  });
});

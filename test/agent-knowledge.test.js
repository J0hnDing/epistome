import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { openDatabase } from "../src/database.js";
import { AppError } from "../src/errors.js";
import { KnowledgeBase } from "../src/knowledge-base.js";

let knowledgeBase;

afterEach(() => {
  knowledgeBase?.close();
  knowledgeBase = undefined;
});

function setup() {
  knowledgeBase = new KnowledgeBase(openDatabase(":memory:", { seed: false }));
  return knowledgeBase;
}

function expectError(callback, status, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

describe("agent knowledge operations", () => {
  test("lists only Subject frontier nodes with known immediate parents", () => {
    const kb = setup();
    const subjectParent = kb.createNode({
      name: "Subject Parent",
      branch: "subjects",
      status: "known",
      understanding: "A known Subject parent."
    });
    const unknown = kb.createNode({
      name: "Unknown Frontier",
      branch: "subjects",
      parentId: subjectParent.id,
      status: "unknown"
    });
    const unassessed = kb.createNode({
      name: "Unassessed Frontier",
      branch: "subjects",
      parentId: subjectParent.id,
      status: "unassessed"
    });
    kb.createNode({
      name: "Known Child",
      branch: "subjects",
      parentId: subjectParent.id,
      status: "known",
      understanding: "A known child is not on the frontier."
    });
    kb.createNode({ name: "Top-level Placeholder", branch: "subjects", status: "unassessed" });

    const ideologyParent = kb.createNode({
      name: "Ideology Parent",
      branch: "ideologies",
      status: "known",
      understanding: "A known Ideology parent."
    });
    kb.createNode({
      name: "Ideology Frontier",
      branch: "ideologies",
      parentId: ideologyParent.id,
      status: "unknown"
    });

    assert.deepEqual(kb.listFrontierNodes({}), {
      nodes: [
        { id: unknown.id, name: "Unknown Frontier", status: "unknown", parent_id: subjectParent.id },
        { id: unassessed.id, name: "Unassessed Frontier", status: "unassessed", parent_id: subjectParent.id }
      ],
      next_cursor: null
    });
  });

  test("filters Subject frontier nodes by exact parent and status", () => {
    const kb = setup();
    const firstParent = kb.createNode({
      name: "First Parent",
      branch: "subjects",
      status: "known",
      understanding: "First known parent."
    });
    const secondParent = kb.createNode({
      name: "Second Parent",
      branch: "subjects",
      status: "known",
      understanding: "Second known parent."
    });
    const firstUnknown = kb.createNode({
      name: "First Unknown",
      branch: "subjects",
      parentId: firstParent.id,
      status: "unknown"
    });
    kb.createNode({
      name: "First Unassessed",
      branch: "subjects",
      parentId: firstParent.id,
      status: "unassessed"
    });
    kb.createNode({
      name: "Second Unknown",
      branch: "subjects",
      parentId: secondParent.id,
      status: "unknown"
    });

    const result = kb.listFrontierNodes({
      parent_id: firstParent.id,
      status: ["unknown"],
      limit: 50,
      cursor: null
    });
    assert.deepEqual(result.nodes, [{
      id: firstUnknown.id,
      name: "First Unknown",
      status: "unknown",
      parent_id: firstParent.id
    }]);
  });

  test("paginates frontier nodes with filter-bound opaque cursors", () => {
    const kb = setup();
    const parent = kb.createNode({
      name: "Paged Parent",
      branch: "subjects",
      status: "known",
      understanding: "A parent with multiple frontier children."
    });
    const children = ["One", "Two", "Three"].map((name) => kb.createNode({
      name,
      branch: "subjects",
      parentId: parent.id,
      status: "unassessed"
    }));

    const first = kb.listFrontierNodes({
      parent_id: parent.id,
      status: ["unassessed"],
      limit: 2,
      cursor: null
    });
    assert.deepEqual(first.nodes.map((node) => node.id), children.slice(0, 2).map((node) => node.id));
    assert.equal(typeof first.next_cursor, "string");

    const second = kb.listFrontierNodes({
      parent_id: parent.id,
      status: ["unassessed"],
      limit: 2,
      cursor: first.next_cursor
    });
    assert.deepEqual(second.nodes.map((node) => node.id), [children[2].id]);
    assert.equal(second.next_cursor, null);

    expectError(() => kb.listFrontierNodes({
      parent_id: parent.id,
      status: ["unknown"],
      limit: 2,
      cursor: first.next_cursor
    }), 400, "cursor_filter_mismatch");
    expectError(() => kb.listFrontierNodes({
      status: ["unknown", "unknown"]
    }), 400, "invalid_status_filter");
  });

  test("rejects Ideology parent filters on the Subject-only frontier API", () => {
    const kb = setup();
    const ideology = kb.createNode({
      name: "Ideology",
      branch: "ideologies",
      status: "known",
      understanding: "An ideological framework."
    });
    expectError(() => kb.listFrontierNodes({ parent_id: ideology.id }), 400, "subjects_only");
  });

  test("searches compact results within an explicit subtree", () => {
    const kb = setup();
    const computing = kb.createNode({
      name: "Computing",
      branch: "subjects",
      status: "known",
      understanding: "Computing studies information processes and the systems that perform them."
    });
    const learning = kb.createNode({
      name: "Machine Learning",
      branch: "subjects",
      parentId: computing.id,
      status: "known",
      understanding: "Systems learn patterns from data."
    });
    kb.createNode({ name: "Model Training", branch: "subjects", parentId: learning.id, status: "unknown" });
    kb.createNode({
      name: "Learning Theory",
      branch: "ideologies",
      status: "known",
      understanding: "A framework about how learning should be interpreted."
    });

    const results = kb.searchKnowledge({
      query: "learning",
      parent_id: computing.id,
      branch: "subjects",
      limit: 5
    });

    assert.deepEqual(results, [{
      id: learning.id,
      name: "Machine Learning",
      path: ["Subjects", "Computing", "Machine Learning"],
      status: "known"
    }]);
    assert.deepEqual(Object.keys(results[0]), ["id", "name", "path", "status"]);
  });

  test("returns only the requested node, path, parent, and immediate children", () => {
    const kb = setup();
    const root = kb.createNode({
      name: "Root Concept",
      branch: "subjects",
      status: "known",
      understanding: "A broad understood concept."
    });
    const child = kb.createNode({
      name: "Child Concept",
      branch: "subjects",
      parentId: root.id,
      status: "known",
      understanding: "A narrower understood concept."
    });
    kb.createNode({ name: "Grandchild Concept", branch: "subjects", parentId: child.id, status: "unknown" });

    const result = kb.getKnowledgeNode({ node_id: root.id });
    assert.deepEqual(Object.keys(result), [
      "id", "revision", "name", "status", "understanding", "path", "parent", "children"
    ]);
    assert.equal(result.parent, null);
    assert.deepEqual(result.children, [{ id: child.id, name: "Child Concept", status: "known" }]);
    assert.equal(JSON.stringify(result).includes("Grandchild Concept"), false);
  });

  test("establishes a known node, reuses children, and preserves all existing children", () => {
    const kb = setup();
    const node = kb.createNode({ name: "Learning", branch: "subjects", status: "unassessed" });

    const established = kb.establishKnownNode({
      node_id: node.id,
      expected_revision: node.revision,
      understanding: "Learning changes a system through experience.",
      children: ["Supervised Learning", "Unsupervised Learning"]
    });
    assert.equal(established.node.revision, node.revision + 1);
    assert.deepEqual(established.children_created, ["Supervised Learning", "Unsupervised Learning"]);
    assert.deepEqual(established.children_existing, []);
    assert.deepEqual(established.children_conflicting, []);

    const repeated = kb.establishKnownNode({
      node_id: node.id,
      expected_revision: established.node.revision,
      understanding: "Learning changes behaviour through experience.",
      children: ["supervised learning", "Reinforcement Learning", "Reinforcement Learning"]
    });
    assert.deepEqual(repeated.children_created, ["Reinforcement Learning"]);
    assert.deepEqual(repeated.children_existing, ["Supervised Learning"]);
    assert.deepEqual(repeated.children_conflicting, ["Reinforcement Learning"]);
    assert.deepEqual(
      kb.getKnowledgeNode({ node_id: node.id }).children.map((child) => child.name),
      ["Reinforcement Learning", "Supervised Learning", "Unsupervised Learning"]
    );
  });

  test("allows establishing a known leaf with an empty child list", () => {
    const kb = setup();
    const node = kb.createNode({ name: "Leaf", branch: "subjects", status: "unknown" });
    const result = kb.establishKnownNode({
      node_id: node.id,
      expected_revision: node.revision,
      understanding: "This concept is now understood without useful decomposition.",
      children: []
    });
    assert.deepEqual(result.children_created, []);
    assert.equal(kb.getKnowledgeNode({ node_id: node.id }).status, "known");
  });

  test("rejects a stale establishment atomically without creating children", () => {
    const kb = setup();
    const node = kb.createNode({ name: "Concurrency", branch: "subjects", status: "unassessed" });
    kb.updateNode(node.id, { name: "Concurrency Control" });

    expectError(() => kb.establishKnownNode({
      node_id: node.id,
      expected_revision: node.revision,
      understanding: "This stale write must not apply.",
      children: ["Leaked Child"]
    }), 409, "stale_revision");

    const current = kb.getKnowledgeNode({ node_id: node.id });
    assert.equal(current.status, "unassessed");
    assert.deepEqual(current.children, []);
  });

  test("updates only an already known node and never restructures it", () => {
    const kb = setup();
    const unknown = kb.createNode({ name: "Unknown Area", branch: "subjects", status: "unknown" });
    expectError(() => kb.updateKnownNode({
      node_id: unknown.id,
      expected_revision: unknown.revision,
      understanding: "An invalid attempted update.",
      children_to_add: ["Invalid Child"]
    }), 409, "node_not_known");
    assert.deepEqual(kb.getKnowledgeNode({ node_id: unknown.id }).children, []);

    const known = kb.createNode({
      name: "Known Area",
      branch: "subjects",
      status: "known",
      understanding: "The original understanding."
    });
    const updated = kb.updateKnownNode({
      node_id: known.id,
      expected_revision: known.revision,
      understanding: "The updated understanding.",
      children_to_add: ["New Boundary"]
    });
    assert.equal(updated.node.revision, known.revision + 1);
    assert.deepEqual(updated.children_created, ["New Boundary"]);
    const current = kb.getKnowledgeNode({ node_id: known.id });
    assert.equal(current.name, "Known Area");
    assert.deepEqual(current.path, ["Subjects", "Known Area"]);
    assert.deepEqual(current.children, [{
      id: current.children[0].id,
      name: "New Boundary",
      status: "unassessed"
    }]);
  });

  test("rejects restructuring fields from agent update input", () => {
    const kb = setup();
    const known = kb.createNode({
      name: "Stable identity",
      branch: "subjects",
      status: "known",
      understanding: "The original understanding."
    });

    expectError(() => kb.updateKnownNode({
      node_id: known.id,
      expected_revision: known.revision,
      understanding: "A proposed update.",
      children_to_add: [],
      name: "Forbidden rename",
      branch: "ideologies",
      children_to_delete: ["Anything"]
    }), 400, "unexpected_field");

    const unchanged = kb.getKnowledgeNode({ node_id: known.id });
    assert.equal(unchanged.name, "Stable identity");
    assert.equal(unchanged.revision, known.revision);
    assert.equal(unchanged.understanding, "The original understanding.");
  });
});

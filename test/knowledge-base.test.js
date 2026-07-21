import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { openDatabase } from "../src/database.js";
import { AppError } from "../src/errors.js";
import { INITIAL_TAXONOMY } from "../src/initial-taxonomy.js";
import { KnowledgeBase } from "../src/knowledge-base.js";

let knowledgeBase;

afterEach(() => {
  knowledgeBase?.close();
  knowledgeBase = undefined;
});

function createKnowledgeBase() {
  knowledgeBase = new KnowledgeBase(openDatabase(":memory:", { seed: false }));
  return knowledgeBase;
}

function known(name, branch = "subjects", parentId = null) {
  return knowledgeBase.createNode({
    name,
    branch,
    parentId,
    status: "known",
    understanding: `${name} is understood at a useful conceptual level.`
  });
}

function expectAppError(callback, { status, code }) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

describe("knowledge tree", () => {
  test("supports an intentionally unseeded tree for isolated domain use", () => {
    const kb = createKnowledgeBase();
    assert.deepEqual(kb.listNodes(), []);
    assert.deepEqual(kb.getTree().map(({ id, children }) => ({ id, children })), [
      { id: "subjects", children: [] },
      { id: "ideologies", children: [] }
    ]);
  });

  test("creates a known hierarchy and exposes it as a tree", () => {
    const kb = createKnowledgeBase();
    const science = known("Natural Sciences");
    const physics = known("Physics", "subjects", science.id);
    const frontier = kb.createNode({
      name: "Quantum Field Theory",
      branch: "subjects",
      parentId: physics.id,
      status: "unknown"
    });

    const subjects = kb.getTree()[0];
    assert.equal(subjects.children[0].id, science.id);
    assert.equal(subjects.children[0].children[0].id, physics.id);
    assert.equal(subjects.children[0].children[0].children[0].id, frontier.id);
  });

  test("requires a meaningful understanding for known nodes", () => {
    const kb = createKnowledgeBase();
    expectAppError(() => kb.createNode({
      name: "Physics",
      branch: "subjects",
      status: "known",
      understanding: "  "
    }), { status: 400, code: "understanding_required" });
  });

  test("does not retain understanding text for unknown or unassessed nodes", () => {
    const kb = createKnowledgeBase();
    const node = kb.createNode({
      name: "Ethics",
      branch: "ideologies",
      status: "unassessed",
      understanding: "This must not be stored."
    });
    assert.equal(node.understanding, null);
  });

  test("allows children only beneath known nodes", () => {
    const kb = createKnowledgeBase();
    const parent = kb.createNode({ name: "Epistemology", branch: "ideologies", status: "unknown" });
    expectAppError(() => kb.createNode({
      name: "Skepticism",
      branch: "ideologies",
      parentId: parent.id,
      status: "unassessed"
    }), { status: 409, code: "parent_not_known" });
  });

  test("does not allow a node with children to stop being known", () => {
    const kb = createKnowledgeBase();
    const parent = known("Computer Science");
    kb.createNode({ name: "Algorithms", branch: "subjects", parentId: parent.id, status: "unassessed" });
    expectAppError(() => kb.updateNode(parent.id, { status: "unknown" }), {
      status: 409,
      code: "children_require_known_parent"
    });
  });

  test("rejects duplicate sibling names without case sensitivity", () => {
    const kb = createKnowledgeBase();
    known("Mathematics");
    expectAppError(() => known("mathematics"), { status: 409, code: "duplicate" });
  });

  test("rejects cycles during a move", () => {
    const kb = createKnowledgeBase();
    const root = known("Engineering");
    const child = known("Mechanical Engineering", "subjects", root.id);
    expectAppError(() => kb.updateNode(root.id, { parentId: child.id }), {
      status: 400,
      code: "cycle"
    });
  });

  test("moves a complete subtree between primary branches", () => {
    const kb = createKnowledgeBase();
    const root = known("A Broad Framework");
    const child = known("A Narrow Position", "subjects", root.id);

    kb.updateNode(root.id, { parentId: null, branch: "ideologies" });
    assert.equal(kb.getNode(root.id).branch, "ideologies");
    assert.equal(kb.getNode(child.id).branch, "ideologies");
  });

  test("creates one undirected connection and rejects its reverse duplicate", () => {
    const kb = createKnowledgeBase();
    const gravity = known("Gravity");
    const acceleration = known("Acceleration");
    const connection = kb.createConnection({ sourceId: gravity.id, targetId: acceleration.id });

    assert.equal(kb.getNode(gravity.id).connections[0].node.id, acceleration.id);
    expectAppError(
      () => kb.createConnection({ sourceId: acceleration.id, targetId: gravity.id }),
      { status: 409, code: "duplicate" }
    );
    kb.deleteConnection(connection.id);
    assert.deepEqual(kb.getNode(gravity.id).connections, []);
  });

  test("requires children to be handled before a parent is deleted", () => {
    const kb = createKnowledgeBase();
    const parent = known("History");
    const child = kb.createNode({ name: "Ancient History", branch: "subjects", parentId: parent.id, status: "unknown" });
    expectAppError(() => kb.deleteNode(parent.id), { status: 409, code: "node_has_children" });
    kb.deleteNode(child.id);
    kb.deleteNode(parent.id);
    assert.deepEqual(kb.listNodes(), []);
  });

  test("clears knowledge while restoring the base taxonomy as unassessed leaves", () => {
    const kb = createKnowledgeBase();
    const physics = known("Physics");
    const mechanics = known("Mechanics", "subjects", physics.id);
    const ethics = known("Ethics", "ideologies");
    const custom = known("Personal Notes");
    kb.createConnection({ sourceId: mechanics.id, targetId: custom.id });
    kb.database.prepare("INSERT INTO app_metadata (key, value) VALUES ('custom', 'preserved')").run();

    const result = kb.clearKnowledge();

    assert.deepEqual(result, {
      nodes_deleted: 2,
      connections_deleted: 1,
      base_nodes_preserved: 2,
      base_nodes_reset: 2,
      base_nodes_created: 48
    });
    const nodes = kb.listNodes();
    assert.equal(nodes.length, INITIAL_TAXONOMY.subjects.length + INITIAL_TAXONOMY.ideologies.length);
    assert.ok(nodes.every((node) => node.parentId === null));
    assert.ok(nodes.every((node) => node.status === "unassessed"));
    assert.ok(nodes.every((node) => node.understanding === null));
    assert.ok(nodes.every((node) => node.terms.length === 0));
    assert.equal(nodes.find((node) => node.name === "Physics").id, physics.id);
    assert.equal(nodes.find((node) => node.name === "Ethics").id, ethics.id);
    assert.equal(kb.database.prepare("SELECT count(*) AS count FROM connections").get().count, 0);
    assert.equal(kb.database.prepare("SELECT value FROM app_metadata WHERE key = 'custom'").get().value, "preserved");
  });

  test("advances a parent revision when its immediate child view changes", () => {
    const kb = createKnowledgeBase();
    const parent = known("Parent");
    const child = kb.createNode({
      name: "Boundary",
      branch: "subjects",
      parentId: parent.id,
      status: "unassessed"
    });
    assert.equal(kb.getNode(parent.id).revision, parent.revision + 1);

    kb.establishKnownNode({
      node_id: child.id,
      expected_revision: child.revision,
      understanding: "The boundary is now understood.",
      children: []
    });
    assert.equal(kb.getNode(parent.id).revision, parent.revision + 2);

    const establishedChild = kb.getNode(child.id);
    const renamedChild = kb.updateNode(child.id, { name: "Renamed boundary" });
    assert.equal(renamedChild.revision, establishedChild.revision + 1);
    assert.equal(kb.getNode(parent.id).revision, parent.revision + 3);

    kb.deleteNode(child.id);
    assert.equal(kb.getNode(parent.id).revision, parent.revision + 4);
  });
});

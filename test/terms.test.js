import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { renderTermList } from "../public/terms.js";
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

function expectCode(operation, code) {
  assert.throws(operation, (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, code);
    return true;
  });
}

const exampleTerms = [{
  id: "weights",
  label: "weights",
  definition: "Learned numeric parameters that control how inputs influence a model's output."
}];

describe("known-node terms", () => {
  test("stores terms only on known nodes and clears them when a leaf becomes unknown", () => {
    const kb = setup();
    const known = kb.createNode({
      name: "Machine Learning",
      branch: "subjects",
      status: "known",
      understanding: "Machine learning adjusts models from data to improve behavior on a task.",
      terms: exampleTerms
    });

    assert.deepEqual(known.terms, exampleTerms);
    assert.equal("description" in known, false);
    expectCode(() => kb.createNode({
      name: "Unknown with terms",
      branch: "subjects",
      status: "unknown",
      terms: exampleTerms
    }), "terms_require_known_status");

    const unknown = kb.updateNode(known.id, { status: "unknown", understanding: null });
    assert.equal(unknown.understanding, null);
    assert.deepEqual(unknown.terms, []);
  });

  test("rejects removed descriptions and malformed or duplicate terms", () => {
    const kb = setup();
    const base = {
      name: "Invalid",
      branch: "subjects",
      status: "known",
      understanding: "A direct explanation of the concept."
    };

    expectCode(() => kb.createNode({ ...base, description: [] }), "unexpected_field");
    expectCode(() => kb.createNode({
      ...base,
      terms: [{ id: "Invalid ID", label: "Term", definition: "Definition." }]
    }), "invalid_term_id");
    expectCode(() => kb.createNode({
      ...base,
      terms: [
        { id: "term", label: "Term", definition: "First definition." },
        { id: "term", label: "Term", definition: "Second definition." }
      ]
    }), "duplicate_term_id");
  });

  test("creates name-only unassessed children and rejects child content objects", () => {
    const kb = setup();
    const parent = kb.createNode({ name: "Learning", branch: "subjects", status: "unassessed" });

    expectCode(() => kb.establishKnownNode({
      node_id: parent.id,
      expected_revision: parent.revision,
      understanding: "Learning changes behavior through experience.",
      children: [{ name: "Model Training", terms: exampleTerms }]
    }), "invalid_child");

    const result = kb.establishKnownNode({
      node_id: parent.id,
      expected_revision: parent.revision,
      understanding: "Learning changes behavior through experience.",
      children: ["Model Training"]
    });
    const child = kb.getNode(kb.getKnowledgeNode({ node_id: parent.id }).children[0].id);
    assert.deepEqual(result.children_created, ["Model Training"]);
    assert.equal(child.status, "unassessed");
    assert.equal(child.understanding, null);
    assert.deepEqual(child.terms, []);
  });

  test("renders term labels, sources, and definitions as inert text", () => {
    class FakeElement {
      constructor(tagName) { this.tagName = tagName; this.children = []; }
      replaceChildren() { this.children = []; }
      append(...children) { this.children.push(...children); }
    }
    const document = { createElement: (tagName) => new FakeElement(tagName) };
    const container = new FakeElement("dl");
    renderTermList({
      document,
      container,
      terms: [{
        id: "unsafe",
        label: "<strong>Weights</strong>",
        definition: "<img src=x onerror=alert(1)>",
        sourceName: "<script>Parent</script>",
        isLocal: false
      }]
    });

    const [item] = container.children;
    assert.equal(item.children[0].textContent, "<strong>Weights</strong>");
    assert.equal(item.children[0].children[0].textContent, "From <script>Parent</script>");
    assert.equal(item.children[1].textContent, "<img src=x onerror=alert(1)>");
  });
});

import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { renderInlineDescription, renderTermList } from "../public/inline-terms.js";
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

const exampleContent = {
  description: [
    { type: "text", text: "A model adjusts " },
    { type: "term", termId: "weights" },
    { type: "text", text: " during training." }
  ],
  terms: [{
    id: "weights",
    label: "weights",
    definition: "Learned numeric parameters that control how inputs influence a model's output."
  }]
};

describe("inline node terms", () => {
  test("persists structured descriptions and local terms independently of knowledge status", () => {
    const kb = setup();
    const node = kb.createNode({
      name: "Machine Learning",
      branch: "subjects",
      status: "unassessed",
      ...exampleContent
    });

    assert.deepEqual(node.description, exampleContent.description);
    assert.deepEqual(node.terms, exampleContent.terms);
    assert.equal(node.understanding, null);
    assert.deepEqual(kb.getKnowledgeNode({ node_id: node.id }).terms, exampleContent.terms);

    const updated = kb.updateNode(node.id, {
      description: [{ type: "text", text: "A plain explanation with no defined terms." }],
      terms: []
    });
    assert.deepEqual(updated.description, [{ type: "text", text: "A plain explanation with no defined terms." }]);
    assert.deepEqual(updated.terms, []);
  });

  test("rejects malformed, unresolved, duplicate, and unused term contracts", () => {
    const kb = setup();
    const base = { name: "Invalid", branch: "subjects", status: "unassessed" };

    expectCode(() => kb.createNode({
      ...base,
      description: [{ type: "term", termId: "missing" }],
      terms: []
    }), "unresolved_term_reference");

    expectCode(() => kb.createNode({
      ...base,
      description: [{ type: "term", termId: "term", label: "smuggled" }],
      terms: [{ id: "term", label: "Term", definition: "A concise definition." }]
    }), "malformed_term_reference");

    expectCode(() => kb.createNode({
      ...base,
      description: [{ type: "term", termId: "term" }],
      terms: [
        { id: "term", label: "Term", definition: "First definition." },
        { id: "term", label: "Term", definition: "Second definition." }
      ]
    }), "duplicate_term_id");

    expectCode(() => kb.createNode({
      ...base,
      description: [{ type: "text", text: "No reference here." }],
      terms: [{ id: "term", label: "Term", definition: "An unused definition." }]
    }), "unreferenced_term");
  });

  test("creates generated children with optional descriptions and essential terms atomically", () => {
    const kb = setup();
    const parent = kb.createNode({ name: "Learning", branch: "subjects", status: "unassessed" });
    const result = kb.establishKnownNode({
      node_id: parent.id,
      expected_revision: parent.revision,
      understanding: "Learning changes behaviour through experience.",
      children: [
        { name: "Model Training", ...exampleContent },
        "Learning Theory"
      ]
    });

    assert.deepEqual(result.children_created, ["Model Training", "Learning Theory"]);
    const children = kb.getKnowledgeNode({ node_id: parent.id }).children;
    const generated = kb.getNode(children.find((child) => child.name === "Model Training").id);
    const plain = kb.getNode(children.find((child) => child.name === "Learning Theory").id);
    assert.deepEqual(generated.description, exampleContent.description);
    assert.deepEqual(generated.terms, exampleContent.terms);
    assert.deepEqual(plain.description, []);
    assert.deepEqual(plain.terms, []);
  });

  test("renders explicit references as accessible buttons and keeps stored text inert", () => {
    class FakeElement {
      constructor(tagName) {
        this.tagName = tagName;
        this.children = [];
        this.attributes = new Map();
        this.listeners = new Map();
      }
      replaceChildren() { this.children = []; }
      append(...children) { this.children.push(...children); }
      setAttribute(name, value) { this.attributes.set(name, value); }
      addEventListener(name, listener) { this.listeners.set(name, listener); }
    }
    const document = {
      createElement: (tagName) => new FakeElement(tagName),
      createTextNode: (textContent) => ({ nodeType: 3, textContent })
    };
    const container = new FakeElement("div");
    let opened;
    renderInlineDescription({
      document,
      container,
      description: [
        { type: "text", text: "<img src=x onerror=alert(1)> " },
        { type: "term", termId: "weights" }
      ],
      terms: exampleContent.terms,
      onTermClick: (button, term) => { opened = { button, term }; }
    });

    assert.equal(container.children[0].nodeType, 3);
    assert.equal(container.children[0].textContent, "<img src=x onerror=alert(1)> ");
    const button = container.children[1];
    assert.equal(button.tagName, "button");
    assert.equal(button.type, "button");
    assert.equal(button.textContent, "weights");
    assert.equal(button.attributes.get("aria-haspopup"), "dialog");
    assert.equal(button.attributes.get("aria-expanded"), "false");
    button.listeners.get("click")();
    assert.equal(opened.term.definition, exampleContent.terms[0].definition);
  });

  test("renders a safe, persistent definition list for every local term", () => {
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
        definition: "<img src=x onerror=alert(1)>"
      }]
    });

    const [item] = container.children;
    assert.equal(item.className, "term-list-item");
    assert.equal(item.children[0].tagName, "dt");
    assert.equal(item.children[0].textContent, "<strong>Weights</strong>");
    assert.equal(item.children[1].tagName, "dd");
    assert.equal(item.children[1].textContent, "<img src=x onerror=alert(1)>");
  });
});

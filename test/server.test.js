import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { createApp } from "../src/server.js";
import { KNOWLEDGE_EXPORT_VERSION } from "../src/knowledge-base.js";

let app;
let baseUrl;

beforeEach(async () => {
  app = createApp({ databasePath: ":memory:", seedInitialTaxonomy: false });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const address = app.server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await app.close();
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json" } : undefined
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

describe("HTTP application", () => {
  test("serves the application and health endpoint", async () => {
    const page = await fetch(baseUrl);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Epistome/);

    const { response, body } = await request("/api/health");
    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: "ok" });
  });

  test("supports the node lifecycle through JSON endpoints", async () => {
    const created = await request("/api/nodes", {
      method: "POST",
      body: JSON.stringify({
        name: "Computer Science",
        branch: "subjects",
        status: "known",
        understanding: "Computer science studies computation, information, and the systems that operate on them.",
        terms: [{
          id: "algorithms",
          label: "algorithms",
          definition: "Finite procedures for carrying out computations."
        }]
      })
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.node.terms[0].id, "algorithms");

    const id = created.body.node.id;
    const read = await request(`/api/nodes/${id}`);
    assert.equal("description" in read.body.node, false);
    assert.deepEqual(read.body.node.terms, created.body.node.terms);
    const updated = await request(`/api/nodes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Computing" })
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.node.name, "Computing");

    const deleted = await request(`/api/nodes/${id}`, { method: "DELETE" });
    assert.equal(deleted.response.status, 204);
    const list = await request("/api/nodes");
    assert.deepEqual(list.body.nodes, []);
  });

  test("returns stable validation errors", async () => {
    const { response, body } = await request("/api/nodes", {
      method: "POST",
      body: JSON.stringify({ name: "Ethics", branch: "ideologies", status: "known" })
    });
    assert.equal(response.status, 400);
    assert.equal(body.error.code, "understanding_required");
  });

  test("exports and imports a full versioned replacement", async () => {
    const first = app.knowledgeBase.createNode({
      name: "Physics",
      branch: "subjects",
      status: "known",
      understanding: "Physics models matter, energy, motion, and their interactions."
    });
    const second = app.knowledgeBase.createNode({
      name: "Metaphysics",
      branch: "ideologies",
      status: "known",
      understanding: "Metaphysics examines the most general structure and categories of reality."
    });
    app.knowledgeBase.createConnection({ sourceId: first.id, targetId: second.id });

    const exported = await request("/api/export");
    assert.equal(exported.response.status, 200);
    assert.equal(exported.body.format, "epistome");
    assert.equal(exported.body.format_version, KNOWLEDGE_EXPORT_VERSION);

    app.knowledgeBase.createNode({ name: "Temporary", branch: "subjects", status: "unassessed" });
    const imported = await request("/api/import", {
      method: "POST",
      body: JSON.stringify(exported.body)
    });
    assert.equal(imported.response.status, 200);
    assert.deepEqual(imported.body.imported, {
      format_version: KNOWLEDGE_EXPORT_VERSION,
      nodes_imported: 2,
      connections_imported: 1
    });

    const nodes = await request("/api/nodes");
    assert.deepEqual(nodes.body.nodes.map((node) => node.name), ["Metaphysics", "Physics"]);
    assert.equal(app.knowledgeBase.getNode(first.id).connections[0].node.id, second.id);
  });
});

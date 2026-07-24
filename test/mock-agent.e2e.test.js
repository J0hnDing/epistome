import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createApp } from "../src/server.js";

let app;
let baseUrl;

class MockKnowledgeAgent {
  constructor(url) {
    this.url = url;
  }

  async call(toolName, input) {
    const response = await fetch(`${this.url}/api/agent/${toolName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const output = await response.json();
    if (!response.ok) {
      const error = new Error(output.error.message);
      error.status = response.status;
      error.code = output.error.code;
      error.details = output.error.details;
      throw error;
    }
    return output;
  }
}

async function rawRequest(path, input) {
  const response = await fetch(`${baseUrl}${path}`, input === undefined ? {} : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return { response, output: await response.json() };
}

before(async () => {
  app = createApp({ databasePath: ":memory:", seedInitialTaxonomy: false });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  await app.close();
});

describe("mock AI agent over HTTP", () => {
  test("discovers, inspects, establishes, and revises knowledge using explicit IDs", async () => {
    const catalogResponse = await fetch(`${baseUrl}/api/agent/tools`);
    const catalog = await catalogResponse.json();
    assert.equal(catalog.guide_url, "/api/agent/guide");
    assert.equal(catalog.openapi_url, "/api/openapi.json");
    assert.deepEqual(catalog.tools.map((tool) => tool.name), [
      "search_knowledge",
      "list_frontier_nodes",
      "get_knowledge_node",
      "establish_known_node",
      "update_known_node"
    ]);
    const [guideResponse, specificationResponse] = await Promise.all([
      fetch(`${baseUrl}${catalog.guide_url}`),
      fetch(`${baseUrl}${catalog.openapi_url}`)
    ]);
    const guide = await guideResponse.json();
    const specification = await specificationResponse.json();
    assert.match(guide.expansion_boundary.summary, /immediate children/i);
    assert.ok(specification.paths["/api/agent/establish_known_node"].post);

    // A user-created unassessed placeholder gives the agent an explicit node to work from.
    const seeded = await rawRequest("/api/nodes", {
      name: "Machine Learning",
      branch: "subjects",
      status: "unassessed"
    });
    assert.equal(seeded.response.status, 201);

    const agent = new MockKnowledgeAgent(baseUrl);
    assert.equal(Object.hasOwn(agent, "current_node"), false);

    const search = await agent.call("search_knowledge", {
      query: "machine learning",
      parent_id: null,
      branch: "subjects",
      limit: 5
    });
    assert.deepEqual(search.results, [{
      id: seeded.output.node.id,
      name: "Machine Learning",
      path: ["Subjects", "Machine Learning"],
      status: "unassessed"
    }]);
    assert.deepEqual(Object.keys(search.results[0]), ["id", "name", "path", "status"]);

    const inspected = await agent.call("get_knowledge_node", { node_id: search.results[0].id });
    assert.equal(inspected.revision, 1);
    assert.equal(inspected.parent, null);
    assert.deepEqual(inspected.children, []);

    const established = await agent.call("establish_known_node", {
      node_id: inspected.id,
      expected_revision: inspected.revision,
      understanding: "Systems learn behaviour or patterns from data.",
      terms: [{
        id: "training-data",
        label: "training data",
        definition: "Examples used to adjust or select a model."
      }],
      children: [
        "Supervised Learning",
        "Unsupervised Learning",
        "Reinforcement Learning"
      ]
    });
    assert.equal(established.node.revision, 2);
    assert.equal(established.node.terms[0].id, "training-data");
    assert.deepEqual(established.children_created, [
      "Supervised Learning", "Unsupervised Learning", "Reinforcement Learning"
    ]);

    const frontier = await agent.call("list_frontier_nodes", {
      parent_id: inspected.id,
      status: ["unknown", "unassessed"],
      limit: 50,
      cursor: null
    });
    assert.deepEqual(
      frontier.nodes.map(({ name, status, parent_id: parentId }) => ({ name, status, parentId })),
      [
        { name: "Supervised Learning", status: "unassessed", parentId: inspected.id },
        { name: "Unsupervised Learning", status: "unassessed", parentId: inspected.id },
        { name: "Reinforcement Learning", status: "unassessed", parentId: inspected.id }
      ]
    );
    assert.equal(frontier.next_cursor, null);

    const expanded = await agent.call("get_knowledge_node", { node_id: inspected.id });
    assert.equal(expanded.status, "known");
    assert.equal(expanded.terms[0].definition, "Examples used to adjust or select a model.");
    assert.equal(expanded.children.length, 3);
    assert.ok(expanded.children.every((child) => child.status === "unassessed"));

    const childSearch = await agent.call("search_knowledge", {
      query: "reinforcement learning",
      parent_id: expanded.id,
      branch: "subjects",
      limit: 1
    });
    const child = await agent.call("get_knowledge_node", { node_id: childSearch.results[0].id });
    assert.deepEqual(child.path, ["Subjects", "Machine Learning", "Reinforcement Learning"]);
    assert.equal(child.parent.id, expanded.id);
    assert.equal(child.understanding, null);
    assert.deepEqual(child.terms, []);

    const knownLeaf = await agent.call("establish_known_node", {
      node_id: child.id,
      expected_revision: child.revision,
      understanding: "An agent learns actions through feedback from an environment.",
      terms: [{
        id: "rewards",
        label: "rewards",
        definition: "Feedback signals indicating the desirability of outcomes."
      }],
      children: []
    });
    assert.equal(knownLeaf.node.status, "known");
    assert.equal(knownLeaf.node.terms[0].id, "rewards");

    // Establishing the child changed its status in the parent's bounded view.
    const refreshedParent = await agent.call("get_knowledge_node", { node_id: expanded.id });
    assert.equal(refreshedParent.revision, 3);

    const updated = await agent.call("update_known_node", {
      node_id: refreshedParent.id,
      expected_revision: refreshedParent.revision,
      understanding: "Systems infer useful behaviour or patterns from data and feedback.",
      terms: [{
        id: "feedback",
        label: "feedback",
        definition: "Information used to improve later predictions or actions."
      }],
      children_to_add: ["Self-Supervised Learning", "Supervised Learning"]
    });
    assert.equal(updated.node.revision, 4);
    assert.equal(updated.node.terms[0].id, "feedback");
    assert.deepEqual(updated.children_created, ["Self-Supervised Learning"]);
    assert.deepEqual(updated.children_existing, ["Supervised Learning"]);

    await assert.rejects(
      agent.call("update_known_node", {
        node_id: refreshedParent.id,
        expected_revision: refreshedParent.revision,
        understanding: "A stale change that must not be applied.",
        terms: [{ id: "stale-term", label: "stale term", definition: "Must not be stored." }],
        children_to_add: ["Leaked Stale Child"]
      }),
      (error) => error.status === 409 && error.code === "stale_revision"
    );

    const finalNode = await agent.call("get_knowledge_node", { node_id: expanded.id });
    assert.equal(finalNode.revision, 4);
    assert.equal(finalNode.understanding, updated.node.understanding);
    assert.deepEqual(finalNode.terms, updated.node.terms);
    assert.equal(finalNode.children.some((candidate) => candidate.name === "Leaked Stale Child"), false);

    const generatedChildSearch = await agent.call("search_knowledge", {
      query: "self-supervised learning",
      parent_id: finalNode.id,
      branch: "subjects",
      limit: 1
    });
    const generatedChild = await agent.call("get_knowledge_node", {
      node_id: generatedChildSearch.results[0].id
    });
    assert.equal(generatedChild.status, "unassessed");
    assert.equal(generatedChild.understanding, null);
    assert.deepEqual(generatedChild.terms, []);
  });

  test("cannot add children through update_known_node beneath a non-known node", async () => {
    const seeded = await rawRequest("/api/nodes", {
      name: "Unassessed Boundary",
      branch: "subjects",
      status: "unassessed"
    });
    const agent = new MockKnowledgeAgent(baseUrl);

    await assert.rejects(
      agent.call("update_known_node", {
        node_id: seeded.output.node.id,
        expected_revision: seeded.output.node.revision,
        understanding: "This update is not allowed to establish a node.",
        children_to_add: ["Invalid Descendant"]
      }),
      (error) => error.status === 409 && error.code === "node_not_known"
    );

    const unchanged = await agent.call("get_knowledge_node", { node_id: seeded.output.node.id });
    assert.equal(unchanged.status, "unassessed");
    assert.deepEqual(unchanged.children, []);
  });

  test("rejects explanatory child objects without changing the node", async () => {
    const seeded = await rawRequest("/api/nodes", {
      name: "Name-only Boundary",
      branch: "subjects",
      status: "unassessed"
    });
    const agent = new MockKnowledgeAgent(baseUrl);

    await assert.rejects(
      agent.call("establish_known_node", {
        node_id: seeded.output.node.id,
        expected_revision: seeded.output.node.revision,
        understanding: "This understanding must not be committed.",
        children: [{ name: "Forbidden Content", terms: [] }]
      }),
      (error) => error.status === 400 && error.code === "invalid_child"
    );

    const unchanged = await agent.call("get_knowledge_node", {
      node_id: seeded.output.node.id
    });
    assert.equal(unchanged.revision, seeded.output.node.revision);
    assert.equal(unchanged.status, "unassessed");
    assert.equal(unchanged.understanding, null);
    assert.deepEqual(unchanged.terms, []);
  });
});

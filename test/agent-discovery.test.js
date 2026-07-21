import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createApp } from "../src/server.js";

let app;
let baseUrl;

before(async () => {
  app = createApp({ databasePath: ":memory:", seedInitialTaxonomy: false });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  await app.close();
});

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^application\/json/);
  return response.json();
}

describe("agent API discovery", () => {
  test("tool catalog points agents to the guide and OpenAPI specification", async () => {
    const catalog = await getJson("/api/agent/tools");
    assert.equal(catalog.project, "Epistome");
    assert.equal(catalog.guide_url, "/api/agent/guide");
    assert.equal(catalog.openapi_url, "/api/openapi.json");
    assert.deepEqual(catalog.tools.map((tool) => tool.name), [
      "search_knowledge",
      "list_frontier_nodes",
      "get_knowledge_node",
      "establish_known_node",
      "update_known_node"
    ]);
    for (const tool of catalog.tools) {
      assert.ok(tool.description.length > 80, `${tool.name} needs a substantive description`);
      assert.equal(tool.method, "POST");
      assert.equal(tool.input_schema.additionalProperties, false);
    }

    const establish = catalog.tools.find((tool) => tool.name === "establish_known_node");
    assert.match(establish.description, /immediate children/i);
    assert.match(establish.description, /unassessed/i);
    assert.match(establish.description, /never include grandchildren/i);
    assert.match(establish.description, /exhaustive external taxonomies/i);
    assert.match(establish.description, /children: \[\].*known leaf/i);
    assert.match(establish.input_schema.properties.children.description, /known parent/i);
    assert.match(establish.input_schema.properties.children.description, /known leaf/i);
    assert.match(establish.description, /one direct explanation/i);
    assert.equal(establish.input_schema.properties.description, undefined);
    assert.equal(establish.input_schema.properties.terms.maxItems, 20);
    assert.match(establish.input_schema.properties.terms.description, /must not duplicate children|never define an existing or proposed child/i);
    assert.match(establish.input_schema.properties.terms.description, /narrower descendant/i);
    assert.match(establish.input_schema.properties.children.description, /name-only/i);
    assert.equal(establish.input_schema.properties.children.items.type, "string");
    const update = catalog.tools.find((tool) => tool.name === "update_known_node");
    assert.equal(update.input_schema.properties.description, undefined);
    assert.equal(update.input_schema.properties.terms.maxItems, 20);
    assert.equal(update.input_schema.properties.children_to_add.items.type, "string");

    const frontier = catalog.tools.find((tool) => tool.name === "list_frontier_nodes");
    assert.match(frontier.description, /Subjects tree only/i);
    assert.match(frontier.description, /unknown or unassessed.*parent is known/i);
    assert.match(frontier.description, /Ideology nodes are never returned/i);
  });

  test("agent guide explains the project, statuses, workflow, and expansion boundary", async () => {
    const guide = await getJson("/api/agent/guide");
    assert.match(guide.project.purpose, /personal.*conceptual understanding/i);
    assert.match(guide.structure.roots.subjects, /descriptive knowledge/i);
    assert.match(guide.structure.roots.ideologies, /normative/i);
    assert.match(guide.structure.status.known, /central idea/i);
    assert.match(guide.structure.status.unknown, /frontier/i);
    assert.match(guide.structure.frontier.definition, /unknown or unassessed.*parent is known/i);
    assert.match(guide.structure.frontier.api_scope, /restricted to Subjects/i);
    assert.match(guide.structure.frontier.api_scope, /never returns Ideology/i);
    assert.match(guide.agent_workflow.state_model, /no global.*current_node/i);
    assert.match(guide.terms.description, /known node/i);
    assert.ok(guide.terms.rules.some((rule) => /never submit HTML/i.test(rule)));
    assert.ok(guide.terms.rules.some((rule) => /child knowledge node/i.test(rule)));
    assert.ok(guide.terms.rules.some((rule) => /do not define an immediate child.*proposed child/i.test(rule)));
    assert.ok(guide.terms.rules.some((rule) => /child's own explanation/i.test(rule)));

    assert.match(guide.expansion_boundary.summary, /immediate children/i);
    assert.match(guide.expansion_boundary.rule, /newly created child is.*unassessed/i);
    assert.ok(guide.expansion_boundary.stop_when.some((rule) => /grandchildren/i.test(rule)));
    assert.ok(guide.expansion_boundary.stop_when.some((rule) => /exhaustive.*taxonomy/i.test(rule)));
    assert.ok(guide.expansion_boundary.stop_when.some((rule) => /empty child list/i.test(rule)));
    assert.ok(guide.expansion_boundary.consequences.some((rule) => /never create or infer grandchildren/i.test(rule)));
  });

  test("OpenAPI 3.1 specifies every operation, payload, response, and error surface", async () => {
    const specification = await getJson("/api/openapi.json");
    assert.equal(specification.openapi, "3.1.0");
    assert.match(specification.info.description, /personal conceptual understanding/i);
    assert.equal(specification["x-agent-guide"], "/api/agent/guide");

    const operationNames = [
      "search_knowledge",
      "list_frontier_nodes",
      "get_knowledge_node",
      "establish_known_node",
      "update_known_node"
    ];
    for (const operationName of operationNames) {
      const path = `/api/agent/${operationName}`;
      const operation = specification.paths[path]?.post;
      assert.ok(operation, `OpenAPI path missing for ${operationName}`);
      assert.equal(operation.operationId, operationName);
      assert.ok(operation.description.length > 100, `${operationName} description is too weak`);
      assert.ok(operation.requestBody.content["application/json"].schema.$ref);
      assert.ok(operation.responses[200].content["application/json"].schema.$ref);
      assert.ok(operation.responses[400]);
      assert.ok(operation.responses[404]);
      assert.ok(operation.responses[409]);
    }

    const establish = specification.paths["/api/agent/establish_known_node"].post;
    assert.match(establish.description, /immediate children/i);
    assert.match(establish.description, /exhaustive external taxonomy/i);
    assert.match(establish.description, /grandchildren/i);
    assert.match(establish.description, /children: \[\]/i);
    const childDescription = specification.components.schemas.EstablishKnownNodeInput
      .properties.children.description;
    assert.match(childDescription, /newly created child is.*unassessed/i);
    assert.equal(specification.components.schemas.NodeDescription, undefined);
    assert.ok(specification.components.schemas.NodeTerm);
    assert.equal(
      specification.components.schemas.KnowledgeNode.properties.terms.$ref,
      "#/components/schemas/NodeTerms"
    );
    assert.match(
      specification.components.schemas.NodeTerms.description,
      /must not duplicate children.*narrower descendants/i
    );
    assert.match(establish.description, /do not define an existing or proposed child/i);
    assert.equal(
      specification.components.schemas.GeneratedChildInput.type,
      "string"
    );
    assert.equal(specification.components.schemas.KnowledgeNode.properties.description, undefined);
    assert.equal(specification.components.schemas.MutationNode.properties.description, undefined);
    assert.equal(
      specification.components.schemas.MutationNode.properties.terms.$ref,
      "#/components/schemas/NodeTerms"
    );
    assert.equal(
      specification.components.schemas.EstablishKnownNodeInput.properties.description,
      undefined
    );
    assert.equal(
      specification.components.schemas.UpdateKnownNodeInput.properties.description,
      undefined
    );

    const frontier = specification.paths["/api/agent/list_frontier_nodes"].post;
    assert.match(frontier.description, /Subjects tree/i);
    assert.match(frontier.description, /immediate canonical parent is known/i);
    assert.match(frontier.description, /Ideology nodes are never eligible/i);
    assert.ok(specification.components.schemas.ListFrontierNodesOutput);

    const documentText = JSON.stringify(specification);
    const refs = [...documentText.matchAll(/#\/components\/schemas\/([A-Za-z0-9]+)/g)]
      .map((match) => match[1]);
    for (const ref of refs) {
      assert.ok(specification.components.schemas[ref], `Unresolved OpenAPI schema reference: ${ref}`);
    }
  });
});

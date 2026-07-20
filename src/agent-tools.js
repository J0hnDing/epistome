import { EXPANSION_BOUNDARY } from "./agent-guide.js";

const descriptionSchema = {
  type: "array",
  maxItems: 200,
  description: "Ordered safe text and explicit references to terms owned by this node. Never submit HTML.",
  items: {
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["type", "text"],
        properties: { type: { const: "text" }, text: { type: "string", minLength: 1 } }
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["type", "termId"],
        properties: {
          type: { const: "term" },
          termId: { type: "string", pattern: "^[a-z][a-z0-9-]{0,63}$" }
        }
      }
    ]
  }
};

const termsSchema = {
  type: "array",
  maxItems: 20,
  description: "Node-local terms. Every id must be unique and every term must be explicitly referenced by description.",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["id", "label", "definition"],
    properties: {
      id: { type: "string", pattern: "^[a-z][a-z0-9-]{0,63}$" },
      label: { type: "string", minLength: 1, maxLength: 80 },
      definition: { type: "string", minLength: 1, maxLength: 500 }
    }
  }
};

const childSchema = {
  oneOf: [
    { type: "string", minLength: 1, maxLength: 120 },
    {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: {
        name: { type: "string", minLength: 1, maxLength: 120 },
        description: descriptionSchema,
        terms: termsSchema
      }
    }
  ]
};

export const AGENT_TOOLS = Object.freeze([
  {
    name: "search_knowledge",
    description: "Find candidate nodes without changing navigation state. Returns only ID, name, canonical path, and status. Use parent_id to search descendants of one explicit parent; it never establishes a current node.",
    method: "POST",
    endpoint: "/api/agent/search_knowledge",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1, maxLength: 200, description: "Text matched against node names first, then understanding and description text." },
        parent_id: { type: ["integer", "null"], minimum: 1, description: "Optional explicit subtree root. Only its descendants are searched; the parent itself is excluded." },
        branch: { type: ["string", "null"], enum: ["subjects", "ideologies", null], description: "Optional primary-branch scope. It must match parent_id when both are supplied." },
        limit: { type: "integer", minimum: 1, maximum: 25, default: 5 }
      }
    }
  },
  {
    name: "list_frontier_nodes",
    description: "List frontier nodes from the Subjects tree only. A frontier node is an unknown or unassessed node whose immediate canonical parent is known. parent_id filters by one exact Subject parent; null means all Subject parents. Results are compact and cursor-paginated. Ideology nodes are never returned.",
    method: "POST",
    endpoint: "/api/agent/list_frontier_nodes",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        parent_id: { type: ["integer", "null"], minimum: 1, default: null, description: "Optional exact canonical parent filter. Null means all known parents in Subjects, not only the virtual Subjects root." },
        status: {
          type: "array",
          minItems: 1,
          maxItems: 2,
          uniqueItems: true,
          default: ["unknown", "unassessed"],
          items: { type: "string", enum: ["unknown", "unassessed"] },
          description: "Frontier statuses to return. Known is invalid because known nodes are not frontier nodes."
        },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
        cursor: { type: ["string", "null"], default: null, description: "Opaque cursor returned by the previous page. Keep all filters unchanged when continuing." }
      }
    }
  },
  {
    name: "get_knowledge_node",
    description: "Inspect one explicitly identified node before mutation. Returns its revision, understanding, structured description, local terms, canonical path, parent, and immediate children only—never grandchildren, connections, or unrelated nodes.",
    method: "POST",
    endpoint: "/api/agent/get_knowledge_node",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["node_id"],
      properties: { node_id: { type: "integer", minimum: 1 } }
    }
  },
  {
    name: "establish_known_node",
    description: `Mark an explicitly identified node known and optionally create missing immediate children as unassessed. A node description may combine safe text with explicit references to its own concise terms. For a new child, include an explanatory description and a limited set of referenced essential terms when they materially help. ${EXPANSION_BOUNDARY.summary} ${EXPANSION_BOUNDARY.rule} Never include grandchildren or exhaustive external taxonomies. Use children: [] for a known leaf.`,
    method: "POST",
    endpoint: "/api/agent/establish_known_node",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["node_id", "expected_revision", "understanding", "children"],
      properties: {
        node_id: { type: "integer", minimum: 1 },
        expected_revision: { type: "integer", minimum: 1 },
        understanding: { type: "string", minLength: 1, maxLength: 2000, description: "The user's concise conceptual explanation in their own words." },
        description: descriptionSchema,
        terms: termsSchema,
        children: {
          type: "array",
          maxItems: 100,
          description: `${EXPANSION_BOUNDARY.rule} Prefer an object with description and referenced essential terms when explanatory context materially helps; a name string remains accepted for children needing none. Use [] for a known leaf.`,
          items: childSchema
        }
      }
    }
  },
  {
    name: "update_known_node",
    description: `Update an explicitly identified, already known node, its optional structured description and node-local terms, and optionally add immediate unassessed children. It cannot rename, move, merge, delete, or recategorize nodes. For a new child, provide explanatory context and referenced essential terms only when useful. ${EXPANSION_BOUNDARY.summary} Use children_to_add: [] when only node content changes.`,
    method: "POST",
    endpoint: "/api/agent/update_known_node",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["node_id", "expected_revision", "understanding", "children_to_add"],
      properties: {
        node_id: { type: "integer", minimum: 1 },
        expected_revision: { type: "integer", minimum: 1 },
        understanding: { type: "string", minLength: 1, maxLength: 2000, description: "The revised concise conceptual explanation." },
        description: descriptionSchema,
        terms: termsSchema,
        children_to_add: {
          type: "array",
          maxItems: 100,
          description: `${EXPANSION_BOUNDARY.rule} Child objects may include a description and referenced essential terms. Existing immediate children are reused and never replaced.`,
          items: childSchema
        }
      }
    }
  }
]);

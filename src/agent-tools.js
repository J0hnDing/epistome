import { EXPANSION_BOUNDARY } from "./agent-guide.js";

const termsSchema = {
  type: "array",
  maxItems: 20,
  description: "A small glossary of vocabulary central to this known node's own explanation. Every id must be unique within the node. Never define an existing or proposed child, or vocabulary whose explanation belongs to a narrower descendant; define child-owned vocabulary only on that child after it is explicitly established as known.",
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

const childSchema = { type: "string", minLength: 1, maxLength: 120 };

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
        query: { type: "string", minLength: 1, maxLength: 200, description: "Text matched against node names first, then known-node explanations and term definitions." },
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
    description: "Inspect one explicitly identified node before mutation. Returns its revision, known-node explanation, local terms, canonical path, parent, and immediate children only—never grandchildren, connections, or unrelated nodes.",
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
    description: `Mark an explicitly identified node known, record one direct explanation of its essence, optionally define concise terms owned by that known node, and optionally create missing immediate children as name-only unassessed leaves. Terms must be central to the current explanation and must not duplicate children or vocabulary owned by descendants. ${EXPANSION_BOUNDARY.summary} ${EXPANSION_BOUNDARY.rule} Never include grandchildren, child explanations, child terms, or exhaustive external taxonomies. Use children: [] for a known leaf.`,
    method: "POST",
    endpoint: "/api/agent/establish_known_node",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["node_id", "expected_revision", "understanding", "children"],
      properties: {
        node_id: { type: "integer", minimum: 1 },
        expected_revision: { type: "integer", minimum: 1 },
        understanding: { type: "string", minLength: 1, maxLength: 2000, description: "A direct explanation of the concept's essence in the user's own words; do not write metacommentary such as 'I understand'." },
        terms: termsSchema,
        children: {
          type: "array",
          maxItems: 100,
          description: `${EXPANSION_BOUNDARY.rule} Each item is only the child name. Never attach explanations or terms to an unassessed child. Use [] for a known leaf.`,
          items: childSchema
        }
      }
    }
  },
  {
    name: "update_known_node",
    description: `Update an explicitly identified, already known node's single direct explanation and optional terms owned by that node, and optionally add name-only immediate unassessed children. Terms must be central to the current explanation and must not duplicate children or vocabulary owned by descendants. It cannot rename, move, merge, delete, recategorize, or attach content to a child. ${EXPANSION_BOUNDARY.summary} Use children_to_add: [] when only known-node content changes.`,
    method: "POST",
    endpoint: "/api/agent/update_known_node",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["node_id", "expected_revision", "understanding", "children_to_add"],
      properties: {
        node_id: { type: "integer", minimum: 1 },
        expected_revision: { type: "integer", minimum: 1 },
        understanding: { type: "string", minLength: 1, maxLength: 2000, description: "The revised direct explanation of the concept's essence, without metacommentary." },
        terms: termsSchema,
        children_to_add: {
          type: "array",
          maxItems: 100,
          description: `${EXPANSION_BOUNDARY.rule} Each item is only the child name. Existing immediate children are reused and never replaced.`,
          items: childSchema
        }
      }
    }
  }
]);

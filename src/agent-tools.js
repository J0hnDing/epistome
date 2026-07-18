import { EXPANSION_BOUNDARY } from "./agent-guide.js";

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
        query: { type: "string", minLength: 1, maxLength: 200, description: "Terms matched against node names first and understanding text second." },
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
    description: "Inspect one explicitly identified node before mutation. Returns its revision, understanding, canonical path, parent, and immediate children only—never grandchildren, connections, or unrelated nodes.",
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
    description: `Mark an explicitly identified node known and optionally create missing immediate children as unassessed. ${EXPANSION_BOUNDARY.summary} ${EXPANSION_BOUNDARY.rule} Never include grandchildren, exhaustive external taxonomies, isolated facts, examples, sources, or implementation details. Use children: [] for a known leaf.`,
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
        children: {
          type: "array",
          maxItems: 100,
          description: `${EXPANSION_BOUNDARY.rule} Use [] for a known leaf when no useful decomposition exists.`,
          items: { type: "string", minLength: 1, maxLength: 120 }
        }
      }
    }
  },
  {
    name: "update_known_node",
    description: `Update an explicitly identified, already known node and optionally add immediate unassessed children. It cannot rename, move, merge, delete, or recategorize nodes. ${EXPANSION_BOUNDARY.summary} Apply the same no-grandchildren and no-exhaustive-taxonomy boundary; use children_to_add: [] when only the understanding changes.`,
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
        children_to_add: {
          type: "array",
          maxItems: 100,
          description: `${EXPANSION_BOUNDARY.rule} Existing immediate children are reused and never replaced.`,
          items: { type: "string", minLength: 1, maxLength: 120 }
        }
      }
    }
  }
]);

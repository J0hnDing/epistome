import { EXPANSION_BOUNDARY } from "./agent-guide.js";

const errorResponses = {
  400: {
    description: "Invalid input or a field outside the operation's allowed contract.",
    content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
  },
  404: {
    description: "The explicitly identified node does not exist.",
    content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
  },
  409: {
    description: "The current tree state conflicts with the request, including a stale revision or a non-known update target.",
    content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
  },
  500: {
    description: "Unexpected local server failure.",
    content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
  }
};

const jsonRequest = (schema) => ({
  required: true,
  content: { "application/json": { schema } }
});

const jsonResponse = (description, schema) => ({
  description,
  content: { "application/json": { schema } }
});

export const OPENAPI_SPEC = Object.freeze({
  openapi: "3.1.0",
  info: {
    title: "Epistome — Agent API",
    version: "1.0.0",
    summary: "Stateless inspection and constrained updates for a personal conceptual-understanding tree.",
    description: [
      "Epistome is a personal conceptual understanding tree, not a fact archive or complete external ontology.",
      "Knowledge is organized beneath the virtual Subjects and Ideologies roots. Known nodes contain the user's concise explanation; unknown and unassessed nodes are leaves that mark the knowledge frontier.",
      "A fresh production database provides broad top-level Subject and Ideology concepts as unassessed leaves. These are assessment starting points, not claims of knowledge. Ideologies is philosophy in the broad sense and has no separate Philosophy container.",
      "Agent navigation is stateless and every operation uses explicit node IDs. Mutations use optimistic revisions, cannot restructure or delete nodes, and preserve the frontier invariants.",
      `${EXPANSION_BOUNDARY.summary} ${EXPANSION_BOUNDARY.rule}`,
      "Read GET /api/agent/guide before mutating knowledge."
    ].join("\n\n")
  },
  servers: [{ url: "/", description: "The same local Epistome server." }],
  tags: [
    { name: "Discovery", description: "Machine-readable specification, tool catalog, and conceptual guide." },
    { name: "Knowledge", description: "Stateless knowledge inspection and constrained mutation operations." }
  ],
  "x-agent-guide": "/api/agent/guide",
  paths: {
    "/api/openapi.json": {
      get: {
        operationId: "get_openapi_specification",
        tags: ["Discovery"],
        summary: "Get this OpenAPI specification",
        description: "Returns the authoritative OpenAPI 3.1 description of the AI-agent surface.",
        responses: { 200: jsonResponse("OpenAPI document.", { type: "object" }) }
      }
    },
    "/api/agent/guide": {
      get: {
        operationId: "get_agent_guide",
        tags: ["Discovery"],
        summary: "Understand the project and safe agent workflow",
        description: "Returns the project purpose, root meanings, statuses, understanding-statement policy, explicit-ID workflow, mutation limits, and child expansion boundary.",
        responses: { 200: jsonResponse("Machine-readable project and agent guide.", { $ref: "#/components/schemas/AgentGuide" }) }
      }
    },
    "/api/agent/tools": {
      get: {
        operationId: "list_agent_tools",
        tags: ["Discovery"],
        summary: "List agent operations and discovery resources",
        description: "A compact catalog pointing to the project guide and OpenAPI specification and listing each callable operation with its input schema.",
        responses: { 200: jsonResponse("Agent discovery catalog.", { $ref: "#/components/schemas/AgentToolCatalog" }) }
      }
    },
    "/api/agent/search_knowledge": {
      post: {
        operationId: "search_knowledge",
        tags: ["Knowledge"],
        summary: "Search for nodes without changing navigation state",
        description: "Returns compact candidate summaries only. parent_id scopes the search to descendants of that explicit parent; the parent is not included. The server never stores a current node.",
        requestBody: jsonRequest({ $ref: "#/components/schemas/SearchKnowledgeInput" }),
        responses: {
          200: jsonResponse("Compact search results.", { $ref: "#/components/schemas/SearchKnowledgeOutput" }),
          ...errorResponses
        }
      }
    },
    "/api/agent/list_frontier_nodes": {
      post: {
        operationId: "list_frontier_nodes",
        tags: ["Knowledge"],
        summary: "List assessment-frontier nodes from Subjects only",
        description: "Returns only unknown or unassessed nodes in the Subjects tree whose immediate canonical parent is known. Ideology nodes are never eligible. parent_id null means all known Subject parents; a non-null parent_id filters by that exact canonical parent. Results contain only ID, name, status, and parent ID and are ordered by ID for opaque cursor pagination.",
        requestBody: jsonRequest({ $ref: "#/components/schemas/ListFrontierNodesInput" }),
        responses: {
          200: jsonResponse("Compact page of Subject frontier nodes.", { $ref: "#/components/schemas/ListFrontierNodesOutput" }),
          ...errorResponses
        }
      }
    },
    "/api/agent/get_knowledge_node": {
      post: {
        operationId: "get_knowledge_node",
        tags: ["Knowledge"],
        summary: "Inspect one explicitly identified node",
        description: "Returns only the node's mutation revision, conceptual fields, canonical path, parent, and immediate children. It deliberately excludes grandchildren, connections, timestamps, and unrelated nodes.",
        requestBody: jsonRequest({ $ref: "#/components/schemas/GetKnowledgeNodeInput" }),
        responses: {
          200: jsonResponse("Bounded node view.", { $ref: "#/components/schemas/KnowledgeNode" }),
          ...errorResponses
        }
      }
    },
    "/api/agent/establish_known_node": {
      post: {
        operationId: "establish_known_node",
        tags: ["Knowledge"],
        summary: "Establish a node as known and optionally define its immediate frontier",
        description: [
          "Atomically verifies expected_revision, records a non-empty conceptual understanding, marks the node known, reuses matching immediate children, and creates missing immediate children as unassessed.",
          EXPANSION_BOUNDARY.summary,
          EXPANSION_BOUNDARY.rule,
          "Do not submit an exhaustive external taxonomy. Do not submit facts, examples, formulas, terminology, sources, courses, projects, implementation details, or grandchildren. Use children: [] when the node is a useful known leaf. Each created child must be independently inspected and established before it can be expanded.",
          "Existing children are never deleted or replaced. A stale revision rejects the complete transaction."
        ].join("\n\n"),
        requestBody: jsonRequest({ $ref: "#/components/schemas/EstablishKnownNodeInput" }),
        responses: {
          200: jsonResponse("Established node and child reuse/creation report.", { $ref: "#/components/schemas/KnownNodeMutationOutput" }),
          ...errorResponses
        }
      }
    },
    "/api/agent/update_known_node": {
      post: {
        operationId: "update_known_node",
        tags: ["Knowledge"],
        summary: "Update an already known node without restructuring",
        description: [
          "Atomically verifies expected_revision, updates the known node's understanding, and optionally reuses or creates immediate unassessed children.",
          EXPANSION_BOUNDARY.summary,
          EXPANSION_BOUNDARY.rule,
          "The operation cannot delete, rename, move, merge, recategorize, or otherwise restructure nodes. Use children_to_add: [] when only the understanding changes."
        ].join("\n\n"),
        requestBody: jsonRequest({ $ref: "#/components/schemas/UpdateKnownNodeInput" }),
        responses: {
          200: jsonResponse("Updated node and child reuse/creation report.", { $ref: "#/components/schemas/KnownNodeMutationOutput" }),
          ...errorResponses
        }
      }
    }
  },
  components: {
    schemas: {
      KnowledgeStatus: {
        type: "string",
        enum: ["unassessed", "unknown", "known"],
        description: "Unassessed and unknown nodes are leaves. A known node has a meaningful understanding and may be decomposed when useful."
      },
      SearchKnowledgeInput: {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: {
          query: { type: "string", minLength: 1, maxLength: 200, description: "Terms matched against names first and understanding text second." },
          parent_id: { type: ["integer", "null"], minimum: 1, default: null, description: "Explicit subtree root. Only descendants are searched; null searches from the selected branch or both roots." },
          branch: { type: ["string", "null"], enum: ["subjects", "ideologies", null], default: null, description: "Optional primary-branch scope. Must match parent_id when both are present." },
          limit: { type: "integer", minimum: 1, maximum: 25, default: 5 }
        }
      },
      SearchResult: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "path", "status"],
        properties: {
          id: { type: "integer", minimum: 1 },
          name: { type: "string" },
          path: { type: "array", minItems: 2, items: { type: "string" }, description: "Canonical path beginning with Subjects or Ideologies." },
          status: { $ref: "#/components/schemas/KnowledgeStatus" }
        }
      },
      SearchKnowledgeOutput: {
        type: "object",
        additionalProperties: false,
        required: ["results"],
        properties: { results: { type: "array", items: { $ref: "#/components/schemas/SearchResult" } } }
      },
      ListFrontierNodesInput: {
        type: "object",
        additionalProperties: false,
        properties: {
          parent_id: {
            type: ["integer", "null"],
            minimum: 1,
            default: null,
            description: "Exact canonical parent filter. Null searches beneath every known node in Subjects; it does not mean direct children of the virtual Subjects root. Ideology parent IDs are rejected."
          },
          status: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            uniqueItems: true,
            default: ["unknown", "unassessed"],
            items: { type: "string", enum: ["unknown", "unassessed"] },
            description: "Frontier statuses to include. Known is not accepted."
          },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
          cursor: {
            type: ["string", "null"],
            default: null,
            description: "Opaque cursor from next_cursor on the previous page. Reuse it only with the same parent_id and status filters."
          }
        }
      },
      FrontierNode: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "status", "parent_id"],
        properties: {
          id: { type: "integer", minimum: 1 },
          name: { type: "string" },
          status: { type: "string", enum: ["unknown", "unassessed"] },
          parent_id: { type: "integer", minimum: 1, description: "ID of the known immediate canonical parent in Subjects." }
        }
      },
      ListFrontierNodesOutput: {
        type: "object",
        additionalProperties: false,
        required: ["nodes", "next_cursor"],
        properties: {
          nodes: { type: "array", items: { $ref: "#/components/schemas/FrontierNode" } },
          next_cursor: { type: ["string", "null"], description: "Pass this opaque value as cursor for the next page, or null when no further page exists." }
        }
      },
      GetKnowledgeNodeInput: {
        type: "object",
        additionalProperties: false,
        required: ["node_id"],
        properties: { node_id: { type: "integer", minimum: 1 } }
      },
      ParentSummary: {
        type: ["object", "null"],
        additionalProperties: false,
        required: ["id", "name"],
        properties: { id: { type: "integer", minimum: 1 }, name: { type: "string" } }
      },
      ChildSummary: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "status"],
        properties: {
          id: { type: "integer", minimum: 1 },
          name: { type: "string" },
          status: { $ref: "#/components/schemas/KnowledgeStatus" }
        }
      },
      KnowledgeNode: {
        type: "object",
        additionalProperties: false,
        required: ["id", "revision", "name", "status", "understanding", "path", "parent", "children"],
        properties: {
          id: { type: "integer", minimum: 1 },
          revision: { type: "integer", minimum: 1, description: "Supply this value as expected_revision in the next mutation after reconsidering the returned state." },
          name: { type: "string" },
          status: { $ref: "#/components/schemas/KnowledgeStatus" },
          understanding: { type: ["string", "null"], description: "Non-null only for known nodes." },
          path: { type: "array", minItems: 2, items: { type: "string" } },
          parent: { $ref: "#/components/schemas/ParentSummary" },
          children: { type: "array", items: { $ref: "#/components/schemas/ChildSummary" }, description: "Immediate children only." }
        }
      },
      EstablishKnownNodeInput: {
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
            items: { type: "string", minLength: 1, maxLength: 120 },
            description: `${EXPANSION_BOUNDARY.rule} Use an empty array for a known leaf.`
          }
        }
      },
      UpdateKnownNodeInput: {
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
            items: { type: "string", minLength: 1, maxLength: 120 },
            description: `${EXPANSION_BOUNDARY.rule} Existing children are reused and never replaced.`
          }
        }
      },
      MutationNode: {
        type: "object",
        additionalProperties: false,
        required: ["id", "revision", "status", "understanding"],
        properties: {
          id: { type: "integer", minimum: 1 },
          revision: { type: "integer", minimum: 1 },
          status: { type: "string", const: "known" },
          understanding: { type: "string", minLength: 1, maxLength: 2000 }
        }
      },
      KnownNodeMutationOutput: {
        type: "object",
        additionalProperties: false,
        required: ["node", "children_created", "children_existing", "children_conflicting"],
        properties: {
          node: { $ref: "#/components/schemas/MutationNode" },
          children_created: { type: "array", items: { type: "string" } },
          children_existing: { type: "array", items: { type: "string" } },
          children_conflicting: { type: "array", items: { type: "string" }, description: "Repeated requested names after case-insensitive normalization." }
        }
      },
      Error: {
        type: "object",
        additionalProperties: false,
        required: ["code", "message"],
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          details: { type: ["object", "null"], additionalProperties: true }
        }
      },
      ErrorResponse: {
        type: "object",
        additionalProperties: false,
        required: ["error"],
        properties: { error: { $ref: "#/components/schemas/Error" } }
      },
      AgentGuide: {
        type: "object",
        description: "Structured project semantics, expansion boundary, mutation limits, and recommended explicit-ID workflow.",
        required: ["project", "structure", "understanding_statement", "expansion_boundary", "agent_workflow", "mutation_limits", "resources"]
      },
      AgentToolCatalog: {
        type: "object",
        additionalProperties: false,
        required: ["project", "guide_url", "openapi_url", "tools"],
        properties: {
          project: { type: "string" },
          guide_url: { type: "string" },
          openapi_url: { type: "string" },
          tools: { type: "array", items: { type: "object" } }
        }
      }
    }
  }
});

export const EXPANSION_BOUNDARY = Object.freeze({
  summary: "Expansion stops at the requested node's immediate children.",
  rule: "Add only immediate children that are major conceptual subdivisions through which the user currently organizes the known parent. Every newly created child is unassessed and remains a leaf until a later, explicit establish_known_node call marks that child known.",
  include_when: [
    "the child is a subfield, type, major component, narrower question, or specific position within the parent",
    "the subdivision clarifies the user's understanding or exposes a useful knowledge frontier",
    "the user can meaningfully distinguish the proposed children at the current level"
  ],
  stop_when: [
    "further expansion would create grandchildren in the same operation",
    "the proposed items are isolated facts, formulas, constants, examples, exceptions, minor terminology, sources, courses, projects, or implementation details",
    "the list would merely reproduce an exhaustive textbook or AI-generated taxonomy",
    "no subdivision is useful; pass an empty child list for a known leaf"
  ],
  consequences: [
    "never create or infer grandchildren",
    "never expand an unknown or unassessed child",
    "reassess each child independently before expanding it"
  ]
});

export const AGENT_GUIDE = Object.freeze({
  project: {
    name: "Epistome",
    purpose: "A personal, tree-structured map of the user's current conceptual understanding and its frontier.",
    represents: [
      "which broad areas the user understands",
      "how known concepts divide into narrower concepts",
      "the user's concise understanding of each known concept",
      "confirmed unknown boundaries and unassessed areas"
    ],
    does_not_represent: [
      "a complete taxonomy of human knowledge",
      "a document, note, source, or fact archive",
      "objective proof that the user's understanding is correct",
      "projects, tasks, courses, files, preferences, or life history"
    ]
  },
  structure: {
    roots: {
      subjects: "Descriptive knowledge about reality, systems, mechanisms, events, empirical patterns, formal relationships, and technical methods.",
      ideologies: "Normative, philosophical, interpretive, political, religious, spiritual, and value-dependent frameworks. This root is philosophy in the broad sense, so it has no redundant Philosophy container. Understanding does not imply endorsement."
    },
    canonical_parent: "Every node has exactly one canonical parent. Parent-child relationships mean conceptual narrowing; applications, similarities, influences, and contrasts are not additional parents.",
    status: {
      unassessed: "The concept exists but the user has not determined whether they understand it. It must remain a leaf.",
      unknown: "The user has confirmed they cannot currently explain the concept meaningfully. It is a leaf marking the knowledge frontier.",
      known: "The user can explain the concept's central idea in their own words. It may remain a leaf or be decomposed when useful."
    },
    frontier: {
      definition: "An unknown or unassessed node whose immediate canonical parent is known.",
      api_scope: "list_frontier_nodes is restricted to Subjects. It never returns Ideology nodes.",
      virtual_root_rule: "Direct children of the virtual Subjects root are not frontier nodes because the virtual root is not a known node."
    }
  },
  understanding_statement: {
    rule: "Capture the user's concise conceptual model, not a copied definition or isolated fact.",
    prioritize: [
      "central mechanism",
      "main purpose or relationship",
      "key trade-off",
      "major insight",
      "defining assumption or distinction"
    ]
  },
  expansion_boundary: EXPANSION_BOUNDARY,
  agent_workflow: {
    state_model: "Stateless. There is no global or session current_node. Pass explicit node IDs on every read and mutation.",
    steps: [
      "Call list_frontier_nodes to discover unknown or unassessed assessment targets whose immediate parent is known. This operation is restricted to the Subjects tree.",
      "Call search_knowledge with an explicit query and optional branch or parent subtree scope.",
      "Call get_knowledge_node with a returned node ID to inspect its latest revision, understanding, parent, and immediate children.",
      "Use establish_known_node when an unknown or unassessed node has become known; apply the expansion boundary to its immediate children.",
      "Use update_known_node only for an already known node; update its understanding and optionally add immediate unassessed children.",
      "If a mutation returns stale_revision, discard the stale proposal, read the node again, and reconsider the change against the new state."
    ]
  },
  mutation_limits: [
    "Agent mutations cannot delete, rename, move, merge, or recategorize nodes.",
    "Existing children are reused by case-insensitive name and are never deleted or replaced.",
    "All understanding and child changes in one agent mutation are atomic.",
    "Unknown and unassessed nodes cannot have children; known descendants cannot exist beneath them."
  ],
  resources: {
    openapi: "/api/openapi.json",
    tools: "/api/agent/tools",
    guide: "/api/agent/guide"
  }
});

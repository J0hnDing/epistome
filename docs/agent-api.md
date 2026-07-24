# Stateless agent API

## Contract

The agent API lets an AI process inspect and improve the knowledge tree without granting it general restructuring operations. It has no global, process-level, session-level, or implicit current node. Every operation supplies either an explicit `node_id` or an explicit search scope, and every returned ID must be passed explicitly to the next operation.

The endpoint catalog is available from:

```http
GET /api/agent/tools
```

It returns each tool name, HTTP method, endpoint, description, and JSON input schema, plus links to:

- `GET /api/agent/guide` — the machine-readable project model, workflow, and expansion policy;
- `GET /api/openapi.json` — the authoritative OpenAPI 3.1 specification with request schemas, response schemas, errors, and descriptions.

An agent should inspect the guide and specification before its first mutation. The five operations themselves use `POST` so their structured inputs are always JSON request bodies.

Node IDs are positive integers in this implementation. Revisions are positive integers beginning at 1.
Requests containing fields outside an operation's published input schema are rejected with `400 unexpected_field`; mutation operations therefore cannot smuggle in rename, move, branch, merge, or deletion instructions.

## Expansion boundary

`establish_known_node.children` and `update_known_node.children_to_add` may describe only the requested node's immediate children.

Add a child only when it is a major conceptual subdivision through which the user currently organizes the known parent: a subfield, type, major component, narrower question, or specific position. The subdivision should clarify the user's understanding or expose a useful frontier.

Every created child is a name-only `unassessed` leaf with no explanation or terms. Child arrays accept strings only. The agent must inspect and establish that child in a later explicit operation before it can receive content or be expanded.

Stop rather than adding:

- grandchildren in the same operation;
- isolated facts, formulas, constants, examples, exceptions, or minor terminology;
- sources, courses, projects, or implementation details;
- an exhaustive textbook or AI-generated taxonomy;
- distinctions the user does not currently understand.

Use an empty child list when no useful decomposition exists. A known node is allowed to remain a leaf.

## Explanations and local terms

Known nodes contain one direct explanation in `understanding` and may define concise node-local terms:

```json
{
  "understanding": "Training adjusts model weights using patterns in data.",
  "terms": [
    {
      "id": "weights",
      "label": "weights",
      "definition": "Learned numeric parameters controlling how inputs affect an output."
    }
  ]
}
```

The explanation should state the topic's essence and must not use metacommentary such as “I understand.” Term IDs are unique within the node. Define only vocabulary central to the current node's own explanation. Never define an existing or proposed child, or vocabulary whose explanation belongs to a narrower descendant. If a concept is or should become a child, omit it from the parent's terms and define any essential child-owned vocabulary only after that child is explicitly established as known. Terms are not a second child list, topic outline, or exhaustive glossary.

Unknown and unassessed nodes always return `understanding: null` and `terms: []`. The removed `description` field and child objects are rejected. A matching existing child name is reused unchanged.

## `list_frontier_nodes`

```http
POST /api/agent/list_frontier_nodes
```

This operation lists assessment targets from the **Subjects tree only**. It never returns nodes from Ideologies.

A frontier node is defined exactly as:

> An unknown or unassessed node whose immediate canonical parent is known.

Because Subjects is a virtual root rather than a known node, an unknown or unassessed node directly beneath Subjects is not a frontier node under this definition.

Input:

```json
{
  "parent_id": null,
  "status": ["unknown", "unassessed"],
  "limit": 50,
  "cursor": null
}
```

- `parent_id: null` searches beneath every known parent in Subjects. It does not mean only direct children of the virtual Subjects root.
- A non-null `parent_id` filters by that exact canonical parent and must identify a node in Subjects.
- `status` accepts a non-empty subset of `unknown` and `unassessed`; it defaults to both.
- `limit` defaults to 50 and must be between 1 and 100.
- `cursor` is null for the first page. Later pages use the opaque `next_cursor` from the prior response with the same parent and status filters.

Output is intentionally compact:

```json
{
  "nodes": [
    {
      "id": 15,
      "name": "Narrower concept",
      "status": "unassessed",
      "parent_id": 12
    }
  ],
  "next_cursor": null
}
```

Results are ordered by ID for stable keyset pagination. Use `get_knowledge_node` with a returned ID before deciding whether to establish it.

## `search_knowledge`

```http
POST /api/agent/search_knowledge
```

Input:

```json
{
  "query": "search terms",
  "parent_id": null,
  "branch": "subjects",
  "limit": 5
}
```

- `query` is required, non-empty text of at most 200 characters.
- `parent_id` is optional. When present, only descendants of that explicit parent are searched; the parent itself is not a result.
- `branch` is optional. It is `subjects`, `ideologies`, or null. If both branch and parent are present, they must agree.
- `limit` defaults to 5 and must be between 1 and 25.
- Name matches rank ahead of known-node explanation and term matches.

Output contains only compact navigation results:

```json
{
  "results": [
    {
      "id": 12,
      "name": "Matching concept",
      "path": ["Subjects", "Parent concept", "Matching concept"],
      "status": "known"
    }
  ]
}
```

Search never changes server state or establishes a current node.

## `get_knowledge_node`

```http
POST /api/agent/get_knowledge_node
```

Input:

```json
{ "node_id": 12 }
```

Output is deliberately bounded to the node, its canonical path, its parent, and its immediate children:

```json
{
  "id": 12,
  "revision": 3,
  "name": "Concept",
  "status": "known",
  "understanding": "A direct explanation of the topic's essence.",
  "terms": [],
  "path": ["Subjects", "Parent concept", "Concept"],
  "parent": { "id": 4, "name": "Parent concept" },
  "children": [
    { "id": 15, "name": "Narrower concept", "status": "unassessed" }
  ]
}
```

`parent` is null for a node directly under a virtual primary branch. Grandchildren, connections, timestamps, and unrelated nodes are not returned. Immediate child summaries intentionally omit explanation and terms; inspect a child by its explicit ID to read its complete bounded content.

## `establish_known_node`

```http
POST /api/agent/establish_known_node
```

Input:

```json
{
  "node_id": 12,
  "expected_revision": 3,
  "understanding": "A direct explanation of the topic's essence in the user's words.",
  "terms": [],
  "children": ["First subdivision", "Second subdivision"]
}
```

The operation:

1. requires the node's current revision to equal `expected_revision`;
2. requires one non-empty direct explanation of at most 2,000 characters;
3. optionally sets local terms on the now-known node;
4. marks the node known and advances its revision once;
5. reuses case-insensitive matches among existing immediate children;
6. creates missing immediate children as name-only unassessed leaves with no explanation or terms;
7. never deletes or replaces an existing child;
8. permits `children: []` for a known leaf;
9. applies every change in one transaction.

Output:

```json
{
  "node": {
    "id": 12,
    "revision": 4,
    "status": "known",
    "understanding": "A direct explanation of the topic's essence in the user's words.",
    "terms": []
  },
  "children_created": ["First subdivision"],
  "children_existing": ["Second subdivision"],
  "children_conflicting": []
}
```

Repeated requested names after case-insensitive normalization are reported in `children_conflicting`; they do not create duplicate children.

## `update_known_node`

```http
POST /api/agent/update_known_node
```

Input:

```json
{
  "node_id": 12,
  "expected_revision": 4,
  "understanding": "An improved direct explanation.",
  "terms": [],
  "children_to_add": ["Another subdivision"]
}
```

This operation accepts only an already known node. It updates the single explanation and optional terms, advances the revision once, and adds or reuses name-only immediate children using the same atomic rules as establishment. It cannot delete, rename, move, merge, recategorize, otherwise restructure a node, or attach content to a child. An empty `children_to_add` array updates known-node content without decomposing it.

The output has the same shape as `establish_known_node`.

## Concurrency and frontier failures

A stale `expected_revision` returns HTTP `409` with code `stale_revision` and both the expected and current revisions in `error.details`. No explanation, term, or child change is committed.

Calling `update_known_node` on an unknown or unassessed node returns HTTP `409` with code `node_not_known`. The caller must explicitly use `establish_known_node` if the user has established an understanding.

All other node-creation paths still require a known parent. A node with children cannot become unknown or unassessed. Therefore an unknown or unassessed node cannot have children, and a known descendant cannot appear beneath a non-known ancestor.

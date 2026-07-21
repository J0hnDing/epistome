# Local JSON API

All API responses use JSON except successful deletes, which return no body. Errors have this shape:

```json
{
  "error": {
    "code": "understanding_required",
    "message": "A known node must include a direct explanation of the topic's essence."
  }
}
```

The browser-oriented endpoints below return broader UI payloads. AI integrations should use the bounded contracts in [Agent API](agent-api.md), inspect the project policy at `GET /api/agent/guide`, and treat `GET /api/openapi.json` as the authoritative OpenAPI 3.1 specification.

## Health and reads

### `GET /api/health`

Returns `{ "status": "ok" }` when the process can serve requests.

### `GET /api/tree`

Returns the two virtual primary branches and their recursively nested nodes:

```json
{
  "branches": [
    { "id": "subjects", "name": "Subjects", "virtual": true, "children": [] },
    { "id": "ideologies", "name": "Ideologies", "virtual": true, "children": [] }
  ]
}
```

### `GET /api/nodes`

Returns a flat, name-sorted list of every stored node. The browser uses it for counts and placement controls. Each node includes its current positive integer `revision`, known-only `understanding`, and node-local `terms`.

### `GET /api/nodes/:id`

Returns one node with `childCount` and its connected nodes.

## Versioned export and import

These are browser-oriented whole-database operations. They are not currently exposed in the agent tool catalog.

### `GET /api/export`

Returns a complete portable JSON snapshot:

```json
{
  "format": "epistome",
  "format_version": 3,
  "exported_at": "2026-07-17T20:00:00.000Z",
  "data": {
    "nodes": [],
    "connections": [],
    "metadata": []
  }
}
```

Nodes retain `id`, `name`, `branch`, `parentId`, `status`, `understanding`, `terms`, `revision`, `createdAt`, and `updatedAt`. Connections retain `id`, `sourceId`, `targetId`, and `createdAt`. Application metadata is represented as `key` and `value` entries. The two virtual roots are structural constants and are not exported as nodes.

### `POST /api/import`

Accepts one complete export document, up to 50 MB, and replaces all current nodes, connections, and application metadata. The response summarizes the applied version and counts:

```json
{
  "imported": {
    "format_version": 3,
    "nodes_imported": 50,
    "connections_imported": 3
  }
}
```

Import preserves exported identities and timestamps. The server rejects unknown formats, unsupported versions, malformed records, invalid hierarchies, and invalid connections before mutation. Replacement is atomic: a rejected or failed import does not partially clear or populate the current database.

Epistome emits and accepts version 3 with `format: "epistome"`. Older versions are intentionally unsupported.

## Clear knowledge

This is a browser-oriented destructive operation and is not exposed in the agent tool catalog.

### `POST /api/clear`

Atomically removes every non-base concept and all cross-connections. Approved initial taxonomy entries remain at their existing IDs when they are still in their original top-level location, are reset to content-free `unassessed` leaves, and any missing or reorganized base entries are recreated. Application metadata is preserved.

The response reports the applied changes:

```json
{
  "cleared": {
    "nodes_deleted": 12,
    "connections_deleted": 3,
    "base_nodes_preserved": 48,
    "base_nodes_reset": 7,
    "base_nodes_created": 2
  }
}
```

## Node writes

### `POST /api/nodes`

Creates a node. Example body:

```json
{
  "name": "Concept name",
  "branch": "subjects",
  "parentId": null,
  "status": "known",
  "understanding": "A direct explanation of the topic's essence in the user's own words.",
  "terms": [
    {
      "id": "weights",
      "label": "weights",
      "definition": "Learned numeric parameters controlling how inputs affect an output."
    }
  ]
}
```

`branch` is `subjects` or `ideologies`. `status` is `unassessed`, `unknown`, or `known`. `parentId` is null for direct placement under a primary branch. A known status requires one direct explanation in `understanding`; other statuses store it as null and must have empty `terms`.

`terms` contains at most 20 node-local `{ id, label, definition }` records on a known node. Term IDs use lowercase letters, digits, and hyphens, are unique within the node, and must begin with a letter. Empty arrays are valid. The removed `description` field is rejected.

### `PATCH /api/nodes/:id`

Updates any supplied node fields. Omitted fields retain their existing values. Moving beneath a parent derives the node's branch from that parent. Moving a root-level subtree between primary branches requires `parentId: null` and the new `branch`.

### `DELETE /api/nodes/:id`

Deletes a leaf node and its connections. Returns `409 node_has_children` if children remain.

## Connection writes

### `POST /api/connections`

Creates an undirected connection:

```json
{
  "sourceId": 1,
  "targetId": 2
}
```

Self-connections and duplicate pairs are rejected.

### `DELETE /api/connections/:id`

Deletes one connection without changing either node.

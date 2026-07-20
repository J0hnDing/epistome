# Todo

This file tracks approved capabilities that remain unfinished. New work should preserve the REST domain contract, tree invariants, explicit-node navigation, optimistic revisions, and the rule that the knowledge base represents the user's understanding rather than an external ontology.

## 1. Tree-reorganization APIs

Status: not implemented for agents. The human-facing node API can currently rename and move nodes, but agents are intentionally prohibited from restructuring the tree and have no dedicated reorganization contract.

Add explicit, revision-safe APIs for approved structural operations such as renaming a node, moving a subtree, and resolving duplicate or overlapping concepts. The contract should:

- preview the affected canonical paths and invariant consequences before applying a change;
- require current revisions for every node whose bounded view or placement may change;
- preserve the Subjects/Ideologies classification policy and known-ancestor frontier rules;
- distinguish rename, move, merge, and split operations instead of hiding them inside a general patch;
- make destructive or identity-changing consequences explicit;
- apply each accepted reorganization atomically;
- remain fully represented in the OpenAPI specification and agent guide.

## 2. Auditability and bounded revert

Status: not implemented. Node revisions provide concurrency control but do not record who made a change, which API call caused it, or what the prior tree state was.

Record every agent call and every resulting tree mutation in an append-only audit history. Each record should identify the operation, actor or integration, request/correlation ID, timestamp, target node IDs, outcome, and sufficient before/after state to explain the change.

Investigate a bounded revert capability that can safely reverse a configurable number of recent mutation steps. Revert behavior must:

- preserve the audit record rather than deleting history;
- detect later dependent changes and refuse or require explicit resolution when a clean inverse is unsafe;
- restore node identity, placement, status, understanding, and immediate-child effects consistently;
- treat a multi-node atomic mutation as one revertable step;
- define retention, privacy, and storage-growth policies before implementation.

## 3. API error contract

Status: partially implemented. The server has a stable `{ "error": { "code", "message", "details" } }` envelope and OpenAPI error schemas, but it does not yet publish a complete error-code contract.

Create one authoritative registry for every public REST and agent error code. For each code, define:

- HTTP status and applicable operations;
- stable machine meaning;
- whether retrying unchanged is safe, unsafe, or pointless;
- the expected agent remediation, such as rereading after `stale_revision`;
- the shape and required fields of `details`;
- whether the error is safe to expose without leaking local data.

Generate or validate OpenAPI error responses and human documentation from that registry so runtime behavior, tests, and documentation cannot drift. Add conformance tests for status, code, details, and retry guidance.

## 4. MCP adapter

Status: not implemented.

Add an MCP adapter only as a thin compatibility layer over the existing REST contract. It must not become a second source of truth for validation, schemas, descriptions, revisions, errors, or tree behavior.

The adapter should:

- map MCP tools directly to the existing agent REST operations;
- derive tool names, descriptions, and input schemas from the same contract metadata where practical;
- return REST-equivalent response and error semantics;
- contain no independent knowledge-domain or persistence logic;
- be covered by parity tests showing that equivalent MCP and REST calls produce equivalent results;
- preserve explicit node IDs and never introduce session-level `current_node` state.

## 5. Agent export and import APIs

Status: not implemented for agents. Complete versioned export and atomic whole-database import are currently available only through the browser-oriented REST endpoints and UI.

Define a dedicated agent contract before adding these operations to `src/agent-tools.js` or the agent OpenAPI surface. The contract should:

- distinguish read-only export from destructive whole-database import;
- require explicit user authorization immediately before an agent import;
- preserve the existing versioned file format rather than creating an agent-specific snapshot format;
- define how a complete export is transferred without violating the normal bounded-read policy;
- validate the whole file before mutation and retain atomic replacement semantics;
- report imported counts and stable format/version errors;
- integrate with the planned audit history so the initiating agent call and replacement outcome are recorded;
- remain stateless and avoid server-side file paths or agent-controlled arbitrary filesystem writes.

## 6. Term evolution beyond node-local definitions

Status: intentionally deferred. Inline terms are currently lightweight definitions owned by one node and referenced only from that node's structured description.

Consider global term registries, aliases, and promotion of a local term into a knowledge node only after concrete usage demonstrates the need. Any future design must:

- preserve existing node-local term IDs and references during migration;
- avoid turning concise contextual vocabulary into a parallel knowledge graph;
- define how aliases affect display and lookup without introducing plain-text auto-linking;
- make term-to-node promotion explicit and preserve the distinction between a definition and independently explorable knowledge;
- prevent a promoted concept from silently existing as both a child and a redundant local term;
- remain fully validated by the domain layer and represented in transfer and agent contracts.

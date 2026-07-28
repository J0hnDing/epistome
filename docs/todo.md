## TODO-001: Tree-reorganization APIs

- Status: planned
- Priority: medium
- Category: feature
- Area: agent-domain
- Dependencies: TODO-003, TODO-012
- Rationale: Human-facing APIs can rename and move nodes, but agents are intentionally prohibited from restructuring. Any future agent reorganization surface needs explicit operation semantics, complete invariant previews, and revision-safe atomic changes rather than a generic patch endpoint.

-Acceptance Criteria:
Define separate previewable contracts for rename, move, merge, and split; require current revisions for every affected bounded view or placement; preserve branch, frontier, canonical-parent, and known-ancestor invariants; make destructive or identity-changing consequences explicit; apply each accepted operation atomically; publish aligned tool, OpenAPI, guide, error, and test coverage.

## TODO-002: Auditability and bounded revert

- Status: planned
- Priority: medium
- Category: feature
- Area: audit-persistence
- Dependencies: TODO-006
- Rationale: Revisions provide concurrency control but do not explain who changed the tree, which operation caused a mutation, or what prior state was replaced. Destructive and multi-node agent capabilities should not expand without a durable audit foundation.

-Acceptance Criteria:
Record every agent call and tree mutation in append-only history with operation, actor or integration, correlation ID, timestamp, targets, outcome, and sufficient before/after state; treat one atomic multi-node mutation as one audit step; define retention, privacy, and storage-growth policies; design bounded revert to preserve audit history, detect dependent later changes, and refuse unsafe inversions.

## TODO-003: API error contract

- Status: planned
- Priority: medium
- Category: refactor
- Area: api-contract
- Dependencies: none
- Rationale: The server has a stable error envelope and OpenAPI error schema, but public error codes, details, retry meaning, and remediation remain distributed across implementation, tests, and prose.

-Acceptance Criteria:
Create one authoritative registry for every public REST and agent error code, including HTTP status, applicable operations, machine meaning, retry policy, caller remediation, required details, and exposure safety; generate or validate OpenAPI and human documentation from it; add conformance tests for status, code, details, and retry guidance.

## TODO-004: MCP adapter

- Status: planned
- Priority: low
- Category: feature
- Area: integrations
- Dependencies: TODO-003, TODO-012
- Rationale: MCP support is useful only as a compatibility layer over the mature REST agent contract. Implementing it before contract metadata and errors are single-sourced would create a second schema and behavior authority.

-Acceptance Criteria:
Map MCP tools directly to existing agent REST operations; derive names, descriptions, input schemas, and error semantics from the shared contract; contain no independent domain, validation, persistence, revision, or navigation state; preserve explicit node IDs; prove REST/MCP parity for equivalent successful calls and failures.

## TODO-005: Agent export and import APIs

- Status: planned
- Priority: medium
- Category: feature
- Area: agent-api
- Dependencies: TODO-002, TODO-003, TODO-012
- Rationale: Complete export and atomic replacement already exist for the browser, but exposing them to agents crosses the normal bounded-read policy and introduces a destructive whole-database operation requiring explicit authorization and auditability.

-Acceptance Criteria:
Define separate read-only export and destructive import operations; require explicit user authorization immediately before import; preserve the existing versioned snapshot and complete pre-mutation validation; retain atomic replacement; avoid agent-controlled server file paths; publish stable count, format, version, and error results; integrate the initiating request and outcome with audit history; keep the workflow stateless.

## TODO-006: Introduce versioned database migrations

- Status: planned
- Priority: medium
- Category: refactor
- Area: persistence
- Dependencies: none
- Rationale: Database evolution currently relies on one-off column inspection. As schema changes accumulate, ordering, rollback, and compatibility become harder to reason about and test.

-Acceptance Criteria:
Store an explicit schema version; apply each migration exactly once in a transaction; preserve supported existing databases; fail safely without partial schema changes; cover fresh, current, and representative legacy databases with tests.

## TODO-007: Preserve UTF-8 across chunked JSON requests

- Status: planned
- Priority: high
- Category: bugfix
- Area: http-boundary
- Dependencies: none
- Rationale: The request reader currently coerces each byte chunk to text independently. A multibyte character split across chunks is silently replaced, corrupting names, understandings, and imported snapshots.

-Acceptance Criteria:
Accumulate bounded request bytes and decode UTF-8 once; reject oversized Content-Length values early while retaining streamed size enforcement; preserve valid multibyte text across arbitrary chunk boundaries; add HTTP tests that deliberately split a character between chunks.

## TODO-008: Unify Unicode sibling-name uniqueness

- Status: planned
- Priority: high
- Category: bugfix
- Area: domain-persistence
- Dependencies: TODO-006
- Rationale: SQLite lower(name) and JavaScript locale lowercasing disagree outside ASCII. The database can accept sibling names that the export validator treats as duplicates, making an Epistome export impossible to re-import.

-Acceptance Criteria:
Define one documented normalization and case-folding function; persist and uniquely index its canonical sibling key; use the same function for writes, agent child reuse, and import validation; migrate existing data with an explicit collision policy; cover non-ASCII and normalization-equivalent names plus export/re-import round trips.

## TODO-009: Harden browser node command validation and no-op revisions

- Status: planned
- Priority: medium
- Category: bugfix
- Area: domain-api
- Dependencies: none
- Rationale: Human-facing node writes accept malformed or unsupported command shapes inconsistently. PATCH null becomes a 500 and an empty or semantically unchanged patch advances the revision despite no conceptual change.

-Acceptance Criteria:
Require plain-object command bodies; reject unsupported fields with stable 400 errors; preserve omitted-field PATCH semantics; avoid writes, timestamps, and revision increments when normalized state is unchanged; add domain and HTTP tests for null, arrays, unknown fields, empty patches, equivalent normalized values, and actual changes.

## TODO-010: Make deep-tree validation and assembly iterative

- Status: planned
- Priority: low
- Category: refactor
- Area: knowledge-transfer
- Dependencies: none
- Rationale: Recursive import validation and tree assembly depend on the JavaScript call stack. A structurally valid deep snapshot within the import size limit can raise RangeError instead of receiving deterministic validation or import behavior.

-Acceptance Criteria:
Replace depth-dependent recursive traversal in import ordering and server-side tree assembly with iterative algorithms; preserve cycle detection and canonical order; define a practical supported-depth policy if any limit remains; add deep valid-chain and deep-cycle tests that do not overflow the process stack.

## TODO-011: Extract a cohesive knowledge-transfer collaborator

- Status: planned
- Priority: medium
- Category: refactor
- Area: architecture
- Dependencies: none
- Rationale: KnowledgeBase currently combines tree mutations, agent queries, export validation, and snapshot replacement in one large implementation. Transfer rules form a cohesive boundary that can be isolated without weakening domain ownership.

-Acceptance Criteria:
Keep KnowledgeBase as the authoritative domain facade; extract pure snapshot parsing, validation, and ordering behind a narrow internal interface; keep transactional replacement owned by the domain layer; preserve all import/export behavior; add focused transfer tests without duplicating invariants.

## TODO-012: Single-source agent operation contract metadata

- Status: planned
- Priority: medium
- Category: refactor
- Area: agent-api
- Dependencies: TODO-003
- Rationale: Agent tool schemas, OpenAPI schemas, route paths, and descriptions are maintained separately. Existing tests check selected alignment but do not prevent all semantic drift.

-Acceptance Criteria:
Define one operation registry for names, methods, paths, input schemas, and shared descriptions; generate or validate the tool catalog and OpenAPI surface from it; keep handlers explicit and domain-free; include the authoritative error registry from TODO-003; add full parity tests for every published operation.

## TODO-013: Consolidate browser knowledge snapshot reads

- Status: planned
- Priority: low
- Category: refactor
- Area: browser
- Dependencies: none
- Rationale: Each browser refresh downloads both the complete nested tree and a complete flat node list. The duplicated full reads add database work, transfer cost, and a potential consistency seam as the knowledge base grows.

-Acceptance Criteria:
Provide or derive one coherent browser read model per refresh; retain tree rendering, summary counts, paths, and parent-choice behavior; ensure one refresh cannot combine different logical snapshots; add focused client or HTTP contract tests for the consolidated payload.

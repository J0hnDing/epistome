# Working history

## 2026-07-21 — Clear knowledge while preserving the base taxonomy

- Added an atomic browser-only clear operation that removes all non-base concepts and cross-connections while restoring the approved Subject and Ideology taxonomy as content-free unassessed leaves.
- Preserved IDs for base entries that remain in their original top-level locations, recreated missing or reorganized entries, and retained application metadata.
- Added a confirmed Clear knowledge control, domain and HTTP coverage, and documentation of the destructive reset boundary.

## 2026-07-21 — Explicit ownership rules for agent-defined terms

- Clarified across the machine-readable guide, tool catalog, OpenAPI specification, and agent docs that terms must be central to the current known node's own explanation.
- Prohibited agents from defining existing or proposed children, or vocabulary owned by narrower descendants, as parent terms; child-owned vocabulary is defined only after that child is explicitly established as known.
- Clarified that terms are not a second child list, topic outline, or exhaustive glossary, and protected the guidance with discovery-contract tests.

## 2026-07-21 — One explanation, known-only content

- Removed the separate structured `description` field from persistence, the domain model, browser payloads, exports, and the agent contract.
- Kept `understanding` as the single direct explanation of a known topic's essence and clarified that agents must not write “I understand” metacommentary.
- Restricted terms to known nodes; unknown and unassessed nodes now always have a null explanation and empty terms, and their UI omits both content sections.
- Restricted agent-created children to name strings so every new child is an unassessed leaf with no explanation or terms.
- Added a database rebuild migration that discards legacy descriptions, preserves known-node explanations and terms, and clears terms on non-known nodes.
- Advanced the breaking export format to version 3 and intentionally stopped accepting older import versions.

## 2026-07-21 — Unified explanation and path terms

- Replaced the separate Explanation and Current understanding sections with one authoritative Explanation block: known nodes use their required essence statement, while other nodes use structured context when available.
- Renamed the known-node form field to Explanation and clarified that it should directly state the topic's essence.
- Made the Terms section visible for every selected node, including a clear empty state when no definitions exist on the canonical path.
- Included terms defined by canonical ancestors in the glossary while preserving each term's owning node and the same-node structured-reference contract.

## 2026-07-20 — Collapsible tree and visible term glossary

- Made primary branches and parent nodes independently collapsible with accessible disclosure controls, hidden-child counts, and expand-all/collapse-all actions.
- Collapsed parent nodes by default while automatically revealing the ancestor path of any selected concept.
- Added a persistent, text-safe defined-terms section to node details while retaining inline definition popovers for reading terms in context.
- Kept the desktop tree panel available while scrolling; bounded the mobile tree, allowed long concept names to wrap, and tightened the mobile layout for term definitions.

## 2026-07-20 — Structured node descriptions and inline terms

- Added optional explanatory descriptions at every node status while preserving the known-only meaning of the user's understanding statement.
- Added bounded node-local terms with stable local IDs, labels, concise definitions, and explicit structured references from description parts.
- Enforced same-node reference resolution, unique IDs, referenced-only term definitions, strict part shapes, safe text storage, and no-HTML rendering contracts in the domain layer.
- Extended agent mutations so current nodes and newly created unassessed children can atomically receive useful descriptions and essential referenced terms; legacy name-only child inputs remain valid.
- Added database migration defaults for existing nodes and export format version 2 with backward-compatible version 1 import.
- Rendered referenced terms as keyboard-focusable buttons with a compact definition popover, Escape-to-close behavior, focus restoration, and DOM text-only insertion.
- Added focused persistence, validation, generated-child, migration, transfer, renderer, API-discovery, and UI-safety tests.

## 2026-07-17 — Epistome project rename

- Renamed the product, browser title, package, server output, agent discovery guide, and OpenAPI identity to Epistome.
- Renamed exported backup files and the canonical versioned export identifier to `epistome`.
- Preserved import compatibility with version 1 backups that use the earlier project identifier.
- Kept knowledge-domain terminology and stable REST paths unchanged.

## 2026-07-17 — Versioned full export and import

- Added a portable JSON export format with an explicit format identifier and version.
- Included all persisted nodes, connections, IDs, revisions, timestamps, and application metadata while leaving the two virtual roots implicit.
- Added complete import validation for record shapes, identities, hierarchy invariants, cycles, sibling uniqueness, connections, and metadata before mutation.
- Made import a single atomic replacement so incompatible or invalid files leave the current knowledge base unchanged.
- Added browser Export and Import controls with a native save-location picker where available, standard download fallback, file-size guard, and destructive replacement confirmation.
- Documented the browser REST contract and deferred a separately authorized agent import/export contract to the todo list.

## 2026-07-17 — Initial broad knowledge taxonomy

- Added 33 common, objective Subject starting points spanning formal, natural, technical, human, historical, linguistic, creative, and applied knowledge.
- Added 17 broad Ideology starting points including Politics, Ethics, Metaphysics, Epistemology, mind, meaning, religion, society, law, science, technology, and worldview.
- Treated Ideologies itself as philosophy in the broad sense: no Philosophy container or redundant “Philosophy of …” seed names are present.
- Seeded every node as a top-level unassessed leaf with no understanding statement, preserving the rule that the system does not claim user knowledge.
- Made seeding one-time and idempotent through database metadata; existing matching nodes are preserved and deleted seed nodes do not reappear.
- Updated the initial UI state, product model, architecture, agent guidance, contributor rules, and tests for the new starting taxonomy.

## 2026-07-17 — Subject frontier listing API

- Added stateless `list_frontier_nodes` discovery for unknown or unassessed Subject nodes whose immediate canonical parent is known.
- Restricted the operation structurally to Subjects; Ideology nodes and virtual-root placeholders cannot appear.
- Added exact-parent and status filters, compact node summaries, limits up to 100, and opaque filter-bound cursor pagination.
- Added tool-catalog, project-guide, OpenAPI, agent-guide, and contributor-policy descriptions that state the frontier definition and Subjects-only boundary.
- Added domain, discovery-contract, and mock-agent HTTP tests for eligibility, exclusion, filtering, pagination, and Ideology-parent rejection.

## 2026-07-17 — Agent discovery and API specification

- Added an authoritative OpenAPI 3.1 document at `GET /api/openapi.json` covering discovery resources and the then-current agent operations, including request, response, and error schemas.
- Added a machine-readable project and workflow guide at `GET /api/agent/guide` covering the project's purpose, roots, statuses, understanding policy, stateless workflow, and mutation limits.
- Expanded the tool catalog to point agents to both resources and strengthened every operation description.
- Defined the child expansion boundary explicitly: immediate major conceptual subdivisions only, created as unassessed leaves; no grandchildren, exhaustive external taxonomies, facts, examples, sources, or implementation details; empty child lists remain valid.
- Added discovery contract tests that protect the OpenAPI paths, schema references, descriptions, guide content, and expansion-boundary wording.

## 2026-07-17 — Stateless AI agent API

- Added explicit-ID `search_knowledge`, `get_knowledge_node`, `establish_known_node`, and `update_known_node` HTTP operations plus a machine-readable tool catalog.
- Added compact search responses, bounded node reads, canonical paths, subtree search scoping, and no server-side navigation state.
- Added per-node optimistic revisions with automatic migration of earlier databases.
- Made agent establishment and updates atomic: stale writes create no children or partial changes.
- Ensured human child creation and deletion also advance the parent's revision so agent concurrency checks cover structural changes outside the agent endpoints.
- Added domain contract tests and a mock agent end-to-end program that searches, inspects, establishes, expands, updates, and tests stale-write and frontier failures over HTTP without invoking an external agent runtime.

## 2026-07-17 — Initial base system

- Established a dependency-free Node.js application with a local HTTP server and SQLite persistence.
- Implemented virtual Subjects and Ideologies roots so a fresh database contains no knowledge.
- Added node creation, inspection, editing, movement, and conservative leaf deletion.
- Enforced known explanations, frontier leaves, known ancestor paths, canonical parentage, branch consistency, sibling uniqueness, and cycle prevention in the domain layer and database where applicable.
- Added simple undirected cross-connections that remain independent of the hierarchy.
- Built a responsive browser interface with an empty state, tree navigation, status summary, node forms, connections, and structural metadata.
- Added domain and HTTP contract tests plus syntax and full-check scripts.
- Documented the product model, architecture, API, contributor rules, operating steps, and current scope.

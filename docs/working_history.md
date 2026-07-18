# Working history

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

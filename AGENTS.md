# AGENTS.md

## Scope

These instructions apply to the entire repository.

## Product contract

This project models one person's conceptual understanding as a tree. Preserve these invariants in every code path:

1. `Subjects` and `Ideologies` are the only primary branches.
2. They are virtual structural roots, not persisted knowledge nodes.
3. Every persisted node has one canonical parent location and belongs to exactly one branch.
4. Parent-child relationships mean conceptual narrowing.
5. A known node requires one non-empty direct explanation in its `understanding` field.
6. Unknown and unassessed nodes cannot have children.
7. A known descendant cannot exist below an unknown or unassessed ancestor.
8. Cross-connections are undirected associations and never change canonical parentage.
9. A fresh production database receives the one-time broad taxonomy in `src/initial-taxonomy.js`. Every seeded node is top-level, unassessed, and has no explanation, terms, or children.
10. Do not add sources, confidence, mastery, history, automation, assessments, or agent behavior to the base model without an explicit product decision.
11. Agent operations are stateless: every navigation or mutation request identifies its node explicitly. Never introduce a process-wide or session-wide `current_node`.
12. Agent mutations use optimistic revisions and must apply the node update and child creation atomically.
13. `list_frontier_nodes` is Subjects-only. A frontier node is unknown or unassessed and has an immediate canonical parent that is known; virtual-root children do not satisfy this definition.
14. Known nodes may own concise terms used by their direct explanation. Unknown and unassessed nodes have no explanation or terms. Terms are not knowledge nodes, children, or graph vertices.

## Architecture

- `src/knowledge-base.js` owns domain validation and tree operations.
- `src/database.js` owns the SQLite schema and database setup.
- `src/server.js` is the HTTP and static-file boundary; keep business rules out of route handlers.
- `src/agent-tools.js` is the machine-readable catalog for the stateless agent HTTP endpoints.
- `public/` contains the dependency-free browser interface.
- `test/` covers domain invariants and the HTTP contract.
- `docs/` explains product, architecture, API, and completed work.

The browser-only versioned transfer endpoints are `GET /api/export` and `POST /api/import`. Import must validate the complete snapshot before atomically replacing nodes, connections, and application metadata. Do not expose these operations to agents until the dedicated agent contract in `docs/todo.md` is implemented.

Use Node built-ins before adding dependencies. The current system intentionally runs without a package-install step and requires Node 22.5 or newer for `node:sqlite`.

## Working rules

- Read `README.md` and relevant files in `docs/` before changing behavior.
- Keep changes small and testable. Put invariants in the domain layer, not only in the UI.
- Never commit the local `data/` directory or a SQLite database.
- Do not prepopulate known status, explanations, terms, child taxonomies, or demonstration content. Changes to the approved initial unassessed taxonomy require an explicit product decision.
- Treat stored node names, explanations, term labels, and term definitions as untrusted text in the browser.
- Keep agent search results compact and agent node reads bounded to the requested node, canonical path, parent, and immediate children.
- Never let agent update operations delete, rename, move, merge, or recategorize nodes.
- Keep `src/agent-guide.js`, `src/agent-tools.js`, `src/openapi.js`, `docs/agent-guide.md`, and `docs/agent-api.md` aligned whenever the agent contract changes.
- Preserve the expansion boundary in machine-readable descriptions: create only useful immediate conceptual subdivisions as name-only unassessed leaves, never attach explanations or terms to them, never infer grandchildren or exhaustive taxonomies, and allow an empty child list for a known leaf.
- Keep frontier results compact, cursor-paginated, and restricted to Subjects even when filtering by parent ID.
- Preserve unrelated worktree changes.
- Record notable completed behavior changes in `docs/working_history.md`.
- Record genuinely unfinished product work in `docs/todo.md`; do not list intentionally deferred extensions as defects.

## Completion checks

Run from the repository root:

```powershell
npm run check
```

This syntax-checks the server, domain layer, and browser JavaScript, then runs all tests. For UI changes, also start the app with `npm start` and inspect the affected flow in a browser.

## Projector

Projector is authoritative for structured TODO and working-history mutations. Do not directly edit `TODO.md` or `WORK_HISTORY.md`.

Use Projector's local API at `http://127.0.0.1:48721/v1`. Projector must be running; resolve the registered project ID with `GET /projects`.

- `POST /projects/{projectId}/todos`: `title`, `priority` (`critical|high|medium|low`), `category` (`feature|bugfix|refactor|test|documentation|research|others`), `area`, `dependencies` (TODO ID array), `rationale`, and `acceptanceCriteria`.
- `POST /projects/{projectId}/todos/{todoId}/complete`: `summary` and `limitations`.
- `POST /projects/{projectId}/work-history`: `title`, `category`, `area`, `summary`, and `limitations`.

Use `POST /projects/{projectId}/todos` to record unfinished actionable work. Use `POST /projects/{projectId}/todos/{todoId}/complete` when that TODO is finished; completion atomically removes the TODO and creates its working-history entry, so do not follow it with a `work-history` call. Use `POST /projects/{projectId}/work-history` only for notable completed work that was not represented by an open TODO.

Send JSON with camel-case field names. Use an empty array when a TODO has no dependencies and use `none` when there are no known limitations. TODO status is derived: a TODO with dependencies is blocked; otherwise it is planned.

# Epistome

Epistome is a local, personal map of conceptual understanding. It organizes knowledge as a readable tree, shows where understanding ends, and keeps optional cross-connections secondary to the main hierarchy.

A fresh installation starts with two structural containers and a curated set of broad, unassessed concepts:

```text
Knowledge
├── Subjects
│   ├── Mathematics — unassessed
│   ├── Physics — unassessed
│   └── …
└── Ideologies
    ├── Ethics — unassessed
    ├── Metaphysics — unassessed
    └── …
```

`Subjects` is for concepts that primarily describe reality, systems, mechanisms, events, or formal relationships. `Ideologies` is for normative, philosophical, interpretive, religious, political, and value-dependent frameworks.

The initial nodes are navigation and assessment starting points. None is marked known, and none has an understanding statement or children. The Ideologies root itself represents philosophy in the broad sense, so there is no separate Philosophy node.

## What the base system does

- Creates, edits, moves, and deletes conceptual nodes.
- Records each node as unassessed, unknown, or known.
- Requires a concise understanding statement for known nodes.
- Allows decomposition only beneath known nodes.
- Prevents cycles, duplicate siblings, cross-branch parent conflicts, and invalid knowledge frontiers.
- Adds simple undirected cross-connections without turning the tree into a graph.
- Exposes stateless, revision-safe APIs for AI agents to search, inspect, establish, and update knowledge by explicit node ID.
- Lets agents page through Subject frontier nodes—unknown or unassessed nodes whose immediate parent is known—without exposing Ideology frontiers.
- Exports the complete knowledge base as a versioned JSON file and atomically replaces it from a compatible import.
- Persists everything locally in SQLite.
- Presents the tree and node details in a responsive browser interface.

It is intentionally not a note archive, source manager, mastery score, assessment engine, or automatically generated ontology.

## Requirements

- Node.js 22.5 or newer. The project uses the built-in `node:sqlite` module.
- No package installation is required; there are no runtime or development dependencies.

## Run locally

From PowerShell in the repository root:

```powershell
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The database is created on first start at `data/knowledge.sqlite`.

For automatic restart while editing:

```powershell
npm run dev
```

Optional environment variables:

```powershell
$env:HOST = "127.0.0.1"
$env:PORT = "3000"
$env:DATABASE_PATH = "C:\path\to\knowledge.sqlite"
npm start
```

## Export and import

Use **Export** in the browser sidebar to save a complete, versioned JSON snapshot. Browsers with the native file-system picker let you select the filename and folder directly; other browsers use their standard download behavior.

Use **Import** to select a previously exported JSON file. Import is a whole-database replacement: it preserves the exported node and connection IDs, revisions, timestamps, hierarchy, understandings, and application metadata while removing anything not present in the file. The file is fully validated first and the replacement is atomic, so an invalid or incompatible import leaves the current knowledge base unchanged.

## Test and verify

```powershell
npm test
npm run check
```

`npm run check` performs JavaScript syntax checks and runs the complete domain and HTTP test suite.

## AI agent discovery

An AI agent should begin with these read-only endpoints:

1. `GET /api/agent/tools` — compact discovery catalog and links.
2. `GET /api/agent/guide` — project purpose, knowledge semantics, safe workflow, and expansion boundary.
3. `GET /api/openapi.json` — authoritative OpenAPI 3.1 request, response, and error specification.

The agent guide explains that expansion stops at immediate children. Agents should add only major conceptual subdivisions useful to the user's current model, create them as unassessed leaves, never infer grandchildren, and use an empty list for a known leaf.

## Project layout

```text
public/                 Browser interface
src/database.js         SQLite schema and setup
src/knowledge-base.js   Domain model and invariant enforcement
src/server.js           JSON API and static web server
test/                   Domain and HTTP tests
docs/                   Product and engineering documentation
data/                   Local runtime data (ignored by Git)
```

## Documentation

- [Core model](docs/core-model.md) explains the implemented product rules.
- [Initial taxonomy](docs/initial-taxonomy.md) lists the one-time broad unassessed starting nodes.
- [Architecture](docs/architecture.md) explains the system boundaries and persistence design.
- [API](docs/api.md) documents the local JSON interface.
- [Agent API](docs/agent-api.md) documents the compact, stateless AI-agent contract.
- [Agent guide](docs/agent-guide.md) explains how agents should interpret and safely evolve the knowledge model.
- [Working history](docs/working_history.md) records completed changes.
- [Todo](docs/todo.md) tracks unfinished base work.

The full product blueprint remains the governing intent. `AGENTS.md` translates it into repository-level implementation rules.

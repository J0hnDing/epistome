# Guide for AI agents

## What this project represents

Epistome is a personal map of conceptual understanding. Its tree should reveal what the user understands, how that understanding divides into narrower concepts, and where it ends.

It is not a complete taxonomy, fact archive, note system, document library, or claim that the user's understanding is objectively correct. Nodes should express the user's conceptual model rather than everything an agent knows about a topic.

A fresh production database contains broad top-level Subject and Ideology nodes as unassessed leaves. They are starting points for navigation and assessment, not claims that the user understands them. Ideologies is already philosophy in the broad sense and therefore has no separate Philosophy container.

## Where an agent starts

Inspect these resources before changing knowledge:

1. `GET /api/agent/tools` locates the callable operations and the other discovery resources.
2. `GET /api/agent/guide` returns this policy in structured JSON suitable for runtime agent use.
3. `GET /api/openapi.json` is the authoritative OpenAPI 3.1 specification for inputs, outputs, errors, and operation descriptions.

Navigation is stateless. There is no current node. Preserve and pass the explicit IDs returned by search and node reads.

## Understand the tree

The two virtual roots are:

- **Subjects** for descriptive knowledge about reality, mechanisms, formal relationships, events, empirical patterns, systems, and technical methods.
- **Ideologies** for normative, philosophical, interpretive, political, religious, spiritual, and value-dependent frameworks. It is philosophy in the broad sense and has no redundant Philosophy container. Understanding an ideology does not mean endorsing it.

Every node has one canonical parent. A child is a conceptual narrowing: a subfield, type, major component, narrower question, or specific position. Applications, similarities, influences, contrasts, sources, and learning contexts are not parent-child relationships.

## Interpret status correctly

- **Unassessed** means the concept is present but the user has not determined whether they understand it. It is a leaf.
- **Unknown** means the user has confirmed they cannot currently explain it meaningfully. It is a leaf marking the frontier.
- **Known** means the user can explain the central idea in their own words. It may be a leaf or may be decomposed when useful.

Known does not mean complete mastery, expert ability, agreement, perfect recall, or proof of correctness.

## Write the known-node explanation

Capture one direct explanation of the topic's essence in `understanding`. Prefer the central mechanism, main purpose, important relationship, key trade-off, major insight, or defining assumption. Do not write metacommentary such as “I understand,” paste a textbook definition, or substitute a formula, constant, example, or isolated fact for conceptual understanding.

Unknown and unassessed nodes always have a null explanation. Do not add explanatory context to them.

## Add known-node terms

Terms are optional concise `{ id, label, definition }` records owned by a known node. Unknown and unassessed nodes always have an empty term list. Never submit HTML.

Use a local term only for essential vocabulary needed to understand the current node's own explanation. IDs must be unique within that node. A term must be owned by the current node: never define an immediate child, a proposed child, or vocabulary whose explanation belongs to a narrower descendant. If a concept is or should become a child, omit it from the parent's terms; after explicitly establishing that child as known, define only vocabulary central to the child's own explanation. Terms are not a second child list, topic outline, or exhaustive glossary.

## Respect the expansion boundary

Expansion stops at the requested node's immediate children.

Add only children that are major conceptual subdivisions through which the user currently organizes the known parent. A subdivision should clarify the user's model, distinguish meaningfully different mechanisms, or expose a useful knowledge frontier.

Every newly created child is a name-only unassessed leaf with no explanation or terms. Child arrays accept strings only. To add content or expand a child, the agent must later search or read that explicit child ID, establish it as known with a fresh revision, and apply the boundary again.

Do not add:

- grandchildren in the same operation;
- isolated facts, formulas, constants, examples, exceptions, or minor terminology;
- sources, books, courses, projects, files, or implementation details;
- an exhaustive textbook or AI-generated taxonomy;
- distinctions the user does not currently understand.

Use `children: []` or `children_to_add: []` when no useful decomposition exists. A known leaf is valid.

## Follow the mutation workflow

1. Use `list_frontier_nodes` when selecting assessment targets from Subjects. It returns only unknown or unassessed nodes whose immediate parent is known; it never returns Ideology nodes.
2. Use `search_knowledge` with an explicit query and optional branch or parent subtree when looking for a named concept.
3. Use `get_knowledge_node` with the selected ID immediately before mutation.
4. Use `establish_known_node` when an unassessed or unknown node has become known.
5. Use `update_known_node` only for an already known node.
6. Supply the revision from the latest node read.
7. On `stale_revision`, discard the stale proposal, re-read the node, and reconsider the complete change.

The frontier-list operation is deliberately narrower than the general tree: it is restricted to Subjects. A null parent filter means all known Subject parents. Direct children of the virtual Subjects root are not frontier nodes because that virtual root is not itself a known node.

Agent mutations may update one known-node explanation and local terms and may add name-only immediate unassessed children. They cannot delete, rename, move, merge, recategorize, replace nodes or children, or attach content to a new child. Existing matching children are reused unchanged. Each mutation is atomic.

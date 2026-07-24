# Core model

## Purpose

The system represents a person's current conceptual model of knowledge. It stores areas the person can explain, confirmed gaps in understanding, and concepts that have not yet been assessed. It does not claim that the model is complete or objectively correct.

The unit of data is a coherent concept, not a document, source, isolated fact, course, project, or file.

## Structural roots

The tree has exactly two virtual primary branches:

- **Subjects** contains descriptive or objective concepts: observable reality, mechanisms, formal relationships, history, empirical patterns, systems, and technical methods.
- **Ideologies** contains normative or interpretive concepts: values, philosophical positions, political ideals, religious beliefs, meaning, and principles about how life or society should operate.

These roots are application structure and are not rows in the node table. A new production database receives broad top-level nodes beneath them, all marked unassessed. This provides useful assessment starting points without asserting that the user knows any concept.

Ideologies is philosophy in the broad sense. There is no additional Philosophy container beneath it; areas such as Ethics, Metaphysics, Epistemology, and Politics are direct top-level nodes.

## Node fields

Every stored node has:

- a concise name;
- one primary branch;
- either one canonical parent node or a direct position under its primary branch;
- one status: `unassessed`, `unknown`, or `known`;
- one direct explanation in the `understanding` field when and only when it is known;
- zero or more concise terms owned by the node when and only when it is known;
- zero or more cross-connections.

Timestamps and numeric identifiers exist for persistence and API operation. They are not part of the conceptual product model.

The explanation records the user's conceptual model directly. It should state the topic's essence rather than metacommentary such as “I understand.” Unknown and unassessed nodes always have a null explanation and no terms.

Each known-node term has a stable identifier within its node, a display label, and a concise definition. Identifiers are unique within that node. A concept needing independent exploration, children, or substantial explanation belongs in the knowledge tree instead of being reduced to a local term.

## Frontier semantics

- **Unassessed** means the concept exists in the map but has not been evaluated. It is a leaf.
- **Unknown** means the user has confirmed they cannot meaningfully explain the concept. It is a leaf and marks the current knowledge frontier.
- **Known** means the user can explain the central idea in their own words. It may be a leaf or may be decomposed into narrower concepts.

Only a known node may receive a child. A node with children cannot be changed to unknown or unassessed. Together these rules guarantee that every path to a known concept passes only through known ancestors.

## Canonical placement

A parent-child edge represents conceptual narrowing: a subfield, type, component, narrower question, or specific position. Relationships such as “used by,” “influences,” “applied to,” “similar to,” or “conflicts with” should be cross-connections instead.

Moving a root-level subtree between Subjects and Ideologies changes the branch of every descendant atomically. Moving a node beneath a parent derives its branch from that parent. Cycles and duplicate sibling names are rejected.

## Connections

Connections are simple undirected associations between two different nodes. Only one connection may exist for a pair, regardless of direction. Deleting a node deletes its connections but never deletes other nodes.

No relationship type is stored in the base system. Typed edges are an optional future extension and should not be added until they solve a demonstrated need.

## Deletion

Deletion is intentionally conservative. A node with children cannot be deleted until its children are moved or deleted. This prevents an ordinary delete action from silently removing a complete area of the user's conceptual map.

The separate browser-only clear operation is explicitly destructive. It atomically removes every non-base node and cross-connection, restores the approved initial taxonomy as top-level unassessed leaves with no explanations or terms, and preserves application metadata. This bulk reset is not an agent operation.

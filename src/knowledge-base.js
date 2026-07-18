import { badRequest, conflict, notFound } from "./errors.js";

export const BRANCHES = Object.freeze([
  { id: "subjects", name: "Subjects", description: "Objective and descriptive knowledge." },
  { id: "ideologies", name: "Ideologies", description: "Normative, interpretive, and value-dependent knowledge." }
]);

export const STATUSES = Object.freeze(["unassessed", "unknown", "known"]);
export const KNOWLEDGE_EXPORT_FORMAT = "epistome";
export const KNOWLEDGE_EXPORT_VERSION = 1;
const LEGACY_KNOWLEDGE_EXPORT_FORMATS = Object.freeze(["the-modeled-knowledge-base"]);
const FRONTIER_STATUSES = Object.freeze(["unknown", "unassessed"]);

function now() {
  return new Date().toISOString();
}

function requireInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw badRequest("invalid_field", `${field} must be a positive integer.`, { field });
  }
  return value;
}

function normalizeName(value) {
  if (typeof value !== "string") {
    throw badRequest("invalid_name", "Name must be text.");
  }
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 120) {
    throw badRequest("invalid_name", "Name must contain between 1 and 120 characters.");
  }
  return name;
}

function normalizeBranch(value) {
  if (!BRANCHES.some((branch) => branch.id === value)) {
    throw badRequest("invalid_branch", "Branch must be subjects or ideologies.");
  }
  return value;
}

function normalizeStatusAndUnderstanding(status, understanding) {
  if (!STATUSES.includes(status)) {
    throw badRequest("invalid_status", "Status must be unassessed, unknown, or known.");
  }

  if (status !== "known") {
    return { status, understanding: null };
  }

  if (typeof understanding !== "string" || !understanding.trim()) {
    throw badRequest(
      "understanding_required",
      "A known node must include a meaningful understanding statement."
    );
  }

  const normalized = understanding.trim();
  if (normalized.length > 2000) {
    throw badRequest("understanding_too_long", "Understanding must be 2,000 characters or fewer.");
  }
  return { status, understanding: normalized };
}

function normalizeUnderstanding(understanding) {
  return normalizeStatusAndUnderstanding("known", understanding).understanding;
}

function normalizeQuery(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw badRequest("invalid_query", "Query must be non-empty text.");
  }
  const query = value.trim().replace(/\s+/g, " ");
  if (query.length > 200) throw badRequest("invalid_query", "Query must be 200 characters or fewer.");
  return query;
}

function normalizeLimit(value) {
  if (value === undefined) return 5;
  if (!Number.isInteger(value) || value < 1 || value > 25) {
    throw badRequest("invalid_limit", "Limit must be an integer between 1 and 25.");
  }
  return value;
}

function normalizeFrontierLimit(value) {
  if (value === undefined) return 50;
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw badRequest("invalid_limit", "Limit must be an integer between 1 and 100.");
  }
  return value;
}

function normalizeFrontierStatuses(value) {
  if (value === undefined) return [...FRONTIER_STATUSES];
  if (!Array.isArray(value) || value.length === 0) {
    throw badRequest("invalid_status_filter", "Status must be a non-empty array.");
  }
  if (value.length > FRONTIER_STATUSES.length || new Set(value).size !== value.length) {
    throw badRequest(
      "invalid_status_filter",
      "Status may contain unknown and unassessed at most once each."
    );
  }
  for (const status of value) {
    if (!FRONTIER_STATUSES.includes(status)) {
      throw badRequest(
        "invalid_status_filter",
        "Frontier status filters may contain only unknown and unassessed."
      );
    }
  }
  return FRONTIER_STATUSES.filter((status) => value.includes(status));
}

function encodeFrontierCursor({ lastId, parentId, statuses }) {
  return Buffer.from(JSON.stringify({
    v: 1,
    last_id: lastId,
    parent_id: parentId,
    status: statuses
  })).toString("base64url");
}

function decodeFrontierCursor(value, { parentId, statuses }) {
  if (value == null) return 0;
  if (typeof value !== "string" || !value || value.length > 1000) {
    throw badRequest("invalid_cursor", "Cursor must be null or a valid cursor string.");
  }
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const validShape = decoded?.v === 1
      && Number.isInteger(decoded.last_id)
      && decoded.last_id > 0
      && (decoded.parent_id === null || (Number.isInteger(decoded.parent_id) && decoded.parent_id > 0))
      && Array.isArray(decoded.status);
    if (!validShape) throw new Error("Invalid cursor payload.");
    if (decoded.parent_id !== parentId
      || JSON.stringify(decoded.status) !== JSON.stringify(statuses)) {
      throw badRequest(
        "cursor_filter_mismatch",
        "Cursor was created for different frontier filters. Restart with cursor: null."
      );
    }
    return decoded.last_id;
  } catch (error) {
    if (error?.code === "cursor_filter_mismatch") throw error;
    throw badRequest("invalid_cursor", "Cursor is malformed. Restart with cursor: null.");
  }
}

function normalizeExpectedRevision(value) {
  return requireInteger(value, "expected_revision");
}

function normalizeRequestedChildren(value, field) {
  if (!Array.isArray(value)) throw badRequest("invalid_children", `${field} must be an array of names.`);
  if (value.length > 100) throw badRequest("too_many_children", `${field} cannot contain more than 100 names.`);

  const unique = [];
  const conflicting = [];
  const seen = new Set();
  for (const candidate of value) {
    const name = normalizeName(candidate);
    const key = name.toLocaleLowerCase("en-US");
    if (seen.has(key)) conflicting.push(name);
    else {
      seen.add(key);
      unique.push({ key, name });
    }
  }
  return { conflicting, unique };
}

function assertAgentInput(input, allowedFields, operation) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw badRequest("invalid_input", `${operation} input must be a JSON object.`);
  }
  const unexpected = Object.keys(input).filter((field) => !allowedFields.includes(field));
  if (unexpected.length) {
    throw badRequest("unexpected_field", `${operation} does not accept: ${unexpected.join(", ")}.`, {
      fields: unexpected
    });
  }
}

function publicNode(row) {
  return {
    id: row.id,
    name: row.name,
    branch: row.branch,
    parentId: row.parent_id,
    status: row.status,
    understanding: row.understanding,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function sqliteConflict(error, message) {
  if (String(error?.message).includes("UNIQUE constraint failed")) {
    throw conflict("duplicate", message);
  }
  throw error;
}

function invalidExport(message, path = null) {
  throw badRequest("invalid_export", message, path ? { path } : undefined);
}

function assertExportObject(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    invalidExport(`${path} must be an object.`, path);
  }
}

function assertExportFields(value, requiredFields, path) {
  assertExportObject(value, path);
  const required = new Set(requiredFields);
  const missing = requiredFields.filter((field) => !(field in value));
  const unexpected = Object.keys(value).filter((field) => !required.has(field));
  if (missing.length) invalidExport(`${path} is missing: ${missing.join(", ")}.`, path);
  if (unexpected.length) invalidExport(`${path} contains unsupported fields: ${unexpected.join(", ")}.`, path);
}

function assertExportId(value, path) {
  if (!Number.isSafeInteger(value) || value < 1) {
    invalidExport(`${path} must be a positive safe integer.`, path);
  }
}

function assertExportTimestamp(value, path) {
  if (typeof value !== "string" || !value || !Number.isFinite(Date.parse(value))) {
    invalidExport(`${path} must be a valid timestamp string.`, path);
  }
}

function validateKnowledgeExport(snapshot) {
  assertExportFields(snapshot, ["format", "format_version", "exported_at", "data"], "export");
  const acceptedFormats = [KNOWLEDGE_EXPORT_FORMAT, ...LEGACY_KNOWLEDGE_EXPORT_FORMATS];
  if (!acceptedFormats.includes(snapshot.format)) {
    throw badRequest(
      "invalid_export_format",
      `Export format must be ${KNOWLEDGE_EXPORT_FORMAT}.`,
      {
        expected: KNOWLEDGE_EXPORT_FORMAT,
        accepted_legacy_formats: LEGACY_KNOWLEDGE_EXPORT_FORMATS,
        received: snapshot.format ?? null
      }
    );
  }
  if (snapshot.format_version !== KNOWLEDGE_EXPORT_VERSION) {
    throw badRequest(
      "unsupported_export_version",
      `Export version ${String(snapshot.format_version)} is not supported.`,
      { supported_versions: [KNOWLEDGE_EXPORT_VERSION], received: snapshot.format_version ?? null }
    );
  }
  assertExportTimestamp(snapshot.exported_at, "export.exported_at");
  assertExportFields(snapshot.data, ["nodes", "connections", "metadata"], "export.data");
  for (const field of ["nodes", "connections", "metadata"]) {
    if (!Array.isArray(snapshot.data[field])) invalidExport(`export.data.${field} must be an array.`, `export.data.${field}`);
  }

  const nodesById = new Map();
  const siblingKeys = new Set();
  for (const [index, node] of snapshot.data.nodes.entries()) {
    const path = `export.data.nodes[${index}]`;
    assertExportFields(node, [
      "id", "name", "branch", "parentId", "status", "understanding", "revision", "createdAt", "updatedAt"
    ], path);
    assertExportId(node.id, `${path}.id`);
    if (nodesById.has(node.id)) invalidExport(`Node id ${node.id} appears more than once.`, `${path}.id`);
    if (typeof node.name !== "string"
      || node.name !== node.name.trim().replace(/\s+/g, " ")
      || node.name.length < 1
      || node.name.length > 120) {
      invalidExport(`${path}.name must be normalized text between 1 and 120 characters.`, `${path}.name`);
    }
    if (!BRANCHES.some((branch) => branch.id === node.branch)) {
      invalidExport(`${path}.branch must be subjects or ideologies.`, `${path}.branch`);
    }
    if (node.parentId !== null) assertExportId(node.parentId, `${path}.parentId`);
    if (!STATUSES.includes(node.status)) {
      invalidExport(`${path}.status must be unassessed, unknown, or known.`, `${path}.status`);
    }
    if (node.status === "known") {
      if (typeof node.understanding !== "string"
        || node.understanding !== node.understanding.trim()
        || node.understanding.length < 1
        || node.understanding.length > 2000) {
        invalidExport(`${path}.understanding must be meaningful normalized text for a known node.`, `${path}.understanding`);
      }
    } else if (node.understanding !== null) {
      invalidExport(`${path}.understanding must be null unless the node is known.`, `${path}.understanding`);
    }
    assertExportId(node.revision, `${path}.revision`);
    assertExportTimestamp(node.createdAt, `${path}.createdAt`);
    assertExportTimestamp(node.updatedAt, `${path}.updatedAt`);

    const siblingKey = `${node.branch}:${node.parentId ?? "root"}:${node.name.toLocaleLowerCase("en-US")}`;
    if (siblingKeys.has(siblingKey)) {
      invalidExport(`Duplicate sibling name ${node.name}.`, `${path}.name`);
    }
    siblingKeys.add(siblingKey);
    nodesById.set(node.id, node);
  }

  const orderedNodes = [];
  const visitState = new Map();
  const visit = (node) => {
    const state = visitState.get(node.id);
    if (state === "visiting") invalidExport(`Node ${node.id} participates in a parent cycle.`, "export.data.nodes");
    if (state === "visited") return;
    visitState.set(node.id, "visiting");
    if (node.parentId !== null) {
      const parent = nodesById.get(node.parentId);
      if (!parent) invalidExport(`Node ${node.id} refers to missing parent ${node.parentId}.`, "export.data.nodes");
      if (parent.branch !== node.branch) {
        invalidExport(`Node ${node.id} must use the same branch as parent ${parent.id}.`, "export.data.nodes");
      }
      if (parent.status !== "known") {
        invalidExport(`Node ${node.id} cannot be beneath non-known parent ${parent.id}.`, "export.data.nodes");
      }
      visit(parent);
    }
    visitState.set(node.id, "visited");
    orderedNodes.push(node);
  };
  for (const node of nodesById.values()) visit(node);

  const connectionIds = new Set();
  const connectionPairs = new Set();
  for (const [index, connection] of snapshot.data.connections.entries()) {
    const path = `export.data.connections[${index}]`;
    assertExportFields(connection, ["id", "sourceId", "targetId", "createdAt"], path);
    assertExportId(connection.id, `${path}.id`);
    assertExportId(connection.sourceId, `${path}.sourceId`);
    assertExportId(connection.targetId, `${path}.targetId`);
    assertExportTimestamp(connection.createdAt, `${path}.createdAt`);
    if (connectionIds.has(connection.id)) invalidExport(`Connection id ${connection.id} appears more than once.`, `${path}.id`);
    if (!nodesById.has(connection.sourceId) || !nodesById.has(connection.targetId)) {
      invalidExport(`Connection ${connection.id} refers to a missing node.`, path);
    }
    if (connection.sourceId >= connection.targetId) {
      invalidExport(`${path} must store the smaller node id as sourceId.`, path);
    }
    const pair = `${connection.sourceId}:${connection.targetId}`;
    if (connectionPairs.has(pair)) invalidExport(`Connection pair ${pair} appears more than once.`, path);
    connectionIds.add(connection.id);
    connectionPairs.add(pair);
  }

  const metadataKeys = new Set();
  for (const [index, entry] of snapshot.data.metadata.entries()) {
    const path = `export.data.metadata[${index}]`;
    assertExportFields(entry, ["key", "value"], path);
    if (typeof entry.key !== "string" || !entry.key) invalidExport(`${path}.key must be non-empty text.`, `${path}.key`);
    if (typeof entry.value !== "string") invalidExport(`${path}.value must be text.`, `${path}.value`);
    if (metadataKeys.has(entry.key)) invalidExport(`Metadata key ${entry.key} appears more than once.`, `${path}.key`);
    metadataKeys.add(entry.key);
  }

  return { ...snapshot.data, orderedNodes };
}

export class KnowledgeBase {
  constructor(database) {
    this.database = database;
  }

  close() {
    this.database.close();
  }

  listNodes() {
    return this.database
      .prepare("SELECT * FROM nodes ORDER BY name COLLATE NOCASE, id")
      .all()
      .map(publicNode);
  }

  getTree() {
    const nodes = this.listNodes();
    const byParent = new Map();
    for (const node of nodes) {
      const key = node.parentId ?? `branch:${node.branch}`;
      const siblings = byParent.get(key) ?? [];
      siblings.push(node);
      byParent.set(key, siblings);
    }

    const build = (node) => ({ ...node, children: (byParent.get(node.id) ?? []).map(build) });
    return BRANCHES.map((branch) => ({
      ...branch,
      virtual: true,
      children: (byParent.get(`branch:${branch.id}`) ?? []).map(build)
    }));
  }

  exportKnowledgeBase() {
    return {
      format: KNOWLEDGE_EXPORT_FORMAT,
      format_version: KNOWLEDGE_EXPORT_VERSION,
      exported_at: now(),
      data: {
        nodes: this.database.prepare("SELECT * FROM nodes ORDER BY id").all().map(publicNode),
        connections: this.database.prepare("SELECT * FROM connections ORDER BY id").all().map((row) => ({
          id: row.id,
          sourceId: row.source_id,
          targetId: row.target_id,
          createdAt: row.created_at
        })),
        metadata: this.database.prepare("SELECT key, value FROM app_metadata ORDER BY key").all()
          .map((entry) => ({ key: entry.key, value: entry.value }))
      }
    };
  }

  importKnowledgeBase(snapshot) {
    const validated = validateKnowledgeExport(snapshot);
    return this.#inTransaction(() => {
      this.database.prepare("DELETE FROM connections").run();
      const deleteLeaves = this.database.prepare(`
        DELETE FROM nodes
        WHERE NOT EXISTS (SELECT 1 FROM nodes child WHERE child.parent_id = nodes.id)
      `);
      while (this.database.prepare("SELECT count(*) AS count FROM nodes").get().count > 0) {
        if (deleteLeaves.run().changes === 0) {
          throw new Error("Stored node hierarchy could not be cleared.");
        }
      }
      this.database.prepare("DELETE FROM app_metadata").run();

      const insertNode = this.database.prepare(`
        INSERT INTO nodes (
          id, name, branch, parent_id, status, understanding, revision, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const node of validated.orderedNodes) {
        insertNode.run(
          node.id,
          node.name,
          node.branch,
          node.parentId,
          node.status,
          node.understanding,
          node.revision,
          node.createdAt,
          node.updatedAt
        );
      }

      const insertConnection = this.database.prepare(`
        INSERT INTO connections (id, source_id, target_id, created_at) VALUES (?, ?, ?, ?)
      `);
      for (const connection of validated.connections) {
        insertConnection.run(connection.id, connection.sourceId, connection.targetId, connection.createdAt);
      }

      const insertMetadata = this.database.prepare("INSERT INTO app_metadata (key, value) VALUES (?, ?)");
      for (const entry of validated.metadata) insertMetadata.run(entry.key, entry.value);

      return {
        format_version: KNOWLEDGE_EXPORT_VERSION,
        nodes_imported: validated.nodes.length,
        connections_imported: validated.connections.length
      };
    });
  }

  searchKnowledge(input) {
    assertAgentInput(input, ["query", "parent_id", "branch", "limit"], "search_knowledge");
    const query = normalizeQuery(input?.query);
    const queryKey = query.toLocaleLowerCase("en-US");
    const branch = input?.branch == null ? null : normalizeBranch(input.branch);
    const parentId = input?.parent_id == null ? null : requireInteger(input.parent_id, "parent_id");
    const limit = normalizeLimit(input?.limit);

    let candidates;
    if (parentId === null) {
      candidates = branch === null
        ? this.database.prepare("SELECT * FROM nodes").all()
        : this.database.prepare("SELECT * FROM nodes WHERE branch = ?").all(branch);
    } else {
      const parent = this.#getNodeRow(parentId);
      if (branch !== null && branch !== parent.branch) {
        throw badRequest("branch_mismatch", "The search branch must match the parent node's branch.");
      }
      candidates = this.database.prepare(`
        WITH RECURSIVE scope(id) AS (
          SELECT id FROM nodes WHERE parent_id = ?
          UNION ALL
          SELECT n.id FROM nodes n JOIN scope s ON n.parent_id = s.id
        )
        SELECT n.* FROM nodes n JOIN scope s ON s.id = n.id
      `).all(parentId);
    }

    return candidates
      .map((row) => {
        const nameKey = row.name.toLocaleLowerCase("en-US");
        const understandingKey = (row.understanding ?? "").toLocaleLowerCase("en-US");
        let rank = Number.POSITIVE_INFINITY;
        if (nameKey === queryKey) rank = 0;
        else if (nameKey.startsWith(queryKey)) rank = 1;
        else if (nameKey.includes(queryKey)) rank = 2;
        else if (understandingKey.includes(queryKey)) rank = 3;
        return { rank, row };
      })
      .filter(({ rank }) => Number.isFinite(rank))
      .sort((left, right) => left.rank - right.rank
        || left.row.name.length - right.row.name.length
        || left.row.name.localeCompare(right.row.name))
      .slice(0, limit)
      .map(({ row }) => ({
        id: row.id,
        name: row.name,
        path: this.#pathForRow(row),
        status: row.status
      }));
  }

  listFrontierNodes(input) {
    assertAgentInput(input, ["parent_id", "status", "limit", "cursor"], "list_frontier_nodes");
    const parentId = input.parent_id == null ? null : requireInteger(input.parent_id, "parent_id");
    const statuses = normalizeFrontierStatuses(input.status);
    const limit = normalizeFrontierLimit(input.limit);
    const lastId = decodeFrontierCursor(input.cursor, { parentId, statuses });

    if (parentId !== null) {
      const parent = this.#getNodeRow(parentId);
      if (parent.branch !== "subjects") {
        throw badRequest(
          "subjects_only",
          "list_frontier_nodes accepts parent IDs from the Subjects tree only."
        );
      }
    }

    const statusPlaceholders = statuses.map(() => "?").join(", ");
    const parentClause = parentId === null ? "" : "AND n.parent_id = ?";
    const parameters = [...statuses];
    if (parentId !== null) parameters.push(parentId);
    parameters.push(lastId, limit + 1);

    const rows = this.database.prepare(`
      SELECT n.id, n.name, n.status, n.parent_id
      FROM nodes n
      JOIN nodes p ON p.id = n.parent_id
      WHERE n.branch = 'subjects'
        AND p.branch = 'subjects'
        AND p.status = 'known'
        AND n.status IN (${statusPlaceholders})
        ${parentClause}
        AND n.id > ?
      ORDER BY n.id ASC
      LIMIT ?
    `).all(...parameters);

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      parent_id: row.parent_id
    }));
    return {
      nodes: page,
      next_cursor: hasMore
        ? encodeFrontierCursor({ lastId: page.at(-1).id, parentId, statuses })
        : null
    };
  }

  getKnowledgeNode(input) {
    assertAgentInput(input, ["node_id"], "get_knowledge_node");
    const id = requireInteger(input.node_id, "node_id");
    const row = this.#getNodeRow(id);
    const parent = row.parent_id === null
      ? null
      : this.database.prepare("SELECT id, name FROM nodes WHERE id = ?").get(row.parent_id);
    const children = this.database.prepare(`
      SELECT id, name, status FROM nodes WHERE parent_id = ? ORDER BY name COLLATE NOCASE, id
    `).all(row.id).map((child) => ({ id: child.id, name: child.name, status: child.status }));

    return {
      id: row.id,
      revision: row.revision,
      name: row.name,
      status: row.status,
      understanding: row.understanding,
      path: this.#pathForRow(row),
      parent: parent ? { id: parent.id, name: parent.name } : null,
      children
    };
  }

  establishKnownNode(input) {
    assertAgentInput(
      input,
      ["node_id", "expected_revision", "understanding", "children"],
      "establish_known_node"
    );
    return this.#mutateKnownNode({
      id: requireInteger(input?.node_id, "node_id"),
      expectedRevision: normalizeExpectedRevision(input?.expected_revision),
      understanding: normalizeUnderstanding(input?.understanding),
      requestedChildren: normalizeRequestedChildren(input?.children, "children"),
      requireAlreadyKnown: false
    });
  }

  updateKnownNode(input) {
    assertAgentInput(
      input,
      ["node_id", "expected_revision", "understanding", "children_to_add"],
      "update_known_node"
    );
    return this.#mutateKnownNode({
      id: requireInteger(input?.node_id, "node_id"),
      expectedRevision: normalizeExpectedRevision(input?.expected_revision),
      understanding: normalizeUnderstanding(input?.understanding),
      requestedChildren: normalizeRequestedChildren(input?.children_to_add, "children_to_add"),
      requireAlreadyKnown: true
    });
  }

  getNode(id) {
    requireInteger(id, "id");
    const row = this.database.prepare("SELECT * FROM nodes WHERE id = ?").get(id);
    if (!row) throw notFound(`Node ${id} does not exist.`);

    const connections = this.database.prepare(`
      SELECT c.id, n.id AS node_id, n.name, n.branch, n.status
      FROM connections c
      JOIN nodes n ON n.id = CASE WHEN c.source_id = ? THEN c.target_id ELSE c.source_id END
      WHERE c.source_id = ? OR c.target_id = ?
      ORDER BY n.name COLLATE NOCASE
    `).all(id, id, id).map((connection) => ({
      id: connection.id,
      node: {
        id: connection.node_id,
        name: connection.name,
        branch: connection.branch,
        status: connection.status
      }
    }));

    const childCount = this.database.prepare("SELECT count(*) AS count FROM nodes WHERE parent_id = ?").get(id).count;
    return { ...publicNode(row), childCount, connections };
  }

  createNode(input) {
    const name = normalizeName(input?.name);
    const branch = normalizeBranch(input?.branch);
    const parentId = input?.parentId == null ? null : requireInteger(input.parentId, "parentId");
    const normalized = normalizeStatusAndUnderstanding(input?.status ?? "unassessed", input?.understanding);

    if (parentId !== null) {
      const parent = this.getNode(parentId);
      if (parent.branch !== branch) {
        throw badRequest("branch_mismatch", "A child must belong to the same branch as its parent.");
      }
      if (parent.status !== "known") {
        throw conflict("parent_not_known", "Only a known node may be decomposed into children.");
      }
    }

    return this.#inTransaction(() => {
      const timestamp = now();
      let result;
      try {
        result = this.database.prepare(`
          INSERT INTO nodes (name, branch, parent_id, status, understanding, revision, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `).run(name, branch, parentId, normalized.status, normalized.understanding, timestamp, timestamp);
      } catch (error) {
        sqliteConflict(error, "A node with this name already exists under that parent.");
      }
      if (parentId !== null) {
        this.database.prepare(`
          UPDATE nodes SET revision = revision + 1, updated_at = ? WHERE id = ?
        `).run(timestamp, parentId);
      }
      return this.getNode(Number(result.lastInsertRowid));
    });
  }

  updateNode(id, input) {
    const current = this.getNode(id);
    const name = input.name === undefined ? current.name : normalizeName(input.name);
    const parentId = input.parentId === undefined
      ? current.parentId
      : input.parentId == null
        ? null
        : requireInteger(input.parentId, "parentId");
    let branch = input.branch === undefined ? current.branch : normalizeBranch(input.branch);
    const status = input.status === undefined ? current.status : input.status;
    const understandingInput = input.understanding === undefined ? current.understanding : input.understanding;
    const normalized = normalizeStatusAndUnderstanding(status, understandingInput);

    if (current.childCount > 0 && normalized.status !== "known") {
      throw conflict("children_require_known_parent", "A node with children must remain known.");
    }

    if (parentId !== null) {
      if (parentId === id) throw badRequest("cycle", "A node cannot be its own parent.");
      const parent = this.getNode(parentId);
      if (parent.status !== "known") {
        throw conflict("parent_not_known", "Only a known node may be decomposed into children.");
      }
      if (this.#isDescendant(parentId, id)) {
        throw badRequest("cycle", "A node cannot be moved beneath one of its descendants.");
      }
      if (input.branch !== undefined && branch !== parent.branch) {
        throw badRequest("branch_mismatch", "A child must belong to the same branch as its parent.");
      }
      branch = parent.branch;
    }

    const transaction = () => {
      try {
        this.database.prepare(`
          UPDATE nodes
          SET name = ?, branch = ?, parent_id = ?, status = ?, understanding = ?,
              revision = revision + 1, updated_at = ?
          WHERE id = ?
        `).run(name, branch, parentId, normalized.status, normalized.understanding, now(), id);
      } catch (error) {
        sqliteConflict(error, "A node with this name already exists under that parent.");
      }

      if (branch !== current.branch || parentId !== current.parentId) {
        this.#updateDescendantsForMove(id, branch);
      }

      const parentsToTouch = new Set();
      if (current.parentId !== null
        && (name !== current.name || normalized.status !== current.status || parentId !== current.parentId)) {
        parentsToTouch.add(current.parentId);
      }
      if (parentId !== null && parentId !== current.parentId) parentsToTouch.add(parentId);
      for (const affectedParentId of parentsToTouch) {
        this.database.prepare(`
          UPDATE nodes SET revision = revision + 1, updated_at = ? WHERE id = ?
        `).run(now(), affectedParentId);
      }
    };

    this.#inTransaction(transaction);
    return this.getNode(id);
  }

  deleteNode(id) {
    const node = this.getNode(id);
    if (node.childCount > 0) {
      throw conflict("node_has_children", "Move or delete this node's children before deleting it.");
    }
    this.#inTransaction(() => {
      this.database.prepare("DELETE FROM nodes WHERE id = ?").run(id);
      if (node.parentId !== null) {
        this.database.prepare(`
          UPDATE nodes SET revision = revision + 1, updated_at = ? WHERE id = ?
        `).run(now(), node.parentId);
      }
    });
  }

  createConnection(input) {
    const first = requireInteger(input?.sourceId, "sourceId");
    const second = requireInteger(input?.targetId, "targetId");
    if (first === second) throw badRequest("self_connection", "A node cannot connect to itself.");
    this.getNode(first);
    this.getNode(second);
    const [sourceId, targetId] = first < second ? [first, second] : [second, first];

    try {
      const result = this.database.prepare(`
        INSERT INTO connections (source_id, target_id, created_at) VALUES (?, ?, ?)
      `).run(sourceId, targetId, now());
      return { id: Number(result.lastInsertRowid), sourceId, targetId };
    } catch (error) {
      sqliteConflict(error, "These nodes are already connected.");
    }
  }

  deleteConnection(id) {
    requireInteger(id, "id");
    const result = this.database.prepare("DELETE FROM connections WHERE id = ?").run(id);
    if (result.changes === 0) throw notFound(`Connection ${id} does not exist.`);
  }

  #getNodeRow(id) {
    const row = this.database.prepare("SELECT * FROM nodes WHERE id = ?").get(id);
    if (!row) throw notFound(`Node ${id} does not exist.`);
    return row;
  }

  #pathForRow(row) {
    const ancestors = this.database.prepare(`
      WITH RECURSIVE ancestors(id, name, parent_id, depth) AS (
        SELECT id, name, parent_id, 0 FROM nodes WHERE id = ?
        UNION ALL
        SELECT n.id, n.name, n.parent_id, a.depth + 1
        FROM nodes n JOIN ancestors a ON a.parent_id = n.id
      )
      SELECT name FROM ancestors ORDER BY depth DESC
    `).all(row.id).map((ancestor) => ancestor.name);
    const branchName = BRANCHES.find((branch) => branch.id === row.branch).name;
    return [branchName, ...ancestors];
  }

  #mutateKnownNode({ id, expectedRevision, understanding, requestedChildren, requireAlreadyKnown }) {
    return this.#inTransaction(() => {
      const row = this.#getNodeRow(id);
      if (row.revision !== expectedRevision) {
        throw conflict(
          "stale_revision",
          `Node ${id} is at revision ${row.revision}, not ${expectedRevision}.`,
          { current_revision: row.revision, expected_revision: expectedRevision }
        );
      }
      if (requireAlreadyKnown && row.status !== "known") {
        throw conflict("node_not_known", "update_known_node can only update an already known node.");
      }

      const timestamp = now();
      const update = this.database.prepare(`
        UPDATE nodes
        SET status = 'known', understanding = ?, revision = revision + 1, updated_at = ?
        WHERE id = ? AND revision = ?
      `).run(understanding, timestamp, id, expectedRevision);
      if (update.changes !== 1) {
        const current = this.#getNodeRow(id);
        throw conflict("stale_revision", `Node ${id} changed before the update could be applied.`, {
          current_revision: current.revision,
          expected_revision: expectedRevision
        });
      }
      if (row.status !== "known" && row.parent_id !== null) {
        this.database.prepare(`
          UPDATE nodes SET revision = revision + 1, updated_at = ? WHERE id = ?
        `).run(timestamp, row.parent_id);
      }

      const existingRows = this.database.prepare(`
        SELECT id, name FROM nodes WHERE parent_id = ? ORDER BY name COLLATE NOCASE, id
      `).all(id);
      const existingByName = new Map(
        existingRows.map((child) => [child.name.toLocaleLowerCase("en-US"), child])
      );
      const childrenCreated = [];
      const childrenExisting = [];

      for (const requested of requestedChildren.unique) {
        const existing = existingByName.get(requested.key);
        if (existing) {
          childrenExisting.push(existing.name);
          continue;
        }
        this.database.prepare(`
          INSERT INTO nodes (
            name, branch, parent_id, status, understanding, revision, created_at, updated_at
          ) VALUES (?, ?, ?, 'unassessed', NULL, 1, ?, ?)
        `).run(requested.name, row.branch, id, timestamp, timestamp);
        childrenCreated.push(requested.name);
        existingByName.set(requested.key, { name: requested.name });
      }

      return {
        node: {
          id,
          revision: expectedRevision + 1,
          status: "known",
          understanding
        },
        children_created: childrenCreated,
        children_existing: childrenExisting,
        children_conflicting: requestedChildren.conflicting
      };
    });
  }

  #inTransaction(operation) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  #isDescendant(candidateId, ancestorId) {
    const result = this.database.prepare(`
      WITH RECURSIVE descendants(id) AS (
        SELECT id FROM nodes WHERE parent_id = ?
        UNION ALL
        SELECT n.id FROM nodes n JOIN descendants d ON n.parent_id = d.id
      )
      SELECT 1 AS found FROM descendants WHERE id = ? LIMIT 1
    `).get(ancestorId, candidateId);
    return Boolean(result);
  }

  #updateDescendantsForMove(id, branch) {
    this.database.prepare(`
      WITH RECURSIVE descendants(id) AS (
        SELECT id FROM nodes WHERE parent_id = ?
        UNION ALL
        SELECT n.id FROM nodes n JOIN descendants d ON n.parent_id = d.id
      )
      UPDATE nodes
      SET branch = ?, revision = revision + 1, updated_at = ?
      WHERE id IN (SELECT id FROM descendants)
    `).run(id, branch, now());
  }
}

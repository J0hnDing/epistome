import { renderTermList } from "./terms.js";

const state = {
  branches: [],
  nodes: [],
  selected: null,
  collapsedBranches: new Set(),
  collapsedNodes: new Set(),
  disclosureInitialized: false,
  noticeTimer: null
};

const elements = Object.fromEntries([
  "tree", "knownCount", "frontierCount", "unassessedCount", "notice", "main",
  "welcome", "branchView", "branchName", "branchDescription", "branchRule", "nodeView",
  "nodePath", "nodeName", "nodeStatus", "nodeContent", "nodeExplanation", "nodeTerms",
  "nodeTermsEmpty", "nodeBranch", "nodeChildren",
  "connections", "addNodeButton", "welcomeAddButton", "branchAddButton", "addChildButton",
  "editNodeButton", "deleteNodeButton", "addConnectionButton", "nodeDialog", "nodeForm",
  "nodeDialogTitle", "editingNodeId", "nameInput", "branchInput", "parentInput", "statusInput",
  "understandingField", "understandingInput", "nodeFormError", "saveNodeButton", "connectionDialog",
  "connectionForm", "connectionTarget", "connectionFormError", "exportButton", "importButton",
  "importFileInput", "collapseAllButton", "expandAllButton"
].map((id) => [id, document.getElementById(id)]));

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json", ...options.headers } : options.headers
  });
  if (response.status === 204) return null;
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? "The request failed.");
  return payload;
}

function showNotice(message, isError = false) {
  clearTimeout(state.noticeTimer);
  elements.notice.textContent = message;
  elements.notice.classList.toggle("error", isError);
  elements.notice.hidden = false;
  state.noticeTimer = setTimeout(() => { elements.notice.hidden = true; }, 4200);
}

function exportFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `epistome-${timestamp}.json`;
}

async function chooseExportHandle(suggestedName) {
  if (!("showSaveFilePicker" in window)) return null;
  return window.showSaveFilePicker({
    suggestedName,
    types: [{
      description: "Epistome export",
      accept: { "application/json": [".json"] }
    }]
  });
}

async function saveExport(snapshot, handle, suggestedName) {
  const contents = JSON.stringify(snapshot, null, 2);
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
    return;
  }

  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function setTransferBusy(busy) {
  elements.exportButton.disabled = busy;
  elements.importButton.disabled = busy;
}

function labelStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function makeDisclosureButton({ label, expanded, controls, onToggle }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tree-toggle";
  button.classList.toggle("expanded", expanded);
  button.textContent = ">";
  button.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${label}`);
  button.setAttribute("aria-expanded", String(expanded));
  button.setAttribute("aria-controls", controls);
  button.addEventListener("click", onToggle);
  return button;
}

function makeTreeItem(node) {
  const item = document.createElement("li");
  const row = document.createElement("div");
  row.className = "tree-row";
  const childrenId = `tree-node-${node.id}-children`;
  const expanded = !state.collapsedNodes.has(node.id);

  if (node.children.length) {
    row.append(makeDisclosureButton({
      label: node.name,
      expanded,
      controls: childrenId,
      onToggle: () => {
        if (expanded) state.collapsedNodes.add(node.id);
        else state.collapsedNodes.delete(node.id);
        renderTree();
      }
    }));
  } else {
    const spacer = document.createElement("span");
    spacer.className = "tree-toggle-spacer";
    spacer.setAttribute("aria-hidden", "true");
    row.append(spacer);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "tree-button";
  button.classList.toggle("selected", state.selected?.type === "node" && state.selected.id === node.id);
  button.dataset.nodeId = node.id;
  const dot = document.createElement("span");
  dot.className = `tree-dot ${node.status}`;
  const name = document.createElement("span");
  name.textContent = node.name;
  button.append(dot, name);
  if (node.children.length && !expanded) {
    const count = document.createElement("span");
    count.className = "tree-child-count";
    count.textContent = String(node.children.length);
    count.setAttribute("aria-label", `${node.children.length} hidden children`);
    button.append(count);
  }
  button.addEventListener("click", () => selectNode(node.id));
  row.append(button);
  item.append(row);

  if (node.children.length) {
    const list = document.createElement("ul");
    list.className = "tree-list";
    list.id = childrenId;
    list.hidden = !expanded;
    node.children.forEach((child) => list.append(makeTreeItem(child)));
    item.append(list);
  }
  return item;
}

function renderTree() {
  elements.tree.replaceChildren();
  for (const branch of state.branches) {
    const list = document.createElement("ul");
    list.className = "tree-list";
    const item = document.createElement("li");
    const row = document.createElement("div");
    row.className = "tree-row";
    const childrenId = `tree-branch-${branch.id}-children`;
    const expanded = !state.collapsedBranches.has(branch.id);
    row.append(makeDisclosureButton({
      label: branch.name,
      expanded,
      controls: childrenId,
      onToggle: () => {
        if (expanded) state.collapsedBranches.add(branch.id);
        else state.collapsedBranches.delete(branch.id);
        renderTree();
      }
    }));

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tree-button branch-button";
    button.classList.toggle("selected", state.selected?.type === "branch" && state.selected.id === branch.id);
    const dot = document.createElement("span");
    dot.className = "tree-dot";
    const name = document.createElement("span");
    name.textContent = branch.name;
    button.append(dot, name);
    if (!expanded && branch.children.length) {
      const count = document.createElement("span");
      count.className = "tree-child-count";
      count.textContent = String(branch.children.length);
      count.setAttribute("aria-label", `${branch.children.length} hidden concepts`);
      button.append(count);
    }
    button.addEventListener("click", () => selectBranch(branch.id));
    row.append(button);
    item.append(row);

    if (branch.children.length) {
      const children = document.createElement("ul");
      children.className = "tree-list";
      children.id = childrenId;
      children.hidden = !expanded;
      branch.children.forEach((node) => children.append(makeTreeItem(node)));
      item.append(children);
    } else {
      const empty = document.createElement("p");
      empty.className = "empty-branch";
      empty.id = childrenId;
      empty.hidden = !expanded;
      empty.textContent = "No concepts yet";
      item.append(empty);
    }
    list.append(item);
    elements.tree.append(list);
  }
}

function updateSummary() {
  elements.knownCount.textContent = state.nodes.filter((node) => node.status === "known").length;
  elements.frontierCount.textContent = state.nodes.filter((node) => node.status === "unknown").length;
  elements.unassessedCount.textContent = state.nodes.filter((node) => node.status === "unassessed").length;
}

async function refresh() {
  const [treePayload, nodesPayload] = await Promise.all([api("/api/tree"), api("/api/nodes")]);
  state.branches = treePayload.branches;
  state.nodes = nodesPayload.nodes;
  if (!state.disclosureInitialized) {
    for (const node of state.nodes) {
      if (state.nodes.some((candidate) => candidate.parentId === node.id)) state.collapsedNodes.add(node.id);
    }
    state.disclosureInitialized = true;
  }
  const existingIds = new Set(state.nodes.map((node) => node.id));
  state.collapsedNodes = new Set([...state.collapsedNodes].filter((id) => existingIds.has(id)));
  renderTree();
  updateSummary();
}

function showOnly(element) {
  [elements.welcome, elements.branchView, elements.nodeView].forEach((view) => { view.hidden = view !== element; });
  elements.main.focus({ preventScroll: true });
}

function termsAlongPath(node) {
  const path = [node];
  let current = node;
  while (current.parentId) {
    current = state.nodes.find((candidate) => candidate.id === current.parentId);
    if (!current) break;
    path.unshift(current);
  }

  return path.flatMap((owner) => owner.terms.map((term) => ({
    ...term,
    sourceName: owner.name,
    isLocal: owner.id === node.id
  })));
}

function renderKnownContent(node) {
  const known = node.status === "known";
  elements.nodeContent.hidden = !known;
  if (!known) {
    elements.nodeExplanation.textContent = "";
    elements.nodeTermsEmpty.hidden = true;
    renderTermList({ document, container: elements.nodeTerms, terms: [] });
    return;
  }

  const terms = termsAlongPath(node);
  elements.nodeExplanation.textContent = node.understanding;
  elements.nodeTermsEmpty.hidden = terms.length !== 0;
  renderTermList({ document, container: elements.nodeTerms, terms });
}

function selectBranch(id) {
  const branch = state.branches.find((candidate) => candidate.id === id);
  if (!branch) return;
  state.selected = { type: "branch", id };
  elements.branchName.textContent = branch.name;
  elements.branchDescription.textContent = branch.description;
  elements.branchRule.textContent = id === "subjects"
    ? "Place a concept here when it primarily describes observable reality, formal relationships, mechanisms, systems, events, or technical methods."
    : "Place a concept here when it primarily expresses values, philosophical positions, interpretations of meaning, or principles for how life or society should operate.";
  showOnly(elements.branchView);
  renderTree();
}

function revealNode(id) {
  let current = state.nodes.find((node) => node.id === id);
  if (!current) return;
  state.collapsedBranches.delete(current.branch);
  while (current.parentId) {
    state.collapsedNodes.delete(current.parentId);
    current = state.nodes.find((node) => node.id === current.parentId);
    if (!current) break;
  }
}

function pathFor(node) {
  const names = [node.name];
  let current = node;
  while (current.parentId) {
    current = state.nodes.find((candidate) => candidate.id === current.parentId);
    if (!current) break;
    names.unshift(current.name);
  }
  names.unshift(node.branch === "subjects" ? "Subjects" : "Ideologies");
  return names.join(" / ");
}

async function selectNode(id) {
  try {
    const { node } = await api(`/api/nodes/${id}`);
    state.selected = { type: "node", id };
    revealNode(id);
    elements.nodePath.textContent = pathFor(node);
    elements.nodeName.textContent = node.name;
    elements.nodeStatus.textContent = labelStatus(node.status);
    elements.nodeStatus.className = `status-badge ${node.status}`;
    renderKnownContent(node);
    elements.nodeBranch.textContent = node.branch === "subjects" ? "Subjects" : "Ideologies";
    elements.nodeChildren.textContent = String(node.childCount);
    elements.addChildButton.hidden = node.status !== "known";
    renderConnections(node);
    showOnly(elements.nodeView);
    renderTree();
  } catch (error) {
    showNotice(error.message, true);
  }
}

elements.collapseAllButton.addEventListener("click", () => {
  state.collapsedBranches = new Set(state.branches.map((branch) => branch.id));
  state.collapsedNodes = new Set(state.nodes
    .filter((node) => state.nodes.some((candidate) => candidate.parentId === node.id))
    .map((node) => node.id));
  renderTree();
});
elements.expandAllButton.addEventListener("click", () => {
  state.collapsedBranches.clear();
  state.collapsedNodes.clear();
  renderTree();
});
function renderConnections(node) {
  elements.connections.replaceChildren();
  if (!node.connections.length) {
    const empty = document.createElement("p");
    empty.className = "empty-copy";
    empty.textContent = "No cross-connections yet.";
    elements.connections.append(empty);
    return;
  }
  for (const connection of node.connections) {
    const row = document.createElement("div");
    row.className = "connection";
    const select = document.createElement("button");
    select.type = "button";
    select.className = "text-button";
    select.textContent = connection.node.name;
    select.addEventListener("click", () => selectNode(connection.node.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove connection to ${connection.node.name}`);
    remove.textContent = "×";
    remove.addEventListener("click", async () => {
      try {
        await api(`/api/connections/${connection.id}`, { method: "DELETE" });
        await selectNode(node.id);
        showNotice("Connection removed.");
      } catch (error) { showNotice(error.message, true); }
    });
    row.append(select, remove);
    elements.connections.append(row);
  }
}

function descendantIds(id) {
  const found = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of state.nodes) {
      if (node.parentId && found.has(node.parentId) && !found.has(node.id)) {
        found.add(node.id);
        changed = true;
      }
    }
  }
  return found;
}

function populateParents(branch, selectedParentId = null, editingId = null) {
  elements.parentInput.replaceChildren();
  const rootOption = document.createElement("option");
  rootOption.value = "";
  rootOption.textContent = `Directly under ${branch === "subjects" ? "Subjects" : "Ideologies"}`;
  elements.parentInput.append(rootOption);

  const excluded = editingId ? descendantIds(editingId) : new Set();
  state.nodes
    .filter((node) => node.branch === branch && node.status === "known" && !excluded.has(node.id))
    .sort((a, b) => pathFor(a).localeCompare(pathFor(b)))
    .forEach((node) => {
      const option = document.createElement("option");
      option.value = node.id;
      option.textContent = pathFor(node);
      elements.parentInput.append(option);
    });
  elements.parentInput.value = selectedParentId == null ? "" : String(selectedParentId);
}

function openNodeDialog({ node = null, branch = "subjects", parentId = null } = {}) {
  elements.nodeForm.reset();
  elements.nodeFormError.hidden = true;
  elements.editingNodeId.value = node?.id ?? "";
  elements.nodeDialogTitle.textContent = node ? "Edit concept" : "Add a concept";
  elements.saveNodeButton.textContent = node ? "Save changes" : "Save concept";
  elements.nameInput.value = node?.name ?? "";
  elements.branchInput.value = node?.branch ?? branch;
  elements.statusInput.value = node?.status ?? "unassessed";
  elements.understandingInput.value = node?.understanding ?? "";
  elements.understandingField.hidden = elements.statusInput.value !== "known";
  populateParents(elements.branchInput.value, node?.parentId ?? parentId, node?.id ?? null);
  elements.nodeDialog.showModal();
  elements.nameInput.focus();
}

elements.statusInput.addEventListener("change", () => {
  elements.understandingField.hidden = elements.statusInput.value !== "known";
  elements.understandingInput.required = elements.statusInput.value === "known";
});
elements.branchInput.addEventListener("change", () => {
  populateParents(elements.branchInput.value, null, Number(elements.editingNodeId.value) || null);
});

elements.nodeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") return elements.nodeDialog.close();
  const id = Number(elements.editingNodeId.value) || null;
  const payload = {
    name: elements.nameInput.value,
    branch: elements.branchInput.value,
    parentId: elements.parentInput.value ? Number(elements.parentInput.value) : null,
    status: elements.statusInput.value,
    understanding: elements.statusInput.value === "known" ? elements.understandingInput.value : null
  };
  try {
    const result = await api(id ? `/api/nodes/${id}` : "/api/nodes", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });
    elements.nodeDialog.close();
    await refresh();
    await selectNode(result.node.id);
    showNotice(id ? "Concept updated." : "Concept added.");
  } catch (error) {
    elements.nodeFormError.textContent = error.message;
    elements.nodeFormError.hidden = false;
  }
});

elements.addNodeButton.addEventListener("click", () => openNodeDialog({
  branch: state.selected?.type === "branch" ? state.selected.id : "subjects",
  parentId: state.selected?.type === "node" ? state.selected.id : null
}));
elements.welcomeAddButton.addEventListener("click", () => openNodeDialog());
elements.branchAddButton.addEventListener("click", () => openNodeDialog({ branch: state.selected.id }));
elements.addChildButton.addEventListener("click", () => {
  const parent = state.nodes.find((node) => node.id === state.selected.id);
  openNodeDialog({ branch: parent.branch, parentId: parent.id });
});
elements.editNodeButton.addEventListener("click", async () => {
  try {
    const { node } = await api(`/api/nodes/${state.selected.id}`);
    openNodeDialog({ node });
  } catch (error) { showNotice(error.message, true); }
});
elements.deleteNodeButton.addEventListener("click", async () => {
  const node = state.nodes.find((candidate) => candidate.id === state.selected.id);
  if (!window.confirm(`Delete “${node.name}”? This cannot be undone.`)) return;
  try {
    await api(`/api/nodes/${node.id}`, { method: "DELETE" });
    state.selected = null;
    await refresh();
    showOnly(elements.welcome);
    showNotice("Concept deleted.");
  } catch (error) { showNotice(error.message, true); }
});

elements.addConnectionButton.addEventListener("click", () => {
  const selectedId = state.selected.id;
  elements.connectionTarget.replaceChildren();
  const connected = new Set();
  api(`/api/nodes/${selectedId}`).then(({ node }) => {
    node.connections.forEach((connection) => connected.add(connection.node.id));
    state.nodes
      .filter((candidate) => candidate.id !== selectedId && !connected.has(candidate.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((candidate) => {
        const option = document.createElement("option");
        option.value = candidate.id;
        option.textContent = `${candidate.name} — ${candidate.branch === "subjects" ? "Subjects" : "Ideologies"}`;
        elements.connectionTarget.append(option);
      });
    elements.connectionFormError.hidden = true;
    elements.connectionDialog.showModal();
  }).catch((error) => showNotice(error.message, true));
});

elements.connectionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") return elements.connectionDialog.close();
  if (!elements.connectionTarget.value) {
    elements.connectionFormError.textContent = "There are no available concepts to connect.";
    elements.connectionFormError.hidden = false;
    return;
  }
  try {
    await api("/api/connections", {
      method: "POST",
      body: JSON.stringify({ sourceId: state.selected.id, targetId: Number(elements.connectionTarget.value) })
    });
    elements.connectionDialog.close();
    await selectNode(state.selected.id);
    showNotice("Connection added.");
  } catch (error) {
    elements.connectionFormError.textContent = error.message;
    elements.connectionFormError.hidden = false;
  }
});

elements.exportButton.addEventListener("click", async () => {
  setTransferBusy(true);
  try {
    const suggestedName = exportFilename();
    const handle = await chooseExportHandle(suggestedName);
    const snapshot = await api("/api/export");
    await saveExport(snapshot, handle, suggestedName);
    showNotice("Complete knowledge base exported.");
  } catch (error) {
    if (error.name !== "AbortError") showNotice(error.message, true);
  } finally {
    setTransferBusy(false);
  }
});

elements.importButton.addEventListener("click", () => {
  elements.importFileInput.value = "";
  elements.importFileInput.click();
});

elements.importFileInput.addEventListener("change", async () => {
  const [file] = elements.importFileInput.files;
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) {
    showNotice("Import files must be 50 MB or smaller.", true);
    return;
  }

  let snapshot;
  try {
    snapshot = JSON.parse(await file.text());
  } catch {
    showNotice("The selected file is not valid JSON.", true);
    return;
  }

  const nodeCount = Array.isArray(snapshot?.data?.nodes) ? snapshot.data.nodes.length : "an unknown number of";
  const confirmed = window.confirm(
    `Import “${file.name}” with ${nodeCount} nodes? This replaces the entire current knowledge base and cannot be undone.`
  );
  if (!confirmed) return;

  setTransferBusy(true);
  try {
    const { imported } = await api("/api/import", {
      method: "POST",
      body: JSON.stringify(snapshot)
    });
    state.selected = null;
    state.collapsedBranches.clear();
    state.collapsedNodes.clear();
    state.disclosureInitialized = false;
    await refresh();
    showOnly(elements.welcome);
    showNotice(`Imported ${imported.nodes_imported} nodes and ${imported.connections_imported} connections.`);
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    setTransferBusy(false);
  }
});

refresh().catch((error) => showNotice(error.message, true));

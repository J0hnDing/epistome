export function renderTermList({ document, container, terms }) {
  container.replaceChildren();

  for (const term of terms) {
    const item = document.createElement("div");
    item.className = "term-list-item";

    const label = document.createElement("dt");
    label.textContent = term.label;
    if (term.sourceName) {
      const source = document.createElement("span");
      source.className = "term-list-source";
      source.textContent = term.isLocal ? "Defined here" : `From ${term.sourceName}`;
      label.append(source);
    }

    const definition = document.createElement("dd");
    definition.textContent = term.definition;
    item.append(label, definition);
    container.append(item);
  }
}
